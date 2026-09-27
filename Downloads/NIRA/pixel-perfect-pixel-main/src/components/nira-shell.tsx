import { useEffect, useState } from "react";
import { BarChart3, ClipboardList, FileHeart, HeartHandshake, Home, LogOut, Menu, Moon, ShieldCheck, Sun, UserRound, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { NiraMark, SoftBadge } from "@/components/nira-primitives";
import { cn } from "@/lib/utils";
import type { NiraRole, WorkspaceView } from "@/lib/nira-types";
import { t } from "@/lib/nira-i18n";
import { useTheme } from "@/lib/nira-theme";

const SITE_LANGUAGES = [
  { code: "en", label: "EN" },
  { code: "ta", label: "தமிழ்" },
  { code: "hi", label: "हिन्दी" },
];

export function NiraShell({
  role,
  name,
  view,
  onView,
  lang = "en",
  onLanguageChange,
  children,
}: {
  role: NiraRole;
  name: string;
  view: WorkspaceView;
  onView: (view: WorkspaceView) => void;
  lang?: string;
  onLanguageChange?: (newLang: string) => void;
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  // Nav items for victim — labels come from i18n
  const victimNav: { key: WorkspaceView; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "home", label: t(lang, "home"), icon: Home },
    { key: "case", label: t(lang, "my_case"), icon: FileHeart },
    { key: "checkin", label: t(lang, "check_in"), icon: ClipboardList },
    { key: "support", label: t(lang, "support"), icon: HeartHandshake },
    { key: "profile", label: t(lang, "profile"), icon: UserRound },
  ];

  const professionalNav: { key: WorkspaceView; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "home", label: "Overview", icon: Home },
    { key: "review", label: "Priority review", icon: ClipboardList },
    ...(role === "admin" ? [{ key: "aggregate" as WorkspaceView, label: "Aggregate view", icon: BarChart3 }] : []),
    { key: "profile", label: "Profile", icon: UserRound },
  ];

  const nav = role === "victim" ? victimNav : professionalNav;

  useEffect(() => {
    setMenuOpen(false);
  }, [view]);

  const signOut = async () => {
    await supabase.auth.signOut();
    await navigate({ to: "/" });
  };

  // Header text — victim header uses i18n
  const headerSubtitle =
    role === "victim"
      ? t(lang, "wellbeing_space")
      : role === "professional"
      ? "Support workspace"
      : "Aggregate wellbeing";

  const hour = new Date().getHours();
  const greetKey = hour < 12 ? "greeting" : hour < 17 ? "greeting_afternoon" : "greeting_evening";
  const headerTitle =
    role === "victim"
      ? `${t(lang, greetKey)}, ${name || "there"}`
      : role === "professional"
      ? "A clear view for human review"
      : "A wider view, without individual details";

  return (
    <div className="min-h-screen bg-background text-ink transition-colors duration-200">
      {/* Background blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="nira-drift absolute -left-32 -top-40 size-[520px] rounded-full bg-brand/8 blur-3xl" />
        <div className="nira-drift-reverse absolute right-0 top-24 size-[600px] rounded-full bg-sage/15 blur-3xl" />
      </div>

      <div className="relative z-10 flex min-h-screen">
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 w-64 border-r border-line bg-surface/90 p-5 shadow-soft backdrop-blur-xl transition-transform lg:static lg:translate-x-0",
            menuOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex items-center justify-between">
            <NiraMark compact />
            <button
              aria-label="Close navigation"
              onClick={() => setMenuOpen(false)}
              className="rounded-full p-2 text-muted-ink hover:bg-brand-soft lg:hidden"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="mt-8 rounded-2xl bg-brand-soft/60 p-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-brand">Signed in as</div>
            <div className="mt-1 text-sm font-bold text-ink">{name || "NIRA member"}</div>
            <SoftBadge tone="brand">
              {role === "victim" ? "Victim space" : role === "professional" ? "Support professional" : "Admin view"}
            </SoftBadge>
          </div>

          <nav className="mt-8 space-y-1">
            {nav.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  onClick={() => onView(item.key)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition",
                    view === item.key ? "bg-brand-soft text-brand" : "text-muted-ink hover:bg-background hover:text-ink"
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto pt-8">
            <button
              onClick={signOut}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-muted-ink hover:bg-background hover:text-ink"
            >
              <LogOut className="size-4" />
              Sign out
            </button>
          </div>
        </aside>

        {/* Overlay for mobile menu */}
        {menuOpen && (
          <button
            aria-label="Close navigation overlay"
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-30 bg-ink/10 lg:hidden"
          />
        )}

        <main className="min-w-0 flex-1">
          {/* Header */}
          <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-line bg-background/80 px-4 backdrop-blur-xl lg:px-8">
            <div className="flex items-center gap-3">
              <button
                aria-label="Open navigation"
                onClick={() => setMenuOpen(true)}
                className="rounded-full p-2 text-muted-ink hover:bg-brand-soft lg:hidden"
              >
                <Menu className="size-5" />
              </button>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-ink">
                  {headerSubtitle}
                </div>
                <h1 className="mt-1 text-base sm:text-lg font-bold tracking-tight text-ink">{headerTitle}</h1>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {/* Language Switcher in Header */}
              {onLanguageChange && (
                <div
                  id="header-lang-switcher"
                  className="flex items-center rounded-xl border border-line bg-surface/80 p-0.5 shadow-xs"
                >
                  {SITE_LANGUAGES.map((l) => (
                    <button
                      key={l.code}
                      onClick={() => onLanguageChange(l.code)}
                      className={cn(
                        "rounded-lg px-2 py-1 text-xs font-semibold transition",
                        lang === l.code
                          ? "bg-brand text-white shadow-xs"
                          : "text-muted-ink hover:text-ink hover:bg-background/60"
                      )}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Theme Toggle Button */}
              <button
                id="theme-toggle-btn"
                type="button"
                onClick={toggleTheme}
                aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                className="grid size-9 place-items-center rounded-xl border border-line bg-surface/80 text-muted-ink hover:text-ink hover:bg-surface transition shadow-xs"
              >
                {theme === "dark" ? (
                  <Sun className="size-4 text-attention" />
                ) : (
                  <Moon className="size-4" />
                )}
              </button>

              <div className="hidden items-center gap-3 sm:flex">
                <SoftBadge tone="brand" icon={<ShieldCheck className="size-3" />}>
                  Consent first
                </SoftBadge>
                <button
                  onClick={signOut}
                  className="rounded-full border border-line bg-surface/70 p-2.5 text-muted-ink hover:bg-surface"
                  aria-label="Sign out"
                >
                  <LogOut className="size-4" />
                </button>
              </div>
            </div>
          </header>

          {/* Page content */}
          <div className="mx-auto max-w-6xl p-5 pb-28 lg:p-10 lg:pb-10">{children}</div>

          {/* Bottom nav for victim (mobile) */}
          {role === "victim" && (
            <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-surface/90 px-2 py-2 shadow-soft backdrop-blur-xl lg:hidden">
              {victimNav.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    onClick={() => onView(item.key)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-semibold",
                      view === item.key ? "text-brand" : "text-muted-ink"
                    )}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          )}
        </main>
      </div>
    </div>
  );
}
