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

// F1.T11 (programa de cobertura RIA, 2026-09-19; cierra GC-31, GC-36, GC-39 y
// GC-117 en su parte F1). Cuatro medidas del responsable del despliegue se
// presentaban como obligación jurídica suya y no lo son: el art. 50.1 obliga al
// proveedor (MD_TRA_01), el cap. V al proveedor del modelo (MD_CS_01/02) y el
// art. 25.1 califica al sujeto sin imponerle un deber de vigilancia (MD_CS_05).
// Pasan a marco operativo PROVISIONAL hasta el veredicto de Harvey H-02A, cuyo
// estado se lee del registro: sin veredicto, ni vuelven a obligación ni pierden
// el rótulo.
describe("F1.T11 — carácter de las medidas del desplegador, provisional hasta H-02A", () => {
  type Peticion = { id: string; estado?: string };
  const registro = JSON.parse(read("docs/legal/harvey/registro.json")) as { peticiones: Peticion[] };
  const h02aConVeredicto = registro.peticiones.some((p) => p.id === "H-02A" && p.estado === "RESPONDIDA");
  const CUATRO = ["MD_TRA_01", "MD_CS_01", "MD_CS_02", "MD_CS_05"];

  it("el registro de Harvey se lee (control positivo del instrumento)", () => {
    expect(registro.peticiones.some((p) => p.id === "H-01" && p.estado === "RESPONDIDA")).toBe(true);
  });

  it("sin veredicto de H-02A, las cuatro son marco operativo y llevan el rótulo provisional", async () => {
    const { procedenciaDe } = await import("@/lib/aims/perfil-aplicabilidad");
    const { ROTULO_PROVISIONAL } = await import("@/lib/aims/cuestionario-calificacion");
    for (const id of CUATRO) {
      const proc = procedenciaDe(id);
      expect(proc, `${id} ha perdido su procedencia`).not.toBeNull();
      if (h02aConVeredicto) continue;
      expect({ id, caracter: proc!.caracter }).toEqual({ id, caracter: "MARCO_OPERATIVO" });
      expect({ id, provisional: proc!.provisional }).toEqual({ id, provisional: ROTULO_PROVISIONAL });
    }
  });

  it("el rótulo provisional no se reparte más allá de las cuatro", async () => {
    const { PROCEDENCIA_DESPLIEGUE } = await import("@/lib/aims/perfil-aplicabilidad");
    const conRotulo = Object.entries(PROCEDENCIA_DESPLIEGUE).filter(([, p]) => p.provisional).map(([id]) => id).sort();
    expect(conRotulo).toEqual(h02aConVeredicto ? [] : [...CUATRO].sort());
  });

  it("las dos superficies que pintan la procedencia la leen de la hoja", () => {
    for (const f of [`${DIR_PASOS}/PasoMedidas.tsx`, "src/components/ai-governance/evaluacion-detalle/ChecklistMedidas.tsx"]) {
      expect(sinComentarios(read(f)), `${f} ya no pinta la procedencia`).toContain("procedenciaDe(");
    }
  });

  // Render, no grep del fuente: un `{false && proc.provisional && …}` deja el
  // literal en el fichero y el rótulo fuera de la pantalla. Se cuenta cuántas
  // veces aparece: una por medida rotulada del catálogo, ni más ni menos.
  it("PasoMedidas y ChecklistMedidas PINTAN el rótulo en cada medida provisional", async () => {
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { DESPLIEGUE_REQUIREMENTS } = await import("@/lib/aims/perfil-aplicabilidad");
    const { ROTULO_PROVISIONAL } = await import("@/lib/aims/cuestionario-calificacion");
    const { default: PasoMedidas } = await import("@/components/ai-governance/evaluacion/PasoMedidas");
    const { default: ChecklistMedidas } = await import("@/components/ai-governance/evaluacion-detalle/ChecklistMedidas");
    const veces = (html: string, t: string) => html.split(t).length - 1;
    const noop = () => {};
    const esperadas = h02aConVeredicto ? 0 : CUATRO.length;

    const checklist = renderToStaticMarkup(
      createElement(ChecklistMedidas, {
        catalog: DESPLIEGUE_REQUIREMENTS,
        findingsMap: {},
        planCounts: {},
        evaluatedCount: 0,
        findingsPersistidos: 0,
        findingsSinReconciliar: false,
        expandedRequirements: {},
        onToggleRequirement: noop,
      }),
    );
    // Control positivo: la procedencia de MD_TRA_01 llega al marcado.
    expect(checklist).toContain("MD_TRA_01");
    expect(checklist).toContain("Art. 50.1");
    expect(veces(checklist, ROTULO_PROVISIONAL)).toBe(esperadas);

    // El paso solo pinta el requisito activo: se recorren todos.
    let enPaso = 0;
    for (const req of DESPLIEGUE_REQUIREMENTS) {
      const html = renderToStaticMarkup(
        createElement(PasoMedidas, {
          requirements: DESPLIEGUE_REQUIREMENTS,
          activeRequirement: req,
          activeReqCode: req.code,
          onActiveReqCode: noop,
          additionalMeasures: [],
          evaluations: {},
          onEvaluationChange: noop,
          onAddMa: noop,
          onRemoveMa: noop,
          systemId: "",
          evidencias: [],
          evidenciasDe: {},
          autoguardado: "limpio",
          bannerPerfil: null,
          onPrev: noop,
          onNext: noop,
        }),
      );
      if (req.code === "TRANSPARENCIA") expect(html).toContain("Art. 50.1");
      enPaso += veces(html, ROTULO_PROVISIONAL);
    }
    expect(enPaso).toBe(esperadas);
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
    // Arista, no reimplementación: el criterio de «tiene cuestionario COMPLETED»
    // vive en la hoja (2026-09-14: el gate anterior fijaba la expresión
    // duplicada y premiaba conservarla).
    expect(src).toContain('from "@/lib/aims/cuestionario-calificacion"');
    expect(src).toContain("tieneClasificacionGuiada(sistema)");
    expect(/regulatory_profile\?\.cuestionario_id/.test(src),
      "el banner reimplementa el criterio de la hoja en vez de importarlo").toBe(false);
    // Y lleva a algún sitio: un aviso sin salida obliga a adivinar dónde se
    // clasifica.
    expect(/\/ai-governance\/sistemas\/\$\{/.test(src), "el aviso no enlaza a la ficha del sistema").toBe(true);
  });
});
