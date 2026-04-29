import { describe, expect, it } from "vitest";
import {
  normalizeRuleLifecycleStatus,
  normalizeRulePackVersion,
  resolveRulePackForMatter,
  type RawRulePackVersionRow,
} from "../rule-resolution";
import type { RuleParamOverride } from "../types";

describe("rule-resolution", () => {
  it("normaliza lifecycle desde estados jurídicos y desde is_active legacy", () => {
    expect(normalizeRuleLifecycleStatus({ status: "DRAFT" })).toBe("DRAFT");
    expect(normalizeRuleLifecycleStatus({ status: "REVISADA" })).toBe("LEGAL_REVIEW");
    expect(normalizeRuleLifecycleStatus({ status: "APROBADA" })).toBe("APPROVED");
    expect(normalizeRuleLifecycleStatus({ status: "ACTIVE" })).toBe("ACTIVE");
    expect(normalizeRuleLifecycleStatus({ status: "DEPRECATED" })).toBe("DEPRECATED");
    expect(normalizeRuleLifecycleStatus({ status: "RETIRED" })).toBe("RETIRED");
    expect(normalizeRuleLifecycleStatus({ is_active: true })).toBe("ACTIVE");
    expect(normalizeRuleLifecycleStatus({ is_active: false })).toBe("DEPRECATED");
    expect(normalizeRuleLifecycleStatus({})).toBe("UNKNOWN");
  });

  it("normaliza una versión actual con pack_id/version/payload y relación rule_packs", () => {
    const normalized = normalizeRulePackVersion({
      id: "version-1",
      pack_id: "APROBACION_CUENTAS",
      version: "1.0.0",
      payload: { id: "APROBACION_CUENTAS", materia: "APROBACION_CUENTAS", clase: "ORDINARIA" },
      is_active: true,
      rule_packs: {
        id: "APROBACION_CUENTAS",
        materia: "APROBACION_CUENTAS",
        organo_tipo: "JUNTA_GENERAL",
        descripcion: "Aprobación de cuentas",
      },
    });

    expect(normalized.packId).toBe("APROBACION_CUENTAS");
    expect(normalized.version).toBe("1.0.0");
    expect(normalized.lifecycleStatus).toBe("ACTIVE");
    expect(normalized.materia).toBe("APROBACION_CUENTAS");
    expect(normalized.organoTipo).toBe("JUNTA_GENERAL");
    expect(normalized.payloadHash).toMatch(/^[a-f0-9]{8,}$/);
    expect(normalized.warnings).toContain("Versión normalizada desde is_active legacy; falta lifecycle jurídico completo.");
  });

  it("bloquea cuando existe materia pero no hay versión ACTIVE", () => {
    const result = resolveRulePackForMatter({
      materia: "DELEGACION_FACULTADES",
      versions: [
        {
          pack_id: "DELEGACION_FACULTADES",
          version: "1.0.0",
          status: "APPROVED",
          payload: { materia: "DELEGACION_FACULTADES" },
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.severity).toBe("BLOCKING");
    expect(result.blocking_issues[0]).toContain("no tiene versión ACTIVE");
  });

  it("permite APPROVED solo para UAT cuando se solicita expresamente", () => {
    const versions: RawRulePackVersionRow[] = [
      {
        pack_id: "DELEGACION_FACULTADES",
        version: "1.0.0",
        status: "APPROVED",
        payload: { materia: "DELEGACION_FACULTADES" },
      },
    ];

    const production = resolveRulePackForMatter({ materia: "DELEGACION_FACULTADES", versions });
    const uat = resolveRulePackForMatter({
      materia: "DELEGACION_FACULTADES",
      versions,
      allowApprovedInUat: true,
    });

    expect(production.ok).toBe(false);
    expect(uat.ok).toBe(true);
    expect(uat.rulePack?.lifecycleStatus).toBe("APPROVED");
  });

  it("selecciona la versión activa más reciente por materia, órgano y clase", () => {
    const result = resolveRulePackForMatter({
      materia: "APROBACION_CUENTAS",
      organoTipo: "JUNTA_GENERAL",
      clase: "ORDINARIA",
      versions: [
        {
          pack_id: "APROBACION_CUENTAS",
          version: "1.0.0",
          status: "ACTIVE",
          payload: { materia: "APROBACION_CUENTAS", clase: "ORDINARIA" },
          rule_packs: { materia: "APROBACION_CUENTAS", clase: "ORDINARIA", organo_tipo: "JUNTA_GENERAL" },
        },
        {
          pack_id: "APROBACION_CUENTAS",
          version: "1.1.0",
          status: "ACTIVE",
          payload: { materia: "APROBACION_CUENTAS", clase: "ORDINARIA", regla: "nueva" },
          rule_packs: { materia: "APROBACION_CUENTAS", clase: "ORDINARIA", organo_tipo: "JUNTA_GENERAL" },
        },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.rulePack?.version).toBe("1.1.0");
    expect(result.warnings).toContain("Hay 2 versiones vigentes para el mismo alcance; se selecciona la versión más reciente.");
  });

  it("incluye overrides aplicables en el snapshot de resolución", () => {
    const overrides: RuleParamOverride[] = [
      {
        id: "override-1",
        entity_id: "entity-1",
        materia: "APROBACION_CUENTAS",
        clave: "constitucion.quorum.SL",
        valor: { valor: 0.3 },
        fuente: "ESTATUTOS",
        referencia: "art. 12 estatutos",
      },
    ];

    const base = resolveRulePackForMatter({
      materia: "APROBACION_CUENTAS",
      versions: [
        {
          pack_id: "APROBACION_CUENTAS",
          version: "1.0.0",
          status: "ACTIVE",
          payload: { materia: "APROBACION_CUENTAS" },
        },
      ],
    });
    const withOverride = resolveRulePackForMatter({
      materia: "APROBACION_CUENTAS",
      versions: [
        {
          pack_id: "APROBACION_CUENTAS",
          version: "1.0.0",
          status: "ACTIVE",
          payload: { materia: "APROBACION_CUENTAS" },
        },
      ],
      overrides,
    });

    expect(withOverride.ok).toBe(true);
    expect(withOverride.applicableOverrides).toHaveLength(1);
    expect(withOverride.rulesetSnapshotId).not.toBe(base.rulesetSnapshotId);
  });

  it("bloquea versiones activas fuera de vigencia", () => {
    const result = resolveRulePackForMatter({
      materia: "GARANTIAS_INTRAGRUPO",
      now: "2026-04-26T00:00:00.000Z",
      versions: [
        {
          pack_id: "GARANTIAS_INTRAGRUPO",
          version: "1.0.0",
          status: "ACTIVE",
          effective_from: "2026-06-01T00:00:00.000Z",
          payload: { materia: "GARANTIAS_INTRAGRUPO" },
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.blocking_issues[0]).toContain("ninguna vigente");
  });
});
