// src/test/aims/tab-riesgos-grc.test.tsx
//
// MOI-164 — la ficha del sistema en AIMS pinta el riesgo de GRC que lo
// enlaza (`risks.ai_system_id`), en SOLO LECTURA: GRC sigue siendo el owner
// del riesgo. Prueba de arista: si la pestaña o el hook empiezan a escribir
// en `risks`, o si `SistemaDetalle` deja de pasarle lo que el hook lee, este
// test se rompe.
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { sinComentarios } from "@/test/helpers/sin-comentarios";
import TabRiesgosGrc from "@/components/ai-governance/sistema/TabRiesgosGrc";
import type { RiskRow } from "@/hooks/useRisks";

const TAB = "src/components/ai-governance/sistema/TabRiesgosGrc.tsx";
const HOOK = "src/hooks/useRisks.ts";
const PAGINA = "src/pages/ai-governance/SistemaDetalle.tsx";
const fuente = (f: string) => sinComentarios(readFileSync(f, "utf8"));

const RIESGO: RiskRow = {
  id: "r1",
  code: "RSK-TECH-011",
  title: "Supply chain attack librerías OSS",
  description: "Dependencias OSS críticas sin SBOM ni signing verificado.",
  probability: null,
  impact: null,
  inherent_score: 12,
  residual_score: null,
  entity_id: null,
  module_id: "tech",
  status: "Abierto",
  obligation_id: null,
  finding_id: null,
  assessed_band: "ROJO",
  assessment_breakdown: null,
  assessment_provenance: null,
  ai_system_id: "sys-1",
};

function html(riesgos: RiskRow[], error?: unknown) {
  const div = document.createElement("div");
  div.innerHTML = renderToStaticMarkup(createElement(TabRiesgosGrc, { riesgos, error }));
  return div;
}

describe("MOI-164 — TabRiesgosGrc pinta el enlace risks.ai_system_id en solo lectura", () => {
  it("con un riesgo enlazado, pinta código, título, banda y estado", () => {
    const div = html([RIESGO]);
    expect(div.querySelector('[data-riesgo-enlazado="RSK-TECH-011"]')).not.toBeNull();
    expect(div.innerHTML).toContain("RSK-TECH-011");
    expect(div.innerHTML).toContain("Supply chain attack librerías OSS");
    expect(div.innerHTML).toContain("ROJO");
    expect(div.innerHTML).toContain("Abierto");
  });

  it("sin riesgos enlazados, lo dice y no lo confunde con un error", () => {
    const div = html([]);
    expect(div.innerHTML).toContain("Ningún riesgo de GRC está enlazado");
  });

  it("con error de lectura, «no se pudo leer» no es «no hay»", () => {
    const div = html([], new Error("boom"));
    expect(div.innerHTML).toContain("No se pudo leer los riesgos enlazados");
    expect(div.innerHTML).not.toContain("Ningún riesgo de GRC está enlazado");
  });

  it("es de solo lectura: ni botón, ni input, ni formulario", () => {
    const div = html([RIESGO]);
    expect(div.querySelector("button")).toBeNull();
    expect(div.querySelector("input")).toBeNull();
    expect(div.querySelector("form")).toBeNull();
  });

  it("la pestaña no escribe en `risks`: ningún insert/update/delete en su fuente", () => {
    const src = fuente(TAB);
    expect(/\.from\(\s*["']risks["']\s*\)/.test(src)).toBe(false);
    expect(/\.(insert|update|delete)\(/.test(src)).toBe(false);
  });

  it("el hook que alimenta la pestaña es de solo lectura sobre `risks`", () => {
    const src = fuente(HOOK);
    const bloque = src.slice(src.indexOf("export function useRisksByAiSystem"));
    const cierre = bloque.indexOf("\nexport function useCreateRisk");
    const cuerpo = cierre > 0 ? bloque.slice(0, cierre) : bloque;
    expect(cuerpo).toContain('.from("risks")');
    expect(cuerpo).toContain('.eq("ai_system_id"');
    expect(cuerpo).toContain('.eq("tenant_id"');
    expect(/\.(insert|update|delete)\(/.test(cuerpo)).toBe(false);
  });

  it("la ficha del sistema monta la pestaña con lo que el hook lee (arista, no solo el rótulo)", () => {
    const src = fuente(PAGINA);
    expect(src).toContain('from "@/hooks/useRisks"');
    expect(src).toContain("useRisksByAiSystem(id)");
    expect(src).toContain("<TabRiesgosGrc riesgos={riesgosGrc} error={errRiesgosGrc} />");
  });
});
