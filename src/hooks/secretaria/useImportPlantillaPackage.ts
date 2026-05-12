/**
 * useImportPlantillaPackage — pipeline de importación JSON wizard (Fase 2).
 *
 * Sprint 1 — Commit 6 (Task 6.4). Spec §6 + §10.3.
 *
 * Pasos atómicos (todo en mutationFn, sin estado intermedio):
 *
 *  1. `parseImport(req.json)` con normalización de alias `organo_tipo`.
 *     Si falla → `{ ok: false, reason: "PARSE_FAILED", details: issues }`.
 *  2. `loadAllActiveTemplates(tenantId)` para construir el contexto Gate
 *     PRE (necesario para detectar duplicados activos).
 *  3. `validateTemplateForActivation(candidate, ctx)` headless. Si
 *     `summary.blocking > 0` → `{ ok: false, reason: "GATE_PRE_BLOCKING",
 *     gatePre }`. Permite mostrar los issues sin escribir nada.
 *  4. Si Gate PRE devuelve WARNING y no llega `ackMotivo`, retorna
 *     `WARNINGS_NEED_ACK` sin escribir.
 *  5. `buildDraftRow(payload, ctx)` produce el shape Cloud.
 *  6. `createDraftFromImport(...)` (Commit 4 service) inserta en BORRADOR
 *     y escribe la entry IMPORT en changelog, con rollback compensatorio
 *     si el changelog falla.
 *  7. onSuccess invalida `["plantillas_protegidas"]` y
 *     `["plantilla_changelog"]` para refrescar las queries del Catálogo
 *     y la Auditoría inmediatamente.
 *
 * `req.ackMotivo` (string ≥20 chars) se pasa solo cuando el wizard ya
 * mostró warnings al usuario y este ha reconocido seguir. Se persiste en
 * el changelog como evidencia de aceptación documental.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenantContext } from "@/context/TenantContext";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { createDraftFromImport } from "@/lib/secretaria/template-admin/template-admin-service";
import {
  buildDraftRow,
  parseImport,
  type ParseResultFail,
} from "@/lib/secretaria/template-admin/template-importer";
import { validateTemplateForActivation } from "@/lib/secretaria/template-admin/gate-pre";
import { loadAllActiveTemplates } from "@/lib/secretaria/template-admin/cloud-helpers";
import type {
  GatePreResult,
  PlantillaCandidate,
} from "@/lib/secretaria/template-admin/types";

export type ImportRequest = { json: unknown; ackMotivo?: string };

export type ImportResult =
  | { ok: true; plantillaId: string; gatePre: GatePreResult }
  | { ok: false; reason: "PARSE_FAILED"; details: unknown }
  | { ok: false; reason: "GATE_PRE_BLOCKING"; gatePre: GatePreResult }
  | { ok: false; reason: "WARNINGS_NEED_ACK"; gatePre: GatePreResult }
  | { ok: false; reason: "INSERT_FAILED"; details: unknown };

export function useImportPlantillaPackage() {
  const qc = useQueryClient();
  const { tenantId } = useTenantContext();
  const { user } = useCurrentUser();
  return useMutation({
    mutationFn: async (req: ImportRequest): Promise<ImportResult> => {
      if (!tenantId || !user) throw new Error("tenantId/user requeridos");

      // Step 1 — parse + normalización organo_tipo alias.
      const parsed = parseImport(req.json);
      if (!parsed.ok) {
        // Narrowing manual: el discriminant `ok` no siempre estrecha cuando
        // el `payload` inferido tiene props opcionales (CLAUDE.md indica
        // `strictNullChecks: false`). Acceder al fail branch directamente.
        const fail = parsed as ParseResultFail;
        return {
          ok: false,
          reason: "PARSE_FAILED",
          details: fail.error.issues,
        };
      }

      // Step 2 — contexto Gate PRE (existentes ACTIVA).
      const others = await loadAllActiveTemplates(tenantId);
      const ctx = { tenantId, existingActiveTemplates: others };

      // Construir candidato para Gate PRE. `id` es un sentinel
      // estable; detectActiveDuplicate filtra por id distinto, así
      // que cualquier string no-vacío evita falsos positivos.
      //
      // Los `as` debajo cruzan el tipo Zod-inferido (donde props llevan
      // `?` por defaults) hacia `PlantillaCandidate` (estricto). Tras la
      // validación safeParse los campos están siempre definidos.
      const candidate: PlantillaCandidate = {
        id: "<new>",
        tipo: parsed.payload.template.tipo as string,
        materia: parsed.payload.template.materia as string,
        materia_acuerdo: parsed.payload.template.materia_acuerdo ?? null,
        jurisdiccion: parsed.payload.template.jurisdiccion as string,
        version: parsed.payload.template.version as string,
        estado: "BORRADOR",
        organo_tipo: parsed.payload.template.organo_tipo as string,
        adoption_mode: parsed.payload.template.adoption_mode as string | null,
        aprobada_por: null,
        fecha_aprobacion: null,
        referencia_legal: parsed.payload.template.referencia_legal as string,
        capa1_inmutable: parsed.payload.capa1_inmutable as string,
        capa2_variables: parsed.payload.capa2_variables as Array<{
          variable: string;
          fuente: string;
          condicion: string;
        }>,
        capa3_editables: parsed.payload.capa3_editables as Array<{
          campo: string;
          obligatoriedad: string;
          descripcion: string;
        }>,
      };

      // Step 3 — Gate PRE headless.
      const gatePre = validateTemplateForActivation(candidate, {
        ...ctx,
        targetEstado: "BORRADOR",
      });
      if (gatePre.summary.blocking > 0) {
        return { ok: false, reason: "GATE_PRE_BLOCKING", gatePre };
      }
      if (gatePre.summary.warning > 0 && (!req.ackMotivo || req.ackMotivo.length < 20)) {
        return { ok: false, reason: "WARNINGS_NEED_ACK", gatePre };
      }

      // Step 4 + 5 — insertar borrador + changelog IMPORT.
      try {
        const draftRow = buildDraftRow(parsed.payload, {
          tenantId,
          actor: user.email ?? user.id,
        });
        const { plantillaId } = await createDraftFromImport(
          {
            draftRow,
            fromVersion: null,
            toVersion: parsed.payload.template.version,
            actor: user.email ?? user.id,
            ackMotivo: req.ackMotivo,
          },
          { tenantId },
        );
        return { ok: true, plantillaId, gatePre };
      } catch (err) {
        return { ok: false, reason: "INSERT_FAILED", details: err };
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plantillas_protegidas"] });
      qc.invalidateQueries({ queryKey: ["plantilla_changelog"] });
    },
  });
}
