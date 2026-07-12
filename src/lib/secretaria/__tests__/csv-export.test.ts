import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildCsvFilename,
  downloadCsv,
  formatCsvDate,
  serializeCsv,
} from "@/lib/secretaria/csv-export";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("serializeCsv", () => {
  it("genera UTF-8 con BOM, delimitador español y CRLF", () => {
    const csv = serializeCsv(
      ["Código", "Nombre", "Activo", "Fecha", "Sin valor 1", "Sin valor 2"],
      [["APROBACION_CUENTAS", "Aprobación de cuentas", true, new Date("2026-07-11T08:30:00.000Z"), null, undefined]],
    );

    expect(csv).toBe(
      "\uFEFFCódigo;Nombre;Activo;Fecha;Sin valor 1;Sin valor 2\r\n" +
        "APROBACION_CUENTAS;Aprobación de cuentas;true;2026-07-11T08:30:00.000Z;;",
    );
    expect(new TextEncoder().encode(csv).slice(0, 3)).toEqual(new Uint8Array([0xef, 0xbb, 0xbf]));
  });

  it("escapa delimitadores, comillas y contenido multilínea según RFC 4180", () => {
    const csv = serializeCsv(
      ["Campo; legal", 'Etiqueta "visible"', "Notas"],
      [["Uno; dos", 'Dice "sí"', "Primera línea\r\nSegunda línea"]],
    );

    expect(csv).toBe(
      '\uFEFF"Campo; legal";"Etiqueta ""visible""";Notas\r\n' +
        '"Uno; dos";"Dice ""sí""";"Primera línea\r\nSegunda línea"',
    );
  });

  it.each([
    ["=SUM(A1:A2)", "'=SUM(A1:A2)"],
    ["+CMD", "'+CMD"],
    ["-42", "'-42"],
    ["@IMPORT", "'@IMPORT"],
    ["\tDDE", "'\tDDE"],
    ["\rDDE", "'\rDDE"],
    ["   =SUM(A1:A2)", "'   =SUM(A1:A2)"],
    [" \tDDE", "' \tDDE"],
    [-42, "'-42"],
  ])("neutraliza el prefijo de fórmula de %j", (value, expected) => {
    const csv = serializeCsv(["Valor"], [[value]]);
    const serializedValue = csv.slice("\uFEFFValor\r\n".length);
    const unquoted = serializedValue.startsWith('"')
      ? serializedValue.slice(1, -1).replace(/""/gu, '"')
      : serializedValue;
    expect(unquoted).toBe(expected);
  });

  it("no altera texto ya neutralizado ni valores ordinarios", () => {
    expect(serializeCsv(["Valor"], [["'=SUM(A1:A2)"], ["Texto normal"]])).toBe(
      "\uFEFFValor\r\n'=SUM(A1:A2)\r\nTexto normal",
    );
  });

  it("mantiene una matriz rectangular y permite un dataset vacío", () => {
    expect(serializeCsv(["A", "B"], [["uno"], ["dos", "tres", "ignorado"]])).toBe(
      "\uFEFFA;B\r\nuno;\r\ndos;tres",
    );
    expect(serializeCsv([], [["ignorado"]])).toBe("\uFEFF");
  });
});

describe("buildCsvFilename", () => {
  it("usa la fecha civil local para evitar saltos de día respecto de la pantalla", () => {
    expect(formatCsvDate(new Date(2026, 6, 11, 0, 30))).toBe("2026-07-11");
  });

  it("normaliza a ASCII seguro y añade fecha y extensión deterministas", () => {
    expect(
      buildCsvFilename(
        ["Secretaría", "Matriz materias", "../ARGA Seguros S.A."],
        "2026-07-11",
      ),
    ).toBe("secretaria-matriz-materias-arga-seguros-s-a-2026-07-11.csv");
  });

  it("usa un nombre base seguro y rechaza fechas ambiguas o imposibles", () => {
    expect(buildCsvFilename([null, "", undefined], "2026-07-11")).toBe(
      "exportacion-2026-07-11.csv",
    );
    expect(() => buildCsvFilename(["informe"], "11/07/2026")).toThrow(
      "formato YYYY-MM-DD",
    );
    expect(() => buildCsvFilename(["informe"], "2026-02-31")).toThrow(
      "formato YYYY-MM-DD",
    );
  });
});

describe("downloadCsv", () => {
  it("crea y libera un objeto local con un nombre de descarga saneado", () => {
    vi.useFakeTimers();
    const createObjectUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:csv-test");
    const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL");
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click");

    downloadCsv("\uFEFFCódigo\r\nMATERIA", "../../Informe Secretaría.CSV");

    const anchor = click.mock.contexts[0] as HTMLAnchorElement;
    expect(anchor.href).toBe("blob:csv-test");
    expect(anchor.download).toBe("informe-secretaria.csv");
    expect(anchor.rel).toBe("noopener");
    expect(anchor.isConnected).toBe(false);
    expect(createObjectUrl).toHaveBeenCalledWith(expect.any(Blob));
    expect(revokeObjectUrl).not.toHaveBeenCalled();

    vi.runAllTimers();
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:csv-test");
  });
});
