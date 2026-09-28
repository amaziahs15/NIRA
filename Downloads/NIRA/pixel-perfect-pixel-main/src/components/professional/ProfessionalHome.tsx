import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SoftBadge, StatusIcon } from "@/components/nira-primitives";
import { aggregateData, reviewQueue } from "@/lib/nira-demo";
import {
  BarChart2,
  ClipboardList,
  ShieldAlert,
  TrendingUp,
  Search,
  SlidersHorizontal,
  Command as CommandIcon,
  Kanban,
  ListFilter,
  Eye,
  CheckCircle2,
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

type TabMode = "queue" | "pipeline";

export default function ProfessionalHome({ userId, onViewCase }: Props) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [caseCount, setCaseCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [useDemoData, setUseDemoData] = useState(false);
  const [tabMode, setTabMode] = useState<TabMode>("queue");
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"newest" | "severity">("newest");
  const [cmdOpen, setCmdOpen] = useState(false);

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

  const loadData = async () => {
    try {
      const { data: cases, error: casesErr } = await supabase
        .from("cases")
        .select("id", { count: "exact" })
        .eq("assigned_professional", userId);

      if (!casesErr && cases) setCaseCount(cases.length);

      const { data: alertData, error: alertErr } = await supabase
        .from("alerts")
        .select(`id, severity, created_at, victim_id, victims(profile_id, cases(case_number, stage))`)
        .neq("status", "resolved")
        .order("created_at", { ascending: false })
        .limit(20);

      if (!alertErr && alertData && alertData.length > 0) {
        setAlerts(alertData as Alert[]);
        setUseDemoData(false);
      } else {
        setUseDemoData(true);
      }
    } catch {
      setUseDemoData(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Supabase Realtime alerts subscription
    const channel = supabase
      .channel("public:alerts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alerts" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            toast.info("New case alert received in real-time");
          }
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const metrics = [
    { label: "Active cases", value: caseCount || aggregateData.activeCases, icon: ClipboardList, tone: "brand" as const },
    { label: "Priority alerts", value: aggregateData.priorityAlerts, icon: ShieldAlert, tone: "priority" as const },
    { label: "Open alerts", value: aggregateData.openAlerts, icon: BarChart2, tone: "attention" as const },
    { label: "Improving", value: aggregateData.improving, icon: TrendingUp, tone: "improving" as const },
  ];

  const rawQueue = useDemoData
    ? reviewQueue
    : alerts.map((a) => ({
        caseNumber: a.victims?.cases?.[0]?.case_number ?? "NIRA-???",
        initials: "AP",
        detail: `${a.severity.charAt(0).toUpperCase() + a.severity.slice(1)} alert`,
        trend: a.severity === "priority" ? "Priority review" : "Needs attention",
        severity: a.severity,
        summary: `An alert flagged for ${a.severity} review.`,
        caseId: a.id,
      }));

  // Filtered & sorted queue
  const filteredQueue = useMemo(() => {
    return rawQueue
      .filter((item) => {
        if (severityFilter !== "all" && item.severity !== severityFilter) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchesNum = item.caseNumber.toLowerCase().includes(q);
          const matchesDetail = item.detail.toLowerCase().includes(q);
          const matchesSummary = item.summary.toLowerCase().includes(q);
          return matchesNum || matchesDetail || matchesSummary;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "severity") {
          const rank: Record<string, number> = { priority: 3, attention: 2, improving: 1, uncertain: 0 };
          return (rank[b.severity] ?? 0) - (rank[a.severity] ?? 0);
        }
        return 0;
      });
  }, [rawQueue, severityFilter, searchQuery, sortBy]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="size-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-ink">
            Support workspace
          </div>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">
            A clear view for human review
          </h2>
          {useDemoData && (
            <div className="mt-2">
              <SoftBadge tone="uncertain">Demo review cases — live database connected</SoftBadge>
            </div>
          )}
        </div>

        {/* Command palette search trigger */}
        <button
          type="button"
          onClick={() => setCmdOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface/80 px-3.5 py-2 text-xs font-semibold text-muted-ink shadow-xs transition hover:border-brand/40 hover:text-ink"
        >
          <Search className="size-3.5" />
          <span>Quick actions...</span>
          <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 text-[10px] font-mono text-muted-ink">
            ⌘K
          </kbd>
        </button>
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
              <SoftBadge tone={m.tone} />
            </div>
          );
        })}
      </div>

      {/* Workspace Tabs: Priority Queue vs. Pipeline Board */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div className="flex items-center gap-1 rounded-xl border border-line bg-surface/70 p-1">
          <button
            type="button"
            onClick={() => setTabMode("queue")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
              tabMode === "queue"
                ? "bg-brand text-white shadow-xs"
                : "text-muted-ink hover:text-ink hover:bg-surface"
            }`}
          >
            <ListFilter className="size-3.5" />
            <span>Review Queue ({filteredQueue.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setTabMode("pipeline")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
              tabMode === "pipeline"
                ? "bg-brand text-white shadow-xs"
                : "text-muted-ink hover:text-ink hover:bg-surface"
            }`}
          >
            <Kanban className="size-3.5" />
            <span>Intervention Pipeline</span>
          </button>
        </div>

        {tabMode === "queue" && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-ink" />
              <input
                type="text"
                placeholder="Filter cases..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 rounded-lg border border-line bg-surface/80 pl-8 pr-3 text-xs text-ink placeholder:text-muted-ink focus:border-brand focus:outline-hidden"
              />
            </div>

            {/* Severity Filter */}
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="h-8 rounded-lg border border-line bg-surface/80 px-2.5 text-xs font-medium text-ink focus:border-brand focus:outline-hidden"
            >
              <option value="all">All severities</option>
              <option value="priority">Priority</option>
              <option value="attention">Attention</option>
              <option value="improving">Improving</option>
            </select>

            {/* Sort Order */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="h-8 rounded-lg border border-line bg-surface/80 px-2.5 text-xs font-medium text-ink focus:border-brand focus:outline-hidden"
            >
              <option value="newest">Newest first</option>
              <option value="severity">Highest severity</option>
            </select>
          </div>
        )}
      </div>

      {/* Main Tab Content */}
      {tabMode === "pipeline" ? (
        <InterventionBoard onSelectCase={() => onViewCase("demo-case-id")} />
      ) : (
        <div className="rounded-[22px] border border-line bg-white/70 p-5 shadow-soft backdrop-blur-md">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-[0.12em] text-muted-ink">
              Priority review queue
            </div>
            <SoftBadge tone="attention">Human review required</SoftBadge>
          </div>

          {filteredQueue.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="size-8 text-muted-ink/40 mb-2" />
              <p className="text-sm font-semibold text-ink">No cases match your filters</p>
              <p className="mt-1 text-xs text-muted-ink">Try resetting the search query or severity selector.</p>
              <button
                type="button"
                onClick={() => { setSearchQuery(""); setSeverityFilter("all"); }}
                className="mt-3 rounded-lg bg-surface border border-line px-3 py-1.5 text-xs font-semibold text-brand hover:border-brand/40"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredQueue.map((item, idx) => (
                <div
                  key={idx}
                  id={`case-queue-item-${idx}`}
                  className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-xl border border-line bg-surface/60 px-4 py-3 transition hover:border-brand/30 hover:bg-brand-soft/20"
                >
                  {/* Initials avatar */}
                  <div
                    className={`grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold ${
                      item.severity === "priority"
                        ? "bg-priority/12 text-priority"
                        : item.severity === "attention"
                        ? "bg-attention/12 text-attention"
                        : "bg-improving/12 text-improving"
                    }`}
                  >
                    {item.initials}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-bold text-ink">{item.caseNumber}</div>
                      <SoftBadge
                        tone={
                          item.severity === "priority"
                            ? "priority"
                            : item.severity === "attention"
                            ? "attention"
                            : item.severity === "improving"
                            ? "improving"
                            : "uncertain"
                        }
                      >
                        {item.trend}
                      </SoftBadge>
                    </div>
                    <div className="mt-0.5 text-xs font-medium text-ink">{item.detail}</div>
                    <div className="mt-1 text-xs text-muted-ink">{item.summary}</div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-line/50">
                    <StatusIcon tone={item.severity} />
                    <button
                      id={`review-case-${idx}`}
                      onClick={() => onViewCase("demo-case-id")}
                      className="shrink-0 rounded-xl bg-brand-soft px-3.5 py-1.5 text-xs font-bold text-brand transition hover:bg-brand/10 hover:shadow-xs"
                    >
                      Review
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Command Palette Modal */}
      <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen}>
        <CommandInput placeholder="Search cases, commands, or jump to view..." />
        <CommandList>
          <CommandEmpty>No matching actions found.</CommandEmpty>
          <CommandGroup heading="Cases for Review">
            <CommandItem
              onSelect={() => {
                setCmdOpen(false);
                onViewCase("demo-case-id");
              }}
            >
              <Eye className="mr-2 size-4 text-brand" />
              <span>Review Case NIRA-1024 (Priority)</span>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setCmdOpen(false);
                onViewCase("demo-case-id");
              }}
            >
              <Eye className="mr-2 size-4 text-attention" />
              <span>Review Case NIRA-1021 (Needs attention)</span>
            </CommandItem>
          </CommandGroup>
          <CommandGroup heading="Workspace Navigation">
            <CommandItem
              onSelect={() => {
                setTabMode("queue");
                setCmdOpen(false);
              }}
            >
              <ListFilter className="mr-2 size-4" />
              <span>Switch to Priority Review Queue</span>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setTabMode("pipeline");
                setCmdOpen(false);
              }}
            >
              <Kanban className="mr-2 size-4" />
              <span>Switch to Intervention Pipeline Board</span>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setSeverityFilter("priority");
                setTabMode("queue");
                setCmdOpen(false);
              }}
            >
              <ShieldAlert className="mr-2 size-4 text-priority" />
              <span>Filter Priority Cases Only</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}
