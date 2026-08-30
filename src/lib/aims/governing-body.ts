/**
 * Órgano de gobierno de la IA, por tenant.
 *
 * Se resuelve por SLUG y no por UUID: `/organos/:id` resuelve por slug
 * (`useBodyBySlug`), así que el slug es la clave con la que se enlaza.
 *
 * POR QUÉ UN MAPA Y NO UNA CONSTANTE
 * ----------------------------------
 * El Dashboard de AI Governance es superficie compartida: la ven todos los
 * tenants. Meter ahí el slug de un despacho lo pintaría también en la consola
 * de una aseguradora — que es exactamente el defecto que este carril acaba de
 * retirar de la pestaña FRIA. El mapa **falla cerrado**: un tenant que no
 * aparezca no tiene órgano de IA declarado y el panel no se renderiza.
 *
 * Y falla cerrado dos veces, porque la segunda puerta es el dato: aunque el
 * slug estuviera, `useBodyBySlug` filtra por `tenant_id` y devuelve `null` si
 * ese tenant no tiene esa fila. Verificado en Cloud (2026-08-30): el comité
 * existe SOLO para Garrigues; ARGA no tiene ninguna fila con ese slug.
 *
 * `hasOwnProperty` en el lookup, no acceso directo: un `tenantId` capaz de
 * llegar como "constructor" o "__proto__" devolvería una función del prototipo.
 * Mismo guard que `src/lib/login-brands.ts`.
 */
const AI_GOVERNANCE_BODY_BY_TENANT: Record<string, string> = {
  // Garrigues. Comité de Gobernanza de la Inteligencia Artificial.
  "00000000-0000-0000-0000-000000000002": "garrigues-comite-gobernanza-ia",
  // ARGA (…0001) NO aparece a propósito: no tiene órgano de IA declarado, y
  // fabricarle uno sería inventar gobernanza que nadie ha constituido.
};

export function aiGovernanceBodySlug(tenantId: string | null | undefined): string | null {
  if (!tenantId) return null;
  return Object.prototype.hasOwnProperty.call(AI_GOVERNANCE_BODY_BY_TENANT, tenantId)
    ? AI_GOVERNANCE_BODY_BY_TENANT[tenantId]
    : null;
}
