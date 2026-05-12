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
 * - `buildDiffSummary`: normaliza el JSON `diff_summary` a snake_case
 *   para coherencia con el esquema Cloud.
 */

import { supabase } from "@/integrations/supabase/client";
import type { ChangelogEntry } from "./types";
import { TemplateAdminError } from "./types";

const BUCKET_5S = 5000;

export function computeIdempotencyKey(
  plantillaId: string,
  toVersion: string,
  timestampMs: number = Date.now(),
): string {
  const bucket = Math.floor(timestampMs / BUCKET_5S);
  const raw = `${plantillaId}|${toVersion}|${bucket}`;
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
  | { action: "CONTENT"; layers: Array<"capa1" | "capa2" | "capa3"> }
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

export async function appendChangelog(entry: ChangelogEntry): Promise<{ id: string }> {
  const idempotencyKey = computeIdempotencyKey(entry.plantillaId, entry.toVersion);
  const motivoConHash = `${entry.motivo} [${idempotencyKey}]`;

  // Verificar si ya existe entrada idempotente
  const { data: existing } = await supabase
    .from("plantilla_changelog")
    .select("id")
    .eq("plantilla_id", entry.plantillaId)
    .ilike("motivo", `%${idempotencyKey}%`)
    .maybeSingle();
  if (existing) return { id: existing.id as string };

  const { data, error } = await supabase
    .from("plantilla_changelog")
    .insert({
      tenant_id: entry.tenantId,
      plantilla_id: entry.plantillaId,
      bump_type: entry.bumpType,
      motivo: motivoConHash,
      diff_summary: entry.diffSummary,
      from_version: entry.fromVersion,
      to_version: entry.toVersion,
      autor: entry.autor,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new TemplateAdminError("CHANGELOG_INSERT_FAILED", "Failed to append changelog", error);
  }
  return { id: data.id as string };
}
