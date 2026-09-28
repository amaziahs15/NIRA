import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getNiraRole, roleHome } from "@/lib/nira-auth";
import { SoftBadge } from "@/components/nira-primitives";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/sign-in")({
  component: SignInPage,
});

function SignInPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (oauthError) throw oauthError;
    } catch (err: any) {
      setError(err.message ?? "Google sign in failed");
      setGoogleLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
      if (authErr) throw authErr;
      const userId = data.user?.id;
      if (!userId) throw new Error("No user returned");
      const role = await getNiraRole(userId);
      const dest = roleHome(role);
      await navigate({ to: `/${dest}` });
    } catch (err: any) {
      setError(err.message ?? "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="nira-drift absolute -left-32 -top-40 size-[520px] rounded-full bg-brand/8 blur-3xl" />
        <div className="nira-drift-reverse absolute right-0 top-24 size-[600px] rounded-full bg-sage/12 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="overflow-hidden rounded-2xl bg-[#F7F8F5] p-2 shadow-lg shadow-brand/10 ring-1 ring-brand/15">
            <img
              src="/nira-logo.png"
              alt="NIRA"
              className="h-24 w-24 object-contain"
            />
          </div>
        </div>

        <div className="rounded-[26px] border border-line bg-white/80 p-7 shadow-soft backdrop-blur-xl">
          <h1 className="text-xl font-extrabold tracking-tight text-ink">Welcome back</h1>
          <p className="mt-1 text-xs text-muted-ink">Sign in to your NIRA space</p>

          {error && (
            <div className="mt-4 rounded-xl bg-priority/10 px-4 py-3 text-xs text-priority">
              {error}
            </div>
          )}

          {/* Google Sign-in */}
          <button
            type="button"
            id="google-sign-in"
            onClick={handleGoogleSignIn}
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

          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-ink">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-line bg-background px-4 py-3 text-sm text-ink outline-none ring-0 transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-ink">
                Password
              </label>
              <div className="relative mt-1.5">
                <input
                  id="password"
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-line bg-background px-4 py-3 pr-10 text-sm text-ink outline-none ring-0 transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                  placeholder="••••••••"
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

            <button
              id="sign-in-submit"
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-brand py-3 text-sm font-bold text-white shadow-lg shadow-brand/20 transition hover:bg-brand/90 disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <div className="mt-4 flex items-center gap-1.5 text-center justify-center">
            <SoftBadge tone="brand" icon={<ShieldCheck className="size-3" />}>
              Consent first · Encrypted
            </SoftBadge>
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-muted-ink">
          New to NIRA?{" "}
          <Link to="/sign-up" className="font-semibold text-brand underline underline-offset-2">
            Create your space
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-muted-ink">
          <Link to="/demo" className="font-semibold text-muted-ink underline underline-offset-2">
            Explore demo (no account needed)
          </Link>
        </p>
      </div>
    </div>
  );
}
