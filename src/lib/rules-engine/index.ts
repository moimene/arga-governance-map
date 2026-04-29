// ============================================================
// Motor de Reglas LSC — Barrel export
// ============================================================

export * from './types';
export { resolverReglaEfectiva } from './jerarquia-normativa';
export { evaluarConvocatoria } from './convocatoria-engine';
export { evaluarConstitucion, calcularDenominadorAjustado, validarCapitalUniversal } from './constitucion-engine';
export { evaluarMayoria } from './majority-evaluator';
export { evaluarVotacion } from './votacion-engine';
export { buildMeetingAdoptionSnapshot } from './meeting-adoption-snapshot';
export type {
  MeetingAdoptionSnapshot,
  MeetingAdoptionSnapshotInput,
  MeetingAdoptionVoter,
  VoteSummary,
} from './meeting-adoption-snapshot';
export { evaluateMeetingVoteCompleteness } from './meeting-vote-completeness';
export type { MeetingVoteCompleteness, MeetingVoteCompletenessRow, MeetingVoteValue } from './meeting-vote-completeness';
export { evaluarProcesoSinSesion, evaluarVentana } from './no-session-engine';
export { evaluarDocumentacion, evaluarActa } from './documentacion-engine';
export { determinarAdoptionMode, componerPerfilSesion, evaluarAcuerdoCompleto } from './orquestador';
export { evaluarBordesNoComputables } from './bordes-no-computables';
export { evaluarPactosParasociales } from './pactos-engine';
export type { PactoParasocial, PactosEvalInput, PactoEvalResult, PactosEvalOutput, TipoPacto } from './pactos-engine';
export {
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
export { evaluarPlantillaProtegida, calcularRulesetSnapshotId, GO_LIVE_CONFIG } from './plantillas-engine';
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
