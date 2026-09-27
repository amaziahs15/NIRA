import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScoreArc, ContributionBars, SoftBadge, Timeline } from "@/components/nira-primitives";
import { demoStages, contributionBars as demoBars } from "@/lib/nira-demo";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { ArrowLeft, CheckCircle2, ChevronRight, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const SIGNAL_CHIP_STYLES: Record<string, string> = {
  GOOD: "bg-improving/12 text-improving",
  DEGRADED: "bg-attention/12 text-attention",
  EXCLUDED: "bg-priority/12 text-priority",
  UNAVAILABLE: "bg-uncertain/12 text-uncertain",
  UNCERTAIN: "bg-uncertain/12 text-uncertain",
};

const INTERVENTION_STEPS = ["Recommended", "Reviewed", "Assigned", "In Progress", "Outcome Recorded"] as const;
type InterventionStatus = typeof INTERVENTION_STEPS[number];

interface Score {
  id: string;
  composite_score: number;
  sentiment_component: number;
  emotion_component: number;
  behaviour_component: number;
  crisis_flag: boolean;
  signal_quality: Record<string, unknown>;
  trend: string;
  created_at: string;
}

interface Props {
  caseId: string;
  userId: string;
  onBack: () => void;
}

export default function ProfessionalReview({ caseId, userId, onBack }: Props) {
  const [scores, setScores] = useState<Score[]>([]);
  const [latestScore, setLatestScore] = useState<Score | null>(null);
  const [interventionStatus, setInterventionStatus] = useState<InterventionStatus>("Recommended");
  const [interventionId, setInterventionId] = useState<string | null>(null);
  const [updatingStep, setUpdatingStep] = useState<InterventionStatus | null>(null);
  const [useDemoData] = useState(caseId === "demo-case-id");

  useEffect(() => {
    if (useDemoData) {
      const fakeScores: Score[] = demoStages
        .filter((s) => s.score !== undefined)
        .map((s, i) => ({
          id: `demo-${i}`,
          composite_score: s.score!,
          sentiment_component: Math.round(s.score! * 0.9),
          emotion_component: Math.round(s.score! * 0.85),
          behaviour_component: Math.round(s.score! * 0.7),
          crisis_flag: s.score! >= 80,
          signal_quality: { status: s.quality?.includes("excluded") ? "EXCLUDED" : "GOOD", snr: 24, confidence: 0.87 },
          trend: s.trend ?? "Stable",
          created_at: new Date(Date.now() - (demoStages.length - i) * 7 * 86400000).toISOString(),
        }));
      setScores(fakeScores);
      setLatestScore(fakeScores[fakeScores.length - 1]);
      return;
    }
  }, [caseId, useDemoData]);

  const chartData = scores.map((s, i) => ({
    label: new Date(s.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
    score: Math.round(s.composite_score),
    trend: s.trend,
  }));

  const sq = latestScore?.signal_quality as Record<string, unknown> | undefined;
  const qualityStatus = (sq?.status as string) ?? "GOOD";

  const contribBars = latestScore
    ? [
        { label: "Sentiment", value: Math.round(latestScore.sentiment_component), tone: "bg-brand" },
        { label: "Emotion", value: Math.round(latestScore.emotion_component), tone: "bg-attention" },
        { label: "Behaviour", value: Math.round(latestScore.behaviour_component), tone: "bg-sage" },
      ]
    : demoBars;

  const handleStepClick = async (step: InterventionStatus) => {
    setUpdatingStep(step);
    if (!useDemoData && latestScore) {
      if (!interventionId) {
        const { data: newInt } = await supabase
          .from("interventions")
          .insert({ victim_id: latestScore.id, type: "counselling_outreach", status: step, assigned_professional: userId })
          .select("id")
          .single();
        if (newInt) setInterventionId(newInt.id);
      } else {
        await supabase.from("interventions").update({ status: step }).eq("id", interventionId);
      }
    }
    setInterventionStatus(step);
    setUpdatingStep(null);
    toast.success(`Intervention updated: ${step}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          id="review-back"
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-semibold text-muted-ink hover:text-ink"
        >
          <ArrowLeft className="size-4" /> Back to queue
        </button>
      </div>

      {useDemoData && (
        <SoftBadge tone="uncertain">Demo data only — fictional case NIRA-1024</SoftBadge>
      )}

      {/* Score Arc + Signal Quality */}
      {latestScore && (
        <div className="rounded-[22px] border border-line bg-white/70 p-6 shadow-soft backdrop-blur-md">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.12em] text-muted-ink">
                Why did the wellbeing view change?
              </div>
              <p className="mt-0.5 text-xs text-muted-ink">
                Multimodal signal decomposition across speech metrics, sentiment shift, and check-in cadence.
              </p>
            </div>
            <SoftBadge tone="improving" icon={<ShieldCheck className="size-3" />}>
              Decision Support
            </SoftBadge>
          </div>

          {/* PS 26094: Explicit AI Decision-Support Safety Framing */}
          <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-brand/20 bg-brand-soft/40 px-3.5 py-2.5 text-xs text-ink">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-brand" />
            <div>
              <span className="font-bold text-brand">Decision-Support Safeguard:</span> A view for human review, not an automated determination. Algorithmic scores never replace professional casework judgement — all care pathways remain under human review and authority.
            </div>
          </div>

          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            <div className="flex flex-col items-center">
              <ScoreArc
                score={Math.round(latestScore.composite_score)}
                trend={latestScore.trend}
                label="Current view"
              />
              <p className="mt-2 text-center text-[10px] font-medium text-muted-ink max-w-[190px]">
                A view for human review, not an automated determination
              </p>
            </div>
            <div className="flex-1 space-y-5">
              {/* Signal Quality chips */}
              <div>
                <div className="mb-2 text-xs font-semibold text-muted-ink">Signal quality</div>
                <div className="flex flex-wrap gap-2">
                  {(["GOOD", "DEGRADED", "EXCLUDED", "UNAVAILABLE", "UNCERTAIN"] as const).map((chip) => (
                    <span
                      key={chip}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        qualityStatus === chip
                          ? SIGNAL_CHIP_STYLES[chip]
                          : "bg-surface text-muted-ink opacity-40"
                      }`}
                    >
                      {chip}
                    </span>
                  ))}
                </div>
                {sq?.snr && (
                  <div className="mt-1.5 text-[10px] text-muted-ink">
                    SNR: {String(sq.snr)}dB · Confidence: {String(sq.confidence)}
                  </div>
                )}
              </div>

              {/* Contribution Bars */}
              <div>
                <div className="mb-3 text-xs font-semibold text-muted-ink">Signal contributions</div>
                <div className="space-y-3">
                  {contribBars.map((bar) => (
                    <div key={bar.label}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-semibold text-ink">{bar.label}</span>
                        <span className="text-muted-ink">{bar.value}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-primary-soft">
                        <div
                          className={`h-full rounded-full ${bar.tone}`}
                          style={{ width: `${bar.value}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {latestScore.crisis_flag && (
                <div className="rounded-xl bg-priority/10 px-4 py-3 text-xs font-semibold text-priority">
                  ⚠ Crisis keywords detected — human review essential
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Trajectory chart */}
      {chartData.length > 0 && (
        <div className="rounded-[22px] border border-line bg-white/70 p-6 shadow-soft backdrop-blur-md">
          <div className="mb-4 text-xs font-bold uppercase tracking-[0.12em] text-muted-ink">
            Trajectory — over time
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--text-secondary)" }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--text-secondary)" }} />
              <Tooltip
                contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
                labelStyle={{ fontWeight: 700 }}
              />
              <ReferenceLine y={75} stroke="var(--priority)" strokeDasharray="4 4" label={{ value: "Review threshold", fontSize: 10, fill: "var(--priority)" }} />
              <Line
                type="monotone"
                dataKey="score"
                stroke="var(--primary)"
                strokeWidth={3}
                dot={{ fill: "var(--primary)", r: 5 }}
                activeDot={{ r: 7 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Case timeline */}
      <div className="rounded-[22px] border border-line bg-white/70 p-6 shadow-soft backdrop-blur-md">
        <div className="mb-4 text-xs font-bold uppercase tracking-[0.12em] text-muted-ink">
          Case timeline
        </div>
        <Timeline professional />
      </div>

      {/* Intervention workflow stepper */}
      <div className="rounded-[22px] border border-line bg-white/70 p-6 shadow-soft backdrop-blur-md">
        <div className="mb-4 text-xs font-bold uppercase tracking-[0.12em] text-muted-ink">
          Intervention workflow
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {INTERVENTION_STEPS.map((step, i) => {
            const currentIdx = INTERVENTION_STEPS.indexOf(interventionStatus);
            const stepIdx = INTERVENTION_STEPS.indexOf(step);
            const isPast = stepIdx < currentIdx;
            const isCurrent = step === interventionStatus;
            const isNext = stepIdx === currentIdx + 1;
            return (
              <div key={step} className="flex items-center gap-2">
                <button
                  id={`intervention-step-${step.replace(/\s+/g, "-")}`}
                  onClick={() => isNext && handleStepClick(step)}
                  disabled={!isNext || updatingStep !== null}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    isCurrent
                      ? "bg-brand text-white"
                      : isPast
                      ? "bg-improving/15 text-improving"
                      : isNext
                      ? "border border-dashed border-brand text-brand hover:bg-brand-soft"
                      : "bg-surface text-muted-ink opacity-50"
                  }`}
                >
                  {isPast && <CheckCircle2 className="size-3" />}
                  {step}
                  {updatingStep === step && <span className="size-3 animate-spin rounded-full border border-current border-t-transparent" />}
                </button>
                {i < INTERVENTION_STEPS.length - 1 && (
                  <ChevronRight className="size-3 text-muted-ink" />
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-[10px] text-muted-ink">
          Click the next step to advance the intervention. Each step is recorded with your user ID.
        </p>
      </div>

      {/* Human decision buttons */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <button
          id="decision-refer"
          onClick={async () => {
            if (!useDemoData && latestScore) {
              await supabase.from("interventions").insert({
                victim_id: latestScore.id,
                type: "legal_referral",
                status: "Recommended",
                assigned_professional: userId,
              });
            }
            toast.success("Legal referral recorded.");
          }}
          className="rounded-xl border border-line bg-surface/70 px-4 py-3 text-sm font-bold text-ink transition hover:border-brand/30 hover:bg-brand-soft/20"
        >
          Refer for legal support
        </button>
        <button
          id="decision-counselling"
          onClick={() => handleStepClick("Assigned")}
          className="rounded-xl bg-brand py-3 text-sm font-bold text-white shadow-lg shadow-brand/20 transition hover:bg-brand/90"
        >
          Assign counselling
        </button>
        <button
          id="decision-no-action"
          onClick={() => { setInterventionStatus("Reviewed"); toast.success("Marked as reviewed — no further action at this time."); }}
          className="rounded-xl border border-line bg-surface/70 px-4 py-3 text-sm font-bold text-muted-ink transition hover:border-line hover:text-ink"
        >
          No further action
        </button>
      </div>
    </div>
  );
}
