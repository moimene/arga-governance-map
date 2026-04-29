import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

export type GroupCampaignOrgan = "ADMIN" | "JUNTA" | "POST" | "COMPLIANCE";

export interface LaunchCampaignAgreement {
  code: string;
  label: string;
  organ: GroupCampaignOrgan;
  dependency: string | null;
  deadlineDays: number;
}

export interface LaunchCampaignStep {
  materia: string;
  label: string;
  organ: GroupCampaignOrgan;
  dependency: string | null;
  stepOrder: number;
  status: string;
  adoptionMode: string;
  rulePackCode: string;
  deadline: string;
  alertas: string[];
  explain: Record<string, unknown>;
}

export interface LaunchCampaignExpediente {
  entityId: string;
  societyName: string;
  jurisdiction: string;
  formaSocial: string;
  formaAdministracion: string;
  status: string;
  faseActual: string;
  adoptionMode: string;
  deadline: string;
  rulePackCode: string;
  responsable?: string;
  alertas: string[];
  explain: Record<string, unknown>;
  steps: LaunchCampaignStep[];
}

export interface LaunchGroupCampaignInput {
  campaignType: string;
  name: string;
  ejercicio: string;
  fechaLanzamiento: string;
  fechaCierre: string;
  plazoLimite: string | null;
  params: Record<string, unknown>;
  acuerdosCadena: LaunchCampaignAgreement[];
  expedientes: LaunchCampaignExpediente[];
}

export interface GroupCampaignSummary {
  id: string;
  name: string;
  campaign_type: string;
  ejercicio: string | null;
  fecha_lanzamiento: string;
  fecha_cierre: string | null;
  plazo_limite: string | null;
  status: string;
  created_at: string;
  expedientes_count: number;
}

export interface GroupCampaignLiveRecord {
  table: string | null;
  id: string | null;
  status: string | null;
  label: string | null;
  deadline: string | null;
  href: string | null;
  logicalRef: string | null;
}

export interface GroupCampaignWarRoomStep {
  id: string;
  campaign_id: string;
  expediente_id: string;
  entity_id: string;
  body_id: string | null;
  materia: string;
  label: string;
  organ: GroupCampaignOrgan;
  dependency: string | null;
  step_order: number;
  status: string;
  adoption_mode: string;
  rule_pack_code: string | null;
  deadline: string | null;
  live_table: string | null;
  live_record_id: string | null;
  alertas: string[];
  explain: Record<string, unknown>;
  live_record: GroupCampaignLiveRecord | null;
}

export interface GroupCampaignWarRoomExpediente {
  id: string;
  campaign_id: string;
  entity_id: string;
  society_name: string;
  jurisdiction: string | null;
  forma_social: string | null;
  forma_administracion: string | null;
  status: string;
  fase_actual: string | null;
  adoption_mode: string | null;
  responsable_label: string | null;
  deadline: string | null;
  rule_pack_code: string | null;
  alertas: string[];
  explain: Record<string, unknown>;
  steps: GroupCampaignWarRoomStep[];
  completed_steps: number;
  blocked_steps: number;
  live_links_count: number;
}

export interface GroupCampaignWarRoomCampaign extends GroupCampaignSummary {
  params: Record<string, unknown>;
  acuerdos_cadena: LaunchCampaignAgreement[];
  expedientes: GroupCampaignWarRoomExpediente[];
  steps_count: number;
  completed_steps: number;
  blocked_steps: number;
  live_links_count: number;
  first_deadline: string | null;
}

interface BodyCandidate {
  id: string;
  entity_id: string | null;
  name: string;
  body_type: string | null;
}

interface CreatedLiveRecord {
  liveTable: string | null;
  liveRecordId: string | null;
}

interface CampaignRow {
  id: string;
  name: string;
  campaign_type: string;
  ejercicio: string | null;
  fecha_lanzamiento: string;
  fecha_cierre: string | null;
  plazo_limite: string | null;
  status: string;
  params: Record<string, unknown> | null;
  acuerdos_cadena: LaunchCampaignAgreement[] | null;
  created_at: string;
}

interface CampaignExpedienteRow {
  id: string;
  campaign_id: string;
  entity_id: string;
  society_name: string;
  jurisdiction: string | null;
  forma_social: string | null;
  forma_administracion: string | null;
  status: string;
  fase_actual: string | null;
  adoption_mode: string | null;
  responsable_label: string | null;
  deadline: string | null;
  rule_pack_code: string | null;
  alertas: string[] | null;
  explain: Record<string, unknown> | null;
}

interface CampaignStepRow {
  id: string;
  campaign_id: string;
  expediente_id: string;
  entity_id: string;
  body_id: string | null;
  materia: string;
  label: string;
  organ: GroupCampaignOrgan;
  dependency: string | null;
  step_order: number;
  status: string;
  adoption_mode: string;
  rule_pack_code: string | null;
  deadline: string | null;
  live_table: string | null;
  live_record_id: string | null;
  alertas: string[] | null;
  explain: Record<string, unknown> | null;
}

interface PostTaskRow {
  id: string;
  campaign_id: string;
  expediente_id: string;
  step_id: string | null;
  title: string;
  due_date: string | null;
  status: string;
  live_table: string | null;
  live_record_id: string | null;
}

async function runWithConcurrency<Item>(
  items: Item[],
  limit: number,
  worker: (item: Item, index: number) => Promise<void>,
) {
  let cursor = 0;
  const workerCount = Math.min(limit, items.length);
  const runners = Array.from({ length: workerCount }, async () => {
    while (cursor < items.length) {
      const currentIndex = cursor;
      cursor += 1;
      await worker(items[currentIndex], currentIndex);
    }
  });
  await Promise.all(runners);
}

function normalize(value: string | null | undefined) {
  return (value ?? "").toUpperCase();
}

function pickBody(bodies: BodyCandidate[], entityId: string, organ: GroupCampaignOrgan) {
  const entityBodies = bodies.filter((body) => body.entity_id === entityId);
  if (entityBodies.length === 0) return null;

  if (organ === "JUNTA") {
    return (
      entityBodies.find((body) => normalize(body.body_type).includes("JUNTA")) ??
      entityBodies.find((body) => normalize(body.name).includes("JUNTA")) ??
      entityBodies.find((body) => normalize(body.name).includes("SOCIO")) ??
      entityBodies[0]
    );
  }

  if (organ === "ADMIN") {
    return (
      entityBodies.find((body) => normalize(body.body_type).includes("CONSEJO")) ??
      entityBodies.find((body) => normalize(body.name).includes("CONSEJO")) ??
      entityBodies.find((body) => normalize(body.name).includes("ADMIN")) ??
      entityBodies[0]
    );
  }

  return entityBodies[0];
}

function isUnipersonalMode(mode: string) {
  return mode === "UNIPERSONAL_ADMIN" || mode === "UNIPERSONAL_SOCIO";
}

function isNoSessionMode(mode: string) {
  return mode === "NO_SESSION";
}

function isUnipersonalEntity(step: LaunchCampaignStep) {
  return step.explain.unipersonal === true;
}

function requiresRegistry(step: LaunchCampaignStep) {
  return [
    "APROBACION_CUENTAS",
    "DEPOSITO_CUENTAS",
    "NOMBRAMIENTO_CARGO",
    "NOMBRAMIENTO_AUDITOR",
    "MODIFICACION_ESTATUTOS",
    "APROBACION_FUSION",
    "APERTURA_CIERRE_SUCURSAL",
  ].includes(step.materia);
}

function agreementMatterClass(materia: string) {
  if (
    [
      "MODIFICACION_ESTATUTOS",
      "AUMENTO_CAPITAL",
      "REDUCCION_CAPITAL",
      "CAMBIO_DOMICILIO",
      "APERTURA_CIERRE_SUCURSAL",
    ].includes(materia)
  ) {
    return "ESTATUTARIA";
  }

  if (
    [
      "PROYECTO_FUSION",
      "APROBACION_FUSION",
      "OPOSICION_INSCRIPCION",
      "AUTORIZACION_GARANTIA",
      "OPERACION_VINCULADA",
    ].includes(materia)
  ) {
    return "ESTRUCTURAL";
  }

  return "ORDINARIA";
}

function agreementAdoptionMode(mode: string) {
  if (mode === "CO_APROBACION" || mode === "SOLIDARIO") return "NO_SESSION";
  return mode;
}

function agreementExecutionMode(mode: string) {
  if (mode === "CO_APROBACION") return { tipo: "CO_APROBACION", source: "group_campaign" };
  if (mode === "SOLIDARIO") return { tipo: "SOLIDARIO", source: "group_campaign" };
  return null;
}

function noSessionTipoProceso(expediente: LaunchCampaignExpediente) {
  if (expediente.formaSocial === "SL" || expediente.formaSocial === "SLU") return "UNANIMIDAD_ESCRITA_SL";
  return "CIRCULACION_CONSEJO";
}

function noSessionCondicion(expediente: LaunchCampaignExpediente) {
  if (expediente.formaSocial === "SL" || expediente.formaSocial === "SLU") return "UNANIMIDAD_CAPITAL";
  return "MAYORIA_CONSEJEROS_ESCRITA";
}

async function createAgreement(
  tenantId: string,
  campaignId: string,
  expediente: LaunchCampaignExpediente,
  step: LaunchCampaignStep,
  bodyId: string | null,
  extra?: { unipersonalDecisionId?: string | null },
) {
  const { data, error } = await supabase
    .from("agreements")
    .insert({
      tenant_id: tenantId,
      entity_id: expediente.entityId,
      body_id: bodyId,
      agreement_kind: step.materia,
      matter_class: agreementMatterClass(step.materia),
      adoption_mode: agreementAdoptionMode(step.adoptionMode),
      execution_mode: agreementExecutionMode(step.adoptionMode),
      inscribable: requiresRegistry(step),
      status: "DRAFT",
      proposal_text: `${step.label} · ${expediente.societyName}`,
      decision_date: null,
      rule_pack_version: "campaign-v1",
      compliance_snapshot: {
        source: "group_campaign",
        campaign_id: campaignId,
        rule_pack_code: step.rulePackCode,
        explain: step.explain,
      },
      compliance_explain: {
        alertas: step.alertas,
        campaign_step: step.materia,
      },
      unipersonal_decision_id: extra?.unipersonalDecisionId ?? null,
    })
    .select("id")
    .single();

  if (error) throw error;
  return (data as { id: string }).id;
}

async function createLiveRecord(
  tenantId: string,
  campaignId: string,
  campaignName: string,
  expedienteId: string,
  stepId: string,
  expediente: LaunchCampaignExpediente,
  step: LaunchCampaignStep,
  bodyId: string | null,
): Promise<CreatedLiveRecord> {
  if (step.materia === "CONVOCATORIA_JGA") {
    const isUnipersonal = isUnipersonalMode(step.adoptionMode) || isUnipersonalEntity(step);
    if (isUnipersonal) {
      const { data, error } = await supabase
        .from("group_campaign_post_tasks")
        .insert({
          tenant_id: tenantId,
          campaign_id: campaignId,
          expediente_id: expedienteId,
          step_id: stepId,
          entity_id: expediente.entityId,
          title: `Sin convocatoria formal · ${expediente.societyName}`,
          description: "Sociedad unipersonal: el sistema enruta la aprobación a decisión de socio único.",
          due_date: step.deadline,
          status: "COMPLETADA",
          live_table: "group_campaign_post_tasks",
        })
        .select("id")
        .single();

      if (error) throw error;
      return { liveTable: "group_campaign_post_tasks", liveRecordId: (data as { id: string }).id };
    }

    const { data, error } = await supabase
      .from("convocatorias")
      .insert({
        tenant_id: tenantId,
        body_id: bodyId,
        estado: "BORRADOR",
        fecha_emision: new Date().toISOString(),
        fecha_1: step.deadline,
        modalidad: "TELEMATICA",
        junta_universal: false,
        urgente: false,
        publication_channels: expediente.formaSocial === "SA" || expediente.formaSocial === "SAU"
          ? ["WEB_CORPORATIVA", "BORME"]
          : ["ERDS"],
        statutory_basis: `${campaignName} · ${step.label}`,
      })
      .select("id")
      .single();

    if (error) throw error;
    return { liveTable: "convocatorias", liveRecordId: (data as { id: string }).id };
  }

  if (step.organ === "POST" || step.organ === "COMPLIANCE" || step.adoptionMode === "POST_TASK") {
    const { data, error } = await supabase
      .from("group_campaign_post_tasks")
      .insert({
        tenant_id: tenantId,
        campaign_id: campaignId,
        expediente_id: expedienteId,
        step_id: stepId,
        entity_id: expediente.entityId,
        title: `${step.label} · ${expediente.societyName}`,
        description: `${campaignName}. Responsable: ${expediente.responsable ?? "Secretaría de la sociedad"}`,
        due_date: step.deadline,
        status: "PENDIENTE",
        live_table: "group_campaign_post_tasks",
      })
      .select("id")
      .single();

    if (error) throw error;
    return { liveTable: "group_campaign_post_tasks", liveRecordId: (data as { id: string }).id };
  }

  if (isUnipersonalMode(step.adoptionMode)) {
    const { data: decision, error: decisionError } = await supabase
      .from("unipersonal_decisions")
      .insert({
        tenant_id: tenantId,
        entity_id: expediente.entityId,
        decision_type: step.materia,
        title: `${step.label} · ${expediente.societyName}`,
        content: `${campaignName}. Expediente generado automáticamente por campaña de grupo.`,
        status: "BORRADOR",
        requires_registry: requiresRegistry(step),
      })
      .select("id")
      .single();

    if (decisionError) throw decisionError;
    const decisionId = (decision as { id: string }).id;
    const agreementId = await createAgreement(tenantId, campaignId, expediente, step, bodyId, {
      unipersonalDecisionId: decisionId,
    });
    return { liveTable: "agreements", liveRecordId: agreementId };
  }

  if (isNoSessionMode(step.adoptionMode)) {
    const agreementId = await createAgreement(tenantId, campaignId, expediente, step, bodyId);
    if (!bodyId) {
      return { liveTable: "agreements", liveRecordId: agreementId };
    }

    const { data, error } = await supabase
      .from("no_session_expedientes")
      .insert({
        tenant_id: tenantId,
        agreement_id: agreementId,
        entity_id: expediente.entityId,
        body_id: bodyId,
        tipo_proceso: noSessionTipoProceso(expediente),
        propuesta_texto: `${step.label} · ${expediente.societyName}`,
        propuesta_fecha: new Date().toISOString().slice(0, 10),
        ventana_inicio: new Date().toISOString(),
        ventana_fin: `${step.deadline}T23:59:59.000Z`,
        ventana_dias_habiles: 5,
        ventana_fuente: "ESTATUTOS",
        estado: "BORRADOR",
        condicion_adopcion: noSessionCondicion(expediente),
        rule_pack_id: step.rulePackCode,
        rule_pack_version: "campaign-v1",
      })
      .select("id")
      .single();

    if (error) throw error;
    return { liveTable: "no_session_expedientes", liveRecordId: (data as { id: string }).id };
  }

  const agreementId = await createAgreement(tenantId, campaignId, expediente, step, bodyId);
  return { liveTable: "agreements", liveRecordId: agreementId };
}

function uniqueValues(values: (string | null | undefined)[]) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function liveKey(table: string | null | undefined, id: string | null | undefined) {
  if (!table || !id) return null;
  return `${table}:${id}`;
}

function liveRecordHref(table: string | null, id: string | null) {
  if (!table || !id) return null;
  if (table === "agreements") return `/secretaria/acuerdos/${id}`;
  if (table === "convocatorias") return `/secretaria/convocatorias/${id}`;
  if (table === "no_session_expedientes") return `/secretaria/acuerdos-sin-sesion/${id}`;
  if (table === "unipersonal_decisions") return `/secretaria/decisiones-unipersonales/${id}`;
  return null;
}

function makeLiveRecord(
  table: string,
  id: string,
  status: string | null,
  label: string | null,
  deadline: string | null,
): GroupCampaignLiveRecord {
  return {
    table,
    id,
    status,
    label,
    deadline,
    href: liveRecordHref(table, id),
    logicalRef: `${table}:${id.slice(0, 8)}`,
  };
}

async function fetchLiveRecords(tenantId: string, steps: CampaignStepRow[], postTasks: PostTaskRow[]) {
  const liveRecords = new Map<string, GroupCampaignLiveRecord>();

  for (const task of postTasks) {
    liveRecords.set(
      `group_campaign_post_tasks:${task.id}`,
      makeLiveRecord("group_campaign_post_tasks", task.id, task.status, task.title, task.due_date),
    );
  }

  const idsByTable = steps.reduce<Record<string, string[]>>((acc, step) => {
    if (!step.live_table || !step.live_record_id || step.live_table === "group_campaign_post_tasks") return acc;
    acc[step.live_table] = uniqueValues([...(acc[step.live_table] ?? []), step.live_record_id]);
    return acc;
  }, {});

  const agreementIds = idsByTable.agreements ?? [];
  if (agreementIds.length > 0) {
    const { data, error } = await supabase
      .from("agreements")
      .select("id, status, decision_date, proposal_text")
      .eq("tenant_id", tenantId)
      .in("id", agreementIds);

    if (error) throw error;
    for (const row of (data ?? []) as { id: string; status: string | null; decision_date: string | null; proposal_text: string | null }[]) {
      liveRecords.set(`agreements:${row.id}`, makeLiveRecord("agreements", row.id, row.status, row.proposal_text, row.decision_date));
    }
  }

  const convocatoriaIds = idsByTable.convocatorias ?? [];
  if (convocatoriaIds.length > 0) {
    const { data, error } = await supabase
      .from("convocatorias")
      .select("id, estado, fecha_1, statutory_basis")
      .eq("tenant_id", tenantId)
      .in("id", convocatoriaIds);

    if (error) throw error;
    for (const row of (data ?? []) as { id: string; estado: string | null; fecha_1: string | null; statutory_basis: string | null }[]) {
      liveRecords.set(`convocatorias:${row.id}`, makeLiveRecord("convocatorias", row.id, row.estado, row.statutory_basis, row.fecha_1));
    }
  }

  const noSessionIds = idsByTable.no_session_expedientes ?? [];
  if (noSessionIds.length > 0) {
    const { data, error } = await supabase
      .from("no_session_expedientes")
      .select("id, estado, ventana_fin, propuesta_texto")
      .eq("tenant_id", tenantId)
      .in("id", noSessionIds);

    if (error) throw error;
    for (const row of (data ?? []) as { id: string; estado: string | null; ventana_fin: string | null; propuesta_texto: string | null }[]) {
      liveRecords.set(
        `no_session_expedientes:${row.id}`,
        makeLiveRecord("no_session_expedientes", row.id, row.estado, row.propuesta_texto, row.ventana_fin),
      );
    }
  }

  const unipersonalIds = idsByTable.unipersonal_decisions ?? [];
  if (unipersonalIds.length > 0) {
    const { data, error } = await supabase
      .from("unipersonal_decisions")
      .select("id, status, decision_date, title")
      .eq("tenant_id", tenantId)
      .in("id", unipersonalIds);

    if (error) throw error;
    for (const row of (data ?? []) as { id: string; status: string | null; decision_date: string | null; title: string | null }[]) {
      liveRecords.set(
        `unipersonal_decisions:${row.id}`,
        makeLiveRecord("unipersonal_decisions", row.id, row.status, row.title, row.decision_date),
      );
    }
  }

  return liveRecords;
}

function countStatuses(items: { status: string }[], status: string) {
  return items.filter((item) => item.status === status).length;
}

export function useGroupCampaignWarRoom() {
  const { tenantId } = useTenantContext();

  return useQuery({
    queryKey: ["group_campaigns", tenantId, "war-room"],
    enabled: !!tenantId,
    queryFn: async (): Promise<GroupCampaignWarRoomCampaign[]> => {
      const { data: campaignRows, error: campaignsError } = await supabase
        .from("group_campaigns")
        .select(
          "id, name, campaign_type, ejercicio, fecha_lanzamiento, fecha_cierre, plazo_limite, status, params, acuerdos_cadena, created_at",
        )
        .eq("tenant_id", tenantId!)
        .in("status", ["LANZADA", "EN_CURSO", "COMPLETADA", "BLOQUEADA"])
        .order("created_at", { ascending: false })
        .limit(20);

      if (campaignsError) throw campaignsError;

      const campaigns = (campaignRows ?? []) as CampaignRow[];
      const campaignIds = campaigns.map((campaign) => campaign.id);
      if (campaignIds.length === 0) return [];

      const { data: expedienteRows, error: expedientesError } = await supabase
        .from("group_campaign_expedientes")
        .select(
          "id, campaign_id, entity_id, society_name, jurisdiction, forma_social, forma_administracion, status, fase_actual, adoption_mode, responsable_label, deadline, rule_pack_code, alertas, explain",
        )
        .eq("tenant_id", tenantId!)
        .in("campaign_id", campaignIds)
        .order("deadline", { ascending: true });

      if (expedientesError) throw expedientesError;

      const { data: stepRows, error: stepsError } = await supabase
        .from("group_campaign_steps")
        .select(
          "id, campaign_id, expediente_id, entity_id, body_id, materia, label, organ, dependency, step_order, status, adoption_mode, rule_pack_code, deadline, live_table, live_record_id, alertas, explain",
        )
        .eq("tenant_id", tenantId!)
        .in("campaign_id", campaignIds)
        .order("step_order", { ascending: true });

      if (stepsError) throw stepsError;

      const { data: postTaskRows, error: postTasksError } = await supabase
        .from("group_campaign_post_tasks")
        .select("id, campaign_id, expediente_id, step_id, title, due_date, status, live_table, live_record_id")
        .eq("tenant_id", tenantId!)
        .in("campaign_id", campaignIds);

      if (postTasksError) throw postTasksError;

      const expedientes = (expedienteRows ?? []) as CampaignExpedienteRow[];
      const steps = (stepRows ?? []) as CampaignStepRow[];
      const postTasks = (postTaskRows ?? []) as PostTaskRow[];
      const liveRecords = await fetchLiveRecords(tenantId!, steps, postTasks);

      const stepsByExpediente = steps.reduce<Record<string, GroupCampaignWarRoomStep[]>>((acc, step) => {
        const key = liveKey(step.live_table, step.live_record_id);
        const liveRecord = key ? liveRecords.get(key) ?? null : null;
        const mapped: GroupCampaignWarRoomStep = {
          ...step,
          alertas: step.alertas ?? [],
          explain: step.explain ?? {},
          live_record: liveRecord,
        };
        acc[step.expediente_id] = [...(acc[step.expediente_id] ?? []), mapped];
        return acc;
      }, {});

      const expedientesByCampaign = expedientes.reduce<Record<string, GroupCampaignWarRoomExpediente[]>>((acc, expediente) => {
        const expedienteSteps = (stepsByExpediente[expediente.id] ?? []).sort((a, b) => a.step_order - b.step_order);
        const liveLinksCount = expedienteSteps.filter((step) => Boolean(step.live_record?.id)).length;
        const mapped: GroupCampaignWarRoomExpediente = {
          ...expediente,
          alertas: expediente.alertas ?? [],
          explain: expediente.explain ?? {},
          steps: expedienteSteps,
          completed_steps: countStatuses(expedienteSteps, "COMPLETADO"),
          blocked_steps: countStatuses(expedienteSteps, "BLOQUEADO"),
          live_links_count: liveLinksCount,
        };
        acc[expediente.campaign_id] = [...(acc[expediente.campaign_id] ?? []), mapped];
        return acc;
      }, {});

      return campaigns.map((campaign) => {
        const campaignExpedientes = expedientesByCampaign[campaign.id] ?? [];
        const campaignSteps = campaignExpedientes.flatMap((expediente) => expediente.steps);
        const deadlines = [
          ...campaignExpedientes.map((expediente) => expediente.deadline),
          ...campaignSteps.map((step) => step.deadline),
        ]
          .filter((deadline): deadline is string => Boolean(deadline))
          .sort((a, b) => a.localeCompare(b));

        return {
          ...campaign,
          params: campaign.params ?? {},
          acuerdos_cadena: campaign.acuerdos_cadena ?? [],
          expedientes_count: campaignExpedientes.length,
          expedientes: campaignExpedientes,
          steps_count: campaignSteps.length,
          completed_steps: countStatuses(campaignSteps, "COMPLETADO"),
          blocked_steps: countStatuses(campaignSteps, "BLOQUEADO"),
          live_links_count: campaignSteps.filter((step) => Boolean(step.live_record?.id)).length,
          first_deadline: deadlines[0] ?? null,
        };
      });
    },
    retry: false,
    staleTime: 20_000,
  });
}

export function useLatestGroupCampaign() {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["group_campaigns", tenantId, "latest"],
    enabled: !!tenantId,
    queryFn: async (): Promise<GroupCampaignSummary | null> => {
      const { data, error } = await supabase
        .from("group_campaigns")
        .select("id, name, campaign_type, ejercicio, fecha_lanzamiento, fecha_cierre, plazo_limite, status, created_at")
        .eq("tenant_id", tenantId!)
        .in("status", ["LANZADA", "COMPLETADA"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      const campaign = data as Omit<GroupCampaignSummary, "expedientes_count">;
      const { count, error: countError } = await supabase
        .from("group_campaign_expedientes")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId!)
        .eq("campaign_id", campaign.id);

      if (countError) throw countError;
      return { ...campaign, expedientes_count: count ?? 0 };
    },
    retry: false,
    staleTime: 30_000,
  });
}

export function useLaunchGroupCampaign() {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: LaunchGroupCampaignInput): Promise<{ id: string }> => {
      if (!tenantId) throw new Error("Tenant no disponible");
      let campaignId: string | null = null;

      try {
        const entityIds = input.expedientes.map((expediente) => expediente.entityId);
        const { data: bodyRows, error: bodiesError } = await supabase
          .from("governing_bodies")
          .select("id, entity_id, name, body_type")
          .eq("tenant_id", tenantId)
          .in("entity_id", entityIds);

        if (bodiesError) throw bodiesError;
        const bodies = (bodyRows ?? []) as BodyCandidate[];

        const { data: campaign, error: campaignError } = await supabase
          .from("group_campaigns")
          .insert({
            tenant_id: tenantId,
            campaign_type: input.campaignType,
            name: input.name,
            ejercicio: input.ejercicio,
            fecha_lanzamiento: input.fechaLanzamiento,
            fecha_cierre: input.fechaCierre,
            plazo_limite: input.plazoLimite,
            status: "EN_CURSO",
            params: input.params,
            acuerdos_cadena: input.acuerdosCadena,
          })
          .select("id")
          .single();

        if (campaignError) throw campaignError;
        campaignId = (campaign as { id: string }).id;
        const activeCampaignId = campaignId;

        await runWithConcurrency(input.expedientes, 4, async (expediente) => {
          const { data: expedienteRow, error: expedienteError } = await supabase
            .from("group_campaign_expedientes")
            .insert({
              tenant_id: tenantId,
              campaign_id: activeCampaignId,
              entity_id: expediente.entityId,
              society_name: expediente.societyName,
              jurisdiction: expediente.jurisdiction,
              forma_social: expediente.formaSocial,
              forma_administracion: expediente.formaAdministracion,
              status: expediente.status,
              fase_actual: expediente.faseActual,
              adoption_mode: expediente.adoptionMode,
              responsable_label: "Secretaría de la sociedad",
              deadline: expediente.deadline,
              rule_pack_code: expediente.rulePackCode,
              alertas: expediente.alertas,
              explain: expediente.explain,
            })
            .select("id")
            .single();

          if (expedienteError) throw expedienteError;
          const expedienteId = (expedienteRow as { id: string }).id;

          await runWithConcurrency(expediente.steps, 4, async (step) => {
            const body = pickBody(bodies, expediente.entityId, step.organ);
            const bodyId = body?.id ?? null;
            const { data: stepRow, error: stepError } = await supabase
              .from("group_campaign_steps")
              .insert({
                tenant_id: tenantId,
                campaign_id: activeCampaignId,
                expediente_id: expedienteId,
                entity_id: expediente.entityId,
                body_id: bodyId,
                materia: step.materia,
                label: step.label,
                organ: step.organ,
                dependency: step.dependency,
                step_order: step.stepOrder,
                status: step.status,
                adoption_mode: step.adoptionMode,
                rule_pack_code: step.rulePackCode,
                deadline: step.deadline,
                alertas: step.alertas,
                explain: step.explain,
              })
              .select("id")
              .single();

            if (stepError) throw stepError;
            const stepId = (stepRow as { id: string }).id;
            const live = await createLiveRecord(
              tenantId,
              activeCampaignId,
              input.name,
              expedienteId,
              stepId,
              expediente,
              step,
              bodyId,
            );

            if (live.liveTable && live.liveRecordId) {
              const { error: updateStepError } = await supabase
                .from("group_campaign_steps")
                .update({
                  live_table: live.liveTable,
                  live_record_id: live.liveRecordId,
                })
                .eq("tenant_id", tenantId)
                .eq("id", stepId);

              if (updateStepError) throw updateStepError;
            }
          });
        });

        const { error: completeError } = await supabase
          .from("group_campaigns")
          .update({ status: "LANZADA" })
          .eq("tenant_id", tenantId)
          .eq("id", activeCampaignId);

        if (completeError) throw completeError;

        return { id: activeCampaignId };
      } catch (error) {
        if (campaignId) {
          const message = error instanceof Error ? error.message : String(error);
          await supabase
            .from("group_campaigns")
            .update({
              status: "BLOQUEADA",
              params: {
                ...input.params,
                launch_error: message,
              },
            })
            .eq("tenant_id", tenantId)
            .eq("id", campaignId);
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group_campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["agreements"] });
      queryClient.invalidateQueries({ queryKey: ["convocatorias"] });
      queryClient.invalidateQueries({ queryKey: ["no_session_expedientes"] });
      queryClient.invalidateQueries({ queryKey: ["unipersonal_decisions"] });
    },
  });
}
