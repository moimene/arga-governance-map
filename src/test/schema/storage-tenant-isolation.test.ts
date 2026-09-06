// src/test/schema/storage-tenant-isolation.test.ts
//
// DA-1 del ledger 2026-09-05: el bucket privado `matter-documents` tenía tres
// políticas de `storage.objects` que discriminaban por `bucket_id` y NO por
// tenant, así que cualquier sesión autenticada leía y escribía los documentos
// registrales de cualquier tenant. Era el único P0 unánime del informe
// 2026-09-02 (3/3 refutadores) y quedó abierto porque cerrarlo exige Cloud.
//
// Esta sonda mide COMPORTAMIENTO, no la forma de la política: con dos logins
// reales intenta la descarga cross-tenant. Antes de la migración
// `matter_documents_tenant_scoped_policies` esta sonda está en ROJO —así se
// midió—, y ese rojo es la prueba de que la exposición era real.
//
// GOTCHA (helper de sesiones): cada cuenta necesita su propio `storageKey`; el
// preload monta JSDOM con localStorage y dos clientes de Supabase comparten
// clave por defecto, con lo que el último login pisa al anterior y el
// aislamiento se «verificaría» con la misma sesión dos veces.
import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEMO_TENANT, GARRIGUES_TENANT, sesionDe } from "../helpers/supabase-test-client";

const BUCKET = "matter-documents";

/**
 * Objeto de ARGA elegido por su ruta, no por una constante inventada: se
 * resuelve desde `secretaria_document_artifacts`, que es quien registra el
 * `storage_path` de las evidencias registrales.
 */
async function rutaDeArga(arga: SupabaseClient): Promise<string> {
  const { data, error } = await arga
    .from("secretaria_document_artifacts")
    .select("tenant_id, metadata")
    .eq("tenant_id", DEMO_TENANT)
    .not("metadata->>storage_path", "is", null)
    .limit(25);
  if (error) throw new Error(`no se pudo resolver una ruta de ARGA: ${error.message}`);
  const rutas = (data ?? [])
    .map((r) => (r.metadata as Record<string, unknown> | null)?.storage_path)
    .filter((p): p is string => typeof p === "string" && p.length > 0);
  if (rutas.length === 0) {
    // Sin objeto de ARGA la aserción cross-tenant pasaría de forma VACUA:
    // se lanza en vez de saltar en verde.
    throw new Error(
      "ARGA no tiene ningún artefacto con storage_path: la sonda de aislamiento sería vacua",
    );
  }
  return rutas[0];
}

describe("matter-documents — aislamiento por tenant (DA-1)", () => {
  let arga: SupabaseClient;
  let garrigues: SupabaseClient;
  let rutaArga: string;

  beforeAll(async () => {
    arga = await sesionDe("ARGA");
    garrigues = await sesionDe("GARRIGUES");
    rutaArga = await rutaDeArga(arga);
  }, 60_000);

  it("control positivo: la sesión de ARGA descarga su propio documento", async () => {
    const { data, error } = await arga.storage.from(BUCKET).download(rutaArga);
    expect(error, `ARGA debe seguir leyendo lo suyo (${rutaArga})`).toBeNull();
    expect(data).not.toBeNull();
    expect((data as Blob).size).toBeGreaterThan(0);
  }, 30_000);

  it("la sesión de Garrigues NO descarga un documento registral de ARGA", async () => {
    const { data, error } = await garrigues.storage.from(BUCKET).download(rutaArga);
    // El fallo debe venir de la política, no de una ruta inexistente: la
    // descarga de ARGA de arriba ya prueba que el objeto existe.
    expect(error, "Garrigues no debe poder leer un objeto de ARGA").not.toBeNull();
    expect(data).toBeNull();
  }, 30_000);

  it("la sesión de Garrigues no ve el objeto de ARGA ni al listar el prefijo", async () => {
    const partes = rutaArga.split("/");
    const prefijo = partes.slice(0, -1).join("/");
    const fichero = partes[partes.length - 1];
    const { data } = await garrigues.storage.from(BUCKET).list(prefijo, { limit: 100 });
    const nombres = (data ?? []).map((o) => o.name);
    expect(nombres).not.toContain(fichero);
  }, 30_000);

  it("ARGA y Garrigues son tenants distintos (control de que la sonda no compara una sesión consigo misma)", async () => {
    const { data: a } = await arga.from("user_profiles").select("tenant_id").limit(1).maybeSingle();
    const { data: g } = await garrigues
      .from("user_profiles")
      .select("tenant_id")
      .limit(1)
      .maybeSingle();
    expect(a?.tenant_id).toBe(DEMO_TENANT);
    expect(g?.tenant_id).toBe(GARRIGUES_TENANT);
  }, 30_000);
});
