// Supabase Edge Function: checkin-companion (NIRA SIH26094)
// Lightweight empathetic check-in acknowledgment layer via Groq (llama-3.3-70b-versatile)
// Completely decoupled from compute-score / signal quality scoring

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CompanionRequest {
  checkin_id?: string;
  message_text?: string | null;
  mood_label?: string | null;
  language?: string;
}

const CRISIS_KEYWORDS = [
  "suicide", "kill myself", "want to die", "end my life", "harm myself",
  "threatened", "beaten", "weapon", "he is coming", "trapped", "danger",
  "kill me", "murder", "abuse"
];

function buildSystemPrompt(language: string): string {
  const langName = language === "ta" ? "Tamil" : language === "hi" ? "Hindi" : "English";

  return `You are NIRA's gentle check-in companion. NIRA is a supportive, dignified wellbeing space for individuals navigating difficult life experiences.

CRITICAL SAFETY & TONE PRINCIPLES:
1. Tone: Calm, warm, dignified, empathetic, and human. NEVER use clinical, medical, legal, or diagnostic terms. Never say "risk", "abnormal", "pathology", "symptom", "diagnosis", or "assessment".
2. Identity: You are a lightweight supportive companion inside their personal space. NEVER claim to be a therapist, doctor, counselor, or crisis hotline. Never give medical, psychiatric, legal, or physical safety advice.
3. Content:
   - Acknowledge what the person shared in 1 to 2 short, validating sentences (e.g. recognizing how tiring, heavy, or steady things feel).
   - If the check-in was brief or neutral, do not force conversation.
   - If appropriate, optionally ask at most ONE gentle, open, non-intrusive question (e.g., "Have you been able to take a quiet breath today?", "Is there someone safe with you this evening?"). Never ask leading or prying questions about traumatic events.
4. Crisis Protocol:
   - If the message expresses self-harm, suicidal thoughts, acute abuse, imminent violence, or emergency danger:
     - Set "is_crisis": true.
     - Do NOT try to counsel, debate, or resolve the crisis yourself.
     - Provide a short, caring acknowledgment that they are not alone and point them directly to use the emergency SOS button on screen or the national helplines on the Support tab.
5. Language:
   - Respond in ${langName} (${language}). Keep the phrasing natural, gentle, and respectful.

You MUST respond strictly with a valid JSON object matching this schema:
{
  "reply": "your 1-2 sentence warm acknowledgment and optional single gentle question",
  "is_crisis": false
}`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const groqApiKey = (
      Deno.env.get("GROQ_API_KEY") ||
      Deno.env.get("GROQ_KEY") ||
      Deno.env.get("GROQCLOUD_API_KEY") ||
      ""
    ).trim().replace(/^["']|["']$/g, "");

    const body: CompanionRequest = await req.json();
    const { checkin_id, message_text, mood_label, language = "en" } = body;

    const userMessage = (message_text || "").trim();
    const moodStr = (mood_label || "").trim();

    // Check for crisis indicators
    const lowerText = `${userMessage} ${moodStr}`.toLowerCase();
    const hasCrisisKeyword = CRISIS_KEYWORDS.some((kw) => lowerText.includes(kw));

    let reply = "";
    let isCrisis = hasCrisisKeyword;

    if (groqApiKey) {
      const systemPrompt = buildSystemPrompt(language);
      const userPrompt = `User mood check-in: "${moodStr || "Not specified"}"\nUser note: "${userMessage || "No text note provided."}"\n(Remember: Respond in valid JSON format: {"reply": "...", "is_crisis": false})`;

      const candidateModels = [
        "qwen/qwen3.8-27b",
        "openai/gpt-oss-120b",
        "openai/gpt-oss-20b",
        "allam-2-7b",
        "llama-3.3-70b-versatile",
        "llama-3.1-8b-instant",
      ];

      for (const model of candidateModels) {
        if (reply) break;
        try {
          const bodyPayload: any = {
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.5,
            max_tokens: 250,
          };
          if (!model.includes("allam") && !model.includes("orpheus")) {
            bodyPayload.response_format = { type: "json_object" };
          }
          const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${groqApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(bodyPayload),
          });

          if (groqRes.ok) {
            const groqData = await groqRes.json();
            const rawContent = groqData.choices?.[0]?.message?.content ?? "";
            try {
              const parsed = JSON.parse(rawContent);
              reply = parsed.reply || "";
              if (typeof parsed.is_crisis === "boolean") {
                isCrisis = isCrisis || parsed.is_crisis;
              }
            } catch {
              reply = rawContent.replace(/^```json\s*|\s*```$/g, "").trim();
            }
            if (reply) break;
          } else {
            console.error(`Groq API returned status for ${model}:`, groqRes.status, await groqRes.text());
          }
        } catch (err) {
          console.error(`Groq API call error for ${model}:`, err);
        }
      }
    }

    // Gentle fallback if Groq API is not configured or failed
    if (!reply) {
      if (isCrisis) {
        reply = language === "ta"
          ? "நீங்கள் தனியாக இல்லை என்பதை நினைவில் கொள்ளுங்கள். உடனடியாக உதவி பெற திரையில் உள்ள SOS பொத்தானைப் பயன்படுத்தவும் அல்லது ஆதரவு பக்கத்தைப் பார்க்கவும்."
          : language === "hi"
          ? "कृपया याद रखें कि आप अकेले नहीं हैं। तत्काल सहायता के लिए कृपया स्क्रीन पर दिए गए SOS बटन का उपयोग करें या सहायता अनुभाग देखें।"
          : "Please know you are not alone right now. If you are in immediate danger or need urgent help, please press the SOS button or visit the Support tab.";
      } else {
        reply = language === "ta"
          ? "இதை எங்களுடன் பகிர்ந்தமைக்கு நன்றி. உங்கள் உணர்வுகள் மதிக்கப்படுகின்றன."
          : language === "hi"
          ? "अपनी बात साझा करने के लिए धन्यवाद। हम आपके साथ हैं।"
          : "Thank you for taking a moment to check in with yourself. Holding this space with you.";
      }
    }

    // Log event to case_events for human caseworker review (non-blocking)
    if (checkin_id && supabaseUrl && supabaseServiceKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const { data: checkin } = await supabase
          .from("checkins")
          .select("victim_id")
          .eq("id", checkin_id)
          .maybeSingle();

        if (checkin?.victim_id) {
          const { data: victim } = await supabase
            .from("victims")
            .select("case_id")
            .eq("id", checkin.victim_id)
            .maybeSingle();

          if (victim?.case_id) {
            await supabase.from("case_events").insert({
              case_id: victim.case_id,
              event_type: "companion_reply",
              description: isCrisis
                ? "AI companion provided supportive acknowledgment with immediate emergency helpline referral."
                : "AI companion provided warm check-in acknowledgment.",
            });
          }
        }
      } catch (logErr) {
        console.error("Could not log companion_reply to case_events:", logErr);
      }
    }

    return new Response(
      JSON.stringify({
        reply,
        is_crisis: isCrisis,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("checkin-companion unhandled error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Failed to process companion reply" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
