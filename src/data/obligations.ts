export interface Obligation {
  id: string;
  code: string;
  title: string;
  framework: string;
  article: string;
  policyId: string;
  scope: string;
  entityIds: string[];
  controlId: string | null;
  coverage: "COMPLETA" | "PARCIAL" | "SIN COBERTURA" | "EXCEPCIÓN";
  status: "CUBIERTA" | "EN REMEDIACIÓN" | "SIN CONTROL" | "EXCEPCIÓN ACTIVA";
}

export const obligations: Obligation[] = [
  { id: "OBL-DORA-001", code: "OBL-DORA-001", title: "Registro de activos TIC críticos", framework: "DORA", article: "Art. 8", policyId: "PR-008", scope: "Grupo", entityIds: ["arga-seguros", "arga-espana", "arga-brasil", "arga-mexico", "arga-usa", "arga-turquia"], controlId: "CTR-005", coverage: "COMPLETA", status: "CUBIERTA" },
  { id: "OBL-DORA-002", code: "OBL-DORA-002", title: "Clasificación de proveedores TIC críticos", framework: "DORA", article: "Art. 28", policyId: "PR-008", scope: "Grupo", entityIds: ["arga-seguros"], controlId: "CTR-006", coverage: "PARCIAL", status: "EN REMEDIACIÓN" },
  { id: "OBL-DORA-003", code: "OBL-DORA-003", title: "Pruebas de resiliencia operativa digital (TLPT)", framework: "DORA", article: "Art. 24", policyId: "PR-008", scope: "Grupo", entityIds: ["arga-seguros", "arga-espana", "arga-digital"], controlId: null, coverage: "SIN COBERTURA", status: "SIN CONTROL" },
  { id: "OBL-SOL-001", code: "OBL-SOL-001", title: "Implementación del Sistema de Gobierno Solvencia II", framework: "Solvencia II", article: "Art. 41 Directiva 2009/138/CE", policyId: "PR-001", scope: "Grupo", entityIds: ["arga-seguros", "arga-espana", "arga-vida", "arga-reaseguros"], controlId: "CTR-001", coverage: "COMPLETA", status: "CUBIERTA" },
  { id: "OBL-SOL-002", code: "OBL-SOL-002", title: "Evaluación interna de riesgos y solvencia (ORSA)", framework: "Solvencia II", article: "Art. 45 Directiva 2009/138/CE", policyId: "PR-012", scope: "Grupo", entityIds: ["arga-seguros"], controlId: "CTR-002", coverage: "COMPLETA", status: "CUBIERTA" },
  { id: "OBL-SOL-003", code: "OBL-SOL-003", title: "Informes de supervisión al regulador (RSR/SFCR)", framework: "Solvencia II", article: "Art. 51-55 Directiva 2009/138/CE", policyId: "PR-012", scope: "Grupo", entityIds: ["arga-seguros", "arga-espana", "arga-vida"], controlId: "CTR-003", coverage: "COMPLETA", status: "CUBIERTA" },
  { id: "OBL-SOL-004", code: "OBL-SOL-004", title: "Control de vencimiento de mandatos en órganos de gobierno", framework: "Solvencia II", article: "Art. 42 Directiva 2009/138/CE", policyId: "PR-011", scope: "Grupo", entityIds: ["arga-seguros", "arga-espana", "arga-brasil"], controlId: "CTR-004", coverage: "PARCIAL", status: "EN REMEDIACIÓN" },
  { id: "OBL-SOL-005", code: "OBL-SOL-005", title: "Evaluación de idoneidad de personas clave (Fit & Proper)", framework: "Solvencia II", article: "Art. 42-43 Directiva 2009/138/CE", policyId: "PR-011", scope: "Grupo", entityIds: ["arga-seguros"], controlId: "CTR-007", coverage: "COMPLETA", status: "CUBIERTA" },
  { id: "OBL-SOL-006", code: "OBL-SOL-006", title: "Registro y supervisión de actividades externalizadas", framework: "Solvencia II", article: "Art. 49 Directiva 2009/138/CE", policyId: "PR-007", scope: "Grupo", entityIds: ["arga-seguros", "arga-espana"], controlId: "CTR-008", coverage: "COMPLETA", status: "CUBIERTA" },
  { id: "OBL-SOL-007", code: "OBL-SOL-007", title: "Cumplimiento del marco regulatorio local Turquía", framework: "Solvencia II + Local", article: "SEDDK (regulador turco)", policyId: "PR-001", scope: "ARGA Turquía", entityIds: ["arga-turquia"], controlId: "CTR-009", coverage: "EXCEPCIÓN", status: "EXCEPCIÓN ACTIVA" },
];
