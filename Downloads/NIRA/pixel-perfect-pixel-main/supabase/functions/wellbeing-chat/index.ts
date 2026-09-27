// Supabase Edge Function: wellbeing-chat (NIRA SIH26094)
// Ephemeral open-ended supportive chat via Groq API
// Fully in-session, multilingual (Tamil, Hindi, English), crisis-aware.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  message: string;
  conversation_history?: ChatMessage[];
  language?: string;
}

const MAX_MESSAGE_CHARS = 1000;
const MAX_HISTORY_TURNS = 20;

const CRISIS_KEYWORDS = [
  "suicide", "kill myself", "want to die", "end my life", "harm myself",
  "threatened", "beaten", "weapon", "he is coming", "trapped", "danger",
  "kill me", "murder", "abuse", "அடி", "கொன்று", "தற்கொலை", "சுயவதை",
  "मारना", "आत्महत्या", "खतरा"
];

function detectCrisis(text: string): boolean {
  const lower = text.toLowerCase();
  return CRISIS_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

interface LanguageResolution {
  lang: "ta" | "hi" | "en";
  langName: string;
  isSwitch: boolean;
}

function resolveLanguage(rawMessage: string, clientLang: string): LanguageResolution {
  const trimmed = rawMessage.trim();
  const lower = trimmed.toLowerCase();

  // 1. Explicit request for Tamil or native Tamil script or common Tamil greeting
  const hasTamilScript = /[\u0B80-\u0BFF]/.test(trimmed);
  const asksTamil =
    /\b(talk\s+in\s+tamil|speak\s+in\s+tamil|speak\s+tamil|in\s+tamil|tamil\s+please|switch\s+to\s+tamil|talk\s+tamil|tell\s+in\s+tamil)\b/i.test(lower) ||
    /^(tamil|tamizh)$/i.test(lower) ||
    /\b(vanakkam|vanakam|nandri|eppadi\s+irukkeenga|epdi\s+irukinga)\b/i.test(lower);

  if (hasTamilScript || asksTamil) {
    return { lang: "ta", langName: "Tamil", isSwitch: true };
  }

  // 2. Explicit request for Hindi or Devanagari script or common Hindi greeting
  const hasHindiScript = /[\u0900-\u097F]/.test(trimmed);
  const asksHindi =
    /\b(talk\s+in\s+hindi|speak\s+in\s+hindi|speak\s+hindi|in\s+hindi|hindi\s+please|switch\s+to\s+hindi|talk\s+hindi|tell\s+in\s+hindi)\b/i.test(lower) ||
    /^(hindi)$/i.test(lower) ||
    /\b(namaste|namaskar|shukriya|kaise\s+ho|kya\s+haal\s+hai)\b/i.test(lower);

  if (hasHindiScript || asksHindi) {
    return { lang: "hi", langName: "Hindi", isSwitch: true };
  }

  // 3. Explicit request for English
  const asksEnglish =
    /\b(talk\s+in\s+english|speak\s+in\s+english|speak\s+english|in\s+english|english\s+please|switch\s+to\s+english|talk\s+english)\b/i.test(lower) ||
    /^(english)$/i.test(lower);

  if (asksEnglish) {
    return { lang: "en", langName: "English", isSwitch: true };
  }

  // 4. Default to client provided language
  const base = (clientLang || "en").toLowerCase();
  if (base === "ta") return { lang: "ta", langName: "Tamil", isSwitch: false };
  if (base === "hi") return { lang: "hi", langName: "Hindi", isSwitch: false };
  return { lang: "en", langName: "English", isSwitch: false };
}

function buildSystemPrompt(langRes: LanguageResolution): string {
  const { lang, langName } = langRes;

  let scriptDirectives = "";
  if (lang === "ta") {
    scriptDirectives = `MANDATORY SCRIPT REQUIREMENT FOR THIS TURN:
- You MUST reply ENTIRELY in authentic Tamil script (தமிழ்).
- Example style: "வணக்கம்! நீங்கள் எப்படி உணர்கிறீர்கள்? நான் உங்களுடன் பேச இங்கே இருக்கிறேன்."
- ABSOLUTELY NEVER output Arabic script (اَلْعَرَبِيَّة).
- NEVER output English or Devanagari script when responding in Tamil.
- If the user said "talk in tamil", "tamil", or "vanakkam", greet them warmly in Tamil script and invite them to share how they feel.`;
  } else if (lang === "hi") {
    scriptDirectives = `MANDATORY SCRIPT REQUIREMENT FOR THIS TURN:
- You MUST reply ENTIRELY in authentic Hindi Devanagari script (हिन्दी).
- Example style: "नमस्ते! आप आज कैसा महसूस कर रहे हैं? मैं आपकी बात सुनने के लिए यहाँ हूँ।"
- ABSOLUTELY NEVER output Arabic script (اَلْعَرَبِيَّة).
- NEVER output English or Tamil script when responding in Hindi.
- If the user said "talk in hindi", "hindi", or "namaste", greet them warmly in Hindi Devanagari script and invite them to share how they feel.`;
  } else {
    scriptDirectives = `MANDATORY SCRIPT REQUIREMENT FOR THIS TURN:
- You MUST reply in English.
- ABSOLUTELY NEVER output Arabic script (اَلْعَرَبِيَّة).
- Keep the tone calm, warm, and supportive.`;
  }

  return `You are NIRA's gentle wellbeing companion — a calm, warm, human presence inside a safe digital space for individuals navigating difficult life experiences.

CORE PRINCIPLES:
1. Tone: Warm, unhurried, dignified, and empathetic. NEVER clinical, diagnostic, prescriptive, or preachy. Avoid words like risk, assessment, symptom, treatment, pathology, disorder, trauma (unless the user uses it first).
2. Identity: You are a supportive companion, NOT a therapist, counselor, doctor, or hotline. Simply be present.
3. Conversation style:
   - Listen first. Reflect what you hear before offering anything.
   - Keep responses concise: 2-3 sentences max.
   - If the user greets you (e.g. "hi", "hello", "vanakkam", "namaste"), greet them warmly in the requested language and ask how they are feeling today.
   - If the user asks for a joke or something uplifting, share a gentle, wholesome, heartwarming thought or clean joke with a warm touch.
   - If the user had a rough day, validate their struggle warmly with deep care and reassurance.
   - Ask at most ONE gentle, open question per turn.
   - Do not offer unsolicited advice, problem-solving, or silver-linings framing.
4. Crisis Protocol:
   - If the message expresses suicidal ideation, self-harm, imminent violence, or acute emergency danger:
     - Begin your response with [CRISIS].
     - Direct them warmly to the SOS button or Support tab for 24x7 helplines.
5. Strict Language & Script Protocol:
Target Language: ${langName} (${lang})
${scriptDirectives}

6. Privacy: Ephemeral conversation.

Respond with ONLY your conversational response text (2-3 sentences). Do not include commentary, disclaimers, or metadata outside of your response.`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const debug: Record<string, unknown> = {};

  try {
    const rawKey =
      Deno.env.get("GROQ_API_KEY") ||
      Deno.env.get("GROQ_KEY") ||
      Deno.env.get("GROQCLOUD_API_KEY") ||
      Deno.env.get("groq_api_key") ||
      "";
    const groqApiKey = rawKey.trim().replace(/^["']|["']$/g, "");

    debug.has_key = Boolean(groqApiKey);
    debug.key_len = groqApiKey.length;
    debug.key_prefix = groqApiKey ? groqApiKey.slice(0, 6) : null;

    const body: ChatRequest = await req.json();
    const rawMessage = (body.message ?? "").trim();
    const clientLanguage = (body.language ?? "en").toLowerCase();
    const history: ChatMessage[] = (body.conversation_history ?? []).slice(-MAX_HISTORY_TURNS);

    if (!rawMessage) {
      return new Response(
        JSON.stringify({ error: "message is required", _debug: debug }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (rawMessage.length > MAX_MESSAGE_CHARS) {
      return new Response(
        JSON.stringify({ error: "message_too_long", max: MAX_MESSAGE_CHARS, _debug: debug }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve effective language from message content and client preference
    const langRes = resolveLanguage(rawMessage, clientLanguage);
    debug.client_language = clientLanguage;
    debug.resolved_language = langRes.lang;
    debug.is_language_switch = langRes.isSwitch;

    let isCrisis = detectCrisis(rawMessage);
    let reply = "";

    if (!groqApiKey) {
      debug.error = "GROQ_API_KEY secret is not set in Supabase Edge Functions environment.";
      console.error("GROQ_API_KEY secret is missing");
    } else {
      const groqMessages = [
        { role: "system" as const, content: buildSystemPrompt(langRes) },
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: rawMessage },
      ];

      // Discover available models dynamically from Groq
      let availableModelIds: string[] = [];
      try {
        const mRes = await fetch("https://api.groq.com/openai/v1/models", {
          headers: { "Authorization": `Bearer ${groqApiKey}` },
        });
        if (mRes.ok) {
          const mData = await mRes.json();
          availableModelIds = (mData.data ?? []).map((m: { id: string }) => m.id);
          debug.available_models = availableModelIds;
        } else {
          debug.models_list_status = mRes.status;
          debug.models_list_error = await mRes.text();
        }
      } catch (e: any) {
        debug.models_list_exception = e?.message;
      }

      // Ordered preferences based on verified Groq account access
      // Note: EXCLUDE allam-2-7b (Arabic-only) and canopylabs (terms-required)
      const preferences = [
        "qwen/qwen3.8-27b",
        "openai/gpt-oss-120b",
        "openai/gpt-oss-20b",
        "llama-3.3-70b-versatile",
        "llama-3.1-8b-instant",
        "llama3-70b-8192",
        "llama3-8b-8192",
      ];

      // Pick matching preferences, or any safe chat model from available list
      let candidateModels: string[] = [];
      if (availableModelIds.length > 0) {
        candidateModels = preferences.filter((p) => availableModelIds.includes(p));
        if (candidateModels.length === 0) {
          candidateModels = availableModelIds.filter(
            (id) =>
              !id.includes("whisper") &&
              !id.includes("guard") &&
              !id.includes("embed") &&
              !id.includes("canopylabs") &&
              !id.includes("allam") &&
              !id.includes("orpheus")
          );
        }
      }
      if (candidateModels.length === 0) {
        candidateModels = ["qwen/qwen3.8-27b", "openai/gpt-oss-120b", "openai/gpt-oss-20b"];
      }

      debug.candidate_models = candidateModels;

      for (const model of candidateModels) {
        if (reply) break;
        try {
          const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${groqApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model,
              messages: groqMessages,
              temperature: 0.7,
              max_tokens: 300,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            let text = data.choices?.[0]?.message?.content ?? "";
            text = text.trim();

            // Try parsing if model returned JSON
            try {
              const parsed = JSON.parse(text);
              if (parsed.reply) {
                text = parsed.reply;
              }
              if (typeof parsed.is_crisis === "boolean") {
                isCrisis = isCrisis || parsed.is_crisis;
              }
            } catch {
              // Plain text response
            }

            if (text.startsWith("[CRISIS]")) {
              isCrisis = true;
              text = text.replace("[CRISIS]", "").trim();
            }

            reply = text;
            debug.model_used = model;
            break;
          } else {
            const errBody = await res.text();
            console.error(`Groq error ${model} (HTTP ${res.status}):`, errBody);
            debug[`groq_${model}_status`] = res.status;
            debug[`groq_${model}_error`] = errBody;
          }
        } catch (fetchErr: any) {
          console.error(`Fetch exception for ${model}:`, fetchErr);
          debug[`fetch_err_${model}`] = fetchErr.message;
        }
      }
    }

    // Dynamic contextual fallback if Groq call failed
    if (!reply) {
      debug.used_fallback = true;
      const lower = rawMessage.toLowerCase();

      if (langRes.lang === "ta") {
        if (lower.includes("tamil") || lower.includes("vanakkam")) {
          reply = "வணக்கம்! நான் உங்களுடன் தமிழில் பேச மகிழ்ச்சியடைகிறேன். இன்று நீங்கள் எப்படி உணர்கிறீர்கள்?";
        } else if (lower.includes("joke") || lower.includes("சிரிப்பு")) {
          reply = "ஒரு சிறிய புன்னகை: டீ ஏன் தியானம் செய்தது? தனது மன அமைதியைக் கண்டறிய! இந்த நாள் உங்களுக்கு நல்வழியாக அமையட்டும்.";
        } else {
          reply = "வணக்கம்! நான் நிராவின் நல்வாழ்வு தோழன். நான் இங்கே உங்களுடன் இருக்கிறேன் — இன்று நீங்கள் எப்படி உணர்கிறீர்கள்?";
        }
      } else if (langRes.lang === "hi") {
        if (lower.includes("hindi") || lower.includes("namaste")) {
          reply = "नमस्ते! मैं आपके साथ हिंदी में बात करने के लिए यहाँ हूँ। आज आप कैसा महसूस कर रहे हैं?";
        } else if (lower.includes("joke") || lower.includes("चुटकुला")) {
          reply = "एक छोटी सी मुस्कान: चाय ध्यान क्यों करने गई? क्योंकि उसे अपने मन की शांति चाहिए थी! आशा है यह आपके चेहरे पर मुस्कान लाएगी।";
        } else {
          reply = "नमस्ते! मैं नीरा का वेलबीइंग साथी हूँ। मैं आपके साथ हूँ — आज आप कैसा महसूस कर रहे हैं?";
        }
      } else {
        if (lower === "hi" || lower === "hello" || lower === "hey") {
          reply = "Hello! I'm NIRA's wellbeing companion. I'm here with you — how are you feeling today?";
        } else if (lower.includes("rough") || lower.includes("bad day") || lower.includes("tired")) {
          reply = "I'm really sorry to hear today has been difficult. Carrying all of that is exhausting — I'm right here if you want to talk or just take a breath.";
        } else if (lower.includes("joke") || lower.includes("funny")) {
          reply = "Here's a gentle smile: Why did the tea go to meditation? To find some inner peas (peace)! I hope today brings you a moment of warmth.";
        } else {
          reply = "Thank you for sharing that with me. I'm here beside you — take all the time you need.";
        }
      }
    }

    return new Response(
      JSON.stringify({
        reply,
        is_crisis: isCrisis,
        detected_language: langRes.lang,
        _debug: debug,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "x-nira-has-groq-key": String(Boolean(groqApiKey)),
          "x-nira-model-used": String(debug.model_used || "none"),
          "x-nira-detected-language": langRes.lang,
        },
      }
    );
  } catch (err: any) {
    console.error("wellbeing-chat unhandled error:", err);
    return new Response(
      JSON.stringify({ error: err.message ?? "Failed to process chat", _debug: debug }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
