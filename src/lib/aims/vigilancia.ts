/**
 * Vigilancia poscomercialización (art. 72 RIA): cómo se lee un indicador.
 *
 * `aims_monitoring_indicators.status` tiene DEFAULT 'OK' y el alta lo deja así,
 * sin valor medido y sin umbral: ese «OK» no es un resultado, es el valor por
 * defecto de una columna. Sin medición el indicador está «sin medición», diga
 * lo que diga `status`. Con valor, se lee el estado como hasta ahora.
 *
 * Hoja: sólo importa del vocabulario, para que la pestaña y cualquier monitor
 * futuro compartan el criterio sin ciclos de importación.
 */
import { normalizeAimsStatus } from "./vocabulario";

export const SIN_MEDICION = "SIN_MEDICION";

/** ¿Hay un valor medido? Un cero es una medición; `{}` o `{ value: null }`, no. */
export function tieneMedicion(valor: unknown): boolean {
  if (valor == null) return false;
  if (typeof valor === "string") return valor.trim() !== "";
  if (typeof valor === "object") {
    const o = valor as Record<string, unknown>;
    if ("value" in o) return o.value != null;
    return Object.keys(o).length > 0;
  }
  return true;
}

export function estadoIndicador(ind: { status?: string | null; current_value?: unknown }): {
  clave: string;
  etiqueta: string;
} {
  if (!tieneMedicion(ind.current_value)) return { clave: SIN_MEDICION, etiqueta: "Sin medición" };
  return { clave: normalizeAimsStatus(ind.status), etiqueta: ind.status || "Sin estado" };
}
