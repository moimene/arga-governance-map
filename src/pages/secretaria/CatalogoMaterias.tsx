import { useMemo, useRef, useState, type ElementType, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Download,
  FileText,
  GitBranch,
  Landmark,
  LayoutGrid,
  Layers,
  ListChecks,
  PlayCircle,
  Scale,
  Search,
  ScrollText,
  Settings2,
  ShieldCheck,
  Table2,
  X,
} from "lucide-react";
import { useCurrentUserRole } from "@/hooks/useCurrentUser";
import { useMateriaCatalogoSocietario } from "@/hooks/useMesaControlSocietaria";
import { usePactosVigentes } from "@/hooks/usePactosParasociales";
import { usePlantillasProtegidas } from "@/hooks/usePlantillasProtegidas";
import { useRulePacks, useRuleParamOverrides } from "@/hooks/useRulePacks";
import { useSociedades } from "@/hooks/useSociedades";
import { ConfigurationLoadError } from "@/components/secretaria/ConfigurationLoadError";
import {
  MateriaCatalogHelp,
  type MateriaHelpSection,
} from "@/components/secretaria/MateriaCatalogHelp";
import { useSecretariaScope } from "@/components/secretaria/shell";
import {
  FUNCTIONAL_MATTER_GROUPS,
  TEMPLATE_DOCUMENT_STAGES,
  buildMateriaCatalogRows,
  buildNormativeAuditEvent,
  buildNormativeMatrixRows,
  buildNormativeTelemetryEvent,
  buildSourceChipsForMateria,
  buildTemplateDocumentBindings,
  canPerformNormativeAction,
  detectConflictOfLaws,
  detectTemplateDataDuplicates,
  displaySocietyLegalForm,
  documentRequirements,
  documentTypeLabel,
  evaluateMateriaGlobalStatus,
  evaluateTemplateReadiness,
  getMateriaFunctionalGroup,
  groupStageBindingsForDisplay,
  isInformativeMatter,
  majorityLabel,
  matterComplexityLabel,
  normativeRoleFromAppRole,
  overrideApplicaAMateria,
  pactoApplicaAMateria,
  plazoLabel,
  resolveSocietySocialTypeForRules,
  resolveMateriaAlias,
  templateBindingDisplayLabel,
  type MateriaGlobalStatusResult,
  type TemplateDocumentBinding,
  type TemplateDocumentStage,
} from "@/lib/secretaria/mesa-control-societaria";
import type { MateriaCatalogRow } from "@/hooks/useMateriaConfig";
import type { RuleParamOverrideRow } from "@/hooks/useRulePacks";
import type { PactoParasocial } from "@/lib/rules-engine/pactos-engine";
import {
  buildTemplateGovernanceUrl,
  buildTemplateLibraryUrl,
  buildUrlWithSearchParams,
  type TemplateRouteScope,
} from "@/lib/secretaria/template-configuration-routing";
import {
  FORMALIZATION_FILTER_OPTIONS,
  MAJORITY_FILTER_OPTIONS,
  buildMatterRuleVariants,
  buildRuleApplicabilityExplanation,
  catalogFormalizationKinds,
  filterMateriaCatalogItems,
  normalizeCatalogSearchText,
  resolveMateriaCodeAgainstCatalog,
  usageNotesForMateria,
  type MatterCatalogFilterCandidate,
  type MatterCatalogPresentation,
  type MatterFormalizationKind,
  type MatterRuleVariant,
  type MateriaUsageNote,
} from "@/lib/secretaria/materia-catalog-ux";
import {
  SEMANTIC_TONE_CLASS,
  SEMANTIC_TONE_DOT_CLASS,
} from "@/lib/secretaria/template-admin";
import {
  buildCsvFilename,
  downloadCsv,
  formatCsvDate,
  serializeCsv,
} from "@/lib/secretaria/csv-export";

const COMPLEXITY_CLASS: Record<string, string> = {
  Ordinaria: SEMANTIC_TONE_CLASS.success,
  Reforzada: SEMANTIC_TONE_CLASS.warning,
  Estructural: SEMANTIC_TONE_CLASS.error,
  Especial: SEMANTIC_TONE_CLASS.info,
  Informativa: SEMANTIC_TONE_CLASS.neutral,
};

const COMPLEXITY_LEGEND: Record<string, string> = {
  Ordinaria: "Mayoría ordinaria del órgano competente.",
  Reforzada: "Puede exigir mayoría o quórum reforzados según ley y estatutos.",
  Estructural: "Operación estructural: escritura pública, inscripción y, en su caso, publicación.",
  Especial: "Régimen específico: socios, pactos u operaciones vinculadas.",
  Informativa: "Seguimiento o información al órgano; se documenta por constancia en acta.",
};

const FORMALIZATION_CHIP_LEGEND: Record<string, string> = {
  "Escritura pública": "Requiere elevación a público ante notario.",
  Inscripción: "El acto se presenta al Registro Mercantil cuando procede.",
  Publicación: "Requiere publicación legal (BORME u otro medio) cuando proceda.",
  "Archivo interno": "Sin inscripción registral; exige conservación documental interna.",
  Constancia: "Debe quedar constancia en acta; sin expediente registral propio.",
};

const MATERIA_STATUS_INDICATOR: Record<
  MateriaGlobalStatusResult["status"],
  { shortLabel: string; dotClass: string }
> = {
  lista: { shortLabel: "Lista", dotClass: SEMANTIC_TONE_DOT_CLASS.success },
  advertencia: { shortLabel: "Advertencia", dotClass: SEMANTIC_TONE_DOT_CLASS.warning },
  revision_legal: { shortLabel: "Revisión legal", dotClass: SEMANTIC_TONE_DOT_CLASS.warning },
  bloqueada: { shortLabel: "Bloqueada", dotClass: SEMANTIC_TONE_DOT_CLASS.error },
};

function matterStatusIndicator(
  materia: string,
  result: MateriaGlobalStatusResult,
) {
  if (result.label === "No aplica a esta sociedad") {
    return { shortLabel: "No aplica", dotClass: SEMANTIC_TONE_DOT_CLASS.info };
  }
  if (isInformativeMatter(materia) && result.status === "lista") {
    return { shortLabel: "Solo constancia", dotClass: SEMANTIC_TONE_DOT_CLASS.info };
  }
  return MATERIA_STATUS_INDICATOR[result.status];
}

const CATALOG_HELP_SECTIONS: MateriaHelpSection[] = [
  {
    id: "naturaleza",
    title: "Naturaleza",
    items: [
      {
        id: "ordinaria",
        label: "Ordinaria",
        definition: COMPLEXITY_LEGEND.Ordinaria,
        consequence: "Sigue la mayoría ordinaria del órgano salvo una fuente especial aplicable.",
        action: "Comprueba órgano y mayoría antes de iniciar el expediente.",
      },
      {
        id: "reforzada",
        label: "Reforzada",
        definition: COMPLEXITY_LEGEND.Reforzada,
        consequence: "Puede elevar quórum o mayoría y hacer impugnable un acuerdo mal tramitado.",
        action: "Revisa la rama SA/SL y cualquier ajuste estatutario publicado.",
      },
      {
        id: "estructural",
        label: "Estructural",
        definition: COMPLEXITY_LEGEND.Estructural,
        consequence: "Añade formalización notarial, registral o publicidad según la operación.",
        action: "Verifica documentos previos y la secuencia post-acuerdo.",
      },
      {
        id: "especial",
        label: "Especial",
        definition: COMPLEXITY_LEGEND.Especial,
        consequence: "Puede exigir abstención, consentimiento o comprobaciones contractuales propias.",
        action: "Abre las fuentes revisadas y confirma pactos o conflictos de interés.",
      },
      {
        id: "informativa",
        label: "Informativa",
        definition: COMPLEXITY_LEGEND.Informativa,
        consequence: "No abre un expediente decisorio, pero debe quedar constancia documental.",
        action: "Incluye el asunto y su constancia en el acta del órgano correspondiente.",
      },
    ],
  },
  {
    id: "formalizacion",
    title: "Formalización",
    items: [
      {
        id: "escritura",
        label: "Escritura pública",
        definition: FORMALIZATION_CHIP_LEGEND["Escritura pública"],
        consequence: "La certificación y el título deben estar listos para la elevación notarial.",
        action: "Comprueba la plantilla de certificación y la documentación previa.",
      },
      {
        id: "registro",
        label: "Inscripción",
        definition: FORMALIZATION_CHIP_LEGEND.Inscripción,
        consequence: "El cierre exige presentación y seguimiento de la calificación registral.",
        action: "Revisa plazo, certificación y documento registral aplicables.",
      },
      {
        id: "publicacion",
        label: "Publicación",
        definition: FORMALIZATION_CHIP_LEGEND.Publicación,
        consequence: "La eficacia o publicidad del acuerdo puede depender del anuncio previsto.",
        action: "Confirma medio, contenido y momento de publicación.",
      },
      {
        id: "archivo",
        label: "Archivo interno",
        definition: FORMALIZATION_CHIP_LEGEND["Archivo interno"],
        consequence: "No hay trámite registral, pero sí deber de conservación y trazabilidad.",
        action: "Cierra el acta y archiva las evidencias del expediente.",
      },
      {
        id: "constancia",
        label: "Constancia",
        definition: FORMALIZATION_CHIP_LEGEND.Constancia,
        consequence: "No abre un expediente decisorio propio, pero el contenido tratado debe documentarse.",
        action: "Recoge el contenido tratado en el acta del órgano.",
      },
    ],
  },
  {
    id: "estado",
    title: "Estado",
    items: [
      {
        id: "lista",
        label: "Lista",
        definition: "La regla y las plantillas críticas permiten continuar.",
        consequence: "Puede iniciarse el expediente decisorio cuando la materia lo admite.",
        action: "Inicia el expediente o revisa la regla antes de continuar.",
      },
      {
        id: "advertencia",
        label: "Advertencia",
        definition: "Existe una condición relevante que no bloquea por sí sola.",
        consequence: "El acuerdo puede tramitarse, dejando constancia de la revisión.",
        action: "Lee la fuente contractual o la advertencia indicada.",
      },
      {
        id: "revision",
        label: "Revisión legal",
        definition: "Falta justificar una fuente o resolver un conflicto jurídico.",
        consequence: "No debe asumirse la regla como validada sin esa revisión.",
        action: "Revisa la fuente determinante y documenta el criterio.",
      },
      {
        id: "bloqueada",
        label: "Bloqueada",
        definition: "Falta una plantilla activa de una fase crítica de apertura.",
        consequence: "El sistema no habilita el expediente hasta corregir la cobertura.",
        action: "Activa o asigna la plantilla indicada en el checklist.",
      },
    ],
  },
];

type EngineWorkspaceTab = "resumen" | "regla" | "plantillas" | "fuentes" | "simular";

const ENGINE_WORKSPACE_TABS: Array<{
  id: EngineWorkspaceTab;
  label: string;
  description: string;
}> = [
  { id: "resumen", label: "Resumen", description: "Cadena completa de decisión" },
  { id: "regla", label: "Regla aplicable", description: "Órgano, mayoría y quórum" },
  { id: "plantillas", label: "Plantillas", description: "Comprobación documental previa" },
  { id: "fuentes", label: "Fuentes", description: "Ley, estatutos y pactos" },
  { id: "simular", label: "Verificación", description: "Requisitos antes de iniciar" },
];

function isEngineWorkspaceTab(value: string | null): value is EngineWorkspaceTab {
  return ENGINE_WORKSPACE_TABS.some((tab) => tab.id === value);
}

function tramitadorNuevoUrl(input: {
  materia: string;
  scope: TemplateRouteScope;
  entityId?: string | null;
}) {
  const params = new URLSearchParams({ materia: input.materia, scope: input.scope });
  if (input.scope === "sociedad" && input.entityId) params.set("entity", input.entityId);
  return buildUrlWithSearchParams("/secretaria/tramitador/nuevo", params);
}

export default function CatalogoMaterias() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [exportStatus, setExportStatus] = useState("");
  const detailRef = useRef<HTMLElement>(null);
  const scope = useSecretariaScope();
  const sociedadesQuery = useSociedades();
  const sociedades = sociedadesQuery.data ?? [];
  const selectedEntityId =
    scope.mode === "sociedad"
      ? searchParams.get("entity") ?? scope.selectedEntity?.id ?? sociedades[0]?.id ?? ""
      : "";
  const selectedSociedad = sociedades.find((sociedad) => sociedad.id === selectedEntityId) ?? null;
  const selectedSocietyTypeResolution = selectedSociedad
    ? resolveSocietySocialTypeForRules({
        jurisdiction: selectedSociedad.jurisdiction,
        tipoSocial: selectedSociedad.tipo_social,
        legalForm: selectedSociedad.legal_form,
      })
    : null;
  const selectedTipoSocialForRules = selectedSocietyTypeResolution?.value ?? null;
  const materiasQuery = useMateriaCatalogoSocietario();
  const rulePacksQuery = useRulePacks();
  const overridesQuery = useRuleParamOverrides(selectedEntityId || undefined);
  const ruleData = useMemo(
    () => ({
      packs: rulePacksQuery.data ?? [],
      overrides: overridesQuery.data ?? [],
    }),
    [overridesQuery.data, rulePacksQuery.data],
  );
  const pactosQuery = usePactosVigentes(selectedEntityId || undefined);
  const pactos = useMemo(() => pactosQuery.data ?? [], [pactosQuery.data]);
  const plantillasQuery = usePlantillasProtegidas();
  const plantillas = useMemo(() => plantillasQuery.data ?? [], [plantillasQuery.data]);
  const { primaryRole } = useCurrentUserRole();
  const normativeRole = normativeRoleFromAppRole(primaryRole);

  const materias = useMemo(
    () => buildMateriaCatalogRows(materiasQuery.data ?? []),
    [materiasQuery.data],
  );
  const [localSelected, setLocalSelected] = useState<string>("");
  const catalogMatterCodes = materias.map((materia) => materia.materia);
  const requestedMatterCode = resolveMateriaCodeAgainstCatalog(
    searchParams.get("materia"),
    catalogMatterCodes,
  );
  const missingDeepLinkTarget = Boolean(
    requestedMatterCode &&
      !materiasQuery.isLoading &&
      !materias.some((materia) => materia.materia === requestedMatterCode),
  );
  const selectedMatterCode =
    missingDeepLinkTarget
      ? ""
      : requestedMatterCode ||
        resolveMateriaCodeAgainstCatalog(localSelected, catalogMatterCodes) ||
        materias[0]?.materia ||
        "";
  const selectedMatter = missingDeepLinkTarget
    ? null
    : materias.find((materia) => materia.materia === selectedMatterCode) ?? materias[0] ?? null;
  const workspaceTabParam = searchParams.get("vista");
  const activeWorkspaceTab: EngineWorkspaceTab = isEngineWorkspaceTab(workspaceTabParam)
    ? workspaceTabParam
    : "resumen";
  const catalogPresentation: MatterCatalogPresentation =
    searchParams.get("presentacion") === "tabla" ? "tabla" : "tarjetas";
  const catalogSearch = searchParams.get("q") ?? "";
  const majorityParam = searchParams.get("mayoria");
  const majorityFilter = MAJORITY_FILTER_OPTIONS.some((option) => option.value === majorityParam)
    ? majorityParam!
    : "ALL";
  const formalizationParam = searchParams.get("formalizacion");
  const formalizationFilter: MatterFormalizationKind | "ALL" = FORMALIZATION_FILTER_OPTIONS.some(
    (option) => option.value === formalizationParam,
  )
    ? (formalizationParam as MatterFormalizationKind)
    : "ALL";
  const statusParam = searchParams.get("estado");
  const statusFilter: MateriaGlobalStatusResult["status"] | "ALL" = [
    "lista",
    "advertencia",
    "revision_legal",
    "bloqueada",
  ].includes(statusParam ?? "")
    ? (statusParam as MateriaGlobalStatusResult["status"])
    : "ALL";
  const matrixRows = useMemo(
    () => buildNormativeMatrixRows(materias, {
      tipoSocial: selectedTipoSocialForRules,
      overrides: ruleData?.overrides ?? [],
      pactos,
    }),
    [materias, pactos, ruleData?.overrides, selectedTipoSocialForRules],
  );
  const selectedMatrixRow = matrixRows.find((row) => row.materia === selectedMatter?.materia);
  const variantsByMateria = useMemo(() => {
    const map = new Map<string, MatterRuleVariant[]>();
    for (const materia of materias) {
      map.set(
        materia.materia,
        buildMatterRuleVariants({
          packs: ruleData.packs,
          materia,
          tipoSocial: selectedTipoSocialForRules,
          socialTypeIssue: selectedSocietyTypeResolution?.explanation,
        }),
      );
    }
    return map;
  }, [
    materias,
    ruleData.packs,
    selectedSocietyTypeResolution?.explanation,
    selectedTipoSocialForRules,
  ]);
  const templateConfigurationByMateria = useMemo(() => {
    const map = new Map<
      string,
      {
        bindings: TemplateDocumentBinding[];
        readiness: ReturnType<typeof evaluateTemplateReadiness>;
        notApplicableReason: string | null;
      }
    >();
    for (const materia of materias) {
      const variants = variantsByMateria.get(materia.materia) ?? [];
      const applicableVariants = variants.filter(
        (variant) => variant.socialTypeApplicability !== "not_applicable",
      );
      const notApplicableReason =
        selectedSociedad && variants.length > 0 && applicableVariants.length === 0
          ? Array.from(
              new Set(variants.map((variant) => variant.socialTypeApplicabilityReason)),
            ).join(" ")
          : null;
      const bindings = notApplicableReason
        ? []
        : buildTemplateDocumentBindings(plantillas, {
            materia: materia.materia,
            jurisdiction: selectedSociedad?.jurisdiction,
            tipoSocial: selectedTipoSocialForRules,
            organoTipo: Array.from(new Set(applicableVariants.map((variant) => variant.organoCode))),
            formaAdopcion: Array.from(
              new Set(
                applicableVariants.flatMap((variant) =>
                  variant.adoptionModes.map((mode) => mode.code),
                ),
              ),
            ),
          });
      const effectiveFormalization = applicableVariants.length > 0
        ? {
            requiresNotary: applicableVariants.some((variant) => variant.formalization.notaryRequired),
            requiresRegistry: applicableVariants.some((variant) => variant.formalization.registryRequired),
            inscribable: applicableVariants.some((variant) => variant.formalization.registryRequired),
          }
        : null;
      map.set(materia.materia, {
        bindings,
        readiness: evaluateTemplateReadiness(bindings, {
          materia,
          formalization: effectiveFormalization,
          notApplicableReason,
        }),
        notApplicableReason,
      });
    }
    return map;
  }, [materias, plantillas, selectedSociedad, selectedTipoSocialForRules, variantsByMateria]);
  const templateBindings = selectedMatter
    ? templateConfigurationByMateria.get(selectedMatter.materia)?.bindings ?? []
    : [];
  const selectedTemplateReadiness = selectedMatter
    ? templateConfigurationByMateria.get(selectedMatter.materia)?.readiness ?? null
    : null;
  const conflictOfLaws = selectedSociedad
    ? detectConflictOfLaws({
        jurisdiction: selectedSociedad.jurisdiction,
        tipoSocial: selectedSociedad.tipo_social,
        legalForm: selectedSociedad.legal_form,
        appliedReferences: [
          selectedMatter?.referencia_legal,
          ...(ruleData?.packs ?? []).map((pack) => pack.rule_pack_id ?? pack.materia ?? null),
        ],
      })
    : null;
  const statusByMateria = useMemo(() => {
    const map = new Map<string, MateriaGlobalStatusResult>();
    const packRefs = (ruleData?.packs ?? []).map((pack) => pack.rule_pack_id ?? pack.materia ?? null);
    for (const materia of materias) {
      const variants = variantsByMateria.get(materia.materia) ?? [];
      const informativa = isInformativeMatter(materia.materia);
      // El conflicto de ley se evalúa con la referencia de CADA materia; usar
      // el flag de la materia seleccionada contaminaría todo el catálogo.
      const materiaConflict = selectedSociedad
        ? detectConflictOfLaws({
            jurisdiction: selectedSociedad.jurisdiction,
            tipoSocial: selectedSociedad.tipo_social,
            legalForm: selectedSociedad.legal_form,
            appliedReferences: [materia.referencia_legal, ...packRefs],
          })
        : null;
      map.set(
        materia.materia,
        evaluateMateriaGlobalStatus({
          templateReadiness:
            templateConfigurationByMateria.get(materia.materia)?.readiness ??
            evaluateTemplateReadiness([], { materia }),
          conflictOfLaws: materiaConflict,
          legalReference: materia.referencia_legal,
          ruleVersionAvailable: variants.length > 0,
          ruleWarnings: variants.flatMap((variant) => variant.warnings),
          notApplicableReason:
            templateConfigurationByMateria.get(materia.materia)?.notApplicableReason ?? null,
          applicablePactosCount: pactos.filter((pacto) => pactoApplicaAMateria(pacto, materia.materia)).length,
          informativa,
        }),
      );
    }
    return map;
  }, [materias, pactos, ruleData.packs, selectedSociedad, templateConfigurationByMateria, variantsByMateria]);
  const selectedMatterStatus = selectedMatter ? statusByMateria.get(selectedMatter.materia) ?? null : null;
  const selectedRuleVariants = selectedMatter
    ? variantsByMateria.get(selectedMatter.materia) ?? []
    : [];
  const catalogItems = useMemo(
    () =>
      materias.map((materia): MatterCatalogFilterCandidate => {
        const variants = variantsByMateria.get(materia.materia) ?? [];
        const configuration = templateConfigurationByMateria.get(materia.materia);
        const documents = Array.from(
          new Map(
            variants
              .flatMap((variant) => variant.documents)
              .map((document) => [normalizeCatalogSearchText(document.name), document]),
          ).values(),
        );
        const formalizationKinds = selectedSociedad
          ? Array.from(new Set(variants.flatMap((variant) => variant.formalization.kinds)))
          : [];
        return {
          materia,
          status: statusByMateria.get(materia.materia)?.status ?? "revision_legal",
          documents,
          templateTypes: Array.from(
            new Set((configuration?.bindings ?? []).map((binding) => binding.template.tipo)),
          ),
          variants,
          formalizationKinds: formalizationKinds.length > 0 ? formalizationKinds : undefined,
        };
      }),
    [materias, selectedSociedad, statusByMateria, templateConfigurationByMateria, variantsByMateria],
  );
  const filteredCatalogItems = useMemo(
    () =>
      filterMateriaCatalogItems(catalogItems, {
        search: catalogSearch,
        majority: majorityFilter,
        formalization: formalizationFilter,
        status: statusFilter,
      }),
    [catalogItems, catalogSearch, formalizationFilter, majorityFilter, statusFilter],
  );
  const selectedOutsideCatalogFilters = Boolean(
    selectedMatter &&
      !filteredCatalogItems.some((item) => item.materia.materia === selectedMatter.materia),
  );

  const hasLoadingError = [
    sociedadesQuery,
    materiasQuery,
    rulePacksQuery,
    overridesQuery,
    pactosQuery,
    plantillasQuery,
  ].some((query) => query.isError);
  const catalogExportLoading = [
    sociedadesQuery,
    materiasQuery,
    rulePacksQuery,
    overridesQuery,
    pactosQuery,
    plantillasQuery,
  ].some((query) => query.isLoading);
  const retryingLoad = [
    sociedadesQuery,
    materiasQuery,
    rulePacksQuery,
    overridesQuery,
    pactosQuery,
    plantillasQuery,
  ].some((query) => query.isFetching);

  if (hasLoadingError) {
    return (
      <div className="mx-auto max-w-[1440px] space-y-5 p-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
            <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
            Secretaría · Catálogo de materias societarias
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
            Materias y reglas
          </h1>
        </div>
        <ConfigurationLoadError
          title="No se ha podido cargar la configuración de materias y reglas."
          onRetry={() => {
            void Promise.all([
              sociedadesQuery.refetch(),
              materiasQuery.refetch(),
              rulePacksQuery.refetch(),
              selectedEntityId ? overridesQuery.refetch() : Promise.resolve(),
              pactosQuery.refetch(),
              plantillasQuery.refetch(),
            ]);
          }}
          retrying={retryingLoad}
        />
      </div>
    );
  }

  function handleSociedadChange(next: string) {
    setExportStatus("");
    const params = new URLSearchParams(searchParams);
    if (next) {
      params.set("scope", "sociedad");
      params.set("entity", next);
    } else {
      params.set("scope", "grupo");
      params.delete("entity");
    }
    setSearchParams(params, { replace: true });
  }

  function handleMateriaSelect(materia: string) {
    setLocalSelected(materia);
    const params = new URLSearchParams(searchParams);
    params.set("materia", materia);
    if (!isEngineWorkspaceTab(params.get("vista"))) params.set("vista", "resumen");
    if (selectedEntityId) params.set("entity", selectedEntityId);
    setSearchParams(params, { replace: true });
    if (window.innerWidth < 1280 || catalogPresentation === "tabla") {
      window.requestAnimationFrame(() => {
        detailRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
        detailRef.current?.focus({ preventScroll: true });
      });
    }
  }

  function handleWorkspaceTabChange(tab: EngineWorkspaceTab) {
    const params = new URLSearchParams(searchParams);
    params.set("vista", tab);
    if (selectedMatter?.materia) params.set("materia", selectedMatter.materia);
    if (selectedEntityId) params.set("entity", selectedEntityId);
    setSearchParams(params, { replace: true });
  }

  function handleCatalogParamChange(
    key: "q" | "mayoria" | "formalizacion" | "estado" | "presentacion",
    value: string,
  ) {
    setExportStatus("");
    const params = new URLSearchParams(searchParams);
    const defaultValue = key === "presentacion" ? "tarjetas" : key === "q" ? "" : "ALL";
    if (!value || value === defaultValue) params.delete(key);
    else params.set(key, value);
    setSearchParams(params, { replace: true });
  }

  function clearCatalogFilters() {
    setExportStatus("");
    const params = new URLSearchParams(searchParams);
    ["q", "mayoria", "formalizacion", "estado"].forEach((key) => params.delete(key));
    setSearchParams(params, { replace: true });
  }

  function exportVisibleCatalog() {
    const generatedOn = formatCsvDate();
    const societyName = selectedSociedad
      ? selectedSociedad.common_name ?? selectedSociedad.legal_name
      : "";
    const columns = [
      "Código de materia",
      "Materia",
      "Grupo funcional",
      "Ámbito",
      "Sociedad",
      "ID de sociedad",
      "Órgano",
      "Mayoría",
      "Formalización",
      "Base de formalización",
      "Documentos",
      "Estado",
      "Referencia legal",
      "Generado el",
    ];
    const rows = filteredCatalogItems.map((item) => {
      const variants = item.variants ?? [];
      const kinds = item.formalizationKinds ?? catalogFormalizationKinds(item.materia);
      const documents = item.documents ?? [];
      const status = statusByMateria.get(item.materia.materia);
      const indicator = status ? matterStatusIndicator(item.materia.materia, status) : null;
      const hasDiscrepancy = variants.some((variant) => variant.formalization.discrepancy);
      const formalizationSource = selectedSociedad && variants.length > 0
        ? "Regla versionada activa"
        : "Mínimo de catálogo";

      return [
        item.materia.materia,
        item.materia.materia_label_es,
        getMateriaFunctionalGroup(item.materia.materia).title,
        selectedSociedad ? "Sociedad" : "Grupo",
        societyName,
        selectedSociedad?.id ?? "",
        variants.length > 0
          ? Array.from(new Set(variants.map((variant) => variant.organoLabel))).join(" / ")
          : "Regla versionada pendiente",
        selectedSociedad
          ? majoritySummary(variants, item.materia)
          : majorityLabel(item.materia.min_majority_code),
        kinds.map((kind) => FORMALIZATION_KIND_LABEL[kind]).join(", "),
        `${formalizationSource}${hasDiscrepancy ? " · Difiere del mínimo de catálogo" : ""}`,
        documents.length > 0
          ? documents.map((document) => document.name).join(" · ")
          : documentRequirements(item.materia).join(" · "),
        indicator?.shortLabel ?? "Pendiente",
        item.materia.referencia_legal ?? "",
        generatedOn,
      ];
    });

    try {
      const filename = buildCsvFilename(
        ["secretaria", "matriz", "materias", selectedSociedad ? societyName : "grupo"],
        generatedOn,
      );
      downloadCsv(serializeCsv(columns, rows), filename);
      setExportStatus("");
      window.setTimeout(() => {
        setExportStatus(
          `${rows.length} ${rows.length === 1 ? "materia exportada" : "materias exportadas"} en ${filename}.`,
        );
      }, 0);
    } catch {
      setExportStatus("");
      window.setTimeout(() => {
        setExportStatus("No se ha podido descargar la matriz de materias. Inténtalo de nuevo.");
      }, 0);
    }
  }

  function relatedMatterUrl(materia: string) {
    const params = new URLSearchParams(searchParams);
    params.set("materia", resolveMateriaCodeAgainstCatalog(materia, catalogMatterCodes));
    params.set("vista", activeWorkspaceTab);
    params.set("scope", scope.mode);
    if (scope.mode === "sociedad" && selectedEntityId) params.set("entity", selectedEntityId);
    else params.delete("entity");
    return buildUrlWithSearchParams("/secretaria/catalogo-materias", params);
  }

  function clearMissingMateriaTarget() {
    const params = new URLSearchParams(searchParams);
    params.delete("materia");
    setLocalSelected("");
    setSearchParams(params, { replace: true });
  }

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
            <BookOpen className="h-3.5 w-3.5" />
            Secretaría · Catálogo de materias societarias
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
            Materias y reglas
          </h1>
          <p className="mt-1 max-w-4xl text-sm leading-6 text-[var(--g-text-secondary)]">
            Consulta qué puede tratar o acordar una sociedad, qué exige la ley, qué añaden sus
            estatutos, qué pactos aplican y qué documentos se generarán en cada fase.
          </p>
          {selectedSociedad ? (
            <p className="mt-2 text-xs text-[var(--g-text-secondary)]">
              {selectedSociedad.common_name ?? selectedSociedad.legal_name} · Jurisdicción{" "}
              {selectedSociedad.jurisdiction ?? "no informada"} · Forma{" "}
              {selectedSocietyTypeResolution?.conflict
                ? `datos incoherentes (${selectedSociedad.tipo_social ?? "sin tipo social"} / ${selectedSociedad.legal_form ?? "sin forma jurídica"})`
                : displaySocietyLegalForm({
                    jurisdiction: selectedSociedad.jurisdiction,
                    tipoSocial: selectedSociedad.tipo_social,
                    legalForm: selectedSociedad.legal_form,
                  })}
            </p>
          ) : null}
        </div>

        <label className="w-full text-xs font-semibold uppercase tracking-wider text-[var(--g-text-primary)] sm:w-auto sm:min-w-[280px]">
          Sociedad
          <select
            aria-label="Sociedad"
            value={selectedEntityId}
            onChange={(event) => handleSociedadChange(event.target.value)}
            className="mt-1 min-h-11 w-full border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-3 py-2 text-sm font-normal normal-case tracking-normal text-[var(--g-text-primary)] focus:border-[var(--g-brand-3308)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <option value="">Reglas legales por defecto</option>
            {sociedades.map((sociedad) => (
              <option key={sociedad.id} value={sociedad.id}>
                {sociedad.common_name ?? sociedad.legal_name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {missingDeepLinkTarget ? (
        <div
          role="alert"
          className="mb-6 flex flex-col gap-3 border border-[var(--status-warning)] bg-[var(--g-surface-card)] p-4 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-warning)]"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-medium text-[var(--g-text-primary)]">
                No se ha encontrado la materia solicitada en este ámbito.
              </p>
              <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
                La URL se conserva para que puedas revisar el código solicitado o volver al catálogo disponible.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={clearMissingMateriaTarget}
            className="min-h-11 shrink-0 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm font-medium text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Mostrar materias disponibles
          </button>
        </div>
      ) : null}

      {conflictOfLaws?.conflict_of_laws_flag ? (
        <div
          className="mb-6 border border-[var(--status-error)] bg-[var(--g-surface-card)] p-4"
          role="alert"
          style={{ borderRadius: "var(--g-radius-lg)" }}
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--g-text-primary)]">
            <AlertTriangle className="h-4 w-4 text-[var(--status-error)]" aria-hidden="true" />
            {conflictOfLaws.conflict_kind === "social_form"
              ? "Configuración societaria incoherente"
              : "Posible conflicto de ley aplicable"}
          </div>
          <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
            {conflictOfLaws.explanation}
            {conflictOfLaws.conflict_kind === "social_form"
              ? null
              : ` Ley esperada: ${conflictOfLaws.expectedLawLabel}. Ley aplicada: ${conflictOfLaws.appliedLawLabel}.`}
          </p>
        </div>
      ) : null}

      <MateriaCatalogControls
        search={catalogSearch}
        majority={majorityFilter}
        formalization={formalizationFilter}
        status={statusFilter}
        presentation={catalogPresentation}
        visibleCount={filteredCatalogItems.length}
        totalCount={catalogItems.length}
        onChange={handleCatalogParamChange}
        onClear={clearCatalogFilters}
        onExport={exportVisibleCatalog}
        exportDisabled={catalogExportLoading || filteredCatalogItems.length === 0}
        exportLoading={catalogExportLoading}
        exportStatus={exportStatus}
        exportFailed={exportStatus.startsWith("No se ha podido")}
      />

      <EngineConfigSummary
        selectedMatter={selectedMatter}
        selectedMatrixRow={selectedMatrixRow}
        ruleVariants={selectedRuleVariants}
        templateReadiness={selectedTemplateReadiness}
        selectedStatus={selectedMatterStatus}
        onTabChange={handleWorkspaceTabChange}
      />

      <div className="mb-6">
        <MateriaCatalogHelp title="Cómo interpretar el catálogo" sections={CATALOG_HELP_SECTIONS} />
      </div>

      {selectedOutsideCatalogFilters ? (
        <div
          className="mb-6 flex flex-col gap-3 border border-[var(--status-info)] bg-[var(--g-surface-card)] p-3 sm:flex-row sm:items-center sm:justify-between"
          role="status"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <p className="text-sm text-[var(--g-text-secondary)]">
            La ficha abierta no coincide con los filtros; se conserva para no perder el deep-link.
          </p>
          <button
            type="button"
            onClick={clearCatalogFilters}
            className="min-h-11 shrink-0 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm font-semibold text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] focus:ring-offset-2"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Mostrar materia seleccionada
          </button>
        </div>
      ) : null}

      <div
        className={
          catalogPresentation === "tabla"
            ? "flex min-w-0 max-w-full flex-col gap-6"
            : "grid min-w-0 max-w-full grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_480px]"
        }
      >
        <section className="min-w-0 max-w-full space-y-5">
          {filteredCatalogItems.length === 0 ? (
            <CatalogEmptyState onClear={clearCatalogFilters} />
          ) : catalogPresentation === "tabla" ? (
            <MateriaComparisonTable
              items={filteredCatalogItems}
              statusByMateria={statusByMateria}
              selectedMatterCode={selectedMatter?.materia ?? null}
              onSelect={handleMateriaSelect}
              societyScoped={Boolean(selectedSociedad)}
            />
          ) : (
            <MateriaCardGroups
              items={filteredCatalogItems}
              statusByMateria={statusByMateria}
              selectedMatterCode={selectedMatter?.materia ?? null}
              onSelect={handleMateriaSelect}
            />
          )}
        </section>

        <aside
          ref={detailRef}
          tabIndex={-1}
          aria-label="Detalle de la materia seleccionada"
          className={
            catalogPresentation === "tabla"
              ? "min-w-0 max-w-full scroll-mt-4 focus:outline-none"
              : "min-w-0 max-w-full scroll-mt-4 focus:outline-none xl:sticky xl:top-4 xl:self-start"
          }
        >
          {selectedMatter ? (
            <MateriaDetail
              materia={selectedMatter}
              selectedSociedadName={selectedSociedad?.common_name ?? selectedSociedad?.legal_name ?? null}
              matrixRow={selectedMatrixRow}
              ruleVariants={selectedRuleVariants}
              templateBindings={templateBindings}
              templateReadiness={selectedTemplateReadiness ?? evaluateTemplateReadiness([], { materia: selectedMatter })}
              overrides={ruleData?.overrides ?? []}
              pactos={pactos}
              entityId={selectedEntityId}
              conflictOfLaws={conflictOfLaws}
              globalStatus={selectedMatterStatus}
              normativeRole={normativeRole}
              routeScope={scope.mode}
              activeTab={activeWorkspaceTab}
              onTabChange={handleWorkspaceTabChange}
              relatedMatterUrl={relatedMatterUrl}
            />
          ) : (
            <div className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-6 text-sm text-[var(--g-text-secondary)]" style={{ borderRadius: "var(--g-radius-lg)" }}>
              {missingDeepLinkTarget
                ? "La materia solicitada no está disponible. Elige otra materia o limpia la selección."
                : materiasQuery.isLoading
                  ? "Cargando catálogo de materias…"
                  : "No hay materias disponibles para este ámbito."}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

const FORMALIZATION_KIND_LABEL: Record<MatterFormalizationKind, string> = {
  ESCRITURA: "Escritura pública",
  REGISTRO: "Inscripción",
  PUBLICACION: "Publicación",
  ARCHIVO_INTERNO: "Archivo interno",
  CONSTANCIA: "Constancia",
};

function MateriaCatalogControls({
  search,
  majority,
  formalization,
  status,
  presentation,
  visibleCount,
  totalCount,
  onChange,
  onClear,
  onExport,
  exportDisabled,
  exportLoading,
  exportStatus,
  exportFailed,
}: {
  search: string;
  majority: string;
  formalization: MatterFormalizationKind | "ALL";
  status: MateriaGlobalStatusResult["status"] | "ALL";
  presentation: MatterCatalogPresentation;
  visibleCount: number;
  totalCount: number;
  onChange: (
    key: "q" | "mayoria" | "formalizacion" | "estado" | "presentacion",
    value: string,
  ) => void;
  onClear: () => void;
  onExport: () => void;
  exportDisabled: boolean;
  exportLoading: boolean;
  exportStatus: string;
  exportFailed: boolean;
}) {
  const hasFilters = Boolean(
    search || majority !== "ALL" || formalization !== "ALL" || status !== "ALL",
  );
  const fieldClass =
    "min-h-11 w-full border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:border-[var(--g-brand-3308)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] focus:ring-offset-2";
  return (
    <section
      className="mb-6 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
      aria-label="Buscar y filtrar materias"
      data-testid="materias-catalog-controls"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(240px,1.6fr)_repeat(3,minmax(150px,1fr))]">
        <label className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-primary)]">
          Buscar por materia, artículo o documento
          <span className="relative mt-1 block">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--g-text-secondary)]"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => onChange("q", event.target.value)}
              placeholder="Ej.: art. 308, auditoría, estado contable"
              className={`${fieldClass} pl-9`}
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
          </span>
        </label>
        <label className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-primary)]">
          Mayoría mínima (catálogo)
          <select
            value={majority}
            onChange={(event) => onChange("mayoria", event.target.value)}
            className={`mt-1 ${fieldClass}`}
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            {MAJORITY_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-primary)]">
          Formalización
          <select
            value={formalization}
            onChange={(event) => onChange("formalizacion", event.target.value)}
            className={`mt-1 ${fieldClass}`}
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            {FORMALIZATION_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-primary)]">
          Estado
          <select
            value={status}
            onChange={(event) => onChange("estado", event.target.value)}
            className={`mt-1 ${fieldClass}`}
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <option value="ALL">Todos los estados</option>
            <option value="lista">Lista</option>
            <option value="advertencia">Advertencia</option>
            <option value="revision_legal">Revisión legal</option>
            <option value="bloqueada">Bloqueada</option>
          </select>
        </label>
      </div>
      <div className="mt-4 flex flex-col gap-3 border-t border-[var(--g-border-subtle)] pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-[var(--g-text-primary)]" aria-live="polite">
            {visibleCount} de {totalCount} materias
          </span>
          {hasFilters ? (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex min-h-11 items-center gap-1.5 px-1 text-sm font-semibold text-[var(--g-link)] hover:text-[var(--g-link-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] focus:ring-offset-2"
              style={{ borderRadius: "var(--g-radius-sm)" }}
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Limpiar filtros
            </button>
          ) : null}
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onExport}
            disabled={exportDisabled}
            aria-busy={exportLoading}
            aria-describedby="materias-export-scope"
            className="inline-flex min-h-11 items-center justify-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm font-semibold text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Exportar matriz CSV
          </button>
          <div
            className="inline-flex w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-1 sm:w-auto"
            role="group"
            aria-label="Presentación del catálogo"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            {([
              { value: "tarjetas" as const, label: "Tarjetas", icon: LayoutGrid },
              { value: "tabla" as const, label: "Tabla comparativa", icon: Table2 },
            ]).map((option) => {
              const Icon = option.icon;
              const selected = presentation === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onChange("presentacion", option.value)}
                  className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] focus:ring-offset-2 sm:flex-none ${
                    selected
                      ? "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]"
                      : "text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
                  }`}
                  style={{ borderRadius: "var(--g-radius-sm)" }}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <p id="materias-export-scope" className="mt-3 text-xs text-[var(--g-text-secondary)]">
        El CSV refleja únicamente las materias visibles y el ámbito seleccionado.
      </p>
      <p
        className="mt-1 text-xs text-[var(--g-text-secondary)]"
        role={exportFailed ? "alert" : "status"}
        aria-live="polite"
        aria-atomic="true"
      >
        {exportStatus}
      </p>
    </section>
  );
}

function CatalogEmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-8 text-center"
      role="status"
      style={{ borderRadius: "var(--g-radius-lg)" }}
    >
      <h2 className="text-base font-semibold text-[var(--g-text-primary)]">
        No hay materias que coincidan con los filtros
      </h2>
      <p className="mt-2 text-sm text-[var(--g-text-secondary)]">
        Prueba otra búsqueda o restablece mayoría, formalización y estado.
      </p>
      <button
        type="button"
        onClick={onClear}
        className="mt-4 inline-flex min-h-11 items-center justify-center border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm font-semibold text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] focus:ring-offset-2"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        Limpiar filtros
      </button>
    </div>
  );
}

function MateriaCardGroups({
  items,
  statusByMateria,
  selectedMatterCode,
  onSelect,
}: {
  items: MatterCatalogFilterCandidate[];
  statusByMateria: Map<string, MateriaGlobalStatusResult>;
  selectedMatterCode: string | null;
  onSelect: (materia: string) => void;
}) {
  return (
    <div className="space-y-5" data-testid="materias-card-view">
      {FUNCTIONAL_MATTER_GROUPS.map((group) => {
        const rows = items.filter(
          (item) => getMateriaFunctionalGroup(item.materia.materia).id === group.id,
        );
        if (rows.length === 0) return null;
        return (
          <div key={group.id} className="space-y-3">
            <div>
              <h2 className="text-base font-semibold text-[var(--g-text-primary)]">
                {group.title}{" "}
                <span className="font-normal text-[var(--g-text-secondary)]">({rows.length})</span>
              </h2>
              <p className="mt-1 text-sm text-[var(--g-text-secondary)]">{group.description}</p>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {rows.map((item) => {
                const materia = item.materia;
                const selected = materia.materia === selectedMatterCode;
                const complexity = matterComplexityLabel(materia);
                const status = statusByMateria.get(materia.materia);
                const indicator = status ? matterStatusIndicator(materia.materia, status) : null;
                const kinds = item.formalizationKinds ?? catalogFormalizationKinds(materia);
                const hasDiscrepancy = (item.variants ?? []).some(
                  (variant) => variant.formalization.discrepancy,
                );
                return (
                  <button
                    key={materia.materia}
                    type="button"
                    onClick={() => onSelect(materia.materia)}
                    aria-pressed={selected}
                    className={`border bg-[var(--g-surface-card)] p-4 text-left transition-colors hover:bg-[var(--g-surface-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] focus:ring-offset-2 ${
                      selected ? "border-[var(--g-brand-3308)]" : "border-[var(--g-border-subtle)]"
                    }`}
                    style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-[var(--g-text-primary)]">
                          {materia.materia_label_es}
                        </h3>
                        <p className="mt-1 text-xs leading-5 text-[var(--g-text-secondary)]">
                          {materia.referencia_legal ?? "Referencia legal pendiente de completar"}
                        </p>
                        {(item.variants ?? []).length > 0 ? (
                          <p className="mt-1 text-xs leading-5 text-[var(--g-text-secondary)]">
                            Órgano: {(item.variants ?? []).map((variant) => variant.organoLabel).join(" / ")}
                          </p>
                        ) : null}
                      </div>
                      <span
                        className={`shrink-0 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${COMPLEXITY_CLASS[complexity]}`}
                        style={{ borderRadius: "var(--g-radius-full)" }}
                      >
                        {complexity}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-[var(--g-text-secondary)]">
                      {kinds.map((kind) => <Chip key={kind} label={FORMALIZATION_KIND_LABEL[kind]} />)}
                      {hasDiscrepancy ? (
                        <span className="font-semibold text-[var(--g-text-primary)]">
                          Difiere del mínimo de catálogo
                        </span>
                      ) : null}
                      {indicator && status ? (
                        <span className="ml-auto inline-flex items-center gap-1.5 font-semibold text-[var(--g-text-primary)]">
                          <span
                            aria-hidden="true"
                            className={`h-2 w-2 shrink-0 ${indicator.dotClass}`}
                            style={{ borderRadius: "var(--g-radius-full)" }}
                          />
                          {indicator.shortLabel}
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MateriaComparisonTable({
  items,
  statusByMateria,
  selectedMatterCode,
  onSelect,
  societyScoped,
}: {
  items: MatterCatalogFilterCandidate[];
  statusByMateria: Map<string, MateriaGlobalStatusResult>;
  selectedMatterCode: string | null;
  onSelect: (materia: string) => void;
  societyScoped: boolean;
}) {
  return (
    <div
      className="relative overflow-x-auto border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] focus:ring-offset-2"
      data-testid="materias-comparison-table"
      role="region"
      aria-label="Comparación de materias y reglas"
      tabIndex={0}
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <table className="min-w-[1040px] w-full border-collapse text-left">
        <caption className="sr-only">
          Comparación de órgano competente, mayoría, formalización, documentos y estado por materia.
        </caption>
        <thead>
          <tr className="bg-[var(--g-surface-subtle)]">
            {["Materia", "Órgano", "Mayoría", "Formalización", "Documentos", "Estado", "Acción"].map((header) => (
              <th
                key={header}
                scope="col"
                className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--g-text-primary)]"
              >
                <span className={header === "Acción" ? "sr-only" : undefined}>{header}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--g-border-subtle)]">
          {items.map((item) => {
            const status = statusByMateria.get(item.materia.materia);
            const indicator = status
              ? matterStatusIndicator(item.materia.materia, status)
              : null;
            const variants = item.variants ?? [];
            const kinds = item.formalizationKinds ?? catalogFormalizationKinds(item.materia);
            const documents = item.documents ?? [];
            const selected = item.materia.materia === selectedMatterCode;
            const hasDiscrepancy = variants.some((variant) => variant.formalization.discrepancy);
            return (
              <tr
                key={item.materia.materia}
                className={selected ? "bg-[var(--g-surface-subtle)]" : "bg-[var(--g-surface-card)] hover:bg-[var(--g-surface-subtle)]/50"}
              >
                <th scope="row" className="px-4 py-3">
                  <div className="text-sm font-semibold text-[var(--g-text-primary)]">{item.materia.materia_label_es}</div>
                  <div className="mt-1 text-xs text-[var(--g-text-secondary)]">{item.materia.referencia_legal}</div>
                </th>
                <td className="px-4 py-3 text-sm text-[var(--g-text-secondary)]">
                  {variants.length > 0 ? variants.map((variant) => variant.organoLabel).join(" / ") : "Regla versionada pendiente"}
                </td>
                <td className="max-w-[220px] px-4 py-3 text-sm text-[var(--g-text-secondary)]">
                  {societyScoped ? majoritySummary(variants, item.materia) : majorityLabel(item.materia.min_majority_code)}
                </td>
                <td className="px-4 py-3 text-sm text-[var(--g-text-secondary)]">
                  <div>{kinds.map((kind) => FORMALIZATION_KIND_LABEL[kind]).join(", ")}</div>
                  <div className="mt-1 text-xs">
                    {societyScoped && variants.length > 0 ? "Regla versionada activa" : "Mínimo de catálogo"}
                    {hasDiscrepancy ? " · difiere del catálogo" : ""}
                  </div>
                </td>
                <td className="max-w-[260px] px-4 py-3 text-sm text-[var(--g-text-secondary)]">
                  {documents.length > 0
                    ? `${documents.slice(0, 2).map((document) => document.name).join(" · ")}${documents.length > 2 ? ` · +${documents.length - 2}` : ""}`
                    : documentRequirements(item.materia).join(", ")}
                </td>
                <td className="px-4 py-3 text-sm font-semibold text-[var(--g-text-primary)]">
                  {indicator ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className={`h-2 w-2 ${indicator.dotClass}`}
                        aria-hidden="true"
                        style={{ borderRadius: "var(--g-radius-full)" }}
                      />
                      {indicator.shortLabel}
                    </span>
                  ) : "Pendiente"}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => onSelect(item.materia.materia)}
                    aria-label={`Ver detalle de ${item.materia.materia_label_es}`}
                    className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-xs font-semibold text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] focus:ring-offset-2"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    Ver detalle
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function majoritySummary(variants: MatterRuleVariant[], materia: MateriaCatalogRow) {
  if (
    variants.length > 0 &&
    variants.every((variant) => variant.socialTypeApplicability === "not_applicable")
  ) {
    return "No aplica a esta sociedad";
  }
  const rows = variants
    .filter((variant) => variant.socialTypeApplicability !== "not_applicable")
    .flatMap((variant) =>
    variant.branches.map((branch) => ({ organo: variant.organoLabel, majority: branch.majority })),
    );
  if (rows.length === 0) return majorityLabel(materia.min_majority_code);
  const values = Array.from(new Set(rows.map((row) => row.majority)));
  if (values.length === 1) return values[0];
  return rows.map((row) => `${row.organo}: ${row.majority}`).join(" · ");
}

function MateriaDetail({
  materia,
  selectedSociedadName,
  matrixRow,
  ruleVariants,
  templateBindings,
  templateReadiness,
  overrides,
  pactos,
  entityId,
  conflictOfLaws,
  globalStatus,
  normativeRole,
  routeScope,
  activeTab,
  onTabChange,
  relatedMatterUrl,
}: {
  materia: MateriaCatalogRow;
  selectedSociedadName: string | null;
  matrixRow: ReturnType<typeof buildNormativeMatrixRows>[number] | undefined;
  ruleVariants: MatterRuleVariant[];
  templateBindings: ReturnType<typeof buildTemplateDocumentBindings>;
  templateReadiness: ReturnType<typeof evaluateTemplateReadiness>;
  overrides: RuleParamOverrideRow[];
  pactos: PactoParasocial[];
  entityId: string;
  conflictOfLaws: ReturnType<typeof detectConflictOfLaws> | null;
  globalStatus: MateriaGlobalStatusResult | null;
  normativeRole: ReturnType<typeof normativeRoleFromAppRole>;
  routeScope: TemplateRouteScope;
  activeTab: EngineWorkspaceTab;
  onTabChange: (tab: EngineWorkspaceTab) => void;
  relatedMatterUrl: (materia: string) => string;
}) {
  const group = getMateriaFunctionalGroup(materia.materia);
  const applicableOverrides = overrides.filter((override) => overrideApplicaAMateria(override, materia.materia));
  const entityHasEstatutosOverrides = overrides.some((override) => override.fuente === "ESTATUTOS");
  const applicablePactos = pactos.filter((pacto) => pactoApplicaAMateria(pacto, materia.materia));
  const sourceChips = buildSourceChipsForMateria({
    materia: materia.materia,
    legalReference: materia.referencia_legal,
    overrides,
    pactos,
  });
  const assignTemplateDecision = canPerformNormativeAction(normativeRole, "assign_template");
  const blockedEvent = templateReadiness.openingStatus === "blocked"
    ? buildNormativeAuditEvent({
        action: "expediente_blocked",
        societyId: entityId || "sociedad-no-seleccionada",
        matter: materia.materia,
        userRole: normativeRole,
        before: { templates: "incompletas" },
        after: { blockingMessage: templateReadiness.blockingMessage },
      })
    : null;
  const blockedTelemetry = blockedEvent ? buildNormativeTelemetryEvent(blockedEvent) : null;
  const usageNote = usageNotesForMateria(materia.materia);

  return (
    <div className="space-y-4">
      <div
        className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-5"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--g-brand-3308)]">
              {group.title}
            </div>
            <h2 className="mt-1 text-lg font-semibold text-[var(--g-text-primary)]">
              {materia.materia_label_es}
            </h2>
            <p className="mt-1 text-sm leading-6 text-[var(--g-text-secondary)]">
              {selectedSociedadName ? `Regla aplicable para ${selectedSociedadName}.` : "Reglas legales por defecto; selecciona sociedad para ver estatutos y pactos."}
            </p>
            {resolveMateriaAlias(materia.materia) === "SUPRESION_PREFERENTE" ? (
              <p className="mt-2 text-xs leading-5 text-[var(--g-text-secondary)]">
                También denominada exclusión del derecho de suscripción preferente (art. 308 LSC).
              </p>
            ) : null}
          </div>
          <Scale className="h-5 w-5 text-[var(--g-brand-3308)]" />
        </div>
        {globalStatus ? (
          <div className="mt-3 border-t border-[var(--g-border-subtle)] pt-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-[var(--g-text-primary)]">{globalStatus.label}</span>
              <StatusPill
                label={matterStatusIndicator(materia.materia, globalStatus).shortLabel}
                tone={
                  globalStatus.status === "bloqueada"
                    ? "block"
                    : globalStatus.status === "lista"
                      ? "ok"
                      : "warn"
                }
              />
            </div>
            <p className="mt-1 text-xs leading-5 text-[var(--g-text-secondary)]">{globalStatus.explanation}</p>
            <div className="mt-3">
              <MateriaPrimaryCta
                status={globalStatus}
                materia={materia}
                entityId={entityId}
                routeScope={routeScope}
                onTabChange={onTabChange}
              />
            </div>
          </div>
        ) : null}
      </div>

      {usageNote ? (
        <MateriaUsageNotePanel note={usageNote} relatedMatterUrl={relatedMatterUrl} />
      ) : null}

      <EngineWorkspaceTabs activeTab={activeTab} onTabChange={onTabChange} />

      {activeTab === "resumen" ? (
        <WorkspaceTabPanel tab="resumen">
        <MateriaSummaryTab
          materia={materia}
          matrixRow={matrixRow}
          ruleVariants={ruleVariants}
          templateReadiness={templateReadiness}
          selectedSociedadName={selectedSociedadName}
          applicableOverrides={applicableOverrides}
          entityHasEstatutosOverrides={entityHasEstatutosOverrides}
          applicablePactos={applicablePactos}
          globalStatus={globalStatus}
          entityId={entityId}
          routeScope={routeScope}
          onTabChange={onTabChange}
        />
        </WorkspaceTabPanel>
      ) : null}

      {activeTab === "regla" ? (
        <WorkspaceTabPanel tab="regla">
        <MateriaRuleTab
          materia={materia}
          matrixRow={matrixRow}
          ruleVariants={ruleVariants}
          entityId={entityId}
          sourceChips={sourceChips}
          conflictOfLaws={conflictOfLaws}
        />
        </WorkspaceTabPanel>
      ) : null}

      {activeTab === "plantillas" ? (
        <WorkspaceTabPanel tab="plantillas">
        <MateriaTemplatesTab
          materia={materia}
          templateBindings={templateBindings}
          templateReadiness={templateReadiness}
          assignTemplateAllowed={assignTemplateDecision.allowed}
          entityId={entityId}
          routeScope={routeScope}
        />
        </WorkspaceTabPanel>
      ) : null}

      {activeTab === "fuentes" ? (
        <WorkspaceTabPanel tab="fuentes">
        <MateriaSourcesTab
          materia={materia}
          applicableOverrides={applicableOverrides}
          applicablePactos={applicablePactos}
          conflictOfLaws={conflictOfLaws}
          ruleExplanation={buildRuleApplicabilityExplanation({
            materia,
            variants: ruleVariants,
            overrides,
            pactos,
          })}
        />
        </WorkspaceTabPanel>
      ) : null}

      {activeTab === "simular" ? (
        <WorkspaceTabPanel tab="simular">
        <MateriaSimulationTab
          materia={materia}
          matrixRow={matrixRow}
          ruleVariants={ruleVariants}
          templateReadiness={templateReadiness}
          conflictOfLaws={conflictOfLaws}
          globalStatus={globalStatus}
          sourceChips={sourceChips}
          entityId={entityId}
          routeScope={routeScope}
          blockedTelemetryPrepared={Boolean(blockedTelemetry)}
          onTabChange={onTabChange}
        />
        </WorkspaceTabPanel>
      ) : null}
    </div>
  );
}

function MateriaUsageNotePanel({
  note,
  relatedMatterUrl,
}: {
  note: MateriaUsageNote;
  relatedMatterUrl: (materia: string) => string;
}) {
  return (
    <aside
      className="border border-[var(--g-border-default)] bg-[var(--g-surface-subtle)] p-4"
      aria-labelledby="materia-usage-note-title"
      style={{ borderRadius: "var(--g-radius-lg)" }}
    >
      <h3 id="materia-usage-note-title" className="text-sm font-semibold text-[var(--g-text-primary)]">
        Nota de uso · {note.title}
      </h3>
      <dl className="mt-3 space-y-2 text-xs leading-5 text-[var(--g-text-secondary)]">
        <div>
          <dt className="font-semibold text-[var(--g-text-primary)]">Usar cuando</dt>
          <dd>{note.useWhen}</dd>
        </div>
        <div>
          <dt className="font-semibold text-[var(--g-text-primary)]">No usar cuando</dt>
          <dd>{note.avoidWhen}</dd>
        </div>
      </dl>
      {note.related.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {note.related.map((related) => (
            <Link
              key={related.materia}
              to={relatedMatterUrl(related.materia)}
              className="inline-flex min-h-10 items-center border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-xs font-semibold text-[var(--g-link)] hover:bg-[var(--g-surface-card)] hover:text-[var(--g-link-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] focus:ring-offset-2"
              style={{ borderRadius: "var(--g-radius-sm)" }}
            >
              Ver {related.label}
            </Link>
          ))}
        </div>
      ) : null}
    </aside>
  );
}

function EngineWorkspaceTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: EngineWorkspaceTab;
  onTabChange: (tab: EngineWorkspaceTab) => void;
}) {
  return (
    <div
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-2"
      role="tablist"
      aria-label="Regla aplicable y documentos de la materia"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        {ENGINE_WORKSPACE_TABS.map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`materia-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={selected ? `materia-panel-${tab.id}` : undefined}
              tabIndex={selected ? 0 : -1}
              onClick={() => onTabChange(tab.id)}
              onKeyDown={(event) => {
                if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
                  return;
                }
                event.preventDefault();
                const currentIndex = ENGINE_WORKSPACE_TABS.findIndex((item) => item.id === tab.id);
                const nextIndex =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? ENGINE_WORKSPACE_TABS.length - 1
                      : (currentIndex + (event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1) + ENGINE_WORKSPACE_TABS.length) % ENGINE_WORKSPACE_TABS.length;
                const nextTab = ENGINE_WORKSPACE_TABS[nextIndex];
                onTabChange(nextTab.id);
                requestAnimationFrame(() => document.getElementById(`materia-tab-${nextTab.id}`)?.focus());
              }}
              className={`min-h-[58px] border px-3 py-2 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] focus:ring-offset-2 ${
                selected
                  ? "border-[var(--g-brand-3308)] bg-[var(--g-surface-subtle)] text-[var(--g-text-primary)]"
                  : "border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] text-[var(--g-text-secondary)] hover:bg-[var(--g-surface-subtle)]"
              }`}
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <span className="block text-xs font-semibold uppercase tracking-wider">{tab.label}</span>
              <span className="mt-0.5 block text-[11px] leading-4">{tab.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WorkspaceTabPanel({ tab, children }: { tab: EngineWorkspaceTab; children: ReactNode }) {
  return (
    <div
      id={`materia-panel-${tab}`}
      role="tabpanel"
      aria-labelledby={`materia-tab-${tab}`}
      tabIndex={0}
      className="focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] focus:ring-offset-2"
      style={{ borderRadius: "var(--g-radius-md)" }}
    >
      {children}
    </div>
  );
}

function MateriaSummaryTab({
  materia,
  matrixRow,
  ruleVariants,
  templateReadiness,
  selectedSociedadName,
  applicableOverrides,
  entityHasEstatutosOverrides,
  applicablePactos,
  globalStatus,
  entityId,
  routeScope,
  onTabChange,
}: {
  materia: MateriaCatalogRow;
  matrixRow: ReturnType<typeof buildNormativeMatrixRows>[number] | undefined;
  ruleVariants: MatterRuleVariant[];
  templateReadiness: ReturnType<typeof evaluateTemplateReadiness>;
  selectedSociedadName: string | null;
  applicableOverrides: RuleParamOverrideRow[];
  entityHasEstatutosOverrides: boolean;
  applicablePactos: PactoParasocial[];
  globalStatus: MateriaGlobalStatusResult | null;
  entityId: string;
  routeScope: TemplateRouteScope;
  onTabChange: (tab: EngineWorkspaceTab) => void;
}) {
  return (
    <div className="space-y-4">
      <DetailSection icon={GitBranch} title="Cadena de decisión">
        <div className="space-y-3">
          <EnginePathStep
            step="1"
            title="Materia"
            detail={`${materia.materia_label_es} · ${matterComplexityLabel(materia)}`}
            status="cumplido"
          />
          <EnginePathStep
            step="2"
            title="Regla aplicable"
            detail={
              ruleVariants.length > 0
                ? `${ruleVariants.map((variant) => variant.organoLabel).join(" / ")} · ${majoritySummary(ruleVariants, materia)}`
                : `${matrixRow?.organo ?? "Órgano pendiente"} · mínimo ${matrixRow?.mayoria ?? majorityLabel(materia.min_majority_code)}`
            }
            status={ruleVariants.length > 0 ? "cumplido" : "pendiente"}
          />
          <EnginePathStep
            step="3"
            title="Documentos"
            detail={templateReadiness.openingMessage}
            status={templateReadiness.openingStatus === "blocked" ? "bloqueante" : "cumplido"}
          />
          <EnginePathStep
            step="4"
            title="Verificación previa"
            detail="Comprueba los requisitos antes de abrir la tramitación"
            status={templateReadiness.openingStatus === "blocked" ? "pendiente" : "cumplido"}
          />
          <EnginePathStep
            step="5"
            title="Expediente"
            detail={
              templateReadiness.openingStatus === "ready"
                ? "Listo para iniciar expediente"
                : templateReadiness.openingStatus === "not_applicable"
                  ? "No aplica expediente decisorio; la materia se documenta por constancia"
                  : "Salida bloqueada hasta completar la configuración"
            }
            status={templateReadiness.openingStatus === "blocked" ? "bloqueante" : "cumplido"}
          />
        </div>
      </DetailSection>

      <DetailSection icon={Landmark} title="Qué exige la ley">
        <RequirementList
          items={[
            materia.referencia_legal ?? "Referencia legal pendiente",
            `Mayoría mínima: ${majorityLabel(materia.min_majority_code)}`,
            materia.requires_notary ? "Escritura pública necesaria" : "Sin escritura pública configurada",
            materia.requires_registry || materia.inscribable ? "Inscripción registral requerida" : "No inscribible por defecto",
            materia.publication_required ? "Publicación legal requerida" : "Sin publicación legal configurada",
          ]}
        />
      </DetailSection>

      <DetailSection icon={ScrollText} title="Qué añaden los estatutos">
        {applicableOverrides.filter((override) => override.fuente === "ESTATUTOS").length > 0 ? (
          <RequirementList
            items={applicableOverrides
              .filter((override) => override.fuente === "ESTATUTOS")
              .map((override) => `${override.clave}: ${formatOverrideValue(override.valor)} · ${override.referencia ?? "sin referencia"}`)}
          />
        ) : entityHasEstatutosOverrides ? (
          <p className="text-sm text-[var(--g-text-secondary)]">
            Las cláusulas estatutarias estructuradas en el sistema no recogen regla especial para
            esta materia; se aplica la regla legal por defecto salvo previsión estatutaria aún no
            estructurada.
          </p>
        ) : (
          <p className="text-sm text-[var(--g-text-secondary)]">
            Estatutos no estructurados en el sistema para esta sociedad. Se aplica la regla legal
            por defecto hasta cargar la fuente documental.
          </p>
        )}
      </DetailSection>

      <DetailSection icon={ShieldCheck} title="Pactos aplicables">
        {applicablePactos.length > 0 ? (
          <RequirementList
            items={applicablePactos.map((pacto) => `${pacto.titulo ?? "Pacto vigente"} · obligación contractual, no invalida por sí sola el acuerdo societario.`)}
          />
        ) : (
          <p className="text-sm text-[var(--g-text-secondary)]">
            No hay pactos vigentes registrados para esta materia.
          </p>
        )}
      </DetailSection>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onTabChange("simular")}
          className="inline-flex items-center justify-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm font-semibold text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] focus:ring-offset-2"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          Verificar requisitos antes de iniciar <PlayCircle className="h-4 w-4" aria-hidden="true" />
        </button>
        {globalStatus ? (
          <MateriaPrimaryCta
            status={globalStatus}
            materia={materia}
            entityId={entityId}
            routeScope={routeScope}
            onTabChange={onTabChange}
          />
        ) : (
          <button
            type="button"
            onClick={() => onTabChange("plantillas")}
            className="inline-flex items-center justify-center gap-2 bg-[var(--g-brand-3308)] px-3 py-2 text-sm font-semibold text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] focus:ring-offset-2"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Ver documentos y plantillas de esta materia <FileText className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
      {selectedSociedadName ? (
        <p className="text-xs text-[var(--g-text-secondary)]">
          El resumen se evalúa para {selectedSociedadName}; cambia de sociedad para recalcular órgano, fuentes y requisitos.
        </p>
      ) : null}
    </div>
  );
}

function MateriaPrimaryCta({
  status,
  materia,
  entityId,
  routeScope,
  onTabChange,
}: {
  status: MateriaGlobalStatusResult;
  materia: MateriaCatalogRow;
  entityId: string;
  routeScope: TemplateRouteScope;
  onTabChange: (tab: EngineWorkspaceTab) => void;
}) {
  const primaryClass =
    "inline-flex items-center justify-center gap-2 bg-[var(--g-brand-3308)] px-3 py-2 text-sm font-semibold text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] focus:ring-offset-2";
  if (status.status === "bloqueada") {
    return (
      <button
        type="button"
        onClick={() => onTabChange("plantillas")}
        className={primaryClass}
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        Resolver bloqueo <ListChecks className="h-4 w-4" aria-hidden="true" />
      </button>
    );
  }
  if (status.status === "revision_legal") {
    return (
      <button
        type="button"
        onClick={() => onTabChange("fuentes")}
        className={primaryClass}
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        Revisar fuentes <Layers className="h-4 w-4" aria-hidden="true" />
      </button>
    );
  }
  if (status.ctaLabel === "Ver regla aplicable") {
    return (
      <button
        type="button"
        onClick={() => onTabChange("regla")}
        className={primaryClass}
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        Ver regla aplicable <Scale className="h-4 w-4" aria-hidden="true" />
      </button>
    );
  }
  return (
    <Link
      to={tramitadorNuevoUrl({ materia: materia.materia, scope: routeScope, entityId })}
      className={primaryClass}
      style={{ borderRadius: "var(--g-radius-md)" }}
    >
      Iniciar expediente <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}

function MateriaRuleTab({
  materia,
  matrixRow,
  ruleVariants,
  entityId,
  sourceChips,
  conflictOfLaws,
}: {
  materia: MateriaCatalogRow;
  matrixRow: ReturnType<typeof buildNormativeMatrixRows>[number] | undefined;
  ruleVariants: MatterRuleVariant[];
  entityId: string;
  sourceChips: ReturnType<typeof buildSourceChipsForMateria>;
  conflictOfLaws: ReturnType<typeof detectConflictOfLaws> | null;
}) {
  return (
    <DetailSection
      icon={CheckCircle2}
      title={entityId ? "Regla aplicable para esta sociedad" : "Ramas legales disponibles"}
    >
      <p className="mb-4 text-sm leading-6 text-[var(--g-text-secondary)]">
        {entityId
          ? "La rama aplicable se resuelve por órgano y tipo social a partir de la regla versionada activa."
          : "Selecciona una sociedad para resolver la rama SA o SL; el catálogo conserva todas las variantes por órgano."}
      </p>
      {ruleVariants.length > 0 ? (
        <div className="space-y-3">
          {ruleVariants.map((variant) => (
            <section
              key={variant.id}
              className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-3"
              aria-labelledby={`rule-variant-${variant.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`}
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3
                    id={`rule-variant-${variant.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`}
                    className="text-sm font-semibold text-[var(--g-text-primary)]"
                  >
                    {variant.organoLabel}
                  </h3>
                  <p className="mt-0.5 text-xs text-[var(--g-text-secondary)]">
                    Regla versionada activa v{variant.version}
                  </p>
                </div>
                {entityId ? (
                  <Link
                    to={`/secretaria/catalogo-organos?entity=${entityId}&matter=${materia.materia}`}
                    className="text-xs font-semibold text-[var(--g-link)] hover:text-[var(--g-link-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] focus:ring-offset-2"
                    style={{ borderRadius: "var(--g-radius-sm)" }}
                  >
                    Ver órgano
                  </Link>
                ) : null}
              </div>
              {variant.adoptionModes.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {variant.adoptionModes.map((mode) => (
                    <span
                      key={mode.code}
                      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-2 py-1 text-[11px] text-[var(--g-text-primary)]"
                      style={{ borderRadius: "var(--g-radius-full)" }}
                    >
                      {mode.label}
                    </span>
                  ))}
                </div>
              ) : null}
              {variant.socialTypeRestrictions.length > 0 ? (
                <p className="mt-3 text-xs leading-5 text-[var(--g-text-secondary)]">
                  <strong className="text-[var(--g-text-primary)]">Aplicabilidad por tipo social:</strong>{" "}
                  {variant.socialTypeApplicabilityReason}
                </p>
              ) : null}
              {variant.warnings.some(
                (warning) => warning !== variant.socialTypeApplicabilityReason,
              ) ? (
                <div
                  className="mt-3 border border-[var(--status-warning)] bg-[var(--g-surface-card)] p-3 text-xs leading-5 text-[var(--g-text-secondary)]"
                  role="note"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  {variant.warnings
                    .filter((warning) => warning !== variant.socialTypeApplicabilityReason)
                    .join(" ")}
                </div>
              ) : null}
              <div className="mt-3 space-y-3">
                {variant.branches.map((branch) => (
                  <div key={branch.id} className="border-t border-[var(--g-border-subtle)] pt-3 first:border-t-0 first:pt-0">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
                      {branch.label}
                    </div>
                    <div className="grid grid-cols-1 gap-2 text-sm">
                      <KeyValue
                        label="Mayoría"
                        value={`${branch.majority}${branch.majorityReference ? ` · ${branch.majorityReference}` : ""}`}
                      />
                      <KeyValue
                        label="Quórum"
                        value={`${branch.quorum}${branch.quorumReference ? ` · ${branch.quorumReference}` : ""}`}
                      />
                    </div>
                  </div>
                ))}
                <KeyValue
                  label="Documentos reales"
                  value={
                    variant.documents.length > 0
                      ? variant.documents.map((document) => document.name).join(", ")
                      : documentRequirements(materia).join(", ")
                  }
                />
                <KeyValue
                  label="Formalización"
                  value={variant.formalization.kinds.map((kind) => FORMALIZATION_KIND_LABEL[kind]).join(", ")}
                />
                {variant.formalization.discrepancy ? (
                  <p className="text-xs leading-5 text-[var(--g-text-secondary)]">
                    La formalización de la regla versionada difiere del mínimo de catálogo. La procedencia se detalla en Fuentes.
                  </p>
                ) : null}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div
          className="border border-[var(--status-warning)] bg-[var(--g-surface-card)] p-3"
          role="note"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <p className="text-sm font-semibold text-[var(--g-text-primary)]">
            Sin regla versionada activa: se muestra solo el mínimo de catálogo.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2 text-sm">
            <KeyValue label="Órgano orientativo" value={matrixRow?.organo ?? "Pendiente de revisión"} />
            <KeyValue label="Mayoría mínima" value={majorityLabel(materia.min_majority_code)} />
            <KeyValue label="Referencia" value={materia.referencia_legal ?? "Pendiente"} />
          </div>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2" aria-label="Fuentes revisadas">
        {sourceChips.map((chip) => <SourceChip key={`${chip.type}-${chip.reference}`} chip={chip} />)}
      </div>
      {conflictOfLaws?.conflict_of_laws_flag ? (
        <ConflictOfLawsNotice conflictOfLaws={conflictOfLaws} />
      ) : null}
    </DetailSection>
  );
}

function MateriaTemplatesTab({
  materia,
  templateBindings,
  templateReadiness,
  assignTemplateAllowed,
  entityId,
  routeScope,
}: {
  materia: MateriaCatalogRow;
  templateBindings: ReturnType<typeof buildTemplateDocumentBindings>;
  templateReadiness: ReturnType<typeof evaluateTemplateReadiness>;
  assignTemplateAllowed: boolean;
  entityId: string;
  routeScope: TemplateRouteScope;
}) {
  return (
    <div className="space-y-4">
      <DetailSection icon={FileText} title="Documentos y plantillas de esta materia">
        <p className="mb-4 text-sm leading-6 text-[var(--g-text-secondary)]">
          La comprobación documental previa verifica que las fases mínimas tengan plantilla activa
          antes de habilitar el expediente.
        </p>
        <div className="space-y-3" aria-label="Matriz de preparación documental por fase">
          {TEMPLATE_DOCUMENT_STAGES.map((stage) => (
            <TemplateStageRow
              key={stage}
              stage={stage}
              materia={materia}
              bindings={templateBindings.filter((binding) => binding.stage === stage)}
              readiness={templateReadiness.items.find((item) => item.stage === stage)}
              assignTemplateAllowed={assignTemplateAllowed}
              entityId={entityId}
              routeScope={routeScope}
            />
          ))}
        </div>
      </DetailSection>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Link
          to={buildTemplateLibraryUrl({
            materia: materia.materia,
            ciclo: "vigentes",
            scope: routeScope,
            entityId,
          })}
          className="inline-flex flex-1 items-center justify-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm font-semibold text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          Ver en catálogo de plantillas <Settings2 className="h-4 w-4" aria-hidden="true" />
        </Link>
        <Link
          to={buildTemplateGovernanceUrl({
            materia: materia.materia,
            estado: "ACTIVA",
            scope: routeScope,
            entityId,
          })}
          className="inline-flex flex-1 items-center justify-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm font-semibold text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          Administrar plantillas <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

function TemplateStageRow({
  stage,
  materia,
  bindings,
  readiness,
  assignTemplateAllowed,
  entityId,
  routeScope,
}: {
  stage: TemplateDocumentStage;
  materia: MateriaCatalogRow;
  bindings: ReturnType<typeof buildTemplateDocumentBindings>;
  readiness: ReturnType<typeof evaluateTemplateReadiness>["items"][number] | undefined;
  assignTemplateAllowed: boolean;
  entityId: string;
  routeScope: TemplateRouteScope;
}) {
  const activeBindings = bindings.filter((binding) => binding.template.estado === "ACTIVA");
  const candidateBindings = bindings.filter((binding) => binding.template.estado !== "ACTIVA");
  const displayGroups = groupStageBindingsForDisplay(activeBindings);
  const currentBindings = displayGroups.map((group) => group.current);
  const dataDuplicates = detectTemplateDataDuplicates(activeBindings);
  const criticalityLabel =
    readiness?.criticality === "apertura"
      ? "Bloquea apertura"
      : readiness?.criticality === "cierre"
        ? "Antes del cierre"
        : readiness?.criticality === "no_aplica"
          ? "No aplica"
          : "Soporte";
  const stateLabel =
    readiness?.status === "faltante"
      ? "Faltante"
      : readiness?.status === "pendiente_revision"
        ? "Pendiente revisión"
        : readiness?.status === "no_aplica"
          ? "No aplica"
          : "Activa";
  const actionTarget = buildTemplateLibraryUrl({
    tipo: stage,
    materia: materia.materia,
    ciclo: readiness?.status === "activa" ? "vigentes" : "todas",
    scope: routeScope,
    entityId,
  });
  return (
    <article
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
      style={{ borderRadius: "var(--g-radius-md)" }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--g-text-primary)]">{stage}</h3>
          <p className="mt-1 text-xs font-semibold text-[var(--g-text-secondary)]">
            Criticidad: {criticalityLabel}
          </p>
        </div>
        <StatusPill
          label={stateLabel}
          tone={
            readiness?.blocking
              ? "block"
              : readiness?.status === "activa"
                ? "ok"
                : readiness?.status === "no_aplica"
                  ? "info"
                : "warn"
          }
        />
      </div>
      <div className="mt-3 border-t border-[var(--g-border-subtle)] pt-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
          Consecuencia
        </div>
        <p className="mt-1 text-xs leading-5 text-[var(--g-text-secondary)]">
          {readiness?.consequence ?? "Revisar la configuración de esta fase."}
        </p>
      </div>
      <div className="mt-3 border-t border-[var(--g-border-subtle)] pt-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
          Plantilla vigente o candidata
        </div>
        {dataDuplicates.length > 0 ? (
          <div
            className="mb-3 border border-[var(--status-warning)] bg-[var(--g-surface-card)] p-2 text-xs text-[var(--g-text-secondary)]"
            role="note"
            style={{ borderRadius: "var(--g-radius-sm)" }}
          >
            <strong className="text-[var(--g-text-primary)]">Posible duplicidad de plantilla:</strong>{" "}
            {dataDuplicates
              .map((duplicate) => `${documentTypeLabel(duplicate.tipo)} · v${duplicate.version} (${duplicate.ids.length} copias)`)
              .join("; ")}
            . Revisar antes de activar nuevos expedientes.
          </div>
        ) : null}
        {displayGroups.length > 0 ? (
          <ul className="space-y-3">
            {displayGroups.map((group) => (
              <li key={group.current.template.id}>
                <TemplateBindingItem
                  binding={group.current}
                  siblings={currentBindings}
                  label="Vigente para nuevos expedientes"
                  entityId={entityId}
                  routeScope={routeScope}
                />
                {group.older.length > 0 ? (
                  <details className="mt-1">
                    <summary
                      className="cursor-pointer text-[11px] font-semibold text-[var(--g-link)] hover:text-[var(--g-link-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2"
                      style={{ borderRadius: "var(--g-radius-sm)" }}
                    >
                      Ver versiones anteriores ({group.older.length})
                    </summary>
                    <ul className="mt-2 space-y-2 border-l border-[var(--g-border-subtle)] pl-3">
                      {group.older.map((binding) => (
                        <li key={binding.template.id}>
                          <TemplateBindingItem
                            binding={binding}
                            siblings={group.older}
                            label="Versión anterior"
                            entityId={entityId}
                            routeScope={routeScope}
                          />
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        {candidateBindings.length > 0 ? (
          <div className={displayGroups.length > 0 ? "mt-3 border-t border-[var(--g-border-subtle)] pt-3" : ""}>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
              Plantillas candidatas
            </div>
            <ul className="mt-2 space-y-2">
              {candidateBindings.slice(0, 2).map((binding) => (
                <li key={binding.template.id}>
                  <TemplateBindingItem
                    binding={binding}
                    siblings={candidateBindings}
                    label="Candidata"
                    entityId={entityId}
                    routeScope={routeScope}
                  />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {bindings.length === 0 ? (
          <p className="text-xs text-[var(--g-text-secondary)]">
            {readiness?.criticality === "no_aplica"
              ? "Esta fase no requiere plantilla en el contexto seleccionado."
              : "No hay plantilla asociada a esta fase."}
          </p>
        ) : null}
      </div>
      <div className="mt-3 border-t border-[var(--g-border-subtle)] pt-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
          Acción
        </div>
        {readiness?.status === "no_aplica" ? (
          <span className="text-xs font-semibold text-[var(--g-text-secondary)]">No requiere acción</span>
        ) : assignTemplateAllowed ? (
          <div className="flex min-w-[150px] flex-col gap-2">
            <Link
              to={actionTarget}
              className="inline-flex min-h-10 items-center justify-center border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-xs font-semibold text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] focus:ring-offset-2"
              style={{ borderRadius: "var(--g-radius-sm)" }}
            >
              {readiness?.actionLabel ?? "Revisar plantilla"}
            </Link>
            {bindings.length === 0 ? (
              <Link
                to={buildTemplateGovernanceUrl({
                  materia: materia.materia,
                  estado: "ALL",
                  scope: routeScope,
                  entityId,
                })}
                className="inline-flex min-h-10 items-center justify-center border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-xs font-semibold text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] focus:ring-offset-2"
                style={{ borderRadius: "var(--g-radius-sm)" }}
              >
                Crear desde modelo
              </Link>
            ) : null}
          </div>
        ) : (
          <span className="text-xs font-semibold text-[var(--g-text-secondary)]">Solicitar edición</span>
        )}
      </div>
    </article>
  );
}

function TemplateBindingItem({
  binding,
  siblings,
  label,
  entityId,
  routeScope,
}: {
  binding: TemplateDocumentBinding;
  siblings: TemplateDocumentBinding[];
  label: string;
  entityId: string;
  routeScope: TemplateRouteScope;
}) {
  return (
    <div className="text-xs text-[var(--g-text-secondary)]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-[var(--g-text-primary)]">
            {templateBindingDisplayLabel(binding, siblings)}
          </div>
          <div>{binding.statusLabel} · {binding.selectionReason}</div>
          <div>
            Variables automáticas {binding.automaticVariablesValid ? "válidas" : "pendientes"} · Campos obligatorios al generar: {binding.editableFieldsPending}
          </div>
        </div>
        <span
          className="shrink-0 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--g-text-primary)]"
          style={{ borderRadius: "var(--g-radius-full)" }}
        >
          {label}
        </span>
      </div>
      <div className="mt-1">
        <Link
          to={buildTemplateGovernanceUrl({
            materia: resolveMateriaAlias(
              binding.template.materia_acuerdo ?? binding.template.materia,
            ),
            plantilla: binding.template.id,
            estado: binding.template.estado,
            scope: routeScope,
            entityId,
          })}
          className="font-semibold text-[var(--g-brand-3308)] hover:text-[var(--g-sec-700)]"
        >
          Vista previa del documento
        </Link>
      </div>
    </div>
  );
}

function MateriaSourcesTab({
  materia,
  applicableOverrides,
  applicablePactos,
  conflictOfLaws,
  ruleExplanation,
}: {
  materia: MateriaCatalogRow;
  applicableOverrides: RuleParamOverrideRow[];
  applicablePactos: PactoParasocial[];
  conflictOfLaws: ReturnType<typeof detectConflictOfLaws> | null;
  ruleExplanation: ReturnType<typeof buildRuleApplicabilityExplanation>;
}) {
  return (
    <div className="space-y-4">
      <DetailSection icon={Layers} title="¿Por qué se aplica esta regla?">
        <p className="mb-3 text-sm leading-6 text-[var(--g-text-secondary)]">
          Cada requisito identifica la rama versionada que lo determina. Las demás fuentes se muestran como revisadas, sin presentarlas como ganadoras.
        </p>
        <div className="grid grid-cols-1 gap-4">
          <section aria-labelledby="determinant-source-title">
            <h3
              id="determinant-source-title"
              className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-primary)]"
            >
              Fuente determinante
            </h3>
            <dl className="mt-2 space-y-2">
              {ruleExplanation.determinants.map((entry) => (
                <div
                  key={entry.id}
                  className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-3"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <dt className="text-sm font-semibold text-[var(--g-text-primary)]">{entry.label}</dt>
                  <dd className="mt-1 text-sm text-[var(--g-text-primary)]">{entry.value}</dd>
                  <dd className="mt-1 text-xs leading-5 text-[var(--g-text-secondary)]">
                    {entry.provenance}{entry.reference ? ` · ${entry.reference}` : ""}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
          <section aria-labelledby="reviewed-source-title">
            <h3
              id="reviewed-source-title"
              className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-primary)]"
            >
              Fuentes revisadas
            </h3>
            <dl className="mt-2 space-y-2">
              {ruleExplanation.reviewed.map((entry) => (
                <div
                  key={entry.id}
                  className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-3"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <dt className="text-sm font-semibold text-[var(--g-text-primary)]">{entry.label}</dt>
                  <dd className="text-xs leading-5 text-[var(--g-text-secondary)]">
                    {entry.value}{entry.reference ? ` · ${entry.reference}` : ""} · {entry.provenance}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
          {ruleExplanation.warnings.length > 0 ? (
            <div
              className="border border-[var(--status-warning)] bg-[var(--g-surface-card)] p-3 text-xs leading-5 text-[var(--g-text-secondary)]"
              role="note"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              {ruleExplanation.warnings.join(" ")}
            </div>
          ) : null}
        </div>
      </DetailSection>

      <DetailSection icon={Landmark} title="Ley base">
        <RequirementList items={[materia.referencia_legal ?? "Referencia legal pendiente"]} />
      </DetailSection>

      <DetailSection icon={ScrollText} title="Estatutos y reglamento">
        {applicableOverrides.length > 0 ? (
          <RequirementList
            items={applicableOverrides.map((override) => `${override.fuente}: ${override.clave} = ${formatOverrideValue(override.valor)} · ${override.referencia ?? "sin referencia"}`)}
          />
        ) : (
          <p className="text-sm text-[var(--g-text-secondary)]">
            No hay ajustes publicados. La regla aplicable queda en el mínimo legal exigible.
          </p>
        )}
      </DetailSection>

      <DetailSection icon={ShieldCheck} title="Pactos parasociales">
        {applicablePactos.length > 0 ? (
          <RequirementList
            items={applicablePactos.map((pacto) => `${pacto.titulo ?? "Pacto vigente"} · ${pacto.tipo_clausula ?? "cláusula"} · obligación contractual.`)}
          />
        ) : (
          <p className="text-sm text-[var(--g-text-secondary)]">
            No hay pacto vigente registrado para esta materia.
          </p>
        )}
      </DetailSection>

      {conflictOfLaws?.conflict_of_laws_flag ? <ConflictOfLawsNotice conflictOfLaws={conflictOfLaws} /> : null}
    </div>
  );
}

function MateriaSimulationTab({
  materia,
  matrixRow,
  ruleVariants,
  templateReadiness,
  conflictOfLaws,
  globalStatus,
  sourceChips,
  entityId,
  routeScope,
  blockedTelemetryPrepared,
  onTabChange,
}: {
  materia: MateriaCatalogRow;
  matrixRow: ReturnType<typeof buildNormativeMatrixRows>[number] | undefined;
  ruleVariants: MatterRuleVariant[];
  templateReadiness: ReturnType<typeof evaluateTemplateReadiness>;
  conflictOfLaws: ReturnType<typeof detectConflictOfLaws> | null;
  globalStatus: MateriaGlobalStatusResult | null;
  sourceChips: ReturnType<typeof buildSourceChipsForMateria>;
  entityId: string;
  routeScope: TemplateRouteScope;
  blockedTelemetryPrepared: boolean;
  onTabChange: (tab: EngineWorkspaceTab) => void;
}) {
  const conflict = Boolean(conflictOfLaws?.conflict_of_laws_flag);
  const legalReviewRequired = globalStatus?.status === "revision_legal";
  const societyNotApplicable = globalStatus?.label === "No aplica a esta sociedad";
  const legalGateBlocked = conflict || legalReviewRequired;
  const effectiveFormalizationKinds = Array.from(
    new Set(
      ruleVariants.length > 0
        ? ruleVariants.flatMap((variant) => variant.formalization.kinds)
        : catalogFormalizationKinds(materia),
    ),
  );
  const outcome = templateReadiness.openingStatus === "blocked"
    ? {
        label: "Bloqueado",
        detail: templateReadiness.blockingMessage ?? "Falta configuración documental mínima.",
        tone: "block" as const,
      }
    : societyNotApplicable
      ? {
          label: "No aplica a esta sociedad",
          detail: globalStatus?.explanation ?? templateReadiness.openingMessage,
          tone: "info" as const,
        }
    : templateReadiness.openingStatus === "not_applicable"
      ? {
          label: "No aplica abrir expediente",
          detail: "Esta materia informativa se documenta mediante constancia en acta.",
          tone: "info" as const,
        }
    : legalReviewRequired || conflict
      ? {
          label: "Revisión legal pendiente",
          detail:
            globalStatus?.explanation ??
            "Hay una cuestión jurídica pendiente antes de abrir expediente.",
          tone: "warn" as const,
        }
      : {
          label: "Listo para iniciar expediente",
          detail: "Los requisitos y documentos mínimos están cubiertos.",
          tone: "ok" as const,
        };

  return (
    <div className="space-y-4">
      <DetailSection icon={PlayCircle} title="Verificación previa del expediente">
        <div
          className="mb-4 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-4"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
                Resultado de la verificación
              </div>
              <div className="mt-1 text-lg font-semibold text-[var(--g-text-primary)]">{outcome.label}</div>
              <p className="mt-1 text-sm text-[var(--g-text-secondary)]">{outcome.detail}</p>
            </div>
            <StatusPill label={outcome.label} tone={outcome.tone} />
          </div>
        </div>

        <div className="space-y-2">
          <PreflightRow
            label="Materia reconocida"
            detail={materia.materia_label_es}
            state="cumplido"
          />
          <PreflightRow
            label={societyNotApplicable ? "Aplicabilidad por tipo social" : "Regla aplicable resuelta"}
            detail={
              ruleVariants.length > 0
                ? `${ruleVariants.map((variant) => variant.organoLabel).join(" / ")} · ${majoritySummary(ruleVariants, materia)}`
                : `${matrixRow?.organo ?? "Órgano pendiente"} · mínimo ${matrixRow?.mayoria ?? majorityLabel(materia.min_majority_code)}`
            }
            state={
              societyNotApplicable
                ? "no_aplica"
                : legalReviewRequired
                  ? "bloqueante"
                  : ruleVariants.length > 0
                    ? "cumplido"
                    : "pendiente"
            }
          />
          <PreflightRow
            label="Fuentes jurídicas"
            detail={sourceChips.map((chip) => chip.type).join(", ")}
            state={legalGateBlocked ? "bloqueante" : "cumplido"}
          />
          <PreflightRow
            label="Plantillas mínimas"
            detail={templateReadiness.openingMessage}
            state={
              templateReadiness.openingStatus === "blocked"
                ? "bloqueante"
                : templateReadiness.openingStatus === "not_applicable"
                  ? "no_aplica"
                  : "cumplido"
            }
          />
          <PreflightRow
            label="Formalización posterior"
            detail={
              societyNotApplicable
                ? globalStatus?.explanation ?? "No se ejecuta para la sociedad seleccionada."
                : `${effectiveFormalizationKinds.map((kind) => FORMALIZATION_KIND_LABEL[kind]).join(" · ")} · ${ruleVariants.length > 0 ? "regla versionada activa" : "mínimo de catálogo"}`
            }
            state={societyNotApplicable ? "no_aplica" : "cumplido"}
          />
        </div>
      </DetailSection>

      {templateReadiness.openingStatus === "blocked" ? (
        <div
          className="border border-[var(--status-error)] bg-[var(--g-surface-card)] p-3 text-sm text-[var(--g-text-secondary)]"
          role="alert"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <strong className="text-[var(--g-text-primary)]">Expediente bloqueado.</strong>{" "}
          {templateReadiness.blockingMessage}
          {blockedTelemetryPrepared ? (
            <span className="mt-1 block text-xs">
              Trazabilidad preparada para el bloqueo del expediente.
            </span>
          ) : null}
        </div>
      ) : null}

      {legalReviewRequired && templateReadiness.openingStatus !== "blocked" ? (
        <div
          className="border border-[var(--status-warning)] bg-[var(--g-surface-card)] p-3 text-sm text-[var(--g-text-secondary)]"
          role="alert"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <strong className="text-[var(--g-text-primary)]">Revisión legal pendiente.</strong>{" "}
          {globalStatus?.explanation}
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        {templateReadiness.openingStatus === "ready" && !legalGateBlocked && !societyNotApplicable ? (
          <Link
            to={tramitadorNuevoUrl({ materia: materia.materia, scope: routeScope, entityId })}
            className="inline-flex flex-1 items-center justify-center gap-2 bg-[var(--g-brand-3308)] px-3 py-2 text-sm font-semibold text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Iniciar expediente <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : (
          <span
            aria-disabled="true"
            aria-label={
              societyNotApplicable
                ? "No aplica abrir un expediente para esta materia en la sociedad seleccionada"
                : templateReadiness.openingStatus === "not_applicable"
                ? "No aplica abrir un expediente decisorio para esta materia informativa"
                : "No se puede iniciar expediente porque la verificación previa requiere revisión"
            }
            className="inline-flex flex-1 items-center justify-center gap-2 bg-[var(--g-surface-muted)] px-3 py-2 text-sm font-semibold text-[var(--g-text-secondary)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            {societyNotApplicable
              ? "No aplica a esta sociedad"
              : templateReadiness.openingStatus === "not_applicable"
              ? "No aplica abrir expediente"
              : "Iniciar expediente bloqueado"}
          </span>
        )}
        <button
          type="button"
          onClick={() => onTabChange("plantillas")}
          className="inline-flex flex-1 items-center justify-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm font-semibold text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          Revisar configuración <ListChecks className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function EnginePathStep({
  step,
  title,
  detail,
  status,
}: {
  step: string;
  title: string;
  detail: string;
  status: "cumplido" | "pendiente" | "bloqueante";
}) {
  return (
    <div className="grid grid-cols-[32px_minmax(0,1fr)] gap-3">
      <div
        className={`flex h-8 w-8 items-center justify-center text-xs font-semibold ${
          status === "bloqueante"
            ? SEMANTIC_TONE_CLASS.error
            : status === "pendiente"
              ? SEMANTIC_TONE_CLASS.warning
              : SEMANTIC_TONE_CLASS.success
        }`}
        style={{ borderRadius: "var(--g-radius-full)" }}
      >
        {step}
      </div>
      <div className="min-w-0 border-b border-[var(--g-border-subtle)] pb-3 last:border-b-0 last:pb-0">
        <div className="text-sm font-semibold text-[var(--g-text-primary)]">{title}</div>
        <div className="mt-0.5 text-xs leading-5 text-[var(--g-text-secondary)]">{detail}</div>
      </div>
    </div>
  );
}

function PreflightRow({
  label,
  detail,
  state,
}: {
  label: string;
  detail: string;
  state: "cumplido" | "pendiente" | "bloqueante" | "no_aplica";
}) {
  const icon =
    state === "bloqueante" ? (
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-error)]" aria-hidden="true" />
    ) : state === "no_aplica" ? (
      <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-info)]" aria-hidden="true" />
    ) : state === "pendiente" ? (
      <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-warning)]" aria-hidden="true" />
    ) : (
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-success)]" aria-hidden="true" />
    );
  return (
    <div
      className="flex gap-3 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-3"
      style={{ borderRadius: "var(--g-radius-md)" }}
    >
      {icon}
      <div>
        <div className="text-sm font-semibold text-[var(--g-text-primary)]">{label}</div>
        <div className="mt-0.5 text-xs leading-5 text-[var(--g-text-secondary)]">{detail}</div>
      </div>
    </div>
  );
}

function ConflictOfLawsNotice({
  conflictOfLaws,
}: {
  conflictOfLaws: ReturnType<typeof detectConflictOfLaws>;
}) {
  return (
    <div
      className="mt-3 border border-[var(--status-error)] bg-[var(--g-surface-card)] p-3 text-xs text-[var(--g-text-secondary)]"
      style={{ borderRadius: "var(--g-radius-md)" }}
    >
      <strong className="text-[var(--g-text-primary)]">
        {conflictOfLaws.conflict_kind === "social_form"
          ? "Configuración societaria incoherente:"
          : "Conflicto jurisdiccional:"}
      </strong>{" "}
      {conflictOfLaws.explanation}
    </div>
  );
}

function EngineConfigSummary({
  selectedMatter,
  selectedMatrixRow,
  ruleVariants,
  templateReadiness,
  selectedStatus,
  onTabChange,
}: {
  selectedMatter: MateriaCatalogRow | null;
  selectedMatrixRow: ReturnType<typeof buildNormativeMatrixRows>[number] | undefined;
  ruleVariants: MatterRuleVariant[];
  templateReadiness: ReturnType<typeof evaluateTemplateReadiness> | null;
  selectedStatus: MateriaGlobalStatusResult | null;
  onTabChange: (tab: EngineWorkspaceTab) => void;
}) {
  return (
    <section
      className="mb-6 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
      aria-label="Reglas aplicables y requisitos para tramitar"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
            <Layers className="h-3.5 w-3.5" aria-hidden="true" />
            Reglas aplicables y requisitos para tramitar
          </div>
          <p className="mt-1 max-w-3xl text-sm text-[var(--g-text-secondary)]">
            La materia seleccionada determina el órgano competente, la mayoría, el quórum, las
            fuentes aplicables y los documentos mínimos necesarios para iniciar el expediente.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onTabChange("plantillas")}
          className="inline-flex items-center justify-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-xs font-semibold text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] focus:ring-offset-2"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          Ver documentos y plantillas de esta materia <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
      <dl className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
        <EngineConfigMetric
          icon={BookOpen}
          label="Materia"
          value={selectedMatter?.materia_label_es ?? "Pendiente"}
          detail={selectedMatter ? matterComplexityLabel(selectedMatter) : "Sin selección"}
        />
        <EngineConfigMetric
          icon={Scale}
          label="Regla aplicable"
          value={
            selectedMatter
              ? majoritySummary(ruleVariants, selectedMatter)
              : selectedMatrixRow?.mayoria ?? "Pendiente"
          }
          detail={
            ruleVariants.length > 0
              ? `${ruleVariants.map((variant) => variant.organoLabel).join(" / ")} · regla versionada activa`
              : "Mínimo de catálogo; regla versionada pendiente"
          }
        />
        <EngineConfigMetric
          icon={FileText}
          label="Preparación documental"
          value={
            templateReadiness?.openingStatus === "ready"
              ? "Completa"
              : templateReadiness?.openingStatus === "not_applicable"
                ? "No aplica a la apertura"
                : "Bloqueante"
          }
          detail={templateReadiness?.openingMessage ?? "Comprobación documental previa pendiente"}
        />
        <EngineConfigMetric
          icon={ShieldCheck}
          label="Resultado de la verificación"
          value={
            selectedStatus?.label ??
            (templateReadiness?.openingStatus === "ready"
              ? "Listo para iniciar expediente"
              : templateReadiness?.openingStatus === "not_applicable"
                ? "No aplica abrir expediente"
                : "Bloqueado")
          }
          detail={selectedStatus?.explanation ?? "La verificación se realiza antes de abrir el flujo operativo"}
        />
      </dl>
    </section>
  );
}

function EngineConfigMetric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: ElementType;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="min-w-0 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-3" style={{ borderRadius: "var(--g-radius-md)" }}>
      <dt className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
        <Icon className="h-3.5 w-3.5 text-[var(--g-brand-3308)]" aria-hidden="true" />
        {label}
      </dt>
      <dd className="mt-1 truncate text-sm font-semibold text-[var(--g-text-primary)]">{value}</dd>
      <dd className="mt-1 line-clamp-2 text-xs text-[var(--g-text-secondary)]">{detail}</dd>
    </div>
  );
}

function DetailSection({
  icon: Icon,
  title,
  children,
}: {
  icon: ElementType;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--g-text-primary)]">
        <Icon className="h-4 w-4 text-[var(--g-brand-3308)]" />
        {title}
      </div>
      {children}
    </section>
  );
}

function RequirementList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 text-sm text-[var(--g-text-secondary)]">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--status-success)]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function KeyValue({ label, value, action }: { label: string; value: string; action?: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-[var(--g-border-subtle)] pb-2 last:border-b-0 last:pb-0 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">{label}</div>
      <div className="flex items-center justify-between gap-2 text-sm text-[var(--g-text-primary)]">
        <span>{value}</span>
        {action}
      </div>
    </div>
  );
}

function SourceChip({ chip }: { chip: ReturnType<typeof buildSourceChipsForMateria>[number] }) {
  const accessibleLabel = `${chip.type}: ${chip.reference}; ${chip.version}; ${chip.validationState}`;
  return (
    <span
      className="inline-flex max-w-full flex-wrap items-center gap-1.5 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-3 py-2 text-xs text-[var(--g-text-primary)]"
      style={{ borderRadius: "var(--g-radius-full)" }}
      role="note"
      aria-label={accessibleLabel}
    >
      <span className="shrink-0 font-semibold">{chip.type}</span>
      <span aria-hidden="true">·</span>
      <span className="break-words">{chip.reference}</span>
      <span className="shrink-0 text-[var(--g-text-secondary)]">({chip.validationState})</span>
    </span>
  );
}

function StatusPill({ label, tone }: { label: string; tone: "ok" | "warn" | "block" | "info" }) {
  const cls =
    tone === "ok"
      ? SEMANTIC_TONE_CLASS.success
      : tone === "block"
        ? SEMANTIC_TONE_CLASS.error
        : tone === "info"
          ? SEMANTIC_TONE_CLASS.info
          : SEMANTIC_TONE_CLASS.warning;
  return (
    <span className={`px-2.5 py-1 text-xs font-semibold uppercase tracking-wider ${cls}`} style={{ borderRadius: "var(--g-radius-full)" }}>
      {label}
    </span>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <span
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-muted)] px-2 py-1"
      style={{ borderRadius: "var(--g-radius-full)" }}
      title={FORMALIZATION_CHIP_LEGEND[label]}
    >
      {label}
    </span>
  );
}

function formatOverrideValue(value: unknown) {
  if (value === null || value === undefined) return "sin valor";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}
