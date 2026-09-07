import { useQuery, skipToken } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

/**
 * NOTA SOBRE EL TIPADO DE ESTAS TABLAS (2026-09-06).
 *
 * Los `.from("aims_…" as never)` que había aquí se han retirado: no hacían
 * nada. `supabase.from()` en esta app NO está tipado por tabla, y la causa no
 * es que falten las tablas en los tipos generados —el fichero está a medias:
 * `aims_incident_evidence_packs` SÍ está en `supabase/functions/_types/
 * database.ts:1233`, y las `aims_fria_*` no—, sino que `createClient` se
 * construye SIN el genérico
 * `Database` (`src/integrations/supabase/client.ts`, y no hay ni un
 * `createClient<…>` en todo el repo). Con el cliente sin genérico, `from()`
 * acepta cualquier `string` y devuelve filas `any`.
 *
 * Consecuencia práctica: regenerar los tipos NO tiparía estos accesos, y el
 * `as never` solo servía para aparentar que había una razón de tipos detrás.
 * Comprobado: `bun run typecheck` pasa igual sin los casts.
 *
 * Lo que de verdad protege el shape de estas consultas es
 * `src/test/aims/aims-column-contract.test.ts`, que pregunta a Cloud por cada
 * columna declarada aquí. (Hasta el 2026-09-07 este comentario apuntaba a
 * `no-fabricated-claims.test.ts`, que no consulta Cloud: compara contra una
 * lista congelada de 19 fantasmas conocidos y no puede ver uno nuevo.) El día que el cliente reciba su
 * genérico, este comentario sobra.
 */
export interface FriaAssessment {
  id: string;
  tenant_id: string;
  system_id: string;
  version_id: string | null;
  title: string;
  status: "DRAFT" | "IN_REVIEW" | "APPROVED" | "SUPERSEDED";
  version_number: number;
  assessed_by: string | null;
  approved_by_dpo: string | null;
  approved_by_ai_officer: string | null;
  fria_summary: string | null;
  market_surveillance_notified: boolean;
  notification_date: string | null;
  // `qseal_token` / `tsq_token` NO existen en `aims_fria_assessments`: la
  // migración las retiró a propósito (verificado en Cloud, 2026-09-05).
  // Declararlas hacía dos daños: la UI las pintaba como `undefined`, y un sello
  // cualificado y un sello de tiempo son exactamente el tipo de afirmación que
  // este producto no puede sostener. No se reintroducen.
  created_at: string;
  updated_at: string;
}

export interface FriaProcessMapItem {
  id: string;
  fria_id: string;
  business_process: string;
  intended_purpose: string;
  decision_point: string;
  human_role: string | null;
  integration_notes: string | null;
}

export interface FriaUseProfile {
  id: string;
  fria_id: string;
  planned_start_date: string | null;
  planned_end_date: string | null;
  usage_frequency: "CONTINUOUS" | "BATCH_DAILY" | "ON_DEMAND" | "SEASONAL";
  estimated_volume: string | null;
  review_periodicity: string;
}

export interface FriaAffectedGroup {
  id: string;
  fria_id: string;
  group_name: string;
  group_description: string | null;
  impact_type: "DIRECT" | "INDIRECT";
  is_vulnerable_group: boolean;
  vulnerability_factors: string | null;
  is_data_subject_only: boolean;
}

export interface FriaRightsRisk {
  id: string;
  fria_id: string;
  fundamental_right: string;
  harm_scenario: string;
  provider_info_ref: string | null;
  likelihood: "LOW" | "MEDIUM" | "HIGH";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  mitigation_measures: string | null;
  residual_risk: string;
}

/**
 * Art. 27.1 (f). El órgano es una ARISTA, no un rótulo.
 *
 * La columna de Cloud es `governance_body_id uuid REFERENCES governing_bodies`
 * (verificado el 2026-09-06). Esta interfaz declaraba en su lugar un
 * `governance_body: string` que NO EXISTE en la tabla, así que la ficha pintaba
 * `undefined` en cuanto hubiera una fila. Y aunque un seed hubiera escrito los
 * dos campos con el mismo valor, leer el texto seguiría sin demostrar la
 * relación: el rótulo coincide, la arista no se recorre. Es la lección de G4,
 * repetida aquí.
 *
 * Por eso se lee la FK con su embed y la pantalla ENLAZA al órgano. Si el
 * enlace deja de resolver, se nota; un texto libre no se rompe nunca.
 */
export interface FriaRemediationGovernance {
  id: string;
  fria_id: string;
  trigger_event: string;
  governance_body_id: string | null;
  /** Embed de `governing_bodies`. `slug` porque `/organos/:id` resuelve POR
   *  SLUG (`useBodyBySlug`), no por UUID. */
  governing_bodies: { name: string; slug: string } | null;
  complaint_channel: string;
  redress_procedure: string;
  rollback_strategy: string | null;
  board_escalation_threshold: string | null;
}

export interface FriaDpiaCrossReference {
  id: string;
  tenant_id: string;
  fria_id: string;
  dpia_ref_id: string;
  ria_obligation_point: "ART_27_1_A" | "ART_27_1_C" | "ART_27_1_D" | "ART_27_1_F";
  dpia_section: string;
  coverage_type: "FULL" | "PARTIAL";
  source_hash: string | null;
  validation_status: "VALID" | "IN_REVIEW" | "REVOKED";
  dpo_signoff_by: string | null;
  ai_officer_signoff_by: string | null;
  notes: string | null;
}

/**
 * Consulta la FRIA asociada a un sistema de IA.
 */
export function useFriaBySystem(systemId: string | undefined) {
  const { tenantId } = useTenantContext();

  return useQuery<FriaAssessment | null>({
    queryKey: ["aims_fria_assessments", tenantId, systemId],
    queryFn: tenantId && systemId ? async () => {
      const { data, error } = await supabase
        .from("aims_fria_assessments")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("system_id", systemId)
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as FriaAssessment | null;
    } : skipToken,
  });
}

/**
 * Consulta los 6 bloques y las referencias cruzadas FRIA-EIPD de una FRIA.
 */
export function useFriaDetails(friaId: string | undefined) {
  const { tenantId } = useTenantContext();

  return useQuery<{
    processes: FriaProcessMapItem[];
    useProfile: FriaUseProfile | null;
    affectedGroups: FriaAffectedGroup[];
    rightsRisks: FriaRightsRisk[];
    remediation: FriaRemediationGovernance | null;
    crossReferences: FriaDpiaCrossReference[];
  }>({
    queryKey: ["aims_fria_details", tenantId, friaId],
    queryFn: tenantId && friaId ? async () => {
      const [pRes, uRes, gRes, rRes, remRes, xRes] = await Promise.all([
        supabase.from("aims_fria_process_map").select("*").eq("tenant_id", tenantId).eq("fria_id", friaId),
        supabase.from("aims_fria_use_profile").select("*").eq("tenant_id", tenantId).eq("fria_id", friaId).maybeSingle(),
        supabase.from("aims_fria_affected_groups").select("*").eq("tenant_id", tenantId).eq("fria_id", friaId),
        supabase.from("aims_fria_fundamental_rights_risks").select("*").eq("tenant_id", tenantId).eq("fria_id", friaId),
        supabase
          .from("aims_fria_remediation_governance")
          .select("*, governing_bodies(name, slug)")
          .eq("tenant_id", tenantId)
          .eq("fria_id", friaId)
          .maybeSingle(),
        supabase.from("aims_fria_dpia_cross_references").select("*").eq("tenant_id", tenantId).eq("fria_id", friaId),
      ]);

      // Un fallo de RLS o una tabla ausente no puede presentarse como "no hay datos":
      // la pantalla quedaría vacía y nadie se enteraría.
      for (const res of [pRes, uRes, gRes, rRes, remRes, xRes]) {
        const { error } = res;
        if (error) throw error;
      }

      return {
        processes: (pRes.data || []) as FriaProcessMapItem[],
        useProfile: (uRes.data || null) as FriaUseProfile | null,
        affectedGroups: (gRes.data || []) as FriaAffectedGroup[],
        rightsRisks: (rRes.data || []) as FriaRightsRisk[],
        remediation: (remRes.data || null) as FriaRemediationGovernance | null,
        crossReferences: (xRes.data || []) as FriaDpiaCrossReference[],
      };
    } : skipToken,
  });
}
