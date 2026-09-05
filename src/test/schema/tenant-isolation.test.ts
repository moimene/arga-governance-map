// src/test/schema/tenant-isolation.test.ts
// G0 gate de salida: aislamiento RLS bidireccional ARGA ⇄ Garrigues.
// Primera vez que governance_OS opera con 2 tenants activos reales.
// GOTCHA documentado (Oleada 3A): un write cross-tenant filtrado por RLS
// devuelve 0 filas SIN error — se asierta "no mutó", no "dio 42501".
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  DEMO_TENANT,
  DEMO_ENTITY_ARGA,
  GARRIGUES_TENANT,
  GARRIGUES_DEMO_EMAIL,
  sesionDe,
} from "../helpers/supabase-test-client";
import { AISLAMIENTO_DECLARADO } from "../garrigues/aislamiento-declarado";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || "https://hzqwefkwsxopwrmtksbg.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cXdlZmt3c3hvcHdybXRrc2JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Mjc1MDMsImV4cCI6MjA5MjAwMzUwM30.IZ2FbhQLp2ljRcsvsvzpLWQ9cq9p5Lz4dJfVzY3whjQ";
const ARGA_EMAIL = process.env.DEMO_EMAIL || "demo@arga-seguros.com";

// Tablas de dominio representativas de cada superficie (Secretaría, motor,
// plantillas, expedientes, sistema normativo GRC, riesgos penales, hallazgos).
// Todas tienen tenant_id NOT NULL. G5 Task 9: añadidas risks y findings.
const DOMAIN_TABLES = [
  "entities", "document_templates", "rule_packs", "agreements",
  "policies", "obligations", "controls", "risks", "findings",
];

function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
}

describe("G0 — aislamiento RLS bidireccional ARGA ⇄ Garrigues", () => {
  let arga: SupabaseClient | null = null;
  let garr: SupabaseClient | null = null;
  let authed = false;

  beforeAll(async () => {
    // Sesión COMPARTIDA y memoizada: la suite entera hace 2 logins en vez de
    // ~40. `sesionDe` LANZA si no puede autenticar, así que el gate se pone
    // rojo en vez de saltarse en silencio.
    [arga, garr] = await Promise.all([sesionDe("ARGA"), sesionDe("GARRIGUES")]);
    authed = true;
  }, 30_000);

  // SIN afterAll con signOut: la sesión es COMPARTIDA. Cerrarla aquí dejaría
  // sin autenticar a todas las sondas que corran después de esta.

  it("el perfil del usuario Garrigues resuelve a su tenant", async () => {
    if (!authed || !garr) { expect(true).toBe(true); return; }
    const { data, error } = await garr
      .from("user_profiles").select("tenant_id, role_code").maybeSingle();
    expect(error).toBeNull();
    expect(data?.tenant_id).toBe(GARRIGUES_TENANT);
    expect(data?.role_code).toBe("SECRETARIO");
  });

  // Las dos direcciones NO tienen la misma fuerza, y el gate no finge que sí:
  //  - "Garrigues no ve filas ARGA": aserción real en las 7 tablas, porque
  //    ARGA tiene filas en todas. Es además la dirección de riesgo real (el
  //    dato histórico y sensible es el de ARGA).
  //  - "ARGA no ve filas Garrigues": vacua en las tablas donde Garrigues aún
  //    no tiene dato propio — al 2026-08-16, `document_templates` (0 filas) y
  //    `agreements` (0 filas). Ahí se comprueba que ARGA no ve algo que no
  //    existe.
  // NO se siembran filas falsas para cerrar ese hueco: un gate honesto y más
  // débil vale más que uno fuerte de mentira. En vez de eso, cada iteración
  // pregunta a Garrigues si tiene dato propio y DECLARA la vacuidad en la
  // salida del runner, de modo que el aviso desaparece solo el día que la
  // tabla se siembre (el comentario no se queda desfasado).
  // El bucle genera 14 tests (7 tablas × 2 direcciones), más los 5 fijos = 19.
  for (const table of DOMAIN_TABLES) {
    it(`Garrigues no ve filas ARGA en ${table}`, async () => {
      if (!authed || !garr) { expect(true).toBe(true); return; }
      const { data, error } = await garr.from(table).select("tenant_id").limit(500);
      expect(error).toBeNull();
      const foreign = (data ?? []).filter((r) => r.tenant_id !== GARRIGUES_TENANT);
      expect(foreign).toEqual([]);
    });

    it(`ARGA no ve filas Garrigues en ${table}`, async () => {
      if (!authed || !arga || !garr) { expect(true).toBe(true); return; }
      const { data, error } = await arga.from(table).select("tenant_id").limit(500);
      expect(error).toBeNull();
      const foreign = (data ?? []).filter((r) => r.tenant_id === GARRIGUES_TENANT);
      expect(foreign).toEqual([]);

      // La aserción de arriba es VACUA si Garrigues no tiene filas en la tabla:
      // filtrar un conjunto vacío da vacío y pasa sin probar aislamiento. Esto
      // se venía señalando con un `console.warn`, que es la forma más educada
      // de un gate que no lo es — nadie lee los warns de una suite verde.
      //
      // Ahora ROMPE, salvo que la ausencia esté DECLARADA con su motivo y su
      // fuente en `aislamiento-declarado.ts`. No se silencia la vacuidad: se le
      // pone dueño. Y si una tabla declarada como vacía deja de estarlo, el
      // test de esa declaración también rompe.
      const own = await garr.from(table).select("tenant_id").limit(1);
      expect(own.error, `${table}: la sonda de vacuidad no pudo consultar`).toBeNull();
      if ((own.data ?? []).length === 0) {
        const declarada = AISLAMIENTO_DECLARADO.find((t) => t.tabla === table);
        expect(
          declarada?.garrigues,
          `${table}: dirección VACUA sin declarar. Garrigues no tiene filas, así que esta ` +
            "aserción no prueba aislamiento. Decláralo en aislamiento-declarado.ts con su " +
            "motivo y su fuente, o averigua por qué falta el dato.",
        ).toBe("NINGUNA");
      }
    });
  }

  it("ARGA sí ve su propio dato (la sonda no pasa por lista vacía global)", async () => {
    if (!authed || !arga) { expect(true).toBe(true); return; }
    const { data, error } = await arga
      .from("entities").select("id, tenant_id").limit(500);
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
    expect((data ?? []).every((r) => r.tenant_id === DEMO_TENANT)).toBe(true);
  });

  it("write cross-tenant: Garrigues no muta una entity ARGA (0 filas, sin error)", async () => {
    if (!authed || !arga || !garr) { expect(true).toBe(true); return; }
    const before = await arga
      .from("entities").select("common_name").eq("id", DEMO_ENTITY_ARGA).maybeSingle();
    expect(before.error).toBeNull();

    const attempt = await garr
      .from("entities")
      .update({ common_name: "PROBE-DENY-G0" })
      .eq("id", DEMO_ENTITY_ARGA)
      .select();
    // GOTCHA: RLS filtra → 0 filas afectadas, SIN 42501.
    expect(attempt.error).toBeNull();
    expect(attempt.data ?? []).toEqual([]);

    const after = await arga
      .from("entities").select("common_name").eq("id", DEMO_ENTITY_ARGA).maybeSingle();
    expect(after.error).toBeNull();
    expect(after.data?.common_name).toBe(before.data?.common_name);
  });

  it("write cross-tenant: Garrigues no muta el tenant ARGA (branding, 0 filas, sin error)", async () => {
    if (!authed || !arga || !garr) { expect(true).toBe(true); return; }
    const before = await arga
      .from("tenants").select("branding").eq("id", DEMO_TENANT).maybeSingle();
    expect(before.error).toBeNull();

    const attempt = await garr
      .from("tenants")
      .update({ branding: { nombre: "PROBE-DENY-TENANTS-G0" } })
      .eq("id", DEMO_TENANT)
      .select();
    // GOTCHA: RLS filtra → 0 filas afectadas, SIN 42501 (misma semántica que entities).
    expect(attempt.error).toBeNull();
    expect(attempt.data ?? []).toEqual([]);

    const after = await arga
      .from("tenants").select("branding").eq("id", DEMO_TENANT).maybeSingle();
    expect(after.error).toBeNull();
    expect(after.data?.branding?.nombre).toBe(before.data?.branding?.nombre);
    expect(after.data?.branding?.nombre).not.toBe("PROBE-DENY-TENANTS-G0");
  });

  it("excepción documentada: tenants es lectura pública (branding no es secreto)", async () => {
    if (!authed || !garr) { expect(true).toBe(true); return; }
    const { data, error } = await garr.from("tenants").select("id").limit(50);
    expect(error).toBeNull();
    const ids = (data ?? []).map((r) => r.id);
    expect(ids).toContain(DEMO_TENANT);
    expect(ids).toContain(GARRIGUES_TENANT);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// C3 Tarea 8 — ampliación ADITIVA: `conflicts_of_interest` y `action_plans`.
//
// Va en describe propio para no tocar una sola aserción de G0/G4, y usa la
// declaración de `aislamiento-declarado.ts` en vez de repetir literales.
//
// Cada afirmación de ausencia lleva el control positivo DEL CLIENTE QUE LA
// HACE. Un control positivo en el otro cliente no vale: si la sesión de ARGA
// estuviera caída, «ARGA no ve lo de Garrigues» pasaría por ceguera y no por
// aislamiento, y un gate de aislamiento no puede permitirse esa confusión.
describe("C3 — aislamiento en conflicts_of_interest y action_plans", () => {
  let arga: SupabaseClient;
  let garr: SupabaseClient;

  beforeAll(async () => {
    // Sin graceful-skip: `sesionDe` lanza y el gate se pone rojo. Una sonda
    // que se autodesactiva cuando no puede autenticar es un verde que no
    // asierta nada.
    [arga, garr] = await Promise.all([sesionDe("ARGA"), sesionDe("GARRIGUES")]);
  }, 30_000);

  const NUEVAS = AISLAMIENTO_DECLARADO.filter(
    (t) => t.tabla === "conflicts_of_interest" || t.tabla === "action_plans",
  );

  it("las dos tablas nuevas están declaradas", () => {
    // Si alguien renombra una tabla en la declaración, el bucle de abajo se
    // quedaría vacío y sus tests desaparecerían sin que nadie lo note.
    expect(NUEVAS.map((t) => t.tabla).sort()).toEqual(["action_plans", "conflicts_of_interest"]);
  });

  for (const decl of NUEVAS) {
    it(`Garrigues no ve filas ARGA en ${decl.tabla}`, async () => {
      const { data, error } = await garr.from(decl.tabla).select("tenant_id").limit(500);
      expect(error).toBeNull();

      // Control positivo del cliente de GARRIGUES, que es el que afirma.
      // Cuando la tabla está declarada vacía para él, el control se hace
      // contra la tabla donde SÍ está su dato.
      if (decl.garrigues === "ALGUNA") {
        expect(data.length, `${decl.tabla}: Garrigues no ve ni lo suyo`).toBeGreaterThan(0);
      } else {
        const alt = decl.alternativa;
        const sonda = alt
          ? await garr.from(alt.tabla).select("id").eq("tenant_id", GARRIGUES_TENANT).limit(1)
          : await garr.from("entities").select("id").eq("tenant_id", GARRIGUES_TENANT).limit(1);
        expect(sonda.data.length, `${decl.tabla}: la sesión de Garrigues no ve nada`)
          .toBeGreaterThan(0);
      }

      expect(data.filter((r) => r.tenant_id !== GARRIGUES_TENANT)).toEqual([]);
    });

    it(`ARGA no ve filas Garrigues en ${decl.tabla}`, async () => {
      const { data, error } = await arga.from(decl.tabla).select("tenant_id").limit(500);
      expect(error).toBeNull();

      // Control positivo del cliente de ARGA, que es el que afirma aquí.
      expect(data.length, `${decl.tabla}: ARGA no ve ni lo suyo`).toBeGreaterThan(0);
      expect(data.every((r) => r.tenant_id === DEMO_TENANT)).toBe(true);

      expect(data.filter((r) => r.tenant_id === GARRIGUES_TENANT)).toEqual([]);
    });
  }

  it("y los marcadores de Garrigues no cruzan, por código concreto", async () => {
    // La invariante escrita A MANO. No se comparan dos conjuntos traídos con la
    // misma consulta —eso probaría que la consulta es determinista—: se pinan
    // códigos que solo pueden existir en un tenant.
    const conflictos = NUEVAS.find((t) => t.tabla === "conflicts_of_interest")!;
    const codigos = conflictos.marcadores.garrigues ?? [];
    expect(codigos.length).toBeGreaterThan(0);

    const { data: propios } = await garr.from("conflicts_of_interest")
      .select("code").eq("tenant_id", GARRIGUES_TENANT).in("code", [...codigos]);
    expect(propios).toHaveLength(codigos.length);

    // Control positivo del cliente de ARGA antes de afirmar que no los ve.
    const { data: suyos } = await arga.from("conflicts_of_interest")
      .select("code").eq("tenant_id", DEMO_TENANT).limit(1);
    expect(suyos.length, "ARGA no ve ni sus propios conflictos").toBeGreaterThan(0);

    const { data: ajenos, error } = await arga.from("conflicts_of_interest")
      .select("code").in("code", [...codigos]);
    expect(error).toBeNull();
    expect(ajenos).toEqual([]);
  });
});
