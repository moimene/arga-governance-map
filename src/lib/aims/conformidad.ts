/**
 * Criterio ÚNICO de conformidad de una medida del autodiagnóstico AIMS.
 *
 * Es un **módulo hoja a propósito: no importa nada**. Lo consumen
 * `catalog-aesia.ts` (estadísticas del wizard), `evaluacion-payload.ts` (lo que
 * se persiste) y `readiness.ts` (el KPI del dashboard). Si viviera en
 * cualquiera de ellos habría ciclo de imports — el mismo TDZ que ya tumbó
 * `/secretaria` una vez y que obligó a dejar `metadata-policy.ts` como hoja.
 *
 * Que el criterio esté en un solo sitio no es estética: en GRC el criterio de
 * cobertura de una obligación vivía dentro de una página, y por eso la
 * corrección llegó a una pantalla y sus dos hermanas siguieron pintando lo
 * contrario sobre las mismas filas.
 */

/**
 * Niveles que, por su título en la escala L1–L8, describen algo terminado:
 * `L5` («documentada e implementada») y `L8` («medida no necesaria para el
 * sistema»). `L3` es «documentada, NO implementada» y `L4` «implementación en
 * curso», así que no acreditan.
 *
 * Se enumera lo que SÍ acredita: un nivel nuevo en la escala será brecha por
 * defecto, que es el lado seguro.
 */
export const NIVELES_CONFORMES = new Set(["L5", "L8"]);

/** El nivel que la escala obliga a justificar (`requiresJustification: true`). */
export const NIVEL_NO_APLICABLE = "L8";

/** Copy único para la medida que declara «no aplica» y no dice por qué. */
export const MOTIVO_L8_SIN_JUSTIFICAR = "No aplicable declarada sin justificación";

/** Copy único para la medida que se declara hecha y no aporta nada detrás. */
export const MOTIVO_L5_SIN_EVIDENCIA = "Declarada sin evidencia";

/** Copy único para la fila anterior al 2026-09-07, que no midió evidencia. */
export const MOTIVO_L5_PENDIENTE_EVIDENCIA = "Pendiente de evidencia";

/**
 * ¿Esta medida acredita conformidad?
 *
 * `L5` sí. `L8` **sólo con su motivo**: el formulario la pide con asterisco de
 * obligatoria y el catálogo la declara obligatoria, pero hasta el 2026-09-07 el
 * texto se recogía y se descartaba al persistir, así que una exención en blanco
 * era indistinguible de una motivada y contaba igual en el porcentaje.
 */
export function acreditaConformidad(
  finding:
    | {
        status?: string | null;
        justification?: string | null;
        /**
         * Evidencias VIGENTES atadas a la medida.
         *
         * `undefined` y `0` NO son lo mismo y se dicen distinto: las filas
         * anteriores al 2026-09-07 no midieron evidencia («pendiente de
         * evidencia»); un `0` es una medida que se declara hecha sin nada
         * detrás. Pero desde el 2026-09-19 (F1.T5) NINGUNO acredita: la regla
         * anterior —«no medido no degrada»— dejaba que 40 L5 sin evidencia
         * sostuvieran el 49 % de Harvey.
         */
        evidenceCount?: number | null;
      }
    | null
    | undefined,
): boolean {
  const nivel = (finding?.status ?? "").trim().toUpperCase();
  if (!NIVELES_CONFORMES.has(nivel)) return false;
  if (nivel === NIVEL_NO_APLICABLE) {
    return Boolean(finding?.justification && finding.justification.trim().length > 0);
  }
  // `L5` = «documentada e implementada». Sin nada detrás —o sin haberlo
  // medido— es una autodeclaración, y un porcentaje construido con
  // autodeclaraciones no vale para auditoría interna ni para certificación.
  return typeof finding?.evidenceCount === "number" && finding.evidenceCount > 0;
}

/** L5 sin recuento de evidencia (filas anteriores al 2026-09-07): el indicador las cuenta aparte. */
export function pendientesDeEvidencia(
  findings: { status?: string | null; evidenceCount?: number | null }[] | null | undefined,
): number {
  return (findings ?? []).filter(
    (f) => (f.status ?? "").trim().toUpperCase() === "L5" && typeof f.evidenceCount !== "number",
  ).length;
}

/** Por qué una medida de nivel conforme no acredita. `null` si acredita. */
export function motivoNoAcredita(
  finding: { status?: string | null; justification?: string | null; evidenceCount?: number | null } | null | undefined,
): string | null {
  const nivel = (finding?.status ?? "").trim().toUpperCase();
  if (!NIVELES_CONFORMES.has(nivel)) return null;
  if (acreditaConformidad(finding)) return null;
  if (nivel === NIVEL_NO_APLICABLE) return MOTIVO_L8_SIN_JUSTIFICAR;
  return typeof finding?.evidenceCount === "number" ? MOTIVO_L5_SIN_EVIDENCIA : MOTIVO_L5_PENDIENTE_EVIDENCIA;
}
