/**
 * Servicio central de mutaciones de plantillas.
 * Sprint 1 — Spec §7. Centraliza state machine + Gate PRE + changelog.
 *
 * Punto único de entrada para todas las transiciones de estado y
 * para la creación de borradores desde el importador. Owns:
 *
 * - `TRANSITION_MATRIX`: tabla de transiciones permitidas (state machine).
 * - `transitionTemplateState`: aplica Gate PRE cuando destino es ACTIVA,
 *   actualiza estado, registra entry en changelog, y revierte el cambio
 *   de estado si el changelog falla (rollback compensatorio).
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

export type TransitionInput = {
  plantillaId: string;
  to: EstadoPlantilla;
  motivo: string;
  actor: string;
  ackWarnings?: boolean;
  aprobadaPor?: string;
  fechaAprobacion?: string;
};

export type TransitionResult =
  | { ok: true; plantillaId: string; from: string; to: string; changelogId: string }
  | { ok: false; reason: "NOT_FOUND" }
  | { ok: false; reason: "GATE_PRE_BLOCKING"; issues: GatePreIssue[] }
  | { ok: false; reason: "WARNINGS_NEED_ACK"; issues: GatePreIssue[] }
  | { ok: false; reason: "INVALID_TRANSITION"; from: string; to: string }
  | { ok: false; reason: "MISSING_APPROVAL_DATA" }
  | { ok: false; reason: "UPDATE_FAILED"; error: unknown }
  | {
      ok: false;
      reason: "CHANGELOG_FAILED";
      rolledBack: boolean;
      error?: unknown;
      rollbackError?: unknown;
    };

export const TRANSITION_MATRIX: Record<EstadoPlantilla, EstadoPlantilla[]> = {
  BORRADOR: ["REVISADA", "ARCHIVADA"],
  REVISADA: ["APROBADA", "BORRADOR", "ARCHIVADA"],
  APROBADA: ["ACTIVA", "BORRADOR", "ARCHIVADA"],
  ACTIVA: ["ARCHIVADA"],
  ARCHIVADA: [], // terminal
  DEPRECADA: ["ARCHIVADA"],
};

export function isTransitionAllowed(from: EstadoPlantilla, to: EstadoPlantilla): boolean {
  return TRANSITION_MATRIX[from]?.includes(to) ?? false;
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

  const from = current.estado as EstadoPlantilla;

  if (!isTransitionAllowed(from, input.to)) {
    return { ok: false, reason: "INVALID_TRANSITION", from, to: input.to };
  }

  const nextAprobadaPor = input.aprobadaPor ?? (current.aprobada_por as string | null);
  const nextFechaAprobacion =
    input.fechaAprobacion ?? (current.fecha_aprobacion as string | null);

  if (input.to === "APROBADA" && (!nextAprobadaPor || !nextFechaAprobacion)) {
    return { ok: false, reason: "MISSING_APPROVAL_DATA" };
  }

  // 2. Gate PRE solo si destino es ACTIVA
  if (input.to === "ACTIVA") {
    const others = await loadAllActiveTemplates(ctx.tenantId);
    const candidate = {
      ...(current as PlantillaCandidate),
      aprobada_por: nextAprobadaPor,
      fecha_aprobacion: nextFechaAprobacion,
    };
    const result = validateTemplateForActivation(candidate, {
      tenantId: ctx.tenantId,
      existingActiveTemplates: others,
      targetEstado: "ACTIVA",
    });
    if (result.summary.blocking > 0) {
      return { ok: false, reason: "GATE_PRE_BLOCKING", issues: result.issues };
    }
    if (result.summary.warning > 0 && !input.ackWarnings) {
      return { ok: false, reason: "WARNINGS_NEED_ACK", issues: result.issues };
    }
  }

  // 3. Update estado
  const update: Record<string, unknown> = { estado: input.to };
  if (input.to === "APROBADA" || input.to === "ACTIVA") {
    if (input.aprobadaPor) update.aprobada_por = input.aprobadaPor;
    if (input.fechaAprobacion) update.fecha_aprobacion = input.fechaAprobacion;
  }

  const { error: e1 } = await supabase
    .from("plantillas_protegidas")
    .update(update)
    .eq("id", input.plantillaId)
    .eq("tenant_id", ctx.tenantId);
  if (e1) return { ok: false, reason: "UPDATE_FAILED", error: e1 };

  // 4. Append changelog con rollback compensatorio
  try {
    const { id: changelogId } = await appendChangelog({
      plantillaId: input.plantillaId,
      tenantId: ctx.tenantId,
      bumpType: "PATCH",
      motivo: `STATE:${from}->${input.to} | ${input.motivo}`,
      diffSummary: buildDiffSummary({ action: "STATE_CHANGE", fromState: from, toState: input.to }),
      fromVersion: current.version as string,
      toVersion: current.version as string,
      autor: input.actor,
    });
    return { ok: true, plantillaId: input.plantillaId, from, to: input.to, changelogId };
  } catch (err) {
    // Rollback: revertir estado a "from" para no dejar la plantilla en un
    // estado avanzado sin registro en changelog (auditabilidad).
    try {
      const { error: rollbackError } = await supabase
        .from("plantillas_protegidas")
        .update({
          estado: from,
          aprobada_por: current.aprobada_por,
          fecha_aprobacion: current.fecha_aprobacion,
        })
        .eq("id", input.plantillaId)
        .eq("tenant_id", ctx.tenantId);

      if (rollbackError) {
        return {
          ok: false,
          reason: "CHANGELOG_FAILED",
          rolledBack: false,
          error: err,
          rollbackError,
        };
      }
      return { ok: false, reason: "CHANGELOG_FAILED", rolledBack: true, error: err };
    } catch (rollbackError) {
      return {
        ok: false,
        reason: "CHANGELOG_FAILED",
        rolledBack: false,
        error: err,
        rollbackError,
      };
    }
  }
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
