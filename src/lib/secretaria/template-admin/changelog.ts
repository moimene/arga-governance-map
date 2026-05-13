/**
 * Gestión del plantilla_changelog con idempotencia 5s bucket.
 * Sprint 1 — Spec §7.3, §7.4.
 *
 * Reglas clave:
 * - `computeIdempotencyKey`: hash determinista FNV-1a 32 bit que agrupa
 *   intentos dentro de una ventana de 5 segundos. Permite que dobles
 *   submits del UI no generen entradas duplicadas en el changelog.
 * - `appendChangelog`: si encuentra una entrada existente con el mismo
 *   key idempotente para la plantilla, devuelve su id sin insertar
 *   (no-op idempotente). De lo contrario, inserta con motivo sufijado
 *   `[<key>]` y devuelve el id nuevo.
 * - `buildDiffSummary`: normaliza el resumen a snake_case. Cloud define
 *   `diff_summary` como `text`, por lo que `appendChangelog` lo serializa
 *   antes de insertar.
 * - Cloud impone `UNIQUE(plantilla_id, to_version)`. Como el changelog es
 *   un event log y puede haber varios cambios sobre la misma versión lógica,
 *   `appendChangelog` persiste `to_version` como versión lógica + token
 *   idempotente, conservando la versión lógica dentro de `diff_summary`.
 */

import { supabase } from "@/integrations/supabase/client";
import type { ChangelogEntry } from "./types";
import { TemplateAdminError } from "./types";

const BUCKET_5S = 5000;

export function computeIdempotencyKey(
  plantillaId: string,
  toVersion: string,
  timestampMs: number = Date.now(),
  discriminator: string = "",
): string {
  const bucket = Math.floor(timestampMs / BUCKET_5S);
  const raw = `${plantillaId}|${toVersion}|${bucket}|${discriminator}`;
  // Hash determinista corto (FNV-1a 32 bit es suficiente para una clave de minuto)
  let h = 0x811c9dc5;
  for (let i = 0; i < raw.length; i += 1) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `idemp:${(h >>> 0).toString(16).padStart(8, "0")}`;
}

export type DiffSummaryInput =
  | { action: "STATE_CHANGE"; fromState: string; toState: string }
  | { action: "IMPORT"; source: "wizard" | "batch"; ack?: boolean }
  | { action: "CONTENT"; layers: Array<"capa1" | "capa2" | "capa3" | "notas_legal"> }
  | { action: "ARCHIVE"; reason: string };

export function buildDiffSummary(input: DiffSummaryInput): Record<string, unknown> {
  if (input.action === "STATE_CHANGE") {
    return { action: "STATE_CHANGE", from_state: input.fromState, to_state: input.toState };
  }
  if (input.action === "IMPORT") {
    return { action: "IMPORT", source: input.source, ack: input.ack ?? false };
  }
  if (input.action === "CONTENT") {
    return { action: "CONTENT", layers: input.layers };
  }
  return { action: "ARCHIVE", reason: input.reason };
}

export function serializeDiffSummary(
  diffSummary: Record<string, unknown>,
  meta: { logicalToVersion: string; ackMotivo?: string | null },
): string {
  return JSON.stringify({
    ...diffSummary,
    logical_to_version: meta.logicalToVersion,
    ...(meta.ackMotivo ? { ack_motivo: meta.ackMotivo } : {}),
  });
}

export function buildEventToVersion(logicalToVersion: string, idempotencyKey: string): string {
  return `${logicalToVersion}#${idempotencyKey}`;
}

export async function appendChangelog(entry: ChangelogEntry): Promise<{ id: string }> {
  const diffSummaryText = serializeDiffSummary(entry.diffSummary, {
    logicalToVersion: entry.toVersion,
    ackMotivo: entry.ackMotivo,
  });
  const idempotencyKey = computeIdempotencyKey(
    entry.plantillaId,
    entry.toVersion,
    Date.now(),
    `${entry.motivo}|${diffSummaryText}`,
  );
  const motivoConHash = `${entry.motivo} [${idempotencyKey}]`;
  const eventToVersion = buildEventToVersion(entry.toVersion, idempotencyKey);

  // Verificar si ya existe entrada idempotente. El token se busca con
  // corchetes completos para evitar colisiones por substring.
  const { data: existing, error: lookupError } = await supabase
    .from("plantilla_changelog")
    .select("id")
    .eq("tenant_id", entry.tenantId)
    .eq("plantilla_id", entry.plantillaId)
    .ilike("motivo", `%[${idempotencyKey}]%`)
    .limit(1);
  if (lookupError) {
    throw new TemplateAdminError(
      "CHANGELOG_LOOKUP_FAILED",
      "Failed to check changelog idempotency",
      lookupError,
    );
  }
  const existingRow = existing?.[0];
  if (existingRow) return { id: existingRow.id as string };

  const { data, error } = await supabase
    .from("plantilla_changelog")
    .insert({
      tenant_id: entry.tenantId,
      plantilla_id: entry.plantillaId,
      bump_type: entry.bumpType,
      motivo: motivoConHash,
      diff_summary: diffSummaryText,
      from_version: entry.fromVersion,
      to_version: eventToVersion,
      autor: entry.autor,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new TemplateAdminError("CHANGELOG_INSERT_FAILED", "Failed to append changelog", error);
  }
  return { id: data.id as string };
}
