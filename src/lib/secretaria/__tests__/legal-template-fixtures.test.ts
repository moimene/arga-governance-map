import { describe, expect, it } from "vitest";
import { renderTemplate, validateTemplate } from "@/lib/doc-gen/template-renderer";
import { expandLegalStructuredVariables } from "../legal-template-normalizer";
import { LEGAL_TEAM_TEMPLATE_FIXTURES, withLegalTeamTemplateFixtures } from "../legal-template-fixtures";

describe("legal-template-fixtures", () => {
  it("incluye los modelos Word base convertidos a Handlebars locales", () => {
    expect(LEGAL_TEAM_TEMPLATE_FIXTURES.map((template) => template.id)).toEqual([
      "legal-fixture-convocatoria-junta-es",
      "legal-fixture-convocatoria-consejo-es",
      "legal-fixture-acta-junta-es",
      "legal-fixture-acta-consejo-es",
      "legal-fixture-acta-consignacion-socio-unico-es",
      "legal-fixture-acta-consignacion-admin-unico-es",
      "legal-fixture-acta-acuerdo-escrito-sin-sesion-es",
      "legal-fixture-acta-decision-conjunta-es",
      "legal-fixture-acta-organo-admin-solidario-es",
      "legal-fixture-certificacion-es",
      "legal-fixture-informe-preceptivo-es",
      "legal-fixture-informe-documental-pre-es",
      "legal-fixture-documento-registral-es",
      "legal-fixture-subsanacion-registral-es",
    ]);

    for (const template of LEGAL_TEAM_TEMPLATE_FIXTURES) {
      expect(template.estado).toBe("ACTIVA");
      expect(template.notas_legal).toContain("Fixture local");
      expect(validateTemplate(template.capa1_inmutable ?? "").ok).toBe(true);
    }
  });

  it("no duplica fixtures si ya existen en la lista runtime", () => {
    const merged = withLegalTeamTemplateFixtures([LEGAL_TEAM_TEMPLATE_FIXTURES[0]]);

    expect(merged.filter((template) => template.id === "legal-fixture-convocatoria-junta-es")).toHaveLength(1);
    expect(merged).toHaveLength(LEGAL_TEAM_TEMPLATE_FIXTURES.length);
  });

  it("renderiza una acta de consejo desde campos Capa 3 multilinea", () => {
    const actaConsejo = LEGAL_TEAM_TEMPLATE_FIXTURES.find(
      (template) => template.id === "legal-fixture-acta-consejo-es",
    );

    const variables = expandLegalStructuredVariables({
      denominacion_social: "ARGA Seguros, S.A.",
      ciudad_emision: "Madrid",
      fecha: "28/04/2026",
      hora_inicio: "10:00",
      hora_fin: "11:15",
      lugar: "Domicilio social",
      presidente: "Presidenta",
      secretario: "Secretario",
      miembros_presentes_texto: "Consejera A\nConsejero B",
      orden_dia_texto: "Formulacion de cuentas\nConvocatoria de junta",
      acuerdos_texto: "Se formulan las cuentas\nSe convoca la junta",
    });

    const rendered = renderTemplate({
      template: actaConsejo?.capa1_inmutable ?? "",
      variables,
    });

    expect(rendered.ok).toBe(true);
    expect(rendered.unresolvedVariables).toEqual([]);
    expect(rendered.text).toContain("ACTA DEL CONSEJO DE ADMINISTRACION");
    expect(rendered.text).toContain("1. Formulacion de cuentas");
    expect(rendered.text).toContain("2. Se convoca la junta");
    expect(rendered.text).toContain("Consejera A");
  });

  it("renderiza consignacion unipersonal y acuerdo escrito sin sesion con variables Capa 3", () => {
    const socioUnico = LEGAL_TEAM_TEMPLATE_FIXTURES.find(
      (template) => template.id === "legal-fixture-acta-consignacion-socio-unico-es",
    );
    const sinSesion = LEGAL_TEAM_TEMPLATE_FIXTURES.find(
      (template) => template.id === "legal-fixture-acta-acuerdo-escrito-sin-sesion-es",
    );

    const decision = renderTemplate({
      template: socioUnico?.capa1_inmutable ?? "",
      variables: expandLegalStructuredVariables({
        denominacion_social: "ARGA Servicios, S.L.U.",
        ciudad_emision: "Madrid",
        fecha: "28/04/2026",
        identidad_decisor: "ARGA Seguros, S.A.",
        nif_decisor: "A00000000",
        texto_decision: "Se aprueban las cuentas anuales.",
        firma_qes_ref: "QES-1",
      }),
    });

    const escrito = renderTemplate({
      template: sinSesion?.capa1_inmutable ?? "",
      variables: expandLegalStructuredVariables({
        denominacion_social: "ARGA Capital, S.L.",
        ciudad_emision: "Madrid",
        fecha_cierre: "28/04/2026",
        tipo_proceso: "CIRCULACION_CONSEJO",
        propuesta_texto: "Aprobar la operacion.",
        relacion_respuestas_texto: "Consejera A - A favor - 28/04/2026\nConsejero B - A favor - 28/04/2026",
        condicion_adopcion: "Mayoría suficiente.",
        texto_decision: "Se aprueba la operacion.",
        expediente_hash: "hash-expediente",
        firma_qes_ref: "QES-2",
      }),
    });

    expect(decision.ok).toBe(true);
    expect(decision.unresolvedVariables).toEqual([]);
    expect(decision.text).toContain("DECISION DEL SOCIO UNICO");
    expect(escrito.ok).toBe(true);
    expect(escrito.unresolvedVariables).toEqual([]);
    expect(escrito.text).toContain("ACTA DE ACUERDO ESCRITO SIN SESION");
    expect(escrito.text).toContain("Consejera A - A favor - 28/04/2026");
  });

  it("renderiza informes PRE y documentos registrales con listas documentales", () => {
    const informePre = LEGAL_TEAM_TEMPLATE_FIXTURES.find(
      (template) => template.id === "legal-fixture-informe-preceptivo-es",
    );
    const registral = LEGAL_TEAM_TEMPLATE_FIXTURES.find(
      (template) => template.id === "legal-fixture-documento-registral-es",
    );

    const informe = renderTemplate({
      template: informePre?.capa1_inmutable ?? "",
      variables: expandLegalStructuredVariables({
        denominacion_social: "ARGA Seguros, S.A.",
        organo_nombre: "Consejo de Administración",
        materia_acuerdo: "FORMULACION_CUENTAS",
        fecha: "28/04/2026",
        objeto_informe: "Validar documentacion previa.",
        fundamento_legal: "Art. 253 LSC.",
        comprobaciones_texto: "Reglas LSC revisadas\nEstatutos revisados",
        conclusion_informe: "Puede continuarse con advertencias.",
        resultado_gate: "WARNING",
        resultado_evaluacion: "Recordatorio documental.",
        snapshot_hash: "hash-demo",
      }),
    });

    const documento = renderTemplate({
      template: registral?.capa1_inmutable ?? "",
      variables: expandLegalStructuredVariables({
        denominacion_social: "ARGA Seguros, S.A.",
        materia_acuerdo: "NOMBRAMIENTO_AUDITOR",
        modo_adopcion: "MEETING",
        estado_acuerdo: "Certificado",
        instrumento_requerido: "ESCRITURA",
        tipo_presentacion: "SIGER",
        datos_presentacion: "asiento 1/2026",
        texto_decision: "Se nombra auditor.",
        documentacion_texto: "Certificación firmada\nEscritura pública",
        observaciones_registrales: "Sin observaciones.",
        agreement_id: "00000000-0000-0000-0000-000000000001",
        certificacion_id: "cert-1",
        snapshot_hash: "hash-demo",
      }),
    });

    expect(informe.ok).toBe(true);
    expect(informe.unresolvedVariables).toEqual([]);
    expect(informe.text).toContain("Reglas LSC revisadas");
    expect(documento.ok).toBe(true);
    expect(documento.unresolvedVariables).toEqual([]);
    expect(documento.text).toContain("Certificación firmada");
    expect(documento.text).toContain("Agreement ID");
  });
});
