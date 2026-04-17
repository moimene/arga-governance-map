export type NotifType = "critical" | "warning" | "info";

export interface Notification {
  id: number;
  text: string;
  time: string;
  type: NotifType;
  read: boolean;
}

export const notifications: Notification[] = [
  { id: 1, text: "HALL-008: Hallazgo CRÍTICO asignado — conflicto de interés ARGA Brasil", time: "Hace 2 horas", type: "critical", read: false },
  { id: 2, text: "Reunión CdA 22/04/2026: 2 confirmaciones pendientes", time: "Hace 3 horas", type: "warning", read: false },
  { id: 3, text: "PR-003: Revisión pendiente — vence 30/04/2026", time: "Hace 5 horas", type: "warning", read: false },
  { id: 4, text: "Delegación D. Carlos Eduardo Vaz: CADUCADA desde 15/04/2026", time: "Hace 1 día", type: "critical", read: false },
  { id: 5, text: "Excepción regulatoria ARGA Turquía: vence 22/04/2026", time: "Hace 1 día", type: "warning", read: false },
  { id: 6, text: "OBL-DORA-003 sin control asignado — acción requerida", time: "Hace 2 días", type: "critical", read: false },
  { id: 7, text: "Attestation anual 2026: 12 personas pendientes de completar", time: "Hace 3 días", type: "info", read: true },
];
