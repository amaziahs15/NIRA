import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SoftBadge } from "@/components/nira-primitives";
import { t } from "@/lib/nira-i18n";
import { Check, CloudRain, Eye, Sparkles, Volume2, VolumeX, Waves, Wind } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lang: string;
}

export function CalmingToolsModal({ open, onOpenChange, lang }: Props) {
  const [activeTab, setActiveTab] = useState<"breathe" | "grounding" | "sounds">("breathe");

  // Box Breathing state
  const [breathPhase, setBreathPhase] = useState<"in" | "hold1" | "out" | "hold2">("in");
  const [breathTimer, setBreathTimer] = useState(4);

  useEffect(() => {
    if (!open || activeTab !== "breathe") return;

    const interval = setInterval(() => {
      setBreathTimer((prev) => {
        if (prev <= 1) {
          setBreathPhase((p) => {
            if (p === "in") return "hold1";
            if (p === "hold1") return "out";
            if (p === "out") return "hold2";
            return "in";
          });
          return 4;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [open, activeTab]);

  // 5-4-3-2-1 Grounding state
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});

  const toggleStep = (step: number) => {
    setCompletedSteps((prev) => ({ ...prev, [step]: !prev[step] }));
  };

  // Web Audio Synth for Calming Sounds
  const [playingSound, setPlayingSound] = useState<"rain" | "waves" | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const sourceNodeRef = useRef<AudioNode | null>(null);

  const stopSound = () => {
    if (sourceNodeRef.current) {
      try {
        (sourceNodeRef.current as any).stop?.();
        sourceNodeRef.current.disconnect();
      } catch {
        // ignore
      }
      sourceNodeRef.current = null;
    }
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close();
      } catch {
        // ignore
      }
      audioCtxRef.current = null;
    }
    setPlayingSound(null);
  };

  const playSound = (type: "rain" | "waves") => {
    if (playingSound === type) {
      stopSound();
      return;
    }
    stopSound();

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      // Pink noise generator for soothing water/rain
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.08;
        b6 = white * 0.115926;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      // Filter for rain / ocean
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = type === "rain" ? 1200 : 450;

      const gain = ctx.createGain();
      gain.gain.value = 0.4;
      gainNodeRef.current = gain;

      // LFO for wave modulation
      if (type === "waves") {
        const osc = ctx.createOscillator();
        osc.frequency.value = 0.15; // slow ocean wave period
        const oscGain = ctx.createGain();
        oscGain.gain.value = 0.3;
        osc.connect(oscGain);
        oscGain.connect(gain.gain);
        osc.start();
      }

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start();

      sourceNodeRef.current = noise;
      setPlayingSound(type);
    } catch {
      // AudioContext unavailable
    }
  };

  useEffect(() => {
    return () => stopSound();
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg overflow-hidden rounded-[26px] border border-border bg-surface p-6 shadow-2xl backdrop-blur-xl sm:p-7">
        <DialogHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <DialogTitle className="text-xl font-extrabold tracking-tight text-text-primary">
              {t(lang, "calm_tools")}
            </DialogTitle>
            <p className="mt-1 text-xs text-text-secondary">Take a steady moment for yourself</p>
          </div>
          <SoftBadge tone="brand" icon={<Sparkles className="size-3" />}>
            Self-care
          </SoftBadge>
        </DialogHeader>

        {/* Tab switchers */}
        <div className="mt-3 flex rounded-xl border border-border bg-surface-elevated p-1">
          <button
            onClick={() => setActiveTab("breathe")}
            className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
              activeTab === "breathe" ? "bg-primary text-primary-foreground shadow-xs" : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {t(lang, "breathe_title")}
          </button>
          <button
            onClick={() => setActiveTab("grounding")}
            className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
              activeTab === "grounding" ? "bg-primary text-primary-foreground shadow-xs" : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {t(lang, "grounding_title")}
          </button>
          <button
            onClick={() => setActiveTab("sounds")}
            className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
              activeTab === "sounds" ? "bg-primary text-primary-foreground shadow-xs" : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {t(lang, "sounds_title")}
          </button>
        </div>

        {/* Tab 1: Box Breathing */}
        {activeTab === "breathe" && (
          <div className="mt-6 flex flex-col items-center py-4 text-center">
            {/* Animated breathing circle */}
            <div className="relative flex size-52 items-center justify-center">
              <div
                className={`absolute rounded-full bg-primary/20 blur-xl transition-all duration-1000 ease-in-out ${
                  breathPhase === "in" || breathPhase === "hold1" ? "size-48 opacity-80" : "size-28 opacity-30"
                }`}
              />
              <div
                className={`flex items-center justify-center rounded-full border-2 border-primary/40 bg-primary/10 shadow-[0_0_30px_rgba(45,212,191,0.2)] transition-all duration-1000 ease-in-out ${
                  breathPhase === "in" || breathPhase === "hold1" ? "size-44 scale-100" : "size-32 scale-90"
                }`}
              >
                <div className="text-center">
                  <div className="text-3xl font-extrabold text-primary">{breathTimer}</div>
                  <div className="mt-1 text-[11px] font-semibold text-text-secondary uppercase tracking-widest">
                    {breathPhase === "in" && "Inhale"}
                    {breathPhase === "hold1" && "Hold"}
                    {breathPhase === "out" && "Exhale"}
                    {breathPhase === "hold2" && "Rest"}
                  </div>
                </div>
              </div>
            </div>

            <p className="mt-6 text-sm font-semibold text-text-primary">
              {breathPhase === "in" && t(lang, "breathe_in")}
              {breathPhase === "hold1" && t(lang, "breathe_hold")}
              {breathPhase === "out" && t(lang, "breathe_out")}
              {breathPhase === "hold2" && "Stay relaxed and still..."}
            </p>
            <p className="mt-1 text-xs text-text-muted">4 seconds in · 4 seconds hold · 4 seconds out · 4 seconds rest</p>
          </div>
        )}

        {/* Tab 2: 5-4-3-2-1 Grounding */}
        {activeTab === "grounding" && (
          <div className="mt-4 space-y-2.5 py-2">
            {[
              { num: 5, key: "grounding_5", icon: Eye },
              { num: 4, key: "grounding_4", icon: Sparkles },
              { num: 3, key: "grounding_3", icon: Volume2 },
              { num: 2, key: "grounding_2", icon: Wind },
              { num: 1, key: "grounding_1", icon: Check },
            ].map(({ num, key, icon: Icon }) => (
              <button
                key={num}
                onClick={() => toggleStep(num)}
                className={`flex w-full items-center gap-3.5 rounded-2xl border p-3.5 text-left transition ${
                  completedSteps[num]
                    ? "border-success/40 bg-success/10 text-text-primary"
                    : "border-border bg-surface-elevated text-text-secondary hover:border-primary/40 hover:text-text-primary"
                }`}
              >
                <div
                  className={`grid size-7 shrink-0 place-items-center rounded-xl text-xs font-extrabold transition ${
                    completedSteps[num] ? "bg-success text-white" : "bg-primary-soft text-primary"
                  }`}
                >
                  {completedSteps[num] ? <Check className="size-4" /> : num}
                </div>
                <div className="flex-1 text-xs font-semibold leading-relaxed">{t(lang, key)}</div>
              </button>
            ))}
          </div>
        )}

        {/* Tab 3: Calming Ambient Sounds */}
        {activeTab === "sounds" && (
          <div className="mt-4 space-y-3 py-2">
            <div className="rounded-2xl border border-border bg-surface-elevated p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
                    <CloudRain className="size-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-text-primary">{t(lang, "sounds_rain")}</div>
                    <div className="text-xs text-text-muted">Soft steady rainfall frequency</div>
                  </div>
                </div>
                <button
                  onClick={() => playSound("rain")}
                  className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                    playingSound === "rain" ? "bg-primary text-primary-foreground shadow-sm" : "border border-border bg-surface text-text-primary hover:bg-primary-soft"
                  }`}
                >
                  {playingSound === "rain" ? "Pause" : "Play"}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface-elevated p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
                    <Waves className="size-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-text-primary">{t(lang, "sounds_waves")}</div>
                    <div className="text-xs text-text-muted">Gentle rhythmic ocean shore</div>
                  </div>
                </div>
                <button
                  onClick={() => playSound("waves")}
                  className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                    playingSound === "waves" ? "bg-primary text-primary-foreground shadow-sm" : "border border-border bg-surface text-text-primary hover:bg-primary-soft"
                  }`}
                >
                  {playingSound === "waves" ? "Pause" : "Play"}
                </button>
              </div>
            </div>

            {playingSound && (
              <div className="mt-2 flex items-center justify-between rounded-xl border border-primary/20 bg-primary/10 px-4 py-2.5 text-xs text-primary">
                <span className="flex items-center gap-2">
                  <span className="size-2 animate-ping rounded-full bg-primary" />
                  Ambient sound active
                </span>
                <button onClick={stopSound} className="font-semibold underline">
                  Turn off
                </button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
