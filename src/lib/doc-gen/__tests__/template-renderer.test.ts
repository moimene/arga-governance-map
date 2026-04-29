import { describe, expect, it } from "vitest";
import { extractVariableNames, renderTemplate } from "../template-renderer";

describe("template-renderer", () => {
  it("extrae variables usadas como parámetros de helpers y bloques", () => {
    const vars = extractVariableNames(`
      {{uppercase denominacion_social}}
      {{fechaES fecha_junta}}
      {{#if (eq tipo_junta "ORDINARIA")}}{{organo.nombre}}{{/if}}
      {{#each orden_dia}}{{descripcion_punto}}{{/each}}
    `);

    expect(vars).toEqual(expect.arrayContaining([
      "denominacion_social",
      "fecha_junta",
      "tipo_junta",
      "organo.nombre",
      "orden_dia",
    ]));
    expect(vars).not.toContain("uppercase");
    expect(vars).not.toContain("eq");
    expect(vars).not.toContain("descripcion_punto");
  });

  it("marca como no resueltas variables anidadas usadas por helpers", () => {
    const rendered = renderTemplate({
      template: "{{fechaES fecha_junta}} {{organo.nombre}}",
      variables: { organo: {} },
    });

    expect(rendered.ok).toBe(true);
    expect(rendered.unresolvedVariables).toEqual(expect.arrayContaining(["fecha_junta", "organo.nombre"]));
  });
});
