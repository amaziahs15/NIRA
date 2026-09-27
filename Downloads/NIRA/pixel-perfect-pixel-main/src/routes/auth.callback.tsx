import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getNiraRole, roleHome } from "@/lib/nira-auth";
import { NiraMark, SafetyNotice, SoftBadge } from "@/components/nira-primitives";
import { HeartHandshake, Shield, ShieldCheck, Sparkles, UserCheck } from "lucide-react";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
});

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "ta", label: "தமிழ்" },
  { value: "hi", label: "हिन्दी" },
];

const ROLES = [
  {
    value: "victim" as const,
    label: "I need support",
    description: "Private wellbeing space, continuous check-ins, and case updates",
    badge: "Victim space" as const,
    tone: "brand" as const,
    icon: HeartHandshake,
  },
  {
    value: "professional" as const,
    label: "I provide support",
    description: "Dashboard for reviewing priority cases and recording human decisions",
    badge: "Support professional" as const,
    tone: "improving" as const,
    icon: Shield,
  },
];

function AuthCallbackPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");

  // Setup form states
  const [name, setName] = useState("");
  const [role, setRole] = useState<"victim" | "professional">("victim");
  const [language, setLanguage] = useState("en");

  useEffect(() => {
    let mounted = true;

    // Check pre-selected preferences from localStorage if user clicked Google on sign-up
    if (typeof window !== "undefined") {
      const storedRole = localStorage.getItem("nira_oauth_role") as "victim" | "professional" | null;
      const storedLang = localStorage.getItem("nira_oauth_language");
      if (storedRole && (storedRole === "victim" || storedRole === "professional")) {
        setRole(storedRole);
      }
      if (storedLang) {
        setLanguage(storedLang);
      }
    }

    const checkSessionAndRole = async () => {
      try {
        const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr) throw sessionErr;

        if (!session?.user) {
          // If no immediate session, wait briefly for OAuth hash to parse
          const { data: authListener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
            if (newSession?.user && mounted) {
              await processUser(newSession.user);
            } else if (event === "SIGNED_OUT" && mounted) {
              setChecking(false);
              setError("Sign in was cancelled or session expired.");
            }
          });
          return () => {
            authListener.subscription.unsubscribe();
          };
        } else {
          await processUser(session.user);
        }
      } catch (err: any) {
        if (mounted) {
          setError(err.message ?? "Authentication check failed");
          setChecking(false);
        }
      }
    };

    const processUser = async (user: any) => {
      setUserId(user.id);
      setUserEmail(user.email ?? "");

      const googleName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        (user.email ? user.email.split("@")[0] : "NIRA Member");
      setName(googleName);

      // Check existing role & stored role intent
      const existingRole = await getNiraRole(user.id);
      const storedRole = typeof window !== "undefined" ? (localStorage.getItem("nira_oauth_role") as "victim" | "professional" | null) : null;
      const storedLang = typeof window !== "undefined" ? (localStorage.getItem("nira_oauth_language") ?? "en") : "en";

      if (storedRole && storedRole !== existingRole) {
        // User explicitly picked a role before OAuth — call setup to write it
        await (supabase.rpc as any)("complete_user_setup", {
          user_role: storedRole,
          user_name: googleName,
          user_lang: storedLang,
        });
        localStorage.removeItem("nira_oauth_role");
        localStorage.removeItem("nira_oauth_language");
        const dest = roleHome(storedRole);
        await navigate({ to: `/${dest}` });
        return;
      }

      if (existingRole) {
        // Returning user OR stored role matched what trigger already wrote
        localStorage.removeItem("nira_oauth_role");
        localStorage.removeItem("nira_oauth_language");
        const dest = roleHome(existingRole);
        await navigate({ to: `/${dest}` });
        return;
      }

      // Fresh Google user needing role/space setup (no stored hint, no existing role)
      if (mounted) {
        setChecking(false);
      }
    };

    checkSessionAndRole();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  const handleCompleteSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setError(null);
    setSubmitting(true);

    try {
      // 1. First attempt: call the complete_user_setup RPC
      const { data: rpcData, error: rpcErr } = await (supabase.rpc as any)("complete_user_setup", {
        user_role: role,
        user_name: name.trim() || "NIRA Member",
        user_lang: language,
      });

      if (!rpcErr && rpcData?.success) {
        // Clear local storage hints
        localStorage.removeItem("nira_oauth_role");
        localStorage.removeItem("nira_oauth_language");

        const dest = roleHome(role);
        await navigate({ to: `/${dest}` });
        return;
      }

      // 2. Client-side fallback if RPC hasn't been migrated yet on remote DB
      // Insert/update profile
      await supabase.from("profiles").upsert({
        id: userId,
        name: name.trim() || "NIRA Member",
        language,
      });

      // Insert user_roles
      await supabase.from("user_roles").insert({
        user_id: userId,
        role,
      });

      // If victim, create initial victim record and case
      if (role === "victim") {
        const caseNumber = `NIRA-${Math.floor(1000 + Math.random() * 9000)}`;

        const { data: victimRow, error: victimErr } = await supabase
          .from("victims")
          .insert({ profile_id: userId })
          .select("id")
          .single();

        if (!victimErr && victimRow) {
          const { data: caseRow } = await supabase
            .from("cases")
            .insert({
              victim_id: victimRow.id,
              case_number: caseNumber,
              stage: "Registered",
              status_text: "Consent registered. Supportive monitoring active.",
              district: "Chennai",
            })
            .select("id")
            .single();

          if (caseRow) {
            await supabase
              .from("victims")
              .update({ case_id: caseRow.id })
              .eq("id", victimRow.id);

            await supabase.from("case_events").insert({
              case_id: caseRow.id,
              event_type: "case_registered",
              description: "Case space created with consent via Google OAuth.",
            });

            // Initial audit log
            await (supabase.from("audit_log") as any).insert({
              case_id: caseRow.id,
              actor_id: userId,
              actor_name: name.trim() || "NIRA Member",
              actor_role: "victim",
              action: "Case Space Created",
              details: "Encrypted case profile and consent initialized via Google OAuth.",
            });
          }
        }
      }

      // Clear local storage hints
      localStorage.removeItem("nira_oauth_role");
      localStorage.removeItem("nira_oauth_language");

      const dest = roleHome(role);
      await navigate({ to: `/${dest}` });
    } catch (err: any) {
      setError(err.message ?? "Setup failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <div className="text-center">
          <div className="inline-block size-9 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          <p className="mt-4 text-sm font-semibold text-ink">Connecting your NIRA space…</p>
          <p className="mt-1 text-xs text-muted-ink">Verifying secure Google credentials</p>
        </div>
      </div>
    );
  }

  if (error && !userId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm rounded-[26px] border border-line bg-white/80 p-7 text-center shadow-soft backdrop-blur-xl">
          <NiraMark />
          <h2 className="mt-4 text-lg font-bold text-ink">Authentication Error</h2>
          <p className="mt-2 text-xs text-priority">{error}</p>
          <button
            onClick={() => navigate({ to: "/sign-in" })}
            className="mt-6 w-full rounded-xl bg-brand py-3 text-sm font-bold text-white shadow-lg shadow-brand/20 transition hover:bg-brand/90"
          >
            Return to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="nira-drift absolute -left-32 -top-40 size-[520px] rounded-full bg-brand/8 blur-3xl" />
        <div className="nira-drift-reverse absolute right-0 top-24 size-[600px] rounded-full bg-sage/12 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <NiraMark />
        </div>

        <div className="rounded-[26px] border border-line bg-white/85 p-7 shadow-soft backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand">
              One Last Step
            </span>
            <SoftBadge tone="brand" icon={<UserCheck className="size-3" />}>
              Google connected
            </SoftBadge>
          </div>

          <h1 className="mt-2 text-xl font-extrabold tracking-tight text-ink">
            Complete your space setup
          </h1>
          <p className="mt-1 text-xs text-muted-ink">
            Logged in as <span className="font-semibold text-ink">{userEmail}</span>. Choose how you will use NIRA.
          </p>

          {error && (
            <div className="mt-4 rounded-xl bg-priority/10 px-4 py-3 text-xs text-priority">
              {error}
            </div>
          )}

          <form onSubmit={handleCompleteSetup} className="mt-6 space-y-5">
            {/* Preferred Name */}
            <div>
              <label htmlFor="user-name" className="block text-xs font-semibold text-ink">
                Your preferred name
              </label>
              <input
                id="user-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-line bg-background px-4 py-3 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                placeholder="How should NIRA address you?"
              />
            </div>

            {/* Role picker */}
            <div>
              <label className="block text-xs font-semibold text-ink">I am using NIRA to…</label>
              <div className="mt-2 grid grid-cols-1 gap-2.5">
                {ROLES.map((r) => {
                  const Icon = r.icon;
                  const isSelected = role === r.value;
                  return (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setRole(r.value)}
                      className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${
                        isSelected
                          ? "border-brand bg-brand-soft/50 ring-2 ring-brand/20"
                          : "border-line bg-background/50 hover:bg-background"
                      }`}
                    >
                      <div
                        className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl ${
                          isSelected ? "bg-brand text-white" : "bg-white text-muted-ink border border-line"
                        }`}
                      >
                        <Icon className="size-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-ink">{r.label}</span>
                          <SoftBadge tone={r.tone}>{r.badge}</SoftBadge>
                        </div>
                        <p className="mt-1 text-[11px] leading-relaxed text-muted-ink">
                          {r.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Language Selection */}
            <div>
              <label htmlFor="user-language" className="block text-xs font-semibold text-ink">
                Preferred language
              </label>
              <select
                id="user-language"
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
              Your space is encrypted. Decisions and care plans are always led by human professionals,
              with complete audit transparency.
            </SafetyNotice>

            <button
              id="complete-setup-submit"
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-brand py-3 text-sm font-bold text-white shadow-lg shadow-brand/20 transition hover:bg-brand/90 disabled:opacity-60"
            >
              {submitting ? "Configuring your space…" : "Enter NIRA"}
            </button>
          </form>

          <div className="mt-4 flex justify-center">
            <SoftBadge tone="brand" icon={<ShieldCheck className="size-3" />}>
              Consent first · Encrypted · SIH 26094
            </SoftBadge>
          </div>
        </div>
      </div>
    </div>
  );
}
