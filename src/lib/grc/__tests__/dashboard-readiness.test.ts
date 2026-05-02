import { describe, expect, it } from "vitest";
import {
  GRC_HANDOFF_CANDIDATES,
  GRC_NOT_CONNECTED_BACKLOG,
  GRC_P0_DOMAINS,
  GRC_SCREEN_POSTURES,
  getGrcHandoffCandidate,
  getGrcP0ReadinessSummary,
  getGrcScreenPostureSummary,
} from "../dashboard-readiness";

describe("grc dashboard readiness contract", () => {
  it("keeps the P0 executive domains stable", () => {
    expect(GRC_P0_DOMAINS.map((domain) => domain.id)).toEqual([
      "gdpr-canal-interno",
      "dora-ict",
      "cyber",
      "erm-auditoria",
      "work-alerts-exceptions",
      "country-packs",
    ]);
  });

  it("exposes source posture and next steps for every P0 domain", () => {
    for (const domain of GRC_P0_DOMAINS) {
      expect(["legacy", "frontend_connected"]).toContain(domain.sourcePosture);
      expect(["ready", "watch", "gap"]).toContain(domain.readiness);
      expect(domain.coverage).toBeGreaterThanOrEqual(0);
      expect(domain.coverage).toBeLessThanOrEqual(100);
      expect(domain.nextStep.length).toBeGreaterThan(20);
      expect(domain.route).toMatch(/^\/grc/);
      expect(domain.connectedRoutes.length).toBeGreaterThan(0);
      for (const route of domain.connectedRoutes) {
        expect(route).toMatch(/^\/grc/);
      }
    }
  });

  it("keeps non-connected domains out of the primary readiness panel", () => {
    expect(GRC_P0_DOMAINS.map((domain) => domain.id)).not.toContain("tprm");
    expect(GRC_NOT_CONNECTED_BACKLOG.map((domain) => domain.id)).toEqual([
      "tprm",
    ]);
  });

  it("summarizes readiness without fetching data", () => {
    expect(getGrcP0ReadinessSummary()).toEqual({
      total: 6,
      ready: 3,
      watch: 3,
      gap: 0,
      legacySources: 2,
      connectedSources: 4,
      connectedRoutes: 24,
      averageCoverage: 75,
    });
  });

  it("maps every connected GRC frontend screen with owner, source posture and access mode", () => {
    expect(GRC_SCREEN_POSTURES).toHaveLength(30);

    for (const screen of GRC_SCREEN_POSTURES) {
      expect(screen.owner).toBe("GRC Compass");
      expect(screen.route).toMatch(/^\/grc/);
      expect(screen.sourceOfTruth.length).toBeGreaterThan(0);
      expect(screen.notes.length).toBeGreaterThan(20);
      expect(["legacy_read", "legacy_write", "tgms_handoff", "local_demo_read", "backlog_placeholder"]).toContain(
        screen.sourcePosture,
      );
      expect(["read-only", "owner-write", "backlog"]).toContain(screen.accessMode);
    }
  });

  it("keeps write posture limited to GRC-owned incident and risk workflows", () => {
    const ownerWriteScreens = GRC_SCREEN_POSTURES.filter((screen) => screen.accessMode === "owner-write");

    expect(ownerWriteScreens.map((screen) => screen.route)).toEqual([
      "/grc/risk-360/nuevo",
      "/grc/risk-360/:id/editar",
      "/grc/incidentes/nuevo",
    ]);
    expect(ownerWriteScreens.map((screen) => screen.tables.join(","))).toEqual([
      "risks",
      "risks",
      "incidents",
    ]);
    expect(ownerWriteScreens.every((screen) => screen.sourcePosture === "legacy_write")).toBe(true);
  });

  it("keeps TPRM out while penal anticorruption is connected as a legacy read view", () => {
    const connectedIdsAndRoutes = GRC_SCREEN_POSTURES.flatMap((screen) => [
      screen.id,
      screen.route,
      screen.label,
    ]).join(" ").toLowerCase();

    expect(connectedIdsAndRoutes).not.toContain("tprm");
    expect(connectedIdsAndRoutes).toContain("anticorrup");
    expect(GRC_NOT_CONNECTED_BACKLOG.map((domain) => domain.id)).toEqual(["tprm"]);
  });

  it("summarizes screen posture without database access", () => {
    expect(getGrcScreenPostureSummary()).toEqual({
      total: 30,
      withTables: 23,
      withHandoffCandidates: 11,
      byAccessMode: {
        "read-only": 23,
        "owner-write": 3,
        backlog: 4,
      },
      bySourcePosture: {
        legacy_read: 19,
        legacy_write: 3,
        tgms_handoff: 1,
        local_demo_read: 3,
        backlog_placeholder: 4,
      },
    });
  });

  it("declares read-only handoff candidates without event or link writes", () => {
    expect(GRC_HANDOFF_CANDIDATES.map((candidate) => candidate.id)).toEqual([
      "grc-incident-secretaria",
      "grc-finding-secretaria",
      "aims-gap-grc",
      "aims-incident-grc",
    ]);

    for (const candidate of GRC_HANDOFF_CANDIDATES) {
      expect(candidate.mutation).toBe("read-only-route");
      expect(candidate.targetRoute).toMatch(/^\/(grc|secretaria)/);
      expect(candidate.contractEvent).toMatch(/^(GRC|AIMS)_/);
    }

    expect(getGrcHandoffCandidate("aims-gap-grc")?.targetRoute).toContain("/grc/risk-360");
    expect(getGrcHandoffCandidate("grc-incident-secretaria")?.targetRoute).toContain("/secretaria/reuniones/nueva");
  });
});
