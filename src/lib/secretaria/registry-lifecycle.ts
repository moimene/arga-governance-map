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
  | "PUBLICADA";

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
    return to === "SUBSANACION" || to === "DENEGADA" || to === "INSCRITA";
  }
  if (from === "SUBSANACION") return to === "PRESENTADA";
  if (from === "INSCRITA") return to === "PUBLICADA";
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
