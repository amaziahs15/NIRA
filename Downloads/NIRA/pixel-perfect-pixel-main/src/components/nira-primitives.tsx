import { useMemo } from "react";
import { ArrowRight, Check, CircleAlert, CircleCheck, CircleHelp, Clock3, Info, LockKeyhole, MessageCircle, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { contributionBars, demoTimeline, demoTrend } from "@/lib/nira-demo";

export function NiraMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <img
        src="/nira-mark.png"
        alt="NIRA mark"
        width={compact ? 36 : 44}
        height={compact ? 36 : 44}
        className={cn(
          "rounded-xl object-contain shadow-sm",
          compact ? "size-9" : "size-11"
        )}
      />
      {!compact && (
        <div className="leading-none">
          <div className="text-[15px] font-extrabold tracking-tight text-ink">NIRA</div>
          <div className="mt-0.5 text-[10px] text-muted-ink">wellbeing, gently</div>
        </div>
      )}
    </div>
  );
}

export function SoftBadge({ children, tone = "brand", icon }: { children: React.ReactNode; tone?: "brand" | "stable" | "improving" | "attention" | "priority" | "uncertain"; icon?: React.ReactNode }) {
  const styles = { brand: "bg-brand-soft text-brand", stable: "bg-stable/12 text-stable", improving: "bg-improving/12 text-improving", attention: "bg-attention/12 text-attention", priority: "bg-priority/12 text-priority", uncertain: "bg-uncertain/12 text-uncertain" };
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold", styles[tone])}>{icon ?? <span className="size-1.5 rounded-full bg-current" />}{children}</span>;
}

export function ClosedLoop({ compact = false }: { compact?: boolean }) {
  const steps = ["Detect", "Explain", "Sufficiency check", "Human review", "Support", "Measure", "Adapt"];
  return <div className={cn("flex flex-col items-center gap-4 text-center", compact ? "py-2" : "rounded-[26px] border border-line bg-white/55 p-6 shadow-soft backdrop-blur-xl")}><SoftBadge tone="brand" icon={<Sparkles className="size-3" />}>Closed loop · consent first</SoftBadge><div className="flex max-w-3xl flex-wrap items-center justify-center gap-2">{steps.map((step, index) => <div key={step} className="flex items-center gap-2"><span className={cn("rounded-full px-3 py-1.5 text-[11px] font-semibold", index === 3 ? "bg-brand text-primary-foreground" : "bg-surface/80 text-ink")}>{step}</span>{index < steps.length - 1 && <ArrowRight className="size-3 text-muted-ink" />}</div>)}</div>{!compact && <p className="max-w-xl text-xs leading-relaxed text-muted-ink">Signals create a reason to look closer. People decide what support means. Every next step adds context instead of replacing it.</p>}</div>;
}

export function FlowIllustration() {
  return <div className="relative overflow-hidden rounded-[24px] border border-line bg-white/70 p-5 shadow-soft backdrop-blur-md"><div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-ink"><span>One steady thread</span><span>Held by people</span></div><svg viewBox="0 0 420 190" className="mt-4 h-auto w-full" fill="none" aria-label="A flowing line from lived experience to human support"><path className="nira-draw" pathLength="1" d="M12 158 C 80 158 74 48 154 70 S 228 142 292 94 S 354 36 408 31" stroke="var(--sage)" strokeWidth="3" strokeLinecap="round"/><path d="M12 158 C 80 158 74 48 154 70 S 228 142 292 94 S 354 36 408 31" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" strokeDasharray="0.2 0.8" pathLength="1"/><circle cx="12" cy="158" r="6" fill="var(--sage)"/><circle cx="154" cy="70" r="6" fill="var(--sage)"/><circle cx="292" cy="94" r="6" fill="var(--sage)"/><circle cx="408" cy="31" r="8" fill="var(--primary)"/></svg><div className="flex justify-between text-[11px] text-muted-ink"><span>Lived experience</span><span>Signals</span><span>Human support</span></div></div>;
}

export function ScoreArc({ score, label = "Current view", trend = "Improving", compact = false }: { score: number; label?: string; trend?: string; compact?: boolean }) {
  const radius = compact ? 48 : 68; const circumference = 2 * Math.PI * radius; const progress = Math.min(score / 100, 1) * circumference * 0.75; const dash = `${progress} ${circumference}`;
  return <div className={cn("flex items-center", compact ? "gap-3" : "gap-5")}><div className={cn("relative shrink-0", compact ? "size-28" : "size-40")}><svg viewBox="0 0 180 180" className="size-full -rotate-[135deg]"><circle cx="90" cy="90" r={radius} stroke="var(--primary-soft)" strokeWidth={compact ? 9 : 11} fill="none" strokeLinecap="round" strokeDasharray={`${circumference * .75} ${circumference}`} /><circle cx="90" cy="90" r={radius} stroke="var(--primary)" strokeWidth={compact ? 9 : 11} fill="none" strokeLinecap="round" strokeDasharray={dash} /></svg><div className="absolute inset-0 grid place-items-center text-center"><div><div className={cn("font-extrabold text-brand", compact ? "text-2xl" : "text-4xl")}>{score}</div><div className="text-[10px] text-muted-ink">of 100</div></div></div></div><div><div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-ink">{label}</div><div className="mt-2 flex items-center gap-2 text-sm font-semibold text-ink"><CircleCheck className="size-4 text-improving" />{trend}</div>{!compact && <p className="mt-2 max-w-[24ch] text-xs leading-relaxed text-muted-ink">A view for human review, not a verdict about a person.</p>}</div></div>;
}

export function ContributionBars() {
  return <div className="space-y-4">{contributionBars.map((bar) => <div key={bar.label}><div className="mb-1.5 flex items-center justify-between text-xs"><span className="font-semibold text-ink">{bar.label}</span><span className="text-muted-ink">context signal</span></div><div className="h-2 overflow-hidden rounded-full bg-primary-soft"><div className={cn("h-full rounded-full", bar.tone)} style={{ width: `${bar.value}%` }} /></div></div>)}</div>;
}

export function TrendChart({ highlight = 5 }: { highlight?: number }) {
  const points = useMemo(() => demoTrend.map((value, index) => `${18 + (index * 94)},${136 - value}`).join(" "), []);
  return <div><svg viewBox="0 0 580 160" className="h-auto w-full overflow-visible" fill="none" aria-label="Trajectory line chart"><path d="M18 136H562" stroke="var(--border)" strokeWidth="1"/><path d="M18 86H562" stroke="var(--border)" strokeWidth="1" strokeDasharray="4 6"/><path d={`M${points}`} stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/><path d={`M${points} L 582 160 L 18 160 Z`} fill="var(--primary-soft)" opacity=".55"/>{demoTrend.map((value, index) => <circle key={index} cx={18 + index * 94} cy={136 - value} r={index === highlight ? 6 : 4} fill={index === highlight ? "var(--primary)" : "var(--surface)"} stroke="var(--primary)" strokeWidth="2" />)}</svg><div className="mt-2 flex justify-between text-[10px] text-muted-ink"><span>01 Sep</span><span>08 Sep</span><span>15 Sep</span><span>16 Sep</span><span>23 Sep</span><span>28 Sep</span><span>Today</span></div></div>;
}

export function Timeline({ professional = false }: { professional?: boolean }) {
  return <div className="space-y-4">{demoTimeline.map((item, index) => <div key={`${item.title}-${index}`} className="flex gap-3"><div className="flex flex-col items-center"><div className={cn("mt-1 grid size-8 place-items-center rounded-full", item.type === "case" ? "bg-brand-soft text-brand" : item.type === "support" ? "bg-improving/15 text-improving" : "bg-attention/15 text-attention")}>{item.type === "case" ? <ShieldCheck className="size-4" /> : item.type === "support" ? <MessageCircle className="size-4" /> : <Sparkles className="size-4" />}</div>{index < demoTimeline.length - 1 && <div className="mt-2 h-full w-px bg-border" />}</div><div className="min-w-0 flex-1 pb-2"><div className="flex flex-wrap items-center justify-between gap-2"><div className="text-sm font-semibold text-ink">{item.title}</div><div className="text-[11px] text-muted-ink">{item.date}</div></div><p className="mt-1 text-xs leading-relaxed text-muted-ink">{item.detail}</p>{professional && index === 2 && <SoftBadge tone="attention" icon={<Info className="size-3" />}>Context added to review</SoftBadge>}</div></div>)}</div>;
}

export function SafetyNotice({ children }: { children: React.ReactNode }) { return <div className="flex items-start gap-3 rounded-2xl bg-brand-soft/50 p-4 text-xs leading-relaxed text-muted-ink"><LockKeyhole className="mt-0.5 size-4 shrink-0 text-brand" />{children}</div>; }
export function StatusIcon({ tone }: { tone: string }) { return tone === "priority" ? <CircleAlert className="size-4 text-priority" /> : tone === "attention" ? <Clock3 className="size-4 text-attention" /> : tone === "uncertain" ? <CircleHelp className="size-4 text-uncertain" /> : <CircleCheck className="size-4 text-improving" />; }
export function EmptyState({ title, detail }: { title: string; detail: string }) { return <div className="rounded-2xl border border-dashed border-line bg-white/50 p-8 text-center"><UserRound className="mx-auto size-8 text-sage" /><h3 className="mt-3 text-sm font-bold text-ink">{title}</h3><p className="mt-1 text-xs text-muted-ink">{detail}</p><Button variant="outline" className="mt-4 rounded-full">Return home</Button></div>; }
