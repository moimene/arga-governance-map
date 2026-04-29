import { describe, expect, it } from "vitest";
import type { PlantillaProtegidaRow } from "@/hooks/usePlantillasProtegidas";
import { getTemplateUsageTarget } from "../template-routing";

function template(patch: Partial<PlantillaProtegidaRow> & Pick<PlantillaProtegidaRow, "id" | "tipo">) {
  return {
    id: patch.id,
    tenant_id: "tenant",
    tipo: patch.tipo,
    materia: null,
    jurisdiccion: "ES",
    version: "1.0.0",
    estado: "ACTIVA",
    aprobada_por: null,
    fecha_aprobacion: null,
    contenido_template: null,
    capa1_inmutable: "contenido",
    capa2_variables: null,
    capa3_editables: null,
    referencia_legal: null,
    notas_legal: null,
    variables: [],
    protecciones: {},
    snapshot_rule_pack_required: true,
    adoption_mode: null,
    organo_tipo: null,
    contrato_variables_version: null,
    created_at: "2026-04-29T00:00:00.000Z",
    materia_acuerdo: null,
    approval_checklist: null,
    version_history: null,
    ...patch,
  } as PlantillaProtegidaRow;
}

describe("template-routing", () => {
  it("dirige modelos de acuerdo al tramitador con la materia canonica", () => {
    const target = getTemplateUsageTarget(
      template({
        id: "modelo-cuentas",
        tipo: "MODELO_ACUERDO",
        materia_acuerdo: "APROBACION_CUENTAS",
      }),
    );

    expect(target.to).toBe("/secretaria/tramitador/nuevo?materia=APROBACION_CUENTAS&plantilla=modelo-cuentas");
    expect(target.label).toBe("Usar en tramitador");
  });

  it("dirige convocatorias al asistente de nueva convocatoria", () => {
    const junta = getTemplateUsageTarget(template({ id: "conv-junta", tipo: "CONVOCATORIA" }));
    const sl = getTemplateUsageTarget(template({ id: "conv-sl", tipo: "CONVOCATORIA_SL_NOTIFICACION" }));

    expect(junta.to).toBe("/secretaria/convocatorias/nueva?plantilla=conv-junta");
    expect(sl.to).toBe("/secretaria/convocatorias/nueva?plantilla=conv-sl");
    expect(sl.hint).toContain("órgano, plazos y orden del día");
  });

  it("dirige actas segun modo de adopcion para no aplanar el proceso", () => {
    const unipersonal = getTemplateUsageTarget(
      template({
        id: "acta-socio-unico",
        tipo: "ACTA_CONSIGNACION",
        adoption_mode: "UNIPERSONAL_SOCIO",
      }),
    );
    const noSession = getTemplateUsageTarget(
      template({
        id: "acta-escrita",
        tipo: "ACTA_ACUERDO_ESCRITO",
        adoption_mode: "NO_SESSION",
      }),
    );
    const meeting = getTemplateUsageTarget(
      template({
        id: "acta-sesion",
        tipo: "ACTA_SESION",
        adoption_mode: "MEETING",
      }),
    );

    expect(unipersonal.to).toBe("/secretaria/decisiones-unipersonales?plantilla=acta-socio-unico&tipo=ACTA_CONSIGNACION");
    expect(noSession.to).toBe("/secretaria/acuerdos-sin-sesion?plantilla=acta-escrita&tipo=ACTA_ACUERDO_ESCRITO");
    expect(meeting.to).toBe("/secretaria/actas?plantilla=acta-sesion&tipo=ACTA_SESION");
  });

  it("dirige documentos PRE y registrales al flujo owner sin crear schema nuevo", () => {
    const pre = getTemplateUsageTarget(template({ id: "pre", tipo: "INFORME_PRECEPTIVO" }));
    const documentalPre = getTemplateUsageTarget(template({ id: "doc-pre", tipo: "INFORME_DOCUMENTAL_PRE" }));
    const registral = getTemplateUsageTarget(template({ id: "registral", tipo: "DOCUMENTO_REGISTRAL" }));

    expect(pre.to).toBe("/secretaria/convocatorias?plantilla=pre&tipo=INFORME_PRECEPTIVO");
    expect(documentalPre.to).toBe("/secretaria/convocatorias?plantilla=doc-pre&tipo=INFORME_DOCUMENTAL_PRE");
    expect(registral.to).toBe("/secretaria/tramitador?plantilla=registral&tipo=DOCUMENTO_REGISTRAL");
  });
});
