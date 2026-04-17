export interface DelegationHistoryEntry {
  date: string;
  event: string;
  kind?: "alert-unattended" | "expired" | "action" | "info";
}

export interface Delegation {
  id: string;
  code: string;
  grantedTo: string;
  entityId: string;
  scope: string;
  grantedBy: string;
  grantedDate: string;
  expirationDate: string;
  status: "VIGENTE" | "PRÓXIMA VENCIMIENTO" | "CADUCADA" | "REVOCADA";
  findingId: string | null;
  powers?: string[];
  history: DelegationHistoryEntry[];
  revokedDate?: string;
  revokedReason?: string;
}

export const delegations: Delegation[] = [
  {
    id: "carlos-vaz-latam", code: "DEL-001", grantedTo: "D. Carlos Eduardo Vaz", entityId: "arga-latam",
    scope: "Dirección General Regional LATAM — poderes de representación y administración ordinaria",
    grantedBy: "D. Antonio Ríos Valverde (Presidente CdA)", grantedDate: "15/04/2022", expirationDate: "15/04/2026",
    status: "CADUCADA", findingId: "HALL-003",
    powers: [
      "Representación legal ARGA LATAM Holdings S.L.",
      "Firma de contratos hasta €5.000.000",
      "Apertura y gestión de cuentas bancarias regionales",
      "Representación ante organismos regulatorios de Brasil, México, Colombia, Perú, Argentina y Chile",
    ],
    history: [
      { date: "15/04/2022", event: "Delegación otorgada por Consejo de Administración", kind: "action" },
      { date: "15/01/2026", event: "Alerta T-90 generada por el sistema — sin respuesta registrada", kind: "alert-unattended" },
      { date: "15/02/2026", event: "Alerta T-60 generada por el sistema — sin respuesta registrada", kind: "alert-unattended" },
      { date: "15/03/2026", event: "Alerta T-30 generada por el sistema — sin respuesta registrada", kind: "alert-unattended" },
      { date: "15/04/2026", event: "DELEGACIÓN CADUCADA — sin renovación ni revocación formal", kind: "expired" },
      { date: "17/04/2026", event: "HALL-003 creado por Auditoría Interna — D. Miguel Ortega notificado", kind: "action" },
    ],
  },
  {
    id: "rodrigo-almeida-latam", code: "DEL-002", grantedTo: "D. Rodrigo Almeida Ferreira", entityId: "arga-latam",
    scope: "Poderes financieros LATAM — firma de operaciones financieras hasta €2.000.000",
    grantedBy: "D. Antonio Ríos Valverde", grantedDate: "01/07/2023", expirationDate: "30/06/2026",
    status: "PRÓXIMA VENCIMIENTO", findingId: null,
    powers: ["Firma operaciones bancarias hasta €2.000.000", "Representación ante entidades financieras LATAM"],
    history: [
      { date: "01/07/2023", event: "Delegación otorgada", kind: "action" },
      { date: "01/04/2026", event: "Alerta T-90 enviada al titular", kind: "info" },
    ],
  },
  {
    id: "ignacio-fuentes-espana", code: "DEL-003", grantedTo: "D. Ignacio Fuentes Torres", entityId: "arga-espana",
    scope: "Dirección Comercial España — poderes de contratación hasta €1.000.000",
    grantedBy: "Dña. Carmen Delgado (CEO)", grantedDate: "15/07/2023", expirationDate: "15/07/2026",
    status: "PRÓXIMA VENCIMIENTO", findingId: null,
    powers: ["Firma contratos comerciales hasta €1.000.000", "Representación en negociaciones con distribuidores"],
    history: [
      { date: "15/07/2023", event: "Delegación otorgada", kind: "action" },
      { date: "15/04/2026", event: "Alerta T-90 enviada", kind: "info" },
    ],
  },
  {
    id: "andre-barbosa-brasil", code: "DEL-004", grantedTo: "D. André Barbosa Lima", entityId: "arga-brasil",
    scope: "Poderes generales CEO ARGA Brasil — representación y administración",
    grantedBy: "D. Antonio Ríos Valverde", grantedDate: "01/03/2025", expirationDate: "01/03/2028",
    status: "VIGENTE", findingId: null,
    powers: ["Representación legal ARGA Brasil", "Firma contratos hasta R$50.000.000", "Representación ante SUSEP (regulador Brasil)"],
    history: [{ date: "01/03/2025", event: "Delegación otorgada por Consejo de Administración", kind: "action" }],
  },
  {
    id: "valentina-guzman-mexico", code: "DEL-005", grantedTo: "Dña. Valentina Guzmán Reyes", entityId: "arga-mexico",
    scope: "Poderes generales CEO ARGA México",
    grantedBy: "D. Antonio Ríos Valverde", grantedDate: "01/01/2024", expirationDate: "01/01/2027",
    status: "VIGENTE", findingId: null,
    powers: ["Representación legal ARGA México", "Firma contratos hasta MXN$100.000.000", "Representación ante CNSF (regulador México)"],
    history: [{ date: "01/01/2024", event: "Delegación otorgada", kind: "action" }],
  },
  {
    id: "thomas-carter-usa", code: "DEL-006", grantedTo: "D. Thomas Carter", entityId: "arga-usa",
    scope: "General powers — CEO ARGA USA",
    grantedBy: "D. Antonio Ríos Valverde", grantedDate: "01/03/2023", expirationDate: "01/03/2028",
    status: "VIGENTE", findingId: null,
    powers: ["Full legal representation ARGA USA", "Contracts up to USD $20.000.000"],
    history: [{ date: "01/03/2023", event: "Delegation granted", kind: "action" }],
  },
  {
    id: "elif-yilmaz-turquia", code: "DEL-007", grantedTo: "Dña. Elif Yılmaz", entityId: "arga-turquia",
    scope: "Poderes generales CEO ARGA Turquía — representación y administración",
    grantedBy: "D. Antonio Ríos Valverde", grantedDate: "01/01/2024", expirationDate: "01/01/2027",
    status: "VIGENTE", findingId: null,
    powers: ["Representación legal ARGA Turquía", "Firma contratos hasta TRY 50.000.000", "Representación ante SEDDK (regulador turco)"],
    history: [{ date: "01/01/2024", event: "Delegación otorgada", kind: "action" }],
  },
  {
    id: "javier-ruiz-espana", code: "DEL-008", grantedTo: "D. Javier Ruiz Montero", entityId: "arga-espana",
    scope: "Secretaría local ARGA España — firma de actas y documentos corporativos",
    grantedBy: "Dña. Lucía Paredes Vega", grantedDate: "01/01/2024", expirationDate: "31/12/2026",
    status: "VIGENTE", findingId: null,
    powers: ["Firma y certificación de actas ARGA España", "Representación en notarías y registros"],
    history: [{ date: "01/01/2024", event: "Delegación otorgada", kind: "action" }],
  },
  {
    id: "elena-navarro-cumplimiento", code: "DEL-009", grantedTo: "Dña. Elena Navarro Pons", entityId: "arga-seguros",
    scope: "Firma de comunicaciones regulatorias de Cumplimiento ante supervisores",
    grantedBy: "Dña. Carmen Delgado (CEO)", grantedDate: "01/06/2024", expirationDate: "31/05/2027",
    status: "VIGENTE", findingId: null,
    powers: ["Firma de informes ante DGS / Banco de España", "Representación en inspecciones regulatorias"],
    history: [{ date: "01/06/2024", event: "Delegación otorgada", kind: "action" }],
  },
  {
    id: "marco-bianchi-europa", code: "DEL-010", grantedTo: "D. Marco Bianchi", entityId: "arga-italia",
    scope: "Director Regional Europa — coordinación y representación filiales europeas",
    grantedBy: "D. Antonio Ríos Valverde", grantedDate: "01/09/2024", expirationDate: "01/09/2027",
    status: "VIGENTE", findingId: null,
    powers: ["Coordinación y supervisión filiales Italia, Portugal, Alemania, Malta", "Representación ante reguladores europeos"],
    history: [{ date: "01/09/2024", event: "Delegación otorgada", kind: "action" }],
  },
  {
    id: "carmen-delgado-poderes-ant", code: "DEL-011", grantedTo: "Dña. Carmen Delgado Ortiz", entityId: "arga-seguros",
    scope: "Poderes generales CEO — REVOCADA por renovación mandato",
    grantedBy: "D. Antonio Ríos Valverde", grantedDate: "01/07/2018", expirationDate: "30/06/2025",
    status: "REVOCADA", revokedDate: "01/07/2025", revokedReason: "Renovación y sustitución por DEL-012", findingId: null,
    history: [
      { date: "01/07/2018", event: "Delegación otorgada", kind: "action" },
      { date: "01/07/2025", event: "Delegación revocada formalmente — sustituida", kind: "action" },
    ],
  },
  {
    id: "miguel-ortega-procesales", code: "DEL-012", grantedTo: "D. Miguel Ortega Sánchez", entityId: "arga-seguros",
    scope: "Poderes procesales generales — REVOCADA por reorganización legal",
    grantedBy: "Dña. Carmen Delgado (CEO)", grantedDate: "15/03/2020", expirationDate: "15/03/2024",
    status: "REVOCADA", revokedDate: "01/01/2024", revokedReason: "Reorganización del área jurídica — poderes reasignados individualmente", findingId: null,
    history: [
      { date: "15/03/2020", event: "Delegación otorgada", kind: "action" },
      { date: "01/01/2024", event: "Delegación revocada — área jurídica reorganizada", kind: "action" },
    ],
  },
];
