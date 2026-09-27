/**
 * Órgano de gobierno de la IA del tenant — resuelto por DATO, no por una
 * lista fija de tenants dentro del programa (F2.T9, MOI-170; MOI-150).
 *
 * ANTES había un `AI_GOVERNANCE_BODY_BY_TENANT: Record<tenantId, slug>`
 * escrito a mano en este fichero, con una sola entrada (Garrigues). Cada
 * grupo nuevo que quisiera declarar su órgano de IA necesitaba una modificación
 * de este programa — justo lo contrario de un alta sin intervención técnica
 * (MOI-150). El mapa retirado.
 *
 * AHORA el órgano se deriva de dos tablas, en este orden (falla cerrado si
 * ninguna resuelve):
 *
 *   1. `aims_ria_subjects.governing_body_id` — un sujeto concreto (una
 *      entidad, en un rol, de un sistema) ya tiene un órgano acreditado. Es
 *      el dato más fino: distintos sistemas del mismo tenant podrían, en
 *      teoría, acreditar órganos distintos.
 *   2. `policies.owner_body_id` de la política de IA (`ai_systems.ai_policy_id`)
 *      de algún sistema del tenant — el nivel de "programa de IA" cuando
 *      todavía no hay sujetos declarados por sistema.
 *   3. Ninguna de las dos: `null`. No se fabrica un órgano que nadie ha
 *      constituido — el panel del Dashboard, condicionado a este valor,
 *      simplemente no se pinta.
 *
 * Un tenant nuevo (Garrigues, el Grupo Nuevo o cualquier despacho futuro)
 * declara su órgano con este mismo dato — un sujeto con `governing_body_id`,
 * o una política con `owner_body_id` enlazada a alguno de sus sistemas — sin
 * tocar este fichero. Es la hoja pura (sin imports, sin red): la consulta a
 * Supabase vive en el hook `useAiGovernanceBody` (`@/hooks/useAiGovernanceBody`),
 * que llama a estas funciones con lo que ya trajo de la base.
 */

export interface AiSubjectGoverningBodyRef {
  governing_body_id: string | null;
}

export interface AiSystemPolicyRef {
  ai_policy_id: string | null;
}

export interface PolicyOwnerBodyRef {
  id: string;
  owner_body_id: string | null;
}

/** Primer sujeto del tenant con un órgano acreditado, o `null`. */
export function resolveGoverningBodyIdFromSubjects(
  subjects: AiSubjectGoverningBodyRef[],
): string | null {
  return subjects.find((s) => s.governing_body_id)?.governing_body_id ?? null;
}

/**
 * Primer sistema del tenant cuya política de IA tiene un órgano responsable
 * acreditado (`owner_body_id`), o `null`.
 */
export function resolveGoverningBodyIdFromPolicies(
  systems: AiSystemPolicyRef[],
  policies: PolicyOwnerBodyRef[],
): string | null {
  const ownerById = new Map(policies.map((p) => [p.id, p.owner_body_id]));
  for (const s of systems) {
    if (!s.ai_policy_id) continue;
    const owner = ownerById.get(s.ai_policy_id);
    if (owner) return owner;
  }
  return null;
}

/**
 * Resolución completa: sujetos primero, política después, `null` si ninguna
 * de las dos vías acredita un órgano. Falla cerrado — el llamador no debe
 * inventar un valor por defecto cuando esto devuelve `null`.
 */
export function resolveAiGovernanceBodyId(input: {
  subjects: AiSubjectGoverningBodyRef[];
  systems: AiSystemPolicyRef[];
  policies: PolicyOwnerBodyRef[];
}): string | null {
  return (
    resolveGoverningBodyIdFromSubjects(input.subjects) ??
    resolveGoverningBodyIdFromPolicies(input.systems, input.policies)
  );
}
