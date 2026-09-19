/**
 * Qué acredita y qué es legado, por REGLA (F1.T4, DS-16).
 *
 * Sólo acredita lo congelado y revisado. Las filas anteriores a los controles
 * del 2026-09-07 (congelación, evidencia por medida) no se reescriben —cero
 * UPDATE sobre ARGA o Garrigues—: se rotulan al leerlas. Medido en Cloud el
 * 2026-09-19: ARGA Score figuraba cubierto con un APROBADO de 72 sin congelar,
 * y las cuatro APROBADO de 100 del «Motor de triaje» las generó una prueba
 * end-to-end.
 *
 * Criterio único: lo importan `readiness`, el Dashboard, la lista de
 * evaluaciones, la pestaña del sistema y el informe. Módulo hoja: sólo importa
 * hojas.
 */
import { evaluacionesVigentes } from "./checks-vigentes";
import { normalizarEstadoSeccion } from "./expediente-tecnico";
import { ESTADOS_EVALUACION_LEGADO, normalizeAimsStatus } from "./vocabulario";

export const ROTULO_LEGADO = "Legado demo, no acredita";

type EvaluacionLike = {
  system_id?: string | null;
  framework?: string | null;
  status?: string | null;
  created_at?: string | null;
  frozen_at?: string | null;
  reviewed_at?: string | null;
  findings?: { status?: string | null; evidenceCount?: number | null }[] | null;
};

const ESTADOS_CONFORMES = new Set(["CONFORME", "APROBADO"]);

/** Congelada y revisada por otra persona (la RPC de revisión exige que sea otra). */
export function evaluacionFirme(a: EvaluacionLike): boolean {
  return Boolean(a.frozen_at && a.reviewed_at);
}

/** Acredita conformidad: estado conforme Y congelada y revisada. */
export function evaluacionAcredita(a: EvaluacionLike): boolean {
  return ESTADOS_CONFORMES.has(normalizeAimsStatus(a.status)) && evaluacionFirme(a);
}

/**
 * Fila anterior a los controles del 2026-09-07: vocabulario de estado legado
 * (`APROBADO`, `EN_REVISION`), hallazgos que no son niveles L1–L8, o niveles
 * sin recuento de evidencia (entonces no había dónde guardarla). El producto
 * actual escribe siempre el recuento, también cuando es cero.
 */
export function esEvaluacionLegado(a: EvaluacionLike): boolean {
  if (evaluacionFirme(a)) return false;
  if ((ESTADOS_EVALUACION_LEGADO as readonly string[]).includes(normalizeAimsStatus(a.status))) return true;
  return (a.findings ?? []).some((f) => !/^L[1-8]$/.test((f.status ?? "").trim().toUpperCase()) || typeof f.evidenceCount !== "number");
}

/** Por qué una evaluación no acredita, dicho en la pantalla. `null` si es firme. */
export function rotuloEvaluacion(a: EvaluacionLike): string | null {
  if (evaluacionFirme(a)) return null;
  if (esEvaluacionLegado(a)) return ROTULO_LEGADO;
  return a.frozen_at ? "Congelada, pendiente de revisión: no acredita" : "Sin congelar ni revisar, no acredita";
}

/**
 * Sistemas cubiertos por una evaluación que acredita. De cada sistema y marco
 * manda la más reciente no borrador: una evaluación posterior con brechas
 * desplaza a la acreditada anterior; un borrador, no.
 */
export function sistemasCubiertos(assessments: EvaluacionLike[]): Set<string> {
  return new Set(
    evaluacionesVigentes(assessments)
      .filter(evaluacionAcredita)
      .map((a) => a.system_id)
      .filter((id): id is string => Boolean(id)),
  );
}

type SeccionLike = { section_code?: string | null; status?: string | null; reviewed_by_id?: string | null };

/** Una sección acredita si está conforme (o cerrada) y tiene revisor: la fecha de revisión sola no. */
export function seccionAcredita(s: SeccionLike): boolean {
  return ["APPROVED", "SEALED"].includes(normalizarEstadoSeccion(s.status)) && Boolean(s.reviewed_by_id);
}

/** Una sección que se dice conforme o cerrada sin revisor es legado. Una pendiente no afirma nada. */
export function rotuloSeccion(s: SeccionLike): string | null {
  return ["APPROVED", "SEALED"].includes(normalizarEstadoSeccion(s.status)) && !s.reviewed_by_id ? ROTULO_LEGADO : null;
}

/**
 * Códigos de `ai_compliance_checks` anteriores al catálogo vigente → código
 * vigente, para LEERLOS (nunca se reescriben). Cerrado sobre los 22 códigos de
 * legado medidos en Cloud el 2026-09-19. `null`: sin equivalente en el catálogo
 * vigente, declarado.
 */
export const LEGADO_A_VIGENTE: Record<string, string | null> = {
  "AIA-09": "RISK_MGMT",
  "AIA-10": "DATA_GOVERNANCE",
  "AIA-11": "TECHNICAL_DOC",
  "AIA-13": "TRANSPARENCY",
  "AIA-14": "HUMAN_OVERSIGHT",
  EU_AI_ACT_ART_9: "RISK_MGMT",
  EU_AI_ACT_ART_10: "DATA_GOVERNANCE",
  EU_AI_ACT_ART_13: "TRANSPARENCY",
  // Seed del «Motor de triaje»: VAL-01…07 son los arts. 9 a 15, por su título.
  "VAL-01": "RISK_MGMT",
  "VAL-02": "DATA_GOVERNANCE",
  "VAL-03": "TECHNICAL_DOC",
  "VAL-04": "LOGGING",
  "VAL-05": "TRANSPARENCY",
  "VAL-06": "HUMAN_OVERSIGHT",
  // ponytail: VAL-07 es el art. 15 entero; se lee como ACCURACY porque las tres
  // del art. 15 van al mismo monitor. Si algún día se miden por separado, partirlo.
  "VAL-07": "ACCURACY",
  // Anexo A de ISO 42001 por su título, no por su número (la numeración del seed está desplazada).
  "ISO-05": "ISO_POLICIES",
  "ISO-06": "ISO_ORG_ROLES",
  "ISO-07": null, // Recursos de IA: sin requisito vigente.
  "ISO-08": "ISO_IMPACT_ASSESS",
  "ISO-09": "ISO_LIFECYCLE",
  "ISO-10": null, // Gestión de datos para IA: sin requisito ISO vigente.
  "ISO42001_6.1": null, // Cláusula 6.1 (planificación): sin requisito vigente.
};

/** Copia de la comprobación con el código vigente y el de legado conservado. Un código vigente pasa tal cual. */
export function traducirLegado<T extends { requirement_code?: string | null }>(
  check: T,
): T & { codigo_legado?: string } {
  const code = check.requirement_code ?? "";
  if (!Object.prototype.hasOwnProperty.call(LEGADO_A_VIGENTE, code)) return check;
  return { ...check, requirement_code: LEGADO_A_VIGENTE[code] ?? code, codigo_legado: code };
}
