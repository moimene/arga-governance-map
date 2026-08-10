import { describe, expect, it } from "vitest";
import type { TipoOrgano } from "@/lib/rules-engine";
import {
  AGENDA_INFORMATIVE_MATERIAS,
  AGENDA_MATERIAS,
  ALL_ORGANOS,
  MATERIA_ORGANOS,
  MATERIAS_LIBRES,
  agendaItemsForDecisionEngine,
  agendaMateriaSelectionForKind,
  agendaMateriaGroups,
  isMateriaInformativa,
  isMateriaCompatibleWithOrgano,
  isMateriaVisibleForTipoSocial,
  labelMateria,
  materiaDefaultForOrgano,
  resolveMateriaAlias,
  resolveMateriaPresentationAlias,
} from "@/lib/secretaria/agenda-materias";

const ORGANOS: TipoOrgano[] = ["JUNTA_GENERAL", "CONSEJO", "COMISION_DELEGADA"];

describe("agenda-materias — catálogo canónico materia × órgano", () => {
  it("separa las dos categorías informativas del catálogo de acuerdos", () => {
    expect(AGENDA_INFORMATIVE_MATERIAS).toEqual([
      {
        value: "INFORME_DIRECCION_GENERAL_MARCHA_SOCIEDAD",
        label: "Informe de la Dirección General sobre la marcha de la sociedad",
      },
      {
        value: "INFORME_GOBIERNO_CORPORATIVO_CUMPLIMIENTO",
        label: "Informe de gobierno corporativo y cumplimiento",
      },
    ]);
    for (const materia of AGENDA_INFORMATIVE_MATERIAS) {
      expect(isMateriaInformativa(materia.value)).toBe(true);
      expect(AGENDA_MATERIAS.some((candidate) => candidate.value === materia.value)).toBe(false);
      expect(labelMateria(materia.value)).toBe(materia.label);
      expect(MATERIA_ORGANOS[materia.value]).toEqual(ALL_ORGANOS);
    }
  });

  it("al cambiar a INFORMATIVO sustituye una materia decisoria por la categoría visible por defecto", () => {
    expect(
      agendaMateriaSelectionForKind({
        kind: "INFORMATIVO",
        currentMateria: "APROBACION_PLAN_NEGOCIO",
        organoTipo: "CONSEJO",
      }),
    ).toEqual({
      materia: "INFORME_DIRECCION_GENERAL_MARCHA_SOCIEDAD",
      tipo: "ORDINARIA",
      inscribible: false,
    });
  });

  it("conserva una categoría informativa elegida y nunca la reutiliza al volver a DECISORIO", () => {
    expect(
      agendaMateriaSelectionForKind({
        kind: "DELIBERATIVO",
        currentMateria: "INFORME_GOBIERNO_CORPORATIVO_CUMPLIMIENTO",
        organoTipo: "CONSEJO",
      }).materia,
    ).toBe("INFORME_GOBIERNO_CORPORATIVO_CUMPLIMIENTO");

    const decisoria = agendaMateriaSelectionForKind({
      kind: "DECISORIO",
      currentMateria: "INFORME_GOBIERNO_CORPORATIVO_CUMPLIMIENTO",
      organoTipo: "CONSEJO",
    });
    expect(decisoria.materia).toBe("APROBACION_PLAN_NEGOCIO");
    expect(isMateriaInformativa(decisoria.materia)).toBe(false);
  });

  it("el boundary del motor deja fuera toda categoría no decisoria", () => {
    const items = [
      { kind: "INFORMATIVO" as const, materia: "INFORME_DIRECCION_GENERAL_MARCHA_SOCIEDAD" },
      { kind: "DELIBERATIVO" as const, materia: "INFORME_GOBIERNO_CORPORATIVO_CUMPLIMIENTO" },
      { kind: "DECISORIO" as const, materia: "FORMULACION_CUENTAS" },
      { materia: "APROBACION_PLAN_NEGOCIO" },
    ];
    expect(agendaItemsForDecisionEngine(items).map((item) => item.materia)).toEqual([
      "FORMULACION_CUENTAS",
    ]);
  });

  it("ofrece PODER_REPRESENTACION al Consejo sin confundirlo con delegación orgánica", () => {
    const poder = AGENDA_MATERIAS.find((materia) => materia.value === "PODER_REPRESENTACION");

    expect(poder).toMatchObject({
      label: "Otorgamiento o modificación de poderes de representación",
      tipo: "ORDINARIA",
      inscribible: true,
    });
    expect(MATERIA_ORGANOS.PODER_REPRESENTACION).toContain("CONSEJO");
  });

  it("separa la representación del socio único en la filial del art. 212 bis LSC", () => {
    const materia = AGENDA_MATERIAS.find(
      (candidate) => candidate.value === "DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL",
    );

    expect(materia).toMatchObject({
      label: "Designación de representante de la socia única en la filial",
      tipo: "ORDINARIA",
      inscribible: false,
    });
    expect(materia?.label).not.toMatch(/administradora|persona jurídica|212 bis/i);
    expect(MATERIA_ORGANOS.DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL).toEqual([
      "CONSEJO",
    ]);
    expect(
      isMateriaCompatibleWithOrgano(
        "DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL",
        "COMISION_DELEGADA",
      ),
    ).toBe(false);
  });

  it("mantiene la representación genérica legacy como identidad distinta", () => {
    expect(
      AGENDA_MATERIAS.find(
        (candidate) => candidate.value === "NOMBRAMIENTO_REPRESENTANTE_FILIAL",
      ),
    ).toMatchObject({
      label: "Designación de representante de la sociedad en filial o participada",
    });
    expect(
      resolveMateriaAlias("NOMBRAMIENTO_REPRESENTANTE_FILIAL"),
    ).toBe("NOMBRAMIENTO_REPRESENTANTE_FILIAL");
  });

  it("todas las materias del catálogo tienen mapeo explícito de órganos", () => {
    const sinMapeo = AGENDA_MATERIAS.filter((m) => !MATERIA_ORGANOS[m.value]);
    expect(sinMapeo.map((m) => m.value)).toEqual([]);
  });

  it("los grupos particionan exactamente las materias compatibles (sin duplicados ni huecos)", () => {
    for (const organo of ORGANOS) {
      // G3 fix round 1 (I-1): agendaMateriaGroups sin tipoSocial también
      // aplica el gate fail-closed de isMateriaVisibleForTipoSocial (oculta
      // las materias soloTipoSocial, p.ej. las 6 SLP) — la referencia debe
      // filtrar lo mismo para seguir siendo la partición exacta.
      const compatibles = AGENDA_MATERIAS.filter(
        (m) => isMateriaCompatibleWithOrgano(m.value, organo) && isMateriaVisibleForTipoSocial(m, undefined),
      ).map((m) => m.value);
      const agrupadas = agendaMateriaGroups(organo).flatMap((g) => g.materias.map((m) => m.value));
      expect([...agrupadas].sort()).toEqual([...compatibles].sort());
      expect(new Set(agrupadas).size).toBe(agrupadas.length);
    }
  });

  it("Junta y Consejo separan sus materias propias (cuentas: aprueba la Junta, formula el Consejo)", () => {
    const propiasJunta = agendaMateriaGroups("JUNTA_GENERAL").find((g) => g.key === "propias")!;
    const propiasConsejo = agendaMateriaGroups("CONSEJO").find((g) => g.key === "propias")!;
    expect(propiasJunta.materias.map((m) => m.value)).toContain("APROBACION_CUENTAS");
    expect(propiasJunta.materias.map((m) => m.value)).not.toContain("FORMULACION_CUENTAS");
    expect(propiasConsejo.materias.map((m) => m.value)).toContain("FORMULACION_CUENTAS");
    expect(propiasConsejo.materias.map((m) => m.value)).not.toContain("APROBACION_CUENTAS");
  });

  it("las transversales (todos los órganos) van en su propio grupo, no en propias", () => {
    for (const organo of ORGANOS) {
      const groups = agendaMateriaGroups(organo);
      const transversales = groups.find((g) => g.key === "transversales");
      expect(transversales?.materias.map((m) => m.value)).toContain("NOMBRAMIENTO_CONSEJERO");
      const propias = groups.find((g) => g.key === "propias");
      expect(propias?.materias.map((m) => m.value) ?? []).not.toContain("NOMBRAMIENTO_CONSEJERO");
    }
  });

  it("el punto libre está disponible para cualquier órgano en su propio grupo", () => {
    for (const organo of ORGANOS) {
      const libre = agendaMateriaGroups(organo).find((g) => g.key === "libre");
      expect(libre?.materias.map((m) => m.value)).toEqual([...MATERIAS_LIBRES]);
    }
  });

  it("una materia desconocida (borradores legacy) es compatible con todo por fallback conservador", () => {
    for (const organo of ORGANOS) {
      expect(isMateriaCompatibleWithOrgano("MATERIA_LEGACY_DESCONOCIDA", organo)).toBe(true);
    }
    expect(labelMateria("MATERIA_LEGACY_DESCONOCIDA")).toBe("Materia legacy desconocida");
  });

  it("separa el alias de presentación del art. 308 de la identidad funcional", () => {
    expect(resolveMateriaAlias("AMPLIACION_CAPITAL")).toBe("AUMENTO_CAPITAL");
    expect(labelMateria("AMPLIACION_CAPITAL")).toBe("Aumento de capital");
    expect(resolveMateriaAlias("EXCLUSION_DERECHO_SUSCRIPCION_PREFERENTE")).toBe(
      "EXCLUSION_DERECHO_SUSCRIPCION_PREFERENTE",
    );
    expect(resolveMateriaPresentationAlias("EXCLUSION_DERECHO_SUSCRIPCION_PREFERENTE")).toBe(
      "SUPRESION_PREFERENTE",
    );
    expect(labelMateria("EXCLUSION_DERECHO_SUSCRIPCION_PREFERENTE")).toBe(
      "Exclusión del derecho de preferencia —supresión total o parcial—",
    );
    expect(labelMateria("SUPRESION_PREFERENTE", "Supresión del derecho preferente")).toBe(
      "Exclusión del derecho de preferencia —supresión total o parcial—",
    );
  });

  it("presenta con ortografía jurídica las materias de proceso reales de Cloud", () => {
    expect(labelMateria("ACUERDO_SIN_SESION")).toBe("Acuerdo sin sesión");
    expect(labelMateria("CERTIFICACION_ACUERDOS")).toBe("Certificación de acuerdos");
    expect(labelMateria("DECISION_SOCIO_UNICO")).toBe("Decisión del socio único");
    expect(labelMateria("DECISION_ADMIN_UNICO")).toBe("Decisión del administrador único");
    expect(labelMateria("NOTIFICACION_CONVOCATORIA_SL")).toBe(
      "Notificación individual de convocatoria de S.L.",
    );
    expect(labelMateria("CO_APROBACION")).toBe(
      "Coaprobación de administradores mancomunados",
    );
    expect(labelMateria("ACTAS_ORGANOS_DELEGADOS")).toBe("Actas de órganos delegados");
    expect(labelMateria("CONSEJO_ADMIN")).toBe("Consejo de Administración");
    expect(labelMateria("JUNTA_GENERAL")).toBe("Junta General");
    expect(labelMateria("CONVOCATORIA_CDA")).toBe(
      "Convocatoria del Consejo de Administración",
    );
    expect(labelMateria("CONVOCATORIA_COMISION_DELEGADA")).toBe(
      "Convocatoria de comisión delegada",
    );
    expect(labelMateria("CONVOCATORIA_JUNTA")).toBe("Convocatoria de Junta General");
    expect(labelMateria("CONVOCATORIA_PRE")).toBe("Comprobación previa de convocatoria");
    expect(labelMateria("EXPEDIENTE_PRE")).toBe("Comprobación documental previa");
    expect(labelMateria("GESTION_SOCIEDAD")).toBe("Gestión de la sociedad");
    expect(labelMateria("ADMIN_SOLIDARIO")).toBe("Decisión de administrador solidario");
  });

  it("materiaDefaultForOrgano devuelve una materia compatible con el órgano", () => {
    for (const organo of ORGANOS) {
      const def = materiaDefaultForOrgano(organo);
      expect(isMateriaCompatibleWithOrgano(def.value, organo)).toBe(true);
    }
  });

  it("las materias estructurales son exclusivas de la Junta General", () => {
    const estructurales = AGENDA_MATERIAS.filter((m) => m.tipo === "ESTRUCTURAL");
    expect(estructurales.length).toBeGreaterThan(0);
    for (const m of estructurales) {
      expect(MATERIA_ORGANOS[m.value]).toEqual(["JUNTA_GENERAL"]);
    }
  });

  it("ALL_ORGANOS cubre los tres tipos de órgano soportados", () => {
    expect([...ALL_ORGANOS].sort()).toEqual([...ORGANOS].sort());
  });
});
