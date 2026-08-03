// Badges de naturaleza de órgano desde governing_bodies.config (G2).
// Config sin `naturaleza` (todos los bodies ARGA) → [] → cero cambio ARGA.
export function organoNaturalezaBadges(config: unknown): { label: string; title?: string }[] {
  if (!config || typeof config !== "object" || Array.isArray(config)) return [];
  const c = config as { naturaleza?: string; depende_de?: string[]; informe_preceptivo?: boolean };
  if (c.naturaleza !== "CONSULTIVO") return [];
  const badges = [{
    label: "Consultivo — no adopta acuerdos",
    title: c.depende_de?.length ? `Depende de: ${c.depende_de.join(" y ")}` : undefined,
  }];
  if (c.informe_preceptivo) badges.push({ label: "Informa preceptivamente a la Junta", title: undefined });
  return badges;
}
