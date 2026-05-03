/**
 * Variable Resolver — Maps capa2 variable sources to real Supabase data
 *
 * Each capa2 variable has a `fuente` (source) indicating where to fetch
 * the real value from. This service resolves all variables for a given
 * agreement context.
 *
 * Sources:
 * - ENTIDAD  → entities table (denominacion_social, cif, domicilio, etc.)
 * - ORGANO   → governing_bodies + condiciones_persona (presidente, secretario, members)
 * - REUNION  → meetings + agenda + participants
 * - EXPEDIENTE → agreements table (the agreement itself)
 * - CAP_TABLE → capital_holdings + parte_votante_current
 * - MOTOR    → compliance snapshot from Motor de Reglas LSC
 * - SISTEMA  → runtime values (fecha, hora, usuario, etc.)
 * - USUARIO  → values from capa3 form (resolved separately)
 */

import { supabase } from "@/integrations/supabase/client";

// ── Types ────────────────────────────────────────────────────────────────────

export interface Capa2Variable {
  variable: string;
  fuente: string;   // ENTIDAD | ORGANO | REUNION | EXPEDIENTE | MOTOR | SISTEMA | USUARIO
  condicion: string;
}

export interface ResolverContext {
  agreementId: string;
  tenantId: string;
  entityId?: string;
  bodyId?: string;
  meetingId?: string;
  complianceSnapshot?: Record<string, unknown>;
  now?: Date | string;
}

export interface ResolvedVariables {
  values: Record<string, unknown>;
  resolved: string[];
  unresolved: string[];
  errors: string[];
}

// ── Local join types ─────────────────────────────────────────────────────────

type PersonRow = { name?: string | null; full_name?: string | null };
type BodyMandateRow = {
  role?: string | null;
  tipo_condicion?: string | null;
  person_name?: string | null;
  persons?: PersonRow | null;
};
type BodyWithMandates = {
  id?: string | null;
  name: string;
  established_date?: string | null;
  legal_basis?: string | null;
};
type AgendaItemRow = { order_index?: number | null; title?: string | null; description?: string | null };
type ParticipantRow = {
  attendance_status?: string | null;
  attended?: boolean | null;
  person_name?: string | null;
  name?: string | null;
  role?: string | null;
  absence_reason?: string | null;
};
type ResolutionRow = {
  agenda_item_index?: number | null;
  resolution_text?: string | null;
  resolution_type?: string | null;
  status?: string | null;
};
type MeetingWithJoins = {
  status?: string | null;
  date?: string | null;
  scheduled_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  location?: string | null;
  convocation_date?: string | null;
  publication_medium?: string | null;
  publication_date?: string | null;
  notice_days?: number | null;
  second_call_date?: string | null;
  second_call_time?: string | null;
  meeting_participants?: ParticipantRow[];
  meeting_agenda?: AgendaItemRow[];
  meeting_resolutions?: ResolutionRow[];
};

// ── Entity resolver ──────────────────────────────────────────────────────────

async function resolveEntityVars(entityId: string, tenantId: string): Promise<Record<string, unknown>> {
  const { data, error } = await supabase
    .from("entities")
    .select("*")
    .eq("id", entityId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error || !data) return {};

  return {
    name: data.common_name || data.legal_name,
    tax_id: data.tax_id || data.registration_number,
    registration_number: data.registration_number,
    legal_name: data.legal_name,
    common_name: data.common_name,
    jurisdiction: data.jurisdiction,
    legal_form: data.legal_form,
    entity_type_detail: data.tipo_social || data.legal_form,
    denominacion_social: data.legal_name || data.common_name,
    cif: data.tax_id || data.registration_number || "—",
    domicilio_social: data.address || "—",
    registro_mercantil: data.registry_location || "—",
    tomo: data.registry_volume || "—",
    folio: data.registry_folio || "—",
    hoja: data.registry_sheet || "—",
    inscripcion: data.registry_inscription || "—",
    lugar: data.city || data.address || "—",
    tipo_social: data.tipo_social || data.legal_form, // SA, SL
    articulo_estatutos_comision: data.bylaws_commission_article || "—",
  };
}

// ── Body (organ) resolver ────────────────────────────────────────────────────

async function resolveBodyVars(bodyId: string, tenantId: string): Promise<Record<string, unknown>> {
  const { data: body, error } = await supabase
    .from("governing_bodies")
    .select("*")
    .eq("id", bodyId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error || !body) return {};

  const bodyTyped = body as unknown as BodyWithMandates;
  const { data: rawMandates } = await supabase
    .from("condiciones_persona")
    .select("id, tipo_condicion, persons(full_name)")
    .eq("body_id", bodyId)
    .eq("tenant_id", tenantId)
    .eq("estado", "VIGENTE")
    .order("tipo_condicion", { ascending: true });
  const mandates = ((rawMandates ?? []) as BodyMandateRow[]).map((mandate) => ({
    ...mandate,
    role: mandate.role ?? mandate.tipo_condicion ?? null,
  }));

  // Find presidente and secretario by role
  const presidenteMandate = mandates.find((m) =>
    m.role?.toLowerCase().includes("presidente") || m.role?.toLowerCase().includes("president")
  );
  const secretarioMandate = mandates.find((m) =>
    m.role?.toLowerCase().includes("secretario") || m.role?.toLowerCase().includes("secretary")
  );

  const miembros = mandates.map((m) => ({
    nombre: m.persons?.full_name || m.persons?.name || m.person_name || "—",
    cargo: m.role || "Vocal",
  }));

  return {
    name: bodyTyped.name,
    established_date: bodyTyped.established_date,
    legal_basis: bodyTyped.legal_basis,
    nombre_comision: bodyTyped.name,
    organo_nombre: bodyTyped.name,
    organo_convocante: bodyTyped.name,   // alias used in JGA acta templates
    presidente: presidenteMandate?.persons?.full_name || presidenteMandate?.persons?.name || presidenteMandate?.person_name || "—",
    secretario: secretarioMandate?.persons?.full_name || secretarioMandate?.persons?.name || secretarioMandate?.person_name || "—",
    cargo_convocante: presidenteMandate?.role || "Presidente",
    convocante_nombre: presidenteMandate?.persons?.full_name || presidenteMandate?.persons?.name || "—",
    miembros_totales: mandates.length,
    miembros: miembros,
    fecha_constitucion_comision: bodyTyped.established_date || "—",
    base_cargo_mesa: bodyTyped.legal_basis || "los Estatutos Sociales",
  };
}

// ── Meeting resolver ─────────────────────────────────────────────────────────

async function resolveMeetingVars(meetingId: string, tenantId: string): Promise<Record<string, unknown>> {
  const { data: meeting, error } = await supabase
    .from("meetings")
    .select("*, meeting_participants(*), meeting_agenda(*), meeting_resolutions(*)")
    .eq("id", meetingId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error || !meeting) return {};

  const meetingTyped = meeting as unknown as MeetingWithJoins;
  const participants = meetingTyped.meeting_participants ?? [];
  const agenda = (meetingTyped.meeting_agenda ?? [])
    .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

  const presentes = participants.filter((p) => p.attendance_status === "PRESENT" || p.attended);
  const ausentes = participants.filter((p) => p.attendance_status === "ABSENT" || !p.attended);

  // Extract mesa roles from participants (fallback for JGA where no body mandate exists)
  const presidenteP = participants.find(
    (p) => p.role?.toLowerCase().includes("presidente") || p.role?.toLowerCase().includes("president")
  );
  const secretarioP = participants.find(
    (p) => p.role?.toLowerCase().includes("secretario") || p.role?.toLowerCase().includes("secretary")
  );

  // Build ordered acuerdos from meeting_resolutions
  const resolutions = meetingTyped.meeting_resolutions ?? [];
  const acuerdos = resolutions
    .sort((a, b) => (a.agenda_item_index ?? 0) - (b.agenda_item_index ?? 0))
    .map((r, i) => ({
      ordinal: String(i + 1),
      titulo: `Punto ${r.agenda_item_index ?? i + 1} del orden del día`,
      texto: r.resolution_text || "—",
      resultado_votacion:
        r.status === "ADOPTED" ? "Adoptado" :
        r.status === "REJECTED" ? "Rechazado" :
        r.status || "Pendiente",
      tipo: r.resolution_type || "—",
    }));

  const meetingDate = meetingTyped.date || meetingTyped.scheduled_date;

  return {
    status: meetingTyped.status,
    date: meetingTyped.date,
    scheduled_date: meetingTyped.scheduled_date,
    start_time: meetingTyped.start_time,
    end_time: meetingTyped.end_time,
    location: meetingTyped.location,
    convocation_date: meetingTyped.convocation_date,
    publication_medium: meetingTyped.publication_medium,
    publication_date: meetingTyped.publication_date,
    notice_days: meetingTyped.notice_days,
    second_call_date: meetingTyped.second_call_date,
    second_call_time: meetingTyped.second_call_time,
    fecha: meetingDate,
    hora_inicio: meetingTyped.start_time || "—",
    hora_fin: meetingTyped.end_time || "—",
    lugar: meetingTyped.location || "—",
    lugar_junta: meetingTyped.location || "—",
    fecha_junta: meetingDate,
    hora_junta: meetingTyped.start_time || "—",
    // Mesa roles from participants (used when no governing_body mandate is available, e.g. JGA)
    presidente: presidenteP?.person_name || presidenteP?.name || null,
    secretario: secretarioP?.person_name || secretarioP?.name || null,
    miembros_presentes: presentes.map((p) => ({
      nombre: p.person_name || p.name || "—",
      cargo: p.role || "Miembro",
    })),
    miembros_ausentes: ausentes.map((p) => ({
      nombre: p.person_name || p.name || "—",
      cargo: p.role || "Miembro",
      justificacion: p.absence_reason || null,
    })),
    miembros_presentes_count: presentes.length,
    orden_dia: agenda.map((a, i) => ({
      ordinal: `${i + 1}`,
      descripcion_punto: a.title || a.description || "—",
    })),
    acuerdos,
    // Convocatoria specific
    fecha_convocatoria: meetingTyped.convocation_date || "—",
    medio_publicacion: meetingTyped.publication_medium || "—",
    fecha_publicacion_convocatoria: meetingTyped.publication_date || "—",
    dias_antelacion: meetingTyped.notice_days || "—",
    segunda_convocatoria: !!meetingTyped.second_call_date,
    fecha_segunda_convocatoria: meetingTyped.second_call_date || null,
    hora_segunda_convocatoria: meetingTyped.second_call_time || null,
  };
}

// ── Agreement (expediente) resolver ──────────────────────────────────────────

async function resolveAgreementVars(agreementId: string, tenantId: string): Promise<Record<string, unknown>> {
  const { data, error } = await supabase
    .from("agreements")
    .select("*")
    .eq("id", agreementId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error || !data) return {};

  return {
    id: data.id,
    agreement_kind: data.agreement_kind,
    matter_class: data.matter_class,
    adoption_mode: data.adoption_mode,
    status: data.status,
    proposal_text: data.proposal_text,
    decision_text: data.decision_text,
    decision_date: data.decision_date,
    statutory_basis: data.statutory_basis,
    tipo_junta: data.agreement_kind,
    tipo_junta_texto: data.agreement_kind === "ORDINARIA" ? "Ordinaria" : "Extraordinaria",
    materia: data.matter_class,
    modo_adopcion: data.adoption_mode,
    texto_acuerdo_certificado: data.decision_text || data.proposal_text,
    resultado_adopcion_texto:
      data.status === "ADOPTED" ? "Adoptado" :
      data.status === "REJECTED" ? "Rechazado" :
      data.status || "Pendiente",
    documentos_disponibles: [],  // Would come from related documents
    complemento_convocatoria: false,
    documentos_adjuntos: [],
  };
}

// ── Motor (compliance) resolver ──────────────────────────────────────────────

function resolveMotorVars(snapshot?: Record<string, unknown>): Record<string, unknown> {
  if (!snapshot) {
    return {
      snapshot_rule_pack_id: "—",
      snapshot_rule_pack_version: "—",
      snapshot_hash: "—",
      resultado_gate: "PENDIENTE",
      quorum_observado: "—",
      quorum_requerido: "—",
      quorum_fuente: "—",
      quorum_referencia_legal: "—",
      convocatoria_ordinal: "primera",
      quorum_primera_convocatoria: true,
      puntos_votacion: [],
    };
  }

  return {
    snapshot_rule_pack_id: snapshot.rulePackId || snapshot.snapshot_rule_pack_id || "—",
    snapshot_rule_pack_version: snapshot.rulePackVersion || snapshot.snapshot_rule_pack_version || "—",
    snapshot_hash: snapshot.snapshot_hash || snapshot.gate_hash || "—",
    resultado_gate: snapshot.ok ? "CONFORME" : "NO CONFORME",
    quorum_observado: snapshot.quorumPresente || "—",
    quorum_pct: snapshot.quorumPresente || "—",
    quorum_requerido: snapshot.quorumRequerido || "—",
    quorum_fuente: "LSC",
    quorum_referencia_legal: snapshot.quorumReferencia || "art. 193 LSC",
    convocatoria_ordinal: snapshot.primeraConvocatoria !== false ? "primera" : "segunda",
    quorum_primera_convocatoria: snapshot.primeraConvocatoria !== false,
    quorum_rama: snapshot.quorumRama || null,
    quorum_rama_pct: snapshot.quorumRama || null,
    convocatoria_ordinal_detalle: snapshot.convocatoriaDetalle || null,
    puntos_votacion: snapshot.votaciones || [],
    materias_indelegables_warning: snapshot.materiasIndelegablesWarning || false,
    requiere_ratificacion: snapshot.requiereRatificacion || false,
    acuerdos_ratificacion: snapshot.acuerdosRatificacion || [],
    derecho_representacion: true,
  };
}

// ── System resolver ──────────────────────────────────────────────────────────

function resolveSystemVars(nowInput?: Date | string): Record<string, unknown> {
  const now = nowInput
    ? new Date(nowInput)
    : new Date();
  const iso = Number.isNaN(now.getTime()) ? new Date().toISOString() : now.toISOString();
  return {
    fecha_emision: iso.split("T")[0],
    fecha_generacion: iso,
    tsq_token: `TSQ-${iso.replace(/\D/g, "").slice(0, 17)}`,
    firma_qes_ref: null, // Filled after QES signing
    ocsp_status: null,
    firma_qes_timestamp: null,
    canal_notificacion: "comunicación electrónica con acuse de recibo",
    acuse_electronico: true,
    usuario_generador: "Secretario",
  };
}

// ── Cap-table resolver ───────────────────────────────────────────────────────

async function resolveCapTableVars(entityId: string, tenantId: string): Promise<Record<string, unknown>> {
  const { data: holdings, error } = await supabase
    .from("capital_holdings")
    .select("holder_person_id, numero_titulos, porcentaje_capital, voting_rights")
    .eq("entity_id", entityId)
    .eq("tenant_id", tenantId)
    .is("effective_to", null)
    .eq("is_treasury", false)
    .order("porcentaje_capital", { ascending: false });

  if (error || !holdings || holdings.length === 0) return {};

  // Fetch persons for all holders in one round-trip
  const personIds = [...new Set(holdings.map((h) => h.holder_person_id).filter(Boolean))];
  const { data: persons } = await supabase
    .from("persons")
    .select("id, full_name, tax_id, denomination")
    .in("id", personIds);

  type PersonRow2 = { id: string; full_name?: string | null; tax_id?: string | null; denomination?: string | null };
  const personMap: Record<string, PersonRow2> = {};
  for (const p of (persons ?? []) as PersonRow2[]) {
    personMap[p.id] = p;
  }

  // Fetch voting weights (parte_votante_current); graceful if empty
  const { data: voting } = await supabase
    .from("parte_votante_current")
    .select("person_id, voting_weight, denominator_weight")
    .eq("entity_id", entityId)
    .eq("tenant_id", tenantId)
    .eq("voting_rights", true);

  const votingMap: Record<string, { weight: number; denominator: number }> = {};
  for (const v of voting ?? []) {
    if (v.person_id) {
      votingMap[v.person_id] = { weight: Number(v.voting_weight), denominator: Number(v.denominator_weight) };
    }
  }

  const lista_socios = holdings.map((h) => {
    const person = personMap[h.holder_person_id] || {};
    const nombre = person.full_name || person.denomination || "—";
    const porcentaje = h.porcentaje_capital ? Number(h.porcentaje_capital) : 0;

    const vv = votingMap[h.holder_person_id];
    const porcentaje_voto =
      vv && vv.denominator > 0
        ? ((vv.weight / vv.denominator) * 100).toFixed(4)
        : porcentaje.toFixed(4);

    return {
      nombre,
      tax_id: person.tax_id || "—",
      numero_titulos: Number(h.numero_titulos).toLocaleString("es-ES"),
      porcentaje_capital: porcentaje.toFixed(4),
      porcentaje_voto,
      tiene_voto: h.voting_rights,
    };
  });

  const porcentaje_capital_presente = lista_socios
    .reduce((sum, s) => sum + Number(s.porcentaje_capital), 0)
    .toFixed(2);

  return {
    lista_socios,
    porcentaje_capital_presente,
    total_socios: lista_socios.length,
  };
}

// ── Fuente normalizer ────────────────────────────────────────────────────────

// DB stores dotted-path fuente values like "entities.name" or legacy singular
// paths like "agreement.adoption_mode". Normalize before source lookup.
export function normalizeFuente(fuente: string): string {
  const raw = fuente.trim();
  const lower = raw.toLowerCase();

  if (!raw) return "";
  if (["entidad", "entity", "entities"].includes(lower) || lower.startsWith("entities.") || lower.startsWith("entity.")) {
    return "ENTIDAD";
  }
  if (
    ["organo", "órgano", "governing_body", "governing_bodies", "body", "bodies"].includes(lower) ||
    lower.startsWith("governing_bodies.") ||
    lower.startsWith("governing_body.") ||
    lower.startsWith("body.") ||
    lower.startsWith("bodies.") ||
    lower.startsWith("body_mandates.") ||
    lower.startsWith("mandate.") ||
    lower.startsWith("mandates.") ||
    lower.startsWith("persons.") ||
    lower.startsWith("person.")
  ) {
    return "ORGANO";
  }
  if (
    ["reunion", "reunión", "meeting", "meetings", "convocatoria", "convocatorias"].includes(lower) ||
    lower.startsWith("meetings.") ||
    lower.startsWith("meeting.") ||
    lower.startsWith("meeting_participants.") ||
    lower.startsWith("meeting_agenda.") ||
    lower.startsWith("meeting_resolutions.") ||
    lower.startsWith("convocatoria.") ||
    lower.startsWith("convocatorias.")
  ) {
    return "REUNION";
  }
  if (
    ["expediente", "agreement", "agreements", "registry_filing", "registry_filings", "tramitador"].includes(lower) ||
    lower.startsWith("agreement.") ||
    lower.startsWith("agreements.") ||
    lower.startsWith("registry_filing.") ||
    lower.startsWith("registry_filings.") ||
    lower.startsWith("tramitador.")
  ) {
    return "EXPEDIENTE";
  }
  if (
    ["cap_table", "capital_holdings", "parte_votante", "socios", "shareholders"].includes(lower) ||
    lower.startsWith("capital_holdings.") ||
    lower.startsWith("cap_table.") ||
    lower.startsWith("parte_votante.") ||
    lower.startsWith("socios.") ||
    lower.startsWith("shareholder.") ||
    lower.startsWith("shareholders.")
  ) return "CAP_TABLE";
  if (
    ["motor", "ley", "estatutos", "pacto", "pacto_parasocial", "reglamento", "rule_pack"].includes(lower) ||
    lower.startsWith("rule_pack.") ||
    lower.startsWith("evaluar") ||
    lower.startsWith("calcular")
  ) {
    return "MOTOR";
  }
  if (
    ["sistema", "qtsp", "ead_trust"].includes(lower) ||
    lower.startsWith("qtsp.") ||
    lower.startsWith("firma_qes") ||
    lower.startsWith("tsq")
  ) {
    return "SISTEMA";
  }
  if (["usuario", "user", "capa3"].includes(lower)) return "USUARIO";
  // Already uppercase category key or unknown — pass through uppercased
  return raw.toUpperCase();
}

function directFuenteValue(source: Record<string, unknown>, fuente: string): unknown {
  const raw = fuente.trim();
  const equality = raw.match(/^[^.]+\.([a-zA-Z0-9_]+)\s*==\s*['"]([^'"]+)['"]$/);
  if (equality) {
    const [, field, expected] = equality;
    return source[field] === expected;
  }

  const parts = raw.split(".");
  if (parts.length < 2) return undefined;

  const field = parts[parts.length - 1];
  if (field in source) return source[field];

  const pathAfterCategory = parts.slice(1).join(".");
  if (pathAfterCategory in source) return source[pathAfterCategory];

  return undefined;
}

// ── Main resolver ────────────────────────────────────────────────────────────

/**
 * Resolve all capa2 variables from their declared sources.
 *
 * @param capa2 - Array of capa2 variable definitions from plantilla
 * @param context - Agreement context with IDs for lookups
 * @returns Resolved values with tracking of what was/wasn't resolved
 */
export async function resolveVariables(
  capa2: Capa2Variable[],
  context: ResolverContext
): Promise<ResolvedVariables> {
  const values: Record<string, unknown> = {};
  const resolved: string[] = [];
  const unresolved: string[] = [];
  const errors: string[] = [];

  // Fetch all sources in parallel — always fetch when IDs are present so that
  // dotted-path fuente values (e.g. "entities.name") don't silently skip resolution.
  const [entityVars, bodyVars, meetingVars, agreementVars, capTableVars] = await Promise.all([
    context.entityId
      ? resolveEntityVars(context.entityId, context.tenantId)
      : Promise.resolve({}),
    context.bodyId
      ? resolveBodyVars(context.bodyId, context.tenantId)
      : Promise.resolve({}),
    context.meetingId
      ? resolveMeetingVars(context.meetingId, context.tenantId)
      : Promise.resolve({}),
    context.agreementId
      ? resolveAgreementVars(context.agreementId, context.tenantId)
      : Promise.resolve({}),
    context.entityId
      ? resolveCapTableVars(context.entityId, context.tenantId)
      : Promise.resolve({}),
  ]);

  const motorVars = resolveMotorVars(context.complianceSnapshot);
  const systemVars = resolveSystemVars(context.now);

  // Source map
  const sourceMap: Record<string, Record<string, unknown>> = {
    ENTIDAD: entityVars,
    ORGANO: bodyVars,
    REUNION: meetingVars,
    EXPEDIENTE: agreementVars,
    CAP_TABLE: capTableVars,
    MOTOR: motorVars,
    SISTEMA: systemVars,
    USUARIO: {}, // Filled from capa3 form — not auto-resolved
  };

  // Resolve each variable
  for (const v of capa2) {
    const normalizedFuente = normalizeFuente(v.fuente);
    const source = sourceMap[normalizedFuente] || {};
    const value = source[v.variable] ?? directFuenteValue(source, v.fuente);

    if (value !== undefined && value !== null) {
      values[v.variable] = value;
      resolved.push(v.variable);
    } else if (normalizedFuente === "USUARIO") {
      // USUARIO variables are expected to come from capa3 form
      unresolved.push(v.variable);
    } else {
      // Try finding in any source (best-effort cross-source lookup)
      let found = false;
      for (const [, srcVars] of Object.entries(sourceMap)) {
        if (v.variable in srcVars) {
          values[v.variable] = srcVars[v.variable];
          resolved.push(v.variable);
          found = true;
          break;
        }
      }
      if (!found) {
        unresolved.push(v.variable);
      }
    }
  }

  return { values, resolved, unresolved, errors };
}

/**
 * Merge resolved capa2 variables with user-provided capa3 values.
 */
export function mergeVariables(
  capa2Resolved: Record<string, unknown>,
  capa3Values: Record<string, unknown>
): Record<string, unknown> {
  return { ...capa2Resolved, ...capa3Values };
}
