// src/test/sii/_almacen-memoria.ts
//
// Doble en memoria de la tabla `public.sii_reports`.
//
// POR QUÉ. Desde 2026-09-07 el canal persiste en Cloud, y el código de
// producción tiene UN SOLO camino: Supabase. No hay respaldo a `localStorage`,
// porque un respaldo es lo que convierte un gate en verde sin asertar nada.
// Los tests no pueden salir a la red, así que se sustituye el cliente —el
// patrón que ya usa `planes-accion-cache.test.tsx`— por este doble, que
// implementa lo poquísimo de PostgREST que `src/lib/sii/store.ts` consume.
//
// LO QUE ESTE DOBLE **NO** SUSTITUYE, Y HAY QUE DECIRLO: no evalúa RLS. El
// aislamiento por tenant que aquí se comprueba es el que aplica el CÓDIGO
// (`.eq("tenant_id", …)` y la semilla por tenant). Que la BASE DE DATOS también
// lo aísle lo fija la migración `20260907150000` y su bloque de verificación,
// no este fichero.
import { mockRestaurable } from "../garrigues/_mock-restaurable";

interface Fila {
  tenant_id: string;
  code: string;
  origen: string;
  orden: number;
  report: unknown;
}

/** Estado compartido. `reiniciar()` en `beforeEach` deja la tabla vacía. */
const filas = new Map<string, Fila>();

const clave = (tenantId: string, code: string) => `${tenantId}|${code}`;

export function reiniciarAlmacen(): void {
  filas.clear();
}

/** Siembra directa, para montar el ESTADO DE PARTIDA de un test. */
export function sembrarFilas(nuevas: Fila[]): void {
  for (const f of nuevas) filas.set(clave(f.tenant_id, f.code), { ...f });
}

/** Lo que la tabla contiene, para asertar sobre lo ESCRITO y no solo lo leído. */
export function filasDe(tenantId: string): Fila[] {
  return [...filas.values()]
    .filter((f) => f.tenant_id === tenantId)
    .sort((a, b) => a.orden - b.orden);
}

function construirCliente() {
  return {
    from(tabla: string) {
      if (tabla !== "sii_reports") {
        throw new Error(`El doble del SII solo conoce 'sii_reports', no '${tabla}'`);
      }
      return {
        select() {
          return {
            eq(columna: string, valor: string) {
              if (columna !== "tenant_id") {
                throw new Error(`El doble filtra por tenant_id, no por '${columna}'`);
              }
              return {
                order(col: string, opts: { ascending: boolean }) {
                  const datos = filasDe(valor).map((f) => ({
                    code: f.code,
                    origen: f.origen,
                    orden: f.orden,
                    report: f.report,
                  }));
                  if (col !== "orden" || !opts.ascending) datos.reverse();
                  return Promise.resolve({ data: datos, error: null });
                },
              };
            },
          };
        },
        upsert(nuevas: Fila[], opts: { onConflict: string; ignoreDuplicates?: boolean }) {
          if (opts.onConflict !== "tenant_id,code") {
            throw new Error(`onConflict inesperado: ${opts.onConflict}`);
          }
          for (const f of nuevas) {
            const k = clave(f.tenant_id, f.code);
            if (opts.ignoreDuplicates && filas.has(k)) continue;
            filas.set(k, { ...f });
          }
          return Promise.resolve({ error: null });
        },
      };
    },
  };
}

/**
 * Sustituye el cliente de Supabase por el doble y devuelve el restaurador.
 *
 * Va por `mockRestaurable` y NO por `mock.module` directo: los mocks de bun son
 * globales a la corrida entera, así que un doble sin restaurar sigue vivo en
 * ficheros que no lo conocen. Este stub concreto ya tumbó 11 tests de
 * motor-plantillas en su día. Llamar al restaurador en `afterAll`.
 */
export async function mockearAlmacenSii(): Promise<() => void> {
  const cliente = construirCliente();
  const restaurar = await mockRestaurable(
    "@/integrations/supabase/client",
    () => ({ supabase: cliente }),
  );
  return () => {
    filas.clear();
    restaurar();
  };
}
