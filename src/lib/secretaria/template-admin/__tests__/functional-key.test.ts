import { describe, it, expect } from "vitest";
import {
  CORE_V1_MATERIAS,
  CORE_V1_MATERIAS_COUNT,
  buildFunctionalKey,
  detectFunctionalDuplicate,
  findFunctionalDuplicates,
  normalizeFunctionalSocialType,
  serializeFunctionalKey,
  matchesFunctionalKey,
} from "../functional-key";
import type { PlantillaCandidate } from "../types";

const baseRow = (overrides: Partial<PlantillaCandidate> = {}): PlantillaCandidate => ({
  id: "rid",
  tipo: "MODELO_ACUERDO",
  materia: "APROBACION_CUENTAS",
  materia_acuerdo: null,
  jurisdiccion: "ES",
  version: "1.0.0",
  estado: "ACTIVA",
  organo_tipo: "JUNTA_GENERAL",
  adoption_mode: "MEETING",
  tipo_social: null,
  aprobada_por: "X",
  fecha_aprobacion: "2026-01-01",
  referencia_legal: "Art. 160 LSC",
  capa1_inmutable: "x".repeat(120),
  capa2_variables: [],
  capa3_editables: [],
  ...overrides,
});

describe("functional-key", () => {
  it("CORE_V1_MATERIAS_COUNT = 14", () => {
    expect(CORE_V1_MATERIAS_COUNT).toBe(14);
    expect(CORE_V1_MATERIAS.length).toBe(14);
  });

  it("buildFunctionalKey usa materia_acuerdo si está, sino materia", () => {
    const k1 = buildFunctionalKey(baseRow({ materia: "X", materia_acuerdo: "Y" }), "tenant1");
    expect(k1.materia).toBe("Y");
    const k2 = buildFunctionalKey(baseRow({ materia: "X", materia_acuerdo: null }), "tenant1");
    expect(k2.materia).toBe("X");
  });

  it("trata materia_acuerdo vacía como ausencia, igual que la clave SQL", () => {
    const key = buildFunctionalKey(
      baseRow({ materia: "AUMENTO_CAPITAL", materia_acuerdo: "   " }),
      "tenant1",
    );

    expect(key.materia).toBe("AUMENTO_CAPITAL");
  });

  it("no aplica normalizaciones de presentación que la clave SQL no comparte", () => {
    const canonical = buildFunctionalKey(baseRow({ materia: "AUMENTO_CAPITAL" }), "tenant1");
    const humanized = buildFunctionalKey(baseRow({ materia: "ampliación-capital" }), "tenant1");

    expect(canonical.materia).toBe("AUMENTO_CAPITAL");
    expect(humanized.materia).toBe("AMPLIACIÓN-CAPITAL");
    expect(serializeFunctionalKey(canonical)).not.toBe(serializeFunctionalKey(humanized));
  });

  it("buildFunctionalKey rellena tenantId del argumento", () => {
    const k = buildFunctionalKey(baseRow(), "tenant42");
    expect(k.tenantId).toBe("tenant42");
  });

  it("serializeFunctionalKey produce string determinista", () => {
    const k1 = buildFunctionalKey(baseRow(), "t1");
    const k2 = buildFunctionalKey(baseRow(), "t1");
    expect(serializeFunctionalKey(k1)).toBe(serializeFunctionalKey(k2));
    expect(JSON.parse(serializeFunctionalKey(k1))).toHaveLength(7);
  });

  it("el separador de identidad no colisiona con pipes de datos libres", () => {
    const withPipeInType = buildFunctionalKey(baseRow({ tipo: "MODELO|ACUERDO" }), "t1");
    const withPipeInJurisdiction = buildFunctionalKey(
      baseRow({ tipo: "MODELO", jurisdiccion: "ACUERDO|ES" }),
      "t1",
    );

    expect(serializeFunctionalKey(withPipeInType)).not.toBe(
      serializeFunctionalKey(withPipeInJurisdiction),
    );
  });

  it("recorta espacios ASCII como btrim sin colapsar otros separadores", () => {
    expect(buildFunctionalKey(baseRow({ materia: "  aumento_capital  " }), "t1").materia).toBe(
      "AUMENTO_CAPITAL",
    );
    expect(buildFunctionalKey(baseRow({ materia: "\taumento_capital\t" }), "t1").materia).toBe(
      "\tAUMENTO_CAPITAL\t",
    );
  });

  it("matchesFunctionalKey ignora id y otros campos no funcionales", () => {
    const a = baseRow({ id: "a" });
    const b = baseRow({ id: "b" });
    expect(matchesFunctionalKey(a, b, "t1")).toBe(true);
  });

  it("matchesFunctionalKey detecta diferencia en organo_tipo", () => {
    const a = baseRow({ organo_tipo: "JUNTA_GENERAL" });
    const b = baseRow({ organo_tipo: "CONSEJO_ADMIN" });
    expect(matchesFunctionalKey(a, b, "t1")).toBe(false);
  });

  it("matchesFunctionalKey detecta diferencia en materia normalizada", () => {
    const a = baseRow({ materia: "X", materia_acuerdo: "AUMENTO_CAPITAL" });
    const b = baseRow({ materia: "AUMENTO_CAPITAL", materia_acuerdo: null });
    expect(matchesFunctionalKey(a, b, "t1")).toBe(true);
  });

  it("colapsa aliases históricos de materia, incluido el art. 308", () => {
    expect(
      matchesFunctionalKey(
        baseRow({ materia: "AMPLIACION_CAPITAL" }),
        baseRow({ materia: "AUMENTO_CAPITAL" }),
        "t1",
      ),
    ).toBe(true);
    expect(
      matchesFunctionalKey(
        baseRow({ materia: "EXCLUSION_DERECHO_SUSCRIPCION_PREFERENTE" }),
        baseRow({ materia: "SUPRESION_PREFERENTE" }),
        "t1",
      ),
    ).toBe(true);
  });

  it("normaliza aliases de órgano sin mezclar órganos distintos", () => {
    expect(
      matchesFunctionalKey(
        baseRow({ organo_tipo: "CONSEJO_ADMINISTRACION" }),
        baseRow({ organo_tipo: "CONSEJO_ADMIN" }),
        "t1",
      ),
    ).toBe(true);
    expect(
      matchesFunctionalKey(
        baseRow({ organo_tipo: "CONSEJO_ADMIN" }),
        baseRow({ organo_tipo: "JUNTA_GENERAL" }),
        "t1",
      ),
    ).toBe(false);
  });

  it("aplica btrim ASCII también al órgano y no colapsa tabs que SQL conserva", () => {
    expect(
      matchesFunctionalKey(
        baseRow({ organo_tipo: "  consejo  " }),
        baseRow({ organo_tipo: "CONSEJO_ADMIN" }),
        "t1",
      ),
    ).toBe(true);
    expect(buildFunctionalKey(baseRow({ organo_tipo: "\tCONSEJO\t" }), "t1").organoTipo).toBe(
      "\tCONSEJO\t",
    );
    expect(
      matchesFunctionalKey(
        baseRow({ organo_tipo: "\tCONSEJO\t" }),
        baseRow({ organo_tipo: "CONSEJO_ADMIN" }),
        "t1",
      ),
    ).toBe(false);
  });

  it("normaliza NULL, vacío y ANY como todos los tipos sociales", () => {
    const all = buildFunctionalKey(baseRow({ tipo_social: null }), "t1");
    expect(all.tipoSocial).toBe("ANY");
    expect(normalizeFunctionalSocialType("")).toBe("ANY");
    expect(
      matchesFunctionalKey(
        baseRow({ tipo_social: null }),
        baseRow({ tipo_social: "ANY" }),
        "t1",
      ),
    ).toBe(true);
    expect(
      matchesFunctionalKey(
        baseRow({ tipo_social: "   " }),
        baseRow({ tipo_social: "any" }),
        "t1",
      ),
    ).toBe(true);
  });

  it("mantiene las variantes sociales específicas fuera de la identidad ANY", () => {
    expect(
      matchesFunctionalKey(
        baseRow({ tipo_social: null }),
        baseRow({ tipo_social: "SA" }),
        "t1",
      ),
    ).toBe(false);
  });

  it("CORE_V1_MATERIAS incluye las 14 combinaciones del spec §3", () => {
    const set = new Set(CORE_V1_MATERIAS.map((m) => `${m.organo}|${m.materia}`));
    expect(set.has("JUNTA_GENERAL|APROBACION_CUENTAS")).toBe(true);
    expect(set.has("CONSEJO_ADMIN|DISTRIBUCION_CARGOS")).toBe(true);
    expect(set.has("CONSEJO_ADMIN|FORMULACION_CUENTAS")).toBe(true);
    expect(set.has("ORGANO_ADMIN|FORMULACION_CUENTAS")).toBe(false);
    expect(set.has("CONSEJO_ADMIN|COMITES_INTERNOS")).toBe(true);
  });

  it("detectFunctionalDuplicate encuentra duplicados no-terminales", () => {
    const candidate = baseRow({ id: "candidate", estado: "REVISADA" });
    const duplicate = baseRow({ id: "existing-draft", estado: "BORRADOR" });

    expect(
      detectFunctionalDuplicate(candidate, [duplicate], "t1", {
        states: ["BORRADOR", "REVISADA", "APROBADA", "ACTIVA"],
      })?.id,
    ).toBe("existing-draft");
  });

  it("detectFunctionalDuplicate respeta filtro de estados", () => {
    const candidate = baseRow({ id: "candidate", estado: "REVISADA" });
    const archived = baseRow({ id: "archived", estado: "ARCHIVADA" });

    expect(
      detectFunctionalDuplicate(candidate, [archived], "t1", {
        states: ["BORRADOR", "REVISADA", "APROBADA", "ACTIVA"],
      }),
    ).toBeNull();
  });

  it("findFunctionalDuplicates devuelve todas las activas equivalentes", () => {
    const candidate = baseRow({ id: "candidate", estado: "APROBADA" });
    const duplicates = [
      baseRow({ id: "active-a", estado: "ACTIVA", tipo_social: null }),
      baseRow({ id: "active-b", estado: "ACTIVA", tipo_social: "ANY" }),
      baseRow({ id: "variant-sa", estado: "ACTIVA", tipo_social: "SA" }),
    ];

    expect(
      findFunctionalDuplicates(candidate, duplicates, "t1", { states: ["ACTIVA"] }).map(
        (row) => row.id,
      ),
    ).toEqual(["active-a", "active-b"]);
  });
});
