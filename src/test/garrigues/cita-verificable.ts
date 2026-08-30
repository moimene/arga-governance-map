// src/test/garrigues/cita-verificable.ts
//
// Comprueba que una cita a un documento normativo interno apunta a un apartado
// que EXISTE en el índice congelado de ese documento.
//
// Por qué hace falta: el guard anterior era `/§|commit|art\./`, o sea un regex
// de FORMA. Cualquier cadena con pinta de cita lo satisfacía —«§246», «art. 99»,
// un hash inventado— así que el mecanismo que presentaba como su logro
// («un motivo sin nada detrás no se admite») era la forma nº2: imposible de
// fallar. Lo cazó la lente adversarial, y tenía razón.
//
// Y lo que destapó al comprobarlo de verdad: `PPD-01 §246` y `§350-356` NO
// existen. El índice canónico de ese documento va de «1. Introducción» a
// «10. Control de versiones», con subapartados decimales. Los números de tres
// cifras son **posiciones de párrafo del volcado de texto**, escritas con el
// signo de apartado. Un `§246` se lee como «apartado 246» y ahí no hay
// ninguno: el Plan de acción es el **§4.2** y la supervisión el **§8**.
//
// La diferencia importa porque una cita es una promesa de que alguien puede ir
// a mirarlo. Con el número de párrafo de un volcado que ya no existe, no puede.
import { NORMATIVO_CATALOG } from "../../../scripts/garrigues/normativo/catalogo-normativo";

/** `PPD-01 §4.2` → `{ codigo: "PPD-01", apartado: "4.2" }`. */
export function partirCita(cita: string): { codigo: string; apartado: string } | null {
  const m = cita.match(/\b([A-Z]{2,3}-[A-Z]{0,3}-?\d{1,2})\b[^§]*§\s*([\d.]+)/);
  return m ? { codigo: m[1], apartado: m[2] } : null;
}

/**
 * ¿Existe ese apartado en el índice del documento?
 *
 * Acepta el apartado exacto (`4.2`) y también el de nivel superior (`8` cuando
 * el índice lista `8.1`), porque citar la sección entera es legítimo.
 */
export function apartadoExiste(codigo: string, apartado: string): boolean {
  const doc = NORMATIVO_CATALOG.find((d) => d.policy_code === codigo);
  if (!doc?.content_outline?.length) return false;
  return doc.content_outline.some((linea) => {
    const m = String(linea).match(/^\s*(\d+(?:\.\d+)*)/);
    if (!m) return false;
    return m[1] === apartado || m[1].startsWith(`${apartado}.`);
  });
}

/**
 * Resultado legible para el test. `null` cuando la cita no apunta a un
 * documento interno con índice — ahí este comprobador no opina, y quien lo use
 * debe exigir otra forma de respaldo.
 */
export function verificarCita(cita: string): { codigo: string; apartado: string; existe: boolean } | null {
  const p = partirCita(cita);
  if (!p) return null;
  const doc = NORMATIVO_CATALOG.find((d) => d.policy_code === p.codigo);
  if (!doc?.content_outline?.length) return null;
  return { ...p, existe: apartadoExiste(p.codigo, p.apartado) };
}
