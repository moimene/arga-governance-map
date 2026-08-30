import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { formatDeadline, DEADLINE_TIME_ZONE } from "../incident-clocks";

const DETALLE = "src/pages/ai-governance/IncidenteDetalle.tsx";

describe("los plazos se pintan en una zona fija, no en la de quien mira", () => {
  // `bun test` corre en UTC y la aplicación en Europe/Madrid. Mientras el
  // formato no llevaba `timeZone`, NINGUNA aserción sobre la salida podía
  // cubrir ese eje: el runner no ve la diferencia que sí ve producción.
  // Fijar la zona elimina la dimensión, y por eso a partir de aquí sí vale
  // asertar la salida.

  it("un vencimiento cercano a medianoche UTC no se muestra el día anterior", () => {
    // 22:30 UTC del 30 de agosto es 00:30 del 31 en hora peninsular (CEST).
    // Con `toLocaleDateString` sin zona, el runner en UTC pintaba "30/08" y
    // producción "31/08": el plazo del art. 33 aparecía un día antes.
    const salida = formatDeadline("2026-08-30T22:30:00.000Z");
    expect(salida).toContain("31/08/2026");
    expect(salida).toContain("00:30");
  });

  it("la hora se rotula, para que nadie tenga que adivinar la zona", () => {
    expect(formatDeadline("2026-01-15T10:00:00.000Z")).toContain("hora peninsular");
    // Enero es CET (+1): 10:00Z son las 11:00. Si esto se rompiera al cambiar
    // la zona, el test lo diría en vez de seguir verde.
    expect(formatDeadline("2026-01-15T10:00:00.000Z")).toContain("11:00");
  });

  it("una fecha ausente o inválida no inventa un vencimiento", () => {
    for (const v of [null, undefined, "", "no-es-una-fecha"]) {
      expect(formatDeadline(v), `${v} debería quedar sin vencimiento`).toBe("—");
    }
  });

  it("la zona está fijada explícitamente y no heredada del entorno", () => {
    expect(DEADLINE_TIME_ZONE).toBe("Europe/Madrid");
  });

  it("la pantalla no vuelve a formatear un plazo sin zona", () => {
    // Pin del FUENTE, no de la salida: es lo único que protege del eje que el
    // runner no puede ver si alguien reintroduce un toLocale* pelado.
    const src = readFileSync(DETALLE, "utf8");
    expect(src.length, "no se ha leído la pantalla").toBeGreaterThan(1000);
    const sinZona = [...src.matchAll(/toLocale(?:Date|Time)?String\([^)]*\)/g)]
      .map((m) => m[0])
      .filter((llamada) => !llamada.includes("timeZone"));
    expect(sinZona, `formato sin zona: ${sinZona.join(" | ")}`).toEqual([]);
  });
});
