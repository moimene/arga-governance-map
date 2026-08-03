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
      "1. Formulación de cuentas (Acuerdo · Formulación de cuentas)\n2. Ruegos y preguntas",
    );
    expect(result.values.canal_convocatoria).toBe("Email simple, Notificación ERDS");
    expect(result.fields.every((field) => field.readonly)).toBe(true);
  });

  it("preserves the authoritative agenda projection with validated representation identities", () => {
    const summary =
      "1. Designación de representante — Filial: ARGA Digital Services, S.L.; " +
      "representante propuesta: Dña. Carmen Delgado Ortiz " +
      "(Acuerdo · Designación de representante de la socia única en la filial)";
    const result = buildConvocatoriaCapa3Resolution(
      fields(["orden_del_dia_resumen", "orden_dia_texto"]),
      {
        agendaSummaryText: summary,
        agendaItems: [
          {
            titulo: "Designación de representante",
            kind: "DECISORIO",
            materia: "DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL",
          },
        ],
      },
    );

    expect(result.values.orden_del_dia_resumen).toBe(summary);
    expect(result.values.orden_dia_texto).toBe(summary);
  });

  it("prefills the document channel and human attachment index from step 6", () => {
    const result = buildConvocatoriaCapa3Resolution(
      fields(["canal_documentacion", "indice_documentacion_ref"]),
      {
        attachmentAliases: [
          "Balance de situación 2025 — simulación demo",
          "Propuesta de poder general mercantil — simulación demo",
        ],
      },
    );

    expect(result.values.canal_documentacion).toContain("Expediente electrónico de Secretaría Societaria");
    expect(result.values.indice_documentacion_ref).toBe(
      "Balance de situación 2025 — simulación demo · Propuesta de poder general mercantil — simulación demo",
    );
    expect(result.fields.every((field) => field.readonly)).toBe(true);
    expect(result.fields.every((field) => field.sourceLabel === "Paso 6")).toBe(true);
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

  it("keeps the convener identity read-only because it comes from authority evidence", () => {
    const result = buildConvocatoriaCapa3Resolution(
      fields(["nombre_convocante", "cargo_convocante"]),
      {
        convocanteNombre: "Antonio Ríos",
        convocanteCargo: "PRESIDENTE",
      },
    );

    expect(result.values).toEqual({
      nombre_convocante: "Antonio Ríos",
      cargo_convocante: "PRESIDENTE",
    });
    expect(result.fields.every((field) => field.readonly)).toBe(true);
    expect(result.fields.every((field) => field.sourceLabel === "Autoridad vigente")).toBe(true);
  });

  it("derives the second-call switch from step 2 instead of asking the user twice", () => {
    const enabled = buildConvocatoriaCapa3Resolution(
      fields(["hay_segunda_convocatoria"]),
      { haySegundaConvocatoria: true },
    );
    const disabled = buildConvocatoriaCapa3Resolution(
      fields(["hay_segunda_convocatoria"]),
      { haySegundaConvocatoria: false },
    );

    expect(enabled.values.hay_segunda_convocatoria).toBe("Sí");
    expect(disabled.values.hay_segunda_convocatoria).toBe("No");
    expect(enabled.fields[0]?.readonly).toBe(true);
    expect(enabled.fields[0]?.sourceLabel).toBe("Paso 2");
  });
});
