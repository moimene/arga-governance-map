import { normalizeMateriaForRulePack } from "@/lib/rules-engine/rule-resolution";

/**
 * W7 — evaluador puro de autorizaciones regulatorias sectoriales (G13).
 *
 * En filiales reguladas, ciertas materias (operaciones estructurales, cambio de
 * objeto social) exigen autorización previa del supervisor sectorial antes de
 * poder inscribir el acuerdo. Este evaluador, dado el acto y las autorizaciones
 * disponibles, devuelve qué organismos son requeridos y cuáles faltan o están
 * caducados. Es PURO y determinista (recibe `hoyISO`, no usa la fecha del
 * sistema). Alias-aware en la materia. El *enforcement* como hard-block en el
 * flujo es trabajo futuro; esta capa surface el estado (read-only).
 */
export type OrganismoRegulatorio =
  | "DGSFP" // seguros ES
  | "SUSEP" // seguros BR
  | "CNSF" // seguros MX
  | "BDP" // banca PT
  | "CNMV" // mercados ES
  | "BDE"; // banca ES

export interface AutorizacionRegulatoriaInput {
  organismo: OrganismoRegulatorio;
  estado: "VIGENTE" | "EXPIRADA" | "REVOCADA";
  fechaVigenciaHasta?: string | null;
}

export interface AutorizacionesEvalInput {
  materia: string;
  esEntidadRegulada: boolean;
  sectorRegulado?: string | null;
  jurisdiccion?: string | null;
  autorizaciones: AutorizacionRegulatoriaInput[];
  hoyISO: string;
}

export interface AutorizacionesEvalResult {
  required: OrganismoRegulatorio[];
  present: OrganismoRegulatorio[];
  missing: OrganismoRegulatorio[];
  expired: OrganismoRegulatorio[];
  blocking: boolean;
}

// Materias que, en una aseguradora ES, exigen autorización previa de la DGSFP
// (operaciones estructurales y de objeto/control). Se comparan tras normalizar
// la grafía (alias-aware) e incluyen el paraguas OPERACION_ESTRUCTURAL.
const DGSFP_TRIGGER_MATERIAS = new Set<string>([
  "FUSION",
  "ESCISION",
  "TRANSFORMACION",
  "DISOLUCION",
  "LIQUIDACION",
  "CESION_GLOBAL_ACTIVO",
  "OPERACION_ESTRUCTURAL",
  "AMPLIACION_OBJETO_SOCIAL",
  "VENTA_ACTIVOS_ESENCIALES",
]);

function esSeguros(sector?: string | null): boolean {
  return /seguro/i.test(sector ?? "");
}

function organismosRequeridos(input: AutorizacionesEvalInput): OrganismoRegulatorio[] {
  if (!input.esEntidadRegulada) return [];
  const materia = normalizeMateriaForRulePack(input.materia);
  const jur = (input.jurisdiccion ?? "ES").toUpperCase();
  const required: OrganismoRegulatorio[] = [];
  if (jur === "ES" && esSeguros(input.sectorRegulado) && DGSFP_TRIGGER_MATERIAS.has(materia)) {
    required.push("DGSFP");
  }
  return required;
}

function vigenciaValida(a: AutorizacionRegulatoriaInput, hoyISO: string): boolean {
  if (a.estado !== "VIGENTE") return false;
  if (!a.fechaVigenciaHasta) return true;
  return new Date(a.fechaVigenciaHasta) >= new Date(hoyISO.slice(0, 10));
}

export function evaluarAutorizacionesRegulatorias(
  input: AutorizacionesEvalInput,
): AutorizacionesEvalResult {
  const required = organismosRequeridos(input);
  const present: OrganismoRegulatorio[] = [];
  const missing: OrganismoRegulatorio[] = [];
  const expired: OrganismoRegulatorio[] = [];

  for (const org of required) {
    const delOrg = input.autorizaciones.filter((a) => a.organismo === org);
    if (delOrg.some((a) => vigenciaValida(a, input.hoyISO))) {
      present.push(org);
    } else if (delOrg.length > 0) {
      expired.push(org);
    } else {
      missing.push(org);
    }
  }

  return {
    required,
    present,
    missing,
    expired,
    blocking: missing.length > 0 || expired.length > 0,
  };
}
