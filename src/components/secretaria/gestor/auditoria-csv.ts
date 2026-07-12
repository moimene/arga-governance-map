import { labelMateria } from "@/lib/secretaria/agenda-materias";
import {
  formatCsvDate,
  type CsvValue,
} from "@/lib/secretaria/csv-export";
import {
  estadoLabel,
  tipoLabel,
  type OrphanTemplateRow,
} from "@/lib/secretaria/template-admin";

export type ChangelogRow = {
  id: string;
  plantilla_id: string;
  bump_type: string | null;
  motivo: string | null;
  diff_summary: string | null;
  from_version: string | null;
  to_version: string;
  autor: string;
  created_at: string | null;
};

export type ChangelogFilters = {
  plantilla: string;
  actor: string;
  bump: "ALL" | "PATCH" | "MINOR" | "MAJOR";
  date: string;
};

export const CHANGELOG_CSV_COLUMNS = [
  "ID plantilla",
  "Tipo de cambio (raw)",
  "Tipo de cambio",
  "Versión anterior",
  "Versión nueva (lógica)",
  "Autor",
  "Motivo",
  "Fecha y hora (ISO)",
] as const;

export const ORPHAN_CSV_COLUMNS = [
  "ID plantilla",
  "Tipo (raw)",
  "Tipo",
  "Materia (raw)",
  "Materia",
  "Versión",
  "Estado (raw)",
  "Estado",
] as const;

export function bumpTypeLabel(value?: string | null): string {
  if (value === "PATCH") return "Corrección (PATCH)";
  if (value === "MINOR") return "Evolución menor (MINOR)";
  if (value === "MAJOR") return "Cambio mayor (MAJOR)";
  return value || "—";
}

export function logicalToVersion(row: ChangelogRow): string {
  if (row.diff_summary) {
    try {
      const parsed = JSON.parse(row.diff_summary) as { logical_to_version?: unknown };
      if (typeof parsed.logical_to_version === "string") return parsed.logical_to_version;
    } catch {
      // `diff_summary` existed before the JSON text convention; fall back below.
    }
  }
  return row.to_version.split("#idemp:")[0] ?? row.to_version;
}

export function changelogLocalDate(value: string | null): string {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : formatCsvDate(parsed);
}

function isoTimestamp(value: string | null): CsvValue {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

export function filterChangelogRows(
  rows: readonly ChangelogRow[],
  filters: ChangelogFilters,
): ChangelogRow[] {
  const plantilla = filters.plantilla.trim().toLowerCase();
  const actor = filters.actor.trim().toLowerCase();
  return rows.filter((row) => {
    if (plantilla && !row.plantilla_id.toLowerCase().includes(plantilla)) return false;
    if (actor && !row.autor.toLowerCase().includes(actor)) return false;
    if (filters.bump !== "ALL" && row.bump_type !== filters.bump) return false;
    if (filters.date && changelogLocalDate(row.created_at) !== filters.date) return false;
    return true;
  });
}

export function buildChangelogCsvRows(
  rows: readonly ChangelogRow[],
): CsvValue[][] {
  return rows.map((row) => [
    row.plantilla_id,
    row.bump_type,
    bumpTypeLabel(row.bump_type),
    row.from_version,
    logicalToVersion(row),
    row.autor,
    row.motivo,
    isoTimestamp(row.created_at),
  ]);
}

export function buildOrphanCsvRows(
  rows: readonly OrphanTemplateRow[],
): CsvValue[][] {
  return rows.map((row) => [
    row.id,
    row.tipo,
    tipoLabel(row.tipo),
    row.materia,
    row.materia ? labelMateria(row.materia) : null,
    row.version,
    row.estado,
    estadoLabel(row.estado),
  ]);
}
