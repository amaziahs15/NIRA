// Supabase Edge Function: compute-score (NIRA SIH26094)
// Longitudinal wellbeing multi-modal risk scoring engine

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ComputeScoreRequest {
  checkin_id: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseKey = serviceKey || anonKey;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: !serviceKey && authHeader ? { headers: { Authorization: authHeader } } : undefined,
    });

    const body: ComputeScoreRequest = await req.json();
    const { checkin_id } = body;

    if (!checkin_id) {
      return new Response(JSON.stringify({ error: "Missing checkin_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Fetch checkin
    const { data: checkin, error: checkinErr } = await supabase
      .from("checkins")
      .select("*")
      .eq("id", checkin_id)
      .maybeSingle();

    if (checkinErr || !checkin) {
      return new Response(
        JSON.stringify({ error: checkinErr?.message || "Checkin not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { victim_id, message_text, mood_label, channel, voice_url, response_latency_seconds } = checkin;

    // 2. Fetch victim's previous scores to determine trend
    const { data: prevScores } = await supabase
      .from("scores")
      .select("composite_score, created_at")
      .eq("victim_id", victim_id)
      .order("created_at", { ascending: false })
      .limit(3);

    const lastScoreVal = prevScores && prevScores.length > 0 ? Number(prevScores[0].composite_score) : null;

    // 3a. Hugging Face Inference: Sentiment Analysis (distilbert-base-uncased-finetuned-sst-2-english)
    let sentimentScore = 50; // 0 (positive/healthy) to 100 (high risk/distress)
    let emotionScore = 50;
    let crisisFlag = false;

    // emotion_component metadata
    let emotionTopLabel = "neutral";
    let sentimentConfidence: number | null = null;
    let emotionConfidence: number | null = null;
    let sentimentCallStatus = "skipped";
    let emotionCallStatus = "skipped";

    const crisisKeywords = [
      "threatened", "harm", "kill", "suicide", "danger", "scared",
      "violence", "hurt", "beaten", "weapon", "stalking", "force", "abuse"
    ];

    // Distress weight mapping for the 7-class emotion model
    // Higher = more distress signal
    const EMOTION_DISTRESS_WEIGHTS: Record<string, number> = {
      fear: 85,
      sadness: 75,
      disgust: 65,
      anger: 70,
      surprise: 45,
      neutral: 40,
      joy: 10,
    };

    if (message_text && message_text.trim().length > 0) {
      const lower = message_text.toLowerCase();
      for (const kw of crisisKeywords) {
        if (lower.includes(kw)) {
          crisisFlag = true;
          break;
        }
      }

      if (hfToken) {
        // --- Call 1: Binary Sentiment (distilbert SST-2) ---
        try {
          sentimentCallStatus = "pending";
          const hfSentRes = await fetch(
            "https://router.huggingface.co/hf-inference/models/distilbert-base-uncased-finetuned-sst-2-english",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${hfToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ inputs: message_text }),
            }
          );

          if (hfSentRes.ok) {
            const hfData = await hfSentRes.json();
            // Format: [[{ label: 'NEGATIVE', score: 0.98 }, { label: 'POSITIVE', score: 0.02 }]]
            if (Array.isArray(hfData) && Array.isArray(hfData[0])) {
              const neg = hfData[0].find((item: any) => item.label === "NEGATIVE");
              if (neg) {
                sentimentScore = Math.round(neg.score * 100);
                sentimentConfidence = neg.score;
              }
            }
            sentimentCallStatus = "ok";
          } else {
            sentimentCallStatus = `error_${hfSentRes.status}`;
            console.warn("HF sentiment API error:", hfSentRes.status);
          }
        } catch (e) {
          sentimentCallStatus = "exception";
          console.warn("HF sentiment inference exception:", e);
        }

        // --- Call 2: 7-Class Emotion (j-hartmann/emotion-english-distilroberta-base) ---
        try {
          emotionCallStatus = "pending";
          const hfEmoRes = await fetch(
            "https://router.huggingface.co/hf-inference/models/j-hartmann/emotion-english-distilroberta-base",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${hfToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ inputs: message_text }),
            }
          );

          if (hfEmoRes.ok) {
            const hfEmoData = await hfEmoRes.json();
            // Format: [[{ label: 'sadness', score: 0.87 }, { label: 'joy', score: 0.03 }, ...]]
            if (Array.isArray(hfEmoData) && Array.isArray(hfEmoData[0])) {
              const labels: { label: string; score: number }[] = hfEmoData[0];
              // Sort by score descending, pick top label
              labels.sort((a, b) => b.score - a.score);
              const top = labels[0];
              if (top) {
                emotionTopLabel = top.label.toLowerCase();
                emotionConfidence = top.score;
                // Map top label to distress-weighted score (0–100)
                emotionScore = EMOTION_DISTRESS_WEIGHTS[emotionTopLabel] ?? 50;
                // Blend confidence: if top label is very confident, use it; otherwise pull toward 50
                emotionScore = Math.round(emotionScore * top.score + 50 * (1 - top.score));
              }
            }
            emotionCallStatus = "ok";
          } else {
            emotionCallStatus = `error_${hfEmoRes.status}`;
            console.warn("HF emotion API error:", hfEmoRes.status);
          }
        } catch (e) {
          emotionCallStatus = "exception";
          console.warn("HF emotion inference exception:", e);
        }

      } else {
        // Deterministic NLP heuristic fallback (no HF token)
        sentimentCallStatus = "no_token";
        emotionCallStatus = "no_token";
        if (crisisFlag) {
          sentimentScore = 85;
          emotionScore = 82;
          emotionTopLabel = "fear";
        } else if (lower.includes("sad") || lower.includes("worried") || lower.includes("anxious") || lower.includes("crying")) {
          sentimentScore = 70;
          emotionScore = 68;
          emotionTopLabel = "sadness";
        } else if (lower.includes("calm") || lower.includes("peaceful") || lower.includes("good") || lower.includes("better")) {
          sentimentScore = 25;
          emotionScore = 20;
          emotionTopLabel = "joy";
        } else {
          sentimentScore = 48;
          emotionScore = 45;
          emotionTopLabel = "neutral";
        }
      }
    } else {
      sentimentCallStatus = "no_text";
      emotionCallStatus = "no_text";
    }


    // 4. Derive Behaviour Component
    // Latency, channel type, mood label
    let behaviourScore = 40;
    const moodImpact: Record<string, number> = {
      "Overwhelmed": 85,
      "Distressed": 80,
      "Anxious": 70,
      "Uneasy": 60,
      "Neutral": 45,
      "Steady": 30,
      "Hopeful": 20,
      "Safe": 15,
    };

    if (moodImpact[mood_label]) {
      behaviourScore = moodImpact[mood_label];
    }

    // Adjust for latency
    const latency = Number(response_latency_seconds) || 0;
    if (latency > 120) {
      behaviourScore = Math.min(100, behaviourScore + 10);
    } else if (latency < 10) {
      behaviourScore = Math.min(100, behaviourScore + 5);
    }

    // 5. Composite Score Calculation
    // Multi-modal weighted combination
    const compositeScore = Math.min(
      100,
      Math.max(
        10,
        Math.round(0.40 * sentimentScore + 0.35 * emotionScore + 0.25 * behaviourScore)
      )
    );

    // 6. Signal Quality assessment
    let qualityStatus = "GOOD";
    let snr = 28;
    if (voice_url) {
      snr = 24;
      qualityStatus = "GOOD";
    } else if (!message_text || message_text.length < 5) {
      qualityStatus = "UNCERTAIN";
      snr = 14;
    }

    const signalQuality = {
      status: qualityStatus,
      snr: snr,
      confidence: qualityStatus === "GOOD" ? 0.91 : 0.65,
      channel: channel || "web",
      has_voice: Boolean(voice_url),
      // HF model call metadata
      sentiment_model: "distilbert-base-uncased-finetuned-sst-2-english",
      sentiment_call_status: sentimentCallStatus,
      sentiment_confidence: sentimentConfidence,
      emotion_model: "j-hartmann/emotion-english-distilroberta-base",
      emotion_call_status: emotionCallStatus,
      emotion_confidence: emotionConfidence,
      emotion_top_label: emotionTopLabel,
    };

    // 7. Trend determination vs previous score
    let trend = "Stable";
    if (crisisFlag || compositeScore >= 80) {
      trend = "Priority review";
    } else if (lastScoreVal !== null) {
      const delta = compositeScore - lastScoreVal;
      if (delta >= 18) {
        trend = "Rapidly increasing";
      } else if (delta >= 8) {
        trend = "Increasing";
      } else if (delta <= -8) {
        trend = "Improving";
      } else {
        trend = "Stable";
      }
    } else {
      trend = compositeScore > 65 ? "Needs attention" : "Stable";
    }

    // 8. Insert row into scores
    const { data: newScore, error: scoreErr } = await supabase
      .from("scores")
      .insert({
        victim_id,
        checkin_id,
        composite_score: compositeScore,
        sentiment_component: sentimentScore,
        emotion_component: emotionScore,
        behaviour_component: behaviourScore,
        crisis_flag: crisisFlag,
        signal_quality: signalQuality,
        trend,
      })
      .select()
      .single();

    if (scoreErr) {
      throw scoreErr;
    }

    // 9. If crisis or high score, insert into alerts
    if (crisisFlag || compositeScore >= 75) {
      await supabase.from("alerts").insert({
        victim_id,
        score_id: newScore.id,
        severity: crisisFlag || compositeScore >= 80 ? "priority" : "attention",
        status: "open",
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        score: newScore,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Failed to compute score" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
