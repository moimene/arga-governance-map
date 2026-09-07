// scripts/garrigues/hallazgos/hallazgos-penales.ts
//
// Dos cosas, y la segunda es un hueco TODAVÍA no sembrado (no una prohibición).
//
// 1) El código de cada hallazgo se deriva de la celda que lo origina
//    (`codigo` del riesgo + `columna` del área), NO de su posición en el
//    array. El esquema anterior era `FND-GARR-PEN-${i + 1}`: reordenar el
//    catálogo del mapa penal reasignaba los ocho hallazgos en silencio, sin
//    tocar una línea de código y sin que ningún gate lo notara.
//
// 2) TODAVÍA no hay planes de acción sembrados, y el aviso de abajo lo dice.
//    ORDEN VIGENTE desde el 2026-09-07: el tenant Garrigues SE SIEMBRA de
//    forma progresiva con dato simulado a partir de fuentes reales, y ese
//    dato PERSISTE. La orden anterior —«no se siembra, porque fabricarlo
//    haría el dato demo indistinguible del real»— queda derogada.
//    Lo que sí sigue: PPD-01 §4.2 describe el mecanismo del Plan de acción y
//    **no publica la lista**, así que no hay nada que copiar de la fuente; lo
//    que se siembre será simulado y hay que ETIQUETARLO como tal. Mientras no
//    haya ninguno, la pantalla explica el hueco en vez de dejarlo mudo, y el
//    aviso desaparece solo en cuanto exista el primer plan (`plans.length`).

/** Una celda de banda alta del mapa penal, tal como la sirve `mapa-penal.ts`. */
export type CeldaBandaAlta = {
  readonly codigo: string;
  readonly delito: string;
  readonly columna: string;
  readonly celda: string;
};

/**
 * `RSK-GARR-PEN-010` + `IP` → `FND-GARR-PEN-010-IP`.
 *
 * Se incluye la columna porque un mismo delito puede alcanzar banda alta en
 * más de un área: hoy las ocho celdas tienen código de riesgo único, pero la
 * clave de identidad de la fuente es la celda, no el delito.
 */
export function codigoHallazgo(celda: Pick<CeldaBandaAlta, "codigo" | "columna">): string {
  const numero = celda.codigo.replace(/^RSK-GARR-PEN-/, "");
  const area = celda.columna
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return `FND-GARR-PEN-${numero}-${area}`;
}

/** Prefijo común, para localizar y limpiar el esquema antiguo por posición. */
export const PREFIJO_HALLAZGO_PENAL = "FND-GARR-PEN-";

/** El esquema viejo: `FND-GARR-PEN-01` … `FND-GARR-PEN-08`, sin área. */
export const ES_CODIGO_POR_POSICION = /^FND-GARR-PEN-\d{2}$/;

/**
 * Lo que la pantalla dice MIENTRAS no haya planes. Se sirve como texto y no
 * como dato porque todavía no hay dato; el día que se siembre el primero,
 * `ActionPlans` lista los planes y este bloque deja de renderizarse sin que
 * nadie tenga que tocarlo. No es una prohibición de sembrar: es el estado
 * intermedio, escrito para que no se lea como un cero real.
 */
export const PLAN_ACCION_AUSENCIA = {
  // El catalogo declara a QUE tenant pertenece, y la pantalla lo compara con
  // el suyo. Guard por DATO, no por literal en el componente: el dia que otro
  // tenant tenga su propia procedencia, esto sigue siendo correcto sin tocarlo,
  // y ARGA nunca ve un texto que habla de una fuente que no es suya.
  tenantId: "00000000-0000-0000-0000-000000000002",
  titulo: "Sin planes de acción registrados todavía",
  motivo:
    "El Manual del Sistema de Gestión de Riesgos Penales describe el mecanismo del Plan de " +
    "acción y el seguimiento de su desarrollo, pero no publica los planes concretos ni sus " +
    "responsables o plazos, así que no hay lista que trasladar literalmente de la fuente.",
  consecuencia:
    "Este entorno se está poblando de forma progresiva con datos simulados a partir de fuentes " +
    "reales, y los planes de acción aún no se han incorporado. Hoy no consta ninguno, y por eso " +
    "no se muestra ninguno; los que se incorporen irán identificados como simulados.",
  // §4.2 «Plan de acción» y §8 «Supervisión y seguimiento del programa», que
  // son los apartados REALES del índice del documento. Antes citaba «§246 y
  // §350-356», que son posiciones de párrafo del volcado, no apartados.
  fuente: "PPD-01, Manual del Sistema de Gestión de Riesgos Penales, §4.2 y §8",
  // Lo que sí consta del mecanismo está sembrado como controles de
  // supervisión, no como planes: son actividades recurrentes con órgano
  // responsable identificado. Ver `penal/seguimiento-ppd.ts`.
  controlesRelacionados: ["CTR-GARR-25", "CTR-GARR-26", "CTR-GARR-27", "CTR-GARR-28"],
} as const;
