import { useEffect, useState, useRef, useCallback } from "react";

const STORAGE_KEY = "nira_intro_seen";

export function LogoIntro() {
  const [visible, setVisible] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [phase, setPhase] = useState<"bloom" | "logo" | "ripples" | "wordmark" | "tagline" | "complete">("bloom");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timerRef = useRef<number[]>([]);

  const finishIntro = useCallback(() => {
    // Clear all pending timers
    timerRef.current.forEach((t) => clearTimeout(t));
    timerRef.current = [];

    setFadingOut(true);
    try {
      sessionStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // Ignore sessionStorage errors
    }

    const t = window.setTimeout(() => {
      setVisible(false);
      document.body.style.overflow = "";
    }, 600);
    timerRef.current.push(t);
  }, []);

  useEffect(() => {
    // Check if user already saw the intro in this session
    try {
      if (sessionStorage.getItem(STORAGE_KEY)) {
        return;
      }
    } catch {
      return;
    }

    // Check prefers-reduced-motion
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReducedMotion(prefersReduced);
    setVisible(true);
    document.body.style.overflow = "hidden";

    // Preload logo images for instant display
    const img1 = new Image();
    img1.src = "/nira-mark.png";
    const img2 = new Image();
    img2.src = "/nira-logo.png";

    if (prefersReduced) {
      // Simple 0.8s fade for reduced motion
      const t = window.setTimeout(() => {
        finishIntro();
      }, 1000);
      timerRef.current.push(t);
      return;
    }

    // Normal cinematic sequence (~3.5s)
    // T+0ms: Bloom grows
    // T+500ms: Logo mark scales in & unblurs
    const t1 = window.setTimeout(() => setPhase("logo"), 450);
    // T+1200ms: Concentric ripples expand
    const t2 = window.setTimeout(() => setPhase("ripples"), 1100);
    // T+1800ms: Wordmark N-I-R-A reveals
    const t3 = window.setTimeout(() => setPhase("wordmark"), 1700);
    // T+2400ms: Tagline fades in
    const t4 = window.setTimeout(() => setPhase("tagline"), 2300);
    // T+3400ms: Intro fades & scales out smoothly
    const t5 = window.setTimeout(() => {
      setPhase("complete");
      finishIntro();
    }, 3500);

    timerRef.current.push(t1, t2, t3, t4, t5);

    // Keyboard handler for Escape
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        finishIntro();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      timerRef.current.forEach((t) => clearTimeout(t));
      document.body.style.overflow = "";
    };
  }, [finishIntro]);

  // Floating ambient particles canvas
  useEffect(() => {
    if (!visible || reducedMotion || fadingOut) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    // Generate lightweight particles
    const particleCount = Math.min(32, Math.floor(width / 35));
    const particles = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 2 + 1,
      speedX: (Math.random() - 0.5) * 0.4,
      speedY: -Math.random() * 0.5 - 0.2,
      opacity: Math.random() * 0.45 + 0.15,
      hue: Math.random() > 0.4 ? 172 : 155, // teal / sage
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        p.x += p.speedX;
        p.y += p.speedY;

        if (p.y < 0) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 60%, 75%, ${p.opacity})`;
        ctx.shadowBlur = 8;
        ctx.shadowColor = `hsla(${p.hue}, 80%, 60%, ${p.opacity * 0.8})`;
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animId);
    };
  }, [visible, reducedMotion, fadingOut]);

  if (!visible) return null;

  if (reducedMotion) {
    return (
      <div
        className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#071211] transition-opacity duration-700 ${
          fadingOut ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
        onClick={finishIntro}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="size-24 overflow-hidden rounded-2xl bg-[#F7F8F5] p-2 shadow-2xl">
            <img src="/nira-mark.png" alt="NIRA" className="size-full object-contain" />
          </div>
          <div className="text-2xl font-extrabold tracking-tight text-[#EAF6F3]">NIRA</div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            finishIntro();
          }}
          className="absolute bottom-6 right-6 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/20 hover:text-white"
        >
          Skip (Esc)
        </button>
      </div>
    );
  }

  const isLogoVisible = phase !== "bloom";
  const areRipplesVisible = phase === "ripples" || phase === "wordmark" || phase === "tagline" || phase === "complete";
  const isWordmarkVisible = phase === "wordmark" || phase === "tagline" || phase === "complete";
  const isTaglineVisible = phase === "tagline" || phase === "complete";

  return (
    <div
      role="dialog"
      aria-label="Welcome to NIRA"
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden bg-[#050C0B] select-none transition-all duration-700 ${
        fadingOut ? "opacity-0 scale-105 pointer-events-none" : "opacity-100 scale-100"
      }`}
      onClick={finishIntro}
    >
      {/* Background canvas for ambient floating particles */}
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 size-full" />

      {/* Central teal/emerald bloom light */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="size-[500px] rounded-full bg-gradient-to-tr from-emerald-500/25 via-teal-400/20 to-transparent blur-[120px] transition-all duration-1000 animate-pulse" />
        <div className="size-[320px] rounded-full bg-teal-300/15 blur-[80px]" />
      </div>

      {/* Concentric ripples */}
      {areRipplesVisible && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="nira-intro-ripple absolute size-44 rounded-full border border-teal-300/35" />
          <div className="nira-intro-ripple-2 absolute size-44 rounded-full border border-emerald-400/25" />
          <div className="nira-intro-ripple-3 absolute size-44 rounded-full border border-teal-200/20" />
        </div>
      )}

      {/* Core Center Stage */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Glow halo behind mark */}
        <div
          className={`absolute -top-8 size-48 rounded-full bg-teal-400/30 blur-2xl transition-all duration-1000 ${
            isLogoVisible ? "scale-100 opacity-100" : "scale-50 opacity-0"
          }`}
        />

        {/* Logo Mark */}
        <div
          className={`relative flex items-center justify-center overflow-hidden rounded-3xl bg-[#F7F8F5] p-3.5 shadow-[0_0_50px_rgba(20,184,166,0.35)] transition-all duration-1000 cubic-bezier(0.34,1.56,0.64,1) ${
            isLogoVisible
              ? "scale-100 opacity-100 blur-0 translate-y-0"
              : "scale-[0.78] opacity-0 blur-[24px] translate-y-3"
          }`}
          style={{ width: 112, height: 112 }}
        >
          <img
            src="/nira-mark.png"
            alt="NIRA logo mark"
            width={112}
            height={112}
            className="size-full object-contain"
          />
        </div>

        {/* Wordmark N-I-R-A */}
        <div className="mt-7 flex items-center justify-center gap-2.5 overflow-hidden">
          {["N", "I", "R", "A"].map((letter, i) => (
            <span
              key={i}
              className={`inline-block text-3xl sm:text-4xl font-black tracking-[0.22em] text-[#EAF6F3] drop-shadow-[0_2px_12px_rgba(20,184,166,0.4)] transition-all duration-500 ease-out`}
              style={{
                transitionDelay: `${i * 90}ms`,
                opacity: isWordmarkVisible ? 1 : 0,
                transform: isWordmarkVisible ? "translateY(0) scale(1)" : "translateY(16px) scale(0.9)",
              }}
            >
              {letter}
            </span>
          ))}
        </div>

        {/* Tagline */}
        <p
          className={`mt-3 max-w-sm text-center text-xs sm:text-sm font-medium tracking-wide text-teal-100/75 transition-all duration-700 ${
            isTaglineVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
          }`}
        >
          A calm space, held with care
        </p>
      </div>

      {/* Skip button in bottom-right */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          finishIntro();
        }}
        aria-label="Skip cinematic introduction"
        className="group absolute bottom-6 right-6 flex items-center gap-2 rounded-full border border-teal-500/25 bg-white/5 px-4 py-1.5 text-xs font-semibold text-teal-100/70 backdrop-blur-md transition-all hover:border-teal-400/50 hover:bg-white/10 hover:text-white"
      >
        <span>Skip intro</span>
        <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-mono text-teal-200/60 group-hover:text-white">
          Esc
        </kbd>
      </button>

      {/* Inline animations for ripples */}
      <style>{`
        @keyframes nira-ripple {
          0% { transform: scale(0.85); opacity: 0.85; }
          100% { transform: scale(2.8); opacity: 0; }
        }
        .nira-intro-ripple {
          animation: nira-ripple 2.6s cubic-bezier(0.1, 0.6, 0.2, 1) infinite;
        }
        .nira-intro-ripple-2 {
          animation: nira-ripple 2.6s cubic-bezier(0.1, 0.6, 0.2, 1) 0.6s infinite;
        }
        .nira-intro-ripple-3 {
          animation: nira-ripple 2.6s cubic-bezier(0.1, 0.6, 0.2, 1) 1.2s infinite;
        }
      `}</style>
    </div>
  );
}
