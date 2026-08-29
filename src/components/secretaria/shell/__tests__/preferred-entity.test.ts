import { describe, expect, it } from "vitest";
import { getPreferredEntity } from "../useSecretariaScope";
import type { SecretariaEntityOption } from "../types";

const opt = (over: Partial<SecretariaEntityOption>): SecretariaEntityOption => ({
  id: "x",
  name: "",
  legalName: "",
  jurisdiction: "",
  legalForm: "",
  status: "",
  materiality: "",
  parentEntityId: null,
  ...over,
});

describe("getPreferredEntity — multi-tenant", () => {
  it("entidad preferida por nombre o matriz del grupo", () => {
    const entities = [
      opt({ id: "1", legalName: "Sociedad Filial S.L.U.", parentEntityId: "2" }),
      opt({ id: "2", legalName: "Sociedad Matriz, S.A.", parentEntityId: null }),
    ];
    expect(getPreferredEntity(entities)?.id).toBe("2");
    expect(getPreferredEntity(entities, "Sociedad Filial S.L.U.")?.id).toBe("1");
  });

  it("sin match ARGA → la matriz del grupo (parent null) aunque no sea la primera", () => {
    const entities = [
      opt({ id: "f1", legalName: "Garrigues IP, S.L.P.", parentEntityId: "m" }),
      opt({ id: "m", legalName: "J&A Garrigues, S.L.P.", parentEntityId: null }),
    ];
    expect(getPreferredEntity(entities)?.id).toBe("m");
  });

  it("sin matriz identificable → primera; lista vacía → null", () => {
    const entities = [
      opt({ id: "a", legalName: "Filial A", parentEntityId: "z" }),
      opt({ id: "b", legalName: "Filial B", parentEntityId: "z" }),
    ];
    expect(getPreferredEntity(entities)?.id).toBe("a");
    expect(getPreferredEntity([])).toBeNull();
  });
});
