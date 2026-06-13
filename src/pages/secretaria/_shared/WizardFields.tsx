import { ReactNode } from "react";

/**
 * ITEM-125 — Primitivas de formulario compartidas por los steppers de Secretaría.
 *
 * Antes vivían copiadas byte a byte como `Input`/`Field`/`Checkbox` locales en
 * AnadirSocioStepper, TransmisionStepper, DesignarAdminStepper y PersonaNuevaStepper.
 * Se consolidan aquí para eliminar la duplicación estructural sin cambiar el
 * marcado ni el comportamiento (mismas clases Garrigues `var(--g-*)`).
 */

export function WizardInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
        {label}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] outline-none focus:border-[var(--g-brand-3308)] focus:ring-2 focus:ring-[var(--g-brand-3308)]/20"
        style={{ borderRadius: "var(--g-radius-md)" }}
      />
    </label>
  );
}

export function WizardCheckbox({
  label,
  value,
  onChange,
  help,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  help?: string;
}) {
  return (
    <label className="flex items-start gap-2">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-[var(--g-brand-3308)]"
      />
      <div>
        <div className="text-sm text-[var(--g-text-primary)]">{label}</div>
        {help ? <div className="text-xs text-[var(--g-text-secondary)]">{help}</div> : null}
      </div>
    </label>
  );
}

export function WizardField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">{label}</dt>
      <dd className="text-sm text-[var(--g-text-primary)]">{value}</dd>
    </div>
  );
}
