import type { PostAcuerdoPayload } from "@/hooks/useRulePackForMateria";
import type { RegistryBaseDocumentKind } from "./registry-lifecycle";

export type RegistryProcedureKind =
  | "ACTO_INSCRIBIBLE"
  | "DEPOSITO_CUENTAS"
  | "NO_TRAMITABLE";

export interface RegistryProcedureProfile {
  kind: RegistryProcedureKind;
  label: string;
  baseDocumentKind: RegistryBaseDocumentKind | null;
  procedureProfileCode: string | null;
  deadlineDays: number | null;
  canPrepareFiling: boolean;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asPositiveDays(value: unknown): number | null {
  const direct = typeof value === "number" ? value : Number(value);
  return Number.isFinite(direct) && direct >= 0 ? direct : null;
}

function asBaseDocumentKind(value: unknown): RegistryBaseDocumentKind | null {
  const normalized = String(value ?? "").trim().toUpperCase();
  return normalized === "ESCRITURA" || normalized === "INSTANCIA" || normalized === "CERTIFICACION"
    ? normalized
    : null;
}

/**
 * D4-B: separa la inscribibilidad del acuerdo de sus trámites posteriores.
 * La aprobación de cuentas no se convierte en un acto inscribible; sí abre el
 * procedimiento autónomo de depósito cuando el rule pack lo declara.
 */
export function resolveRegistryProcedureProfile(
  agreementKind: string,
  payload: PostAcuerdoPayload,
): RegistryProcedureProfile {
  const directBaseDocument = asBaseDocumentKind(payload.instrumentoRequerido);
  if (payload.inscribible && directBaseDocument) {
    const rawDeadline = typeof payload.plazoInscripcion === "object"
      ? payload.plazoInscripcion?.dias
      : payload.plazoInscripcion;
    return {
      kind: "ACTO_INSCRIBIBLE",
      label: "Inscripción del acuerdo",
      baseDocumentKind: directBaseDocument,
      procedureProfileCode: directBaseDocument,
      deadlineDays: asPositiveDays(rawDeadline),
      canPrepareFiling: true,
    };
  }

  const deposit = asRecord(payload.deposito_cuentas);
  if (agreementKind === "APROBACION_CUENTAS" && deposit?.obligatorio === true) {
    const baseDocumentKind = asBaseDocumentKind(deposit.instrumento);
    return {
      kind: "DEPOSITO_CUENTAS",
      label: "Depósito de cuentas anuales",
      baseDocumentKind,
      procedureProfileCode: "DEPOSITO_CUENTAS",
      deadlineDays: asPositiveDays(deposit.plazoDias),
      canPrepareFiling: Boolean(baseDocumentKind),
    };
  }

  return {
    kind: "NO_TRAMITABLE",
    label: "Sin trámite registral derivado",
    baseDocumentKind: null,
    procedureProfileCode: null,
    deadlineDays: null,
    canPrepareFiling: false,
  };
}
