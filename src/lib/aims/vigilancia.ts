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

/** Un valor leíble: número finito o cadena no vacía. */
function esValor(v: unknown): boolean {
  if (typeof v === "number") return Number.isFinite(v);
  return typeof v === "string" && v.trim() !== "";
}

/**
 * ¿Hay un valor medido? Falla CERRADO: cuenta el valor suelto o el `value` de
 * un objeto, y solo si es un número finito (el cero incluido) o una cadena no
 * vacía. Cualquier otra forma —`{}`, `{ unit: "%" }`, `{ value: {} }`, un
 * array, un booleano— es «sin medición»: un valor que no se sabe leer no es una
 * medición, y el DEFAULT 'OK' de `status` no puede pintarse sobre él.
 */
export function tieneMedicion(valor: unknown): boolean {
  if (esValor(valor)) return true;
  if (valor == null || typeof valor !== "object" || Array.isArray(valor)) return false;
  return esValor((valor as Record<string, unknown>).value);
}

export function estadoIndicador(ind: { status?: string | null; current_value?: unknown }): {
  clave: string;
  etiqueta: string;
} {
  if (!tieneMedicion(ind.current_value)) return { clave: SIN_MEDICION, etiqueta: "Sin medición" };
  return { clave: normalizeAimsStatus(ind.status), etiqueta: ind.status || "Sin estado" };
}
