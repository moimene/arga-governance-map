// Qué clave de módulo gatea una ruta GRC.
//
// POR QUÉ EXISTE. El guard de ruta `RequireGrcModule` resuelve `/grc/m/:moduleId`
// evaluando `isModuleEnabled(branding, moduleId)` — cualquier moduleId, no una
// lista. El filtro del dashboard enumeraba a mano `/grc/m/dora` y `/grc/packs`,
// así que ofrecía a Garrigues tarjetas a `/grc/m/gdpr`, `/grc/m/cyber` y
// `/grc/m/audit` que el guard redirige a `/` sin mensaje: enlaces muertos.
//
// El criterio pasa a ser uno solo y vive aquí, no repetido en el consumidor.
// Devuelve `null` para las rutas que no gatea nadie.
//
// Fuera de alcance a propósito: `/grc/tprm` y `/grc/solvencia-ii`. No son
// enlaces muertos — cada pantalla se autogatea y sirve un panel explícito de
// «no habilitado para este grupo», que es una superficie deliberada.
export function grcRouteModuleKey(route: string): string | null {
  const anidado = /^\/grc\/m\/([^/?#]+)/.exec(route);
  if (anidado) return anidado[1];
  if (route.startsWith("/grc/packs")) return "country-packs";
  return null;
}
