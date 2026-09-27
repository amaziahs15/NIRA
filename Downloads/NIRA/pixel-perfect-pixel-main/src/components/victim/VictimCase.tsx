import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { VictimData } from "@/routes/victim";
import { t } from "@/lib/nira-i18n";
import { SoftBadge } from "@/components/nira-primitives";
import { FileHeart, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";

interface CaseEvent {
  id: string;
  event_type: string;
  description: string;
  occurred_at: string;
  source: "case" | "wellbeing";
  trend?: string;
}

interface Props {
  data: VictimData;
  lang: string;
}

export default function VictimCase({ data, lang }: Props) {
  const [caseInfo, setCaseInfo] = useState<{
    case_number: string;
    stage: string;
    status_text: string;
    district: string;
    created_at: string;
  } | null>(null);
  const [timeline, setTimeline] = useState<CaseEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!data.caseId) { setLoading(false); return; }

    async function load() {
      const { data: c } = await supabase
        .from("cases")
        .select("case_number, stage, status_text, district, created_at")
        .eq("id", data.caseId!)
        .maybeSingle();

      const { data: events } = await supabase
        .from("case_events")
        .select("id, event_type, description, occurred_at")
        .eq("case_id", data.caseId!)
        .order("occurred_at", { ascending: false });

      const { data: checkins } = await supabase
        .from("checkins")
        .select("id, mood_label, created_at, scores(trend)")
        .eq("victim_id", data.victimId)
        .order("created_at", { ascending: false })
        .limit(10);

      const merged: CaseEvent[] = [
        ...(events ?? []).map((ev) => ({
          id: ev.id,
          event_type: ev.event_type,
          description: ev.description,
          occurred_at: ev.occurred_at,
          source: "case" as const,
        })),
        ...(checkins ?? []).map((ci: any) => ({
          id: ci.id,
          event_type: "check_in",
          description: `Check-in: ${ci.mood_label}`,
          occurred_at: ci.created_at,
          source: "wellbeing" as const,
          trend: ci.scores?.[0]?.trend,
        })),
      ].sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());

      setCaseInfo(c ?? null);
      setTimeline(merged);
      setLoading(false);
    }
    load();
  }, [data]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="size-7 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  if (!data.caseId || !caseInfo) {
    return (
      <div className="rounded-[22px] border border-dashed border-line bg-surface/50 p-8 text-center text-xs text-muted-ink">
        Your case space is being prepared. Please check again shortly.
      </div>
    );
  }

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="space-y-6">
      <div className="nira-rise">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-ink">
          {t(lang, "my_case")}
        </div>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">
          {caseInfo.case_number}
        </h2>
      </div>

      {/* Case details card */}
      <div className="rounded-[22px] border border-line bg-surface/80 p-5 shadow-soft backdrop-blur-md">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs text-muted-ink">Current stage</div>
            <div className="mt-1 text-base font-bold text-ink">{caseInfo.stage}</div>
          </div>
          <SoftBadge tone="brand"><FileHeart className="size-3" /> Active</SoftBadge>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
          <div>
            <div className="text-muted-ink">Status</div>
            <div className="mt-0.5 font-semibold text-ink">{caseInfo.status_text}</div>
          </div>
          <div>
            <div className="text-muted-ink">District</div>
            <div className="mt-0.5 font-semibold text-ink">{caseInfo.district}</div>
          </div>
          <div>
            <div className="text-muted-ink">Started</div>
            <div className="mt-0.5 font-semibold text-ink">{fmtDate(caseInfo.created_at)}</div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-[22px] border border-line bg-surface/80 p-5 shadow-soft backdrop-blur-md">
        <div className="mb-4 text-xs font-bold uppercase tracking-[0.12em] text-muted-ink">
          Your journey
        </div>
        {timeline.length === 0 && (
          <div className="text-center text-xs text-muted-ink py-6">
            No events yet — your timeline will grow as support progresses.
          </div>
        )}
        <div className="space-y-4">
          {timeline.map((item, idx) => (
            <div key={item.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className={`mt-1 grid size-8 shrink-0 place-items-center rounded-full ${
                  item.source === "case"
                    ? "bg-brand-soft text-brand"
                    : item.trend === "Priority review"
                    ? "bg-priority/12 text-priority"
                    : "bg-improving/12 text-improving"
                }`}>
                  {item.source === "case"
                    ? <ShieldCheck className="size-4" />
                    : item.trend === "Priority review"
                    ? <MessageCircle className="size-4" />
                    : <Sparkles className="size-4" />}
                </div>
                {idx < timeline.length - 1 && (
                  <div className="mt-2 h-full w-px bg-border" />
                )}
              </div>
              <div className="min-w-0 flex-1 pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-ink">{item.description}</div>
                  <div className="text-[11px] text-muted-ink">{fmtDate(item.occurred_at)}</div>
                </div>
                {item.source === "wellbeing" && item.trend && (
                  <div className="mt-1">
                    <SoftBadge
                      tone={
                        item.trend === "Improving" ? "improving"
                        : item.trend === "Priority review" ? "priority"
                        : item.trend?.includes("Increasing") ? "attention"
                        : "uncertain"
                      }
                    >
                      {item.trend}
                    </SoftBadge>
                  </div>
                )}
                <p className="mt-1 text-xs text-muted-ink capitalize">
                  {item.source === "case" ? "Case update" : "Your wellbeing signal"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Micro-assessment */}
      <MicroAssessment victimId={data.victimId} lang={lang} />
    </div>
  );
}

function MicroAssessment({ victimId, lang }: { victimId: string; lang: string }) {
  const PROMPTS = [
    "In the past week, have you felt safe at home?",
    "Is there anything that has been worrying you especially?",
    "Is there someone you can call if you need support right now?",
  ];
  const [answers, setAnswers] = useState<string[]>(["", "", ""]);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!victimId) return;
    const responses = PROMPTS.reduce((acc, q, i) => ({ ...acc, [q]: answers[i] }), {} as Record<string, string>);
    await supabase.from("micro_assessments").insert({ victim_id: victimId, responses });
    setSaved(true);
  };

  if (saved) {
    return (
      <div className="rounded-[22px] border border-improving/30 bg-improving/8 px-5 py-4 text-center text-xs text-improving font-semibold">
        Thank you. Your responses have been saved.
      </div>
    );
  }

  return (
    <div className="rounded-[22px] border border-line bg-surface/80 p-5 shadow-soft backdrop-blur-md">
      <div className="text-xs font-bold uppercase tracking-[0.12em] text-muted-ink mb-1">
        Brief reflection
      </div>
      <p className="text-xs text-muted-ink mb-4">
        A few short questions to help us understand better. Your answers are private.
      </p>
      <div className="space-y-4">
        {PROMPTS.map((prompt, i) => (
          <div key={i}>
            <label className="text-xs font-semibold text-ink">{prompt}</label>
            <textarea
              id={`micro-${i}`}
              rows={2}
              value={answers[i]}
              onChange={(e) => {
                const next = [...answers];
                next[i] = e.target.value;
                setAnswers(next);
              }}
              className="mt-1.5 w-full resize-none rounded-xl border border-line bg-background px-3 py-2.5 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              placeholder="Write anything you'd like to share…"
            />
          </div>
        ))}
      </div>
      <button
        id="micro-save"
        onClick={handleSave}
        className="mt-4 w-full rounded-xl bg-brand-soft py-2.5 text-sm font-bold text-brand transition hover:bg-brand/10"
      >
        Save responses
      </button>
    </div>
  );
}
