import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { WorkspaceView } from "@/lib/nira-types";
import type { VictimData } from "@/routes/victim";
import { t } from "@/lib/nira-i18n";
import { SoftBadge, SafetyNotice } from "@/components/nira-primitives";
import { AlertOctagon, ClipboardList, HeartHandshake, ShieldAlert } from "lucide-react";

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
      {/* Greeting */}
      <div className="nira-rise">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-ink">
          {t(lang, "wellbeing_space")}
        </div>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">
          {greeting}, {data.name}
        </h2>
      </div>

      {/* Case card */}
      <CaseCard data={data} lang={lang} />

      {/* Check-in prompt */}
      <div className="rounded-[22px] border border-line bg-surface/80 p-5 shadow-soft backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-ink">{t(lang, "checkin_prompt")}</div>
          <SoftBadge tone="brand">Quick check-in</SoftBadge>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {MOOD_CHIPS.map((m) => (
            <button
              key={m.key}
              id={`mood-chip-${m.key}`}
              onClick={() => onView("checkin")}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface/80 px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-brand hover:bg-brand-soft hover:text-brand"
            >
              <span>{m.emoji}</span>
              {t(lang, m.key)}
            </button>
          ))}
        </div>
      </div>

      {/* Quick action cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <button
          id="home-go-case"
          onClick={() => onView("case")}
          className="group flex items-center gap-4 rounded-[22px] border border-line bg-surface/80 p-5 shadow-soft backdrop-blur-md transition hover:border-brand/30 hover:shadow-md"
        >
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
            <ClipboardList className="size-5" />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-ink group-hover:text-brand">{t(lang, "my_case")}</div>
            <div className="text-xs text-muted-ink">Case updates and timeline</div>
          </div>
        </button>

        <button
          id="home-go-support"
          onClick={() => onView("support")}
          className="group flex items-center gap-4 rounded-[22px] border border-line bg-surface/80 p-5 shadow-soft backdrop-blur-md transition hover:border-improving/30 hover:shadow-md"
        >
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-improving/12 text-improving">
            <HeartHandshake className="size-5" />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-ink group-hover:text-improving">{t(lang, "support")}</div>
            <div className="text-xs text-muted-ink">Resources and connections</div>
          </div>
        </button>
      </div>

      {/* SOS button */}
      {!sosCode ? (
        <button
          id="sos-button"
          onClick={() => setSosOpen(true)}
          className="flex w-full items-center justify-center gap-3 rounded-[22px] bg-priority/10 border border-priority/30 px-6 py-4 text-sm font-bold text-priority transition hover:bg-priority/15"
        >
          <ShieldAlert className="size-5" />
          {t(lang, "sos_btn")}
        </button>
      ) : (
        <div className="rounded-[22px] border border-improving/30 bg-improving/8 p-5 text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-improving">Request received</div>
          <div className="mt-2 text-2xl font-extrabold tracking-tight text-ink">{sosCode}</div>
          <p className="mt-2 text-xs text-muted-ink">
            Your request ID. A professional will reach you shortly. This is a demo workflow.
          </p>
        </div>
      )}

      {/* SOS confirm modal */}
      {sosOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/20 p-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-sm rounded-[26px] border border-line bg-surface p-6 shadow-xl">
            <div className="grid size-12 place-items-center rounded-2xl bg-priority/10 text-priority mx-auto">
              <AlertOctagon className="size-6" />
            </div>
            <h3 className="mt-4 text-center text-base font-extrabold text-ink">Send emergency request?</h3>
            <p className="mt-2 text-center text-xs leading-relaxed text-muted-ink">
              This will create an urgent support request visible to your assigned professional.
              You will receive a request code to track it. This is a demo workflow.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                id="sos-cancel"
                onClick={() => setSosOpen(false)}
                className="rounded-xl border border-line py-3 text-sm font-semibold text-muted-ink"
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
                className="rounded-xl bg-priority py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {sosLoading ? "Sending…" : "Yes, send request"}
              </button>
            </div>
          </div>
        </div>
      )}

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
      <div className="rounded-[22px] border border-dashed border-line bg-surface/50 p-5 text-center text-xs text-muted-ink">
        Your case space is being set up…
      </div>
    );
  }

  return (
    <div className="rounded-[22px] border border-line bg-surface/80 p-5 shadow-soft backdrop-blur-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-ink">
            {lang ? t(lang, "my_case") : "Your case"}
          </div>
          <div className="mt-1 text-lg font-extrabold tracking-tight text-ink">{caseInfo.case_number}</div>
          <div className="mt-1 text-xs text-muted-ink">{caseInfo.status_text}</div>
        </div>
        <SoftBadge tone="brand">{caseInfo.stage}</SoftBadge>
      </div>
      {caseInfo.latestEvent && (
        <div className="mt-4 rounded-xl bg-brand-soft/40 px-4 py-3 text-xs text-muted-ink">
          {caseInfo.latestEvent}
        </div>
      )}
    </div>
  );
}
