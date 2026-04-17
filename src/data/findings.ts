export type FindingSeverity = "CRÍTICA" | "ALTA" | "MEDIA" | "BAJA";
export type FindingStatus = "ABIERTO" | "ASIGNADO" | "EN REMEDIACIÓN" | "EN INVESTIGACIÓN" | "PENDIENTE VALIDACIÓN" | "CERRADO";

export interface Finding {
  id: string;
  title: string;
  severity: FindingSeverity;
  status: FindingStatus;
  entity: string;
  responsible: string;
  dueDate: string;
  origin: string;
}

export const findings: Finding[] = [
  { id: "HALL-001", title: "Ausencia de control de vencimiento de mandatos en órganos de gobierno", severity: "ALTA", status: "EN REMEDIACIÓN", entity: "ARGA España", responsible: "Dña. Lucía Paredes Vega", dueDate: "30/06/2026", origin: "Auditoría Interna" },
  { id: "HALL-002", title: "Política de inversiones no revisada en 18 meses", severity: "MEDIA", status: "ASIGNADO", entity: "ARGA Inversiones", responsible: "D. Ricardo Vega Sanz", dueDate: "15/05/2026", origin: "Cumplimiento" },
  { id: "HALL-003", title: "Delegación caducada sin revocación formal — D. Carlos Eduardo Vaz", severity: "ALTA", status: "ABIERTO", entity: "ARGA LATAM", responsible: "D. Miguel Ortega Sánchez", dueDate: "15/04/2026", origin: "Auditoría Interna" },
  { id: "HALL-004", title: "Actas de la Comisión de Inversiones sin firma digital desde Q3 2025", severity: "MEDIA", status: "EN REMEDIACIÓN", entity: "ARGA Seguros", responsible: "Dña. Lucía Paredes Vega", dueDate: "30/04/2026", origin: "Auditoría Interna" },
  { id: "HALL-005", title: "Falta de evidencia de test de controles Solvencia II en filial Malta", severity: "MEDIA", status: "PENDIENTE VALIDACIÓN", entity: "ARGA Malta", responsible: "Dña. Elena Navarro Pons", dueDate: "20/05/2026", origin: "Auditoría Interna" },
  { id: "HALL-006", title: "Reglamento del Comité de Riesgos desactualizado (versión 2022)", severity: "BAJA", status: "ASIGNADO", entity: "ARGA Seguros", responsible: "Dña. Sofía Herrera Ramos", dueDate: "30/06/2026", origin: "Secretaría General" },
  { id: "HALL-007", title: "Proveedores TIC críticos sin clasificar conforme a DORA", severity: "ALTA", status: "EN REMEDIACIÓN", entity: "Grupo", responsible: "D. Roberto García Prieto", dueDate: "30/04/2026", origin: "Cumplimiento" },
  { id: "HALL-008", title: "Conflicto de interés no declarado — inversión inmobiliaria ARGA Brasil", severity: "CRÍTICA", status: "EN INVESTIGACIÓN", entity: "ARGA Brasil", responsible: "D. Álvaro Mendoza Torres", dueDate: "30/04/2026", origin: "Auditoría Interna" },
  { id: "HALL-009", title: "Ausencia de control específico para OBL-DORA-003 (resiliencia operativa)", severity: "ALTA", status: "ABIERTO", entity: "Grupo", responsible: "D. Roberto García Prieto", dueDate: "15/05/2026", origin: "Cumplimiento" },
  { id: "HALL-010", title: "Excepción regulatoria de Turquía vencida y no renovada", severity: "ALTA", status: "ABIERTO", entity: "ARGA Turquía", responsible: "Dña. Elif Yılmaz", dueDate: "22/04/2026", origin: "Cumplimiento" },
];

export const getFindingById = (id: string) => findings.find((f) => f.id === id);
