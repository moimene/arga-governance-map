// src/lib/sii/store.ts
//
// Almacén de expedientes del canal interno. UNO SOLO, y en Cloud.
//
// POR QUÉ CAMBIÓ. Hasta 2026-09-07 el canal vivía entero en `localStorage`
// (clave `sii_whistleblowing_cases_v2:<tenant>`), por decisión de producto
// del cierre de 2026-09-05. La orden vigente del usuario la deroga: el dato
// simulado de los tenants tiene que PERSISTIR.
//
// UNIFORME PARA LOS DOS TENANTS, a propósito. No hay rama por tenant: ARGA
// persiste igual que Garrigues. Dos caminos de verdad en la misma pantalla es
// exactamente el defecto que se viene arrastrando en este módulo — la marca
// «Simulado» dejó de llegar porque una arista se rompía por caché, no por
// criterio— y no se reintroduce como "compatibilidad".
//
// LO QUE ESTE ALMACÉN NO ES: no hay cifrado, ni sello, ni custodia por un
// tercero cualificado, ni eficacia jurídica. Es una tabla con aislamiento por
// tenant, y eso es lo que dicen las pantallas.
//
// ponytail: el expediente se guarda como documento JSONB entero porque cada
// mutación del hook lo lee y lo reescribe completo. Sin consultas por campo ni
// paginación: si algún día hay que buscar por categoría o listar miles, se
// normaliza.
import { supabase } from "@/integrations/supabase/client";
import type { WhistleblowingReport } from "./whistleblowing-engine";

/** Vista de `public` sobre `sii.reports` (`security_invoker`). El esquema `sii`
 *  no está expuesto en la API; es el mismo patrón que `sii_cases_view`. */
const TABLA = "sii_reports";

export type OrigenExpediente = "CATALOGO" | "ALTA";

export interface FilaExpediente {
  code: string;
  origen: OrigenExpediente;
  orden: number;
  report: WhistleblowingReport;
}

/** El cliente tipado no conoce la vista nueva hasta que se regeneren los tipos
 *  de Supabase. Se aísla el cast en un solo sitio en vez de repetirlo. */
function tabla() {
  return (supabase as unknown as {
    from: (t: string) => ReturnType<typeof supabase.from>;
  }).from(TABLA) as unknown as {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        order: (col: string, opts: { ascending: boolean }) => Promise<{
          data: FilaExpediente[] | null;
          error: { message: string } | null;
        }>;
      };
    };
    upsert: (
      rows: Array<Record<string, unknown>>,
      opts: { onConflict: string; ignoreDuplicates?: boolean },
    ) => Promise<{ error: { message: string } | null }>;
  };
}

/** Lee los expedientes del tenant, en el orden en que la pantalla los espera. */
export async function selectReports(tenantId: string): Promise<FilaExpediente[]> {
  const { data, error } = await tabla()
    .select("code, origen, orden, report")
    .eq("tenant_id", tenantId)
    .order("orden", { ascending: true });
  if (error) throw new Error(`No se han podido leer los expedientes del canal: ${error.message}`);
  return data ?? [];
}

/**
 * Escribe (o reescribe) expedientes por `(tenant_id, code)`.
 *
 * `ignoreDuplicates` sirve a la siembra: dos pestañas abriendo el módulo a la
 * vez intentarían sembrar el catálogo dos veces, y la segunda tiene que ser
 * inocua, no un error en pantalla. Para una mutación real se pasa `false`, que
 * es lo que hace que la escritura efectivamente sustituya.
 */
export async function upsertReports(
  tenantId: string,
  filas: FilaExpediente[],
  opciones: { ignorarDuplicados?: boolean } = {},
): Promise<void> {
  if (filas.length === 0) return;
  const { error } = await tabla().upsert(
    filas.map((f) => ({
      tenant_id: tenantId,
      code: f.code,
      origen: f.origen,
      orden: f.orden,
      report: f.report,
    })),
    { onConflict: "tenant_id,code", ignoreDuplicates: opciones.ignorarDuplicados ?? false },
  );
  if (error) throw new Error(`No se ha podido guardar el expediente: ${error.message}`);
}
