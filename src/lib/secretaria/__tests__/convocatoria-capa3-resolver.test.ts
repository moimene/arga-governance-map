import { describe, expect, it } from "vitest";
import { buildConvocatoriaCapa3Resolution } from "../convocatoria-capa3-resolver";
import type { NormalizedCapa3Field } from "../capa3-fields";

const fields = (names: string[]): NormalizedCapa3Field[] =>
  names.map((campo) => ({
    campo,
    obligatoriedad: "OBLIGATORIO",
    descripcion: campo,
  }));

describe("convocatoria-capa3-resolver", () => {
  it("prefills session fields from convocatoria stepper context", () => {
    const result = buildConvocatoriaCapa3Resolution(
      fields(["fecha_sesion", "hora_sesion", "lugar_sesion", "modalidad_sesion"]),
      {
        fechaReunion: "2026-05-19",
        horaReunion: "10:00",
        lugar: "Domicilio social, Madrid",
        formatoReunion: "TELEMATICA",
      },
    );

    expect(result.values).toEqual({
      fecha_sesion: "2026-05-19",
      hora_sesion: "10:00",
      lugar_sesion: "Domicilio social, Madrid",
      modalidad_sesion: "TELEMATICA",
    });
    expect(result.fields.find((field) => field.campo === "modalidad_sesion")?.readonly).toBe(true);
    expect(result.fields.find((field) => field.campo === "fecha_sesion")?.readonly).toBe(false);
  });

  it("marks derived agenda and channel summaries as readonly", () => {
    const result = buildConvocatoriaCapa3Resolution(
      fields(["orden_del_dia_resumen", "canal_convocatoria"]),
      {
        agendaItems: [
          { titulo: "Formulación de cuentas", kind: "DECISORIO", materia: "FORMULACION_CUENTAS" },
          { titulo: "Ruegos y preguntas", kind: "RUEGOS_PREGUNTAS" },
        ],
        channelLabels: ["Email simple", "Notificación ERDS"],
      },
    );

    expect(result.values.orden_del_dia_resumen).toBe(
      "1. Formulación de cuentas (FORMULACION_CUENTAS)\n2. Ruegos y preguntas",
    );
    expect(result.values.canal_convocatoria).toBe("Email simple, Notificación ERDS");
    expect(result.fields.every((field) => field.readonly)).toBe(true);
  });

  it("prefills listed-company status from entity context", () => {
    const result = buildConvocatoriaCapa3Resolution(
      fields(["entidad_cotizada", "es_cotizada"]),
      { entidadCotizada: true },
    );

    expect(result.values).toEqual({
      entidad_cotizada: "Sí",
      es_cotizada: "Sí",
    });
    expect(result.fields.every((field) => field.readonly)).toBe(true);
  });
});
