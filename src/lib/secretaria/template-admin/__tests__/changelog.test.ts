import { describe, it, expect } from "vitest";
import {
  computeIdempotencyKey,
  buildDiffSummary,
  buildEventToVersion,
  serializeDiffSummary,
} from "../changelog";

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

  it("diferente discriminador dentro del mismo bucket → distinto hash", () => {
    const ts = 1715508000000;
    expect(computeIdempotencyKey("p1", "1.0.0", ts, "A")).not.toBe(
      computeIdempotencyKey("p1", "1.0.0", ts, "B"),
    );
  });

  it("serializeDiffSummary produce texto compatible con Cloud", () => {
    const text = serializeDiffSummary(
      { action: "IMPORT", ack: true },
      {
        logicalToVersion: "1.0.0",
        ackMotivo: "Warnings revisadas",
      },
    );
    expect(typeof text).toBe("string");
    expect(JSON.parse(text)).toEqual({
      action: "IMPORT",
      ack: true,
      logical_to_version: "1.0.0",
      ack_motivo: "Warnings revisadas",
    });
  });

  it("buildEventToVersion conserva la versión lógica y añade token único", () => {
    expect(buildEventToVersion("1.0.0", "idemp:abcd1234")).toBe("1.0.0#idemp:abcd1234");
  });
});
