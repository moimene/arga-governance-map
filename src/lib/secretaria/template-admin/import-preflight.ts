/**
 * Preflight compartido para paquetes de importación.
 *
 * Es read-only: parsea, carga contexto de plantillas ACTIVA y ejecuta Gate
 * PRE con target BORRADOR. El wizard lo usa en el paso 3 y el hook de commit
 * lo re-ejecuta justo antes de insertar como defensa de concurrencia.
 */

import { validateTemplateForActivation } from "./gate-pre";
import { loadAllActiveTemplates } from "./cloud-helpers";
import {
  parseImport,
  type ParseResultFail,
} from "./template-importer";
import type { TemplateImportPayload } from "./template-import-schema";
import type {
  GatePreResult,
  PlantillaCandidate,
} from "./types";

export type TemplateImportPreflightRequest = {
  json: unknown;
  tenantId: string;
  ackMotivo?: string;
  requireWarningAck?: boolean;
};

export type TemplateImportPreflightResult =
  | { ok: true; payload: TemplateImportPayload; gatePre: GatePreResult }
  | { ok: false; reason: "PARSE_FAILED"; details: unknown }
  | { ok: false; reason: "GATE_PRE_BLOCKING"; gatePre: GatePreResult }
  | { ok: false; reason: "WARNINGS_NEED_ACK"; gatePre: GatePreResult };

export async function runTemplateImportPreflight(
  req: TemplateImportPreflightRequest,
): Promise<TemplateImportPreflightResult> {
  const parsed = parseImport(req.json);
  if (!parsed.ok) {
    const fail = parsed as ParseResultFail;
    return {
      ok: false,
      reason: "PARSE_FAILED",
      details: fail.error.issues,
    };
  }

  const others = await loadAllActiveTemplates(req.tenantId);

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

  const gatePre = validateTemplateForActivation(candidate, {
    tenantId: req.tenantId,
    existingActiveTemplates: others,
    targetEstado: "BORRADOR",
  });

  if (gatePre.summary.blocking > 0) {
    return { ok: false, reason: "GATE_PRE_BLOCKING", gatePre };
  }
  if (
    req.requireWarningAck &&
    gatePre.summary.warning > 0 &&
    (!req.ackMotivo || req.ackMotivo.length < 20)
  ) {
    return { ok: false, reason: "WARNINGS_NEED_ACK", gatePre };
  }

  return { ok: true, payload: parsed.payload, gatePre };
}
