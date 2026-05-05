import { isRequiredCapa3Field } from "@/lib/secretaria/capa3-fields";

export interface Capa3ValidationField {
  campo: string;
  obligatoriedad: string;
  descripcion?: string | null;
}

/**
 * Validate Capa 3 values against template field requirements.
 * Returns a field-to-message map for validation errors.
 */
export function validateCapa3(
  fields: Capa3ValidationField[],
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
