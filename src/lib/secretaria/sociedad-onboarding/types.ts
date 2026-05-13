export type TipoSocial = "SA" | "SL" | "SAU" | "SLU";

export type TipoOrganoAdmin =
  | "ADMIN_UNICO"
  | "ADMIN_SOLIDARIOS"
  | "ADMIN_MANCOMUNADOS"
  | "CDA";

export type FormaAdministracion =
  | "ADMINISTRADOR_UNICO"
  | "ADMINISTRADORES_SOLIDARIOS"
  | "ADMINISTRADORES_MANCOMUNADOS"
  | "CONSEJO";

export type OnboardingStatus =
  | "OPERATIVA"
  | "INCOMPLETA_CARGOS"
  | "INCOMPLETA_DATOS"
  | "BORRADOR";

export type FuenteDesignacion =
  | "ACTA_NOMBRAMIENTO"
  | "ESCRITURA"
  | "DECISION_UNIPERSONAL"
  | "BOOTSTRAP";

export type TipoCondicionOnboarding =
  | "SOCIO"
  | "ADMIN_UNICO"
  | "ADMIN_SOLIDARIO"
  | "ADMIN_MANCOMUNADO"
  | "ADMIN_PJ"
  | "CONSEJERO"
  | "PRESIDENTE"
  | "SECRETARIO"
  | "VICEPRESIDENTE"
  | "VICESECRETARIO"
  | "CONSEJERO_COORDINADOR";

export type BodyKey =
  | "JUNTA"
  | "ADMIN"
  | "CDA"
  | "COMISION_AUDITORIA"
  | "COMISION_NOMBRAMIENTOS"
  | "COMISION_RETRIBUCIONES"
  | "COMISION_RIESGOS";

export type PersonType = "PF" | "PJ";

export interface PersonaDraft {
  key: string;
  tax_id: string;
  full_name: string;
  denomination?: string | null;
  email?: string | null;
  person_type: PersonType;
  representante?: PersonaDraft | null;
}

export interface IdentificationDraft {
  legal_name: string;
  common_name: string;
  tax_id: string;
  tipo_social: TipoSocial;
  jurisdiction: string;
  constitution_date: string;
  registration_date: string;
}

export interface RegistryDraft {
  address_street: string;
  address_number: string;
  address_floor: string;
  postal_code: string;
  city: string;
  province: string;
  country: string;
  cnae_primary: string;
  cnae_secondary: string[];
  registry_location: string;
  registry_volume: string;
  registry_folio: string;
  registry_sheet: string;
  registry_inscription: string;
  lei_code: string;
  corporate_purpose: string;
  duration: string;
  fiscal_year_close: string;
  website: string;
  corporate_email: string;
}

export interface ProfileDraft {
  forma_administracion: FormaAdministracion;
  tipo_organo_admin: TipoOrganoAdmin;
  es_unipersonal: boolean;
  es_cotizada: boolean;
  regulated_sector: "BANCA" | "SEGUROS" | "ENERGIA" | "TELECOM" | "OTRO" | "";
  group_role: "INDEPENDIENTE" | "MATRIZ" | "FILIAL" | "PARTICIPADA";
  parent_entity_id: string;
  ownership_percentage: string;
}

export interface CapitalDraft {
  currency: string;
  capital_escriturado: string;
  capital_desembolsado: string;
  numero_titulos: string;
  valor_nominal: string;
  tipo_titulo: "ACCION" | "PARTICIPACION";
  effective_from: string;
}

export interface ShareClassDraft {
  key: string;
  class_code: string;
  name: string;
  numero_titulos: string;
  votes_per_title: string;
  economic_rights_coeff: string;
  voting_rights: boolean;
  veto_rights: boolean;
  restrictions: Record<string, unknown>;
}

export interface CapTableEntryDraft {
  key: string;
  holder: PersonaDraft | null;
  share_class_code: string;
  numero_titulos: string;
  voting_rights: boolean;
  is_treasury: boolean;
  representante_junta?: PersonaDraft | null;
}

export interface OrganosDraft {
  junta_enabled: boolean;
  consejo_min: string;
  consejo_max: string;
  comisiones: {
    auditoria: boolean;
    nombramientos: boolean;
    retribuciones: boolean;
    riesgos: boolean;
  };
}

export interface CargoInputDraft {
  key: string;
  tipo_condicion: TipoCondicionOnboarding;
  bodyKey: BodyKey | null;
  persona: PersonaDraft | null;
  fecha_inicio: string;
  fuente_designacion: FuenteDesignacion;
  metadata?: Record<string, unknown>;
}

export interface RulesDraft {
  quorum_primera_pct: string;
  quorum_segunda_pct: string;
  mayoria_simple_pct: string;
  mayoria_reforzada_pct: string;
  convocatoria_dias: string;
  convocatoria_medio: string;
  voto_calidad_presidente: boolean;
  restricciones_transmision: string;
}

export interface SupportDocDraft {
  key: string;
  tipo: string;
  nombre: string;
  uri: string;
  sha512: string;
}

export interface SociedadOnboardingDraft {
  identification: IdentificationDraft;
  registry: RegistryDraft;
  profile: ProfileDraft;
  capital: CapitalDraft;
  shareClasses: ShareClassDraft[];
  capTable: CapTableEntryDraft[];
  organos: OrganosDraft;
  cargos: CargoInputDraft[];
  rules: RulesDraft;
  supportDocs: SupportDocDraft[];
}

export type ValidationSeverity = "BLOCK" | "BLOCK_OPERATIONAL" | "WARN";

export interface ValidationIssue {
  code: string;
  field: string;
  message: string;
  severity: ValidationSeverity;
}

export interface ValidationResult {
  ok: boolean;
  blocking: ValidationIssue[];
  blockingOperational: ValidationIssue[];
  warnings: ValidationIssue[];
  derived: Record<string, unknown>;
}

export interface AdapterContext {
  tenantId: string;
  entityId: string;
  bodyJuntaId: string;
  bodyAdminId: string;
  bodyConsejoId: string | null;
  bodyComisiones: Record<string, string>;
}

export interface RpcSociedadPayload {
  sociedad_pj: Record<string, unknown>;
  entity: Record<string, unknown>;
  capital_profile: Record<string, unknown>;
  share_classes: Array<Record<string, unknown>>;
  socios: Array<Record<string, unknown>>;
  capital_holdings: Array<Record<string, unknown>>;
  governing_bodies: Array<Record<string, unknown>>;
  entity_settings: Array<Record<string, unknown>>;
  rule_param_overrides: Array<Record<string, unknown>>;
}
