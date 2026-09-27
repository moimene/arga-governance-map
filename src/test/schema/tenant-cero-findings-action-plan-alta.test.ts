// MOI-149 (D-23, por delegación de Moisés: alta POR PANTALLA) — hallazgos y
// planes de acción para el tenant en blanco (`…0003`). Antes de esto,
// `findings`/`action_plans` solo existían sembrados y el grupo nuevo tenía 0
// filas en ambas; la aplicación no tenía ningún camino de escritura.
//
// Esta sonda usa la SESIÓN AUTENTICADA del SECRETARIO de `…0003`
// (`sesionDe("NUEVO")`), no el cliente service-role: es el mismo camino que
// recorren `useCreateFinding`/`useCreateActionPlan` desde la pantalla, así que
// si alguien retira el `tenant_id` explícito del hook, o RLS deja de exigirlo,
// esta sonda lo nota (findings/action_plans no tienen DEFAULT de tenant desde
// 20260906072910: un INSERT sin tenant_id explícito falla por NOT NULL, nunca
// aterriza en silencio en ARGA).
//
// Es idempotente: usa un código fijo y sólo inserta si no existe ya, así que
// puede correr en cada `bun test` sin acumular filas de sonda ni exigir
// limpieza. El resultado que deja persistido ES la primera alta real por
// pantalla del grupo nuevo — el criterio de hecho del issue.
import { describe, it, expect, beforeAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEMO_TENANT, GARRIGUES_TENANT, NUEVO_TENANT, sesionDe } from "../helpers/supabase-test-client";

const FINDING_CODE = "GRPN-ALTA-001";
const ACTION_PLAN_TITLE = "Plan de acción de arranque (alta por pantalla, MOI-149)";

async function countByTenant(cliente: SupabaseClient, tabla: "findings" | "action_plans", tenantId: string) {
  const { count, error } = await cliente.from(tabla).select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);
  if (error) throw error;
  return count ?? 0;
}

describe("MOI-149 — alta por pantalla de hallazgos y planes de acción (grupo nuevo)", () => {
  let nuevo: SupabaseClient;
  let arga: SupabaseClient;
  let garr: SupabaseClient;

  beforeAll(async () => {
    [nuevo, arga, garr] = await Promise.all([sesionDe("NUEVO"), sesionDe("ARGA"), sesionDe("GARRIGUES")]);
  }, 45_000);

  it("un INSERT sin tenant_id explícito no aterriza en ningún tenant (NOT NULL, sin DEFAULT)", async () => {
    // Réplica exacta del trap documentado en el issue: `action_plans.tenant_id`
    // (y `findings.tenant_id`) YA NO tienen `DEFAULT '…0001'` (20260906072910).
    // Si alguien reintrodujese ese default, este INSERT dejaría de fallar y la
    // fila caería en ARGA en silencio: la sonda pasaría a rojo por el
    // recuento de ARGA de la siguiente prueba, no por ésta — así que además
    // se comprueba aquí, directo, que el motor todavía rechaza el hueco.
    // Con `tenant_id` NULL, la propia policy RLS (`tenant_id = fn_current_tenant_id()`)
    // ya rechaza el WITH CHECK antes de llegar al NOT NULL: el código real es
    // 42501 (RLS), no 23502. Cualquiera de las dos deja claro que no aterriza
    // en ningún tenant existente — lo que NO puede pasar es que no dé error.
    const RECHAZOS_ESPERADOS = ["23502", "42501"];
    const { error: errFinding } = await nuevo
      .from("findings")
      .insert({ code: `TEST-SIN-TENANT-${Date.now()}`, title: "Sonda MOI-149 sin tenant" });
    expect(errFinding).not.toBeNull();
    expect(RECHAZOS_ESPERADOS).toContain(errFinding!.code);

    // Con un hallazgo REAL del propio grupo: desde F5.T7 (20260928101000) la
    // guardia de origen rechaza con 23503 un finding_id inexistente ANTES de
    // llegar al tenant, y la sonda dejaría de medir el hueco de tenant_id.
    const { data: hallazgo } = await nuevo
      .from("findings")
      .select("id")
      .eq("tenant_id", NUEVO_TENANT)
      .limit(1)
      .maybeSingle();
    expect(hallazgo?.id, "el grupo nuevo necesita un hallazgo para que la sonda mida algo").toBeTruthy();
    const { error: errPlan } = await nuevo
      .from("action_plans")
      .insert({ finding_id: hallazgo!.id, title: "Sonda MOI-149 sin tenant" });
    expect(errPlan).not.toBeNull();
    expect(RECHAZOS_ESPERADOS).toContain(errPlan!.code);
  });

  it("alta por pantalla: un hallazgo del grupo nuevo, con recuentos de ARGA y Garrigues idénticos antes y después", async () => {
    const before = {
      argaFindings: await countByTenant(arga, "findings", DEMO_TENANT),
      garrFindings: await countByTenant(garr, "findings", GARRIGUES_TENANT),
    };

    // Idempotente: sólo crea la fila si esta corrida es la primera.
    const existente = await nuevo.from("findings").select("id, tenant_id").eq("code", FINDING_CODE).maybeSingle();
    expect(existente.error).toBeNull();
    if (!existente.data) {
      const { error } = await nuevo.from("findings").insert({
        tenant_id: NUEVO_TENANT,
        code: FINDING_CODE,
        title: "Primer hallazgo dado de alta por pantalla en el grupo nuevo",
        severity: "Medio",
        status: "Abierto",
      });
      expect(error).toBeNull();
    }

    const after = {
      argaFindings: await countByTenant(arga, "findings", DEMO_TENANT),
      garrFindings: await countByTenant(garr, "findings", GARRIGUES_TENANT),
    };
    expect(after.argaFindings, "ARGA no debe ganar ni perder hallazgos").toBe(before.argaFindings);
    expect(after.garrFindings, "Garrigues no debe ganar ni perder hallazgos").toBe(before.garrFindings);
  });

  // Ésta es la arista real: la MISMA forma de consulta que usa la pantalla
  // (`useFindingsList`, filtrando por `tenant_id`). Si el hallazgo dejara de
  // llevar el tenant correcto, o la pantalla dejara de filtrar por él, esta
  // prueba cae — no sólo "existe la fila en algún sitio".
  it("la pantalla de Hallazgos (useFindingsList) lee el alta con el tenant correcto", async () => {
    const { data, error } = await nuevo
      .from("findings")
      .select("id, code, title, tenant_id")
      .eq("tenant_id", NUEVO_TENANT)
      .eq("code", FINDING_CODE)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(data!.tenant_id).toBe(NUEVO_TENANT);
  });

  it("ARGA y Garrigues no ven el hallazgo del grupo nuevo (RLS por tenant)", async () => {
    const [a, g] = await Promise.all([
      arga.from("findings").select("id").eq("code", FINDING_CODE),
      garr.from("findings").select("id").eq("code", FINDING_CODE),
    ]);
    expect(a.error).toBeNull();
    expect(g.error).toBeNull();
    expect(a.data ?? []).toEqual([]);
    expect(g.data ?? []).toEqual([]);
  });

  it("alta por pantalla: un plan de acción enlazado al hallazgo, con recuentos de ARGA y Garrigues idénticos antes y después", async () => {
    const finding = await nuevo.from("findings").select("id").eq("tenant_id", NUEVO_TENANT).eq("code", FINDING_CODE).maybeSingle();
    expect(finding.error).toBeNull();
    expect(finding.data?.id, "el hallazgo de la prueba anterior debe existir").toBeTruthy();
    const findingId = finding.data!.id as string;

    const before = {
      argaPlans: await countByTenant(arga, "action_plans", DEMO_TENANT),
      garrPlans: await countByTenant(garr, "action_plans", GARRIGUES_TENANT),
    };

    const existente = await nuevo.from("action_plans").select("id").eq("finding_id", findingId).eq("title", ACTION_PLAN_TITLE).maybeSingle();
    expect(existente.error).toBeNull();
    if (!existente.data) {
      const { error } = await nuevo.from("action_plans").insert({
        tenant_id: NUEVO_TENANT,
        finding_id: findingId,
        title: ACTION_PLAN_TITLE,
        status: "Pendiente",
      });
      expect(error).toBeNull();
    }

    const after = {
      argaPlans: await countByTenant(arga, "action_plans", DEMO_TENANT),
      garrPlans: await countByTenant(garr, "action_plans", GARRIGUES_TENANT),
    };
    expect(after.argaPlans, "ARGA no debe ganar ni perder planes de acción").toBe(before.argaPlans);
    expect(after.garrPlans, "Garrigues no debe ganar ni perder planes de acción").toBe(before.garrPlans);

    // Arista real: la misma forma de consulta que usa la pestaña «Planes de
    // acción» del hallazgo (`useActionPlansByFinding`, filtrando por finding_id).
    const leido = await nuevo.from("action_plans").select("id, title, finding_id").eq("finding_id", findingId).eq("title", ACTION_PLAN_TITLE).maybeSingle();
    expect(leido.error).toBeNull();
    expect(leido.data?.finding_id).toBe(findingId);
  });

  it("Garrigues no ve el plan de acción del grupo nuevo", async () => {
    const { data, error } = await garr.from("action_plans").select("id").eq("title", ACTION_PLAN_TITLE);
    expect(error).toBeNull();
    expect(data ?? []).toEqual([]);
  });
});
