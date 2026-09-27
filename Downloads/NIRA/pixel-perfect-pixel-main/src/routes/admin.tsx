import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getNiraProfile, getNiraRole } from "@/lib/nira-auth";
import { NiraShell } from "@/components/nira-shell";
import type { WorkspaceView } from "@/lib/nira-types";
import AdminHome from "@/components/admin/AdminHome";

export const Route = createFileRoute("/admin")({
  component: AdminApp,
});

function AdminApp() {
  const navigate = useNavigate();
  const [name, setName] = useState("Admin");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<WorkspaceView>("home");

  const load = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;
    if (!user) { await navigate({ to: "/sign-in" }); return; }
    const role = await getNiraRole(user.id);
    if (role && role !== "admin") { await navigate({ to: `/${role}` }); return; }
    const profile = await getNiraProfile(user.id);
    setName(profile?.name ?? "Admin");
    setLoading(false);
  }, [navigate]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") navigate({ to: "/" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="size-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  return (
    <NiraShell role="admin" name={name} view={view} onView={setView}>
      <AdminHome />
    </NiraShell>
  );
}
