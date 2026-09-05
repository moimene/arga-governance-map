import { describe, expect, it } from "vitest";
import {
  GRC_COMPLIANCE_AREAS,
  GRC_COMPLIANCE_MONITORS,
  GRC_HANDOFF_CANDIDATES,
  GRC_NOT_CONNECTED_BACKLOG,
  GRC_P0_DOMAINS,
  GRC_SCREEN_POSTURES,
  getGrcComplianceMonitorSummary,
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
    // TPRM salió del backlog: `/grc/tprm` lee `grc_third_parties` de verdad.
    expect(GRC_NOT_CONNECTED_BACKLOG).toEqual([]);
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

  it("declares a broad compliance monitoring map without pretending TPRM is connected", () => {
    expect(GRC_COMPLIANCE_AREAS).toEqual([
      "Riesgo y control",
      "Regulatorio y privacidad",
      "Tecnología y resiliencia",
      "Assurance y escalado",
    ]);
    expect(GRC_COMPLIANCE_MONITORS.map((monitor) => monitor.id)).toEqual([
      "regulatory-obligations",
      "controls-assurance",
      "risk-rcsa",
      "incident-regulatory",
      "dora-ict",
      "cyber-remediation",
      "bcm-operational-resilience",
      "privacy-gdpr",
      "tprm-outsourcing",
      "penal-anticorruption",
      "audit-remediation",
      "exceptions-waivers",
      "policy-lifecycle",
      "country-packs",
      "board-escalation",
      "aims-intake",
    ]);

    // `/grc/tprm` lee `grc_third_parties` con filas reales del tenant: la
    // postura declarada tiene que decirlo, o el propio producto la desmiente.
    const tprm = GRC_COMPLIANCE_MONITORS.find((monitor) => monitor.id === "tprm-outsourcing");
    expect(tprm?.readiness).toBe("watch");
    expect(tprm?.route).toBe("/grc/tprm");
    expect(tprm?.sourcePosture).toBe("legacy_read");
    expect(tprm?.sourceTables).toEqual(["grc_third_parties"]);
  });

  it("summarizes compliance monitoring posture without database access", () => {
    expect(getGrcComplianceMonitorSummary()).toEqual({
      total: 16,
      withSourceTables: 16,
      withHandoffs: 8,
      backlog: 0,
      byReadiness: {
        ready: 6,
        watch: 10,
        gap: 0,
      },
      byArea: {
        "Riesgo y control": 5,
        "Regulatorio y privacidad": 5,
        "Tecnología y resiliencia": 3,
        "Assurance y escalado": 3,
      },
    });
  });

  it("keeps compliance monitor handoffs inside declared route-only contracts", () => {
    const declaredCandidateIds = GRC_HANDOFF_CANDIDATES.map((candidate) => candidate.id);

    for (const monitor of GRC_COMPLIANCE_MONITORS) {
      expect(["ready", "watch", "gap"]).toContain(monitor.readiness);
      expect(monitor.executiveSignal.length).toBeGreaterThan(20);
      expect(monitor.nextAction.length).toBeGreaterThan(20);
      expect(monitor.route).toMatch(/^\/(grc|politicas|obligaciones|controles)/);
      for (const handoffId of monitor.handoffCandidateIds) {
        expect(declaredCandidateIds).toContain(handoffId);
      }
    }
  });

  it("maps every connected GRC frontend screen with owner, source posture and access mode", () => {
    expect(GRC_SCREEN_POSTURES).toHaveLength(31);

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
      "/grc/tprm",
      "/grc/incidentes/nuevo",
    ]);
    expect(ownerWriteScreens.map((screen) => screen.tables.join(","))).toEqual([
      "risks",
      "risks",
      "grc_third_parties,evidence_bundles",
      "incidents",
    ]);
    // TPRM escribe `grc_third_parties` pero LEE el resto: su postura declarada
    // es legacy_read, no legacy_write, y el mapa lo distingue.
    expect(
      ownerWriteScreens.every((screen) => ["legacy_write", "legacy_read"].includes(screen.sourcePosture)),
    ).toBe(true);
  });

  it("keeps TPRM out while penal anticorruption is connected as a legacy read view", () => {
    const connectedIdsAndRoutes = GRC_SCREEN_POSTURES.flatMap((screen) => [
      screen.id,
      screen.route,
      screen.label,
    ]).join(" ").toLowerCase();

    expect(connectedIdsAndRoutes).toContain("tprm");
    expect(connectedIdsAndRoutes).toContain("anticorrup");
    expect(GRC_NOT_CONNECTED_BACKLOG).toEqual([]);
  });

  it("summarizes screen posture without database access", () => {
    expect(getGrcScreenPostureSummary()).toEqual({
      total: 31,
      withTables: 24,
      withHandoffCandidates: 11,
      byAccessMode: {
        "read-only": 23,
        "owner-write": 4,
        backlog: 4,
      },
      bySourcePosture: {
        legacy_read: 20,
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
