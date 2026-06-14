// W3-F3 — Validador de COMPLETITUD por flujo de Secretaría (lógica pura).
// ============================================================================
// Dada la foto de datos de una sociedad (counts/flags por tabla relevante),
// determina, para cada flujo del módulo Secretaría, si está "ready" (datos de
// partida completos para recorrerlo end-to-end), "partial" (navegable pero con
// huecos) o "unavailable" (no aplica / faltan cimientos). No consulta la BD: es
// pura para poder testearse y reutilizarse en scripts de verificación y UI.

export type SecretariaFlow =
  | "convocatoria_reunion_acta_certificacion"
  | "tramitador_registral"
  | "acuerdo_sin_sesion"
  | "co_aprobacion"
  | "solidario"
  | "decision_unipersonal"
  | "libros_legalizacion"
  | "sociedades_personas_cargos"
  | "board_pack";

export type FlowStatus = "ready" | "partial" | "unavailable";

export type EntityFlowInput = {
  /** CDA | ADMIN_UNICO | ADMIN_SOLIDARIOS | ADMIN_MANCOMUNADOS | ... */
  tipoOrganoAdmin?: string | null;
  esUnipersonal?: boolean | null;
  hasVigenteCapitalProfile?: boolean;
  capTableSumsTo100?: boolean;
  bodies?: number;
  /** condiciones_persona vigentes (cargos/miembros) */
  activePositions?: number;
  /** administradores vigentes (para co-aprobación/solidario: se exigen >= 2) */
  activeAdmins?: number;
  authorityEvidence?: number;
  meetingsCelebradas?: number;
  /** reuniones con censo_snapshot (debe ser >= meetingsCelebradas para flujo completo) */
  meetingsWithCenso?: number;
  minutes?: number;
  certifications?: number;
  convocatorias?: number;
  registryFilings?: number;
  noSessionResolutions?: number;
  unipersonalDecisions?: number;
  mandatoryBooks?: number;
  agreements?: number;
};

export type FlowReadiness = {
  flow: SecretariaFlow;
  status: FlowStatus;
  reasons: string[];
};

const n = (x?: number) => (typeof x === "number" && x > 0 ? x : 0);
const admin = (input: EntityFlowInput) => String(input.tipoOrganoAdmin ?? "").toUpperCase();

/** Cimientos mínimos de identidad para cualquier flujo societario. El cap table,
 *  si existe, debe cuadrar al 100% (capTableSumsTo100 !== false). */
function hasFoundations(input: EntityFlowInput): boolean {
  return (
    !!input.hasVigenteCapitalProfile &&
    input.capTableSumsTo100 !== false &&
    n(input.bodies) > 0 &&
    n(input.activePositions) > 0
  );
}

function assessOne(flow: SecretariaFlow, input: EntityFlowInput): FlowReadiness {
  const reasons: string[] = [];
  const foundations = hasFoundations(input);
  if (!foundations) {
    if (!input.hasVigenteCapitalProfile) reasons.push("sin perfil de capital vigente");
    if (input.capTableSumsTo100 === false) reasons.push("cap table no suma 100%");
    if (n(input.bodies) === 0) reasons.push("sin órganos");
    if (n(input.activePositions) === 0) reasons.push("sin cargos vigentes");
  }

  const ready = (): FlowReadiness => ({ flow, status: "ready", reasons });
  const partial = (why: string[]): FlowReadiness => ({ flow, status: "partial", reasons: [...reasons, ...why] });
  const unavailable = (why: string[]): FlowReadiness => ({ flow, status: "unavailable", reasons: why });

  switch (flow) {
    case "sociedades_personas_cargos":
      // El más básico: necesita identidad + cargos. No exige sesiones.
      return foundations && n(input.authorityEvidence) > 0
        ? ready()
        : partial(n(input.authorityEvidence) === 0 ? ["sin evidencia de autoridad certificante"] : []);

    case "libros_legalizacion":
      if (n(input.mandatoryBooks) === 0) return unavailable(["sin libros obligatorios calculados"]);
      return ready();

    case "convocatoria_reunion_acta_certificacion": {
      if (!foundations) return partial([]);
      const why: string[] = [];
      if (n(input.convocatorias) === 0) why.push("sin convocatorias");
      if (n(input.meetingsCelebradas) === 0) why.push("sin reuniones celebradas");
      if (n(input.meetingsWithCenso) < n(input.meetingsCelebradas)) why.push("reuniones celebradas sin censo");
      if (n(input.minutes) === 0) why.push("sin actas");
      if (n(input.certifications) === 0) why.push("sin certificaciones");
      return why.length === 0 ? ready() : partial(why);
    }

    case "tramitador_registral":
      if (!foundations) return partial([]);
      return n(input.registryFilings) > 0 ? ready() : partial(["sin expedientes registrales"]);

    case "acuerdo_sin_sesion":
      if (!foundations) return partial([]);
      return n(input.noSessionResolutions) > 0 ? ready() : partial(["sin resoluciones sin sesión"]);

    case "co_aprobacion":
      if (admin(input) !== "ADMIN_MANCOMUNADOS") return unavailable(["la sociedad no tiene administración mancomunada"]);
      if (!foundations) return partial([]);
      return n(input.activeAdmins) >= 2 ? ready() : partial(["requiere ≥2 administradores mancomunados vigentes"]);

    case "solidario":
      if (admin(input) !== "ADMIN_SOLIDARIOS") return unavailable(["la sociedad no tiene administración solidaria"]);
      if (!foundations) return partial([]);
      return n(input.activeAdmins) >= 2 ? ready() : partial(["requiere ≥2 administradores solidarios vigentes"]);

    case "decision_unipersonal":
      if (!input.esUnipersonal) return unavailable(["la sociedad no es unipersonal"]);
      if (!foundations) return partial([]);
      return n(input.unipersonalDecisions) > 0 ? ready() : partial(["sin decisiones unipersonales"]);

    case "board_pack":
      if (!foundations) return partial([]);
      return admin(input) === "CDA" && n(input.agreements) > 0 && n(input.meetingsCelebradas) > 0
        ? ready()
        : admin(input) !== "CDA"
          ? unavailable(["el board pack aplica a sociedades con Consejo de Administración"])
          : partial(n(input.agreements) === 0 ? ["sin acuerdos"] : ["sin reuniones celebradas"]);
  }
}

const ALL_FLOWS: SecretariaFlow[] = [
  "sociedades_personas_cargos",
  "libros_legalizacion",
  "convocatoria_reunion_acta_certificacion",
  "tramitador_registral",
  "acuerdo_sin_sesion",
  "co_aprobacion",
  "solidario",
  "decision_unipersonal",
  "board_pack",
];

export function assessFlowCompleteness(input: EntityFlowInput): FlowReadiness[] {
  return ALL_FLOWS.map((flow) => assessOne(flow, input));
}

/** Resumen: nº de flujos ready/partial/unavailable y si la sociedad es "demo-ready"
 *  (al menos los flujos aplicables clave en ready). */
export function summarizeFlowCompleteness(input: EntityFlowInput) {
  const flows = assessFlowCompleteness(input);
  const ready = flows.filter((f) => f.status === "ready").length;
  const partial = flows.filter((f) => f.status === "partial").length;
  const unavailable = flows.filter((f) => f.status === "unavailable").length;
  // "demo-ready" = cimientos + el flujo nuclear de reunión/acta/cert en ready.
  const core = flows.find((f) => f.flow === "convocatoria_reunion_acta_certificacion");
  const demoReady = hasFoundations(input) && core?.status === "ready";
  return { ready, partial, unavailable, demoReady, flows };
}
