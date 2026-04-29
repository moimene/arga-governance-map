import { describe, expect, it } from "vitest";
import { buildMeetingAdoptionSnapshot } from "../meeting-adoption-snapshot";
import type {
  MajoritySpec,
  ReglaActa,
  ReglaConstitucion,
  ReglaConvocatoria,
  ReglaDocumentacion,
  ReglaPlazosMateriales,
  ReglaPostAcuerdo,
  RulePack,
  RuleParamOverride,
} from "../types";
import type { PactoParasocial } from "../pactos-engine";

const majority = (formula = "favor > contra"): MajoritySpec => ({
  formula,
  fuente: "LEY",
  referencia: "LSC",
});

const pack = (materia = "FUSION"): RulePack => ({
  id: `pack-${materia}`,
  materia,
  clase: materia === "FUSION" ? "ESTRUCTURAL" : "ORDINARIA",
  organoTipo: "JUNTA_GENERAL",
  modosAdopcionPermitidos: ["MEETING"],
  convocatoria: {} as ReglaConvocatoria,
  constitucion: {} as ReglaConstitucion,
  votacion: {
    mayoria: {
      SA: majority("favor > contra"),
      SL: majority("favor > contra"),
      CONSEJO: majority("mayoria_consejeros"),
    },
    abstenciones: "no_cuentan",
  },
  documentacion: {} as ReglaDocumentacion,
  acta: {} as ReglaActa,
  plazosMateriales: {} as ReglaPlazosMateriales,
  postAcuerdo: {} as ReglaPostAcuerdo,
});

const pactoVeto: PactoParasocial = {
  id: "pacto-veto",
  titulo: "Veto Fundacion ARGA",
  tipo_clausula: "VETO",
  firmantes: [{ nombre: "Fundacion ARGA", tipo: "SOCIO", capital_pct: 69.69 }],
  materias_aplicables: ["FUSION"],
  titular_veto: "Fundacion ARGA",
  estado: "VIGENTE",
};

describe("buildMeetingAdoptionSnapshot", () => {
  it("separa validez societaria de incumplimiento de pacto parasocial", () => {
    const snapshot = buildMeetingAdoptionSnapshot({
      agendaItemIndex: 1,
      resolutionText: "Aprobar fusion",
      materia: "FUSION",
      materiaClase: "ESTRUCTURAL",
      tipoSocial: "SA",
      organoTipo: "JUNTA_GENERAL",
      quorumReached: true,
      voters: [
        { id: "a1", vote: "FAVOR", voting_weight: 80 },
        { id: "a2", vote: "CONTRA", voting_weight: 20 },
      ],
      totalMiembros: 2,
      capitalTotal: 100,
      packs: [pack("FUSION")],
      pactos: [pactoVeto],
    });

    expect(snapshot.societary_validity.ok).toBe(true);
    expect(snapshot.status_resolucion).toBe("ADOPTED");
    expect(snapshot.pacto_compliance.ok).toBe(false);
    expect(snapshot.pacto_compliance.severity).toBe("WARNING");
  });

  it("bloquea societariamente si hay veto estatutario aplicable", () => {
    const override: RuleParamOverride = {
      id: "override-veto",
      entity_id: "entity-1",
      materia: "FUSION",
      clave: "veto_estatutario_fundacion",
      valor: true,
      fuente: "ESTATUTOS",
      referencia: "Estatutos art. demo",
    };

    const snapshot = buildMeetingAdoptionSnapshot({
      agendaItemIndex: 1,
      resolutionText: "Aprobar fusion",
      materia: "FUSION",
      materiaClase: "ESTRUCTURAL",
      tipoSocial: "SA",
      organoTipo: "JUNTA_GENERAL",
      quorumReached: true,
      voters: [
        { id: "a1", vote: "FAVOR", voting_weight: 80 },
        { id: "a2", vote: "CONTRA", voting_weight: 20 },
      ],
      totalMiembros: 2,
      capitalTotal: 100,
      packs: [pack("FUSION")],
      overrides: [override],
    });

    expect(snapshot.societary_validity.ok).toBe(false);
    expect(snapshot.societary_validity.statutory_veto_active).toBe(true);
    expect(snapshot.status_resolucion).toBe("REJECTED");
  });

  it("excluye conflictuados del voto antes de calcular mayoria", () => {
    const snapshot = buildMeetingAdoptionSnapshot({
      agendaItemIndex: 1,
      resolutionText: "Operacion vinculada",
      materia: "APROBACION_CUENTAS",
      materiaClase: "ORDINARIA",
      tipoSocial: "SA",
      organoTipo: "JUNTA_GENERAL",
      quorumReached: true,
      voters: [
        { id: "conflicted", vote: "FAVOR", voting_weight: 40, conflict_flag: true, conflict_reason: "Vinculado" },
        { id: "a1", vote: "FAVOR", voting_weight: 30 },
        { id: "a2", vote: "CONTRA", voting_weight: 30 },
      ],
      totalMiembros: 3,
      capitalTotal: 100,
      packs: [pack("APROBACION_CUENTAS")],
    });

    expect(snapshot.vote_summary.conflict_excluded).toBe(40);
    expect(snapshot.vote_summary.favor).toBe(30);
    expect(snapshot.vote_summary.contra).toBe(30);
    expect(snapshot.societary_validity.ok).toBe(false);
  });

  it("no proclama el punto si falta voto de un votante elegible", () => {
    const snapshot = buildMeetingAdoptionSnapshot({
      agendaItemIndex: 1,
      resolutionText: "Aprobar cuentas",
      materia: "APROBACION_CUENTAS",
      materiaClase: "ORDINARIA",
      tipoSocial: "SA",
      organoTipo: "JUNTA_GENERAL",
      quorumReached: true,
      voters: [
        { id: "a1", vote: "FAVOR", voting_weight: 60 },
        { id: "a2", vote: "", voting_weight: 40 },
      ],
      totalMiembros: 2,
      capitalTotal: 100,
      packs: [pack("APROBACION_CUENTAS")],
    });

    expect(snapshot.vote_completeness.complete).toBe(false);
    expect(snapshot.vote_completeness.missing_vote_ids).toEqual(["a2"]);
    expect(snapshot.societary_validity.blocking_issues).toContain("votes_incomplete_for_point");
    expect(snapshot.status_resolucion).toBe("REJECTED");
  });

  it("excluye a un conflictuado sin voto si consta motivo", () => {
    const snapshot = buildMeetingAdoptionSnapshot({
      agendaItemIndex: 1,
      resolutionText: "Operacion vinculada",
      materia: "APROBACION_CUENTAS",
      materiaClase: "ORDINARIA",
      tipoSocial: "SA",
      organoTipo: "JUNTA_GENERAL",
      quorumReached: true,
      voters: [
        { id: "conflicted", vote: "", voting_weight: 40, conflict_flag: true, conflict_reason: "Parte vinculada" },
        { id: "a1", vote: "FAVOR", voting_weight: 35 },
        { id: "a2", vote: "CONTRA", voting_weight: 25 },
      ],
      totalMiembros: 3,
      capitalTotal: 100,
      packs: [pack("APROBACION_CUENTAS")],
    });

    expect(snapshot.vote_completeness.complete).toBe(true);
    expect(snapshot.vote_summary.conflict_excluded).toBe(40);
    expect(snapshot.vote_summary.voting_weight).toBe(60);
    expect(snapshot.societary_validity.ok).toBe(true);
  });
});
