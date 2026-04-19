import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";

export interface PostAcuerdoPayload {
  inscribible: boolean;
  instrumentoRequerido: "ESCRITURA" | "INSTANCIA" | "NINGUNO";
  publicacionRequerida: boolean;
  canalesPublicacion?: string[];
  plazoInscripcion?: number;
  notas?: string;
}

export interface RulePackVersionRow {
  id: string;
  rule_pack_id: string;
  version_number: number;
  is_active: boolean;
  payload: PostAcuerdoPayload | null;
  created_at: string;
}

export interface RulePackRow {
  id: string;
  tenant_id: string;
  materia_clase: string;
  nombre: string;
  descripcion?: string | null;
  created_at: string;
}

export interface RulePackData {
  pack: RulePackRow;
  version: RulePackVersionRow;
  payload: PostAcuerdoPayload;
}

/**
 * useRulePackForMateria — Fetches the rule_pack + active version for a given materia_clase
 * from rule_packs JOIN rule_pack_versions WHERE is_active=true
 *
 * Usage:
 *   const { data, isLoading, error } = useRulePackForMateria("JUNTA_GENERAL");
 *   if (data) {
 *     const { inscribible, instrumentoRequerido } = data.payload;
 *   }
 */
export function useRulePackForMateria(materiaCla: string | undefined) {
  return useQuery<RulePackData | null, Error>({
    enabled: !!materiaCla,
    queryKey: ["rule_packs", "byMateria", materiaCla],
    queryFn: async () => {
      if (!materiaCla) return null;

      const { data, error } = await supabase
        .from("rule_packs")
        .select(
          `
          id,
          tenant_id,
          materia_clase,
          nombre,
          descripcion,
          created_at,
          rule_pack_versions!inner (
            id,
            rule_pack_id,
            version_number,
            is_active,
            payload,
            created_at
          )
        `
        )
        .eq("tenant_id", DEMO_TENANT)
        .eq("materia_clase", materiaCla)
        .eq("rule_pack_versions.is_active", true)
        .maybeSingle();

      if (error) throw error;

      if (!data) return null;

      const pack = data as any as RulePackRow;
      const versions = (data as any).rule_pack_versions as RulePackVersionRow[];
      const version = versions[0];

      if (!version || !version.payload) return null;

      return {
        pack,
        version,
        payload: version.payload as PostAcuerdoPayload,
      };
    },
  });
}
