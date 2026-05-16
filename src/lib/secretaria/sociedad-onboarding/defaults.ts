import type {
  FormaAdministracion,
  SociedadOnboardingDraft,
  TipoOrganoAdmin,
  TipoSocial,
} from "./types";

export const TIPO_SOCIAL_VALUES: TipoSocial[] = ["SA", "SL", "SAU", "SLU"];

export const ADMIN_BY_TIPO_ORGANO: Record<TipoOrganoAdmin, FormaAdministracion> = {
  ADMIN_UNICO: "ADMINISTRADOR_UNICO",
  ADMIN_SOLIDARIOS: "ADMINISTRADORES_SOLIDARIOS",
  ADMIN_MANCOMUNADOS: "ADMINISTRADORES_MANCOMUNADOS",
  CDA: "CONSEJO",
};

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function isUnipersonalTipo(tipo: TipoSocial) {
  return tipo === "SAU" || tipo === "SLU";
}

export function legalFormFromTipo(tipo: TipoSocial) {
  return (
    {
      SA: "S.A.",
      SAU: "S.A.U.",
      SL: "S.L.",
      SLU: "S.L.U.",
    } as Record<TipoSocial, string>
  )[tipo];
}

export function tipoTituloFromTipo(tipo: TipoSocial) {
  return tipo === "SA" || tipo === "SAU" ? "ACCION" : "PARTICIPACION";
}

export function deriveNominalValue(capital: string | number, titles: string | number) {
  const c = Number(capital);
  const t = Number(titles);
  if (!Number.isFinite(c) || !Number.isFinite(t) || c <= 0 || t <= 0) return "";
  return String(Number((c / t).toFixed(6)));
}

export function deriveJuntaName(tipo: TipoSocial) {
  if (isUnipersonalTipo(tipo)) return "Socio unico";
  return tipo === "SA" ? "Junta General de Accionistas" : "Junta General de Socios";
}

export function applyTipoSocialDefaults(
  draft: SociedadOnboardingDraft,
  tipo: TipoSocial,
): SociedadOnboardingDraft {
  const convocatoriaDias = tipo === "SA" || tipo === "SAU" ? "30" : "15";
  return {
    ...draft,
    identification: { ...draft.identification, tipo_social: tipo },
    profile: { ...draft.profile, es_unipersonal: isUnipersonalTipo(tipo) },
    capital: { ...draft.capital, tipo_titulo: tipoTituloFromTipo(tipo) },
    rules: { ...draft.rules, convocatoria_dias: convocatoriaDias },
  };
}

export function createEmptySociedadDraft(date = todayIso()): SociedadOnboardingDraft {
  return {
    identification: {
      legal_name: "",
      common_name: "",
      tax_id: "",
      tipo_social: "SL",
      jurisdiction: "ES",
      constitution_date: date,
      registration_date: "",
    },
    registry: {
      address_street: "",
      address_number: "",
      address_floor: "",
      postal_code: "",
      city: "",
      province: "",
      country: "ES",
      cnae_primary: "",
      cnae_secondary: [],
      registry_location: "",
      registry_volume: "",
      registry_folio: "",
      registry_sheet: "",
      registry_inscription: "",
      lei_code: "",
      corporate_purpose: "",
      duration: "INDEFINIDA",
      fiscal_year_close: "31-12",
      website: "",
      corporate_email: "",
    },
    profile: {
      forma_administracion: "CONSEJO",
      tipo_organo_admin: "CDA",
      es_unipersonal: false,
      es_cotizada: false,
      regulated_sector: "",
      group_role: "INDEPENDIENTE",
      parent_entity_id: "",
      ownership_percentage: "",
    },
    capital: {
      currency: "EUR",
      capital_escriturado: "",
      capital_desembolsado: "",
      numero_titulos: "",
      valor_nominal: "",
      tipo_titulo: "PARTICIPACION",
      effective_from: date,
    },
    shareClasses: [],
    capTable: [],
    organos: {
      junta_enabled: true,
      consejo_min: "3",
      consejo_max: "15",
      comisiones: {
        auditoria: false,
        nombramientos: false,
        retribuciones: false,
        riesgos: false,
      },
    },
    cargos: [],
    rules: {
      quorum_primera_pct: "50",
      quorum_segunda_pct: "0",
      mayoria_simple_pct: "50",
      mayoria_reforzada_pct: "",
      convocatoria_dias: "15",
      convocatoria_medio: "WEB_EMAIL",
      voto_calidad_presidente: true,
      restricciones_transmision: "",
      estatutos_modelados: false,
      reglamento_organo_modelado: false,
      pactos_modelados: false,
      pactos_no_modelados_ack: false,
      override_materia: "MODIFICACION_ESTATUTOS",
      override_fuente: "ESTATUTOS",
      override_mayoria_reforzada_pct: "",
      override_quorum_primera_pct: "",
      override_convocatoria_dias: "",
      override_referencia: "",
      override_justificacion: "",
      override_vigencia_desde: date,
      override_vigencia_hasta: "",
      capa3_area_responsable: "",
      capa3_firmante_preferente: "",
    },
    supportDocs: [],
  };
}
