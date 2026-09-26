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
  if (raw === "SA" || raw === "SL" || raw === "SLU" || raw === "SAU" || raw === "SLP") return raw;
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

/**
 * Regla común de Convocatorias y Reuniones para derivar el tipo social a
 * partir de un valor libre (`tipo_social` o `legal_form`). Por `includes`,
 * en orden SLP → SLU → SAU → SL, y SA por defecto.
 *
 * MOI-209: hoja única — antes duplicada de forma idéntica en
 * `ConvocatoriasStepper.tsx` y `ReunionStepper.tsx`. El orden importa:
 * "SLP".includes("SL") es true, así que SLP debe comprobarse antes que SL o
 * colapsaría la forma profesional a SL, ocultando las materias
 * `soloTipoSocial:["SLP"]` del orden del día (bug cazado en la
 * verificación viva de G3 Task 9).
 *
 * NO delegar en `deriveTipoSocial`: sus reglas no coinciden (p. ej. "SOCIEDAD
 * LIMITADA" da SL aquí y SA en `deriveTipoSocial`, que solo reconoce
 * "ANONIMA"/"S.A."). Componer una sobre otra cambiaría el resultado en
 * entradas no normalizadas.
 */
export function toTipoSocialAgenda(value: unknown): TipoSocial {
  const raw = String(value ?? "").toUpperCase();
  if (raw.includes("SLP")) return "SLP";
  if (raw.includes("SLU")) return "SLU";
  if (raw.includes("SAU")) return "SAU";
  if (raw.includes("SL")) return "SL";
  return "SA";
}

/**
 * Regla del motor de validez (`useAgreementCompliance`): SA/SA_CV → SA;
 * cualquier otra forma (incluidas SAU, SLU y SLP) → SL.
 *
 * MOI-209: hoja única — antes duplicada en `useAgreementCompliance.ts`.
 * Agrupar SAU/SLU/SLP en SL es deliberado y NO se corrige aquí: darles
 * identidad propia cambiaría el resultado del motor para ARGA (cero cambio
 * ARGA). Ampliar esta distinción exige autorización expresa — ver MOI-209.
 */
export function toTipoSocialMotorValidez(companyForm: string | null): TipoSocial {
  if (companyForm === "SA" || companyForm === "SA_CV") return "SA";
  return "SL";
}
