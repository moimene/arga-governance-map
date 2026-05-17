import { Plus, Trash2 } from "lucide-react";
import {
  type Capa3ArrayItem,
  type NormalizedCapa3ItemField,
} from "@/lib/secretaria/capa3-fields";

interface ArrayFieldProps {
  id: string;
  label: string;
  value: unknown;
  itemSchema: Record<string, NormalizedCapa3ItemField>;
  minItems?: number;
  maxItems?: number | null;
  readOnly?: boolean;
  onChange: (items: Capa3ArrayItem[]) => void;
}

function emptyRow(itemSchema: Record<string, NormalizedCapa3ItemField>): Capa3ArrayItem {
  return Object.keys(itemSchema).reduce<Capa3ArrayItem>((acc, key) => {
    acc[key] = "";
    return acc;
  }, {});
}

function normalizeRows(value: unknown): Capa3ArrayItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item))
    .map((item) =>
      Object.entries(item).reduce<Capa3ArrayItem>((acc, [key, entry]) => {
        acc[key] = entry === null || entry === undefined ? "" : String(entry);
        return acc;
      }, {}),
    );
}

function inputType(field: NormalizedCapa3ItemField) {
  if (field.tipo === "date") return "date";
  if (field.tipo === "number" || field.tipo === "currency") return "number";
  return "text";
}

export function ArrayField({
  id,
  label,
  value,
  itemSchema,
  minItems = 0,
  maxItems = null,
  readOnly = false,
  onChange,
}: ArrayFieldProps) {
  const rows = normalizeRows(value);
  const displayRows =
    rows.length >= minItems
      ? rows
      : [...rows, ...Array.from({ length: minItems - rows.length }, () => emptyRow(itemSchema))];
  const canAdd = !readOnly && (maxItems === null || maxItems === undefined || displayRows.length < maxItems);
  const canRemove = (index: number) => !readOnly && displayRows.length > minItems && index >= 0;

  const updateCell = (rowIndex: number, key: string, nextValue: string) => {
    const nextRows = displayRows.map((row, index) =>
      index === rowIndex ? { ...row, [key]: nextValue } : row,
    );
    onChange(nextRows);
  };

  const addRow = () => {
    if (!canAdd) return;
    onChange([...displayRows, emptyRow(itemSchema)]);
  };

  const removeRow = (rowIndex: number) => {
    if (!canRemove(rowIndex)) return;
    onChange(displayRows.filter((_, index) => index !== rowIndex));
  };

  return (
    <div className="space-y-3">
      {displayRows.map((row, rowIndex) => (
        <div
          key={`${id}-row-${rowIndex}`}
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-3"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-[var(--g-text-primary)]">
              {label} {rowIndex + 1}
            </p>
            {!readOnly && displayRows.length > minItems ? (
              <button
                type="button"
                onClick={() => removeRow(rowIndex)}
                className="inline-flex h-8 w-8 items-center justify-center text-[var(--status-error)] transition-colors hover:bg-[var(--g-surface-subtle)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
                aria-label={`Eliminar ${label.toLowerCase()} ${rowIndex + 1}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {Object.values(itemSchema).map((itemField) => {
              const fieldId = `${id}-${rowIndex}-${itemField.key}`;
              const currentValue = row[itemField.key] ?? "";
              const requiredAndEmpty = itemField.requerido && !currentValue.trim();
              return (
                <div key={itemField.key} className={itemField.tipo === "textarea" ? "md:col-span-2" : ""}>
                  <label
                    htmlFor={fieldId}
                    className="text-xs font-medium text-[var(--g-text-primary)]"
                  >
                    {itemField.label}
                  </label>
                  {itemField.help_text ? (
                    <p className="mt-0.5 text-[11px] text-[var(--g-text-secondary)]">
                      {itemField.help_text}
                    </p>
                  ) : null}
                  {itemField.options && itemField.options.length > 0 ? (
                    <select
                      id={fieldId}
                      value={currentValue}
                      onChange={(event) => updateCell(rowIndex, itemField.key, event.target.value)}
                      disabled={readOnly}
                      aria-required={itemField.requerido}
                      aria-invalid={requiredAndEmpty}
                      className="mt-1 w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] disabled:opacity-70"
                      style={{ borderRadius: "var(--g-radius-md)" }}
                    >
                      <option value="">Seleccione una opción</option>
                      {itemField.options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : itemField.tipo === "textarea" ? (
                    <textarea
                      id={fieldId}
                      value={currentValue}
                      onChange={(event) => updateCell(rowIndex, itemField.key, event.target.value)}
                      disabled={readOnly}
                      rows={3}
                      minLength={itemField.min_length}
                      aria-required={itemField.requerido}
                      aria-invalid={requiredAndEmpty}
                      className="mt-1 w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] disabled:opacity-70"
                      style={{ borderRadius: "var(--g-radius-md)" }}
                      placeholder={itemField.placeholder}
                    />
                  ) : (
                    <input
                      id={fieldId}
                      type={inputType(itemField)}
                      value={currentValue}
                      onChange={(event) => updateCell(rowIndex, itemField.key, event.target.value)}
                      disabled={readOnly}
                      minLength={itemField.min_length}
                      aria-required={itemField.requerido}
                      aria-invalid={requiredAndEmpty}
                      className="mt-1 w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] disabled:opacity-70"
                      style={{ borderRadius: "var(--g-radius-md)" }}
                      placeholder={itemField.placeholder}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {!readOnly ? (
        <button
          type="button"
          onClick={addRow}
          disabled={!canAdd}
          className="inline-flex items-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm font-medium text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)] disabled:opacity-50"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <Plus className="h-4 w-4" />
          Añadir
        </button>
      ) : null}
    </div>
  );
}
