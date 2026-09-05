import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import type { Measured } from "@/hooks/useModuleStatus";

/**
 * Contratos `console.evidence.spine.v1` y `console.integration.links.v1`.
 *
 * Solo lectura: la consola no escribe en `governance_module_events` ni en
 * `governance_module_links` (prohibición vigente de CLAUDE.md), y no promueve
 * `evidence_bundles` a evidencia verificable mientras 000049 siga en HOLD.
 *
 * Un error de consulta se propaga como `null` («no medido»), nunca como 0.
 */
export interface ConsoleReadModel {
  evidence: {
    open: Measured;
    sealed: Measured;
    verified: Measured;
  };
  integration: {
    events: Measured;
    links: Measured;
  };
}

type CountResult = { count: number | null; error: unknown };

function measured(res: CountResult): Measured {
  return res.error ? null : (res.count ?? 0);
}

export function useConsoleReadModel() {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["console_read_model", tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<ConsoleReadModel> => {
      const countOf = (table: string, status?: string) => {
        const q = supabase
          .from(table as "evidence_bundles")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId!);
        return status ? q.eq("status", status) : q;
      };

      const [openRes, sealedRes, verifiedRes, eventsRes, linksRes] = await Promise.all([
        countOf("evidence_bundles", "OPEN"),
        countOf("evidence_bundles", "SEALED"),
        countOf("evidence_bundles", "VERIFIED"),
        countOf("governance_module_events"),
        countOf("governance_module_links"),
      ]);

      return {
        evidence: {
          open: measured(openRes),
          sealed: measured(sealedRes),
          verified: measured(verifiedRes),
        },
        integration: {
          events: measured(eventsRes),
          links: measured(linksRes),
        },
      };
    },
    staleTime: 60_000,
  });
}
