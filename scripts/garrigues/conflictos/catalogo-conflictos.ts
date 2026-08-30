// scripts/garrigues/conflictos/catalogo-conflictos.ts
//
// Conflictos de interés del tenant Garrigues. TIPOLÓGICOS, nunca nominales.
//
// La regla dura de este carril: **ningún conflicto real se atribuye a una
// persona identificada**. El censo tiene 406 personas físicas con nombre y
// apellidos reales de fuente pública; decir que una de ellas está en conflicto
// es una afirmación sobre una persona concreta que ninguna fuente sostiene.
// Por eso las situaciones se describen POR ROL («un socio del área Mercantil»)
// y `person_id` va a NULL en todas.
//
// Qué es firme y qué no:
//
//  - Las DOS CATEGORÍAS son de PI-02 y están en su índice: §2.1 «Conflictos de
//    intereses en sentido estricto» y §2.2 «Conflictos de carácter comercial o
//    de negocio». Eso lo dice la fuente y se cita con su apartado.
//  - Las SITUACIONES concretas no. PI-02 define las categorías; no publica un
//    registro de conflictos. Todas van con `firmeza: "DEMO_PILOTO"`.
//
// Limitación de procedencia, declarada: el PDF de PI-02 **no está** en el árbol
// (`version garrigues/Garr_politicas/` no lo contiene; se extrajo en G4 cuando
// sí estaba). La cita procede del catálogo normativo congelado
// —`normativo/catalogo-normativo.ts`, entrada `PI-02`, Edición 3 de febrero de
// 2024—, que es texto extraído del original, no una paráfrasis. No se cita
// ningún apartado que no aparezca en ese índice.

export const CONFLICTOS_TENANT = "00000000-0000-0000-0000-000000000002";

/** Política rectora, con la edición que consta en el catálogo normativo. */
export const CONFLICTOS_POLITICA = {
  codigo: "PI-02",
  titulo: "Política sobre conflicto de intereses, chequeo y resolución de los mismos",
  edicion: "Edición 3, febrero 2024",
} as const;

/**
 * Las dos categorías del apartado 2 de PI-02. FIRMES: están en su índice.
 *
 * NO viajan a Cloud: el CHECK de `conflicts_of_interest.conflict_type` solo
 * admite 'Permanente' | 'Situacional', que clasifica por DURACIÓN y no por la
 * naturaleza del conflicto. Son ejes distintos y mapear uno sobre otro sería
 * inventar una correspondencia que la fuente no hace, así que la columna queda
 * en NULL y la categoría vive aquí, que es donde la lee la pantalla.
 */
export const CATEGORIAS_PI02 = [
  {
    conflict_type: "SENTIDO_ESTRICTO",
    etiqueta: "Conflicto de intereses en sentido estricto",
    apartado: "PI-02 §2.1",
    firmeza: "FIRME",
  },
  {
    conflict_type: "COMERCIAL_O_NEGOCIO",
    etiqueta: "Conflicto de carácter comercial o de negocio",
    apartado: "PI-02 §2.2",
    firmeza: "FIRME",
  },
] as const;

export type CategoriaPI02 = (typeof CATEGORIAS_PI02)[number]["conflict_type"];

export type ConflictoDemo = {
  readonly code: string;
  readonly conflict_type: CategoriaPI02;
  /** Descripción POR ROL. Nunca un nombre. */
  readonly descripcion: string;
  /**
   * Valor de la BD. El CHECK de la columna solo admite
   * 'Declarado' | 'Pendiente' | 'Resuelto', que es el vocabulario del esquema
   * y no el de PI-02 —cuya §3 habla de «chequeo»—. Se usa el de la BD en la
   * BD, y el de la fuente en pantalla, sin que ninguno finja ser el otro.
   */
  readonly status: "Declarado" | "Pendiente" | "Resuelto";
  /** Como lo llama la fuente. Es lo que lee la pantalla. */
  readonly estadoTexto: string;
  readonly firmeza: "DEMO_PILOTO";
};

/**
 * Situaciones ilustrativas. Verosímiles para un despacho, **simuladas todas**,
 * y sin una sola persona identificada: el sujeto es siempre un rol.
 *
 * El objeto de PI-02, citado de su resumen, explica por qué son verosímiles:
 * «por el gran número de clientes y la diversidad de profesionales responsables
 * de los mismos, es muy probable la concurrencia de encargos que plantee un
 * potencial conflicto de intereses». Eso lo dice la fuente. Que ESTOS casos
 * hayan ocurrido, no.
 */
export const CONFLICTOS_DEMO: readonly ConflictoDemo[] = [
  {
    code: "COI-GARR-01",
    conflict_type: "SENTIDO_ESTRICTO",
    descripcion:
      "Un socio del área Mercantil recibe un encargo de una sociedad cuya contraparte en la misma " +
      "operación ya es cliente del despacho en otro asunto en curso. El chequeo se activa antes de " +
      "aceptar el trabajo profesional.",
    status: "Pendiente",
    estadoTexto: "En chequeo",
    firmeza: "DEMO_PILOTO",
  },
  {
    code: "COI-GARR-02",
    conflict_type: "SENTIDO_ESTRICTO",
    descripcion:
      "Un profesional del área Procesal es propuesto para la defensa de un cliente frente a otro " +
      "cliente del despacho. La situación afecta al secreto profesional y se eleva para su " +
      "resolución antes de la contratación.",
    status: "Pendiente",
    estadoTexto: "En chequeo",
    firmeza: "DEMO_PILOTO",
  },
  {
    code: "COI-GARR-03",
    conflict_type: "SENTIDO_ESTRICTO",
    descripcion:
      "Un profesional del área Fiscal tiene un interés personal en una de las sociedades " +
      "implicadas en un encargo que se le propone. Se declara y se aparta del asunto.",
    status: "Resuelto",
    estadoTexto: "Resuelto",
    firmeza: "DEMO_PILOTO",
  },
  {
    code: "COI-GARR-04",
    conflict_type: "COMERCIAL_O_NEGOCIO",
    descripcion:
      "Un encargo de una entidad competidora de un cliente relevante del despacho plantea un " +
      "conflicto de carácter comercial, sin conflicto en sentido estricto. Se valora la " +
      "conveniencia de aceptarlo.",
    status: "Pendiente",
    estadoTexto: "En chequeo",
    firmeza: "DEMO_PILOTO",
  },
  {
    code: "COI-GARR-05",
    conflict_type: "COMERCIAL_O_NEGOCIO",
    descripcion:
      "Un proveedor propuesto para un servicio interno está vinculado a un cliente del despacho. " +
      "Se documenta la vinculación y se somete a chequeo antes de la contratación.",
    status: "Resuelto",
    estadoTexto: "Resuelto",
    firmeza: "DEMO_PILOTO",
  },
] as const;

/** Lo que la pantalla dice sobre la procedencia de estas filas. */
export const CONFLICTOS_AVISO = {
  titulo: "Situaciones simuladas sobre una tipología real",
  texto:
    "Las dos categorías proceden del apartado 2 de PI-02 y se citan con su apartado. Las " +
    "situaciones concretas son simuladas: la política define los tipos de conflicto y el " +
    "procedimiento de chequeo, pero no publica un registro de conflictos. Ninguna se atribuye a " +
    "una persona identificada — el sujeto es siempre un rol.",
  fuente: `${CONFLICTOS_POLITICA.codigo}, ${CONFLICTOS_POLITICA.titulo} (${CONFLICTOS_POLITICA.edicion})`,
} as const;
