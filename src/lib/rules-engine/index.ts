// ============================================================
// Motor de Reglas LSC — Barrel export
// ============================================================

export * from './types';
export {
  FUENTE_PRIORITY,
  resolverReglaEfectiva,
  resolverReglaEfectivaConTrazabilidad,
  type ResolverReglaEfectivaOptions,
} from './jerarquia-normativa';
export { evaluarConvocatoria } from './convocatoria-engine';
export { evaluarConstitucion, calcularDenominadorAjustado, validarCapitalUniversal } from './constitucion-engine';
export { evaluarMayoria } from './majority-evaluator';
export { evaluarVotacion } from './votacion-engine';
export {
  buildMeetingAdoptionSnapshot,
  isLegacyMeetingAdoptionSnapshot,
  MEETING_ADOPTION_SNAPSHOT_ENGINE_VERSION,
} from './meeting-adoption-snapshot';
export type {
  MeetingAdoptionSnapshot,
  MeetingAdoptionSnapshotInput,
  MeetingAdoptionRuleTrace,
  MeetingAdoptionVoter,
  VoteSummary,
} from './meeting-adoption-snapshot';
export { evaluateMeetingVoteCompleteness } from './meeting-vote-completeness';
export type { MeetingVoteCompleteness, MeetingVoteCompletenessRow, MeetingVoteValue } from './meeting-vote-completeness';
export {
  AGENDA_ITEM_KINDS,
  NON_DECISION_AGENDA_ITEM_KINDS,
  evaluarPuntoOrdenDia,
  isDecisionAgendaItem,
  normalizeAgendaItemKind,
  normalizeAgendaReportAcceptanceVote,
  resolutionKindForAgendaItem,
  shouldRunAgreementGatesForAgendaItem,
} from './agenda-item-engine';
export {
  buildCompliancePanelResult,
  evaluateAgendaItemComplianceGate,
  gateFromEvaluation,
} from './compliance-gates';
export {
  buildEffectiveRuleProjection,
  type EffectiveRuleProjection,
} from './effective-rule';
export { evaluarProcesoSinSesion, evaluarVentana } from './no-session-engine';
export { evaluarDocumentacion, evaluarActa } from './documentacion-engine';
export { determinarAdoptionMode, componerPerfilSesion, evaluarAcuerdoCompleto } from './orquestador';
export { evaluarBordesNoComputables } from './bordes-no-computables';
// ITEM-099 — Validación legal de representaciones (proxy junta arts. 183-187/523 LSC + delegación consejo art. 529 quáter LSC)
export {
  validarProxyJunta,
  validarDelegacionConsejo,
  type ProxyJuntaInput,
  type DelegacionConsejoInput,
  type RepresentacionValidacionResult,
  type RepresentacionHallazgo,
  type RepresentacionSeverity,
  type RepresentacionStatus,
  type VinculoRepresentanteSL,
  type CaracterConsejero,
} from './representacion-validator';
export { evaluarPactosParasociales } from './pactos-engine';
export type { PactoParasocial, PactosEvalInput, PactoEvalResult, PactosEvalOutput, TipoPacto } from './pactos-engine';
// ITEM-113 — normalización de materias operativas ↔ materias de cláusula de pacto
export {
  normalizeMateriaPacto,
  materiaPactoCoincide,
  materiasPactoCoincidentes,
  type MateriaPactoCanonica,
} from './materia-pacto-mapping';
export {
  MATERIA_PACK_ALIASES,
  normalizeMateriaForRulePack,
  normalizeRuleLifecycleStatus,
  normalizeRulePackVersion,
  resolveRulePackForMatter,
  type CanonicalRulePackVersion,
  type RawRulePackRelation,
  type RawRulePackVersionRow,
  type RuleLifecycleStatus,
  type RuleResolution,
  type RuleResolutionInput,
} from './rule-resolution';
export {
  evaluarPlantillaProtegida,
  calcularRulesetSnapshotId,
  GO_LIVE_CONFIG,
  resolverPlantillaConvocatoria,
  tiposPlantillaConvocatoriaPreferidos,
} from './plantillas-engine';
export {
  firmarDocumentoQES,
  notificarCertificado,
  verificarOCSP,
  verificarOCSPAsync,
  validarPreFirma,
  verificarIntegridad,
  type QESSignResult,
  type CertifiedNotificationResult,
  type PreFirmaValidationResult,
  type OCSPVerificationResult,
  type IntegrityCheckDetail,
  type IntegrityVerificationResult,
  type VerifiableArtifact,
} from './qtsp-integration';
export {
  generarEvidenceBundle,
  empaquetarASiCE,
  computeManifestHashSync,
  computeManifestHashAsync,
  generarVerificadorOffline,
  sha256,
  type EvidenceArtifact,
  type EvidenceManifest,
  type EvidenceBundleResult,
  type ASiCEPackage,
} from './evidence-bundle';
