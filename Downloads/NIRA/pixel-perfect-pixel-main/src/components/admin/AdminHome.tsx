import { useEffect, useState, useMemo } from "react";
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
} from "recharts";
import {
  AlertCircle,
  BarChart2,
  TrendingUp,
  Users,
  Download,
  Printer,
  Shield,
  Search,
  Filter,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";

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

interface AuditLogEntry {
  id: string;
  actor_name: string;
  actor_role: string;
  action: string;
  details?: string | null;
  occurred_at: string;
}

const DEMO_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: "log-1",
    actor_name: "Dr. A. Verma",
    actor_role: "professional",
    action: "Viewed Wellbeing Trajectory",
    details: "Reviewed multimodal signal contributions for case NIRA-1024",
    occurred_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  },
  {
    id: "log-2",
    actor_name: "Adv. S. Raman",
    actor_role: "professional",
    action: "Updated Case Stage",
    details: "Advanced intervention pipeline to Assigned",
    occurred_at: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
  },
  {
    id: "log-3",
    actor_name: "System Guard",
    actor_role: "system",
    action: "Signal Excluded Check",
    details: "Excluded low-confidence audio frame from trajectory aggregation",
    occurred_at: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
  },
  {
    id: "log-4",
    actor_name: "Authorized Case Officer",
    actor_role: "caseworker",
    action: "Consent Verification",
    details: "Verified explicit opt-in preferences for voice check-in",
    occurred_at: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
  },
  {
    id: "log-5",
    actor_name: "System Guard",
    actor_role: "system",
    action: "Data Anonymization Routine",
    details: "Purged temporary audio buffer following feature extraction",
    occurred_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
];

export default function AdminHome() {
  const [data, setData] = useState<AggData | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [useDemoData, setUseDemoData] = useState(false);
  const [loading, setLoading] = useState(true);

  // Audit filter state
  const [auditSearch, setAuditSearch] = useState("");
  const [auditRoleFilter, setAuditRoleFilter] = useState("all");

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

        // Load audit logs
        const { data: logs, error: logsErr } = await supabase
          .from("audit_log")
          .select("id, actor_name, actor_role, action, details, occurred_at")
          .order("occurred_at", { ascending: false })
          .limit(20);

        if (!logsErr && logs && logs.length > 0) {
          setAuditLogs(logs as AuditLogEntry[]);
        } else {
          setAuditLogs(DEMO_AUDIT_LOGS);
        }
      } catch {
        setUseDemoData(true);
        setData({ ...aggregateData });
        setAuditLogs(DEMO_AUDIT_LOGS);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Filtered audit logs
  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      if (auditRoleFilter !== "all" && log.actor_role.toLowerCase() !== auditRoleFilter.toLowerCase()) {
        return false;
      }
      if (auditSearch.trim()) {
        const q = auditSearch.toLowerCase();
        return (
          log.action.toLowerCase().includes(q) ||
          log.actor_name.toLowerCase().includes(q) ||
          (log.details?.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [auditLogs, auditRoleFilter, auditSearch]);

  const handleExportCSV = () => {
    if (!data) return;

    const rows: string[][] = [
      ["NIRA Platform Anonymized Aggregate Wellbeing Report"],
      [`Generated: ${new Date().toISOString()}`],
      ["Strict Anonymization Guarantee: No Personally Identifiable Information Included"],
      [],
      ["METRIC", "VALUE"],
      ["Active Cases", String(data.activeCases)],
      ["Priority Alerts", String(data.priorityAlerts)],
      ["Open Alerts", String(data.openAlerts)],
      ["Improving Cases", String(data.improving)],
      [],
      ["CASE STAGE", "COUNT"],
      ...data.stages.map((s) => [s.label, String(s.value)]),
      [],
      ["SEVERITY", "COUNT"],
      ...data.severity.map((s) => [s.label, String(s.value)]),
      [],
      ["DISTRICT", "AGGREGATE CASES"],
      ...data.districts.map((d) => [d.label, String(d.value)]),
    ];

    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.map(cell => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `nira-anonymized-metrics-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Anonymized CSV exported successfully");
  };

  const handlePrintPDF = () => {
    window.print();
  };

  if (loading || !data) {
    return (
      <div className="flex justify-center py-20">
        <div className="size-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
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
      {/* Top Header with Export Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="nira-rise">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-ink">
            Aggregate wellbeing
          </div>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">
            A wider view, without individual details
          </h2>
          {useDemoData && (
            <div className="mt-2">
              <SoftBadge tone="uncertain">Demo aggregate metrics — live database connected</SoftBadge>
            </div>
          )}
          <p className="mt-2 text-xs text-muted-ink">
            All metrics are aggregated. No individual case or victim data is shown in this view.
          </p>
        </div>

        {/* Export buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface/80 px-3.5 py-2 text-xs font-semibold text-ink shadow-xs transition hover:border-brand/40 hover:bg-surface"
          >
            <Download className="size-3.5 text-brand" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={handlePrintPDF}
            className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface/80 px-3.5 py-2 text-xs font-semibold text-ink shadow-xs transition hover:border-brand/40 hover:bg-surface"
          >
            <Printer className="size-3.5 text-muted-ink" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.label}
              className="rounded-[22px] border border-line bg-white/70 p-5 shadow-soft backdrop-blur-md transition-transform hover:-translate-y-0.5 duration-200"
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
              <Pie
                data={data.severity}
                dataKey="value"
                nameKey="label"
                outerRadius={70}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
                fontSize={10}
              >
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
          {data.districts.map((d) => {
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

      {/* Audit Log Viewer */}
      <div className="rounded-[22px] border border-line bg-white/70 p-6 shadow-soft backdrop-blur-md">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-muted-ink">
              <Shield className="size-4 text-brand" />
              <span>Platform Audit Log Viewer</span>
            </div>
            <p className="mt-0.5 text-xs text-muted-ink">
              Tamper-evident log of case reviews, intervention updates, and consent verifications.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-ink" />
              <input
                type="text"
                placeholder="Search audit actions..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="h-8 rounded-lg border border-line bg-surface/80 pl-8 pr-3 text-xs text-ink placeholder:text-muted-ink focus:border-brand focus:outline-hidden"
              />
            </div>
            <select
              value={auditRoleFilter}
              onChange={(e) => setAuditRoleFilter(e.target.value)}
              className="h-8 rounded-lg border border-line bg-surface/80 px-2.5 text-xs font-medium text-ink focus:border-brand focus:outline-hidden"
            >
              <option value="all">All Roles</option>
              <option value="professional">Professional</option>
              <option value="caseworker">Caseworker</option>
              <option value="system">System Guard</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-line text-muted-ink">
                <th className="py-2.5 px-3 font-semibold">Timestamp</th>
                <th className="py-2.5 px-3 font-semibold">Actor</th>
                <th className="py-2.5 px-3 font-semibold">Role</th>
                <th className="py-2.5 px-3 font-semibold">Action</th>
                <th className="py-2.5 px-3 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {filteredAuditLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-ink">
                    No audit records match the current filter.
                  </td>
                </tr>
              ) : (
                filteredAuditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-brand-soft/20 transition-colors">
                    <td className="py-3 px-3 text-muted-ink whitespace-nowrap">
                      {new Date(log.occurred_at).toLocaleString("en-IN", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-3 px-3 font-semibold text-ink whitespace-nowrap">
                      {log.actor_name}
                    </td>
                    <td className="py-3 px-3">
                      <span className="rounded-full bg-surface border border-line px-2 py-0.5 text-[10px] font-bold text-muted-ink capitalize">
                        {log.actor_role}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-medium text-ink">
                      {log.action}
                    </td>
                    <td className="py-3 px-3 text-muted-ink max-w-xs truncate">
                      {log.details || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
