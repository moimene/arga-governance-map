import { describe, expect, it } from "vitest";
import {
  extractMajorityFromRulePackParams,
  mapRulePackJoinRowToVersionRow,
  pickFreshestRulePackVersion,
  type RulePackJoinRow,
} from "../rule-pack-params";

// ─── extractMajorityFromRulePackParams ───────────────────────────────────────

describe("extractMajorityFromRulePackParams", () => {
  it("returns null for null and undefined", () => {
    expect(extractMajorityFromRulePackParams(null)).toBeNull();
    expect(extractMajorityFromRulePackParams(undefined)).toBeNull();
  });

  it("returns null for primitive payloads", () => {
    expect(extractMajorityFromRulePackParams("0.5")).toBeNull();
    expect(extractMajorityFromRulePackParams(0.5)).toBeNull();
    expect(extractMajorityFromRulePackParams(true)).toBeNull();
  });

  it("returns null for top-level arrays", () => {
    expect(extractMajorityFromRulePackParams([0.5])).toBeNull();
  });

  it("returns null for empty object", () => {
    expect(extractMajorityFromRulePackParams({})).toBeNull();
  });

  it("returns null when no candidate keys are present", () => {
    expect(extractMajorityFromRulePackParams({ unrelated: 0.5 })).toBeNull();
  });

  it("accepts numeric `majority` shorthand", () => {
    expect(extractMajorityFromRulePackParams({ majority: 0.5 })).toEqual({
      code: null,
      threshold: 0.5,
    });
  });

  it("accepts numeric `mayoria` (es) shorthand", () => {
    expect(extractMajorityFromRulePackParams({ mayoria: 0.6667 })).toEqual({
      code: null,
      threshold: 0.6667,
    });
  });

  it("accepts numeric `majority_threshold` shorthand", () => {
    expect(extractMajorityFromRulePackParams({ majority_threshold: 0.75 })).toEqual({
      code: null,
      threshold: 0.75,
    });
  });

  it("extracts threshold/code/description from object form (en keys)", () => {
    expect(
      extractMajorityFromRulePackParams({
        majority: { threshold: 0.5, code: "MAYORIA_SIMPLE", description: "Simple majority" },
      }),
    ).toEqual({
      threshold: 0.5,
      code: "MAYORIA_SIMPLE",
      description: "Simple majority",
    });
  });

  it("extracts from object form with es-locale keys", () => {
    expect(
      extractMajorityFromRulePackParams({
        mayoria_legal: {
          umbral: 0.6667,
          codigo: "MAYORIA_REFORZADA",
          descripcion: "Mayoría reforzada",
        },
      }),
    ).toEqual({
      threshold: 0.6667,
      code: "MAYORIA_REFORZADA",
      description: "Mayoría reforzada",
    });
  });

  it("falls back to legacy `value` key for threshold", () => {
    expect(
      extractMajorityFromRulePackParams({ majority: { value: 0.5, code: "X" } }),
    ).toEqual({ threshold: 0.5, code: "X", description: null });
  });

  it("returns partial when only code is present (threshold null)", () => {
    expect(
      extractMajorityFromRulePackParams({ majority: { code: "MAYORIA_SIMPLE" } }),
    ).toEqual({ threshold: null, code: "MAYORIA_SIMPLE", description: null });
  });

  it("returns partial when only threshold is present (code null)", () => {
    expect(
      extractMajorityFromRulePackParams({ majority: { threshold: 0.5 } }),
    ).toEqual({ threshold: 0.5, code: null, description: null });
  });

  it("returns null when threshold is non-numeric and code is missing", () => {
    expect(
      extractMajorityFromRulePackParams({ majority: { threshold: "0.5" } }),
    ).toBeNull();
  });

  it("uses the first matching candidate key (precedence: majority → mayoria → mayoria_legal → majority_threshold)", () => {
    expect(
      extractMajorityFromRulePackParams({
        majority: 0.5,
        mayoria: 0.6,
        mayoria_legal: 0.7,
      }),
    ).toEqual({ code: null, threshold: 0.5 });
  });

  it("ignores nested arrays inside a candidate", () => {
    expect(
      extractMajorityFromRulePackParams({ majority: [{ threshold: 0.5 }] }),
    ).toBeNull();
  });
});

// ─── mapRulePackJoinRowToVersionRow ──────────────────────────────────────────

describe("mapRulePackJoinRowToVersionRow", () => {
  const baseRow: RulePackJoinRow = {
    id: "rpv-1",
    pack_id: "pack-modificacion-estatutos",
    version: "2.0.0",
    is_active: true,
    payload: { majority: 0.6667 },
    created_at: "2026-04-01T00:00:00Z",
    rule_packs: {
      tenant_id: "tenant-arga",
      materia: "MODIFICACION_ESTATUTOS",
      organo_tipo: "JUNTA",
    },
  };

  it("maps a complete row preserving every field", () => {
    expect(mapRulePackJoinRowToVersionRow(baseRow, "fallback-tenant")).toEqual({
      id: "rpv-1",
      rule_pack_id: "pack-modificacion-estatutos",
      version_tag: "2.0.0",
      status: "ACTIVE",
      params: { majority: 0.6667 },
      created_at: "2026-04-01T00:00:00Z",
      tenant_id: "tenant-arga",
      materia: "MODIFICACION_ESTATUTOS",
      clase: undefined,
      organo_tipo: "JUNTA",
    });
  });

  it("uses fallback tenant when rule_packs join is null", () => {
    const result = mapRulePackJoinRowToVersionRow(
      { ...baseRow, rule_packs: null },
      "fallback-tenant",
    );
    expect(result.tenant_id).toBe("fallback-tenant");
    expect(result.materia).toBeUndefined();
    expect(result.organo_tipo).toBeUndefined();
  });

  it("returns DEPRECATED when is_active is false", () => {
    expect(
      mapRulePackJoinRowToVersionRow({ ...baseRow, is_active: false }, "x").status,
    ).toBe("DEPRECATED");
  });

  it("returns DEPRECATED when is_active is null (legacy rows)", () => {
    expect(
      mapRulePackJoinRowToVersionRow({ ...baseRow, is_active: null }, "x").status,
    ).toBe("DEPRECATED");
  });

  it("returns undefined organo_tipo when join column is null", () => {
    const result = mapRulePackJoinRowToVersionRow(
      {
        ...baseRow,
        rule_packs: { ...baseRow.rule_packs!, organo_tipo: null },
      },
      "x",
    );
    expect(result.organo_tipo).toBeUndefined();
  });
});

// ─── pickFreshestRulePackVersion ─────────────────────────────────────────────

describe("pickFreshestRulePackVersion", () => {
  function row(id: string, created_at: string | null, version = "1.0.0"): RulePackJoinRow {
    return {
      id,
      pack_id: `pack-${id}`,
      version,
      is_active: true,
      payload: null,
      created_at,
      rule_packs: { tenant_id: "t", materia: "M", organo_tipo: null },
    };
  }

  it("returns null for empty input", () => {
    expect(pickFreshestRulePackVersion([])).toBeNull();
  });

  it("returns the only row when input has length 1", () => {
    const r = row("only", "2026-01-01T00:00:00Z");
    expect(pickFreshestRulePackVersion([r])).toBe(r);
  });

  it("picks the latest by created_at when timestamps differ", () => {
    const older = row("older", "2026-01-01T00:00:00Z");
    const newer = row("newer", "2026-05-01T00:00:00Z");
    expect(pickFreshestRulePackVersion([older, newer])?.id).toBe("newer");
    expect(pickFreshestRulePackVersion([newer, older])?.id).toBe("newer");
  });

  it("treats null created_at as older than any non-null timestamp", () => {
    const noTime = row("no-time", null);
    const withTime = row("with-time", "2026-01-01T00:00:00Z");
    expect(pickFreshestRulePackVersion([noTime, withTime])?.id).toBe("with-time");
    expect(pickFreshestRulePackVersion([withTime, noTime])?.id).toBe("with-time");
  });

  it("keeps the first row when all created_at are null (stable)", () => {
    const a = row("a", null);
    const b = row("b", null);
    expect(pickFreshestRulePackVersion([a, b])?.id).toBe("a");
  });

  it("keeps the first row when timestamps tie (stable)", () => {
    const a = row("a", "2026-04-01T00:00:00Z");
    const b = row("b", "2026-04-01T00:00:00Z");
    expect(pickFreshestRulePackVersion([a, b])?.id).toBe("a");
  });

  it("PICKS BY created_at, NOT by version (canonical INC-14 adversarial case)", () => {
    // Operator activated v2 in March, then accidentally re-created v1 in April
    // and forgot to deactivate it. Both rows are is_active=true.
    //   - `version desc` would pick v2 (high semver, but stale).
    //   - `created_at desc` picks v1 (latest creation = current operational intent).
    // Policy: "última activación/creación operativa gana, aunque la versión
    // semántica sea menor".
    const v2_old = row("rpv-v2-old", "2026-03-01T00:00:00Z", "2.0.0");
    const v1_new = row("rpv-v1-new", "2026-04-15T00:00:00Z", "1.0.0");
    expect(pickFreshestRulePackVersion([v2_old, v1_new])?.id).toBe("rpv-v1-new");
    expect(pickFreshestRulePackVersion([v1_new, v2_old])?.id).toBe("rpv-v1-new");
  });

  it("works for the canonical INC-14 happy case (AUMENTO_CAPITAL with v1+v2 active, version and created_at agree)", () => {
    // Cloud has both v1 (older, created earlier) and v2 (newer, created later)
    // marked is_active=true. Picker must return v2.
    const v1 = row("rpv-aumento-v1", "2026-03-01T00:00:00Z", "1.0.0");
    const v2 = row("rpv-aumento-v2", "2026-04-15T00:00:00Z", "2.0.0");
    expect(pickFreshestRulePackVersion([v1, v2])?.id).toBe("rpv-aumento-v2");
    expect(pickFreshestRulePackVersion([v2, v1])?.id).toBe("rpv-aumento-v2");
  });
});
