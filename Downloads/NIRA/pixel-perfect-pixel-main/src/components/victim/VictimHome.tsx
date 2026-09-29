import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { WorkspaceView } from "@/lib/nira-types";
import type { VictimData } from "@/routes/victim";
import { t } from "@/lib/nira-i18n";
import { executeQuickExit } from "@/lib/quick-exit";
import { SoftBadge, SafetyNotice } from "@/components/nira-primitives";
import {
  AlertOctagon,
  ClipboardList,
  Flame,
  HeartHandshake,
  LogOut,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Wind,
} from "lucide-react";
import { CalmingToolsModal } from "./CalmingToolsModal";
import { SafetyPlanModal } from "./SafetyPlanModal";
import { WellbeingTrendChart } from "./WellbeingTrendChart";

const MOOD_CHIPS = [
  { key: "mood_safe", tone: "improving" as const, emoji: "😌" },
  { key: "mood_hopeful", tone: "improving" as const, emoji: "🌱" },
  { key: "mood_steady", tone: "stable" as const, emoji: "🤝" },
  { key: "mood_neutral", tone: "uncertain" as const, emoji: "😐" },
  { key: "mood_uneasy", tone: "attention" as const, emoji: "😟" },
  { key: "mood_anxious", tone: "attention" as const, emoji: "😰" },
  { key: "mood_distressed", tone: "priority" as const, emoji: "💔" },
  { key: "mood_overwhelmed", tone: "priority" as const, emoji: "🆘" },
];

interface Props {
  data: VictimData;
  lang: string;
  onView: (v: WorkspaceView) => void;
}

export default function VictimHome({ data, lang, onView }: Props) {
  const [sosOpen, setSosOpen] = useState(false);
  const [sosCode, setSosCode] = useState<string | null>(null);
  const [sosLoading, setSosLoading] = useState(false);

  // Calming tools & Safety plan modal states
  const [calmingOpen, setCalmingOpen] = useState(false);
  const [safetyPlanOpen, setSafetyPlanOpen] = useState(false);

  // Quick Exit function: instantly clears storage and redirects to weather.com
  const handleQuickExit = () => {
    executeQuickExit();
  };

  const handleSos = async () => {
    if (!data.victimId) return;
    setSosLoading(true);
    const { data: sos } = await supabase
      .from("sos_requests")
      .insert({ victim_id: data.victimId })
      .select("request_code")
      .single();
    setSosCode(sos?.request_code ?? "SOS-DEMO");
    setSosLoading(false);
  };

  const hour = new Date().getHours();
  const greetKey = hour < 12 ? "greeting" : hour < 17 ? "greeting_afternoon" : "greeting_evening";
  const greeting = t(lang, greetKey);

  return (
    <div className="space-y-6">
      {/* Top Safety Bar with Quick Exit */}
      <div className="flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-2.5 shadow-2xs">
        <div className="hidden sm:flex items-center gap-2 text-xs text-text-secondary">
          <span className="size-2 rounded-full bg-success animate-pulse" />
          <span>Private & encrypted space</span>
        </div>
        <button
          id="quick-exit-btn"
          onClick={handleQuickExit}
          title={t(lang, "quick_exit_desc")}
          className="ml-auto flex items-center gap-1.5 rounded-full bg-danger/10 px-3.5 py-1.5 text-xs font-bold text-danger border border-danger/25 transition hover:bg-danger hover:text-white active:scale-95"
        >
          <LogOut className="size-3.5" />
          <span>{t(lang, "quick_exit")}<span className="hidden sm:inline"> (Esc)</span></span>
        </button>
      </div>

      {/* Greeting & Streak Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 nira-rise">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
            {t(lang, "wellbeing_space")}
          </div>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-text-primary">
            {greeting}, {data.name}
          </h2>
        </div>

        {/* Gentle Streak Badge */}
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 shadow-2xs">
          <div className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
            <Flame className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-text-primary">
              <span>3-Day Reflection Streak</span>
            </div>
            <div className="text-[11px] text-text-muted">{t(lang, "streak_cheer")}</div>
          </div>
        </div>
      </div>

      {/* Case card */}
      <CaseCard data={data} lang={lang} />

      {/* Quick Calming & Safety Tools */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <button
          onClick={() => setCalmingOpen(true)}
          className="nira-card-hover flex items-center justify-between rounded-[22px] border border-border bg-surface p-4 text-left shadow-soft"
        >
          <div className="flex items-center gap-3.5">
            <div className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Wind className="size-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-text-primary">{t(lang, "calm_tools")}</div>
              <div className="text-xs text-text-muted">Box breathing · 5-4-3-2-1 · Nature sounds</div>
            </div>
          </div>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">Open</span>
        </button>

        <button
          onClick={() => setSafetyPlanOpen(true)}
          className="nira-card-hover flex items-center justify-between rounded-[22px] border border-border bg-surface p-4 text-left shadow-soft"
        >
          <div className="flex items-center gap-3.5">
            <div className="grid size-11 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-500">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-text-primary">{t(lang, "safety_plan")}</div>
              <div className="text-xs text-text-muted">Trusted contacts · Safe places · Notes</div>
            </div>
          </div>
          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">View</span>
        </button>
      </div>

      {/* Check-in prompt */}
      <div className="rounded-[22px] border border-border bg-surface p-5 shadow-soft backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-text-primary">{t(lang, "checkin_prompt")}</div>
          <SoftBadge tone="brand">Quick check-in</SoftBadge>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {MOOD_CHIPS.map((m) => (
            <button
              key={m.key}
              id={`mood-chip-${m.key}`}
              onClick={() => onView("checkin")}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-elevated px-3 py-1.5 text-xs font-semibold text-text-primary transition hover:border-primary hover:bg-primary-soft hover:text-primary"
            >
              <span>{m.emoji}</span>
              {t(lang, m.key)}
            </button>
          ))}
        </div>
      </div>

      {/* Wellbeing Trend Chart (7/30/90 days + mood-by-day heatmap) */}
      <WellbeingTrendChart />

      {/* Quick action cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <button
          id="home-go-case"
          onClick={() => onView("case")}
          className="nira-card-hover group flex items-center gap-4 rounded-[22px] border border-border bg-surface p-5 shadow-soft backdrop-blur-md transition hover:border-primary/40"
        >
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
            <ClipboardList className="size-5" />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-text-primary group-hover:text-primary">{t(lang, "my_case")}</div>
            <div className="text-xs text-text-muted">Case updates and timeline</div>
          </div>
        </button>

        <button
          id="home-go-support"
          onClick={() => onView("support")}
          className="nira-card-hover group flex items-center gap-4 rounded-[22px] border border-border bg-surface p-5 shadow-soft backdrop-blur-md transition hover:border-success/40"
        >
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-success/15 text-success">
            <HeartHandshake className="size-5" />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-text-primary group-hover:text-success">{t(lang, "support")}</div>
            <div className="text-xs text-text-muted">Resources and connections</div>
          </div>
        </button>
      </div>

      {/* SOS button */}
      {!sosCode ? (
        <button
          id="sos-button"
          onClick={() => setSosOpen(true)}
          className="flex w-full items-center justify-center gap-3 rounded-[22px] bg-danger/10 border border-danger/30 px-6 py-4 text-sm font-bold text-danger transition hover:bg-danger/15"
        >
          <ShieldAlert className="size-5" />
          {t(lang, "sos_btn")}
        </button>
      ) : (
        <div className="rounded-[22px] border border-success/30 bg-success/10 p-5 text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-success">Request received</div>
          <div className="mt-2 text-2xl font-extrabold tracking-tight text-text-primary">{sosCode}</div>
          <p className="mt-2 text-xs text-text-muted">
            Your request ID. A professional will reach you shortly. This is a demo workflow.
          </p>
        </div>
      )}

      {/* SOS confirm modal */}
      {sosOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-sm rounded-[26px] border border-border bg-surface p-6 shadow-xl">
            <div className="grid size-12 place-items-center rounded-2xl bg-danger/10 text-danger mx-auto">
              <AlertOctagon className="size-6" />
            </div>
            <h3 className="mt-4 text-center text-base font-extrabold text-text-primary">Send emergency request?</h3>
            <p className="mt-2 text-center text-xs leading-relaxed text-text-muted">
              This will create an urgent support request visible to your assigned professional.
              You will receive a request code to track it.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                id="sos-cancel"
                onClick={() => setSosOpen(false)}
                className="rounded-xl border border-border py-3 text-sm font-semibold text-text-secondary"
              >
                {t(lang, "cancel")}
              </button>
              <button
                id="sos-confirm"
                onClick={async () => {
                  setSosOpen(false);
                  await handleSos();
                }}
                disabled={sosLoading}
                className="rounded-xl bg-danger py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {sosLoading ? "Sending…" : "Yes, send request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Calming Tools Modal */}
      <CalmingToolsModal open={calmingOpen} onOpenChange={setCalmingOpen} lang={lang} />

      {/* Safety Plan Modal */}
      <SafetyPlanModal open={safetyPlanOpen} onOpenChange={setSafetyPlanOpen} victimId={data.victimId ?? ""} />

      <SafetyNotice>
        Only your assigned professional can see signals linked to your case. You control what you share,
        and you can pause or end at any time.
      </SafetyNotice>
    </div>
  );
}

function CaseCard({ data, lang }: { data: VictimData; lang?: string }) {
  const [caseInfo, setCaseInfo] = useState<{
    case_number: string;
    stage: string;
    status_text: string;
    latestEvent?: string;
  } | null>(null);

  useState(() => {
    if (!data.caseId) return;
    supabase
      .from("cases")
      .select("case_number, stage, status_text")
      .eq("id", data.caseId)
      .maybeSingle()
      .then(({ data: c }) => {
        if (!c) return;
        supabase
          .from("case_events")
          .select("description")
          .eq("case_id", data.caseId!)
          .order("occurred_at", { ascending: false })
          .limit(1)
          .maybeSingle()
          .then(({ data: ev }) => {
            setCaseInfo({ ...c, latestEvent: ev?.description });
          });
      });
  });

  if (!data.caseId || !caseInfo) {
    return (
      <div className="rounded-[22px] border border-dashed border-border bg-surface/50 p-5 text-center text-xs text-text-muted">
        Your case space is being set up…
      </div>
    );
  }

  return (
    <div className="rounded-[22px] border border-border bg-surface p-5 shadow-soft backdrop-blur-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
            {lang ? t(lang, "my_case") : "Your case"}
          </div>
          <div className="mt-1 text-lg font-extrabold tracking-tight text-text-primary">{caseInfo.case_number}</div>
          <div className="mt-1 text-xs text-text-muted">{caseInfo.status_text}</div>
        </div>
        <SoftBadge tone="brand">{caseInfo.stage}</SoftBadge>
      </div>
      {caseInfo.latestEvent && (
        <div className="mt-4 rounded-xl bg-primary-soft/40 px-4 py-3 text-xs text-text-muted">
          {caseInfo.latestEvent}
        </div>
      )}
    </div>
  );
}
