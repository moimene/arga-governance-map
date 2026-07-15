/**
 * Servicio central de mutaciones de plantillas.
 * Sprint 1 — Spec §7. Centraliza state machine + Gate PRE + changelog.
 *
 * Punto único de entrada para todas las transiciones de estado y
 * para la creación de borradores desde el importador. Owns:
 *
 * - `TRANSITION_MATRIX`: tabla de transiciones permitidas (state machine).
 * - `transitionTemplateState`: aplica Gate PRE cuando destino es ACTIVA y
 *   delega toda transición a una RPC transaccional con CAS, changelog WORM y
 *   sustitución de la vigente exacta cuando corresponda.
 * - `createDraftFromImport`: inserta plantilla en BORRADOR y registra
 *   IMPORT en changelog, eliminando la plantilla huérfana si el log falla.
 *
 * Discriminated unions en `TransitionResult` permiten al caller saber
 * exactamente qué se rechazó (Gate PRE bloqueante, falta ack de warnings,
 * transición prohibida, etc.) sin lanzar excepciones para flujos normales.
 */

import { supabase } from "@/integrations/supabase/client";
import type {
  EstadoPlantilla,
  GatePreIssue,
  PlantillaCandidate,
} from "./types";
import { TemplateAdminError } from "./types";
import { validateTemplateForActivation } from "./gate-pre";
import { appendChangelog, buildDiffSummary } from "./changelog";
import { loadAllActiveTemplates } from "./cloud-helpers";
import { findFunctionalDuplicates } from "./functional-key";

export type TransitionInput = {
  plantillaId: string;
  to: EstadoPlantilla;
  motivo: string;
  /** Compatibilidad con hooks existentes; la RPC deriva el actor de la sesión. */
  actor: string;
  ackWarnings?: boolean;
  aprobadaPor?: string;
  fechaAprobacion?: string;
  /** Permite reusar la misma operación en un retry de transporte. */
  operationId?: string;
  /** Estado observado al abrir la decisión; se conserva durante el reconocimiento. */
  expectedFrom?: EstadoPlantilla;
  /**
   * Predecesora concreta reconocida por el usuario. `null` fija explícitamente
   * que no existía ninguna; `undefined` permite descubrirla en el primer intento.
   */
  expectedPredecessorId?: string | null;
};

export type TransitionAttemptContext = {
  operationId: string;
  expectedFrom: EstadoPlantilla;
  expectedPredecessorId: string | null;
};

export type TransitionResult =
  | {
      ok: true;
      plantillaId: string;
      from: string;
      to: string;
      changelogId: string;
      operationId: string;
      replayed: boolean;
      archivedTemplateId?: string;
      archivedChangelogId?: string;
      bindingsMoved: number;
    }
  | { ok: false; reason: "NOT_FOUND" }
  | { ok: false; reason: "GATE_PRE_BLOCKING"; issues: GatePreIssue[] }
  | ({ ok: false; reason: "WARNINGS_NEED_ACK"; issues: GatePreIssue[] } &
      TransitionAttemptContext)
  | { ok: false; reason: "INVALID_TRANSITION"; from: string; to: string }
  | { ok: false; reason: "MISSING_APPROVAL_DATA" }
  | { ok: false; reason: "ACTIVE_BINDINGS_REQUIRE_REPLACEMENT"; error?: unknown }
  | { ok: false; reason: "STALE_STATE"; expected: string; error?: unknown }
  | {
      ok: false;
      reason: "STALE_PREDECESSOR";
      expected: string | null;
      error?: unknown;
    }
  | { ok: false; reason: "RPC_FAILED"; error: unknown };

export const TRANSITION_MATRIX: Record<EstadoPlantilla, EstadoPlantilla[]> = {
  BORRADOR: ["REVISADA", "ARCHIVADA"],
  REVISADA: ["APROBADA", "BORRADOR", "ARCHIVADA"],
  APROBADA: ["ACTIVA", "BORRADOR", "ARCHIVADA"],
  ACTIVA: ["ARCHIVADA"],
  ARCHIVADA: [], // terminal
  DEPRECADA: [], // compatibilidad histórica; terminal y sin transición ejecutable
};

export function isTransitionAllowed(from: EstadoPlantilla, to: EstadoPlantilla): boolean {
  return TRANSITION_MATRIX[from]?.includes(to) ?? false;
}

type TransitionRpcPayload = {
  ok?: boolean;
  reason?: string;
  plantilla_id?: string;
  from?: string;
  to?: string;
  changelog_id?: string;
  operation_id?: string;
  replayed?: boolean;
  archived_template_id?: string | null;
  archived_changelog_id?: string | null;
  bindings_moved?: number | null;
};

function errorText(error: unknown): string {
  if (!error || typeof error !== "object") return String(error ?? "");
  const candidate = error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown };
  return [candidate.code, candidate.message, candidate.details, candidate.hint]
    .filter(Boolean)
    .map(String)
    .join(" ");
}

/**
 * Solo estos fallos dejan ambiguo si el servidor confirmó la transacción pero
 * se perdió la respuesta. Los errores SQL/RLS/CAS no se reintentan.
 */
function isAmbiguousTransportFailure(error: unknown): boolean {
  return /failed to fetch|fetch failed|network(?:error)?|load failed|econnreset|etimedout|connection reset|connection closed|socket hang up|bad gateway|gateway timeout|service unavailable|\b50[234]\b/i.test(
    errorText(error),
  );
}

function mapRpcFailure(
  error: unknown,
  payload: TransitionRpcPayload | null,
  context: { from: string; to: string; expectedPredecessorId: string | null },
): TransitionResult {
  const reason = String(payload?.reason ?? "").toUpperCase();
  const text = `${reason} ${errorText(error)}`;
  if (/NOT_FOUND|NO ENCONTRAD|NOT FOUND/i.test(text)) {
    return { ok: false, reason: "NOT_FOUND" };
  }
  if (/MISSING_APPROVAL|APROBACI[ÓO]N FORMAL|APPROVAL DATA/i.test(text)) {
    return { ok: false, reason: "MISSING_APPROVAL_DATA" };
  }
  if (/ACTIVE_BINDINGS_REQUIRE_REPLACEMENT|ACTIVE BINDINGS.*REPLACEMENT/i.test(text)) {
    return { ok: false, reason: "ACTIVE_BINDINGS_REQUIRE_REPLACEMENT", error };
  }
  if (/INVALID_TRANSITION|INVALID TEMPLATE STATE|TRANSICI[ÓO]N.*NO PERMITIDA/i.test(text)) {
    return { ok: false, reason: "INVALID_TRANSITION", from: context.from, to: context.to };
  }
  if (/STALE_PREDECESSOR|PREDECESORA.*(CAMBI|ESPERAD)|PREDECESSOR.*MISMATCH/i.test(text)) {
    return {
      ok: false,
      reason: "STALE_PREDECESSOR",
      expected: context.expectedPredecessorId,
      error,
    };
  }
  if (/STALE_STATE|ESTADO.*(CAMBI|ESPERAD)|EXPECTED_FROM|STATE.*MISMATCH/i.test(text)) {
    return { ok: false, reason: "STALE_STATE", expected: context.from, error };
  }
  return { ok: false, reason: "RPC_FAILED", error: error ?? payload };
}

export async function transitionTemplateState(
  input: TransitionInput,
  ctx: { tenantId: string },
): Promise<TransitionResult> {
  // 1. Load actual
  const { data: current, error: e0 } = await supabase
    .from("plantillas_protegidas")
    .select(
      "id, tipo, materia, materia_acuerdo, jurisdiccion, version, estado, organo_tipo, adoption_mode, tipo_social, aprobada_por, fecha_aprobacion, referencia_legal, capa1_inmutable, capa2_variables, capa3_editables",
    )
    .eq("id", input.plantillaId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (e0 || !current) return { ok: false, reason: "NOT_FOUND" };

  const actualFrom = current.estado as EstadoPlantilla;
  const from = input.expectedFrom ?? actualFrom;

  if (input.expectedFrom && actualFrom !== input.expectedFrom) {
    return { ok: false, reason: "STALE_STATE", expected: input.expectedFrom };
  }

  if (!isTransitionAllowed(from, input.to)) {
    return { ok: false, reason: "INVALID_TRANSITION", from, to: input.to };
  }

  const nextAprobadaPor = input.aprobadaPor ?? (current.aprobada_por as string | null);
  const nextFechaAprobacion =
    input.fechaAprobacion ?? (current.fecha_aprobacion as string | null);

  if (
    input.to === "APROBADA" &&
    (!input.aprobadaPor?.trim() || !input.fechaAprobacion?.trim())
  ) {
    return { ok: false, reason: "MISSING_APPROVAL_DATA" };
  }

  const operationId = input.operationId ?? crypto.randomUUID();
  let expectedPredecessorId: string | null = input.expectedPredecessorId ?? null;

  // 2. Gate PRE solo si destino es ACTIVA. Una única vigente de la misma
  // identidad es una sustitución atómica reconocible; más de una sigue siendo
  // corrupción bloqueante y nunca se delega a la RPC.
  if (input.to === "ACTIVA") {
    const others = await loadAllActiveTemplates(ctx.tenantId);
    const candidate = {
      ...(current as PlantillaCandidate),
      aprobada_por: nextAprobadaPor,
      fecha_aprobacion: nextFechaAprobacion,
    };
    const predecessors = findFunctionalDuplicates(candidate, others, ctx.tenantId, {
      states: ["ACTIVA"],
    });
    const discoveredPredecessorId = predecessors.length === 1 ? predecessors[0].id : null;
    const predecessorWasPinned = input.expectedPredecessorId !== undefined;
    if (
      predecessorWasPinned &&
      (predecessors.length > 1 || discoveredPredecessorId !== expectedPredecessorId)
    ) {
      return {
        ok: false,
        reason: "STALE_PREDECESSOR",
        expected: expectedPredecessorId,
      };
    }
    if (!predecessorWasPinned) expectedPredecessorId = discoveredPredecessorId;
    const result = validateTemplateForActivation(candidate, {
      tenantId: ctx.tenantId,
      existingActiveTemplates: others,
      targetEstado: "ACTIVA",
      atomicReplacement: { expectedPredecessorId },
    });
    if (result.summary.blocking > 0) {
      return { ok: false, reason: "GATE_PRE_BLOCKING", issues: result.issues };
    }
    const replacementAckWasNotPinned =
      predecessors.length === 1 && input.ackWarnings === true && !predecessorWasPinned;
    if (result.summary.warning > 0 && (!input.ackWarnings || replacementAckWasNotPinned)) {
      return {
        ok: false,
        reason: "WARNINGS_NEED_ACK",
        issues: result.issues,
        operationId,
        expectedFrom: from,
        expectedPredecessorId,
      };
    }
  }

  // 3. Una sola llamada cambia estado, mueve bindings, archiva la predecesora
  // exacta y escribe el changelog. El actor y el tenant se derivan en servidor.
  const rpcParams = {
    p_template_id: input.plantillaId,
    p_expected_from: from,
    p_to_state: input.to,
    p_motivo: input.motivo,
    p_operation_id: operationId,
    p_expected_predecessor_id: expectedPredecessorId,
    p_aprobada_por: input.aprobadaPor ?? null,
    p_fecha_aprobacion: input.fechaAprobacion ?? null,
    p_ack_warnings: input.ackWarnings ?? false,
  };
  const invokeRpc = async (): Promise<{ data: unknown; error: unknown }> => {
    try {
      const { data, error } = await supabase.rpc(
        "fn_secretaria_transition_template_state",
        rpcParams,
      );
      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  };

  let { data: rpcData, error: rpcError } = await invokeRpc();
  if (rpcError && isAmbiguousTransportFailure(rpcError)) {
    // Un único replay con el MISMO payload. Si el primer intento confirmó y la
    // respuesta se perdió, el ledger de la RPC devuelve el resultado guardado.
    ({ data: rpcData, error: rpcError } = await invokeRpc());
  }
  const payload = (rpcData ?? null) as TransitionRpcPayload | null;
  if (rpcError || !payload?.ok) {
    return mapRpcFailure(rpcError, payload, {
      from,
      to: input.to,
      expectedPredecessorId,
    });
  }

  if (!payload.plantilla_id || !payload.changelog_id) {
    return {
      ok: false,
      reason: "RPC_FAILED",
      error: new Error("La transición atómica devolvió una respuesta incompleta"),
    };
  }

  return {
    ok: true,
    plantillaId: payload.plantilla_id,
    from: payload.from ?? from,
    to: payload.to ?? input.to,
    changelogId: payload.changelog_id,
    operationId: payload.operation_id ?? operationId,
    replayed: payload.replayed ?? false,
    ...(payload.archived_template_id
      ? { archivedTemplateId: payload.archived_template_id }
      : {}),
    ...(payload.archived_changelog_id
      ? { archivedChangelogId: payload.archived_changelog_id }
      : {}),
    bindingsMoved: Number(payload.bindings_moved ?? 0),
  };
}

export type CreateDraftInput = {
  draftRow: Record<string, unknown>;
  fromVersion: string | null;
  toVersion: string;
  actor: string;
  ackMotivo?: string;
};

export async function createDraftFromImport(
  input: CreateDraftInput,
  ctx: { tenantId: string },
): Promise<{ plantillaId: string }> {
  // 1. Insert borrador
  const { data, error } = await supabase
    .from("plantillas_protegidas")
    .insert({ ...input.draftRow, tenant_id: ctx.tenantId, estado: "BORRADOR" })
    .select("id")
    .single();
  if (error || !data) {
    throw new TemplateAdminError("PLANTILLA_INSERT_FAILED", "Failed to insert draft", error);
  }
  const plantillaId = data.id as string;

  // 2. Changelog con rollback compensatorio: si el log falla, eliminamos
  //    la plantilla recién insertada para no dejarla huérfana.
  try {
    await appendChangelog({
      plantillaId,
      tenantId: ctx.tenantId,
      bumpType: "MINOR",
      motivo: "IMPORT",
      diffSummary: buildDiffSummary({
        action: "IMPORT",
        source: "wizard",
        ack: !!input.ackMotivo,
      }),
      fromVersion: input.fromVersion,
      toVersion: input.toVersion,
      autor: input.actor,
      ackMotivo: input.ackMotivo ?? null,
    });
    return { plantillaId };
  } catch (err) {
    await supabase.from("plantillas_protegidas").delete().eq("id", plantillaId);
    throw new TemplateAdminError("CHANGELOG_INSERT_FAILED", "Rolled back orphan", err);
  }
}
