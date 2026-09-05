// scripts/garrigues/penal/descripcion-articulo.ts
//
// Cómo se redacta la `description` de un riesgo penal a partir del `articulo`
// que trae el catálogo del mapa.
//
// Vive aparte porque `mapa-penal.ts` es GENERADO (lo reescribe
// `generar-catalogo.ts`) y `seed-garrigues-penal.ts` abre un cliente Supabase
// en el nivel superior y se sale si no hay service-role, así que ninguno de los
// dos puede alojar una función que un test tenga que importar.

/**
 * La plantilla anterior, en el seed, era `Artículos del Código Penal:
 * ${articulo}` para TODAS las filas. Una del catálogo no trae número de
 * artículo sino el nombre de otra norma —«Ley de represión del contrabando»— y
 * salía como «Artículos del Código Penal: Ley de represión del contrabando».
 * El contrabando se tipifica en la Ley Orgánica 12/1995, no en el Código Penal,
 * y además es el ÚNICO riesgo en banda roja del mapa: la cita equivocada iba
 * justo en la fila más visible.
 *
 * Solo se atribuye al CP lo que viene como articulado.
 */
export function descripcionArticulo(articulo: string | null | undefined): string | null {
  const valor = (articulo ?? "").trim();
  if (!valor) return null;
  // Articulado del CP: empieza por dígito («305 y siguientes», «286 quater»,
  // «159 a 161»). Cualquier otra cosa es el nombre de otra norma y se sirve
  // tal cual, sin atribuirla al Código Penal.
  return /^\d/.test(valor) ? `Artículos del Código Penal: ${valor}` : valor;
}
