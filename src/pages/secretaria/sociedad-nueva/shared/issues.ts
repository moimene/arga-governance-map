import type { ValidationIssue } from "@/lib/secretaria/sociedad-onboarding/types";

export function issueForField(issues: ValidationIssue[] | undefined, field: string) {
  return (issues ?? []).find((issue) => issue.field === field || issue.field.startsWith(`${field}.`));
}
