// scripts/garrigues/hallazgos/hallazgos-penales.ts
//
// Dos cosas, y la segunda es una AUSENCIA deliberada.
//
// 1) El código de cada hallazgo se deriva de la celda que lo origina
//    (`codigo` del riesgo + `columna` del área), NO de su posición en el
//    array. El esquema anterior era `FND-GARR-PEN-${i + 1}`: reordenar el
//    catálogo del mapa penal reasignaba los ocho hallazgos en silencio, sin
//    tocar una línea de código y sin que ningún gate lo notara.
//
// 2) NO hay planes de acción sembrados, y no es un olvido. PPD-01 §4.2
//    describe el mecanismo del Plan de acción y **no publica la lista**. La
//    regla del carril es que lo que la fuente no dice no se afirma, así que
//    la pantalla muestra la ausencia con su motivo y su fuente en vez de
//    ocho planes verosímiles que nadie ha escrito. Un estado vacío explicado
//    es contenido; uno relleno es ruido con apariencia de dato.

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
 * Lo que la pantalla dice donde irían los planes de acción. Se sirve como
 * texto y no como dato porque no hay dato: es la razón de que no lo haya.
 */
export const PLAN_ACCION_AUSENCIA = {
  // El catalogo declara a QUE tenant pertenece, y la pantalla lo compara con
  // el suyo. Guard por DATO, no por literal en el componente: el dia que otro
  // tenant tenga su propia procedencia, esto sigue siendo correcto sin tocarlo,
  // y ARGA nunca ve un texto que habla de una fuente que no es suya.
  tenantId: "00000000-0000-0000-0000-000000000002",
  titulo: "Sin planes de acción publicados",
  motivo:
    "El Manual del Sistema de Gestión de Riesgos Penales describe el mecanismo del Plan de " +
    "acción y el seguimiento de su desarrollo, pero no publica los planes concretos ni sus " +
    "responsables o plazos.",
  consecuencia:
    "No se muestran planes porque no consta ninguno en la fuente. Rellenar este espacio con " +
    "planes verosímiles los haría indistinguibles de los reales.",
  // §4.2 «Plan de acción» y §8 «Supervisión y seguimiento del programa», que
  // son los apartados REALES del índice del documento. Antes citaba «§246 y
  // §350-356», que son posiciones de párrafo del volcado, no apartados.
  fuente: "PPD-01, Manual del Sistema de Gestión de Riesgos Penales, §4.2 y §8",
  // Lo que sí consta del mecanismo está sembrado como controles de
  // supervisión, no como planes: son actividades recurrentes con órgano
  // responsable identificado. Ver `penal/seguimiento-ppd.ts`.
  controlesRelacionados: ["CTR-GARR-25", "CTR-GARR-26", "CTR-GARR-27", "CTR-GARR-28"],
} as const;
