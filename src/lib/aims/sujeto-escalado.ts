/**
 * F2.T14 (MOI-170) — sujeto RIA a citar al escalar un sistema de IA a
 * Secretaría (`EscaladoSecretariaModal.tsx`).
 *
 * Módulo HOJA: no importa Supabase ni React (mismo patrón que
 * `rule-pack-selection.ts` / `secretaria-derivation.ts`), para poder testear
 * la arista sin levantar ningún doble de red.
 *
 * Un sistema puede tener varios sujetos vigentes (F2.T2:
 * `aims_ria_subjects`, único por rol). Si hay un PROVEEDOR, es el que manda
 * — es quien redacta el Expediente Técnico (arts. 11/47). Si el sistema solo
 * tiene RESPONSABLE_DESPLIEGUE (uso de un sistema de un tercero), NO se debe
 * precargar el "Expediente Técnico": esa obligación es del proveedor, no del
 * responsable del despliegue.
 */

export interface AimsRiaSubjectRow {
  entity_id: string;
  role: string;
  entity: { common_name: string } | null;
}

export interface PrimaryRiaSubject {
  entityId: string;
  entityName: string | null;
  role: string;
  /** true si, entre los sujetos vigentes del sistema, hay un PROVEEDOR. */
  hasProveedor: boolean;
}

/**
 * Elige el sujeto a citar en la propuesta: el PROVEEDOR si existe, si no el
 * primero. `null` sin sujetos vigentes (hoy, 0 en Cloud — F2.T16 los siembra).
 */
export function pickPrimaryRiaSubject(rows: AimsRiaSubjectRow[]): PrimaryRiaSubject | null {
  const proveedor = rows.find((r) => r.role === "PROVEEDOR");
  const primary = proveedor ?? rows[0];
  if (!primary) return null;
  return {
    entityId: primary.entity_id,
    entityName: primary.entity?.common_name ?? null,
    role: primary.role,
    hasProveedor: Boolean(proveedor),
  };
}

/**
 * Materia por defecto de la propuesta. Sin sujeto conocido (hoy, la mayoría
 * de los casos) o con un PROVEEDOR entre los sujetos, mantiene el texto
 * histórico ("Expediente Técnico"). Con un sujeto conocido que es SOLO
 * responsable del despliegue, no lo menciona: esa obligación no es suya.
 */
export function defaultEscaladoMatter(systemName: string, subject: PrimaryRiaSubject | null): string {
  if (subject && subject.role === "RESPONSABLE_DESPLIEGUE" && !subject.hasProveedor) {
    return `Propuesta relativa al Sistema de IA: ${systemName} (responsable del despliegue)`;
  }
  return `Propuesta de aprobación del Expediente Técnico para el Sistema de IA: ${systemName}`;
}
