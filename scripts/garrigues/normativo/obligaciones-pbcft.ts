// scripts/garrigues/normativo/obligaciones-pbcft.ts
//
// G4 Task 4 — ÚNICA FUENTE DE VERDAD de las obligaciones PBC/FT (Ley 10/2010)
// y de los controles del Programa de Prevención de Delitos (PPD) del tenant
// Garrigues. Mismo papel que `scripts/garrigues/entities-catalog.ts`: el seed
// no reinterpreta nada de lo que hay aquí.
//
// ─── Verificación de las citas ────────────────────────────────────────────
// TODO `legal_reference` de este fichero se ha cotejado contra el texto
// consolidado del BOE que viaja en el propio repo:
//   version garrigues/Garr_politicas/OneDrive_1_2-8-2026.zip
//     → "Documentos de interés/01. Ley 10_2010, de 28 de abril, de prevención
//        del blanqueo de capitales y de la financiación del terrorismo.pdf"
// Ninguna cita se ha escrito de memoria. El campo `quote` guarda el literal
// del artículo que respalda cada fila para que la revisión sea auditable sin
// volver al PDF. `quote` NO se persiste en base de datos.
//
// ─── Granularidad de la cita (criterio del Comité Legal) ──────────────────
// docs/legal/2026-08-04-decisiones-comite-legal-slp-garrigues.md fijó que la
// cita que se MUESTRA es a nivel de artículo. Los apartados, cuando importan,
// viven en comentario interno de este fichero y nunca en la interfaz. Por eso
// `legal_reference` dice "art. 7" y el matiz del apartado 7.3 está en el
// comentario de la exención, no en pantalla.
//
// ─── `source` es el MARCO, no el artículo ─────────────────────────────────
// `obligations.source` es la columna de marco normativo: en ARGA vale DORA,
// GDPR, LGPD o SolvenciaII, y de ella deriva la agrupación por secciones de
// /obligaciones. Un `source` por artículo produciría 20 secciones de una fila.
// Por eso hay UN solo valor, `MARCO_PBCFT`, y el artículo vive en
// `legal_reference`, que es la columna que lo representa.
//
// ─── Sujeción del despacho ────────────────────────────────────────────────
// Garrigues es sujeto obligado por el art. 2.1.ñ (VERIFICADO, no supuesto):
// "Los abogados, procuradores u otros profesionales independientes cuando
// participen en la concepción, realización o asesoramiento de operaciones por
// cuenta de clientes relativas a la compraventa de bienes inmuebles o
// entidades comerciales, la gestión de fondos, valores u otros activos […]".
// No es la letra m) (auditores, contables externos, asesores fiscales), que es
// la confusión habitual en un despacho multidisciplinar.
//
// ─── Qué es dato real y qué es postura simulada ───────────────────────────
// Real y trazable a fuente: el artículo de cada obligación (BOE) y el nombre
// de cada control (Manual PBC/FT v.10 nov-2025 y PPD-01 Manual del Sistema de
// Gestión de Riesgos Penales, ed. 03 mayo 2018, ambos en el material aportado).
// SIMULADO para la demo: `status` de los controles y `criticality` de las
// obligaciones. NO son una evaluación de la eficacia real del sistema de
// Garrigues. Por eso no se usa `Inefectivo` en ninguna fila: afirmar que un
// control de una firma real es inefectivo sería una imputación, no un dato.

export type ObligationPeriodicity =
  | "CONTINUA"
  | "POR_OPERACION"
  | "ANUAL"
  | "BIENAL"
  | "PUNTUAL"
  | "SEGUN_REGLAMENTO";

export type OwnerSlug =
  | "garrigues-caci"
  | "garrigues-departamento-compliance"
  | "garrigues-comite-prevencion-delitos";

/**
 * Marco normativo único de este bloque. Va a `obligations.source`, la columna
 * de la que /obligaciones deriva sus secciones y su filtro de marco: un solo
 * valor para las 20 filas. El artículo NO va aquí, va en `legal_reference`.
 */
export const MARCO_PBCFT = "PBC/FT — Ley 10/2010";

export type ObligacionPbcFt = {
  /** Prefijo OBL-PBC- (no colisiona con los prefijos que mapea el trigger de backbone). */
  code: string;
  title: string;
  /** Columna estructurada de Task 1. Cita canónica verificada contra el BOE. */
  legal_reference: string;
  criticality: "Crítico" | "Alto" | "Medio" | "Bajo";
  periodicity: ObligationPeriodicity;
  owner_slug: OwnerSlug;
  /**
   * Firmeza del criterio, patrón del Comité Legal
   * (`docs/legal/2026-08-04-decisiones-comite-legal-slp-garrigues.md`).
   * Ausente = FIRME: literal del texto consolidado del BOE. `DEMO_PILOTO`
   * marca lo que el Comité Legal debe confirmar antes de tratarlo como firme;
   * cuando está presente, el título DEBE llevar la cautela en pantalla (el
   * seed lo verifica). Solo auditoría — no va a base de datos.
   */
  firmeza?: "DEMO_PILOTO";
  /** Literal del BOE que respalda la cita. Solo auditoría — no va a base de datos. */
  quote: string;
};

export type ControlPpd = {
  /** Prefijo CTR-GARR-. */
  code: string;
  name: string;
  /** CHECK real en Cloud: solo Efectivo | Parcial | Inefectivo. */
  status: "Efectivo" | "Parcial" | "Inefectivo";
  /** Obligación que cubre. Todo control debe cubrir una: los read-paths de
   *  /obligaciones resuelven los controles por `obligation_id`, así que un
   *  control huérfano no se ve en ninguna pantalla. */
  obligation_code: string;
  owner_slug: OwnerSlug;
  /** Fuente documental del control. Solo auditoría — no va a base de datos. */
  source_doc: string;
};

// ──────────────────────────────────────────────────────────────────────────
// Obligaciones
// ──────────────────────────────────────────────────────────────────────────
export const OBLIGACIONES_PBCFT: ObligacionPbcFt[] = [
  {
    code: "OBL-PBC-01",
    title: "Identificación formal del cliente y comprobación de su identidad mediante documento fehaciente",
    legal_reference: "Ley 10/2010, de 28 de abril, art. 3",
    criticality: "Crítico",
    periodicity: "POR_OPERACION",
    owner_slug: "garrigues-caci",
    quote:
      "Los sujetos obligados identificarán a cuantas personas físicas o jurídicas pretendan establecer relaciones de negocio o intervenir en cualesquiera operaciones.",
  },
  {
    code: "OBL-PBC-02",
    title: "Identificación del titular real y de la estructura de propiedad y control del cliente",
    legal_reference: "Ley 10/2010, de 28 de abril, art. 4",
    criticality: "Crítico",
    periodicity: "POR_OPERACION",
    owner_slug: "garrigues-caci",
    quote:
      "Los sujetos obligados identificarán al titular real y adoptarán medidas adecuadas a fin de comprobar su identidad con carácter previo al establecimiento de relaciones de negocio o a la ejecución de cualesquiera operaciones.",
  },
  {
    code: "OBL-PBC-03",
    title: "Obtención de información sobre el propósito e índole prevista de la relación de negocios",
    legal_reference: "Ley 10/2010, de 28 de abril, art. 5",
    criticality: "Alto",
    periodicity: "POR_OPERACION",
    owner_slug: "garrigues-caci",
    quote:
      "Los sujetos obligados obtendrán información sobre el propósito e índole prevista de la relación de negocios.",
  },
  {
    code: "OBL-PBC-04",
    title: "Seguimiento continuo de la relación de negocios y actualización del expediente del cliente",
    legal_reference: "Ley 10/2010, de 28 de abril, art. 6",
    criticality: "Alto",
    periodicity: "CONTINUA",
    owner_slug: "garrigues-caci",
    quote:
      "Los sujetos obligados aplicarán medidas de seguimiento continuo a la relación de negocios, incluido el escrutinio de las operaciones efectuadas a lo largo de dicha relación […] y garantizar que los documentos, datos e información de que se disponga estén actualizados.",
  },
  {
    code: "OBL-PBC-05",
    title: "Aplicación de las medidas de diligencia debida en función del riesgo, con análisis de riesgo escrito",
    legal_reference: "Ley 10/2010, de 28 de abril, art. 7",
    criticality: "Crítico",
    periodicity: "ANUAL",
    owner_slug: "garrigues-caci",
    quote:
      "Los sujetos obligados deberán estar en condiciones de demostrar a las autoridades competentes que las medidas adoptadas tienen el alcance adecuado en vista del riesgo de blanqueo de capitales o de financiación del terrorismo mediante un previo análisis de riesgo que en todo caso deberá constar por escrito.",
  },
  {
    code: "OBL-PBC-06",
    title: "Medidas reforzadas de diligencia debida en situaciones de alto riesgo",
    legal_reference: "Ley 10/2010, de 28 de abril, art. 11",
    criticality: "Alto",
    periodicity: "POR_OPERACION",
    owner_slug: "garrigues-caci",
    quote:
      "Los sujetos obligados, aplicarán, en función de un análisis del riesgo, medidas reforzadas de diligencia debida en aquellas situaciones que por su propia naturaleza puedan presentar un riesgo más elevado de blanqueo de capitales o de financiación del terrorismo.",
  },
  {
    code: "OBL-PBC-07",
    title: "Medidas reforzadas respecto de personas con responsabilidad pública",
    legal_reference: "Ley 10/2010, de 28 de abril, art. 14",
    criticality: "Alto",
    periodicity: "POR_OPERACION",
    owner_slug: "garrigues-caci",
    quote:
      "Los sujetos obligados aplicarán las medidas reforzadas de diligencia debida previstas en este artículo en las relaciones de negocio u operaciones de personas con responsabilidad pública.",
  },
  {
    code: "OBL-PBC-08",
    title: "Examen especial de hechos u operaciones y reseña por escrito de su resultado",
    legal_reference: "Ley 10/2010, de 28 de abril, art. 17",
    criticality: "Crítico",
    periodicity: "POR_OPERACION",
    owner_slug: "garrigues-caci",
    quote:
      "Los sujetos obligados examinarán con especial atención cualquier hecho u operación, con independencia de su cuantía, que, por su naturaleza, pueda estar relacionado con el blanqueo de capitales o la financiación del terrorismo, reseñando por escrito los resultados del examen.",
  },
  {
    code: "OBL-PBC-09",
    title: "Comunicación por indicio al Servicio Ejecutivo de la Comisión (SEPBLAC)",
    legal_reference: "Ley 10/2010, de 28 de abril, art. 18",
    criticality: "Crítico",
    periodicity: "PUNTUAL",
    owner_slug: "garrigues-caci",
    quote:
      "Los sujetos obligados comunicarán, por iniciativa propia, al Servicio Ejecutivo de la Comisión […] cualquier hecho u operación, incluso la mera tentativa, respecto al que, tras el examen especial a que se refiere el artículo precedente, exista indicio o certeza de que está relacionado con el blanqueo de capitales o la financiación del terrorismo.",
  },
  {
    code: "OBL-PBC-10",
    title: "Abstención de ejecución de la operación comunicada",
    legal_reference: "Ley 10/2010, de 28 de abril, art. 19",
    criticality: "Crítico",
    periodicity: "PUNTUAL",
    owner_slug: "garrigues-caci",
    quote:
      "Los sujetos obligados se abstendrán de ejecutar cualquier operación de las señaladas en el artículo precedente.",
  },
  {
    // SEGUNDA EXCLUSIÓN ETIQUETADA. El art. 20 de la Ley remite la
    // comunicación sistemática al reglamento, y el reglamento excluye
    // expresamente a los sujetos del art. 2.1.k) a y) — donde cae la ñ) por la
    // que Garrigues es sujeto obligado. La declaración negativa semestral vive
    // en el art. 27.1 del RD, del que también quedan exceptuados.
    //
    // Corroboración interna, la que más pesa: el Manual PBC/FT v.10 del
    // despacho NO tiene sección de comunicación sistemática (su §7 va 7.1
    // examen especial → 7.2 procedimiento → 7.3 abstención → 7.4 revelación →
    // 7.5 colaboración → 7.6 infracciones → 7.7 conservación) y la expresión
    // no aparece ni una vez en el cuerpo del Manual.
    //
    // Por eso NO se modela como obligación exigible: afirmarla sería atribuir
    // al despacho una obligación que no le aplica y un control que no ejecuta.
    //
    // firmeza DEMO_PILOTO: la copia del RD que obra en el expediente es la de
    // 2014 y puede tener modificaciones posteriores. Pendiente de confirmación
    // por el Comité Legal.
    code: "OBL-PBC-11",
    title:
      "Excepción — la comunicación sistemática no es exigible al despacho como sujeto obligado del art. 2.1.ñ (criterio DEMO_PILOTO, pendiente de confirmación del Comité Legal)",
    legal_reference: "RD 304/2014, de 5 de mayo, art. 27.3 (excepción al art. 20 de la Ley 10/2010)",
    criticality: "Bajo",
    periodicity: "PUNTUAL",
    owner_slug: "garrigues-caci",
    firmeza: "DEMO_PILOTO",
    quote:
      "Quedan exceptuados de la obligación de comunicación sistemática los corredores de seguros a los que se refiere el artículo 2.1 b) de la Ley 10/2010, de 28 de abril, las empresas de asesoramiento financiero y los sujetos obligados mencionados en los párrafos k) a y), ambos inclusive, del artículo 2.1 de la misma ley.",
  },
  {
    code: "OBL-PBC-20",
    title:
      "Colaboración con la Comisión de Prevención del Blanqueo de Capitales y sus órganos de apoyo, y sistemas de respuesta a sus requerimientos",
    legal_reference: "Ley 10/2010, de 28 de abril, art. 21",
    criticality: "Alto",
    periodicity: "PUNTUAL",
    owner_slug: "garrigues-caci",
    quote:
      "Los sujetos obligados facilitarán la documentación e información que la Comisión de Prevención del Blanqueo de Capitales e Infracciones Monetarias o sus órganos de apoyo les requieran para el ejercicio de sus competencias. […] Los sujetos obligados establecerán, en el marco de las medidas de control interno a que se refiere el artículo 26, sistemas que les permitan responder de forma completa y diligente a las solicitudes de información…",
  },
  {
    code: "OBL-PBC-12",
    title: "Prohibición de revelar al cliente o a terceros la comunicación o el examen de una operación",
    legal_reference: "Ley 10/2010, de 28 de abril, art. 24",
    criticality: "Crítico",
    periodicity: "CONTINUA",
    owner_slug: "garrigues-caci",
    quote:
      "Los sujetos obligados y sus directivos o empleados no revelarán al cliente ni a terceros que se ha comunicado información al Servicio Ejecutivo de la Comisión, o que se está examinando o puede examinarse alguna operación por si pudiera estar relacionada con el blanqueo de capitales o con la financiación del terrorismo.",
  },
  {
    code: "OBL-PBC-13",
    title: "Conservación de la documentación durante diez años",
    legal_reference: "Ley 10/2010, de 28 de abril, art. 25",
    criticality: "Alto",
    periodicity: "CONTINUA",
    owner_slug: "garrigues-departamento-compliance",
    quote:
      "Los sujetos obligados conservarán durante un período de diez años la documentación en que se formalice el cumplimiento de las obligaciones establecidas en la presente ley, procediendo tras el mismo a su eliminación.",
  },
  {
    code: "OBL-PBC-14",
    title: "Aprobación por escrito de políticas y procedimientos de control interno y manual de prevención actualizado",
    legal_reference: "Ley 10/2010, de 28 de abril, art. 26",
    criticality: "Crítico",
    periodicity: "ANUAL",
    owner_slug: "garrigues-caci",
    quote:
      "Los sujetos obligados aprobarán por escrito y aplicarán políticas y procedimientos adecuados en materia de diligencia debida, información, conservación de documentos, control interno, evaluación y gestión de riesgos […]. Los sujetos obligados deberán aprobar un manual adecuado de prevención del blanqueo de capitales y de la financiación del terrorismo, que se mantendrá actualizado.",
  },
  {
    code: "OBL-PBC-15",
    title: "Procedimiento interno de comunicación de potenciales incumplimientos",
    legal_reference: "Ley 10/2010, de 28 de abril, art. 26 bis",
    criticality: "Alto",
    periodicity: "CONTINUA",
    owner_slug: "garrigues-departamento-compliance",
    quote:
      "Los sujetos obligados establecerán procedimientos internos para que sus empleados, directivos o agentes puedan comunicar, incluso anónimamente, información relevante sobre posibles incumplimientos de esta ley, su normativa de desarrollo o las políticas y procedimientos implantados para darles cumplimiento, cometidos en el seno del sujeto obligado.",
  },
  {
    code: "OBL-PBC-16",
    title: "Órgano de control interno y representante ante el Servicio Ejecutivo de la Comisión",
    legal_reference: "Ley 10/2010, de 28 de abril, art. 26 ter",
    criticality: "Crítico",
    periodicity: "CONTINUA",
    owner_slug: "garrigues-caci",
    quote:
      "Los sujetos obligados designarán como representante ante el Servicio Ejecutivo de la Comisión a una persona residente en España que ejerza cargo de administración o dirección de la sociedad. […] Los sujetos obligados establecerán un órgano adecuado de control interno responsable de la aplicación de las políticas y procedimientos a que se refiere el artículo 26.",
  },
  {
    code: "OBL-PBC-17",
    title: "Examen anual de las medidas y órganos de control interno por experto externo",
    legal_reference: "Ley 10/2010, de 28 de abril, art. 28",
    criticality: "Alto",
    periodicity: "ANUAL",
    owner_slug: "garrigues-departamento-compliance",
    quote:
      "Las medidas y órganos de control interno a que se refieren los artículos 26, 26 bis y 26 ter serán objeto de examen anual por un experto externo.",
  },
  {
    code: "OBL-PBC-18",
    title: "Formación de empleados conforme a plan anual aprobado por el órgano de control interno",
    legal_reference: "Ley 10/2010, de 28 de abril, art. 29",
    criticality: "Alto",
    periodicity: "ANUAL",
    owner_slug: "garrigues-departamento-compliance",
    quote:
      "Los sujetos obligados adoptarán las medidas oportunas para que sus empleados tengan conocimiento de las exigencias derivadas de esta Ley. […] Las acciones formativas serán objeto de un plan anual que, diseñado en función de los riesgos del sector de negocio del sujeto obligado, será aprobado por el órgano de control interno.",
  },
  {
    code: "OBL-PBC-19",
    title:
      "Confidencialidad de la identidad de quien comunica y estándares éticos en la contratación de empleados, directivos y agentes",
    legal_reference: "Ley 10/2010, de 28 de abril, art. 30",
    criticality: "Medio",
    periodicity: "CONTINUA",
    owner_slug: "garrigues-departamento-compliance",
    quote:
      "Los sujetos obligados adoptarán las medidas adecuadas para mantener la confidencialidad sobre la identidad de los empleados, directivos o agentes que hayan realizado una comunicación […]. Los sujetos obligados establecerán por escrito y aplicarán políticas y procedimientos adecuados para asegurar altos estándares éticos en la contratación de empleados, directivos y agentes.",
  },
  {
    // EXCLUSIÓN ETIQUETADA, no una obligación más. El título dice "Exención"
    // en primera posición precisamente porque `title` es lo primero que
    // pintan las dos lecturas de /obligaciones (lista y detalle) — así el
    // abogado ve que es una no sujeción sin abrir nada. El artículo lo pinta
    // la ficha desde `legal_reference` (Task 7).
    //
    // Apartado (comentario interno, NO va a pantalla por el criterio del
    // Comité Legal): la no sujeción del art. 22 alcanza exactamente a los
    // arts. 7.3, 18 y 21 — no a toda la Ley. El deber de secreto profesional
    // se conserva íntegro (párrafo segundo del propio art. 22).
    code: "OBL-PBC-EX-22",
    title:
      "Exención — no sujeción de los abogados respecto de la información obtenida al determinar la posición jurídica del cliente o en el ejercicio de su defensa",
    legal_reference: "Ley 10/2010, de 28 de abril, art. 22 (no sujeción)",
    criticality: "Bajo",
    periodicity: "PUNTUAL",
    owner_slug: "garrigues-caci",
    quote:
      "Los abogados no estarán sometidos a las obligaciones establecidas en los artículos 7.3, 18 y 21 con respecto a la información que reciban de uno de sus clientes u obtengan sobre él al determinar la posición jurídica en favor de su cliente o desempeñar su misión de defender a dicho cliente en procesos judiciales o en relación con ellos, incluido el asesoramiento sobre la incoación o la forma de evitar un proceso, independientemente de si han recibido u obtenido dicha información antes, durante o después de tales procesos.",
  },
];

// ──────────────────────────────────────────────────────────────────────────
// Controles
//
// Ownership por comité según el reparto de la fase: CACI para lo PBC/FT
// nuclear, Departamento de Compliance para archivo, formación y examen
// externo, Comité de Prevención de Delitos para los controles del PPD.
//
// NOTA DE PROCEDENCIA (para no confundir el reparto operativo con la fuente):
// PPD-01 §8.1 atribuye la supervisión del PPD al Senior Partner "debidamente
// auxiliado por el Comité de Práctica Profesional". La asignación de los tres
// controles del PPD al Comité de Prevención de Delitos es el reparto de
// ownership de esta fase, no una afirmación del manual.
//
// Los tres controles del PPD se enganchan solo donde el instrumento del PPD
// sirve DE VERDAD a una obligación de la Ley 10/2010 (PPD-01 §5.1 lista entre
// las medidas generales de la Firma el Código Ético, el Canal Ético y la
// propia normativa interna de PBC/FT). No se han fabricado más enlaces
// PPD ↔ Ley 10/2010 de los que la fuente sostiene.
// ──────────────────────────────────────────────────────────────────────────
export const CONTROLES_PPD: ControlPpd[] = [
  {
    code: "CTR-GARR-01",
    name: "Formulario KYC y comprobación documental de la identidad en el alta de cliente (herramienta AML)",
    status: "Efectivo",
    obligation_code: "OBL-PBC-01",
    owner_slug: "garrigues-caci",
    source_doc: "Manual PBC/FT v.10, §6.2.1",
  },
  {
    code: "CTR-GARR-02",
    name: "Declaración responsable del cliente y contraste del titular real con registros mercantiles",
    status: "Parcial",
    obligation_code: "OBL-PBC-02",
    owner_slug: "garrigues-caci",
    source_doc: "Manual PBC/FT v.10, §6.2.2",
  },
  {
    code: "CTR-GARR-03",
    name: "Registro del propósito e índole del encargo en la apertura del asunto",
    status: "Efectivo",
    obligation_code: "OBL-PBC-03",
    owner_slug: "garrigues-caci",
    source_doc: "Manual PBC/FT v.10, §6",
  },
  {
    code: "CTR-GARR-04",
    name: "Revisión periódica del expediente KYC según el nivel de riesgo asignado al cliente",
    status: "Parcial",
    obligation_code: "OBL-PBC-04",
    owner_slug: "garrigues-caci",
    source_doc: "Manual PBC/FT v.10, §5.2 y §6",
  },
  {
    code: "CTR-GARR-05",
    name: "Estratificación de clientes por riesgo y análisis de riesgo escrito de la Firma",
    status: "Efectivo",
    obligation_code: "OBL-PBC-05",
    owner_slug: "garrigues-caci",
    source_doc: "Manual PBC/FT v.10, §5.2",
  },
  {
    code: "CTR-GARR-06",
    name: "Análisis reforzado del cliente en los supuestos de alto riesgo",
    status: "Efectivo",
    obligation_code: "OBL-PBC-06",
    owner_slug: "garrigues-caci",
    source_doc: "Manual PBC/FT v.10, anexo de Análisis Reforzado del Cliente",
  },
  {
    code: "CTR-GARR-07",
    name: "Cribado de personas con responsabilidad pública y aprobación de la relación por la dirección",
    status: "Parcial",
    obligation_code: "OBL-PBC-07",
    owner_slug: "garrigues-caci",
    source_doc: "Manual PBC/FT v.10, §6; lista de PRP de la UE (Tesoro)",
  },
  {
    code: "CTR-GARR-08",
    name: "Examen especial documentado por el CACI de las operaciones detectadas",
    status: "Efectivo",
    obligation_code: "OBL-PBC-08",
    owner_slug: "garrigues-caci",
    source_doc: "Manual PBC/FT v.10, §7.2 (procedimiento de examen especial); detección previa en §7.1",
  },
  {
    code: "CTR-GARR-09",
    name: "Comunicación interna al CACI y elevación al Servicio Ejecutivo de la Comisión",
    status: "Efectivo",
    obligation_code: "OBL-PBC-09",
    owner_slug: "garrigues-caci",
    source_doc: "Manual PBC/FT v.10, §7.1.2",
  },
  {
    code: "CTR-GARR-10",
    name: "Bloqueo de la ejecución del encargo hasta la resolución del CACI",
    status: "Efectivo",
    obligation_code: "OBL-PBC-10",
    owner_slug: "garrigues-caci",
    source_doc: "Manual PBC/FT v.10, §7",
  },
  {
    code: "CTR-GARR-11",
    name: "Advertencia expresa de la prohibición de revelación en toda comunicación interna de operativa sospechosa",
    status: "Efectivo",
    obligation_code: "OBL-PBC-12",
    owner_slug: "garrigues-caci",
    source_doc: "Manual PBC/FT v.10, §7",
  },
  {
    // No es "hacer la comunicación sistemática" — el despacho está exceptuado.
    // Es verificar que la excepción sigue vigente al actualizar el Manual, que
    // es lo único que cabe controlar sobre una no sujeción. Sin este control,
    // la fila saldría en /obligaciones como "SIN CONTROL — acción inmediata
    // requerida", leyéndose como un hueco de cumplimiento que no existe.
    code: "CTR-GARR-24",
    name: "Verificación de la vigencia de la excepción a la comunicación sistemática en la revisión del Manual PBC/FT",
    status: "Efectivo",
    obligation_code: "OBL-PBC-11",
    owner_slug: "garrigues-caci",
    source_doc: "RD 304/2014, art. 27.3; Manual PBC/FT v.10, control de versiones",
  },
  {
    code: "CTR-GARR-23",
    name: "Sistema de respuesta a los requerimientos de la Comisión y de sus órganos de apoyo, con plazo controlado",
    status: "Efectivo",
    obligation_code: "OBL-PBC-20",
    owner_slug: "garrigues-caci",
    source_doc: "Manual PBC/FT v.10, §7.5",
  },
  {
    code: "CTR-GARR-12",
    name: "Archivo centralizado y conservación decenal de la documentación PBC/FT",
    status: "Efectivo",
    obligation_code: "OBL-PBC-13",
    owner_slug: "garrigues-departamento-compliance",
    source_doc: "Manual PBC/FT v.10, §7.7",
  },
  {
    code: "CTR-GARR-13",
    name: "Revisión y aprobación del Manual PBC/FT y de sus anexos, con control de versiones",
    status: "Efectivo",
    obligation_code: "OBL-PBC-14",
    owner_slug: "garrigues-caci",
    source_doc: "Manual PBC/FT v.10, control de versiones",
  },
  {
    code: "CTR-GARR-14",
    name: "Política de aceptación de nuevos clientes y asuntos con chequeo previo obligatorio",
    status: "Efectivo",
    obligation_code: "OBL-PBC-14",
    owner_slug: "garrigues-caci",
    source_doc: "Manual PBC/FT v.10, §5.3; el Manual incorpora el apartado 2 de PI-01 como su Anexo 1",
  },
  {
    code: "CTR-GARR-15",
    name: "Comité de Análisis y Control Interno constituido, con actas, y representante designado ante el Servicio Ejecutivo",
    status: "Efectivo",
    obligation_code: "OBL-PBC-16",
    owner_slug: "garrigues-caci",
    source_doc: "Manual PBC/FT v.10, §8.1.2 (representante ante el SEPBLAC) y §8.1.3 (CACI)",
  },
  {
    code: "CTR-GARR-16",
    name: "Informe anual del experto externo y seguimiento documentado de las deficiencias identificadas",
    status: "Efectivo",
    obligation_code: "OBL-PBC-17",
    owner_slug: "garrigues-departamento-compliance",
    source_doc: "Manual PBC/FT v.10, §8.4",
  },
  {
    code: "CTR-GARR-17",
    name: "Plan anual de formación PBC/FT con registro acreditado de asistencia",
    status: "Efectivo",
    obligation_code: "OBL-PBC-18",
    owner_slug: "garrigues-departamento-compliance",
    source_doc: "Manual PBC/FT v.10, §8",
  },
  {
    code: "CTR-GARR-18",
    name: "Aplicación del secreto profesional: marcado del asunto amparado por la no sujeción y exclusión del flujo de comunicación",
    status: "Efectivo",
    obligation_code: "OBL-PBC-EX-22",
    owner_slug: "garrigues-caci",
    source_doc: "Ley 10/2010, art. 22; Manual PBC/FT v.10, §7",
  },
  // ── Controles del PPD (Comité de Prevención de Delitos) ────────────────
  {
    code: "CTR-GARR-19",
    name: "PPD — Canal Ético como vía de comunicación de incidencias, riesgos e incumplimientos del sistema normativo interno",
    status: "Efectivo",
    obligation_code: "OBL-PBC-15",
    owner_slug: "garrigues-comite-prevencion-delitos",
    source_doc: "PPD-01 §4.2 y §5.1",
  },
  {
    code: "CTR-GARR-20",
    name: "PPD — Código Ético y sistema disciplinario aplicables a la vulneración del sistema normativo interno",
    status: "Efectivo",
    obligation_code: "OBL-PBC-19",
    owner_slug: "garrigues-comite-prevencion-delitos",
    source_doc: "PPD-01 §5.1 y §8.2; Código Ético §1.6",
  },
  {
    // Reanclado al art. 26 (procedimientos documentados de control interno,
    // que el propio artículo extiende a la conservación de documentos) y NO al
    // art. 25: la retención decenal del PPD lo es por el plazo de prescripción
    // penal (PPD-01 §8.3), no por el art. 25. Coincide el número de años, no
    // el fundamento.
    code: "CTR-GARR-21",
    name: "PPD — Control de documentos e inventario del programa en la herramienta de gestión, con archivo centralizado",
    status: "Efectivo",
    obligation_code: "OBL-PBC-14",
    owner_slug: "garrigues-comite-prevencion-delitos",
    source_doc: "PPD-01 §8.3 (control de documentos) y §8.4 (herramienta de soporte)",
  },
];
