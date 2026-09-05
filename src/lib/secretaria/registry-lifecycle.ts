export type RegistryBaseDocumentKind = "ESCRITURA" | "INSTANCIA" | "CERTIFICACION";

export type RegistryQualificationOutcome =
  | "POSITIVA"
  | "SUSPENSION_SUBSANABLE"
  | "DENEGACION";

export type RegistryLifecycleStatus =
  | "PREPARADA"
  | "ELEVADA"
  | "PRESENTADA"
  | "SUBSANACION"
  | "DENEGADA"
  | "INSCRITA"
  | "DEPOSITADA"
  | "LEGALIZADA"
  | "PUBLICADA";

/**
 * Terminal de exito por via registral. Un deposito de cuentas (arts. 279 y ss.
 * LSC) y una legalizacion de libros (arts. 329 y ss. RRM) no causan
 * inscripcion, asi que no pueden compartir terminal con el acto inscribible.
 * El servidor decide lo mismo en fn_registry_record_inscription; aqui vive la
 * copia que necesita la UI para rotular y para abrir la publicacion.
 */
export type RegistryTerminalStatus = Extract<
  RegistryLifecycleStatus,
  "INSCRITA" | "DEPOSITADA" | "LEGALIZADA"
>;

export interface RegistryTerminal {
  status: RegistryTerminalStatus;
  /** Nombre del tramite, en minuscula y sin articulo. */
  noun: string;
  /** Articulo que le corresponde, para redactar sin desacuerdos de genero. */
  article: "el" | "la";
  /** Participio concordado con el nombre. */
  participle: "acreditado" | "acreditada";
}

const TERMINAL_BY_PROFILE = new Map<string, RegistryTerminal>([
  [
    "DEPOSITO_CUENTAS",
    { status: "DEPOSITADA", noun: "depósito", article: "el", participle: "acreditado" },
  ],
  [
    "LEGALIZACION_LIBROS",
    { status: "LEGALIZADA", noun: "legalización", article: "la", participle: "acreditada" },
  ],
]);

const TERMINAL_DEFAULT: RegistryTerminal = {
  status: "INSCRITA",
  noun: "inscripción",
  article: "la",
  participle: "acreditada",
};

export function registryTerminal(procedureProfileCode?: string | null): RegistryTerminal {
  return (
    TERMINAL_BY_PROFILE.get(String(procedureProfileCode ?? "").trim().toUpperCase()) ??
    TERMINAL_DEFAULT
  );
}

export function isRegistryTerminal(status: string): status is RegistryTerminalStatus {
  return status === "INSCRITA" || status === "DEPOSITADA" || status === "LEGALIZADA";
}

export interface RegistryRpcResult {
  affected_count: number;
  filing_id: string;
  status: string;
  event_id?: string | null;
  state_version?: number;
}

const STATUS_BY_QUALIFICATION: Record<RegistryQualificationOutcome, RegistryLifecycleStatus> = {
  POSITIVA: "PRESENTADA",
  SUSPENSION_SUBSANABLE: "SUBSANACION",
  DENEGACION: "DENEGADA",
};

export function statusForQualification(
  outcome: RegistryQualificationOutcome,
): RegistryLifecycleStatus {
  return STATUS_BY_QUALIFICATION[outcome];
}

export function canRegistryTransition(
  from: RegistryLifecycleStatus,
  to: RegistryLifecycleStatus,
  baseDocumentKind: RegistryBaseDocumentKind,
): boolean {
  if (from === "PREPARADA") {
    if (baseDocumentKind === "ESCRITURA") return to === "ELEVADA";
    return to === "PRESENTADA";
  }
  if (from === "ELEVADA") return to === "PRESENTADA";
  if (from === "PRESENTADA") {
    return to === "SUBSANACION" || to === "DENEGADA" || isRegistryTerminal(to);
  }
  if (from === "SUBSANACION") return to === "PRESENTADA";
  if (isRegistryTerminal(from)) return to === "PUBLICADA";
  return false;
}

export function assertRegistryRpcResult(value: unknown): RegistryRpcResult {
  if (!value || typeof value !== "object") {
    throw new Error("La transición registral no devolvió una confirmación válida.");
  }
  const result = value as Record<string, unknown>;
  const affectedCount = Number(result.affected_count);
  if (affectedCount !== 1) {
    throw new Error(
      `La transición registral debe confirmar exactamente una fila; confirmó ${Number.isFinite(affectedCount) ? affectedCount : 0}.`,
    );
  }
  if (typeof result.filing_id !== "string" || !result.filing_id) {
    throw new Error("La transición registral no devolvió el expediente afectado.");
  }
  if (typeof result.status !== "string" || !result.status) {
    throw new Error("La transición registral no devolvió el estado confirmado.");
  }
  return {
    affected_count: affectedCount,
    filing_id: result.filing_id,
    status: result.status,
    event_id: typeof result.event_id === "string" ? result.event_id : null,
    state_version: typeof result.state_version === "number" ? result.state_version : undefined,
  };
}
