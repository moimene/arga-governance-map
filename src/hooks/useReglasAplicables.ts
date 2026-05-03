import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import { useSociedad } from "@/hooks/useSociedades";
import { usePactosVigentes } from "@/hooks/usePactosParasociales";
import { normalizeSocietyFormForRuleSet } from "@/lib/secretaria/normative-framework";

export type ReglasSource = "LEY" | "ESTATUTOS" | "PACTO" | "REGLAMENTO";

export interface ReglasPack {
  source: ReglasSource;
  pack_id: string;
  pack_code: string;
  version: number | string | null;
  jurisdiction: string | null;
  materia: string | null;
  note: string | null;
}

interface RulePackRow {
  id: string;
  codigo?: string | null;
  nombre?: string | null;
  descripcion?: string | null;
  materia?: string | null;
  materia_clase?: string | null;
  organo_tipo?: string | null;
  rule_pack_versions?: Array<{
    id: string;
    version_number?: number | null;
    version?: string | null;
    is_active: boolean | null;
  }> | null;
}

interface JurisdictionRuleSetRow {
  id: string;
  jurisdiction: string;
  company_form: string;
  rule_set_version: string;
  legal_reference: string | null;
}

/**
 * useReglasAplicables — Devuelve el listado unificado de reglas aplicables para
 * una sociedad: LEY (rule_packs + jurisdiction_rule_sets), ESTATUTOS (placeholder
 * hasta que exista tabla específica), PACTO (pactos_parasociales vigentes) y
 * REGLAMENTO (placeholder).
 *
 * Nota: no todas las fuentes existen como tabla separada en la base actual.
 * Los STUBS quedan listos para cuando se añadan.
 */
export function useReglasAplicables(entityId: string | undefined) {
  const { tenantId } = useTenantContext();
  const { data: sociedad } = useSociedad(entityId);
  const { data: pactos } = usePactosVigentes(entityId);
  const companyForm = normalizeSocietyFormForRuleSet(sociedad?.tipo_social ?? sociedad?.legal_form, {
    listed: sociedad?.es_cotizada,
  });

  return useQuery({
    enabled: !!entityId && !!sociedad && !!tenantId,
    queryKey: [
      "reglas_aplicables",
      tenantId,
      entityId,
      sociedad?.jurisdiction ?? null,
      sociedad?.tipo_social ?? null,
      companyForm ?? null,
      (pactos ?? []).length,
    ],
    queryFn: async (): Promise<ReglasPack[]> => {
      const out: ReglasPack[] = [];

      // 1) LEY — jurisdiction_rule_sets vigentes
      if (sociedad?.jurisdiction && companyForm) {
        const { data: jrs, error: jrsErr } = await supabase
          .from("jurisdiction_rule_sets")
          .select("id, jurisdiction, company_form, rule_set_version, legal_reference")
          .eq("tenant_id", tenantId!)
          .eq("jurisdiction", sociedad.jurisdiction)
          .eq("company_form", companyForm);
        if (jrsErr) throw jrsErr;
        for (const r of (jrs ?? []) as JurisdictionRuleSetRow[]) {
          out.push({
            source: "LEY",
            pack_id: r.id,
            pack_code: r.legal_reference ?? `Jurisdiction rule set ${r.company_form}`,
            version: r.rule_set_version,
            jurisdiction: r.jurisdiction,
            materia: "GENERAL",
            note: "Régimen aplicable por jurisdicción + forma jurídica",
          });
        }
      }

      // 2) LEY — rule_packs activos (motor LSC) para la jurisdicción
      const { data: rps, error: rpsErr } = await supabase
        .from("rule_packs")
        .select("*, rule_pack_versions(id, version, version_number, is_active)")
        .eq("tenant_id", tenantId!);
      if (rpsErr) {
        // si la tabla o columnas fallan por versión de schema, caemos silenciosamente
        // (la UI mostrará lo que haya)
      } else {
        for (const p of (rps ?? []) as RulePackRow[]) {
          const active = (p.rule_pack_versions ?? []).find((v) => v.is_active);
          if (!active) continue;
          out.push({
            source: "LEY",
            pack_id: p.id,
            pack_code: p.codigo ?? p.nombre ?? p.descripcion ?? String(p.id).slice(0, 20),
            version: active.version_number ?? active.version ?? null,
            jurisdiction: sociedad?.jurisdiction ?? null,
            materia: p.materia_clase ?? p.materia ?? null,
            note: p.nombre ?? p.descripcion ?? null,
          });
        }
      }

      // 3) ESTATUTOS — aún no existe tabla específica; stub para cuando se añada.
      //   Si hay columna `statutes_version` o similar en entities, se puede leer.
      //   Por ahora, si la sociedad tiene metadata con `estatutos`, lo registramos.

      // 4) PACTO — pactos_parasociales vigentes (hook ya cargado arriba)
      for (const p of pactos ?? []) {
        const materias = (p.materias_aplicables ?? []).join(", ");
        out.push({
          source: "PACTO",
          pack_id: p.id,
          pack_code: p.titulo ?? p.tipo_clausula ?? "PACTO",
          version: null,
          jurisdiction: sociedad?.jurisdiction ?? null,
          materia: materias || p.tipo_clausula,
          note: p.descripcion ?? null,
        });
      }

      // 5) REGLAMENTO — no hay tabla específica todavía; stub.

      return out;
    },
  });
}
