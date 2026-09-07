// Sonda Cloud del read model de la consola (contratos console.<owner>.<objeto>.v1).
//
// POR QUÉ EXISTE. Hasta 2026-09-05 el KPI «Incidentes DORA abiertos» de la
// consola filtraba por `incidents.module_id`, una columna que NO existe en
// Cloud, y consultaba estados (`OPEN|ABIERTO|IN_PROGRESS`) que tampoco son los
// reales. El `count ?? 0` del hook se tragaba el error de PostgREST, así que la
// consola llevaba desde su creación pintando un 0 que no era una medición sino
// un fallo silencioso — y ningún test lo veía.
//
// Esta sonda asierta las dos mitades: que la consulta vieja SIGUE fallando (lo
// que prueba que el 0 era falso) y que la nueva NO falla en los dos tenants.
//
// GOTCHA (G4 nº4): con más de un cliente Supabase hay que usar
// `persistSession: false`; el preload de bun monta JSDOM con localStorage y
// todos los clientes comparten storageKey. `sesionDe` ya lo hace y LANZA si no
// puede autenticar, así que un login roto pone la sonda ROJA, no verde.
import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEMO_TENANT,
  GARRIGUES_TENANT,
  sesionDe,
} from "../helpers/supabase-test-client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  AI_ASSESSMENT_RESOLVED,
  INCIDENT_CLOSED_STATUSES,
  INCIDENT_OPEN_STATUSES,
  measured,
} from "@/hooks/useModuleStatus";



describe("console read model — cada número nace de una query que existe", () => {
  let arga: SupabaseClient;
  let garr: SupabaseClient;

  beforeAll(async () => {
    arga = await sesionDe("ARGA");
    garr = await sesionDe("GARRIGUES");
  }, 60_000);

  it("la consulta VIEJA falla: el 0 de «Incidentes DORA abiertos» era un fallo silencioso", async () => {
    const res = await arga
      .from("incidents")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", DEMO_TENANT)
      // Columna inexistente a propósito: es exactamente el defecto que se corrigió.
      .ilike("module_id", "%dora%");

    expect(res.error, "si esto deja de fallar, `incidents` ganó module_id y hay que revisar el contrato").not.toBeNull();
    // Y esta es la línea que explica el defecto: el hook hacía `count ?? 0`.
    expect(res.count ?? 0).toBe(0);
  });

  it("los estados de incidents en Cloud no son el vocabulario que consultaba la consola", async () => {
    const { data, error } = await arga.from("incidents").select("status").eq("tenant_id", DEMO_TENANT);
    expect(error).toBeNull();
    const estados = new Set((data ?? []).map((r: { status: string }) => r.status));
    expect(estados.size).toBeGreaterThan(0);
    for (const viejo of ["OPEN", "ABIERTO", "IN_PROGRESS"]) {
      expect(estados.has(viejo), `'${viejo}' no es un estado real de incidents`).toBe(false);
    }
  });

  it("la consulta NUEVA de incidentes no falla en ninguno de los dos tenants", async () => {
    for (const [nombre, cli, tenant] of [
      ["ARGA", arga, DEMO_TENANT],
      ["GARRIGUES", garr, GARRIGUES_TENANT],
    ] as const) {
      const abiertos = await cli
        .from("incidents")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant)
        .in("status", INCIDENT_OPEN_STATUSES);
      expect(abiertos.error, `incidentes abiertos (${nombre})`).toBeNull();
      expect(abiertos.count).not.toBeNull();

      const mayores = await cli
        .from("incidents")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant)
        .in("status", INCIDENT_OPEN_STATUSES)
        .eq("is_major_incident", true);
      expect(mayores.error, `incidentes mayores (${nombre})`).toBeNull();
      expect(mayores.count! <= abiertos.count!).toBe(true);
    }
  });

  it("las seis consultas del read model responden sin error para ARGA y para Garrigues", async () => {
    const tablas = [
      "convocatorias",
      "agreements",
      "regulatory_notifications",
      "ai_systems",
      "evidence_bundles",
      "governance_module_events",
      "governance_module_links",
    ] as const;

    for (const [nombre, cli, tenant] of [
      ["ARGA", arga, DEMO_TENANT],
      ["GARRIGUES", garr, GARRIGUES_TENANT],
    ] as const) {
      for (const tabla of tablas) {
        const res = await cli
          .from(tabla)
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenant);
        expect(res.error, `${tabla} (${nombre})`).toBeNull();
        expect(res.count, `${tabla} (${nombre}) sin recuento`).not.toBeNull();
      }
    }
  });

  it("Garrigues ve la verdad de Cloud, no un número prestado de ARGA", async () => {
    // DISCRIMINANTE REESCRITO (2026-09-07). El anterior usaba la AUSENCIA de
    // eventos en Garrigues —`count === 0`— como prueba de que el read model no
    // cruza tenants. Eso ataba el gate a que el tenant siguiera vacío: el día
    // que Garrigues tenga su primer evento, el test se pone rojo por haber
    // crecido y la salida fácil es borrar el evento, no arreglar nada.
    //
    // El discriminante que no depende de que un tenant esté vacío es el CRUCE:
    // cada cliente mide lo suyo, y el de Garrigues no alcanza lo de ARGA.
    const eventosArga = await arga
      .from("governance_module_events")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", DEMO_TENANT);
    const eventosGarr = await garr
      .from("governance_module_events")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", GARRIGUES_TENANT);
    const cruzado = await garr
      .from("governance_module_events")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", DEMO_TENANT);

    expect(eventosArga.error).toBeNull();
    expect(eventosGarr.error).toBeNull();
    expect(cruzado.error).toBeNull();
    // Anti-vacuidad: sin eventos en ARGA, el cruce de abajo daría 0 por el
    // motivo equivocado y el control no discriminaría nada.
    expect(eventosArga.count!).toBeGreaterThan(0);
    // Se MIDE: un error de PostgREST no puede volver a pasar por «no hay».
    expect(eventosGarr.count, "el recuento de Garrigues vino a null").not.toBeNull();
    // Y la sesión de Garrigues no alcanza los eventos de ARGA, tenga los suyos
    // o no los tenga todavía.
    expect(cruzado.count).toBe(0);
  });

  it("TODA columna que el hook consulta existe en Cloud (arista, no copia)", async () => {
    // POR QUÉ ASÍ. La primera versión de esta sonda escribía SU PROPIA consulta
    // replicando la del hook: probaba que la consulta escrita aquí funciona, no
    // que la del hook lo haga. Reintroducir `.ilike("module_id", …)` en
    // `useModuleStatus.ts` la dejaba en VERDE — lo demostró la review adversarial
    // mutando el hook. Ahora se leen las columnas que el hook filtra de verdad y
    // se comprueba una a una contra el catálogo de Cloud.
    const fuente = readFileSync(
      resolve(process.cwd(), "src/hooks/useModuleStatus.ts"),
      "utf8",
    );

    // `.from("tabla")` … `.eq("col"` / `.in("col"` / `.neq("col"` / `.gte("col"` …
    const pares: Array<{ tabla: string; columna: string }> = [];
    let tablaActual: string | null = null;
    for (const linea of fuente.split("\n")) {
      const from = linea.match(/\.from\(\s*"([a-z_]+)"/);
      if (from) tablaActual = from[1];
      const filtro = linea.match(/\.(?:eq|neq|in|gte|lte|gt|lt|ilike|like)\(\s*"([a-z_]+)"/);
      if (filtro && tablaActual) pares.push({ tabla: tablaActual, columna: filtro[1] });
    }

    // Control positivo: si el parseo deja de encontrar filtros, esto no puede
    // quedarse en verde por lista vacía.
    expect(pares.length, "no se encontró ningún filtro en useModuleStatus.ts").toBeGreaterThan(8);
    expect(pares.some((p) => p.tabla === "incidents")).toBe(true);

    // `information_schema` no es legible por PostgREST, así que cada columna se
    // pide a su tabla real. Lo que NO puede ocurrir es que la columna no exista
    // (`42703` / `PGRST204`). Un `42501` es otra cosa —la columna está, falta el
    // permiso— y el read model ya lo trata como «no medido», así que se registra
    // como postura en vez de confundirlo con un error de esquema.
    const sinPermiso: string[] = [];
    for (const { tabla, columna } of pares) {
      const res = await arga
        .from(tabla as "evidence_bundles")
        .select(columna)
        .limit(1);
      const code = (res.error as { code?: string } | null)?.code;
      if (code === "42501") {
        sinPermiso.push(`${tabla}.${columna}`);
        continue;
      }
      expect(
        res.error,
        `useModuleStatus filtra ${tabla}.${columna}, que Cloud no tiene`,
      ).toBeNull();
    }

    // Postura medida, no supuesta: `sii_cases_view` cuelga de `sii.cases`, que
    // no concede SELECT a `authenticated` (42501 «permission denied for table
    // cases», medido 2026-09-05). El informe de revisión lo daba por «no
    // verificado»; queda verificado, y por eso la tarjeta del SII se pinta «no
    // medido» y nunca 0. Si algún día se concede el permiso, esto rompe y hay
    // que revisar la postura de esa tarjeta.
    expect(sinPermiso.sort()).toEqual(["sii_cases_view.status", "sii_cases_view.tenant_id"]);
  }, 60_000);

  it("el vocabulario de estados del hook es EXACTAMENTE el de Cloud", async () => {
    // Si aparece un estado nuevo, no se clasifica a ciegas: rompe. Y `Resuelto`
    // tiene que estar en el lado cerrado — contarlo como abierto sobreestimaba
    // el KPI (ARGA tiene un incidente por estado: decía 3 donde son 2).
    const inc = await arga.from("incidents").select("status").eq("tenant_id", DEMO_TENANT);
    expect(inc.error).toBeNull();
    const enCloud = new Set((inc.data ?? []).map((r: { status: string }) => r.status));
    expect(enCloud.size, "sin estados que comparar").toBeGreaterThan(0);

    const declarados = new Set([...INCIDENT_OPEN_STATUSES, ...INCIDENT_CLOSED_STATUSES]);
    for (const estado of enCloud) {
      expect(
        declarados.has(estado),
        `'${estado}' existe en Cloud y el hook no lo clasifica ni como abierto ni como cerrado`,
      ).toBe(true);
    }
    expect(INCIDENT_CLOSED_STATUSES).toContain("Resuelto");
    expect(INCIDENT_OPEN_STATUSES).not.toContain("Resuelto");

    const ass = await arga.from("ai_risk_assessments").select("status");
    expect(ass.error).toBeNull();
    const estadosEval = new Set((ass.data ?? []).map((r: { status: string }) => r.status));
    expect(
      AI_ASSESSMENT_RESOLVED.some((v) => estadosEval.has(v)),
      `ninguno de ${AI_ASSESSMENT_RESOLVED.join("|")} existe en ai_risk_assessments`,
    ).toBe(true);
  });

  it("measured() propaga el error como «no medido» y no como 0", () => {
    // La línea exacta del defecto histórico.
    expect(measured({ count: null, error: { message: "column does not exist" } })).toBeNull();
    expect(measured({ count: null, error: null })).toBe(0);
    expect(measured({ count: 7, error: null })).toBe(7);
  });

  it("deja escrita la postura REAL de sii_cases_view en vez de suponerla", async () => {
    // El informe daba por hecho un 42501 que role_table_grants no respalda.
    // Aquí se mide de verdad: lo que salga es lo que la consola debe pintar.
    const res = await garr
      .from("sii_cases_view" as "evidence_bundles")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", GARRIGUES_TENANT);

    // Antes esto aceptaba LAS DOS ramas (con error, `count` es null; sin error,
    // 0), así que no podía fallar: documentaba en vez de gatear. Postura MEDIDA
    // el 2026-09-07 con la sesión de Garrigues: 403 y `count` null. Si algún
    // día se concede el permiso, esto rompe y hay que revisar esa tarjeta.
    expect(
      res.status,
      "sii_cases_view dejó de denegar a Garrigues: la tarjeta del SII ya puede medirse",
    ).toBe(403);
    expect(res.count ?? null, "denegado exige «no medido», jamás 0").toBeNull();

    // Y el porqué, que el HEAD no puede dar: una petición `head:true` viaja sin
    // cuerpo, así que supabase-js devuelve `{ message: "" }` SIN `code`. El
    // código real solo se ve pidiendo filas. Es justo la forma del defecto
    // histórico: un `count ?? 0` sobre un error mudo pinta un 0 que nadie midió.
    const conCuerpo = await garr.from("sii_cases_view" as "evidence_bundles").select("id").limit(1);
    expect((res.error as { code?: string } | null)?.code, "el HEAD no trae código").toBeUndefined();
    expect(
      (conCuerpo.error as { code?: string } | null)?.code,
      "`sii.cases` ya no deniega SELECT a authenticated",
    ).toBe("42501");
  });
});
