import { describe, expect, it } from "vitest";
import { getMeetingOpeningAvailability } from "@/hooks/useReunionSecretaria";

const NOW = Date.parse("2026-07-21T08:00:00.000Z");

describe("meeting opening availability", () => {
  it("blocks a meeting whose scheduled start is still in the future", () => {
    expect(
      getMeetingOpeningAvailability(
        "CONVOCADA",
        "2026-08-09T08:00:00.000Z",
        "2026-08-09T10:00:00.000Z",
        NOW,
      ),
    ).toEqual({
      allowed: false,
      reason: "La sesión solo podrá abrirse cuando llegue la fecha y hora de inicio previstas.",
    });
  });

  it("allows DRAFT and CONVOCADA meetings exactly at or after scheduled_start", () => {
    expect(
      getMeetingOpeningAvailability(
        "CONVOCADA",
        "2026-07-21T08:00:00.000Z",
        "2026-07-21T10:00:00.000Z",
        NOW,
      ).allowed,
    ).toBe(true);
    expect(
      getMeetingOpeningAvailability(
        "DRAFT",
        "2026-07-21T07:30:00.000Z",
        "2026-07-21T09:30:00.000Z",
        NOW,
      ).allowed,
    ).toBe(true);
  });

  it("blocks terminal states and incoherent schedules", () => {
    expect(
      getMeetingOpeningAvailability(
        "CANCELADA",
        "2026-07-21T07:00:00.000Z",
        "2026-07-21T09:00:00.000Z",
        NOW,
      ).allowed,
    ).toBe(false);
    expect(
      getMeetingOpeningAvailability(
        "CONVOCADA",
        "2026-07-21T08:00:00.000Z",
        null,
        NOW,
      ).allowed,
    ).toBe(false);
    expect(
      getMeetingOpeningAvailability(
        "CONVOCADA",
        "2026-07-21T10:00:00.000Z",
        "2026-07-21T09:00:00.000Z",
        NOW,
      ).allowed,
    ).toBe(false);
  });
});
