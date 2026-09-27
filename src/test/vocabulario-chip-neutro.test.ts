import { describe, it, expect } from "bun:test";
import {
  ESTADOS_SISTEMA,
  NIVELES_RIESGO,
  ESTADOS_EVALUACION,
  ESTADOS_EVALUACION_LEGADO,
  SEVERIDADES_INCIDENTE,
  ESTADOS_INCIDENTE,
  normalizeAimsStatus,
  CHIP_ESTADO_SISTEMA,
  CLASE_NIVEL_RIESGO,
  CHIP_ESTADO_EVALUACION,
  CHIP_SEVERIDAD,
  CHIP_ESTADO_INCIDENTE,
} from "@/lib/aims/vocabulario";
import {
  SEVERITY_OPTIONS,
  SEVERITY_CHIP,
  INCIDENT_STATUS_CHIP,
  NOTIFICATION_STATUS_CHIP,
  EXCEPTION_STATUS_CHIP,
  VULNERABILITY_STATUS_CHIP,
  ACTION_PLAN_STATUS_CHIP,
  DSAR_STATUS_CHIP,
  DPIA_STATUS_CHIP,
  RISK_LEVEL_CHIP,
} from "@/lib/grc/status-labels";

/**
 * MOI-161 — decisión D-03 (b): cada módulo conserva su lista de estados;
 * ninguno se unifica. Este gate es TRANSVERSAL en el sentido que pide el
 * issue: recorre los dominios de AIMS y de GRC (los dos módulos cuyo helper
 * de chip tiene un fallback "neutro" literal para lo desconocido) y falla si
 * ALGÚN estado declarado como conocido en el vocabulario propio del módulo no
 * tiene una entrada EXPLÍCITA en su mapa de chip.
 *
 * POR QUÉ "entrada explícita" y no "el chip no es neutro". Varios estados son
 * neutros A PROPÓSITO (RETIRADO/PLANIFICADO en AIMS; Cerrado/Medio/Bajo/
 * Aceptada/Expirada en GRC) — mismo string de clase que el fallback. Comparar
 * el resultado no distingue "declarado como neutro" de "olvidado y caído al
 * fallback": ambos pintan igual. Sólo la pertenencia AL MAPA distingue las dos
 * cosas, así que el gate usa `hasOwnProperty`, no `!== NEUTRO`.
 *
 * Secretaría queda fuera de este gate: sus dos mapas de estado
 * (`status-labels.ts`, `evidence-status-labels.ts`) no tienen un chip
 * "neutro" con este patrón de fallback compartido — el primero devuelve el
 * valor crudo y el segundo cae a un tono "warning" declarado (entorno de
 * validación funcional), no a un gris neutro. Ver contexto técnico del issue.
 */

type Caso = {
  modulo: string;
  dominio: string;
  valores: readonly string[];
  mapa: Record<string, string>;
  clave: (v: string) => string;
};

const CASOS: Caso[] = [
  // ── AIMS (src/lib/aims/vocabulario.ts) ──────────────────────────────────
  { modulo: "AIMS", dominio: "estadoSistema", valores: ESTADOS_SISTEMA, mapa: CHIP_ESTADO_SISTEMA, clave: normalizeAimsStatus },
  { modulo: "AIMS", dominio: "nivelRiesgo", valores: NIVELES_RIESGO, mapa: CLASE_NIVEL_RIESGO, clave: (v) => v },
  {
    modulo: "AIMS",
    dominio: "estadoEvaluacion",
    valores: [...ESTADOS_EVALUACION, ...ESTADOS_EVALUACION_LEGADO],
    mapa: CHIP_ESTADO_EVALUACION,
    clave: normalizeAimsStatus,
  },
  { modulo: "AIMS", dominio: "severidad", valores: SEVERIDADES_INCIDENTE, mapa: CHIP_SEVERIDAD, clave: normalizeAimsStatus },
  { modulo: "AIMS", dominio: "estadoIncidente", valores: ESTADOS_INCIDENTE, mapa: CHIP_ESTADO_INCIDENTE, clave: normalizeAimsStatus },

  // ── GRC (src/lib/grc/status-labels.ts) ──────────────────────────────────
  // SEVERITY_OPTIONS es un array declarado independiente del mapa: sirve de
  // control real (una entrada podría faltar en el mapa sin que el array lo
  // note). Los demás dominios de GRC no tienen un array así de independiente,
  // así que el "conocido" es la foto congelada aquí abajo — igual que hace
  // `vocabulario-unico.test.ts` con `ESTADOS_SISTEMA` en su control positivo.
  { modulo: "GRC", dominio: "severidad", valores: SEVERITY_OPTIONS, mapa: SEVERITY_CHIP, clave: (v) => v },
  {
    modulo: "GRC",
    dominio: "estadoIncidente",
    valores: ["Abierto", "En contención", "En investigación", "Resuelto", "Cerrado"],
    mapa: INCIDENT_STATUS_CHIP,
    clave: (v) => v,
  },
  {
    modulo: "GRC",
    dominio: "estadoNotificacion",
    valores: ["Pendiente", "Enviada", "Aceptada", "Rechazada"],
    mapa: NOTIFICATION_STATUS_CHIP,
    clave: (v) => v,
  },
  {
    modulo: "GRC",
    dominio: "estadoExcepcion",
    valores: ["Pendiente", "Aprobada", "Rechazada", "Expirada"],
    mapa: EXCEPTION_STATUS_CHIP,
    clave: (v) => v,
  },
  {
    modulo: "GRC",
    dominio: "estadoVulnerabilidad",
    valores: ["Abierta", "En mitigación", "Parcheada", "Aceptada"],
    mapa: VULNERABILITY_STATUS_CHIP,
    clave: (v) => v,
  },
  {
    modulo: "GRC",
    dominio: "estadoPlanAccion",
    valores: ["Abierto", "En curso", "Cerrado"],
    mapa: ACTION_PLAN_STATUS_CHIP,
    clave: (v) => v,
  },
  { modulo: "GRC", dominio: "estadoDsar", valores: ["En curso", "Resuelto", "Pendiente"], mapa: DSAR_STATUS_CHIP, clave: (v) => v },
  {
    modulo: "GRC",
    dominio: "estadoDpia",
    valores: ["Aprobada", "En revisión", "Rechazada"],
    mapa: DPIA_STATUS_CHIP,
    clave: (v) => v,
  },
  { modulo: "GRC", dominio: "nivelRiesgo", valores: ["Alto", "Medio", "Bajo"], mapa: RISK_LEVEL_CHIP, clave: (v) => v },
];

describe("control positivo del instrumento", () => {
  it("hay más de un módulo y más de un dominio por módulo (si no, el bucle de abajo sería vacuo)", () => {
    const modulos = new Set(CASOS.map((c) => c.modulo));
    expect(modulos.size).toBeGreaterThanOrEqual(2);
    expect(CASOS.filter((c) => c.modulo === "AIMS").length).toBeGreaterThanOrEqual(4);
    expect(CASOS.filter((c) => c.modulo === "GRC").length).toBeGreaterThanOrEqual(4);
    for (const c of CASOS) {
      expect(c.valores.length, `${c.modulo}.${c.dominio}: la lista de valores conocidos está vacía`).toBeGreaterThan(0);
    }
  });
});

describe("ningún estado conocido de AIMS o GRC cae en el chip neutro por omisión", () => {
  for (const caso of CASOS) {
    it(`${caso.modulo}.${caso.dominio}: cada valor declarado tiene entrada explícita en su mapa de chip`, () => {
      for (const valor of caso.valores) {
        const clave = caso.clave(valor);
        const tieneEntrada = Object.prototype.hasOwnProperty.call(caso.mapa, clave);
        expect(
          tieneEntrada,
          `${caso.modulo}.${caso.dominio}: "${valor}" (clave "${clave}") no está en el mapa de chip — cae al fallback neutro sin que nadie lo haya declarado`,
        ).toBe(true);
      }
    });
  }
});
