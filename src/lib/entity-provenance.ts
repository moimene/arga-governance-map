// Badges de procedencia/cobertura desde entities.data_provenance (G1).
// data_provenance NULL (todas las filas ARGA) → [] → cero cambio visual ARGA.
export interface EntityProvenance {
  fuentes?: string[];
  confianza?: "CONFIRMADO" | "A_CONFIRMAR" | "PENDIENTE";
  cobertura_motor?: boolean;
  cobertura_motivo?: string;
  incidencias?: string[];
  notas?: string[];
}

export interface ProvenanceBadge {
  label: string;
  tone: "warning" | "neutral" | "info";
  title?: string;
}

export function provenanceBadges(p: unknown): ProvenanceBadge[] {
  if (!p || typeof p !== "object" || Array.isArray(p)) return [];
  const prov = p as EntityProvenance;
  const badges: ProvenanceBadge[] = [];

  if (prov.cobertura_motor === false) {
    badges.push({
      label: "Fuera de cobertura normativa (motor ES)",
      tone: "neutral",
      title: prov.cobertura_motivo,
    });
  }
  if (prov.confianza === "A_CONFIRMAR") {
    badges.push({ label: "Datos a confirmar", tone: "warning", title: (prov.notas ?? []).join(" · ") || undefined });
  } else if (prov.confianza === "PENDIENTE") {
    badges.push({ label: "Participación pendiente de fuente", tone: "warning" });
  }
  const inc = prov.incidencias ?? [];
  if (inc.length > 0) {
    badges.push({
      label: inc.length === 1 ? "1 incidencia de dato" : `${inc.length} incidencias de dato`,
      tone: "info",
      title: inc.join(" · "),
    });
  }
  return badges;
}
