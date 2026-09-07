// src/test/schema/aims-evidence-tenant-isolation.test.ts
//
// El bucket de evidencias del autodiagnóstico, medido por COMPORTAMIENTO.
//
// POR QUÉ NO BASTA CON DECLARARLO
// -------------------------------
// `matter-documents` tenía tres políticas que discriminaban por `bucket_id` y
// no por tenant, así que cualquier sesión autenticada leía los justificantes
// registrales de cualquier tenant. Fue el único P0 unánime del informe del
// 2026-09-02 y estuvo abierto meses. La lección: la forma de la política se
// lee en un `pg_policies` y se puede leer mal — lo que prueba el aislamiento es
// intentar cruzarlo.
//
// `aims-evidence` nace con el primer segmento de la ruta = tenant, comprobado
// por la política. Aquí se intenta escribir en el prefijo AJENO desde los dos
// lados.
//
// RESIDUO ACOTADO, A PROPÓSITO
// ----------------------------
// El control positivo sube UN objeto a su propio prefijo, con nombre fijo. El
// bucket no tiene política de UPDATE ni de DELETE —una evidencia registrada no
// se pisa ni se borra desde la aplicación—, así que la segunda corrida recibe
// un 409 «ya existe», que también es prueba de que la ruta es escribible por su
// dueño y NO es un rechazo de permisos. El residuo queda en un objeto.
//
// GOTCHA del repo: cada cuenta necesita su propio `storageKey`, porque el
// preload monta JSDOM con localStorage y dos clientes comparten clave por
// defecto — el último login pisaría al anterior y el aislamiento se
// «verificaría» con la misma sesión dos veces. `sesionDe` ya lo hace.
import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEMO_TENANT, GARRIGUES_TENANT, sesionDe } from "../helpers/supabase-test-client";

const BUCKET = "aims-evidence";
const CUERPO = new TextEncoder().encode("sonda de aislamiento");

/** Un 409 es «ya existe»; un 403/400 de RLS es «no puedes». No son lo mismo. */
function esYaExiste(error: { message?: string; statusCode?: string } | null): boolean {
  const m = `${error?.message ?? ""} ${error?.statusCode ?? ""}`;
  return /409|already exists|duplicate|resource already/i.test(m);
}

describe("aims-evidence — el bucket de evidencias aísla por el primer segmento de la ruta", () => {
  let arga: SupabaseClient;
  let garr: SupabaseClient;

  beforeAll(async () => {
    // Sin graceful-skip: `sesionDe` lanza y el gate se pone rojo. Una sonda que
    // se autodesactiva cuando no puede autenticar es un verde que no asierta.
    [arga, garr] = await Promise.all([sesionDe("ARGA"), sesionDe("GARRIGUES")]);
  }, 30_000);

  it("CONTROL POSITIVO: cada tenant puede escribir bajo su propio prefijo", async () => {
    // Sin esto, los dos tests de abajo pasarían con un bucket inexistente o con
    // una política que lo niega todo: «no puede cruzar» significaría «no puede
    // nada».
    for (const [quien, cliente, tenant] of [
      ["Garrigues", garr, GARRIGUES_TENANT],
      ["ARGA", arga, DEMO_TENANT],
    ] as const) {
      const { error } = await cliente.storage
        .from(BUCKET)
        .upload(`${tenant}/__sonda__/aislamiento.txt`, CUERPO, { contentType: "text/plain" });
      const ok = !error || esYaExiste(error as { message?: string });
      expect(ok, `${quien} no puede escribir en su propio prefijo: ${error?.message}`).toBe(true);
    }
  }, 30_000);

  it("Garrigues NO puede escribir bajo el prefijo de ARGA", async () => {
    const { error } = await garr.storage
      .from(BUCKET)
      .upload(`${DEMO_TENANT}/__forjado__/${crypto.randomUUID()}.txt`, CUERPO);
    expect(error, "la escritura cross-tenant se aceptó").not.toBeNull();
    expect(esYaExiste(error as { message?: string }), "rechazada por colisión, no por permisos").toBe(false);
  }, 30_000);

  it("ARGA NO puede escribir bajo el prefijo de Garrigues", async () => {
    const { error } = await arga.storage
      .from(BUCKET)
      .upload(`${GARRIGUES_TENANT}/__forjado__/${crypto.randomUUID()}.txt`, CUERPO);
    expect(error, "la escritura cross-tenant se aceptó").not.toBeNull();
    expect(esYaExiste(error as { message?: string }), "rechazada por colisión, no por permisos").toBe(false);
  }, 30_000);

  it("nadie firma una URL sobre el objeto del otro tenant", async () => {
    // El objeto del control positivo EXISTE, así que un fallo aquí sólo puede
    // venir de la política: es la dirección de riesgo real, leer lo ajeno.
    const { data, error } = await arga.storage
      .from(BUCKET)
      .createSignedUrl(`${GARRIGUES_TENANT}/__sonda__/aislamiento.txt`, 60);
    expect(data?.signedUrl ?? null, "ARGA ha firmado una URL sobre una evidencia de Garrigues").toBeNull();
    expect(error).not.toBeNull();
  }, 30_000);

  it("el borrado desde la aplicación no está concedido", async () => {
    // Sin política ni grant de DELETE, mismo criterio que el canal SII: un
    // expediente probatorio no se retira desde la consola; se DESVINCULA de la
    // medida, que es otra cosa y sí está soportada.
    //
    // Esta sonda cazó que `authenticated` había heredado DELETE **y TRUNCATE**
    // del `ALTER DEFAULT PRIVILEGES` del esquema, porque un `grant` es aditivo
    // y no quita nada. El DELETE lo filtraba la RLS; TRUNCATE **no pasa por
    // RLS** y habría vaciado la tabla de todos los tenants de una sentencia.
    // Se retiraron en `20260907200000`.
    const { error } = await garr.from("aims_evidence_items").delete().neq("id", crypto.randomUUID());
    expect(error, "el borrado ya no da error: ¿ha vuelto el privilegio?").not.toBeNull();
    expect(`${error?.message} ${(error as { code?: string })?.code ?? ""}`).toMatch(/permission|denied|42501/i);
  }, 30_000);

  it("la tabla de evidencias sólo devuelve filas del tenant de la sesión", async () => {
    for (const [quien, cliente, propio, ajeno] of [
      ["Garrigues", garr, GARRIGUES_TENANT, DEMO_TENANT],
      ["ARGA", arga, DEMO_TENANT, GARRIGUES_TENANT],
    ] as const) {
      const { data, error } = await cliente
        .from("aims_evidence_items")
        .select("id, tenant_id")
        .eq("tenant_id", ajeno);
      expect(error, `${quien}: ${error?.message}`).toBeNull();
      expect(data ?? [], `${quien} ve evidencias del otro tenant`).toHaveLength(0);
      // Y la consulta sin filtro tampoco trae nada ajeno.
      const { data: todo } = await cliente.from("aims_evidence_items").select("tenant_id");
      expect(
        (todo ?? []).every((r) => r.tenant_id === propio),
        `${quien} ve filas de otro tenant al consultar sin filtro`,
      ).toBe(true);
    }
  }, 30_000);
});
