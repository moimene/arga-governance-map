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

import { useCallback } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Info,
  Minus,
} from "lucide-react";
import { ArrayField } from "./ArrayField";
import {
  capa3ValueHasContent,
  capa3ValueToText,
  isArrayCapa3Field,
  isBooleanCapa3Field,
  isNumberCapa3Field,
  isRequiredCapa3Field,
  normalizeBooleanDraftValue,
  resolveNumberDraftInput,
  type Capa3Values,
  type NormalizedCapa3Field,
} from "@/lib/secretaria/capa3-fields";

export interface Capa3Field extends NormalizedCapa3Field {
  /** Default sugerido (Codex P2 round 5). Aplicado por buildDefaultCapa3Values. */
  default?: string;
  /** Campo derivado de Capa 2 que no debe editarse desde Capa 3. */
  readonly?: boolean;
  /** Etiqueta de origen para campos pre-rellenados desde el expediente. */
  sourceLabel?: string;
  /**
   * Lista cerrada de opciones (Codex P2 round 5). Si está presente y no vacía,
   * Capa3Form renderiza `<select>` en lugar de `<textarea>`.
   */
  opciones?: string[];
}

interface Capa3FormProps {
  fields: Capa3Field[];
  values: Record<string, unknown>;
  onChange: (values: Capa3Values) => void;
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
      onChange({ ...values, [campo]: value } as Capa3Values);
    },
    [values, onChange]
  );

  const handleArrayChange = useCallback(
    (campo: string, value: Capa3Values[string]) => {
      onChange({ ...values, [campo]: value } as Capa3Values);
    },
    [values, onChange]
  );

  // MOI-206: control de tres estados (sí/no/sin contestar). "Sin contestar"
  // quita la clave en vez de guardar "" — así capa3ValueHasContent distingue
  // "todavía sin responder" de una respuesta "No" ya persistida.
  const handleBooleanChange = useCallback(
    (campo: string, raw: string) => {
      const next = { ...values };
      if (raw === "true") next[campo] = true;
      else if (raw === "false") next[campo] = false;
      else delete next[campo];
      onChange(next as Capa3Values);
    },
    [values, onChange]
  );

  const handleNumberChange = useCallback(
    (campo: string, raw: string) => {
      const next = { ...values };
      const resolved = resolveNumberDraftInput(raw);
      if (resolved === undefined) delete next[campo];
      else next[campo] = resolved;
      onChange(next as Capa3Values);
    },
    [values, onChange]
  );

  const isFieldRequired = (field: Capa3Field): boolean => {
    if (isRequiredCapa3Field(field)) return true;
    if (field.obligatoriedad === "OBLIGATORIO_SI_TELEMATICA" && telematicaEnabled) return true;
    return false;
  };

  const incompleteRequired = fields.filter(
    (f) => isFieldRequired(f) && !capa3ValueHasContent(values[f.campo])
  );

  if (fields.length === 0) {
    return (
      <div
        className="flex items-center gap-2 px-4 py-3 text-sm text-[var(--g-text-secondary)] bg-[var(--g-surface-subtle)]"
        style={{ borderRadius: "var(--g-radius-md)" }}
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
        const rawValue = values[field.campo];
        const valueText = capa3ValueToText(rawValue);
        const isEmpty = !capa3ValueHasContent(rawValue);
        const fieldReadOnly = readOnly || field.readonly === true;
        const isArrayField = isArrayCapa3Field(field);

        return (
          <div key={field.campo} className="space-y-1.5">
            {/* Label row */}
            <div className="flex flex-wrap items-center gap-2">
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
              {field.sourceLabel && (
                <span
                  className="inline-flex items-center gap-1 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-2 py-0.5 text-[11px] font-medium text-[var(--g-text-secondary)]"
                  style={{ borderRadius: "var(--g-radius-full)" }}
                >
                  {field.readonly ? "Derivado" : "Pre-rellenado"} · {field.sourceLabel}
                </span>
              )}
            </div>

            {/* Description */}
            <p className="text-xs text-[var(--g-text-secondary)]">
              {field.descripcion}
            </p>

            {/* Input — orden: array → opciones (lista cerrada) → boolean
                (tres estados, MOI-206) → number (input numérico + min/max,
                MOI-206) → textarea libre como último recurso. */}
            {fieldReadOnly ? (
              <div
                className={`px-3 py-2 text-sm text-[var(--g-text-primary)] ${config.bgClass}`}
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                {valueText || (
                  <span className="italic text-[var(--g-text-secondary)]">Sin completar</span>
                )}
              </div>
            ) : isArrayField && field.item_schema ? (
              <ArrayField
                id={`capa3-${field.campo}`}
                label={humanizeFieldName(field.campo)}
                value={rawValue}
                itemSchema={field.item_schema}
                minItems={field.min_items ?? (required ? 1 : 0)}
                maxItems={field.max_items}
                readOnly={fieldReadOnly}
                onChange={(items) => handleArrayChange(field.campo, items)}
              />
            ) : field.opciones && field.opciones.length > 0 ? (
              <select
                id={`capa3-${field.campo}`}
                value={valueText}
                onChange={(e) => handleChange(field.campo, e.target.value)}
                aria-required={required}
                aria-invalid={required && isEmpty}
                aria-describedby={`capa3-${field.campo}-desc`}
                className={`w-full px-3 py-2 text-sm text-[var(--g-text-primary)] bg-[var(--g-surface-card)] border ${
                  required && isEmpty
                    ? config.borderClass
                    : "border-[var(--g-border-subtle)]"
                } focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] transition-colors`}
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <option value="">— Seleccione una opción —</option>
                {field.opciones.map((opcion) => (
                  <option key={opcion} value={opcion}>
                    {opcion}
                  </option>
                ))}
              </select>
            ) : isBooleanCapa3Field(field) ? (
              // MOI-206: control de tres estados. El valor guardado es un
              // booleano real (o ausente si "sin contestar"), nunca el texto
              // "Sí"/"No" — así el motor de plantillas no confunde un "No"
              // (string no vacío, verdadero en Handlebars) con una respuesta
              // negativa.
              <select
                id={`capa3-${field.campo}`}
                // normalizeBooleanDraftValue tolera además un `default` legacy
                // en texto ("SÍ"/"No") que un override de entity_settings
                // pueda seguir precargando sin re-normalizar antes del render.
                value={(() => {
                  const parsed = normalizeBooleanDraftValue(rawValue);
                  return parsed === true ? "true" : parsed === false ? "false" : "";
                })()}
                onChange={(e) => handleBooleanChange(field.campo, e.target.value)}
                aria-required={required}
                aria-invalid={required && isEmpty}
                aria-describedby={`capa3-${field.campo}-desc`}
                className={`w-full px-3 py-2 text-sm text-[var(--g-text-primary)] bg-[var(--g-surface-card)] border ${
                  required && isEmpty
                    ? config.borderClass
                    : "border-[var(--g-border-subtle)]"
                } focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] transition-colors`}
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <option value="">Sin contestar</option>
                <option value="true">Sí</option>
                <option value="false">No</option>
              </select>
            ) : isNumberCapa3Field(field) ? (
              <input
                id={`capa3-${field.campo}`}
                type="number"
                // MOI-206 fix (revisión): valueText (capa3ValueToText) refleja
                // el string crudo tal cual mientras se edita — normalizeNumberDraftValue
                // devolvería "" para un intermedio como "-" o "3." y forzaría
                // el snap-back del valor controlado en cada tecla.
                value={valueText}
                min={field.min}
                max={field.max}
                onChange={(e) => handleNumberChange(field.campo, e.target.value)}
                aria-required={required}
                aria-invalid={required && isEmpty}
                aria-describedby={`capa3-${field.campo}-desc`}
                className={`w-full px-3 py-2 text-sm text-[var(--g-text-primary)] bg-[var(--g-surface-card)] border ${
                  required && isEmpty
                    ? config.borderClass
                    : "border-[var(--g-border-subtle)]"
                } focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] transition-colors`}
                style={{ borderRadius: "var(--g-radius-md)" }}
                placeholder={`${field.descripcion}...`}
              />
            ) : (
              <textarea
                id={`capa3-${field.campo}`}
                value={valueText}
                onChange={(e) => handleChange(field.campo, e.target.value)}
                rows={3}
                aria-required={required}
                aria-invalid={required && isEmpty}
                aria-describedby={`capa3-${field.campo}-desc`}
                className={`w-full px-3 py-2 text-sm text-[var(--g-text-primary)] bg-[var(--g-surface-card)] border ${
                  required && isEmpty
                    ? config.borderClass
                    : "border-[var(--g-border-subtle)]"
                } focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] transition-colors`}
                style={{ borderRadius: "var(--g-radius-md)" }}
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
