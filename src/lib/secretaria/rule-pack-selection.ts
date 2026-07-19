/**
 * Selección de rule pack por materia y órgano, como función pura.
 *
 * Vivía dentro de `useRulePackForMateria` y no había forma de probarla: ningún
 * test unitario del repo ejercitaba este camino, y por eso ITEM-133 pudo darse
 * por cerrado estando a medias. Extraerla aquí cumple dos objetivos: se puede
 * fijar en tests, y el llamador puede saber POR QUÉ se eligió ese pack.
 *
 * El comportamiento NO cambia respecto al anterior: si ningún pack es del
 * órgano del acuerdo se sigue devolviendo el primero determinista. Lo que se
 * añade es el motivo, para que la UI pueda advertir de que la regla mostrada no
 * es la del órgano que adopta. Si esa advertencia debe además BLOQUEAR la
 * tramitación es criterio jurídico del Comité Legal, no de este módulo.
 */
import { rulePackOrganoFamily } from "./rule-pack-organo";

export type RulePackSelectionReason =
  /** El pack es del mismo órgano que adopta el acuerdo. */
  | "ORGANO_COINCIDE"
  /** Solo hay un pack para la materia y no se conoce el órgano del acuerdo. */
  | "UNICO_PACK_SIN_ORGANO_CONOCIDO"
  /** Se conoce el órgano, pero ningún pack de la materia es de ese órgano. */
  | "FALLBACK_ORGANO_DISTINTO"
  /** No se conoce el órgano y hay varios packs: la elección es arbitraria. */
  | "FALLBACK_AMBIGUO";

export interface RulePackSelection<T> {
  pack: T | null;
  reason: RulePackSelectionReason | null;
  /** Órgano del pack elegido, tal cual viene del dato. */
  packOrgano: string | null;
}

/**
 * Elige el pack de la lista dando preferencia al del órgano del acuerdo.
 *
 * @param rows packs candidatos de la materia, en orden determinista
 * @param organoTipo órgano que adopta el acuerdo, si se conoce
 */
export function selectRulePackForOrgano<T extends { organo_tipo?: string | null }>(
  rows: T[],
  organoTipo?: string | null,
): RulePackSelection<T> {
  if (!rows || rows.length === 0) {
    return { pack: null, reason: null, packOrgano: null };
  }

  const agreementFamily = rulePackOrganoFamily(organoTipo);

  if (agreementFamily) {
    const exact = rows.find((row) => rulePackOrganoFamily(row.organo_tipo) === agreementFamily);
    if (exact) {
      return {
        pack: exact,
        reason: "ORGANO_COINCIDE",
        packOrgano: exact.organo_tipo ?? null,
      };
    }
    // Se conoce el órgano y ninguno casa: se conserva el comportamiento previo
    // (servir el primero) pero queda declarado que la regla es de otro órgano.
    return {
      pack: rows[0],
      reason: "FALLBACK_ORGANO_DISTINTO",
      packOrgano: rows[0].organo_tipo ?? null,
    };
  }

  return {
    pack: rows[0],
    reason: rows.length === 1 ? "UNICO_PACK_SIN_ORGANO_CONOCIDO" : "FALLBACK_AMBIGUO",
    packOrgano: rows[0].organo_tipo ?? null,
  };
}

/**
 * ¿La regla servida procede de un órgano distinto al que adopta el acuerdo, o
 * de una elección arbitraria entre varias? En ambos casos lo mostrado no está
 * acreditado para ese acuerdo y debe advertirse.
 */
export function isUnreliableRulePackSelection(reason?: RulePackSelectionReason | null): boolean {
  return reason === "FALLBACK_ORGANO_DISTINTO" || reason === "FALLBACK_AMBIGUO";
}
