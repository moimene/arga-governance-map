import {
  capa3ValueToText,
  isArrayCapa3Field,
  isRequiredCapa3Field,
  type NormalizedCapa3ItemField,
} from "@/lib/secretaria/capa3-fields";

export interface Capa3ValidationField {
  campo: string;
  obligatoriedad: string;
  descripcion?: string | null;
  tipo?: string;
  min_items?: number;
  max_items?: number | null;
  item_schema?: Record<string, NormalizedCapa3ItemField>;
  /**
   * Lista cerrada de opciones permitidas (Codex P2 round 5). Si está presente
   * y el valor no está dentro, se rechaza. Defensa al render del `<select>`
   * por si un cliente bypaseara la UI.
   */
  opciones?: string[];
}

/**
 * Validate Capa 3 values against template field requirements.
 * Returns a field-to-message map for validation errors.
 */
export function validateCapa3(
  fields: Capa3ValidationField[],
  values: Record<string, unknown>,
  telematicaEnabled = false
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const required =
      isRequiredCapa3Field(field) ||
      (field.obligatoriedad === "OBLIGATORIO_SI_TELEMATICA" && telematicaEnabled);
    const rawValue = values[field.campo];

    if (isArrayCapa3Field(field)) {
      const rows = Array.isArray(rawValue) ? rawValue : [];
      const nonEmptyRows = rows.filter((row) =>
        row &&
        typeof row === "object" &&
        Object.values(row as Record<string, unknown>).some((entry) => capa3ValueToText(entry).length > 0),
      );
      const minItems = field.min_items ?? (required ? 1 : 0);
      if (nonEmptyRows.length < minItems) {
        errors[field.campo] =
          `${field.descripcion || field.campo}: añada al menos ${minItems} elemento(s).`;
        continue;
      }

      const schema = field.item_schema ?? {};
      for (const [rowIndex, row] of nonEmptyRows.entries()) {
        const record = row as Record<string, unknown>;
        for (const itemField of Object.values(schema)) {
          const itemValue = capa3ValueToText(record[itemField.key]);
          if (itemField.requerido && !itemValue) {
            errors[field.campo] =
              `${itemField.label}: campo obligatorio en elemento ${rowIndex + 1}.`;
            break;
          }
          if (
            itemValue &&
            itemField.min_length !== undefined &&
            itemValue.length < itemField.min_length
          ) {
            errors[field.campo] =
              `${itemField.label}: mínimo ${itemField.min_length} caracteres en elemento ${rowIndex + 1}.`;
            break;
          }
          if (
            itemValue &&
            itemField.options &&
            itemField.options.length > 0 &&
            !itemField.options.includes(itemValue)
          ) {
            errors[field.campo] =
              `${itemField.label}: valor fuera de las opciones permitidas (${itemField.options.join(", ")}).`;
            break;
          }
        }
        if (errors[field.campo]) break;
      }
      continue;
    }

    const value = capa3ValueToText(rawValue);
    if (required && !value) {
      errors[field.campo] = `${field.descripcion || field.campo}: campo obligatorio.`;
      continue;
    }
    // Codex P2 round 5: validar lista cerrada cuando se declaran opciones.
    if (value && field.opciones && field.opciones.length > 0 && !field.opciones.includes(value)) {
      errors[field.campo] =
        `${field.descripcion || field.campo}: valor fuera de las opciones permitidas (${field.opciones.join(", ")}).`;
    }
  }
  return errors;
}
