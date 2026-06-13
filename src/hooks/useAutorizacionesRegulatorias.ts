import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import type { AutorizacionRegulatoriaInput } from "@/lib/secretaria/autorizaciones-regulatorias";

/**
 * W7 — carga las autorizaciones regulatorias de una sociedad + sus flags de
 * regulación (cotizada / sector), para que la card del expediente evalúe (con
 * `evaluarAutorizacionesRegulatorias`) qué autorizaciones exige el acto.
 */
export interface AutorizacionesRegulatoriasData {
  autorizaciones: AutorizacionRegulatoriaInput[];
  esCotizada: boolean;
  regulatedSector: string | null;
}

export function useAutorizacionesRegulatorias(entityId: string | null | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!entityId && !!tenantId,
    queryKey: ["autorizaciones_regulatorias", tenantId, entityId],
    queryFn: async (): Promise<AutorizacionesRegulatoriasData> => {
      const [autRes, entRes] = await Promise.all([
        supabase
          .from("autorizacion_regulatoria")
          .select("organismo, estado, fecha_vigencia_hasta")
          .eq("tenant_id", tenantId!)
          .eq("sociedad_id", entityId!),
        supabase
          .from("entities")
          .select("es_cotizada, regulated_sector")
          .eq("id", entityId!)
          .maybeSingle(),
      ]);
      if (autRes.error) throw autRes.error;
      const ent = (entRes.data ?? {}) as {
        es_cotizada?: boolean | null;
        regulated_sector?: string | null;
      };
      const autorizaciones = (
        (autRes.data ?? []) as Array<{
          organismo: string;
          estado: string;
          fecha_vigencia_hasta: string | null;
        }>
      ).map((a) => ({
        organismo: a.organismo as AutorizacionRegulatoriaInput["organismo"],
        estado: a.estado as AutorizacionRegulatoriaInput["estado"],
        fechaVigenciaHasta: a.fecha_vigencia_hasta,
      }));
      return {
        autorizaciones,
        esCotizada: !!ent.es_cotizada,
        regulatedSector: ent.regulated_sector ?? null,
      };
    },
  });
}
