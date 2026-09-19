// src/test/aims/catalogo-version-arista.test.ts
//
// F1.T12 (2026-09-19): el recotejo contra el texto consolidado corrige el texto
// de medidas ya respondidas y añade otras. Una evaluación guardada antes quedó
// respondida a otra formulación. El criterio vive en UNA hoja
// (`cambiosDelCatalogoDesde`, en `perfil-aplicabilidad.ts`); aquí se vigila la
// ARISTA —que el informe y el historial la importen, la llamen y pinten lo que
// devuelve— y el COMPORTAMIENTO del historial, con control positivo.
import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { sinComentarios } from "@/test/helpers/sin-comentarios";
import { AESIA_RIA_REQUIREMENTS } from "@/lib/aims/catalog-aesia";
import TabEvaluaciones from "@/components/ai-governance/sistema/TabEvaluaciones";

const DETALLE = "src/pages/ai-governance/EvaluacionDetalle.tsx";
const CABECERA = "src/components/ai-governance/evaluacion-detalle/CabeceraInforme.tsx";
const HISTORIAL = "src/components/ai-governance/sistema/TabEvaluaciones.tsx";
const HOJA = "src/lib/aims/perfil-aplicabilidad.ts";
const SUPERFICIES = ["src/pages/ai-governance", "src/components/ai-governance"];

const fuente = (f: string) => sinComentarios(readFileSync(f, "utf8"));
const CHIP = "Respondida con una versión anterior del catálogo";

describe("la versión del catálogo la decide una hoja", () => {
  it("el informe y el historial importan el criterio y lo llaman", () => {
    for (const f of [DETALLE, HISTORIAL]) {
      const src = fuente(f);
      expect(
        /import\s*\{[^}]*\bcambiosDelCatalogoDesde\b[^}]*\}\s*from\s*["']@\/lib\/aims\/perfil-aplicabilidad["']/.test(src),
        `${f}: no importa el criterio`,
      ).toBe(true);
      expect(/cambiosDelCatalogoDesde\(/.test(src), `${f}: lo importa y no lo llama`).toBe(true);
    }
  });

  it("la cabecera del informe pinta lo que devuelve el criterio", () => {
    const src = fuente(CABECERA);
    expect(src).toMatch(/cambiosCatalogo\.anterior\s*&&/);
    expect(src).toContain("cambiosCatalogo.corregidas.length");
    expect(src).toContain("cambiosCatalogo.nuevas.length");
    expect(fuente(DETALLE)).toMatch(/cambiosCatalogo=\{/);
  });

  it("ninguna pantalla compara por su cuenta el texto guardado con el vigente", () => {
    // Control positivo del patrón: la hoja SÍ hace esa comparación.
    const patron = /\.title(\.trim\(\))?\s*!==?\s*(?!["'`])/;
    expect(patron.test(fuente(HOJA)), "el patrón no casa ni con la hoja: está ciego").toBe(true);
    const ficheros = SUPERFICIES.flatMap((dir) =>
      (readdirSync(dir, { recursive: true }) as string[]).map((f) => `${dir}/${f}`),
    ).filter((f) => /\.tsx?$/.test(f));
    expect(ficheros.length).toBeGreaterThan(30);
    for (const f of ficheros) {
      expect(patron.test(fuente(f)), `${f}: reimplementa la comparación de versión`).toBe(false);
    }
  });
});

describe("el historial dice cuándo una evaluación se respondió con otra versión", () => {
  const noop = () => undefined;
  const system = { id: "s1", tenant_id: "t", name: "S", system_type: null, risk_level: null, vendor: null, deployment_date: null, owner_id: null, status: "ACTIVO", description: null, use_case: null, created_at: "" };
  const primera = AESIA_RIA_REQUIREMENTS[0].measures[0];
  const evaluacion = (title: string) => ({
    id: "a1", system_id: "s1", framework: "EU_AI_ACT", score: 40, assessment_date: "2026-09-07", assessor_id: null,
    status: "CON_GAPS", notes: null, created_at: "", findings: [{ code: primera.id, title, status: "L3" }],
  });
  const html = (title: string) =>
    renderToStaticMarkup(createElement(TabEvaluaciones, { system: system as never, assessments: [evaluacion(title) as never], onNueva: noop, onAbrir: noop }));

  it("con el texto de otra versión → chip", () => {
    expect(html("Un texto que la medida ya no tiene")).toContain(CHIP);
  });

  it("con el texto vigente → sin chip (control)", () => {
    const out = html(primera.description);
    expect(out).toContain("Historial de Autodiagnósticos");
    expect(out).not.toContain(CHIP);
  });
});
