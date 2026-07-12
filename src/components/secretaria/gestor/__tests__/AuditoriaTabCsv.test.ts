import { describe, expect, it } from "vitest";
import {
  CHANGELOG_CSV_COLUMNS,
  ORPHAN_CSV_COLUMNS,
  buildChangelogCsvRows,
  buildOrphanCsvRows,
  filterChangelogRows,
  type ChangelogRow,
} from "../auditoria-csv";

describe("AuditoriaTab — datasets CSV", () => {
  it("exporta el changelog visible con ID completo, código raw, label y versión lógica", () => {
    const row: ChangelogRow = {
      id: "change-1",
      plantilla_id: "bc49965f-2c0b-4778-9751-163f87fcbff6",
      bump_type: "MINOR",
      motivo: "Ajuste jurídico",
      diff_summary: JSON.stringify({ logical_to_version: "1.3.0" }),
      from_version: "1.2.0",
      to_version: "1.3.0#idemp:20260711",
      autor: "Comité Legal",
      created_at: "2026-07-11T10:15:00+02:00",
    };

    expect(CHANGELOG_CSV_COLUMNS).toEqual([
      "ID plantilla",
      "Tipo de cambio (raw)",
      "Tipo de cambio",
      "Versión anterior",
      "Versión nueva (lógica)",
      "Autor",
      "Motivo",
      "Fecha y hora (ISO)",
    ]);
    expect(buildChangelogCsvRows([row])).toEqual([[
      "bc49965f-2c0b-4778-9751-163f87fcbff6",
      "MINOR",
      "Evolución menor (MINOR)",
      "1.2.0",
      "1.3.0",
      "Comité Legal",
      "Ajuste jurídico",
      "2026-07-11T08:15:00.000Z",
    ]]);
  });

  it("elimina el sufijo idempotente aunque el resumen legacy no sea JSON", () => {
    const row: ChangelogRow = {
      id: "change-2",
      plantilla_id: "tpl-full-id",
      bump_type: "PATCH",
      motivo: null,
      diff_summary: "resumen legacy",
      from_version: null,
      to_version: "2.0.1#idemp:legacy",
      autor: "Secretaría",
      created_at: "fecha-legacy",
    };

    expect(buildChangelogCsvRows([row])[0]).toEqual([
      "tpl-full-id",
      "PATCH",
      "Corrección (PATCH)",
      null,
      "2.0.1",
      "Secretaría",
      null,
      "fecha-legacy",
    ]);
  });

  it("deja vacía una fecha nula y filtra por la fecha civil que ve el usuario", () => {
    const withoutDate: ChangelogRow = {
      id: "change-null-date",
      plantilla_id: "template-null-date",
      bump_type: "PATCH",
      motivo: "Sin fecha legacy",
      diff_summary: null,
      from_version: null,
      to_version: "1.0.1",
      autor: "Secretaría",
      created_at: null,
    };
    const dated: ChangelogRow = {
      ...withoutDate,
      id: "change-dated",
      plantilla_id: "template-dated",
      autor: "Comité Legal",
      bump_type: "MINOR",
      created_at: new Date(2026, 6, 11, 0, 30).toISOString(),
    };

    expect(buildChangelogCsvRows([withoutDate])[0]?.at(-1)).toBeNull();
    expect(filterChangelogRows([withoutDate, dated], {
      plantilla: "dated",
      actor: "comité",
      bump: "MINOR",
      date: "2026-07-11",
    })).toEqual([dated]);
    expect(filterChangelogRows([withoutDate], {
      plantilla: "",
      actor: "",
      bump: "ALL",
      date: "2026-07-11",
    })).toEqual([]);
  });

  it("separa códigos raw y labels jurídicos en plantillas sin changelog", () => {
    expect(ORPHAN_CSV_COLUMNS).toEqual([
      "ID plantilla",
      "Tipo (raw)",
      "Tipo",
      "Materia (raw)",
      "Materia",
      "Versión",
      "Estado (raw)",
      "Estado",
    ]);
    expect(buildOrphanCsvRows([{
      id: "1b1118a6-577d-45ed-96ee-77be89358aa0",
      tipo: "MODELO_ACUERDO",
      materia: "APROBACION_CUENTAS",
      version: "1.2.0",
      estado: "ACTIVA",
    }])).toEqual([[
      "1b1118a6-577d-45ed-96ee-77be89358aa0",
      "MODELO_ACUERDO",
      "Modelo de acuerdo",
      "APROBACION_CUENTAS",
      "Aprobación de cuentas",
      "1.2.0",
      "ACTIVA",
      "Activa",
    ]]);
  });
});
