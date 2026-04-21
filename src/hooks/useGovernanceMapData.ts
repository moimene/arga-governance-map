import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Node, Edge } from "@xyflow/react";
import { MarkerType } from "@xyflow/react";
import type { GovNodeData } from "@/components/governance-map/GovNode";

const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";

type EntityRow = {
  id: string;
  slug: string;
  common_name: string;
  jurisdiction: string | null;
  parent_entity_id: string | null;
};
type BodyRow = {
  id: string;
  slug: string;
  name: string;
  body_type: string | null;
  entity_id: string;
};
type PolicyRow = {
  id: string;
  policy_code: string;
  title: string;
  status: string;
};
type ObligationRow = {
  id: string;
  code: string;
  title: string;
  criticality: string | null;
  policy_id: string | null;
};
type FindingRow = {
  id: string;
  code: string;
  title: string;
  severity: string | null;
  status: string | null;
  entity_id: string | null;
};
type DelegationRow = {
  id: string;
  code: string;
  delegation_type: string | null;
  status: string | null;
  entity_id: string | null;
};

export interface GovernanceMapData {
  nodes: Node<GovNodeData>[];
  edges: Edge[];
}

// Layout: posiciones derivadas de profundidad jerárquica (entities) + clusters estáticos para el resto.
const ENTITY_ROW_HEIGHT = 160;
const ENTITY_COL_WIDTH = 220;
const BODY_Y = 800;
const POLICY_Y = 1020;
const OBL_Y = 1200;
const FIND_Y = 1380;
const DEL_Y = 1380;

function layoutEntities(entities: EntityRow[]): Map<string, { x: number; y: number; depth: number }> {
  const byParent = new Map<string | null, EntityRow[]>();
  for (const e of entities) {
    const key = e.parent_entity_id;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(e);
  }
  const pos = new Map<string, { x: number; y: number; depth: number }>();
  // BFS-ish layout
  const root = entities.find((e) => e.parent_entity_id === null);
  if (!root) return pos;
  const levels: EntityRow[][] = [[root]];
  while (levels[levels.length - 1].length > 0) {
    const next: EntityRow[] = [];
    for (const node of levels[levels.length - 1]) {
      const children = byParent.get(node.id) ?? [];
      next.push(...children);
    }
    if (next.length === 0) break;
    levels.push(next);
  }
  levels.forEach((row, depth) => {
    const y = depth * ENTITY_ROW_HEIGHT;
    const totalWidth = row.length * ENTITY_COL_WIDTH;
    const startX = -totalWidth / 2 + ENTITY_COL_WIDTH / 2;
    row.forEach((e, i) => {
      pos.set(e.id, { x: startX + i * ENTITY_COL_WIDTH, y, depth });
    });
  });
  return pos;
}

export function useGovernanceMapData() {
  return useQuery<GovernanceMapData>({
    queryKey: ["governance_map", "all"],
    staleTime: 60_000,
    queryFn: async () => {
      const [entRes, bodyRes, polRes, oblRes, findRes, delRes] = await Promise.all([
        supabase
          .from("entities")
          .select("id, slug, common_name, jurisdiction, parent_entity_id")
          .eq("tenant_id", DEMO_TENANT)
          .order("common_name"),
        supabase
          .from("governing_bodies")
          .select("id, slug, name, body_type, entity_id")
          .eq("tenant_id", DEMO_TENANT),
        supabase
          .from("policies")
          .select("id, policy_code, title, status")
          .eq("tenant_id", DEMO_TENANT)
          .order("policy_code"),
        supabase
          .from("obligations")
          .select("id, code, title, criticality, policy_id")
          .eq("tenant_id", DEMO_TENANT),
        supabase
          .from("findings")
          .select("id, code, title, severity, status, entity_id")
          .eq("tenant_id", DEMO_TENANT),
        supabase
          .from("delegations")
          .select("id, code, delegation_type, status, entity_id")
          .eq("tenant_id", DEMO_TENANT),
      ]);
      if (entRes.error) throw entRes.error;
      if (bodyRes.error) throw bodyRes.error;
      if (polRes.error) throw polRes.error;
      if (oblRes.error) throw oblRes.error;
      if (findRes.error) throw findRes.error;
      if (delRes.error) throw delRes.error;

      const entities = (entRes.data ?? []) as EntityRow[];
      const bodies = (bodyRes.data ?? []) as BodyRow[];
      const policies = (polRes.data ?? []) as PolicyRow[];
      const obligations = (oblRes.data ?? []) as ObligationRow[];
      const findings = (findRes.data ?? []) as FindingRow[];
      const delegations = (delRes.data ?? []) as DelegationRow[];

      const pos = layoutEntities(entities);
      const nodes: Node<GovNodeData>[] = [];
      const edges: Edge[] = [];

      // Entidades
      entities.forEach((e) => {
        const p = pos.get(e.id);
        const findingsOnEntity = findings.filter((f) => f.entity_id === e.id && f.status !== "CERRADO");
        const status: GovNodeData["status"] =
          findingsOnEntity.some((f) => f.severity === "Crítico")
            ? { label: "Crítica", tone: "critical" }
            : findingsOnEntity.length > 0
            ? { label: "Hallazgos", tone: "warning" }
            : undefined;
        nodes.push({
          id: `entity:${e.id}`,
          type: "gov",
          position: { x: p?.x ?? 0, y: p?.y ?? 0 },
          data: {
            label: e.common_name + (e.jurisdiction ? ` · ${e.jurisdiction}` : ""),
            type: "entity",
            status,
            emphasized: !!status && status.tone === "critical",
            href: `/entidades/${e.slug}`,
          },
        });
        if (e.parent_entity_id) {
          edges.push({
            id: `e:ent:${e.id}`,
            source: `entity:${e.parent_entity_id}`,
            target: `entity:${e.id}`,
            label: "participa",
            type: "smoothstep",
          });
        }
      });

      // Órganos — colgados del body_y, alineados bajo su entidad si tiene pos
      const bodiesByEntity = new Map<string, BodyRow[]>();
      for (const b of bodies) {
        if (!bodiesByEntity.has(b.entity_id)) bodiesByEntity.set(b.entity_id, []);
        bodiesByEntity.get(b.entity_id)!.push(b);
      }
      bodiesByEntity.forEach((list, entityId) => {
        const entPos = pos.get(entityId);
        const baseX = entPos?.x ?? 0;
        list.forEach((b, i) => {
          nodes.push({
            id: `body:${b.id}`,
            type: "gov",
            position: { x: baseX + (i - (list.length - 1) / 2) * 180, y: BODY_Y + (entPos?.depth ?? 0) * 40 },
            data: {
              label: b.name,
              type: "organ",
              status: undefined,
              href: `/organos/${b.slug}`,
            },
          });
          edges.push({
            id: `e:body:${b.id}`,
            source: `entity:${b.entity_id}`,
            target: `body:${b.id}`,
            label: "gobierna",
            type: "smoothstep",
            style: { stroke: "hsl(var(--primary))", strokeWidth: 1.2 },
          });
        });
      });

      // Políticas — fila
      policies.forEach((p, i) => {
        nodes.push({
          id: `policy:${p.id}`,
          type: "gov",
          position: { x: (i - policies.length / 2) * 200, y: POLICY_Y },
          data: {
            label: `${p.policy_code} — ${p.title}`,
            type: "policy",
            status:
              p.status === "Published"
                ? { label: "Vigente", tone: "active" }
                : p.status === "Approval Pending"
                ? { label: "Pendiente", tone: "warning" }
                : { label: p.status, tone: "pending" },
            href: `/politicas/${p.policy_code}`,
          },
        });
      });

      // Obligaciones — fila debajo, enlazadas a política padre
      obligations.forEach((o, i) => {
        nodes.push({
          id: `oblig:${o.id}`,
          type: "gov",
          position: { x: (i - obligations.length / 2) * 260, y: OBL_Y },
          data: {
            label: `${o.code} — ${o.title}`,
            type: "obligation",
            status: o.criticality
              ? {
                  label: o.criticality,
                  tone: o.criticality === "Crítica" || o.criticality === "Alta" ? "warning" : "pending",
                }
              : undefined,
            href: `/obligaciones/${o.code}`,
          },
        });
        if (o.policy_id) {
          edges.push({
            id: `e:opl:${o.id}`,
            source: `policy:${o.policy_id}`,
            target: `oblig:${o.id}`,
            label: "regula",
            type: "smoothstep",
          });
        }
      });

      // Hallazgos — fila inferior
      findings.forEach((f, i) => {
        nodes.push({
          id: `find:${f.id}`,
          type: "gov",
          position: { x: (i - findings.length / 2) * 260 - 300, y: FIND_Y },
          data: {
            label: `${f.code} — ${f.title}`,
            type: "finding",
            status: { label: f.severity ?? f.status ?? "—", tone: "critical" },
            emphasized: true,
            href: `/hallazgos/${f.code}`,
          },
        });
        if (f.entity_id) {
          edges.push({
            id: `e:fnd-ent:${f.id}`,
            source: `find:${f.id}`,
            target: `entity:${f.entity_id}`,
            label: "afecta",
            type: "smoothstep",
            style: { stroke: "hsl(var(--destructive))", strokeWidth: 1.5, strokeDasharray: "4 3" },
            labelStyle: { fill: "hsl(var(--destructive))", fontWeight: 600 },
          });
        }
        if (f.policy_id) {
          edges.push({
            id: `e:fnd-pol:${f.id}`,
            source: `find:${f.id}`,
            target: `policy:${f.policy_id}`,
            label: "origen",
            type: "smoothstep",
            style: { stroke: "hsl(var(--status-warning))", strokeWidth: 1.2 },
          });
        }
      });

      // Delegaciones — al lado de findings
      delegations.forEach((d, i) => {
        nodes.push({
          id: `deleg:${d.id}`,
          type: "gov",
          position: { x: (i - delegations.length / 2) * 260 + 400, y: DEL_Y },
          data: {
            label: `${d.code} — ${d.title}`,
            type: "delegation",
            status:
              d.status === "CADUCADA" || d.status === "Caducada"
                ? { label: "Caducada", tone: "critical" }
                : d.status
                ? { label: d.status, tone: "warning" }
                : undefined,
            emphasized: d.status === "CADUCADA" || d.status === "Caducada",
            href: `/delegaciones/${d.code}`,
          },
        });
        if (d.entity_id) {
          const isExpired = d.status === "CADUCADA" || d.status === "Caducada";
          edges.push({
            id: `e:del:${d.id}`,
            source: `deleg:${d.id}`,
            target: `entity:${d.entity_id}`,
            label: isExpired ? "CADUCADA ⚠" : "delegación",
            type: "smoothstep",
            style: isExpired
              ? { stroke: "hsl(var(--destructive))", strokeWidth: 2, strokeDasharray: "6 4" }
              : undefined,
            labelStyle: isExpired ? { fill: "hsl(var(--destructive))", fontWeight: 700 } : undefined,
            markerEnd: isExpired
              ? { type: MarkerType.ArrowClosed, color: "hsl(var(--destructive))" }
              : undefined,
          });
        }
      });

      return { nodes, edges };
    },
  });
}
