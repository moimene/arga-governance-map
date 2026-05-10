/**
 * src/lib/secretaria/matter-class.ts
 *
 * Constantes y helpers para el dominio `matter_class` en agreements.
 *
 * Contexto: la tabla `agreements` tiene un CHECK constraint
 * `agreements_matter_class_check` que sólo acepta 3 valores:
 *
 *   - 'ORDINARIA'    — gestión ordinaria, no requiere mayoría reforzada
 *   - 'ESTATUTARIA'  — modificación de estatutos, mayoría reforzada
 *   - 'ESTRUCTURAL'  — fusión/escisión/disolución, mayoría reforzada + notario
 *
 * Sin embargo, el catálogo `materia_catalog` tiene rows con
 * `matter_class='ESPECIAL'` para materias que NO se persisten en `agreements`:
 *
 *   - PACTO_PARASOCIAL    → tabla `pactos_parasociales` (ruta dedicada)
 *   - EXCLUSION_SOCIO     → operación sobre `capital_holdings` con resolución
 *                            judicial / acuerdo separación social — flujo
 *                            distinto del agreement genérico
 *   - SEPARACION_SOCIO    → idem (art. 346 LSC)
 *
 * Si la UI permite seleccionar una materia ESPECIAL en un stepper que
 * persiste en `agreements`, el INSERT falla con HTTP 400 silencioso
 * (CHECK violation, código 23514).
 *
 * Este módulo centraliza la lista de matter_class compatibles con
 * `agreements` para que los hooks de catálogo (useMateriaCatalog) y los
 * tests filtren coherentemente.
 *
 * Fuente de verdad: el CHECK SQL `agreements_matter_class_check`. Si en
 * el futuro se amplía el CHECK (vía migración nueva), actualizar este array
 * y validar con `bun test` que ningún consumer rompe.
 */

export const AGREEMENT_COMPATIBLE_MATTER_CLASSES = [
  'ORDINARIA',
  'ESTATUTARIA',
  'ESTRUCTURAL',
] as const;

export type AgreementMatterClass = (typeof AGREEMENT_COMPATIBLE_MATTER_CLASSES)[number];

/**
 * Devuelve true si el matter_class dado es válido para persistir en
 * `agreements` sin disparar el CHECK constraint.
 */
export function isAgreementCompatibleMatterClass(value: string | null | undefined): value is AgreementMatterClass {
  if (!value) return false;
  return (AGREEMENT_COMPATIBLE_MATTER_CLASSES as readonly string[]).includes(value);
}

/**
 * Filtra un array de filas de catálogo de materias dejando sólo las
 * compatibles con `agreements`. Usar esto en hooks que alimentan steppers
 * que persisten agreements (Decisión Unipersonal, futuros que añadan
 * materia selector).
 */
export function filterAgreementCompatibleMaterias<T extends { matter_class: string | null | undefined }>(
  rows: T[],
): T[] {
  return rows.filter((row) => isAgreementCompatibleMatterClass(row.matter_class));
}
