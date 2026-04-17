export interface Body {
  id: string;
  name: string;
  entityId: string;
  type: "Consejo" | "Comisión delegada" | "Comité ejecutivo" | "Junta General";
  regulationId: string | null;
  quorum: string;
  frequency: string;
  secretary: string;
  status: "Activo" | "Inactivo";
  nextMeetingDate?: string;
  alertsCount?: number;
}

export const bodies: Body[] = [
  { id: "consejo-administracion", name: "Consejo de Administración", entityId: "arga-seguros", type: "Consejo", regulationId: "REG-001", quorum: "mayoría absoluta (5/9)", frequency: "Mensual", secretary: "Dña. Lucía Paredes Vega", status: "Activo", nextMeetingDate: "22/04/2026", alertsCount: 4 },
  { id: "comision-auditoria", name: "Comisión de Auditoría", entityId: "arga-seguros", type: "Comisión delegada", regulationId: "REG-002", quorum: "mayoría simple (2/3)", frequency: "Trimestral", secretary: "Dña. Lucía Paredes Vega", status: "Activo", nextMeetingDate: "28/04/2026", alertsCount: 1 },
  { id: "comision-nombramientos", name: "Comisión de Nombramientos y Retribuciones", entityId: "arga-seguros", type: "Comisión delegada", regulationId: "REG-003", quorum: "mayoría simple (2/3)", frequency: "Trimestral", secretary: "Dña. Lucía Paredes Vega", status: "Activo", nextMeetingDate: "10/05/2026" },
  { id: "comision-riesgos", name: "Comisión de Riesgos", entityId: "arga-seguros", type: "Comisión delegada", regulationId: "REG-004", quorum: "mayoría simple (2/3)", frequency: "Bimestral", secretary: "Dña. Sofía Herrera Ramos", status: "Activo", nextMeetingDate: "02/05/2026" },
  { id: "comite-inversiones", name: "Comité de Inversiones", entityId: "arga-seguros", type: "Comité ejecutivo", regulationId: "REG-005", quorum: "mayoría simple (3/5)", frequency: "Mensual", secretary: "D. Ricardo Vega Sanz", status: "Activo", nextMeetingDate: "15/05/2026" },
  { id: "jga", name: "Junta General de Accionistas", entityId: "arga-seguros", type: "Junta General", regulationId: "REG-006", quorum: "25% capital social", frequency: "Anual", secretary: "Dña. Lucía Paredes Vega", status: "Activo", nextMeetingDate: "25/06/2026" },
  { id: "cda-espana", name: "Consejo de Administración ARGA España", entityId: "arga-espana", type: "Consejo", regulationId: "REG-007", quorum: "mayoría simple (3/5)", frequency: "Bimestral", secretary: "D. Javier Ruiz Montero", status: "Activo", nextMeetingDate: "06/05/2026" },
  { id: "conselho-brasil", name: "Conselho de Administração ARGA Brasil", entityId: "arga-brasil", type: "Consejo", regulationId: "REG-008", quorum: "mayoría simple (3/5)", frequency: "Trimestral", secretary: "D. André Barbosa Lima", status: "Activo", nextMeetingDate: "20/05/2026" },
  { id: "cda-mexico", name: "Consejo de Administración ARGA México", entityId: "arga-mexico", type: "Consejo", regulationId: null, quorum: "mayoría simple", frequency: "Trimestral", secretary: "Dña. Valentina Guzmán", status: "Activo" },
  { id: "cda-usa", name: "Board of Directors ARGA USA", entityId: "arga-usa", type: "Consejo", regulationId: null, quorum: "simple majority", frequency: "Quarterly", secretary: "D. Thomas Carter", status: "Activo" },
  { id: "comite-direccion", name: "Comité de Dirección del Grupo", entityId: "arga-seguros", type: "Comité ejecutivo", regulationId: "REG-009", quorum: "mayoría simple", frequency: "Semanal", secretary: "Dña. Lucía Paredes Vega", status: "Activo", nextMeetingDate: "21/04/2026" },
  { id: "comite-crisis", name: "Comité de Crisis y Resiliencia", entityId: "arga-seguros", type: "Comité ejecutivo", regulationId: null, quorum: "3 miembros mínimo", frequency: "Ad hoc", secretary: "Dña. Sofía Herrera Ramos", status: "Activo" },
  { id: "comite-esg", name: "Comité de Sostenibilidad y ESG", entityId: "arga-seguros", type: "Comité ejecutivo", regulationId: null, quorum: "mayoría simple", frequency: "Trimestral", secretary: "Dña. Pilar Castro Romero", status: "Activo", nextMeetingDate: "12/06/2026" },
  { id: "comite-digital", name: "Comité de Transformación Digital", entityId: "arga-seguros", type: "Comité ejecutivo", regulationId: null, quorum: "mayoría simple", frequency: "Mensual", secretary: "D. Roberto García Prieto", status: "Activo", nextMeetingDate: "29/04/2026" },
  { id: "cda-turquia", name: "Yönetim Kurulu (ARGA Turquía)", entityId: "arga-turquia", type: "Consejo", regulationId: null, quorum: "mayoría simple", frequency: "Trimestral", secretary: "Dña. Elif Yılmaz", status: "Activo" },
  { id: "cda-italia", name: "Consiglio di Amministrazione ARGA Italia", entityId: "arga-italia", type: "Consejo", regulationId: null, quorum: "mayoría simple", frequency: "Trimestral", secretary: "D. Marco Bianchi", status: "Activo" },
  { id: "comite-latam", name: "Comité Regional LATAM", entityId: "arga-latam", type: "Comité ejecutivo", regulationId: "REG-010", quorum: "mayoría simple (4/7)", frequency: "Mensual", secretary: "D. Carlos Eduardo Vaz", status: "Activo" },
  { id: "cda-alemania", name: "Aufsichtsrat ARGA Alemania", entityId: "arga-alemania", type: "Consejo", regulationId: null, quorum: "mayoría simple", frequency: "Trimestral", secretary: "D. Hans Müller", status: "Activo" },
];

export function getBodyById(id: string): Body | undefined {
  return bodies.find((b) => b.id === id);
}
