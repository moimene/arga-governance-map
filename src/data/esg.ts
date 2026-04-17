export interface EsgEntityRow {
  entityId: string;
  entity: string;
  country: string;
  scope1: number; // tCO2e
  scope2: number;
  scope3: number;
  esgScore: number; // 0-100
  rating: "AAA" | "AA" | "A" | "BBB" | "BB" | "B";
  trend: "up" | "down" | "flat";
}

export const esgEntities: EsgEntityRow[] = [
  { entityId: "arga-seguros", entity: "ARGA Seguros, S.A.", country: "ES", scope1: 1240, scope2: 3180, scope3: 18420, esgScore: 72, rating: "A", trend: "up" },
  { entityId: "arga-espana", entity: "ARGA España", country: "ES", scope1: 820, scope2: 2140, scope3: 11200, esgScore: 76, rating: "AA", trend: "up" },
  { entityId: "arga-latam", entity: "ARGA LATAM Holdings", country: "MX", scope1: 460, scope2: 1280, scope3: 6420, esgScore: 64, rating: "BBB", trend: "flat" },
  { entityId: "arga-brasil", entity: "ARGA Brasil", country: "BR", scope1: 380, scope2: 980, scope3: 4810, esgScore: 51, rating: "BB", trend: "down" },
  { entityId: "arga-re", entity: "ARGA Reaseguros", country: "ES", scope1: 210, scope2: 540, scope3: 2380, esgScore: 81, rating: "AA", trend: "up" },
  { entityId: "arga-turquia", entity: "ARGA Turquía", country: "TR", scope1: 540, scope2: 1620, scope3: 5240, esgScore: 48, rating: "B", trend: "down" },
  { entityId: "arga-usa", entity: "ARGA USA", country: "US", scope1: 980, scope2: 2640, scope3: 9810, esgScore: 69, rating: "A", trend: "flat" },
];

export const esgTotals = esgEntities.reduce(
  (acc, e) => {
    acc.scope1 += e.scope1;
    acc.scope2 += e.scope2;
    acc.scope3 += e.scope3;
    return acc;
  },
  { scope1: 0, scope2: 0, scope3: 0 },
);

export const esgGroupScore = Math.round(
  esgEntities.reduce((s, e) => s + e.esgScore, 0) / esgEntities.length,
);

export const esgEvolution = [
  { year: "2020", scope1: 5840, scope2: 14200, scope3: 68400, score: 58 },
  { year: "2021", scope1: 5420, scope2: 13680, scope3: 65900, score: 61 },
  { year: "2022", scope1: 5180, scope2: 13140, scope3: 62800, score: 64 },
  { year: "2023", scope1: 4890, scope2: 12780, scope3: 60120, score: 67 },
  { year: "2024", scope1: 4630, scope2: 12380, scope3: 58280, score: 70 },
];

export const esgTargets = {
  scope1And2Reduction2030: 42, // %
  netZeroYear: 2050,
};
