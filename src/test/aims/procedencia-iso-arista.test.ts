// src/test/aims/procedencia-iso-arista.test.ts
//
// F1.T13 (2026-09-19): toda medida de ISO/IEC 42001 se pinta como «Marco
// operativo · ISO/IEC 42001, anexo A, A.x» —marco de madurez, no obligación
// jurídica—. La hoja (`procedenciaDe`) se prueba en `iso42001.test.ts`; aquí,
// la ARISTA: que el desglose del informe y el paso de medidas del asistente la
// PINTEN. Se renderizan los dos componentes, así que ni un `&& null` sobre la
// procedencia ni un import de señuelo pasan.
import { describe, expect, it } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AESIA_RIA_REQUIREMENTS, ISO_42001_REQUIREMENTS, type RequirementDef } from "@/lib/aims/catalog-aesia";
import ChecklistMedidas from "@/components/ai-governance/evaluacion-detalle/ChecklistMedidas";
import PasoMedidas from "@/components/ai-governance/evaluacion/PasoMedidas";

const noop = () => undefined;
const limpio = (html: string) => html.replace(/<!-- -->/g, "");
const PROCEDENCIA_A2 = "ISO/IEC 42001, anexo A, A.2";

const checklist = (catalog: RequirementDef[]) =>
  limpio(
    renderToStaticMarkup(
      createElement(ChecklistMedidas, {
        catalog,
        findingsMap: {},
        planCounts: {},
        evaluatedCount: 0,
        findingsPersistidos: 0,
        findingsSinReconciliar: false,
        expandedRequirements: {},
        onToggleRequirement: noop,
      }),
    ),
  );

const paso = (requirements: RequirementDef[]) =>
  limpio(
    renderToStaticMarkup(
      createElement(PasoMedidas, {
        requirements,
        activeRequirement: requirements[0],
        activeReqCode: requirements[0].code,
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
      } as never),
    ),
  );

/** El TEXTO visible de la fila del desglose de una medida (sin etiquetas). */
const fila = (html: string, id: string) =>
  (html.split("<tr").find((tr) => tr.includes(`>${id}</td>`)) ?? "").replace(/<[^>]+>/g, "");

describe("el desglose del informe pinta la procedencia de ISO/IEC 42001", () => {
  it("una medida de ISO dice «Marco operativo» y su punto del anexo A", () => {
    expect(ISO_42001_REQUIREMENTS[0].code).toBe("ISO_POLICIES");
    const f = fila(checklist(ISO_42001_REQUIREMENTS), "MG_ISO_POL_01");
    expect(f).toContain("Marco operativo · " + PROCEDENCIA_A2);
    expect(f).not.toContain("Obligación");
  });

  it("control: una medida del RIA no lleva procedencia de ISO", () => {
    const f = fila(checklist(AESIA_RIA_REQUIREMENTS), "MG_RISK_01");
    expect(f).toContain("MG_RISK_01");
    expect(f).not.toContain("Marco operativo");
    expect(f).not.toContain("ISO/IEC 42001");
  });
});

describe("el paso de medidas del asistente pinta la procedencia de ISO/IEC 42001", () => {
  it("una medida de ISO dice «Marco operativo» y su punto del anexo A", () => {
    const html = paso(ISO_42001_REQUIREMENTS);
    expect(html).toContain("MG_ISO_POL_01");
    expect(html).toContain("Marco operativo · " + PROCEDENCIA_A2);
  });

  it("control: el paso con un requisito del RIA no pinta procedencia de ISO", () => {
    const html = paso(AESIA_RIA_REQUIREMENTS);
    expect(html).toContain(AESIA_RIA_REQUIREMENTS[0].measures[0].id);
    expect(html).not.toContain("Marco operativo");
    expect(html).not.toContain("ISO/IEC 42001");
  });
});
