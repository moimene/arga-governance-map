import { forwardRef, type InputHTMLAttributes } from "react";

interface CheckboxFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "checked" | "type"> {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  help?: string;
}

export const CheckboxField = forwardRef<HTMLInputElement, CheckboxFieldProps>(
  ({ label, checked, onChange, help, id, ...props }, ref) => {
    const inputId = id ?? props.name ?? label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return (
      <label className="flex items-start gap-2" htmlFor={inputId}>
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[var(--g-brand-3308)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]/30"
          {...props}
        />
        <span>
          <span className="block text-sm font-medium text-[var(--g-text-primary)]">{label}</span>
          {help ? <span className="block text-xs text-[var(--g-text-secondary)]">{help}</span> : null}
        </span>
      </label>
    );
  },
);

CheckboxField.displayName = "CheckboxField";
