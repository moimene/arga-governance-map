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
 * Módulo hoja: no importa nada, para que lo puedan usar los hooks y el read
 * model sin ciclos.
 */

type ChequeoConHistoria = {
  system_id?: string | null;
  requirement_code?: string | null;
  created_at?: string | null;
  checked_at?: string | null;
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
    if (!previo || marca(c) >= marca(previo)) porRequisito.set(clave, c);
  });
  return [...porRequisito.values()];
}
