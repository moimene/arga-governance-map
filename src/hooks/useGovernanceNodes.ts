import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import type { Node, Edge } from "@xyflow/react";
import type { GovNodeData } from "@/components/governance-map/GovNode";

// Raw types from Supabase — no `as any`, castear en el boundary de la query

type EntityRaw = {
  id: string;
  common_name: string;
  entity_status: string | null;
};

type BodyRaw = {
  id: string;
  name: string;
  body_type: string | null;
  entity_id: string;
};

type PolicyRaw = {
  id: string;
  title: string;
  policy_code: string;
  status: string;
};

export type GovernanceNode = Node<GovNodeData>;
export type GovernanceEdge = Edge;

export interface GovernanceNodesData {
  nodes: GovernanceNode[];
  edges: GovernanceEdge[];
}

function statusBadgeClass(status: string | null): string {
  if (!status) return "bg-[var(--g-surface-muted)]";
  const s = status.toUpperCase();
  if (s === "VIGENTE" || s === "PUBLISHED" || s === "ACTIVO") return "bg-[var(--status-success)]";
  if (s === "EN_REVISION" || s === "IN_REVIEW" || s === "APPROVAL_PENDING" || s === "APPROVAL PENDING")
    return "bg-[var(--status-warning)]";
  return "bg-[var(--g-surface-muted)]";
}

function policyStatusToGovStatus(status: string): GovNodeData["status"] {
  const s = status.toUpperCase();
  if (s === "VIGENTE" || s === "PUBLISHED") return { label: "Vigente", tone: "active" };
  if (s === "EN_REVISION" || s === "IN_REVIEW") return { label: "En revisión", tone: "warning" };
  if (s === "BORRADOR" || s === "DRAFT") return { label: "Borrador", tone: "pending" };
  if (s === "APPROVAL_PENDING" || s === "APPROVAL PENDING") return { label: "Pendiente", tone: "warning" };
  return { label: status, tone: "pending" };
}

export function useGovernanceNodes() {
  const { tenantId } = useTenantContext();
  return useQuery<GovernanceNodesData>({
    queryKey: ["governance_nodes", tenantId, "supabase"],
    enabled: !!tenantId,
    staleTime: 60_000,
    queryFn: async () => {
      const [entRes, bodyRes, polRes] = await Promise.all([
        supabase
          .from("entities")
          .select("id, common_name, entity_status")
          .eq("tenant_id", tenantId!),
        supabase
          .from("governing_bodies")
          .select("id, name, body_type, entity_id")
          .eq("tenant_id", tenantId!),
        supabase
          .from("policies")
          .select("id, title, policy_code, status")
          .eq("tenant_id", tenantId!)
          .order("policy_code")
          .limit(8),
      ]);

      if (entRes.error) throw entRes.error;
      if (bodyRes.error) throw bodyRes.error;
      if (polRes.error) throw polRes.error;

      const entities = (entRes.data ?? []) as EntityRaw[];
      const bodies = (bodyRes.data ?? []) as BodyRaw[];
      const policies = (polRes.data ?? []) as PolicyRaw[];

      const nodes: GovernanceNode[] = [];
      const edges: GovernanceEdge[] = [];

      // Entidades — nivel raíz
      const ENTITY_COL_W = 240;
      entities.forEach((e, i) => {
        nodes.push({
          id: `gov-entity:${e.id}`,
          type: "gov",
          position: {
            x: (i - (entities.length - 1) / 2) * ENTITY_COL_W,
            y: 0,
          },
          data: {
            label: e.common_name,
            type: "entity",
            status: undefined,
            href: `/entidades/${e.id}`,
          },
        });
      });

      // Órganos — cuelgan de su entity_id
      const bodiesByEntity = new Map<string, BodyRaw[]>();
      for (const b of bodies) {
        if (!bodiesByEntity.has(b.entity_id)) bodiesByEntity.set(b.entity_id, []);
        bodiesByEntity.get(b.entity_id)!.push(b);
      }

      const entIndexMap = new Map(entities.map((e, i) => [e.id, i]));
      let bodyIndex = 0;

      bodiesByEntity.forEach((list, entityId) => {
        const entIdx = entIndexMap.get(entityId) ?? 0;
        const baseX = (entIdx - (entities.length - 1) / 2) * ENTITY_COL_W;
        list.forEach((b, j) => {
          nodes.push({
            id: `gov-body:${b.id}`,
            type: "gov",
            position: {
              x: baseX + (j - (list.length - 1) / 2) * 200,
              y: 200,
            },
            data: {
              label: b.name,
              type: "organ",
              status: undefined,
              href: `/organos/${b.id}`,
            },
          });
          edges.push({
            id: `gov-e-body:${b.id}`,
            source: `gov-entity:${entityId}`,
            target: `gov-body:${b.id}`,
            label: "gobierna",
            type: "smoothstep",
          });
          bodyIndex++;
        });
      });

      // Políticas — cuelgan del body principal (consejo-administracion si existe, si no al primer body)
      const cdaBody = bodies.find((b) => b.body_type === "CDA");
      const anchorBodyId = cdaBody?.id ?? bodies[0]?.id;

      policies.forEach((p, i) => {
        const statusObj = policyStatusToGovStatus(p.status);
        nodes.push({
          id: `gov-policy:${p.id}`,
          type: "gov",
          position: {
            x: (i - (policies.length - 1) / 2) * 220,
            y: 440,
          },
          data: {
            label: `${p.policy_code} — ${p.title}`,
            type: "policy",
            status: statusObj,
            href: `/politicas/${p.policy_code}`,
          },
        });

        if (anchorBodyId) {
          edges.push({
            id: `gov-e-pol:${p.id}`,
            source: `gov-body:${anchorBodyId}`,
            target: `gov-policy:${p.id}`,
            label: "aprueba",
            type: "smoothstep",
          });
        }
      });

      return { nodes, edges };
    },
  });
}
