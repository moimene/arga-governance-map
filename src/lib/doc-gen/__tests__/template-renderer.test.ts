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

  // ================================================================
  // Codex P1 PR #3: contrato `orden_dia` debe ser array, no string.
  // Las plantillas reales (migration 20260419_000009_cobertura_es_100)
  // hacen `{{#each orden_dia}}{{ordinal}}. {{descripcion_punto}}{{/each}}`.
  // ================================================================
  describe("contrato orden_dia / destinatarios_lista — array required (Codex P1)", () => {
    it("orden_dia como array de objetos renderiza puntos correctamente", () => {
      const rendered = renderTemplate({
        template: "{{#each orden_dia}}{{ordinal}}. {{descripcion_punto}}\n{{/each}}",
        variables: {
          orden_dia: [
            { ordinal: 1, descripcion_punto: "Aprobación cuentas 2025" },
            { ordinal: 2, descripcion_punto: "Reparto dividendos" },
            { ordinal: 3, descripcion_punto: "Nombramiento auditor" },
          ],
        },
      });
      expect(rendered.ok).toBe(true);
      expect(rendered.text).toContain("1. Aprobación cuentas 2025");
      expect(rendered.text).toContain("2. Reparto dividendos");
      expect(rendered.text).toContain("3. Nombramiento auditor");
    });

    it("orden_dia como string newline-delimited produce bloque vacío (anti-regresión)", () => {
      const rendered = renderTemplate({
        template: "INICIO\n{{#each orden_dia}}{{ordinal}}. {{descripcion_punto}}\n{{/each}}FIN",
        variables: {
          orden_dia: "1. Aprobación cuentas\n2. Dividendos\n",
        },
      });
      // Handlebars itera caracter por caracter — produce ruido vacío, sin
      // ordinal ni descripcion_punto. El bloque queda visualmente "perdido"
      // pero no crashea. Este test documenta que ese shape NO sirve.
      expect(rendered.ok).toBe(true);
      expect(rendered.text).not.toContain("1. Aprobación");
      expect(rendered.text).not.toContain("2. Dividendos");
    });

    it("destinatarios_lista como array renderiza nombres correctamente", () => {
      const rendered = renderTemplate({
        template: "{{#each destinatarios_lista}}- {{nombre}}\n{{/each}}",
        variables: {
          destinatarios_lista: [
            { nombre: "María García", email: "m@arga.es", rol: "PRESIDENTE" },
            { nombre: "Juan Pérez", email: "j@arga.es", rol: "CONSEJERO" },
          ],
        },
      });
      expect(rendered.ok).toBe(true);
      expect(rendered.text).toContain("María García");
      expect(rendered.text).toContain("Juan Pérez");
    });

    it("orden_dia con propuesta_acuerdo condicional renderiza solo para DECISORIO", () => {
      const rendered = renderTemplate({
        template:
          "{{#each orden_dia}}{{ordinal}}. {{descripcion_punto}}\n" +
          "{{#if propuesta_acuerdo}}Propuesta: {{propuesta_acuerdo}}\n{{/if}}{{/each}}",
        variables: {
          orden_dia: [
            { ordinal: 1, descripcion_punto: "Informe gestión", kind: "INFORMATIVO", propuesta_acuerdo: null },
            { ordinal: 2, descripcion_punto: "Acuerdo X", kind: "DECISORIO", propuesta_acuerdo: "Texto íntegro acuerdo" },
          ],
        },
      });
      expect(rendered.ok).toBe(true);
      expect(rendered.text).toContain("1. Informe gestión");
      expect(rendered.text).toContain("2. Acuerdo X");
      expect(rendered.text).toContain("Propuesta: Texto íntegro acuerdo");
      // El punto 1 NO debe llevar bloque "Propuesta:" porque propuesta_acuerdo=null
      const occurrences = (rendered.text.match(/Propuesta:/g) ?? []).length;
      expect(occurrences).toBe(1);
    });
  });
});
