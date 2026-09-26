// src/test/grc/derivacion-sin-jerga.test.ts
//
// MOI-157 — a los casos que llegan de AIMS a GRC y a Secretaría se les llama
// «derivación», nunca «intake» ni «handoff», y el evento se pinta con su
// nombre legible, no con el código crudo del contrato. Ausencia de literales
// SOBRE `sinComentarios(src)`, para que el comentario que explica la retirada
// no dispare su propio guard (patrón del CLAUDE.md, cierre 2026-09-05).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sinComentarios } from "../helpers/sin-comentarios";
import { handoffEventLabel } from "@/lib/handoff-event-labels";

const raiz = process.cwd();
const leer = (rel: string) => sinComentarios(readFileSync(join(raiz, rel), "utf8"));

const FICHEROS = {
  readiness: "src/lib/grc/dashboard-readiness.ts",
  dashboard: "src/pages/grc/Dashboard.tsx",
  riskEditor: "src/pages/grc/RiskEditor.tsx",
  reunionStepper: "src/pages/secretaria/ReunionStepper.tsx",
};

// Los mismos literales del criterio de hecho del issue: si sobreviven en
// cualquiera de las cuatro superficies tocadas, el issue no está resuelto.
const JERGA_RETIRADA = [
  "intake GRC",
  "Handoffs de solo lectura",
  "Sin handoff",
  "Handoff read-only",
  "legacy_write · risks",
];

describe("MOI-157 — la jerga de intake/handoff no sobrevive en las superficies tocadas", () => {
  it("ninguna de las cuatro superficies contiene los literales retirados", () => {
    for (const [nombre, ruta] of Object.entries(FICHEROS)) {
      const src = leer(ruta);
      for (const jerga of JERGA_RETIRADA) {
        expect(src.includes(jerga), `${nombre} (${ruta}) sigue diciendo «${jerga}»`).toBe(false);
      }
    }
  });

  // Control positivo: si el fichero estuviera vacío o el `leer` se rompiera,
  // el test de arriba pasaría por vacuidad. Tres superficies sustituyen la
  // jerga por «derivación»; RiskEditor retiró el chip entero (no hay término
  // que lo sustituya), así que su control positivo es otro: la frase llana
  // que ya declaraba el registro owner sigue en pantalla.
  it("control positivo — el texto de reemplazo sí está, en las cuatro superficies", () => {
    for (const ruta of [FICHEROS.readiness, FICHEROS.dashboard, FICHEROS.reunionStepper]) {
      const src = leer(ruta);
      expect(src.length, `${ruta} se leyó vacío`).toBeGreaterThan(100);
      expect(/derivaci[oó]n/i.test(src), `${ruta} no dice «derivación» en ningún sitio`).toBe(true);
    }
    const riskEditor = leer(FICHEROS.riskEditor);
    expect(riskEditor.length, `${FICHEROS.riskEditor} se leyó vacío`).toBeGreaterThan(100);
    expect(riskEditor.includes("Registro owner de GRC sobre risks")).toBe(true);
  });

  it("Dashboard.tsx y ReunionIntake ya no pintan el código de evento en crudo", () => {
    const dashboard = leer(FICHEROS.dashboard);
    const reunion = leer(FICHEROS.reunionStepper);
    // El código crudo solo debe aparecer como *valor de datos* (contractEvent,
    // query params, el propio código del contrato), nunca ya interpolado
    // directamente en un nodo de texto sin pasar por handoffEventLabel.
    expect(dashboard.includes("{handoff.contractEvent}")).toBe(false);
    expect(dashboard.includes("{handoff?.contractEvent}")).toBe(false);
    expect(reunion.includes("{event ?? \"sin evento\"}")).toBe(false);
    expect(dashboard.includes("handoffEventLabel")).toBe(true);
    expect(reunion.includes("handoffEventLabel")).toBe(true);
  });
});

describe("handoffEventLabel — nombre legible del evento, nunca el código crudo", () => {
  it("traduce los eventos conocidos de GRC/AIMS a una frase legible", () => {
    expect(handoffEventLabel("GRC_INCIDENT_MATERIAL")).toBe("incidente material");
    expect(handoffEventLabel("AIMS_TECHNICAL_FILE_GAP")).toBe("brecha en expediente técnico");
    expect(handoffEventLabel("AIMS_INCIDENT_MATERIAL")).toBe("incidente de IA material");
  });

  it("nunca devuelve el código en mayúsculas con guion bajo intacto", () => {
    for (const code of [
      "GRC_INCIDENT_MATERIAL",
      "GRC_FINDING_BOARD_ESCALATION",
      "AIMS_TECHNICAL_FILE_GAP",
      "AIMS_INCIDENT_MATERIAL",
      "UN_CODIGO_DESCONOCIDO",
    ]) {
      expect(handoffEventLabel(code)).not.toBe(code);
      expect(handoffEventLabel(code).includes("_")).toBe(false);
    }
  });

  it("un código sin mapear se humaniza en vez de romper", () => {
    expect(handoffEventLabel("UN_CODIGO_DESCONOCIDO")).toBe("Un Codigo Desconocido");
  });

  it("sin evento, declara que no hay señal en vez de quedar vacío", () => {
    expect(handoffEventLabel(null)).toBe("señal recibida");
    expect(handoffEventLabel(undefined)).toBe("señal recibida");
  });
});
