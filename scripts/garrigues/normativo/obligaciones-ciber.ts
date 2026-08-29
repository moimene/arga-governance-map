// scripts/garrigues/normativo/obligaciones-ciber.ts
//
// G6 — ÚNICA FUENTE DE VERDAD de las obligaciones de Ciberseguridad/SGSI (ISO 27001 + ENS),
// marco prospectivo NIS2 (EAD Trust) y controles operativos del tenant Garrigues.
//
// Regla cardinal: NIS2 NO es deber del despacho (servicios jurídicos fuera de Anexos I y II),
// sino marco prospectivo de su filial QTSP EAD Trust, S.L. sujeto a transposición en España.

export type ObligationPeriodicity =
  | "CONTINUA"
  | "POR_OPERACION"
  | "ANUAL"
  | "BIENAL"
  | "PUNTUAL"
  | "SEGUN_REGLAMENTO";

export type OwnerSlug =
  | "garrigues-comite-seguridad-privacidad"
  | "garrigues-ots"
  | "garrigues-comite-gobernanza-ia"
  | "garrigues-departamento-compliance"
  | "garrigues-consejo-administracion-ead-trust";

export interface ObligacionCiber {
  code: string;
  title: string;
  source: string;
  legal_reference: string;
  criticality: "Crítico" | "Alto" | "Medio" | "Bajo";
  periodicity: ObligationPeriodicity;
  owner_body_slug: OwnerSlug;
  policy_code: string;
  prospectiva?: boolean;
  sujeto_obligado?: string;
  /**
   * Procedencia de la condición de prestador CUALIFICADO del sujeto obligado.
   * Solo aplica a las fichas cuyo régimen dependa de esa condición: en NIS2 la
   * cualificación no determina la entrada en ámbito (art. 2.2.a.ii habla de
   * "prestadores de servicios de confianza", sin el adjetivo) sino la CATEGORÍA
   * — cualificado ⇒ entidad esencial, art. 3.1.b — y con ella el régimen de
   * supervisión y el techo sancionador. Verificado 2026-08-29 contra la Trusted
   * List: docs/legal/2026-08-29-tsl-ead-trust-servicios-cualificados.md
   */
  procedencia_cualificacion?: string;
  quote?: string;
}

export interface ControlCiber {
  code: string;
  name: string;
  status: "Efectivo" | "Parcial" | "Inefectivo";
  obligation_code: string;
  owner_body_slug: OwnerSlug;
  policy_code: string;
  quote?: string;
}

export const MARCO_SGSI = "ISO 27001 / ENS";
export const MARCO_NIS2 = "NIS2 (UE 2022/2555)";

export const OBLIGACIONES_CIBER: readonly ObligacionCiber[] = [
  {
    code: "OBL-GARR-CYBER-01",
    title: "Revisión anual obligatoria de la Política de Seguridad y del análisis de riesgos de los sistemas de información",
    source: MARCO_SGSI,
    legal_reference: "PI-26 §5(b), §5(g), §15 / ISO/IEC 27001:2022",
    criticality: "Alto",
    periodicity: "ANUAL",
    owner_body_slug: "garrigues-comite-seguridad-privacidad",
    policy_code: "PI-26",
    quote: "Este análisis se repetirá: al menos una vez al año. Cuando la información y/o servicios gestionados cambien significativamente. La Política será revisada una vez al año.",
  },
  {
    code: "OBL-GARR-CYBER-02",
    title: "Notificación preceptiva a clientes de incidentes de seguridad con impacto significativo en los servicios",
    source: "ENS (RD 311/2022)",
    legal_reference: "PI-26 §12 / art. 33 RD 311/2022",
    criticality: "Crítico",
    periodicity: "POR_OPERACION",
    owner_body_slug: "garrigues-comite-seguridad-privacidad",
    policy_code: "PI-26",
    quote: "De conformidad con lo dispuesto en el artículo 33 del RD 311/2022 … Garrigues notificará a sus clientes aquellas incidencias que tengan un impacto significativo.",
  },
  {
    code: "OBL-GARR-CYBER-03",
    title: "Procedimiento formal de excepciones de seguridad con informe técnico motivado del Responsable de Seguridad",
    source: MARCO_SGSI,
    legal_reference: "PI-26 §13 / ISO/IEC 27001",
    criticality: "Medio",
    periodicity: "POR_OPERACION",
    owner_body_slug: "garrigues-comite-seguridad-privacidad",
    policy_code: "PI-26",
    quote: "Se requerirá un informe del Responsable de Seguridad que precise los riesgos en que se incurre y la forma de tratarlos.",
  },
  {
    code: "OBL-GARR-CYBER-04",
    title: "Custodia y conservación de evidencias técnicas, logs de auditoría y registros de seguridad durante 10 años",
    source: "SGSI / Retención",
    legal_reference: "PI-27 §2, PI-21 §2(a) / ENS",
    criticality: "Alto",
    periodicity: "CONTINUA",
    owner_body_slug: "garrigues-comite-seguridad-privacidad",
    policy_code: "PI-26",
    quote: "Conservación durante 10 años de los registros y evidencias del sistema de gestión y destrucción confidencial garantizada.",
  },
  {
    code: "OBL-GARR-CYBER-05",
    title: "Auditoría periódica bienal de seguridad y verificación de conformidad del estado de seguridad",
    source: "ENS / PPD",
    legal_reference: "PPD-01 §9 / RD 311/2022 art. 31",
    criticality: "Alto",
    periodicity: "BIENAL",
    owner_body_slug: "garrigues-comite-seguridad-privacidad",
    policy_code: "PI-26",
    quote: "Programa de auditoría bienal del sistema de gestión y medidas de seguridad técnicas.",
  },
  {
    code: "OBL-GARR-NIS2-01",
    title: "[Marco Prospectivo] Medidas de gobernanza y gestión de riesgos de ciberseguridad para prestadores cualificados de confianza",
    source: MARCO_NIS2,
    legal_reference: "Directiva (UE) 2022/2555 art. 21 / Anexo I sector 8",
    criticality: "Crítico",
    periodicity: "CONTINUA",
    owner_body_slug: "garrigues-consejo-administracion-ead-trust",
    policy_code: "PI-26",
    prospectiva: true,
    sujeto_obligado: "EAD Trust, S.L. (QTSP esencial)",
    procedencia_cualificacion:
      "Trusted List española (tsl.digital.gob.es), TSLSequenceNumber 188 de 2026-08-06, alcanzada desde la LOTL de la Comisión (seq. 392). EAD TRUST European Agency of Digital Trust, S.L. — VATES-B85626240 — con servicios cualificados CA/QC (certificados de firma, sello y web) y TSA/QTST (sellos de tiempo), granted desde 2020-10-05. Acredita la CUALIFICACIÓN, no el porcentaje de participación, que sigue A_CONFIRMAR.",
    quote: "Directiva (UE) 2022/2555 art. 21. Sujeto obligado: EAD Trust, S.L. como QTSP cualificado (entidad esencial con independencia de tamaño). Aplicabilidad sujeta a transposición en España.",
  },
  {
    code: "OBL-GARR-NIS2-02",
    title: "[Marco Prospectivo] Notificación de incidentes significativos en 24 horas y supervisión ex-ante como entidad esencial",
    source: MARCO_NIS2,
    legal_reference: "Directiva (UE) 2022/2555 art. 23.4, 32 / Anexo I sector 8",
    criticality: "Crítico",
    periodicity: "POR_OPERACION",
    owner_body_slug: "garrigues-consejo-administracion-ead-trust",
    policy_code: "PI-26",
    prospectiva: true,
    sujeto_obligado: "EAD Trust, S.L. (QTSP esencial)",
    procedencia_cualificacion:
      "Trusted List española (tsl.digital.gob.es), TSLSequenceNumber 188 de 2026-08-06, alcanzada desde la LOTL de la Comisión (seq. 392). La categoría de entidad esencial deriva de los servicios CA/QC y TSA/QTST cualificados; NO de entrega electrónica certificada: EAD Trust no tiene EDS/Q (QERDS) en la lista, frente a 71 servicios EDS/Q de otros prestadores españoles.",
    quote: "Plazo de alerta temprana de 24 horas para incidentes significativos y supervisión ex-ante aplicable a prestadores cualificados de servicios de confianza.",
  },
] as const;

export const CONTROLES_CIBER: readonly ControlCiber[] = [
  {
    code: "CTR-GARR-29",
    name: "Autenticación multifactor (2FA) y canales cifrados TLS en todos los accesos externos y aplicaciones corporativas",
    status: "Efectivo",
    obligation_code: "OBL-GARR-CYBER-01",
    owner_body_slug: "garrigues-ots",
    policy_code: "PI-24",
    quote: "PI-24 §5.3: SSL, cifrado, 2FA siguiendo los requerimientos de la Oficina Técnica de Seguridad (OTS).",
  },
  {
    code: "CTR-GARR-30",
    name: "Cifrado integral de dispositivos portátiles y soportes extraíbles corporativos (BitLocker To Go)",
    status: "Efectivo",
    obligation_code: "OBL-GARR-CYBER-01",
    owner_body_slug: "garrigues-ots",
    policy_code: "PI-11",
    quote: "PI-11 §10: Medidas de control, cifrado de equipos portátiles y soportes con BitLocker To Go.",
  },
  {
    code: "CTR-GARR-31",
    name: "Gestión de dispositivos móviles BYOD mediante MDM corporativo con capacidad de borrado remoto de datos",
    status: "Efectivo",
    obligation_code: "OBL-GARR-CYBER-01",
    owner_body_slug: "garrigues-ots",
    policy_code: "PI-15",
    quote: "PI-15 §3.8: BYOD + MDM + borrado remoto corporativo a través del SAU.",
  },
  {
    code: "CTR-GARR-32",
    name: "Política de contraseñas robustas con caducidad forzada a 60 días y desactivación por inactividad mayor a 2 meses",
    status: "Efectivo",
    obligation_code: "OBL-GARR-CYBER-01",
    owner_body_slug: "garrigues-ots",
    policy_code: "PI-24",
    quote: "PI-24 Anexo 2: Caducidad a 60 días y cierre de cuentas por inactividad > 2 meses.",
  },
  {
    code: "CTR-GARR-33",
    name: "Prohibición taxativa de volcado de información confidencial y datos de clientes en herramientas de IA Generativa de terceros",
    status: "Efectivo",
    obligation_code: "OBL-GARR-CYBER-03",
    owner_body_slug: "garrigues-comite-gobernanza-ia",
    policy_code: "PI-30",
    quote: "PI-30 §2: Está terminantemente prohibido introducir información confidencial o datos personales en herramientas de IA Generativa de terceros.",
  },
  {
    code: "CTR-GARR-34",
    name: "Homologación y adhesión obligatoria de proveedores a requisitos de seguridad de la información y esquema ENS",
    status: "Parcial",
    obligation_code: "OBL-GARR-CYBER-01",
    owner_body_slug: "garrigues-comite-seguridad-privacidad",
    policy_code: "PI-28",
    quote: "PI-28 Anexo 1 §5: Código ético de proveedores adaptado al ENS y extensión de PI-26 a la cadena de suministro.",
  },
  {
    code: "CTR-GARR-35",
    name: "Gestión de la plataforma Insiders List y conservación del registro de iniciados durante 5 años conforme a MAR",
    status: "Efectivo",
    obligation_code: "OBL-GARR-CYBER-04",
    owner_body_slug: "garrigues-departamento-compliance",
    policy_code: "PI-29",
    quote: "PI-29 §4: Plataforma Insiders List, conservación 5 años conforme al Reglamento (UE) 596/2014.",
  },
] as const;
