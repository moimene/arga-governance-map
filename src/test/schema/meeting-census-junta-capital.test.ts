// MOI-143 — evaluador de quórum y mayoría por capital de una Junta.
// Test PURO: sin red, sin cliente Supabase. Espejo de
// `fn_secretaria_server_junta_resolution_evaluation`
// (supabase/migrations/20260928160000_secretaria_junta_capital_evaluator.sql).
//
// Los números son los del acta real de la Junta de Socios de Garrigues del
// 06/05/2026: 150 votos presenciales sobre una base declarada de 16.900
// (clase A sin autocartera) = 0,8875 % (docs/legal/2026-08-29-base-computo-
// junta-socios-garrigues.md §2/§4).
import { describe, it, expect } from "vitest";
import { baseComputoJunta, baseComputoTodasLasClases } from "../../../scripts/garrigues/capital/estructura-art7";
import {
  evaluarQuorumYMayoriaJuntaPorCapital,
  type JuntaCapitalSeat,
  type JuntaCapitalVote,
} from "../../lib/secretaria/meeting-census";

describe("evaluarQuorumYMayoriaJuntaPorCapital — acta real de Garrigues 06/05/2026", () => {
  // Los 3 socios de cuota presenciales: 2 participaciones clase A x 25 votos
  // cada uno = 50 votos/socio, 150 en total (docs/legal/…§2).
  const presenciales: JuntaCapitalSeat[] = [
    { personId: "socio-1", rawVotes: 50 },
    { personId: "socio-2", rawVotes: 50 },
    { personId: "socio-3", rawVotes: 50 },
  ];
  const votosFavor: JuntaCapitalVote[] = presenciales.map((s) => ({ personId: s.personId, value: "FAVOR" }));

  it("150 votos sobre la base de 16.900 dan 0,8875 % (truncado) del acta", () => {
    const base = baseComputoJunta();
    expect(base).toBe(16_900);
    const resultado = evaluarQuorumYMayoriaJuntaPorCapital(presenciales, votosFavor, base);
    expect(resultado.concurrentWeight).toBe(150);
    // Valor exacto medido en Cloud (meetings.quorum_data.presenciales_pct).
    expect(resultado.presentPct).toBeCloseTo(0.8875739644970414, 12);
    expect(resultado.presentPct.toFixed(4)).toBe("0.8876");
    expect(resultado.quorumReached).toBe(true);
    expect(resultado.majorityReached).toBe(true);
    expect(resultado.favor).toBe(150);
    expect(resultado.contra).toBe(0);
  });

  it("sobre la base íntegra (16.908, con clase B) el mismo voto da un porcentaje distinto", () => {
    // Contraste explícito de las dos bases candidatas: no cuadra con el acta,
    // que es precisamente por lo que la base declarada es la de clase A.
    const baseIntegra = baseComputoTodasLasClases();
    expect(baseIntegra).toBe(16_908);
    const resultado = evaluarQuorumYMayoriaJuntaPorCapital(presenciales, votosFavor, baseIntegra);
    expect(resultado.presentPct).toBeCloseTo(0.8871540099361249, 12);
    expect(resultado.presentPct).not.toBeCloseTo(0.8875739644970414, 6);
  });

  it("sin ningún voto concurrente no hay quórum ni mayoría", () => {
    const resultado = evaluarQuorumYMayoriaJuntaPorCapital(presenciales, [], baseComputoJunta());
    expect(resultado.concurrentWeight).toBe(0);
    expect(resultado.quorumReached).toBe(false);
    expect(resultado.majorityReached).toBe(false);
  });

  it("mayoría ordinaria del art. 201.1 LSC: favor > contra, no favor > mitad del concurrente", () => {
    // 2 a favor (100) y 1 en contra (50): favor > contra ya con quórum
    // mínimo, aunque el CONTRA no sea residual.
    const votos: JuntaCapitalVote[] = [
      { personId: "socio-1", value: "FAVOR" },
      { personId: "socio-2", value: "FAVOR" },
      { personId: "socio-3", value: "CONTRA" },
    ];
    const resultado = evaluarQuorumYMayoriaJuntaPorCapital(presenciales, votos, baseComputoJunta());
    expect(resultado.favor).toBe(100);
    expect(resultado.contra).toBe(50);
    expect(resultado.majorityReached).toBe(true);
  });

  it("un empate favor/contra no alcanza mayoría", () => {
    const empatados: JuntaCapitalSeat[] = [
      { personId: "socio-1", rawVotes: 50 },
      { personId: "socio-2", rawVotes: 50 },
    ];
    const votos: JuntaCapitalVote[] = [
      { personId: "socio-1", value: "FAVOR" },
      { personId: "socio-2", value: "CONTRA" },
    ];
    const resultado = evaluarQuorumYMayoriaJuntaPorCapital(empatados, votos, baseComputoJunta());
    expect(resultado.quorumReached).toBe(true);
    expect(resultado.majorityReached).toBe(false);
  });

  it("una clase excluida de la base declarada (rawVotes=0) no aporta a quórum ni a la mayoría aunque vote", () => {
    // Un socio de clase B bajo VOTOS_CLASE_A_NO_AUTOCARTERA: su asiento existe
    // (puede votar) pero su peso está a cero por criterio declarado, no por
    // ausencia de voto — docs/legal/…§4: "no afirma que la clase B carezca de
    // voto".
    const seats: JuntaCapitalSeat[] = [...presenciales, { personId: "socio-clase-b", rawVotes: 0 }];
    const votos: JuntaCapitalVote[] = [...votosFavor, { personId: "socio-clase-b", value: "CONTRA" }];
    const resultado = evaluarQuorumYMayoriaJuntaPorCapital(seats, votos, baseComputoJunta());
    expect(resultado.concurrentWeight).toBe(150);
    expect(resultado.contra).toBe(0);
    expect(resultado.majorityReached).toBe(true);
  });
});
