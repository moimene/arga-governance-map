import { describe, expect, it } from "vitest";
import { selectMeetingOfficers } from "../meeting-officers";

describe("meeting officers", () => {
  it("prefiere presidente y secretario vigentes sobre sus suplentes", () => {
    expect(selectMeetingOfficers([
      { person_id: "vp", cargo: "VICEPRESIDENTE", fecha_inicio: "2026-01-01" },
      { person_id: "president", cargo: "PRESIDENTE", fecha_inicio: "2025-01-01" },
      { person_id: "vice-secretary", cargo: "VICESECRETARIO", fecha_inicio: "2026-01-01" },
      { person_id: "secretary", cargo: "SECRETARIO", fecha_inicio: "2025-01-01" },
    ])).toEqual({
      president_id: "president",
      secretary_id: "secretary",
    });
  });

  it("usa suplentes solo cuando falta el cargo principal", () => {
    expect(selectMeetingOfficers([
      { person_id: "vp", cargo: "VICEPRESIDENTE" },
      { person_id: "vice-secretary", cargo: "VICESECRETARIO" },
    ])).toEqual({
      president_id: "vp",
      secretary_id: "vice-secretary",
    });
  });
});
