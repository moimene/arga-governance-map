import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface WorkflowStep {
  label: string;
}

interface WorkflowStepperProps {
  steps: WorkflowStep[];
  current: number; // 1-indexed; steps < current are completed, == current is active
  caption?: string;
}

export function WorkflowStepper({ steps, current, caption }: WorkflowStepperProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-start gap-1 overflow-x-auto pb-1">
        {steps.map((s, i) => {
          const idx = i + 1;
          const completed = idx < current;
          const active = idx === current;
          const pending = idx > current;
          return (
            <div key={i} className="flex min-w-0 flex-1 items-start gap-1">
              <div className="flex flex-1 flex-col items-center gap-2">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold",
                    completed && "border-status-active bg-status-active text-white",
                    active && "border-status-pending bg-status-pending-bg text-status-pending pulse-ring",
                    pending && "border-border bg-muted text-muted-foreground",
                  )}
                >
                  {completed ? <Check className="h-4 w-4" /> : idx}
                </div>
                <div
                  className={cn(
                    "text-center text-[11px] font-medium leading-tight",
                    completed && "text-foreground",
                    active && "text-status-pending",
                    pending && "text-muted-foreground",
                  )}
                >
                  {s.label}
                </div>
              </div>
              {i < steps.length - 1 && (
                <div className={cn("mt-3.5 h-0.5 flex-1", completed ? "bg-status-active" : "bg-border")} />
              )}
            </div>
          );
        })}
      </div>
      {caption && (
        <div className="mt-4 rounded-md border border-status-pending/20 bg-status-pending-bg px-3 py-2 text-sm text-status-pending">
          {caption}
        </div>
      )}
    </div>
  );
}
