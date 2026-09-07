// src/test/grc/navegacion-por-tenant.test.ts
//
// Dos defectos de la pasada adversarial del 2026-09-06, los dos de la misma
// familia: lo que la navegación OFRECE no coincide con lo que el destino
// SIRVE a ese tenant.
//
//  1. [#72/#219] El filtro del dashboard GRC enumeraba a mano `/grc/m/dora` y
//     `/grc/packs`, mientras el guard de ruta (`RequireGrcModule`) ya resolvía
//     CUALQUIER `/grc/m/:moduleId` contra la lista blanca. Resultado medido:
//     Garrigues recibía tarjetas a `/grc/m/gdpr`, `/grc/m/cyber` y
//     `/grc/m/audit`, y al pulsarlas el guard redirigía a `/` sin mensaje.
//     Enlaces muertos, no fuga.
//  2. [#49] `/grc/sostenibilidad` existía en App.tsx sin ningún item de
//     navegación: ruta huérfana. Y no podía entrar con `moduleKey`, porque
//     `isModuleEnabled` falla ABIERTO y ARGA habría ganado un item hacia una
//     pantalla que su propio gate deja vacía.
//
// El control discriminante va en CADA aserción de ocultación: ARGA tiene
// `branding` NULL y no debe perder ni un destino.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sinComentarios } from "../helpers/sin-comentarios";
import { grcRouteModuleKey } from "@/lib/grc/route-module-key";
import { isModuleEnabled } from "@/lib/tenant-modules";
import {
  GRC_COMPLIANCE_MONITORS,
  GRC_P0_DOMAINS,
  GRC_SCREEN_POSTURES,
} from "@/lib/grc/dashboard-readiness";
import { GRC_NAV_ITEMS, getVisibleGrcNavItems } from "@/components/garrigues-shell/navigation";
import { ESG_MODULO } from "../../../scripts/garrigues/esg/plan-sostenibilidad";
import { GARRIGUES_TENANT, sesionDe } from "../helpers/supabase-test-client";

const raiz = process.cwd();
const leer = (rel: string) => sinComentarios(readFileSync(join(raiz, rel), "utf8"));

const ARGA = "00000000-0000-0000-0000-000000000001";

// COPIA de `tenants.branding->modules` de Garrigues. La fuente es Cloud, no
// esto: la sonda de más abajo compara las dos en CADA corrida.
//
// Por qué existe la sonda. Hasta el 2026-09-07 esto era una copia congelada y
// nada la contrastaba, así que el fichero afirmaba ausencias contra su propia
// copia: el día que se abriera un módulo en Cloud, estos tests habrían seguido
// verdes jurando que no estaba. Un gate que se mide a sí mismo es un VERDE
// FALSO, no una salvaguarda — y con el tenant sembrándose de forma progresiva,
// la copia va a quedarse atrás antes o después.
const MODULOS_GARRIGUES = [
  "secretaria", "grc", "ai-governance", "sii", "politicas", "obligaciones",
  "delegaciones", "hallazgos", "conflictos", "governance-map", "entidades", "organos",
];
const GARRIGUES = { modules: MODULOS_GARRIGUES } as never;

describe("la copia de la lista blanca no puede divergir del dato sin que esto caiga", () => {
  it("`tenants.branding->modules` de Garrigues en Cloud coincide con la copia de este fichero", async () => {
    const garr = await sesionDe("GARRIGUES");
    const { data, error } = await garr
      .from("tenants").select("branding").eq("id", GARRIGUES_TENANT).maybeSingle();
    expect(error).toBeNull();
    const modules = (data?.branding as { modules?: unknown } | null)?.modules;

    // Control positivo: `isModuleEnabled` falla ABIERTO ante `null` y ante `[]`,
    // así que un branding borrado dejaría todo visible y las aserciones de
    // ocultación de abajo pasarían sin gatear nada.
    expect(Array.isArray(modules), "Garrigues ya no declara lista blanca en Cloud").toBe(true);
    expect((modules as string[]).length).toBeGreaterThan(0);

    // Si esto cae, el dato de Cloud MANDA: se actualiza `MODULOS_GARRIGUES` y se
    // revisan las aserciones ancladas de abajo. No se revierte nada en Cloud.
    expect(
      [...(modules as string[])].sort(),
      "la lista blanca de Garrigues cambió en Cloud: actualiza MODULOS_GARRIGUES aquí (y las rutas ancladas de #72). El dato manda; no se toca Cloud",
    ).toEqual([...MODULOS_GARRIGUES].sort());
  });
});

// Reproduce el filtro del dashboard: es la composición que el propio
// `Dashboard.tsx` aplica, y se comprueba abajo que la aplica.
const visible = (branding: never | null, route: string) => {
  const clave = grcRouteModuleKey(route);
  return clave === null || isModuleEnabled(branding, clave);
};

describe("#72 — el dashboard GRC no ofrece rutas que el guard va a redirigir", () => {
  it("el criterio del filtro es el del guard: cualquier /grc/m/:moduleId", () => {
    expect(grcRouteModuleKey("/grc/m/gdpr")).toBe("gdpr");
    expect(grcRouteModuleKey("/grc/m/cyber")).toBe("cyber");
    expect(grcRouteModuleKey("/grc/m/audit")).toBe("audit");
    expect(grcRouteModuleKey("/grc/m/dora/operate/incidents")).toBe("dora");
    expect(grcRouteModuleKey("/grc/packs/ES")).toBe("country-packs");
    // Lo que no gatea nadie sigue sin gatearse.
    expect(grcRouteModuleKey("/grc/risk-360")).toBeNull();
    expect(grcRouteModuleKey("/grc/incidentes")).toBeNull();
    expect(grcRouteModuleKey("/grc")).toBeNull();
  });

  it("los tres módulos anidados medidos como enlaces muertos ya no se ofrecen a Garrigues", () => {
    for (const ruta of ["/grc/m/gdpr", "/grc/m/cyber", "/grc/m/audit", "/grc/m/dora"]) {
      expect(visible(GARRIGUES, ruta)).toBe(false);
    }
    // Control discriminante: ARGA (branding NULL) conserva los cuatro.
    for (const ruta of ["/grc/m/gdpr", "/grc/m/cyber", "/grc/m/audit", "/grc/m/dora"]) {
      expect(visible(null, ruta)).toBe(true);
    }
  });

  it("sobre las listas reales del dashboard: ARGA no pierde NI UN destino", () => {
    for (const lista of [GRC_P0_DOMAINS, GRC_COMPLIANCE_MONITORS, GRC_SCREEN_POSTURES]) {
      const rutas = lista.map((x) => x.route);
      expect(rutas.filter((r) => visible(null, r))).toHaveLength(rutas.length);
    }
  });

  it("y Garrigues sí pierde exactamente los destinos de módulo que no tiene", () => {
    const ocultos = [...GRC_P0_DOMAINS, ...GRC_COMPLIANCE_MONITORS, ...GRC_SCREEN_POSTURES]
      .map((x) => x.route)
      .filter((r) => !visible(GARRIGUES, r));
    // Control positivo: las listas no están vacías y el filtro sí discrimina.
    expect(ocultos.length).toBeGreaterThan(0);
    for (const r of ocultos) {
      expect(grcRouteModuleKey(r)).not.toBeNull();
    }
    // Y lo que le aplica sigue en pie.
    expect(visible(GARRIGUES, "/grc/risk-360")).toBe(true);
    expect(visible(GARRIGUES, "/grc/penal-anticorrupcion")).toBe(true);
  });

  it("el dashboard usa ese criterio y ya no enumera rutas a mano", () => {
    const src = leer("src/pages/grc/Dashboard.tsx");
    // Control positivo: es el fichero que toca y sigue teniendo el filtro.
    expect(src).toContain("isGrcRouteVisible");
    expect(src).toContain("grcRouteModuleKey");
    // El defecto era la enumeración literal dentro del filtro.
    expect(src).not.toContain('route.startsWith("/grc/m/dora")');
  });

  // Comprobar la FUNCIÓN no prueba que las listas la APLIQUEN: si alguien
  // quitara el `.filter(...)` de una de ellas, todo lo de arriba seguiría verde
  // y las tarjetas muertas volverían. Se cuentan las aplicaciones, que son las
  // cinco superficies que enlazan a módulos: los tres bloques de tarjetas
  // (monitores, dominios P0, posturas de pantalla) y las dos listas de enlaces
  // del pie.
  it("y las CINCO listas que enlazan a módulos aplican el filtro, no solo existe", () => {
    const src = leer("src/pages/grc/Dashboard.tsx");
    // Se buscan las LLAMADAS con su argumento, no el nombre suelto: la
    // declaración de la función lo contiene y contarla habría inflado el total.
    for (const aplicacion of [
      "isGrcRouteVisible(branding, monitor.route)",
      "isGrcRouteVisible(branding, domain.route)",
      "isGrcRouteVisible(branding, screen.route)",
      "isGrcRouteVisible(branding, link.to)",
      "isGrcRouteVisible(branding, mod.to)",
    ]) {
      expect(src, `falta el filtro en: ${aplicacion}`).toContain(aplicacion);
    }
    for (const lista of [
      "GRC_COMPLIANCE_MONITORS.filter",
      "GRC_P0_DOMAINS.filter",
      "GRC_SCREEN_POSTURES.filter",
    ]) {
      expect(src).toContain(lista);
    }
  });
});

describe("#49 — /grc/sostenibilidad deja de ser ruta huérfana", () => {
  it("hay un item de navegación que lleva a ella", () => {
    expect(GRC_NAV_ITEMS.some((i) => i.to === "/grc/sostenibilidad")).toBe(true);
  });

  it("y su gate es el MISMO que aplica la pantalla, no la lista blanca de módulos", () => {
    const item = GRC_NAV_ITEMS.find((i) => i.to === "/grc/sostenibilidad")!;
    // Si alguien lo cambia a `moduleKey`, `isModuleEnabled` falla ABIERTO y
    // ARGA gana el item: por eso se exige el gate por tenant.
    expect(item.tenantGate).toBeInstanceOf(Function);
    expect(item.moduleKey).toBeUndefined();
    expect(item.tenantGate!(ESG_MODULO.tenant_id)).toBe(true);
    expect(item.tenantGate!(ARGA)).toBe(false);
    expect(item.tenantGate!(null)).toBe(false);
  });

  it("solo la ve el tenant dueño del catálogo, y ARGA no gana ningún item", () => {
    const deGarrigues = getVisibleGrcNavItems(GARRIGUES, ESG_MODULO.tenant_id).map((i) => i.to);
    expect(deGarrigues).toContain("/grc/sostenibilidad");

    // Control discriminante: ARGA sigue con exactamente lo de siempre.
    const deArga = getVisibleGrcNavItems(null, ARGA).map((i) => i.to);
    expect(deArga).not.toContain("/grc/sostenibilidad");
    expect(deArga).toHaveLength(GRC_NAV_ITEMS.length - 1);
    for (const ruta of ["/grc/solvencia-ii", "/grc/tprm", "/grc/packs", "/grc/risk-360"]) {
      expect(deArga).toContain(ruta);
    }
  });

  it("el sidebar usa ese filtro y no uno propio que ignore el gate por tenant", () => {
    const src = leer("src/components/garrigues-shell/GarriguesSidebar.tsx");
    expect(src).toContain("getVisibleGrcNavItems");
    expect(src).not.toContain("GRC_NAV_ITEMS.filter");
  });
});
