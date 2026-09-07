// src/test/garrigues/seed-ia-siembra-progresiva.test.ts
//
// ORDEN VIGENTE 2026-09-07: el tenant Garrigues se siembra de forma PROGRESIVA
// y el dato PERSISTE. Un seed que duplique o pise lo ya sembrado es un defecto,
// y un discriminante que aborte porque «hay más de los del catálogo» empuja al
// siguiente a borrar el alta legítima para que el seed vuelva a pasar.
//
// El caso medido en Cloud el 2026-09-07: el tenant tenía UNA fila en
// `ai_systems` —«Harvey – Plataforma de IA generativa legal»,
// `aims_reference_code` NULL, status EN_EVALUACION— escrita por otra sesión.
// Como el índice de idempotencia sólo miraba filas CON código, esa fila era
// invisible y la pasada siguiente insertaba un segundo Harvey.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sinComentarios } from "../helpers/sin-comentarios";
import {
  planificarSiembra,
  type FilaSistemaIA,
} from "../../../scripts/seed-garrigues-ia";
import { SISTEMAS_IA } from "../../../scripts/garrigues/ia/catalogo-ia";

const HARVEY_EN_CLOUD: FilaSistemaIA = {
  id: "2f877e8c-875d-4b11-9b39-aed0826cacb5",
  aims_reference_code: null,
  name: "Harvey – Plataforma de IA generativa legal",
  vendor: "Harvey AI (Counsel AI Corporation), San Francisco, EE. UU.",
  use_case: null,
  description: null,
  status: "EN_EVALUACION",
  system_type: null,
};

const catalogoHarvey = SISTEMAS_IA.find((s) => s.code === "GARR-IA-002")!;

describe("el seed de IA reconoce lo ya sembrado en vez de duplicarlo", () => {
  it("adopta la fila sin código que otra sesión dejó, no la duplica", () => {
    // Control positivo: el catálogo tiene el sistema que se dice adoptar.
    expect(catalogoHarvey?.name).toBe("Harvey");

    const { plan, problemas } = planificarSiembra([HARVEY_EN_CLOUD], SISTEMAS_IA);
    expect(problemas).toEqual([]);
    expect(plan).toHaveLength(SISTEMAS_IA.length);

    const harvey = plan.find((p) => p.s.code === "GARR-IA-002")!;
    expect(harvey.accion, "un alta aquí sería el segundo Harvey").toBe("adopta");
    expect(harvey.fila?.id).toBe(HARVEY_EN_CLOUD.id);

    // Discriminante: el resto del catálogo sí es alta, así que «adopta» no es
    // lo que devuelve para todo.
    for (const paso of plan.filter((p) => p.s.code !== "GARR-IA-002")) {
      expect(paso.accion).toBe("alta");
    }
  });

  it("sobre un tenant ya sembrado no vuelve a insertar nada", () => {
    const yaSembrado: FilaSistemaIA[] = SISTEMAS_IA.map((s, i) => ({
      id: `id-${i}`, aims_reference_code: s.code, name: s.name,
      vendor: s.vendor, use_case: s.use_case, description: s.description,
      status: s.status, system_type: s.system_type,
    }));
    const { plan, problemas } = planificarSiembra(yaSembrado, SISTEMAS_IA);
    expect(problemas).toEqual([]);
    expect(plan.every((p) => p.accion === "actualiza")).toBe(true);
  });

  it("un alta hecha desde la aplicación no le estorba: ni la toca ni aborta", () => {
    const ajeno: FilaSistemaIA = {
      id: "alta-desde-la-app", aims_reference_code: null,
      name: "Sistema propio del despacho", vendor: null, use_case: null,
      description: null, status: "EN_EVALUACION", system_type: null,
    };
    const { plan, problemas } = planificarSiembra([ajeno], SISTEMAS_IA);
    expect(problemas).toEqual([]);
    expect(plan.some((p) => p.fila?.id === ajeno.id), "no se apropia de lo ajeno").toBe(false);
  });

  it("y ante una ambigüedad no elige: la declara y no deja escribir", () => {
    const dosHarvey: FilaSistemaIA[] = [
      HARVEY_EN_CLOUD,
      { ...HARVEY_EN_CLOUD, id: "otro", name: "Harvey (piloto)" },
    ];
    const { problemas } = planificarSiembra(dosHarvey, SISTEMAS_IA);
    expect(problemas.join(" ")).toMatch(/GARR-IA-002.*2 filas sin código/s);

    const duplicado: FilaSistemaIA[] = [
      { ...HARVEY_EN_CLOUD, aims_reference_code: "GARR-IA-002" },
      { ...HARVEY_EN_CLOUD, id: "otro", aims_reference_code: "GARR-IA-002" },
    ];
    expect(planificarSiembra(duplicado, SISTEMAS_IA).problemas.join(" "))
      .toMatch(/GARR-IA-002 duplicado/);
  });
});

describe("el discriminante final admite que el tenant crezca", () => {
  // Sin comentarios: la prosa que explica la corrección cita lo corregido, y
  // un grep se dispararía contra su propia justificación.
  const src = sinComentarios(
    readFileSync(join(process.cwd(), "scripts/seed-garrigues-ia.ts"), "utf8"),
  );

  it("no exige que Garrigues quede en el tamaño exacto del catálogo", () => {
    // Ese `!==` abortaba DESPUÉS de escribir en cuanto el tenant tuviera un
    // alta propia, y la salida fácil era borrarla.
    expect(src).not.toMatch(/garrDespues\s*!==\s*SISTEMAS_IA\.length/);
  });

  it("pero sigue cazando que falte alguno del catálogo o que quede duplicado", () => {
    expect(src).toContain("falta ${s.code} en el tenant");
    expect(src).toContain("quedó duplicado");
    // Y no se ha desarmado el resto del cierre del conjunto.
    expect(src).toContain("ARGA se movió");
    expect(src).toContain("tenant desconocido");
  });

  it("no borra: el script no tiene ninguna llamada a delete", () => {
    expect(src).not.toMatch(/\.delete\(/);
  });
});
