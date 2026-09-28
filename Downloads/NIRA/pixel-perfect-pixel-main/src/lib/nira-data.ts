/**
 * nira-data.ts
 * Shared Supabase data-access helpers. All queries return real data.
 * Demo/fallback data is NEVER silently injected here.
 */

import { supabase } from "@/integrations/supabase/client";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CaseQueueItem {
  caseId: string;
  caseNumber: string;
  stage: string;
  district: string;
  assignedProfessional: string | null;
  victimId: string;
  profileName: string;
  initials: string;
  latestMood: string | null;
  latestScore: number | null;
  latestTrend: string | null;
  alertSeverity: string | null;
  lastCheckinAt: string | null;
  minutesSinceCheckin: number | null;
  crisisFlag: boolean;
}

export interface CaseDetail {
  id: string;
  caseNumber: string;
  stage: string;
  statusText: string;
  district: string;
  assignedProfessional: string | null;
  victimId: string;
  profileName: string;
  profileId: string;
  consentShareText: boolean;
  consentShareVoice: boolean;
  consentWellbeingMonitoring: boolean;
}

export interface CheckinRow {
  id: string;
  victimId: string;
  moodLabel: string;
  messageText: string | null;
  voiceUrl: string | null;
  channel: string;
  createdAt: string;
}

export interface ScoreRow {
  id: string;
  victimId: string;
  checkinId: string | null;
  compositeScore: number;
  sentimentComponent: number;
  emotionComponent: number;
  behaviourComponent: number;
  crisisFlag: boolean;
  signalQuality: Record<string, unknown>;
  trend: string;
  createdAt: string;
}

export interface AlertRow {
  id: string;
  victimId: string;
  severity: "routine" | "attention" | "priority";
  status: "open" | "reviewed" | "resolved";
  createdAt: string;
}

export interface MessageRow {
  id: string;
  caseId: string;
  senderId: string | null;
  senderRole: "victim" | "professional";
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface AppointmentRow {
  id: string;
  caseId: string;
  scheduledAt: string;
  mode: "call" | "in_person" | "video";
  status: "proposed" | "accepted" | "reschedule_requested" | "completed" | "cancelled";
  notes: string | null;
  createdAt: string;
}

export interface SosRow {
  id: string;
  victimId: string;
  requestCode: string;
  status: string;
  createdAt: string;
}

// ─── Professional Queue ──────────────────────────────────────────────────────

export async function fetchProfessionalQueue(
  professionalId: string,
  tab: "my" | "unassigned" | "sos"
): Promise<CaseQueueItem[]> {
  // Base: get cases + victim + profile + latest checkin + latest score + open alerts
  let query = supabase
    .from("cases")
    .select(`
      id,
      case_number,
      stage,
      district,
      assigned_professional,
      victim_id,
      victims!inner(
        id,
        profile_id,
        profiles!inner(name)
      )
    `);

  if (tab === "my") {
    query = query.eq("assigned_professional", professionalId);
  } else if (tab === "unassigned") {
    query = query.is("assigned_professional", null).neq("stage", "Closed");
  } else {
    // SOS tab — get cases with open SOS requests
    const { data: sosVictims } = await supabase
      .from("sos_requests")
      .select("victim_id")
      .not("status", "in", '("Handled","resolved")');

    const victimIds = (sosVictims ?? []).map((s) => s.victim_id);
    if (victimIds.length === 0) return [];

    query = query.in("victim_id", victimIds);
  }

  const { data: cases, error } = await query.limit(50);
  if (error || !cases) return [];

  // For each case, fetch latest checkin, latest score, latest open alert
  const enriched: CaseQueueItem[] = await Promise.all(
    cases.map(async (c: any) => {
      const victim = c.victims;
      const profile = victim?.profiles;
      const victimId = victim?.id ?? "";
      const profileName = profile?.name ?? "Anonymous";

      // Latest checkin
      const { data: checkins } = await supabase
        .from("checkins")
        .select("id, mood_label, created_at")
        .eq("victim_id", victimId)
        .order("created_at", { ascending: false })
        .limit(1);
      const latestCheckin = checkins?.[0] ?? null;

      // Latest score
      const { data: scores } = await supabase
        .from("scores")
        .select("composite_score, trend, crisis_flag")
        .eq("victim_id", victimId)
        .order("created_at", { ascending: false })
        .limit(1);
      const latestScore = scores?.[0] ?? null;

      // Open alert
      const { data: alerts } = await supabase
        .from("alerts")
        .select("severity")
        .eq("victim_id", victimId)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(1);
      const topAlert = alerts?.[0] ?? null;

      const nameParts = profileName.trim().split(/\s+/);
      const initials =
        nameParts.length >= 2
          ? `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase()
          : profileName.slice(0, 2).toUpperCase();

      const lastCheckinAt = latestCheckin?.created_at ?? null;
      const minutesSinceCheckin = lastCheckinAt
        ? Math.round((Date.now() - new Date(lastCheckinAt).getTime()) / 60000)
        : null;

      return {
        caseId: c.id,
        caseNumber: c.case_number,
        stage: c.stage,
        district: c.district,
        assignedProfessional: c.assigned_professional,
        victimId,
        profileName,
        initials,
        latestMood: latestCheckin?.mood_label ?? null,
        latestScore: latestScore ? Math.round(latestScore.composite_score) : null,
        latestTrend: latestScore?.trend ?? null,
        alertSeverity: topAlert?.severity ?? null,
        lastCheckinAt,
        minutesSinceCheckin,
        crisisFlag: latestScore?.crisis_flag ?? false,
      } satisfies CaseQueueItem;
    })
  );

  // Sort: priority alerts first, then attention, then most recent check-in
  return enriched.sort((a, b) => {
    const rank: Record<string, number> = { priority: 3, attention: 2, routine: 1 };
    const ra = rank[a.alertSeverity ?? ""] ?? 0;
    const rb = rank[b.alertSeverity ?? ""] ?? 0;
    if (ra !== rb) return rb - ra;
    // Fallback: most recent check-in first
    const ta = a.lastCheckinAt ? new Date(a.lastCheckinAt).getTime() : 0;
    const tb = b.lastCheckinAt ? new Date(b.lastCheckinAt).getTime() : 0;
    return tb - ta;
  });
}

// ─── Claim Case ──────────────────────────────────────────────────────────────

export async function claimCase(
  caseId: string,
  professionalId: string,
  professionalName: string
): Promise<{ ok: boolean; error?: string }> {
  const { error: updateErr } = await supabase
    .from("cases")
    .update({ assigned_professional: professionalId })
    .eq("id", caseId)
    .is("assigned_professional", null); // prevent double-claim

  if (updateErr) return { ok: false, error: updateErr.message };

  await supabase.from("case_events").insert({
    case_id: caseId,
    event_type: "case_claimed",
    description: `Case accepted by ${professionalName}. Active support now assigned.`,
    visible_to_victim: true,
    author_id: professionalId,
  });

  return { ok: true };
}

// ─── Case Detail ─────────────────────────────────────────────────────────────

export async function fetchCaseDetail(caseId: string): Promise<CaseDetail | null> {
  const { data, error } = await supabase
    .from("cases")
    .select(`
      id, case_number, stage, status_text, district, assigned_professional,
      victim_id,
      victims!inner(
        id, profile_id,
        consent_share_text, consent_share_voice, consent_wellbeing_monitoring,
        profiles!inner(name)
      )
    `)
    .eq("id", caseId)
    .single();

  if (error || !data) return null;

  const v = (data as any).victims;
  return {
    id: data.id,
    caseNumber: data.case_number,
    stage: data.stage,
    statusText: data.status_text,
    district: data.district,
    assignedProfessional: data.assigned_professional,
    victimId: v?.id ?? "",
    profileId: v?.profile_id ?? "",
    profileName: v?.profiles?.name ?? "Anonymous",
    consentShareText: v?.consent_share_text ?? true,
    consentShareVoice: v?.consent_share_voice ?? true,
    consentWellbeingMonitoring: v?.consent_wellbeing_monitoring ?? true,
  };
}

// ─── Voice Signed URLs ───────────────────────────────────────────────────────

export async function getVoiceSignedUrl(voiceUrl: string): Promise<string | null> {
  if (!voiceUrl) return null;
  // If stored as full URL, extract the relative storage path inside voice-checkins
  let path = voiceUrl;
  if (voiceUrl.includes("/voice-checkins/")) {
    const parts = voiceUrl.split("/voice-checkins/");
    path = parts[1]?.split("?")[0] ?? voiceUrl;
  } else if (voiceUrl.startsWith("http")) {
    try {
      const u = new URL(voiceUrl);
      const parts = u.pathname.split("/voice-checkins/");
      if (parts[1]) path = parts[1];
    } catch {}
  }
  path = decodeURIComponent(path).replace(/^\/+/, "");

  try {
    const { data, error } = await supabase.storage
      .from("voice-checkins")
      .createSignedUrl(path, 3600); // 60 minutes
    if (error || !data) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}

// ─── Check-ins ───────────────────────────────────────────────────────────────

export async function fetchCheckins(victimId: string, limit = 20): Promise<CheckinRow[]> {
  const { data, error } = await supabase
    .from("checkins")
    .select("id, victim_id, mood_label, message_text, voice_url, channel, created_at")
    .eq("victim_id", victimId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  // Generate 60-min signed URLs for voice audio
  const checkins = await Promise.all(
    data.map(async (r) => {
      let signedUrl: string | null = null;
      if (r.voice_url) {
        signedUrl = await getVoiceSignedUrl(r.voice_url);
      }
      return {
        id: r.id,
        victimId: r.victim_id,
        moodLabel: r.mood_label,
        messageText: r.message_text,
        voiceUrl: signedUrl ?? r.voice_url,
        channel: r.channel,
        createdAt: r.created_at,
      };
    })
  );

  return checkins;
}

// ─── Scores ──────────────────────────────────────────────────────────────────

export async function fetchScores(victimId: string, limit = 20): Promise<ScoreRow[]> {
  const { data, error } = await supabase
    .from("scores")
    .select("*")
    .eq("victim_id", victimId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    victimId: r.victim_id,
    checkinId: r.checkin_id,
    compositeScore: r.composite_score,
    sentimentComponent: r.sentiment_component,
    emotionComponent: r.emotion_component,
    behaviourComponent: r.behaviour_component,
    crisisFlag: r.crisis_flag,
    signalQuality: r.signal_quality as Record<string, unknown>,
    trend: r.trend,
    createdAt: r.created_at,
  }));
}

// ─── Alerts ──────────────────────────────────────────────────────────────────

export async function fetchAlerts(victimId: string): Promise<AlertRow[]> {
  const { data, error } = await supabase
    .from("alerts")
    .select("id, victim_id, severity, status, created_at")
    .eq("victim_id", victimId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    victimId: r.victim_id,
    severity: r.severity as AlertRow["severity"],
    status: r.status as AlertRow["status"],
    createdAt: r.created_at,
  }));
}

export async function updateAlertStatus(
  alertId: string,
  status: "reviewed" | "resolved",
  caseId: string,
  actorId: string,
  actorName: string
): Promise<void> {
  await supabase.from("alerts").update({ status }).eq("id", alertId);
  await supabase.from("case_events").insert({
    case_id: caseId,
    event_type: "alert_" + status,
    description: `Alert marked as ${status} by ${actorName}.`,
    visible_to_victim: false,
    author_id: actorId,
  });
}

// ─── Case Events ─────────────────────────────────────────────────────────────

export async function fetchCaseEvents(caseId: string, visibleToVictimOnly = false) {
  let query = supabase
    .from("case_events")
    .select("id, event_type, description, visible_to_victim, occurred_at")
    .eq("case_id", caseId)
    .order("occurred_at", { ascending: false });

  if (visibleToVictimOnly) {
    query = query.eq("visible_to_victim", true);
  }

  const { data } = await query;
  return data ?? [];
}

export async function postCaseEvent(
  caseId: string,
  eventType: string,
  description: string,
  visibleToVictim: boolean,
  authorId: string
): Promise<void> {
  await supabase.from("case_events").insert({
    case_id: caseId,
    event_type: eventType,
    description,
    visible_to_victim: visibleToVictim,
    author_id: authorId,
  });
}

// ─── Case Stage Update ───────────────────────────────────────────────────────

export async function updateCaseStage(
  caseId: string,
  stage: string,
  statusText: string,
  actorId: string,
  actorName: string
): Promise<void> {
  await supabase.from("cases").update({ stage, status_text: statusText }).eq("id", caseId);
  await supabase.from("case_events").insert({
    case_id: caseId,
    event_type: "stage_update",
    description: `Stage updated to "${stage}": ${statusText}`,
    visible_to_victim: true,
    author_id: actorId,
  });
  await supabase.from("audit_log").insert({
    case_id: caseId,
    actor_id: actorId,
    actor_name: actorName,
    actor_role: "professional",
    action: "Updated Case Stage",
    details: `Stage changed to ${stage}`,
  });
}

// ─── Messages ────────────────────────────────────────────────────────────────

export async function fetchMessages(caseId: string): Promise<MessageRow[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, case_id, sender_id, sender_role, body, read_at, created_at")
    .eq("case_id", caseId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id,
    caseId: r.case_id,
    senderId: r.sender_id,
    senderRole: r.sender_role as MessageRow["senderRole"],
    body: r.body,
    readAt: r.read_at,
    createdAt: r.created_at,
  }));
}

export async function sendMessage(
  caseId: string,
  senderId: string,
  senderRole: "victim" | "professional",
  body: string
): Promise<MessageRow | null> {
  const { data, error } = await supabase
    .from("messages")
    .insert({ case_id: caseId, sender_id: senderId, sender_role: senderRole, body })
    .select()
    .single();

  if (error || !data) return null;
  return {
    id: data.id,
    caseId: data.case_id,
    senderId: data.sender_id,
    senderRole: data.sender_role as MessageRow["senderRole"],
    body: data.body,
    readAt: data.read_at,
    createdAt: data.created_at,
  };
}

export async function markMessagesRead(caseId: string, readerRole: "victim" | "professional"): Promise<void> {
  const otherRole = readerRole === "victim" ? "professional" : "victim";
  await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("case_id", caseId)
    .eq("sender_role", otherRole)
    .is("read_at", null);
}

// ─── Appointments ────────────────────────────────────────────────────────────

export async function fetchAppointments(caseId: string): Promise<AppointmentRow[]> {
  const { data } = await supabase
    .from("appointments")
    .select("*")
    .eq("case_id", caseId)
    .order("scheduled_at", { ascending: true });

  return (data ?? []).map((r: any) => ({
    id: r.id,
    caseId: r.case_id,
    scheduledAt: r.scheduled_at,
    mode: r.mode,
    status: r.status,
    notes: r.notes,
    createdAt: r.created_at,
  }));
}

export async function updateAppointmentStatus(
  appointmentId: string,
  status: AppointmentRow["status"]
): Promise<void> {
  await supabase.from("appointments").update({ status }).eq("id", appointmentId);
}

// ─── SOS Requests ────────────────────────────────────────────────────────────

export async function fetchOpenSOS(): Promise<(SosRow & { caseNumber: string; district: string })[]> {
  const { data } = await supabase
    .from("sos_requests")
    .select(`
      id, victim_id, request_code, status, created_at,
      victims!inner(
        id, cases!inner(case_number, district)
      )
    `)
    .not("status", "in", '("Handled","resolved")')
    .order("created_at", { ascending: false });

  return (data ?? []).map((r: any) => ({
    id: r.id,
    victimId: r.victim_id,
    requestCode: r.request_code,
    status: r.status,
    createdAt: r.created_at,
    caseNumber: r.victims?.cases?.case_number ?? "—",
    district: r.victims?.cases?.district ?? "—",
  }));
}

export async function updateSosStatus(
  sosId: string,
  status: string
): Promise<void> {
  await supabase.from("sos_requests").update({ status }).eq("id", sosId);
}

// ─── Realtime counting helpers ────────────────────────────────────────────────

export function formatMinutesAgo(minutes: number | null): string {
  if (minutes === null) return "No check-ins yet";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ─── Professional Inbox ──────────────────────────────────────────────────────

export interface InboxConversation {
  caseId: string;
  caseNumber: string;
  district: string;
  victimName: string;
  lastMessageBody: string | null;
  lastMessageAt: string | null;
  lastSenderRole: "victim" | "professional" | null;
  unreadCount: number;
}

export async function fetchProfessionalInbox(professionalId: string): Promise<InboxConversation[]> {
  const { data: cases, error } = await supabase
    .from("cases")
    .select(`
      id, case_number, district,
      victims!inner(
        profiles!inner(name)
      )
    `)
    .eq("assigned_professional", professionalId);

  if (error || !cases) return [];

  const conversations = await Promise.all(
    cases.map(async (c: any) => {
      // Get latest message for this case
      const { data: latestMsg } = await supabase
        .from("messages")
        .select("body, sender_role, created_at")
        .eq("case_id", c.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Count unread messages from victim
      const { count: unreadCount } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("case_id", c.id)
        .eq("sender_role", "victim")
        .is("read_at", null);

      return {
        caseId: c.id,
        caseNumber: c.case_number,
        district: c.district,
        victimName: c.victims?.profiles?.name ?? "Participant",
        lastMessageBody: latestMsg?.body ?? null,
        lastMessageAt: latestMsg?.created_at ?? null,
        lastSenderRole: latestMsg?.sender_role ?? null,
        unreadCount: unreadCount ?? 0,
      };
    })
  );

  // Sort by unread messages first, then latest message time
  return conversations.sort((a, b) => {
    if (a.unreadCount !== b.unreadCount) return b.unreadCount - a.unreadCount;
    const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return tb - ta;
  });
}

// ─── Follow-Up Management ───────────────────────────────────────────────────

export interface OverdueFollowup {
  caseId: string;
  caseNumber: string;
  district: string;
  victimName: string;
  followUpDate: string;
  isOverdue: boolean;
}

export async function fetchFollowups(professionalId: string): Promise<OverdueFollowup[]> {
  const { data: cases, error } = await supabase
    .from("cases")
    .select(`
      id, case_number, district, follow_up_date,
      victims!inner(profiles!inner(name))
    `)
    .eq("assigned_professional", professionalId)
    .not("follow_up_date", "is", null);

  if (error || !cases) return [];

  const now = new Date();
  return cases.map((c: any) => ({
    caseId: c.id,
    caseNumber: c.case_number,
    district: c.district,
    victimName: c.victims?.profiles?.name ?? "Participant",
    followUpDate: c.follow_up_date,
    isOverdue: new Date(c.follow_up_date) < now,
  })).sort((a, b) => new Date(a.followUpDate).getTime() - new Date(b.followUpDate).getTime());
}

export async function updateCaseFollowUpDate(caseId: string, followUpDate: string | null): Promise<void> {
  await supabase.from("cases").update({ follow_up_date: followUpDate }).eq("id", caseId);
}

// ─── Structured Case Updates ────────────────────────────────────────────────

export const STRUCTURED_UPDATE_TYPES = [
  "Status update",
  "Appointment scheduled",
  "Referral made",
  "Follow-up",
  "Resolved",
] as const;

export type StructuredUpdateType = typeof STRUCTURED_UPDATE_TYPES[number];

export async function postStructuredCaseUpdate(
  caseId: string,
  updateType: StructuredUpdateType,
  note: string,
  visibleToVictim: boolean,
  authorId: string,
  newStage?: string
): Promise<{ ok: boolean; error?: string }> {
  const updatePayload: Record<string, any> = {
    status_text: note,
  };
  if (newStage) {
    updatePayload.stage = newStage;
  }

  const { error: caseErr } = await supabase
    .from("cases")
    .update(updatePayload)
    .eq("id", caseId);

  if (caseErr) return { ok: false, error: caseErr.message };

  const { error: eventErr } = await supabase.from("case_events").insert({
    case_id: caseId,
    event_type: updateType.toLowerCase().replace(/\s+/g, "_"),
    description: `[${updateType}] ${note}`,
    visible_to_victim: visibleToVictim,
    author_id: authorId,
  });

  if (eventErr) return { ok: false, error: eventErr.message };
  return { ok: true };
}
