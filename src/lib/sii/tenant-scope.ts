// src/lib/sii/tenant-scope.ts
// Scoping por tenant del módulo SII (canal interno de información).
//
// POR QUÉ EXISTE: las queryKeys del canal eran constantes sin tenant, así que
// un usuario de Garrigues abría /sii y veía las tres denuncias de ARGA bajo una
// cabecera que decía "SII · Garrigues". Es el dato más sensible del producto.
// RLS filtra la CONSULTA, pero no la CACHÉ: sin el tenant en la clave, el
// segundo en entrar ve lo que trajo el primero.
//
// `siiStorageKey` vivía aquí y se retiró el 2026-09-07: el almacén dejó de ser
// `localStorage` y pasó a `sii.reports` en Cloud (`src/lib/sii/store.ts`), donde
// el aislamiento lo dan la columna `tenant_id` y su política RLS. Dejar la
// función habría sido dejar un segundo almacén a un import de distancia.
//
// Módulo hoja: no importa nada del proyecto.

/** Clave de React Query por tenant. El tenant va SIEMPRE en segunda posición. */
export function siiQueryKey(tenantId: string | null | undefined, ...parts: unknown[]): unknown[] {
  return ["whistleblowing", tenantId ?? "__sin_tenant__", ...parts];
}
