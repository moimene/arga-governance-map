/**
 * Variable Resolver — Maps capa2 variable sources to real Supabase data
 *
 * Each capa2 variable has a `fuente` (source) indicating where to fetch
 * the real value from. This service resolves all variables for a given
 * agreement context.
 *
 * Sources:
 * - ENTIDAD  → entities table (denominacion_social, cif, domicilio, etc.)
 * - ORGANO   → governing_bodies + body_mandates (presidente, secretario, members)
 * - REUNION  → meetings + agenda + participants
 * - EXPEDIENTE → agreements table (the agreement itself)
 * - MOTOR    → compliance snapshot from Motor de Reglas LSC
 * - SISTEMA  → runtime values (fecha, hora, usuario, etc.)
 * - USUARIO  → values from capa3 form (resolved separately)
 */

import { supabase } from "@/integrations/supabase/client";

const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";

// ── Types ────────────────────────────────────────────────────────────────────

export interface Capa2Variable {
  variable: string;
  fuente: string;   // ENTIDAD | ORGANO | REUNION | EXPEDIENTE | MOTOR | SISTEMA | USUARIO
  condicion: string;
}

export interface ResolverContext {
  agreementId: string;
  entityId?: string;
  bodyId?: string;
  meetingId?: string;
  complianceSnapshot?: Record<string, unknown>;
}

export interface ResolvedVariables {
  values: Record<string, unknown>;
  resolved: string[];
  unresolved: string[];
  errors: string[];
}

// ── Entity resolver ──────────────────────────────────────────────────────────

async function resolveEntityVars(entityId: string): Promise<Record<string, unknown>> {
  const { data, error } = await supabase
    .from("entities")
    .select("*")
    .eq("id", entityId)
    .eq("tenant_id", DEMO_TENANT)
    .maybeSingle();

  if (error || !data) return {};

  return {
    denominacion_social: data.name,
    cif: data.tax_id || data.registration_number,
    domicilio_social: data.address,
    registro_mercantil: data.registry_location,
    tomo: data.registry_volume,
    folio: data.registry_folio,
    hoja: data.registry_sheet,
    inscripcion: data.registry_inscription,
    lugar: data.city || data.address,
    tipo_social: data.entity_type_detail, // SA, SL
    articulo_estatutos_comision: data.bylaws_commission_article || "—",
  };
}

// ── Body (organ) resolver ────────────────────────────────────────────────────

async function resolveBodyVars(bodyId: string): Promise<Record<string, unknown>> {
  const { data: body, error } = await supabase
    .from("governing_bodies")
    .select("*, body_mandates(*, persons(*))")
    .eq("id", bodyId)
    .eq("tenant_id", DEMO_TENANT)
    .maybeSingle();

  if (error || !body) return {};

  const mandates = (body as any).body_mandates ?? [];

  // Find presidente and secretario by role
  const presidenteMandate = mandates.find((m: any) =>
    m.role?.toLowerCase().includes("presidente") || m.role?.toLowerCase().includes("president")
  );
  const secretarioMandate = mandates.find((m: any) =>
    m.role?.toLowerCase().includes("secretario") || m.role?.toLowerCase().includes("secretary")
  );

  const miembros = mandates.map((m: any) => ({
    nombre: m.persons?.name || m.person_name || "—",
    cargo: m.role || "Vocal",
  }));

  return {
    nombre_comision: body.name,
    organo_nombre: body.name,
    presidente: presidenteMandate?.persons?.name || presidenteMandate?.person_name || "—",
    secretario: secretarioMandate?.persons?.name || secretarioMandate?.person_name || "—",
    cargo_convocante: presidenteMandate?.role || "Presidente",
    convocante_nombre: presidenteMandate?.persons?.name || "—",
    miembros_totales: mandates.length,
    miembros: miembros,
    fecha_constitucion_comision: body.established_date || "—",
    base_cargo_mesa: body.legal_basis || "los Estatutos Sociales",
  };
}

// ── Meeting resolver ─────────────────────────────────────────────────────────

async function resolveMeetingVars(meetingId: string): Promise<Record<string, unknown>> {
  const { data: meeting, error } = await supabase
    .from("meetings")
    .select("*, meeting_participants(*), meeting_agenda(*)")
    .eq("id", meetingId)
    .eq("tenant_id", DEMO_TENANT)
    .maybeSingle();

  if (error || !meeting) return {};

  const participants = (meeting as any).meeting_participants ?? [];
  const agenda = ((meeting as any).meeting_agenda ?? [])
    .sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0));

  const presentes = participants.filter((p: any) => p.attendance_status === "PRESENT" || p.attended);
  const ausentes = participants.filter((p: any) => p.attendance_status === "ABSENT" || !p.attended);

  const meetingDate = meeting.date || meeting.scheduled_date;

  return {
    fecha: meetingDate,
    hora_inicio: meeting.start_time || "—",
    hora_fin: meeting.end_time || "—",
    lugar: meeting.location || "—",
    lugar_junta: meeting.location || "—",
    fecha_junta: meetingDate,
    hora_junta: meeting.start_time || "—",
    miembros_presentes: presentes.map((p: any) => ({
      nombre: p.person_name || p.name || "—",
      cargo: p.role || "Miembro",
    })),
    miembros_ausentes: ausentes.map((p: any) => ({
      nombre: p.person_name || p.name || "—",
      cargo: p.role || "Miembro",
      justificacion: p.absence_reason || null,
    })),
    miembros_presentes_count: presentes.length,
    orden_dia: agenda.map((a: any, i: number) => ({
      ordinal: `${i + 1}`,
      descripcion_punto: a.title || a.description || "—",
    })),
    // Convocatoria specific
    fecha_convocatoria: meeting.convocation_date || "—",
    medio_publicacion: meeting.publication_medium || "—",
    fecha_publicacion_convocatoria: meeting.publication_date || "—",
    dias_antelacion: meeting.notice_days || "—",
    segunda_convocatoria: !!meeting.second_call_date,
    fecha_segunda_convocatoria: meeting.second_call_date || null,
    hora_segunda_convocatoria: meeting.second_call_time || null,
  };
}

// ── Agreement (expediente) resolver ──────────────────────────────────────────

async function resolveAgreementVars(agreementId: string): Promise<Record<string, unknown>> {
  const { data, error } = await supabase
    .from("agreements")
    .select("*")
    .eq("id", agreementId)
    .eq("tenant_id", DEMO_TENANT)
    .maybeSingle();

  if (error || !data) return {};

  return {
    tipo_junta: data.agreement_kind,
    tipo_junta_texto: data.agreement_kind === "ORDINARIA" ? "Ordinaria" : "Extraordinaria",
    materia: data.matter_class,
    modo_adopcion: data.adoption_mode,
    proposal_text: data.proposal_text,
    decision_text: data.decision_text,
    decision_date: data.decision_date,
    statutory_basis: data.statutory_basis,
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
    quorum_requerido: snapshot.quorumRequerido || "—",
    quorum_fuente: "LSC",
    quorum_referencia_legal: snapshot.quorumReferencia || "art. 193 LSC",
    convocatoria_ordinal: snapshot.primeraConvocatoria !== false ? "primera" : "segunda",
    quorum_primera_convocatoria: snapshot.primeraConvocatoria !== false,
    quorum_rama: snapshot.quorumRama || null,
    convocatoria_ordinal_detalle: snapshot.convocatoriaDetalle || null,
    puntos_votacion: snapshot.votaciones || [],
    materias_indelegables_warning: snapshot.materiasIndelegablesWarning || false,
    requiere_ratificacion: snapshot.requiereRatificacion || false,
    acuerdos_ratificacion: snapshot.acuerdosRatificacion || [],
    derecho_representacion: true,
  };
}

// ── System resolver ──────────────────────────────────────────────────────────

function resolveSystemVars(): Record<string, unknown> {
  const now = new Date();
  return {
    fecha_emision: now.toISOString().split("T")[0],
    fecha_generacion: now.toISOString(),
    tsq_token: `TSQ-${Date.now().toString(36).toUpperCase()}`,
    firma_qes_ref: null, // Filled after QES signing
    ocsp_status: null,
    firma_qes_timestamp: null,
    canal_notificacion: "comunicación electrónica con acuse de recibo",
    acuse_electronico: true,
    usuario_generador: "Secretario",
  };
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

  // Determine which sources we need
  const sources = new Set(capa2.map((v) => v.fuente));

  // Fetch all sources in parallel
  const [entityVars, bodyVars, meetingVars, agreementVars] = await Promise.all([
    sources.has("ENTIDAD") && context.entityId
      ? resolveEntityVars(context.entityId)
      : Promise.resolve({}),
    sources.has("ORGANO") && context.bodyId
      ? resolveBodyVars(context.bodyId)
      : Promise.resolve({}),
    sources.has("REUNION") && context.meetingId
      ? resolveMeetingVars(context.meetingId)
      : Promise.resolve({}),
    sources.has("EXPEDIENTE") && context.agreementId
      ? resolveAgreementVars(context.agreementId)
      : Promise.resolve({}),
  ]);

  const motorVars = resolveMotorVars(context.complianceSnapshot);
  const systemVars = resolveSystemVars();

  // Source map
  const sourceMap: Record<string, Record<string, unknown>> = {
    ENTIDAD: entityVars,
    ORGANO: bodyVars,
    REUNION: meetingVars,
    EXPEDIENTE: agreementVars,
    MOTOR: motorVars,
    SISTEMA: systemVars,
    USUARIO: {}, // Filled from capa3 form — not auto-resolved
  };

  // Resolve each variable
  for (const v of capa2) {
    const source = sourceMap[v.fuente] || {};
    const value = source[v.variable];

    if (value !== undefined && value !== null) {
      values[v.variable] = value;
      resolved.push(v.variable);
    } else if (v.fuente === "USUARIO") {
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
