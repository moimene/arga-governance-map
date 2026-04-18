import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";

export function useCountryPacks() {
  return useQuery({
    queryKey: ["grc", "packs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("country_packs")
        .select("*, pack_rules(framework_code, effective_date)")
        .eq("tenant_id", DEMO_TENANT)
        .order("country_code");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCountryPackDetail(countryCode: string) {
  return useQuery({
    queryKey: ["grc", "pack", countryCode],
    enabled: !!countryCode,
    queryFn: async () => {
      const { data: pack } = await supabase
        .from("country_packs")
        .select("*, pack_rules(framework_code, effective_date, local_adaptations)")
        .eq("tenant_id", DEMO_TENANT)
        .eq("country_code", countryCode)
        .maybeSingle();

      const { count: incidentsOpen } = await supabase
        .from("incidents")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", DEMO_TENANT)
        .neq("status", "Cerrado")
        .eq("country_code", countryCode);

      const { count: risksHigh } = await supabase
        .from("risks")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", DEMO_TENANT)
        .gte("residual_score", 15);

      const { count: regNotsPending } = await supabase
        .from("regulatory_notifications")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", DEMO_TENANT)
        .eq("status", "Pendiente");

      return {
        pack,
        kpis: {
          incidentsOpen: incidentsOpen ?? 0,
          risksHigh: risksHigh ?? 0,
          regNotsPending: regNotsPending ?? 0,
        },
      };
    },
  });
}
