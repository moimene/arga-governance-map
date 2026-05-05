import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { mergeVariables } from "../variable-resolver";
import { renderTemplate } from "../template-renderer";
import { validatePostRenderDocument } from "@/lib/motor-plantillas/post-render-validation";

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

describe("template-renderer — Secretaría expanded coverage", () => {
  it("acta de junta universal declara aceptación unánime y omite bloque de convocatoria ordinaria", () => {
    const template = [
      "ACTA DE JUNTA GENERAL",
      "{{#if es_junta_universal}}Se declara junta universal con aceptación unánime de la celebración y del orden del día.{{else}}Convocatoria ordinaria publicada en {{canal_convocatoria}}.{{/if}}",
      "Acuerdo: {{agreement_id}}",
    ].join("\n");

    const rendered = renderTemplate({
      template,
      variables: {
        es_junta_universal: true,
        canal_convocatoria: "",
        agreement_id: "agr-universal-1",
      },
    });

    expect(rendered.ok).toBe(true);
    expect(rendered.text).toContain("junta universal con aceptación unánime");
    expect(rendered.text).not.toContain("Convocatoria ordinaria");
  });

  it("renderiza bloque cotizada solo para entidades cotizadas", () => {
    const template = [
      "CONVOCATORIA",
      "{{#if (eq entities.es_cotizada \"SÍ\")}}Canales de difusión pública. Procedimiento de preguntas. Voto a distancia.{{/if}}",
      "Orden del día: {{orden_dia_texto}}",
    ].join("\n");

    const cotizada = renderTemplate({
      template,
      variables: { entities: { es_cotizada: "SÍ" }, orden_dia_texto: "Aprobación de cuentas" },
    });
    const noCotizada = renderTemplate({
      template,
      variables: { entities: { es_cotizada: "NO" }, orden_dia_texto: "Aprobación de cuentas" },
    });

    expect(cotizada.ok).toBe(true);
    expect(cotizada.text).toContain("Canales de difusión pública");
    expect(cotizada.text).toContain("Voto a distancia");
    expect(noCotizada.ok).toBe(true);
    expect(noCotizada.text).not.toContain("Canales de difusión pública");
    expect(noCotizada.text).not.toContain("Voto a distancia");
  });

  it("omite bloque aprueba_reglamento sin romper si fecha_reglamento_vigente es null", () => {
    const template = [
      "COMITÉ INTERNO",
      "{{#if aprueba_reglamento}}Se aprueba el reglamento con fecha {{fecha_reglamento_vigente}}.{{/if}}",
      "Se adopta el acuerdo.",
    ].join("\n");

    const withReglamento = renderTemplate({
      template,
      variables: { aprueba_reglamento: true, fecha_reglamento_vigente: "2026-05-04" },
    });
    const withoutReglamento = renderTemplate({
      template,
      variables: { aprueba_reglamento: false, fecha_reglamento_vigente: null },
    });

    expect(withReglamento.text).toContain("Se aprueba el reglamento");
    expect(withoutReglamento.ok).toBe(true);
    expect(withoutReglamento.text).not.toContain("Se aprueba el reglamento");
    expect(withoutReglamento.text).not.toContain("{{fecha_reglamento_vigente}}");
  });

  it("mantiene numeración cuando sustituye_politica_anterior es false", () => {
    const template = [
      "PRIMERO. Aprobar la política.",
      "SEGUNDO. Ámbito de aplicación.",
      "TERCERO. Entrada en vigor.",
      "{{#if sustituye_politica_anterior}}CUARTO. Se sustituye la política anterior {{politica_anterior_ref}}.{{else}}CUARTO. No se sustituye ninguna política anterior.{{/if}}",
      "QUINTO. Facultar para ejecución.",
    ].join("\n");

    const rendered = renderTemplate({
      template,
      variables: { sustituye_politica_anterior: false, politica_anterior_ref: "" },
    });

    expect(rendered.ok).toBe(true);
    expect(rendered.text).toContain("CUARTO. No se sustituye ninguna política anterior.");
    expect(rendered.text).toContain("QUINTO. Facultar");
    expect(rendered.text).not.toContain("{{politica_anterior_ref}}");
  });

  it("omite cláusula de experto independiente si requiere_experto es false", () => {
    const template = [
      "PRIMERO. Aprobar la operación estructural.",
      "SEGUNDO. Régimen simplificado aplicable.",
      "{{#if requiere_experto}}TERCERO. Se incorpora informe de experto independiente.{{/if}}",
      "CUARTO. Ejecutar los actos necesarios.",
    ].join("\n");

    const rendered = renderTemplate({
      template,
      variables: { requiere_experto: false },
    });

    expect(rendered.ok).toBe(true);
    expect(rendered.text).not.toContain("TERCERO. Se incorpora informe de experto");
    expect(rendered.text).toContain("CUARTO. Ejecutar");
  });

  it("no deja variables Capa 3 opcionales como marcas literales", () => {
    const rendered = renderTemplate({
      template: "Base legal del comité: {{articulos_lsc_comite}}.\nAcuerdo adoptado.",
      variables: { articulos_lsc_comite: "" },
    });

    expect(rendered.ok).toBe(true);
    expect(rendered.text).not.toContain("{{articulos_lsc_comite}}");
    expect(rendered.unresolvedVariables).toContain("articulos_lsc_comite");
  });

  it("Capa 3 prevalece sobre Capa 2 cuando hay override manual", () => {
    const variables = mergeVariables(
      { consejero_nombre: "Valor auto-resuelto Capa 2", acuerdo_id: "agr-1" },
      { consejero_nombre: "Override manual Capa 3" },
    );
    const rendered = renderTemplate({
      template: "Se acuerda el nombramiento de {{consejero_nombre}} en expediente {{acuerdo_id}}.",
      variables,
    });

    expect(rendered.text).toContain("Override manual Capa 3");
    expect(rendered.text).not.toContain("Valor auto-resuelto Capa 2");
  });

  it("es idempotente si el sello QTSP se proporciona como input estable", () => {
    const template = [
      "ACTA DE JUNTA",
      "Snapshot: {{snapshot_hash}}",
      "QTSP: {{qtsp.sello_tiempo_ref}}",
      "{{#if qtsp.activo}}Proveedor: EAD Trust{{/if}}",
    ].join("\n");
    const variables = {
      snapshot_hash: "hash-acta-001",
      qtsp: { activo: true, sello_tiempo_ref: "TSQ-20260504103000000" },
    };

    const first = renderTemplate({ template, variables });
    const second = renderTemplate({ template, variables });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(first.text).toBe(second.text);
    expect(hash(first.text)).toBe(hash(second.text));
    expect(first.text).toContain("EAD Trust");
  });

  it("renderiza referencias QTSP EAD Trust solo cuando el bloque está activo", () => {
    const template = [
      "CERTIFICACIÓN",
      "{{#if qtsp.activo}}Firma secretario: {{QTSP.firma_secretario_ref}}. Firma presidente: {{QTSP.firma_presidente_ref}}. Sello de tiempo: {{QTSP.sello_tiempo_ref}}. QTSP: EAD Trust.{{/if}}",
      "Fin.",
    ].join("\n");

    const active = renderTemplate({
      template,
      variables: {
        qtsp: { activo: true },
        QTSP: {
          firma_secretario_ref: "QES-SECRETARIO-1",
          firma_presidente_ref: "QES-PRESIDENTE-1",
          sello_tiempo_ref: "TSQ-1",
        },
      },
    });
    const inactive = renderTemplate({
      template,
      variables: { qtsp: { activo: false }, QTSP: {} },
    });

    expect(active.text).toContain("QES-SECRETARIO-1");
    expect(active.text).toContain("QES-PRESIDENTE-1");
    expect(active.text).toContain("TSQ-1");
    expect(active.text).toContain("EAD Trust");
    expect(inactive.ok).toBe(true);
    expect(inactive.text).not.toContain("QES-");
    expect(inactive.text).not.toContain("EAD Trust");
  });

  it("convocatoria con fecha de primera convocatoria ausente genera aviso explícito post-render", () => {
    const template = [
      "CONVOCATORIA DE JUNTA",
      "ORDEN DEL DÍA: {{orden_dia_texto}}",
      "Fecha primera convocatoria: {{fecha_primera_convocatoria}}",
    ].join("\n");
    const rendered = renderTemplate({
      template,
      variables: { orden_dia_texto: "Aprobación de cuentas" },
    });
    const validation = validatePostRenderDocument({
      documentType: "CONVOCATORIA",
      renderedText: rendered.text,
      capa1Template: template,
      unresolvedVariables: rendered.unresolvedVariables,
      agreementIds: [],
    });

    expect(rendered.unresolvedVariables).toContain("fecha_primera_convocatoria");
    expect(validation.issues.some((issue) => issue.code === "UNRESOLVED_VARIABLES")).toBe(true);
  });

  it("acta sin lista de asistentes no falla en silencio: queda issue explícito", () => {
    const template = [
      "ACTA DE JUNTA GENERAL",
      "Anexo A - Lista de asistentes: {{lista_asistentes}}",
      "Acuerdo: {{agreement_id}}",
    ].join("\n");
    const rendered = renderTemplate({
      template,
      variables: { agreement_id: "agr-acta-1" },
    });
    const validation = validatePostRenderDocument({
      documentType: "ACTA",
      renderedText: rendered.text,
      capa1Template: template,
      unresolvedVariables: rendered.unresolvedVariables,
      agreementIds: ["agr-acta-1"],
    });

    expect(rendered.unresolvedVariables).toContain("lista_asistentes");
    expect(validation.issues.some((issue) => issue.field_path === "variables")).toBe(true);
  });

  it("certificación sin secretario certificante queda bloqueada por variable huérfana", () => {
    const template = [
      "CERTIFICACIÓN",
      "Certifica: {{certificante_role}}",
      "Acuerdo certificado: {{agreement_id}}",
    ].join("\n");
    const rendered = renderTemplate({
      template,
      variables: { agreement_id: "agr-cert-1" },
    });
    const validation = validatePostRenderDocument({
      documentType: "CERTIFICACION",
      renderedText: `${rendered.text}\n{{certificante_role}}`,
      capa1Template: template,
      unresolvedVariables: rendered.unresolvedVariables,
      agreementIds: ["agr-cert-1"],
    });

    expect(rendered.unresolvedVariables).toContain("certificante_role");
    expect(validation.ok).toBe(false);
    expect(validation.issues.some((issue) => issue.code === "ORPHAN_TEMPLATE_VARIABLES")).toBe(true);
  });

  it("SEGUROS_RESPONSABILIDAD renderiza bloque de conflicto intra-grupo solo si aplica", () => {
    const template = [
      "PRIMERO. Aprobar la póliza de responsabilidad.",
      "{{#if aseguradora_del_grupo}}SEGUNDO. Se documenta conflicto intra-grupo y soporte de mercado independiente.{{/if}}",
      "TERCERO. Facultar para ejecución.",
    ].join("\n");

    const intraGrupo = renderTemplate({
      template,
      variables: { aseguradora_del_grupo: true },
    });
    const externa = renderTemplate({
      template,
      variables: { aseguradora_del_grupo: false },
    });

    expect(intraGrupo.text).toContain("conflicto intra-grupo");
    expect(externa.text).not.toContain("conflicto intra-grupo");
    expect(externa.text).toContain("TERCERO. Facultar");
  });

  it("DISTRIBUCION_CARGOS omite secretario no consejero si el flag es false", () => {
    const template = [
      "PRIMERO. Distribuir cargos.",
      "{{#if existe_secretario_no_consejero}}CUARTO. Designar secretario no consejero: {{secretario_no_consejero_nombre}}.{{/if}}",
      "QUINTO. Elevar a público.",
    ].join("\n");

    const rendered = renderTemplate({
      template,
      variables: { existe_secretario_no_consejero: false, secretario_no_consejero_nombre: null },
    });

    expect(rendered.ok).toBe(true);
    expect(rendered.text).not.toContain("secretario no consejero");
    expect(rendered.text).toContain("QUINTO. Elevar");
  });

  it("DISTRIBUCION_CARGOS omite Código Buen Gobierno si la entidad no es cotizada", () => {
    const template = [
      "SEGUNDO. Nombrar presidente.",
      "{{#if entities.es_cotizada}}TERCERO. Se atiende el Código de Buen Gobierno CNMV.{{/if}}",
      "CUARTO. Cierre.",
    ].join("\n");

    const rendered = renderTemplate({
      template,
      variables: { entities: { es_cotizada: false } },
    });

    expect(rendered.text).not.toContain("Código de Buen Gobierno");
    expect(rendered.text).toContain("CUARTO. Cierre");
  });

  it("POLITICA_REMUNERACION no arrastra referencia de cotizada en variante no cotizada", () => {
    const template = [
      "PRIMERO. Aprobar política de remuneraciones.",
      "{{#if es_cotizada}}SEGUNDO. Se aprueba conforme al art. 529 novodecies LSC.{{else}}SEGUNDO. Se aprueba conforme al régimen general del art. 217 LSC.{{/if}}",
      "TERCERO. Vigencia.",
    ].join("\n");

    const rendered = renderTemplate({
      template,
      variables: { es_cotizada: false },
    });

    expect(rendered.text).toContain("art. 217 LSC");
    expect(rendered.text).not.toContain("529 novodecies");
  });

  it("COMITES_INTERNOS usa valor default y no deja placeholder literal", () => {
    const template = "Base normativa del comité: {{articulos_lsc_comite}}.";
    const rendered = renderTemplate({
      template,
      variables: { articulos_lsc_comite: "Reglamento interno del órgano y normativa aplicable" },
    });

    expect(rendered.ok).toBe(true);
    expect(rendered.text).toContain("Reglamento interno");
    expect(rendered.text).not.toContain("{{articulos_lsc_comite}}");
  });
});
