/**
 * RRM art. 109: una entidad con ADMIN_UNICO vigente certifica sin Vº Bº de
 * presidencia — pero solo si no tiene además un órgano DE ADMINISTRACIÓN
 * colegiado real. Un PRESIDENTE/SECRETARIO de un COMITE consultivo (p. ej.
 * Rosa Zarza presidiendo el Consejo de Socios de la matriz SLP de Garrigues,
 * `config.naturaleza='CONSULTIVO'`) no cuenta como colegiado: excluirlo evita
 * el falso negativo que enrutaría la certificación al flujo SECRETARIO
 * inexistente en esa sociedad.
 *
 * Extraído de ActaDetalle.tsx para poder testear la lógica sin montar la
 * página completa (12+ hooks + router) — el consumidor solo pasa
 * `signingAuthorities`, ya cargado por `useAuthorityEvidence(entityId)`.
 */
export interface SigningAuthorityForAdminUnicoCheck {
  cargo: string;
  body?: { body_type: string } | null;
}

export function isAdminUnicoCertificante(
  signingAuthorities: SigningAuthorityForAdminUnicoCheck[],
): boolean {
  return (
    signingAuthorities.some((authority) => authority.cargo === "ADMIN_UNICO") &&
    !signingAuthorities.some(
      (authority) =>
        (authority.cargo === "PRESIDENTE" || authority.cargo === "SECRETARIO") &&
        authority.body?.body_type !== "COMITE",
    )
  );
}
