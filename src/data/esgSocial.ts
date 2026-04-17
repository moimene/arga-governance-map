export interface SocialEntityRow {
  entityId: string;
  entity: string;
  boardWomenPct: number; // % mujeres en consejo
  execWomenPct: number; // % mujeres en alta dirección
  payGapPct: number; // brecha salarial ajustada (%)
  complianceTrainingPct: number; // % plantilla con formación compliance al día
  headcount: number;
}

export const socialEntities: SocialEntityRow[] = [
  { entityId: "arga-seguros", entity: "ARGA Seguros, S.A.", boardWomenPct: 42, execWomenPct: 38, payGapPct: 4.2, complianceTrainingPct: 96, headcount: 3240 },
  { entityId: "arga-espana", entity: "ARGA España", boardWomenPct: 38, execWomenPct: 34, payGapPct: 5.1, complianceTrainingPct: 94, headcount: 2180 },
  { entityId: "arga-latam", entity: "ARGA LATAM Holdings", boardWomenPct: 33, execWomenPct: 28, payGapPct: 7.8, complianceTrainingPct: 88, headcount: 980 },
  { entityId: "arga-brasil", entity: "ARGA Brasil", boardWomenPct: 27, execWomenPct: 24, payGapPct: 9.4, complianceTrainingPct: 81, headcount: 1420 },
  { entityId: "arga-re", entity: "ARGA Reaseguros", boardWomenPct: 44, execWomenPct: 40, payGapPct: 3.1, complianceTrainingPct: 98, headcount: 320 },
  { entityId: "arga-turquia", entity: "ARGA Turquía", boardWomenPct: 22, execWomenPct: 18, payGapPct: 11.6, complianceTrainingPct: 72, headcount: 640 },
  { entityId: "arga-usa", entity: "ARGA USA", boardWomenPct: 40, execWomenPct: 36, payGapPct: 6.2, complianceTrainingPct: 91, headcount: 1180 },
];

export const socialAverages = {
  boardWomenPct: Math.round(socialEntities.reduce((s, e) => s + e.boardWomenPct, 0) / socialEntities.length),
  execWomenPct: Math.round(socialEntities.reduce((s, e) => s + e.execWomenPct, 0) / socialEntities.length),
  payGapPct: +(socialEntities.reduce((s, e) => s + e.payGapPct, 0) / socialEntities.length).toFixed(1),
  complianceTrainingPct: Math.round(
    socialEntities.reduce((s, e) => s + e.complianceTrainingPct * e.headcount, 0) /
      socialEntities.reduce((s, e) => s + e.headcount, 0),
  ),
};

export const socialTargets = {
  boardWomenPctTarget: 40,
  payGapPctTarget: 5,
  complianceTrainingPctTarget: 95,
};
