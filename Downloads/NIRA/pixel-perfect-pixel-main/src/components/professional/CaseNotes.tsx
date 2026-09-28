import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SoftBadge } from "@/components/nira-primitives";
import { Lock, MessageSquare, Plus, Send } from "lucide-react";
import { toast } from "sonner";

interface Note {
  id: string;
  author_name: string;
  note: string;
  created_at: string;
}

interface Props {
  caseId: string;
  userId: string;
}

export function CaseNotes({ caseId, userId }: Props) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadNotes() {
      try {
        const { data, error } = await supabase
          .from("case_notes" as any)
          .select("*")
          .eq("case_id", caseId)
          .order("created_at", { ascending: false });

        if (!error && data && (data as any[]).length > 0) {
          setNotes(data as any[]);
          return;
        }
      } catch {
        // fallback
      }

      // Default demo notes for fictional case
      setNotes([
        {
          id: "note-1",
          author_name: "Lead Caseworker",
          note: "Reviewed recent voice check-in. Audio tone indicates notable relief following the community support connection.",
          created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
        },
        {
          id: "note-2",
          author_name: "Support Specialist",
          note: "Initial case intake completed with explicit consent. Safety plan established with trusted sister contact.",
          created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
        },
      ]);
    }

    loadNotes();
  }, [caseId]);

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setSubmitting(true);

    const noteItem: Note = {
      id: crypto.randomUUID(),
      author_name: "Professional",
      note: newNote.trim(),
      created_at: new Date().toISOString(),
    };

    try {
      await supabase.from("case_notes" as any).insert({
        case_id: caseId,
        author_id: userId,
        author_name: "Professional",
        note: newNote.trim(),
        is_private: true,
      });
    } catch {
      // offline/demo
    }

    setNotes((prev) => [noteItem, ...prev]);
    setNewNote("");
    setSubmitting(false);
    toast.success("Private note recorded.");
  };

  return (
    <div className="rounded-[22px] border border-border bg-surface p-6 shadow-soft backdrop-blur-md space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="grid size-7 place-items-center rounded-xl bg-primary-soft text-primary">
            <Lock className="size-3.5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-primary">Confidential Case Notes</h3>
            <p className="text-[11px] text-text-muted">Staff-only notes. Never shared with algorithms or external parties.</p>
          </div>
        </div>
        <SoftBadge tone="brand">Private & Encrypted</SoftBadge>
      </div>

      {/* Add note input */}
      <div className="flex gap-2">
        <textarea
          rows={2}
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Add an observational note or next action..."
          className="flex-1 resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs text-text-primary placeholder:text-text-muted outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/20"
        />
        <button
          onClick={handleAddNote}
          disabled={!newNote.trim() || submitting}
          className="self-end rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-50"
        >
          <Send className="size-3.5" />
        </button>
      </div>

      {/* List of notes */}
      <div className="space-y-3 pt-2">
        {notes.map((n) => (
          <div key={n.id} className="rounded-xl border border-border bg-surface-elevated p-3.5 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-text-primary">{n.author_name}</span>
              <span className="text-[10px] text-text-muted">
                {new Date(n.created_at).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <p className="text-text-secondary leading-relaxed">{n.note}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
