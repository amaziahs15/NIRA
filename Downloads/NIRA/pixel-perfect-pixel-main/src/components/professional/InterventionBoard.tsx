import { useState } from "react";
import { SoftBadge } from "@/components/nira-primitives";
import { ArrowRight, User } from "lucide-react";
import { toast } from "sonner";

export type InterventionStage = "Recommended" | "Reviewed" | "Assigned" | "In Progress" | "Outcome Recorded";

export interface PipelineItem {
  id: string;
  caseNumber: string;
  initials: string;
  title: string;
  stage: InterventionStage;
  severity: "priority" | "attention" | "improving" | "uncertain";
  assignedTo: string;
  updatedAt: string;
  notesCount: number;
}

const STAGES: { id: InterventionStage; label: string }[] = [
  { id: "Recommended", label: "Recommended" },
  { id: "Reviewed", label: "Reviewed" },
  { id: "Assigned", label: "Assigned" },
  { id: "In Progress", label: "In Progress" },
  { id: "Outcome Recorded", label: "Outcome Recorded" },
];

const INITIAL_PIPELINE: PipelineItem[] = [
  {
    id: "int-1",
    caseNumber: "NIRA-1024",
    initials: "AP",
    title: "Counselling Outreach",
    stage: "In Progress",
    severity: "attention",
    assignedTo: "Dr. A. Verma",
    updatedAt: "2h ago",
    notesCount: 3,
  },
  {
    id: "int-2",
    caseNumber: "NIRA-1021",
    initials: "RK",
    title: "Legal Aid Referral",
    stage: "Assigned",
    severity: "priority",
    assignedTo: "Adv. S. Raman",
    updatedAt: "5h ago",
    notesCount: 2,
  },
  {
    id: "int-3",
    caseNumber: "NIRA-1018",
    initials: "ML",
    title: "Shelter Verification",
    stage: "Reviewed",
    severity: "priority",
    assignedTo: "Casework Team",
    updatedAt: "1d ago",
    notesCount: 4,
  },
  {
    id: "int-4",
    caseNumber: "NIRA-1015",
    initials: "ST",
    title: "Routine Check-in Call",
    stage: "Recommended",
    severity: "uncertain",
    assignedTo: "Pending Assignment",
    updatedAt: "3h ago",
    notesCount: 1,
  },
  {
    id: "int-5",
    caseNumber: "NIRA-1009",
    initials: "VB",
    title: "Wellbeing Stability Review",
    stage: "Outcome Recorded",
    severity: "improving",
    assignedTo: "Dr. A. Verma",
    updatedAt: "3d ago",
    notesCount: 6,
  },
];

interface Props {
  onSelectCase?: (caseId: string) => void;
}

export function InterventionBoard({ onSelectCase }: Props) {
  const [items, setItems] = useState<PipelineItem[]>(INITIAL_PIPELINE);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<InterventionStage | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
    setDraggedItemId(id);
  };

  const handleDragOver = (e: React.DragEvent, stage: InterventionStage) => {
    e.preventDefault();
    setDragOverStage(stage);
  };

  const handleDragLeave = () => {
    setDragOverStage(null);
  };

  const handleDrop = (e: React.DragEvent, targetStage: InterventionStage) => {
    e.preventDefault();
    setDragOverStage(null);
    const itemId = e.dataTransfer.getData("text/plain") || draggedItemId;
    if (!itemId) return;

    setItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          if (item.stage !== targetStage) {
            toast.success(`${item.caseNumber} moved to ${targetStage}`);
          }
          return { ...item, stage: targetStage, updatedAt: "Just now" };
        }
        return item;
      })
    );
    setDraggedItemId(null);
  };

  const advanceStage = (id: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const currentIndex = STAGES.findIndex((s) => s.id === item.stage);
          if (currentIndex < STAGES.length - 1) {
            const nextStage = STAGES[currentIndex + 1].id;
            toast.success(`${item.caseNumber} moved to ${nextStage}`);
            return { ...item, stage: nextStage, updatedAt: "Just now" };
          }
        }
        return item;
      })
    );
  };

  return (
    <div className="rounded-[22px] border border-line bg-white/70 p-5 shadow-soft backdrop-blur-md">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.12em] text-muted-ink">
            Intervention Pipeline Board
          </div>
          <p className="mt-0.5 text-xs text-muted-ink">
            Drag cases between stages or use quick advancement to coordinate supportive interventions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-ink">Total cases: <strong className="text-ink">{items.length}</strong></span>
        </div>
      </div>

      {/* 5-Column Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {STAGES.map((col) => {
          const colItems = items.filter((it) => it.stage === col.id);
          const isOver = dragOverStage === col.id;

          return (
            <div
              key={col.id}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.id)}
              className={`flex flex-col rounded-xl border p-3 transition-colors ${
                isOver
                  ? "border-brand bg-brand-soft/20 shadow-md"
                  : "border-line/70 bg-surface/40"
              }`}
            >
              {/* Column Header */}
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-bold text-ink">{col.label}</span>
                <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-bold text-muted-ink border border-line">
                  {colItems.length}
                </span>
              </div>

              {/* Column Cards */}
              <div className="flex-1 space-y-2.5 min-h-[140px]">
                {colItems.length === 0 ? (
                  <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-line/60 text-[11px] text-muted-ink">
                    Drop items here
                  </div>
                ) : (
                  colItems.map((item) => {
                    const currentIndex = STAGES.findIndex((s) => s.id === item.stage);
                    const canAdvance = currentIndex < STAGES.length - 1;

                    return (
                      <div
                        key={item.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, item.id)}
                        className="group relative cursor-grab rounded-lg border border-line bg-surface p-3 shadow-sm transition hover:border-brand/40 hover:shadow-md active:cursor-grabbing"
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <span
                            className="text-xs font-bold text-ink hover:text-brand transition cursor-pointer"
                            onClick={() => onSelectCase?.(item.caseNumber)}
                          >
                            {item.caseNumber}
                          </span>
                          <SoftBadge tone={item.severity}>
                            {item.severity}
                          </SoftBadge>
                        </div>

                        <div className="mt-1 text-xs font-medium text-ink line-clamp-1">
                          {item.title}
                        </div>

                        <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted-ink border-t border-line/60 pt-2">
                          <div className="flex items-center gap-1">
                            <User className="size-3 text-muted-ink" />
                            <span className="truncate max-w-[85px]">{item.assignedTo}</span>
                          </div>
                          <span className="text-[10px]">{item.updatedAt}</span>
                        </div>

                        {canAdvance && (
                          <div className="mt-2 pt-1 border-t border-line/40 flex justify-end">
                            <button
                              type="button"
                              onClick={() => advanceStage(item.id)}
                              className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand hover:underline"
                              title={`Advance to ${STAGES[currentIndex + 1]?.label}`}
                            >
                              <span>Next step</span>
                              <ArrowRight className="size-2.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
