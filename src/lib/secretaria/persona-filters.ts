/**
 * Helpers de filtrado de personas — distinguen registros reales de demo
 * de los fixtures E2E, placeholders PENDIENTE-* y duplicados soft-archived.
 *
 * Se usan vía el flag `excludeTestData` en `usePersonasCanonical` /
 * `usePersonasEnriquecidas` para mantener los dropdowns de producción
 * (alta de cargo, asistentes a reunión, libro de socios) limpios, mientras
 * los tests E2E pueden seguir viendo sus fixtures pasando
 * `excludeTestData=false` explícitamente.
 *
 * Cobertura de patrones (todos confirmados como presentes en Cloud demo
 * a fecha 2026-05-12 según `wave2-input-table-list-FK-persons` y el script
 * de consolidación `scripts/consolidate-duplicate-persons.ts`):
 *
 *   - `[E2E REAL]` prefix en `full_name`  → fixtures E2E con persistencia.
 *   - `[ARCHIVED]` prefix en `full_name`  → personas soft-archived por la
 *                                           consolidación D2.
 *   - `PRUEBA 1`, `PEDRO PRUEBA PRUEBA`   → registros manuales de prueba
 *                                           heredados.
 *   - `E2E-*` tax_id                      → CIFs ficticios E2E.
 *   - `PENDIENTE-*` tax_id                → placeholders sin CIF real
 *                                           (detector Type B del script
 *                                           de consolidación).
 *   - `ARCHIVED-*` tax_id                 → tax_id originales soft-archived
 *                                           tras la consolidación (mantienen
 *                                           el CIF original para auditoría).
 */

import type { PersonaRow } from "@/hooks/usePersonasCanonical";

/**
 * `true` si la persona representa un registro de producción demo.
 *
 * Implementación intencionalmente declarativa (chequeos lineales) para
 * facilitar la auditoría adversarial: cada patrón es revisable de un
 * vistazo y el orden no afecta al resultado (todos los `return false` son
 * disjuntos). NO usar `tax_id.includes(...)` — los patrones son prefijos
 * deliberados para minimizar falsos positivos sobre CIFs reales.
 */
export function isProductionPerson(p: PersonaRow): boolean {
  // W3 (2026-06-14): honra la columna `data_class` además de los patrones de
  // nombre/tax_id. Tras la purga F1 no quedan personas TEST, pero el trigger de
  // auto-tag marcará futuros artefactos E2E como data_class='TEST' y aquí se ocultan.
  if ((p as { data_class?: string | null }).data_class === "TEST") return false;

  const fullName = p.full_name ?? "";
  if (fullName.startsWith("[E2E REAL]")) return false;
  if (fullName.startsWith("[ARCHIVED]")) return false;
  if (fullName === "PRUEBA 1") return false;
  if (fullName === "PEDRO PRUEBA PRUEBA") return false;

  const tax = p.tax_id ?? "";
  if (tax.startsWith("E2E-")) return false;
  if (tax.startsWith("PENDIENTE-")) return false;
  if (tax.startsWith("ARCHIVED-")) return false;

  return true;
}
