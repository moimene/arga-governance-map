/**
 * ITEM-025 — Canales de presentación registral por jurisdicción.
 *
 * El selector del Tramitador ofrecía TODOS los canales a la vez (Registro
 * Mercantil ES, SIGER/PSM MX, JUCERJA BR, Conservatória PT) sin filtrar por la
 * jurisdicción de la entidad — jurídicamente incoherente (un acto de una SA
 * española no se presenta en la JUCERJA brasileña). Esta función devuelve solo
 * los canales de la jurisdicción dada. Fallback a ES si es desconocida, para no
 * exponer canales de otros países.
 *
 * BORME no es un canal de presentación (es publicación posterior a la
 * inscripción) → no aparece aquí.
 */
export interface RegistryChannelOption {
  value: string;
  label: string;
}

const CHANNELS_BY_JURISDICTION: Record<string, RegistryChannelOption[]> = {
  ES: [{ value: "REGISTRO_MERCANTIL", label: "Registro Mercantil (España)" }],
  MX: [
    { value: "SIGER", label: "SIGER — Sistema Integral de Gestión Registral (México)" },
    { value: "PSM", label: "PSM — Portal de Servicios (México)" },
  ],
  BR: [{ value: "JUCERJA", label: "JUCERJA — Junta Comercial do Rio de Janeiro (Brasil)" }],
  PT: [{ value: "CONSERVATORIA", label: "Conservatória do Registo Comercial (Portugal)" }],
};

export function registryChannelsForJurisdiction(
  jurisdiction: string | null | undefined,
): RegistryChannelOption[] {
  const key = (jurisdiction ?? "").toUpperCase().trim();
  return CHANNELS_BY_JURISDICTION[key] ?? CHANNELS_BY_JURISDICTION.ES;
}
