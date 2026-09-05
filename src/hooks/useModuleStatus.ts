import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

/**
 * Read model de la consola (contratos `console.<owner>.<objeto>.v1`).
 *
 * Regla del contrato: cada número nace de UNA query tenant-scoped contra una
 * tabla que existe en Cloud. Un error de PostgREST se propaga como `null`
 * («no medido»), NUNCA como 0 — un 0 afirma que se midió y no había nada.
 *
 * Historia: hasta 2026-09-05 el KPI de incidentes filtraba por `incidents.module_id`,
 * columna que no existe en Cloud, y los estados consultados (`OPEN|ABIERTO|IN_PROGRESS`)
 * tampoco son los reales (`Abierto|En investigación|Cerrado|Resuelto`). El `count ?? 0`
 * se tragaba el error, así que el KPI era un 0 falso permanente que ningún test veía.
 */

/** Recuento medido, o `null` si la consulta falló (no medido). */
export type Measured = number | null;

export type ModuleStatus = {
  secretaria: {
    convocatoriasEmitidas: Measured;
    acuerdosPendientes: Measured;
  };
  grc: {
    incidentesAbiertos: Measured;
    incidentesMayoresAbiertos: Measured;
    notificacionesUrgentes: Measured;
  };
  aiGovernance: {
    altosNoAprobados: Measured;
    incidentesAbiertos: Measured;
  };
  sii: {
    casosAbiertos: Measured;
  };
};

/**
 * Vocabulario real de `incidents.status` en Cloud, partido en abierto y cerrado.
 *
 * `Resuelto` NO es abierto: un incidente resuelto ya no está en curso. La primera
 * versión de este read model solo excluía `Cerrado` con un `.neq()`, así que
 * contaba los resueltos como abiertos y sobreestimaba el KPI (ARGA tiene un
 * incidente por estado: decía 3 donde son 2). Lo cazó la review adversarial.
 *
 * Se usa una lista POSITIVA de abiertos en vez de `.neq()` por dos motivos: un
 * `.neq()` en PostgREST descarta también las filas con `status IS NULL` (lógica
 * trivaluada), y la columna es nullable; y una lista positiva no se rompe en
 * silencio cuando aparece un estado nuevo — lo deja fuera de «abierto», que es
 * lo conservador.
 *
 * Ambas listas se exportan porque `src/test/schema/console-read-model.test.ts`
 * comprueba contra Cloud que su UNIÓN es exactamente el conjunto de estados que
 * existen. Si aparece uno nuevo, el gate rompe en vez de clasificarlo a ciegas.
 */
export const INCIDENT_OPEN_STATUSES = ["Abierto", "En investigación"];
export const INCIDENT_CLOSED_STATUSES = ["Cerrado", "Resuelto"];

/**
 * Estados de `ai_risk_assessments` que valen como evaluación resuelta.
 * El write path del producto persiste CONFORME (src/lib/aims/evaluacion-payload.ts);
 * el dato legacy de Cloud usa APROBADO. El contrato de lectura tolera ambos.
 */
export const AI_ASSESSMENT_RESOLVED = ["APROBADO", "CONFORME"];

export type CountResult = { count: number | null; error: unknown };

/**
 * `null` si la consulta falló; el recuento medido en otro caso.
 * Este es exactamente el punto donde vivía el defecto: `count ?? 0` convertía
 * un error de PostgREST en un 0 que parecía una medición.
 */
export function measured(res: CountResult): Measured {
  return res.error ? null : (res.count ?? 0);
}

export function useModuleStatus() {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["module_status", tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<ModuleStatus> => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const h72 = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

      const [
        convRes,
        acuerdosRes,
        incidentesRes,
        incidentesMayoresRes,
        notifRes,
        aiSystemsRes,
        aiAssessResolvedRes,
        aiIncRes,
        siiRes,
      ] = await Promise.all([
        // Secretaría: convocatorias EMITIDAS este mes
        // OJO: la columna real es `estado`, no `status`.
        supabase
          .from("convocatorias")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId!)
          .eq("estado", "EMITIDA")
          .gte("created_at", startOfMonth),

        // Secretaría: acuerdos pendientes de inscripción
        // Solo inscribibles en estados pre-registrales (no cuenta PUBLISHED/REGISTERED ni DRAFT/PROPOSED)
        supabase
          .from("agreements")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId!)
          .eq("inscribable", true)
          .in("status", ["ADOPTED", "CERTIFIED", "INSTRUMENTED", "FILED", "REJECTED_REGISTRY"]),

        // GRC: incidentes abiertos (cualquier régimen).
        // No se filtra por régimen: `incidents` no tiene columna de módulo en Cloud.
        supabase
          .from("incidents")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId!)
          .in("status", INCIDENT_OPEN_STATUSES),

        // GRC: de esos, los que el owner marcó como incidente mayor
        supabase
          .from("incidents")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId!)
          .in("status", INCIDENT_OPEN_STATUSES)
          .eq("is_major_incident", true),

        // GRC: notificaciones regulatorias con deadline < 72h
        supabase
          .from("regulatory_notifications")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId!)
          .lte("notification_deadline", h72)
          .gt("notification_deadline", now.toISOString()),

        // AI: sistemas con riesgo Alto
        supabase
          .from("ai_systems")
          .select("id")
          .eq("tenant_id", tenantId!)
          .eq("risk_level", "Alto"),

        // AI: evaluaciones resueltas (para filtrar sistemas ya evaluados).
        // `ai_risk_assessments` no tiene tenant_id: el aislamiento lo da la política
        // por join contra ai_systems, y el cruce final se hace en memoria contra
        // los sistemas del tenant, que sí van filtrados.
        supabase
          .from("ai_risk_assessments")
          .select("system_id")
          .in("status", AI_ASSESSMENT_RESOLVED),

        // AI: incidentes abiertos
        supabase
          .from("ai_incidents")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId!)
          .in("status", ["ABIERTO", "EN_INVESTIGACION"]),

        // SII: casos abiertos.
        // sii_cases_view no está en los tipos generados; cast controlado para usar PostgREST.
        (supabase as unknown as { from: (t: string) => {
          select: (c: string, o: { count: "exact"; head: true }) => {
            eq: (col: string, val: string) => {
              neq: (col: string, val: string) => Promise<{ count: number | null; error: { message: string } | null }>;
            };
          };
        } })
          .from("sii_cases_view")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId!)
          .neq("status", "Cerrado"),
      ]);

      // Sin sistemas legibles no se puede afirmar 0 sistemas de alto riesgo sin evaluar.
      const altosNoAprobados: Measured = aiSystemsRes.error || aiAssessResolvedRes.error
        ? null
        : (() => {
            const altoSysIds = new Set((aiSystemsRes.data ?? []).map((s: { id: string }) => s.id));
            const resolvedIds = new Set(
              (aiAssessResolvedRes.data ?? []).map((a: { system_id: string }) => a.system_id),
            );
            return [...altoSysIds].filter((id) => !resolvedIds.has(id)).length;
          })();

      return {
        secretaria: {
          convocatoriasEmitidas: measured(convRes),
          acuerdosPendientes: measured(acuerdosRes),
        },
        grc: {
          incidentesAbiertos: measured(incidentesRes),
          incidentesMayoresAbiertos: measured(incidentesMayoresRes),
          notificacionesUrgentes: measured(notifRes),
        },
        aiGovernance: {
          altosNoAprobados,
          incidentesAbiertos: measured(aiIncRes),
        },
        sii: {
          casosAbiertos: measured(siiRes),
        },
      };
    },
    staleTime: 60_000,
  });
}
