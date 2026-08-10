export interface OperationalBodyLike {
  slug?: string | null;
  name?: string | null;
  config?: Record<string, unknown> | null;
}

export function isOperationalSecretariaBody(body: OperationalBodyLike) {
  const slug = String(body.slug ?? "");
  const name = String(body.name ?? "");
  const config = body.config ?? {};

  if (slug.startsWith("e2e-real-")) return false;
  if (name.includes("[E2E REAL]")) return false;
  if (config.e2e_real_run_id) return false;
  if (config.reference_only) return false;
  if (config.hidden_from_secretaria_operational_flows) return false;
  // ITEM-100: excluir también los órganos sintéticos de los specs destructivos
  // de fases (B1/B6) que pueden quedar como residuo en Cloud.
  if (config.e2e_phase_b_run) return false;
  if (slug.startsWith("phase-b")) return false;

  return true;
}

/**
 * G3 Task 7 — selectores de ADOPCIÓN (Convocatorias, Reuniones, Tramitador,
 * AcuerdoSinSesion): un órgano consultivo informa, no acuerda
 * (`config.naturaleza='CONSULTIVO'`, G2/G3) — nunca puede ser el órgano que
 * adopta un acuerdo. Distinto de `isOperationalSecretariaBody`: ese filtro
 * también alimenta listados donde los consultivos SÍ deben seguir
 * apareciendo (p.ej. /organos, fichas de entidad) — no tocarlo. ARGA no
 * tiene `config.naturaleza` en ningún órgano → cero cambio.
 */
export function isAdoptingBody(body: OperationalBodyLike) {
  if (!isOperationalSecretariaBody(body)) return false;
  const config = body.config ?? {};
  return (config as { naturaleza?: string }).naturaleza !== "CONSULTIVO";
}
