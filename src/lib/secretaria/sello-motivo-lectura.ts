/**
 * Lectura jurídica de los motivos de «evaluación no sellada en servidor».
 *
 * El motivo vive dentro del `explain` de `rule_evaluation_results`, que es WORM
 * y cuyo contenido entra en el `evaluation_hash`: es INMUTABLE y está escrito
 * para quien audita, con el nombre exacto de la función que lo produce. En la
 * ficha lo lee un abogado, y ahí ese nombre es jerga.
 *
 * El registro y su presentación son artefactos distintos —como un asiento y su
 * nota simple—, así que la ficha enseña LAS DOS COSAS: la lectura jurídica y,
 * desplegable y rotulado como tal, el literal del registro. Traducir no es
 * falsificar mientras el literal siga alcanzable, la traducción no cambie el
 * sentido y se vea que es una traducción.
 *
 * ACOPLAMIENTO — la parte que hace esto seguro:
 * la clave del mapa es EL PROPIO TEXTO FUENTE. Si alguien re-acuña esos WORM
 * con otra redacción, la búsqueda falla y pasan dos cosas a la vez:
 *   - la ficha cae al literal (fail-safe: nunca oculta, como mucho no traduce);
 *   - el test `sello-motivo-lectura.test.ts` CAE, porque comprueba que todo
 *     motivo vivo en Cloud tiene lectura.
 * Sin ese acoplamiento la traducción se desacoplaría de su original EN
 * SILENCIO, y la pantalla seguiría enseñando la lectura vieja para siempre.
 */

const FUENTE_JUNTA_POR_PARTICIPACIONES =
  "La vía sellada en servidor (fn_secretaria_server_resolution_evaluation) no admite este órgano: evalúa CDA, COMISION y COMITE, exige un censo POLITICO WORM y que cada asiento pese exactamente 1. Esta Junta son 346 socios ponderados por títulos × votos por título sobre un censo ECONOMICO, y no cabe ahí ni añadiendo JUNTA a la lista. La evaluación la ejecutó el motor de reglas TS en el cliente.";

const LECTURAS: Record<string, string> = {
  [FUENTE_JUNTA_POR_PARTICIPACIONES]:
    "La vía de evaluación sellada en servidor está construida sobre órganos de administración: " +
    "supone un censo de asientos, un voto por asiento y una lista cerrada de órganos que no incluye la Junta. " +
    "Esta Junta de Socios son 346 socios cuyo voto se pondera por sus participaciones, " +
    "de modo que su mayoría queda fuera de esa vía por definición y no por un defecto de configuración. " +
    "La calculó el motor de reglas en el navegador.",
};

export type SelloMotivoLectura = {
  /** Lectura jurídica, o `null` si este motivo no tiene traducción registrada. */
  lectura: string | null;
  /** Literal del registro WORM, siempre presente y siempre alcanzable. */
  literal: string;
};

export function lecturaDeSelloMotivo(motivo: string): SelloMotivoLectura {
  const limpio = motivo.trim();
  return { lectura: LECTURAS[limpio] ?? null, literal: limpio };
}

/** Los textos fuente con lectura registrada. Lo usa el test de acoplamiento. */
export function motivosConLectura(): string[] {
  return Object.keys(LECTURAS);
}
