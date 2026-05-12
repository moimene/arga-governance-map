// scripts/__tests__/audit-entity-settings-keys-regex.test.ts
/**
 * H8 (human pre-merge review): el regex del audit script debe detectar
 * ENTIDAD.<key> y entities.<key> donde quiera que aparezcan en capa1_inmutable,
 * NO sólo en interpolación directa {{ENTIDAD.x}}. El patrón principal de v2
 * es {{#if (eq ENTIDAD.es_cotizada "SÍ")}}...{{/if}}; el regex anterior
 * anchored to {{...}} dejaba pasar typos en condicionales.
 *
 * Estos tests aseguran que el regex permisivo cubre los patrones reales de
 * Handlebars que aparecen en v2 capa1.
 */
import { describe, expect, it } from "vitest";

// Reproduce el regex del script (no exportado — duplicación intencional para
// evitar acoplamiento del test al runtime del script CLI).
const ENTITY_KEY_REGEX = /(?:ENTIDAD|entities)\.([a-zA-Z0-9_]+)(?=[^a-zA-Z0-9_.]|$)/g;

function extractKeys(template: string): Set<string> {
  const keys = new Set<string>();
  for (const m of template.matchAll(ENTITY_KEY_REGEX)) {
    keys.add(m[1]);
  }
  return keys;
}

describe("audit-entity-settings-keys regex (H8)", () => {
  it("matches direct interpolation {{ENTIDAD.x}}", () => {
    expect(extractKeys("Hello {{ENTIDAD.cargo_secretario_label}}")).toEqual(
      new Set(["cargo_secretario_label"]),
    );
  });

  it("matches direct interpolation {{entities.x}}", () => {
    expect(extractKeys("Hello {{entities.name}}")).toEqual(new Set(["name"]));
  });

  it("matches inside (eq ENTIDAD.x ...) subexpression — main v2 pattern", () => {
    const template = '{{#if (eq ENTIDAD.es_cotizada "SÍ")}}Cotizada{{/if}}';
    expect(extractKeys(template)).toEqual(new Set(["es_cotizada"]));
  });

  it("matches inside {{#if ENTIDAD.x}} block helper", () => {
    const template = "{{#if ENTIDAD.tiene_reglamento_consejo}}Reglamento{{/if}}";
    expect(extractKeys(template)).toEqual(new Set(["tiene_reglamento_consejo"]));
  });

  it("matches inside {{#unless ENTIDAD.x}} block helper", () => {
    expect(extractKeys("{{#unless ENTIDAD.es_cotizada}}No cotizada{{/unless}}")).toEqual(
      new Set(["es_cotizada"]),
    );
  });

  it("matches inside {{#each ENTIDAD.x}} iteration", () => {
    expect(extractKeys("{{#each ENTIDAD.lista}}{{/each}}")).toEqual(new Set(["lista"]));
  });

  it("matches inside {{lookup ENTIDAD.x ...}} helper", () => {
    expect(extractKeys('{{lookup ENTIDAD.cargo_secretario_label "default"}}')).toEqual(
      new Set(["cargo_secretario_label"]),
    );
  });

  it("matches multiple distinct keys in same template", () => {
    const template = `
      {{#if (eq ENTIDAD.es_cotizada "SÍ")}}
        Cotizada en {{ENTIDAD.regulador_principal}}.
      {{/if}}
      {{#unless ENTIDAD.tiene_reglamento_consejo}}
        Sin reglamento.
      {{/unless}}
      Por: {{entities.name}}
    `;
    expect(extractKeys(template)).toEqual(
      new Set(["es_cotizada", "regulador_principal", "tiene_reglamento_consejo", "name"]),
    );
  });

  it("does NOT match identifier prefixes like ENTIDADX or entitiesX", () => {
    expect(extractKeys("{{ENTIDADX.foo}} {{entitiesY.bar}}")).toEqual(new Set());
  });

  it("does NOT match nested .property.subproperty (catalog v2.0 only top-level keys)", () => {
    // ENTIDAD.foo.bar → no match because after "foo" comes "." which fails
    // the lookahead [^a-zA-Z0-9_.]. v2.0 catalog only stores top-level keys
    // (nested paths are out of scope; plantillas v2 deben referenciar
    // ENTIDAD.<top_level_key> directamente). Si v2.1+ introduce nested,
    // este test debe actualizarse y el regex también.
    expect(extractKeys("{{ENTIDAD.foo.bar}}")).toEqual(new Set());
  });
});
