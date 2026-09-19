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
    expect(dpia.status).not.toBe("ready");
    expect(dpia.metric).not.toBe("1/1 conformes");
    expect(gobierno.status).not.toBe("ready");
    expect(gobierno.metric).not.toBe("3/3 conformes");
  });

  it("control positivo: una comprobación con el código del área sí mueve su monitor", () => {
    const monitores = buildAimsComplianceMonitors({
      systems: [{ id: "s1", status: "ACTIVO", risk_level: "Limitado" }],
      assessments: [],
      incidents: [],
      complianceChecks: [
        { id: "c1", system_id: "s1", requirement_code: "PROTECCION_DATOS", requirement_title: "Sin palabra clave", status: "CONFORME" },
        { id: "c2", system_id: "s1", requirement_code: "ISO_ORG_ROLES", requirement_title: "x", status: "NO_CONFORME" },
      ],
    });
    expect(monitores.find((m) => m.id === "fundamental-rights-dpia")).toMatchObject({ status: "ready", metric: "1/1 conformes" });
    expect(monitores.find((m) => m.id === "governance-accountability")).toMatchObject({ status: "gap", metric: "0/1 conformes" });
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

describe("monitor por sistema y por tenant", () => {
  it("el del sistema sólo cuenta lo suyo; el del tenant, todo", async () => {
    const { buildAimsComplianceMonitorsPorSistema } = await import("../readiness");
    const input = {
      systems: [{ id: "s1", status: "ACTIVO" }, { id: "s2", status: "ACTIVO" }],
      assessments: [],
      incidents: [],
      complianceChecks: [
        { id: "c1", system_id: "s1", requirement_code: "DATA_GOVERNANCE", status: "CONFORME" },
        { id: "c2", system_id: "s2", requirement_code: "DATA_GOVERNANCE", status: "NO_CONFORME" },
      ],
    };
    const porSistema = buildAimsComplianceMonitorsPorSistema(input);
    expect(Object.keys(porSistema).sort()).toEqual(["s1", "s2"]);
    expect(porSistema.s1.find((m) => m.id === "data-governance")).toMatchObject({ status: "ready", metric: "1/1 conformes" });
    expect(porSistema.s2.find((m) => m.id === "data-governance")).toMatchObject({ status: "gap", metric: "0/1 conformes" });
    expect(buildAimsComplianceMonitors(input).find((m) => m.id === "data-governance")?.metric).toBe("1/2 conformes");
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
