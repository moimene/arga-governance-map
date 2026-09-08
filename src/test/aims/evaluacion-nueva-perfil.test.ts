/**
 * El alta del autodiagnóstico compone; el catálogo lo decide el perfil.
 *
 * QUÉ VIGILA, Y POR QUÉ ESO.
 *
 * 1. TAMAÑO. La pantalla tenía 1 360 líneas con los cuatro pasos, el modal y el
 *    criterio dentro. Un fichero así es donde un paso se «ajusta» un criterio
 *    por su cuenta y la corrección llega a una pantalla y no a sus hermanas.
 *
 * 2. LA ARISTA, no el rótulo. Leer «Perfil de aplicabilidad: …» en pantalla no
 *    prueba que el perfil se use: coincidiría igual si el texto estuviera
 *    escrito a mano. Se comprueba que la página IMPORTA y LLAMA `perfilAplicable`
 *    y que el banner LEE `catalogProfile`.
 *
 * 3. QUIÉN DECIDE EL CATÁLOGO. Ningún paso puede importar el catálogo del
 *    proveedor, el del responsable del despliegue ni el resolutor por marco
 *    para decidir contra qué se mide: eso lo hace la página con `perfilAplicable`
 *    y llega por props. Los tipos (`RequirementDef`) sí, que no deciden nada.
 *
 * 4. EL AVISO DE CA-7. Un sistema sin cuestionario guiado se mide contra el
 *    catálogo completo —fail-open declarado— y la pantalla tiene que decirlo.
 *    La condición se lee de `regulatory_profile.cuestionario_id`, que es lo que
 *    escribe la RPC del cuestionario: `regulatory_role` NO sirve, porque un
 *    sistema clasificado a mano antes del cuestionario lo tiene y aun así no
 *    pasó por el camino guiado.
 */
import { describe, it, expect } from "bun:test";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { sinComentarios } from "../helpers/sin-comentarios";

const PAGINA = "src/pages/ai-governance/EvaluacionNueva.tsx";
const DIR_PASOS = "src/components/ai-governance/evaluacion";
const BANNER = `${DIR_PASOS}/PerfilAplicabilidadBanner.tsx`;

const read = (f: string) => readFileSync(f, "utf8");
const ficherosDelPaso = () => readdirSync(DIR_PASOS).filter((f) => f.endsWith(".tsx")).map((f) => `${DIR_PASOS}/${f}`);

describe("EvaluacionNueva — control positivo del instrumento", () => {
  it("la pantalla y el banner existen y son los que se están midiendo", () => {
    // Sin esto, un renombrado dejaría el resto del fichero asertando sobre
    // ficheros que no existen y todo pasaría a verde por vacuidad.
    expect(existsSync(PAGINA), `${PAGINA} no existe`).toBe(true);
    expect(existsSync(BANNER), `${BANNER} no existe`).toBe(true);
    const pasos = ficherosDelPaso();
    expect(pasos.length, "la carpeta de pasos se ha quedado corta").toBeGreaterThanOrEqual(6);
    for (const esperado of ["PasoParametros", "PasoMedidas", "ControlesDeMedida", "PasoRevision", "PasoResultado", "PerfilAplicabilidadBanner"]) {
      expect(pasos.some((f) => f.endsWith(`/${esperado}.tsx`)), `falta ${esperado}.tsx`).toBe(true);
    }
  });

  it("la página quedó en composición, no vaciada", () => {
    const lineas = read(PAGINA).split("\n").length;
    expect(lineas, `${PAGINA} sigue por encima del techo: ${lineas} líneas`).toBeLessThanOrEqual(400);
    // Una pantalla vacía cumpliría el techo y no compondría nada.
    expect(lineas, `${PAGINA} se ha quedado en nada: ${lineas} líneas`).toBeGreaterThan(100);
  });

  it("ningún paso supera el techo", () => {
    for (const f of ficherosDelPaso()) {
      const lineas = read(f).split("\n").length;
      expect(lineas, `${f}: ${lineas} líneas`).toBeLessThanOrEqual(400);
    }
  });
});

describe("EvaluacionNueva — el catálogo lo decide el perfil", () => {
  it("la página importa perfilAplicable y lo LLAMA", () => {
    const src = sinComentarios(read(PAGINA));
    expect(/import\s*\{[^}]*perfilAplicable[^}]*\}\s*from\s*["']@\/lib\/aims\/perfil-aplicabilidad["']/.test(src),
      "la página no importa el criterio de perfil").toBe(true);
    expect(/perfilAplicable\s*\(/.test(src), "importa `perfilAplicable` y no lo llama").toBe(true);
  });

  it("ningún paso resuelve el catálogo por su cuenta", () => {
    // Control positivo del detector: la PÁGINA sí resuelve el catálogo, así
    // que un patrón que no encontrara nada en ningún sitio estaría ciego.
    expect(/getRequirementsForFramework\s*\(/.test(sinComentarios(read(PAGINA))),
      "la página ya no resuelve el catálogo: el detector de abajo no discrimina").toBe(true);

    for (const f of ficherosDelPaso()) {
      const src = sinComentarios(read(f));
      // `import type { RequirementDef }` está permitido: un tipo no decide.
      const importsDeValor = (src.match(/import\s+(?!type\s)[\s\S]*?from\s*["'][^"']*catalog-aesia["']/g) ?? []).join("\n");
      for (const prohibido of ["AESIA_RIA_REQUIREMENTS", "ISO_42001_REQUIREMENTS", "getRequirementsForFramework"]) {
        expect(importsDeValor.includes(prohibido), `${f}: importa ${prohibido} y decide el catálogo`).toBe(false);
      }
      expect(/DESPLIEGUE_REQUIREMENTS/.test(src), `${f}: importa el catálogo del desplegador`).toBe(false);
    }
  });
});

describe("PerfilAplicabilidadBanner — dice qué perfil y qué le falta", () => {
  it("pinta el perfil de catálogo leyendo el dato, no un rótulo fijo", () => {
    const src = sinComentarios(read(BANNER));
    expect(/catalogProfile/.test(src), "el banner no lee el perfil de catálogo").toBe(true);
    expect(/ETIQUETA_PERFIL\s*\[/.test(src), "el banner no usa la etiqueta canónica del perfil").toBe(true);
    expect(/AVISO_COBERTURA_PROVISIONAL/.test(src), "el banner no declara la cobertura provisional").toBe(true);
  });

  it("el aviso de CA-7 existe y su condición mira el cuestionario, no el rol", () => {
    const src = sinComentarios(read(BANNER));
    expect(src).toContain("Sin clasificación guiada");
    expect(/regulatory_profile[^\n]*cuestionario_id/.test(src),
      "el aviso no se decide por `regulatory_profile.cuestionario_id`").toBe(true);
    // Y lleva a algún sitio: un aviso sin salida obliga a adivinar dónde se
    // clasifica.
    expect(/\/ai-governance\/sistemas\/\$\{/.test(src), "el aviso no enlaza a la ficha del sistema").toBe(true);
  });
});
