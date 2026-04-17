import type { Scope } from "./scopes";

export interface ScopeAlert {
  id: string;
  label: string;
  text: string;
  tone: "critical" | "warning";
  to: string;
}

export interface ScopeKpis {
  entidades: number;
  mandatosVencimiento: number;
  politicasPendientes: number;
  hallazgosAbiertos: number;
  excepcionesActivas: number;
  alertas: ScopeAlert[];
}

const A = {
  "HALL-008": { id: "HALL-008", label: "CRÍTICA", text: "Conflicto de interés no declarado — inversión inmobiliaria ARGA Brasil", tone: "critical" as const, to: "/hallazgos/HALL-008" },
  "HALL-003": { id: "HALL-003", label: "ALTA", text: "Delegación caducada — D. Carlos Eduardo Vaz (Director Regional LATAM)", tone: "critical" as const, to: "/hallazgos/HALL-003" },
  "HALL-001": { id: "HALL-001", label: "ALTA", text: "Control CTR-004 deficiente — vencimiento de mandatos", tone: "critical" as const, to: "/hallazgos/HALL-001" },
  "HALL-004": { id: "HALL-004", label: "MEDIA", text: "Política PR-003 sin revisión en plazo (España)", tone: "warning" as const, to: "/hallazgos/HALL-004" },
  "HALL-010": { id: "HALL-010", label: "EN REVISIÓN", text: "Excepción regulatoria de Turquía vencida — 22/04/2026", tone: "warning" as const, to: "/hallazgos/HALL-010" },
  "OBL-DORA-003": { id: "OBL-DORA-003", label: "SIN CONTROL", text: "Resiliencia operativa digital — sin control específico asignado", tone: "critical" as const, to: "/obligaciones/OBL-DORA-003" },
};

export const scopeData: Record<Scope, ScopeKpis> = {
  "Grupo ARGA (Global)": {
    entidades: 25, mandatosVencimiento: 7, politicasPendientes: 4, hallazgosAbiertos: 10, excepcionesActivas: 2,
    alertas: [A["HALL-008"], A["HALL-003"], A["OBL-DORA-003"], A["HALL-010"]],
  },
  "España": {
    entidades: 7, mandatosVencimiento: 4, politicasPendientes: 4, hallazgosAbiertos: 5, excepcionesActivas: 0,
    alertas: [A["HALL-001"], A["HALL-004"], A["OBL-DORA-003"]],
  },
  "LATAM": {
    entidades: 6, mandatosVencimiento: 2, politicasPendientes: 2, hallazgosAbiertos: 3, excepcionesActivas: 0,
    alertas: [A["HALL-003"], A["HALL-008"]],
  },
  "Brasil": {
    entidades: 1, mandatosVencimiento: 0, politicasPendientes: 2, hallazgosAbiertos: 2, excepcionesActivas: 0,
    alertas: [A["HALL-008"]],
  },
  "México": {
    entidades: 1, mandatosVencimiento: 1, politicasPendientes: 2, hallazgosAbiertos: 1, excepcionesActivas: 0,
    alertas: [],
  },
  "Turquía": {
    entidades: 1, mandatosVencimiento: 0, politicasPendientes: 1, hallazgosAbiertos: 2, excepcionesActivas: 1,
    alertas: [A["HALL-010"]],
  },
  "Europa": {
    entidades: 5, mandatosVencimiento: 1, politicasPendientes: 1, hallazgosAbiertos: 1, excepcionesActivas: 0,
    alertas: [],
  },
  "Asia-Pacífico": {
    entidades: 2, mandatosVencimiento: 0, politicasPendientes: 1, hallazgosAbiertos: 0, excepcionesActivas: 0,
    alertas: [],
  },
  "EE.UU.": {
    entidades: 1, mandatosVencimiento: 0, politicasPendientes: 1, hallazgosAbiertos: 0, excepcionesActivas: 0,
    alertas: [],
  },
};
