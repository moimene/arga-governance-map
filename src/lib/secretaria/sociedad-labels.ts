import { displaySocietyLegalForm } from "@/lib/secretaria/mesa-control-societaria";

export const TIPO_SOCIAL_OPTIONS = [
  { value: "SA", label: "S.A. - Sociedad Anonima" },
  { value: "SL", label: "S.L. - Sociedad Limitada" },
  { value: "SAU", label: "S.A.U. - Sociedad Anonima unipersonal" },
  { value: "SLU", label: "S.L.U. - Sociedad Limitada unipersonal" },
  { value: "SLP", label: "Sociedad Limitada Profesional" },
];

export function sociedadDetalleTipoSocialLabel(
  value: string | null | undefined,
  jurisdiction?: string | null,
  legalForm?: string | null
): string {
  if (!value) return "Tipo social pendiente";
  if (jurisdiction && jurisdiction !== "ES") {
    return displaySocietyLegalForm({ jurisdiction, tipoSocial: value, legalForm });
  }
  return (
    {
      SA: "Sociedad Anónima",
      SAU: "Sociedad Anónima Unipersonal",
      SL: "Sociedad Limitada",
      SLU: "Sociedad Limitada Unipersonal",
      SLP: "Sociedad Limitada Profesional",
    } as Record<string, string>
  )[value] ?? value;
}

export function sociedadesListTipoSocialLabel(s: string | null | undefined): string {
  if (!s) return "—";
  return (
    {
      SA: "S.A.",
      SL: "S.L.",
      SLU: "S.L.U. (unipersonal)",
      SAU: "S.A.U. (unipersonal)",
      SLP: "Sociedad Limitada Profesional",
    } as Record<string, string>
  )[s] ?? s;
}

export const tipoSocialLabel = sociedadDetalleTipoSocialLabel;
