import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  evaluarAcuerdoCompleto,
  type RulePack,
  type RuleParamOverride,
  type AdoptionMode,
  type TipoSocial,
  type TipoOrgano,
  type FormaAdministracion,
  type MateriaClase,
  type ComplianceResult as EngineComplianceResult,
} from "@/lib/rules-engine";

const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";

type RulePackJoinRow = {
  id: string; params: unknown; status: string;
  rule_packs: { materia: string; clase: string; organo_tipo: string } | null;
};
type OverrideRaw = { id: string; entity_id: string; materia: string; clave: string; valor: unknown; fuente: string; referencia: string | null };

/**
 * Feature flag: activar para usar el Motor de Reglas LSC V2.
 * Cuando false, se usa la lógica V1 inline (queries ad-hoc a Supabase).
 * Cuando true, se usa evaluarAcuerdoCompleto() del motor puro.
 */
const ENGINE_V2 = true; // T20 — V2 motor de reglas activo definitivamente

/** Normaliza la forma societaria de `entities.legal_form` al vocabulario
 *  canónico usado en `jurisdiction_rule_sets.company_form`. */
function normalizeCompanyForm(legalForm?: string | null): string | null {
  if (!legalForm) return null;
  const lf = legalForm.trim().toUpperCase().replace(/\./g, "").replace(/\s+/g, "");
  if (lf === "SA" || lf === "SAECV") return "SA";
  if (lf === "SACV" || lf === "SADECV") return "SA_CV";
  if (lf === "SL" || lf === "SRL") return "SRL";
  if (lf === "LTDA") return "LTDA";
  if (lf === "LDA") return "LDA";
  return lf;
}

export type InstrumentRequired = "ESCRITURA" | "INSTANCIA" | "NINGUNO";

export interface ComplianceResult {
  agreement_id: string;
  agreement_kind: string;
  matter_class: string;
  adoption_mode: string;
  inscribable: boolean;
  convocation_compliant: boolean;
  quorum_compliant: boolean;
  conflict_handled: boolean;
  majority_compliant: boolean;
  instrument_required: InstrumentRequired;
  registry_required: boolean;
  publication_required: boolean;
  publication_channel: string | null;
  blocking_issues: string[];
  status: string;
}

export interface AgreementFull {
  id: string;
  tenant_id: string;
  entity_id: string | null;
  body_id: string | null;
  agreement_kind: string;
  matter_class: string;
  inscribable: boolean;
  adoption_mode: string;
  required_quorum_code: string | null;
  required_majority_code: string | null;
  jurisdiction_rule_id: string | null;
  proposal_text: string | null;
  decision_text: string | null;
  decision_date: string | null;
  effective_date: string | null;
  status: string;
  parent_meeting_id: string | null;
  unipersonal_decision_id: string | null;
  no_session_resolution_id: string | null;
  statutory_basis: string | null;
  compliance_snapshot: Record<string, unknown> | null;
  created_at: string;
  entities?: { common_name: string; jurisdiction: string; legal_form: string } | null;
  governing_bodies?: { name: string; body_type: string } | null;
}

/** Subconjunto de agreement con entidad anidada usado por el motor de compliance. */
type AgreementWithEntity = AgreementFull & {
  entities: { jurisdiction: string | null; legal_form: string | null } | null;
  governing_bodies?: { name: string; body_type: string } | null;
  entity_id: string | null;
};

/** Subconjunto relevante de jurisdiction_rule_sets.rule_config (JSONB flexible). */
type RuleConfig = {
  notice_periods_days?: { ordinaria?: number; extraordinaria?: number };
  inscribable_matters?: string[];
  registry_filing_types?: string[];
  publication_channels?: Record<string, string>;
};
type JurisdictionRule = { rule_config: RuleConfig } | null;

type MeetingRow = { id: string; body_id: string | null; scheduled_start: string | null } | null;
type ConvocatoriaRow = { fecha_emision: string | null; fecha_1: string | null; urgente: boolean | null; junta_universal: boolean | null };
type ResolutionRow = { status: string };
type ConflictRow = { id: string; status: string };
type NoSessionRow = { status: string; requires_unanimity: boolean; votes_for: number; votes_against: number; abstentions: number } | null;
type UnipersonalRow = { status: string } | null;

export function useAgreement(agreementId?: string) {
  return useQuery({
    queryKey: ["agreement", agreementId ?? "none"],
    enabled: !!agreementId,
    staleTime: 60_000,
    queryFn: async (): Promise<AgreementFull | null> => {
      const { data, error } = await supabase
        .from("agreements")
        .select(
          "*, entities(common_name, jurisdiction, legal_form), governing_bodies(name, body_type)",
        )
        .eq("tenant_id", DEMO_TENANT)
        .eq("id", agreementId!)
        .maybeSingle();
      if (error) throw error;
      return (data as AgreementFull | null) ?? null;
    },
  });
}

/** Mapea legal_form normalizado a TipoSocial del motor V2. */
function toTipoSocial(companyForm: string | null): TipoSocial {
  if (companyForm === "SA" || companyForm === "SA_CV") return "SA";
  return "SL";
}

/** Mapea body_type del órgano al TipoOrgano del motor V2. */
function toTipoOrgano(bodyType: string | null): TipoOrgano {
  if (bodyType === "CONSEJO" || bodyType === "consejo_administracion") return "CONSEJO";
  if (bodyType === "COMISION" || bodyType === "comision_delegada") return "COMISION_DELEGADA";
  return "JUNTA_GENERAL";
}

/** Mapea matter_class del agreement al MateriaClase del motor V2. */
function toMateriaClase(mc: string): MateriaClase {
  if (mc === "ESTATUTARIA") return "ESTATUTARIA";
  if (mc === "ESTRUCTURAL") return "ESTRUCTURAL";
  return "ORDINARIA";
}

/**
 * Ejecuta el motor V2 y mapea el resultado a ComplianceResult V1.
 * Carga rule packs + overrides desde Supabase, ejecuta evaluarAcuerdoCompleto().
 */
async function evaluateV2(a: AgreementWithEntity): Promise<ComplianceResult> {
  const companyForm = normalizeCompanyForm(a.entities?.legal_form);
  const tipoSocial = toTipoSocial(companyForm);
  const organoTipo = toTipoOrgano(a.governing_bodies?.body_type ?? null);

  // Cargar rule packs activos
  const { data: rpVersions } = await supabase
    .from("rule_pack_versions")
    .select("*, rule_packs!inner(materia, clase, organo_tipo)")
    .eq("tenant_id", DEMO_TENANT)
    .eq("status", "ACTIVE");

  // Cargar overrides para la entidad
  const { data: overridesRaw } = a.entity_id
    ? await supabase
        .from("rule_param_overrides")
        .select("*")
        .eq("tenant_id", DEMO_TENANT)
        .eq("entity_id", a.entity_id)
    : { data: [] };

  // Buscar el rule pack de la materia del acuerdo
  const rpRows = (rpVersions ?? []) as RulePackJoinRow[];
  const matchingVersion = rpRows.find(
    (v) => v.rule_packs?.materia === a.agreement_kind
  );

  const packs: RulePack[] = matchingVersion
    ? [matchingVersion.params as RulePack]
    : [];

  const overrides: RuleParamOverride[] = ((overridesRaw ?? []) as OverrideRaw[]).map((o) => ({
    id: o.id,
    entity_id: o.entity_id,
    materia: o.materia,
    clave: o.clave,
    valor: o.valor,
    fuente: o.fuente,
    referencia: o.referencia,
  }));

  // Cargar forma_administracion de la entidad
  let formaAdministracion: FormaAdministracion = "CONSEJO";
  if (a.entity_id) {
    const { data: ent } = await supabase
      .from("entities")
      .select("forma_administracion, es_unipersonal")
      .eq("id", a.entity_id)
      .maybeSingle();
    if (ent?.forma_administracion) {
      formaAdministracion = ent.forma_administracion as FormaAdministracion;
    }
  }

  const adoptionMode = a.adoption_mode as AdoptionMode;
  const materiaClase = toMateriaClase(a.matter_class);

  const result: EngineComplianceResult = evaluarAcuerdoCompleto(
    adoptionMode,
    packs,
    overrides,
    {
      convocatoria: {
        tipoSocial,
        organoTipo,
        adoptionMode,
        fechaJunta: new Date().toISOString(),
        esCotizada: false,
        webInscrita: false,
        primeraConvocatoria: true,
        esJuntaUniversal: adoptionMode === "UNIVERSAL",
        materias: [a.agreement_kind],
      },
      constitucion: {
        tipoSocial,
        organoTipo,
        adoptionMode,
        primeraConvocatoria: true,
        materiaClase,
        capitalConDerechoVoto: 0,
        capitalPresenteRepresentado: 0,
      },
      votacion: {
        tipoSocial,
        organoTipo,
        adoptionMode,
        materiaClase,
        materias: [a.agreement_kind],
        votos: { favor: 0, contra: 0, abstenciones: 0, en_blanco: 0, capital_presente: 0, capital_total: 0 },
      },
      documentacion: {
        adoptionMode,
        materias: [a.agreement_kind],
        documentosDisponibles: [],
      },
    }
  );

  // Mapear EngineComplianceResult → ComplianceResult V1
  const convEtapa = result.etapas.find((e) => e.etapa === "convocatoria");
  const quorumEtapa = result.etapas.find((e) => e.etapa === "constitucion");
  const votEtapa = result.etapas.find((e) => e.etapa === "votacion");
  const postEtapa = result.etapas.find((e) => e.etapa === "postAcuerdo");

  const inscribable = postEtapa?.explain.some((e) => e.regla === "inscribible" && e.valor === "true") ?? a.inscribable;

  return {
    agreement_id: a.id,
    agreement_kind: a.agreement_kind,
    matter_class: a.matter_class,
    adoption_mode: a.adoption_mode,
    inscribable,
    convocation_compliant: convEtapa?.ok ?? true,
    quorum_compliant: quorumEtapa?.ok ?? true,
    conflict_handled: true,
    majority_compliant: votEtapa?.ok ?? true,
    instrument_required: "NINGUNO",
    registry_required: inscribable,
    publication_required: false,
    publication_channel: null,
    blocking_issues: result.blocking_issues,
    status: a.status,
  };
}

/**
 * Deriva el cumplimiento societario del acuerdo a partir de:
 *  - agreements (matter_class, adoption_mode, required_quorum_code, required_majority_code)
 *  - jurisdiction_rule_sets (plazos, quorum, mayorías, vías de publicación)
 *  - meeting / unipersonal_decision / no_session_resolution según adoption_mode
 *
 * No aplica cambios en BD — es una vista derivada para el expediente del acuerdo.
 */
export function useAgreementCompliance(agreementId?: string) {
  return useQuery({
    queryKey: ["agreement_compliance", agreementId ?? "none"],
    enabled: !!agreementId,
    staleTime: 60_000,
    queryFn: async (): Promise<ComplianceResult | null> => {
      // 1. Acuerdo + entidad (V2 carga body_type adicional)
      const selectCols = ENGINE_V2
        ? "*, entities(jurisdiction, legal_form), governing_bodies(name, body_type)"
        : "*, entities(jurisdiction, legal_form)";
      const { data: agreement, error: aErr } = await supabase
        .from("agreements")
        .select(selectCols)
        .eq("tenant_id", DEMO_TENANT)
        .eq("id", agreementId!)
        .maybeSingle();
      if (aErr) throw aErr;
      if (!agreement) return null;

      const a = agreement as unknown as AgreementWithEntity;

      // --- V2 path: motor de reglas LSC puro ---
      if (ENGINE_V2) {
        return evaluateV2(a);
      }

      // --- V1 path: lógica inline (legacy) ---
      const jurisdiction: string | null = a.entities?.jurisdiction ?? null;
      const legalForm: string | null = a.entities?.legal_form ?? null;

      // 2. Reglas jurisdiccionales
      let rule: JurisdictionRule = null;
      const companyForm = normalizeCompanyForm(legalForm);
      if (jurisdiction && companyForm) {
        const { data } = await supabase
          .from("jurisdiction_rule_sets")
          .select("*")
          .eq("tenant_id", DEMO_TENANT)
          .eq("jurisdiction", jurisdiction)
          .eq("company_form", companyForm)
          .eq("is_active", true)
          .maybeSingle();
        rule = (data as JurisdictionRule) ?? null;
      }
      const cfg: RuleConfig = rule?.rule_config ?? {};

      const blocking: string[] = [];

      // 3. Flags por adoption_mode
      let convocation_compliant = true;
      let quorum_compliant = true;
      let majority_compliant = true;
      let conflict_handled = true;

      if (a.adoption_mode === "MEETING" && a.parent_meeting_id) {
        // F9: meeting / meeting_resolutions / conflicts_of_interest son independientes
        // entre sí — se lanzan en paralelo. `conv` depende de `meeting` y queda secuencial.
        const [meetingRes, resolutionsRes, conflictsRes] = await Promise.all([
          supabase
            .from("meetings")
            .select("*")
            .eq("tenant_id", DEMO_TENANT)
            .eq("id", a.parent_meeting_id)
            .maybeSingle(),
          supabase
            .from("meeting_resolutions")
            .select("status")
            .eq("tenant_id", DEMO_TENANT)
            .eq("agreement_id", a.id),
          supabase
            .from("conflicts_of_interest")
            .select("id, status")
            .eq("tenant_id", DEMO_TENANT)
            .eq("related_meeting_id", a.parent_meeting_id),
        ]);

        const m = meetingRes.data as MeetingRow;
        const res = (resolutionsRes.data ?? []) as ResolutionRow[];
        const conflicts = (conflictsRes.data ?? []) as ConflictRow[];

        // No existe FK meetings↔convocatorias: se localiza la convocatoria por
        // body_id + fecha_1 == fecha de la reunión (match determinista sobre el seed).
        let conv: ConvocatoriaRow | null = null;
        if (m?.body_id && m?.scheduled_start) {
          const meetingDateISO = String(m.scheduled_start).slice(0, 10);
          const { data: convs } = await supabase
            .from("convocatorias")
            .select("fecha_emision, fecha_1, urgente, junta_universal")
            .eq("tenant_id", DEMO_TENANT)
            .eq("body_id", m.body_id)
            .eq("fecha_1", meetingDateISO)
            .order("fecha_emision", { ascending: false })
            .limit(1);
          conv = ((convs as ConvocatoriaRow[] | null)?.[0]) ?? null;
        }

        // Convocatoria: plazo mínimo respetado
        const notice = conv?.fecha_emision;
        const meetingDate = conv?.fecha_1;
        if (conv?.junta_universal) {
          convocation_compliant = true;
        } else if (notice && meetingDate) {
          const diffDays = Math.floor(
            (new Date(meetingDate).getTime() - new Date(notice).getTime()) /
              (1000 * 60 * 60 * 24),
          );
          const minDays =
            cfg.notice_periods_days?.[
              a.matter_class === "ESTRUCTURAL" || a.matter_class === "ESTATUTARIA"
                ? "extraordinaria"
                : "ordinaria"
            ] ?? 15;
          if (diffDays < minDays) {
            convocation_compliant = false;
            blocking.push(
              `Plazo de convocatoria insuficiente: ${diffDays}d < ${minDays}d exigidos`,
            );
          }
        } else if (a.status !== "DRAFT" && a.status !== "PROPOSED") {
          // Acuerdo ya adoptado sin convocatoria localizable: advertencia, no bloqueo
          convocation_compliant = false;
          blocking.push(
            "Convocatoria no localizable para la reunión — plazo no verificable.",
          );
        }

        // Quorum: validado por vista/hook externo; marcamos pendiente si meeting no existe
        if (!m) {
          quorum_compliant = false;
          blocking.push("Reunión no localizada para validar quórum.");
        }

        // Mayoría: si acuerdo ya tiene decision_text y meeting tiene resolutions aprobadas.
        // Si el acuerdo ya está ADOPTED+ sin meeting_resolutions vinculadas (seed sin back-fill
        // de agreement_id), confiamos en la transición de estado y no bloqueamos.
        if (!res || res.length === 0) {
          majority_compliant = true;
        } else {
          const approved = res.some((r) => r.status === "APROBADO");
          majority_compliant = approved;
          if (!approved && a.status !== "DRAFT" && a.status !== "PROPOSED") {
            blocking.push("Resolución asociada no figura como APROBADA.");
          }
        }

        // Conflictos de interés ligados a la reunión
        if (conflicts && conflicts.length > 0) {
          conflict_handled = conflicts.every(
            (c) => c.status === "RESUELTO" || c.status === "NOTIFICADO",
          );
          if (!conflict_handled) {
            blocking.push("Existen conflictos de interés no resueltos en la reunión.");
          }
        }
      } else if (a.adoption_mode === "UNIVERSAL") {
        convocation_compliant = true; // Junta universal no requiere plazo
      } else if (a.adoption_mode === "NO_SESSION" && a.no_session_resolution_id) {
        const { data: nsr } = await supabase
          .from("no_session_resolutions")
          .select(
            "status, requires_unanimity, votes_for, votes_against, abstentions",
          )
          .eq("tenant_id", DEMO_TENANT)
          .eq("id", a.no_session_resolution_id)
          .maybeSingle();
        const n = nsr as NoSessionRow;
        if (!n) {
          majority_compliant = false;
          blocking.push("Resolución sin sesión no localizada.");
        } else if (n.requires_unanimity) {
          const unanimous = n.votes_against === 0 && n.abstentions === 0;
          majority_compliant = unanimous;
          if (!unanimous && n.status === "APROBADO") {
            blocking.push("Acuerdo requiere unanimidad y no se ha alcanzado.");
          }
        } else {
          majority_compliant = n.status === "APROBADO";
        }
        convocation_compliant = true;
      } else if (
        a.adoption_mode === "UNIPERSONAL_SOCIO" ||
        a.adoption_mode === "UNIPERSONAL_ADMIN"
      ) {
        // Decisión unipersonal — no hay convocatoria ni quórum
        convocation_compliant = true;
        quorum_compliant = true;
        const { data: dec } = await supabase
          .from("unipersonal_decisions")
          .select("status")
          .eq("tenant_id", DEMO_TENANT)
          .eq("id", a.unipersonal_decision_id)
          .maybeSingle();
        const d = dec as UnipersonalRow;
        majority_compliant = d?.status === "FIRMADA" || a.status === "DRAFT";
        if (!majority_compliant) {
          blocking.push("Decisión unipersonal aún no firmada.");
        }
      }

      // 4. Instrumento requerido
      const inscribableMatters: string[] = cfg.inscribable_matters ?? [];
      const isInscribable = a.inscribable || inscribableMatters.includes(a.agreement_kind);

      let instrument_required: InstrumentRequired = "NINGUNO";
      if (isInscribable) {
        const filingTypes: string[] = cfg.registry_filing_types ?? [];
        // Heurística: materias ESTRUCTURAL y MOD_ESTATUTOS requieren escritura
        if (
          a.matter_class === "ESTRUCTURAL" ||
          a.agreement_kind === "MOD_ESTATUTOS" ||
          a.agreement_kind === "AMPLIACION_CAPITAL" ||
          a.agreement_kind === "FUSION" ||
          a.agreement_kind === "ESCISION"
        ) {
          instrument_required = "ESCRITURA";
        } else if (filingTypes.includes("INSTANCIA") || filingTypes.includes("instancia")) {
          instrument_required = "INSTANCIA";
        } else {
          instrument_required = "ESCRITURA";
        }
      }

      // 5. Publicación
      const publicationChannels: Record<string, string> = cfg.publication_channels ?? {};
      const publication_required =
        a.agreement_kind === "AMPLIACION_CAPITAL" ||
        a.agreement_kind === "FUSION" ||
        a.agreement_kind === "ESCISION" ||
        a.agreement_kind === "DISOLUCION" ||
        a.agreement_kind === "REDUCCION_CAPITAL";

      let publication_channel: string | null = null;
      if (publication_required) {
        publication_channel =
          publicationChannels.default ??
          publicationChannels.primary ??
          (jurisdiction === "ES"
            ? "BORME"
            : jurisdiction === "MX"
              ? "PSM"
              : jurisdiction === "BR"
                ? "Diário Oficial"
                : jurisdiction === "PT"
                  ? "Portal da Justiça"
                  : null);
      }

      return {
        agreement_id: a.id,
        agreement_kind: a.agreement_kind,
        matter_class: a.matter_class,
        adoption_mode: a.adoption_mode,
        inscribable: isInscribable,
        convocation_compliant,
        quorum_compliant,
        conflict_handled,
        majority_compliant,
        instrument_required,
        registry_required: isInscribable,
        publication_required,
        publication_channel,
        blocking_issues: blocking,
        status: a.status,
      };
    },
  });
}

/**
 * F6.2: Firmantes vigentes de una entidad desde `authority_evidence`.
 * Devuelve filas VIGENTES por cargo certificante. Usado por el flujo de
 * certificación (ActaDetalle, EmitirCertificacionButton) para validar
 * que el firmante tiene cargo vigente antes de llamar a fn_generar_certificacion.
 */
export function useFirmantesVigentes(entityId?: string, bodyId?: string | null) {
  return useQuery({
    queryKey: ["authority_evidence", "firmantes", entityId ?? "none", bodyId ?? "null"],
    enabled: !!entityId,
    staleTime: 30_000,
    queryFn: async () => {
      let q = supabase
        .from("authority_evidence")
        .select("id, person_id, cargo, body_id, fecha_inicio, fecha_fin, estado, person:person_id(full_name)")
        .eq("tenant_id", DEMO_TENANT)
        .eq("entity_id", entityId!)
        .eq("estado", "VIGENTE")
        .in("cargo", ["PRESIDENTE", "SECRETARIO", "VICEPRESIDENTE", "VICESECRETARIO", "ADMIN_UNICO", "ADMIN_SOLIDARIO", "ADMIN_MANCOMUNADO", "CONSEJERO_COORDINADOR"]);
      if (bodyId !== undefined && bodyId !== null) {
        q = q.eq("body_id", bodyId);
      }
      const { data, error } = await q;
      if (error) throw error;
      type Raw = {
        id: string;
        person_id: string;
        cargo: string;
        body_id: string | null;
        fecha_inicio: string | null;
        fecha_fin: string | null;
        estado: string;
        person?: { full_name?: string | null } | null;
      };
      return ((data ?? []) as Raw[]).map((r) => ({
        id: r.id,
        person_id: r.person_id,
        cargo: r.cargo,
        body_id: r.body_id,
        fecha_inicio: r.fecha_inicio,
        fecha_fin: r.fecha_fin,
        estado: r.estado,
        full_name: r.person?.full_name ?? null,
      }));
    },
  });
}

export function useAgreementsByEntity(entityId?: string) {
  return useQuery({
    queryKey: ["agreements", "entity", entityId ?? "none"],
    enabled: !!entityId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agreements")
        .select("*, governing_bodies(name, body_type)")
        .eq("tenant_id", DEMO_TENANT)
        .eq("entity_id", entityId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AgreementFull[];
    },
  });
}
