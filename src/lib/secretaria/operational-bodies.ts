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
