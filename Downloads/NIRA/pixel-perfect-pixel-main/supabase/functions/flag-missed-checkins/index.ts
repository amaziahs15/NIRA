// Supabase Edge Function: flag-missed-checkins (NIRA SIH26094)
// Daily scheduled detection of participants with no check-in for N days (default 3)

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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let thresholdDays = 3;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body.threshold_days && Number.isInteger(body.threshold_days)) {
          thresholdDays = body.threshold_days;
        }
      } catch {
        // empty body or GET fallback
      }
    }

    // Call the database function flag_missed_checkins
    const { data: flaggedCount, error } = await supabase.rpc("flag_missed_checkins", {
      threshold_days: thresholdDays,
    });

    if (error) {
      console.error("flag_missed_checkins RPC error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log the cron execution in audit_log
    await supabase.from("audit_log").insert({
      actor_name: "Scheduled Cron System",
      actor_role: "system",
      action: "Missed Check-in Scan",
      details: `Scanned active cases (threshold: ${thresholdDays} days). Flagged ${flaggedCount ?? 0} cases for follow-up.`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        threshold_days: thresholdDays,
        flagged_count: flaggedCount ?? 0,
        timestamp: new Date().toISOString(),
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
