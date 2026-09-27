import { t } from "@/lib/nira-i18n";
import { SoftBadge } from "@/components/nira-primitives";
import { ExternalLink, HeartHandshake, MessageCircle, Phone, ShieldCheck, LifeBuoy } from "lucide-react";
import { toast } from "sonner";

// Real National Helplines (Official Govt of India & Statutory bodies)
const NATIONAL_HELPLINES = [
  {
    title: "Women Helpline (All India)",
    organization: "Ministry of Women & Child Development",
    type: "Emergency 24x7",
    description: "Toll-free 24/7 emergency response and crisis intervention for women facing violence or distress.",
    phone: "181",
    tone: "priority" as const,
    badge: "Official 24x7",
  },
  {
    title: "Childline India",
    organization: "Ministry of Women & Child Development",
    type: "Emergency 24x7",
    description: "24-hour national emergency phone outreach service for children and youth in distress.",
    phone: "1098",
    tone: "priority" as const,
    badge: "Toll-Free 24x7",
  },
  {
    title: "National Commission for Women (NCW)",
    organization: "Statutory Body, Govt of India",
    type: "Legal & Crisis Support",
    description: "Dedicated 24/7 helpline for women affected by violence, atrocities, and legal distress.",
    phone: "7827170170",
    url: "https://ncw.nic.in",
    tone: "attention" as const,
    badge: "Statutory Support",
  },
  {
    title: "KIRAN Mental Health Helpline",
    organization: "DEPwD, Ministry of Social Justice & Empowerment",
    type: "Psychosocial Support",
    description: "24/7 toll-free mental health helpline providing early screening, first-aid, psychological support, and distress management.",
    phone: "1800-599-0019",
    tone: "brand" as const,
    badge: "Toll-Free Govt",
  },
  {
    title: "Tele-MANAS",
    organization: "Ministry of Health & Family Welfare",
    type: "Tele-Mental Health",
    description: "24x7 national tele-mental health programme offering comprehensive, confidential psychological assistance in multiple Indian languages.",
    phone: "14416",
    tone: "improving" as const,
    badge: "24x7 Multilingual",
  },
];

// Specialised Counselling & Support Partners
const COMMUNITY_RESOURCES = [
  {
    title: "iCall — Psychological Helpline",
    organization: "Tata Institute of Social Sciences (TISS)",
    type: "Counselling",
    description: "Free mental health counselling by trained psychologists via telephone and email.",
    phone: "9152987821",
    url: "https://icallhelpline.org",
    tone: "brand" as const,
    icon: Phone,
  },
  {
    title: "SNEHI — Emotional Support",
    organization: "Mental Health NGO",
    type: "Crisis Support",
    description: "Empathetic listening and emotional first-aid for acute psychological distress.",
    phone: "044-24640050",
    url: "https://snehi.org",
    tone: "improving" as const,
    icon: HeartHandshake,
  },
];

interface Props {
  lang: string;
  victimId: string;
}

export default function VictimSupport({ lang }: Props) {
  const handleDemoMessage = (title: string) => {
    toast.info(`Request sent to ${title} (Demo workflow). In production, an encrypted intake referral is created with your consent.`);
  };

  return (
    <div className="space-y-6">
      <div className="nira-rise">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-ink">
          {t(lang, "support")}
        </div>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">
          Emergency & support resources
        </h2>
        <p className="mt-1 text-xs text-muted-ink">
          Direct helpline access to verified national statutory bodies and crisis centres. All calls are private, confidential, and made directly on your device.
        </p>
      </div>

      {/* 1. National Government Helplines (Direct dial, real numbers) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LifeBuoy className="size-4 text-brand" />
            <h3 className="text-sm font-bold text-ink">National Emergency Helplines</h3>
          </div>
          <SoftBadge tone="improving" icon={<ShieldCheck className="size-3" />}>
            Verified 24x7 Services
          </SoftBadge>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {NATIONAL_HELPLINES.map((h) => (
            <div
              key={h.title}
              className="flex flex-col justify-between rounded-[20px] border border-line bg-surface/80 p-4 shadow-soft backdrop-blur-md transition hover:border-brand/30"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-ink">{h.title}</h4>
                    <p className="text-[10px] text-muted-ink">{h.organization}</p>
                  </div>
                  <SoftBadge tone={h.tone}>{h.badge}</SoftBadge>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-muted-ink">
                  {h.description}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between gap-2 border-t border-line/60 pt-3">
                <a
                  href={`tel:${h.phone.replace(/[^0-9]/g, "")}`}
                  id={`support-national-${h.phone}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-brand/90"
                >
                  <Phone className="size-3" /> Call {h.phone}
                </a>
                {h.url && (
                  <a
                    href={h.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-ink transition hover:text-brand"
                  >
                    <span>Official portal</span>
                    <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Specialized Counselling & Partner Networks */}
      <div className="space-y-3 pt-2">
        <h3 className="text-sm font-bold text-ink">Specialised Counselling Partners</h3>
        <div className="space-y-3">
          {COMMUNITY_RESOURCES.map((r) => {
            const Icon = r.icon;
            return (
              <div
                key={r.title}
                className="rounded-[22px] border border-line bg-surface/80 p-5 shadow-soft backdrop-blur-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl"
                      style={{
                        background: `color-mix(in oklch, var(--${r.tone === "brand" ? "primary" : "improving"}) 12%, transparent)`,
                      }}
                    >
                      <Icon
                        className="size-4"
                        style={{
                          color: `var(--${r.tone === "brand" ? "primary" : "improving"})`,
                        }}
                      />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-ink">{r.title}</div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <SoftBadge tone={r.tone}>{r.type}</SoftBadge>
                        <span className="text-[10px] text-muted-ink">{r.organization}</span>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-muted-ink">{r.description}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <a
                    href={`tel:${r.phone}`}
                    id={`support-call-${r.phone}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-4 py-2 text-xs font-bold text-brand transition hover:bg-brand/10"
                  >
                    <Phone className="size-3" /> {r.phone}
                  </a>
                  {r.url && (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      id={`support-web-${r.title.replace(/\s+/g, "-")}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-4 py-2 text-xs font-semibold text-muted-ink transition hover:text-ink"
                    >
                      <ExternalLink className="size-3" /> Visit website
                    </a>
                  )}
                  <button
                    id={`support-msg-${r.phone}`}
                    onClick={() => handleDemoMessage(r.title)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-muted-ink/30 px-4 py-2 text-xs text-muted-ink hover:border-brand hover:text-brand transition"
                  >
                    <MessageCircle className="size-3" /> Request callback
                    <span className="text-[10px] text-muted-ink/80">(demo workflow)</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Safety Notice */}
      <div className="rounded-[20px] border border-dashed border-line bg-surface/50 p-4 text-xs text-muted-ink">
        <span className="font-semibold text-ink">Confidentiality Guarantee:</span> Browsing support contacts or clicking helpline numbers is not recorded against your case profile unless you explicitly consent to sharing a referral request.
      </div>
    </div>
  );
}
