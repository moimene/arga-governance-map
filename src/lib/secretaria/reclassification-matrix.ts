/**
 * Matriz P7 — reclasificación de `agenda_items.kind` (v1.4).
 *
 * Evalúa si una reclasificación de `kind` (INFORMATIVO / DELIBERATIVO /
 * DECISORIO) es admisible según el estado procedimental de la reunión y el
 * tipo de órgano. Se aplica desde el hook `useReclassifyAgendaItemKind` como
 * defensa en profundidad antes del UPDATE (los triggers T2/T3 son el último
 * backstop).
 *
 * Estados canónicos (español, los que persiste la BD):
 *   - `BORRADOR`   (legacy inglés: `DRAFT`)
 *   - `CONVOCADA`  (legacy inglés: `CONVOKED`)
 *   - `CELEBRADA`  (legacy inglés: `OPEN`)
 *   - `CERRADA`    (legacy inglés: `CLOSED`)
 *
 * `normalizeStatus` mapea ambos vocabularios al canónico español para
 * defensa en profundidad: producción usa español, pero código histórico y
 * tests pueden seguir pasando los valores ingleses sin romper.
 *
 * Reglas (spec §10 R7 + §6 P7):
 *
 * - `meeting.status === 'CERRADA'` → NUNCA permitido (T2 ya bloquea, doble
 *   check UX).
 * - `meeting.status === 'BORRADOR'` → siempre permitido (sin restricciones).
 * - `meeting.status === 'CONVOCADA'`:
 *    · CONSEJO → permitido (con audit).
 *    · JUNTA convocada formalmente (no universal) + newKind=DECISORIO →
 *      NO permitido (vicio procedimiento, requiere reconvocar).
 *    · JUNTA universal → permitido (asume unanimidad por construcción).
 *    · default (sin organType conocido) → permitido (degradación conservadora
 *      a CONSEJO: si no podemos demostrar JUNTA formal, no bloqueamos).
 * - `meeting.status === 'CELEBRADA'`:
 *    · CONSEJO + reclassify a DECISORIO → permitido si quórum unánime (la UI
 *      pre-condiciona; la matriz asume "sí" y deja al UI exigir constancia).
 *    · JUNTA universal + unanimidad → permitido.
 *    · JUNTA convocada formalmente (no universal) + newKind=DECISORIO →
 *      NO permitido (vicio procedimiento).
 *    · default → permitido (sin organType conocido, CONSEJO conservador).
 * - `currentKind === newKind` → NO permitido (no-op, evita audit ruidoso).
 *
 * Esta función es PURA: sin side effects, sin fetches, sin clock. Toda la
 * resolución de campos (organType desde `governing_bodies.body_type`,
 * isUniversal desde `meetings.quorum_data` o snapshot de convocatoria) se
 * hace en el hook.
 */
import type { AgendaItemKind } from "./agenda-kind";

export type MeetingStatus =
  | "BORRADOR"
  | "CONVOCADA"
  | "CELEBRADA"
  | "CERRADA"
  | "DRAFT"
  | "CONVOKED"
  | "OPEN"
  | "CLOSED"
  | string;

export type OrganType = "CONSEJO" | "JUNTA" | "JUNTA_GENERAL" | "CONSEJO_ADMIN" | string;

export interface ReclassificationCheckInput {
  /** Estado del meeting. Se compara case-insensitive. */
  meetingStatus: MeetingStatus;
  /** kind actual del punto (lo que está en BD). */
  currentKind: AgendaItemKind;
  /** kind propuesto. */
  newKind: AgendaItemKind;
  /**
   * Tipo de órgano normalizado. Acepta:
   *  - "CONSEJO" / "CONSEJO_ADMIN" / "CDA" → tratados como CONSEJO.
   *  - "JUNTA" / "JUNTA_GENERAL" → tratados como JUNTA.
   *
   * Si es undefined, se aplica degradación conservadora (no bloquear por
   * vicio JUNTA, dejar pasar como si fuera CONSEJO).
   */
  organType?: OrganType;
  /** Solo relevante para JUNTA. Si undefined, se asume convocatoria formal. */
  isUniversal?: boolean;
}

export interface ReclassificationCheckResult {
  allowed: boolean;
  /** Razón humana en castellano cuando `allowed=false`. */
  reason?: string;
}

const CONSEJO_TYPES = new Set(["CONSEJO", "CONSEJO_ADMIN", "CDA", "ADMIN", "ADMINISTRACION"]);
const JUNTA_TYPES = new Set(["JUNTA", "JUNTA_GENERAL", "JGA", "JUNTA_ACCIONISTAS"]);

function normalizeOrganType(value?: OrganType): "CONSEJO" | "JUNTA" | "UNKNOWN" {
  if (!value) return "UNKNOWN";
  const upper = String(value).toUpperCase().trim();
  if (CONSEJO_TYPES.has(upper)) return "CONSEJO";
  if (JUNTA_TYPES.has(upper)) return "JUNTA";
  return "UNKNOWN";
}

/**
 * Normaliza el estado de la reunión al vocabulario canónico de BD.
 *
 * CHECK constraint real `meetings_status_check` en producción:
 *   ('DRAFT', 'CONVOCADA', 'CELEBRADA', 'CANCELADA')
 *
 * - DRAFT (inglés literal, NO 'BORRADOR') — reunión sin emitir convocatoria
 * - CONVOCADA — convocatoria emitida, antes de la sesión
 * - CELEBRADA — sesión abierta o en desarrollo
 * - CANCELADA — terminal (acta firmada o reunión abortada)
 *
 * Mapea también valores legacy (BORRADOR / CONVOKED / OPEN / CLOSED / CERRADA)
 * que pudieron usarse en código histórico, tests previos o documentación
 * en español natural. La comparación es case-insensitive.
 */
function normalizeStatus(
  value: MeetingStatus,
): "DRAFT" | "CONVOCADA" | "CELEBRADA" | "CANCELADA" | "OTHER" {
  const upper = String(value ?? "").toUpperCase().trim();
  // Canónico BD (DRAFT inglés, resto español)
  if (upper === "DRAFT") return "DRAFT";
  if (upper === "CONVOCADA") return "CONVOCADA";
  if (upper === "CELEBRADA") return "CELEBRADA";
  if (upper === "CANCELADA") return "CANCELADA";
  // Legacy → mapeo al canónico
  if (upper === "BORRADOR") return "DRAFT";        // tests/docs en español
  if (upper === "CONVOKED") return "CONVOCADA";    // inglés legacy
  if (upper === "OPEN") return "CELEBRADA";        // inglés legacy
  if (upper === "CLOSED") return "CANCELADA";      // inglés legacy
  if (upper === "CERRADA") return "CANCELADA";     // español alterno (incorrecto)
  return "OTHER";
}

export function checkReclassificationAllowed(
  input: ReclassificationCheckInput,
): ReclassificationCheckResult {
  const { currentKind, newKind } = input;

  // Sanity: no-op
  if (currentKind === newKind) {
    return {
      allowed: false,
      reason: `El punto ya está clasificado como ${currentKind}; no requiere reclasificación.`,
    };
  }

  const status = normalizeStatus(input.meetingStatus);
  const organ = normalizeOrganType(input.organType);

  // Hard block: reunión terminal (CANCELADA, legacy: CLOSED/CERRADA)
  if (status === "CANCELADA") {
    return {
      allowed: false,
      reason:
        "Reunión cancelada: la reclasificación está prohibida una vez firmada el acta. " +
        "(T2 enforcement; este es el chequeo previo UX.)",
    };
  }

  // DRAFT (canónico BD, legacy: BORRADOR): sin restricciones procedimentales
  if (status === "DRAFT") {
    return { allowed: true };
  }

  // CONVOCADA y CELEBRADA (legacy: CONVOKED / OPEN): depende de órgano
  if (status === "CONVOCADA" || status === "CELEBRADA") {
    if (organ === "JUNTA") {
      const isUniversal = input.isUniversal === true;
      if (!isUniversal && newKind === "DECISORIO") {
        return {
          allowed: false,
          reason:
            "Junta convocada formalmente: no se puede elevar un punto a DECISORIO " +
            "después de la convocatoria sin reconvocar (vicio de procedimiento, art. 174 LSC). " +
            "Solo admisible en Junta Universal con unanimidad de los presentes.",
        };
      }
      // Junta universal o reclassify INFO↔DELIB (no requiere vicio chequeo)
      return { allowed: true };
    }

    // CONSEJO o UNKNOWN (conservador: permitir, audit + UI validan)
    return { allowed: true };
  }

  // Status fuera de catálogo conocido: permitir conservador (BD/triggers son backstop)
  return { allowed: true };
}
