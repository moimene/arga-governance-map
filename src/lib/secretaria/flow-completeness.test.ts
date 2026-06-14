import { describe, it, expect } from "vitest";
import {
  assessFlowCompleteness,
  summarizeFlowCompleteness,
  type EntityFlowInput,
  type SecretariaFlow,
} from "./flow-completeness";

function statusOf(input: EntityFlowInput, flow: SecretariaFlow) {
  return assessFlowCompleteness(input).find((f) => f.flow === flow)!;
}

const FOUNDATIONS: EntityFlowInput = {
  hasVigenteCapitalProfile: true,
  capTableSumsTo100: true,
  bodies: 2,
  activePositions: 5,
  authorityEvidence: 2,
};

// SA cotizada estilo ARGA con flujos completos.
const ARGA: EntityFlowInput = {
  ...FOUNDATIONS,
  tipoOrganoAdmin: "CDA",
  esUnipersonal: false,
  meetingsCelebradas: 5,
  meetingsWithCenso: 5,
  minutes: 3,
  certifications: 2,
  convocatorias: 4,
  registryFilings: 2,
  noSessionResolutions: 1,
  mandatoryBooks: 12,
  agreements: 10,
};

describe("assessFlowCompleteness — cimientos", () => {
  it("sin perfil de capital marca los flujos base como partial con razón", () => {
    const r = statusOf({ ...FOUNDATIONS, hasVigenteCapitalProfile: false, mandatoryBooks: 1 }, "sociedades_personas_cargos");
    expect(r.status).toBe("partial");
    expect(r.reasons.join(" ")).toContain("perfil de capital");
  });

  it("sin órganos ni cargos no permite el flujo de reunión (partial)", () => {
    const r = statusOf({ hasVigenteCapitalProfile: true, bodies: 0, activePositions: 0 }, "convocatoria_reunion_acta_certificacion");
    expect(r.status).toBe("partial");
  });
});

describe("assessFlowCompleteness — ARGA (SA cotizada completa)", () => {
  it("flujo reunión→acta→certificación es ready", () => {
    expect(statusOf(ARGA, "convocatoria_reunion_acta_certificacion").status).toBe("ready");
  });
  it("tramitador registral ready (tiene expedientes)", () => {
    expect(statusOf(ARGA, "tramitador_registral").status).toBe("ready");
  });
  it("board pack ready (CDA + acuerdos + reuniones)", () => {
    expect(statusOf(ARGA, "board_pack").status).toBe("ready");
  });
  it("decisión unipersonal NO aplica a sociedad no unipersonal", () => {
    expect(statusOf(ARGA, "decision_unipersonal").status).toBe("unavailable");
  });
  it("solidario y co-aprobación NO aplican a un CDA", () => {
    expect(statusOf(ARGA, "solidario").status).toBe("unavailable");
    expect(statusOf(ARGA, "co_aprobacion").status).toBe("unavailable");
  });
  it("summarize marca demoReady=true", () => {
    expect(summarizeFlowCompleteness(ARGA).demoReady).toBe(true);
  });
});

describe("assessFlowCompleteness — reunión sin censo / sin acta", () => {
  it("reuniones celebradas sin censo => partial con razón de censo", () => {
    const r = statusOf({ ...ARGA, meetingsWithCenso: 2 }, "convocatoria_reunion_acta_certificacion");
    expect(r.status).toBe("partial");
    expect(r.reasons.join(" ")).toContain("censo");
  });
  it("sin actas ni certificaciones => partial", () => {
    const r = statusOf({ ...ARGA, minutes: 0, certifications: 0 }, "convocatoria_reunion_acta_certificacion");
    expect(r.status).toBe("partial");
    expect(r.reasons.join(" ")).toContain("actas");
  });
});

describe("assessFlowCompleteness — formas de administración", () => {
  it("SL admin solidarios: solidario aplica y es ready con cimientos", () => {
    const sl: EntityFlowInput = { ...FOUNDATIONS, tipoOrganoAdmin: "ADMIN_SOLIDARIOS" };
    expect(statusOf(sl, "solidario").status).toBe("ready");
    expect(statusOf(sl, "co_aprobacion").status).toBe("unavailable");
  });
  it("SL admin mancomunados: co-aprobación aplica y es ready", () => {
    const sl: EntityFlowInput = { ...FOUNDATIONS, tipoOrganoAdmin: "ADMIN_MANCOMUNADOS" };
    expect(statusOf(sl, "co_aprobacion").status).toBe("ready");
    expect(statusOf(sl, "solidario").status).toBe("unavailable");
  });
  it("SLU unipersonal: decisión unipersonal aplica; ready con decisiones", () => {
    const slu: EntityFlowInput = { ...FOUNDATIONS, esUnipersonal: true, tipoOrganoAdmin: "ADMIN_UNICO", unipersonalDecisions: 2 };
    expect(statusOf(slu, "decision_unipersonal").status).toBe("ready");
  });
  it("SLU unipersonal sin decisiones: decisión unipersonal partial", () => {
    const slu: EntityFlowInput = { ...FOUNDATIONS, esUnipersonal: true, unipersonalDecisions: 0 };
    expect(statusOf(slu, "decision_unipersonal").status).toBe("partial");
  });
});

describe("assessFlowCompleteness — libros", () => {
  it("sin libros => unavailable", () => {
    expect(statusOf({ ...FOUNDATIONS, mandatoryBooks: 0 }, "libros_legalizacion").status).toBe("unavailable");
  });
  it("con libros => ready", () => {
    expect(statusOf({ ...FOUNDATIONS, mandatoryBooks: 5 }, "libros_legalizacion").status).toBe("ready");
  });
});

describe("summarizeFlowCompleteness — filial vacía", () => {
  it("filial sin cimientos no es demoReady y tiene flujos partial/unavailable", () => {
    const s = summarizeFlowCompleteness({ hasVigenteCapitalProfile: false, bodies: 0, activePositions: 0 });
    expect(s.demoReady).toBe(false);
    expect(s.ready).toBe(0);
    expect(s.partial + s.unavailable).toBe(s.flows.length);
  });
});
