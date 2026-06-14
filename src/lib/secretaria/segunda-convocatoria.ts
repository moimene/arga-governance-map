/**
 * ITEM-034 — art. 177.2 LSC: entre la primera y la segunda convocatoria de una
 * junta general debe mediar, por lo menos, un plazo de 24 horas. La segunda
 * convocatoria solo procede en junta de SA/SAU (art. 177.1, decidido en el caller).
 *
 * Lógica pura para poder testear el cómputo y BLOQUEAR la emisión (no solo
 * advertir): un gap < 24h es incumplimiento de un mínimo legal imperativo.
 */
export function gapSegundaConvocatoriaHoras(
  fecha1: string,
  hora1: string,
  fecha2: string,
  hora2: string,
): number | null {
  if (!fecha1 || !fecha2) return null;
  const first = new Date(`${fecha1}T${hora1 || "00:00"}:00`);
  const second = new Date(`${fecha2}T${hora2 || "00:00"}:00`);
  if (Number.isNaN(first.getTime()) || Number.isNaN(second.getTime())) return null;
  return (second.getTime() - first.getTime()) / 3_600_000;
}

export function segundaConvocatoriaGapIncumplido(
  fecha1: string,
  hora1: string,
  fecha2: string,
  hora2: string,
): boolean {
  const gap = gapSegundaConvocatoriaHoras(fecha1, hora1, fecha2, hora2);
  return gap !== null && gap < 24;
}
