import { forwardRef, type SelectHTMLAttributes } from "react";
import type { ValidationIssue } from "@/lib/secretaria/sociedad-onboarding/types";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  issue?: ValidationIssue;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ label, value, options, onChange, issue, id, ...props }, ref) => {
    const selectId = id ?? props.name ?? label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return (
      <label className="flex flex-col gap-1" htmlFor={selectId}>
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
          {label}
        </span>
        <select
          ref={ref}
          id={selectId}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={issue ? true : undefined}
          aria-describedby={issue ? `${selectId}-error` : undefined}
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] outline-none focus:border-[var(--g-brand-3308)] focus:ring-2 focus:ring-[var(--g-brand-3308)]/20"
          style={{ borderRadius: "var(--g-radius-md)" }}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {issue ? (
          <span id={`${selectId}-error`} className="text-xs font-medium text-[var(--status-error)]">
            {issue.message}
          </span>
        ) : null}
      </label>
    );
  },
);

SelectField.displayName = "SelectField";
