import { describe, expect, it } from "vitest";
import {
  expandLegalVariableAliases,
  expandLegalStructuredVariables,
  findMissingLegalTemplateVariables,
  legalListBlockFor,
  normalizeLegalCode,
  normalizeLegalPlaceholderKey,
  normalizeLegalTemplateText,
  resolveLegalCodeEquivalence,
} from "../legal-template-normalizer";

describe("legal-template-normalizer", () => {
  it("normaliza placeholders legales con acentos, mayusculas y numeracion dinamica", () => {
    const result = normalizeLegalTemplateText(
      "En [NOMBRE DE LA SOCIEDAD], se trata [Punto 1 del orden del día] y se firma en [Fecha de emisión].",
    );

    expect(result.template).toContain("{{denominacion_social}}");
    expect(result.template).toContain("{{orden_dia}}");
    expect(result.template).toContain("{{fecha_emision}}");
    expect(result.replacements.map((replacement) => replacement.normalizedKey)).toEqual([
      "nombre_de_la_sociedad",
      "punto_x_del_orden_del_dia",
      "fecha_de_emision",
    ]);
  });

  it("mantiene placeholders manuales como pendientes editables, no como mapping inventado", () => {
    const result = normalizeLegalTemplateText("Condiciones: [detalle]. Firmante: [persona/s].");

    expect(result.template).toBe("Condiciones: [detalle]. Firmante: [persona/s].");
    expect(result.unresolvedPlaceholders).toEqual(["detalle", "persona/s"]);
    expect(result.manualPlaceholders).toEqual(["detalle", "persona/s"]);
  });

  it("expande alias entre variables canonicas y nombres legacy de plantillas", () => {
    const fromLegacy = expandLegalVariableAliases({
      empresa_nombre: "ARGA Seguros, S.A.",
      quorum_observado: "68%",
      asistentes_lista: ["Consejera A"],
    });

    expect(fromLegacy.denominacion_social).toBe("ARGA Seguros, S.A.");
    expect(fromLegacy.porcentaje_capital_presente).toBe("68%");
    expect(fromLegacy.miembros_presentes).toEqual(["Consejera A"]);

    const fromCanonical = expandLegalVariableAliases({
      denominacion_social: "ARGA Capital, S.L.",
      porcentaje_capital_presente: "51%",
    });

    expect(fromCanonical.empresa_nombre).toBe("ARGA Capital, S.L.");
    expect(fromCanonical.quorum_observado).toBe("51%");
  });

  it("convierte textos multilinea de Capa 3 en listas estructuradas para Handlebars", () => {
    const expanded = expandLegalStructuredVariables({
      orden_dia_texto: "1. Formulacion de cuentas\n2. Convocatoria de junta",
      acuerdos_texto: "- Se formulan las cuentas\n- Se aprueba la convocatoria",
      asistentes_texto: "Consejera A\nConsejero B",
      relacion_respuestas_texto: "Consejera A - A favor\nConsejero B - A favor",
      documentacion_texto: "Certificacion firmada\nEscritura publica",
      comprobaciones_texto: "Quorum revisado\nMayoría revisada",
    });

    expect(expanded.orden_dia).toEqual([
      { ordinal: "1", descripcion_punto: "Formulacion de cuentas" },
      { ordinal: "2", descripcion_punto: "Convocatoria de junta" },
    ]);
    expect(expanded.acuerdos).toEqual([
      { ordinal: "1", texto: "Se formulan las cuentas" },
      { ordinal: "2", texto: "Se aprueba la convocatoria" },
    ]);
    expect(expanded.miembros_presentes).toEqual([
      { nombre: "Consejera A" },
      { nombre: "Consejero B" },
    ]);
    expect(expanded.relacion_respuestas).toEqual([
      { nombre: "Consejera A - A favor" },
      { nombre: "Consejero B - A favor" },
    ]);
    expect(expanded.documentacion).toEqual([
      { descripcion: "Certificacion firmada" },
      { descripcion: "Escritura publica" },
    ]);
    expect(expanded.comprobaciones).toEqual([
      { descripcion: "Quorum revisado" },
      { descripcion: "Mayoría revisada" },
    ]);
  });

  it("expande alias de pantallas operativas hacia variables canonicas documentales", () => {
    const expanded = expandLegalVariableAliases({
      contenido_acuerdo: "Se aprueba la operacion.",
      decisor: "ARGA Seguros, S.A.",
      fecha_decision: "2026-04-28",
      organo_convocante: "Consejo de Administracion",
    });

    expect(expanded.texto_decision).toBe("Se aprueba la operacion.");
    expect(expanded.identidad_decisor).toBe("ARGA Seguros, S.A.");
    expect(expanded.fecha).toBe("2026-04-28");
    expect(expanded.organo_nombre).toBe("Consejo de Administracion");
  });

  it("resuelve variables pendientes tras normalizar placeholders legales y alias", () => {
    const missing = findMissingLegalTemplateVariables(
      "[Nombre de la sociedad] adopta acuerdo en [Lugar de celebración].",
      {
        empresa_nombre: "ARGA Seguros, S.A.",
        lugar_reunion: "Madrid",
      },
    );

    expect(missing).toEqual([]);
  });

  it("expone bloques dinamicos sin exigir campos internos como variables raiz", () => {
    const template = [
      "Orden del dia:",
      legalListBlockFor("orden_dia"),
      "Acuerdos:",
      legalListBlockFor("acuerdos"),
    ].join("\n");

    expect(template).toContain("{{#each orden_dia}}");
    expect(template).toContain("{{#each acuerdos}}");

    expect(
      findMissingLegalTemplateVariables(template, {
        orden_dia: [{ ordinal: "Primero", descripcion_punto: "Formulacion de cuentas" }],
        acuerdos: [{ ordinal: "Primero", texto: "Se formula" }],
      }),
    ).toEqual([]);

    expect(findMissingLegalTemplateVariables(template, {})).toEqual(["orden_dia", "acuerdos"]);
  });

  it("normaliza codigos legales equivalentes sin perder rutas juridicas criticas", () => {
    expect(normalizeLegalCode("J1")).toBe("J-01");
    expect(normalizeLegalCode("J01")).toBe("J-01");
    expect(normalizeLegalCode("CA3")).toBe("CA-03");

    expect(resolveLegalCodeEquivalence("J01")?.canonicalMaterias).toEqual([
      "APROBACION_CUENTAS",
      "APLICACION_RESULTADO",
    ]);
    expect(resolveLegalCodeEquivalence("J-04")?.catalogRefs).toContain("J9");
    expect(resolveLegalCodeEquivalence("J-07")?.catalogRefs).toContain("J14");
    expect(resolveLegalCodeEquivalence("J-08")?.note).toContain("160.f");
    expect(resolveLegalCodeEquivalence("CA-03")?.catalogRefs).toEqual(["CA-11", "J21"]);
    expect(resolveLegalCodeEquivalence("CA-05")?.catalogRefs).toEqual([]);
    expect(resolveLegalCodeEquivalence("CA-08")?.catalogRefs).toEqual([]);
    expect(resolveLegalCodeEquivalence("CA-09")?.catalogRefs).toEqual([]);
  });

  it("normaliza claves auxiliares usadas por documentos del equipo legal", () => {
    expect(normalizeLegalPlaceholderKey("D./D.a Secretario de la Junta")).toBe("secretario_de_la_junta");
    expect(normalizeLegalPlaceholderKey("Relación de asistentes")).toBe("relacion_de_asistentes");
  });
});
