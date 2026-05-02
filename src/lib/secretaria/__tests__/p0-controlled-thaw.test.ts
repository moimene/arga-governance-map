import { describe, expect, test } from "vitest";
import { evaluateP0ControlledThawRulePacks } from "../p0-controlled-thaw";
import type { RawRulePackVersionRow } from "@/lib/rules-engine/rule-resolution";

function row(packId: string, version: string, extra: Partial<RawRulePackVersionRow> = {}): RawRulePackVersionRow {
  return {
    id: `${packId}-${version}`,
    pack_id: packId,
    version,
    status: "ACTIVE",
    payload_hash: `${packId}-${version}-hash`,
    payload: {
      id: packId,
      materia: packId,
      clase: "ORDINARIA",
      organoTipo: packId === "AUTORIZACION_GARANTIA" ? "CONSEJO" : "JUNTA_GENERAL",
    },
    rule_packs: {
      id: packId,
      materia: packId,
      organo_tipo: packId === "AUTORIZACION_GARANTIA" ? "CONSEJO" : "JUNTA_GENERAL",
    },
    ...extra,
  };
}

describe("p0-controlled-thaw", () => {
  test("bloquea cerrado si falta un pack P0", () => {
    const result = evaluateP0ControlledThawRulePacks([
      row("DELEGACION_FACULTADES", "1.1.0"),
      row("DIVIDENDO_A_CUENTA", "1.0.0"),
      row("OPERACION_VINCULADA", "1.1.0"),
    ]);

    expect(result.ok).toBe(false);
    expect(result.blockingIssues).toContain("No hay rule pack Cloud para AUTORIZACION_GARANTIA.");
  });

  test("usa AUTORIZACION_GARANTIA como materia canonica de garantia intragrupo", () => {
    const result = evaluateP0ControlledThawRulePacks([
      row("DELEGACION_FACULTADES", "1.1.0"),
      row("DIVIDENDO_A_CUENTA", "1.0.0"),
      row("OPERACION_VINCULADA", "1.1.0"),
      row("AUTORIZACION_GARANTIA", "1.1.0"),
    ]);

    const garantia = result.packs.find((pack) => pack.targetPackId === "AUTORIZACION_GARANTIA");

    expect(result.ok).toBe(true);
    expect(garantia?.status).toBe("READY");
    expect(garantia?.selectedVersion?.packId).toBe("AUTORIZACION_GARANTIA");
    expect(garantia?.warnings).not.toContain("AUTORIZACION_GARANTIA se satisface mediante alias Cloud GARANTIA_PRESTAMO.");
  });

  test("acepta GARANTIA_PRESTAMO solo como alias legacy de AUTORIZACION_GARANTIA", () => {
    const result = evaluateP0ControlledThawRulePacks([
      row("DELEGACION_FACULTADES", "1.1.0"),
      row("DIVIDENDO_A_CUENTA", "1.0.0"),
      row("OPERACION_VINCULADA", "1.1.0"),
      row("GARANTIA_PRESTAMO", "1.1.0"),
    ]);

    const garantia = result.packs.find((pack) => pack.targetPackId === "AUTORIZACION_GARANTIA");

    expect(result.ok).toBe(true);
    expect(garantia?.status).toBe("READY_WITH_WARNINGS");
    expect(garantia?.selectedVersion?.packId).toBe("GARANTIA_PRESTAMO");
    expect(garantia?.warnings).toContain("AUTORIZACION_GARANTIA se satisface mediante alias Cloud GARANTIA_PRESTAMO.");
  });

  test("marca duplicados ACTIVE como warning, no como bloqueo", () => {
    const result = evaluateP0ControlledThawRulePacks([
      row("DELEGACION_FACULTADES", "1.0.0"),
      row("DELEGACION_FACULTADES", "1.1.0"),
      row("DIVIDENDO_A_CUENTA", "1.0.0"),
      row("OPERACION_VINCULADA", "1.1.0"),
      row("AUTORIZACION_GARANTIA", "1.1.0"),
    ]);

    const delegacion = result.packs.find((pack) => pack.targetPackId === "DELEGACION_FACULTADES");

    expect(result.ok).toBe(true);
    expect(delegacion?.status).toBe("READY_WITH_WARNINGS");
    expect(delegacion?.selectedVersion?.version).toBe("1.1.0");
    expect(delegacion?.warnings).toContain(
      "Hay 2 versiones ACTIVE con hash para DELEGACION_FACULTADES; se usara la semver mas reciente.",
    );
  });

  test("bloquea si Cloud no aporta payload_hash persistido", () => {
    const result = evaluateP0ControlledThawRulePacks([
      row("DELEGACION_FACULTADES", "1.1.0", { payload_hash: null }),
      row("DIVIDENDO_A_CUENTA", "1.0.0"),
      row("OPERACION_VINCULADA", "1.1.0"),
      row("AUTORIZACION_GARANTIA", "1.1.0"),
    ]);

    expect(result.ok).toBe(false);
    expect(result.blockingIssues).toContain(
      "No hay version ACTIVE con payload_hash persistido para DELEGACION_FACULTADES.",
    );
  });

  test("arrastra warning si payload versionado corrige metadata de catalogo", () => {
    const result = evaluateP0ControlledThawRulePacks([
      row("DELEGACION_FACULTADES", "1.1.0"),
      row("DIVIDENDO_A_CUENTA", "1.0.0"),
      row("OPERACION_VINCULADA", "1.1.0"),
      row("AUTORIZACION_GARANTIA", "1.1.0", {
        rule_packs: { id: "AUTORIZACION_GARANTIA", materia: "AUTORIZACION_GARANTIA", organo_tipo: "JUNTA_GENERAL" },
      }),
    ]);

    expect(result.ok).toBe(true);
    expect(result.warnings).toContain(
      "Conflicto metadata rule_packs/payload en organo_tipo: catalogo=JUNTA_GENERAL, payload=CONSEJO; se usa payload versionado.",
    );
  });
});
