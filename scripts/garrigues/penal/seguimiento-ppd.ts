// scripts/garrigues/penal/seguimiento-ppd.ts
// Las cuatro actividades del Plan de seguimiento del PPD, LITERALES de
// PPD-01 "Supervisión y seguimiento del programa" (§350-356).
//
// Son controles y no planes de acción: son actividades de supervisión
// recurrentes con órgano responsable identificado. El Plan de acción del §246
// no se siembra porque la fuente describe el mecanismo y no publica la lista.
export const CONTROLES_SEGUIMIENTO = [
  { code: "CTR-GARR-25", name: "PPD — Seguimiento del desarrollo del Plan de acción" },
  { code: "CTR-GARR-26", name: "PPD — Seguimiento del desarrollo del Plan de formación" },
  { code: "CTR-GARR-27", name: "PPD — Seguimiento de la aplicación de controles ya establecidos" },
  { code: "CTR-GARR-28", name: "PPD — Seguimiento de los objetivos establecidos en relación con el PPD" },
] as const;

export const SEGUIMIENTO_DESCRIPCION =
  "Actividad del Plan de seguimiento del Sistema de gestión de riesgos penales. " +
  "Sus resultados se tratan en las reuniones de coordinación del PPD, donde se analizan " +
  "también las no conformidades detectadas —el incumplimiento de un requisito establecido " +
  "en el PPD— y se valora la conveniencia de tomar acciones correctivas. " +
  "Fuente: PPD-01, Manual del Sistema de Gestión de Riesgos Penales, " +
  "apartado «Supervisión y seguimiento del programa».";
