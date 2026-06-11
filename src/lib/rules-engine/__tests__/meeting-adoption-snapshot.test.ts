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

  // ITEM-019: junta sin datos de capital → census_not_available WARNING persistido
  it("ITEM-019: JUNTA_GENERAL sin datos de capital emite WARNING census_not_available", () => {
    const snapshot = buildMeetingAdoptionSnapshot({
      agendaItemIndex: 1,
      resolutionText: "Modificar estatutos",
      materia: "MODIFICACION_ESTATUTOS",
      materiaClase: "ESTATUTARIA",
      tipoSocial: "SL",
      organoTipo: "JUNTA_GENERAL",
      quorumReached: true,
      voters: [
        { id: "a1", vote: "FAVOR", voting_weight: 1 },
        { id: "a2", vote: "CONTRA", voting_weight: 1 },
      ],
      totalMiembros: 3,
      capitalTotal: 2,
      capitalDataAvailable: false,
      packs: [packWithMajority("MODIFICACION_ESTATUTOS", "favor > 1/2_capital_total_con_voto")],
    });
    expect(
      snapshot.societary_validity.warnings.some((w) => w.includes("census_not_available")),
    ).toBe(true);
    expect(
      snapshot.societary_validity.explain.some(
        (e) => e.resultado === "WARNING" && /capital no disponible/i.test(e.regla),
      ),
    ).toBe(true);
  });

  it("ITEM-019: JUNTA_GENERAL con datos de capital reales NO emite census_not_available", () => {
    const snapshot = buildMeetingAdoptionSnapshot({
      agendaItemIndex: 1,
      resolutionText: "Modificar estatutos",
      materia: "MODIFICACION_ESTATUTOS",
      materiaClase: "ESTATUTARIA",
      tipoSocial: "SL",
      organoTipo: "JUNTA_GENERAL",
      quorumReached: true,
      voters: [{ id: "a1", vote: "FAVOR", voting_weight: 80 }],
      totalMiembros: 1,
      capitalTotal: 100,
      capitalDataAvailable: true,
      packs: [packWithMajority("MODIFICACION_ESTATUTOS", "favor > 1/2_capital_total_con_voto")],
    });
    expect(
      snapshot.societary_validity.warnings.some((w) => w.includes("census_not_available")),
    ).toBe(false);
  });

  it("ITEM-019: CONSEJO (base por miembros) no aplica census_not_available aunque falte capital", () => {
    const snapshot = buildMeetingAdoptionSnapshot({
      agendaItemIndex: 1,
      resolutionText: "Delegar facultades",
      materia: "DELEGACION_FACULTADES",
      materiaClase: "ORDINARIA",
      tipoSocial: "SA",
      organoTipo: "CONSEJO",
      quorumReached: true,
      voters: [
        { id: "c1", vote: "FAVOR", voting_weight: 1 },
        { id: "c2", vote: "FAVOR", voting_weight: 1 },
      ],
      totalMiembros: 3,
      capitalTotal: 2,
      capitalDataAvailable: false,
      packs: [pack("DELEGACION_FACULTADES")],
    });
    expect(
      snapshot.societary_validity.warnings.some((w) => w.includes("census_not_available")),
    ).toBe(false);
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

  it("CdA SA empate 3-3 + votoCalidadHabilitado=true + presidente FAVOR → ADOPTED con voto_calidad_usado=true", () => {
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
      votoPresidente: "FAVOR",
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

  it("ITEM-017/039: empate con voto de calidad habilitado pero presidente CONTRA → REJECTED", () => {
    const snapshot = buildMeetingAdoptionSnapshot({
      agendaItemIndex: 0,
      resolutionText: "Empate con presidente en contra — el voto de calidad dirime EN CONTRA",
      materia: "APROBACION_CUENTAS",
      materiaClase: "ORDINARIA",
      tipoSocial: "SA",
      organoTipo: "CONSEJO",
      adoptionMode: "MEETING",
      quorumReached: true,
      votoCalidadHabilitado: true,
      votoPresidente: "CONTRA",
      voters: [
        { id: "c1-pres", vote: "CONTRA", voting_weight: 1 },
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

    expect(snapshot.status_resolucion).toBe("REJECTED");
    expect(snapshot.voting_context.voto_presidente).toBe("CONTRA");
    expect(snapshot.societary_validity.voting.votoCalidadUsado).toBeUndefined();
    expect(snapshot.societary_validity.ok).toBe(false);
  });

  it("ITEM-017/039: empate sin voto del presidente informado → fail-closed REJECTED", () => {
    const snapshot = buildMeetingAdoptionSnapshot({
      agendaItemIndex: 0,
      resolutionText: "Empate sin identificar el voto del presidente",
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
        { id: "c4", vote: "CONTRA", voting_weight: 1 },
        { id: "c5", vote: "CONTRA", voting_weight: 1 },
        { id: "c6", vote: "CONTRA", voting_weight: 1 },
      ],
      totalMiembros: 6,
      capitalTotal: 6,
      packs: [consejoOrdinariaPack()],
    });

    expect(snapshot.status_resolucion).toBe("REJECTED");
    expect(snapshot.voting_context.voto_presidente).toBeNull();
    expect(snapshot.societary_validity.voting.votoCalidadUsado).toBeUndefined();
    expect(snapshot.societary_validity.ok).toBe(false);
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
    // Simula snapshot meeting leído de Cloud sin el campo (pre-A2).
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
    expect(
      isLegacyMeetingAdoptionSnapshot({
        schema_version: "meeting-adoption-snapshot.v2",
        engine_version: 21,
      } as unknown as Record<string, unknown>),
    ).toBe(true);
    expect(
      isLegacyMeetingAdoptionSnapshot({
        schema_version: "meeting-adoption-snapshot.v2",
        engine_version: "",
      }),
    ).toBe(true);
    expect(
      isLegacyMeetingAdoptionSnapshot({
        schema_version: "meeting-adoption-snapshot.v2",
        engine_version: null,
      }),
    ).toBe(true);
  });

  it("isLegacyMeetingAdoptionSnapshot acepta currentVersion explícito (futuro: comparar contra '3.0')", () => {
    const v21 = { schema_version: "meeting-adoption-snapshot.v2", engine_version: "2.1" };
    expect(isLegacyMeetingAdoptionSnapshot(v21, "2.1")).toBe(false);
    expect(isLegacyMeetingAdoptionSnapshot(v21, "3.0")).toBe(true);
  });

  // Discriminación de shapes: solidario/co-aprobacion/no-session NO son
  // afectados por el bug CDA→CONSEJO porque no pasan por
  // useAgreementCompliance.evaluateV2.
  it("isLegacyMeetingAdoptionSnapshot devuelve false para shapes NO-meeting (solidario/co-aprobacion/no-session)", () => {
    // Solidario: motor V2 output con shape distinto, sin schema_version meeting.
    const solidarioSnap = {
      adoption_mode: "SOLIDARIO",
      adminVigentes: ["a1"],
      firmasPresentes: ["a1"],
      result: { acuerdoProclamable: true },
    };
    expect(isLegacyMeetingAdoptionSnapshot(solidarioSnap)).toBe(false);

    // Co-aprobación: shape distinto.
    const coAprobacionSnap = {
      adoption_mode: "CO_APROBACION",
      k_required: 2,
      n_total: 2,
    };
    expect(isLegacyMeetingAdoptionSnapshot(coAprobacionSnap)).toBe(false);

    // Objeto arbitrario sin schema_version.
    expect(isLegacyMeetingAdoptionSnapshot({ foo: "bar" })).toBe(false);

    // schema_version distinto.
    expect(
      isLegacyMeetingAdoptionSnapshot({
        schema_version: "no-session-snapshot.v1",
      }),
    ).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────
// B2 motor edge cases — escenarios que un usuario REAL puede encontrar
// en demo y que NO estaban cubiertos a nivel snapshot boundary.
//
// Plan informado por adversarial exploration (Ruflo agent code-explorer).
// Casos descartados por duplicación con tests existentes:
//   - Empate sin voto calidad (cubierto en describe A3 línea 314)
//   - Conflict of interest (3 tests existentes, líneas 130, 179, 204)
//   - Statutory veto base con valor: true (cubierto línea 96)
//   - Cotizada DL-2 base (cubierto en bordes-no-computables.test.ts)
//   - Pacto VETO genérico (cubierto línea 67)
//
// Casos AÑADIDOS aquí (gaps reales):
//   1. Quórum failed CONSEJO a nivel snapshot — el path quorumReached:
//      false NO estaba ejercitado. Cualquier CdA con asistencia
//      insuficiente pasa por aquí.
//   2. Statutory veto con valor: "activo" (string truthy) — variante
//      de isTruthyOverrideValue NO cubierta. Importante porque
//      migraciones humanas suelen escribir 'true' como string.
//   3. Statutory veto con materia: "*" wildcard — el constraint del
//      override aplica a CUALQUIER materia. No cubierto.
// ─────────────────────────────────────────────────────────────────────

describe("B2 — quorum failed CONSEJO en snapshot boundary", () => {
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
    },
  });

  it("quorumReached=false bloquea status_resolucion incluso con votación favorable", () => {
    // Escenario real: CdA SA convocado, solo 2 de 6 consejeros asisten
    // (quórum no alcanzado: < 50% + 1). Aunque los 2 voten FAVOR, el
    // motor debe rechazar el acuerdo por defecto de constitución.
    //
    // Setup robusto (post reviewer C1): voters configurados para que
    // votingResult.acuerdoProclamable=TRUE si solo se mira la votación.
    // 4 FAVOR + 1 CONTRA con totalMiembros=6, mayoría clara. El ÚNICO
    // bloqueante esperado es el `quorum_not_confirmed_for_point` que
    // viene de `quorumReached: false`.
    const snapshot = buildMeetingAdoptionSnapshot({
      agendaItemIndex: 0,
      resolutionText: "Aprobar cuentas — quórum insuficiente",
      materia: "APROBACION_CUENTAS",
      materiaClase: "ORDINARIA",
      tipoSocial: "SA",
      organoTipo: "CONSEJO",
      adoptionMode: "MEETING",
      quorumReached: false, // ← input clave: el ÚNICO bloqueante esperado
      voters: [
        { id: "c1", vote: "FAVOR", voting_weight: 1 },
        { id: "c2", vote: "FAVOR", voting_weight: 1 },
        { id: "c3", vote: "FAVOR", voting_weight: 1 },
        { id: "c4", vote: "FAVOR", voting_weight: 1 },
        { id: "c5", vote: "CONTRA", voting_weight: 1 },
      ],
      totalMiembros: 6,
      capitalTotal: 6,
      packs: [consejoOrdinariaPack()],
    });

    expect(snapshot.societary_validity.quorum_reached).toBe(false);
    expect(snapshot.societary_validity.ok).toBe(false);
    expect(snapshot.societary_validity.blocking_issues).toContain(
      "quorum_not_confirmed_for_point",
    );
    expect(snapshot.status_resolucion).toBe("REJECTED");

    // Aislamiento del branch (post C1): si la línea 349 de
    // meeting-adoption-snapshot.ts desaparece, votación clara 4-1 sería
    // ADOPTED. Por tanto la regresión se cazaría aquí.
    expect(snapshot.societary_validity.voting.acuerdoProclamable).toBe(true);
    expect(snapshot.societary_validity.voting.mayoriaAlcanzada).toBe(true);
  });

  it("quorumReached omitido (undefined) → fallback permisivo: ok=true + ADOPTED", () => {
    // Documentación del comportamiento default: si el caller omite
    // quorumReached, el snapshot asume true (línea 345 de
    // meeting-adoption-snapshot.ts: `quorumReached !== false`).
    // Test guard contra cambio silencioso de ese default.
    //
    // Post reviewer I3: assertion del output final completo (status_resolucion
    // + ok) para que cualquier nueva guarda interna que silenciosamente
    // bloquee el acuerdo se detecte como regresión aquí.
    const snapshot = buildMeetingAdoptionSnapshot({
      agendaItemIndex: 0,
      resolutionText: "Aprobar cuentas — quórum no especificado",
      materia: "APROBACION_CUENTAS",
      materiaClase: "ORDINARIA",
      tipoSocial: "SA",
      organoTipo: "CONSEJO",
      adoptionMode: "MEETING",
      // quorumReached omitido intencionalmente
      voters: [
        { id: "c1", vote: "FAVOR", voting_weight: 1 },
        { id: "c2", vote: "FAVOR", voting_weight: 1 },
        { id: "c3", vote: "FAVOR", voting_weight: 1 },
        { id: "c4", vote: "FAVOR", voting_weight: 1 },
      ],
      totalMiembros: 6,
      capitalTotal: 6,
      packs: [consejoOrdinariaPack()],
    });

    // Default permisivo del campo `quorumReached`.
    expect(snapshot.societary_validity.quorum_reached).toBe(true);
    expect(snapshot.societary_validity.blocking_issues).not.toContain(
      "quorum_not_confirmed_for_point",
    );

    // Output final coherente (anti-silent-regression): si una nueva
    // guarda interna del motor bloquea el acuerdo aunque quorum_reached
    // sea true por default, el test detecta la regresión aquí.
    expect(snapshot.societary_validity.ok).toBe(true);
    expect(snapshot.status_resolucion).toBe("ADOPTED");
  });
});

describe("B2 — statutory veto: variantes isTruthyOverrideValue no cubiertas", () => {
  const buildOverride = (overrides: Partial<RuleParamOverride>): RuleParamOverride => ({
    id: "override-veto",
    entity_id: "entity-1",
    materia: "FUSION",
    clave: "veto_estatutario_fundacion",
    valor: true,
    fuente: "ESTATUTOS",
    referencia: "Estatutos art. demo",
    ...overrides,
  });

  it("override con valor: 'activo' (string truthy) activa veto correctamente", () => {
    // Migraciones humanas a veces escriben 'true', 'activo', '1' como
    // string en lugar de boolean. isTruthyOverrideValue debe reconocerlos.
    const override = buildOverride({ valor: "activo" });
    const snapshot = buildMeetingAdoptionSnapshot({
      agendaItemIndex: 0,
      resolutionText: "Aprobar fusión",
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

    expect(snapshot.societary_validity.statutory_veto_active).toBe(true);
    expect(snapshot.status_resolucion).toBe("REJECTED");
  });

  it("override con valor: 1 (número truthy) activa veto", () => {
    const override = buildOverride({ valor: 1 });
    const snapshot = buildMeetingAdoptionSnapshot({
      agendaItemIndex: 0,
      resolutionText: "Aprobar fusión",
      materia: "FUSION",
      materiaClase: "ESTRUCTURAL",
      tipoSocial: "SA",
      organoTipo: "JUNTA_GENERAL",
      quorumReached: true,
      voters: [{ id: "a1", vote: "FAVOR", voting_weight: 100 }],
      totalMiembros: 1,
      capitalTotal: 100,
      packs: [pack("FUSION")],
      overrides: [override],
    });
    expect(snapshot.societary_validity.statutory_veto_active).toBe(true);
  });

  it("override con valor: 'false' (string falsy) NO activa veto", () => {
    // Anti-bug: si alguien escribe 'false' por error, NO debe bloquear.
    const override = buildOverride({ valor: "false" });
    const snapshot = buildMeetingAdoptionSnapshot({
      agendaItemIndex: 0,
      resolutionText: "Aprobar fusión",
      materia: "FUSION",
      materiaClase: "ESTRUCTURAL",
      tipoSocial: "SA",
      organoTipo: "JUNTA_GENERAL",
      quorumReached: true,
      voters: [{ id: "a1", vote: "FAVOR", voting_weight: 100 }],
      totalMiembros: 1,
      capitalTotal: 100,
      packs: [pack("FUSION")],
      overrides: [override],
    });
    expect(snapshot.societary_validity.statutory_veto_active).toBe(false);
    expect(snapshot.societary_validity.ok).toBe(true);
  });

  it("override con valor: { activo: true } (objeto wrapped) activa veto", () => {
    const override = buildOverride({ valor: { activo: true } });
    const snapshot = buildMeetingAdoptionSnapshot({
      agendaItemIndex: 0,
      resolutionText: "Aprobar fusión",
      materia: "FUSION",
      materiaClase: "ESTRUCTURAL",
      tipoSocial: "SA",
      organoTipo: "JUNTA_GENERAL",
      quorumReached: true,
      voters: [{ id: "a1", vote: "FAVOR", voting_weight: 100 }],
      totalMiembros: 1,
      capitalTotal: 100,
      packs: [pack("FUSION")],
      overrides: [override],
    });
    expect(snapshot.societary_validity.statutory_veto_active).toBe(true);
  });

  it("override con materia: '*' wildcard activa veto para CUALQUIER materia del agreement", () => {
    // Veto general cubre todas las materias. Verifica que el filtro
    // `materiaMatches = !override.materia || override.materia === materia || override.materia === "*"`
    // (línea 154 de meeting-adoption-snapshot.ts) acepta el comodín.
    const override = buildOverride({ materia: "*" });
    const snapshot = buildMeetingAdoptionSnapshot({
      agendaItemIndex: 0,
      resolutionText: "Aprobar cuentas — veto general aplica",
      materia: "APROBACION_CUENTAS", // distinta de FUSION del override base
      materiaClase: "ORDINARIA",
      tipoSocial: "SA",
      organoTipo: "JUNTA_GENERAL",
      quorumReached: true,
      voters: [{ id: "a1", vote: "FAVOR", voting_weight: 100 }],
      totalMiembros: 1,
      capitalTotal: 100,
      packs: [pack("APROBACION_CUENTAS")],
      overrides: [override],
    });

    expect(snapshot.societary_validity.statutory_veto_active).toBe(true);
    expect(snapshot.status_resolucion).toBe("REJECTED");
  });
});
