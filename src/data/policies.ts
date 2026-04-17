export type PolicyStatus = "VIGENTE" | "EN REVISIÓN" | "PENDIENTE APROBACIÓN" | "BORRADOR" | "ARCHIVADA";

export interface Policy {
  code: string;
  title: string;
  type: string;
  scope: string;
  owner: string;
  status: PolicyStatus;
  effectiveDate: string | null;
  nextReview: string | null;
}

export const policies: Policy[] = [
  { code: "PR-001", title: "Política General de Gobierno Corporativo", type: "Corporativa", scope: "Grupo", owner: "Secretaría General", status: "VIGENTE", effectiveDate: "01/01/2025", nextReview: "01/01/2027" },
  { code: "PR-002", title: "Política de Gestión de Riesgos", type: "Corporativa", scope: "Grupo", owner: "Riesgos", status: "VIGENTE", effectiveDate: "15/03/2025", nextReview: "15/03/2027" },
  { code: "PR-003", title: "Política de Cumplimiento Normativo", type: "Corporativa", scope: "Grupo", owner: "Cumplimiento", status: "EN REVISIÓN", effectiveDate: "01/06/2024", nextReview: "30/04/2026" },
  { code: "PR-004", title: "Política de Inversiones", type: "Corporativa", scope: "Grupo", owner: "Inversiones", status: "VIGENTE", effectiveDate: "01/09/2024", nextReview: "01/09/2026" },
  { code: "PR-005", title: "Política de Remuneraciones", type: "Corporativa", scope: "Grupo", owner: "RRHH / Comisión Nombramientos", status: "VIGENTE", effectiveDate: "01/01/2025", nextReview: "01/01/2027" },
  { code: "PR-006", title: "Política de Conflictos de Interés", type: "Corporativa", scope: "Grupo", owner: "Cumplimiento", status: "VIGENTE", effectiveDate: "01/01/2025", nextReview: "01/01/2027" },
  { code: "PR-007", title: "Política de Subcontratación y Outsourcing", type: "Corporativa", scope: "Grupo", owner: "Operaciones", status: "VIGENTE", effectiveDate: "01/06/2025", nextReview: "01/06/2027" },
  { code: "PR-008", title: "Política de Resiliencia Operativa Digital (DORA)", type: "Corporativa", scope: "Grupo", owner: "Tecnología / Cumplimiento", status: "PENDIENTE APROBACIÓN", effectiveDate: null, nextReview: null },
  { code: "PR-009", title: "Política de Protección de Datos (RGPD)", type: "Corporativa", scope: "Grupo", owner: "Legal / Cumplimiento", status: "VIGENTE", effectiveDate: "25/05/2025", nextReview: "25/05/2027" },
  { code: "PR-010", title: "Política de Auditoría Interna", type: "Corporativa", scope: "Grupo", owner: "Auditoría Interna", status: "VIGENTE", effectiveDate: "01/03/2025", nextReview: "01/03/2027" },
  { code: "PR-011", title: "Política de Idoneidad (Fit & Proper)", type: "Corporativa", scope: "Grupo", owner: "Secretaría General", status: "VIGENTE", effectiveDate: "01/01/2025", nextReview: "01/01/2027" },
  { code: "PR-012", title: "Política de Solvencia II — ORSA", type: "Corporativa", scope: "Grupo", owner: "Riesgos / Actuarial", status: "VIGENTE", effectiveDate: "01/01/2025", nextReview: "01/01/2027" },
  { code: "PR-013", title: "Política Antifraude", type: "Corporativa", scope: "Grupo", owner: "Cumplimiento", status: "VIGENTE", effectiveDate: "01/07/2025", nextReview: "01/07/2027" },
  { code: "PR-014", title: "Política de Canal Interno (SII)", type: "Corporativa", scope: "Grupo", owner: "Cumplimiento", status: "VIGENTE", effectiveDate: "01/01/2024", nextReview: "01/01/2026" },
  { code: "PR-015", title: "Política de Sostenibilidad y ESG", type: "Corporativa", scope: "Grupo", owner: "Sostenibilidad", status: "VIGENTE", effectiveDate: "01/03/2025", nextReview: "01/03/2027" },
  { code: "PR-016", title: "Política de Continuidad de Negocio", type: "Corporativa", scope: "Grupo", owner: "Operaciones / Riesgos", status: "VIGENTE", effectiveDate: "01/06/2025", nextReview: "01/06/2027" },
  { code: "PR-017", title: "Política de Prevención de Blanqueo de Capitales", type: "Corporativa", scope: "Grupo", owner: "Cumplimiento", status: "VIGENTE", effectiveDate: "01/01/2025", nextReview: "01/01/2027" },
  { code: "PR-018", title: "Norma de Delegación de Poderes", type: "Normativa interna", scope: "Grupo", owner: "Legal", status: "VIGENTE", effectiveDate: "01/03/2025", nextReview: "01/03/2027" },
  { code: "PR-019", title: "Procedimiento de Gestión de Actas", type: "Procedimiento", scope: "Grupo", owner: "Secretaría General", status: "VIGENTE", effectiveDate: "15/01/2025", nextReview: "15/01/2027" },
  { code: "PR-020", title: "Procedimiento de Evaluación Anual del Consejo", type: "Procedimiento", scope: "Grupo", owner: "Secretaría General", status: "VIGENTE", effectiveDate: "01/09/2025", nextReview: "01/09/2027" },
  { code: "PR-021", title: "Política de Operaciones Vinculadas", type: "Corporativa", scope: "Grupo", owner: "Legal / Cumplimiento", status: "EN REVISIÓN", effectiveDate: "01/06/2024", nextReview: "01/06/2026" },
  { code: "PR-022", title: "Norma de Gestión Documental Corporativa", type: "Normativa interna", scope: "Grupo", owner: "Secretaría General", status: "VIGENTE", effectiveDate: "01/01/2025", nextReview: "01/01/2027" },
  { code: "PR-023", title: "Política de Seguridad de la Información", type: "Corporativa", scope: "Grupo", owner: "Tecnología / CISO", status: "VIGENTE", effectiveDate: "01/01/2025", nextReview: "01/01/2027" },
  { code: "PR-024", title: "Política de Inteligencia Artificial Responsable", type: "Corporativa", scope: "Grupo", owner: "Tecnología / Legal", status: "BORRADOR", effectiveDate: null, nextReview: null },
  { code: "PR-025", title: "Marco de Apetito de Riesgo", type: "Marco", scope: "Grupo", owner: "Riesgos / Consejo", status: "VIGENTE", effectiveDate: "01/01/2026", nextReview: "01/01/2027" },
];
