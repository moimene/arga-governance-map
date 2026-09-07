/**
 * Rol regulatorio y clasificación motivada de un sistema de IA.
 *
 * Módulo hoja (no importa nada) porque lo usan el alta, la ficha del sistema y
 * el perfil de aplicabilidad del autodiagnóstico.
 *
 * POR QUÉ EXISTE
 * --------------
 * El alta pedía «nivel de riesgo» en un desplegable libre con «Alto»
 * preseleccionado, y no preguntaba en absoluto qué papel juega la entidad
 * respecto al sistema. Las obligaciones del Reglamento (UE) 2024/1689 se
 * determinan por POSICIÓN REGULATORIA —quién controla modelo, datos, registros
 * y finalidad—, no por taxonomía técnica. Sin el rol no se puede saber qué
 * catálogo de medidas aplica, y medir a un responsable del despliegue contra el
 * catálogo de un proveedor de alto riesgo produce un porcentaje que no
 * significa nada.
 *
 * QUÉ HACE Y QUÉ NO
 * -----------------
 * El cuestionario **propone** un nivel a partir de las preguntas del propio
 * Reglamento y **obliga a motivar**. No decide: la clasificación la firma quien
 * evalúa, con su fecha y su nombre. Un producto que dictaminara la calificación
 * jurídica de un sistema estaría fabricando criterio.
 */

export type RolRegulatorio =
  | "PROVEEDOR"
  | "RESPONSABLE_DESPLIEGUE"
  | "IMPORTADOR"
  | "DISTRIBUIDOR"
  | "PROVEEDOR_GPAI"
  | "PROVEEDOR_POSTERIOR";

export type NivelRiesgo = "Inaceptable" | "Alto" | "Limitado" | "Mínimo";

export const ROLES_REGULATORIOS: {
  code: RolRegulatorio;
  label: string;
  articulo: string;
  ayuda: string;
}[] = [
  {
    code: "RESPONSABLE_DESPLIEGUE",
    label: "Responsable del despliegue",
    articulo: "Art. 3.4",
    ayuda:
      "Usa el sistema bajo su propia autoridad en el ejercicio de su actividad profesional. Es el papel habitual de quien contrata una herramienta de un tercero.",
  },
  {
    code: "PROVEEDOR",
    label: "Proveedor",
    articulo: "Art. 3.3",
    ayuda:
      "Desarrolla el sistema —o lo hace desarrollar— y lo introduce en el mercado o lo pone en servicio con su nombre o marca.",
  },
  {
    code: "PROVEEDOR_GPAI",
    label: "Proveedor de modelo de uso general",
    articulo: "Cap. V",
    ayuda: "Introduce en el mercado un modelo de IA de uso general (GPAI).",
  },
  {
    code: "PROVEEDOR_POSTERIOR",
    label: "Proveedor posterior",
    articulo: "Art. 3.68",
    ayuda:
      "Integra un modelo de uso general en un sistema propio que introduce en el mercado.",
  },
  {
    code: "IMPORTADOR",
    label: "Importador",
    articulo: "Art. 3.6",
    ayuda:
      "Está establecido en la Unión e introduce en el mercado un sistema que lleva el nombre o la marca de una entidad de un tercer país.",
  },
  {
    code: "DISTRIBUIDOR",
    label: "Distribuidor",
    articulo: "Art. 3.7",
    ayuda:
      "Comercializa el sistema en la Unión sin ser ni el proveedor ni el importador.",
  },
];

export const ETIQUETA_ROL: Record<RolRegulatorio, string> = Object.fromEntries(
  ROLES_REGULATORIOS.map((r) => [r.code, r.label]),
) as Record<RolRegulatorio, string>;

/**
 * Las tres preguntas del art. 25.1: un responsable del despliegue PASA A SER
 * proveedor —y asume sus obligaciones— si concurre cualquiera de ellas.
 *
 * No se resuelven solas: la respuesta afirmativa avisa, y quien evalúa decide.
 */
export const PREGUNTAS_ROL: { id: string; texto: string }[] = [
  {
    id: "nombre_o_marca",
    texto: "¿La entidad introduce el sistema en el mercado o lo pone en servicio con su propio nombre o marca?",
  },
  {
    id: "modificacion_sustancial",
    texto: "¿La entidad ha modificado sustancialmente el sistema?",
  },
  {
    id: "cambio_finalidad",
    texto: "¿La entidad ha cambiado la finalidad prevista del sistema?",
  },
];

export const PREGUNTAS_CLASIFICACION: {
  id: string;
  texto: string;
  articulo: string;
  implica: NivelRiesgo | null;
}[] = [
  {
    id: "practica_prohibida",
    texto: "¿El sistema incurre en alguna de las prácticas prohibidas?",
    articulo: "Art. 5",
    implica: "Inaceptable",
  },
  {
    id: "anexo_iii",
    texto: "¿El caso de uso está entre los del anexo III, o el sistema es un componente de seguridad de los productos del anexo I?",
    articulo: "Art. 6 y anexos I y III",
    implica: "Alto",
  },
  {
    id: "transparencia",
    texto: "¿Interactúa con personas físicas, genera o manipula contenido sintético, reconoce emociones o hace categorización biométrica?",
    articulo: "Art. 50",
    implica: "Limitado",
  },
  {
    id: "usa_gpai",
    texto: "¿El sistema se apoya en uno o varios modelos de IA de uso general?",
    articulo: "Cap. V",
    // No cambia el nivel del SISTEMA: activa las obligaciones de cadena de
    // suministro del capítulo V y la trazabilidad del proveedor de modelo.
    implica: null,
  },
];

export type RespuestasClasificacion = Record<string, boolean | undefined>;

export type PropuestaClasificacion = {
  nivel: NivelRiesgo;
  /** Por qué sale ese nivel, en los términos de las propias preguntas. */
  motivoAutomatico: string;
  /**
   * `true` cuando se responde que SÍ al anexo III y aun así se clasifica por
   * debajo de «Alto»: el art. 6.3 obliga a documentar esa evaluación ANTES de
   * introducir el sistema en el mercado o ponerlo en servicio.
   */
  exigeMotivacionArt63: boolean;
};

/** Faltan respuestas por dar. */
export function clasificacionCompleta(r: RespuestasClasificacion): boolean {
  return PREGUNTAS_CLASIFICACION.every((p) => typeof r[p.id] === "boolean");
}

/**
 * Propone el nivel. Es una propuesta, no un dictamen: la pantalla deja cambiarlo
 * y exige la motivación con fecha y autor.
 */
export function proponerNivel(r: RespuestasClasificacion): PropuestaClasificacion {
  if (r.practica_prohibida) {
    return {
      nivel: "Inaceptable",
      motivoAutomatico: "Incurre en una práctica prohibida del art. 5.",
      exigeMotivacionArt63: false,
    };
  }
  if (r.anexo_iii) {
    return {
      nivel: "Alto",
      motivoAutomatico: "Caso del anexo III o componente de seguridad del anexo I (art. 6).",
      exigeMotivacionArt63: false,
    };
  }
  if (r.transparencia) {
    return {
      nivel: "Limitado",
      motivoAutomatico: "Obligaciones de transparencia del art. 50; no es de alto riesgo.",
      exigeMotivacionArt63: false,
    };
  }
  return {
    nivel: "Mínimo",
    motivoAutomatico: "Ni práctica prohibida, ni anexo III, ni supuesto del art. 50.",
    exigeMotivacionArt63: false,
  };
}

/**
 * ¿Esta clasificación necesita la documentación del art. 6.3?
 *
 * Se comprueba contra el nivel FINALMENTE elegido, no contra el propuesto: la
 * exigencia nace de apartarse a la baja del anexo III, y eso sólo se sabe
 * cuando se sabe qué se ha decidido.
 */
export function exigeMotivacionArt63(
  r: RespuestasClasificacion,
  nivelElegido: NivelRiesgo | "",
): boolean {
  return Boolean(r.anexo_iii) && nivelElegido !== "" && nivelElegido !== "Alto" && nivelElegido !== "Inaceptable";
}

/** El art. 25.1 convierte en proveedor a quien responde que sí a cualquiera. */
export function rolQueImponeElArt25(respuestas: Record<string, boolean | undefined>): boolean {
  return PREGUNTAS_ROL.some((p) => respuestas[p.id] === true);
}

export type PerfilRegulatorio = {
  rol: RolRegulatorio;
  preguntasRol: Record<string, boolean | undefined>;
  clasificacion: {
    respuestas: RespuestasClasificacion;
    nivelPropuesto: NivelRiesgo;
    nivelElegido: NivelRiesgo;
    motivacion: string;
    /** ISO date. Quién y cuándo, que es lo que convierte una casilla en decisión. */
    decidido_en: string;
    decidido_por: string;
  };
};
