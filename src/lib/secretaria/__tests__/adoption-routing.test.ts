import { describe, expect, it } from "bun:test";
import {
  coarseAdoptionMateria,
  normalizeAdoptionModes,
  pickPrimaryAdoptionMode,
  resolveAdoptionRoute,
} from "../adoption-routing";

describe("adoption-routing", () => {
  it("normaliza modos como strings u objetos {code} con dedupe", () => {
    expect(
      normalizeAdoptionModes(["meeting", { code: "MEETING" }, " no_session ", null, { code: null }]),
    ).toEqual(["MEETING", "NO_SESSION"]);
  });

  it("prioriza la sesión formal cuando la regla admite varios modos", () => {
    expect(pickPrimaryAdoptionMode(["UNIPERSONAL_ADMIN", "MEETING"])).toBe("MEETING");
    expect(pickPrimaryAdoptionMode(["NO_SESSION", "UNIVERSAL"])).toBe("UNIVERSAL");
  });

  it("cae a sesión formal sin información de modos", () => {
    expect(pickPrimaryAdoptionMode(undefined)).toBe("MEETING");
    expect(pickPrimaryAdoptionMode([])).toBe("MEETING");
    expect(pickPrimaryAdoptionMode(["MODO_DESCONOCIDO"])).toBe("MEETING");
  });

  it("resuelve sesión formal hacia el asistente de convocatoria", () => {
    const target = resolveAdoptionRoute({
      materia: "DIVIDENDO_A_CUENTA",
      adoptionModes: ["MEETING", "UNIPERSONAL_ADMIN"],
      scope: "sociedad",
      entityId: "entidad-1",
    });
    expect(target.mode).toBe("MEETING");
    expect(target.to).toBe(
      "/secretaria/convocatorias/nueva?materia=DIVIDENDO_A_CUENTA&scope=sociedad&entity=entidad-1",
    );
  });

  it("resuelve cada vía escrita o unipersonal a su stepper", () => {
    expect(resolveAdoptionRoute({ materia: "OPERACION_VINCULADA", adoptionModes: ["NO_SESSION"] }).to).toBe(
      "/secretaria/acuerdos-sin-sesion/nuevo?materia=OPERACION_VINCULADA",
    );
    expect(resolveAdoptionRoute({ materia: "OTROS", adoptionModes: ["CO_APROBACION"] }).to).toBe(
      "/secretaria/acuerdos-sin-sesion/co-aprobacion?materia=OTROS",
    );
    expect(resolveAdoptionRoute({ materia: "OTROS", adoptionModes: ["SOLIDARIO"] }).to).toBe(
      "/secretaria/acuerdos-sin-sesion/solidario?materia=OTROS",
    );
    expect(
      resolveAdoptionRoute({ materia: "CONTRATOS_SOCIO_UNICO_SOCIEDAD", adoptionModes: ["UNIPERSONAL_SOCIO"] }).to,
    ).toBe("/secretaria/decisiones-unipersonales/nueva?materia=CONTRATOS_SOCIO_UNICO_SOCIEDAD&decisor=SOCIO_UNICO");
    expect(
      resolveAdoptionRoute({ materia: "OTROS", adoptionModes: ["UNIPERSONAL_ADMIN"] }).to,
    ).toBe("/secretaria/decisiones-unipersonales/nueva?materia=OTROS&decisor=ADMINISTRADOR_UNICO");
  });

  it("canonicaliza alias de materia y propaga la plantilla", () => {
    const target = resolveAdoptionRoute({
      materia: "EXCLUSION_DERECHO_SUSCRIPCION_PREFERENTE",
      adoptionModes: [{ code: "MEETING" }],
      plantillaId: "plantilla-1",
    });
    expect(target.to).toBe(
      "/secretaria/convocatorias/nueva?materia=SUPRESION_PREFERENTE&plantilla=plantilla-1",
    );
  });

  it("mapea materias canónicas al selector agregado de co-aprobación/solidario", () => {
    expect(coarseAdoptionMateria("APROBACION_CUENTAS")).toBe("APROBACION_CUENTAS");
    expect(coarseAdoptionMateria("CESE_CONSEJERO")).toBe("NOMBRAMIENTO_CESE");
    expect(coarseAdoptionMateria("COOPTACION")).toBe("NOMBRAMIENTO_CESE");
    expect(coarseAdoptionMateria("MODIFICACION_ESTATUTOS")).toBe("MOD_ESTATUTOS");
    expect(coarseAdoptionMateria("FUSION")).toBe("OPERACION_ESTRUCTURAL");
    expect(coarseAdoptionMateria("REDUCCION_CAPITAL")).toBe("OPERACION_ESTRUCTURAL");
    expect(coarseAdoptionMateria("DELEGACION_FACULTADES")).toBe("DELEGACION_FACULTADES");
  });

  it("canonicaliza alias legacy antes de mapear al selector agregado", () => {
    // MOD_ESTATUTOS → MODIFICACION_ESTATUTOS (alias) → MOD_ESTATUTOS (coarse)
    expect(coarseAdoptionMateria("MOD_ESTATUTOS")).toBe("MOD_ESTATUTOS");
    expect(coarseAdoptionMateria("NOMBRAMIENTO_CESE")).toBe("NOMBRAMIENTO_CESE");
    expect(coarseAdoptionMateria("AMPLIACION_CAPITAL")).toBe("OPERACION_ESTRUCTURAL");
  });

  it("devuelve null cuando no hay correspondencia fiable", () => {
    expect(coarseAdoptionMateria("SUPRESION_PREFERENTE")).toBeNull();
    expect(coarseAdoptionMateria("DIVIDENDO_A_CUENTA")).toBeNull();
    expect(coarseAdoptionMateria(undefined)).toBeNull();
    expect(coarseAdoptionMateria("")).toBeNull();
  });

  it("no emite entity fuera del ámbito sociedad", () => {
    const target = resolveAdoptionRoute({
      materia: "APROBACION_CUENTAS",
      adoptionModes: ["MEETING"],
      scope: "grupo",
      entityId: "entidad-1",
    });
    expect(target.to).toBe("/secretaria/convocatorias/nueva?materia=APROBACION_CUENTAS&scope=grupo");
  });
});
