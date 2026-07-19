import { describe, expect, it } from "vitest";
import {
  resolveOrganoTipo,
  resolveOrganoTipoStrict,
  type GoverningBodyShape,
} from "../organo-resolver";

const body = (overrides: Partial<GoverningBodyShape> = {}): GoverningBodyShape => ({
  body_type: null,
  config: null,
  ...overrides,
});

describe("resolveOrganoTipo — body_type CDA (umbrella admin)", () => {
  it("CDA + organo_tipo=CONSEJO_ADMIN → CONSEJO", () => {
    expect(
      resolveOrganoTipo(body({ body_type: "CDA", config: { organo_tipo: "CONSEJO_ADMIN" } })),
    ).toBe("CONSEJO");
  });

  it("CDA + organo_tipo=ADMIN_UNICO → CONSEJO (admin no colegiado se mapea como órgano admin)", () => {
    expect(
      resolveOrganoTipo(body({ body_type: "CDA", config: { organo_tipo: "ADMIN_UNICO" } })),
    ).toBe("CONSEJO");
  });

  it("CDA + organo_tipo=ADMIN_SOLIDARIOS → CONSEJO", () => {
    expect(
      resolveOrganoTipo(body({ body_type: "CDA", config: { organo_tipo: "ADMIN_SOLIDARIOS" } })),
    ).toBe("CONSEJO");
  });

  it("CDA + organo_tipo=ADMIN_CONJUNTA (mancomunados) → CONSEJO", () => {
    expect(
      resolveOrganoTipo(body({ body_type: "CDA", config: { organo_tipo: "ADMIN_CONJUNTA" } })),
    ).toBe("CONSEJO");
  });

  it("CDA + organo_tipo=null → CONSEJO (default umbrella)", () => {
    expect(resolveOrganoTipo(body({ body_type: "CDA", config: null }))).toBe("CONSEJO");
  });

  it("CDA + config sin organo_tipo → CONSEJO", () => {
    expect(resolveOrganoTipo(body({ body_type: "CDA", config: {} }))).toBe("CONSEJO");
  });
});

describe("resolveOrganoTipo — body_type JUNTA", () => {
  it("JUNTA → JUNTA_GENERAL", () => {
    expect(resolveOrganoTipo(body({ body_type: "JUNTA" }))).toBe("JUNTA_GENERAL");
  });

  it("JUNTA + organo_tipo=SOCIO_UNICO → JUNTA_GENERAL (socio único es junta degenerada)", () => {
    expect(
      resolveOrganoTipo(body({ body_type: "JUNTA", config: { organo_tipo: "SOCIO_UNICO" } })),
    ).toBe("JUNTA_GENERAL");
  });

  it("JUNTA + organo_tipo=JUNTA_GENERAL (redundante) → JUNTA_GENERAL", () => {
    expect(
      resolveOrganoTipo(body({ body_type: "JUNTA", config: { organo_tipo: "JUNTA_GENERAL" } })),
    ).toBe("JUNTA_GENERAL");
  });
});

describe("resolveOrganoTipo — body_type COMISION/COMITE", () => {
  it("COMISION → COMISION_DELEGADA", () => {
    expect(resolveOrganoTipo(body({ body_type: "COMISION" }))).toBe("COMISION_DELEGADA");
  });

  it("COMITE → COMISION_DELEGADA (mismas reglas de quorum por convención)", () => {
    expect(resolveOrganoTipo(body({ body_type: "COMITE" }))).toBe("COMISION_DELEGADA");
  });

  it("body_type vacío + organo_tipo=COMISION_AUDITORIA → COMISION_DELEGADA", () => {
    expect(
      resolveOrganoTipo(body({ body_type: null, config: { organo_tipo: "COMISION_AUDITORIA" } })),
    ).toBe("COMISION_DELEGADA");
  });
});

describe("resolveOrganoTipo — convenciones legacy lowercase", () => {
  it("body_type=consejo_administracion (lowercase) → CONSEJO", () => {
    expect(resolveOrganoTipo(body({ body_type: "consejo_administracion" }))).toBe("CONSEJO");
  });

  it("body_type=comision_delegada (lowercase) → COMISION_DELEGADA", () => {
    expect(resolveOrganoTipo(body({ body_type: "comision_delegada" }))).toBe("COMISION_DELEGADA");
  });

  it("body_type=CONSEJO (uppercase explicit) → CONSEJO", () => {
    expect(resolveOrganoTipo(body({ body_type: "CONSEJO" }))).toBe("CONSEJO");
  });
});

describe("resolveOrganoTipo — fallback y casos límite", () => {
  it("body=null → JUNTA_GENERAL (conservador)", () => {
    expect(resolveOrganoTipo(null)).toBe("JUNTA_GENERAL");
  });

  it("body=undefined → JUNTA_GENERAL", () => {
    expect(resolveOrganoTipo(undefined)).toBe("JUNTA_GENERAL");
  });

  it("body con todo null/undefined → JUNTA_GENERAL", () => {
    expect(resolveOrganoTipo({})).toBe("JUNTA_GENERAL");
  });

  it("body_type desconocido + organo_tipo desconocido → JUNTA_GENERAL", () => {
    expect(
      resolveOrganoTipo(body({ body_type: "FOOBAR", config: { organo_tipo: "UNKNOWN" } })),
    ).toBe("JUNTA_GENERAL");
  });

  it("body_type con espacios y mixed case → normaliza", () => {
    expect(resolveOrganoTipo(body({ body_type: "  Cda  " }))).toBe("CONSEJO");
    expect(resolveOrganoTipo(body({ body_type: "Junta " }))).toBe("JUNTA_GENERAL");
  });
});

describe("resolveOrganoTipo — config con campos extra", () => {
  it("config con muchos campos pero organo_tipo correcto → respeta organo_tipo", () => {
    expect(
      resolveOrganoTipo(
        body({
          body_type: "CDA",
          config: {
            organo_tipo: "CONSEJO_ADMIN",
            voto_calidad_presidente: true,
            adoption_mode: "MEETING",
            tipo_social: "SA",
          },
        }),
      ),
    ).toBe("CONSEJO");
  });

  it("config como objeto JSONB sin organo_tipo → cae a body_type", () => {
    expect(
      resolveOrganoTipo(
        body({
          body_type: "JUNTA",
          config: { tipo_social: "SL", canal_publicidad: ["BORME"] },
        }),
      ),
    ).toBe("JUNTA_GENERAL");
  });

  it("organo_tipo CONSEJO_ADMIN sin body_type → CONSEJO (config wins)", () => {
    expect(
      resolveOrganoTipo(body({ body_type: null, config: { organo_tipo: "CONSEJO_ADMIN" } })),
    ).toBe("CONSEJO");
  });
});

describe("resolveOrganoTipo — anti-bug useAgreementCompliance:216", () => {
  // Caso que motivó FU#3: la implementación previa en
  // useAgreementCompliance.toTipoOrgano() solo aceptaba "CONSEJO" o
  // "consejo_administracion", lo que hacía que body_type="CDA" cayera
  // erróneamente a JUNTA_GENERAL. Cloud tiene 20× CDA — 20 órganos de
  // administración tratados como Junta General por el motor.
  it("anti-bug: body_type=CDA NO cae a JUNTA_GENERAL", () => {
    expect(resolveOrganoTipo(body({ body_type: "CDA" }))).not.toBe("JUNTA_GENERAL");
    expect(resolveOrganoTipo(body({ body_type: "CDA" }))).toBe("CONSEJO");
  });
});

describe("resolveOrganoTipoStrict — variante para superficies informativas", () => {
  // Codex adversarial (2026-07-18): el fallback a Junta del resolver es el
  // criterio correcto para calcular quórums (ante la duda, el régimen más
  // exigente), pero MOSTRARLO afirma un órgano que nadie ha acreditado.

  it("coincide con el resolver en todos los órganos reales de Cloud", () => {
    const reales: Array<[Partial<GoverningBodyShape>, string]> = [
      [{ body_type: "CDA" }, "CONSEJO"],
      [{ body_type: "CDA", config: { organo_tipo: "CONSEJO_ADMIN" } }, "CONSEJO"],
      [{ body_type: "CDA", config: { organo_tipo: "ADMIN_UNICO" } }, "CONSEJO"],
      [{ body_type: "CDA", config: { organo_tipo: "ADMIN_SOLIDARIOS" } }, "CONSEJO"],
      [{ body_type: "CDA", config: { organo_tipo: "ADMIN_CONJUNTA" } }, "CONSEJO"],
      [{ body_type: "JUNTA" }, "JUNTA_GENERAL"],
      [{ body_type: "JUNTA", config: { organo_tipo: "JUNTA_GENERAL" } }, "JUNTA_GENERAL"],
      [{ body_type: "JUNTA", config: { organo_tipo: "SOCIO_UNICO" } }, "JUNTA_GENERAL"],
      [{ body_type: "COMISION", config: { organo_tipo: "COMISION_DELEGADA" } }, "COMISION_DELEGADA"],
      [{ body_type: "COMITE", config: { organo_tipo: "COMISION_DELEGADA" } }, "COMISION_DELEGADA"],
      [{ body_type: "COMITE" }, "COMISION_DELEGADA"],
    ];
    for (const [shape, esperado] of reales) {
      expect(resolveOrganoTipoStrict(body(shape))).toBe(esperado);
      expect(resolveOrganoTipoStrict(body(shape))).toBe(resolveOrganoTipo(body(shape)));
    }
  });

  it("devuelve null en vez de adivinar Junta ante un órgano irreconocible", () => {
    expect(resolveOrganoTipo(body({ body_type: "ORGANO_RARO" }))).toBe("JUNTA_GENERAL");
    expect(resolveOrganoTipoStrict(body({ body_type: "ORGANO_RARO" }))).toBeNull();
    expect(resolveOrganoTipoStrict(body())).toBeNull();
    expect(resolveOrganoTipoStrict(null)).toBeNull();
  });
});
