import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SoftBadge, StatusIcon } from "@/components/nira-primitives";
import { aggregateData, reviewQueue } from "@/lib/nira-demo";
import { BarChart2, ClipboardList, ShieldAlert, TrendingUp } from "lucide-react";

interface Alert {
  id: string;
  severity: string;
  created_at: string;
  victim_id: string;
  victims: {
    profile_id: string;
    cases: { case_number: string; stage: string }[];
  } | null;
}

interface Props {
  userId: string;
  onViewCase: (caseId: string) => void;
}

export default function ProfessionalHome({ userId, onViewCase }: Props) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [caseCount, setCaseCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [useDemoData, setUseDemoData] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: cases, error: casesErr } = await supabase
        .from("cases")
        .select("id", { count: "exact" })
        .eq("assigned_professional", userId);

      if (!casesErr) setCaseCount(cases?.length ?? 0);

      const { data: alertData, error: alertErr } = await supabase
        .from("alerts")
        .select(`id, severity, created_at, victim_id, victims(profile_id, cases(case_number, stage))`)
        .neq("status", "resolved")
        .order("created_at", { ascending: false })
        .limit(10);

      if (!alertErr && alertData && alertData.length > 0) {
        setAlerts(alertData as Alert[]);
      } else {
        setUseDemoData(true);
      }
      setLoading(false);
    }
    load();
  }, [userId]);

  const metrics = [
    { label: "Active cases", value: caseCount || aggregateData.activeCases, icon: ClipboardList, tone: "brand" as const },
    { label: "Priority alerts", value: aggregateData.priorityAlerts, icon: ShieldAlert, tone: "priority" as const },
    { label: "Open alerts", value: aggregateData.openAlerts, icon: BarChart2, tone: "attention" as const },
    { label: "Improving", value: aggregateData.improving, icon: TrendingUp, tone: "improving" as const },
  ];

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="size-7 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  const queue = useDemoData ? reviewQueue : alerts.map((a) => ({
    caseNumber: (a.victims?.cases?.[0]?.case_number) ?? "NIRA-???",
    initials: "??",
    detail: `${a.severity} alert`,
    trend: a.severity === "priority" ? "Priority review" : "Needs attention",
    severity: a.severity,
    summary: `An alert flagged for ${a.severity} review.`,
    caseId: a.id,
  }));

  return (
    <div className="space-y-6">
      <div className="nira-rise">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-ink">
          Support workspace
        </div>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">
          A clear view for human review
        </h2>
        {useDemoData && (
          <div className="mt-2">
            <SoftBadge tone="uncertain">Demo data — no real cases assigned yet</SoftBadge>
          </div>
        )}
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.label}
              className="rounded-[22px] border border-line bg-white/70 p-5 shadow-soft backdrop-blur-md"
            >
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-muted-ink">{m.label}</div>
                <Icon className="size-4 text-muted-ink" />
              </div>
              <div className="mt-3 text-3xl font-extrabold text-ink">{m.value}</div>
              <SoftBadge tone={m.tone} />
            </div>
          );
        })}
      </div>

      {/* Priority Review Queue */}
      <div className="rounded-[22px] border border-line bg-white/70 p-5 shadow-soft backdrop-blur-md">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-xs font-bold uppercase tracking-[0.12em] text-muted-ink">
            Priority review queue
          </div>
          <SoftBadge tone="attention">Human review required</SoftBadge>
        </div>
        <div className="space-y-3">
          {queue.map((item, idx) => (
            <div
              key={idx}
              id={`case-queue-item-${idx}`}
              className="flex items-center gap-4 rounded-xl border border-line bg-surface/60 px-4 py-3 transition hover:border-brand/30 hover:bg-brand-soft/20"
            >
              {/* Initials avatar */}
              <div className={`grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold ${
                item.severity === "priority"
                  ? "bg-priority/12 text-priority"
                  : item.severity === "attention"
                  ? "bg-attention/12 text-attention"
                  : "bg-improving/12 text-improving"
              }`}>
                {item.initials}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-bold text-ink">{item.caseNumber}</div>
                  <SoftBadge
                    tone={
                      item.severity === "priority" ? "priority"
                      : item.severity === "attention" ? "attention"
                      : item.severity === "improving" ? "improving"
                      : "uncertain"
                    }
                  >
                    {item.trend}
                  </SoftBadge>
                </div>
                <div className="mt-0.5 text-xs text-muted-ink">{item.detail}</div>
                <div className="mt-1 text-xs text-muted-ink">{item.summary}</div>
              </div>

              <div className="flex items-center gap-2">
                <StatusIcon tone={item.severity} />
                <button
                  id={`review-case-${idx}`}
                  onClick={() => onViewCase("demo-case-id")}
                  className="shrink-0 rounded-xl bg-brand-soft px-3 py-1.5 text-xs font-bold text-brand transition hover:bg-brand/10"
                >
                  Review
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
