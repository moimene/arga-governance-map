/**
 * Qué monitor del Dashboard mide cada requisito, por su CÓDIGO.
 *
 * Antes cada monitor buscaba palabras clave dentro del título y la descripción
 * de la comprobación. Medido sobre el dato vivo de ARGA el 2026-09-19:
 * «Derechos fundamentales / DPIA» salía Listo 1/1 por una comprobación ISO cuya
 * descripción decía «privacidad», y «Gobierno, roles y accountability» salía
 * Listo 3/3 porque «rol» está dentro de «desarrollo».
 *
 * El universo está cerrado: las claves son exactamente los códigos de los tres
 * catálogos (proveedor RIA, ISO 42001 y responsable del despliegue), y el test
 * lo comprueba contra ellos. Un código fuera del mapa no es de ningún monitor:
 * no se adivina por lo que diga su título.
 *
 * Módulo hoja: no importa nada.
 */
export const MONITOR_DE_CODIGO = {
  // Proveedor de alto riesgo (`AESIA_RIA_REQUIREMENTS`).
  QUALITY_MGMT: "high-risk-obligations", // art. 17
  RISK_MGMT: "high-risk-obligations", // art. 9
  HUMAN_OVERSIGHT: "human-oversight", // art. 14
  DATA_GOVERNANCE: "data-governance", // art. 10
  TRANSPARENCY: "transparency-user-information", // art. 13
  ACCURACY: "accuracy-robustness-cybersecurity", // art. 15
  ROBUSTNESS: "accuracy-robustness-cybersecurity", // art. 15
  CYBERSECURITY: "accuracy-robustness-cybersecurity", // art. 15
  LOGGING: "evidence-recordkeeping", // art. 12
  TECHNICAL_DOC: "technical-documentation", // art. 11
  POST_MARKET: "post-market-monitoring", // art. 72
  INCIDENT_MGMT: "incident-reporting-escalation", // art. 73
  // ISO/IEC 42001 (`ISO_42001_REQUIREMENTS`).
  ISO_POLICIES: "iso-42001-management-system",
  ISO_ORG_ROLES: "governance-accountability",
  ISO_IMPACT_ASSESS: "fundamental-rights-dpia",
  ISO_LIFECYCLE: "iso-42001-management-system",
  // Responsable del despliegue (`DESPLIEGUE_REQUIREMENTS`).
  ALFABETIZACION: "governance-accountability", // art. 4
  TRANSPARENCIA: "transparency-user-information", // art. 50
  PROTECCION_DATOS: "fundamental-rights-dpia", // RGPD 28 y 35
  CADENA_SUMINISTRO: "provider-vendor-third-party",
  SUPERVISION_USO: "human-oversight",
  GOBERNANZA_AIMS: "governance-accountability",
  INCIDENTES_IA: "incident-reporting-escalation",
} as const;

export type MonitorConCodigo = (typeof MONITOR_DE_CODIGO)[keyof typeof MONITOR_DE_CODIGO];

export function monitorDeCodigo(code: string | null | undefined): MonitorConCodigo | null {
  if (!code || !Object.prototype.hasOwnProperty.call(MONITOR_DE_CODIGO, code)) return null;
  return MONITOR_DE_CODIGO[code as keyof typeof MONITOR_DE_CODIGO];
}
