import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getNiraRole, roleHome } from "@/lib/nira-auth";
import { SafetyNotice, SoftBadge } from "@/components/nira-primitives";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/sign-up")({
  component: SignUpPage,
});

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "ta", label: "தமிழ்" },
  { value: "hi", label: "हिन्दी" },
];

const ROLES = [
  {
    value: "victim",
    label: "I need support",
    description: "Private wellbeing space, check-ins, and case updates",
    badge: "Victim space" as const,
    tone: "brand" as const,
  },
  {
    value: "professional",
    label: "I provide support",
    description: "Dashboard for reviewing priority cases and recording decisions",
    badge: "Support professional" as const,
    tone: "improving" as const,
  },
];

function SignUpPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [language, setLanguage] = useState("en");
  const [role, setRole] = useState<"victim" | "professional">("victim");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleSignUp = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("nira_oauth_role", role);
        localStorage.setItem("nira_oauth_language", language);
      }
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (oauthError) throw oauthError;
    } catch (err: any) {
      setError(err.message ?? "Google sign up failed");
      setGoogleLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data, error: authErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            nira_role: role,
            role: role,
            name,
            language,
          },
        },
      });
      if (authErr) throw authErr;
      const userId = data.user?.id;
      if (!userId) throw new Error("No user returned");
      // Small delay for trigger to fire
      await new Promise((r) => setTimeout(r, 800));
      const resolvedRole = await getNiraRole(userId);
      const dest = roleHome(resolvedRole ?? role);
      await navigate({ to: `/${dest}` });
    } catch (err: any) {
      setError(err.message ?? "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="nira-drift absolute -left-32 -top-40 size-[520px] rounded-full bg-brand/8 blur-3xl" />
        <div className="nira-drift-reverse absolute right-0 top-24 size-[600px] rounded-full bg-sage/12 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3">
          <img
            src="/nira-logo.png"
            alt="NIRA"
            className="h-24 w-24 rounded-2xl object-contain shadow-lg shadow-brand/10"
          />
        </div>

        <div className="rounded-[26px] border border-line bg-white/80 p-7 shadow-soft backdrop-blur-xl">
          <h1 className="text-xl font-extrabold tracking-tight text-ink">Create your space</h1>
          <p className="mt-1 text-xs text-muted-ink">
            Everything you share is private and held with care.
          </p>

          {error && (
            <div className="mt-4 rounded-xl bg-priority/10 px-4 py-3 text-xs text-priority">
              {error}
            </div>
          )}

          {/* Google Sign-up */}
          <button
            type="button"
            id="google-sign-up"
            onClick={handleGoogleSignUp}
            disabled={googleLoading || loading}
            className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-xl border border-line bg-white py-3 text-sm font-semibold text-ink shadow-sm transition hover:bg-neutral-50/80 active:scale-[0.99] disabled:opacity-60"
          >
            <svg className="size-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            {googleLoading ? "Connecting to Google…" : "Continue with Google"}
          </button>

          <div className="relative my-5 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-line" />
            </div>
            <span className="relative bg-white px-3 text-[11px] font-medium uppercase tracking-wider text-muted-ink">
              or with email
            </span>
          </div>

          <form onSubmit={handleSignUp} className="space-y-5">
            {/* Role selection */}
            <div>
              <label className="block text-xs font-semibold text-ink">I am…</label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {ROLES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    id={`role-${r.value}`}
                    onClick={() => setRole(r.value as "victim" | "professional")}
                    className={`rounded-xl border p-3 text-left transition ${
                      role === r.value
                        ? "border-brand bg-brand-soft ring-2 ring-brand/20"
                        : "border-line bg-surface hover:border-brand/40"
                    }`}
                  >
                    <div className="text-xs font-bold text-ink mb-1.5">{r.label}</div>
                    <SoftBadge tone={r.tone}>{r.badge}</SoftBadge>
                    <p className="mt-2 text-[10px] text-muted-ink">{r.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-xs font-semibold text-ink">
                Your name
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-line bg-background px-4 py-3 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                placeholder="How should we address you?"
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="signup-email" className="block text-xs font-semibold text-ink">
                Email
              </label>
              <input
                id="signup-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-line bg-background px-4 py-3 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                placeholder="you@example.com"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="signup-password" className="block text-xs font-semibold text-ink">
                Password
              </label>
              <div className="relative mt-1.5">
                <input
                  id="signup-password"
                  type={showPw ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-line bg-background px-4 py-3 pr-10 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  placeholder="At least 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-ink"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {/* Language */}
            <div>
              <label htmlFor="language" className="block text-xs font-semibold text-ink">
                Preferred language
              </label>
              <select
                id="language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-line bg-background px-4 py-3 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>

            <SafetyNotice>
              Your information is encrypted and only used to provide your wellbeing space. We will never share
              your details without your explicit consent.
            </SafetyNotice>

            <button
              id="sign-up-submit"
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-brand py-3 text-sm font-bold text-white shadow-lg shadow-brand/20 transition hover:bg-brand/90 disabled:opacity-60"
            >
              {loading ? "Creating your space…" : "Create my space"}
            </button>
          </form>

          <div className="mt-4 flex justify-center">
            <SoftBadge tone="brand" icon={<ShieldCheck className="size-3" />}>
              Consent first · Encrypted · Private
            </SoftBadge>
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-muted-ink">
          Already have a space?{" "}
          <Link to="/sign-in" className="font-semibold text-brand underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
