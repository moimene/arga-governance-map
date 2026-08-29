// src/lib/sii/tenant-scope.ts
// Scoping por tenant del módulo SII (canal interno de información).
//
// POR QUÉ EXISTE: el almacén del canal vivía en una única clave literal
// —"arga_sii_whistleblowing_cases_v1"— compartida por todos los tenants, y las
// queryKeys eran constantes sin tenant. Un usuario de Garrigues abría /sii y
// veía las tres denuncias de ARGA bajo una cabecera que decía "SII · Garrigues".
// Es el dato más sensible del producto.
//
// El patrón NO es nuevo en este repo: SociedadNuevaStepper.tsx ya construye su
// clave de borrador como `${PREFIJO}:${tenantId}`. Esto aplica al SII lo que
// Secretaría ya hacía bien, en vez de inventar un segundo sabor que mantener.
//
// Módulo hoja: no importa nada del proyecto.

/**
 * Clave de almacén por tenant. Exige el tenant y no acepta un defecto: una
 * firma que permita `siiStorageKey()` reintroduce el bucket compartido en
 * cuanto alguien la llame sin argumento desde un camino nuevo.
 */
export function siiStorageKey(tenantId: string): string {
  if (!tenantId) {
    throw new Error("siiStorageKey exige tenantId: sin él el almacén se comparte entre tenants");
  }
  return `sii_whistleblowing_cases_v2:${tenantId}`;
}

/** Clave de React Query por tenant. El tenant va SIEMPRE en segunda posición. */
export function siiQueryKey(tenantId: string | null | undefined, ...parts: unknown[]): unknown[] {
  return ["whistleblowing", tenantId ?? "__sin_tenant__", ...parts];
}
