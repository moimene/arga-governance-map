// scripts/garrigues/esg/plan-sostenibilidad.ts
//
// G-ESG — ÚNICA FUENTE DE VERDAD del módulo de Sostenibilidad del tenant Garrigues.
//
// DECISIÓN DEL USUARIO (2026-08-29), opción (B): **gobernanza sin métricas**.
// El «Informe de Sostenibilidad 2025» NO está en el corpus. Verificado por
// comando: `grep -ri "sostenib"` sobre las tres carpetas fuente devuelve 2
// ocurrencias, y una de ellas es sólo una URL de SharePoint inaccesible citada
// por un agente de investigación anterior. El diseño de G5 ya lo había dicho
// (§2, D-1). Por tanto **no hay ni un objetivo, indicador ni cifra que sembrar**,
// y no se inventan: el módulo muestra quién gobierna la sostenibilidad y con qué
// política, y declara en pantalla que los objetivos del Plan no constan.
//
// Todo lo de este fichero es LITERAL de fuente. Las citas de PI-22 se extrajeron
// del PDF con `pdftotext -layout`; las misiones de los órganos vienen del
// catálogo de comités ya sembrado en G2.

/** Política rectora. Existe en Cloud y NO tiene owner_body_id: no se le atribuye uno. */
export const ESG_POLITICA = "PI-22";

/**
 * Los dos órganos reales, con el slug EXACTO con el que están sembrados en
 * Cloud — llevan prefijo `garrigues-`, que el JSON de origen no tiene. La ficha
 * de órgano resuelve por SLUG, no por UUID (`useBodyBySlug`), así que un slug
 * mal copiado deja el enlace muerto sin que nada falle.
 */
export const ESG_ORGANOS = [
  {
    slug: "garrigues-comite-sostenibilidad",
    nombre: "Comité de Sostenibilidad",
    miembros: 15,
    mision:
      "Coordina la estrategia ESG y de sostenibilidad del despacho, como organización y como firma de servicios profesionales.",
  },
  {
    slug: "garrigues-comision-seguimiento-sostenibilidad",
    nombre: "Comisión de Seguimiento del Plan de Sostenibilidad",
    miembros: 8,
    mision:
      "Analiza el cumplimiento de los objetivos del Plan de Sostenibilidad 2023-2025 y evalúa la contribución de las actuaciones, con apoyo del Grupo de Trabajo de Medioambiente.",
  },
] as const;

/**
 * El Plan existe y está NOMBRADO en la misión de la Comisión de Seguimiento.
 * Su contenido no. `objetivos: null` es deliberado y la pantalla lo dice.
 */
export const PLAN_SOSTENIBILIDAD = {
  nombre: "Plan de Sostenibilidad 2023-2025",
  periodo: "2023-2025",
  objetivos: null,
  motivo_ausencia:
    "El Plan se nombra en la misión de la Comisión de Seguimiento del Plan de Sostenibilidad, pero su contenido —objetivos, indicadores y grado de cumplimiento— no consta en fuente disponible.",
} as const;

export interface CompromisoEsg {
  eje: "AMBIENTAL" | "SOCIAL" | "GOBERNANZA";
  titulo: string;
  /** Literal de la fuente. No se parafrasea. */
  cita: string;
  fuente: string;
  /** Órgano o departamento que la fuente hace responsable. `null` = la fuente no lo dice. */
  responsable: string | null;
}

/**
 * Compromisos con cita literal. Ninguno lleva cifra, porcentaje ni objetivo
 * cuantificado, porque la fuente no los publica: son compromisos, no métricas.
 */
export const COMPROMISOS_ESG: readonly CompromisoEsg[] = [
  {
    eje: "AMBIENTAL",
    titulo: "Control del consumo de recursos y cumplimiento de la normativa ambiental",
    cita:
      "Controlará los consumos de recursos en general, y en especial aquéllos que tengan un impacto relevante para el medio ambiente.",
    fuente: "PI-22 §3.3(a)",
    responsable: "Departamento de Servicios Generales, Logística e Infraestructuras",
  },
  {
    eje: "AMBIENTAL",
    titulo: "Economía circular",
    cita:
      "Entre las prioridades de Garrigues en esta materia se encuentra el fomento de la economía circular, es decir, que los materiales y recursos naturales que utilizamos se mantengan en uso durante el mayor tiempo posible.",
    fuente: "PI-22 §3.3",
    responsable: "Departamento de Servicios Generales, Logística e Infraestructuras",
  },
  {
    eje: "AMBIENTAL",
    titulo: "Compatibilidad del modelo de negocio con la transición climática",
    cita:
      "Es prioritario para Garrigues garantizar que su modelo de negocio y su estrategia sean compatibles con la transición hacia una economía sostenible y con la limitación del calentamiento global a 1,5 °C, en consonancia con el Acuerdo de París […] y el objetivo de lograr la neutralidad climática de aquí a 2050 tal como se establece en el Reglamento (UE) 2021/1119.",
    fuente: "PI-22 §3.3",
    responsable: null,
  },
  {
    eje: "SOCIAL",
    titulo: "Adhesión al Pacto Mundial de las Naciones Unidas",
    cita:
      "Garrigues firmó su adhesión al Pacto Mundial de las Naciones Unidas en marzo del año 2002, y dedica sus mejores esfuerzos para materializar el compromiso asumido con los diez principios que lo constituyen.",
    fuente: "PI-22 §3.4",
    responsable: null,
  },
  {
    eje: "SOCIAL",
    titulo: "Actividad pro bono",
    cita:
      "Es de especial relevancia en Garrigues su contribución a la sociedad a través de la realización de actividades pro bono, que se regirán de acuerdo con lo establecido por el Comité Pro bono y el Manual creados específicamente para ello.",
    fuente: "PI-22 §3.4",
    responsable: "Comité Pro bono",
  },
  {
    eje: "SOCIAL",
    titulo: "Contribución a los Objetivos de Desarrollo Sostenible",
    cita:
      "Garrigues asume el compromiso de ejercer su labor profesional contribuyendo al cumplimiento de los Objetivos de Desarrollo Sostenible aprobados por la Asamblea General de Naciones Unidas el 25 de septiembre de 2015 […] la Agenda 2030 para el Desarrollo Sostenible.",
    fuente: "PI-22 §3.4",
    responsable: null,
  },
  {
    eje: "GOBERNANZA",
    titulo: "Información a los grupos de interés",
    cita:
      "A través de los diferentes canales de comunicación que el Despacho tiene definidos para cada grupo de interés, se identifican sus respectivas expectativas y, especialmente a través de la Memoria de Responsabilidad Social del Despacho, se les informa de los resultados obtenidos, de forma clara y transparente.",
    fuente: "PI-22 §3.4",
    responsable: null,
  },
] as const;

/**
 * Los diez principios del Pacto Mundial, literales de PI-22 §3.4. Se sirven
 * como lo que son —el compromiso suscrito— y no como indicadores de desempeño.
 */
export const PRINCIPIOS_PACTO_MUNDIAL: readonly string[] = [
  "Las empresas deben apoyar y respetar la protección de los derechos humanos fundamentales reconocidos universalmente, dentro de su ámbito de influencia.",
  "Las empresas deben asegurarse de que sus empresas no son cómplices de la vulneración de los derechos humanos.",
  "Las empresas deben apoyar la libertad de Asociación y el reconocimiento efectivo del derecho a la negociación colectiva.",
  "Las empresas deben apoyar la eliminación de toda forma de trabajo forzoso o realizado bajo coacción.",
  "Las empresas deben apoyar la erradicación del trabajo infantil.",
  "Las empresas deben apoyar la abolición de las prácticas de discriminación en el empleo y ocupación.",
  "Las empresas deberán mantener un enfoque preventivo que favorezca el medio ambiente.",
  "Las empresas deben fomentar las iniciativas que promuevan una mayor responsabilidad ambiental.",
  "Las empresas deben favorecer el desarrollo y la difusión de las tecnologías respetuosas con el medio ambiente.",
  "Las empresas deben trabajar en contra de la corrupción en todas sus formas, incluidas la extorsión y el soborno.",
] as const;

/**
 * A QUÉ tenant pertenece este catálogo. La pantalla lo compara con el suyo para
 * no servírselo a otro grupo: ese es su único uso real.
 *
 * NO es una fila de `grc_modules`, y decía serlo. `grc_modules` del tenant
 * Garrigues contiene aml, cyber, ethics y risk — comprobado en Cloud — y no hay
 * ninguna migración que añada `esg`. Sembrarla exige una decisión sobre el
 * schema que no corresponde a este carril, así que queda anotado como deuda en
 * vez de afirmar una fila que no existe. Consecuencia hoy: `/grc/sostenibilidad`
 * es además ruta huérfana, sin item de navegación que lleve a ella.
 */
export const ESG_MODULO = {
  id: "esg",
  tenant_id: "00000000-0000-0000-0000-000000000002",
  name: "Sostenibilidad y ESG",
  owner: "Comité de Sostenibilidad",
} as const;

/**
 * Si `/grc/sostenibilidad` puede servir este catálogo al tenant que lo pide.
 *
 * Falla CERRADO, y por eso es una función y no una condición dentro de la
 * pantalla: `TenantProvider` arranca en `null` y resuelve por red, así que el
 * guard anterior —`if (tenantId && tenantId !== ESG_MODULO.tenant_id)`— dejaba
 * pasar el primer render de CUALQUIER tenant, incluido ARGA, que veía la
 * política y los comités de Garrigues. Un `null` no es «todavía no sé»: es
 * «todavía no puedo decir que sí».
 */
export function esgVisibleParaTenant(tenantId: string | null | undefined): boolean {
  return tenantId === ESG_MODULO.tenant_id;
}
