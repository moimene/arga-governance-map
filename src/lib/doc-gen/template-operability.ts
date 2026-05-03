import type { PlantillaProtegidaRow } from "@/hooks/usePlantillasProtegidas";

export const OPERATIONAL_TEMPLATE_QUERY_STATES = ["ACTIVA", "APROBADA", "BORRADOR"] as const;

function normalizeTemplateStatus(status?: string | null) {
  return status?.trim().toUpperCase() ?? "";
}

function hasCapa1Content(template: Pick<PlantillaProtegidaRow, "capa1_inmutable">) {
  return !!template.capa1_inmutable?.trim();
}

export function isLegallyReviewedDraft(template: PlantillaProtegidaRow) {
  return (
    normalizeTemplateStatus(template.estado) === "BORRADOR" &&
    !!template.aprobada_por?.trim() &&
    !!template.fecha_aprobacion?.trim()
  );
}

export function isOperationalTemplate(template: PlantillaProtegidaRow) {
  const status = normalizeTemplateStatus(template.estado);
  if (!hasCapa1Content(template)) return false;
  if (status === "ACTIVA" || status === "APROBADA") return true;
  return isLegallyReviewedDraft(template);
}

function operationalStatusRank(template: PlantillaProtegidaRow) {
  const status = normalizeTemplateStatus(template.estado);
  if (status === "ACTIVA") return 0;
  if (status === "APROBADA") return 1;
  if (isLegallyReviewedDraft(template)) return 2;
  return 99;
}

function versionParts(version?: string | null) {
  return (version ?? "")
    .match(/\d+/g)
    ?.slice(0, 4)
    .map((part) => Number(part)) ?? [];
}

export function compareTemplateVersionDesc(
  a: Pick<PlantillaProtegidaRow, "version">,
  b: Pick<PlantillaProtegidaRow, "version">,
) {
  const aParts = versionParts(a.version);
  const bParts = versionParts(b.version);
  const length = Math.max(aParts.length, bParts.length, 3);
  for (let index = 0; index < length; index += 1) {
    const diff = (bParts[index] ?? 0) - (aParts[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return (b.version ?? "").localeCompare(a.version ?? "");
}

export function compareOperationalTemplateFreshness(
  a: PlantillaProtegidaRow,
  b: PlantillaProtegidaRow,
) {
  const versionDiff = compareTemplateVersionDesc(a, b);
  if (versionDiff !== 0) return versionDiff;
  return operationalStatusRank(a) - operationalStatusRank(b);
}
