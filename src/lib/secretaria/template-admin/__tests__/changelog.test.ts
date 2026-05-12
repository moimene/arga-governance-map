import { describe, it, expect } from "vitest";
import { computeIdempotencyKey, buildDiffSummary } from "../changelog";

describe("changelog — idempotency key", () => {
  it("misma plantilla + version + bucket 5s → mismo hash", () => {
    const ts = 1715508000000; // 2024-05-12 09:20:00
    const k1 = computeIdempotencyKey("p1", "1.0.0", ts);
    const k2 = computeIdempotencyKey("p1", "1.0.0", ts + 4000); // dentro del bucket 5s
    expect(k1).toBe(k2);
  });

  it("diferente toVersion → distinto hash", () => {
    const ts = 1715508000000;
    expect(computeIdempotencyKey("p1", "1.0.0", ts)).not.toBe(computeIdempotencyKey("p1", "1.0.1", ts));
  });

  it("diferente bucket 5s → distinto hash", () => {
    const ts = 1715508000000;
    expect(computeIdempotencyKey("p1", "1.0.0", ts)).not.toBe(
      computeIdempotencyKey("p1", "1.0.0", ts + 10000),
    );
  });

  it("buildDiffSummary state-change", () => {
    const d = buildDiffSummary({ action: "STATE_CHANGE", fromState: "REVISADA", toState: "APROBADA" });
    expect(d).toEqual({ action: "STATE_CHANGE", from_state: "REVISADA", to_state: "APROBADA" });
  });

  it("buildDiffSummary import con ack", () => {
    const d = buildDiffSummary({ action: "IMPORT", source: "wizard", ack: true });
    expect(d).toEqual({ action: "IMPORT", source: "wizard", ack: true });
  });
});
