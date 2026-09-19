// src/test/aims/tab-vigilancia.test.tsx
//
// F1.T6 (GC-50) — un indicador sin medición no se pinta como resultado.
//
// `aims_monitoring_indicators.status` tiene DEFAULT 'OK' y el alta desde la
// pestaña lo dejaba así: sin valor medido y sin umbral, un «OK» en verde que
// nadie había medido. El criterio vive en la hoja `@/lib/aims/vigilancia`; aquí
// se mide lo que la pestaña PINTA, con control positivo: el único indicador de
// Cloud (ARGA, medido el 2026-09-19) sí tiene valor (6,4 % con umbrales 8/12),
// y tiene que seguir en «OK».
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { sinComentarios } from "@/test/helpers/sin-comentarios";
import { estadoIndicador, SIN_MEDICION } from "@/lib/aims/vigilancia";
import Vigilancia from "@/components/ai-governance/sistema/TabVigilancia";
import { conProveedoresReales } from "./_proveedores-reales";

const TAB = "src/components/ai-governance/sistema/TabVigilancia.tsx";
const HOOK = "src/hooks/useAimsTechnicalFile.ts";
const fuente = (f: string) => sinComentarios(readFileSync(f, "utf8"));

const base = {
  tenant_id: "00000000-0000-0000-0000-000000000001",
  system_id: "11111111-1111-1111-1111-111111111111",
  created_at: "2026-04-24T00:00:00Z",
};
/**
 * Como nace desde la pestaña: `status` DEFAULT 'OK' y `current_value` DEFAULT
 * '{}'::jsonb (la columna es NOT NULL, medido el 2026-09-19), sin umbral.
 */
const SIN_VALOR = { ...base, id: "ind-sin-valor", indicator_name: "Deriva del modelo", status: "OK", current_value: {} };
/** El indicador real de ARGA (Motor de triaje de siniestros auto). */
const ARGA_REAL = {
  ...base,
  id: "ind-arga",
  indicator_name: "Override humano en rechazos",
  metric_key: "human_override_rejection_pct",
  status: "OK",
  current_value: { unit: "%", value: 6.4 },
  threshold_config: { unit: "%", warning: 8, critical: 12 },
  last_observed_at: "2026-04-24T00:00:00Z",
};

describe("F1.T6 — la hoja: sin valor medido no hay estado que leer", () => {
  it("sin current_value es SIN_MEDICION, diga lo que diga status", () => {
    for (const status of ["OK", "OPTIMAL", "ALERTA", "", null]) {
      expect(estadoIndicador({ status, current_value: null }).clave).toBe(SIN_MEDICION);
      expect(estadoIndicador({ status, current_value: undefined }).clave).toBe(SIN_MEDICION);
    }
    expect(estadoIndicador({ status: "OK", current_value: null }).etiqueta).toBe("Sin medición");
  });

  it("un valor vacío tampoco es una medición", () => {
    for (const vacio of [{}, { unit: "%", value: null }, "", "   "]) {
      expect(estadoIndicador({ status: "OK", current_value: vacio }).clave, JSON.stringify(vacio))
        .toBe(SIN_MEDICION);
    }
  });

  it("falla cerrado: un valor que no se sabe leer no es una medición", () => {
    // `{ unit: "%" }` es una unidad declarada sin valor: la misma forma que el
    // `threshold_config` del indicador de ARGA. Ninguna de estas formas puede
    // pintarse «OK» en verde por el DEFAULT de `status`.
    const ilegibles = [
      { unit: "%" }, { value: "" }, { value: "  " }, { pending: true }, { valor: 3 }, [null], [6.4],
      { value: {} }, { value: [] }, { value: true }, { value: Number.NaN }, { value: Infinity },
      Number.NaN, true,
    ];
    for (const v of ilegibles) {
      expect(estadoIndicador({ status: "OK", current_value: v }).clave, String(JSON.stringify(v) ?? v))
        .toBe(SIN_MEDICION);
    }
  });

  it("control positivo: con valor medido se lee el estado (también un cero)", () => {
    expect(estadoIndicador({ status: "OK", current_value: { unit: "%", value: 6.4 } }))
      .toEqual({ clave: "OK", etiqueta: "OK" });
    expect(estadoIndicador({ status: "optimal", current_value: 0 }).clave).toBe("OPTIMAL");
    expect(estadoIndicador({ status: "OK", current_value: { unit: "%", value: 0 } }).clave).toBe("OK");
    expect(estadoIndicador({ status: "OK", current_value: { value: "6,4 %" } }).clave).toBe("OK");
    expect(estadoIndicador({ status: "OK", current_value: "6,4 %" }).clave).toBe("OK");
  });
});

describe("F1.T6 — la pestaña pinta «sin medición» y no promete monitorización", () => {
  // Sin `mock.module`: la pestaña se renderiza con sus hooks y proveedores
  // reales, así que el resultado no depende de qué fichero la cargó antes.
  function chips(indicators: unknown[]) {
    const div = document.createElement("div");
    div.innerHTML = renderToStaticMarkup(
      conProveedoresReales(createElement(Vigilancia, { systemId: base.system_id, indicators: indicators as never })),
    );
    return {
      html: div.innerHTML,
      chips: Array.from(div.querySelectorAll("[data-indicador-estado]")).map((el) => ({
        clave: el.getAttribute("data-indicador-estado"),
        texto: el.textContent?.trim(),
        clase: el.getAttribute("class") ?? "",
      })),
    };
  }

  it("sin current_value, «Sin medición» en neutro aunque status = 'OK'; con valor, «OK» en verde", () => {
    const { chips: vistos } = chips([SIN_VALOR, ARGA_REAL]);
    // Control del instrumento: dos indicadores, dos chips. Un selector que no
    // casara haría pasar las aserciones de ausencia de abajo sin mirar nada.
    expect(vistos.length).toBe(2);

    const [sinValor, arga] = vistos;
    expect(sinValor.clave).toBe(SIN_MEDICION);
    expect(sinValor.texto).toBe("Sin medición");
    // Neutro en positivo, no por ausencia de tres colores: un `--status-info`
    // también es un color de estado.
    expect(sinValor.clase).toContain("--g-surface-muted");
    expect(/--status-/.test(sinValor.clase),
      `el indicador sin medición se pinta con un color que afirma algo: ${sinValor.clase}`).toBe(false);

    // Control positivo: el indicador real de ARGA, con valor, sigue igual.
    expect(arga.clave).toBe("OK");
    expect(arga.texto).toBe("OK");
    expect(arga.clase).toContain("status-success");
  });

  it("no promete una monitorización continua que no existe", () => {
    const { html } = chips([SIN_VALOR]);
    expect(html).toContain("Art. 72 RIA"); // control: la cabecera se pintó
    expect(/monitorizaci[oó]n\s+continua/i.test(html)).toBe(false);
    // Ni el formulario dice que el umbral y la medición «se declaran después»:
    // no hay camino para declararlos.
    expect(/se declaran despu[eé]s/i.test(fuente(TAB))).toBe(false);
  });

  it("la pestaña importa la hoja y no relee status por su cuenta", () => {
    const src = fuente(TAB);
    expect(src).toContain('from "@/lib/aims/vigilancia"');
    expect(src).toContain("estadoIndicador(ind)");
    expect(/normalizeAimsStatus\(\s*ind\.status\s*\)/.test(src),
      "la pestaña vuelve a leer status sin mirar si hay medición").toBe(false);
  });

  it("el alta no escribe un «OK» que nadie ha medido", () => {
    const src = fuente(HOOK);
    const bloque = src.slice(src.indexOf("export function useRegistrarIndicador"));
    // Control: el bloque existe y es el que inserta en la tabla de indicadores.
    expect(bloque).toContain('.from("aims_monitoring_indicators")');
    const insert = bloque.slice(bloque.indexOf(".insert("), bloque.indexOf(".select()"));
    expect(insert.length).toBeGreaterThan(0);
    expect(/status\s*:/.test(insert), `el alta fija un estado sin medición → ${insert}`).toBe(false);
  });
});
