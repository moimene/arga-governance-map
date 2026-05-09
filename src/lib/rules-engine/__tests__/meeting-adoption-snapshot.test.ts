import { describe, expect, it } from "vitest";
import {
  buildMeetingAdoptionSnapshot,
  isLegacyMeetingAdoptionSnapshot,
  MEETING_ADOPTION_SNAPSHOT_ENGINE_VERSION,
} from "../meeting-adoption-snapshot";
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

const packWithMajority = (materia: string, formula: string): RulePack => ({
  ...pack(materia),
  votacion: {
    mayoria: {
      SA: majority(formula),
      SL: majority(formula),
      CONSEJO: majority("mayoria_consejeros"),
    },
    abstenciones: "no_cuentan",
  },
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

  it("mantiene quórum de constitución aunque el conflicto reduzca el denominador de voto por punto", () => {
    const snapshot = buildMeetingAdoptionSnapshot({
      agendaItemIndex: 2,
      resolutionText: "Operacion vinculada con quorum limitrofe",
      materia: "OPERACION_VINCULADA",
      materiaClase: "ORDINARIA",
      tipoSocial: "SA",
      organoTipo: "JUNTA_GENERAL",
      quorumReached: true,
      voters: [
        { id: "socio-a", vote: "FAVOR", voting_weight: 12 },
        { id: "socio-b", vote: "FAVOR", voting_weight: 1 },
        { id: "socio-c", vote: "CONTRA", voting_weight: 11 },
        { id: "socio-conflict", vote: "FAVOR", voting_weight: 2, conflict_flag: true, conflict_reason: "Operacion vinculada" },
      ],
      totalMiembros: 4,
      capitalTotal: 100,
      packs: [packWithMajority("OPERACION_VINCULADA", "favor > 1/2_capital_presente")],
    });

    expect(snapshot.voting_context.quorum_reached).toBe(true);
    expect(snapshot.vote_summary.present_weight).toBe(26);
    expect(snapshot.vote_summary.conflict_excluded).toBe(2);
    expect(snapshot.vote_summary.voting_weight).toBe(24);
    expect(snapshot.vote_summary.favor).toBe(13);
    expect(snapshot.societary_validity.majority_reached).toBe(true);
    expect(snapshot.societary_validity.ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────
// A3 — Voto de calidad CdA SA con empate (golden test)
//
// Contexto adversarial: pre-fix CDA→CONSEJO (commit 96a64ca), los CdA
// caían a JUNTA_GENERAL en `useAgreementCompliance.toTipoOrgano`. La
// rama JUNTA evalúa por capital social (% presente), no por número de
// consejeros. Como consecuencia, los empates en CdA NUNCA disparaban
// voto de calidad — falsos empates "ADOPTED" o "REJECTED" según el
// numerador de capital, no según la lógica colegiada.
//
// Post-fix: con organoTipo=CONSEJO, el motor V2 ramifica correctamente
// en `votacion-engine.ts:445-456` y dispara el voto de calidad cuando
// hay empate y el flag está habilitado (DL-5 ARGA: voto calidad en CdA
// y Comité Ejecutivo, NO en comisiones delegadas).
//
// Este test es el guard golden: si alguien revierte el fix, esta
// aserción falla porque organoTipo=CONSEJO ya no se honra y el voto
// de calidad no se aplica al empate.
// ─────────────────────────────────────────────────────────────────────

describe("A3 — buildMeetingAdoptionSnapshot voto de calidad CdA", () => {
  const consejoOrdinariaPack = (): RulePack => ({
    ...pack("APROBACION_CUENTAS"),
    organoTipo: "CONSEJO",
    modosAdopcionPermitidos: ["MEETING"],
    votacion: {
      mayoria: {
        SA: majority("favor > contra"),
        SL: majority("favor > contra"),
        CONSEJO: majority("favor > contra"),
      },
      abstenciones: "no_cuentan",
      votoCalidadPermitido: true,
    },
  });

  it("CdA SA empate 3-3 + votoCalidadHabilitado=true → ADOPTED con voto_calidad_usado=true", () => {
    const snapshot = buildMeetingAdoptionSnapshot({
      agendaItemIndex: 0,
      resolutionText: "Aprobar cuentas anuales 2025 — empate resuelto por voto de calidad del Presidente",
      materia: "APROBACION_CUENTAS",
      materiaClase: "ORDINARIA",
      tipoSocial: "SA",
      organoTipo: "CONSEJO",
      adoptionMode: "MEETING",
      quorumReached: true,
      votoCalidadHabilitado: true,
      voters: [
        { id: "c1-pres", vote: "FAVOR", voting_weight: 1 },
        { id: "c2", vote: "FAVOR", voting_weight: 1 },
        { id: "c3", vote: "FAVOR", voting_weight: 1 },
        { id: "c4", vote: "CONTRA", voting_weight: 1 },
        { id: "c5", vote: "CONTRA", voting_weight: 1 },
        { id: "c6", vote: "CONTRA", voting_weight: 1 },
      ],
      totalMiembros: 6,
      capitalTotal: 6,
      packs: [consejoOrdinariaPack()],
    });

    // Resolución adoptada (voto de calidad rompió el empate).
    expect(snapshot.status_resolucion).toBe("ADOPTED");

    // Contexto persistido marca el flag como habilitado.
    expect(snapshot.voting_context.voto_calidad_habilitado).toBe(true);

    // El motor reportó que efectivamente USÓ el voto de calidad.
    // Anti-bug: si organoTipo cae a JUNTA_GENERAL, esta aserción falla.
    expect(snapshot.societary_validity.voting.votoCalidadUsado).toBe(true);

    // Validez societaria OK (mayoría alcanzada vía voto de calidad).
    expect(snapshot.societary_validity.ok).toBe(true);
    expect(snapshot.societary_validity.majority_reached).toBe(true);

    // Vote summary: empate registrado (3 favor, 3 contra) antes del
    // voto de calidad.
    expect(snapshot.vote_summary.favor).toBe(3);
    expect(snapshot.vote_summary.contra).toBe(3);
  });

  it("sanity inverso: CdA SA empate + votoCalidadHabilitado=false → REJECTED, voto_calidad_usado undefined", () => {
    const snapshot = buildMeetingAdoptionSnapshot({
      agendaItemIndex: 0,
      resolutionText: "Aprobar cuentas anuales 2025 — empate sin voto de calidad",
      materia: "APROBACION_CUENTAS",
      materiaClase: "ORDINARIA",
      tipoSocial: "SA",
      organoTipo: "CONSEJO",
      adoptionMode: "MEETING",
      quorumReached: true,
      votoCalidadHabilitado: false,
      voters: [
        { id: "c1", vote: "FAVOR", voting_weight: 1 },
        { id: "c2", vote: "FAVOR", voting_weight: 1 },
        { id: "c3", vote: "FAVOR", voting_weight: 1 },
        { id: "c4", vote: "CONTRA", voting_weight: 1 },
        { id: "c5", vote: "CONTRA", voting_weight: 1 },
        { id: "c6", vote: "CONTRA", voting_weight: 1 },
      ],
      totalMiembros: 6,
      capitalTotal: 6,
      packs: [consejoOrdinariaPack()],
    });

    expect(snapshot.status_resolucion).toBe("REJECTED");
    expect(snapshot.voting_context.voto_calidad_habilitado).toBe(false);
    expect(snapshot.societary_validity.voting.votoCalidadUsado).toBeUndefined();
    expect(snapshot.societary_validity.ok).toBe(false);
    expect(snapshot.societary_validity.majority_reached).toBe(false);
  });

  it("CdA con mayoría clara (4-2) NO necesita voto de calidad aunque esté habilitado", () => {
    const snapshot = buildMeetingAdoptionSnapshot({
      agendaItemIndex: 0,
      resolutionText: "Aprobar cuentas — mayoría clara, voto de calidad no necesario",
      materia: "APROBACION_CUENTAS",
      materiaClase: "ORDINARIA",
      tipoSocial: "SA",
      organoTipo: "CONSEJO",
      adoptionMode: "MEETING",
      quorumReached: true,
      votoCalidadHabilitado: true,
      voters: [
        { id: "c1", vote: "FAVOR", voting_weight: 1 },
        { id: "c2", vote: "FAVOR", voting_weight: 1 },
        { id: "c3", vote: "FAVOR", voting_weight: 1 },
        { id: "c4", vote: "FAVOR", voting_weight: 1 },
        { id: "c5", vote: "CONTRA", voting_weight: 1 },
        { id: "c6", vote: "CONTRA", voting_weight: 1 },
      ],
      totalMiembros: 6,
      capitalTotal: 6,
      packs: [consejoOrdinariaPack()],
    });

    expect(snapshot.status_resolucion).toBe("ADOPTED");
    // Voto de calidad estaba HABILITADO pero NO USADO (no había empate).
    expect(snapshot.voting_context.voto_calidad_habilitado).toBe(true);
    expect(snapshot.societary_validity.voting.votoCalidadUsado).toBeFalsy();
  });
});

// ─────────────────────────────────────────────────────────────────────
// A2 — engine_version persistence + legacy snapshot detection
//
// Antes de A2 (2026-05-09) los snapshots no llevaban `engine_version`.
// Tras el fix CDA→CONSEJO (commit 96a64ca), los snapshots históricos
// persistidos en Cloud quedan estancados con `organo_tipo` derivado
// del bug previo. Re-evaluar el agreement actualmente produciría un
// resultado distinto.
//
// Estos tests validan:
//   1) Builds nuevos siempre llevan engine_version actual.
//   2) `isLegacyMeetingAdoptionSnapshot` detecta snapshots legacy
//      (sin campo) y snapshots de versiones antiguas.
//   3) Snapshots con la versión actual NO son legacy.
// ─────────────────────────────────────────────────────────────────────

describe("A2 — engine_version persistence + isLegacyMeetingAdoptionSnapshot", () => {
  it("buildMeetingAdoptionSnapshot persiste engine_version actual", () => {
    const snapshot = buildMeetingAdoptionSnapshot({
      agendaItemIndex: 0,
      resolutionText: "Test",
      materia: "APROBACION_CUENTAS",
      materiaClase: "ORDINARIA",
      tipoSocial: "SA",
      organoTipo: "JUNTA_GENERAL",
      quorumReached: true,
      voters: [{ id: "a1", vote: "FAVOR", voting_weight: 100 }],
      totalMiembros: 1,
      capitalTotal: 100,
      packs: [pack("APROBACION_CUENTAS")],
    });
    expect(snapshot.engine_version).toBe(MEETING_ADOPTION_SNAPSHOT_ENGINE_VERSION);
  });

  it("MEETING_ADOPTION_SNAPSHOT_ENGINE_VERSION está fijado en '2.1' (post-fix CDA→CONSEJO)", () => {
    // Anti-bug: si alguien degrada a '2.0' sin migración explícita,
    // los snapshots producidos posteriormente NO se distinguirían de
    // los legacy pre-fix. Esto bloquea ese cambio silencioso.
    expect(MEETING_ADOPTION_SNAPSHOT_ENGINE_VERSION).toBe("2.1");
  });

  it("isLegacyMeetingAdoptionSnapshot detecta snapshot SIN engine_version (legacy pre-A2)", () => {
    // Simula snapshot leído de Cloud sin el campo (pre-A2).
    const legacy = {
      schema_version: "meeting-adoption-snapshot.v2",
      agenda_item_index: 0,
      voting_context: { organo_tipo: "JUNTA_GENERAL" },
    };
    expect(isLegacyMeetingAdoptionSnapshot(legacy)).toBe(true);
  });

  it("isLegacyMeetingAdoptionSnapshot detecta snapshot con engine_version anterior", () => {
    const oldSnap = {
      schema_version: "meeting-adoption-snapshot.v2",
      engine_version: "2.0",
      voting_context: { organo_tipo: "JUNTA_GENERAL" },
    };
    expect(isLegacyMeetingAdoptionSnapshot(oldSnap)).toBe(true);
  });

  it("isLegacyMeetingAdoptionSnapshot devuelve false para snapshots con la versión actual", () => {
    const fresh = {
      schema_version: "meeting-adoption-snapshot.v2",
      engine_version: MEETING_ADOPTION_SNAPSHOT_ENGINE_VERSION,
      voting_context: { organo_tipo: "CONSEJO" },
    };
    expect(isLegacyMeetingAdoptionSnapshot(fresh)).toBe(false);
  });

  it("isLegacyMeetingAdoptionSnapshot tolera snapshot null/undefined sin throw", () => {
    expect(isLegacyMeetingAdoptionSnapshot(null)).toBe(false);
    expect(isLegacyMeetingAdoptionSnapshot(undefined)).toBe(false);
  });

  it("isLegacyMeetingAdoptionSnapshot tolera engine_version no-string (corrupción)", () => {
    expect(isLegacyMeetingAdoptionSnapshot({ engine_version: 21 } as unknown as Record<string, unknown>)).toBe(true);
    expect(isLegacyMeetingAdoptionSnapshot({ engine_version: "" })).toBe(true);
    expect(isLegacyMeetingAdoptionSnapshot({ engine_version: null })).toBe(true);
  });

  it("isLegacyMeetingAdoptionSnapshot acepta currentVersion explícito (futuro: comparar contra '3.0')", () => {
    const v21 = { engine_version: "2.1" };
    expect(isLegacyMeetingAdoptionSnapshot(v21, "2.1")).toBe(false);
    expect(isLegacyMeetingAdoptionSnapshot(v21, "3.0")).toBe(true);
  });
});
