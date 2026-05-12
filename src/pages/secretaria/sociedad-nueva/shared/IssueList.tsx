import { AlertCircle } from "lucide-react";
import type { ValidationIssue } from "@/lib/secretaria/sociedad-onboarding/types";

const SEVERITY_CLASS: Record<ValidationIssue["severity"], string> = {
  BLOCK: "border-[var(--status-error)] bg-[var(--g-surface-card)] text-[var(--status-error)]",
  BLOCK_OPERATIONAL: "border-[var(--status-warning)] bg-[var(--g-surface-card)] text-[var(--status-warning)]",
  WARN: "border-[var(--status-info)] bg-[var(--g-surface-card)] text-[var(--status-info)]",
};

export function IssueList({ issues = [] }: { issues?: ValidationIssue[] }) {
  if (issues.length === 0) return null;

  return (
    <div className="space-y-2">
      {issues.map((issue) => (
        <div
          key={`${issue.code}-${issue.field}`}
          className={`flex items-start gap-2 border px-3 py-2 text-sm ${SEVERITY_CLASS[issue.severity]}`}
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-semibold">{issue.code}</div>
            <div className="text-[var(--g-text-secondary)]">{issue.message}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
