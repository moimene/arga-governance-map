/**
 * Lógica del importador: parse + conversión Cloud↔payload + buildDraftRow.
 *
 * Sprint 1 — Commit 6 (Task 6.2). Spec §6.
 *
 * Tres entradas públicas:
 *
 *  - `parseImport(input)`: normaliza alias de `organo_tipo` (e.g.
 *    `CONSEJO_ADMINISTRACION` → `CONSEJO_ADMIN`) ANTES de validar con
 *    `TemplateImportSchema`. Devuelve discriminated union
 *    `{ ok: true; payload }` o `{ ok: false; error: z.ZodError }`.
 *
 *  - `buildDraftRow(payload, ctx)`: produce el objeto plano con claves
 *    snake_case esperadas por `plantillas_protegidas.insert` (BORRADOR,
 *    sin aprobada_por/fecha_aprobacion). Es lo que consume
 *    `createDraftFromImport` (Commit 4 service).
 *
 *  - `convertCloudRowToImportPayload(row)`: dirección inversa. Toma una
 *    fila ACTIVA y la convierte al shape del importador para validación
 *    regresiva (test D15). Devuelve `unknown` para que el caller siempre
 *    pase por `safeParse`.
 *
 * También expone `throwIfImportError(parsed)` como assertion para flujos
 * que prefieren lanzar TemplateAdminError en lugar de propagar el union.
 */

import type { z } from "zod";
import {
  TemplateImportSchema,
  type TemplateImportPayload,
} from "./template-import-schema";
import { normalizeOrganoTipo } from "./organo-canonico";
import type { PlantillaCandidate } from "./types";
import { TemplateAdminError } from "./types";
import { resolveMateriaAlias } from "../agenda-materias";

export type ParseResultOk = { ok: true; payload: TemplateImportPayload };
export type ParseResultFail = { ok: false; error: z.ZodError };
export type ParseResult = ParseResultOk | ParseResultFail;

/**
 * Parsea un input JSON contra `TemplateImportSchema`.
 *
 * Normalización de `organo_tipo` antes de validar: si el caller envía
 * un alias legacy (`CONSEJO_ADMINISTRACION`, `CONSEJO`, etc.), se
 * mapea a su forma canónica mediante `normalizeOrganoTipo` antes de
 * que Zod aplique el enum estricto. Esto permite aceptar paquetes
 * legacy sin relajar la enum.
 *
 * Si la normalización devuelve `null` (alias desconocido), no se
 * muta — el schema entonces emitirá el error de `OrganoCanonicoEnum`,
 * que es la conducta deseada.
 */
export function parseImport(input: unknown): ParseResult {
  // Clonar superficie para no mutar el input del caller
  const obj =
    typeof input === "object" && input !== null
      ? { ...(input as Record<string, unknown>) }
      : input;
  if (obj && typeof obj === "object" && "template" in obj) {
    const t = (obj as { template?: Record<string, unknown> }).template;
    if (t && typeof t.organo_tipo === "string") {
      const normalized = normalizeOrganoTipo(t.organo_tipo);
      if (normalized) t.organo_tipo = normalized;
    }
  }
  const r = TemplateImportSchema.safeParse(obj);
  if (r.success) return { ok: true, payload: r.data };
  return { ok: false, error: r.error };
}

/**
 * Construye la fila para `plantillas_protegidas.insert` desde un payload
 * validado. Estado fijo `BORRADOR`; `aprobada_por` / `fecha_aprobacion`
 * `null` (los rellena Comité Legal en `ACTIVA`).
 *
 * Importante: el caller debe pasar `tenant_id` en `ctx` aunque el
 * service de Commit 4 (`createDraftFromImport`) lo re-asigne — preserva
 * compatibilidad con el batch import (Commit 7), que invoca esta
 * función directamente con service-role.
 */
export function buildDraftRow(
  payload: TemplateImportPayload,
  ctx: { tenantId: string; actor: string },
): Record<string, unknown> {
  return {
    tenant_id: ctx.tenantId,
    tipo: payload.template.tipo,
    // Codex adversarial (P2): el esquema acepta alias legacy (p.ej. el plural
    // APROBACION_PRESUPUESTOS). Si se persistieran tal cual, la plantilla no
    // aparecería al pedir la materia canónica y reintroduciría el duplicado que
    // el saneamiento de alias acaba de cerrar.
    materia: resolveMateriaAlias(payload.template.materia),
    materia_acuerdo: payload.template.materia_acuerdo
      ? resolveMateriaAlias(payload.template.materia_acuerdo)
      : null,
    jurisdiccion: payload.template.jurisdiccion,
    version: payload.template.version,
    estado: "BORRADOR",
    organo_tipo: payload.template.organo_tipo,
    adoption_mode: payload.template.adoption_mode,
    referencia_legal: payload.template.referencia_legal,
    capa1_inmutable: payload.capa1_inmutable,
    capa2_variables: payload.capa2_variables,
    capa3_editables: payload.capa3_editables,
    notas_legal: payload.notas_legal ?? null,
    aprobada_por: null,
    fecha_aprobacion: null,
    snapshot_rule_pack_required:
      payload.template.snapshot_rule_pack_required ?? false,
    contrato_variables_version:
      payload.template.contrato_variables_version ?? null,
  };
}

/**
 * Convierte una fila Cloud (`PlantillaCandidate`) al shape del importador
 * para que pueda ser re-validada por `TemplateImportSchema`.
 *
 * Calibraciones D15:
 *  - `template.materia` toma `row.materia_acuerdo ?? row.materia` para
 *    coincidir con la materia jurídica efectiva, no la materia genérica
 *    derivada del tipo.
 *  - `template.materia_acuerdo` queda `undefined` si la fila no tiene
 *    `materia_acuerdo` para que el `.optional()` del schema no rechace.
 *  - `capa2_variables` / `capa3_editables` se coercen a `[]` cuando Cloud
 *    devuelve `null` (columnas pre-Sprint-1).
 *  - Devuelve `unknown` para forzar al caller a re-parsear con `safeParse`.
 *    El test D15 nunca asume que el resultado sea válido.
 */
export function convertCloudRowToImportPayload(row: PlantillaCandidate): unknown {
  return {
    schema_version: "secretaria.template_import.v1",
    template: {
      tipo: row.tipo,
      materia: row.materia_acuerdo ?? row.materia,
      materia_acuerdo: row.materia_acuerdo ?? undefined,
      jurisdiccion: row.jurisdiccion,
      version: row.version,
      organo_tipo: row.organo_tipo,
      adoption_mode: row.adoption_mode,
      referencia_legal: row.referencia_legal,
    },
    capa1_inmutable: row.capa1_inmutable ?? "",
    capa2_variables: row.capa2_variables ?? [],
    capa3_editables: row.capa3_editables ?? [],
  };
}

/**
 * Type assertion para flujos que prefieren lanzar antes que propagar
 * el discriminated union. Útil en scripts batch (Commit 7) donde
 * cualquier error termina la ejecución.
 */
export function throwIfImportError(
  parsed: ParseResult,
): asserts parsed is ParseResultOk {
  if (parsed.ok) return;
  // El narrowing del discriminant `ok` falla en algunas versiones de TS
  // con strictNullChecks=false (config raíz). Acceder al union completo
  // y type-guard manual es la forma robusta.
  const err = (parsed as ParseResultFail).error;
  throw new TemplateAdminError("PARSE_FAILED", err.message, err);
}
