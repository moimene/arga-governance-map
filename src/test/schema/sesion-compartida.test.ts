// src/test/schema/sesion-compartida.test.ts
// T0 del carril C3 — la sesión compartida no puede cruzar identidades.
//
// El modo de fallo que este fichero existe para impedir NO da error: dos
// clientes de Supabase comparten `storageKey` por defecto, el preload monta
// JSDOM con `localStorage`, y **el último login pisa al anterior en silencio**.
// El cliente "de ARGA" acaba autenticado como Garrigues, las aserciones de
// aislamiento cross-tenant pasan de forma vacua, y sería el verificador del
// aislamiento el que habría dejado de verificar. Sin este test no se ve.
import { describe, expect, it, beforeAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sesionDe, DEMO_TENANT, GARRIGUES_TENANT } from "../helpers/supabase-test-client";

describe("T0 — sesión compartida por cuenta", () => {
  let arga: SupabaseClient;
  let garr: SupabaseClient;

  beforeAll(async () => {
    // Si esto lanza, el gate se pone ROJO, que es lo correcto: una sonda que no
    // puede autenticar no puede afirmar nada.
    [arga, garr] = await Promise.all([sesionDe("ARGA"), sesionDe("GARRIGUES")]);
  });

  it("cada cuenta está autenticada como quien dice ser", async () => {
    const { data: a } = await arga.auth.getUser();
    const { data: g } = await garr.auth.getUser();
    expect(a.user?.email).toBe("demo@arga-seguros.com");
    expect(g.user?.email).toBe("demo@garrigues-demo.dev");
  });

  it("LOS DOS CLIENTES NO COMPARTEN IDENTIDAD", async () => {
    // La aserción central. Si el `storageKey` vuelve a ser común, los dos
    // `getUser()` devuelven el mismo email y esto falla — que es la única
    // manera de enterarse, porque el choque no lanza.
    const { data: a } = await arga.auth.getUser();
    const { data: g } = await garr.auth.getUser();
    expect(a.user?.email).not.toBe(g.user?.email);
    expect(a.user?.id).not.toBe(g.user?.id);
  });

  it("y cada una ve su propio tenant, no el del otro", async () => {
    // Comprobación de arista: que la identidad sea distinta no basta si la
    // sesión no arrastra el tenant correcto a las consultas.
    const { data: rArga } = await arga.from("entities").select("tenant_id").limit(50);
    const { data: rGarr } = await garr.from("entities").select("tenant_id").limit(50);
    const tenantsArga = new Set((rArga ?? []).map((r) => r.tenant_id));
    const tenantsGarr = new Set((rGarr ?? []).map((r) => r.tenant_id));

    expect(tenantsArga.size).toBeGreaterThan(0);
    expect(tenantsGarr.size).toBeGreaterThan(0);
    expect([...tenantsArga]).toEqual([DEMO_TENANT]);
    expect([...tenantsGarr]).toEqual([GARRIGUES_TENANT]);
  });

  it("la memoización devuelve el MISMO cliente y no reabre sesión", async () => {
    // Es lo que hace que la corrida entera cueste 2 logins en vez de ~40.
    expect(await sesionDe("ARGA")).toBe(arga);
    expect(await sesionDe("GARRIGUES")).toBe(garr);
  });
});
