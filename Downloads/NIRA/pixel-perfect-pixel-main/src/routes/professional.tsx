import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getNiraProfile, getNiraRole } from "@/lib/nira-auth";
import { NiraShell } from "@/components/nira-shell";
import type { WorkspaceView } from "@/lib/nira-types";
import ProfessionalHome from "@/components/professional/ProfessionalHome";
import ProfessionalReview from "@/components/professional/ProfessionalReview";

export const Route = createFileRoute("/professional")({
  component: ProfessionalApp,
});

export type ProfessionalData = {
  userId: string;
  name: string;
};

function ProfessionalApp() {
  const navigate = useNavigate();
  const [view, setView] = useState<WorkspaceView>("home");
  const [reviewCaseId, setReviewCaseId] = useState<string | null>(null);
  const [data, setData] = useState<ProfessionalData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;
    if (!user) { await navigate({ to: "/sign-in" }); return; }
    const role = await getNiraRole(user.id);
    if (role && role !== "professional") { await navigate({ to: `/${role}` }); return; }
    const profile = await getNiraProfile(user.id);
    setData({ userId: user.id, name: profile?.name ?? "Professional" });
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
  if (!data) return null;

  const handleViewCase = (caseId: string) => {
    setReviewCaseId(caseId);
    setView("review");
  };

  const renderView = () => {
    if (view === "review" && reviewCaseId) {
      return <ProfessionalReview caseId={reviewCaseId} userId={data.userId} onBack={() => setView("home")} />;
    }
    return <ProfessionalHome userId={data.userId} onViewCase={handleViewCase} />;
  };

  return (
    <NiraShell role="professional" name={data.name} view={view} onView={setView}>
      {renderView()}
    </NiraShell>
  );
}
