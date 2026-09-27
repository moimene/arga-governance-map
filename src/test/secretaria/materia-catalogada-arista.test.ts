import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// H-50 (MOI-15, severidad A): prueba de ARISTA — falla si alguno de los
// selectores de materia deja de aplicar el gate de `materia-catalogada.ts`
// (por ejemplo, si alguien vuelve a leer `AGENDA_MATERIAS`/`AGREEMENT_KINDS`
// directamente sin pasar por la variante *Catalogadas o sin filtrar por
// `esMateriaCatalogada`/`filtrarMateriasCatalogadas`). No es una prueba de
// comportamiento de la lógica (esa vive en materia-catalogada.test.ts y
// agenda-materias-catalogo.test.ts): vigila que la ARISTA entre el selector y
// el criterio único siga conectada, siguiendo el patrón ya establecido en
// convocatorias-informative-matter-ui-contract.test.ts.
const convocatoriasStepper = readFileSync(
  resolve(process.cwd(), "src/pages/secretaria/ConvocatoriasStepper.tsx"),
  "utf8",
);
const reunionStepper = readFileSync(
  resolve(process.cwd(), "src/pages/secretaria/ReunionStepper.tsx"),
  "utf8",
);
const acuerdoSinSesionStepper = readFileSync(
  resolve(process.cwd(), "src/pages/secretaria/AcuerdoSinSesionStepper.tsx"),
  "utf8",
);

describe("H-50 — selectores de materia decisoria gatean por materia_catalog", () => {
  it("ConvocatoriasStepper: el selector del orden del día usa la variante catalogada, no agendaMateriaGroups a secas", () => {
    expect(convocatoriasStepper).toContain(
      "agendaMateriaGroupsCatalogadas(organoTipo, tipoSocial, codigosCatalogo)",
    );
    expect(convocatoriasStepper).not.toContain("agendaMateriaGroups(organoTipo, tipoSocial)");
  });

  it("ConvocatoriasStepper: el default de materia por órgano usa la variante catalogada", () => {
    expect(convocatoriasStepper).toContain("materiaDefaultForOrganoCatalogada(organoTipo, codigosCatalogo)");
  });

  it("ConvocatoriasStepper: el cambio de naturaleza a DECISORIO pasa codigosCatalogo", () => {
    expect(convocatoriasStepper).toContain("agendaMateriaSelectionForKind({");
    expect(convocatoriasStepper).toContain("codigosCatalogo,");
  });

  it("ConvocatoriasStepper: la emisión bloquea un punto DECISORIO sin fila en el catálogo", () => {
    expect(convocatoriasStepper).toContain(
      "!esMateriaCatalogada(item.materia, codigosCatalogo)",
    );
  });

  it("ConvocatoriasStepper: muestra la nota visible de materias pendientes de clasificación", () => {
    expect(convocatoriasStepper).toContain("notaMateriasPendientes(");
    expect(convocatoriasStepper).toContain("materiasPendientesDeCatalogo(organoTipo, tipoSocial, codigosCatalogo)");
  });

  it("ReunionStepper: el selector de materia del punto nacido en sesión filtra por catálogo", () => {
    expect(reunionStepper).toContain("materiasDisponibles.catalogadas.map((materia) =>");
    expect(reunionStepper).not.toContain(
      "AGENDA_MATERIAS.filter((materia) => isMateriaVisibleForTipoSocial(materia, tipoSocial)).map((materia) =>",
    );
  });

  it("ReunionStepper: guardar un punto bloquea una decisión sin materia catalogada", () => {
    expect(reunionStepper).toContain("!esMateriaCatalogada(point.materia, codigosCatalogo)");
  });

  it("AcuerdoSinSesionStepper: el selector de tipo de acuerdo filtra por catálogo", () => {
    expect(acuerdoSinSesionStepper).toContain("agreementKindsCatalogados.catalogadas");
  });

  it("AcuerdoSinSesionStepper: abrir la votación bloquea un tipo sin materia catalogada", () => {
    expect(acuerdoSinSesionStepper).toContain("!esMateriaCatalogada(agreementKind, codigosCatalogo)");
  });
});
