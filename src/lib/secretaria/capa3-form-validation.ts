import { isRequiredCapa3Field } from "@/lib/secretaria/capa3-fields";

export interface Capa3ValidationField {
  campo: string;
  obligatoriedad: string;
  descripcion?: string | null;
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
  values: Record<string, string>,
  telematicaEnabled = false
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const required =
      isRequiredCapa3Field(field) ||
      (field.obligatoriedad === "OBLIGATORIO_SI_TELEMATICA" && telematicaEnabled);
    const value = values[field.campo]?.trim() ?? "";
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
