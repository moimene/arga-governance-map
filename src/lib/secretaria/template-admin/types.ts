/**
 * Tipos compartidos del módulo template-admin.
 * Sprint 1 — refactor consola Gestor de Plantillas.
 */

import type { PlantillaProtegidaRow } from "@/hooks/usePlantillasProtegidas";

export type EstadoPlantilla =
  | "BORRADOR"
  | "REVISADA"
  | "APROBADA"
  | "ACTIVA"
  | "ARCHIVADA"
  | "DEPRECADA";

export type GatePreSeverity = "BLOCKING" | "WARNING" | "INFO";

export type GatePreIssue = {
  severity: GatePreSeverity;
  code: string;
  message: string;
  field?: string;
  hint?: string;
};

export type GatePreResult = {
  ok: boolean;
  issues: GatePreIssue[];
  summary: { blocking: number; warning: number; info: number };
};

export type PlantillaCandidate = Pick<
  PlantillaProtegidaRow,
  | "id"
  | "tipo"
  | "materia"
  | "materia_acuerdo"
  | "jurisdiccion"
  | "version"
  | "estado"
  | "organo_tipo"
  | "adoption_mode"
  | "aprobada_por"
  | "fecha_aprobacion"
  | "referencia_legal"
  | "capa1_inmutable"
  | "capa2_variables"
  | "capa3_editables"
>;

export type FunctionalKey = {
  tenantId: string;
  tipo: string;
  jurisdiccion: string;
  materia: string;
  organoTipo: string;
  adoptionMode: string;
  tipoSocial: string | null;
};

export type ChangelogEntry = {
  plantillaId: string;
  tenantId: string;
  bumpType: "PATCH" | "MINOR" | "MAJOR";
  motivo: string;
  diffSummary: Record<string, unknown>;
  fromVersion: string | null;
  toVersion: string;
  autor: string;
  ackMotivo?: string | null;
};

export class TemplateAdminError extends Error {
  constructor(
    public code: string,
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "TemplateAdminError";
  }
}
