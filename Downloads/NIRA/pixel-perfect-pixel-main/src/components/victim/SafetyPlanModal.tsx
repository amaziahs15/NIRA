import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { SoftBadge } from "@/components/nira-primitives";
import { toast } from "sonner";
import { AlertCircle, HeartHandshake, MapPin, Phone, Plus, ShieldCheck, Trash2, UserPlus } from "lucide-react";

interface TrustedContact {
  name: string;
  phone: string;
  relation: string;
}

interface SafePlace {
  location: string;
  notes: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  victimId: string;
}

export function SafetyPlanModal({ open, onOpenChange, victimId }: Props) {
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [places, setPlaces] = useState<SafePlace[]>([]);
  const [signs, setSigns] = useState<string[]>([]);
  const [coping, setCoping] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // New item inputs
  const [newContact, setNewContact] = useState<TrustedContact>({ name: "", phone: "", relation: "" });
  const [newPlace, setNewPlace] = useState<SafePlace>({ location: "", notes: "" });
  const [newSign, setNewSign] = useState("");
  const [newCoping, setNewCoping] = useState("");

  useEffect(() => {
    if (!open) return;

    async function loadPlan() {
      setLoading(true);
      try {
        if (victimId) {
          const { data, error } = await supabase
            .from("safety_plans" as any)
            .select("*")
            .eq("victim_id", victimId)
            .maybeSingle();

          if (!error && data) {
            setContacts((data as any).trusted_contacts ?? []);
            setPlaces((data as any).safe_places ?? []);
            setSigns((data as any).warning_signs ?? []);
            setCoping((data as any).coping_strategies ?? []);
            setLoading(false);
            return;
          }
        }
      } catch {
        // ignore
      }

      // Local storage fallback for privacy or offline
      try {
        const local = localStorage.getItem(`nira_safety_plan_${victimId}`);
        if (local) {
          const parsed = JSON.parse(local);
          setContacts(parsed.contacts ?? []);
          setPlaces(parsed.places ?? []);
          setSigns(parsed.signs ?? []);
          setCoping(parsed.coping ?? []);
        }
      } catch {
        // ignore
      }
      setLoading(false);
    }

    loadPlan();
  }, [open, victimId]);

  const handleSave = async () => {
    setSaving(true);
    const planPayload = {
      victim_id: victimId,
      trusted_contacts: contacts,
      safe_places: places,
      warning_signs: signs,
      coping_strategies: coping,
      updated_at: new Date().toISOString(),
    };

    try {
      if (victimId) {
        await supabase
          .from("safety_plans" as any)
          .upsert(planPayload, { onConflict: "victim_id" });
      }
      try {
        localStorage.setItem(`nira_safety_plan_${victimId}`, JSON.stringify({ contacts, places, signs, coping }));
      } catch {
        // ignore
      }
      toast.success("Safety plan updated safely.");
      onOpenChange(false);
    } catch {
      toast.error("Could not sync to cloud, but saved locally on your device.");
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const addContact = () => {
    if (!newContact.name.trim()) return;
    setContacts((prev) => [...prev, newContact]);
    setNewContact({ name: "", phone: "", relation: "" });
  };

  const addPlace = () => {
    if (!newPlace.location.trim()) return;
    setPlaces((prev) => [...prev, newPlace]);
    setNewPlace({ location: "", notes: "" });
  };

  const addSign = () => {
    if (!newSign.trim()) return;
    setSigns((prev) => [...prev, newSign.trim()]);
    setNewSign("");
  };

  const addCoping = () => {
    if (!newCoping.trim()) return;
    setCoping((prev) => [...prev, newCoping.trim()]);
    setNewCoping("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto rounded-[26px] border border-border bg-surface p-6 shadow-2xl backdrop-blur-xl sm:p-8">
        <DialogHeader className="pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-extrabold tracking-tight text-text-primary">
              Personal Safety Plan
            </DialogTitle>
            <SoftBadge tone="brand" icon={<ShieldCheck className="size-3" />}>
              Confidential
            </SoftBadge>
          </div>
          <p className="mt-1 text-xs text-text-secondary leading-relaxed">
            A private guide to help keep you safe, prepared, and connected whenever situations feel uncertain.
          </p>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-6 pt-4">
            {/* 1. Trusted Contacts */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-2">
                  <UserPlus className="size-3.5 text-primary" />
                  1. Trusted Contacts
                </span>
                <span className="text-[11px] text-text-muted">People who support you unconditionally</span>
              </div>

              <div className="space-y-2">
                {contacts.map((c, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl border border-border bg-surface-elevated p-3 text-xs">
                    <div>
                      <div className="font-bold text-text-primary">{c.name} ({c.relation})</div>
                      <div className="text-text-muted mt-0.5">{c.phone}</div>
                    </div>
                    <button
                      onClick={() => setContacts((prev) => prev.filter((_, idx) => idx !== i))}
                      className="rounded-lg p-1.5 text-text-muted hover:text-danger hover:bg-danger/10"
                      aria-label="Remove contact"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Name"
                    value={newContact.name}
                    onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                    className="rounded-xl border border-border bg-surface-elevated px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Phone"
                    value={newContact.phone}
                    onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                    className="rounded-xl border border-border bg-surface-elevated px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Relation"
                      value={newContact.relation}
                      onChange={(e) => setNewContact({ ...newContact, relation: e.target.value })}
                      className="w-full rounded-xl border border-border bg-surface-elevated px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
                    />
                    <button
                      onClick={addContact}
                      className="rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground hover:opacity-90"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Safe Places */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-2">
                  <MapPin className="size-3.5 text-primary" />
                  2. Safe Places
                </span>
                <span className="text-[11px] text-text-muted">Places you can go to feel secure</span>
              </div>

              <div className="space-y-2">
                {places.map((p, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl border border-border bg-surface-elevated p-3 text-xs">
                    <div>
                      <div className="font-bold text-text-primary">{p.location}</div>
                      {p.notes && <div className="text-text-muted mt-0.5">{p.notes}</div>}
                    </div>
                    <button
                      onClick={() => setPlaces((prev) => prev.filter((_, idx) => idx !== i))}
                      className="rounded-lg p-1.5 text-text-muted hover:text-danger hover:bg-danger/10"
                      aria-label="Remove place"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}

                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Location (e.g. Sister's home, Community library)"
                    value={newPlace.location}
                    onChange={(e) => setNewPlace({ ...newPlace, location: e.target.value })}
                    className="flex-1 rounded-xl border border-border bg-surface-elevated px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
                  />
                  <button
                    onClick={addPlace}
                    className="rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:opacity-90"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* 3. Personal Warning Signs */}
            <div className="space-y-3 pt-2">
              <span className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-2">
                <AlertCircle className="size-3.5 text-warning" />
                3. Warning Signs
              </span>

              <div className="flex flex-wrap gap-2">
                {signs.map((s, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-elevated px-3 py-1 text-xs text-text-primary">
                    {s}
                    <button onClick={() => setSigns((prev) => prev.filter((_, idx) => idx !== i))} className="text-text-muted hover:text-danger">
                      ×
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Trouble sleeping, feeling heart racing, sudden dread"
                  value={newSign}
                  onChange={(e) => setNewSign(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addSign()}
                  className="flex-1 rounded-xl border border-border bg-surface-elevated px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
                />
                <button onClick={addSign} className="rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground hover:opacity-90">
                  Add
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-border">
              <button
                onClick={() => onOpenChange(false)}
                className="rounded-full border border-border px-5 py-2.5 text-xs font-semibold text-text-secondary hover:bg-surface-elevated"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-full bg-primary px-6 py-2.5 text-xs font-bold text-primary-foreground shadow-md hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Saving safely..." : "Save Safety Plan"}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
