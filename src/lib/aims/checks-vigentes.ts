/**
 * De todo el histórico de `ai_compliance_checks`, el estado VIGENTE de cada
 * requisito.
 *
 * Cada autodiagnóstico INSERTA una fila por requisito, así que reevaluar un
 * sistema deja tantas filas como veces se haya evaluado. Medido en Cloud el
 * 2026-09-07: «Motor de triaje de siniestros auto» tiene **28 filas para 7
 * códigos** — cuatro evaluaciones, 21 filas repetidas. La consola las contaba
 * como 28 controles independientes.
 *
 * El histórico NO se borra: es dato legítimo, cada fila la produjo una
 * evaluación real y sirve para ver la evolución. Lo que se corrige es la
 * LECTURA: de cada requisito manda la comprobación más reciente.
 *
 * Módulo hoja: solo importa otra hoja (`vocabulario`), para que lo puedan usar
 * los hooks y el read model sin ciclos.
 */

import { normalizeAimsStatus } from "./vocabulario";

type ChequeoConHistoria = {
  system_id?: string | null;
  status?: string | null;
  requirement_code?: string | null;
  created_at?: string | null;
  checked_at?: string | null;
  /**
   * La evaluación de la que sale, embebida por su FK (M01, 2026-09-19). `null`
   * o ausente en las comprobaciones legacy, que no la tienen.
   */
  evaluacion?: { status?: string | null; reviewed_at?: string | null } | null;
};

/**
 * `created_at` es la marca de escritura y es la que ordena. `checked_at` es una
 * fecha declarada por quien evalúa (día, sin hora) y dos evaluaciones del mismo
 * día empatarían.
 */
function marca(c: ChequeoConHistoria): number {
  const t = Date.parse(c.created_at ?? "");
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Solo pesa una comprobación enlazada a una evaluación CERRADA (`status`
 * distinto de `BORRADOR`). Un borrador y una legacy (sin evaluación) no
 * acreditan: empatan entre ellos y decide la fecha, como antes de M01. Así, un
 * `PENDIENTE` de un autodiagnóstico cerrado sin contestar no tapa lo ya
 * cerrado, y una fila de seed tampoco tapa a un borrador posterior. Si lo único
 * que hay es un borrador o una legacy, se conserva: no se pierde dato.
 *
 * `reviewed_at` no se lee aquí: el criterio es «cerrada», no «revisada». Viaja
 * en el embebido para F1.T4 (`legado.ts`).
 */
function peso(c: ChequeoConHistoria): number {
  return c.evaluacion && c.evaluacion.status !== "BORRADOR" ? 1 : 0;
}

/**
 * Entre las que no acreditan (legado y borrador), una no conformidad declarada
 * solo la desplaza otra no conformidad: una conformidad o un pendiente
 * posteriores no prueban que la brecha se cerrara. Decisión del controlador al
 * integrar F1 (19-09-2026), sobre el caso FraudGuard de ARGA.
 */
function esNoConforme(c: ChequeoConHistoria): boolean {
  return normalizeAimsStatus(c.status) === "NO_CONFORME";
}

export function checksVigentes<T extends ChequeoConHistoria>(rows: T[] | null | undefined): T[] {
  const porRequisito = new Map<string, T>();
  (rows ?? []).forEach((c) => {
    // Sin sistema o sin código no hay a qué atribuir la comprobación. Se
    // conserva tal cual —no se descarta dato— pero con clave propia, para que
    // dos filas huérfanas no se pisen entre ellas.
    const clave =
      c.system_id && c.requirement_code
        ? `${c.system_id}::${c.requirement_code}`
        : `__huerfano__::${porRequisito.size}`;
    const previo = porRequisito.get(clave);
    // `>=` y no `>`: con marcas iguales gana la última del array, que llega en
    // orden ascendente de escritura desde PostgREST.
    const gana =
      !previo ||
      peso(c) > peso(previo) ||
      (peso(c) === peso(previo) &&
        marca(c) >= marca(previo) &&
        !(peso(c) === 0 && esNoConforme(previo) && !esNoConforme(c)));
    if (gana) porRequisito.set(clave, c);
  });
  return [...porRequisito.values()];
}

type EvaluacionConHistoria = {
  system_id?: string | null;
  framework?: string | null;
  status?: string | null;
  created_at?: string | null;
};

/**
 * La misma regla para las evaluaciones: de cada sistema y marco manda la más
 * reciente que no es borrador. Medido en ARGA el 2026-09-19: el «Motor de
 * triaje» tiene cuatro evaluaciones iguales y el dominio «Controles» sumaba
 * los hallazgos de las cuatro y de un borrador (35/38 en vez de 8/11).
 *
 * El borrador no manda: es trabajo sin terminar, no una evaluación.
 */
export function evaluacionesVigentes<T extends EvaluacionConHistoria>(rows: T[] | null | undefined): T[] {
  const porClave = new Map<string, T>();
  (rows ?? []).forEach((a, i) => {
    if ((a.status ?? "").trim().toUpperCase() === "BORRADOR") return;
    const clave = a.system_id ? `${a.system_id}::${a.framework ?? ""}` : `__huerfana__::${i}`;
    const previa = porClave.get(clave);
    if (!previa || marca(a) > marca(previa)) porClave.set(clave, a);
  });
  return [...porClave.values()];
}
