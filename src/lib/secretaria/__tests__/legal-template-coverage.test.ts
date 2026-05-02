import { describe, expect, it } from "vitest";
import type { PlantillaProtegidaRow } from "@/hooks/usePlantillasProtegidas";
import { buildLegalTemplateCoverage } from "../legal-template-coverage";

function template(patch: Partial<PlantillaProtegidaRow> & Pick<PlantillaProtegidaRow, "id" | "tipo" | "estado">) {
  return {
    id: patch.id,
    tenant_id: "tenant",
    tipo: patch.tipo,
    materia: null,
    jurisdiccion: patch.jurisdiccion ?? "ES",
    version: "1.0.0",
    estado: patch.estado,
    aprobada_por: null,
    fecha_aprobacion: null,
    contenido_template: null,
    capa1_inmutable: patch.capa1_inmutable ?? "contenido",
    capa2_variables: null,
    capa3_editables: null,
    referencia_legal: null,
    notas_legal: null,
    variables: [],
    protecciones: {},
    snapshot_rule_pack_required: true,
    adoption_mode: null,
    organo_tipo: patch.organo_tipo ?? null,
    contrato_variables_version: null,
    created_at: "2026-04-29T00:00:00.000Z",
    materia_acuerdo: null,
    approval_checklist: null,
    version_history: null,
    ...patch,
  } as PlantillaProtegidaRow;
}

describe("legal-template-coverage", () => {
  it("marca Cloud activa por familia de organo aunque el tipo sea CDA", () => {
    const rows = buildLegalTemplateCoverage([
      template({
        id: "cloud-consejo",
        tipo: "CONVOCATORIA",
        estado: "ACTIVA",
        organo_tipo: "CDA",
      }),
    ]);

    const consejo = rows.find((row) => row.key === "convocatoria-consejo");
    expect(consejo?.state).toBe("cloud_active");
    expect(consejo?.activeCloudCount).toBe(1);
    expect(consejo?.cloudTemplateIds).toEqual(["cloud-consejo"]);
  });

  it("usa fixture local como puente cuando no hay plantilla Cloud", () => {
    const rows = buildLegalTemplateCoverage([]);

    expect(rows.find((row) => row.key === "acta-consejo")?.state).toBe("fixture_pending_load");
    expect(rows.find((row) => row.key === "acta-consejo")?.fixtureTemplateId).toBe("legal-fixture-acta-consejo-es");
    expect(rows.find((row) => row.key === "informe-preceptivo")?.state).toBe("fixture_pending_load");
    expect(rows.find((row) => row.key === "documento-registral")?.fixtureTemplateId).toBe("legal-fixture-documento-registral-es");
    expect(rows.find((row) => row.key === "modelo-acuerdo")?.state).toBe("missing");
  });

  it("distingue plantilla Cloud pendiente de fixture local", () => {
    const rows = buildLegalTemplateCoverage([
      template({
        id: "draft-cert",
        tipo: "CERTIFICACION",
        estado: "BORRADOR",
      }),
    ]);

    const cert = rows.find((row) => row.key === "certificacion");
    expect(cert?.state).toBe("cloud_pending");
    expect(cert?.pendingCloudCount).toBe(1);
    expect(cert?.fixtureAvailable).toBe(true);
  });

  it("filtra por jurisdiccion cuando hay sociedad en contexto", () => {
    const rows = buildLegalTemplateCoverage([
      template({
        id: "pt-acta",
        tipo: "ACTA_SESION",
        estado: "ACTIVA",
        jurisdiccion: "PT",
        organo_tipo: "JUNTA_GENERAL",
      }),
    ], { jurisdiction: "ES" });

    const junta = rows.find((row) => row.key === "acta-junta");
    expect(junta?.state).toBe("fixture_pending_load");
    expect(junta?.cloudTemplateIds).toEqual([]);
  });

  it("distingue cobertura Cloud por modo de adopcion para actas de consignacion", () => {
    const rows = buildLegalTemplateCoverage([
      template({
        id: "cloud-admin-unico",
        tipo: "ACTA_CONSIGNACION",
        estado: "ACTIVA",
        adoption_mode: "UNIPERSONAL_ADMIN",
      }),
    ]);

    const admin = rows.find((row) => row.key === "acta-consignacion-admin-unico");
    const socio = rows.find((row) => row.key === "acta-consignacion-socio-unico");
    expect(admin?.state).toBe("cloud_active");
    expect(admin?.cloudTemplateIds).toEqual(["cloud-admin-unico"]);
    expect(socio?.state).toBe("fixture_pending_load");
    expect(socio?.cloudTemplateIds).toEqual([]);
  });

  it("expone fixtures locales pendientes de carga para CO_APROBACION y SOLIDARIO", () => {
    const rows = buildLegalTemplateCoverage([]);

    expect(rows.find((row) => row.key === "acta-co-aprobacion")?.state).toBe("fixture_pending_load");
    expect(rows.find((row) => row.key === "acta-co-aprobacion")?.fixtureTemplateId).toBe(
      "legal-fixture-acta-decision-conjunta-es"
    );
    expect(rows.find((row) => row.key === "acta-solidario")?.state).toBe("fixture_pending_load");
    expect(rows.find((row) => row.key === "acta-solidario")?.fixtureTemplateId).toBe(
      "legal-fixture-acta-organo-admin-solidario-es"
    );
  });
});
