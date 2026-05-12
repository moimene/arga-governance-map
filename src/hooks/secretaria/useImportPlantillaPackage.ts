/**
 * useImportPlantillaPackage — pipeline de importación JSON wizard (Fase 2).
 *
 * Sprint 1 — Commit 6 (Task 6.4). Spec §6 + §10.3.
 *
 * Commit explícito del paso 5 del wizard. Re-ejecuta el preflight read-only
 * antes de escribir para defenderse de drift de concurrencia, pero no se
 * usa ya para el paso 3 del wizard.
 *
 *  1. `runTemplateImportPreflight(..., requireWarningAck=true)`.
 *  2. `buildDraftRow(payload, ctx)` produce el shape Cloud.
 *  3. `createDraftFromImport(...)` inserta en BORRADOR
 *     y escribe la entry IMPORT en changelog, con rollback compensatorio
 *     si el changelog falla.
 *  4. onSuccess invalida cachés solo si el resultado fue `{ ok: true }`.
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
} from "@/lib/secretaria/template-admin/template-importer";
import { runTemplateImportPreflight } from "@/lib/secretaria/template-admin/import-preflight";
import type { GatePreResult } from "@/lib/secretaria/template-admin/types";

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

      const preflight = await runTemplateImportPreflight({
        json: req.json,
        tenantId,
        ackMotivo: req.ackMotivo,
        requireWarningAck: true,
      });
      if (!preflight.ok) return preflight as ImportResult;

      // Step 4 + 5 — insertar borrador + changelog IMPORT.
      try {
        const draftRow = buildDraftRow(preflight.payload, {
          tenantId,
          actor: user.email ?? user.id,
        });
        const { plantillaId } = await createDraftFromImport(
          {
            draftRow,
            fromVersion: null,
            toVersion: preflight.payload.template.version,
            actor: user.email ?? user.id,
            ackMotivo: req.ackMotivo,
          },
          { tenantId },
        );
        return { ok: true, plantillaId, gatePre: preflight.gatePre };
      } catch (err) {
        return { ok: false, reason: "INSERT_FAILED", details: err };
      }
    },
    onSuccess: (data) => {
      if (!data.ok) return;
      qc.invalidateQueries({ queryKey: ["plantillas_protegidas"] });
      qc.invalidateQueries({ queryKey: ["plantilla_changelog"] });
    },
  });
}
