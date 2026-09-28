import { createFileRoute, Link } from "@tanstack/react-router";
import { FlowIllustration, ClosedLoop, NiraMark, SoftBadge } from "@/components/nira-primitives";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-ink">
      {/* Ambient blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="nira-drift absolute -left-40 -top-48 size-[600px] rounded-full bg-brand/8 blur-3xl" />
        <div className="nira-drift-reverse absolute -right-32 top-20 size-[700px] rounded-full bg-sage/12 blur-3xl" />
        <div className="nira-drift absolute bottom-0 left-1/3 size-[400px] rounded-full bg-brand/5 blur-3xl" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 lg:px-10">
          <NiraMark />
          <div className="flex items-center gap-3">
            <Link
              to="/demo"
              className="hidden rounded-full border border-line bg-surface/80 px-4 py-2 text-sm font-semibold text-ink transition hover:bg-surface sm:block"
            >
              Explore Demo
            </Link>
            <Link
              to="/sign-in"
              className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand/20 transition hover:bg-brand/90"
            >
              Sign In
            </Link>
          </div>
        </header>

        {/* Hero */}
        <main className="mx-auto max-w-6xl px-5 pb-20 pt-12 lg:px-10">
          <div className="nira-rise text-center">
            <SoftBadge tone="brand" icon={<ShieldCheck className="size-3" />}>
              SIH2026 · NIRA-1024 · Consent first
            </SoftBadge>

            {/* Hero logo */}
            <div className="mx-auto mt-8 flex justify-center">
              <img
                src="/nira-logo.png"
                alt="NIRA — Understand change. Explain risk. Connect support."
                className="h-40 w-40 sm:h-52 sm:w-52 rounded-3xl object-contain shadow-xl shadow-brand/10 ring-1 ring-brand/10"
              />
            </div>

            <h1 className="mx-auto mt-8 max-w-3xl text-4xl font-extrabold leading-[1.1] tracking-tight text-ink sm:text-5xl lg:text-6xl">
              Understand change.{" "}
              <span className="text-brand">Explain risk.</span>{" "}
              Connect support.
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-ink sm:text-lg">
              NIRA listens quietly across check-ins, builds a longitudinal picture with explainable signals,
              and brings human reviewers in at exactly the right moment — never instead of them.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                to="/demo"
                className="inline-flex items-center gap-2 rounded-full bg-brand px-7 py-3.5 text-sm font-bold text-white shadow-xl shadow-brand/25 transition hover:bg-brand/90"
              >
                <Sparkles className="size-4" />
                Explore Demo
              </Link>
              <Link
                to="/sign-in"
                className="inline-flex items-center gap-2 rounded-full border border-line bg-white/80 px-7 py-3.5 text-sm font-bold text-ink backdrop-blur transition hover:bg-white"
              >
                Sign In
                <ArrowRight className="size-4" />
              </Link>
            </div>

            {/* New here? sign up */}
            <p className="mt-5 text-xs text-muted-ink">
              First time?{" "}
              <Link to="/sign-up" className="font-semibold text-brand underline underline-offset-2">
                Create your space
              </Link>
            </p>
          </div>

          {/* Flow Illustration */}
          <div className="nira-rise mt-20">
            <FlowIllustration />
          </div>

          {/* Three value pillars */}
          <div className="mt-16 grid gap-5 sm:grid-cols-3">
            {[
              {
                icon: "🎙️",
                title: "Multi-modal signals",
                body: "Voice, text, and patterns across check-ins — never a single data point in isolation.",
              },
              {
                icon: "🔍",
                title: "Explainable by design",
                body: "Every risk view comes with a 'why' — sentiment, emotion, and behaviour context shown side by side.",
              },
              {
                icon: "🤝",
                title: "Human review, always",
                body: "Signals suggest. People decide. No alert triggers action without a professional in the loop.",
              },
            ].map((p) => (
              <div
                key={p.title}
                className="rounded-[24px] border border-line bg-white/60 p-6 shadow-soft backdrop-blur-md transition hover:shadow-md"
              >
                <div className="text-2xl">{p.icon}</div>
                <h3 className="mt-3 text-sm font-bold text-ink">{p.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-ink">{p.body}</p>
              </div>
            ))}
          </div>

          {/* Closed Loop */}
          <div className="mt-16">
            <div className="mb-5 text-center text-xs font-semibold uppercase tracking-[0.14em] text-muted-ink">
              How NIRA works
            </div>
            <ClosedLoop />
          </div>

          {/* Roles */}
          <div className="mt-16 rounded-[26px] border border-line bg-white/60 p-8 shadow-soft backdrop-blur-md">
            <h2 className="text-center text-sm font-bold uppercase tracking-[0.14em] text-muted-ink">
              Who is NIRA for?
            </h2>
            <div className="mt-6 grid gap-6 sm:grid-cols-3">
              {[
                {
                  role: "Victim",
                  tone: "brand" as const,
                  desc: "A private space to check in, share how you're feeling, and see your support journey — on your terms.",
                  cta: "Start your space",
                  href: "/sign-up",
                },
                {
                  role: "Support Professional",
                  tone: "improving" as const,
                  desc: "A clear view of patterns and priorities — with explainable signals and human decision tools.",
                  cta: "Professional sign-in",
                  href: "/sign-in",
                },
                {
                  role: "Admin",
                  tone: "uncertain" as const,
                  desc: "Aggregate wellbeing metrics, district views, and intervention outcomes — no individual details.",
                  cta: "Admin sign-in",
                  href: "/sign-in",
                },
              ].map((r) => (
                <div key={r.role} className="flex flex-col gap-3">
                  <SoftBadge tone={r.tone}>{r.role}</SoftBadge>
                  <p className="text-xs leading-relaxed text-muted-ink">{r.desc}</p>
                  <Link
                    to={r.href}
                    className="mt-auto inline-flex items-center gap-1.5 text-xs font-bold text-brand"
                  >
                    {r.cta} <ArrowRight className="size-3" />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </main>

        <footer className="border-t border-line py-8 text-center text-xs text-muted-ink">
          <div className="flex items-center justify-center gap-2">
            <NiraMark compact />
          </div>
          <p className="mt-3">
            NIRA · SIH2026 · Built with consent at its core · Demo data only
          </p>
        </footer>
      </div>
    </div>
  );
}
