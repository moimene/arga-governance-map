// src/lib/doc-gen/__tests__/dotted-placeholder-rendering.test.ts
/**
 * H6 (human pre-merge review): documenta el contrato actual del renderer
 * Handlebars frente a placeholders punteados como {{entities.name}}.
 *
 * Contexto del hallazgo: el reviewer observó que un futuro paquete "plantillas
 * v2 SQL" podría introducir placeholders dotted ({{entities.name}}) en capa1.
 * El resolver guarda los valores resueltos como CLAVE PLANA values["entities.name"]
 * (ver variable-resolver.ts línea ~677), pero Handlebars navega objetos anidados
 * para placeholders punteados (busca context.entities.name, NO context["entities.name"]).
 *
 * Este test documenta el comportamiento actual y guía v2.1+:
 * - Si el renderer resuelve dotted via objeto anidado → bloque OK
 * - Si NO resuelve → es deuda v2.1 (necesita normalización dotPathToNestedObject)
 *
 * v2.0 status: las 41 plantillas canónicas usan placeholders planos
 * ({{denominacion_social}}, {{cif}}, etc.), NO dotted. Por tanto este gap
 * NO bloquea v2.0 ni rompe ninguna plantilla existente. Documentado para
 * v2.1+ cuando se introduzcan dotted placeholders.
 */
import { describe, expect, it } from "vitest";
import { renderTemplate } from "../template-renderer";

describe("renderer + placeholders punteados (H6 contract documentation)", () => {
  it("renderiza correctamente cuando context tiene OBJETO ANIDADO entities.name", () => {
    // Caso esperado: si el resolver entrega objeto anidado, render funciona
    const rendered = renderTemplate({
      template: "Convocatoria de {{entities.name}}",
      variables: { entities: { name: "ARGA Seguros" } },
    });
    expect(rendered.text).toContain("ARGA Seguros");
  });

  it("NO renderiza cuando context tiene CLAVE PLANA 'entities.name' (gap v2.1)", () => {
    // Caso del gap: si el resolver entrega clave plana (como hoy),
    // Handlebars busca el path entities.name y no lo encuentra.
    const rendered = renderTemplate({
      template: "Convocatoria de {{entities.name}}",
      variables: { "entities.name": "ARGA Seguros" },
    });
    // Documenta el comportamiento actual: NO renderiza el valor plano dotted
    expect(rendered.text).not.toContain("ARGA Seguros");
  });

  it("placeholders planos (sin punto) renderizan desde claves planas — patrón v2.0", () => {
    // Las 41 plantillas canónicas v2.0 usan este patrón. Confirma que sigue funcionando.
    const rendered = renderTemplate({
      template: "Convocatoria de {{denominacion_social}}",
      variables: { denominacion_social: "ARGA Seguros" },
    });
    expect(rendered.text).toContain("ARGA Seguros");
  });

  it("documenta deuda v2.1: necesita dotPathToNestedObject() o cambio de contrato", () => {
    // Si v2.1+ introduce plantillas dotted en capa1, debe haber:
    // (a) helper dotPathToNestedObject() que convierta { "a.b": v } → { a: { b: v } }
    //     antes del render, O
    // (b) cambio de contrato: el resolver entrega objeto anidado, no clave plana
    // Esta línea es un assertion-marker — falla si alguien implementa la solución
    // sin actualizar este test, lo que fuerza revisar este contrato a la vez.
    const rendered = renderTemplate({
      template: "{{entities.name}}",
      variables: { "entities.name": "TEST" },
    });
    expect(rendered.text.trim()).toBe(""); // hoy: no renderiza. v2.1+: debe renderizar "TEST"
  });
});
