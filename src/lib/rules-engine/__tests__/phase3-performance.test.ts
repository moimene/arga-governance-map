import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import { renderTemplate } from "@/lib/doc-gen/template-renderer";
import { computeAttendanceWithDelegations, computeCapitalVotingWeights } from "../capital-voting";

describe("Fase 3 performance — capital y orden del día extenso", () => {
  it("cap_table de 500 socios calcula capital concurrente en menos de 2s", () => {
    const holdings = Array.from({ length: 500 }, (_, index) => ({
      holder_id: `socio-${index}`,
      numero_titulos: 1,
    }));

    const start = performance.now();
    const result = computeCapitalVotingWeights(holdings);
    const elapsed = performance.now() - start;

    expect(result.socialCapitalTitles).toBe(500);
    expect(result.quorumDenominator).toBe(500);
    expect(elapsed).toBeLessThan(2000);
  });

  it("votación por punto con 500 asistentes mantiene cálculo de delegaciones bajo 2s", () => {
    const holders = Array.from({ length: 500 }, (_, index) => ({
      holder_id: `socio-${index}`,
      capital: 1,
      present: index < 250,
    }));
    const delegations = Array.from({ length: 250 }, (_, index) => ({
      from_holder_id: `socio-${index + 250}`,
      to_representative_id: `socio-${index}`,
      capital: 1,
      delegacion_tipo: "PODER_ESCRITO" as const,
    }));

    const start = performance.now();
    const result = computeAttendanceWithDelegations({ holders, delegations });
    const elapsed = performance.now() - start;

    expect(result.concurrentCapital).toBe(500);
    expect(elapsed).toBeLessThan(2000);
  });

  it("acta con 20 puntos renderiza agreements.id sin truncamiento", () => {
    const puntos = Array.from({ length: 20 }, (_, index) => ({
      ordinal: index + 1,
      agreement_id: `agr-${String(index + 1).padStart(2, "0")}`,
      proclamacion: index % 2 === 0 ? "Aprobado" : "Rechazado",
    }));
    const template = [
      "ACTA DE JUNTA",
      "{{#each puntos}}Punto {{ordinal}} - {{agreement_id}} - {{proclamacion}}\n{{/each}}",
    ].join("\n");

    const rendered = renderTemplate({ template, variables: { puntos } });

    expect(rendered.ok).toBe(true);
    expect(rendered.text).toContain("agr-01");
    expect(rendered.text).toContain("agr-20");
    expect(rendered.text.match(/Punto/g)).toHaveLength(20);
  });

  it("certificación múltiple genera 20 referencias correctas", () => {
    const template = "CERTIFICACIÓN\nAcuerdo certificado: {{agreement_id}}\n";
    const rendered = Array.from({ length: 20 }, (_, index) =>
      renderTemplate({
        template,
        variables: { agreement_id: `agr-${String(index + 1).padStart(2, "0")}` },
      }).text
    );

    expect(rendered).toHaveLength(20);
    expect(rendered[0]).toContain("agr-01");
    expect(rendered[19]).toContain("agr-20");
  });
});
