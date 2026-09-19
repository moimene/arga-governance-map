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
import { createElement, createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/context/AuthContext";
import { TenantProvider } from "@/context/TenantContext";
import { sinComentarios } from "@/test/helpers/sin-comentarios";
import { AESIA_RIA_REQUIREMENTS, VERSION_CATALOGO_RIA } from "@/lib/aims/catalog-aesia";
import TabEvaluaciones from "@/components/ai-governance/sistema/TabEvaluaciones";
import EvaluacionDetalle from "@/pages/ai-governance/EvaluacionDetalle";

const DETALLE = "src/pages/ai-governance/EvaluacionDetalle.tsx";
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

  it("ninguna pantalla compara por su cuenta el texto guardado con el vigente", () => {
    // Capa DÉBIL, y se dice: un guard de texto se derrota reescribiendo la
    // comparación. La prueba fuerte es de comportamiento (abajo: el informe y el
    // historial renderizados). Esto sólo frena la reimplementación obvia, en
    // cualquiera de los dos sentidos (`f.title !== x` o `x !== f.title`) y con
    // cualquier operador de igualdad.
    const patron = /\.title(\.trim\(\))?\s*[!=]==?(?!=)\s*(?![\s"'`])|[\w)\]]\s*[!=]==?(?!=)\s*[\w$.]+\.title\b/;
    expect(patron.test('if (f.title.trim() !== "") x()'), "el patrón confunde un literal con una versión").toBe(false);
    expect(patron.test('if ("" !== f.title) x()'), "el patrón confunde un literal con una versión").toBe(false);
    expect(patron.test(fuente(HOJA)), "el patrón no casa ni con la hoja: está ciego").toBe(true);
    // Controles del sentido inverso y de la igualdad, que el patrón anterior no veía.
    expect(patron.test("findings.some((f) => m.description !== f.title)")).toBe(true);
    expect(patron.test("const igual = vigente.get(f.code) === f.title.trim();")).toBe(true);
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
  const evaluacion = (title: string, assessment_date: string) => ({
    id: "a1", system_id: "s1", framework: "EU_AI_ACT", score: 40, assessment_date, assessor_id: null,
    status: "CON_GAPS", notes: null, created_at: "", findings: [{ code: primera.id, title, status: "L3" }],
  });
  const html = (title: string, fecha = VERSION_CATALOGO_RIA) =>
    renderToStaticMarkup(createElement(TabEvaluaciones, { system: system as never, assessments: [evaluacion(title, fecha) as never], onNueva: noop, onAbrir: noop }));

  it("con el texto de otra versión → chip", () => {
    expect(html("Un texto que la medida ya no tiene")).toContain(CHIP);
  });

  it("con el texto vigente pero anterior a las medidas nuevas → chip", () => {
    expect(html(primera.description, "2026-09-07")).toContain(CHIP);
  });

  it("con el texto vigente y en la versión vigente → sin chip (control)", () => {
    const out = html(primera.description);
    expect(out).toContain("Historial de Autodiagnósticos");
    expect(out).not.toContain(CHIP);
  });
});

describe("el informe dice cuándo una evaluación se respondió con otra versión (renderizado)", () => {
  // Se renderiza la PÁGINA con la evaluación sembrada en la caché de consultas:
  // prueba la cadena entera (hoja → página → cabecera → desglose) y no se
  // satisface con un import de señuelo ni con un `false &&`.
  const medidas = AESIA_RIA_REQUIREMENTS.flatMap((r) => r.measures);
  const nuevas = medidas.filter((m) => m.desde === VERSION_CATALOGO_RIA);
  const [primera, segunda] = medidas.filter((m) => !m.desde);
  const informe = (findings: { code: string; title: string; status: string }[], assessment_date: string) => {
    const qc = new QueryClient();
    qc.setQueryData(["ai_risk_assessments", null, "a1"], {
      id: "a1", system_id: "s1", framework: "EU_AI_ACT", score: 40, assessment_date, status: "CON_GAPS",
      notes: null, created_at: "", findings,
      ai_systems: { id: "s1", name: "Sistema de prueba", risk_level: null, regulatory_role: null },
    });
    return renderToStaticMarkup(
      h(QueryClientProvider, { client: qc },
        h(AuthProvider, null,
          h(TenantProvider, null,
            h(MemoryRouter, { initialEntries: ["/ai-governance/evaluaciones/a1"] },
              h(Routes, null, h(Route, { path: "/ai-governance/evaluaciones/:id", element: h(EvaluacionDetalle) })))))),
    ).replace(/<!-- -->/g, ""); // separadores de nodos de texto del render de servidor
  };
  /** La fila del desglose de una medida. */
  const fila = (html: string, id: string) => html.split("<tr").find((tr) => tr.includes(`>${id}</td>`)) ?? "";
  const MARCA = "Texto corregido desde la respuesta";

  it("con el texto de otra versión: aviso con los recuentos, y la fila corregida lo dice", () => {
    const html = informe(
      [
        { code: primera.id, title: "Un texto que la medida ya no tiene", status: "L3" },
        { code: segunda.id, title: segunda.description, status: "L5" },
      ],
      "2026-09-07",
    );
    expect(html).toContain(CHIP);
    expect(html).toContain("han cambiado de texto 1 medida respondida");
    expect(nuevas.length).toBeGreaterThan(1);
    expect(html).toContain(`han entrado ${nuevas.length} medidas nuevas`);
    expect(fila(html, primera.id)).toContain(MARCA);
    // Control: la respondida con el texto vigente no lleva la marca.
    expect(fila(html, segunda.id)).toContain(segunda.description);
    expect(fila(html, segunda.id)).not.toContain(MARCA);
  });

  it("con el texto vigente pero antes de que entraran medidas nuevas: aviso sin «0 medidas»", () => {
    const html = informe([{ code: primera.id, title: primera.description, status: "L5" }], "2026-09-07");
    expect(html).toContain(CHIP);
    expect(html).toContain(`han entrado ${nuevas.length} medidas nuevas`);
    expect(html).not.toContain("cambiado de texto 0");
    expect(html).not.toContain(MARCA);
  });

  it("control: con el texto vigente y en la versión vigente, sin aviso", () => {
    const html = informe([{ code: primera.id, title: primera.description, status: "L5" }], VERSION_CATALOGO_RIA);
    expect(html).toContain("Informe de Autodiagnóstico de Conformidad");
    expect(html).toContain(primera.description);
    expect(html).not.toContain(CHIP);
    expect(html).not.toContain(MARCA);
  });
});
