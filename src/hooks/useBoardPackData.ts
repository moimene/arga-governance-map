import { useQueries } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface BoardPackMeeting {
  id: string;
  slug: string | null;
  scheduled_start: string | null;
  meeting_type: string;
  status: string;
  location: string | null;
  body: {
    id: string;
    name: string;
    body_type: string;
    entity_id: string;
    entity_name: string;
    quorum_rule: Record<string, unknown> | null;
  } | null;
  president: { full_name: string } | null;
  secretary: { full_name: string } | null;
  agenda_items: Array<{
    order_number: number;
    title: string;
    description: string | null;
  }>;
}

export interface BoardPackAgreement {
  id: string;
  agreement_kind: string;
  status: string;
  decision_date: string | null;
  policy_id: string | null;
  policy_title: string | null;
}

export interface BoardPackRisk {
  code: string;
  title: string;
  inherent_score: number;
  residual_score: number | null;
  status: string;
}

export interface BoardPackObligation {
  id: string;
  code: string;
  title: string;
  criticality: string;
  incidents_count: number;
  controls_count: number;
}

export interface BoardPackFinding {
  id: string;
  code: string;
  title: string;
  severity: string;
  status: string;
  origin: string | null;
  due_date: string | null;
  action_plans: Array<{
    title: string;
    status: string;
    progress_pct: number;
    due_date: string;
  }>;
}

export interface BoardPackAttestation {
  person_name: string;
  campaign: string;
  status: string;
  completed_at: string | null;
}

export interface BoardPackDelegation {
  code: string;
  delegation_type: string;
  delegate_name: string;
  scope: string;
  limits: string | null;
  end_date: string;
  status: string;
  days_to_expiry: number;
}

export interface BoardPackAISystem {
  id: string;
  name: string;
  risk_level: string;
  vendor: string;
  status: string;
  checks: Array<{
    requirement_code: string;
    requirement_title: string;
    status: string;
  }>;
  non_conformities: number;
}

export interface BoardPackData {
  meeting: BoardPackMeeting | null;
  agreements: BoardPackAgreement[];
  risks: BoardPackRisk[];
  obligations: BoardPackObligation[];
  findings: BoardPackFinding[];
  attestations: {
    campaign: string;
    completed: number;
    total: number;
    pending: BoardPackAttestation[];
  };
  delegations: BoardPackDelegation[];
  aiSystems: BoardPackAISystem[];
  generatedAt: string;
  cotizadaWarnings: string[];
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useBoardPackData(meetingId: string, entityId?: string | null): {
  data: BoardPackData | null;
  isLoading: boolean;
  error: Error | null;
} {
  const { tenantId } = useTenantContext();
  const results = useQueries({
    queries: [
      // Q1: Meeting + body + president + secretary
      {
        queryKey: ["board-pack", "meeting", tenantId, meetingId],
        enabled: !!meetingId && !!tenantId,
        queryFn: async () => {
          const { data, error } = await supabase
            .from("meetings")
            .select(`
              id, slug, scheduled_start, meeting_type, status, location,
              governing_bodies ( id, name, body_type, entity_id, quorum_rule, entities ( common_name, es_cotizada ) ),
              president:president_id ( full_name ),
              secretary:secretary_id ( full_name )
            `)
            .eq("id", meetingId)
            .eq("tenant_id", tenantId!)
            .maybeSingle();
          if (error) throw error;
          return data;
        },
      },
      // Q2: Agenda items
      {
        queryKey: ["board-pack", "agenda", meetingId],
        enabled: !!meetingId,
        queryFn: async () => {
          const { data, error } = await supabase
            .from("agenda_items")
            .select("order_number, title, description")
            .eq("meeting_id", meetingId)
            .order("order_number");
          if (error) throw error;
          return data ?? [];
        },
      },
      // Q3: Acuerdos vinculados a esta reunión
      {
        queryKey: ["board-pack", "agreements", tenantId, meetingId],
        enabled: !!meetingId && !!tenantId,
        queryFn: async () => {
          const { data, error } = await supabase
            .from("agreements")
            .select("id, agreement_kind, status, decision_date, policy_id, policies:policy_id ( title )")
            .eq("parent_meeting_id", meetingId)
            .eq("tenant_id", tenantId!);
          if (error) throw error;
          type Raw = {
            id: string;
            agreement_kind: string;
            status: string;
            decision_date: string | null;
            policy_id: string | null;
            policies: { title: string }[] | null;
          };
          return ((data ?? []) as Raw[]).map((a) => ({
            id: a.id,
            agreement_kind: a.agreement_kind,
            status: a.status,
            decision_date: a.decision_date,
            policy_id: a.policy_id,
            policy_title: a.policies?.[0]?.title ?? null,
          }));
        },
      },
      // Q4: Top 5 riesgos por inherent_score DESC
      {
        queryKey: ["board-pack", "risks", tenantId, entityId ?? "all"],
        enabled: !!tenantId,
        queryFn: async () => {
          let query = supabase
            .from("risks")
            .select("code, title, inherent_score, residual_score, status")
            .eq("tenant_id", tenantId!);
          if (entityId) query = query.eq("entity_id", entityId);
          const { data, error } = await query.order("inherent_score", { ascending: false }).limit(5);
          if (error) throw error;
          return (data ?? []) as BoardPackRisk[];
        },
      },
      // Q5: Obligaciones + conteo incidentes y controles
      {
        queryKey: ["board-pack", "obligations", tenantId],
        enabled: !!tenantId,
        queryFn: async () => {
          const [oblRes, incRes, ctrlRes] = await Promise.all([
            supabase
              .from("obligations")
              .select("id, code, title, criticality")
              .eq("tenant_id", tenantId!)
              .order("code"),
            supabase
              .from("incidents")
              .select("obligation_id")
              .eq("tenant_id", tenantId!),
            supabase
              .from("controls")
              .select("obligation_id")
              .eq("tenant_id", tenantId!),
          ]);
          if (oblRes.error) throw oblRes.error;
          const incs = incRes.data ?? [];
          const ctrls = ctrlRes.data ?? [];
          return (oblRes.data ?? []).map((obl) => ({
            id: obl.id,
            code: obl.code,
            title: obl.title,
            criticality: obl.criticality,
            incidents_count: incs.filter((i) => i.obligation_id === obl.id).length,
            controls_count: ctrls.filter((c) => c.obligation_id === obl.id).length,
          }));
        },
      },
      // Q6: Hallazgos abiertos + planes de acción
      {
        queryKey: ["board-pack", "findings", tenantId, entityId ?? "all"],
        enabled: !!tenantId,
        queryFn: async () => {
          let findingsQuery = supabase
            .from("findings")
            .select("id, code, title, severity, status, origin, due_date")
            .eq("tenant_id", tenantId!)
            .eq("status", "Abierto");
          if (entityId) findingsQuery = findingsQuery.eq("entity_id", entityId);
          const { data: findings, error } = await findingsQuery;
          if (error) throw error;
          const findingIds = (findings ?? []).map((f) => f.id);
          const { data: plans } = findingIds.length
            ? await supabase
                .from("action_plans")
                .select("finding_id, title, status, progress_pct, due_date")
                .in("finding_id", findingIds)
            : { data: [] as Array<{ finding_id: string; title: string; status: string; progress_pct: number; due_date: string }> };
          return (findings ?? []).map((f) => ({
            ...f,
            action_plans: (plans ?? []).filter((p) => p.finding_id === f.id),
          }));
        },
      },
      // Q7: Attestations — campaña más reciente
      {
        queryKey: ["board-pack", "attestations", tenantId],
        enabled: !!tenantId,
        queryFn: async () => {
          const { data, error } = await supabase
            .from("attestations")
            .select("person_id, campaign, status, completed_at, persons:person_id ( full_name )")
            .eq("tenant_id", tenantId!)
            .order("campaign", { ascending: false });
          if (error) throw error;
          return data ?? [];
        },
      },
      // Q8: Delegaciones vigentes ordenadas por vencimiento
      {
        queryKey: ["board-pack", "delegations", tenantId, entityId ?? "all"],
        enabled: !!tenantId,
        queryFn: async () => {
          let delegationsQuery = supabase
            .from("delegations")
            .select("code, delegation_type, scope, limits, end_date, status, delegate:delegate_id ( full_name )")
            .eq("tenant_id", tenantId!)
            .in("status", ["Vigente"]);
          if (entityId) delegationsQuery = delegationsQuery.eq("entity_id", entityId);
          const { data, error } = await delegationsQuery.order("end_date");
          if (error) throw error;
          type Raw = {
            code: string;
            delegation_type: string;
            scope: string;
            limits: string | null;
            end_date: string;
            status: string;
            delegate: { full_name: string }[] | null;
          };
          const today = new Date();
          return ((data ?? []) as Raw[]).map((d) => ({
            code: d.code,
            delegation_type: d.delegation_type,
            delegate_name: d.delegate?.[0]?.full_name ?? "—",
            scope: d.scope,
            limits: d.limits,
            end_date: d.end_date,
            status: d.status,
            days_to_expiry: Math.ceil(
              (new Date(d.end_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
            ),
          }));
        },
      },
      // Q9: Sistemas IA Alto Riesgo + compliance checks
      {
        queryKey: ["board-pack", "ai-systems", tenantId],
        enabled: !!tenantId,
        queryFn: async () => {
          const { data: systems, error } = await supabase
            .from("ai_systems")
            .select("id, name, risk_level, vendor, status")
            .eq("tenant_id", tenantId!)
            .eq("risk_level", "Alto");
          if (error) throw error;
          const systemIds = (systems ?? []).map((s) => s.id);
          const { data: checks } = systemIds.length
            ? await supabase
                .from("ai_compliance_checks")
                .select("system_id, requirement_code, requirement_title, status")
                .in("system_id", systemIds)
            : { data: [] as Array<{ system_id: string; requirement_code: string; requirement_title: string; status: string }> };
          return (systems ?? []).map((sys) => {
            const sysChecks = (checks ?? []).filter((c) => c.system_id === sys.id);
            return {
              id: sys.id,
              name: sys.name,
              risk_level: sys.risk_level,
              vendor: sys.vendor,
              status: sys.status,
              checks: sysChecks,
              non_conformities: sysChecks.filter(
                (c) => c.status === "No conforme" || (c.status && String(c.status).toUpperCase() === "NO_CONFORME")
              ).length,
            };
          });
        },
      },
    ],
  });

  const isLoading = results.some((r) => r.isLoading);
  const error = results.find((r) => r.error)?.error as Error | null;

  if (isLoading || error || !results[0].data) {
    return { data: null, isLoading, error };
  }

  const [meetingQ, agendaQ, agreementsQ, risksQ, oblQ, findingsQ, attestQ, delQ, aiQ] = results;

  // DL-2: cotizadaWarnings desde entities.es_cotizada
  type RawMeeting = {
    id: string;
    slug: string | null;
    scheduled_start: string | null;
    meeting_type: string;
    status: string;
    location: string | null;
    governing_bodies: {
      id: string;
      name: string;
      body_type: string;
      entity_id: string;
      quorum_rule: Record<string, unknown> | null;
      entities: { common_name: string; es_cotizada: boolean | null }[] | null;
    }[] | null;
    president: { full_name: string }[] | null;
    secretary: { full_name: string }[] | null;
  };
  const rawMeeting = meetingQ.data as RawMeeting | null;

  // DL-2: si la entidad es cotizada, añadir advertencias LMV
  const gb = rawMeeting?.governing_bodies?.[0];
  const ent = gb?.entities?.[0];
  const esCotizada = ent?.es_cotizada === true;
  const cotizadaWarnings: string[] = esCotizada
    ? [
        "Entidad cotizada en mercados regulados (IBEX 35)",
        "Aplicable normativa LMV y obligaciones de información privilegiada",
        "Acuerdos con impacto en precio requieren valoración de materialidad MAR",
      ]
    : [];

  const meeting: BoardPackMeeting | null = rawMeeting
    ? {
        id: rawMeeting.id,
        slug: rawMeeting.slug,
        scheduled_start: rawMeeting.scheduled_start,
        meeting_type: rawMeeting.meeting_type,
        status: rawMeeting.status,
        location: rawMeeting.location,
        body: gb
          ? {
              id: gb.id,
              name: gb.name,
              body_type: gb.body_type,
              entity_id: gb.entity_id,
              entity_name: ent?.common_name ?? "—",
              quorum_rule: gb.quorum_rule ?? null,
            }
          : null,
        president: rawMeeting.president?.[0] ?? null,
        secretary: rawMeeting.secretary?.[0] ?? null,
        agenda_items: (agendaQ.data ?? []) as Array<{
          order_number: number;
          title: string;
          description: string | null;
        }>,
      }
    : null;

  // Attestations: agrupar por campaña más reciente
  type AttRaw = {
    campaign: string;
    status: string;
    completed_at: string | null;
    persons: { full_name: string }[] | null;
  };
  const allAtts = (attestQ.data ?? []) as AttRaw[];
  const latestCampaign = allAtts[0]?.campaign ?? "";
  const campaignAtts = allAtts.filter((a) => a.campaign === latestCampaign);

  const data: BoardPackData = {
    meeting,
    agreements: (agreementsQ.data ?? []) as BoardPackAgreement[],
    risks: (risksQ.data ?? []) as BoardPackRisk[],
    obligations: (oblQ.data ?? []) as BoardPackObligation[],
    findings: (findingsQ.data ?? []) as BoardPackFinding[],
    attestations: {
      campaign: latestCampaign,
      completed: campaignAtts.filter((a) => a.status === "Completada").length,
      total: campaignAtts.length,
      pending: campaignAtts
        .filter((a) => a.status === "Pendiente")
        .map((a) => ({
          person_name: a.persons?.[0]?.full_name ?? "—",
          campaign: a.campaign,
          status: a.status,
          completed_at: a.completed_at,
        })),
    },
    delegations: (delQ.data ?? []) as BoardPackDelegation[],
    aiSystems: (aiQ.data ?? []) as BoardPackAISystem[],
    generatedAt: new Date().toISOString(),
    cotizadaWarnings,
  };

  return { data, isLoading: false, error: null };
}
