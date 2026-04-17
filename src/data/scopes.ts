export const scopes = [
  "Grupo ARGA (Global)",
  "España",
  "LATAM",
  "Europa",
  "Asia-Pacífico",
  "Brasil",
  "México",
  "Turquía",
  "EE.UU.",
] as const;

export type Scope = (typeof scopes)[number];
