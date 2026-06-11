import type { TipoSocial } from "@/lib/rules-engine/types";

export interface TipoSocialSource {
  tipo_social?: string | null;
  legal_form?: string | null;
}

/**
 * Deriva el tipo social canónico (SA/SL/SLU/SAU) a partir de los campos libres
 * de la entidad: `tipo_social` con prioridad y `legal_form` como fallback.
 *
 * Centraliza la lógica antes duplicada inline en los asistentes de decisiones
 * unipersonales, co-aprobación y solidario (ITEM-050). El motor LSC necesita el
 * tipo social real para aplicar reglas de mancomunidad (arts. 210.2 y 233.2.c
 * LSC); pasar un valor fijo "SL" deja sin efecto el guard de administración
 * conjunta en la SA.
 */
export function deriveTipoSocial(
  source: TipoSocialSource | null | undefined,
): TipoSocial {
  const raw = String(source?.tipo_social ?? source?.legal_form ?? "SL")
    .toUpperCase()
    .trim();
  if (raw === "SA" || raw === "SL" || raw === "SLU" || raw === "SAU") return raw;
  if (
    raw.includes("ANONIMA") ||
    raw.includes("ANÓNIMA") ||
    raw === "S.A." ||
    raw === "S.A"
  ) {
    return "SA";
  }
  return "SL";
}
