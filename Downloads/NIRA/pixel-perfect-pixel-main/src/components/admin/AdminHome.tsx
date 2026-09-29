import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SoftBadge } from "@/components/nira-primitives";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";
import {
  AlertCircle, TrendingUp, Users, Shield,
  Search, UserCheck, UserX, ClipboardList, Siren,
  Activity, History, CheckCircle2, RefreshCw, Eye, ToggleLeft, ToggleRight,
  FileText, Download, Printer, Settings as SettingsIcon, Send, UserPlus,
  CheckSquare, Square, Sliders, AlertTriangle, MessageSquare, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { fetchOpenSOS, updateSosStatus } from "@/lib/nira-data";

const CHART_COLORS = ["#2d7a6e", "#e8a942", "#d85a3a", "#6b7280", "#22c55e", "#6366f1"];

interface AdminMetrics {
  activeCases: number;
  totalVictims: number;
  totalProfessionals: number;
  unassignedCases: number;
  priorityAlerts: number;
  openAlerts: number;
  openSOS: number;
  improving: number;
  missedCheckins: number;
  checkinsLast7Days: number;
  stages: { label: string; value: number }[];
  severity: { label: string; value: number }[];
  districts: { label: string; value: number }[];
  trajectory_distribution: { label: string; value: number }[];
  intervention_status: { label: string; value: number }[];
  checkinSeries: { date: string; checkins: number }[];
  alertSeries: { date: string; alerts: number }[];
}

interface CaseRow {
  id: string;
  case_number: string;
  stage: string;
  district: string;
  assigned_professional: string | null;
  victim_id: string;
  profile_name: string;
}

interface ProfessionalRow {
  user_id: string;
  name: string;
  email: string;
  caseCount: number;
}

interface AuditEntry {
  id: string;
  actor_name: string;
  actor_role: string;
  action: string;
  details?: string | null;
  occurred_at: string;
}

type AdminTab = "overview" | "analytics" | "cases" | "professionals" | "sos" | "reports" | "settings" | "audit" | "profile";

/** Map WorkspaceView keys (from the sidebar) → AdminTab */
function viewToTab(view: string): AdminTab {
  switch (view) {
    case "admin_overview":      return "overview";
    case "admin_cases":         return "cases";
    case "admin_professionals": return "professionals";
    case "admin_alerts":        return "sos";
    case "admin_analytics":     return "analytics";
    case "admin_reports":       return "reports";
    case "admin_audit":         return "audit";
    case "admin_settings":      return "settings";
    case "admin_profile":       return "profile";
    default:                    return "overview";
  }
}

interface Props {
  userId: string;
  userName: string;
  activeView?: string;
}

export default function AdminHome({ userId, userName, activeView }: Props) {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [professionals, setProfessionals] = useState<ProfessionalRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [sosItems, setSosItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Derive tab from the sidebar's activeView; fall back to "overview" initially
  const tab: AdminTab = activeView ? viewToTab(activeView) : "overview";
  const [caseSearch, setCaseSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [sampleDataMode, setSampleDataMode] = useState(false);
  const [assigningCase, setAssigningCase] = useState<string | null>(null);
  const [selectedProfessional, setSelectedProfessional] = useState<Record<string, string>>({});

  // Bulk assign state
  const [selectedCaseIds, setSelectedCaseIds] = useState<Set<string>>(new Set());
  const [bulkProfessionalId, setBulkProfessionalId] = useState("");
  const [bulkAssigning, setBulkAssigning] = useState(false);

  // Invite professional modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviting, setInviting] = useState(false);

  // Settings state
  const [escalationTimeout, setEscalationTimeout] = useState(30);
  const [missedCheckinDays, setMissedCheckinDays] = useState(3);
  const [crisisKeywords, setCrisisKeywords] = useState("suicide, kill myself, harm myself, emergency, beaten, threatened, weapon, danger, trapped");
  const [bannerEnabled, setBannerEnabled] = useState(false);
  const [bannerMessage, setBannerMessage] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  // Reports state
  const [reportTimeframe, setReportTimeframe] = useState<"7d" | "30d" | "90d" | "all">("30d");

  const loadAll = async () => {
    setLoading(true);
    try {
      const [metricsRes, casesRes, auditRes, sosRes, settingsRes] = await Promise.all([
        supabase.rpc("get_admin_aggregate_metrics"),
        supabase
          .from("cases")
          .select(`
            id, case_number, stage, district, assigned_professional, victim_id,
            victims!inner(profiles!inner(name))
          `)
          .order("case_number", { ascending: true })
          .limit(100),
        supabase
          .from("audit_log")
          .select("*")
          .order("occurred_at", { ascending: false })
          .limit(50),
        fetchOpenSOS(),
        supabase.from("system_settings").select("key, value"),
      ]);

      if (metricsRes.data) {
        setMetrics(metricsRes.data as unknown as AdminMetrics);
      }

      if (casesRes.data) {
        setCases(
          casesRes.data.map((c: any) => ({
            id: c.id,
            case_number: c.case_number,
            stage: c.stage,
            district: c.district,
            assigned_professional: c.assigned_professional,
            victim_id: c.victim_id,
            profile_name: c.victims?.profiles?.name ?? "—",
          }))
        );
      }

      if (auditRes.data) {
        setAuditLogs(
          auditRes.data.map((a: any) => ({
            id: a.id,
            actor_name: a.actor_name ?? "System",
            actor_role: a.actor_role ?? "system",
            action: a.action,
            details: a.details,
            occurred_at: a.occurred_at,
          }))
        );
      }

      setSosItems(sosRes);

      // Load settings if available
      if (settingsRes.data) {
        for (const item of settingsRes.data) {
          if (item.key === "escalation_timeout_minutes" && typeof item.value === "number") {
            setEscalationTimeout(item.value);
          } else if (item.key === "missed_checkin_days" && typeof item.value === "number") {
            setMissedCheckinDays(item.value);
          } else if (item.key === "crisis_keywords") {
            if (Array.isArray(item.value)) setCrisisKeywords(item.value.join(", "));
          } else if (item.key === "announcement_banner" && typeof item.value === "object") {
            setBannerEnabled(!!item.value?.enabled);
            setBannerMessage(item.value?.message || "");
          }
        }
      }

      // Professionals: get user_roles + profiles
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "professional");

      if (roles && roles.length > 0) {
        const profIds = roles.map((r) => r.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", profIds);

        const profRows: ProfessionalRow[] = await Promise.all(
          (profiles ?? []).map(async (p) => {
            const { count } = await supabase
              .from("cases")
              .select("id", { count: "exact", head: true })
              .eq("assigned_professional", p.id);
            return {
              user_id: p.id,
              name: p.name ?? "—",
              email: p.id,
              caseCount: count ?? 0,
            };
          })
        );
        setProfessionals(profRows);
      }
    } catch (err) {
      toast.error("Could not load dashboard data.");
    }
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  // Assign single case
  const handleAssignCase = async (caseId: string, professionalId: string) => {
    setAssigningCase(caseId);
    const { error } = await supabase
      .from("cases")
      .update({ assigned_professional: professionalId })
      .eq("id", caseId);

    if (error) {
      toast.error("Could not assign case.");
    } else {
      const prof = professionals.find((p) => p.user_id === professionalId);
      await supabase.from("case_events").insert({
        case_id: caseId,
        event_type: "case_assigned",
        description: `Case assigned to ${prof?.name ?? professionalId} by administrator.`,
        visible_to_victim: true,
        author_id: userId,
      });
      await supabase.from("audit_log").insert({
        case_id: caseId,
        actor_id: userId,
        actor_name: userName,
        actor_role: "admin",
        action: "Assigned Case",
        details: `Assigned to ${prof?.name ?? professionalId}`,
      });
      toast.success("Case assigned.");
      await loadAll();
    }
    setAssigningCase(null);
  };

  // Bulk assign cases
  const handleBulkAssign = async () => {
    if (selectedCaseIds.size === 0 || !bulkProfessionalId) return;
    setBulkAssigning(true);
    const prof = professionals.find((p) => p.user_id === bulkProfessionalId);
    const caseIdArray = Array.from(selectedCaseIds);

    const { error } = await supabase
      .from("cases")
      .update({ assigned_professional: bulkProfessionalId })
      .in("id", caseIdArray);

    if (error) {
      toast.error("Bulk assignment failed.");
    } else {
      for (const cid of caseIdArray) {
        await supabase.from("case_events").insert({
          case_id: cid,
          event_type: "case_assigned",
          description: `Assigned to ${prof?.name ?? bulkProfessionalId} via administrative bulk action.`,
          visible_to_victim: true,
          author_id: userId,
        });
      }
      await supabase.from("audit_log").insert({
        actor_id: userId,
        actor_name: userName,
        actor_role: "admin",
        action: "Bulk Case Assignment",
        details: `Assigned ${caseIdArray.length} cases to ${prof?.name ?? bulkProfessionalId}`,
      });
      toast.success(`Assigned ${caseIdArray.length} cases to ${prof?.name ?? "caseworker"}.`);
      setSelectedCaseIds(new Set());
      setBulkProfessionalId("");
      await loadAll();
    }
    setBulkAssigning(false);
  };

  // Auto-assign all unassigned cases
  const handleAutoAssignAll = async () => {
    const unassigned = cases.filter((c) => !c.assigned_professional && c.stage !== "Closed");
    if (unassigned.length === 0) {
      toast.info("No unassigned cases to allocate.");
      return;
    }
    if (professionals.length === 0) {
      toast.error("No active caseworkers available for allocation.");
      return;
    }

    setLoading(true);
    // Sort professionals by active caseload ascending
    const sortedProfs = [...professionals].sort((a, b) => a.caseCount - b.caseCount);
    let assignedCount = 0;

    for (let i = 0; i < unassigned.length; i++) {
      const targetProf = sortedProfs[i % sortedProfs.length];
      const caseItem = unassigned[i];

      await supabase
        .from("cases")
        .update({ assigned_professional: targetProf.user_id })
        .eq("id", caseItem.id);

      await supabase.from("case_events").insert({
        case_id: caseItem.id,
        event_type: "case_assigned",
        description: `Auto-allocated to ${targetProf.name} by administrative load balancing.`,
        visible_to_victim: true,
        author_id: userId,
      });
      assignedCount++;
    }

    await supabase.from("audit_log").insert({
      actor_id: userId,
      actor_name: userName,
      actor_role: "admin",
      action: "Auto-Assigned Cases",
      details: `Evenly distributed ${assignedCount} unassigned cases across ${professionals.length} professionals.`,
    });

    toast.success(`Auto-allocated ${assignedCount} cases across available caseworkers.`);
    await loadAll();
  };

  // Invite professional
  const handleInviteProfessional = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);

    try {
      const { data, error } = await supabase.functions.invoke("invite-professional", {
        body: { email: inviteEmail.trim(), name: inviteName.trim() },
      });

      if (error || data?.error) {
        toast.error(error?.message || data?.error || "Could not invite professional.");
      } else {
        toast.success(`Invitation dispatched to ${inviteEmail.trim()}`);
        setInviteEmail("");
        setInviteName("");
        setShowInviteModal(false);
        await loadAll();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to invoke invite service.");
    }
    setInviting(false);
  };

  // Save Settings
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const kwList = crisisKeywords.split(",").map((k) => k.trim()).filter(Boolean);
      await Promise.all([
        supabase.from("system_settings").upsert({
          key: "escalation_timeout_minutes",
          value: escalationTimeout,
          updated_at: new Date().toISOString(),
          updated_by: userId,
        }),
        supabase.from("system_settings").upsert({
          key: "missed_checkin_days",
          value: missedCheckinDays,
          updated_at: new Date().toISOString(),
          updated_by: userId,
        }),
        supabase.from("system_settings").upsert({
          key: "crisis_keywords",
          value: kwList,
          updated_at: new Date().toISOString(),
          updated_by: userId,
        }),
        supabase.from("system_settings").upsert({
          key: "announcement_banner",
          value: { enabled: bannerEnabled, message: bannerMessage },
          updated_at: new Date().toISOString(),
          updated_by: userId,
        }),
      ]);

      await supabase.from("audit_log").insert({
        actor_id: userId,
        actor_name: userName,
        actor_role: "admin",
        action: "Updated System Settings",
        details: `Escalation: ${escalationTimeout}m, Missed checkin: ${missedCheckinDays}d, Banner: ${bannerEnabled}`,
      });

      toast.success("Platform settings saved successfully.");
    } catch {
      toast.error("Could not save settings.");
    }
    setSavingSettings(false);
  };

  // Download Reports CSV
  const handleDownloadReportsCSV = () => {
    if (!metrics) return;
    const lines = [
      "NIRA Platform Aggregate Report",
      `Generated: ${new Date().toISOString()}`,
      `Timeframe: ${reportTimeframe}`,
      "",
      "Metric,Value",
      `Active Cases,${metrics.activeCases}`,
      `Total Participants,${metrics.totalVictims}`,
      `Caseworkers & Professionals,${metrics.totalProfessionals}`,
      `Unassigned Cases,${metrics.unassignedCases}`,
      `Priority Alerts,${metrics.priorityAlerts}`,
      `Open Alerts,${metrics.openAlerts}`,
      `Open SOS Requests,${metrics.openSOS}`,
      `Improving Trajectory,${metrics.improving}`,
      `Missed Check-ins Flagged,${metrics.missedCheckins}`,
      `Check-ins (Last 7 Days),${metrics.checkinsLast7Days}`,
      "",
      "Stage Breakdown,Count",
      ...metrics.stages.map((s) => `"${s.label}",${s.value}`),
      "",
      "District Breakdown,Count",
      ...metrics.districts.map((d) => `"${d.label}",${d.value}`),
      "",
      "Alert Severity Breakdown,Count",
      ...metrics.severity.map((v) => `"${v.label}",${v.value}`),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `nira-aggregates-${reportTimeframe}-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Aggregates CSV exported.");
  };

  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      if (stageFilter !== "all" && c.stage !== stageFilter) return false;
      if (caseSearch.trim()) {
        const q = caseSearch.toLowerCase();
        return (
          c.case_number.toLowerCase().includes(q) ||
          c.district.toLowerCase().includes(q) ||
          c.stage.toLowerCase().includes(q) ||
          c.profile_name.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [cases, stageFilter, caseSearch]);

  const toggleSelectCase = (id: string) => {
    setSelectedCaseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllCases = () => {
    if (selectedCaseIds.size === filteredCases.length) {
      setSelectedCaseIds(new Set());
    } else {
      setSelectedCaseIds(new Set(filteredCases.map((c) => c.id)));
    }
  };

  const METRIC_CARDS = metrics
    ? [
        { label: "Active cases", value: metrics.activeCases, icon: ClipboardList, tone: "brand" as const },
        { label: "Unassigned", value: metrics.unassignedCases, icon: Users, tone: "uncertain" as const },
        { label: "Priority alerts", value: metrics.priorityAlerts, icon: Siren, tone: "priority" as const },
        { label: "Open alerts", value: metrics.openAlerts, icon: AlertCircle, tone: "attention" as const },
        { label: "Improving", value: metrics.improving, icon: TrendingUp, tone: "improving" as const },
        { label: "Missed check-ins", value: metrics.missedCheckins, icon: Clock, tone: "attention" as const },
        { label: "Open SOS", value: metrics.openSOS, icon: Siren, tone: "priority" as const },
        { label: "Check-ins (7d)", value: metrics.checkinsLast7Days, icon: Activity, tone: "brand" as const },
      ]
    : [];



  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-ink">Admin workspace</div>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">Administrative Governance & Insights</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSampleDataMode((v) => !v)}
            className="flex items-center gap-2 rounded-xl border border-line bg-surface/80 px-3.5 py-2 text-xs font-semibold text-muted-ink transition hover:border-brand/40 hover:text-ink"
          >
            {sampleDataMode ? <ToggleRight className="size-4 text-brand" /> : <ToggleLeft className="size-4" />}
            Preview sample data
          </button>
          <button
            type="button"
            onClick={loadAll}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-line bg-surface/80 px-3.5 py-2 text-xs font-semibold text-muted-ink transition hover:border-brand/40 hover:text-ink disabled:opacity-40"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* System Announcement Banner if active */}
      {bannerEnabled && bannerMessage && (
        <div className="flex items-center gap-3 rounded-xl border border-brand/30 bg-brand-soft/50 px-4 py-3 text-xs text-ink font-semibold">
          <AlertCircle className="size-4 text-brand shrink-0" />
          <span>{bannerMessage}</span>
        </div>
      )}

      {/* Metric cards */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="size-8 animate-spin rounded-full border-2 border-brand border-t-transparent" /></div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {METRIC_CARDS.map((m) => {
            const Icon = m.icon;
            return (
              <div key={m.label} className="rounded-[22px] border border-line bg-white/70 p-4 shadow-soft backdrop-blur-md transition-transform hover:-translate-y-0.5 duration-200">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-semibold text-muted-ink">{m.label}</div>
                  <Icon className="size-3.5 text-muted-ink" />
                </div>
                <div className="mt-2 text-2xl font-extrabold text-ink">{m.value}</div>
                <SoftBadge tone={m.tone} />
              </div>
            );
          })}
        </div>
      )}



      {/* ── TAB: OVERVIEW (Summary + key metrics) ── */}
      {(tab === "overview") && (
        <div className="space-y-5">
          <div className="rounded-[22px] border border-line bg-white/70 p-6 shadow-soft backdrop-blur-md">
            <div className="text-xs font-bold uppercase tracking-[0.12em] text-muted-ink mb-3">Platform summary</div>
            {loading ? (
              <div className="flex justify-center py-8"><div className="size-6 animate-spin rounded-full border-2 border-brand border-t-transparent" /></div>
            ) : metrics ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {METRIC_CARDS.map((m) => {
                  const Icon = m.icon;
                  return (
                    <div key={m.label} className="rounded-[18px] border border-line bg-surface/60 p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-[11px] font-semibold text-muted-ink">{m.label}</div>
                        <Icon className="size-3.5 text-muted-ink" />
                      </div>
                      <div className="mt-2 text-2xl font-extrabold text-ink">{m.value}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-ink text-center py-6">No data yet. Data will appear once cases and check-ins are logged.</p>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: ANALYTICS ── */}
      {tab === "analytics" && metrics && (
        <div className="space-y-5">
          {sampleDataMode && (
            <div className="rounded-xl border border-attention/40 bg-attention/10 px-4 py-2 text-xs font-semibold text-attention">
              Preview mode: showing sample data overlay. Toggle off to see real platform data only.
            </div>
          )}

          {/* Time Series: Check-ins & Alerts */}
          <div className="grid gap-5 md:grid-cols-2">
            {metrics.checkinSeries.length > 0 && (
              <div className="rounded-[22px] border border-line bg-white/70 p-5 shadow-soft backdrop-blur-md">
                <div className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-muted-ink">Daily Check-ins (30 Days)</div>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={metrics.checkinSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: "var(--text-secondary)" }} tickFormatter={(v) => new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} />
                    <YAxis tick={{ fontSize: 9, fill: "var(--text-secondary)" }} />
                    <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 11 }} />
                    <Line type="monotone" dataKey="checkins" stroke="#2d7a6e" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {metrics.alertSeries?.length > 0 && (
              <div className="rounded-[22px] border border-line bg-white/70 p-5 shadow-soft backdrop-blur-md">
                <div className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-muted-ink">Alert Activity (30 Days)</div>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={metrics.alertSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: "var(--text-secondary)" }} tickFormatter={(v) => new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} />
                    <YAxis tick={{ fontSize: 9, fill: "var(--text-secondary)" }} />
                    <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 11 }} />
                    <Line type="monotone" dataKey="alerts" stroke="#d85a3a" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {/* Stage distribution */}
            {metrics.stages.length > 0 && (
              <div className="rounded-[22px] border border-line bg-white/70 p-6 shadow-soft backdrop-blur-md">
                <div className="mb-4 text-xs font-bold uppercase tracking-[0.12em] text-muted-ink">Case stage funnel</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={metrics.stages} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" tick={{ fontSize: 9, fill: "var(--text-secondary)" }} />
                    <YAxis type="category" dataKey="label" tick={{ fontSize: 9, fill: "var(--text-secondary)" }} width={100} />
                    <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 11 }} />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                      {metrics.stages.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Trajectory distribution */}
            {metrics.trajectory_distribution?.length > 0 && (
              <div className="rounded-[22px] border border-line bg-white/70 p-6 shadow-soft backdrop-blur-md">
                <div className="mb-4 text-xs font-bold uppercase tracking-[0.12em] text-muted-ink">Wellbeing Trajectories</div>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={metrics.trajectory_distribution} dataKey="value" nameKey="label" innerRadius={50} outerRadius={80} paddingAngle={3}>
                      {metrics.trajectory_distribution.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* District breakdown */}
            {metrics.districts.length > 0 && (
              <div className="rounded-[22px] border border-line bg-white/70 p-6 shadow-soft backdrop-blur-md">
                <div className="mb-4 text-xs font-bold uppercase tracking-[0.12em] text-muted-ink">Geographic distribution</div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={metrics.districts}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--text-secondary)" }} />
                    <YAxis tick={{ fontSize: 9, fill: "var(--text-secondary)" }} />
                    <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 11 }} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {metrics.districts.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Alert severity breakdown */}
            {metrics.severity?.length > 0 && (
              <div className="rounded-[22px] border border-line bg-white/70 p-6 shadow-soft backdrop-blur-md">
                <div className="mb-4 text-xs font-bold uppercase tracking-[0.12em] text-muted-ink">Alert Severity Breakdown</div>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={metrics.severity} dataKey="value" nameKey="label" innerRadius={40} outerRadius={70} paddingAngle={3}>
                      {metrics.severity.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: CASES ── */}
      {tab === "cases" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-ink" />
                <input
                  type="text"
                  placeholder="Search case #, district, participant…"
                  value={caseSearch}
                  onChange={(e) => setCaseSearch(e.target.value)}
                  className="h-9 w-full rounded-lg border border-line bg-surface/80 pl-8 pr-3 text-xs text-ink placeholder:text-muted-ink focus:border-brand focus:outline-hidden"
                />
              </div>
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="h-9 rounded-lg border border-line bg-surface/80 px-3 text-xs font-medium text-ink focus:border-brand focus:outline-hidden"
              >
                <option value="all">All stages</option>
                {["Registered", "Under review", "Support assigned", "In progress", "Follow-up", "Closed"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleAutoAssignAll}
              className="flex items-center gap-1.5 rounded-xl bg-brand/10 border border-brand/20 px-3.5 py-2 text-xs font-bold text-brand hover:bg-brand hover:text-white transition"
            >
              <Sliders className="size-3.5" />
              Auto-assign all unassigned
            </button>
          </div>

          {/* Bulk Assign Toolbar */}
          {selectedCaseIds.size > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/30 bg-brand-soft/40 px-4 py-2.5">
              <span className="text-xs font-bold text-ink">
                {selectedCaseIds.size} case{selectedCaseIds.size > 1 ? "s" : ""} selected
              </span>
              <div className="flex items-center gap-2">
                <select
                  value={bulkProfessionalId}
                  onChange={(e) => setBulkProfessionalId(e.target.value)}
                  className="h-8 rounded-lg border border-line bg-white px-2.5 text-xs text-ink font-medium focus:border-brand focus:outline-hidden"
                >
                  <option value="">Select professional for batch assign…</option>
                  {professionals.map((p) => (
                    <option key={p.user_id} value={p.user_id}>
                      {p.name} ({p.caseCount} active cases)
                    </option>
                  ))}
                </select>
                <button
                  disabled={!bulkProfessionalId || bulkAssigning}
                  onClick={handleBulkAssign}
                  className="rounded-lg bg-brand px-3.5 py-1.5 text-xs font-bold text-white hover:bg-brand/90 disabled:opacity-40 transition"
                >
                  {bulkAssigning ? "Assigning…" : "Assign Selected"}
                </button>
                <button
                  onClick={() => setSelectedCaseIds(new Set())}
                  className="text-xs text-muted-ink hover:text-ink font-medium"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          <div className="rounded-[22px] border border-line bg-white/70 shadow-soft backdrop-blur-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-line bg-surface/60">
                    <th className="w-8 px-4 py-3">
                      <button onClick={toggleSelectAllCases} className="text-muted-ink hover:text-ink">
                        {selectedCaseIds.size === filteredCases.length && filteredCases.length > 0 ? (
                          <CheckSquare className="size-4 text-brand" />
                        ) : (
                          <Square className="size-4" />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left font-bold text-muted-ink">Case #</th>
                    <th className="px-4 py-3 text-left font-bold text-muted-ink">District</th>
                    <th className="px-4 py-3 text-left font-bold text-muted-ink">Stage</th>
                    <th className="px-4 py-3 text-left font-bold text-muted-ink">Caseworker</th>
                    <th className="px-4 py-3 text-left font-bold text-muted-ink">Reassign</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredCases.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-ink">No cases match your filters.</td></tr>
                  ) : filteredCases.map((c) => {
                    const assignedProf = professionals.find((p) => p.user_id === c.assigned_professional);
                    const isSelected = selectedCaseIds.has(c.id);
                    return (
                      <tr key={c.id} className={`hover:bg-surface/40 transition ${isSelected ? "bg-brand/5" : ""}`}>
                        <td className="px-4 py-3">
                          <button onClick={() => toggleSelectCase(c.id)} className="text-muted-ink hover:text-ink">
                            {isSelected ? <CheckSquare className="size-4 text-brand" /> : <Square className="size-4" />}
                          </button>
                        </td>
                        <td className="px-4 py-3 font-mono font-semibold text-ink">{c.case_number}</td>
                        <td className="px-4 py-3 text-muted-ink">{c.district}</td>
                        <td className="px-4 py-3">
                          <SoftBadge tone={c.stage === "Closed" ? "uncertain" as any : c.stage === "In progress" ? "improving" : "brand"}>{c.stage}</SoftBadge>
                        </td>
                        <td className="px-4 py-3 text-muted-ink">{assignedProf?.name ?? <span className="text-attention italic">Unassigned</span>}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <select
                              value={selectedProfessional[c.id] ?? ""}
                              onChange={(e) => setSelectedProfessional((prev) => ({ ...prev, [c.id]: e.target.value }))}
                              className="h-7 rounded-lg border border-line bg-surface/80 px-2 text-xs text-ink focus:border-brand focus:outline-hidden"
                            >
                              <option value="">Select…</option>
                              {professionals.map((p) => (
                                <option key={p.user_id} value={p.user_id}>{p.name} ({p.caseCount} cases)</option>
                              ))}
                            </select>
                            <button
                              disabled={!selectedProfessional[c.id] || assigningCase === c.id}
                              onClick={() => handleAssignCase(c.id, selectedProfessional[c.id] ?? "")}
                              className="rounded-lg bg-brand px-2.5 py-1 text-[10px] font-bold text-white disabled:opacity-40 hover:bg-brand/90 transition"
                            >
                              {assigningCase === c.id ? "…" : "Assign"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: PROFESSIONALS ── */}
      {tab === "professionals" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowInviteModal(true)}
              className="flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-brand/90 transition"
            >
              <UserPlus className="size-3.5" />
              Invite Professional
            </button>
          </div>

          <div className="rounded-[22px] border border-line bg-white/70 shadow-soft backdrop-blur-md overflow-hidden">
            {professionals.length === 0 ? (
              <div className="p-8 text-center text-muted-ink text-sm">No professionals registered yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-line bg-surface/60">
                      <th className="px-4 py-3 text-left font-bold text-muted-ink">Name</th>
                      <th className="px-4 py-3 text-left font-bold text-muted-ink">Account ID</th>
                      <th className="px-4 py-3 text-left font-bold text-muted-ink">Active Caseload</th>
                      <th className="px-4 py-3 text-left font-bold text-muted-ink">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {professionals.map((p) => (
                      <tr key={p.user_id} className="hover:bg-surface/40 transition">
                        <td className="px-4 py-3 font-semibold text-ink">{p.name}</td>
                        <td className="px-4 py-3 text-muted-ink font-mono text-[11px]">{p.user_id}</td>
                        <td className="px-4 py-3">
                          <span className={`font-bold ${p.caseCount > 5 ? "text-attention" : "text-improving"}`}>
                            {p.caseCount} active cases
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <SoftBadge tone="improving">Active</SoftBadge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: SOS ── */}
      {tab === "sos" && (
        <div className="space-y-3">
          {sosItems.length === 0 ? (
            <div className="rounded-xl border border-improving/30 bg-improving/10 p-8 text-center">
              <CheckCircle2 className="mx-auto mb-2 size-8 text-improving" />
              <p className="text-sm font-semibold text-ink">No open SOS requests</p>
              <p className="mt-1 text-xs text-muted-ink">All SOS requests have been acknowledged and handled.</p>
            </div>
          ) : sosItems.map((sos) => (
            <div key={sos.id} className="rounded-xl border border-priority/40 bg-priority/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Siren className="size-5 text-priority animate-pulse" />
                <div>
                  <div className="text-sm font-bold text-priority">{sos.requestCode}</div>
                  <div className="text-xs text-muted-ink">{sos.caseNumber} · {sos.district} · {new Date(sos.createdAt).toLocaleString("en-IN")}</div>
                </div>
                <SoftBadge tone="priority">{sos.status}</SoftBadge>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={async () => { await updateSosStatus(sos.id, "Acknowledged"); toast.success("SOS acknowledged"); await loadAll(); }}
                  className="rounded-lg bg-priority/15 px-3 py-1.5 text-xs font-bold text-priority hover:bg-priority/25 transition"
                >
                  Acknowledge
                </button>
                <button
                  onClick={async () => { await updateSosStatus(sos.id, "Handled"); toast.success("SOS handled"); await loadAll(); }}
                  className="rounded-lg bg-improving/15 px-3 py-1.5 text-xs font-bold text-improving hover:bg-improving/25 transition"
                >
                  Mark handled
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── TAB: REPORTS & EXPORT ── */}
      {tab === "reports" && (
        <div className="space-y-4">
          <div className="rounded-[22px] border border-line bg-white/70 p-6 shadow-soft backdrop-blur-md">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <div>
                <h3 className="text-sm font-bold text-ink">Platform Aggregate Reports</h3>
                <p className="text-xs text-muted-ink">Generate anonymized governance summaries and metric audits.</p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={reportTimeframe}
                  onChange={(e) => setReportTimeframe(e.target.value as any)}
                  className="h-8 rounded-lg border border-line bg-surface/80 px-2.5 text-xs font-semibold text-ink focus:border-brand focus:outline-hidden"
                >
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                  <option value="90d">Last 90 Days</option>
                  <option value="all">All Time</option>
                </select>
                <button
                  onClick={handleDownloadReportsCSV}
                  className="flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-bold text-white hover:bg-brand/90 transition shadow-xs"
                >
                  <Download className="size-3.5" />
                  Download CSV
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 rounded-lg border border-line bg-surface/80 px-3.5 py-1.5 text-xs font-bold text-ink hover:border-brand/40 transition"
                >
                  <Printer className="size-3.5" />
                  Print / Save PDF
                </button>
              </div>
            </div>

            {metrics && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 pt-2 border-t border-line">
                <div className="p-3 bg-surface/50 rounded-xl">
                  <div className="text-[10px] uppercase font-bold text-muted-ink">Active Caseload</div>
                  <div className="text-xl font-bold text-ink mt-1">{metrics.activeCases}</div>
                </div>
                <div className="p-3 bg-surface/50 rounded-xl">
                  <div className="text-[10px] uppercase font-bold text-muted-ink">Participants Served</div>
                  <div className="text-xl font-bold text-ink mt-1">{metrics.totalVictims}</div>
                </div>
                <div className="p-3 bg-surface/50 rounded-xl">
                  <div className="text-[10px] uppercase font-bold text-muted-ink">Resolution / Improving Rate</div>
                  <div className="text-xl font-bold text-improving mt-1">
                    {metrics.totalVictims > 0 ? Math.round((metrics.improving / metrics.totalVictims) * 100) : 0}%
                  </div>
                </div>
                <div className="p-3 bg-surface/50 rounded-xl">
                  <div className="text-[10px] uppercase font-bold text-muted-ink">Open Critical Alerts</div>
                  <div className="text-xl font-bold text-priority mt-1">{metrics.priorityAlerts}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: SETTINGS ── */}
      {tab === "settings" && (
        <div className="space-y-4">
          <div className="rounded-[22px] border border-line bg-white/70 p-6 shadow-soft backdrop-blur-md max-w-3xl">
            <h3 className="text-sm font-bold text-ink mb-1">Administrative Platform Settings</h3>
            <p className="text-xs text-muted-ink mb-6">Manage thresholds, crisis safety lists, and global system notifications.</p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-ink block mb-1">Escalation Timeout (Minutes)</label>
                <p className="text-[11px] text-muted-ink mb-1.5">Alerts unhandled beyond this duration trigger supervisor notifications.</p>
                <input
                  type="number"
                  min="5"
                  max="1440"
                  value={escalationTimeout}
                  onChange={(e) => setEscalationTimeout(Number(e.target.value))}
                  className="h-9 w-40 rounded-lg border border-line bg-surface/80 px-3 text-xs font-semibold text-ink focus:border-brand focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-ink block mb-1">Missed Check-in Threshold (Days)</label>
                <p className="text-[11px] text-muted-ink mb-1.5">Days of silence before an automated supportive caseworker alert is raised.</p>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={missedCheckinDays}
                  onChange={(e) => setMissedCheckinDays(Number(e.target.value))}
                  className="h-9 w-40 rounded-lg border border-line bg-surface/80 px-3 text-xs font-semibold text-ink focus:border-brand focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-ink block mb-1">Crisis Detection Keyword Triggers</label>
                <p className="text-[11px] text-muted-ink mb-1.5">Comma-separated terms checked by edge scoring models for urgent crisis escalation.</p>
                <textarea
                  rows={3}
                  value={crisisKeywords}
                  onChange={(e) => setCrisisKeywords(e.target.value)}
                  className="w-full rounded-lg border border-line bg-surface/80 p-3 text-xs text-ink focus:border-brand focus:outline-hidden"
                />
              </div>

              <div className="pt-2 border-t border-line">
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={bannerEnabled}
                    onChange={(e) => setBannerEnabled(e.target.checked)}
                    className="accent-brand"
                  />
                  <span className="text-xs font-bold text-ink">Enable Global Platform Announcement Banner</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., Scheduled maintenance window tonight at 02:00 UTC."
                  value={bannerMessage}
                  onChange={(e) => setBannerMessage(e.target.value)}
                  disabled={!bannerEnabled}
                  className="h-9 w-full rounded-lg border border-line bg-surface/80 px-3 text-xs text-ink placeholder:text-muted-ink focus:border-brand focus:outline-hidden disabled:opacity-50"
                />
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                  className="rounded-xl bg-brand px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-brand/90 disabled:opacity-50 transition"
                >
                  {savingSettings ? "Saving…" : "Save Platform Settings"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: AUDIT LOG ── */}
      {tab === "audit" && (
        <div className="rounded-[22px] border border-line bg-white/70 shadow-soft backdrop-blur-md overflow-hidden">
          {auditLogs.length === 0 ? (
            <div className="p-8 text-center text-muted-ink text-sm">No audit entries yet. Administrative actions and logins will appear here.</div>
          ) : (
            <div className="divide-y divide-line">
              {auditLogs.map((entry) => (
                <div key={entry.id} className="flex flex-wrap items-start gap-3 px-5 py-3">
                  <div className={`mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    entry.actor_role === "admin" ? "bg-brand/10 text-brand"
                    : entry.actor_role === "professional" ? "bg-improving/10 text-improving"
                    : entry.actor_role === "victim" ? "bg-sage/20 text-sage"
                    : "bg-surface text-muted-ink"
                  }`}>{entry.actor_role}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-ink">{entry.actor_name}</span>
                      <span className="text-xs text-muted-ink">{entry.action}</span>
                    </div>
                    {entry.details && <p className="mt-0.5 text-[11px] text-muted-ink">{entry.details}</p>}
                  </div>
                  <div className="text-[10px] text-muted-ink shrink-0">
                    {new Date(entry.occurred_at).toLocaleString("en-IN")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Invite Professional Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-[22px] border border-line bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-ink">Invite Support Professional</h3>
            <p className="mt-1 text-xs text-muted-ink">Sends an invitation email with a direct login link and sets caseworker permissions.</p>

            <form onSubmit={handleInviteProfessional} className="mt-4 space-y-3">
              <div>
                <label className="text-[11px] font-bold text-ink block mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="caseworker@organization.org"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="h-9 w-full rounded-lg border border-line bg-surface/80 px-3 text-xs text-ink focus:border-brand focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-ink block mb-1">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Kavitha Sundaram"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="h-9 w-full rounded-lg border border-line bg-surface/80 px-3 text-xs text-ink focus:border-brand focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="rounded-lg border border-line px-3.5 py-1.5 text-xs font-semibold text-muted-ink hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting || !inviteEmail.trim()}
                  className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-1.5 text-xs font-bold text-white hover:bg-brand/90 disabled:opacity-50"
                >
                  <Send className="size-3" />
                  {inviting ? "Sending invite…" : "Send Invitation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── TAB: PROFILE ── */}
      {tab === "profile" && (
        <div className="rounded-[22px] border border-line bg-white/70 p-6 shadow-soft backdrop-blur-md max-w-lg">
          <div className="text-xs font-bold uppercase tracking-[0.12em] text-muted-ink mb-4">Administrator profile</div>
          <div className="flex items-center gap-4 mb-6">
            <div className="grid size-14 place-items-center rounded-2xl bg-brand text-xl font-bold text-white shadow-sm">
              {userName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="text-base font-bold text-ink">{userName}</div>
              <div className="text-xs text-muted-ink mt-0.5">System administrator</div>
              <div className="mt-1 inline-block rounded-full bg-brand/10 px-2.5 py-0.5 text-[11px] font-bold text-brand">Admin</div>
            </div>
          </div>
          <div className="space-y-3 text-xs text-muted-ink border-t border-line pt-4">
            <div><span className="font-semibold text-ink">User ID:</span> <span className="font-mono">{userId}</span></div>
            <div><span className="font-semibold text-ink">Role:</span> Administrator</div>
          </div>
        </div>
      )}
    </div>
  );
}
