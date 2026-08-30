// scripts/garrigues/sii/canal-interno.ts
//
// El Canal Interno de Información de Garrigues, con las citas cotejadas contra
// el PDF de PI-31 («Política Sistema Interno de Información (SII) de
// Garrigues»), extraído con `pdftotext -layout` el 2026-08-30.
//
// Todo lo de este fichero es FIRME y literal. Donde la fuente no dice algo, no
// hay entrada: no se rellena con lo que «tendría sentido».
//
// Por qué importa que sea literal: la superficie del SII nombraba hasta ahora
// una «Comisión de Auditoría y Control» y un «Comité de Cumplimiento», que son
// órganos de una aseguradora. **En Garrigues no existen.** El Responsable es
// un órgano UNIPERSONAL, y decir «comisión» cambia quién responde.

export const SII_TENANT = "00000000-0000-0000-0000-000000000002";

export const SII_POLITICA = {
  codigo: "PI-31",
  titulo: "Política Sistema Interno de Información (SII) de Garrigues",
} as const;

/**
 * Los dos roles del canal, con su apartado. Literal de PI-31.
 *
 * El Responsable NO es un órgano colegiado: la política dice «órgano
 * unipersonal» con todas las letras.
 */
export const SII_ROLES = [
  {
    rol: "RESPONSABLE",
    cargo: "Senior Partner de la Firma",
    apartado: "PI-31 §4",
    cita:
      "El Responsable de la gestión del SII de Garrigues, designado por el órgano de " +
      "administración, es el Senior Partner de la Firma, órgano unipersonal que asume la " +
      "función de supervisión del Sistema de Compliance de Garrigues.",
    // La propia política prevé qué pasa si el Responsable está en conflicto.
    sustitucion:
      "En caso de conflicto de interés, el órgano de administración nombrará a la persona " +
      "encargada de dicha resolución (PI-31 §4).",
  },
  {
    rol: "INSTRUCTOR",
    cargo: "Directora de Cumplimiento Normativo",
    apartado: "PI-31, Anexo §2.a",
    cita:
      // Frase COMPLETA. La primera versión cortaba en «fase de instrucción» y
      // le ponía un punto que la fuente no tiene — el cotejo literal contra el
      // PDF lo cazó. Una cita truncada con punto final afirma que ahí acababa.
      "El Instructor del Canal Interno de Información es la Directora de Cumplimiento " +
      "Normativo, y será la persona encargada de gestionar el adecuado funcionamiento del " +
      "citado Canal en la fase de instrucción salvo que, como se prevé en el apartado 5 c), " +
      "concurra en ella alguna situación de conflicto de interés u otro impedimento, en cuyo " +
      "caso el Responsable del SII designará a otro instructor.",
    sustitucion:
      "Si concurre conflicto de interés u otro impedimento, el Responsable del SII designará " +
      "a otro instructor (PI-31, Anexo §2.a).",
  },
] as const;

/**
 * Canales externos. Art. 25 de la Ley 2/2023 y §3 de PI-31.
 *
 * El matiz jurídico que NO se puede perder: el canal interno es el cauce
 * *preferente*, pero el informante puede acudir al externo **directamente**.
 * Presentar el interno como obligatorio o previo sería incorrecto.
 */
export const SII_CANALES_EXTERNOS = [
  {
    nombre: "Autoridad Independiente de Protección del Informante (A.A.I.)",
    ambito:
      "Cualquier acción u omisión incluida en el ámbito de aplicación de la Ley de protección " +
      "del informante, o las autoridades u órganos autonómicos correspondientes.",
    apartado: "PI-31 §3",
    // A esta autoridad se le notifica además la designación del Responsable.
    nota: "A ella se notifica la designación del Responsable del SII (PI-31 §4).",
  },
  {
    nombre: "SEPBLAC",
    ambito:
      "Hechos o situaciones que puedan ser constitutivos de infracciones contempladas en la " +
      "Ley 10/2010 o su normativa de desarrollo. Garrigues es sujeto obligado por la " +
      "normativa de PBC/FT.",
    apartado: "PI-31 §3",
    nota:
      "Las comunicaciones son confidenciales: el SEPBLAC no puede desvelar los datos " +
      "identificativos de quien las realiza.",
  },
] as const;

/** La advertencia que acompaña al bloque. Es el matiz del art. 25. */
export const SII_CANAL_EXTERNO_AVISO =
  "El Canal Interno es el cauce preferente, pero no es obligatorio ni previo: se puede acudir " +
  "a los canales externos directamente, o después de haber comunicado por el interno.";

/**
 * Cita de la Ley 2/2023 verificada contra el consolidado del BOE
 * (BOE-A-2023-4513) el 2026-08-29. Las demás del módulo —art. 26 «Registro de
 * informaciones» y art. 36 «Prohibición de represalias»— ya estaban correctas
 * en el código y no se tocan.
 */
export const SII_ART_25 = {
  articulo: "art. 25",
  rubrica: "Información sobre los canales interno y externo de información",
  norma: "Ley 2/2023, de 20 de febrero",
} as const;

/**
 * Los órganos que el motor debe nombrar en el tenant Garrigues.
 *
 * Sustituyen a los valores por defecto —«Comité de Cumplimiento», «Presidencia
 * de la Comisión de Auditoría y Control»—, que son órganos de una aseguradora.
 * Aquí el Responsable del SII es un **órgano unipersonal**: el Senior Partner
 * (PI-31 §4). No hay comité que presida nada.
 *
 * El escalado no va «al Senior Partner» sin más: la propia política prevé que,
 * si él está en conflicto, es el **órgano de administración** quien designa a
 * la persona que resuelve. Eso es lo que se nombra.
 */
export const SII_ORGANOS_GARRIGUES = {
  comiteCumplimientoPenal:
    "Responsable del SII (Senior Partner) / Posible remisión a Fiscalía",
  comiteCumplimiento: "Responsable del SII (Senior Partner)",
  organoEscalado:
    "el Responsable del SII (Senior Partner) o, si concurre conflicto de interés, " +
    "a la persona que designe el órgano de administración (PI-31 §4)",
} as const;
