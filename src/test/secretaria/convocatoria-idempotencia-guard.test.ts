import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("MOI-232 — Guard de fecha no pretérita e idempotencia en ConvocatoriasStepper", () => {
  const root = process.cwd();
  const read = (path: string) => readFileSync(resolve(root, path), "utf8");

  it("handleEmitir en ConvocatoriasStepper.tsx valida fecha futura y unicidad de convocatoria", () => {
    const fileContent = read("src/pages/secretaria/ConvocatoriasStepper.tsx");

    // Verificar que valida que la fecha/hora de la reunión sea posterior al momento actual
    expect(fileContent).toContain("const meetingTimeMs = new Date(`${fechaReunion}T${horaReunion}:00`).getTime();");
    expect(fileContent).toContain("if (meetingTimeMs <= Date.now()) {");
    expect(fileContent).toContain("La fecha y hora de la reunión deben ser posteriores al momento actual.");

    // Verificar guard de idempotencia frente a convocatorias duplicadas en el mismo órgano y timestamp
    expect(fileContent).toContain("const duplicateConvocatoria = previousConvocatorias.find(");
    expect(fileContent).toContain('c.body_id === selectedBodyId &&');
    expect(fileContent).toContain('c.fecha_1 === meetingIso &&');
    expect(fileContent).toContain('Ya existe una convocatoria emitida para este órgano en la misma fecha y hora.');
  });
});
