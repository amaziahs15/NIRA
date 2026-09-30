import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Copy, Expand, MessageCircle, Mic, MicOff, Phone, Send, Sparkles, Trash2, Volume2, VolumeX, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SoftBadge } from "@/components/nira-primitives";
import { cn } from "@/lib/utils";
import { t } from "@/lib/nira-i18n";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  isCrisis?: boolean;
  timestamp?: string;
}

export interface WellbeingChatProps {
  lang: string;
  victimId: string;
  fullPage?: boolean;
  initialMessages?: ChatMsg[];
  onMessagesChange?: (msgs: ChatMsg[]) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const SESSION_MESSAGE_CAP = 30; // client-side cap

export function getDefaultGreeting(lang: string): ChatMsg {
  const content =
    lang === "ta"
      ? "வணக்கம், நான் NIRA-வின் நல்வாழ்வு துணைவன். நான் கேட்க இங்கே இருக்கிறேன் — நான் மருத்துவரோ அல்லது அவசர சேவையோ அல்ல, நீங்கள் பேச விரும்பினால் ஒரு அமைதியான இடம்."
      : lang === "hi"
      ? "नमस्ते, मैं NIRA का वेलबीइंग साथी हूँ। मैं सुनने के लिए यहाँ हूँ — कोई थेरेपिस्ट या आपातकालीन सेवा नहीं, बस एक शांत जगह अगर आप बात करना चाहें।"
      : "Hi, I'm NIRA's wellbeing companion. I'm here to listen — not a therapist or emergency service, just a calm space if you want to talk.";

  return {
    id: "initial-intro-greeting",
    role: "assistant",
    content,
    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
}

// ── Crisis card ───────────────────────────────────────────────────────────────
function CrisisCard({ lang, victimId }: { lang: string; victimId: string }) {
  const [sosSent, setSosSent] = useState(false);
  const [sosCode, setSosCode] = useState<string | null>(null);
  const [sosLoading, setSosLoading] = useState(false);

  const handleSos = async () => {
    if (!victimId) return;
    setSosLoading(true);
    try {
      const { data: sos } = await supabase
        .from("sos_requests")
        .insert({ victim_id: victimId })
        .select("request_code")
        .single();
      setSosCode(sos?.request_code ?? "SOS-SENT");
      setSosSent(true);
    } catch {
      setSosCode("SOS-SENT");
      setSosSent(true);
    } finally {
      setSosLoading(false);
    }
  };

  return (
    <div className="rounded-[18px] border-2 border-priority/30 bg-priority/5 p-4">
      <div className="flex items-start gap-2.5">
        <div className="grid size-7 shrink-0 place-items-center rounded-xl bg-priority text-white">
          <AlertTriangle className="size-3.5" />
        </div>
        <div>
          <p className="text-xs font-bold text-priority">Urgent Safety Support</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-ink">
            Immediate, confidential help is available right now.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {!sosSent ? (
          <button
            id="chat-bubble-sos-btn"
            onClick={handleSos}
            disabled={sosLoading}
            className="w-full rounded-2xl bg-priority py-3 text-xs font-bold text-white shadow-lg shadow-priority/25 transition hover:bg-priority/90 disabled:opacity-60"
          >
            {sosLoading ? "Connecting…" : t(lang, "sos_btn")}
          </button>
        ) : (
          <div className="rounded-xl border border-priority/20 bg-surface/90 p-3 text-center">
            <div className="text-[10px] font-semibold text-muted-ink">Emergency Code</div>
            <div className="text-lg font-extrabold tracking-tight text-priority">{sosCode}</div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <a
            href="tel:181"
            className="inline-flex items-center gap-1.5 rounded-full border border-priority/20 bg-surface px-3 py-1.5 text-[11px] font-bold text-priority shadow-sm transition hover:bg-priority/5"
          >
            <Phone className="size-3" /> Women Helpline 181
          </a>
          <a
            href="tel:1098"
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[11px] font-bold text-ink shadow-sm transition hover:bg-surface/80"
          >
            <Phone className="size-3" /> Childline 1098
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────
function MessageBubble({
  msg,
  lang,
  victimId,
  isSpeaking,
  onToggleSpeak,
}: {
  msg: ChatMsg;
  lang: string;
  victimId: string;
  isSpeaking: boolean;
  onToggleSpeak: (msg: ChatMsg) => void;
}) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
      <div className="flex items-center gap-1.5 max-w-[90%]">
        <div
          className={cn(
            "rounded-[16px] px-4 py-3 text-sm leading-relaxed",
            isUser
              ? "rounded-br-sm bg-brand text-white font-medium shadow-sm"
              : "rounded-bl-sm bg-surface text-ink shadow-soft border border-line"
          )}
        >
          {msg.content}
        </div>

        {/* Text-to-speech speaker button for assistant messages */}
        {!isUser && (
          <button
            type="button"
            onClick={() => onToggleSpeak(msg)}
            aria-label={isSpeaking ? "Stop playback" : "Read aloud"}
            title={isSpeaking ? "Stop reading" : "Read aloud"}
            className={cn(
              "grid size-7 shrink-0 place-items-center rounded-full border transition",
              isSpeaking
                ? "border-brand bg-brand-soft text-brand animate-pulse"
                : "border-line bg-surface text-muted-ink hover:text-brand hover:border-brand/40"
            )}
          >
            {isSpeaking ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
          </button>
        )}
      </div>
      {msg.timestamp && (
        <span className="text-[10px] text-muted-ink px-1.5">{msg.timestamp}</span>
      )}
      {msg.isCrisis && <CrisisCard lang={lang} victimId={victimId} />}
    </div>
  );
}

// ── Typing indicator ──────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex items-start gap-2">
      <div className="grid size-6 place-items-center rounded-full bg-brand-soft text-brand">
        <Sparkles className="size-3" />
      </div>
      <div className="flex items-center gap-1 rounded-[16px] rounded-bl-sm border border-line bg-surface px-4 py-3 shadow-soft">
        <span className="size-1.5 animate-bounce rounded-full bg-brand/50" style={{ animationDelay: "0ms" }} />
        <span className="size-1.5 animate-bounce rounded-full bg-brand/70" style={{ animationDelay: "150ms" }} />
        <span className="size-1.5 animate-bounce rounded-full bg-brand/90" style={{ animationDelay: "300ms" }} />
      </div>
    </div>
  );
}

// ── Core chat view (shared between bubble panel and full page) ────────────────
export function WellbeingChatView({
  lang,
  victimId,
  messages,
  loading,
  atCap,
  onSend,
  onExpand,
  onMessagesChange,
  compact = false,
}: {
  lang: string;
  victimId: string;
  messages: ChatMsg[];
  loading: boolean;
  atCap: boolean;
  onSend: (text: string) => void;
  onExpand?: () => void;
  onMessagesChange?: (msgs: ChatMsg[]) => void;
  compact?: boolean;
}) {
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Clean up speech synthesis & recognition on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const handleToggleSpeak = (msg: ChatMsg) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      toast.info("Speech playback is not supported in this browser.");
      return;
    }

    if (speakingMsgId === msg.id) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(msg.content);
    utterance.lang = lang === "ta" ? "ta-IN" : lang === "hi" ? "hi-IN" : "en-US";
    utterance.rate = 0.95; // calm, unhurried cadence

    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);

    setSpeakingMsgId(msg.id);
    window.speechSynthesis.speak(utterance);
  };

  const handleToggleMic = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRec) {
      toast.info("Voice input is not supported in this browser. You can type your message.");
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = lang === "ta" ? "ta-IN" : lang === "hi" ? "hi-IN" : "en-US";

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          setInput(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        if (event.error === "not-allowed" || event.error === "permission-denied") {
          toast.error("Microphone access was denied. You can continue typing your message.");
        } else if (event.error !== "no-speech") {
          toast.info("Voice input interrupted. You can type or tap the microphone again.");
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      setIsListening(false);
      toast.error("Could not start microphone. You can type your message.");
    }
  };

  const submit = () => {
    const trimmed = input.trim();
    if (!trimmed || atCap || loading) return;
    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
    }
    setInput("");
    onSend(trimmed);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  // Check if any message flagged crisis
  const hasCrisis = messages.some((m) => m.isCrisis);

  const handleCopyChat = () => {
    const text = messages
      .map((m: ChatMsg) => `${m.role === "user" ? "You" : "NIRA"} (${m.timestamp || ""}):\n${m.content}`)
      .join("\n\n");
    navigator.clipboard.writeText(text);
    toast.success("Conversation copied to clipboard.");
  };

  const handleClearChat = () => {
    onMessagesChange?.([getDefaultGreeting(lang)]);
    toast.info("Conversation reset.");
  };

  const quickReplies = [
    "I feel a bit overwhelmed today",
    "Can we do a breathing exercise?",
    "What steps can I take right now?",
    "I just need someone to talk to",
  ];

  return (
    <div className={cn("flex flex-col bg-surface/90", compact ? "h-[450px]" : "h-full")}>
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-surface px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <div className="grid size-7 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Sparkles className="size-3.5" />
          </div>
          <div>
            <div className="text-xs font-bold text-text-primary">{t(lang, "chat_title")}</div>
            <div className="text-[10px] text-text-muted">{t(lang, "chat_ephemeral_notice")}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopyChat}
            title={t(lang, "chat_copy")}
            className="rounded-lg p-1.5 text-text-muted transition hover:bg-primary-soft hover:text-primary"
            aria-label="Copy conversation"
          >
            <Copy className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={handleClearChat}
            title={t(lang, "chat_clear")}
            className="rounded-lg p-1.5 text-text-muted transition hover:bg-danger/10 hover:text-danger"
            aria-label="Clear conversation"
          >
            <Trash2 className="size-3.5" />
          </button>
          <SoftBadge tone="brand">AI companion</SoftBadge>
          {onExpand && (
            <button
              id="chat-bubble-expand"
              onClick={onExpand}
              title={t(lang, "chat_expand")}
              className="rounded-lg p-1.5 text-text-muted transition hover:bg-primary-soft hover:text-primary"
            >
              <Expand className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Persistent Crisis Banner */}
      {hasCrisis && (
        <div className="flex items-center justify-between border-b border-danger/25 bg-danger/10 px-4 py-2 text-xs text-danger">
          <div className="flex items-center gap-1.5 font-bold">
            <AlertTriangle className="size-3.5 shrink-0" />
            <span>24/7 Crisis Help: 112 (Emergency) · 1091 (Women)</span>
          </div>
          <a
            href="tel:112"
            className="rounded-full bg-danger px-2.5 py-0.5 text-[10px] font-bold text-white shadow-xs hover:opacity-90"
          >
            Call 112
          </a>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.map((msg: ChatMsg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            lang={lang}
            victimId={victimId}
            isSpeaking={speakingMsgId === msg.id}
            onToggleSpeak={handleToggleSpeak}
          />
        ))}
        {loading && <TypingIndicator />}
        <div ref={endRef} />
      </div>

      {/* Limit notice */}
      {atCap && (
        <div className="shrink-0 border-t border-border bg-attention/10 px-4 py-2 text-center text-[11px] text-attention font-medium">
          {t(lang, "chat_session_limit")}
        </div>
      )}

      {/* Suggested Quick Replies */}
      {!atCap && !loading && !input.trim() && messages.length < 6 && (
        <div className="flex flex-wrap gap-1.5 px-3 py-2 border-t border-border/60 bg-surface/60">
          {quickReplies.map((qr, i) => (
            <button
              key={i}
              onClick={() => onSend(qr)}
              className="rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-medium text-text-secondary hover:border-primary/40 hover:bg-primary-soft hover:text-primary transition"
            >
              {qr}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      {!atCap && (
        <div className="shrink-0 border-t border-border bg-surface p-3 backdrop-blur-xl">
          {isListening && (
            <div className="mb-2 flex items-center gap-2 rounded-xl bg-danger/10 px-3 py-1.5 text-xs text-danger animate-pulse">
              <span className="size-2 rounded-full bg-danger" />
              <span>Listening… speak clearly into your microphone</span>
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              id="chat-message-input"
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              maxLength={1000}
              placeholder={t(lang, "chat_placeholder")}
              disabled={loading}
              className="flex-1 resize-none rounded-2xl border border-border bg-background px-4 py-2.5 text-sm text-text-primary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
              style={{ maxHeight: "100px", overflowY: "auto" }}
            />

            {/* Mic button */}
            <button
              id="chat-mic-btn"
              type="button"
              onClick={handleToggleMic}
              aria-label={isListening ? "Stop voice input" : "Start voice input"}
              title={isListening ? "Stop voice input" : "Voice input"}
              disabled={loading}
              className={cn(
                "grid size-10 shrink-0 place-items-center rounded-2xl border transition shadow-sm",
                isListening
                  ? "bg-danger text-white border-danger animate-pulse shadow-danger/30"
                  : "bg-surface-elevated border-border text-text-muted hover:text-primary hover:border-primary/40"
              )}
            >
              {isListening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
            </button>

            {/* Send button */}
            <button
              id="chat-send-btn"
              onClick={submit}
              disabled={!input.trim() || loading}
              className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-40"
            >
              <Send className="size-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Floating bubble + inline panel ────────────────────────────────────────────
export function WellbeingChatBubble({
  lang,
  victimId,
  onExpand,
  sharedMessages,
  onMessagesChange,
  onLanguageChange,
}: {
  lang: string;
  victimId: string;
  onExpand: () => void;
  sharedMessages: ChatMsg[];
  onMessagesChange: (msgs: ChatMsg[]) => void;
  onLanguageChange?: (newLang: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Initialize with greeting if empty
  useEffect(() => {
    if (sharedMessages.length === 0) {
      onMessagesChange([getDefaultGreeting(lang)]);
    }
  }, [lang]);

  const atCap = sharedMessages.length >= SESSION_MESSAGE_CAP;

  const sendMessage = useCallback(
    async (text: string) => {
      if (atCap) return;
      const userMsg: ChatMsg = { id: crypto.randomUUID(), role: "user", content: text };
      const currentList = sharedMessages.length === 0 ? [getDefaultGreeting(lang)] : sharedMessages;
      const next = [...currentList, userMsg];
      onMessagesChange(next);
      setLoading(true);

      try {
        const history = next.map((m) => ({ role: m.role, content: m.content }));
        const { data, error } = await supabase.functions.invoke("wellbeing-chat", {
          body: {
            message: text,
            conversation_history: history.slice(0, -1), // exclude the just-added user msg
            language: lang,
          },
        });

        if (error) {
          console.error("[WellbeingChat] Supabase function invoke error:", error);
        }
        if (data?._debug) {
          console.info("[WellbeingChat] Debug info from edge function:", data._debug);
        }

        if (!error && data?.reply) {
          const assistantMsg: ChatMsg = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: data.reply,
            isCrisis: data.is_crisis === true,
          };
          onMessagesChange([...next, assistantMsg]);
          if (data.detected_language && data.detected_language !== lang && onLanguageChange) {
            onLanguageChange(data.detected_language);
          }
        } else {
          console.warn("[WellbeingChat] Empty reply or error received:", data || error);
          const assistantMsg: ChatMsg = {
            id: crypto.randomUUID(),
            role: "assistant",
            content:
              lang === "ta"
                ? "இணைப்பில் சிக்கல் ஏற்பட்டுள்ளது. தயவுசெய்து சிறிது நேரம் கழித்து மீண்டும் முயற்சிக்கவும்."
                : lang === "hi"
                ? "AI साथी से जुड़ने में समस्या हुई। कृपया थोड़ी देर बाद पुनः प्रयास करें।"
                : "Unable to connect to AI companion right now. Please try again in a moment.",
            isCrisis: false,
          };
          onMessagesChange([...next, assistantMsg]);
        }
      } catch (err) {
        console.error("[WellbeingChat] Caught network/client exception:", err);
        const fallbackMsg: ChatMsg = {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            lang === "ta"
              ? "இணைப்பில் சிக்கல் ஏற்பட்டுள்ளது. உங்கள் இணைய இணைப்பைச் சரிபார்க்கவும்."
              : lang === "hi"
              ? "नेटवर्क त्रुटि हुई। कृपया अपना कनेक्शन जांचें।"
              : "A network error occurred while connecting. Please check your connection and try again.",
          isCrisis: false,
        };
        onMessagesChange([...next, fallbackMsg]);
      } finally {
        setLoading(false);
      }
    },
    [sharedMessages, onMessagesChange, lang, atCap]
  );

  return (
    <>
      {/* Floating panel */}
      {open && (
        <div
          className="fixed bottom-24 right-4 z-50 w-[380px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[22px] border border-line bg-surface/95 shadow-[0_16px_60px_-12px_rgba(0,0,0,0.25)] backdrop-blur-xl nira-rise lg:bottom-6 lg:right-6"
          role="dialog"
          aria-label="NIRA wellbeing chat"
        >
          <WellbeingChatView
            lang={lang}
            victimId={victimId}
            messages={sharedMessages.length === 0 ? [getDefaultGreeting(lang)] : sharedMessages}
            loading={loading}
            atCap={atCap}
            onSend={sendMessage}
            onExpand={onExpand}
            onMessagesChange={onMessagesChange}
            compact
          />
        </div>
      )}

      {/* FAB */}
      <button
        id="wellbeing-chat-fab"
        aria-label={open ? "Close chat" : t(lang, "chat_title")}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed bottom-20 right-4 z-50 flex size-14 items-center justify-center rounded-full shadow-[0_6px_24px_-4px_rgba(0,0,0,0.25)] transition-all duration-300 lg:bottom-6 lg:right-6",
          open ? "bg-ink text-surface rotate-90 scale-95" : "bg-brand text-white scale-100 hover:scale-105"
        )}
      >
        {open ? <X className="size-5" /> : <MessageCircle className="size-6" />}
      </button>
    </>
  );
}
