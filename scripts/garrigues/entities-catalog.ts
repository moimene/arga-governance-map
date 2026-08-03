// scripts/garrigues/entities-catalog.ts
// Única fuente de verdad del perímetro societario Garrigues (G1).
// Fuentes: inventario 2026 (Garr_politicas), cuadro IDC2.1.1 de las cuentas
// anuales consolidadas 2025 (depósito RM, relectura dirigida 2026-08-03) y
// certificación registral del propio depósito (matriz). Los datos dudosos van
// con confianza A_CONFIRMAR/PENDIENTE y pct NULL — nunca se afirma lo ilegible.
// H1: "Xoo.com Digital SLU" NO existe (error de lectura retirado de la spec).

export interface GarriguesEntitySeed {
  uuid: string;
  slug: string;
  legalName: string;
  commonName: string;
  legalForm: string;
  tipoSocial: "SL" | "SLU" | null;
  jurisdiction: string;
  parentSlug: string | null;
  ownershipPct: number | null;
  groupRole:
    | "MATRIZ" | "FILIAL" | "VEHICULO" | "SUCURSAL" | "OFICINA"
    | "OFICINA_REPRESENTACION" | "DIVISION" | "VINCULADA" | "INTEGRACION";
  esUnipersonal: boolean | null;
  formaAdministracion: "ADMINISTRADOR_UNICO" | "CONSEJO" | null;
  nif: string | null;
  /** Estado registral para entities.entity_status (CHECK: Active|Inactive|Liquidated). Ausente = default (Active copiado de ARGA). */
  entityStatus?: "Active" | "Inactive" | "Liquidated";
  provenance: {
    fuentes: string[];
    confianza: "CONFIRMADO" | "A_CONFIRMAR" | "PENDIENTE";
    cobertura_motor: boolean;
    cobertura_motivo?: string;
    incidencias?: string[];
    notas?: string[];
  };
  registral?: {
    hoja: string; tomo: string; folio: string; domicilio: string; ciudad: string;
    cp: string; provincia: string; constitucion: string; duracion: string; registro: string;
  };
}

export const GARRIGUES_TENANT = "00000000-0000-0000-0000-000000000002";
export const GARRIGUES_MATRIZ_UUID = "00000000-0000-0000-0002-000000000001";

const U = (nn: string) => `00000000-0000-0000-0002-0000000000${nn}`;
const SLP_NOTE = "TIPO_SOCIAL_SLP_PENDIENTE_G3";
const IDC = "IDC2.1.1 cuentas consolidadas 2025 (depósito RM)";
const INV = "Inventario 2026 (Garr_politicas)";
const RM = "Certificación Registro Mercantil de Madrid (depósito 2025)";

export const GARRIGUES_ENTITIES: GarriguesEntitySeed[] = [
  {
    uuid: U("01"), slug: "jya-garrigues-slp",
    legalName: "J&A Garrigues, S.L.P.", commonName: "Garrigues (matriz)",
    legalForm: "SLP", tipoSocial: null, jurisdiction: "ES", parentSlug: null,
    ownershipPct: null, groupRole: "MATRIZ", esUnipersonal: false,
    formaAdministracion: "ADMINISTRADOR_UNICO", nif: "B81709081",
    provenance: {
      fuentes: [RM, INV, IDC], confianza: "CONFIRMADO", cobertura_motor: true,
      notas: [SLP_NOTE, "El RM imprime literalmente 'Estructura del órgano: Administrador único'"],
    },
    registral: {
      hoja: "M-190538", tomo: "17456", folio: "132",
      domicilio: "Plaza de Colón, 2", ciudad: "Madrid", cp: "28046", provincia: "Madrid",
      constitucion: "1997-04-01", duracion: "Indefinida", registro: "Registro Mercantil de Madrid",
    },
  },
  {
    uuid: U("02"), slug: "garrigues-ip-slp",
    legalName: "Garrigues IP, S.L.P.", commonName: "Garrigues IP",
    legalForm: "SLP", tipoSocial: null, jurisdiction: "ES", parentSlug: "jya-garrigues-slp",
    ownershipPct: 100, groupRole: "FILIAL", esUnipersonal: true,
    formaAdministracion: "ADMINISTRADOR_UNICO", nif: "B78523123",
    provenance: { fuentes: [IDC, INV], confianza: "CONFIRMADO", cobertura_motor: true, notas: [SLP_NOTE] },
  },
  {
    uuid: U("03"), slug: "g-advisory-slp",
    legalName: "G-Advisory, Consultoría Técnica, Económica y Estratégica, S.L.P.", commonName: "G-Advisory",
    legalForm: "SLP", tipoSocial: null, jurisdiction: "ES", parentSlug: "jya-garrigues-slp",
    ownershipPct: 75, groupRole: "FILIAL", esUnipersonal: false,
    formaAdministracion: "ADMINISTRADOR_UNICO", nif: "B82801069",
    provenance: {
      fuentes: [IDC, INV], confianza: "CONFIRMADO", cobertura_motor: true,
      notas: [SLP_NOTE, "75% según IDC — corrige el 100% tácito del inventario"],
    },
  },
  {
    uuid: U("04"), slug: "garrigues-letrados-soporte-slp",
    legalName: "Garrigues Letrados de Soporte, S.L.P.", commonName: "Letrados de Soporte",
    legalForm: "SLP", tipoSocial: null, jurisdiction: "ES", parentSlug: "jya-garrigues-slp",
    ownershipPct: 100, groupRole: "FILIAL", esUnipersonal: true,
    formaAdministracion: "ADMINISTRADOR_UNICO", nif: "B81552671",
    provenance: { fuentes: [IDC, INV], confianza: "CONFIRMADO", cobertura_motor: true, notas: [SLP_NOTE, "Denominación anterior: Rino Asesores, S.L.P. (hasta 02/01/2018) — es la administradora persona jurídica de Violet/EWOH/Garmen"] },
  },
  {
    uuid: U("05"), slug: "garrigues-hcs-slp",
    legalName: "Garrigues Human Capital Services, S.L.P.", commonName: "Human Capital Services",
    legalForm: "SLP", tipoSocial: null, jurisdiction: "ES", parentSlug: "jya-garrigues-slp",
    ownershipPct: 100, groupRole: "FILIAL", esUnipersonal: true,
    formaAdministracion: "ADMINISTRADOR_UNICO", nif: "B83697128",
    provenance: { fuentes: [IDC, INV], confianza: "CONFIRMADO", cobertura_motor: true, notas: [SLP_NOTE, "La forma de administración es inferencia por patrón de grupo: ninguna fuente declara explícitamente 'Adm. Único' para esta sociedad (cosecha 2026-08-03)"] },
  },
  {
    uuid: U("06"), slug: "garrigues-empresa-familiar-slp",
    legalName: "Garrigues Consultoría de Empresa Familiar, S.L.P.", commonName: "Consultoría de Empresa Familiar",
    legalForm: "SLP", tipoSocial: null, jurisdiction: "ES", parentSlug: "jya-garrigues-slp",
    ownershipPct: 100, groupRole: "FILIAL", esUnipersonal: true,
    formaAdministracion: "ADMINISTRADOR_UNICO", nif: "B83752626",
    provenance: { fuentes: [IDC, INV], confianza: "CONFIRMADO", cobertura_motor: true, notas: [SLP_NOTE] },
  },
  {
    uuid: U("07"), slug: "garrigues-sports-entertainment-slp",
    legalName: "Garrigues Sports & Entertainment, S.L.P.", commonName: "Sports & Entertainment (extinta 2018)",
    legalForm: "SLP", tipoSocial: null, jurisdiction: "ES", parentSlug: "jya-garrigues-slp",
    ownershipPct: null, groupRole: "FILIAL", esUnipersonal: null,
    formaAdministracion: "ADMINISTRADOR_UNICO", nif: "B83321901",
    entityStatus: "Liquidated",
    provenance: {
      fuentes: [INV, "Certificado ISO 27001", "BORME CVE BORME-A-2018-14-28 (boe.es, verificado)"],
      confianza: "CONFIRMADO", cobertura_motor: false, cobertura_motivo: "EXTINGUIDA",
      incidencias: [
        "EXTINGUIDA desde 10/01/2018 (disolución voluntaria + liquidación); J&A Garrigues SLP era su Adm. Único y Liquidador, representada por Fernando Vives — vínculo real pero HISTÓRICO",
        "El inventario interno y el alcance ISO 27001 arrastraban una sociedad extinta 8 años antes — desfase de las fuentes internas, explicado por esta cosecha (Carril B, 2026-08-03)",
      ],
      notas: [SLP_NOTE, "Domicilio histórico Calle Hermosilla 3, distinto del grupo"],
    },
  },
  {
    uuid: U("08"), slug: "garrigues-portugal-slp",
    legalName: "Garrigues Portugal, S.L.P.", commonName: "Garrigues Portugal",
    legalForm: "SLP", tipoSocial: null, jurisdiction: "ES", parentSlug: null,
    ownershipPct: null, groupRole: "FILIAL", esUnipersonal: false,
    formaAdministracion: "ADMINISTRADOR_UNICO", nif: "B81745754",
    provenance: {
      fuentes: [INV, "Cosecha BORME 2026-08-03 (19 actos, PDFs oficiales boe.es)"],
      confianza: "A_CONFIRMAR", cobertura_motor: true,
      incidencias: [
        "Ausente del cuadro IDC 2025 y de la lista de participadas vigentes de la matriz; BORME muestra SOCIOS PROFESIONALES PROPIOS comprando/vendiendo participaciones numeradas vía autocartera (patrón de la matriz, no de filial-vehículo) → posible SLP hermana con pool de socios compartido; la participación de capital de la matriz NO está acreditada (el inventario la daba por filial). Parent retirado hasta fuente",
      ],
      notas: [SLP_NOTE, "Sociedad española (RM de Madrid) con actividad en Portugal; Adm. Único Vives reelegido 06/07/2026; auditor Lillo Auditores; capital 63.010 € (discrepancia con un BORME de 2014 que sugería 147.387,50 € — lead sin investigar)"],
    },
  },
  {
    uuid: U("09"), slug: "garrigues-portugal-sucursal",
    legalName: "Garrigues Portugal S.L.P. — Sucursal em Portugal", commonName: "Sucursal Portugal",
    legalForm: "SUCURSAL", tipoSocial: null, jurisdiction: "PT", parentSlug: "garrigues-portugal-slp",
    ownershipPct: null, groupRole: "SUCURSAL", esUnipersonal: null, formaAdministracion: null, nif: null,
    provenance: { fuentes: [INV], confianza: "CONFIRMADO", cobertura_motor: false, cobertura_motivo: "JURISDICCION_NO_ES" },
  },
  {
    uuid: U("10"), slug: "garrigues-ip-unipessoal-lda",
    legalName: "Garrigues-IP, Unipessoal, Lda", commonName: "Garrigues-IP Portugal",
    legalForm: "LDA", tipoSocial: null, jurisdiction: "PT", parentSlug: "garrigues-ip-slp",
    ownershipPct: 100, groupRole: "FILIAL", esUnipersonal: true, formaAdministracion: null, nif: null,
    provenance: {
      fuentes: [IDC], confianza: "CONFIRMADO", cobertura_motor: false, cobertura_motivo: "JURISDICCION_NO_ES",
      notas: ["100% indirecta según IDC; titular directo inferido: Garrigues IP SLP"],
    },
  },
  {
    uuid: U("11"), slug: "garrigues-uk-llp",
    legalName: "Garrigues UK, L.L.P.", commonName: "Garrigues UK",
    legalForm: "LLP", tipoSocial: null, jurisdiction: "UK", parentSlug: "jya-garrigues-slp",
    ownershipPct: null, groupRole: "FILIAL", esUnipersonal: null, formaAdministracion: null, nif: null,
    provenance: {
      fuentes: [INV], confianza: "PENDIENTE", cobertura_motor: false, cobertura_motivo: "JURISDICCION_NO_ES",
      incidencias: ["Ausente del cuadro IDC 2025 (¿no consolida por su forma LLP?)"],
    },
  },
  {
    uuid: U("12"), slug: "garrigues-llp-us",
    legalName: "Garrigues, L.L.P.", commonName: "Garrigues Nueva York",
    legalForm: "LLP", tipoSocial: null, jurisdiction: "US", parentSlug: "jya-garrigues-slp",
    ownershipPct: 100, groupRole: "FILIAL", esUnipersonal: null, formaAdministracion: null, nif: null,
    provenance: { fuentes: [IDC, INV], confianza: "CONFIRMADO", cobertura_motor: false, cobertura_motivo: "JURISDICCION_NO_ES" },
  },
  {
    uuid: U("13"), slug: "garrigues-maroc-sarlau",
    legalName: "Garrigues Maroc, S.A.R.L.A.U.", commonName: "Garrigues Casablanca",
    legalForm: "SARLAU", tipoSocial: null, jurisdiction: "MA", parentSlug: "jya-garrigues-slp",
    ownershipPct: 100, groupRole: "FILIAL", esUnipersonal: true, formaAdministracion: null, nif: null,
    provenance: { fuentes: [IDC, INV], confianza: "CONFIRMADO", cobertura_motor: false, cobertura_motivo: "JURISDICCION_NO_ES" },
  },
  {
    uuid: U("14"), slug: "garrigues-polska-spk",
    legalName: "Garrigues Polska & Roberto Delgado Gil, Sp.K.", commonName: "Garrigues Varsovia",
    legalForm: "SPK", tipoSocial: null, jurisdiction: "PL", parentSlug: "jya-garrigues-slp",
    ownershipPct: 98.99, groupRole: "FILIAL", esUnipersonal: false, formaAdministracion: null, nif: null,
    provenance: {
      fuentes: [IDC, INV], confianza: "CONFIRMADO", cobertura_motor: false, cobertura_motivo: "JURISDICCION_NO_ES",
      incidencias: ["Discrepancia nominal menor: DUNS la abrevia 'Garrigues Polska'"],
      notas: ["Roberto Delgado Gil figura en la razón social — coincide con el Secretario de la Junta 2026 y el secretario no consejero de EAD Trust"],
    },
  },
  {
    uuid: U("15"), slug: "garrigues-colombia-sas",
    legalName: "Garrigues Colombia S.A.S.", commonName: "Garrigues Bogotá",
    legalForm: "SAS", tipoSocial: null, jurisdiction: "CO", parentSlug: "jya-garrigues-slp",
    ownershipPct: 100, groupRole: "FILIAL", esUnipersonal: true, formaAdministracion: null, nif: null,
    provenance: { fuentes: [IDC, INV], confianza: "CONFIRMADO", cobertura_motor: false, cobertura_motivo: "JURISDICCION_NO_ES" },
  },
  {
    uuid: U("16"), slug: "garrigues-peru-scrl",
    legalName: "J&A Garrigues Perú, Sociedad Civil de Responsabilidad Limitada", commonName: "Garrigues Lima",
    legalForm: "SCRL", tipoSocial: null, jurisdiction: "PE", parentSlug: "jya-garrigues-slp",
    ownershipPct: 99, groupRole: "FILIAL", esUnipersonal: false, formaAdministracion: null, nif: null,
    provenance: {
      fuentes: [IDC, INV], confianza: "A_CONFIRMAR", cobertura_motor: false, cobertura_motivo: "JURISDICCION_NO_ES",
      notas: ["Split IDC: 0,01% directa + 98,99% indirecta (lectura razonable, confirmar)"],
    },
  },
  {
    uuid: U("17"), slug: "garrigues-mexico-sc",
    legalName: "Garrigues México S.C.", commonName: "Garrigues México",
    legalForm: "SC", tipoSocial: null, jurisdiction: "MX", parentSlug: "jya-garrigues-slp",
    ownershipPct: 98.99, groupRole: "FILIAL", esUnipersonal: false, formaAdministracion: null, nif: null,
    provenance: {
      fuentes: [IDC, INV], confianza: "A_CONFIRMAR", cobertura_motor: false, cobertura_motivo: "JURISDICCION_NO_ES",
      incidencias: ["Coexiste con Garrigues MX, S.C. — dos vehículos mexicanos (incidencia 8 de la spec)"],
      notas: ["Split IDC: 0,01% + 98,98% (confirmar)"],
    },
  },
  {
    uuid: U("18"), slug: "garrigues-mx-sc",
    legalName: "Garrigues MX, S.C.", commonName: "Garrigues MX",
    legalForm: "SC", tipoSocial: null, jurisdiction: "MX", parentSlug: "jya-garrigues-slp",
    ownershipPct: null, groupRole: "FILIAL", esUnipersonal: false, formaAdministracion: null, nif: null,
    provenance: {
      fuentes: [IDC, INV], confianza: "A_CONFIRMAR", cobertura_motor: false, cobertura_motivo: "JURISDICCION_NO_ES",
      incidencias: ["Coexiste con Garrigues México S.C. (incidencia 8)"],
      notas: ["Split IDC de lectura dudosa (~5,25% + 94,74%) — pct no se afirma"],
    },
  },
  {
    uuid: U("19"), slug: "garrigues-chile",
    legalName: "Garrigues Chile SpA", commonName: "Garrigues Santiago",
    legalForm: "SpA", tipoSocial: null, jurisdiction: "CL", parentSlug: "jya-garrigues-slp",
    ownershipPct: 98.9, groupRole: "FILIAL", esUnipersonal: false, formaAdministracion: null, nif: null,
    provenance: {
      fuentes: [IDC, INV], confianza: "A_CONFIRMAR", cobertura_motor: false, cobertura_motivo: "JURISDICCION_NO_ES",
      incidencias: ["Forma societaria en tránsito: DUNS y Diario Oficial dicen Limitada; las cuentas 2025 aún dicen SpA (incidencia 3)"],
      notas: ["Split IDC: 0,32% + 98,58% (confirmar)"],
    },
  },
  {
    uuid: U("20"), slug: "eu-law-office-garrigues",
    legalName: "EU Law Office Garrigues", commonName: "Garrigues Bruselas",
    legalForm: "OFICINA", tipoSocial: null, jurisdiction: "BE", parentSlug: "jya-garrigues-slp",
    ownershipPct: null, groupRole: "OFICINA", esUnipersonal: null, formaAdministracion: null, nif: null,
    provenance: {
      fuentes: [INV], confianza: "PENDIENTE", cobertura_motor: false, cobertura_motivo: "JURISDICCION_NO_ES",
      incidencias: ["Forma jurídica no confirmada en fuentes"],
    },
  },
  {
    uuid: U("21"), slug: "garrigues-shanghai-rep-office",
    legalName: "Shanghai Representative Office of J&A Garrigues SLP", commonName: "Garrigues Shanghái",
    legalForm: "REP_OFFICE", tipoSocial: null, jurisdiction: "CN", parentSlug: "jya-garrigues-slp",
    ownershipPct: null, groupRole: "OFICINA_REPRESENTACION", esUnipersonal: null, formaAdministracion: null, nif: null,
    provenance: { fuentes: [INV], confianza: "CONFIRMADO", cobertura_motor: false, cobertura_motivo: "JURISDICCION_NO_ES" },
  },
  {
    uuid: U("22"), slug: "g-advisory-chile-spa",
    legalName: "G-Advisory Chile, SpA", commonName: "G-Advisory Chile",
    legalForm: "SpA", tipoSocial: null, jurisdiction: "CL", parentSlug: "g-advisory-slp",
    ownershipPct: 100, groupRole: "FILIAL", esUnipersonal: true, formaAdministracion: null, nif: null,
    provenance: {
      fuentes: [IDC, INV], confianza: "A_CONFIRMAR", cobertura_motor: false, cobertura_motivo: "JURISDICCION_NO_ES",
      notas: ["IDC: 75% indirecta de J&A = 100% vía G-Advisory (75%) — parent y pct inferidos por aritmética"],
    },
  },
  {
    uuid: U("23"), slug: "g-advisory-mexico-sc",
    legalName: "G-Advisory México, S.C.", commonName: "G-Advisory México",
    legalForm: "SC", tipoSocial: null, jurisdiction: "MX", parentSlug: "g-advisory-slp",
    ownershipPct: 100, groupRole: "FILIAL", esUnipersonal: true, formaAdministracion: null, nif: null,
    provenance: {
      fuentes: [IDC, INV], confianza: "A_CONFIRMAR", cobertura_motor: false, cobertura_motivo: "JURISDICCION_NO_ES",
      notas: ["IDC: 75% indirecta de J&A = 100% vía G-Advisory (75%) — parent y pct inferidos por aritmética"],
    },
  },
  {
    uuid: U("24"), slug: "g-advisory-colombia",
    legalName: "G-Advisory Colombia (oficina Bogotá)", commonName: "G-Advisory Bogotá",
    legalForm: "OFICINA", tipoSocial: null, jurisdiction: "CO", parentSlug: "g-advisory-slp",
    ownershipPct: null, groupRole: "OFICINA", esUnipersonal: null, formaAdministracion: null, nif: null,
    provenance: {
      fuentes: [INV], confianza: "PENDIENTE", cobertura_motor: false, cobertura_motivo: "JURISDICCION_NO_ES",
      incidencias: ["Denominación social local no verificada (incidencia 4 de la spec)"],
    },
  },
  {
    uuid: U("25"), slug: "cia-digital-newlaw-slu",
    legalName: "Compañía Digital NewLaw, S.L.U.", commonName: "NewLaw (holding digital)",
    legalForm: "SLU", tipoSocial: "SLU", jurisdiction: "ES", parentSlug: "jya-garrigues-slp",
    ownershipPct: 100, groupRole: "FILIAL", esUnipersonal: true,
    formaAdministracion: "ADMINISTRADOR_UNICO", nif: "B72893035",
    provenance: { fuentes: [IDC, INV, "Cosecha BORME 2026-08-03: constituida 16/12/2022, socio único y Adm. Único = matriz, capital 1.578.000 € tras cadena de ampliaciones"], confianza: "CONFIRMADO", cobertura_motor: true },
  },
  {
    uuid: U("26"), slug: "ead-trust-sl",
    legalName: "EAD Trust European Agency of Digital Trust, S.L.", commonName: "EAD Trust",
    legalForm: "SL", tipoSocial: "SL", jurisdiction: "ES", parentSlug: "cia-digital-newlaw-slu",
    ownershipPct: 51, groupRole: "FILIAL", esUnipersonal: false,
    formaAdministracion: "CONSEJO", nif: "B85626240",
    provenance: {
      fuentes: [IDC, INV, "Contrato interno NewLaw (51,001%)"], confianza: "A_CONFIRMAR", cobertura_motor: true,
      incidencias: ["Variación nominal del % entre fuentes: 51,00 (IDC, indirecta, titular directo ilegible) vs 51,001 (contrato) — incidencia 7 de la spec"],
      notas: ["Único consejo de administración colegiado del perímetro operativo", "QTSP del ecosistema: solo interposición, mensajería básica y custodia (política 2026-07-21)"],
    },
  },
  {
    uuid: U("27"), slug: "g-digital-division",
    legalName: "g-digital (división de negocios digitales)", commonName: "g-digital",
    legalForm: "DIVISION", tipoSocial: null, jurisdiction: "ES", parentSlug: "jya-garrigues-slp",
    ownershipPct: null, groupRole: "DIVISION", esUnipersonal: null, formaAdministracion: null, nif: null,
    provenance: {
      fuentes: [INV], confianza: "CONFIRMADO", cobertura_motor: false, cobertura_motivo: "NO_SOCIEDAD",
      notas: ["División, no sociedad: integra conocimiento jurídico de Garrigues con la tecnología de EAD Trust"],
    },
  },
  {
    uuid: U("28"), slug: "fundacion-garrigues",
    legalName: "Fundación Garrigues", commonName: "Fundación Garrigues",
    legalForm: "FUNDACION", tipoSocial: null, jurisdiction: "ES", parentSlug: null,
    ownershipPct: null, groupRole: "VINCULADA", esUnipersonal: null, formaAdministracion: null, nif: null,
    provenance: {
      fuentes: [INV], confianza: "CONFIRMADO", cobertura_motor: false, cobertura_motivo: "VINCULADA_NO_CONTROLADA",
      notas: ["Creada y financiada por el despacho; entidad vinculada, no controlada"],
    },
  },
  {
    uuid: U("29"), slug: "centro-estudios-garrigues",
    legalName: "Centro de Estudios Garrigues", commonName: "Centro de Estudios",
    legalForm: "INSTITUCION", tipoSocial: null, jurisdiction: "ES", parentSlug: null,
    ownershipPct: null, groupRole: "VINCULADA", esUnipersonal: null, formaAdministracion: null, nif: null,
    provenance: {
      fuentes: [INV, "Acta Junta de Socios 06/05/2026 (punto 4)"], confianza: "A_CONFIRMAR",
      cobertura_motor: false, cobertura_motivo: "VINCULADA_NO_CONTROLADA",
      incidencias: [
        "Transmisión del 20% en 2025 con conservación de marca y presidencia (incidencia 6)",
        "La Junta 2026 aprueba una 'Operación de toma de participación' — dirección del movimiento sin reconciliar (incidencia 9)",
      ],
    },
  },
  {
    uuid: U("30"), slug: "bsvv-chile",
    legalName: "Barros, Silva, Varela & Vigil Abogados Limitada (BSVV)", commonName: "BSVV (integración Chile)",
    legalForm: "LIMITADA", tipoSocial: null, jurisdiction: "CL", parentSlug: "garrigues-chile",
    ownershipPct: null, groupRole: "INTEGRACION", esUnipersonal: null, formaAdministracion: null, nif: null,
    provenance: {
      fuentes: [INV, "Acta Junta de Socios 06/05/2026 (punto 5)"], confianza: "A_CONFIRMAR",
      cobertura_motor: false, cobertura_motivo: "JURISDICCION_NO_ES",
      incidencias: ["Integración aprobada por la Junta 2026 (admisión de socios BSVV + aumento de capital) — vehículo societario final sin localizar (incidencia 5)"],
    },
  },
  {
    uuid: U("31"), slug: "violet-inversiones-2010-sl",
    legalName: "Violet Inversiones 2010, S.L.", commonName: "Violet Inversiones",
    legalForm: "SL", tipoSocial: "SL", jurisdiction: "ES", parentSlug: null,
    ownershipPct: null, groupRole: "VEHICULO", esUnipersonal: null,
    formaAdministracion: "ADMINISTRADOR_UNICO", nif: "B85944411",
    provenance: {
      fuentes: [IDC, "Cosecha BORME 2026-08-03"], confianza: "A_CONFIRMAR", cobertura_motor: true,
      incidencias: ["100% indirecta según IDC con titular directo SIN RESOLVER — parent sin asignar hasta confirmación"],
      notas: ["Adm. Único: Rino Asesores S.L.P. (hoy Garrigues Letrados de Soporte S.L.P.), representada por Manuel Delgado Quirós; capital 3.012 € desde 2010; 10 apoderados nombrados el 12/11/2021 (mismo lote que EWOH y Garmen)", "No aparece en el inventario 2026 — descubierta en el cuadro de consolidación"],
    },
  },
  {
    uuid: U("32"), slug: "ewch-inversiones-sl",
    legalName: "EWOH Inversiones 2010, S.L.", commonName: "EWOH Inversiones",
    legalForm: "SL", tipoSocial: "SL", jurisdiction: "ES", parentSlug: null,
    ownershipPct: null, groupRole: "VEHICULO", esUnipersonal: null,
    formaAdministracion: "ADMINISTRADOR_UNICO", nif: "B86021698",
    provenance: {
      fuentes: [IDC, "Cosecha BORME 2026-08-03 (triangulación infonif ×3 + cargos de R. Delgado en empresia.es)"],
      confianza: "A_CONFIRMAR", cobertura_motor: true,
      incidencias: ["H1 RESUELTA con confianza alta no absoluta: el OCR 'EWCH' del IDC era 'EWOH' (confusión O↔C). La triangulación descansa en una base subyacente + 1 fuente independiente — verificación adicional (RM/BORME por NIF) antes de marcar CONFIRMADO"],
      notas: ["100% indirecta según IDC, titular directo SIN RESOLVER (el campo 'matriz' de los agregadores apunta a la cabecera última)", "Perfil gemelo de Violet: constitución 2010, capital 3.012 €, Adm. Único persona jurídica representada por Manuel Delgado Quirós, 10 apoderados nombrados el 12/11/2021", "No aparece en el inventario 2026"],
    },
  },
  {
    uuid: U("33"), slug: "garben-inversiones-2013-slu",
    legalName: "Garmen Inversiones 2013, S.L.", commonName: "Garmen Inversiones",
    legalForm: "SL", tipoSocial: "SL", jurisdiction: "ES", parentSlug: null,
    ownershipPct: null, groupRole: "VEHICULO", esUnipersonal: null,
    formaAdministracion: "ADMINISTRADOR_UNICO", nif: "B86825437",
    provenance: {
      fuentes: [IDC, "Cosecha BORME 2026-08-03 (3 consultas consistentes; 'Garben' sin resultados en ninguna)"],
      confianza: "A_CONFIRMAR", cobertura_motor: true,
      incidencias: ["Denominación probable 'Garmen' (con M) — el 'Garben' del OCR del IDC no existe en ninguna búsqueda; misma limitación de fuente única subyacente que EWOH: verificación adicional antes de CONFIRMADO"],
      notas: [
        "IDC: ~75% indirecta de J&A. La hipótesis aritmética (100% vía G-Advisory al 75%) queda como hipótesis: titular directo SIN RESOLVER y la forma S.L.U. del IDC no se confirma (ninguna fuente la declara unipersonal) — parent y pct retirados hasta fuente",
        "Capital 73.000 € tras ampliación de 3.000 € inscrita el 28/01/2026 (anuncio 44669) — única hermana con movimiento reciente; CNAE de intermediación financiera, distinto de Violet/EWOH",
        "No aparece en el inventario 2026",
      ],
    },
  },
];
