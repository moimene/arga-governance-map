export interface Evidence {
  id: string;
  title: string;
  type: string;
  uploadedBy: string;
  uploadedDate: string;
  status: "VALIDADA" | "RECHAZADA" | "PENDIENTE VALIDACIÓN" | "VENCIDA";
  validatedBy: string | null;
  rejectionReason?: string;
}

export interface Control {
  id: string;
  code: string;
  title: string;
  obligationId: string;
  owner: string;
  frequency: string;
  lastExecution: string;
  nextExecution: string;
  status: "EFECTIVO" | "DEFICIENTE" | "EN REMEDIACIÓN" | "EXCEPCIÓN VENCIDA";
  findingId?: string;
  evidences: Evidence[];
}

export const controls: Control[] = [
  {
    id: "CTR-001", code: "CTR-001", title: "Supervisión anual del Sistema de Gobierno (Solvencia II)", obligationId: "OBL-SOL-001", owner: "Dña. Sofía Herrera Ramos", frequency: "Anual", lastExecution: "15/01/2026", nextExecution: "15/01/2027", status: "EFECTIVO",
    evidences: [
      { id: "EV-CTR001-001", title: "Informe Sistema de Gobierno 2025", type: "Informe", uploadedBy: "Dña. Sofía Herrera", uploadedDate: "15/01/2026", status: "VALIDADA", validatedBy: "D. Álvaro Mendoza" },
      { id: "EV-CTR001-002", title: "Acta revisión Comisión Riesgos", type: "Acta", uploadedBy: "Dña. Lucía Paredes", uploadedDate: "10/01/2026", status: "VALIDADA", validatedBy: "D. Álvaro Mendoza" },
    ],
  },
  {
    id: "CTR-002", code: "CTR-002", title: "Proceso ORSA — Evaluación interna riesgos y solvencia", obligationId: "OBL-SOL-002", owner: "Dña. Sofía Herrera Ramos", frequency: "Anual", lastExecution: "30/11/2025", nextExecution: "30/11/2026", status: "EFECTIVO",
    evidences: [
      { id: "EV-CTR002-001", title: "Informe ORSA 2025", type: "Informe", uploadedBy: "Dña. Laura Fernández", uploadedDate: "30/11/2025", status: "VALIDADA", validatedBy: "D. Álvaro Mendoza" },
    ],
  },
  {
    id: "CTR-003", code: "CTR-003", title: "Reporte supervisorio RSR/SFCR anual", obligationId: "OBL-SOL-003", owner: "Dña. Lucía Paredes Vega", frequency: "Anual", lastExecution: "01/04/2026", nextExecution: "01/04/2027", status: "EFECTIVO",
    evidences: [
      { id: "EV-CTR003-001", title: "SFCR 2025 publicado", type: "Documento regulatorio", uploadedBy: "Dña. Lucía Paredes", uploadedDate: "01/04/2026", status: "VALIDADA", validatedBy: "D. Álvaro Mendoza" },
    ],
  },
  {
    id: "CTR-004", code: "CTR-004", title: "Control de vencimiento de mandatos en órganos corporativos", obligationId: "OBL-SOL-004", owner: "Dña. Lucía Paredes Vega", frequency: "Continua", lastExecution: "01/04/2026", nextExecution: "30/04/2026", status: "DEFICIENTE",
    findingId: "HALL-001",
    evidences: [
      { id: "EV-001", title: "Registro de mandatos corporativos Q1 2026", type: "Registro", uploadedBy: "Dña. Lucía Paredes", uploadedDate: "01/04/2026", status: "RECHAZADA", validatedBy: "D. Álvaro Mendoza", rejectionReason: "El registro no incluye las filiales de LATAM. 3 mandatos detectados como vencidos sin alertas previas documentadas. Vinculado a HALL-001." },
      { id: "EV-CTR004-002", title: "Notificaciones de alerta T-90 enviadas", type: "Correo electrónico", uploadedBy: "Dña. Lucía Paredes", uploadedDate: "01/04/2026", status: "VALIDADA", validatedBy: "D. Álvaro Mendoza" },
      { id: "EV-CTR004-003", title: "Acta CdA con mandato Dña. Carmen Delgado", type: "Acta", uploadedBy: "Dña. Lucía Paredes", uploadedDate: "15/07/2025", status: "VALIDADA", validatedBy: "D. Álvaro Mendoza" },
      { id: "EV-CTR004-004", title: "Plan de renovación mandatos 2026", type: "Plan de acción", uploadedBy: "Dña. Lucía Paredes", uploadedDate: "05/04/2026", status: "PENDIENTE VALIDACIÓN", validatedBy: null },
    ],
  },
  {
    id: "CTR-005", code: "CTR-005", title: "Inventario y registro de activos TIC críticos", obligationId: "OBL-DORA-001", owner: "D. Roberto García Prieto", frequency: "Semestral", lastExecution: "01/01/2026", nextExecution: "01/07/2026", status: "EFECTIVO",
    evidences: [
      { id: "EV-CTR005-001", title: "Inventario activos TIC S1 2026", type: "Registro", uploadedBy: "D. Roberto García", uploadedDate: "01/01/2026", status: "VALIDADA", validatedBy: "D. Álvaro Mendoza" },
    ],
  },
  {
    id: "CTR-006", code: "CTR-006", title: "Clasificación y registro de proveedores TIC críticos", obligationId: "OBL-DORA-002", owner: "D. Roberto García Prieto", frequency: "Anual", lastExecution: "15/11/2025", nextExecution: "30/04/2026", status: "EN REMEDIACIÓN",
    findingId: "HALL-007",
    evidences: [
      { id: "EV-CTR006-001", title: "Registro proveedores TIC (parcial)", type: "Registro", uploadedBy: "D. Roberto García", uploadedDate: "15/11/2025", status: "PENDIENTE VALIDACIÓN", validatedBy: null },
    ],
  },
  {
    id: "CTR-007", code: "CTR-007", title: "Evaluación anual Fit & Proper de personas clave", obligationId: "OBL-SOL-005", owner: "Dña. Lucía Paredes Vega", frequency: "Anual", lastExecution: "01/03/2026", nextExecution: "01/03/2027", status: "EFECTIVO",
    evidences: [
      { id: "EV-CTR007-001", title: "Actas evaluación idoneidad 2026", type: "Acta", uploadedBy: "Dña. Lucía Paredes", uploadedDate: "01/03/2026", status: "VALIDADA", validatedBy: "D. Álvaro Mendoza" },
    ],
  },
  {
    id: "CTR-008", code: "CTR-008", title: "Registro de actividades externalizadas (Solvencia II)", obligationId: "OBL-SOL-006", owner: "D. Miguel Ortega Sánchez", frequency: "Continua", lastExecution: "01/04/2026", nextExecution: "01/04/2027", status: "EFECTIVO",
    evidences: [
      { id: "EV-CTR008-001", title: "Registro outsourcing 2026", type: "Registro", uploadedBy: "D. Miguel Ortega", uploadedDate: "01/04/2026", status: "VALIDADA", validatedBy: "Dña. Elena Navarro" },
    ],
  },
  {
    id: "CTR-009", code: "CTR-009", title: "Seguimiento excepción regulatoria ARGA Turquía", obligationId: "OBL-SOL-007", owner: "Dña. Elif Yılmaz", frequency: "Anual", lastExecution: "22/04/2025", nextExecution: "22/04/2026", status: "EXCEPCIÓN VENCIDA",
    findingId: "HALL-010",
    evidences: [
      { id: "EV-CTR009-001", title: "Excepción regulatoria SEDDK aprobada 2025", type: "Documento regulatorio", uploadedBy: "Dña. Elif Yılmaz", uploadedDate: "22/04/2025", status: "VENCIDA", validatedBy: "Dña. Elena Navarro" },
    ],
  },
  {
    id: "CTR-010", code: "CTR-010", title: "Control de gestión de exenciones y excepciones locales", obligationId: "OBL-SOL-007", owner: "Dña. Elena Navarro Pons", frequency: "Continua", lastExecution: "01/04/2026", nextExecution: "30/04/2026", status: "EN REMEDIACIÓN",
    evidences: [],
  },
];
