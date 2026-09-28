import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScoreArc, ContributionBars, SoftBadge, Timeline } from "@/components/nira-primitives";
import {
  fetchCaseDetail,
  fetchCheckins,
  fetchScores,
  fetchAlerts,
  fetchCaseEvents,
  fetchMessages,
  sendMessage,
  markMessagesRead,
  updateAlertStatus,
  updateCaseStage,
  postCaseEvent,
  fetchAppointments,
  updateAppointmentStatus,
  type CaseDetail,
  type CheckinRow,
  type ScoreRow,
  type AlertRow,
  type MessageRow,
  type AppointmentRow,
} from "@/lib/nira-data";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  ArrowLeft, CheckCircle2, ChevronRight, ShieldAlert, ShieldCheck, Activity, Mic, Clock,
  Sparkles, Send, MessageSquare, Calendar, CalendarCheck, CalendarX,
  Lock, Unlock, Volume2, VolumeX, Eye, EyeOff, RefreshCw, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { CaseNotes } from "./CaseNotes";
import { REFERRAL_DIRECTORY, type ReferralResource } from "@/lib/nira-referrals";
import {
  STRUCTURED_UPDATE_TYPES,
  type StructuredUpdateType,
  postStructuredCaseUpdate,
  updateCaseFollowUpDate,
} from "@/lib/nira-data";

const INTERVENTION_STEPS = ["Recommended", "Reviewed", "Assigned", "In Progress", "Outcome Recorded"] as const;
type InterventionStatus = typeof INTERVENTION_STEPS[number];

const CASE_STAGES = ["Registered", "Under review", "Support assigned", "In progress", "Follow-up", "Closed"];

const SIGNAL_CHIP_STYLES: Record<string, string> = {
  GOOD: "bg-improving/12 text-improving",
  DEGRADED: "bg-attention/12 text-attention",
  EXCLUDED: "bg-priority/12 text-priority",
  UNAVAILABLE: "bg-uncertain/12 text-uncertain",
  UNCERTAIN: "bg-uncertain/12 text-uncertain",
};

interface Props {
  caseId: string;
  userId: string;
  userName: string;
  onBack: () => void;
}

export default function ProfessionalReview({ caseId, userId, userName, onBack }: Props) {
  const [caseDetail, setCaseDetail] = useState<CaseDetail | null>(null);
  const [checkins, setCheckins] = useState<CheckinRow[]>([]);
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [interventionStatus, setInterventionStatus] = useState<InterventionStatus>("Recommended");
  const [interventionId, setInterventionId] = useState<string | null>(null);
  const [updatingStep, setUpdatingStep] = useState<InterventionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePanel, setActivePanel] = useState<"overview" | "checkins" | "messages" | "events" | "notes" | "referrals">("overview");
  const [selectedUpdateType, setSelectedUpdateType] = useState<StructuredUpdateType>("Status update");
  const [followUpDateInput, setFollowUpDateInput] = useState("");
  const [referralDistrict, setReferralDistrict] = useState("Chennai");
  const [referralCategory, setReferralCategory] = useState<string>("all");
  const [messageBody, setMessageBody] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const [stageUpdating, setStageUpdating] = useState(false);
  const [newStage, setNewStage] = useState("");
  const [newStatusText, setNewStatusText] = useState("");
  const [eventVisibleToVictim, setEventVisibleToVictim] = useState(true);
  const [eventBody, setEventBody] = useState("");
  const [postingEvent, setPostingEvent] = useState(false);
  const msgEndRef = useRef<HTMLDivElement>(null);
  const realtimeRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const latestScore = scores[scores.length - 1] ?? null;

  const loadAll = async () => {
    setLoading(true);
    const detail = await fetchCaseDetail(caseId);
    if (!detail) { setLoading(false); return; }
    setCaseDetail(detail);

    const [chk, scr, alr, ev, msg, appts] = await Promise.all([
      fetchCheckins(detail.victimId),
      fetchScores(detail.victimId),
      fetchAlerts(detail.victimId),
      fetchCaseEvents(caseId),
      fetchMessages(caseId),
      fetchAppointments(caseId),
    ]);
    setCheckins(chk);
    setScores(scr);
    setAlerts(alr);
    setEvents(ev);
    setMessages(msg);
    setAppointments(appts);
    setNewStage(detail.stage);

    // Load existing intervention
    const { data: interventions } = await supabase
      .from("interventions")
      .select("id, status")
      .eq("victim_id", detail.victimId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (interventions?.[0]) {
      setInterventionId(interventions[0].id);
      setInterventionStatus(interventions[0].status as InterventionStatus);
    }

    // Log audit
    await supabase.from("audit_log").insert({
      case_id: caseId,
      actor_id: userId,
      actor_name: userName,
      actor_role: "professional",
      action: "Viewed Case Review",
      details: `Viewed case ${detail.caseNumber}`,
    });

    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    markMessagesRead(caseId, "professional");
  }, [caseId]);

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Realtime for messages
  useEffect(() => {
    if (realtimeRef.current) supabase.removeChannel(realtimeRef.current);
    const channel = supabase
      .channel(`case-review-${caseId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `case_id=eq.${caseId}` }, async (payload) => {
        const m = payload.new as any;
        if (m.sender_role === "victim") {
          setMessages((prev) => [...prev, {
            id: m.id, caseId: m.case_id, senderId: m.sender_id,
            senderRole: m.sender_role, body: m.body, readAt: m.read_at, createdAt: m.created_at,
          }]);
          toast.info("New message from participant");
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "checkins", filter: `victim_id=eq.${caseDetail?.victimId}` }, () => {
        loadAll();
        toast.info("New check-in submitted");
      })
      .subscribe();
    realtimeRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [caseId, caseDetail?.victimId]);

  const handleStepClick = async (step: InterventionStatus) => {
    setUpdatingStep(step);
    if (!interventionId) {
      const { data: newInt } = await supabase
        .from("interventions")
        .insert({ victim_id: caseDetail!.victimId, type: "counselling_outreach", status: step, assigned_professional: userId })
        .select("id").single();
      if (newInt) setInterventionId(newInt.id);
    } else {
      await supabase.from("interventions").update({ status: step }).eq("id", interventionId);
    }
    setInterventionStatus(step);
    setUpdatingStep(null);
    toast.success(`Intervention updated: ${step}`);
    await postCaseEvent(caseId, "intervention_update", `Intervention advanced to "${step}"`, false, userId);
  };

  const handleAlertAction = async (alertId: string, status: "reviewed" | "resolved") => {
    await updateAlertStatus(alertId, status, caseId, userId, userName);
    setAlerts((prev) => prev.map((a) => a.id === alertId ? { ...a, status } : a));
    toast.success(`Alert marked as ${status}`);
  };

  const handleSendMessage = async () => {
    if (!messageBody.trim()) return;
    setSendingMsg(true);
    const msg = await sendMessage(caseId, userId, "professional", messageBody.trim());
    if (msg) {
      setMessages((prev) => [...prev, msg]);
      setMessageBody("");
    } else {
      toast.error("Could not send message. Please try again.");
    }
    setSendingMsg(false);
  };

  const handlePostEvent = async () => {
    if (!eventBody.trim()) return;
    setPostingEvent(true);
    await postCaseEvent(caseId, "case_update", eventBody.trim(), eventVisibleToVictim, userId);
    setEventBody("");
    const ev = await fetchCaseEvents(caseId);
    setEvents(ev);
    toast.success("Case update posted");
    setPostingEvent(false);
  };

  const handleStageUpdate = async () => {
    if (!newStage || !newStatusText.trim()) return;
    setStageUpdating(true);
    await updateCaseStage(caseId, newStage, newStatusText.trim(), userId, userName);
    setCaseDetail((prev) => prev ? { ...prev, stage: newStage, statusText: newStatusText.trim() } : prev);
    setNewStatusText("");
    toast.success(`Stage updated to "${newStage}"`);
    setStageUpdating(false);
  };

  const handleStructuredUpdate = async () => {
    if (!newStatusText.trim()) return;
    setStageUpdating(true);
    const res = await postStructuredCaseUpdate(
      caseId,
      selectedUpdateType,
      newStatusText.trim(),
      eventVisibleToVictim,
      userId,
      newStage || undefined
    );
    if (res.ok) {
      if (followUpDateInput) {
        await updateCaseFollowUpDate(caseId, new Date(followUpDateInput).toISOString());
      }
      toast.success(`Case update recorded: ${selectedUpdateType}`);
      setNewStatusText("");
      const ev = await fetchCaseEvents(caseId);
      setEvents(ev);
      if (newStage) {
        setCaseDetail((prev) => prev ? { ...prev, stage: newStage, statusText: newStatusText.trim() } : prev);
      }
    } else {
      toast.error(res.error || "Could not update case.");
    }
    setStageUpdating(false);
  };

  const handleSendReferralToVictim = async (res: ReferralResource) => {
    const text = `Community referral recommendation: ${res.name}\nService: ${res.description}\nPhone / Helpline: ${res.phone}\nAddress: ${res.address} (${res.hours})`;
    const msg = await sendMessage(caseId, userId, "professional", text);
    if (msg) {
      setMessages((prev) => [...prev, msg]);
      await postCaseEvent(caseId, "referral_shared", `Shared referral details for ${res.name} with participant.`, true, userId);
      toast.success(`Referral sent to participant: ${res.name}`);
    } else {
      toast.error("Could not send referral message.");
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="size-8 animate-spin rounded-full border-2 border-brand border-t-transparent" /></div>;
  }

  if (!caseDetail) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-semibold text-muted-ink hover:text-ink">
          <ArrowLeft className="size-4" /> Back to queue
        </button>
        <div className="rounded-xl border border-priority/30 bg-priority/10 p-6 text-center">
          <AlertTriangle className="mx-auto mb-2 size-8 text-priority" />
          <p className="text-sm font-bold text-ink">Case not found</p>
          <p className="mt-1 text-xs text-muted-ink">This case may have been closed or you may not have access.</p>
        </div>
      </div>
    );
  }

  const chartData = scores.map((s) => ({
    label: new Date(s.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
    score: Math.round(s.compositeScore),
  }));

  const contribBars = latestScore ? [
    { label: "Sentiment", value: Math.round(latestScore.sentimentComponent), tone: "bg-brand" },
    { label: "Emotion", value: Math.round(latestScore.emotionComponent), tone: "bg-attention" },
    { label: "Behaviour", value: Math.round(latestScore.behaviourComponent), tone: "bg-sage" },
  ] : [];

  const sq = latestScore?.signalQuality ?? {};
  const qualityStatus = (sq?.status as string) ?? "GOOD";
  const openAlerts = alerts.filter((a) => a.status !== "resolved");
  const unreadMsgCount = messages.filter((m) => m.senderRole === "victim" && !m.readAt).length;

  const QUICK_REPLIES = [
    "Thank you for your check-in. I'm reviewing your update and will respond shortly.",
    "I've noted your message. Your safety is the priority — please reach out immediately if anything feels urgent.",
    "We've scheduled a follow-up appointment. Please confirm if the proposed time works for you.",
    "Your case has been reviewed. Here's an update on your support plan.",
  ];

  return (
    <div className="space-y-5">
      {/* Back + case header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-semibold text-muted-ink hover:text-ink transition">
          <ArrowLeft className="size-4" /> Back to queue
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-ink">{caseDetail.caseNumber}</span>
          <SoftBadge tone="uncertain">{caseDetail.district}</SoftBadge>
          <SoftBadge tone={
            caseDetail.stage === "Closed" ? "stable" as any
            : openAlerts.some((a) => a.severity === "priority") ? "priority"
            : openAlerts.some((a) => a.severity === "attention") ? "attention"
            : "improving"
          }>{caseDetail.stage}</SoftBadge>
          {!caseDetail.consentShareText && (
            <SoftBadge tone="uncertain" icon={<EyeOff className="size-3" />}>Text hidden by consent</SoftBadge>
          )}
          {!caseDetail.consentShareVoice && (
            <SoftBadge tone="uncertain" icon={<VolumeX className="size-3" />}>Voice hidden by consent</SoftBadge>
          )}
        </div>
      </div>

      {/* Decision-Support Safeguard */}
      <div className="flex items-start gap-2.5 rounded-xl border border-brand/20 bg-brand-soft/40 px-3.5 py-2.5 text-xs text-ink">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-brand" />
        <div>
          <span className="font-bold text-brand">Decision-Support Safeguard:</span> A view for human review, not an automated determination. Algorithmic scores never replace professional casework judgement.
        </div>
      </div>

      {/* Open Alerts */}
      {openAlerts.length > 0 && (
        <div className="space-y-2">
          {openAlerts.map((a) => (
            <div key={a.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
              a.severity === "priority" ? "border-priority/40 bg-priority/10" : "border-attention/40 bg-attention/10"
            }`}>
              <div className="flex items-center gap-2">
                <ShieldAlert className={`size-4 ${a.severity === "priority" ? "text-priority" : "text-attention"}`} />
                <span className="text-xs font-bold text-ink">{a.severity.charAt(0).toUpperCase() + a.severity.slice(1)} alert</span>
                <span className="text-xs text-muted-ink">{new Date(a.createdAt).toLocaleString("en-IN")}</span>
                <SoftBadge tone="uncertain">{a.status}</SoftBadge>
              </div>
              <div className="flex gap-2">
                {a.status === "open" && (
                  <button onClick={() => handleAlertAction(a.id, "reviewed")}
                    className="rounded-lg border border-line bg-surface/70 px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface transition">
                    Acknowledge
                  </button>
                )}
                {a.status !== "resolved" && (
                  <button onClick={() => handleAlertAction(a.id, "resolved")}
                    className="rounded-lg bg-improving/15 px-3 py-1.5 text-xs font-semibold text-improving hover:bg-improving/25 transition">
                    Resolve
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Panel Tabs */}
      <div className="flex flex-wrap items-center gap-1 border-b border-line pb-3">
        {([
          { key: "overview", label: "Overview" },
          { key: "checkins", label: `Check-ins (${checkins.length})` },
          { key: "messages", label: unreadMsgCount > 0 ? `Messages (${unreadMsgCount} new)` : `Messages (${messages.length})` },
          { key: "events", label: `Case events (${events.length})` },
          { key: "notes", label: "Private notes" },
          { key: "referrals", label: "Referral directory" },
        ] as { key: typeof activePanel; label: string }[]).map(({ key, label }) => (
          <button key={key} onClick={() => setActivePanel(key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activePanel === key ? "bg-brand text-white" : "text-muted-ink hover:text-ink border border-line"
            } ${key === "messages" && unreadMsgCount > 0 ? "!bg-brand !text-white ring-2 ring-brand/30" : ""}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW PANEL ── */}
      {activePanel === "overview" && (
        <div className="space-y-5">
          {/* Score Arc */}
          {latestScore && (
            <div className="rounded-[22px] border border-line bg-white/70 p-6 shadow-soft backdrop-blur-md">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.12em] text-muted-ink">Why did the wellbeing view change?</div>
                  <p className="mt-0.5 text-xs text-muted-ink">Multimodal signal decomposition across speech, sentiment and check-in cadence.</p>
                </div>
                <SoftBadge tone="improving" icon={<ShieldCheck className="size-3" />}>Decision Support</SoftBadge>
              </div>
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
                <div className="flex flex-col items-center">
                  <ScoreArc score={Math.round(latestScore.compositeScore)} trend={latestScore.trend} label="Current view" />
                  <p className="mt-2 text-center text-[10px] font-medium text-muted-ink max-w-[190px]">
                    For human review only — not an automated decision
                  </p>
                </div>
                <div className="flex-1 space-y-4">
                  {/* Signal quality */}
                  <div>
                    <div className="mb-2 text-xs font-semibold text-muted-ink">Signal quality</div>
                    <div className="flex flex-wrap gap-2">
                      {(["GOOD", "DEGRADED", "EXCLUDED", "UNAVAILABLE", "UNCERTAIN"] as const).map((chip) => (
                        <span key={chip} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${qualityStatus === chip ? SIGNAL_CHIP_STYLES[chip] : "bg-surface text-muted-ink opacity-40"}`}>
                          {chip}
                        </span>
                      ))}
                    </div>
                  </div>
                  {/* Contribution bars */}
                  {contribBars.length > 0 && (
                    <div>
                      <div className="mb-2 text-xs font-semibold text-muted-ink">Signal contributions</div>
                      <div className="space-y-2.5">
                        {contribBars.map((bar) => (
                          <div key={bar.label}>
                            <div className="mb-1 flex justify-between text-xs">
                              <span className="font-semibold text-ink">{bar.label}</span>
                              <span className="text-muted-ink">{bar.value}%</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-primary-soft">
                              <div className={`h-full rounded-full ${bar.tone}`} style={{ width: `${bar.value}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {latestScore.crisisFlag && (
                    <div className="rounded-xl bg-priority/10 px-4 py-3 text-xs font-semibold text-priority">
                      ⚠ Crisis language detected — human review essential. Verify support availability.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Score trajectory chart */}
          {chartData.length > 1 && (
            <div className="rounded-[22px] border border-line bg-white/70 p-6 shadow-soft backdrop-blur-md">
              <div className="mb-4 text-xs font-bold uppercase tracking-[0.12em] text-muted-ink">Trajectory over time</div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--text-secondary)" }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--text-secondary)" }} />
                  <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} labelStyle={{ fontWeight: 700 }} />
                  <ReferenceLine y={75} stroke="var(--priority)" strokeDasharray="4 4" label={{ value: "Review threshold", fontSize: 10, fill: "var(--priority)" }} />
                  <Line type="monotone" dataKey="score" stroke="var(--primary)" strokeWidth={3} dot={{ fill: "var(--primary)", r: 5 }} activeDot={{ r: 7 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Appointments */}
          {appointments.length > 0 && (
            <div className="rounded-[22px] border border-line bg-white/70 p-5 shadow-soft backdrop-blur-md">
              <div className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-muted-ink">Appointments</div>
              <div className="space-y-2">
                {appointments.map((appt) => (
                  <div key={appt.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface/60 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Calendar className="size-4 text-brand" />
                      <div>
                        <div className="text-xs font-semibold text-ink">
                          {new Date(appt.scheduledAt).toLocaleString("en-IN")} · {appt.mode.replace("_", " ")}
                        </div>
                        {appt.notes && <div className="text-xs text-muted-ink">{appt.notes}</div>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <SoftBadge tone={appt.status === "accepted" ? "improving" : appt.status === "reschedule_requested" ? "attention" : "uncertain"}>
                        {appt.status.replace("_", " ")}
                      </SoftBadge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Post Structured Case Update */}
          <div className="rounded-[22px] border border-line bg-white/70 p-5 shadow-soft backdrop-blur-md">
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-muted-ink">Record Case Decision & Update</div>
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div>
                  <label className="text-[10px] font-bold text-muted-ink uppercase">Update Type</label>
                  <select
                    value={selectedUpdateType}
                    onChange={(e) => setSelectedUpdateType(e.target.value as StructuredUpdateType)}
                    className="h-9 w-full rounded-lg border border-line bg-surface/80 px-2.5 text-xs font-semibold text-ink focus:border-brand focus:outline-hidden"
                  >
                    {STRUCTURED_UPDATE_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-ink uppercase">Case Stage</label>
                  <select
                    value={newStage}
                    onChange={(e) => setNewStage(e.target.value)}
                    className="h-9 w-full rounded-lg border border-line bg-surface/80 px-2.5 text-xs font-semibold text-ink focus:border-brand focus:outline-hidden"
                  >
                    <option value="">Keep current ({caseDetail.stage})</option>
                    {CASE_STAGES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-ink uppercase">Follow-up Date</label>
                  <input
                    type="date"
                    value={followUpDateInput}
                    onChange={(e) => setFollowUpDateInput(e.target.value)}
                    className="h-9 w-full rounded-lg border border-line bg-surface/80 px-2.5 text-xs text-ink focus:border-brand focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <input
                  value={newStatusText}
                  onChange={(e) => setNewStatusText(e.target.value)}
                  placeholder="Record caseworker update note for case timeline..."
                  className="h-10 w-full rounded-lg border border-line bg-surface/80 px-3 text-xs text-ink placeholder:text-muted-ink focus:border-brand focus:outline-hidden"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface/80 px-3 py-1.5 text-xs font-medium text-muted-ink hover:text-ink transition">
                  <input
                    type="checkbox"
                    checked={eventVisibleToVictim}
                    onChange={(e) => setEventVisibleToVictim(e.target.checked)}
                    className="accent-brand"
                  />
                  {eventVisibleToVictim ? <Eye className="size-3.5 text-brand" /> : <EyeOff className="size-3.5 text-muted-ink" />}
                  <span>{eventVisibleToVictim ? "Visible to participant" : "Private caseworker event"}</span>
                </label>
                <button
                  onClick={handleStructuredUpdate}
                  disabled={stageUpdating || !newStatusText.trim()}
                  className="h-9 rounded-xl bg-brand px-5 text-xs font-bold text-white shadow-sm hover:bg-brand/90 disabled:opacity-40 transition"
                >
                  {stageUpdating ? "Saving update…" : "Post Case Update"}
                </button>
              </div>
            </div>
          </div>

          {/* Intervention workflow */}
          <div className="rounded-[22px] border border-line bg-white/70 p-5 shadow-soft backdrop-blur-md">
            <div className="mb-4 text-xs font-bold uppercase tracking-[0.12em] text-muted-ink">Intervention workflow</div>
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
                        isCurrent ? "bg-brand text-white"
                        : isPast ? "bg-improving/15 text-improving"
                        : isNext ? "border border-dashed border-brand text-brand hover:bg-brand-soft"
                        : "bg-surface text-muted-ink opacity-50"
                      }`}
                    >
                      {isPast && <CheckCircle2 className="size-3" />}
                      {step}
                      {updatingStep === step && <span className="size-3 animate-spin rounded-full border border-current border-t-transparent" />}
                    </button>
                    {i < INTERVENTION_STEPS.length - 1 && <ChevronRight className="size-3 text-muted-ink" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Human decision buttons */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button id="decision-refer"
              onClick={async () => {
                await supabase.from("interventions").insert({ victim_id: caseDetail.victimId, type: "legal_referral", status: "Recommended", assigned_professional: userId });
                await postCaseEvent(caseId, "legal_referral", "Legal support referral initiated.", true, userId);
                toast.success("Legal referral recorded.");
              }}
              className="rounded-xl border border-line bg-surface/70 px-4 py-3 text-sm font-bold text-ink transition hover:border-brand/30 hover:bg-brand-soft/20 shadow-xs">
              Refer for legal support
            </button>
            <button id="decision-counselling"
              onClick={() => handleStepClick("Assigned")}
              className="rounded-xl bg-brand py-3 text-sm font-bold text-white shadow-lg shadow-brand/20 transition hover:bg-brand/90">
              Assign counselling
            </button>
            <button id="decision-no-action"
              onClick={() => { setInterventionStatus("Reviewed"); toast.success("Marked as reviewed — no further action at this time."); }}
              className="rounded-xl border border-line bg-surface/70 px-4 py-3 text-sm font-bold text-muted-ink transition hover:text-ink">
              No further action
            </button>
          </div>
        </div>
      )}

      {/* ── CHECK-INS PANEL ── */}
      {activePanel === "checkins" && (
        <div className="space-y-3">
          {checkins.length === 0 ? (
            <div className="rounded-xl border border-line bg-surface/60 p-8 text-center text-muted-ink text-sm">No check-ins recorded yet.</div>
          ) : checkins.map((c) => (
            <div key={c.id} className="rounded-xl border border-line bg-surface/60 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-ink">{c.moodLabel}</span>
                  <SoftBadge tone="uncertain">{c.channel}</SoftBadge>
                </div>
                <span className="text-xs text-muted-ink">{new Date(c.createdAt).toLocaleString("en-IN")}</span>
              </div>
              {caseDetail.consentShareText && c.messageText && (
                <p className="text-xs text-muted-ink">{c.messageText}</p>
              )}
              {!caseDetail.consentShareText && c.messageText && (
                <p className="text-xs text-muted-ink italic flex items-center gap-1"><EyeOff className="size-3" /> Message text hidden by participant consent.</p>
              )}
              {caseDetail.consentShareVoice && c.voiceUrl && (
                <audio controls src={c.voiceUrl} className="mt-2 h-8 w-full" />
              )}
              {!caseDetail.consentShareVoice && c.voiceUrl && (
                <p className="mt-2 text-xs text-muted-ink italic flex items-center gap-1"><VolumeX className="size-3" /> Voice audio hidden by participant consent.</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── MESSAGES PANEL ── */}
      {activePanel === "messages" && (
        <div className="rounded-[22px] border border-line bg-white/70 shadow-soft backdrop-blur-md flex flex-col" style={{ minHeight: 440 }}>
          <div className="border-b border-line px-5 py-3 flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-[0.12em] text-muted-ink">Direct messages with participant</div>
            <SoftBadge tone="brand" icon={<Lock className="size-3" />}>Private & encrypted</SoftBadge>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-3" style={{ maxHeight: 320 }}>
            {messages.length === 0 ? (
              <div className="text-center text-xs text-muted-ink py-8">No messages yet. Start the conversation below.</div>
            ) : messages.map((m) => {
              const isMine = m.senderRole === "professional";
              return (
                <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-xs ${
                    isMine ? "bg-brand text-white rounded-br-sm" : "bg-surface border border-line text-ink rounded-bl-sm"
                  }`}>
                    <p>{m.body}</p>
                    <div className={`mt-1 text-[10px] ${isMine ? "text-white/60" : "text-muted-ink"} flex items-center gap-1`}>
                      {new Date(m.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      {isMine && m.readAt && <CheckCircle2 className="size-2.5" />}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={msgEndRef} />
          </div>
          {/* Quick replies */}
          <div className="px-5 py-2 border-t border-line/60 flex flex-wrap gap-1.5">
            {QUICK_REPLIES.map((r, i) => (
              <button key={i} onClick={() => setMessageBody(r)}
                className="rounded-full border border-line bg-surface/70 px-2.5 py-1 text-[10px] font-medium text-muted-ink hover:border-brand/40 hover:text-ink transition">
                {r.slice(0, 40)}…
              </button>
            ))}
          </div>
          <div className="border-t border-line p-4 flex gap-2">
            <textarea value={messageBody} onChange={(e) => setMessageBody(e.target.value)}
              placeholder="Write a message to the participant…"
              rows={2}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
              className="flex-1 resize-none rounded-xl border border-line bg-surface/80 px-3 py-2 text-xs text-ink placeholder:text-muted-ink focus:border-brand focus:outline-hidden" />
            <button onClick={handleSendMessage} disabled={sendingMsg || !messageBody.trim()}
              className="rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white hover:bg-brand/90 disabled:opacity-40 transition">
              <Send className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── CASE EVENTS PANEL ── */}
      {activePanel === "events" && (
        <div className="space-y-3">
          {events.length === 0 ? (
            <div className="rounded-xl border border-line bg-surface/60 p-8 text-center text-muted-ink text-sm">No case events yet.</div>
          ) : events.map((ev) => (
            <div key={ev.id} className="flex gap-3 rounded-xl border border-line bg-surface/60 px-4 py-3">
              <div className="mt-0.5 size-2 shrink-0 rounded-full bg-brand/60 mt-1.5" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-ink">{ev.event_type?.replace(/_/g, " ")}</span>
                  {ev.visible_to_victim !== undefined && (
                    <SoftBadge tone={ev.visible_to_victim ? "improving" : "uncertain"}>
                      {ev.visible_to_victim ? "Visible to participant" : "Internal only"}
                    </SoftBadge>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-ink">{ev.description}</p>
                <p className="mt-1 text-[10px] text-muted-ink">{new Date(ev.occurred_at).toLocaleString("en-IN")}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── NOTES PANEL ── */}
      {activePanel === "notes" && (
        <CaseNotes caseId={caseId} userId={userId} />
      )}

      {/* ── REFERRAL DIRECTORY PANEL ── */}
      {activePanel === "referrals" && (
        <div className="space-y-4">
          <div className="rounded-[22px] border border-line bg-white/70 p-5 shadow-soft backdrop-blur-md">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-ink">Emergency & Community Referral Directory</h3>
                <p className="text-xs text-muted-ink">Verified support resources for counselling, shelters, and legal aid.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={referralDistrict}
                  onChange={(e) => setReferralDistrict(e.target.value)}
                  className="h-8 rounded-lg border border-line bg-surface/80 px-2.5 text-xs font-semibold text-ink focus:border-brand focus:outline-hidden"
                >
                  <option value="Chennai">Chennai</option>
                  <option value="Coimbatore">Coimbatore</option>
                  <option value="Madurai">Madurai</option>
                </select>
                <select
                  value={referralCategory}
                  onChange={(e) => setReferralCategory(e.target.value)}
                  className="h-8 rounded-lg border border-line bg-surface/80 px-2.5 text-xs font-semibold text-ink focus:border-brand focus:outline-hidden"
                >
                  <option value="all">All services</option>
                  <option value="counselling">Counselling & Helplines</option>
                  <option value="legal_aid">Legal Aid</option>
                  <option value="shelter">Emergency Shelters</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {REFERRAL_DIRECTORY
                .filter((r) => r.district === referralDistrict)
                .filter((r) => referralCategory === "all" || r.category === referralCategory)
                .map((res) => (
                  <div key={res.id} className="flex flex-col justify-between rounded-xl border border-line bg-surface/60 p-4">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-bold text-ink">{res.name}</span>
                        <SoftBadge tone="brand">{res.category.replace("_", " ")}</SoftBadge>
                      </div>
                      <p className="mt-1 text-xs text-muted-ink">{res.description}</p>
                      <div className="mt-2 text-[11px] text-ink font-semibold">📞 {res.phone}</div>
                      <div className="text-[11px] text-muted-ink">📍 {res.address}</div>
                      <div className="text-[10px] text-muted-ink italic mt-0.5">Hours: {res.hours}</div>
                    </div>
                    <button
                      onClick={() => handleSendReferralToVictim(res)}
                      className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-brand/10 border border-brand/20 py-1.5 text-xs font-bold text-brand hover:bg-brand hover:text-white transition"
                    >
                      <Send className="size-3.5" />
                      Send to participant
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Export for use in quick-replies template
const QUICK_REPLIES = [
  "Thank you for your check-in. I'm reviewing your update and will respond shortly.",
  "I've noted your message. Your safety is the priority — please reach out immediately if anything feels urgent.",
  "We've scheduled a follow-up appointment. Please confirm if the proposed time works for you.",
  "Your case has been reviewed. Here's an update on your support plan.",
];
