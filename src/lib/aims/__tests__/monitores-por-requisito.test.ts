import { describe, expect, it } from "bun:test";
import { AESIA_RIA_REQUIREMENTS, ISO_42001_REQUIREMENTS } from "../catalog-aesia";
import { DESPLIEGUE_REQUIREMENTS } from "../perfil-aplicabilidad";
import { MONITORES_POR_REQUISITO, buildAimsComplianceMonitors } from "../readiness";

/**
 * ¿Qué monitores de readiness alimenta una comprobación? (revisión de F1.T12/T13)
 *
 * Se decidía por palabras clave sobre el código, el TÍTULO y la DESCRIPCIÓN del
 * requisito, que el payload persiste. Al corregir los textos del catálogo, las
 * evaluaciones futuras pasaban a alimentar otros monitores sin que nadie lo
 * decidiera: TRANSPARENCY entraba en «Gobierno, roles y accountability» por la
 * palabra «responsables» del título nuevo, y ISO_IMPACT_ASSESS dejaba de
 * alimentar «Derechos fundamentales / DPIA».
 *
 * Ahora, para un código de los catálogos, manda el CÓDIGO. El ancla de abajo
 * es la medida de la rama base (b1721a5) para los requisitos que ya existían
 * —así nada de lo persistido ni de lo que se reevalúe cambia de monitor— y la
 * decisión declarada para los seis requisitos nuevos de ISO/IEC 42001.
 */
const ANCLA: Record<string, string[]> = {
  // RIA, catálogo del proveedor — medido en la base; son las 12 de Harvey en Cloud.
  ACCURACY: ["accuracy-robustness-cybersecurity"],
  CYBERSECURITY: ["data-governance", "accuracy-robustness-cybersecurity"],
  DATA_GOVERNANCE: ["governance-accountability", "data-governance"],
  HUMAN_OVERSIGHT: ["governance-accountability", "high-risk-obligations", "human-oversight"],
  INCIDENT_MGMT: ["incident-reporting-escalation"],
  LOGGING: ["evidence-recordkeeping"],
  POST_MARKET: ["data-governance"],
  QUALITY_MGMT: ["data-governance", "iso-42001-management-system"],
  RISK_MGMT: ["fundamental-rights-dpia", "iso-42001-management-system"],
  ROBUSTNESS: ["data-governance", "accuracy-robustness-cybersecurity"],
  TECHNICAL_DOC: ["technical-documentation"],
  TRANSPARENCY: ["transparency-user-information"],
  // Catálogo del responsable del despliegue — medido en la base (no lo tocó el recotejo).
  ALFABETIZACION: ["governance-accountability", "provider-vendor-third-party"],
  CADENA_SUMINISTRO: ["provider-vendor-third-party", "evidence-recordkeeping"],
  GOBERNANZA_AIMS: ["iso-42001-management-system"],
  INCIDENTES_IA: [
    "governance-accountability",
    "high-risk-obligations",
    "data-governance",
    "provider-vendor-third-party",
    "incident-reporting-escalation",
    "evidence-recordkeeping",
  ],
  PROTECCION_DATOS: ["data-governance"],
  SUPERVISION_USO: ["governance-accountability", "high-risk-obligations", "human-oversight"],
  TRANSPARENCIA: ["transparency-user-information"],
  // ISO/IEC 42001 — los cuatro que existían, medidos en la base.
  ISO_POLICIES: [],
  ISO_ORG_ROLES: ["governance-accountability"],
  ISO_IMPACT_ASSESS: ["fundamental-rights-dpia"],
  ISO_LIFECYCLE: ["governance-accountability", "data-governance"],
  // ISO/IEC 42001 — los seis nuevos: decisión declarada (su monitor más próximo).
  ISO_RESOURCES: [],
  ISO_DATA: ["data-governance"],
  ISO_INFO_PARTIES: ["transparency-user-information"],
  ISO_RESPONSIBLE_USE: ["governance-accountability"],
  ISO_THIRD_PARTIES: ["provider-vendor-third-party"],
  ISO_RISK_PLANNING: ["iso-42001-management-system"],
};

const CATALOGOS = [...AESIA_RIA_REQUIREMENTS, ...DESPLIEGUE_REQUIREMENTS, ...ISO_42001_REQUIREMENTS];

/** Monitores que alimenta UNA comprobación NO_CONFORME con ese código y ese texto. */
const alimenta = (code: string, title: string, description: string) =>
  buildAimsComplianceMonitors({
    systems: [],
    assessments: [],
    incidents: [],
    complianceChecks: [{ id: "c", system_id: null, requirement_code: code, requirement_title: title, description, status: "NO_CONFORME" }],
  })
    .filter((m) => m.metric.endsWith("conformes"))
    .map((m) => m.id);

describe("el monitor lo decide el código del requisito, no su texto", () => {
  it("el ancla cubre exactamente los requisitos de los tres catálogos, y la tabla también", () => {
    const codigos = CATALOGOS.map((r) => r.code).sort();
    expect(codigos.length).toBe(29);
    expect(Object.keys(ANCLA).sort()).toEqual(codigos);
    expect([...MONITORES_POR_REQUISITO.keys()].sort()).toEqual(codigos);
  });

  it("cada requisito alimenta lo que dice el ancla, con su texto vigente", () => {
    for (const r of CATALOGOS) expect(alimenta(r.code, r.title, r.description), r.code).toEqual(ANCLA[r.code]);
  });

  it("corregir el texto de un requisito no le cambia el monitor", () => {
    const otro = "responsables del despliegue, datos, transparencia, incidente, registro, iso 42001";
    for (const r of CATALOGOS) expect(alimenta(r.code, otro, otro), r.code).toEqual(ANCLA[r.code]);
  });

  it("TRANSPARENCY no alimenta «Gobierno, roles y accountability» aunque su título hable de responsables", () => {
    const t = AESIA_RIA_REQUIREMENTS.find((r) => r.code === "TRANSPARENCY");
    expect(`${t.title} ${t.description}`).toMatch(/responsables/);
    expect(alimenta("TRANSPARENCY", t.title, t.description)).not.toContain("governance-accountability");
  });

  it("control: un código de legado (ARGA) sigue por palabras clave, y el mismo texto SÍ movería el monitor", () => {
    // VAL-05 es de ARGA en Cloud: cero cambio.
    expect(alimenta("VAL-05", "Transparencia e información (Art. 13)", null)).toEqual(["transparency-user-information"]);
    // Por palabras clave, el título nuevo de TRANSPARENCY entra en gobierno: por
    // eso los códigos del catálogo no pasan por ellas.
    const t = AESIA_RIA_REQUIREMENTS.find((r) => r.code === "TRANSPARENCY");
    expect(alimenta("LEGADO-13", t.title, t.description)).toContain("governance-accountability");
  });
});
