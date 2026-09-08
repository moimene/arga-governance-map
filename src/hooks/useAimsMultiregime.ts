import { useQuery, useMutation, useQueryClient, skipToken } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

/**
 * NOTA SOBRE EL TIPADO DE ESTAS TABLAS (2026-09-06).
 *
 * Los `.from("aims_…" as never)` que había aquí se han retirado: no hacían
 * nada. `supabase.from()` en esta app NO está tipado por tabla, y la causa no
 * es que falten las tablas en los tipos generados —que faltan: ninguna de las
 * `aims_fria_*` ni `aims_incident_*` está en `supabase/functions/_types/
 * database.ts`—, sino que `createClient` se construye SIN el genérico
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

export interface IncidentRegimeCase {
  id: string;
  tenant_id: string;
  incident_id: string;
  entity_id: string | null;
  regime_code: "RIA" | "GDPR" | "DORA";
  status: "OPEN" | "IN_INVESTIGATION" | "NOTIFIED" | "NOT_APPLICABLE_JUSTIFIED" | "CLOSED";
  applicability_rationale: string | null;
  target_authority: string;
  lead_role: "AI_OFFICER" | "DPO" | "CISO" | "LEGAL";
  closed_at: string | null;
  closure_reason: string | null;
  evidence_bundle_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// `RegulatoryClock` describía `aims_regulatory_clocks`, tabla que NINGUNA
// superficie de `src/` lee ni escribe: los relojes se calculan en cliente en
// `incident-clocks.ts` y no se persisten. El tipo se ha retirado para que no
// sugiera una persistencia que no existe; la tabla sigue en Cloud.

/**
 * Consulta los subexpedientes por régimen asociados a un incidente.
 */
export function useIncidentRegimes(incidentId: string | undefined) {
  const { tenantId } = useTenantContext();

  return useQuery<IncidentRegimeCase[]>({
    queryKey: ["aims_incident_regimes", tenantId, incidentId],
    queryFn: tenantId && incidentId ? async () => {
      const { data, error } = await supabase
        .from("aims_incident_regimes")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("incident_id", incidentId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as IncidentRegimeCase[];
    } : skipToken,
  });
}

/**
 * Abre un subexpediente por régimen.
 *
 * QUÉ REGISTRA, Y QUÉ NO. Deja constancia de que, a juicio de quien lo abre, el
 * régimen alcanza a este incidente. No hay envío a ninguna autoridad ni acuse
 * de nadie: la motivación de aplicabilidad es obligatoria precisamente porque
 * la afirmación es de quien abre, no del producto.
 *
 * `tenant_id` va EXPLÍCITO: la tabla no tiene default y varias del proyecto
 * defaultean al tenant de ARGA, así que un insert que lo omita aterriza en el
 * tenant equivocado. Y la pertenencia del incidente se comprueba ANTES, porque
 * el `incident_id` llega de la URL.
 */
export function useAbrirSubexpedienteRegimen() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenantContext();

  return useMutation({
    mutationFn: async ({
      incidentId,
      regimeCode,
      targetAuthority,
      leadRole,
      applicabilityRationale,
    }: {
      incidentId: string;
      regimeCode: IncidentRegimeCase["regime_code"];
      targetAuthority: string;
      leadRole: IncidentRegimeCase["lead_role"];
      applicabilityRationale: string;
    }) => {
      const motivacion = applicabilityRationale.trim();
      if (motivacion.length < 20) {
        throw new Error("La motivación de aplicabilidad necesita al menos 20 caracteres.");
      }

      const { data: incidente, error: errorIncidente } = await supabase
        .from("ai_incidents")
        .select("id")
        .eq("tenant_id", tenantId!)
        .eq("id", incidentId)
        .maybeSingle();
      if (errorIncidente) throw errorIncidente;
      if (!incidente) throw new Error("El incidente no pertenece a este entorno.");

      const { data, error } = await supabase
        .from("aims_incident_regimes")
        .insert({
          tenant_id: tenantId,
          incident_id: incidentId,
          regime_code: regimeCode,
          target_authority: targetAuthority,
          lead_role: leadRole,
          applicability_rationale: motivacion,
          status: "OPEN",
        })
        .select()
        .maybeSingle();

      if (error) throw error;
      // La RLS filtra a cero filas SIN error: sin fila no se ha escrito nada y
      // decir lo contrario sería el defecto que este módulo lleva corrigiendo.
      if (!data) throw new Error("La apertura no ha devuelto fila: no se ha registrado nada.");
      return data as IncidentRegimeCase;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["aims_incident_regimes", tenantId, data.incident_id] });
    },
  });
}

/**
 * Actualiza un subexpediente de régimen de forma aislada (Aislamiento de Cierres).
 */
export function useUpdateIncidentRegime() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenantContext();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<IncidentRegimeCase>;
    }) => {
      const { data, error } = await supabase
        .from("aims_incident_regimes")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", tenantId!)
        .eq("id", id)
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("El cierre no ha devuelto fila: no se ha actualizado nada.");
      return data as IncidentRegimeCase;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["aims_incident_regimes", tenantId, data.incident_id] });
    },
  });
}

// `useCreateIncidentReport` y su tipo `IncidentReport` se retiran (2026-09-06).
// No tenían ni un llamador en todo el repo: prometían en el nombre un informe
// «con acuse» a la autoridad que ningún camino del producto envía ni acusa.
// `aims_incident_reports` sigue en Cloud, vacía.
