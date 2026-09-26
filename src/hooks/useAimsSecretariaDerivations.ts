import { useMutation, useQuery, useQueryClient, skipToken } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import {
  buildDerivationInsert,
  DERIVATION_UNIQUE_VIOLATION_CODE,
  type DerivationTarget,
} from "@/lib/aims/secretaria-derivation";

export interface AimsSecretariaDerivationRow {
  id: string;
  source_event: string;
  target_meeting_id: string | null;
  target_agreement_id: string | null;
  status: string;
  evidence_ref: string | null;
  created_at: string;
  meetings: { id: string; status: string; scheduled_start: string | null } | null;
  agreements: { id: string; status: string; agreement_kind: string } | null;
}

/**
 * Persiste la relación AIMS -> Secretaría en el instante en que la reunión o
 * el acuerdo se CREA de verdad desde una derivación — nunca desde la sola
 * navegación (`src/lib/aims/handoffs.ts` sigue siendo de solo lectura).
 * Idempotente: reintentar el mismo par origen/destino no duplica fila (índice
 * único parcial de la migración 20260927105600; el 23505 se trata como éxito).
 */
export function useCreateAimsSecretariaDerivation() {
  const { tenantId } = useTenantContext();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      sourceIncidentId: string;
      sourceEvent: string;
      target: DerivationTarget;
    }): Promise<{ id: string | null; alreadyLinked: boolean }> => {
      const row = buildDerivationInsert({ tenantId, ...input });
      const { data, error } = await supabase
        .from("aims_secretaria_derivations")
        .insert(row)
        .select("id")
        .single();
      if (error) {
        if (error.code === DERIVATION_UNIQUE_VIOLATION_CODE) {
          return { id: null, alreadyLinked: true };
        }
        throw error;
      }
      return { id: (data as { id: string }).id, alreadyLinked: false };
    },
    onSuccess: (_result, input) => {
      qc.invalidateQueries({
        queryKey: ["aims_secretaria_derivations", tenantId, input.sourceIncidentId],
      });
    },
  });
}

/**
 * Consulta de retorno desde AIMS: qué reunión o acuerdo de Secretaría resolvió
 * este incidente. SOLO LECTURA — ningún hook de este contrato hace `.update()`
 * sobre `meetings`/`agreements`; no copia ni modifica el acta ni el acuerdo.
 * Acotada al tenant de la sesión en el propio camino (además de la RLS de la
 * tabla, que ya la exige).
 */
export function useAimsSecretariaDerivationsForIncident(
  incidentId: string | null | undefined,
) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["aims_secretaria_derivations", tenantId, incidentId ?? null],
    queryFn:
      tenantId && incidentId
        ? async () => {
            const { data, error } = await supabase
              .from("aims_secretaria_derivations")
              .select(
                "id, source_event, target_meeting_id, target_agreement_id, status, evidence_ref, created_at, meetings(id, status, scheduled_start), agreements(id, status, agreement_kind)",
              )
              .eq("tenant_id", tenantId!)
              .eq("source_incident_id", incidentId)
              .order("created_at", { ascending: false });
            if (error) throw error;
            return (data ?? []) as unknown as AimsSecretariaDerivationRow[];
          }
        : skipToken,
  });
}
