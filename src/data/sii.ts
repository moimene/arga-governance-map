export interface SiiAction { date: string; action: string; actor: string }
export interface SiiEvidence { id: string; title: string; type: string; status: string }

export interface SiiCase {
  id: string;
  receivedDate: string;
  channel: string;
  category: string;
  status: string;
  investigator: string;
  summary: string;
  relatedFinding: string | null;
  confidentiality: string;
  closedDate?: string;
  closingReason?: string;
  actions: SiiAction[];
  evidences: SiiEvidence[];
}

export const siiCases: SiiCase[] = [
  {
    id: "CASO-SII-001",
    receivedDate: "10/04/2026",
    channel: "Canal web anónimo",
    category: "Conflicto de interés / Operación irregular",
    status: "EN INVESTIGACIÓN ACTIVA",
    investigator: "Dña. Elena Navarro Pons",
    summary: "Denuncia sobre posible conflicto de interés en decisión de inversión inmobiliaria en filial brasileña. El denunciante indica que un directivo con interés personal habría participado activamente en la decisión sin declarar el conflicto.",
    relatedFinding: "HALL-008",
    confidentiality: "MÁXIMA — solo accesible a Investigadora SII y Presidencia Comisión Auditoría",
    actions: [
      { date: "10/04/2026", action: "Caso recibido y registrado", actor: "Sistema SII" },
      { date: "10/04/2026", action: "Asignado a Dña. Elena Navarro (Investigadora SII)", actor: "Sistema SII" },
      { date: "11/04/2026", action: "Comunicación de acuse de recibo al denunciante (anónimo — no procede)", actor: "Dña. Elena Navarro" },
      { date: "14/04/2026", action: "Solicitud de documentación a Auditoría Interna — HALL-008 correlacionado", actor: "Dña. Elena Navarro" },
      { date: "17/04/2026", action: "Documentación recibida. Investigación en curso.", actor: "Dña. Elena Navarro" },
    ],
    evidences: [
      { id: "EV-SII-001-A", title: "Transcripción denuncia original (cifrada)", type: "Denuncia", status: "CIFRADO" },
      { id: "EV-SII-001-B", title: "Documentación operación inmobiliaria Brasil", type: "Documentación interna", status: "CIFRADO" },
      { id: "EV-SII-001-C", title: "Extracto HALL-008 (correlación)", type: "Hallazgo interno", status: "CIFRADO" },
    ],
  },
  {
    id: "CASO-SII-002",
    receivedDate: "02/03/2026",
    channel: "Correo electrónico confidencial",
    category: "Irregularidad proceso de selección de proveedor",
    status: "EN ANÁLISIS PRELIMINAR",
    investigator: "Dña. Elena Navarro Pons",
    summary: "Comunicación confidencial sobre posible irregularidad en proceso de licitación de servicios TIC. Se alega favoritismo en la adjudicación.",
    relatedFinding: null,
    confidentiality: "ALTA",
    actions: [
      { date: "02/03/2026", action: "Caso recibido", actor: "Sistema SII" },
      { date: "03/03/2026", action: "Asignado a Dña. Elena Navarro", actor: "Sistema SII" },
      { date: "10/03/2026", action: "Revisión preliminar — pendiente solicitud documentación", actor: "Dña. Elena Navarro" },
    ],
    evidences: [
      { id: "EV-SII-002-A", title: "Comunicación confidencial original (cifrada)", type: "Denuncia", status: "CIFRADO" },
    ],
  },
  {
    id: "CASO-SII-003",
    receivedDate: "15/11/2025",
    channel: "Canal web anónimo",
    category: "Presunta manipulación de actas",
    status: "CERRADO — INSUFICIENTE EVIDENCIA",
    investigator: "Dña. Elena Navarro Pons",
    summary: "Denuncia sobre presunta alteración retroactiva de actas de un órgano colegiado. Investigación concluida sin evidencia suficiente para sustentar los hechos denunciados.",
    relatedFinding: null,
    confidentiality: "ALTA",
    closedDate: "15/01/2026",
    closingReason: "Investigación exhaustiva completada. No se han encontrado evidencias que sustenten los hechos denunciados. Actas verificadas por auditor externo. Caso archivado conforme al procedimiento.",
    actions: [
      { date: "15/11/2025", action: "Caso recibido y registrado", actor: "Sistema SII" },
      { date: "16/11/2025", action: "Asignado a Dña. Elena Navarro", actor: "Sistema SII" },
      { date: "01/12/2025", action: "Revisión de actas con auditor externo iniciada", actor: "Dña. Elena Navarro" },
      { date: "10/01/2026", action: "Informe auditor externo recibido — sin irregularidades", actor: "Dña. Elena Navarro" },
      { date: "15/01/2026", action: "Caso cerrado por insuficiencia de evidencia", actor: "Dña. Elena Navarro" },
    ],
    evidences: [
      { id: "EV-SII-003-A", title: "Informe auditor externo verificación actas", type: "Informe externo", status: "CIFRADO" },
    ],
  },
];

export const getSiiCaseById = (id: string) => siiCases.find((c) => c.id === id);
