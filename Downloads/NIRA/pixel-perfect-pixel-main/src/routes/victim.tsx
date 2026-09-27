import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getNiraProfile, getNiraRole } from "@/lib/nira-auth";
import { NiraShell } from "@/components/nira-shell";
import type { WorkspaceView } from "@/lib/nira-types";
import { t } from "@/lib/nira-i18n";

// Views
import VictimHome from "@/components/victim/VictimHome";
import VictimCheckin from "@/components/victim/VictimCheckin";
import VictimCase from "@/components/victim/VictimCase";
import VictimSupport from "@/components/victim/VictimSupport";
import VictimProfile from "@/components/victim/VictimProfile";
import VictimChat from "@/components/victim/VictimChat";
import { WellbeingChatBubble } from "@/components/victim/WellbeingChatBubble";
import type { ChatMsg } from "@/components/victim/WellbeingChatBubble";

export const Route = createFileRoute("/victim")({
  component: VictimApp,
});

export type VictimData = {
  userId: string;
  victimId: string;
  caseId: string | null;
  name: string;
  language: string;
};

function VictimApp() {
  const navigate = useNavigate();
  const [view, setView] = useState<WorkspaceView>("home");
  const [data, setData] = useState<VictimData | null>(null);
  const [loading, setLoading] = useState(true);

  // Shared chat state — lifted here so bubble and full-page share the same history
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);

  const load = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;
    if (!user) {
      await navigate({ to: "/sign-in" });
      return;
    }
    const role = await getNiraRole(user.id);
    if (role && role !== "victim") {
      await navigate({ to: `/${role}` });
      return;
    }
    const profile = await getNiraProfile(user.id);
    const { data: victim } = await supabase
      .from("victims")
      .select("id, case_id")
      .eq("profile_id", user.id)
      .maybeSingle();

    setData({
      userId: user.id,
      victimId: victim?.id ?? "",
      caseId: victim?.case_id ?? null,
      name: profile?.name ?? "there",
      language: profile?.language ?? "en",
    });
    setLoading(false);
  }, [navigate]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") navigate({ to: "/" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const handleLanguageChange = useCallback(
    async (newLang: string) => {
      setData((prev) => (prev ? { ...prev, language: newLang } : prev));
      try {
        localStorage.setItem("nira_preferred_lang", newLang);
      } catch {
        // ignore
      }
      if (data?.userId) {
        await supabase.from("profiles").update({ language: newLang }).eq("id", data.userId);
      }
    },
    [data?.userId]
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="size-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  if (!data) return null;

  const lang = data.language;

  const renderView = () => {
    switch (view) {
      case "home":
        return <VictimHome data={data} lang={lang} onView={setView} />;
      case "checkin":
        return <VictimCheckin data={data} lang={lang} onDone={() => setView("home")} />;
      case "case":
        return <VictimCase data={data} lang={lang} />;
      case "support":
        return <VictimSupport lang={lang} victimId={data.victimId} />;
      case "profile":
        return (
          <VictimProfile
            data={data}
            lang={lang}
            onUpdate={load}
            onLanguageChange={handleLanguageChange}
          />
        );
      case "chat":
        return (
          <VictimChat
            data={data}
            lang={lang}
            onBack={() => setView("home")}
            initialMessages={chatMessages}
            onMessagesChange={setChatMessages}
            onLanguageChange={handleLanguageChange}
          />
        );
      default:
        return <VictimHome data={data} lang={lang} onView={setView} />;
    }
  };

  return (
    <NiraShell
      role="victim"
      name={data.name}
      view={view}
      onView={setView}
      lang={lang}
      onLanguageChange={handleLanguageChange}
    >
      {renderView()}
      {/* Floating wellbeing chat bubble — visible on every victim screen except full-page chat */}
      {view !== "chat" && (
        <WellbeingChatBubble
          lang={lang}
          victimId={data.victimId}
          onExpand={() => setView("chat")}
          sharedMessages={chatMessages}
          onMessagesChange={setChatMessages}
          onLanguageChange={handleLanguageChange}
        />
      )}
    </NiraShell>
  );
}
