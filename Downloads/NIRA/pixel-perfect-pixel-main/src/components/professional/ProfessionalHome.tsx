import { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SoftBadge, StatusIcon } from "@/components/nira-primitives";
import {
  fetchProfessionalQueue,
  fetchOpenSOS,
  claimCase,
  updateSosStatus,
  formatMinutesAgo,
  fetchProfessionalInbox,
  fetchFollowups,
  type CaseQueueItem,
  type SosRow,
  type InboxConversation,
  type OverdueFollowup,
} from "@/lib/nira-data";
import {
  BarChart2,
  ClipboardList,
  ShieldAlert,
  TrendingUp,
  Search,
  Kanban,
  ListFilter,
  Eye,
  CheckCircle2,
  UserPlus,
  Bell,
  Clock,
  Command as CommandIcon,
  X as CloseIcon,
  Siren,
  Mail,
  CalendarClock,
  AlertTriangle,
  MessageSquare,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { InterventionBoard } from "./InterventionBoard";
import { toast } from "sonner";

type TabMode = "queue" | "pipeline" | "inbox";
type QueueTab = "my" | "unassigned" | "sos";

interface Props {
  userId: string;
  userName: string;
  onViewCase: (caseId: string) => void;
}

// Real-time metric counters from Supabase
async function fetchMetrics(professionalId: string) {
  const [casesRes, priorityRes, openRes] = await Promise.all([
    supabase.from("cases").select("id", { count: "exact" }).eq("assigned_professional", professionalId),
    supabase.from("alerts").select("id", { count: "exact" }).eq("severity", "priority").eq("status", "open"),
    supabase.from("alerts").select("id", { count: "exact" }).eq("status", "open"),
  ]);

  // Latest scores improving count for professional's cases
  const { data: assignedCases } = await supabase
    .from("cases")
    .select("victim_id")
    .eq("assigned_professional", professionalId);

  const victimIds = (assignedCases ?? []).map((c) => c.victim_id).filter(Boolean);
  let improvingCount = 0;
  if (victimIds.length > 0) {
    const { data: latestScores } = await supabase
      .from("scores")
      .select("victim_id, trend, created_at")
      .in("victim_id", victimIds);

    // Keep only the latest per victim
    const byVictim = new Map<string, { trend: string; created_at: string }>();
    for (const s of latestScores ?? []) {
      const existing = byVictim.get(s.victim_id);
      if (!existing || s.created_at > existing.created_at) {
        byVictim.set(s.victim_id, { trend: s.trend, created_at: s.created_at });
      }
    }
    improvingCount = [...byVictim.values()].filter((v) => v.trend === "Improving").length;
  }

  return {
    activeCases: casesRes.count ?? 0,
    priorityAlerts: priorityRes.count ?? 0,
    openAlerts: openRes.count ?? 0,
    improving: improvingCount,
  };
}

export default function ProfessionalHome({ userId, userName, onViewCase }: Props) {
  const [queue, setQueue] = useState<CaseQueueItem[]>([]);
  const [sosItems, setSosItems] = useState<(SosRow & { caseNumber: string; district: string })[]>([]);
  const [metrics, setMetrics] = useState({ activeCases: 0, priorityAlerts: 0, openAlerts: 0, improving: 0 });
  const [loading, setLoading] = useState(true);
  const [tabMode, setTabMode] = useState<TabMode>("queue");
  const [queueTab, setQueueTab] = useState<QueueTab>("my");
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"newest" | "severity">("severity");
  const [cmdOpen, setCmdOpen] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [unreadBadge, setUnreadBadge] = useState(0);
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [followups, setFollowups] = useState<OverdueFollowup[]>([]);
  const realtimeRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Keyboard shortcut for Cmd+K / Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCmdOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const load = async () => {
    setLoading(true);
    const [queueData, sosData, metricsData, inboxData, followupsData] = await Promise.all([
      fetchProfessionalQueue(userId, queueTab === "sos" ? "my" : queueTab),
      fetchOpenSOS(),
      fetchMetrics(userId),
      fetchProfessionalInbox(userId),
      fetchFollowups(userId),
    ]);
    setQueue(queueTab === "sos" ? [] : queueData);
    setSosItems(sosData);
    setMetrics(metricsData);
    setConversations(inboxData);
    setFollowups(followupsData);
    const totalUnread = inboxData.reduce((acc, c) => acc + c.unreadCount, 0);
    setUnreadBadge(totalUnread);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [userId, queueTab]);

  // Realtime subscriptions
  useEffect(() => {
    if (realtimeRef.current) supabase.removeChannel(realtimeRef.current);

    const channel = supabase
      .channel("professional-workspace")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "checkins" }, () => {
        setUnreadBadge((n) => n + 1);
        toast.info("New check-in received", { description: "A participant has submitted a new check-in." });
        load();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "alerts" }, (payload) => {
        const sev = (payload.new as any)?.severity ?? "routine";
        if (sev === "priority") {
          toast.error("Priority alert", { description: "A new priority alert has been created. Immediate human review needed." });
        } else {
          toast.warning("New alert", { description: `A new ${sev} alert has been created.` });
        }
        load();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "sos_requests" }, () => {
        toast.error("SOS request", { description: "An SOS request has been received. Please attend immediately." });
        load();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const senderRole = (payload.new as any)?.sender_role;
        if (senderRole === "victim") {
          setUnreadBadge((n) => n + 1);
          toast.info("New message", { description: "A message from a participant is waiting." });
        }
      })
      .subscribe();

    realtimeRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const filteredQueue = useMemo(() => {
    const source = queueTab === "sos"
      ? sosItems.map((s) => ({
          caseId: s.id,
          caseNumber: s.caseNumber,
          stage: "SOS",
          district: s.district,
          assignedProfessional: null,
          victimId: s.victimId,
          profileName: "—",
          initials: "!",
          latestMood: null,
          latestScore: null,
          latestTrend: null,
          alertSeverity: "priority" as const,
          lastCheckinAt: s.createdAt,
          minutesSinceCheckin: Math.round((Date.now() - new Date(s.createdAt).getTime()) / 60000),
          crisisFlag: true,
        } satisfies CaseQueueItem))
      : queue;

    return source
      .filter((item) => {
        if (severityFilter !== "all" && (item.alertSeverity ?? "routine") !== severityFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            item.caseNumber.toLowerCase().includes(q) ||
            item.stage.toLowerCase().includes(q) ||
            (item.latestMood ?? "").toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "severity") {
          const rank: Record<string, number> = { priority: 3, attention: 2, routine: 1 };
          return (rank[b.alertSeverity ?? ""] ?? 0) - (rank[a.alertSeverity ?? ""] ?? 0);
        }
        const ta = a.lastCheckinAt ? new Date(a.lastCheckinAt).getTime() : 0;
        const tb = b.lastCheckinAt ? new Date(b.lastCheckinAt).getTime() : 0;
        return tb - ta;
      });
  }, [queue, sosItems, queueTab, severityFilter, searchQuery, sortBy]);

  const handleClaimCase = async (caseId: string) => {
    setClaimingId(caseId);
    const result = await claimCase(caseId, userId, userName);
    if (result.ok) {
      toast.success("Case accepted", { description: "This case is now assigned to you." });
      await load();
    } else {
      toast.error("Could not claim case", { description: result.error });
    }
    setClaimingId(null);
  };

  const metricCards = [
    { label: "My active cases", value: metrics.activeCases, icon: ClipboardList, tone: "brand" as const },
    { label: "Priority alerts", value: metrics.priorityAlerts, icon: ShieldAlert, tone: "priority" as const },
    { label: "Open alerts", value: metrics.openAlerts, icon: BarChart2, tone: "attention" as const },
    { label: "Improving", value: metrics.improving, icon: TrendingUp, tone: "improving" as const },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-ink">Support workspace</div>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">A clear view for human review</h2>
        </div>
        <div className="flex items-center gap-2">
          {unreadBadge > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-priority/15 px-3 py-1.5 text-xs font-bold text-priority">
              <Bell className="size-3.5" />
              {unreadBadge} unread
            </span>
          )}
          <button
            type="button"
            onClick={() => setCmdOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface/80 px-3.5 py-2 text-xs font-semibold text-muted-ink shadow-xs transition hover:border-brand/40 hover:text-ink"
          >
            <Search className="size-3.5" />
            Quick actions...
            <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 text-[10px] font-mono text-muted-ink">⌘K</kbd>
          </button>
        </div>
      </div>

      {/* Pinned SOS Banner */}
      {sosItems.length > 0 && (
        <div className="rounded-xl border border-priority/40 bg-priority/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Siren className="size-5 text-priority animate-pulse" />
            <span className="text-sm font-extrabold text-priority">
              {sosItems.length} open SOS request{sosItems.length > 1 ? "s" : ""} — immediate attention needed
            </span>
          </div>
          <div className="space-y-2">
            {sosItems.slice(0, 3).map((sos) => (
              <div key={sos.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-priority/20 bg-surface/60 px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-bold text-priority">{sos.requestCode}</span>
                  <span className="text-xs text-muted-ink">{sos.caseNumber} · {sos.district}</span>
                  <span className="text-xs text-muted-ink flex items-center gap-1">
                    <Clock className="size-3" />
                    {formatMinutesAgo(Math.round((Date.now() - new Date(sos.createdAt).getTime()) / 60000))}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => { await updateSosStatus(sos.id, "Acknowledged"); toast.success("SOS acknowledged"); await load(); }}
                    className="rounded-lg bg-priority/15 px-3 py-1.5 text-xs font-bold text-priority hover:bg-priority/25 transition"
                  >Acknowledge</button>
                  <button
                    onClick={async () => { await updateSosStatus(sos.id, "Handled"); toast.success("SOS marked handled"); await load(); }}
                    className="rounded-lg bg-improving/15 px-3 py-1.5 text-xs font-bold text-improving hover:bg-improving/25 transition"
                  >Mark handled</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Overdue Follow-ups Alert Banner */}
      {followups.some((f) => f.isOverdue) && (
        <div className="rounded-xl border border-attention/40 bg-attention/10 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CalendarClock className="size-5 text-attention" />
            <span className="text-sm font-extrabold text-attention">
              {followups.filter((f) => f.isOverdue).length} overdue follow-up{followups.filter((f) => f.isOverdue).length > 1 ? "s" : ""} — scheduled caseworker check needed
            </span>
          </div>
          <div className="space-y-1.5">
            {followups.filter((f) => f.isOverdue).slice(0, 3).map((f) => (
              <div key={f.caseId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-attention/20 bg-surface/60 px-4 py-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-ink">{f.caseNumber}</span>
                  <span className="text-xs text-muted-ink">{f.victimName} · {f.district}</span>
                  <span className="text-xs text-attention font-semibold">
                    Scheduled: {new Date(f.followUpDate).toLocaleDateString("en-IN")}
                  </span>
                </div>
                <button
                  onClick={() => onViewCase(f.caseId)}
                  className="rounded-lg bg-attention/15 px-3 py-1 text-xs font-bold text-attention hover:bg-attention/25 transition"
                >
                  Review case
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {metricCards.map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.label} className="rounded-[22px] border border-line bg-white/70 p-5 shadow-soft backdrop-blur-md transition-transform hover:-translate-y-0.5 duration-200">
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

      {/* Tab row: Queue / Pipeline / Inbox */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div className="flex items-center gap-1 rounded-xl border border-line bg-surface/70 p-1">
          <button
            type="button" onClick={() => setTabMode("queue")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${tabMode === "queue" ? "bg-brand text-white" : "text-muted-ink hover:text-ink"}`}
          ><ListFilter className="size-3.5" />Review Queue</button>
          <button
            type="button" onClick={() => setTabMode("pipeline")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${tabMode === "pipeline" ? "bg-brand text-white" : "text-muted-ink hover:text-ink"}`}
          ><Kanban className="size-3.5" />Pipeline</button>
          <button
            type="button" onClick={() => setTabMode("inbox")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${tabMode === "inbox" ? "bg-brand text-white" : "text-muted-ink hover:text-ink"}`}
          >
            <Mail className="size-3.5" />
            Inbox
            {conversations.reduce((acc, c) => acc + c.unreadCount, 0) > 0 && (
              <span className="ml-1 rounded-full bg-priority px-1.5 py-0.2 text-[10px] font-bold text-white">
                {conversations.reduce((acc, c) => acc + c.unreadCount, 0)}
              </span>
            )}
          </button>
        </div>

        {tabMode === "queue" && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Queue sub-tabs */}
            {(["my", "unassigned", "sos"] as QueueTab[]).map((t) => {
              const labels: Record<QueueTab, string> = { my: "My cases", unassigned: "Unassigned", sos: "SOS" };
              return (
                <button key={t} onClick={() => setQueueTab(t)}
                  className={`rounded-lg border px-3 py-1 text-xs font-semibold transition ${queueTab === t
                    ? t === "sos" ? "border-priority bg-priority/10 text-priority" : "border-brand bg-brand-soft text-brand"
                    : "border-line text-muted-ink hover:border-brand/30"
                  }`}>
                  {labels[t]}{t === "sos" && sosItems.length > 0 && <span className="ml-1 rounded-full bg-priority/20 px-1.5 py-0.5 text-[10px] font-bold text-priority">{sosItems.length}</span>}
                </button>
              );
            })}

            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-ink" />
              <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 rounded-lg border border-line bg-surface/80 pl-8 pr-3 text-xs text-ink placeholder:text-muted-ink focus:border-brand focus:outline-hidden" />
            </div>
            <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}
              className="h-8 rounded-lg border border-line bg-surface/80 px-2.5 text-xs font-medium text-ink focus:border-brand focus:outline-hidden">
              <option value="all">All severities</option>
              <option value="priority">Priority</option>
              <option value="attention">Attention</option>
              <option value="routine">Routine</option>
            </select>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}
              className="h-8 rounded-lg border border-line bg-surface/80 px-2.5 text-xs font-medium text-ink focus:border-brand focus:outline-hidden">
              <option value="severity">Highest severity</option>
              <option value="newest">Most recent check-in</option>
            </select>
          </div>
        )}
      </div>

      {/* Content */}
      {tabMode === "pipeline" ? (
        <InterventionBoard onSelectCase={(cn) => {
          // find the queue item by case number and navigate
          const item = queue.find((q) => q.caseNumber === cn);
          if (item) onViewCase(item.caseId);
        }} />
      ) : loading ? (
        <div className="flex justify-center py-20"><div className="size-8 animate-spin rounded-full border-2 border-brand border-t-transparent" /></div>
      ) : (
        <div className="rounded-[22px] border border-line bg-white/70 p-5 shadow-soft backdrop-blur-md">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-[0.12em] text-muted-ink">
              {queueTab === "my" ? "My assigned cases" : queueTab === "unassigned" ? "Unassigned cases" : "Open SOS requests"}
            </div>
            <SoftBadge tone="attention">Human review required</SoftBadge>
          </div>

          {filteredQueue.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <CheckCircle2 className="size-8 text-improving mb-2" />
              <p className="text-sm font-semibold text-ink">
                {queue.length === 0 ? "No cases in this queue yet" : "No cases match your filters"}
              </p>
              <p className="mt-1 text-xs text-muted-ink">
                {queue.length === 0
                  ? queueTab === "unassigned" ? "All cases have been assigned." : "No cases are currently assigned to you."
                  : "Try adjusting your search or filter."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredQueue.map((item) => (
                <div key={item.caseId} className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-xl border border-line bg-surface/60 px-4 py-3 transition hover:border-brand/30 hover:bg-brand-soft/10">
                  {/* Avatar */}
                  <div className={`grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold ${
                    item.alertSeverity === "priority" ? "bg-priority/12 text-priority"
                    : item.alertSeverity === "attention" ? "bg-attention/12 text-attention"
                    : "bg-improving/12 text-improving"
                  }`}>{item.initials}</div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-ink">{item.caseNumber}</span>
                      <span className="text-xs text-muted-ink">{item.district}</span>
                      {item.alertSeverity && (
                        <SoftBadge tone={item.alertSeverity as any}>{item.alertSeverity}</SoftBadge>
                      )}
                      {item.crisisFlag && (
                        <SoftBadge tone="priority">Crisis flag</SoftBadge>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-ink">
                      {item.latestMood && <span>Mood: <strong className="text-ink">{item.latestMood}</strong></span>}
                      {item.latestScore !== null && <span>Score: <strong className="text-ink">{item.latestScore}</strong></span>}
                      {item.latestTrend && <span>Trend: <strong className="text-ink">{item.latestTrend}</strong></span>}
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />{formatMinutesAgo(item.minutesSinceCheckin)}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-ink">Stage: {item.stage}</div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-line/50">
                    {item.alertSeverity && <StatusIcon tone={item.alertSeverity} />}

                    {queueTab === "unassigned" ? (
                      <button
                        id={`claim-case-${item.caseId}`}
                        disabled={claimingId === item.caseId}
                        onClick={() => handleClaimCase(item.caseId)}
                        className="flex items-center gap-1.5 shrink-0 rounded-xl bg-brand px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-brand/90 disabled:opacity-50"
                      >
                        {claimingId === item.caseId
                          ? <span className="size-3 animate-spin rounded-full border border-white border-t-transparent" />
                          : <UserPlus className="size-3.5" />}
                        Claim case
                      </button>
                    ) : (
                      <button
                        id={`review-case-${item.caseId}`}
                        onClick={() => onViewCase(item.caseId)}
                        className="flex items-center gap-1.5 shrink-0 rounded-xl bg-brand-soft px-3.5 py-1.5 text-xs font-bold text-brand transition hover:bg-brand/10"
                      >
                        <Eye className="size-3.5" />
                        Review
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── INBOX MODE ── */}
      {tabMode === "inbox" && (
        <div className="space-y-4">
          <div className="rounded-[22px] border border-line bg-white/70 p-5 shadow-soft backdrop-blur-md">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-ink">Caseworker Messaging Inbox</h3>
                <p className="text-xs text-muted-ink">Direct, confidential conversations with participants assigned to you.</p>
              </div>
              <span className="text-xs font-semibold text-muted-ink">
                {conversations.length} active conversation{conversations.length === 1 ? "" : "s"}
              </span>
            </div>

            {conversations.length === 0 ? (
              <div className="rounded-xl border border-line bg-surface/60 p-12 text-center text-muted-ink text-sm">
                No active participant conversations yet. Messages sent by participants will appear here.
              </div>
            ) : (
              <div className="divide-y divide-line rounded-xl border border-line bg-surface/50 overflow-hidden">
                {conversations.map((conv) => (
                  <div
                    key={conv.caseId}
                    onClick={() => onViewCase(conv.caseId)}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 hover:bg-surface/80 transition cursor-pointer"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand font-bold text-xs mt-0.5">
                        {conv.victimName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-ink">{conv.victimName}</span>
                          <span className="text-[11px] font-mono text-muted-ink">{conv.caseNumber}</span>
                          <SoftBadge tone="uncertain">{conv.district}</SoftBadge>
                          {conv.unreadCount > 0 && (
                            <span className="rounded-full bg-priority px-2 py-0.5 text-[10px] font-bold text-white">
                              {conv.unreadCount} new
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-muted-ink line-clamp-1">
                          {conv.lastSenderRole === "professional" && <span className="font-semibold text-ink">You: </span>}
                          {conv.lastMessageBody ?? "No messages yet"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                      <span className="text-[11px] text-muted-ink">
                        {conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); onViewCase(conv.caseId); }}
                        className="rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white hover:bg-brand/90 transition"
                      >
                        Open chat
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Command Palette */}
      <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen}>
        <CommandInput placeholder="Search cases, commands, jump to view..." />
        <CommandList>
          <CommandEmpty>No matching actions found.</CommandEmpty>
          <CommandGroup heading="Queue">
            {queue.slice(0, 5).map((item) => (
              <CommandItem key={item.caseId} onSelect={() => { setCmdOpen(false); onViewCase(item.caseId); }}>
                <Eye className="mr-2 size-4 text-brand" />
                Review {item.caseNumber} — {item.latestMood ?? item.stage}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Navigation">
            <CommandItem onSelect={() => { setTabMode("queue"); setQueueTab("my"); setCmdOpen(false); }}>
              <ListFilter className="mr-2 size-4" />My assigned cases
            </CommandItem>
            <CommandItem onSelect={() => { setTabMode("queue"); setQueueTab("unassigned"); setCmdOpen(false); }}>
              <UserPlus className="mr-2 size-4" />Unassigned cases
            </CommandItem>
            <CommandItem onSelect={() => { setTabMode("queue"); setQueueTab("sos"); setCmdOpen(false); }}>
              <Siren className="mr-2 size-4 text-priority" />Open SOS requests
            </CommandItem>
            <CommandItem onSelect={() => { setTabMode("pipeline"); setCmdOpen(false); }}>
              <Kanban className="mr-2 size-4" />Intervention pipeline board
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}
