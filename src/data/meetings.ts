export interface AgendaItem {
  order: number;
  title: string;
  type: "Trámite" | "Informe" | "APROBACIÓN" | "Seguimiento";
  status: "PENDIENTE" | "PENDIENTE APROBACIÓN" | "APROBADO";
  relatedObject: string | null;
  notes: string | null;
}

export interface MeetingMaterial {
  id: string;
  title: string;
  type: string;
  uploadedBy: string;
  uploadedDate: string;
  status: string;
}

export interface Agreement {
  id: string;
  title: string;
  votesFor: number;
  votesAgainst: number;
  abstentions: number;
  result: string;
  relatedObject: string | null;
}

export interface Meeting {
  id: string;
  bodyId: string;
  date: string;
  time: string;
  venue: string;
  modality: "Presencial" | "Híbrida" | "Telemática";
  status: "PLANIFICADA" | "CONVOCADA" | "CELEBRADA";
  quorum: string | null;
  convener: string | null;
  convocationDate?: string;
  agenda?: AgendaItem[];
  materials?: MeetingMaterial[];
  participantsConfirmed?: string[];
  participantsPending?: string[];
  agreements?: Agreement[];
  minutesStatus?: "FIRMADA" | "BORRADOR" | "PENDIENTE";
  minutesSignedDate?: string;
  minutesSignedBy?: string;
}

export interface CdaMember {
  personId: string;
  role: string;
  type: "Ejecutivo" | "Independiente" | "Dominical" | "Invitado" | "Secretaria";
  mandateStart: string | null;
  mandateEnd: string | null;
  status: "VIGENTE" | "PRÓXIMO VENCIMIENTO" | "VENCIDO";
  confirmed: boolean;
}

export const cdaMembers: CdaMember[] = [
  { personId: "antonio-rios", role: "Presidente", type: "Ejecutivo", mandateStart: "30/04/2022", mandateEnd: "30/04/2026", status: "PRÓXIMO VENCIMIENTO", confirmed: true },
  { personId: "carmen-delgado", role: "Consejera Delegada (CEO)", type: "Ejecutivo", mandateStart: "01/07/2021", mandateEnd: "30/06/2025", status: "VENCIDO", confirmed: true },
  { personId: "maria-santos", role: "Consejera Independiente", type: "Independiente", mandateStart: "15/06/2022", mandateEnd: "15/06/2026", status: "PRÓXIMO VENCIMIENTO", confirmed: true },
  { personId: "fernando-lopez", role: "Consejero Independiente / Pte. Comisión Auditoría", type: "Independiente", mandateStart: "01/01/2023", mandateEnd: "01/01/2027", status: "VIGENTE", confirmed: false },
  { personId: "isabel-moreno", role: "Consejera Dominical", type: "Dominical", mandateStart: "01/03/2024", mandateEnd: "01/03/2028", status: "VIGENTE", confirmed: true },
  { personId: "ricardo-vega", role: "Consejero Ejecutivo / Director Inversiones", type: "Ejecutivo", mandateStart: "01/09/2023", mandateEnd: "01/09/2027", status: "VIGENTE", confirmed: true },
  { personId: "pablo-navarro", role: "Director Financiero (CFO) — invitado permanente", type: "Invitado", mandateStart: null, mandateEnd: null, status: "VIGENTE", confirmed: true },
  { personId: "sofia-herrera", role: "Directora de Riesgos (CRO) — invitada permanente", type: "Invitado", mandateStart: null, mandateEnd: null, status: "VIGENTE", confirmed: false },
  { personId: "lucia-paredes", role: "Secretaria del Consejo (sin voto)", type: "Secretaria", mandateStart: "01/01/2020", mandateEnd: null, status: "VIGENTE", confirmed: true },
];

export const meetings: Meeting[] = [
  {
    id: "cda-22-04-2026",
    bodyId: "consejo-administracion",
    date: "22/04/2026",
    time: "10:00",
    venue: "Sala del Consejo — Sede Central, Paseo de Recoletos 25, Madrid",
    modality: "Presencial",
    status: "CONVOCADA",
    quorum: "7/9 confirmados",
    convener: "Dña. Lucía Paredes Vega",
    convocationDate: "10/04/2026",
    agenda: [
      { order: 1, title: "Aprobación del acta de la sesión anterior (15/03/2026)", type: "Trámite", status: "PENDIENTE", relatedObject: null, notes: null },
      { order: 2, title: "Informe de gestión Q1 2026 — Presentación CFO", type: "Informe", status: "PENDIENTE", relatedObject: "pablo-navarro", notes: "Presentación enviada a consejeros el 17/04/2026" },
      { order: 3, title: "Aprobación de la Política de Resiliencia Operativa Digital (DORA) — PR-008", type: "APROBACIÓN", status: "PENDIENTE APROBACIÓN", relatedObject: "PR-008", notes: "Pendiente desde Q3 2025. Texto consolidado tras revisión legal." },
      { order: 4, title: "Ruegos y preguntas", type: "Trámite", status: "PENDIENTE", relatedObject: null, notes: null },
    ],
    materials: [
      { id: "MAT-001", title: "Acta sesión 15/03/2026", type: "Acta", uploadedBy: "Dña. Lucía Paredes Vega", uploadedDate: "20/03/2026", status: "DISPONIBLE" },
      { id: "MAT-002", title: "Informe de gestión Q1 2026", type: "Informe", uploadedBy: "D. Pablo Navarro", uploadedDate: "17/04/2026", status: "DISPONIBLE" },
      { id: "MAT-003", title: "Borrador PR-008 — versión consolidada", type: "Política", uploadedBy: "Dña. Elena Navarro", uploadedDate: "15/04/2026", status: "DISPONIBLE" },
      { id: "MAT-004", title: "Informe jurídico sobre PR-008", type: "Informe legal", uploadedBy: "D. Miguel Ortega", uploadedDate: "16/04/2026", status: "DISPONIBLE" },
    ],
    participantsConfirmed: ["antonio-rios", "carmen-delgado", "maria-santos", "isabel-moreno", "ricardo-vega", "pablo-navarro", "lucia-paredes"],
    participantsPending: ["fernando-lopez", "sofia-herrera"],
  },
  {
    id: "cda-15-03-2026",
    bodyId: "consejo-administracion",
    date: "15/03/2026",
    time: "10:00",
    venue: "Sala del Consejo — Sede Central",
    modality: "Presencial",
    status: "CELEBRADA",
    quorum: "8/9 asistentes",
    convener: "Dña. Lucía Paredes Vega",
    convocationDate: "01/03/2026",
    agreements: [
      { id: "AC-001", title: "Aprobación de la Política Antifraude (PR-013)", votesFor: 8, votesAgainst: 0, abstentions: 0, result: "APROBADO POR UNANIMIDAD", relatedObject: "PR-013" },
      { id: "AC-002", title: "Aprobación presupuesto Q2 2026", votesFor: 7, votesAgainst: 1, abstentions: 0, result: "APROBADO", relatedObject: null },
      { id: "AC-003", title: "Ratificación del Marco de Apetito de Riesgo 2026 (PR-025)", votesFor: 8, votesAgainst: 0, abstentions: 0, result: "APROBADO POR UNANIMIDAD", relatedObject: "PR-025" },
    ],
    minutesStatus: "FIRMADA",
    minutesSignedDate: "20/03/2026",
    minutesSignedBy: "Dña. Lucía Paredes Vega + D. Antonio Ríos Valverde",
  },
  { id: "cda-20-02-2026", bodyId: "consejo-administracion", date: "20/02/2026", time: "10:00", venue: "Sala del Consejo", modality: "Presencial", status: "CELEBRADA", quorum: "9/9 asistentes", convener: "Dña. Lucía Paredes Vega", minutesStatus: "FIRMADA", minutesSignedDate: "27/02/2026", minutesSignedBy: "Dña. Lucía Paredes Vega + D. Antonio Ríos Valverde" },
  { id: "cda-15-01-2026", bodyId: "consejo-administracion", date: "15/01/2026", time: "10:00", venue: "Sala del Consejo", modality: "Presencial", status: "CELEBRADA", quorum: "8/9 asistentes", convener: "Dña. Lucía Paredes Vega", minutesStatus: "FIRMADA", minutesSignedDate: "22/01/2026", minutesSignedBy: "Dña. Lucía Paredes Vega + D. Antonio Ríos Valverde" },
  { id: "cda-12-12-2025", bodyId: "consejo-administracion", date: "12/12/2025", time: "10:00", venue: "Sala del Consejo", modality: "Presencial", status: "CELEBRADA", quorum: "9/9 asistentes", convener: "Dña. Lucía Paredes Vega", minutesStatus: "FIRMADA", minutesSignedDate: "19/12/2025", minutesSignedBy: "Dña. Lucía Paredes Vega + D. Antonio Ríos Valverde" },
  {
    id: "audit-28-04-2026",
    bodyId: "comision-auditoria",
    date: "28/04/2026",
    time: "09:30",
    venue: "Sala de Reuniones 3A — Sede Central",
    modality: "Presencial",
    status: "CONVOCADA",
    quorum: "3/3 confirmados",
    convener: "D. Fernando López Aguirre",
    agenda: [
      { order: 1, title: "Revisión del plan de auditoría Q2 2026", type: "Informe", status: "PENDIENTE", relatedObject: null, notes: null },
      { order: 2, title: "Seguimiento de hallazgos críticos — HALL-008", type: "Seguimiento", status: "PENDIENTE", relatedObject: "HALL-008", notes: null },
      { order: 3, title: "Informe auditor externo Q1 2026", type: "Informe", status: "PENDIENTE", relatedObject: null, notes: null },
    ],
  },
  { id: "riesgos-02-05-2026", bodyId: "comision-riesgos", date: "02/05/2026", time: "10:00", venue: "Sala del Consejo", modality: "Híbrida", status: "PLANIFICADA", quorum: null, convener: null },
  { id: "inversiones-15-05-2026", bodyId: "comite-inversiones", date: "15/05/2026", time: "11:00", venue: "Sala de Reuniones 2B", modality: "Presencial", status: "PLANIFICADA", quorum: null, convener: null },
];

export function getMeetingById(id: string): Meeting | undefined {
  return meetings.find((m) => m.id === id);
}

export function getMeetingsByBody(bodyId: string): Meeting[] {
  return meetings.filter((m) => m.bodyId === bodyId);
}
