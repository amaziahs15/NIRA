import { ArrowLeft } from "lucide-react";
import { t } from "@/lib/nira-i18n";
import type { VictimData } from "@/routes/victim";
import type { ChatMsg } from "@/components/victim/WellbeingChatBubble";
import { WellbeingChatView, getDefaultGreeting } from "@/components/victim/WellbeingChatBubble";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const SESSION_MESSAGE_CAP = 30;

interface Props {
  data: VictimData;
  lang: string;
  onBack: () => void;
  initialMessages: ChatMsg[];
  onMessagesChange: (msgs: ChatMsg[]) => void;
  onLanguageChange?: (newLang: string) => void;
}

export default function VictimChat({ data, lang, onBack, initialMessages, onMessagesChange, onLanguageChange }: Props) {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialMessages.length === 0) {
      onMessagesChange([getDefaultGreeting(lang)]);
    }
  }, [lang]);

  const atCap = initialMessages.length >= SESSION_MESSAGE_CAP;

  const sendMessage = useCallback(
    async (text: string) => {
      if (atCap) return;
      const userMsg: ChatMsg = { id: crypto.randomUUID(), role: "user", content: text };
      const currentList = initialMessages.length === 0 ? [getDefaultGreeting(lang)] : initialMessages;
      const next = [...currentList, userMsg];
      onMessagesChange(next);
      setLoading(true);

      try {
        const history = next.map((m) => ({ role: m.role, content: m.content }));
        const { data: res, error } = await supabase.functions.invoke("wellbeing-chat", {
          body: {
            message: text,
            conversation_history: history.slice(0, -1),
            language: lang,
          },
        });

        if (error) {
          console.error("[VictimChat] Supabase function invoke error:", error);
        }
        if (res?._debug) {
          console.info("[VictimChat] Debug info from edge function:", res._debug);
        }

        if (!error && res?.reply) {
          const assistantMsg: ChatMsg = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: res.reply,
            isCrisis: res.is_crisis === true,
          };
          onMessagesChange([...next, assistantMsg]);
          if (res.detected_language && res.detected_language !== lang && onLanguageChange) {
            onLanguageChange(res.detected_language);
          }
        } else {
          console.warn("[VictimChat] Empty reply or error received:", res || error);
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
        console.error("[VictimChat] Caught network/client exception:", err);
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
    [initialMessages, onMessagesChange, lang, atCap]
  );

  return (
    <div className="nira-rise flex h-[calc(100vh-76px-1rem)] flex-col overflow-hidden rounded-[24px] border border-line bg-surface/90 shadow-soft backdrop-blur-xl">
      {/* Page header (back link) */}
      <div className="flex shrink-0 items-center gap-3 border-b border-line px-5 py-4">
        <button
          id="chat-back-btn"
          onClick={onBack}
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-muted-ink transition hover:bg-brand-soft hover:text-brand"
        >
          <ArrowLeft className="size-4" />
          {lang === "ta" ? "திரும்பு" : lang === "hi" ? "वापस" : "Back"}
        </button>
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-ink">
          {t(lang, "chat_title")}
        </div>
      </div>

      {/* Chat view fills remaining space */}
      <div className="flex-1 overflow-hidden">
        <WellbeingChatView
          lang={lang}
          victimId={data.victimId}
          messages={initialMessages.length === 0 ? [getDefaultGreeting(lang)] : initialMessages}
          loading={loading}
          atCap={atCap}
          onSend={sendMessage}
          onMessagesChange={onMessagesChange}
          compact={false}
        />
      </div>
    </div>
  );
}
