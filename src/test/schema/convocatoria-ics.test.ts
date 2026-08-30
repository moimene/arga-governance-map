import { describe, expect, it } from "bun:test";
import { generateIcs } from "@/lib/secretaria/convocatoria-ics";

/**
 * El `.ics` es la única salida del expediente que NO VUELVE: no se queda en la
 * plataforma ni en un fichero que alguien abra y cierre — entra en el
 * calendario de un tercero, y a partir de ahí el dato vive fuera del sistema,
 * sin procedencia, sin etiqueta y sin forma de rectificarlo.
 *
 * Escribía `DTSTART:20260506T000000Z`, que un cliente en Madrid muestra como
 * una Junta de Socios a las 2:00 de la madrugada. Ninguna verificación de
 * pantalla podía verlo: no se ve en la aplicación, se ve en Outlook.
 */
const FECHA_JUNTA = "2026-05-06T00:00:00+00:00";
const base = { title: "Junta de Socios — J&A Garrigues, S.L.P.", meeting_date: FECHA_JUNTA };

describe("C1 — el .ics no se lleva fuera una hora que no consta", () => {
  it("con la hora no acreditada, emite un evento de DÍA COMPLETO", () => {
    const ics = generateIcs({ ...base, hora_no_acreditada: true });
    // RFC 5545 §3.8.2.4: un DTSTART de tipo DATE no puede afirmar ninguna hora.
    expect(ics).toContain("DTSTART;VALUE=DATE:20260506");
    expect(ics).not.toContain("DTSTART:20260506T000000Z");
    expect(ics).toContain("La hora de la sesion no consta");
  });

  it("sin la bandera, emite exactamente lo de antes — es el caso de ARGA", () => {
    const ics = generateIcs(base);
    expect(ics).toContain("DTSTART:20260506T000000Z");
    expect(ics).not.toContain("VALUE=DATE");
    // Y no se cuela la descripción en un evento que sí tiene hora.
    expect(ics).not.toContain("no consta");
  });

  it("el .ics sigue siendo un .ics válido en los dos casos", () => {
    for (const ics of [generateIcs(base), generateIcs({ ...base, hora_no_acreditada: true })]) {
      expect(ics).toContain("BEGIN:VCALENDAR");
      expect(ics).toContain("BEGIN:VEVENT");
      expect(ics).toContain("END:VEVENT");
      expect(ics).toContain("END:VCALENDAR");
      expect(ics).toContain("SUMMARY:Junta de Socios");
    }
  });
});
