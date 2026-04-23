import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

export type PackRuleLite = {
  framework_code: string;
  effective_date: string | null;
  local_adaptations?: string | null;
};

export type CountryPack = {
  id: string;
  country_code: string;
  pack_name: string;
  is_active: boolean | null;
  active_modules: string[] | null;
  pack_rules?: PackRuleLite[] | null;
};

export function useCountryPacks() {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["grc", "packs", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("country_packs")
        .select("*, pack_rules(framework_code, effective_date)")
        .eq("tenant_id", tenantId!)
        .order("country_code");
      if (error) throw error;
      return (data ?? []) as CountryPack[];
    },
  });
}

export function useCountryPackDetail(countryCode: string) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["grc", "pack", tenantId, countryCode],
    enabled: !!countryCode && !!tenantId,
    queryFn: async () => {
      const { data: pack } = await supabase
        .from("country_packs")
        .select("*, pack_rules(framework_code, effective_date, local_adaptations)")
        .eq("tenant_id", tenantId!)
        .eq("country_code", countryCode)
        .maybeSingle();

      const { count: incidentsOpen } = await supabase
        .from("incidents")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId!)
        .neq("status", "Cerrado")
        .eq("country_code", countryCode);

      const { count: risksHigh } = await supabase
        .from("risks")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId!)
        .gte("residual_score", 15);

      const { count: regNotsPending } = await supabase
        .from("regulatory_notifications")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId!)
        .eq("status", "Pendiente");

      return {
        pack: pack as CountryPack | null,
        kpis: {
          incidentsOpen: incidentsOpen ?? 0,
          risksHigh: risksHigh ?? 0,
          regNotsPending: regNotsPending ?? 0,
        },
      };
    },
  });
}
