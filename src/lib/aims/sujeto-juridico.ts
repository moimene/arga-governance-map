// src/lib/aims/sujeto-juridico.ts
//
// F2.T1 — ¿QUIÉN puede ser sujeto de una obligación del RIA?
//
// EL PROBLEMA QUE RESUELVE
// -----------------------
// El RIA impone deberes a un PROVEEDOR o a un RESPONSABLE DEL DESPLIEGUE, y los
// dos son «una persona física o jurídica, autoridad pública, órgano u organismo»
// (arts. 3.3 y 3.4). Una sucursal, una oficina de representación o una división
// de negocio NO son personas jurídicas: no pueden ser sujeto, y lo que hacen
// responde en su titular. El inventario de los dos tenants las tiene mezcladas
// con las sociedades —medido el 20-09-2026: 31 entidades y 16 formas jurídicas
// en ARGA, 33 y 18 en Garrigues—, así que hace falta un criterio, y uno solo.
//
// Módulo HOJA, sin React y sin imports: lo consumen la RPC de sujetos, la ficha
// de entidad, el selector de ámbito y los espejos SQL. Si el criterio viviera en
// una pantalla, una corrección llegaría a esa y sus hermanas seguirían pintando
// lo contrario (es lo que ya pasó con la cobertura de obligaciones en GRC).
//
// FALLA CERRADO
// -------------
// Una forma jurídica que no esté en la tabla de equivalencias NO es elegible:
// `SIN_CLASIFICAR`. Inventar que una forma desconocida es una sociedad crearía
// sujetos con obligaciones atribuidas a quien quizá no las tiene. Al revés
// —negar la condición de sujeto a quien sí la tiene— también esconde deberes,
// y por eso la tabla se cubre con el dato real de los dos tenants y un gate vivo
// (`src/test/schema/aims-sujeto-juridico-live.test.ts`) cae si Cloud estrena una
// forma que aquí no está.
//
// LO QUE NO DECIDE ESTE MÓDULO
// ----------------------------
// La decisión D-U4 del usuario (aceptada el 20-09-2026) resolvió tres casos por
// identidad, no por forma: la Fundación sí es sujeto; el Centro de Estudios
// (INSTITUCION) y BSVV (integración en Chile) no, hasta que se acredite su
// personalidad. Las sociedades de personas —las tres SC mexicanas, las dos LLP y
// la SPK polaca— siguen SIN decidir: su personalidad jurídica depende del
// Derecho de su jurisdicción y es el lote H-09. Quedan `PERSONALIDAD_NO_ACREDITADA`,
// que no es elegible y además pide dictamen.

/** Clase de la entidad a efectos de poder ser sujeto de una obligación. */
export type ClaseSujeto =
  /** Sociedad de capital: persona jurídica, sujeto por sí misma. */
  | "SOCIEDAD"
  /** Persona jurídica no societaria reconocida como sujeto (D-U4). */
  | "FUNDACION"
  /** Sucursal, oficina, oficina de representación o división: sube a su titular. */
  | "ESTABLECIMIENTO"
  /** Instituto o entidad integrada sin personalidad acreditada (D-U4: no es sujeto). */
  | "SIN_PERSONALIDAD_ACREDITADA"
  /** Sociedad de personas cuya personalidad depende de su Derecho: pendiente de H-09. */
  | "PERSONALIDAD_NO_ACREDITADA"
  /** Forma no prevista: no es elegible y hay que clasificarla. */
  | "SIN_CLASIFICAR";

/**
 * Forma mínima que necesita el criterio. La cumplen la fila de `entities` y el
 * catálogo congelado de Garrigues; nadie tiene que convertir una en la otra.
 */
export type EntidadSujeto = {
  slug: string;
  legalName: string;
  legalForm: string | null | undefined;
  groupRole?: string | null;
  entityStatus?: string | null;
  parentSlug?: string | null;
};

export type VeredictoSujeto = {
  elegible: boolean;
  clase: ClaseSujeto;
  /** Por qué, en la lengua del producto: va a la pantalla tal cual. */
  motivo: string;
  /** La actividad responde en el titular, no aquí. */
  subeATitular: boolean;
  /** Necesita dictamen antes de poder decidirse. */
  requiereLegal: boolean;
};

/**
 * Normaliza la forma jurídica: mayúsculas, sin puntos y con los espacios
 * colapsados. Así «S.L.» de ARGA y «SL» de Garrigues son la misma clave, que es
 * lo que son. Se conservan las letras acentuadas y la ş turca: quitarlas
 * confundiría formas distintas de países distintos.
 */
export function normalizaForma(forma: string | null | undefined): string {
  return (forma ?? "").replace(/\./g, "").replace(/\s+/g, " ").trim().toUpperCase();
}

/**
 * Tabla de equivalencias forma → clase, cubierta con las 16 formas de ARGA y las
 * 18 de Garrigues (medidas en Cloud el 20-09-2026). No es una lista de las
 * formas del mundo: es la de las que existen en el dato, y crece con él.
 */
export const CLASE_POR_FORMA: Record<string, ClaseSujeto> = {
  // Sociedades españolas y portuguesas
  SLP: "SOCIEDAD",
  SL: "SOCIEDAD",
  SLU: "SOCIEDAD",
  SA: "SOCIEDAD",
  SICAV: "SOCIEDAD",
  LDA: "SOCIEDAD",
  "SOCIEDADE LIMITADA UNIPESSOAL": "SOCIEDAD",
  "SOCIEDADE POR QUOTAS UNIPESSOAL": "SOCIEDAD",
  // Sociedades del resto de jurisdicciones del perímetro
  // «SPA» cubre la S.p.A. italiana y la SpA chilena: las dos son sociedades por
  // acciones, así que la colisión al normalizar no cambia el veredicto.
  SPA: "SOCIEDAD",
  AG: "SOCIEDAD",
  AŞ: "SOCIEDAD",
  PT: "SOCIEDAD",
  INC: "SOCIEDAD",
  LTD: "SOCIEDAD",
  CORPORATION: "SOCIEDAD",
  "SA DE CV": "SOCIEDAD",
  "SOCIEDAD ANÓNIMA DE CAPITAL VARIABLE": "SOCIEDAD",
  SAS: "SOCIEDAD",
  SCRL: "SOCIEDAD",
  SARLAU: "SOCIEDAD",
  LIMITADA: "SOCIEDAD",

  FUNDACION: "FUNDACION",
  FUNDACIÓN: "FUNDACION",

  // No son personas jurídicas: responde su titular.
  SUCURSAL: "ESTABLECIMIENTO",
  OFICINA: "ESTABLECIMIENTO",
  REP_OFFICE: "ESTABLECIMIENTO",
  DIVISION: "ESTABLECIMIENTO",

  // D-U4: no es sujeto hasta acreditar personalidad.
  INSTITUCION: "SIN_PERSONALIDAD_ACREDITADA",

  // Sociedades de personas: pendientes del lote H-09.
  SC: "PERSONALIDAD_NO_ACREDITADA",
  LLP: "PERSONALIDAD_NO_ACREDITADA",
  SPK: "PERSONALIDAD_NO_ACREDITADA",
};

/** Papeles de grupo que no son personas jurídicas, cualquiera que sea la forma. */
const ROLES_ESTABLECIMIENTO = new Set(["SUCURSAL", "OFICINA", "OFICINA_REPRESENTACION", "DIVISION"]);

/** Estados registrales que impiden ser sujeto de una obligación viva. */
const ESTADOS_NO_OPERATIVOS = new Set(["LIQUIDATED", "INACTIVE"]);

export function claseDeEntidad(e: EntidadSujeto): ClaseSujeto {
  const rol = (e.groupRole ?? "").toUpperCase();
  // El papel manda sobre la forma: BSVV es una «Limitada» chilena por su forma,
  // pero entra en el perímetro como INTEGRACION y D-U4 dice que no es sujeto.
  if (rol === "INTEGRACION") return "SIN_PERSONALIDAD_ACREDITADA";
  if (ROLES_ESTABLECIMIENTO.has(rol)) return "ESTABLECIMIENTO";
  const clave = normalizaForma(e.legalForm);
  return CLASE_POR_FORMA[clave] ?? "SIN_CLASIFICAR";
}

export function esEntidadElegible(e: EntidadSujeto): VeredictoSujeto {
  const clase = claseDeEntidad(e);
  const estado = (e.entityStatus ?? "").toUpperCase();

  if (ESTADOS_NO_OPERATIVOS.has(estado)) {
    return {
      elegible: false,
      clase,
      motivo: `${e.legalName} no está activa en el registro (${e.entityStatus}): no se le atribuyen obligaciones vivas.`,
      subeATitular: false,
      requiereLegal: false,
    };
  }

  switch (clase) {
    case "SOCIEDAD":
    case "FUNDACION":
      return {
        elegible: true,
        clase,
        motivo: `${e.legalName} es persona jurídica propia: puede ser proveedora o responsable del despliegue (arts. 3.3 y 3.4).`,
        subeATitular: false,
        requiereLegal: false,
      };
    case "ESTABLECIMIENTO":
      return {
        elegible: false,
        clase,
        motivo: `${e.legalName} no es una persona jurídica distinta: lo que haga con un sistema de IA responde en su titular.`,
        subeATitular: true,
        requiereLegal: false,
      };
    case "SIN_PERSONALIDAD_ACREDITADA":
      return {
        elegible: false,
        clase,
        motivo: `${e.legalName} no se registra como sujeto hasta acreditar su personalidad jurídica (decisión D-U4, 20-09-2026).`,
        subeATitular: false,
        requiereLegal: true,
      };
    case "PERSONALIDAD_NO_ACREDITADA":
      return {
        elegible: false,
        clase,
        motivo: `${e.legalName} es una sociedad de personas: su personalidad jurídica depende del Derecho de su jurisdicción y está pendiente de dictamen.`,
        subeATitular: false,
        requiereLegal: true,
      };
    default:
      return {
        elegible: false,
        clase,
        motivo: `Forma jurídica no clasificada («${e.legalForm ?? "sin forma"}»): no se atribuyen obligaciones a ${e.legalName} hasta clasificarla.`,
        subeATitular: false,
        requiereLegal: true,
      };
  }
}

/** Atajo para los sitios que solo quieren el sí o el no. */
export function requiereLegal(e: EntidadSujeto): boolean {
  return esEntidadElegible(e).requiereLegal;
}

/**
 * Quién responde por esta entidad. Un establecimiento sube por la cadena de
 * control hasta la primera entidad elegible; si la cadena se rompe —padre que no
 * existe, ciclo, o un titular que tampoco es elegible— devuelve `null`, y quien
 * llama tiene que decirlo en vez de inventarse un titular.
 */
export function titularJuridico(e: EntidadSujeto, catalogo: EntidadSujeto[]): EntidadSujeto | null {
  const porSlug = new Map(catalogo.map((x) => [x.slug, x]));
  const vistos = new Set<string>();
  let actual: EntidadSujeto | undefined = e;
  while (actual && !vistos.has(actual.slug)) {
    vistos.add(actual.slug);
    if (esEntidadElegible(actual).elegible) return actual;
    actual = actual.parentSlug ? porSlug.get(actual.parentSlug) : undefined;
  }
  return null;
}

/**
 * Etiqueta con la que se nombra a un sujeto en pantalla.
 *
 * Es la denominación social completa, no el nombre común: ARGA tiene TRES pares
 * de sociedades distintas que comparten nombre común (Brasil, México y
 * Portugal), y llamarlas igual mezclaría los sujetos de dos personas jurídicas
 * diferentes. El gate exige que dos elegibles nunca compartan etiqueta.
 */
export function etiquetaSociedad(e: EntidadSujeto): string {
  return e.legalName.trim();
}
