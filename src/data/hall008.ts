export interface CorrectiveAction {
  id: string;
  findingId: string;
  title: string;
  responsible: string;
  dueDate: string;
  status: "PENDIENTE" | "EN CURSO" | "COMPLETADA";
  priority: "URGENTE" | "ALTA" | "MEDIA" | "BAJA";
  note?: string;
}

export const hall008Actions: CorrectiveAction[] = [
  { id: "ACC-H008-001", findingId: "HALL-008", title: "Declaración formal de conflicto de interés por D. André Barbosa Lima", responsible: "D. André Barbosa Lima", dueDate: "20/04/2026", status: "PENDIENTE", priority: "URGENTE" },
  { id: "ACC-H008-002", findingId: "HALL-008", title: "Suspensión preventiva de la operación inmobiliaria hasta resolución", responsible: "Dña. Carmen Delgado Ortiz (CEO)", dueDate: "22/04/2026", status: "EN CURSO", priority: "URGENTE" },
  { id: "ACC-H008-003", findingId: "HALL-008", title: "Revisión y actualización de PR-006 (Política de Conflictos de Interés)", responsible: "Dña. Elena Navarro Pons", dueDate: "30/04/2026", status: "PENDIENTE", priority: "ALTA" },
  { id: "ACC-H008-004", findingId: "HALL-008", title: "Informe al Consejo de Administración sobre el hallazgo HALL-008", responsible: "D. Álvaro Mendoza Torres", dueDate: "22/04/2026", status: "EN CURSO", priority: "URGENTE", note: "Presentación prevista en sesión CdA 22/04/2026 — punto 3b de agenda" },
];

export const hall008Timeline = [
  { date: "19/04/2026 09:15", event: "HALL-008 creado por D. Álvaro Mendoza Torres", actor: "D. Álvaro Mendoza" },
  { date: "19/04/2026 09:16", event: "HALL-008 asignado como responsable a D. Álvaro Mendoza (investigación)", actor: "Sistema" },
  { date: "19/04/2026 10:00", event: "4 acciones correctivas creadas", actor: "D. Álvaro Mendoza" },
  { date: "19/04/2026 10:30", event: "Dña. Carmen Delgado notificada — ACC-H008-002 asignada", actor: "Sistema" },
  { date: "19/04/2026 11:00", event: "CASO-SII-001 correlacionado con HALL-008", actor: "Dña. Elena Navarro" },
];
