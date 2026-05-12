import { deriveJuntaName, legalFormFromTipo } from "./defaults";
import { validateSociedadOperability } from "./validation";
import type {
  BodyKey,
  RpcSociedadPayload,
  SociedadOnboardingDraft,
  SupportDocDraft,
} from "./types";

export function slugify(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 56);
  return normalized || "sociedad";
}

export function buildAddress(draft: SociedadOnboardingDraft) {
  return [
    draft.registry.address_street,
    draft.registry.address_number,
    draft.registry.address_floor,
    draft.registry.postal_code,
    draft.registry.city,
    draft.registry.province,
    draft.registry.country,
  ]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
}

function bodyConfigForAdmin(draft: SociedadOnboardingDraft) {
  if (draft.profile.tipo_organo_admin === "ADMIN_UNICO") {
    return {
      name: "Administrador unico",
      config: { organo_tipo: "ADMIN_UNICO", adoption_mode: "UNIPERSONAL_ADMIN" },
      quorum_rule: { unipersonal_admin: true },
    };
  }
  if (draft.profile.tipo_organo_admin === "ADMIN_SOLIDARIOS") {
    return {
      name: "Administradores solidarios",
      config: { organo_tipo: "ADMIN_SOLIDARIOS", adoption_mode: "SOLIDARIO" },
      quorum_rule: { accion_individual: true },
    };
  }
  if (draft.profile.tipo_organo_admin === "ADMIN_MANCOMUNADOS") {
    return {
      name: "Administradores mancomunados",
      config: { organo_tipo: "ADMIN_CONJUNTA", adoption_mode: "CO_APROBACION" },
      quorum_rule: { firmas_requeridas: 2 },
    };
  }
  return {
    name: "Consejo de Administracion",
    config: {
      organo_tipo: "CONSEJO_ADMIN",
      min_consejeros: Number(draft.organos.consejo_min || 0),
      max_consejeros: Number(draft.organos.consejo_max || 0),
      voto_calidad_presidente: draft.rules.voto_calidad_presidente,
    },
    quorum_rule: {
      quorum_asistencia: Number(draft.rules.quorum_primera_pct || 50) / 100,
      mayoria_simple: Number(draft.rules.mayoria_simple_pct || 50) / 100,
      voto_calidad_presidente: draft.rules.voto_calidad_presidente,
    },
  };
}

export function buildInitialBodies(draft: SociedadOnboardingDraft, baseSlug = slugify(draft.identification.legal_name)) {
  const suffix = "onboarding";
  const admin = bodyConfigForAdmin(draft);
  const bodies: Array<Record<string, unknown> & { body_key: BodyKey }> = [
    {
      body_key: "JUNTA",
      slug: `${baseSlug}-junta-${suffix}`,
      name: deriveJuntaName(draft.identification.tipo_social),
      body_type: "JUNTA",
      config: {
        organo_tipo: draft.profile.es_unipersonal ? "SOCIO_UNICO" : "JUNTA_GENERAL",
        tipo_social: draft.identification.tipo_social,
        adoption_mode: draft.profile.es_unipersonal ? "UNIPERSONAL_SOCIO" : undefined,
        cotizada: draft.profile.es_cotizada,
      },
      quorum_rule: draft.profile.es_unipersonal
        ? { unipersonal: true }
        : {
            primera_convocatoria_pct: Number(draft.rules.quorum_primera_pct || 50),
            segunda_convocatoria_pct: Number(draft.rules.quorum_segunda_pct || 0),
          },
    },
    {
      body_key: draft.profile.tipo_organo_admin === "CDA" ? "CDA" : "ADMIN",
      slug: `${baseSlug}-admin-${suffix}`,
      name: admin.name,
      body_type: "CDA",
      config: admin.config,
      quorum_rule: admin.quorum_rule,
    },
  ];

  const comisiones: Array<[keyof typeof draft.organos.comisiones, BodyKey, string]> = [
    ["auditoria", "COMISION_AUDITORIA", "Comision de Auditoria"],
    ["nombramientos", "COMISION_NOMBRAMIENTOS", "Comision de Nombramientos"],
    ["retribuciones", "COMISION_RETRIBUCIONES", "Comision de Retribuciones"],
    ["riesgos", "COMISION_RIESGOS", "Comision de Riesgos"],
  ];

  for (const [flag, body_key, name] of comisiones) {
    if (!draft.organos.comisiones[flag]) continue;
    bodies.push({
      body_key,
      slug: `${baseSlug}-${body_key.toLowerCase()}-${suffix}`,
      name,
      body_type: "COMISION",
      config: { organo_tipo: body_key, voto_calidad_presidente: false },
      quorum_rule: { voto_calidad_presidente: false },
    });
  }

  return bodies;
}

export function buildInitialCapitalStructure(draft: SociedadOnboardingDraft) {
  return {
    capital_profile: {
      currency: draft.capital.currency,
      capital_escriturado: Number(draft.capital.capital_escriturado || 0),
      capital_desembolsado: Number(draft.capital.capital_desembolsado || draft.capital.capital_escriturado || 0),
      numero_titulos: Number(draft.capital.numero_titulos || 0),
      valor_nominal: Number(draft.capital.valor_nominal || 0),
      effective_from: draft.capital.effective_from,
    },
    share_classes: draft.shareClasses.map((item) => ({
      class_code: item.class_code,
      name: item.name,
      votes_per_title: Number(item.votes_per_title || 1),
      economic_rights_coeff: Number(item.economic_rights_coeff || 1),
      voting_rights: item.voting_rights,
      veto_rights: item.veto_rights,
      restrictions: item.restrictions,
      numero_titulos: Number(item.numero_titulos || 0),
    })),
  };
}

export function buildInitialCapTable(draft: SociedadOnboardingDraft) {
  const sociosByKey = new Map<string, Record<string, unknown>>();
  const capital_holdings = draft.capTable.map((entry) => {
    if (!entry.is_treasury && entry.holder) {
      sociosByKey.set(entry.holder.key || entry.holder.tax_id, {
        key: entry.holder.key || entry.holder.tax_id,
        tax_id: entry.holder.tax_id,
        full_name: entry.holder.full_name,
        denomination: entry.holder.denomination,
        person_type: entry.holder.person_type,
        email: entry.holder.email,
      });
    }
    return {
      holder_key: entry.is_treasury ? "__TREASURY__" : (entry.holder?.key || entry.holder?.tax_id),
      holder_tax_id: entry.holder?.tax_id,
      share_class_code: entry.share_class_code,
      numero_titulos: Number(entry.numero_titulos || 0),
      porcentaje_capital: deriveCapitalPct(entry.numero_titulos, draft.capital.numero_titulos),
      voting_rights: entry.is_treasury ? false : entry.voting_rights,
      is_treasury: entry.is_treasury,
      effective_from: draft.capital.effective_from,
      metadata: {},
    };
  });

  return {
    socios: Array.from(sociosByKey.values()),
    capital_holdings,
  };
}

export function deriveCapitalPct(titles: string | number, totalTitles: string | number) {
  const n = Number(titles);
  const total = Number(totalTitles);
  if (!Number.isFinite(n) || !Number.isFinite(total) || total <= 0) return null;
  return Number(((n / total) * 100).toFixed(6));
}

export function buildEntitySettings(draft: SociedadOnboardingDraft, catalogKeys: Set<string>) {
  const candidates = [
    { key: "quorum_primera_pct", value: Number(draft.rules.quorum_primera_pct || 0) },
    { key: "quorum_segunda_pct", value: Number(draft.rules.quorum_segunda_pct || 0) },
    { key: "mayoria_simple_pct", value: Number(draft.rules.mayoria_simple_pct || 0) },
    { key: "convocatoria_dias", value: Number(draft.rules.convocatoria_dias || 0) },
    { key: "convocatoria_medio", value: draft.rules.convocatoria_medio },
    { key: "voto_calidad_presidente", value: draft.rules.voto_calidad_presidente },
  ];
  return candidates.filter((item) => catalogKeys.has(item.key));
}

export function buildRuleParamOverrides(draft: SociedadOnboardingDraft) {
  if (!draft.rules.mayoria_reforzada_pct) return [];
  return [
    {
      materia: "GOBIERNO_SOCIETARIO",
      clave: "MAYORIA_REFORZADA_PCT",
      valor: Number(draft.rules.mayoria_reforzada_pct),
      fuente: "ESTATUTOS",
      referencia: "Alta sociedad onboarding",
    },
  ];
}

export function buildSupportDocsMetadata(docs: SupportDocDraft[]) {
  return {
    docs: docs
      .filter((doc) => doc.uri || doc.sha512 || doc.nombre)
      .map((doc) => ({
        tipo: doc.tipo,
        nombre: doc.nombre,
        uri: doc.uri,
        sha512: doc.sha512,
      })),
  };
}

export function buildRpcPayload(draft: SociedadOnboardingDraft, catalogKeys: Set<string> = new Set()): RpcSociedadPayload {
  const baseSlug = `${slugify(draft.identification.legal_name)}-${Date.now()}`;
  const validation = validateSociedadOperability(draft);
  const onboarding_status = validation.blockingOperational.length > 0 ? "INCOMPLETA_DATOS" : "INCOMPLETA_CARGOS";
  const capital = buildInitialCapitalStructure(draft);
  const capTable = buildInitialCapTable(draft);

  return {
    sociedad_pj: {
      full_name: draft.identification.legal_name,
      denomination: draft.identification.legal_name,
      tax_id: draft.identification.tax_id,
      person_type: "PJ",
      email: draft.registry.corporate_email || null,
    },
    entity: {
      slug: baseSlug,
      legal_name: draft.identification.legal_name,
      common_name: draft.identification.common_name || draft.identification.legal_name,
      jurisdiction: draft.identification.jurisdiction,
      legal_form: legalFormFromTipo(draft.identification.tipo_social),
      tipo_social: draft.identification.tipo_social,
      registration_number: draft.registry.registry_sheet,
      forma_administracion: draft.profile.forma_administracion,
      tipo_organo_admin: draft.profile.tipo_organo_admin,
      es_unipersonal: draft.profile.es_unipersonal,
      es_cotizada: draft.profile.es_cotizada,
      entity_status: "Active",
      materiality: "Medium",
      parent_entity_id: draft.profile.parent_entity_id || null,
      ownership_percentage: draft.profile.ownership_percentage || null,
      constitution_date: draft.identification.constitution_date || null,
      registration_date: draft.identification.registration_date || null,
      registry_location: draft.registry.registry_location || null,
      registry_volume: draft.registry.registry_volume || null,
      registry_folio: draft.registry.registry_folio || null,
      registry_sheet: draft.registry.registry_sheet || null,
      registry_inscription: draft.registry.registry_inscription || null,
      lei_code: draft.registry.lei_code || null,
      cnae_primary: draft.registry.cnae_primary || null,
      cnae_secondary: draft.registry.cnae_secondary,
      corporate_purpose: draft.registry.corporate_purpose || null,
      duration: draft.registry.duration || null,
      fiscal_year_close: draft.registry.fiscal_year_close || null,
      address: buildAddress(draft),
      address_street: draft.registry.address_street || null,
      address_number: draft.registry.address_number || null,
      address_floor: draft.registry.address_floor || null,
      postal_code: draft.registry.postal_code || null,
      city: draft.registry.city || null,
      province: draft.registry.province || null,
      country: draft.registry.country || null,
      website: draft.registry.website || null,
      corporate_email: draft.registry.corporate_email || null,
      regulated_sector: draft.profile.regulated_sector || null,
      group_role: draft.profile.group_role,
      onboarding_status,
      support_docs_metadata: buildSupportDocsMetadata(draft.supportDocs),
    },
    capital_profile: capital.capital_profile,
    share_classes: capital.share_classes,
    socios: capTable.socios,
    capital_holdings: capTable.capital_holdings,
    governing_bodies: buildInitialBodies(draft, baseSlug),
    entity_settings: buildEntitySettings(draft, catalogKeys),
    rule_param_overrides: buildRuleParamOverrides(draft),
  };
}
