import { describe, expect, it } from "vitest";
import type { MateriaCatalogRow } from "@/hooks/useMateriaConfig";
import type { RulePackVersionRow } from "@/hooks/useRulePacks";
import {
  buildMatterRuleVariants,
  buildRuleApplicabilityExplanation,
  extractRulePackDocuments,
  filterMateriaCatalogItems,
  groupActiveRulePacksByOrgano,
  materiaAliasesForSearch,
  matchesMateriaCatalogSearch,
  normalizeCatalogSearchText,
  resolveMateriaCodeAgainstCatalog,
  resolveEffectiveFormalization,
  resolveRulePackLegalBranches,
  selectActiveRulePacksForMateria,
  usageNotesForMateria,
} from "../materia-catalog-ux";

function materia(patch: Partial<MateriaCatalogRow> = {}): MateriaCatalogRow {
  return {
    materia: "APROBACION_CUENTAS",
    materia_label_es: "Aprobación de cuentas anuales",
    requires_notary: false,
    requires_registry: false,
    inscribable: false,
    matter_class: "ORDINARIA",
    min_majority_code: "SIMPLE",
    publication_required: false,
    plazo_inscripcion_dias: null,
    referencia_legal: "arts. 253 y 272 LSC",
    ...patch,
  };
}

function pack(patch: Partial<RulePackVersionRow> = {}): RulePackVersionRow {
  return {
    id: patch.id ?? "version-1",
    rule_pack_id: patch.rule_pack_id ?? "pack-1",
    version_tag: patch.version_tag ?? "1.0.0",
    status: patch.status ?? "ACTIVE",
    params: patch.params ?? {
      organoTipo: "JUNTA_GENERAL",
      modosAdopcionPermitidos: ["MEETING", "UNIVERSAL"],
      convocatoria: {
        documentosObligatorios: [
          { id: "cuentas", nombre: "Cuentas anuales formuladas", condicion: "SIEMPRE" },
        ],
      },
      documentacion: {
        obligatoria: [
          { id: "auditoria", nombre: "Informe de auditoría", condicion: "SI_AUDITORIA" },
        ],
      },
      constitucion: {
        quorum: {
          SA_1a: { valor: 0.25, referencia: "art. 193.1 LSC" },
          SA_2a: { valor: 0, referencia: "art. 193.2 LSC" },
          SL: { valor: 0, referencia: "art. 198 LSC" },
          CONSEJO: { valor: "mayoria_miembros", referencia: "art. 247.1 LSC" },
        },
      },
      votacion: {
        mayoria: {
          SA: { formula: "favor > contra", referencia: "art. 201.1 LSC" },
          SL: { formula: "favor > mitad_capital_con_voto", referencia: "art. 198 LSC" },
          CONSEJO: { formula: "favor > total_miembros / 2", referencia: "art. 248.1 LSC" },
        },
      },
      postAcuerdo: {
        inscribible: false,
        instrumentoRequerido: "NINGUNO",
        publicacionRequerida: false,
      },
    },
    created_at: patch.created_at ?? "2026-07-10T10:00:00Z",
    tenant_id: patch.tenant_id ?? "tenant",
    materia: patch.materia ?? "APROBACION_CUENTAS",
    clase: patch.clase,
    organo_tipo: patch.organo_tipo ?? "JUNTA_GENERAL",
  };
}

describe("materia-catalog-ux", () => {
  it("normaliza tildes, códigos y puntuación para búsqueda jurídica", () => {
    expect(normalizeCatalogSearchText("  INSCRIPCIÓN_registral / Art. 308 ")).toBe(
      "inscripcion registral art 308",
    );
  });

  it("indexa documentos de convocatoria y expediente sin duplicar nombres", () => {
    const documents = extractRulePackDocuments(pack().params);
    expect(documents).toEqual([
      expect.objectContaining({ name: "Cuentas anuales formuladas", phase: "convocatoria" }),
      expect.objectContaining({ name: "Informe de auditoría", phase: "expediente" }),
    ]);
  });

  it("unifica alias de catálogo y de reglas para selección, búsqueda, notas y resolución", () => {
    const presupuestoPack = pack({ materia: "APROBACION_PRESUPUESTO" });
    expect(selectActiveRulePacksForMateria(
      [presupuestoPack],
      "APROBACION_PRESUPUESTOS",
    )).toEqual([presupuestoPack]);
    expect(materiaAliasesForSearch("MODIFICACION_REGLAMENTO")).toContain(
      "APROBACION_REGLAMENTO_CONSEJO",
    );
    expect(resolveMateriaCodeAgainstCatalog(
      "APROBACION_REGLAMENTO_CONSEJO",
      ["MODIFICACION_REGLAMENTO"],
    )).toBe("MODIFICACION_REGLAMENTO");
    expect(matchesMateriaCatalogSearch({
      materia: materia({
        materia: "MODIFICACION_REGLAMENTO",
        materia_label_es: "Modificación del reglamento",
      }),
      status: "lista",
    }, "aprobacion reglamento consejo")).toBe(true);
    expect(usageNotesForMateria("MODIFICACION_REGLAMENTO")?.title).toBe(
      "Reglamento del Consejo o estatutos",
    );
  });

  it("busca por alias, artículo y documento real del rule pack", () => {
    const item = {
      materia: materia({
        materia: "SUPRESION_PREFERENTE",
        materia_label_es: "Exclusión o supresión del derecho de preferencia",
        referencia_legal: "art. 308 LSC",
      }),
      status: "lista" as const,
      documents: [{
        id: "informe_admin",
        name: "Informe de administradores y experto",
        condition: null,
        phase: "expediente" as const,
      }],
    };
    expect(matchesMateriaCatalogSearch(item, "exclusion derecho suscripcion")).toBe(true);
    expect(matchesMateriaCatalogSearch(item, "308")).toBe(true);
    expect(matchesMateriaCatalogSearch(item, "experto")).toBe(true);
  });

  it("conserva AUTORIZACION_GARANTIA como variantes Consejo y Junta", () => {
    const packs = [
      pack({
        id: "c",
        rule_pack_id: "c",
        materia: "AUTORIZACION_GARANTIA",
        organo_tipo: "CONSEJO",
        params: { ...(pack().params as Record<string, unknown>), organoTipo: "CONSEJO" },
      }),
      pack({ id: "j", rule_pack_id: "j", materia: "AUTORIZACION_GARANTIA", organo_tipo: "JUNTA_GENERAL", params: {
        ...(pack().params as Record<string, unknown>),
        organoTipo: "JUNTA_GENERAL",
      } }),
    ];
    const groups = groupActiveRulePacksByOrgano(packs, "AUTORIZACION_GARANTIA");
    expect(groups.map((group) => group.organoLabel).sort()).toEqual([
      "Consejo de Administración",
      "Junta General",
    ]);
  });

  it("hace prevalecer el órgano canónico y expone el conflicto con el contenido", () => {
    const sociedadUnipersonal = pack({
      materia: "SOCIEDAD_UNIPERSONAL",
      organo_tipo: "SOCIO_UNICO",
      params: {
        ...(pack().params as Record<string, unknown>),
        organoTipo: "JUNTA_GENERAL",
        modosAdopcionPermitidos: ["UNIPERSONAL_SOCIO"],
      },
    });
    const [variant] = buildMatterRuleVariants({
      packs: [sociedadUnipersonal],
      materia: materia({
        materia: "SOCIEDAD_UNIPERSONAL",
        materia_label_es: "Decisiones del socio único",
      }),
      tipoSocial: "SLU",
    });
    expect(variant.organoCode).toBe("SOCIO_UNICO");
    expect(variant.organoLabel).toBe("Socio único");
    expect(variant.branches).toEqual([
      expect.objectContaining({
        id: "SOCIO_UNICO",
        label: "Socio único",
        majority: "Decisión del socio único",
        quorum: "No aplica",
      }),
    ]);
    expect(variant.branches.map((branch) => branch.id)).not.toContain("SA");
    expect(variant.warnings.join(" ")).toContain("Se aplica la metadata canónica");
  });

  it("selecciona la rama Consejo y conserva la referencia determinante", () => {
    const consejo = pack({
      materia: "FORMULACION_CUENTAS",
      organo_tipo: "CONSEJO",
      params: {
        ...(pack().params as Record<string, unknown>),
        organoTipo: "CONSEJO",
      },
    });
    const [branch] = resolveRulePackLegalBranches(consejo, "SA");
    expect(branch.label).toBe("Consejo de Administración");
    expect(branch.majority).toBe("Mayoría absoluta de miembros");
    expect(branch.majorityReference).toBe("art. 248.1 LSC");
  });

  it("modela la restricción jurídica de COOPTACION para S.A. y preserva la variante en S.L.", () => {
    const cooptacion = pack({
      materia: "COOPTACION",
      organo_tipo: "CONSEJO",
      params: {
        ...(pack().params as Record<string, unknown>),
        organoTipo: "CONSEJO",
        restriccionTipoSocial: ["SA"],
        nota: "Cooptación exclusiva de SA (art. 244 LSC).",
      },
    });
    const row = materia({
      materia: "COOPTACION",
      materia_label_es: "Nombramiento por cooptación",
    });
    const [sa] = buildMatterRuleVariants({ packs: [cooptacion], materia: row, tipoSocial: "SA" });
    const [sau] = buildMatterRuleVariants({ packs: [cooptacion], materia: row, tipoSocial: "SAU" });
    const slVariants = buildMatterRuleVariants({ packs: [cooptacion], materia: row, tipoSocial: "SL" });
    const [withoutSocialType] = buildMatterRuleVariants({ packs: [cooptacion], materia: row });

    expect(sa.socialTypeRestrictions).toEqual(["SA"]);
    expect(sa.socialTypeApplicability).toBe("applies");
    expect(sau.socialTypeApplicability).toBe("applies");
    expect(sa.socialTypeApplicabilityReason).toContain("art. 244 LSC");
    expect(slVariants).toHaveLength(1);
    expect(slVariants[0].socialTypeApplicability).toBe("not_applicable");
    expect(slVariants[0].socialTypeApplicabilityReason).toContain("No aplica a S.L.");
    expect(slVariants[0].warnings).toContain(slVariants[0].socialTypeApplicabilityReason);
    expect(withoutSocialType.socialTypeApplicability).toBe("unresolved");
    expect(withoutSocialType.socialTypeApplicabilityReason).toContain("no tiene tipo social informado");

    const [inconsistentConfiguration] = buildMatterRuleVariants({
      packs: [cooptacion],
      materia: row,
      socialTypeIssue: "El tipo social (SA) y la forma jurídica (S.L.) pertenecen a familias distintas.",
    });
    expect(inconsistentConfiguration.socialTypeApplicability).toBe("unresolved");
    expect(inconsistentConfiguration.socialTypeApplicabilityReason).toContain("familias distintas");
    expect(inconsistentConfiguration.socialTypeApplicabilityReason).not.toContain("no tiene tipo social informado");
  });

  it("una regla sin restricción de tipo social aplica también en ámbito grupo", () => {
    const [variant] = buildMatterRuleVariants({ packs: [pack()], materia: materia() });
    expect(variant.socialTypeRestrictions).toEqual([]);
    expect(variant.socialTypeApplicability).toBe("applies");
  });

  it("acepta restricciones string y trata S.L., S.R.L. y S.L.U. como equivalentes", () => {
    const restrictedToLimitedCompanies = pack({
      materia: "PRESTACIONES_ACCESORIAS",
      params: {
        ...(pack().params as Record<string, unknown>),
        restriccionTipoSocial: "SL / SLU",
      },
    });
    const row = materia({
      materia: "PRESTACIONES_ACCESORIAS",
      materia_label_es: "Prestaciones accesorias",
    });
    const resolveFor = (tipoSocial: string) => buildMatterRuleVariants({
      packs: [restrictedToLimitedCompanies],
      materia: row,
      tipoSocial,
    })[0];

    expect(resolveFor("SL").socialTypeRestrictions).toEqual(["SL"]);
    expect(resolveFor("SL").socialTypeApplicability).toBe("applies");
    expect(resolveFor("SRL").socialTypeApplicability).toBe("applies");
    expect(resolveFor("SLU").socialTypeApplicability).toBe("applies");
    expect(resolveFor("SAU").socialTypeApplicability).toBe("not_applicable");
    expect(resolveFor("SAU").socialTypeApplicabilityReason).toContain("S.L. / S.L.U. / S.R.L.");
  });

  it("normaliza quórums porcentuales y conserva ambas convocatorias de una S.A.", () => {
    const [branch] = resolveRulePackLegalBranches(pack(), "SA");
    expect(branch.quorums).toEqual([
      expect.objectContaining({
        id: "SA_1a",
        label: "Primera convocatoria",
        value: "25 % del capital con derecho de voto",
        reference: "art. 193.1 LSC",
      }),
      expect.objectContaining({
        id: "SA_2a",
        label: "Segunda convocatoria",
        value: "0 % del capital con derecho de voto",
        reference: "art. 193.2 LSC",
      }),
    ]);
    const params = pack().params as Record<string, unknown>;
    const withWholePercentages = pack({
      params: {
        ...params,
        constitucion: {
          quorum: {
            SA_1a: { valor: 25, unidad: "%" },
            SA_2a: { valor: 50, unidad: "porcentaje" },
          },
        },
      },
    });
    expect(resolveRulePackLegalBranches(withWholePercentages, "SA")[0].quorums.map((row) => row.value)).toEqual([
      "25 % del capital con derecho de voto",
      "50 % del capital con derecho de voto",
    ]);
    const consejo = pack({
      organo_tipo: "CONSEJO",
      params: {
        ...params,
        organoTipo: "CONSEJO",
        constitucion: { quorum: { CONSEJO: { valor: 0.5 } } },
      },
    });
    expect(resolveRulePackLegalBranches(consejo, "SA")[0].quorum).toBe("50 % de miembros");
  });

  it("hace explícita la discrepancia formal de dividendo a cuenta", () => {
    const row = materia({
      materia: "DIVIDENDO_A_CUENTA",
      requires_registry: true,
    });
    const result = resolveEffectiveFormalization(pack({ materia: "DIVIDENDO_A_CUENTA" }), row);
    expect(result.kinds).toEqual(["ARCHIVO_INTERNO"]);
    expect(result.catalogKinds).toEqual(["REGISTRO"]);
    expect(result.discrepancy).toBe(true);
  });

  it("no convierte presupuestos decisorios en constancia por compartir grupo funcional", () => {
    const row = materia({
      materia: "APROBACION_PRESUPUESTO",
      materia_label_es: "Aprobación del presupuesto",
    });
    expect(resolveEffectiveFormalization(null, row).kinds).toEqual(["ARCHIVO_INTERNO"]);
  });

  it("reconoce el depósito de cuentas como formalización registral y conserva su procedencia", () => {
    const cuentasPack = pack({
      materia: "APROBACION_CUENTAS",
      params: {
        ...(pack().params as Record<string, unknown>),
        postAcuerdo: {
          inscribible: false,
          instrumentoRequerido: "CERTIFICACION",
          publicacionRequerida: false,
          deposito_cuentas: {
            obligatorio: true,
            plazoDias: 30,
            referencia: "art. 279 LSC",
          },
        },
      },
    });
    const result = resolveEffectiveFormalization(cuentasPack, materia());
    expect(result.kinds).toEqual(["REGISTRO"]);
    expect(result.registryRequired).toBe(true);
    expect(result.evidence).toContainEqual(expect.objectContaining({
      kind: "REGISTRO",
      path: "postAcuerdo.deposito_cuentas",
      reference: "art. 279 LSC",
    }));
  });

  it("reconoce variantes defensivas de depósito y respeta un flag explícito falso", () => {
    const enabled = resolveEffectiveFormalization(pack({
      params: {
        ...(pack().params as Record<string, unknown>),
        postAcuerdo: { depositoCuentas: { required: true } },
      },
    }), materia());
    const disabled = resolveEffectiveFormalization(pack({
      params: {
        ...(pack().params as Record<string, unknown>),
        postAcuerdo: { deposito_registral: { obligatorio: false } },
      },
    }), materia());
    expect(enabled.kinds).toEqual(["REGISTRO"]);
    expect(enabled.evidence[0].path).toBe("postAcuerdo.depositoCuentas");
    expect(disabled.kinds).toEqual(["ARCHIVO_INTERNO"]);
  });

  it("conserva filas activas equivalentes del mismo órgano sin fusionar órganos distintos", () => {
    const old = pack({
      id: "old",
      rule_pack_id: "presupuesto-plural",
      materia: "APROBACION_PRESUPUESTOS",
      created_at: "2026-07-01T10:00:00Z",
    });
    const current = pack({
      id: "current",
      rule_pack_id: "presupuesto-singular",
      materia: "APROBACION_PRESUPUESTO",
      created_at: "2026-07-11T10:00:00Z",
    });
    const variants = buildMatterRuleVariants({
      packs: [old, current],
      materia: materia({
        materia: "APROBACION_PRESUPUESTOS",
        materia_label_es: "Aprobación de presupuestos",
      }),
      tipoSocial: "SA",
    });
    expect(variants).toHaveLength(1);
    expect(variants[0].versionId).toBe("current");
    expect(variants[0].activeEquivalentVersions.map((row) => row.versionId)).toEqual([
      "current",
      "old",
    ]);
    expect(variants[0].warnings.join(" ")).toContain("2 filas activas equivalentes");
  });

  it("combina búsqueda y filtros de mayoría, formalización y estado", () => {
    const items = [
      {
        materia: materia(),
        status: "lista" as const,
        documents: extractRulePackDocuments(pack().params),
        formalizationKinds: ["ARCHIVO_INTERNO" as const],
      },
      {
        materia: materia({
          materia: "AUMENTO_CAPITAL",
          materia_label_es: "Aumento de capital social",
          min_majority_code: "REFORZADA_2_3",
          requires_notary: true,
          requires_registry: true,
        }),
        status: "bloqueada" as const,
        documents: [],
        formalizationKinds: ["ESCRITURA" as const, "REGISTRO" as const],
      },
    ];
    expect(filterMateriaCatalogItems(items, {
      search: "auditoria",
      majority: "SIMPLE",
      formalization: "ARCHIVO_INTERNO",
      status: "lista",
    })).toHaveLength(1);
  });

  it("separa determinante del pack y pacto contractual revisado", () => {
    const row = materia({ requires_registry: true });
    const variants = buildMatterRuleVariants({ packs: [pack()], materia: row, tipoSocial: "SA" });
    const explanation = buildRuleApplicabilityExplanation({
      materia: row,
      variants,
      pactos: [{ materias_aplicables: ["APROBACION_CUENTAS"], titulo: "Pacto ARGA" }],
    });
    expect(explanation.determinants.some((entry) => entry.reference === "art. 201.1 LSC")).toBe(true);
    expect(explanation.determinants).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: "Junta General · documento para convocatoria",
        value: expect.stringContaining("Cuentas anuales formuladas"),
        provenance: expect.stringContaining("Regla versionada activa"),
      }),
      expect.objectContaining({
        label: "Junta General · formalización",
        value: "Archivo interno",
        provenance: expect.stringContaining("postAcuerdo"),
      }),
    ]));
    expect(explanation.warnings.join(" ")).toContain("el catálogo registra Registro o depósito registral");
    expect(JSON.stringify(explanation)).not.toMatch(/rule pack/i);
    expect(explanation.reviewed).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Pacto parasocial", provenance: expect.stringContaining("contractual") }),
    ]));
  });

  it("ofrece nota de uso y materia relacionada para pares ambiguos", () => {
    const note = usageNotesForMateria("DIVIDENDO_A_CUENTA");
    expect(note?.avoidWhen).toContain("dividendo ordinario");
    expect(note?.related).toContainEqual({
      materia: "DISTRIBUCION_DIVIDENDOS",
      label: "Distribución de dividendos",
    });
  });
});
