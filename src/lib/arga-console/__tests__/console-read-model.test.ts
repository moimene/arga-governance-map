// Contrato del read model de la consola: «no medido» nunca es 0.
//
// Un 0 afirma que se midió y no había nada. Cuando la consulta falla, la única
// respuesta honesta es «no medido». Este contrato existe porque el KPI de
// incidentes de la consola fue un 0 falso permanente desde su creación
// (`incidents.module_id` no existe en Cloud) y ningún test lo vio.
import { describe, expect, it } from "vitest";
import {
  NO_MEDIDO,
  formatMeasured,
  formatMeasuredShort,
  hasMeasuredItems,
  isUnmeasured,
} from "../measured";
import {
  composePlatformReadiness,
  platformReadinessLanes,
  type LaneMeasurement,
} from "../platform-readiness";

describe("read model — «no medido» no se serializa como 0", () => {
  it("distingue no medido de cero medido", () => {
    // Control negativo: si alguien vuelve a poner `?? 0`, estas dos líneas
    // devolverían lo mismo y el test cae.
    expect(formatMeasured(null)).toBe(NO_MEDIDO);
    expect(formatMeasured(0)).toBe("0");
    expect(formatMeasured(null)).not.toBe(formatMeasured(0));

    expect(formatMeasuredShort(null)).toBe("—");
    expect(formatMeasuredShort(0)).toBe("0");
    expect(formatMeasuredShort(null)).not.toBe(formatMeasuredShort(0));
  });

  it("no afirma que haya elementos cuando no se ha medido", () => {
    expect(hasMeasuredItems(null)).toBe(false);
    expect(hasMeasuredItems(undefined)).toBe(false);
    expect(hasMeasuredItems(0)).toBe(false);
    expect(hasMeasuredItems(3)).toBe(true);

    // …y distingue el caso «no medido» del caso «medido y vacío», que es lo
    // que permite pintar tono neutro en vez de tono de éxito.
    expect(isUnmeasured(null)).toBe(true);
    expect(isUnmeasured(0)).toBe(false);
  });
});

describe("composePlatformReadiness", () => {
  it("no promociona ni degrada el status declarado por el owner", () => {
    const medido: Record<string, LaneMeasurement[]> = {
      // 114 bundles no sacan del HOLD al bloque probatorio.
      evidence: [{ label: "Bundles", value: 114, source: "evidence_bundles" }],
      integration: [{ label: "Eventos", value: 2, source: "governance_module_events" }],
    };
    const compuesto = composePlatformReadiness(platformReadinessLanes, medido);

    for (const lane of compuesto) {
      const declarado = platformReadinessLanes.find((l) => l.id === lane.id);
      expect(lane.status).toBe(declarado?.status);
    }
    expect(compuesto.find((l) => l.id === "evidence")?.status).toBe("hold");
  });

  it("conserva null y no lo rellena a 0", () => {
    const compuesto = composePlatformReadiness(platformReadinessLanes, {
      grc: [{ label: "Incidentes abiertos", value: null, source: "incidents" }],
    });
    const grc = compuesto.find((l) => l.id === "grc");

    expect(grc?.measured[0].value).toBeNull();
    expect(grc?.measured[0].value).not.toBe(0);
    expect(formatMeasured(grc?.measured[0].value)).toBe(NO_MEDIDO);
  });

  it("un carril sin mediciones queda vacío, no en ceros inventados", () => {
    const compuesto = composePlatformReadiness(platformReadinessLanes, {});
    for (const lane of compuesto) {
      expect(lane.measured).toEqual([]);
    }
  });

  it("permite declarar por qué falta el número en vez de pintar 0", () => {
    // GRC emite traza de incidents/findings, pero risks NO tiene trigger de
    // auditoría y ai_* tampoco: eso no es «0 eventos», es «sin traza del owner».
    const compuesto = composePlatformReadiness(platformReadinessLanes, {
      aims: [
        {
          label: "Eventos emitidos por el owner",
          value: null,
          source: "audit_log",
          absentReason: "sin traza del owner (las tablas ai_* no tienen trigger)",
        },
      ],
    });
    const aims = compuesto.find((l) => l.id === "aims");
    expect(aims?.measured[0].value).toBeNull();
    expect(aims?.measured[0].absentReason).toContain("sin traza del owner");
  });
});
