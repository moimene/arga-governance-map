import type { Page } from "@playwright/test";

/**
 * Guard de red para verificaciones de SOLO LECTURA (verif-a, 2026-09-27).
 *
 * Registra cualquier POST/PATCH/PUT/DELETE contra `/rest/v1/` (PostgREST,
 * incluye RPC — PostgREST siempre usa POST para RPC, sea o no de solo
 * lectura, así que esto puede sobre-marcar RPCs de lectura empaquetadas como
 * función; se revisa caso a caso) o `/functions/v1/` (Edge Functions) del
 * proyecto Supabase. Se excluye `/auth/v1/` porque el propio login usa POST y
 * no es una escritura de dominio.
 *
 * `block: true` (usar en ARGA y Garrigues, donde la regla es solo lectura
 * estricta) además ABORTA la petición antes de que llegue a Cloud, en vez de
 * solo detectarla después — un efecto colateral del propio parpadeo de una
 * pantalla (p.ej. un escaneo en segundo plano que inserta notificaciones) no
 * debe escribir en Cloud solo por haber navegado a verla.
 */
export async function watchReadOnly(page: Page, opts: { block?: boolean } = {}): Promise<string[]> {
  const violations: string[] = [];
  const mutating = new Set(["POST", "PATCH", "PUT", "DELETE"]);
  const isDomainWrite = (method: string, url: string) =>
    mutating.has(method) &&
    !url.includes("/auth/v1/") &&
    (url.includes("/rest/v1/") || url.includes("/functions/v1/") || url.includes("/storage/v1/object"));

  if (opts.block) {
    // `await` aquí es importante: la ruta debe quedar registrada ANTES de
    // que el test navegue, o las primeras peticiones (incluida la del
    // propio login) no pasarían por el filtro.
    await page.route("**/*", async (route) => {
      const req = route.request();
      if (isDomainWrite(req.method(), req.url())) {
        violations.push(`${req.method()} ${req.url()} (bloqueada, no llegó a Cloud)`);
        await route.abort("blockedbyclient");
        return;
      }
      await route.continue();
    });
  } else {
    page.on("request", (req) => {
      if (isDomainWrite(req.method(), req.url())) violations.push(`${req.method()} ${req.url()}`);
    });
  }
  return violations;
}
