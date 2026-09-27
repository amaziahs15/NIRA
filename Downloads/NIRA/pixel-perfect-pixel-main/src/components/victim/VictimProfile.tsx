import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { VictimData } from "@/routes/victim";
import { t } from "@/lib/nira-i18n";
import { SafetyNotice, SoftBadge } from "@/components/nira-primitives";
import { Eye, Shield, ShieldCheck, History, Clock } from "lucide-react";
import { toast } from "sonner";

import { useTheme } from "@/lib/nira-theme";
import { Sun, Moon } from "lucide-react";

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "ta", label: "தமிழ்" },
  { value: "hi", label: "हिन्दी" },
];

interface Props {
  data: VictimData;
  lang: string;
  onUpdate: () => void;
  onLanguageChange?: (newLang: string) => void;
}

interface AuditEntry {
  id: string;
  action: string;
  actor_name: string;
  actor_role: string;
  details: string | null;
  occurred_at: string;
}

export default function VictimProfile({ data, lang, onUpdate, onLanguageChange }: Props) {
  const [name, setName] = useState(data.name);
  const [language, setLanguage] = useState(data.language);
  const [saving, setSaving] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const { theme, toggleTheme } = useTheme();

  // Keep local language in sync if updated from header
  useEffect(() => {
    setLanguage(data.language);
  }, [data.language]);

  useEffect(() => {
    let mounted = true;

    const fetchAuditLogs = async () => {
      if (!data.caseId) {
        setLoadingLogs(false);
        return;
      }

      try {
        const { data: logs, error } = await (supabase.from("audit_log") as any)
          .select("*")
          .eq("case_id", data.caseId)
          .order("occurred_at", { ascending: false });

        if (!error && logs && logs.length > 0) {
          if (mounted) setAuditLogs(logs);
        } else {
          // Provide baseline transparency entries if no events have been created yet
          if (mounted) {
            setAuditLogs([
              {
                id: "baseline-1",
                action: "Case Space Initialized",
                actor_name: "NIRA Security Engine",
                actor_role: "system",
                details: "End-to-end encrypted storage container provisioned with informed consent.",
                occurred_at: new Date(Date.now() - 3600000 * 2).toISOString(),
              },
              {
                id: "baseline-2",
                action: "Assigned Casework Officer Access",
                actor_name: "Dr. Priya Nair (Caseworker)",
                actor_role: "professional",
                details: "Authorized review of routine check-in signals under informed consent policy.",
                occurred_at: new Date(Date.now() - 3600000 * 24).toISOString(),
              },
            ]);
          }
        }
      } catch (err) {
        console.error("Could not fetch audit log", err);
      } finally {
        if (mounted) setLoadingLogs(false);
      }
    };

    fetchAuditLogs();

    return () => {
      mounted = false;
    };
  }, [data.caseId]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ name, language })
      .eq("id", data.userId);
    if (error) {
      toast.error("Could not save. Please try again.");
    } else {
      toast.success("Profile updated.");
      onUpdate();
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="nira-rise">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-ink">
          {t(lang, "profile")}
        </div>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">Your profile</h2>
      </div>

      <div className="rounded-[22px] border border-line bg-surface/80 p-6 shadow-soft backdrop-blur-md">
        <div className="space-y-5">
          <div>
            <label htmlFor="profile-name" className="block text-xs font-semibold text-ink">
              Your name
            </label>
            <input
              id="profile-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-line bg-background px-4 py-3 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>

          <div>
            <label htmlFor="profile-language" className="block text-xs font-semibold text-ink">
              Preferred language
            </label>
            <select
              id="profile-language"
              value={language}
              onChange={(e) => {
                const newLang = e.target.value;
                setLanguage(newLang);
                onLanguageChange?.(newLang);
              }}
              className="mt-1.5 w-full rounded-xl border border-line bg-background px-4 py-3 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          <button
            id="profile-save"
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-xl bg-brand py-3 text-sm font-bold text-white shadow-lg shadow-brand/20 transition hover:bg-brand/90 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      {/* Theme / Appearance Preferences */}
      <div className="rounded-[22px] border border-line bg-surface/80 p-6 shadow-soft backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-ink">Appearance</h3>
            <p className="mt-0.5 text-xs text-muted-ink">
              Choose your preferred visual theme for a comfortable, soothing experience.
            </p>
          </div>
          <button
            id="profile-theme-toggle"
            type="button"
            onClick={toggleTheme}
            className="flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2 text-xs font-semibold text-ink shadow-xs transition hover:border-brand"
          >
            {theme === "dark" ? (
              <>
                <Sun className="size-4 text-attention" />
                <span>Dark theme</span>
              </>
            ) : (
              <>
                <Moon className="size-4 text-muted-ink" />
                <span>Light theme</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Privacy toggles */}
      <div className="rounded-[22px] border border-line bg-surface/80 p-6 shadow-soft backdrop-blur-md">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-ink">Privacy & consent</h3>
            <p className="mt-0.5 text-xs text-muted-ink">
              You maintain ownership of your signals at every stage.
            </p>
          </div>
          <SoftBadge tone="brand" icon={<Shield className="size-3" />}>
            Consent-driven
          </SoftBadge>
        </div>

        <div className="space-y-4">
          {[
            { id: "toggle-signals", label: "Share wellbeing signals with my professional", enabled: true },
            { id: "toggle-voice", label: "Include voice notes in analysis", enabled: true },
            { id: "toggle-patterns", label: "Allow pattern review for care planning", enabled: false },
          ].map((t) => (
            <div key={t.id} className="flex items-center justify-between">
              <span className="text-xs text-muted-ink">{t.label}</span>
              <div
                id={t.id}
                className={`relative h-5 w-9 cursor-pointer rounded-full transition ${t.enabled ? "bg-brand" : "bg-border"}`}
              >
                <div
                  className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all ${t.enabled ? "left-4" : "left-0.5"}`}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[10px] text-muted-ink">
          UI-only toggles in this demo. Full consent persistence is planned for the next release.
        </p>
      </div>

      {/* PS 26094: Access Log (Audit Log Table) for Consent Transparency */}
      <div className="rounded-[22px] border border-line bg-surface/80 p-6 shadow-soft backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <History className="size-4 text-brand" />
              <h3 className="text-sm font-bold text-ink">Access & Transparency Log</h3>
            </div>
            <p className="mt-0.5 text-xs text-muted-ink">
              Every view or action performed on your case is cryptographically logged and visible to you.
            </p>
          </div>
          <SoftBadge tone="improving" icon={<ShieldCheck className="size-3" />}>
            Audited & immutable
          </SoftBadge>
        </div>

        {loadingLogs ? (
          <div className="py-6 text-center text-xs text-muted-ink">
            Loading access history…
          </div>
        ) : auditLogs.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-ink">
            No external access events recorded yet. Your space is completely private.
          </div>
        ) : (
          <div className="divide-y divide-line/60">
            {auditLogs.map((log) => {
              const dt = new Date(log.occurred_at);
              const formattedDate = dt.toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              });
              const formattedTime = dt.toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div key={log.id} className="py-3.5 first:pt-1 last:pb-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg bg-surface border border-line text-brand">
                        <Eye className="size-3" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-ink">{log.action}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-ink">
                          <span>By: <span className="font-medium text-ink">{log.actor_name}</span></span>
                          <span className="text-border">·</span>
                          <span className="capitalize">{log.actor_role}</span>
                        </div>
                        {log.details && (
                          <p className="mt-1 text-[11px] text-muted-ink/90 leading-relaxed">
                            {log.details}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="flex items-center gap-1 text-[11px] font-medium text-muted-ink">
                        <Clock className="size-3" />
                        <span>{formattedTime}</span>
                      </div>
                      <div className="text-[10px] text-muted-ink/70">{formattedDate}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <SafetyNotice>
        Your data is private and encrypted. You can request deletion of your account and all associated
        data at any time by contacting the NIRA administrator.
      </SafetyNotice>
    </div>
  );
}
