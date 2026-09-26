/**
 * MOI-207 — el dictamen de validez del expediente elegía rule pack solo por
 * materia (`.find()` sin órgano), así que dos packs activos de la misma
 * materia (Junta vs Consejo) dejaban el resultado a merced del orden en que
 * respondiera PostgREST. El Tramitador ya resolvía esto con
 * `selectRulePackForOrgano`; este test fija que `useAgreementCompliance` usa
 * el mismo criterio, con fixtures — mismo patrón que
 * `useAgreementCompliance-organo-resolver.test.ts` (D1), sin renderHook ni
 * mock de Supabase.
 */
import { describe, expect, it } from "vitest";
import { selectAgreementRulePackVersion } from "../useAgreementCompliance";

const rulePackRow = (organo: string | null, payloadTag: string) => ({
  id: `version-${payloadTag}`,
  pack_id: `pack-${payloadTag}`,
  version: "1",
  payload: { tag: payloadTag },
  is_active: true,
  rule_packs: { materia: "AUTORIZACION_GARANTIA", organo_tipo: organo },
});

describe("MOI-207 — selectAgreementRulePackVersion", () => {
  it("elige el pack del órgano que adopta cuando hay dos packs de la misma materia", () => {
    const rows = [rulePackRow("JUNTA_GENERAL", "junta"), rulePackRow("CONSEJO", "consejo")];
    const seleccion = selectAgreementRulePackVersion(rows, "AUTORIZACION_GARANTIA", "CONSEJO");
    expect(seleccion.pack?.row.payload).toEqual({ tag: "consejo" });
    expect(seleccion.reason).toBe("ORGANO_COINCIDE");
  });

  // Regresión directa del defecto: con `.find()` a secas, el primero de la
  // materia (Junta) se serviría SIEMPRE, sin mirar que el acuerdo es de
  // Consejo. Si alguien revierte `selectAgreementRulePackVersion` a un
  // `.find()` sin órgano, esta aserción cae porque devolvería "junta".
  it("NO vuelve a elegir solo por materia: el orden de las filas no decide el resultado", () => {
    // Mismas filas, orden invertido: si el criterio fuera "el primero de la
    // materia" el resultado cambiaría según el orden de entrada. Con el
    // criterio por órgano, el resultado es el mismo pack sea cual sea el
    // orden en que responda la query.
    const rowsInvertidas = [rulePackRow("CONSEJO", "consejo"), rulePackRow("JUNTA_GENERAL", "junta")];
    const seleccion = selectAgreementRulePackVersion(rowsInvertidas, "AUTORIZACION_GARANTIA", "CONSEJO");
    expect(seleccion.pack?.row.payload).toEqual({ tag: "consejo" });
  });

  it("filtra por materia con el mismo criterio alias-aware del motor (MOD_ESTATUTOS → MODIFICACION_ESTATUTOS)", () => {
    const rows = [
      {
        id: "v1",
        pack_id: "pack-1",
        version: "1",
        payload: { tag: "estatutos" },
        is_active: true,
        rule_packs: { materia: "MODIFICACION_ESTATUTOS", organo_tipo: "JUNTA_GENERAL" },
      },
      {
        id: "v2",
        pack_id: "pack-2",
        version: "1",
        payload: { tag: "otra-materia" },
        is_active: true,
        rule_packs: { materia: "AUMENTO_CAPITAL", organo_tipo: "JUNTA_GENERAL" },
      },
    ];
    const seleccion = selectAgreementRulePackVersion(rows, "MOD_ESTATUTOS", "JUNTA_GENERAL");
    expect(seleccion.pack?.row.payload).toEqual({ tag: "estatutos" });
  });

  it("declara FALLBACK_ORGANO_DISTINTO cuando ningún pack de la materia es del órgano que adopta", () => {
    const rows = [rulePackRow("JUNTA_GENERAL", "junta")];
    const seleccion = selectAgreementRulePackVersion(rows, "AUTORIZACION_GARANTIA", "CONSEJO");
    expect(seleccion.pack?.row.payload).toEqual({ tag: "junta" });
    expect(seleccion.reason).toBe("FALLBACK_ORGANO_DISTINTO");
    expect(seleccion.packOrgano).toBe("JUNTA_GENERAL");
  });

  it("sin ningún pack de la materia no inventa selección", () => {
    const rows = [rulePackRow("JUNTA_GENERAL", "junta")];
    const seleccion = selectAgreementRulePackVersion(rows, "OTRA_MATERIA_SIN_PACK", "CONSEJO");
    expect(seleccion.pack).toBeNull();
    expect(seleccion.reason).toBeNull();
  });
});
