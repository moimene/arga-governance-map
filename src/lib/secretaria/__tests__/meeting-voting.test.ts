import { describe, expect, it, vi } from "vitest";
import {
  buildDecisionAgendaSnapshots,
  votingMatterFromSnapshot,
} from "../meeting-voting";

describe("meeting voting boundaries", () => {
  it("builds snapshots only for decisory agenda indices", () => {
    const builder = vi.fn((pointIndex: number) => ({ agenda_item_index: pointIndex + 1 }));

    expect(buildDecisionAgendaSnapshots([0, 2, 4], builder)).toEqual([
      { agenda_item_index: 1 },
      { agenda_item_index: 3 },
      { agenda_item_index: 5 },
    ]);
    expect(builder.mock.calls.map(([pointIndex]) => pointIndex)).toEqual([0, 2, 4]);
  });

  it("does not assign voting matter to an informative point without snapshot", () => {
    expect(votingMatterFromSnapshot(undefined)).toBeNull();
    expect(votingMatterFromSnapshot({ materia: "APROBACION_CUENTAS" })).toBe("APROBACION_CUENTAS");
  });
});
