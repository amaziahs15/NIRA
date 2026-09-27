import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { demoStages, demoTimeline, contributionBars } from "@/lib/nira-demo";
import { ScoreArc, ContributionBars, ClosedLoop, NiraMark, SoftBadge, Timeline, TrendChart } from "@/components/nira-primitives";
import { ArrowLeft, ArrowRight, Info, ShieldCheck, Sparkles } from "lucide-react";

export const Route = createFileRoute("/demo")({
  component: DemoPage,
});

function DemoPage() {
  const [step, setStep] = useState(0);
  const current = demoStages[step];
  const totalSteps = demoStages.length;
  const progress = ((step + 1) / totalSteps) * 100;

  return (
    <div className="min-h-screen bg-background text-ink">
      {/* Ambient blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="nira-drift absolute -left-32 -top-40 size-[500px] rounded-full bg-brand/8 blur-3xl" />
        <div className="nira-drift-reverse absolute right-0 top-20 size-[600px] rounded-full bg-sage/10 blur-3xl" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6 lg:px-10">
          <NiraMark />
          <div className="flex items-center gap-3">
            <SoftBadge tone="uncertain" icon={<Info className="size-3" />}>
              Demo data only — fictional case
            </SoftBadge>
            <Link
              to="/"
              className="rounded-full border border-line bg-surface/80 px-4 py-2 text-xs font-semibold text-ink hover:bg-surface"
            >
              ← Back
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-5 pb-20 lg:px-10">
          {/* Disclaimer */}
          <div className="mb-8 rounded-[18px] border border-uncertain/30 bg-uncertain/8 px-5 py-3 text-xs text-muted-ink text-center">
            ⚠ All data shown is <strong>fictional</strong> and created for demonstration only. No real individuals are represented.
          </div>

          {/* Progress bar */}
          <div className="mb-2 flex items-center justify-between text-[10px] text-muted-ink">
            <span>Step {step + 1} of {totalSteps}</span>
            <span>{current.eyebrow}</span>
          </div>
          <div className="mb-8 h-1.5 overflow-hidden rounded-full bg-primary-soft">
            <div
              className="h-full rounded-full bg-brand transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Step card */}
          <div className="nira-rise rounded-[26px] border border-line bg-white/75 p-7 shadow-soft backdrop-blur-xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-ink">
              {current.eyebrow}
            </div>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-ink">
              {current.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-ink">
              {current.description}
            </p>
            {current.note && (
              <div className="mt-4 rounded-xl border border-attention/30 bg-attention/8 px-4 py-3 text-xs text-attention">
                <strong>Shared message (demo):</strong> "{current.note}"
              </div>
            )}
            {current.quality && (
              <div className="mt-3">
                <SoftBadge
                  tone={
                    current.quality.includes("Good") ? "improving"
                    : current.quality.includes("excluded") ? "attention"
                    : "uncertain"
                  }
                >
                  Signal: {current.quality}
                </SoftBadge>
              </div>
            )}
          </div>

          {/* Score Arc (when score is defined) */}
          {current.score !== undefined && (
            <div className="mt-6 rounded-[22px] border border-line bg-white/70 p-6 shadow-soft backdrop-blur-md">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-ink mb-4">
                Professional's view — not the victim's score
              </div>
              <ScoreArc
                score={current.score}
                trend={current.trend ?? "Stable"}
                label="Demo wellbeing view"
              />
            </div>
          )}

          {/* Trend chart */}
          <div className="mt-6 rounded-[22px] border border-line bg-white/70 p-6 shadow-soft backdrop-blur-md">
            <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-ink">
              Trajectory overview (demo data)
            </div>
            <TrendChart highlight={step} />
          </div>

          {/* Contribution bars — only when score is defined */}
          {current.score !== undefined && (
            <div className="mt-6 rounded-[22px] border border-line bg-white/70 p-6 shadow-soft backdrop-blur-md">
              <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-ink">
                Signal contributions (demo)
              </div>
              <ContributionBars />
            </div>
          )}

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between">
            <button
              id="demo-prev"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="flex items-center gap-2 rounded-full border border-line bg-surface/80 px-5 py-2.5 text-sm font-semibold text-muted-ink transition hover:text-ink disabled:opacity-40"
            >
              <ArrowLeft className="size-4" />
              Previous
            </button>

            {step < totalSteps - 1 ? (
              <button
                id="demo-next"
                onClick={() => setStep((s) => Math.min(totalSteps - 1, s + 1))}
                className="flex items-center gap-2 rounded-full bg-brand px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand/20 transition hover:bg-brand/90"
              >
                Next
                <ArrowRight className="size-4" />
              </button>
            ) : (
              <Link
                to="/sign-up"
                id="demo-cta"
                className="flex items-center gap-2 rounded-full bg-brand px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand/20 transition hover:bg-brand/90"
              >
                <Sparkles className="size-4" />
                Create your space
              </Link>
            )}
          </div>

          {/* Timeline — always shown */}
          <div className="mt-10">
            <div className="mb-4 text-xs font-bold uppercase tracking-[0.12em] text-muted-ink">
              Demo timeline — NIRA-1024
            </div>
            <div className="rounded-[22px] border border-line bg-white/70 p-5 shadow-soft backdrop-blur-md">
              <Timeline />
            </div>
          </div>

          {/* Closed loop */}
          <div className="mt-10">
            <div className="mb-4 text-xs font-bold uppercase tracking-[0.12em] text-muted-ink text-center">
              How NIRA works
            </div>
            <ClosedLoop />
          </div>

          {/* Safety notice */}
          <div className="mt-10 flex items-start gap-3 rounded-2xl bg-brand-soft/50 p-5 text-xs leading-relaxed text-muted-ink">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" />
            This demo uses fictional data. NIRA never exposes raw scores or individual identifiers to victims.
            Professionals only ever see trends and explanations — never raw numbers.
          </div>
        </main>
      </div>
    </div>
  );
}
