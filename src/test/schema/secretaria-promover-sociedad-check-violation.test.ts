import { describe, it, expect } from "vitest";
import { supabaseAdmin, hasAdminClient } from "../helpers/supabase-test-client";

// MOI-219 — La sonda `secretaria-promover-sociedad-live.test.ts` solo ejercita
// el camino `already_operativa: true` y el `no_data_found`: sus dos entidades
// reales ya están OPERATIVA, así que nunca llegan a la ramificación nueva por
// `forma_administracion` (el `check_violation` cuando faltan cargos). Este
// fichero es la prueba NEGATIVA real que exige el issue.
//
// Regla dura: esta sonda NUNCA promueve (escribe) una sociedad para forzar el
// escenario. Comprueba PRIMERO, en solo lectura, si existe hoy una entidad
// real que ya esté INCOMPLETA_CARGOS y con menos cargos vigentes de los que
// exige su forma de administración no colegiada. Si no existe ninguna —que es
// el estado real de governance_OS a 26-09-2026, ver
// `supabase/tests/moi219_promover_sociedad_check_violation_probe.sql` para el
// ensayo revertido (BEGIN...ROLLBACK) que el orquestador puede ejecutar en su
// lugar—, la prueba se SALTA explícitamente (no pasa en verde sin haber
// comprobado nada).
const RAMAS: Record<string, { tipos: string[]; minimo: number }> = {
  ADMINISTRADOR_UNICO: { tipos: ["ADMIN_UNICO", "ADMINISTRADOR_UNICO", "ADMIN_PJ"], minimo: 1 },
  ADMIN_UNICO: { tipos: ["ADMIN_UNICO", "ADMINISTRADOR_UNICO", "ADMIN_PJ"], minimo: 1 },
  ADMINISTRADORES_SOLIDARIOS: { tipos: ["ADMIN_SOLIDARIO", "ADMINISTRADOR_SOLIDARIO", "ADMIN_PJ"], minimo: 2 },
  ADMIN_SOLIDARIO: { tipos: ["ADMIN_SOLIDARIO", "ADMINISTRADOR_SOLIDARIO", "ADMIN_PJ"], minimo: 2 },
  ADMINISTRADORES_MANCOMUNADOS: { tipos: ["ADMIN_MANCOMUNADO", "ADMINISTRADOR_MANCOMUNADO", "ADMIN_PJ"], minimo: 2 },
  ADMIN_MANCOMUNADO: { tipos: ["ADMIN_MANCOMUNADO", "ADMINISTRADOR_MANCOMUNADO", "ADMIN_PJ"], minimo: 2 },
};

describe.skipIf(!hasAdminClient())(
  "MOI-219 — fn_promover_sociedad_operativa rechaza formas no colegiadas sin cargos suficientes",
  () => {
    it("check_violation real: entidad INCOMPLETA_CARGOS sin los cargos vigentes que exige su forma_administracion", async (ctx) => {
      // 1. SOLO LECTURA — buscar una entidad candidata real.
      const { data: entidades, error: readError } = await supabaseAdmin!
        .from("entities")
        .select("id, tenant_id, legal_name, onboarding_status, forma_administracion")
        .eq("onboarding_status", "INCOMPLETA_CARGOS")
        .in("forma_administracion", Object.keys(RAMAS));
      expect(readError).toBeNull();

      let candidato: { id: string; tenant_id: string; forma_administracion: string } | null = null;
      for (const e of entidades ?? []) {
        const rama = RAMAS[e.forma_administracion as string];
        const { count, error: countError } = await supabaseAdmin!
          .from("condiciones_persona")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", e.tenant_id)
          .eq("entity_id", e.id)
          .eq("estado", "VIGENTE")
          .in("tipo_condicion", rama.tipos);
        expect(countError).toBeNull();
        if ((count ?? 0) < rama.minimo) {
          candidato = e as typeof candidato;
          break;
        }
      }

      // 2. Si no hay ninguna entidad así hoy, SALTAR — nunca fabricar el
      // escenario escribiendo sobre una sociedad real.
      ctx.skip(
        !candidato,
        "no existe hoy ninguna entidad INCOMPLETA_CARGOS con forma no colegiada y cargos insuficientes (comprobado en solo lectura); ver supabase/tests/moi219_promover_sociedad_check_violation_probe.sql",
      );
      if (!candidato) return;

      // 3. Ejercitar la ramificación real: debe fallar con check_violation.
      const { data, error } = await supabaseAdmin!.rpc("fn_promover_sociedad_operativa", {
        p_tenant_id: candidato.tenant_id,
        p_entity_id: candidato.id,
      });

      expect(data).toBeNull();
      expect(error).not.toBeNull();
      expect(error?.code).toBe("23514"); // check_violation
      expect(error?.message).toMatch(/requiere al menos|has insufficient/);

      // 4. Nunca debe haber promovido la sociedad.
      const { data: after } = await supabaseAdmin!
        .from("entities")
        .select("onboarding_status")
        .eq("id", candidato.id)
        .single();
      expect(after?.onboarding_status).toBe("INCOMPLETA_CARGOS");
    });
  },
);
