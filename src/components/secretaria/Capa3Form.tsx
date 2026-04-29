/**
 * Capa3Form — Dynamic form generated from capa3_editables JSONB
 *
 * Renders editable fields that the Secretario fills in before document
 * generation. Each field has an obligatoriedad level:
 *   - OBLIGATORIO: required, blocks generation
 *   - RECOMENDADO: highlighted but not blocking
 *   - OPCIONAL: optional, dimmed
 *   - OBLIGATORIO_SI_TELEMATICA: required only if telemática is enabled
 *
 * Uses Garrigues design tokens exclusively.
 */

import { useState, useCallback } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Info,
  Minus,
} from "lucide-react";
import { isRequiredCapa3Field } from "@/lib/secretaria/capa3-fields";

export interface Capa3Field {
  campo: string;
  obligatoriedad: string;
  descripcion: string;
}

interface Capa3FormProps {
  fields: Capa3Field[];
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  telematicaEnabled?: boolean;
  readOnly?: boolean;
}

const OBLIGATORIEDAD_CONFIG: Record<
  string,
  {
    label: string;
    icon: React.ElementType;
    borderClass: string;
    labelClass: string;
    bgClass: string;
  }
> = {
  OBLIGATORIO: {
    label: "Obligatorio",
    icon: AlertCircle,
    borderClass: "border-[var(--status-error)]",
    labelClass: "text-[var(--status-error)]",
    bgClass: "bg-[var(--status-error)]/5",
  },
  RECOMENDADO: {
    label: "Recomendado",
    icon: Info,
    borderClass: "border-[var(--g-brand-bright)]",
    labelClass: "text-[var(--g-brand-bright)]",
    bgClass: "bg-[var(--g-sec-100)]",
  },
  OPCIONAL: {
    label: "Opcional",
    icon: Minus,
    borderClass: "border-[var(--g-border-subtle)]",
    labelClass: "text-[var(--g-text-secondary)]",
    bgClass: "bg-[var(--g-surface-card)]",
  },
  OBLIGATORIO_SI_TELEMATICA: {
    label: "Obligatorio si telemática",
    icon: AlertCircle,
    borderClass: "border-[var(--status-warning)]",
    labelClass: "text-[var(--status-warning)]",
    bgClass: "bg-[var(--g-surface-muted)]",
  },
};

function humanizeFieldName(campo: string): string {
  return campo
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function Capa3Form({
  fields,
  values,
  onChange,
  telematicaEnabled = false,
  readOnly = false,
}: Capa3FormProps) {
  const handleChange = useCallback(
    (campo: string, value: string) => {
      onChange({ ...values, [campo]: value });
    },
    [values, onChange]
  );

  const isFieldRequired = (field: Capa3Field): boolean => {
    if (isRequiredCapa3Field(field)) return true;
    if (field.obligatoriedad === "OBLIGATORIO_SI_TELEMATICA" && telematicaEnabled) return true;
    return false;
  };

  const incompleteRequired = fields.filter(
    (f) => isFieldRequired(f) && !values[f.campo]?.trim()
  );

  if (fields.length === 0) {
    return (
      <div
        className="flex items-center gap-2 px-4 py-3 text-sm text-[var(--g-text-secondary)]"
        style={{ borderRadius: "var(--g-radius-md)", background: "var(--g-surface-subtle)" }}
      >
        <CheckCircle2 className="h-4 w-4 text-[var(--status-success)]" />
        Esta plantilla no requiere campos editables.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary banner */}
      {incompleteRequired.length > 0 && !readOnly && (
        <div
          className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--status-error)]"
          style={{
            borderRadius: "var(--g-radius-md)",
            background: "hsl(0 84% 60% / 0.08)",
            border: "1px solid var(--status-error)",
          }}
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {incompleteRequired.length === 1
            ? "1 campo obligatorio pendiente"
            : `${incompleteRequired.length} campos obligatorios pendientes`}
        </div>
      )}

      {/* Fields */}
      {fields.map((field) => {
        const config = OBLIGATORIEDAD_CONFIG[field.obligatoriedad] || OBLIGATORIEDAD_CONFIG.OPCIONAL;
        const Icon = config.icon;
        const required = isFieldRequired(field);
        const isEmpty = !values[field.campo]?.trim();

        return (
          <div key={field.campo} className="space-y-1.5">
            {/* Label row */}
            <div className="flex items-center gap-2">
              <label
                htmlFor={`capa3-${field.campo}`}
                className="text-sm font-medium text-[var(--g-text-primary)]"
              >
                {humanizeFieldName(field.campo)}
              </label>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium ${config.labelClass}`}
                style={{ borderRadius: "var(--g-radius-full)" }}
              >
                <Icon className="h-3 w-3" />
                {config.label}
              </span>
            </div>

            {/* Description */}
            <p className="text-xs text-[var(--g-text-secondary)]">
              {field.descripcion}
            </p>

            {/* Input */}
            {readOnly ? (
              <div
                className={`px-3 py-2 text-sm text-[var(--g-text-primary)] ${config.bgClass}`}
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                {values[field.campo] || (
                  <span className="italic text-[var(--g-text-secondary)]">Sin completar</span>
                )}
              </div>
            ) : (
              <textarea
                id={`capa3-${field.campo}`}
                value={values[field.campo] || ""}
                onChange={(e) => handleChange(field.campo, e.target.value)}
                rows={3}
                aria-required={required}
                aria-invalid={required && isEmpty}
                aria-describedby={`capa3-${field.campo}-desc`}
                className={`w-full px-3 py-2 text-sm text-[var(--g-text-primary)] border ${
                  required && isEmpty
                    ? config.borderClass
                    : "border-[var(--g-border-subtle)]"
                } focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] transition-colors`}
                style={{
                  borderRadius: "var(--g-radius-md)",
                  background: "var(--g-surface-card)",
                }}
                placeholder={`${field.descripcion}...`}
              />
            )}
            <span id={`capa3-${field.campo}-desc`} className="sr-only">
              {field.descripcion}. {config.label}.
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Validate capa3 values against field requirements.
 * Returns a field-to-message map for validation errors.
 */
export function validateCapa3(
  fields: Capa3Field[],
  values: Record<string, string>,
  telematicaEnabled = false
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const required =
      isRequiredCapa3Field(field) ||
      (field.obligatoriedad === "OBLIGATORIO_SI_TELEMATICA" && telematicaEnabled);
    if (required && !values[field.campo]?.trim()) {
      errors[field.campo] = `${field.descripcion || field.campo}: campo obligatorio.`;
    }
  }
  return errors;
}
