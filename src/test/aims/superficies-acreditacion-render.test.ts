// src/test/aims/superficies-acreditacion-render.test.ts
//
// F1.T4 y F1.T8 sobre lo que RENDERIZAN las superficies hermanas del informe:
// la lista de evaluaciones, la pestaña del sistema, el expediente técnico y la
// prioridad de la portada. Los gates de fuente («importa y llama») se cumplían
// con una sola llamada cualquiera a la hoja y dejaban pasar un `false &&` o un
// chip teñido por el estado: por eso se montan, cada uno con su control positivo.
import { afterAll, afterEach, describe, expect, it } from "bun:test";
import { createElement } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockearModulos } from "@/test/garrigues/_mock-restaurable";

const congeladaYRevisada = { frozen_at: "2026-09-18T10:00:00Z", reviewed_at: "2026-09-18T11:00:00Z" };
// Filas de ARGA leídas en Cloud el 2026-09-19: APROBADO de 100, sin congelar,
// con los códigos VAL-0x del seed del «Motor de triaje».
const argaAprobada = {
  id: "68f23d26",
  system_id: "90000000-0000-0000-0000-000000000001",
  framework: "EU_AI_ACT",
  status: "APROBADO",
  score: 100,
  assessment_date: "2026-07-19",
  created_at: "2026-07-19T10:05:42Z",
  notes: null,
  findings: Array.from({ length: 7 }, (_, i) => ({ code: `VAL-0${i + 1}`, status: "CONFORME" })),
};
const firme = {
  ...argaAprobada,
  id: "firme-1",
  status: "CONFORME",
  findings: [{ code: "MG_QUAL_01", status: "L5", evidenceCount: 1 }],
  ...congeladaYRevisada,
};

let evaluaciones: unknown[] = [];
const mutacion = () => ({ mutateAsync: async () => undefined, isPending: false });
const expedienteReal = await import("@/hooks/useAimsTechnicalFile");
const restaurar = await mockearModulos([
  ["@/hooks/useAiAssessments", () => ({
    useAllAssessments: () => ({ data: evaluaciones, isLoading: false, isError: false, error: null }),
  })],
  ["@/hooks/useAimsTechnicalFile", () => ({
    ...expedienteReal,
    useIniciarExpedienteTecnico: mutacion,
    useUpdateTechnicalFileSection: mutacion,
    useRegistrarVersion: mutacion,
  })],
]);
afterAll(restaurar);
afterEach(() => cleanup());

const { default: Evaluaciones } = await import("@/pages/ai-governance/Evaluaciones");
const { default: TabEvaluaciones } = await import("@/components/ai-governance/sistema/TabEvaluaciones");
const { default: TabExpedienteTecnico } = await import("@/components/ai-governance/sistema/TabExpedienteTecnico");
const { PrioridadAhora } = await import("@/components/ai-governance/dashboard/PrioridadAhora");

const montar = (el: ReturnType<typeof createElement>) => render(createElement(MemoryRouter, null, el));

describe("lista de evaluaciones", () => {
  const kpiAcreditadas = () => screen.getByText("Acreditadas (congeladas y revisadas)").previousElementSibling!.textContent;

  it("ARGA: un APROBADO sin congelar no acredita — KPI 0, rótulo en tabla y móvil, chip sin verde", () => {
    evaluaciones = [argaAprobada];
    montar(createElement(Evaluaciones));
    expect(kpiAcreditadas()).toBe("0");
    expect(screen.getAllByText("Legado demo, no acredita").length).toBe(2);
    const chips = screen.getAllByText("Aprobada (legado)").filter((e) => e.tagName === "SPAN");
    expect(chips.length).toBe(2);
    for (const c of chips) {
      expect(c.className).toContain("--status-warning");
      expect(c.className).not.toContain("--status-success");
    }
  });

  it("control positivo: una conforme, congelada y revisada, cuenta y no lleva rótulo", () => {
    evaluaciones = [firme];
    montar(createElement(Evaluaciones));
    expect(kpiAcreditadas()).toBe("1");
    expect(screen.queryByText(/no acredita/)).toBeNull();
    for (const c of screen.getAllByText("Conforme").filter((e) => e.tagName === "SPAN")) {
      expect(c.className).toContain("--status-success");
    }
  });
});

describe("pestaña de evaluaciones del sistema", () => {
  const nada = () => undefined;
  const sistema = { id: argaAprobada.system_id, name: "Motor de triaje", regulatory_profile: null } as never;

  it("rótulo de legado visible y chip de estado en aviso, no en éxito", () => {
    montar(createElement(TabEvaluaciones, { system: sistema, assessments: [argaAprobada] as never, onNueva: nada, onAbrir: nada }));
    expect(screen.getByText("Legado demo, no acredita")).toBeTruthy();
    const chip = screen.getByText("Aprobada (legado)");
    expect(chip.className).toContain("--status-warning");
  });

  it("control positivo: firme, sin rótulo y en verde", () => {
    montar(createElement(TabEvaluaciones, { system: sistema, assessments: [firme] as never, onNueva: nada, onAbrir: nada }));
    expect(screen.queryByText(/no acredita/)).toBeNull();
    expect(screen.getByText("Conforme").className).toContain("--status-success");
  });
});

describe("expediente técnico", () => {
  // Sección de ARGA leída en Cloud el 2026-09-19: «Conforme» con fecha de revisión y sin revisor.
  const aiv03 = {
    id: "sec-1",
    system_id: "s1",
    section_code: "AIV-03",
    title: "Supervisión, funcionamiento y control",
    status: "Conforme",
    reviewed_by_id: null,
    reviewed_at: "2026-04-24T00:00:00Z",
    evidence_refs: [],
    content: {},
  };
  const fecha = new Date(aiv03.reviewed_at).toLocaleDateString("es-ES");
  const props = (secciones: unknown[]) => ({
    systemId: "s1", rol: null, nivel: null, secciones: secciones as never, versiones: [], onClasificar: () => undefined,
  });

  it("«Conforme» sin revisor: rótulo de legado y ni «Revisada» ni la fecha", () => {
    montar(createElement(TabExpedienteTecnico, props([aiv03])));
    expect(screen.getByText("Legado demo, no acredita")).toBeTruthy();
    expect(screen.queryByText("Revisada")).toBeNull();
    expect(screen.queryByText(fecha)).toBeNull();
  });

  it("control positivo: con revisor, «Revisada» con su fecha y sin rótulo", () => {
    montar(createElement(TabExpedienteTecnico, props([{ ...aiv03, reviewed_by_id: "p-1" }])));
    expect(screen.getByText("Revisada")).toBeTruthy();
    expect(screen.getByText(fecha)).toBeTruthy();
    expect(screen.queryByText(/no acredita/)).toBeNull();
  });
});

describe("prioridad de la portada", () => {
  const base = {
    altosNoEvaluados: 6,
    materialIncidents: 0,
    activos: 4,
    totalSistemas: 8,
    totalIncidentes: 1,
    detalleInventario: "8 en inventario",
    conClasificacionGuiada: 0,
    loading: false,
  };
  const centinela = { label: "PASO-CENTINELA", detalle: "detalle del centinela", to: "/ai-governance/sistemas" };
  const valorAltos = () => screen.getByText("Alto riesgo sin autodiagnóstico acreditado").nextElementSibling!;

  it("pinta los pasos que recibe y ninguno más", () => {
    montar(createElement(PrioridadAhora, { ...base, nivelDeclarado: true, pasos: [centinela] }));
    const pasos = screen.getByText("Acciones del responsable AIMS").closest("div")!.parentElement!;
    const enlaces = within(pasos).getAllByRole("link");
    expect(enlaces.map((e) => e.textContent)).toEqual([`${centinela.label}${centinela.detalle}`]);
  });

  it("sin cuestionario, el «Alto» declarado se pinta neutro", () => {
    montar(createElement(PrioridadAhora, { ...base, nivelDeclarado: true, pasos: [] }));
    expect(valorAltos().className).toContain("text-[var(--g-text-secondary)]");
    expect(valorAltos().className).not.toContain("--status-error");
  });

  it("control positivo: con el nivel del cuestionario, seis sin acreditar van en rojo", () => {
    montar(createElement(PrioridadAhora, { ...base, nivelDeclarado: false, pasos: [] }));
    expect(valorAltos().className).toContain("--status-error");
  });
});
