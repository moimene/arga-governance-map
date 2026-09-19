import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { AESIA_RIA_REQUIREMENTS, ISO_42001_REQUIREMENTS } from "../catalog-aesia";
import { DESPLIEGUE_REQUIREMENTS } from "../perfil-aplicabilidad";
import { MONITOR_DE_CODIGO, monitorDeCodigo } from "../mapa-monitores";
import { buildAimsComplianceMonitors } from "../readiness";
import { sinComentarios } from "@/test/helpers/sin-comentarios";

/**
 * F1.T1 (GC-43) — cada comprobación va al monitor que le toca por su CÓDIGO.
 *
 * Antes se buscaba una subcadena en el título y la descripción: medido sobre
 * el dato vivo de ARGA el 2026-09-19, «Derechos fundamentales / DPIA» salía
 * Listo 1/1 porque la descripción de una comprobación ISO decía «privacidad», y
 * «Gobierno, roles y accountability» salía Listo 3/3 porque «rol» está dentro
 * de «desarrollo».
 */

const CATALOGO = [...AESIA_RIA_REQUIREMENTS, ...ISO_42001_REQUIREMENTS, ...DESPLIEGUE_REQUIREMENTS];
const VACIO = { systems: [], assessments: [], incidents: [] };

describe("el universo del mapa está cerrado contra el catálogo", () => {
  it("control positivo: los tres catálogos traen requisitos", () => {
    expect(AESIA_RIA_REQUIREMENTS.length).toBeGreaterThanOrEqual(12);
    expect(ISO_42001_REQUIREMENTS.length).toBeGreaterThanOrEqual(4);
    expect(DESPLIEGUE_REQUIREMENTS.length).toBeGreaterThanOrEqual(7);
  });

  it("todo código del catálogo tiene monitor, y el mapa no inventa códigos", () => {
    const delCatalogo = CATALOGO.map((r) => r.code).sort();
    expect(Object.keys(MONITOR_DE_CODIGO).sort()).toEqual(delCatalogo);
  });

  it("cada fila se fija contra el ARTÍCULO del requisito en el catálogo, no contra el propio mapa", () => {
    // Tabla independiente: artículo o norma del catálogo → monitor. Una fila del
    // mapa que se mueva de monitor no casa con su artículo.
    const POR_ARTICULO: Record<string, string> = {
      "Art. 17": "high-risk-obligations",
      "Art. 9": "high-risk-obligations",
      "Art. 14": "human-oversight",
      "Art. 10": "data-governance",
      "Art. 13": "transparency-user-information",
      "Art. 15": "accuracy-robustness-cybersecurity",
      "Art. 12": "evidence-recordkeeping",
      "Art. 11": "technical-documentation",
      "Art. 72": "post-market-monitoring",
      "Art. 73": "incident-reporting-escalation",
      "ISO 42001 A.5": "iso-42001-management-system",
      "ISO 42001 A.6": "governance-accountability",
      "ISO 42001 A.8": "fundamental-rights-dpia",
      "ISO 42001 A.9": "iso-42001-management-system",
      "Art. 4": "governance-accountability",
      "Art. 50": "transparency-user-information",
      RGPD: "fundamental-rights-dpia",
      "Cap. V y art. 25": "provider-vendor-third-party",
      "Art. 26": "human-oversight",
      "ISO/IEC 42001": "governance-accountability",
      "Art. 73 RIA y art. 33 RGPD": "incident-reporting-escalation",
    };
    expect(CATALOGO.length).toBe(Object.keys(MONITOR_DE_CODIGO).length);
    for (const r of CATALOGO) {
      expect(r.articleRef in POR_ARTICULO, `${r.code}: artículo «${r.articleRef}» sin monitor esperado`).toBe(true);
      expect({ code: r.code, monitor: monitorDeCodigo(r.code) }).toEqual({ code: r.code, monitor: POR_ARTICULO[r.articleRef] });
    }
  });

  it("todo monitor del mapa existe en el Dashboard", () => {
    const ids = new Set(buildAimsComplianceMonitors(VACIO).map((m) => m.id));
    expect(ids.size).toBeGreaterThan(10);
    for (const [code, monitor] of Object.entries(MONITOR_DE_CODIGO)) {
      expect(ids.has(monitor), `${code} apunta a un monitor que no existe: ${monitor}`).toBe(true);
    }
  });
});

describe("la asignación es por código, nunca por el texto", () => {
  it("un código desconocido no cae en ningún monitor, diga lo que diga su título", () => {
    expect(monitorDeCodigo("ISO-10")).toBeNull();
    expect(monitorDeCodigo(null)).toBeNull();
    expect(monitorDeCodigo("")).toBeNull();
    // Control positivo: el mismo camino sí resuelve un código del catálogo.
    expect(monitorDeCodigo("PROTECCION_DATOS")).toBe("fundamental-rights-dpia");
  });

  it("caso medido en ARGA: ni «privacidad» ni «rol» dentro de «desarrollo» ponen un monitor en Listo", () => {
    // Filas de `ai_compliance_checks` de ARGA leídas en Cloud el 2026-09-19
    // (sistema Asistente de suscripción patrimonial). Códigos de legado: sin
    // traducción, no son de ningún monitor.
    const sistema = "90000000-0000-0000-0000-000000000002";
    const checks = [
      { id: "iso-05", system_id: sistema, requirement_code: "ISO-05", requirement_title: "Política de IA (A.5)", description: "…gobernanza corporativa y los valores éticos… desarrollo y uso de la IA.", status: "CONFORME" },
      { id: "iso-06", system_id: sistema, requirement_code: "ISO-06", requirement_title: "Organización interna (A.6)", description: "Asignar roles y responsabilidades claras…", status: "CONFORME" },
      { id: "iso-09", system_id: sistema, requirement_code: "ISO-09", requirement_title: "Salvaguardas del ciclo de vida de IA (A.9)", description: "…desde el diseño y desarrollo hasta el despliegue y retirada.", status: "CONFORME" },
      { id: "iso-10", system_id: sistema, requirement_code: "ISO-10", requirement_title: "Gestión de datos para IA (A.10)", description: "Garantizar la calidad, procedencia, privacidad y seguridad de los datos…", status: "CONFORME" },
    ];
    const monitores = buildAimsComplianceMonitors({
      systems: [{ id: sistema, status: "Pendiente", risk_level: "Alto" }],
      assessments: [],
      incidents: [],
      complianceChecks: checks,
    });
    const dpia = monitores.find((m) => m.id === "fundamental-rights-dpia")!;
    const gobierno = monitores.find((m) => m.id === "governance-accountability")!;
    // ISO-10 (datos) no tiene equivalente vigente: no es de ningún monitor.
    expect(dpia).toMatchObject({ status: "unmeasured", metric: "Sin comprobaciones del área" });
    // ISO-06 se lee como ISO_ORG_ROLES y es legado: se cuenta, no acredita.
    expect(gobierno).toMatchObject({ status: "watch", metric: "0/1 acreditadas · 1 de legado, no acredita" });
  });

  it("control positivo: una comprobación con el código del área sí mueve su monitor", () => {
    const monitores = buildAimsComplianceMonitors({
      systems: [{ id: "s1", status: "ACTIVO", risk_level: "Limitado" }],
      // Sólo acredita con la evaluación vigente del sistema congelada y revisada.
      assessments: [{ id: "a1", system_id: "s1", framework: "EU_AI_ACT", status: "CON_GAPS", frozen_at: "2026-09-18", reviewed_at: "2026-09-18" }],
      incidents: [],
      complianceChecks: [
        { id: "c1", system_id: "s1", requirement_code: "PROTECCION_DATOS", requirement_title: "Sin palabra clave", status: "CONFORME" },
        { id: "c2", system_id: "s1", requirement_code: "ISO_ORG_ROLES", requirement_title: "x", status: "NO_CONFORME" },
      ],
    });
    expect(monitores.find((m) => m.id === "fundamental-rights-dpia")).toMatchObject({ status: "ready", metric: "1/1 acreditadas" });
    expect(monitores.find((m) => m.id === "governance-accountability")).toMatchObject({ status: "gap", metric: "0/1 acreditadas" });
  });

  it("un monitor sin comprobaciones de su código dice «no medido», no «Derivado» ni «Sin cobertura»", () => {
    const monitores = buildAimsComplianceMonitors({
      systems: [{ id: "s1", status: "ACTIVO", risk_level: "Alto" }],
      assessments: [{ id: "a1", system_id: "s1", status: "CON_GAPS", score: 40, findings: [] }],
      incidents: [],
      complianceChecks: [],
    });
    for (const id of ["governance-accountability", "data-governance", "transparency-user-information", "human-oversight", "fundamental-rights-dpia"]) {
      const m = monitores.find((x) => x.id === id)!;
      expect(m.status, id).toBe("unmeasured");
      expect(m.metric, id).not.toMatch(/Derivado|Sin cobertura/);
    }
  });
});

describe("G-ARISTA — readiness asigna con el mapa y no vuelve la subcadena", () => {
  const READINESS = "src/lib/aims/readiness.ts";
  /** Detecta una asignación por texto: título/descripción, lista de palabras clave o `includes` sobre ellas. */
  const asignaPorTexto = (src: string) =>
    /\.requirement_title|\bkeywords\b|haystack|\.description\b[^;\n]*\.includes\(/.test(sinComentarios(src));

  it("control positivo: el detector reconoce la implementación retirada", () => {
    const retirada = `
      function checksForDefinition(checks, definition) {
        const keywords = definition.keywords.map((keyword) => normalizeSearchText(keyword));
        return checks.filter((check) => {
          const haystack = normalizeSearchText(check.requirement_code, check.requirement_title, check.description);
          return keywords.some((keyword) => haystack.includes(keyword));
        });
      }`;
    expect(asignaPorTexto(retirada)).toBe(true);
  });

  it("readiness.ts no asigna por texto", () => {
    expect(asignaPorTexto(readFileSync(READINESS, "utf8"))).toBe(false);
  });

  it("readiness.ts importa el mapa y lo llama", () => {
    const src = sinComentarios(readFileSync(READINESS, "utf8"));
    expect(src).toMatch(/from "\.\/mapa-monitores"/);
    expect(src).toMatch(/monitorDeCodigo\(/);
  });

  it("el mapa es una hoja: no importa nada", () => {
    const src = sinComentarios(readFileSync("src/lib/aims/mapa-monitores.ts", "utf8"));
    expect(src).toContain("export const MONITOR_DE_CODIGO");
    expect([...src.matchAll(/^\s*import\s.+$/gm)]).toEqual([]);
  });
});
