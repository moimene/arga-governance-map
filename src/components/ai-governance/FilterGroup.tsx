import { cn } from "@/lib/utils";

/**
 * Grupo de filtros de las listas del módulo (sistemas, evaluaciones,
 * incidentes). Estaba copiado idéntico en las tres páginas; las opciones
 * vienen de `opcionesFiltro(...)` del vocabulario único.
 */
const FILTER_BUTTON =
  "px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--g-surface-page)]";

export interface FilterGroupProps {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}

export default function FilterGroup({ label, options, value, onChange }: FilterGroupProps) {
  return (
    <div className="min-w-0">
      <p className="mb-2 text-xs font-medium text-[var(--g-text-secondary)]">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={cn(
              FILTER_BUTTON,
              value === option.value
                ? "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]"
                : "border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] text-[var(--g-text-secondary)] hover:bg-[var(--g-surface-subtle)]",
            )}
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
