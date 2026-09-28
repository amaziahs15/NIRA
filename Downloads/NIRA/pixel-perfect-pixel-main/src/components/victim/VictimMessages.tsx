import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchMessages,
  sendMessage,
  markMessagesRead,
  fetchCaseDetail,
  fetchAppointments,
  updateAppointmentStatus,
  type MessageRow,
  type AppointmentRow,
} from "@/lib/nira-data";
import { SoftBadge } from "@/components/nira-primitives";
import { CheckCircle2, Clock, Lock, Send, Calendar, CalendarCheck, CalendarX } from "lucide-react";
import { toast } from "sonner";

interface Props {
  victimId: string;
  userId: string;
  lang?: string;
}

export default function VictimMessages({ victimId, userId, lang = "en" }: Props) {
  const [caseId, setCaseId] = useState<string | null>(null);
  const [caseNumber, setCaseNumber] = useState<string>("");
  const [assignedProfessional, setAssignedProfessional] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const msgEndRef = useRef<HTMLDivElement>(null);
  const realtimeRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const loadData = async () => {
    // Get victim's case
    const { data: victimRow } = await supabase
      .from("victims")
      .select("case_id")
      .eq("id", victimId)
      .single();

    const cid = victimRow?.case_id;
    if (!cid) { setLoading(false); return; }
    setCaseId(cid);

    const detail = await fetchCaseDetail(cid);
    if (detail) {
      setCaseNumber(detail.caseNumber);
      setAssignedProfessional(detail.assignedProfessional);
    }

    const [msgs, appts] = await Promise.all([
      fetchMessages(cid),
      fetchAppointments(cid),
    ]);
    setMessages(msgs);
    setAppointments(appts);
    await markMessagesRead(cid, "victim");
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [victimId]);

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Realtime
  useEffect(() => {
    if (!caseId) return;
    if (realtimeRef.current) supabase.removeChannel(realtimeRef.current);

    const channel = supabase
      .channel(`victim-messages-${caseId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `case_id=eq.${caseId}` }, async (payload) => {
        const m = payload.new as any;
        if (m.sender_role === "professional") {
          setMessages((prev) => [...prev, {
            id: m.id, caseId: m.case_id, senderId: m.sender_id,
            senderRole: m.sender_role, body: m.body, readAt: m.read_at, createdAt: m.created_at,
          }]);
          // Mark read immediately
          await markMessagesRead(caseId, "victim");
          toast.info("New message from your support professional");
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "appointments", filter: `case_id=eq.${caseId}` }, () => {
        loadData();
        toast.info("An appointment has been proposed for you");
      })
      .subscribe();

    realtimeRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [caseId]);

  const handleSend = async () => {
    if (!body.trim() || !caseId) return;
    setSending(true);
    const msg = await sendMessage(caseId, userId, "victim", body.trim());
    if (msg) {
      setMessages((prev) => [...prev, msg]);
      setBody("");
    } else {
      toast.error("Could not send your message. Please try again.");
    }
    setSending(false);
  };

  const handleApptResponse = async (apptId: string, status: AppointmentRow["status"]) => {
    await updateAppointmentStatus(apptId, status);
    setAppointments((prev) => prev.map((a) => a.id === apptId ? { ...a, status } : a));
    if (status === "accepted") toast.success("Appointment confirmed");
    else toast.info("Reschedule request sent to your professional");
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="size-7 animate-spin rounded-full border-2 border-brand border-t-transparent" /></div>;
  }

  if (!caseId) {
    return (
      <div className="rounded-2xl border border-line bg-surface/60 p-8 text-center">
        <p className="text-sm font-semibold text-ink">Your case is being set up.</p>
        <p className="mt-1 text-xs text-muted-ink">Messages will appear here once your case is registered.</p>
      </div>
    );
  }

  const pendingAppts = appointments.filter((a) => a.status === "proposed");

  return (
    <div className="space-y-5">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-ink">Messages</div>
        <h2 className="mt-1 text-xl font-extrabold tracking-tight text-ink">Your support conversation</h2>
        <p className="mt-1 text-xs text-muted-ink">
          {assignedProfessional
            ? "Messages are private and shared only with your assigned support professional."
            : "A support professional will be assigned soon. You can still send us a message and we'll reply."}
        </p>
      </div>

      {/* Pending appointments */}
      {pendingAppts.length > 0 && (
        <div className="space-y-2">
          {pendingAppts.map((appt) => (
            <div key={appt.id} className="rounded-xl border border-brand/30 bg-brand-soft/30 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Calendar className="size-4 text-brand" />
                  <div>
                    <div className="text-xs font-bold text-ink">Appointment proposed</div>
                    <div className="text-xs text-muted-ink">
                      {new Date(appt.scheduledAt).toLocaleString("en-IN", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      {" · "}{appt.mode.replace("_", " ")}
                    </div>
                    {appt.notes && <div className="mt-0.5 text-xs text-muted-ink">{appt.notes}</div>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApptResponse(appt.id, "accepted")}
                    className="flex items-center gap-1.5 rounded-lg bg-improving/15 px-3 py-1.5 text-xs font-bold text-improving hover:bg-improving/25 transition"
                  >
                    <CalendarCheck className="size-3.5" /> Accept
                  </button>
                  <button
                    onClick={() => handleApptResponse(appt.id, "reschedule_requested")}
                    className="flex items-center gap-1.5 rounded-lg border border-line bg-surface/80 px-3 py-1.5 text-xs font-semibold text-muted-ink hover:text-ink transition"
                  >
                    <CalendarX className="size-3.5" /> Ask to reschedule
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Chat window */}
      <div className="rounded-[22px] border border-line bg-white/70 shadow-soft backdrop-blur-md flex flex-col" style={{ minHeight: 480 }}>
        <div className="border-b border-line px-5 py-3 flex items-center justify-between">
          <div className="text-xs font-bold uppercase tracking-[0.12em] text-muted-ink">
            Case {caseNumber}
          </div>
          <SoftBadge tone="brand" icon={<Lock className="size-3" />}>Private</SoftBadge>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3" style={{ maxHeight: 360 }}>
          {messages.length === 0 ? (
            <div className="text-center text-xs text-muted-ink py-10">
              {assignedProfessional
                ? "No messages yet. You can start the conversation below."
                : "A professional will be assigned and messages will appear here soon."}
            </div>
          ) : messages.map((m) => {
            const isMine = m.senderRole === "victim";
            return (
              <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                {!isMine && (
                  <div className="mr-2 grid size-7 shrink-0 place-items-center rounded-full bg-brand/20 text-[10px] font-bold text-brand self-end">SP</div>
                )}
                <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-xs ${
                  isMine ? "bg-brand text-white rounded-br-sm" : "bg-surface border border-line text-ink rounded-bl-sm"
                }`}>
                  <p>{m.body}</p>
                  <div className={`mt-1 text-[10px] ${isMine ? "text-white/60" : "text-muted-ink"} flex items-center gap-1 justify-end`}>
                    <Clock className="size-2.5" />
                    {new Date(m.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    {isMine && m.readAt && <CheckCircle2 className="size-2.5" />}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={msgEndRef} />
        </div>

        <div className="border-t border-line p-4 flex gap-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write a message to your professional…"
            rows={2}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            className="flex-1 resize-none rounded-xl border border-line bg-surface/80 px-3 py-2 text-xs text-ink placeholder:text-muted-ink focus:border-brand focus:outline-hidden"
          />
          <button
            onClick={handleSend}
            disabled={sending || !body.trim()}
            className="rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white hover:bg-brand/90 disabled:opacity-40 transition"
          >
            <Send className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
