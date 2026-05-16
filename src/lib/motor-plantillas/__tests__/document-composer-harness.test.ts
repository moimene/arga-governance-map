import { describe, expect, it } from "vitest";
import {
  applyActaDraftPolishProposals,
  suggestActaDraftPolish,
  validateActaDraftPolishResult,
  type ActaDraftPolishProposal,
} from "../document-composer-harness";
import {
  buildActaAgendaViewModel,
  type ActaAgendaItemRow,
} from "@/lib/secretaria/acta-agenda";
import {
  buildActaLegalStructureViewModel,
  renderActaLegalStructureText,
} from "@/lib/secretaria/acta-legal-structure";

function model() {
  const agendaItems: ActaAgendaItemRow[] = [
    {
      id: "ai-1",
      meeting_id: "m-1",
      order_number: 1,
      title: "Informe del presidente",
      description: "Se presenta informacion de negocio.",
      kind: "INFORMATIVO",
      tenant_id: "tenant-1",
    },
    {
      id: "ai-2",
      meeting_id: "m-1",
      order_number: 2,
      title: "Aprobacion de cuentas",
      description: "Decision sobre cuentas.",
      kind: "DECISORIO",
      tenant_id: "tenant-1",
    },
  ];
  const puntos = buildActaAgendaViewModel({ agendaItems });
  return buildActaLegalStructureViewModel({
    meetingId: "m-1",
    minuteId: "minute-1",
    entityName: "ARGA Seguros, S.A.",
    organName: "Consejo de Administracion",
    organKind: "CONSEJO",
    date: "15/05/2026",
    startTime: "10:00",
    place: "Madrid",
    convocationText: "Convocatoria documentada.",
    president: "Antonio Rios",
    secretary: "Lucia Paredes",
    attendees: [{ name: "Antonio Rios", attendance: "PRESENTE" }],
    quorumText: "Quorum suficiente.",
    agendaItems: puntos,
    canonicalMinutesHash: "hash-acta-polish-demo",
    approvalMode: "aprobacion en el acto",
    approvalDate: "15/05/2026",
  });
}

function proposal(patch: Partial<ActaDraftPolishProposal>): ActaDraftPolishProposal {
  return {
    target: "narrativa.deliberaciones",
    currentText: "Constancia: Se presenta informacion de negocio.",
    proposedText: "Constancia: Se presenta la informacion de negocio y se deja constancia de su recepcion por el Consejo.",
    reason: "Mejora de claridad narrativa.",
    confidence: 0.8,
    requiresHumanReview: true,
    ...patch,
  };
}

describe("document-composer-harness", () => {
  it("aplica propuestas narrativas sin alterar hechos protegidos del acta", () => {
    const acta = model();
    const text = [
      renderActaLegalStructureText(acta),
      "",
      "HASH CANONICO DEL ACTA",
      "hash-acta-polish-demo",
    ].join("\n");

    const result = applyActaDraftPolishProposals({
      text,
      actaLegalStructure: acta,
      proposals: [proposal({})],
    });

    expect(result.validation.ok).toBe(true);
    expect(result.appliedProposals).toHaveLength(1);
    expect(result.proposedText).toContain("recepcion por el Consejo");
    expect(result.proposedText).toContain("2. Aprobacion de cuentas");
    expect(result.proposedText).toContain("hash-acta-polish-demo");
  });

  it("bloquea propuestas que alteran orden del dia o contenido protegido", () => {
    const acta = model();
    const text = [
      renderActaLegalStructureText(acta),
      "",
      "HASH CANONICO DEL ACTA",
      "hash-acta-polish-demo",
    ].join("\n");

    const result = applyActaDraftPolishProposals({
      text,
      actaLegalStructure: acta,
      proposals: [
        proposal({
          currentText: acta.sections.agenda,
          proposedText: "1. Informe del presidente\n2. Cuentas anuales reformuladas",
          reason: "Cambio no permitido.",
        }),
      ],
    });

    expect(result.appliedProposals).toHaveLength(0);
    expect(result.skippedProposals[0]?.reason).toMatch(/contenido protegido/i);
    expect(result.proposedText).toContain("2. Aprobacion de cuentas");
  });

  it("valida directamente si desaparece el hash canonico", () => {
    const acta = model();
    const text = renderActaLegalStructureText(acta).replace("hash-acta-polish-demo", "");
    const issues = validateActaDraftPolishResult(text, acta);

    expect(issues.map((issue) => issue.code)).toContain("AI_POLISH_PROTECTED_FRAGMENT_CHANGED");
  });

  it("normaliza salida de proveedor y exige revision humana", async () => {
    const acta = model();
    const text = [
      renderActaLegalStructureText(acta),
      "",
      "HASH CANONICO DEL ACTA",
      "hash-acta-polish-demo",
    ].join("\n");
    const result = await suggestActaDraftPolish({
      text,
      actaLegalStructure: acta,
      provider: async () => ({
        modelName: "openai-test-model",
        promptVersion: "capa3-document-copilot.v1",
        summary: "Pulido propuesto.",
        proposals: [proposal({})],
      }),
    });

    expect(result.mode).toBe("MODEL_ADAPTER");
    expect(result.modelName).toBe("openai-test-model");
    expect(result.appliedProposals[0]?.requiresHumanReview).toBe(true);
  });
});
