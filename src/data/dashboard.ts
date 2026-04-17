export interface Meeting {
  date: string;
  organ: string;
  status: "Convocada" | "Planificada" | "Celebrada";
  highlight?: boolean;
  link?: string;
}

export const upcomingMeetings: Meeting[] = [
  { date: "22/04/2026", organ: "Consejo de Administración", status: "Convocada", highlight: true, link: "/organos" },
  { date: "28/04/2026", organ: "Comisión de Auditoría", status: "Convocada", link: "/organos" },
  { date: "02/05/2026", organ: "Comité de Riesgos", status: "Planificada", link: "/organos" },
  { date: "10/05/2026", organ: "Comisión de Nombramientos", status: "Planificada", link: "/organos" },
  { date: "15/05/2026", organ: "Comité de Inversiones", status: "Planificada", link: "/organos" },
];

export interface Task {
  text: string;
  due: string;
  level: "overdue" | "warning" | "normal";
}

export const personalTasks: Task[] = [
  { text: "Confirmar quórum CdA 22/04/2026", due: "20/04/2026", level: "warning" },
  { text: "Revisar borrador PR-008 (DORA)", due: "21/04/2026", level: "warning" },
  { text: "Resolver delegación caducada D. Vaz", due: "15/04/2026", level: "overdue" },
  { text: "Preparar materiales Comisión Auditoría 28/04", due: "25/04/2026", level: "normal" },
  { text: "Completar attestation anual 2026", due: "30/04/2026", level: "normal" },
];

export interface ActivityItem {
  text: string;
  time: string;
}

export const recentActivity: ActivityItem[] = [
  { text: "D. Álvaro Mendoza creó hallazgo HALL-008 (CRÍTICO)", time: "Hace 2h" },
  { text: "PR-008 enviada a aprobación del Consejo", time: "Hace 5h" },
  { text: "Delegación D. Vaz marcada como CADUCADA", time: "Hace 1d" },
  { text: "Reunión CdA 22/04 convocada por Dña. Lucía Paredes", time: "Hace 2d" },
  { text: "HALL-005 en PENDIENTE VALIDACIÓN", time: "Hace 3d" },
  { text: "Attestation anual 2026 lanzada — 25 destinatarios", time: "Hace 5d" },
];
