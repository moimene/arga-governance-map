import { describe, expect, it } from "vitest";
import { rulePackOrganoFamily, sameRulePackOrgano } from "../rule-pack-organo";
import {
  isUnreliableRulePackSelection,
  selectRulePackForOrgano,
} from "../rule-pack-selection";

/**
 * Este camino no tenía NI UN test. Ningún unitario mencionaba
 * `useRulePackForMateria` y ningún e2e ejercitaba la elección de pack por
 * órgano, de modo que el fallback rellenaba la pantalla con contenido plausible
 * y cualquier regresión era invisible para las puertas. Eso es lo que permitió
 * que ITEM-133 se diera por cerrado estando a medias.
 *
 * Vocabulario y cifras verificados contra Cloud `governance_OS` (2026-07-18).
 */

const pack = (organo: string | null) => ({ organo_tipo: organo });

describe("rulePackOrganoFamily — lista blanca, nunca substring", () => {
  it("reconoce el vocabulario real de Cloud", () => {
    expect(rulePackOrganoFamily("JUNTA_GENERAL")).toBe("JUNTA_GENERAL");
    expect(rulePackOrganoFamily("CONSEJO")).toBe("CONSEJO");
    expect(rulePackOrganoFamily("SOCIO_UNICO")).toBe("SOCIO_UNICO");
    expect(rulePackOrganoFamily("SOPORTE_INTERNO")).toBe("SOPORTE_INTERNO");
  });

  it("reconoce los alias del proyecto: CDA es órgano de administración y COMITE es comisión", () => {
    expect(rulePackOrganoFamily("CDA")).toBe("CONSEJO");
    expect(rulePackOrganoFamily("COMITE")).toBe("COMISION_DELEGADA");
    expect(rulePackOrganoFamily("COMISION")).toBe("COMISION_DELEGADA");
    expect(rulePackOrganoFamily(" junta ")).toBe("JUNTA_GENERAL");
  });

  it("NO casa por substring: ese era el agujero del criterio anterior", () => {
    // `v.includes("CONSEJO")` leía estos como órgano de administración.
    expect(rulePackOrganoFamily("NO_ADMINISTRACION")).toBeNull();
    expect(rulePackOrganoFamily("SIN_CONSEJO")).toBeNull();
    expect(rulePackOrganoFamily("EX_JUNTA_DISUELTA")).toBeNull();
  });

  it("el pack híbrido del catálogo no acredita órgano", () => {
    expect(rulePackOrganoFamily("JUNTA_GENERAL_O_CONSEJO")).toBeNull();
  });

  it("no colapsa socio único en Junta: es criterio pendiente del Comité Legal", () => {
    expect(sameRulePackOrgano("SOCIO_UNICO", "JUNTA_GENERAL")).toBe(false);
    expect(sameRulePackOrgano("JUNTA", "JUNTA_GENERAL")).toBe(true);
    expect(sameRulePackOrgano("CDA", "CONSEJO")).toBe(true);
    expect(sameRulePackOrgano("COMITE", "COMISION")).toBe(true);
  });

  it("un código desconocido no casa con nada, ni siquiera consigo mismo", () => {
    expect(sameRulePackOrgano("ORGANO_RARO", "ORGANO_RARO")).toBe(false);
    expect(sameRulePackOrgano(null, null)).toBe(false);
  });
});

describe("selectRulePackForOrgano — prefiere el órgano y declara por qué", () => {
  it("elige el pack del órgano que adopta cuando existe", () => {
    // Caso real: AUTORIZACION_GARANTIA es la única materia con dos packs.
    const rows = [pack("JUNTA_GENERAL"), pack("CONSEJO")];
    const sel = selectRulePackForOrgano(rows, "CDA");
    expect(sel.pack).toBe(rows[1]);
    expect(sel.reason).toBe("ORGANO_COINCIDE");
    expect(isUnreliableRulePackSelection(sel.reason)).toBe(false);
  });

  it("declara el fallback cuando ningún pack es del órgano que adopta", () => {
    // Caso real: 6 acuerdos de Consejo reciben el pack de Junta, y 2 de comisión
    // delegada reciben el que haya, porque no existe ni un pack de comisión.
    const rows = [pack("JUNTA_GENERAL")];
    const sel = selectRulePackForOrgano(rows, "CDA");
    expect(sel.pack).toBe(rows[0]);
    expect(sel.reason).toBe("FALLBACK_ORGANO_DISTINTO");
    expect(sel.packOrgano).toBe("JUNTA_GENERAL");
    expect(isUnreliableRulePackSelection(sel.reason)).toBe(true);
  });

  it("una comisión delegada no se conforma con el pack del consejo", () => {
    const rows = [pack("CONSEJO")];
    const sel = selectRulePackForOrgano(rows, "COMISION_DELEGADA");
    expect(sel.reason).toBe("FALLBACK_ORGANO_DISTINTO");
  });

  it("sin órgano conocido y con un solo pack no hay ambigüedad", () => {
    const rows = [pack("JUNTA_GENERAL")];
    const sel = selectRulePackForOrgano(rows, null);
    expect(sel.pack).toBe(rows[0]);
    expect(sel.reason).toBe("UNICO_PACK_SIN_ORGANO_CONOCIDO");
    expect(isUnreliableRulePackSelection(sel.reason)).toBe(false);
  });

  it("sin órgano conocido y con varios packs la elección es arbitraria y se declara", () => {
    const rows = [pack("JUNTA_GENERAL"), pack("CONSEJO")];
    const sel = selectRulePackForOrgano(rows, undefined);
    expect(sel.reason).toBe("FALLBACK_AMBIGUO");
    expect(isUnreliableRulePackSelection(sel.reason)).toBe(true);
  });

  it("sin packs no devuelve nada ni inventa un motivo", () => {
    const sel = selectRulePackForOrgano([], "CDA");
    expect(sel.pack).toBeNull();
    expect(sel.reason).toBeNull();
  });

  it("conserva el comportamiento previo: nunca deja de servir un pack existente", () => {
    // La corrección de fondo (devolver null bajo discrepancia) es la opción C,
    // posterior a la demo y con decisión del Comité Legal. Este lote solo
    // ADVIERTE, así que la salida no puede cambiar.
    for (const organo of ["CDA", "JUNTA", "COMISION", "SOCIO_UNICO", "DESCONOCIDO", null]) {
      const rows = [pack("JUNTA_GENERAL"), pack("CONSEJO")];
      expect(selectRulePackForOrgano(rows, organo).pack).not.toBeNull();
    }
  });
});
