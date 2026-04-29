export type SecretariaSanitizedFlowId =
  | "agreement-360"
  | "convocatorias"
  | "reuniones"
  | "actas"
  | "certificaciones"
  | "gestor-documental"
  | "plantillas-pre"
  | "board-pack";

export type SecretariaFlowDemoStatus = "ready" | "partial" | "blocked";
export type SecretariaFlowSourceOfTruth = "Cloud" | "legacy" | "local pending" | "none";
export type SecretariaFlowParityRisk = "low" | "medium" | "high";
export type SecretariaFlowEvidenceLevel =
  | "none"
  | "OWNER_RECORD"
  | "GENERATED"
  | "ARCHIVED"
  | "BUNDLED"
  | "QTSP_SIGNED"
  | "AUDIT_VERIFIED"
  | "mixed";

export interface SecretariaSanitizedFlowContract {
  id: SecretariaSanitizedFlowId;
  label: string;
  demoStatus: SecretariaFlowDemoStatus;
  ownerTables: string[];
  sharedTables: string[];
  sourceOfTruth: SecretariaFlowSourceOfTruth;
  evidenceLevel: SecretariaFlowEvidenceLevel;
  parityRisk: SecretariaFlowParityRisk;
  migrationRequired: false;
  typesAffected: false;
  rlsRpcStorageAffected: false;
  pages: string[];
  hooks: string[];
  notes: string;
  blockers: string[];
}

export const SECRETARIA_SANITIZED_FLOW_CONTRACTS: SecretariaSanitizedFlowContract[] = [
  {
    id: "agreement-360",
    label: "Acuerdo 360",
    demoStatus: "ready",
    ownerTables: ["agreements", "meeting_resolutions", "no_session_resolutions", "unipersonal_decisions"],
    sharedTables: ["rule_evaluation_results", "evidence_bundles", "audit_log"],
    sourceOfTruth: "Cloud",
    evidenceLevel: "OWNER_RECORD",
    parityRisk: "medium",
    migrationRequired: false,
    typesAffected: false,
    rlsRpcStorageAffected: false,
    pages: ["ExpedienteAcuerdo", "ReunionStepper", "AcuerdoSinSesionDetalle", "DecisionDetalle"],
    hooks: ["useAgreementsList", "useReunionSecretaria", "useAcuerdosSinSesion", "useAgreementCompliance"],
    notes:
      "agreements.id es el identificador canonico del acto societario. Los documentos finales deben enlazarlo antes de considerarse cerrados.",
    blockers: [
      "Paridad de columnas JSON extendidas sigue sensible hasta regeneracion ordenada de tipos.",
    ],
  },
  {
    id: "convocatorias",
    label: "Convocatorias",
    demoStatus: "ready",
    ownerTables: ["convocatorias", "attachments"],
    sharedTables: ["governing_bodies", "rule_packs", "rule_pack_versions", "plantillas_protegidas"],
    sourceOfTruth: "Cloud",
    evidenceLevel: "ARCHIVED",
    parityRisk: "medium",
    migrationRequired: false,
    typesAffected: false,
    rlsRpcStorageAffected: false,
    pages: ["ConvocatoriasList", "ConvocatoriasStepper", "ConvocatoriaDetalle"],
    hooks: ["useConvocatorias", "useRulePackForMateria"],
    notes:
      "Las reglas de convocatoria operan en modo recordatorio: alertan y trazan, pero no bloquean si la convocatoria se ejecuta fuera del sistema.",
    blockers: [
      "No declarar evidencia final productiva si falta storage/hash/bundle/audit; publication_evidence_url es evidencia externa o referencia.",
    ],
  },
  {
    id: "reuniones",
    label: "Reuniones",
    demoStatus: "ready",
    ownerTables: ["meetings", "meeting_attendees", "meeting_resolutions", "meeting_votes"],
    sharedTables: ["agenda_items", "convocatorias", "agreements", "rule_packs", "rule_pack_versions", "pactos_parasociales"],
    sourceOfTruth: "Cloud",
    evidenceLevel: "OWNER_RECORD",
    parityRisk: "medium",
    migrationRequired: false,
    typesAffected: false,
    rlsRpcStorageAffected: false,
    pages: ["ReunionesLista", "ReunionStepper"],
    hooks: ["useReunionSecretaria"],
    notes:
      "El snapshot por punto vive en JSON existente de meetings.quorum_data; es puente demo confirmado, no schema nuevo.",
    blockers: [
      "Si se necesita agenda canonica mas rica que agenda_items/quorum_data, debe proponerse migracion no destructiva y no aplicarla aqui.",
    ],
  },
  {
    id: "actas",
    label: "Actas",
    demoStatus: "ready",
    ownerTables: ["minutes"],
    sharedTables: ["meetings", "meeting_resolutions", "agreements", "certifications"],
    sourceOfTruth: "Cloud",
    evidenceLevel: "GENERATED",
    parityRisk: "low",
    migrationRequired: false,
    typesAffected: false,
    rlsRpcStorageAffected: false,
    pages: ["ActasLista", "ActaDetalle"],
    hooks: ["useActas", "useAgreementIdsForMinute"],
    notes:
      "El acta es documento societario generado desde reunion/resoluciones. Solo sube de nivel probatorio si se archiva con hash y bundle.",
    blockers: [
      "Actas legacy sin snapshot no deben certificar automaticamente sin revision.",
    ],
  },
  {
    id: "certificaciones",
    label: "Certificaciones",
    demoStatus: "partial",
    ownerTables: ["certifications"],
    sharedTables: ["minutes", "meetings", "meeting_resolutions", "authority_evidence", "capability_matrix", "evidence_bundles"],
    sourceOfTruth: "Cloud",
    evidenceLevel: "QTSP_SIGNED",
    parityRisk: "medium",
    migrationRequired: false,
    typesAffected: false,
    rlsRpcStorageAffected: false,
    pages: ["ActaDetalle", "TramitadorStepper"],
    hooks: ["useActas", "useAuthorityEvidence", "useTramitador"],
    notes:
      "El flujo usa RPCs existentes para generar, firmar y emitir certificacion. La UI debe mostrar evidencia pendiente si falta evidence_id.",
    blockers: [
      "No tocar RPCs ni storage. Si una certificacion firmada no tiene evidence_id, no se considera evidencia final productiva para registro.",
    ],
  },
  {
    id: "gestor-documental",
    label: "Gestor documental",
    demoStatus: "ready",
    ownerTables: ["plantillas_protegidas"],
    sharedTables: ["agreements", "convocatorias", "attachments", "evidence_bundles"],
    sourceOfTruth: "Cloud",
    evidenceLevel: "mixed",
    parityRisk: "medium",
    migrationRequired: false,
    typesAffected: false,
    rlsRpcStorageAffected: false,
    pages: ["GestorPlantillas", "GenerarDocumentoStepper", "TramitadorStepper"],
    hooks: ["usePlantillasProtegidas", "useModelosAcuerdo"],
    notes:
      "Cloud tiene prioridad sobre fixtures locales. Los fixtures son fallback no persistido durante freeze y se muestran como tales.",
    blockers: [
      "No cargar plantillas ni modificar storage durante sanitizacion. No declarar final si archive.archived es false.",
    ],
  },
  {
    id: "plantillas-pre",
    label: "Plantillas PRE",
    demoStatus: "partial",
    ownerTables: ["plantillas_protegidas"],
    sharedTables: ["convocatorias", "rule_packs", "rule_pack_versions", "attachments"],
    sourceOfTruth: "Cloud",
    evidenceLevel: "GENERATED",
    parityRisk: "medium",
    migrationRequired: false,
    typesAffected: false,
    rlsRpcStorageAffected: false,
    pages: ["GestorPlantillas", "ConvocatoriaDetalle", "ProcessDocxButton"],
    hooks: ["usePlantillasProtegidas", "useConvocatorias"],
    notes:
      "INFORME_PRECEPTIVO e INFORME_DOCUMENTAL_PRE pueden existir antes del agreement_id, pero deben enlazarse al Acuerdo 360 cuando se materialice.",
    blockers: [
      "La disponibilidad real de plantillas PRE aprobadas depende de Cloud; los fixtures no son fuente de verdad legal final.",
    ],
  },
  {
    id: "board-pack",
    label: "Board Pack",
    demoStatus: "partial",
    ownerTables: [],
    sharedTables: [
      "meetings",
      "agenda_items",
      "agreements",
      "risks",
      "obligations",
      "incidents",
      "controls",
      "findings",
      "action_plans",
      "attestations",
      "delegations",
      "ai_systems",
      "ai_compliance_checks",
    ],
    sourceOfTruth: "Cloud",
    evidenceLevel: "none",
    parityRisk: "high",
    migrationRequired: false,
    typesAffected: false,
    rlsRpcStorageAffected: false,
    pages: ["BoardPack", "BoardPackPreview"],
    hooks: ["useBoardPackData"],
    notes:
      "Board Pack es lectura compuesta para demo. No posee GRC/AIMS ni muta esos registros; solo compone y enruta.",
    blockers: [
      "Debe declarar legacy/backbone por cada bloque GRC/AIMS antes de tratarlo como contrato cross-module estable.",
    ],
  },
];

export function getSecretariaSanitizedFlowContract(id: SecretariaSanitizedFlowId) {
  return SECRETARIA_SANITIZED_FLOW_CONTRACTS.find((flow) => flow.id === id) ?? null;
}

export function summarizeSecretariaSanitizedFlows() {
  return SECRETARIA_SANITIZED_FLOW_CONTRACTS.reduce(
    (acc, flow) => {
      acc.total += 1;
      acc[flow.demoStatus] += 1;
      if (flow.parityRisk === "high") acc.highRisk += 1;
      if (flow.evidenceLevel === "mixed" || flow.evidenceLevel === "GENERATED") acc.needsEvidenceReview += 1;
      return acc;
    },
    {
      total: 0,
      ready: 0,
      partial: 0,
      blocked: 0,
      highRisk: 0,
      needsEvidenceReview: 0,
    },
  );
}
