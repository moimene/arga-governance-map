// ============================================================
// Motor de Reglas LSC — Tipos base
// Spec: docs/superpowers/specs/2026-04-19-motor-reglas-lsc-secretaria-design.md §4
// ============================================================

// --- Enums y tipos básicos ---

export type Fuente = 'LEY' | 'ESTATUTOS' | 'PACTO_PARASOCIAL' | 'REGLAMENTO';

export type TipoSocial = 'SA' | 'SL';

export type TipoOrgano = 'JUNTA_GENERAL' | 'CONSEJO' | 'COMISION_DELEGADA';

export type FormaAdministracion =
  | 'ADMINISTRADOR_UNICO'
  | 'ADMINISTRADORES_SOLIDARIOS'
  | 'ADMINISTRADORES_MANCOMUNADOS'
  | 'CONSEJO';

export type AdoptionMode =
  | 'MEETING'
  | 'UNIVERSAL'
  | 'NO_SESSION'
  | 'UNIPERSONAL_SOCIO'
  | 'UNIPERSONAL_ADMIN';

export type TipoActa =
  | 'ACTA_JUNTA'
  | 'ACTA_CONSEJO'
  | 'ACTA_CONSIGNACION_SOCIO'
  | 'ACTA_CONSIGNACION_ADMIN'
  | 'ACTA_DECISION_CONJUNTA'
  | 'ACTA_ACUERDO_ESCRITO';

export type MateriaClase = 'ORDINARIA' | 'ESTATUTARIA' | 'ESTRUCTURAL';

// --- Parámetros con fuente ---

export interface ReglaParametro<T> {
  valor: T;
  fuente: Fuente;
  referencia?: string; // e.g., "art. 193.1 LSC"
}

// --- Reglas por etapa ---

export interface ReglaConvocatoria {
  antelacionDias: Record<TipoSocial, ReglaParametro<number>>;
  canales: Record<TipoSocial, string[]>;
  contenidoMinimo: string[];
  documentosObligatorios?: Array<{
    id: string;
    nombre: string;
    condicion?: string;
  }>;
}

export interface ReglaConstitucion {
  quorum: {
    SA_1a: ReglaParametro<number>;  // fraction, e.g., 0.25
    SA_2a: ReglaParametro<number>;  // 0 = sin mínimo
    SL: ReglaParametro<number>;     // 0 = sin quórum legal
    CONSEJO: ReglaParametro<string>; // "mayoria_miembros"
  };
}

export interface MajoritySpec {
  formula: string;        // e.g., "favor > contra", "favor >= 2/3_emitidos"
  fuente: Fuente;
  referencia?: string;
  dobleCondicional?: {
    umbral: number;       // e.g., 0.5 (50% of capital present)
    mayoriaAlternativa: string; // formula if capital_presente < umbral
  };
}

export interface ReglaVotacion {
  mayoria: Record<'SA' | 'SL' | 'CONSEJO', MajoritySpec>;
  unanimidad?: {
    requerida: boolean;
    ambito: 'TODOS' | 'PRESENTES' | 'CLASE';
    fuente: Fuente;
    referencia?: string;
  };
  abstenciones: 'no_cuentan' | 'cuentan_como_contra' | 'cuentan_como_voto';
  votoCalidadPermitido?: boolean;
}

export interface ReglaDocumentacion {
  obligatoria: Array<{
    id: string;
    nombre: string;
    condicion?: string;
  }>;
  ventanaDisponibilidad?: {
    dias: number;
    fuente: Fuente;
  };
}

export interface ReglaActa {
  tipoActaPorModo: Partial<Record<AdoptionMode, TipoActa>>;
  contenidoMinimo: {
    sesion: string[];
    consignacion: string[];
    acuerdoEscrito: string[];
  };
  requiereTranscripcionLibroActas: boolean;
  requiereConformidadConjunta: boolean;
}

export interface ReglaPlazosMateriales {
  inscripcion?: {
    plazo_dias: number;
    fuente: Fuente;
    referencia?: string;
  };
  publicacion?: string[];
  oposicion_acreedores?: {
    plazo_dias: number;
    fuente: Fuente;
    referencia?: string;
  };
}

export interface ReglaPostAcuerdo {
  inscribible: boolean;
  instrumentoRequerido: 'ESCRITURA' | 'INSTANCIA' | 'NINGUNO';
  publicacionRequerida: boolean;
  plazoInscripcion?: {
    dias: number;
    fuente: Fuente;
    referencia?: string;
  };
}

// --- NO_SESSION types ---

export type TipoProceso =
  | 'UNANIMIDAD_ESCRITA_SL'
  | 'CIRCULACION_CONSEJO'
  | 'DECISION_SOCIO_UNICO_SL'
  | 'DECISION_SOCIO_UNICO_SA';

export type CondicionAdopcion =
  | 'UNANIMIDAD_CAPITAL'
  | 'UNANIMIDAD_CONSEJEROS'
  | 'MAYORIA_CONSEJEROS_ESCRITA'
  | 'DECISION_UNICA';

export type SentidoRespuesta =
  | 'CONSENTIMIENTO'
  | 'OBJECION'
  | 'OBJECION_PROCEDIMIENTO'
  | 'SILENCIO';

export interface ReglaNoSession {
  habilitado_por_estatutos: ReglaParametro<boolean>;
  habilitado_por_reglamento: ReglaParametro<boolean>;
  condicion_junta_sl: 'UNANIMIDAD_CAPITAL';
  condicion_consejo: 'MAYORIA_SIN_OPOSICION';
  ventana_minima_dias: ReglaParametro<number>;
  ventana_fuente: Fuente;
  canal_requerido_junta_sl: ReglaParametro<
    Array<'NOTIFICACION_CERTIFICADA' | 'BUROFAX' | 'EMAIL_CON_ACUSE'>
  >;
  canal_requerido_consejo: ReglaParametro<
    Array<'NOTIFICACION_CERTIFICADA' | 'EMAIL_CON_ACUSE'>
  >;
  silencio_equivale_a: 'NADA' | 'OBJECION';
  cierre_anticipado: boolean;
  contenido_minimo_propuesta: string[];
}

// --- RulePack (aggregate) ---

export interface RulePack {
  id: string;
  materia: string;
  clase: MateriaClase;
  organoTipo: TipoOrgano;
  modosAdopcionPermitidos: AdoptionMode[];
  convocatoria: ReglaConvocatoria;
  constitucion: ReglaConstitucion;
  votacion: ReglaVotacion;
  documentacion: ReglaDocumentacion;
  acta: ReglaActa;
  noSession?: ReglaNoSession;
  plazosMateriales: ReglaPlazosMateriales;
  postAcuerdo: ReglaPostAcuerdo;
}

// --- Overrides ---

export interface RuleParamOverride {
  id: string;
  entity_id: string;
  materia: string;
  clave: string;
  valor: unknown; // JSONB, type depends on clave
  fuente: Fuente;
  referencia?: string;
}

// --- Evaluation Results ---

export type EvalSeverity = 'OK' | 'WARNING' | 'BLOCKING';

export interface ExplainNode {
  regla: string;
  fuente: Fuente;
  referencia?: string;
  umbral?: number | string;
  valor?: number | string;
  resultado: EvalSeverity;
  mensaje: string;
  hijos?: ExplainNode[];
}

export interface EvaluacionResult {
  etapa: string;
  ok: boolean;
  severity: EvalSeverity;
  explain: ExplainNode[];
  blocking_issues: string[];
  warnings: string[];
}

// --- Denominador ajustado (conflicto de interés) ---

export interface ConflictoInteres {
  mandate_id: string;
  tipo: 'EXCLUIR_QUORUM' | 'EXCLUIR_VOTO' | 'EXCLUIR_AMBOS';
  motivo: string;
  capital_afectado: number;
}

export interface DenominadorAjustado {
  capital_total: number;
  capital_excluido_quorum: number;
  capital_excluido_voto: number;
  capital_convocable: number;      // capital_total - excluido_quorum
  capital_votante: number;         // capital_total - excluido_voto
  mandatos_excluidos: string[];    // mandate_ids
}

// --- Votación Input ---

export interface VotosInput {
  favor: number;
  contra: number;
  abstenciones: number;
  en_blanco: number;
  capital_presente: number;
  capital_total: number;
  total_miembros?: number;         // for consejo
  miembros_presentes?: number;     // for consejo
}

// --- QTSP types ---

export interface QTSPSealRequest {
  hash: string;           // SHA-256 of the payload
  seal_type: 'QSEAL' | 'TSQ';
  payload_ref: string;    // reference to the sealed artifact
}

export interface QTSPSealResponse {
  seal_token: string;
  timestamp: string;
  issuer: string;
  status: 'SEALED' | 'ERROR';
}

export interface QTSPSignRequest {
  document_hash: string;
  signer_id: string;
  signer_role: string;
  document_type: string;
}

export interface QTSPNotificationRequest {
  recipient_id: string;
  recipient_email: string;
  subject: string;
  body: string;
  attachments?: Array<{ name: string; hash: string }>;
  delivery_type: 'EDELIVERY' | 'BUROFAX' | 'CERTIFICADA';
}

export interface QTSPNotificationEvidence {
  delivery_ref: string;
  delivered_at: string;
  hash: string;
  tsq_token: string;
  status: 'DELIVERED' | 'FAILED' | 'PENDING';
}

export interface TrustVerificationRequest {
  artifact_type: 'QES' | 'QSEAL' | 'TSQ' | 'NOTIFICATION';
  artifact_ref: string;
  expected_hash?: string;
}

export interface TrustVerificationResponse {
  valid: boolean;
  issuer: string;
  timestamp: string;
  ocsp_status: 'GOOD' | 'REVOKED' | 'UNKNOWN';
  chain_valid: boolean;
  details: string;
}

// --- NO_SESSION Engine I/O ---

export interface NoSessionRespuesta {
  person_id: string;
  capital_participacion: number;
  porcentaje_capital: number;
  es_consejero: boolean;
  sentido: SentidoRespuesta;
  firma_qes_ref?: string;
  firma_qes_timestamp?: string;
  ocsp_status?: string;
}

export interface NoSessionNotificacion {
  person_id: string;
  canal: string;
  estado:
    | 'PENDIENTE'
    | 'ENVIADA'
    | 'ENTREGADA'
    | 'FALLIDA'
    | 'RECHAZADA';
  evidencia_ref?: string;
  evidencia_hash?: string;
}

export interface NoSessionInput {
  tipoProceso: TipoProceso;
  condicionAdopcion: CondicionAdopcion;
  organoTipo: TipoOrgano;
  tipoSocial: TipoSocial;
  respuestas: NoSessionRespuesta[];
  notificaciones: NoSessionNotificacion[];
  totalDestinatarios: number;
  totalCapitalSocial: number;
  ventana: {
    inicio: string;
    fin: string;
    ahora: string;  // current timestamp for evaluation
  };
  propuestaTexto: string;
  decisionConsignada?: boolean; // for socio único
}

export interface NoSessionOutput {
  ok: boolean;
  estado: 'CERRADO_OK' | 'CERRADO_FAIL' | 'ABIERTO';
  gates: Array<{
    gate: string;
    ok: boolean;
    severity: EvalSeverity;
    explain: ExplainNode[];
  }>;
  explain: ExplainNode[];
  blocking_issues: string[];
  warnings: string[];
  cierreAnticipado?: boolean;
  motivoCierre?: string;
}

// --- Convocatoria Engine I/O ---

export interface ConvocatoriaInput {
  tipoSocial: TipoSocial;
  organoTipo: TipoOrgano;
  adoptionMode: AdoptionMode;
  fechaJunta: string;
  esCotizada: boolean;
  webInscrita: boolean;
  primeraConvocatoria: boolean;
  esJuntaUniversal: boolean;
  materias: string[];
}

export interface ConvocatoriaOutput extends EvaluacionResult {
  fechaLimitePublicacion: string;
  antelacionDiasRequerida: number;
  canalesExigidos: string[];
  contenidoMinimo: string[];
  documentosObligatorios: Array<{
    id: string;
    nombre: string;
    condicion?: string;
  }>;
  ventanaDisponibilidad: {
    desde: string;
    hasta: string;
  };
}

// --- Constitución Engine I/O ---

export interface ConstitucionInput {
  tipoSocial: TipoSocial;
  organoTipo: TipoOrgano;
  adoptionMode: AdoptionMode;
  primeraConvocatoria: boolean;
  materiaClase: MateriaClase;
  capitalConDerechoVoto: number;
  capitalPresenteRepresentado: number;
  asistentesPresentes?: number;
  totalMiembros?: number;
  conflictos?: ConflictoInteres[];
}

export interface ConstitucionOutput extends EvaluacionResult {
  quorumRequerido: number;
  quorumPresente: number;
  quorumCubierto: boolean;
  denominadorAjustado?: DenominadorAjustado;
}

// --- Votación Engine I/O ---

export interface VotacionInput {
  tipoSocial: TipoSocial;
  organoTipo: TipoOrgano;
  adoptionMode: AdoptionMode;
  materiaClase: MateriaClase;
  materias: string[];
  votos: VotosInput;
  conflictos?: ConflictoInteres[];
  votoCalidadHabilitado?: boolean;
  esEmpate?: boolean;
  decisionFirmada?: boolean;  // for unipersonal
  noSessionInput?: NoSessionInput;  // for NO_SESSION delegation
}

export interface VotacionOutput extends EvaluacionResult {
  acuerdoProclamable: boolean;
  mayoriaAlcanzada: boolean;
  unanimidadRequerida?: boolean;
  unanimidadAlcanzada?: boolean;
  vetoAplicado?: boolean;
  votoCalidadUsado?: boolean;
  noSessionOutput?: NoSessionOutput;  // if delegated to NO_SESSION engine
}

// --- Documentación Engine I/O ---

export interface DocumentacionInput {
  adoptionMode: AdoptionMode;
  materias: string[];
  documentosDisponibles: Array<{
    id: string;
    disponible_desde?: string;
  }>;
  actaDatos?: {
    tipoActa: TipoActa;
    campos: Record<string, boolean>; // field_name -> present
    transcripcionRealizada?: boolean;
    conformidadConjuntaObtenida?: boolean;
  };
}

export interface DocumentacionOutput extends EvaluacionResult {
  documentosFaltantes: Array<{
    id: string;
    nombre: string;
  }>;
  actaValida: boolean;
  actaTipoEsperado: TipoActa;
}

// --- Orquestador I/O ---

export interface ComplianceResult {
  ok: boolean;
  adoptionMode: AdoptionMode;
  path: 'A' | 'B' | 'C'; // A=colegiado, B=unipersonal, C=sin sesión
  etapas: EvaluacionResult[];
  explain: ExplainNode[];
  blocking_issues: string[];
  warnings: string[];
  snapshot_hash?: string;
  gate_hash?: string;
}

// --- Plantilla types ---

export type PlantillaExigencia = 'STRICT' | 'FALLBACK' | 'DISABLED';

export interface PlantillaGateRule {
  tipo: string;          // TipoActa or template tipo
  adoption_mode?: AdoptionMode;
  organo_tipo?: string;
  exigencia: PlantillaExigencia;
  fallback_tipo?: string;
  fallback_modo?: AdoptionMode;
}

export interface PlantillaGateConfig {
  rules: PlantillaGateRule[];
}

// --- Bordes no computables ---

export type BordeStatus = 'RESUELTO' | 'PENDIENTE' | 'FUERA_DE_ALCANCE';

export interface ReglaNoComputable {
  id: string;
  nombre: string;
  condicion: string;
  aplica: boolean;
  status: BordeStatus;
  severity: EvalSeverity;
  resolucion?: string;
}

// --- Pactos parasociales (estructura preparada, sin lógica real — Fase 2) ---

export interface PactosEvaluation {
  tienePacktosRelevantes: boolean;
  pactosIdentificados: Array<{
    id: string;
    tipo: string;
    impacto: string;
  }>;
  evaluado: false; // always false in V1
}
