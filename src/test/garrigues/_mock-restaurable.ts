// src/test/garrigues/_mock-restaurable.ts
//
// `mock.module` de bun es GLOBAL a la corrida entera, no al fichero. Un mock
// declarado aquí sigue vivo en todos los ficheros que se carguen después, y el
// daño no se ve en el fichero que lo declara: se ve en otro, que empieza a
// fallar por razones que no tienen nada que ver consigo mismo.
//
// Pasó de verdad. Mockear `@/integrations/supabase/client` para una sonda de
// caché tumbó 11 tests de `motor-plantillas/composer-smoke`, que pasa 13/13 en
// aislado. Los dos ficheros no se conocen.
//
// Este helper captura el módulo REAL antes de sustituirlo y devuelve la
// función que lo repone. Se llama en `afterAll`.
import { mock } from "bun:test";

/**
 * Sustituye un módulo y devuelve el restaurador.
 *
 * ```ts
 * const restaurar = await mockRestaurable("@/hooks/useRisks", () => ({ … }));
 * afterAll(restaurar);
 * ```
 */
export async function mockRestaurable(
  ruta: string,
  stub: () => Record<string, unknown>,
): Promise<() => void> {
  // El orden importa: hay que importar ANTES de mockear. Después, el import
  // devuelve el propio mock y la restauración repondría el stub sobre sí mismo.
  const real = (await import(ruta)) as Record<string, unknown>;
  const copia = { ...real };
  mock.module(ruta, stub);
  return () => mock.module(ruta, () => copia);
}

/** Varios de golpe, restaurados en orden inverso. */
export async function mockearModulos(
  entradas: Array<[string, () => Record<string, unknown>]>,
): Promise<() => void> {
  const restauradores: Array<() => void> = [];
  for (const [ruta, stub] of entradas) {
    restauradores.push(await mockRestaurable(ruta, stub));
  }
  return () => {
    for (const r of restauradores.reverse()) r();
  };
}
