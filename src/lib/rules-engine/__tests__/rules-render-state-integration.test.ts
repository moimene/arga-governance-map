import { describe, expect, it } from "vitest";
import { renderTemplate } from "@/lib/doc-gen/template-renderer";
import { validatePostRenderDocument } from "@/lib/motor-plantillas/post-render-validation";
import { canTransitionMeetingExpediente } from "@/lib/secretaria/expediente-state-machine";
import { evaluarConstitucion } from "../constitucion-engine";
import { evaluateNoticePeriod } from "../plazos-engine";
import { evaluarVotacion } from "../votacion-engine";
import type {
  MajoritySpec,
  ReglaActa,
  ReglaConstitucion,
  ReglaConvocatoria,
  ReglaDocumentacion,
  ReglaPlazosMateriales,
  ReglaPostAcuerdo,
  RulePack,
} from "../types";

const majority = (patch: Partial<MajoritySpec> = {}): MajoritySpec => ({
  formula: "favor > contra",
  fuente: "LEY",
  referencia: "art. 198 LSC",
  ...patch,
});

function pack(): RulePack {
  return {
    id: "pack-aprobacion-cuentas",
    materia: "APROBACION_CUENTAS",
    clase: "ORDINARIA",
    organoTipo: "JUNTA_GENERAL",
    modosAdopcionPermitidos: ["MEETING"],
    convocatoria: {} as ReglaConvocatoria,
    constitucion: {
      quorum: {
        SA_1a: { valor: 0.25, fuente: "LEY", referencia: "art. 193 LSC" },
        SA_2a: { valor: 0, fuente: "LEY", referencia: "art. 193 LSC" },
        SL: { valor: 0, fuente: "LEY", referencia: "art. 201 LSC" },
        CONSEJO: { valor: "mayoria_miembros", fuente: "LEY", referencia: "art. 247 LSC" },
      },
    } as ReglaConstitucion,
    votacion: {
      mayoria: { SA: majority(), SL: majority(), CONSEJO: majority({ formula: "mayoria_consejeros" }) },
      abstenciones: "no_cuentan",
    },
    documentacion: {} as ReglaDocumentacion,
    acta: {} as ReglaActa,
    plazosMateriales: {} as ReglaPlazosMateriales,
    postAcuerdo: {} as ReglaPostAcuerdo,
  };
}

describe("Fase 3 integración motor → renderer → estado", () => {
  it("permite ACTA_APROBADA si constitución y votación pasan y el acta renderiza gates", () => {
    const rulePack = pack();
    const constitucion = evaluarConstitucion({
      tipoSocial: "SA",
      organoTipo: "JUNTA_GENERAL",
      adoptionMode: "MEETING",
      primeraConvocatoria: true,
      materiaClase: "ORDINARIA",
      capitalConDerechoVoto: 100,
      capitalPresenteRepresentado: 40,
    }, [rulePack]);
    const votacion = evaluarVotacion({
      tipoSocial: "SA",
      organoTipo: "JUNTA_GENERAL",
      adoptionMode: "MEETING",
      materiaClase: "ORDINARIA",
      materias: ["APROBACION_CUENTAS"],
      votos: { favor: 30, contra: 10, abstenciones: 0, en_blanco: 0, capital_presente: 40, capital_total: 100 },
    }, [rulePack]);
    const rendered = renderTemplate({
      template: "ACTA\nQuórum: {{quorum}}. Votos favor: {{favor}}. Proclamación: {{proclamacion}}. Acuerdo {{agreement_id}}.",
      variables: {
        quorum: `${Math.round(constitucion.quorumPresente * 100)}%`,
        favor: 30,
        proclamacion: votacion.ok ? "Aprobado" : "Rechazado",
        agreement_id: "agr-1",
      },
    });
    const validation = validatePostRenderDocument({
      documentType: "ACTA",
      renderedText: rendered.text,
      capa1Template: "ACTA con quorum y votos suficientes para el documento societario de prueba controlada.",
      unresolvedVariables: rendered.unresolvedVariables,
      agreementIds: ["agr-1"],
    });

    expect(constitucion.ok).toBe(true);
    expect(votacion.ok).toBe(true);
    expect(validation.ok).toBe(true);
    expect(canTransitionMeetingExpediente("ACTA_PENDIENTE", "ACTA_APROBADA", { gatesOk: constitucion.ok && votacion.ok }).ok).toBe(true);
  });

  it("bloquea transición a sesión si falla plazo de convocatoria aunque el renderer pueda generar warning", () => {
    const notice = evaluateNoticePeriod({
      tipoSocial: "SA",
      fechaConvocatoria: "2026-05-01",
      fechaJunta: "2026-05-20",
    });
    const rendered = renderTemplate({
      template: "CONVOCATORIA\nORDEN DEL DÍA: {{orden}}.\nWarning: {{warning}}",
      variables: {
        orden: "Aprobación de cuentas",
        warning: notice.blocking_issues.join(", "),
      },
    });
    const transition = canTransitionMeetingExpediente("CONVOCADO", "EN_SESION", { gatesOk: notice.ok });

    expect(notice.ok).toBe(false);
    expect(rendered.ok).toBe(true);
    expect(rendered.text).toContain("notice_period_insufficient");
    expect(transition.ok).toBe(false);
  });
});
