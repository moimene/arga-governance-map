/**
 * Fecha de un expediente cuya HORA no está acreditada en la fuente.
 *
 * Un `timestamptz` obliga a guardar una hora aunque no conste ninguna. Se
 * guarda 00:00Z para que el DÍA sea correcto, y entonces la pantalla la pinta
 * —«2:00» en horario de Madrid— como si fuera dato del expediente. Una Junta de
 * S.L.P. a las dos de la madrugada es lo primero que ve un abogado.
 *
 * No se puede inferir del propio timestamp: una sesión real puede empezar a las
 * 00:00Z. Hace falta que el expediente lo DECLARE, y por eso esto recibe una
 * bandera y no una heurística.
 *
 * Gateado por el dato: un expediente que no la trae se pinta como siempre, con
 * su hora. ARGA no la lleva en ninguna fila.
 */
export function fechaConHoraSiConsta(
  iso: string | null | undefined,
  horaNoAcreditada: boolean,
  /**
   * Formato del caso NORMAL. Los cuatro puntos de llamada usaban tres formatos
   * distintos, así que imponerles uno solo habría cambiado cómo se ve ARGA —y
   * el contrato es cero cambio—. Cada uno pasa el suyo; sin bandera, el
   * resultado es byte a byte el de antes.
   */
  formatoConHora?: Intl.DateTimeFormatOptions,
): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (horaNoAcreditada) {
    return `${d.toLocaleDateString("es-ES", { dateStyle: "medium" })} · hora no acreditada`;
  }
  return formatoConHora ? d.toLocaleString("es-ES", formatoConHora) : d.toLocaleString("es-ES");
}

/** Lee la bandera de un jsonb de expediente, tolerando null y formas raras. */
export function horaNoAcreditadaEn(fuente: unknown): boolean {
  return (fuente as { hora_no_acreditada?: unknown } | null)?.hora_no_acreditada === true;
}
