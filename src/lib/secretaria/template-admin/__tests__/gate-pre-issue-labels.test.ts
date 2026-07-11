import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  GATE_PRE_ISSUE_LABEL,
  GATE_PRE_SEVERITY_LABEL,
  gatePreIssueLabel,
  gatePreSeverityLabel,
} from "../gate-pre-issue-labels";

/**
 * Enumera los códigos de issue emitidos por un fuente del Gate PRE
 * (`code: "XXX"`). Leer el fuente en vez de hardcodear la lista hace que el
 * test falle automáticamente cuando el motor gana un código nuevo sin
 * etiqueta humana.
 */
function extractIssueCodes(sourceFile: string): string[] {
  const source = readFileSync(new URL(sourceFile, import.meta.url), "utf-8");
  const codes = new Set<string>();
  for (const match of source.matchAll(/code:\s*"([A-Z0-9_]+)"/g)) {
    codes.add(match[1]);
  }
  return [...codes].sort();
}

describe("gate-pre-issue-labels — cobertura de códigos", () => {
  const gatePreCodes = extractIssueCodes("../gate-pre.ts");
  const semanticCodes = extractIssueCodes("../gate-pre-semantic.ts");
  const allCodes = [...new Set([...gatePreCodes, ...semanticCodes])].sort();

  it("enumera códigos desde los fuentes (sanidad del extractor)", () => {
    // gate-pre.ts emite 14 códigos y gate-pre-semantic.ts 4 a fecha de G6;
    // el mínimo protege contra un extractor roto que devuelva [].
    expect(gatePreCodes.length).toBeGreaterThanOrEqual(14);
    expect(semanticCodes.length).toBeGreaterThanOrEqual(4);
    expect(gatePreCodes).toContain("DUP_ACTIVE_FUNCTIONAL_KEY");
    expect(semanticCodes).toContain("SEM_NAMESPACE_SIN_PROVEEDOR");
  });

  it("cada código de gate-pre.ts y gate-pre-semantic.ts tiene etiqueta (sin fallback)", () => {
    const missing = allCodes.filter(
      (code) => !Object.prototype.hasOwnProperty.call(GATE_PRE_ISSUE_LABEL, code),
    );
    expect(missing).toEqual([]);
  });

  it("ninguna etiqueta es vacía ni el propio código", () => {
    for (const code of allCodes) {
      const label = GATE_PRE_ISSUE_LABEL[code];
      expect(label.trim().length).toBeGreaterThan(0);
      expect(label).not.toBe(code);
    }
  });

  it("cubre también los diagnósticos locales del editor tri-capa", () => {
    expect(GATE_PRE_ISSUE_LABEL.CAPA2_DUPLICATE_VARIABLE).toBe("Variable duplicada en la capa 2");
    expect(GATE_PRE_ISSUE_LABEL.CAPA3_DUPLICATE_FIELD).toBe("Campo editable duplicado en la capa 3");
  });
});

describe("gatePreIssueLabel", () => {
  it("devuelve la etiqueta humana para códigos conocidos", () => {
    expect(gatePreIssueLabel("SEM_NAMESPACE_SIN_PROVEEDOR")).toBe(
      "Variables sin origen de datos: saldrían en blanco en el documento",
    );
    expect(gatePreIssueLabel("CAPA2_UNUSED_VARIABLE")).toBe(
      "Variable declarada que no se usa en el texto",
    );
    expect(gatePreIssueLabel("DUP_ACTIVE_FUNCTIONAL_KEY")).toBe(
      "Ya existe una plantilla activa equivalente",
    );
    expect(gatePreIssueLabel("META_REF_LEGAL_FORMAT")).toBe(
      "Referencia legal ausente o sin fuente legal reconocible",
    );
    // No sobreafirmar: META_APROBADA_POR se emite también cuando solo falta
    // uno de los dos datos, y META_ORGANO_NULL cuando el órgano es un alias
    // reconocido pendiente de normalizar.
    expect(gatePreIssueLabel("META_APROBADA_POR")).toBe(
      "Aprobación formal incompleta (falta responsable o fecha)",
    );
    expect(gatePreIssueLabel("META_ORGANO_NULL")).toBe(
      "Órgano societario ausente o sin normalizar",
    );
    expect(gatePreIssueLabel("LEGACY_FUENTE_ENTIDAD")).toBe(
      "Fuente de datos antigua: migrar a la fuente actual",
    );
  });

  it("hace fallback al propio código si no está catalogado", () => {
    expect(gatePreIssueLabel("CODIGO_INVENTADO_XYZ")).toBe("CODIGO_INVENTADO_XYZ");
  });

  it("tolera null/undefined", () => {
    expect(gatePreIssueLabel(null)).toBe("—");
    expect(gatePreIssueLabel(undefined)).toBe("—");
  });
});

describe("gatePreSeverityLabel", () => {
  it("traduce las tres severidades del Gate PRE", () => {
    expect(gatePreSeverityLabel("BLOCKING")).toBe("Bloqueante");
    expect(gatePreSeverityLabel("WARNING")).toBe("Advertencia");
    expect(gatePreSeverityLabel("INFO")).toBe("Informativa");
  });

  it("hace fallback al valor recibido si no está catalogado", () => {
    expect(gatePreSeverityLabel("CRITICAL")).toBe("CRITICAL");
  });

  it("tolera null/undefined", () => {
    expect(gatePreSeverityLabel(null)).toBe("—");
    expect(gatePreSeverityLabel(undefined)).toBe("—");
  });

  it("el mapa de severidades cubre las tres severidades canónicas", () => {
    expect(Object.keys(GATE_PRE_SEVERITY_LABEL).sort()).toEqual(["BLOCKING", "INFO", "WARNING"]);
  });
});
