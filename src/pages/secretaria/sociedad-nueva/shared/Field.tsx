import { forwardRef, type InputHTMLAttributes } from "react";
import type { ValidationIssue } from "@/lib/secretaria/sociedad-onboarding/types";

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  label: string;
  value: string;
  onChange: (value: string) => void;
  issue?: ValidationIssue;
  help?: string;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(
  ({ label, value, onChange, issue, help, id, type = "text", ...props }, ref) => {
    const inputId = id ?? props.name ?? label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const describedBy = issue ? `${inputId}-error` : help ? `${inputId}-help` : undefined;

    return (
      <label className="flex flex-col gap-1" htmlFor={inputId}>
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
          {label}
        </span>
        <input
          ref={ref}
          id={inputId}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={issue ? true : undefined}
          aria-describedby={describedBy}
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] outline-none focus:border-[var(--g-brand-3308)] focus:ring-2 focus:ring-[var(--g-brand-3308)]/20"
          style={{ borderRadius: "var(--g-radius-md)" }}
          {...props}
        />
        {help && !issue ? (
          <span id={`${inputId}-help`} className="text-xs text-[var(--g-text-secondary)]">
            {help}
          </span>
        ) : null}
        {issue ? (
          <span id={`${inputId}-error`} className="text-xs font-medium text-[var(--status-error)]">
            {issue.message}
          </span>
        ) : null}
      </label>
    );
  },
);

Field.displayName = "Field";
