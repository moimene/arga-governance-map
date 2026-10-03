// H-54 (MOI-15): el asiento excluido por conflicto tiene que llegar a
// `meeting_votes`, o el servidor no puede descontarlo y rechaza el acta con
// SERVER_VOTE_EXACTLY_ONE_VOTE_REQUIRED (medido 2026-10-03 en `81a4de74…`,
// presidencia con conflicto activo y sin voto).
import { describe, expect, it } from "vitest";
import { evaluateMeetingVoteCompleteness, votesForPersistence } from "../meeting-vote-completeness";

const presidenteConConflicto = {
  id: "att-presidente",
  attendee_id: "att-presidente",
  vote: "" as const,
  conflict_flag: true,
  conflict_reason: "Conflicto activo registrado en el expediente (arts. 190 y 228.c LSC)",
};
const consejeraFavor = { id: "att-1", attendee_id: "att-1", vote: "FAVOR" as const, conflict_flag: false, conflict_reason: "" };
const consejeroSinVoto = { id: "att-2", attendee_id: "att-2", vote: "" as const, conflict_flag: false, conflict_reason: "" };

describe("votesForPersistence (H-54)", () => {
  it("EL DEFECTO: un asiento con conflicto y sin voto se persiste (ABSTENCION + conflict_flag + motivo), no se descarta", () => {
    const rows = votesForPersistence([consejeraFavor, presidenteConConflicto]);
    expect(rows).toEqual([
      { attendee_id: "att-1", vote_value: "FAVOR", conflict_flag: false, reason: null },
      {
        attendee_id: "att-presidente",
        vote_value: "ABSTENCION",
        conflict_flag: true,
        reason: "Conflicto activo registrado en el expediente (arts. 190 y 228.c LSC)",
      },
    ]);
  });

  it("un asiento sin voto y sin conflicto sigue sin enviarse (el botón ya lo bloquea por incompleto)", () => {
    expect(votesForPersistence([consejeroSinVoto])).toEqual([]);
    expect(evaluateMeetingVoteCompleteness([consejeroSinVoto]).complete).toBe(false);
  });

  it("coherencia con el criterio de completitud: todo punto completo produce una fila por asiento", () => {
    const punto = [consejeraFavor, presidenteConConflicto, { ...consejeroSinVoto, vote: "CONTRA" as const }];
    expect(evaluateMeetingVoteCompleteness(punto).complete).toBe(true);
    expect(votesForPersistence(punto)).toHaveLength(punto.length);
  });

  it("un conflicto con voto expreso conserva el voto y el flag (el servidor lo ignora como voto, lo descuenta como asiento)", () => {
    const rows = votesForPersistence([{ ...presidenteConConflicto, vote: "FAVOR" }]);
    expect(rows[0]).toMatchObject({ vote_value: "FAVOR", conflict_flag: true });
  });

  it("el motivo vacío viaja como null y el attendee_id nulo se respeta", () => {
    const rows = votesForPersistence([{ id: "x", attendee_id: null, vote: "ABSTENCION", conflict_flag: false, conflict_reason: "   " }]);
    expect(rows).toEqual([{ attendee_id: null, vote_value: "ABSTENCION", conflict_flag: false, reason: null }]);
  });
});
