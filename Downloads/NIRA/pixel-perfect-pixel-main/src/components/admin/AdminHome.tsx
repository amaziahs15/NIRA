import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SoftBadge } from "@/components/nira-primitives";
import { aggregateData } from "@/lib/nira-demo";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { AlertCircle, BarChart2, TrendingUp, Users } from "lucide-react";

// District → approximate lat/lng (Tamil Nadu focus)
const DISTRICT_COORDS: Record<string, [number, number]> = {
  Chennai: [13.08, 80.27],
  Coimbatore: [11.0, 76.96],
  Madurai: [9.93, 78.12],
  Salem: [11.66, 78.14],
  Tiruchirappalli: [10.79, 78.7],
};

const CHART_COLORS = ["#2d7a6e", "#e8a942", "#d85a3a", "#6b7280", "#22c55e"];

interface AggData {
  activeCases: number;
  priorityAlerts: number;
  openAlerts: number;
  improving: number;
  stages: { label: string; value: number }[];
  severity: { label: string; value: number; tone: string }[];
  districts: { label: string; value: number }[];
  trajectory_distribution?: { label: string; value: number }[];
  intervention_status?: { label: string; value: number }[];
}

export default function AdminHome() {
  const [data, setData] = useState<AggData | null>(null);
  const [useDemoData, setUseDemoData] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data: rpcData, error } = await supabase.rpc("get_admin_aggregate_metrics");
        if (!error && rpcData) {
          setData(rpcData as AggData);
        } else {
          setUseDemoData(true);
          setData({
            ...aggregateData,
            trajectory_distribution: [
              { label: "Improving", value: 19 },
              { label: "Stable", value: 15 },
              { label: "Increasing", value: 9 },
              { label: "Priority review", value: 5 },
            ],
            intervention_status: [
              { label: "Recommended", value: 8 },
              { label: "Reviewed", value: 12 },
              { label: "Assigned", value: 10 },
              { label: "In Progress", value: 14 },
              { label: "Outcome Recorded", value: 6 },
            ],
          });
        }
      } catch {
        setUseDemoData(true);
        setData({ ...aggregateData });
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading || !data) {
    return (
      <div className="flex justify-center py-16">
        <div className="size-7 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  const metrics = [
    { label: "Active cases", value: data.activeCases, icon: Users, tone: "brand" as const },
    { label: "Priority alerts", value: data.priorityAlerts, icon: AlertCircle, tone: "priority" as const },
    { label: "Open alerts", value: data.openAlerts, icon: BarChart2, tone: "attention" as const },
    { label: "Improving", value: data.improving, icon: TrendingUp, tone: "improving" as const },
  ];

  return (
    <div className="space-y-6">
      <div className="nira-rise">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-ink">
          Aggregate wellbeing
        </div>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">
          A wider view, without individual details
        </h2>
        {useDemoData && (
          <div className="mt-2">
            <SoftBadge tone="uncertain">Demo data — schema not yet applied to live DB</SoftBadge>
          </div>
        )}
        <p className="mt-2 text-xs text-muted-ink">
          All metrics are aggregated. No individual case or victim data is shown in this view.
        </p>
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
            </div>
          );
        })}
      </div>

      {/* Case stages bar chart */}
      <div className="rounded-[22px] border border-line bg-white/70 p-6 shadow-soft backdrop-blur-md">
        <div className="mb-4 text-xs font-bold uppercase tracking-[0.12em] text-muted-ink">
          Cases by stage
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data.stages} margin={{ left: -15, right: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--text-secondary)" }} />
            <YAxis tick={{ fontSize: 10, fill: "var(--text-secondary)" }} />
            <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
            <Bar dataKey="value" fill="var(--primary)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Severity + Trajectory pie charts */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-[22px] border border-line bg-white/70 p-6 shadow-soft backdrop-blur-md">
          <div className="mb-4 text-xs font-bold uppercase tracking-[0.12em] text-muted-ink">
            Alert severity distribution
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={data.severity} dataKey="value" nameKey="label" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                {data.severity.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-[22px] border border-line bg-white/70 p-6 shadow-soft backdrop-blur-md">
          <div className="mb-4 text-xs font-bold uppercase tracking-[0.12em] text-muted-ink">
            Trajectory distribution
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.trajectory_distribution ?? []} margin={{ left: -15 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--text-secondary)" }} />
              <YAxis tick={{ fontSize: 10, fill: "var(--text-secondary)" }} />
              <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
              <Bar dataKey="value" fill="var(--sage)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Intervention status bar chart */}
      <div className="rounded-[22px] border border-line bg-white/70 p-6 shadow-soft backdrop-blur-md">
        <div className="mb-4 text-xs font-bold uppercase tracking-[0.12em] text-muted-ink">
          Intervention status
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data.intervention_status ?? []} layout="vertical" margin={{ left: 60, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10, fill: "var(--text-secondary)" }} />
            <YAxis dataKey="label" type="category" tick={{ fontSize: 10, fill: "var(--text-secondary)" }} />
            <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
            <Bar dataKey="value" fill="var(--improving)" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* District view — static lookup map */}
      <div className="rounded-[22px] border border-line bg-white/70 p-6 shadow-soft backdrop-blur-md">
        <div className="mb-4 text-xs font-bold uppercase tracking-[0.12em] text-muted-ink">
          District view — aggregated counts only
        </div>
        <p className="mb-4 text-[10px] text-muted-ink">
          Circle size indicates case count. No individual victim location data is shown.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {data.districts.map((d, i) => {
            const maxVal = Math.max(...data.districts.map((x) => x.value));
            const pct = d.value / maxVal;
            const size = Math.round(32 + pct * 48);
            return (
              <div key={d.label} className="flex flex-col items-center gap-2">
                <div
                  className="grid place-items-center rounded-full font-bold text-white shadow-md"
                  style={{
                    width: size,
                    height: size,
                    background: `color-mix(in oklch, var(--primary) ${Math.round(pct * 70 + 30)}%, var(--sage))`,
                    fontSize: size > 56 ? 13 : 11,
                  }}
                >
                  {d.value}
                </div>
                <div className="text-center text-[11px] font-semibold text-ink">{d.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
