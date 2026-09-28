// Supabase Edge Function: invite-professional (NIRA SIH26094)
// Allows administrators to invite caseworkers & support professionals securely

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const authHeader = req.headers.get("Authorization");

    if (!supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is admin
    const callerClient = createClient(supabaseUrl, supabaseServiceKey);
    let callerUserId: string | null = null;
    let callerEmail: string | null = null;

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await callerClient.auth.getUser(token);
      if (user) {
        callerUserId = user.id;
        callerEmail = user.email ?? null;
      }
    }

    if (!callerUserId) {
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid or missing token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if caller has 'admin' role
    const { data: roleRow } = await callerClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUserId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden: Admin privileges required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, name } = await req.json();

    if (!email || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "Valid email address is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Invite user via Supabase Auth Admin API
    const { data: inviteData, error: inviteErr } = await callerClient.auth.admin.inviteUserByEmail(email, {
      data: {
        name: name || "Support Professional",
        role: "professional",
      },
    });

    if (inviteErr) {
      return new Response(JSON.stringify({ error: inviteErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newUserId = inviteData?.user?.id;
    if (newUserId) {
      // Upsert user_roles with role 'professional'
      await callerClient
        .from("user_roles")
        .upsert({ user_id: newUserId, role: "professional" }, { onConflict: "user_id" });

      // Upsert profile
      if (name) {
        await callerClient
          .from("profiles")
          .upsert({ id: newUserId, name }, { onConflict: "id" });
      }
    }

    // Audit log
    await callerClient.from("audit_log").insert({
      actor_id: callerUserId,
      actor_name: callerEmail ?? "Admin",
      actor_role: "admin",
      action: "Invited Professional",
      details: `Sent invitation to ${email} (Name: ${name || "N/A"}). Role: professional.`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Invitation sent to ${email}`,
        user_id: newUserId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
