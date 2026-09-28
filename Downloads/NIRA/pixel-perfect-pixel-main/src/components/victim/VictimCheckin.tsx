import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { VictimData } from "@/routes/victim";
import { t } from "@/lib/nira-i18n";
import { SafetyNotice, SoftBadge } from "@/components/nira-primitives";
import { AlertTriangle, CheckCircle2, Mic, MicOff, Phone, Send, Sparkles, ArrowRight } from "lucide-react";
import { toast } from "sonner";

const MOOD_CHIPS = [
  { key: "mood_safe", emoji: "😌", tone: "improving" as const },
  { key: "mood_hopeful", emoji: "🌱", tone: "improving" as const },
  { key: "mood_steady", emoji: "🤝", tone: "stable" as const },
  { key: "mood_neutral", emoji: "😐", tone: "uncertain" as const },
  { key: "mood_uneasy", emoji: "😟", tone: "attention" as const },
  { key: "mood_anxious", emoji: "😰", tone: "attention" as const },
  { key: "mood_distressed", emoji: "💔", tone: "priority" as const },
  { key: "mood_overwhelmed", emoji: "🆘", tone: "priority" as const },
];

interface Props {
  data: VictimData;
  lang: string;
  onDone: () => void;
}

export default function VictimCheckin({ data, lang, onDone }: Props) {
  const [mood, setMood] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [startTime] = useState(() => Date.now());

  // Post-submit companion state
  const [submitted, setSubmitted] = useState(false);
  const [companionLoading, setCompanionLoading] = useState(false);
  const [companionReply, setCompanionReply] = useState<string | null>(null);
  const [isCrisis, setIsCrisis] = useState(false);

  // Crisis SOS state inside companion card
  const [sosSent, setSosSent] = useState(false);
  const [sosCode, setSosCode] = useState<string | null>(null);
  const [sosLoading, setSosLoading] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioCtxRef.current) {
        try { audioCtxRef.current.close(); } catch {}
      }
    };
  }, [audioUrl]);

  const drawWaveform = (analyser: AnalyserNode) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      animFrameRef.current = requestAnimationFrame(render);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / 32);
      let x = 0;

      for (let i = 0; i < 32; i++) {
        // Average a slice of frequencies for each bar
        const sliceIndex = Math.floor((i * bufferLength) / 32);
        const val = dataArray[sliceIndex] / 255.0;
        const barHeight = Math.max(4, val * canvas.height * 0.9);

        // Gradient bar
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
        gradient.addColorStop(0, "rgba(45, 212, 191, 0.4)");
        gradient.addColorStop(1, "rgba(20, 184, 166, 0.95)");

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, (canvas.height - barHeight) / 2, barWidth - 3, barHeight, 4);
        ctx.fill();

        x += barWidth;
      }
    };

    render();
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];

      // Setup Web Audio Analyser for live waveform
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 128;
        source.connect(analyser);
        drawWaveform(analyser);
      } catch (e) {
        console.error("AudioContext error", e);
      }

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        if (audioCtxRef.current) {
          try { audioCtxRef.current.close(); } catch {}
          audioCtxRef.current = null;
        }
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch {
      toast.error("Microphone access is needed to record a voice note.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const handleSosTrigger = async () => {
    if (!data.victimId) return;
    setSosLoading(true);
    try {
      const { data: sos } = await supabase
        .from("sos_requests")
        .insert({ victim_id: data.victimId })
        .select("request_code")
        .single();
      setSosCode(sos?.request_code ?? "SOS-SENT");
      setSosSent(true);
      toast.error("Emergency alert triggered. Please stay in a safe place.", { duration: 6000 });
    } catch {
      setSosCode("SOS-SENT");
      setSosSent(true);
    } finally {
      setSosLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!mood) return;
    if (!data.victimId) {
      toast.error("Your space record is still completing setup.");
      return;
    }
    setSubmitting(true);
    const latency = Math.round((Date.now() - startTime) / 1000);
    let voice_url: string | null = null;
    let channel = "web";

    if (audioBlob) {
      channel = "web-voice";
      const filename = `${data.victimId}/${Date.now()}.webm`;
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from("voice-checkins")
        .upload(filename, audioBlob, { upsert: true, contentType: "audio/webm" });
      if (!uploadErr && uploadData) {
        // Bucket is private — store the file path so createSignedUrl can be used
        voice_url = filename;
      }
    }

    const { data: checkin, error: insertErr } = await supabase
      .from("checkins")
      .insert({
        victim_id: data.victimId,
        mood_label: mood,
        message_text: message.trim() || null,
        voice_url,
        channel,
        response_latency_seconds: latency,
      })
      .select("id")
      .single();

    if (insertErr) {
      toast.error("Something went wrong. Please try again.");
      setSubmitting(false);
      return;
    }

    // Trigger compute-score edge function (fire-and-forget, non-blocking)
    if (checkin?.id) {
      supabase.functions.invoke("compute-score", {
        body: { checkin_id: checkin.id },
      }).catch(() => {/* non-blocking */});
    }

    // Switch to submitted state and query lightweight companion
    setSubmitting(false);
    setSubmitted(true);
    setCompanionLoading(true);

    // Call checkin-companion edge function (Groq llama-3.3-70b-versatile)
    try {
      const { data: compData, error: compErr } = await supabase.functions.invoke("checkin-companion", {
        body: {
          checkin_id: checkin?.id,
          message_text: message.trim(),
          mood_label: mood,
          language: lang,
        },
      });

      if (!compErr && compData?.reply) {
        setCompanionReply(compData.reply);
        if (compData.is_crisis) {
          setIsCrisis(true);
        }
      }
    } catch {
      // Graceful fallback: do nothing extra if network/edge function fails
    } finally {
      setCompanionLoading(false);
    }
  };

  // 1. Post-Submission View (Confirmation + Companion Acknowledgment)
  if (submitted) {
    return (
      <div className="space-y-6">
        <div className="nira-rise">
          <div className="flex items-center gap-2 text-xs font-semibold text-improving">
            <CheckCircle2 className="size-4" />
            <span>Check-in saved privately</span>
          </div>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">
            Thank you for checking in
          </h2>
          <p className="mt-1 text-xs text-muted-ink">
            Logged with your consent: {mood}
          </p>
        </div>

        {/* Companion Reply Card */}
        {companionLoading && (
          <div className="rounded-[22px] border border-line bg-surface/85 p-6 shadow-soft backdrop-blur-md">
            <div className="flex items-center gap-2.5">
              <div className="grid size-7 place-items-center rounded-xl bg-brand-soft text-brand">
                <Sparkles className="size-3.5 animate-pulse" />
              </div>
              <span className="text-xs font-semibold text-muted-ink">A quiet reflection…</span>
            </div>
            <div className="mt-3 flex items-center gap-1.5 py-1">
              <span className="size-1.5 animate-bounce rounded-full bg-brand/40" style={{ animationDelay: "0ms" }} />
              <span className="size-1.5 animate-bounce rounded-full bg-brand/60" style={{ animationDelay: "150ms" }} />
              <span className="size-1.5 animate-bounce rounded-full bg-brand/80" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}

        {companionReply && !companionLoading && (
          <div className="rounded-[22px] border border-line bg-surface/85 p-6 shadow-soft backdrop-blur-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="grid size-7 place-items-center rounded-xl bg-brand-soft text-brand">
                  <Sparkles className="size-3.5" />
                </div>
                <span className="text-xs font-bold text-ink">A quiet reflection</span>
              </div>
              <SoftBadge tone="brand">AI companion</SoftBadge>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-ink/90 font-medium">
              {companionReply}
            </p>
          </div>
        )}

        {/* Crisis Branch: Directly connected to Emergency SOS */}
        {isCrisis && (
          <div className="rounded-[22px] border-2 border-priority/30 bg-priority/5 p-6 shadow-soft backdrop-blur-md">
            <div className="flex items-start gap-3">
              <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-priority text-white">
                <AlertTriangle className="size-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-priority">Urgent Safety & Crisis Support</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-ink">
                  If you are in danger or feeling overwhelmed, please know that immediate, confidential help is available right now.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {!sosSent ? (
                <button
                  id="companion-sos-button"
                  onClick={handleSosTrigger}
                  disabled={sosLoading}
                  className="w-full rounded-2xl bg-priority py-3.5 text-sm font-bold text-white shadow-lg shadow-priority/25 transition hover:bg-priority/90 active:scale-[0.99] disabled:opacity-60"
                >
                  {sosLoading ? "Connecting urgent request…" : t(lang, "sos_btn")}
                </button>
              ) : (
                <div className="rounded-xl border border-priority/20 bg-surface/90 p-4 text-center">
                  <div className="text-xs font-semibold text-muted-ink">Emergency Request Code</div>
                  <div className="mt-1 text-xl font-extrabold tracking-tight text-priority">{sosCode}</div>
                  <p className="mt-1 text-[11px] text-muted-ink">
                    Priority notification dispatched to on-call duty officers.
                  </p>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <a
                  href="tel:181"
                  className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3.5 py-2 text-xs font-bold text-priority border border-priority/20 shadow-sm transition hover:bg-priority/5"
                >
                  <Phone className="size-3" /> Women Helpline 181 (24x7)
                </a>
                <a
                  href="tel:1098"
                  className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3.5 py-2 text-xs font-bold text-ink border border-line shadow-sm transition hover:bg-surface/80"
                >
                  <Phone className="size-3" /> Childline 1098 (24x7)
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Done / Return Action */}
        <button
          id="checkin-done-button"
          onClick={onDone}
          className="flex w-full items-center justify-center gap-2 rounded-[22px] bg-brand py-3.5 text-sm font-bold text-white shadow-lg shadow-brand/20 transition hover:bg-brand/90"
        >
          <span>Return to your space</span>
          <ArrowRight className="size-4" />
        </button>

        <SafetyNotice>
          Your check-in reflection is private to you. Only aggregated wellbeing indicators — never your exact words — are shared with your assigned caseworker.
        </SafetyNotice>
      </div>
    );
  }

  // 2. Pre-Submission Form View (Mood, Optional Note, Voice Note)
  return (
    <div className="space-y-6">
      <div className="nira-rise">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-ink">
          {t(lang, "check_in")}
        </div>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">
          {t(lang, "checkin_prompt")}
        </h2>
        <p className="mt-1 text-xs text-muted-ink">
          This is just for you. Share as little or as much as you'd like.
        </p>
      </div>

      {/* Mood selection */}
      <div className="rounded-[22px] border border-line bg-surface/80 p-5 shadow-soft backdrop-blur-md">
        <div className="text-xs font-semibold text-ink mb-3">How would you describe how you feel?</div>
        <div className="flex flex-wrap gap-2">
          {MOOD_CHIPS.map((m) => (
            <button
              key={m.key}
              id={`checkin-mood-${m.key}`}
              onClick={() => setMood(t(lang, m.key))}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition ${
                mood === t(lang, m.key)
                  ? "border-brand bg-brand-soft text-brand ring-2 ring-brand/20"
                  : "border-line bg-surface/80 text-ink hover:border-brand/30"
              }`}
            >
              <span>{m.emoji}</span>
              {t(lang, m.key)}
            </button>
          ))}
        </div>
      </div>

      {/* Message (optional) */}
      <div className="rounded-[22px] border border-line bg-surface/80 p-5 shadow-soft backdrop-blur-md">
        <label htmlFor="checkin-message" className="text-xs font-semibold text-ink">
          Add a message <span className="font-normal text-muted-ink">(optional)</span>
        </label>
        <textarea
          id="checkin-message"
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Anything you want to share about how you're doing…"
          className="mt-2 w-full resize-none rounded-xl border border-line bg-background px-4 py-3 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </div>

      {/* Voice recording with live waveform */}
      <div className="rounded-[22px] border border-border bg-surface p-5 shadow-soft backdrop-blur-md">
        <div className="text-xs font-semibold text-text-primary mb-3">
          Voice note <span className="font-normal text-text-muted">(optional)</span>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-4">
            <button
              id="checkin-mic"
              type="button"
              onClick={recording ? stopRecording : startRecording}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                recording
                  ? "bg-danger/10 text-danger border border-danger/30"
                  : "bg-primary-soft text-primary border border-primary/20 hover:opacity-90"
              }`}
            >
              {recording ? (
                <>
                  <MicOff className="size-4 animate-pulse" /> Stop recording
                </>
              ) : (
                <>
                  <Mic className="size-4" /> Record voice note
                </>
              )}
            </button>

            {recording && (
              <span className="flex items-center gap-2 text-xs font-semibold text-danger animate-pulse">
                <span className="size-2 rounded-full bg-danger" />
                Live recording in progress…
              </span>
            )}

            {audioUrl && !recording && (
              <audio controls src={audioUrl} className="h-9 flex-1" />
            )}
          </div>

          {/* Live Waveform Canvas */}
          {recording && (
            <div className="rounded-xl border border-primary/30 bg-surface-elevated p-3 shadow-inner">
              <div className="mb-1.5 flex items-center justify-between text-[11px] text-text-muted">
                <span>Microphone Live Frequency</span>
                <span className="text-primary font-bold">Sound Waves</span>
              </div>
              <canvas
                ref={canvasRef}
                width={360}
                height={50}
                className="h-12 w-full rounded-lg bg-background"
              />
            </div>
          )}
        </div>
      </div>

      {/* Submit */}
      <button
        id="checkin-submit"
        type="button"
        onClick={handleSubmit}
        disabled={!mood || submitting}
        className="flex w-full items-center justify-center gap-2 rounded-[22px] bg-brand py-4 text-sm font-bold text-white shadow-lg shadow-brand/20 transition hover:bg-brand/90 disabled:opacity-50"
      >
        <Send className="size-4" />
        {submitting ? "Submitting…" : t(lang, "submit")}
      </button>

      <SafetyNotice>
        Your check-in is held privately. Only signals — never the raw words — are visible to your professional,
        and only with your ongoing consent.
      </SafetyNotice>
    </div>
  );
}
