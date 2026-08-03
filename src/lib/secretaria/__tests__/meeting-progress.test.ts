import { describe, expect, it } from "vitest";
import { patchMeetingQuorumCache } from "../meeting-progress";

describe("patchMeetingQuorumCache", () => {
  it("publishes confirmed quorum in the meeting cache without losing other fields", () => {
    const current = {
      id: "meeting-1",
      status: "IN_PROGRESS",
      title: "Consejo ordinario",
      quorum_data: { quorum: { reached: false } },
      governing_bodies: { body_type: "CONSEJO_ADMIN" },
    };
    const confirmed = { quorum: { reached: true, present: 16, total: 16 } };

    expect(patchMeetingQuorumCache(current, confirmed)).toEqual({
      ...current,
      quorum_data: confirmed,
    });
  });

  it("does not invent a cache row when the meeting query has no data", () => {
    expect(patchMeetingQuorumCache(undefined, { quorum: { reached: true } })).toBeUndefined();
    expect(patchMeetingQuorumCache(null, { quorum: { reached: true } })).toBeNull();
  });
});
