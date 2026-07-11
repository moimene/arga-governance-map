import { useMemo, useState, type ElementType, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  FileText,
  GitBranch,
  Landmark,
  Layers,
  ListChecks,
  PlayCircle,
  Scale,
  ScrollText,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { useCurrentUserRole } from "@/hooks/useCurrentUser";
import { useMateriaCatalogoSocietario } from "@/hooks/useMesaControlSocietaria";
import { usePactosVigentes } from "@/hooks/usePactosParasociales";
import { usePlantillasProtegidas } from "@/hooks/usePlantillasProtegidas";
import { useRulePacksForEntity } from "@/hooks/useRulePacks";
import { useSociedades } from "@/hooks/useSociedades";
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
  MINIMUM_TEMPLATE_STAGES,
  majorityLabel,
  matterComplexityLabel,
  normativeRoleFromAppRole,
  overrideApplicaAMateria,
  pactoApplicaAMateria,
  plazoLabel,
  resolveMateriaAlias,
  templateBindingDisplayLabel,
  type MateriaGlobalStatusResult,
  type TemplateDocumentBinding,
  type TemplateDocumentStage,
} from "@/lib/secretaria/mesa-control-societaria";
import type { MateriaCatalogRow } from "@/hooks/useMateriaConfig";
import type { RuleParamOverrideRow } from "@/hooks/useRulePacks";
import type { PactoParasocial } from "@/lib/rules-engine/pactos-engine";

const COMPLEXITY_CLASS: Record<string, string> = {
  Ordinaria: "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  Reforzada: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  Estructural: "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  Especial: "bg-[var(--status-info)] text-[var(--g-text-inverse)]",
  Informativa: "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
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
  lista: { shortLabel: "Lista", dotClass: "bg-[var(--status-success)]" },
  advertencia: { shortLabel: "Advertencia", dotClass: "bg-[var(--status-warning)]" },
  revision_legal: { shortLabel: "Revisión legal", dotClass: "bg-[var(--status-info)]" },
  bloqueada: { shortLabel: "Bloqueada", dotClass: "bg-[var(--status-error)]" },
};

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

function materiaCatalogUrl(input: {
  materia?: string | null;
  entityId?: string | null;
  vista?: EngineWorkspaceTab;
}) {
  const params = new URLSearchParams();
  if (input.entityId) params.set("entity", input.entityId);
  if (input.materia) params.set("materia", input.materia);
  if (input.vista) params.set("vista", input.vista);
  const query = params.toString();
  return `/secretaria/catalogo-materias${query ? `?${query}` : ""}`;
}

export default function CatalogoMaterias() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: sociedades = [] } = useSociedades();
  const selectedEntityId = searchParams.get("entity") ?? sociedades[0]?.id ?? "";
  const selectedSociedad = sociedades.find((sociedad) => sociedad.id === selectedEntityId) ?? null;
  const materiasQuery = useMateriaCatalogoSocietario();
  const { data: ruleData } = useRulePacksForEntity(selectedEntityId || undefined);
  const { data: pactos = [] } = usePactosVigentes(selectedEntityId || undefined);
  const { data: plantillas = [] } = usePlantillasProtegidas();
  const { primaryRole } = useCurrentUserRole();
  const normativeRole = normativeRoleFromAppRole(primaryRole);

  const materias = useMemo(
    () => buildMateriaCatalogRows(materiasQuery.data ?? []),
    [materiasQuery.data],
  );
  const [localSelected, setLocalSelected] = useState<string>("");
  const selectedMatterCode =
    resolveMateriaAlias(searchParams.get("materia") || localSelected) || materias[0]?.materia || "";
  const selectedMatter = materias.find((materia) => materia.materia === selectedMatterCode) ?? materias[0] ?? null;
  const workspaceTabParam = searchParams.get("vista");
  const activeWorkspaceTab: EngineWorkspaceTab = isEngineWorkspaceTab(workspaceTabParam)
    ? workspaceTabParam
    : "resumen";
  const matrixRows = useMemo(
    () => buildNormativeMatrixRows(materias, {
      tipoSocial: selectedSociedad?.tipo_social ?? selectedSociedad?.legal_form,
      overrides: ruleData?.overrides ?? [],
      pactos,
    }),
    [materias, pactos, ruleData?.overrides, selectedSociedad?.legal_form, selectedSociedad?.tipo_social],
  );
  const selectedMatrixRow = matrixRows.find((row) => row.materia === selectedMatter?.materia);
  const templateBindings = useMemo(
    () =>
      selectedMatter
        ? buildTemplateDocumentBindings(plantillas, {
            materia: selectedMatter.materia,
            jurisdiction: selectedSociedad?.jurisdiction,
            tipoSocial: selectedSociedad?.tipo_social,
          })
        : [],
    [plantillas, selectedMatter, selectedSociedad?.jurisdiction, selectedSociedad?.tipo_social],
  );
  const selectedTemplateReadiness = useMemo(
    () => (selectedMatter ? evaluateTemplateReadiness(templateBindings) : null),
    [selectedMatter, templateBindings],
  );
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
      const bindings = buildTemplateDocumentBindings(plantillas, {
        materia: materia.materia,
        jurisdiction: selectedSociedad?.jurisdiction,
        tipoSocial: selectedSociedad?.tipo_social,
      });
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
          templateReadiness: evaluateTemplateReadiness(bindings),
          conflictOfLaws: materiaConflict,
          legalReference: materia.referencia_legal,
          applicablePactosCount: pactos.filter((pacto) => pactoApplicaAMateria(pacto, materia.materia)).length,
          informativa: getMateriaFunctionalGroup(materia.materia).complexity === "informativa",
        }),
      );
    }
    return map;
  }, [materias, pactos, plantillas, ruleData?.packs, selectedSociedad]);
  const selectedMatterStatus = selectedMatter ? statusByMateria.get(selectedMatter.materia) ?? null : null;

  function handleSociedadChange(next: string) {
    const params = new URLSearchParams(searchParams);
    if (next) params.set("entity", next);
    else params.delete("entity");
    setSearchParams(params, { replace: true });
  }

  function handleMateriaSelect(materia: string) {
    setLocalSelected(materia);
    const params = new URLSearchParams(searchParams);
    params.set("materia", materia);
    if (!isEngineWorkspaceTab(params.get("vista"))) params.set("vista", "resumen");
    if (selectedEntityId) params.set("entity", selectedEntityId);
    setSearchParams(params, { replace: true });
  }

  function handleWorkspaceTabChange(tab: EngineWorkspaceTab) {
    const params = new URLSearchParams(searchParams);
    params.set("vista", tab);
    if (selectedMatter?.materia) params.set("materia", selectedMatter.materia);
    if (selectedEntityId) params.set("entity", selectedEntityId);
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
            Materias, requisitos y documentos
          </h1>
          <p className="mt-1 max-w-4xl text-sm leading-6 text-[var(--g-text-secondary)]">
            Consulta qué puede tratar o acordar una sociedad, qué exige la ley, qué añaden sus
            estatutos, qué pactos aplican y qué documentos se generarán en cada fase.
          </p>
          {selectedSociedad ? (
            <p className="mt-2 text-xs text-[var(--g-text-secondary)]">
              {selectedSociedad.common_name ?? selectedSociedad.legal_name} · Jurisdicción{" "}
              {selectedSociedad.jurisdiction ?? "no informada"} · Forma{" "}
              {displaySocietyLegalForm({
                jurisdiction: selectedSociedad.jurisdiction,
                tipoSocial: selectedSociedad.tipo_social,
                legalForm: selectedSociedad.legal_form,
              })}
            </p>
          ) : null}
        </div>

        <label className="min-w-[280px] text-xs font-semibold uppercase tracking-wider text-[var(--g-text-primary)]">
          Sociedad
          <select
            value={selectedEntityId}
            onChange={(event) => handleSociedadChange(event.target.value)}
            className="mt-1 w-full border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-3 py-2 text-sm font-normal normal-case tracking-normal text-[var(--g-text-primary)] focus:border-[var(--g-brand-3308)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
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

      {conflictOfLaws?.conflict_of_laws_flag ? (
        <div
          className="mb-6 border border-[var(--status-error)] bg-[var(--g-surface-card)] p-4"
          role="alert"
          style={{ borderRadius: "var(--g-radius-lg)" }}
        >
          <div className="text-sm font-semibold text-[var(--status-error)]">
            Posible conflicto de ley aplicable
          </div>
          <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
            {conflictOfLaws.explanation} Ley esperada: {conflictOfLaws.expectedLawLabel}. Ley aplicada:{" "}
            {conflictOfLaws.appliedLawLabel}.
          </p>
        </div>
      ) : null}

      <EngineConfigSummary
        selectedMatter={selectedMatter}
        selectedMatrixRow={selectedMatrixRow}
        templateReadiness={selectedTemplateReadiness}
        selectedStatus={selectedMatterStatus}
        entityId={selectedEntityId}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_480px]">
        <section className="space-y-5">
          <NatureLegend />
          {FUNCTIONAL_MATTER_GROUPS.map((group) => {
            const rows = materias.filter((materia) => getMateriaFunctionalGroup(materia.materia).id === group.id);
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
                  {rows.map((materia) => {
                    const selected = materia.materia === selectedMatter?.materia;
                    const complexity = matterComplexityLabel(materia);
                    const status = statusByMateria.get(materia.materia);
                    const indicator = status ? MATERIA_STATUS_INDICATOR[status.status] : null;
                    return (
                      <button
                        key={materia.materia}
                        type="button"
                        onClick={() => handleMateriaSelect(materia.materia)}
                        className={`border bg-[var(--g-surface-card)] p-4 text-left transition-colors hover:bg-[var(--g-surface-subtle)] ${
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
                          </div>
                          <span
                            className={`shrink-0 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${COMPLEXITY_CLASS[complexity]}`}
                            style={{ borderRadius: "var(--g-radius-full)" }}
                            title={COMPLEXITY_LEGEND[complexity]}
                          >
                            {complexity}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-[var(--g-text-secondary)]">
                          {materia.requires_notary ? <Chip label="Escritura pública" /> : null}
                          {materia.requires_registry || materia.inscribable ? <Chip label="Inscripción" /> : null}
                          {materia.publication_required ? <Chip label="Publicación" /> : null}
                          {!materia.requires_notary && !materia.requires_registry && !materia.publication_required ? (
                            <Chip label={getMateriaFunctionalGroup(materia.materia).complexity === "informativa" ? "Constancia" : "Archivo interno"} />
                          ) : null}
                          {indicator && status ? (
                            <span
                              className="ml-auto inline-flex items-center gap-1.5 font-semibold text-[var(--g-text-primary)]"
                              title={status.label}
                            >
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
        </section>

        <aside className="xl:sticky xl:top-4 xl:self-start">
          {selectedMatter ? (
            <MateriaDetail
              materia={selectedMatter}
              selectedSociedadName={selectedSociedad?.common_name ?? selectedSociedad?.legal_name ?? null}
              matrixRow={selectedMatrixRow}
              templateBindings={templateBindings}
              overrides={ruleData?.overrides ?? []}
              pactos={pactos}
              entityId={selectedEntityId}
              conflictOfLaws={conflictOfLaws}
              globalStatus={selectedMatterStatus}
              normativeRole={normativeRole}
              activeTab={activeWorkspaceTab}
              onTabChange={handleWorkspaceTabChange}
            />
          ) : (
            <div className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-6 text-sm text-[var(--g-text-secondary)]" style={{ borderRadius: "var(--g-radius-lg)" }}>
              Cargando catálogo de materias…
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function MateriaDetail({
  materia,
  selectedSociedadName,
  matrixRow,
  templateBindings,
  overrides,
  pactos,
  entityId,
  conflictOfLaws,
  globalStatus,
  normativeRole,
  activeTab,
  onTabChange,
}: {
  materia: MateriaCatalogRow;
  selectedSociedadName: string | null;
  matrixRow: ReturnType<typeof buildNormativeMatrixRows>[number] | undefined;
  templateBindings: ReturnType<typeof buildTemplateDocumentBindings>;
  overrides: RuleParamOverrideRow[];
  pactos: PactoParasocial[];
  entityId: string;
  conflictOfLaws: ReturnType<typeof detectConflictOfLaws> | null;
  globalStatus: MateriaGlobalStatusResult | null;
  normativeRole: ReturnType<typeof normativeRoleFromAppRole>;
  activeTab: EngineWorkspaceTab;
  onTabChange: (tab: EngineWorkspaceTab) => void;
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
  const templateReadiness = evaluateTemplateReadiness(templateBindings);
  const assignTemplateDecision = canPerformNormativeAction(normativeRole, "assign_template");
  const blockedEvent = !templateReadiness.canStartCase
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
          </div>
          <Scale className="h-5 w-5 text-[var(--g-brand-3308)]" />
        </div>
        {globalStatus ? (
          <div className="mt-3 border-t border-[var(--g-border-subtle)] pt-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-[var(--g-text-primary)]">{globalStatus.label}</span>
              <StatusPill
                label={MATERIA_STATUS_INDICATOR[globalStatus.status].shortLabel}
                tone={
                  globalStatus.status === "bloqueada"
                    ? "block"
                    : globalStatus.status === "lista"
                      ? "ok"
                      : globalStatus.status === "revision_legal"
                        ? "info"
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
                onTabChange={onTabChange}
              />
            </div>
          </div>
        ) : null}
      </div>

      <EngineWorkspaceTabs activeTab={activeTab} onTabChange={onTabChange} />

      {activeTab === "resumen" ? (
        <MateriaSummaryTab
          materia={materia}
          matrixRow={matrixRow}
          templateReadiness={templateReadiness}
          selectedSociedadName={selectedSociedadName}
          applicableOverrides={applicableOverrides}
          entityHasEstatutosOverrides={entityHasEstatutosOverrides}
          applicablePactos={applicablePactos}
          globalStatus={globalStatus}
          entityId={entityId}
          onTabChange={onTabChange}
        />
      ) : null}

      {activeTab === "regla" ? (
        <MateriaRuleTab
          materia={materia}
          matrixRow={matrixRow}
          entityId={entityId}
          sourceChips={sourceChips}
          conflictOfLaws={conflictOfLaws}
        />
      ) : null}

      {activeTab === "plantillas" ? (
        <MateriaTemplatesTab
          materia={materia}
          templateBindings={templateBindings}
          templateReadiness={templateReadiness}
          assignTemplateAllowed={assignTemplateDecision.allowed}
          entityId={entityId}
        />
      ) : null}

      {activeTab === "fuentes" ? (
        <MateriaSourcesTab
          materia={materia}
          applicableOverrides={applicableOverrides}
          applicablePactos={applicablePactos}
          sourceChips={sourceChips}
          conflictOfLaws={conflictOfLaws}
        />
      ) : null}

      {activeTab === "simular" ? (
        <MateriaSimulationTab
          materia={materia}
          matrixRow={matrixRow}
          templateReadiness={templateReadiness}
          conflictOfLaws={conflictOfLaws}
          sourceChips={sourceChips}
          entityId={entityId}
          blockedTelemetryPrepared={Boolean(blockedTelemetry)}
        />
      ) : null}
    </div>
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
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onTabChange(tab.id)}
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

function MateriaSummaryTab({
  materia,
  matrixRow,
  templateReadiness,
  selectedSociedadName,
  applicableOverrides,
  entityHasEstatutosOverrides,
  applicablePactos,
  globalStatus,
  entityId,
  onTabChange,
}: {
  materia: MateriaCatalogRow;
  matrixRow: ReturnType<typeof buildNormativeMatrixRows>[number] | undefined;
  templateReadiness: ReturnType<typeof evaluateTemplateReadiness>;
  selectedSociedadName: string | null;
  applicableOverrides: RuleParamOverrideRow[];
  entityHasEstatutosOverrides: boolean;
  applicablePactos: PactoParasocial[];
  globalStatus: MateriaGlobalStatusResult | null;
  entityId: string;
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
            detail={`${matrixRow?.organo ?? "Órgano pendiente"} · ${matrixRow?.mayoria ?? majorityLabel(materia.min_majority_code)}`}
            status={matrixRow ? "cumplido" : "pendiente"}
          />
          <EnginePathStep
            step="3"
            title="Documentos"
            detail={templateReadiness.canStartCase ? "Plantillas mínimas disponibles" : templateReadiness.blockingMessage ?? "Revisión documental pendiente"}
            status={templateReadiness.canStartCase ? "cumplido" : "bloqueante"}
          />
          <EnginePathStep
            step="4"
            title="Verificación previa"
            detail="Comprueba los requisitos antes de abrir la tramitación"
            status={templateReadiness.canStartCase ? "cumplido" : "pendiente"}
          />
          <EnginePathStep
            step="5"
            title="Expediente"
            detail={templateReadiness.canStartCase ? "Listo para iniciar expediente" : "Salida bloqueada hasta completar la configuración"}
            status={templateReadiness.canStartCase ? "cumplido" : "bloqueante"}
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
  onTabChange,
}: {
  status: MateriaGlobalStatusResult;
  materia: MateriaCatalogRow;
  entityId: string;
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
      to={`/secretaria/tramitador/nuevo?materia=${materia.materia}${entityId ? `&entity=${entityId}` : ""}`}
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
  entityId,
  sourceChips,
  conflictOfLaws,
}: {
  materia: MateriaCatalogRow;
  matrixRow: ReturnType<typeof buildNormativeMatrixRows>[number] | undefined;
  entityId: string;
  sourceChips: ReturnType<typeof buildSourceChipsForMateria>;
  conflictOfLaws: ReturnType<typeof detectConflictOfLaws> | null;
}) {
  return (
    <DetailSection icon={CheckCircle2} title="Regla aplicable para esta sociedad">
      <p className="mb-4 text-sm leading-6 text-[var(--g-text-secondary)]">
        Esta es la regla que se aplica cuando una convocatoria, acuerdo o expediente declara esta materia.
      </p>
      <div className="grid grid-cols-1 gap-2 text-sm">
        <KeyValue
          label="Órgano competente"
          value={matrixRow?.organo ?? "Pendiente"}
          action={
            entityId ? (
              <Link
                to={`/secretaria/catalogo-organos?entity=${entityId}&matter=${materia.materia}`}
                className="text-xs font-semibold text-[var(--g-brand-3308)] hover:text-[var(--g-sec-700)]"
              >
                Ver órgano
              </Link>
            ) : null
          }
        />
        <KeyValue label="Mayoría requerida" value={matrixRow?.mayoria ?? majorityLabel(materia.min_majority_code)} />
        <KeyValue label="Quórum" value={matrixRow?.quorum ?? "Según ley y estatutos"} />
        <KeyValue label="Documentos obligatorios" value={matrixRow?.documentos ?? documentRequirements(materia).join(", ")} />
        <KeyValue label="Plazos" value={plazoLabel(materia)} />
        <KeyValue label="Fuente determinante" value={matrixRow?.fuente ?? "Ley"} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {sourceChips.map((chip) => (
          <SourceChip key={`${chip.type}-${chip.reference}`} chip={chip} />
        ))}
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
}: {
  materia: MateriaCatalogRow;
  templateBindings: ReturnType<typeof buildTemplateDocumentBindings>;
  templateReadiness: ReturnType<typeof evaluateTemplateReadiness>;
  assignTemplateAllowed: boolean;
  entityId: string;
}) {
  return (
    <div className="space-y-4">
      <DetailSection icon={FileText} title="Documentos y plantillas de esta materia">
        <p className="mb-4 text-sm leading-6 text-[var(--g-text-secondary)]">
          La comprobación documental previa verifica que las fases mínimas tengan plantilla activa
          antes de habilitar el expediente.
        </p>
        <div className="space-y-3">
          {TEMPLATE_DOCUMENT_STAGES.map((stage) => (
            <TemplateStageCard
              key={stage}
              stage={stage}
              materia={materia}
              bindings={templateBindings.filter((binding) => binding.stage === stage)}
              readiness={templateReadiness.items.find((item) => item.stage === stage)}
              assignTemplateAllowed={assignTemplateAllowed}
            />
          ))}
        </div>
      </DetailSection>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Link
          to={`/secretaria/plantillas?materia=${materia.materia}${entityId ? `&entity=${entityId}` : ""}`}
          className="inline-flex flex-1 items-center justify-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm font-semibold text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          Ver en catálogo de plantillas <Settings2 className="h-4 w-4" aria-hidden="true" />
        </Link>
        <Link
          to={`/secretaria/gestor-plantillas?tab=catalogo&materia=${materia.materia}`}
          className="inline-flex flex-1 items-center justify-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm font-semibold text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          Administrar plantillas <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

function TemplateStageCard({
  stage,
  materia,
  bindings,
  readiness,
  assignTemplateAllowed,
}: {
  stage: TemplateDocumentStage;
  materia: MateriaCatalogRow;
  bindings: ReturnType<typeof buildTemplateDocumentBindings>;
  readiness: ReturnType<typeof evaluateTemplateReadiness>["items"][number] | undefined;
  assignTemplateAllowed: boolean;
}) {
  const activeBindings = bindings.filter((binding) => binding.template.estado === "ACTIVA");
  const candidateBindings = bindings.filter((binding) => binding.template.estado !== "ACTIVA");
  const displayGroups = groupStageBindingsForDisplay(activeBindings);
  const currentBindings = displayGroups.map((group) => group.current);
  const dataDuplicates = detectTemplateDataDuplicates(activeBindings);
  const minimum = MINIMUM_TEMPLATE_STAGES.includes(stage);
  return (
    <div
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-3"
      style={{ borderRadius: "var(--g-radius-md)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-primary)]">{stage}</div>
          <div className="mt-0.5 text-[11px] text-[var(--g-text-secondary)]">
            {minimum ? "Fase mínima para abrir expediente" : "Fase de soporte o post-acuerdo"}
          </div>
        </div>
        <StatusPill
          label={readiness?.status === "faltante" ? "Faltante" : readiness?.status === "pendiente_revision" ? "Pendiente revisión" : "Activa"}
          tone={readiness?.blocking ? "block" : readiness?.status === "activa" ? "ok" : "warn"}
        />
      </div>

      {dataDuplicates.length > 0 ? (
        <div
          className="mt-3 border border-[var(--status-warning)] bg-[var(--g-surface-card)] p-2 text-xs text-[var(--g-text-secondary)]"
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
        <ul className="mt-3 space-y-2">
          {displayGroups.map((group) => (
            <li key={group.current.template.id}>
              <TemplateBindingItem
                binding={group.current}
                siblings={currentBindings}
                label="Vigente para nuevos expedientes"
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
                        <TemplateBindingItem binding={binding} siblings={group.older} label="Versión anterior" />
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
        <div className="mt-3 border-t border-[var(--g-border-subtle)] pt-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
            Plantillas candidatas
          </div>
          <ul className="mt-2 space-y-2">
            {candidateBindings.slice(0, 2).map((binding) => (
              <li key={binding.template.id}>
                <TemplateBindingItem binding={binding} siblings={candidateBindings} label="Candidata" />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {bindings.length === 0 ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-[var(--g-text-secondary)]">
            {minimum ? "Falta una plantilla mínima para que el motor habilite el expediente." : "No hay plantilla asociada a esta fase."}
          </p>
          {assignTemplateAllowed ? (
            <div className="flex flex-wrap gap-2">
              <Link
                to={`/secretaria/plantillas?tipo=${encodeURIComponent(stage)}&materia=${materia.materia}`}
                className="inline-flex items-center justify-center border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-2 py-1 text-xs font-semibold text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
                style={{ borderRadius: "var(--g-radius-sm)" }}
              >
                Asignar plantilla
              </Link>
              <Link
                to={`/secretaria/gestor-plantillas?tab=catalogo&materia=${materia.materia}`}
                className="inline-flex items-center justify-center border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-2 py-1 text-xs font-semibold text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
                style={{ borderRadius: "var(--g-radius-sm)" }}
              >
                Crear desde modelo
              </Link>
            </div>
          ) : (
            <div className="text-xs font-semibold text-[var(--g-text-secondary)]">Solicitar edición</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function TemplateBindingItem({
  binding,
  siblings,
  label,
}: {
  binding: TemplateDocumentBinding;
  siblings: TemplateDocumentBinding[];
  label: string;
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
            Variables automáticas {binding.automaticVariablesValid ? "válidas" : "pendientes"} · campos editables pendientes: {binding.editableFieldsPending}
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
          to={`/secretaria/gestor-plantillas?tab=catalogo&plantilla=${binding.template.id}`}
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
  sourceChips,
  conflictOfLaws,
}: {
  materia: MateriaCatalogRow;
  applicableOverrides: RuleParamOverrideRow[];
  applicablePactos: PactoParasocial[];
  sourceChips: ReturnType<typeof buildSourceChipsForMateria>;
  conflictOfLaws: ReturnType<typeof detectConflictOfLaws> | null;
}) {
  return (
    <div className="space-y-4">
      <DetailSection icon={Layers} title="Fuente determinante y fuentes revisadas">
        <p className="mb-3 text-sm leading-6 text-[var(--g-text-secondary)]">
          La regla aplicable se compone de ley, estatutos, reglamento, pactos y overrides documentales.
        </p>
        <div className="flex flex-wrap gap-2">
          {sourceChips.map((chip) => (
            <SourceChip key={`${chip.type}-${chip.reference}`} chip={chip} />
          ))}
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
            No hay overrides publicados. La regla efectiva queda en el mínimo legal aplicable.
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
  templateReadiness,
  conflictOfLaws,
  sourceChips,
  entityId,
  blockedTelemetryPrepared,
}: {
  materia: MateriaCatalogRow;
  matrixRow: ReturnType<typeof buildNormativeMatrixRows>[number] | undefined;
  templateReadiness: ReturnType<typeof evaluateTemplateReadiness>;
  conflictOfLaws: ReturnType<typeof detectConflictOfLaws> | null;
  sourceChips: ReturnType<typeof buildSourceChipsForMateria>;
  entityId: string;
  blockedTelemetryPrepared: boolean;
}) {
  const conflict = Boolean(conflictOfLaws?.conflict_of_laws_flag);
  const outcome = !templateReadiness.canStartCase
    ? {
        label: "Bloqueado",
        detail: templateReadiness.blockingMessage ?? "Falta configuración documental mínima.",
        tone: "block" as const,
      }
    : conflict
      ? {
          label: "Revisión requerida",
          detail: "Hay conflicto de ley aplicable antes de abrir expediente.",
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
            label="Regla aplicable resuelta"
            detail={`${matrixRow?.organo ?? "Órgano pendiente"} · ${matrixRow?.mayoria ?? majorityLabel(materia.min_majority_code)}`}
            state={matrixRow ? "cumplido" : "pendiente"}
          />
          <PreflightRow
            label="Fuentes jurídicas"
            detail={sourceChips.map((chip) => chip.type).join(", ")}
            state={conflict ? "bloqueante" : "cumplido"}
          />
          <PreflightRow
            label="Plantillas mínimas"
            detail={templateReadiness.blockingMessage ?? "Modelo de acuerdo, acta y certificación disponibles"}
            state={templateReadiness.canStartCase ? "cumplido" : "bloqueante"}
          />
          <PreflightRow
            label="Formalización posterior"
            detail={`${materia.requires_notary ? "Elevación a público" : "Sin notaría configurada"} · ${materia.requires_registry || materia.inscribable ? "inscripción registral" : "archivo interno"}`}
            state="cumplido"
          />
        </div>
      </DetailSection>

      {!templateReadiness.canStartCase ? (
        <div
          className="border border-[var(--status-error)] bg-[var(--g-surface-card)] p-3 text-sm text-[var(--g-text-secondary)]"
          role="alert"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <strong className="text-[var(--status-error)]">Expediente bloqueado.</strong>{" "}
          {templateReadiness.blockingMessage}
          {blockedTelemetryPrepared ? (
            <span className="mt-1 block text-xs">
              Trazabilidad preparada para el bloqueo del expediente.
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        {templateReadiness.canStartCase && !conflict ? (
          <Link
            to={`/secretaria/tramitador/nuevo?materia=${materia.materia}${entityId ? `&entity=${entityId}` : ""}`}
            className="inline-flex flex-1 items-center justify-center gap-2 bg-[var(--g-brand-3308)] px-3 py-2 text-sm font-semibold text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Iniciar expediente <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : (
          <span
            aria-disabled="true"
            aria-label="No se puede iniciar expediente porque la verificación previa requiere revisión"
            className="inline-flex flex-1 items-center justify-center gap-2 bg-[var(--g-surface-muted)] px-3 py-2 text-sm font-semibold text-[var(--g-text-secondary)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Iniciar expediente bloqueado
          </span>
        )}
        <Link
          to={materiaCatalogUrl({ materia: materia.materia, entityId, vista: "plantillas" })}
          className="inline-flex flex-1 items-center justify-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm font-semibold text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          Revisar configuración <ListChecks className="h-4 w-4" aria-hidden="true" />
        </Link>
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
            ? "bg-[var(--status-error)] text-[var(--g-text-inverse)]"
            : status === "pendiente"
              ? "bg-[var(--status-warning)] text-[var(--g-text-inverse)]"
              : "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
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
  state: "cumplido" | "pendiente" | "bloqueante";
}) {
  const icon =
    state === "bloqueante" ? (
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-error)]" aria-hidden="true" />
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
      <strong className="text-[var(--status-error)]">Conflicto jurisdiccional:</strong>{" "}
      {conflictOfLaws.explanation}
    </div>
  );
}

function EngineConfigSummary({
  selectedMatter,
  selectedMatrixRow,
  templateReadiness,
  selectedStatus,
  entityId,
}: {
  selectedMatter: MateriaCatalogRow | null;
  selectedMatrixRow: ReturnType<typeof buildNormativeMatrixRows>[number] | undefined;
  templateReadiness: ReturnType<typeof evaluateTemplateReadiness> | null;
  selectedStatus: MateriaGlobalStatusResult | null;
  entityId: string;
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
        <Link
          to={selectedMatter ? materiaCatalogUrl({ materia: selectedMatter.materia, entityId, vista: "plantillas" }) : "/secretaria/catalogo-materias?vista=plantillas"}
          className="inline-flex items-center justify-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-xs font-semibold text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          Ver documentos y plantillas de esta materia <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
      <ol className="mt-4 grid grid-cols-1 gap-2 text-xs text-[var(--g-text-secondary)] md:grid-cols-5">
        {["Materia", "Regla aplicable", "Documentos", "Verificación previa", "Expediente"].map((step, index) => (
          <li
            key={step}
            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <span className="font-semibold text-[var(--g-brand-3308)]">{index + 1}.</span>{" "}
            <span className="font-semibold text-[var(--g-text-primary)]">{step}</span>
          </li>
        ))}
      </ol>
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
          value={selectedMatrixRow?.mayoria ?? "Pendiente"}
          detail={selectedMatrixRow?.fuente ?? "Ley por defecto"}
        />
        <EngineConfigMetric
          icon={FileText}
          label="Preparación documental"
          value={templateReadiness?.canStartCase ? "Completa" : "Bloqueante"}
          detail={templateReadiness?.blockingMessage ?? "Comprobación documental previa superada"}
        />
        <EngineConfigMetric
          icon={ShieldCheck}
          label="Resultado de la verificación"
          value={selectedStatus?.label ?? (templateReadiness?.canStartCase ? "Listo para iniciar expediente" : "Bloqueado")}
          detail={selectedStatus?.explanation ?? "La verificación se realiza antes de abrir el flujo operativo"}
        />
      </dl>
    </section>
  );
}

function NatureLegend() {
  return (
    <div
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-3"
      style={{ borderRadius: "var(--g-radius-lg)" }}
    >
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
        Naturaleza de las materias
      </div>
      <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-[var(--g-text-secondary)] sm:grid-cols-2 xl:grid-cols-3">
        {Object.entries(COMPLEXITY_LEGEND).map(([term, explanation]) => (
          <div key={term} className="flex items-baseline gap-2">
            <dt className="flex shrink-0 items-center gap-1.5 font-semibold text-[var(--g-text-primary)]">
              <span
                aria-hidden="true"
                className={`inline-block h-2 w-2 ${COMPLEXITY_CLASS[term] ?? ""}`}
                style={{ borderRadius: "var(--g-radius-full)" }}
              />
              {term}
            </dt>
            <dd>{explanation}</dd>
          </div>
        ))}
      </dl>
    </div>
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
    <div className="grid grid-cols-[150px_minmax(0,1fr)] gap-3 border-b border-[var(--g-border-subtle)] pb-2 last:border-b-0 last:pb-0">
      <div className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">{label}</div>
      <div className="flex items-center justify-between gap-2 text-sm text-[var(--g-text-primary)]">
        <span>{value}</span>
        {action}
      </div>
    </div>
  );
}

function SourceChip({ chip }: { chip: ReturnType<typeof buildSourceChipsForMateria>[number] }) {
  return (
    <span
      className="inline-flex max-w-full items-center gap-1.5 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-2 py-1 text-[11px] text-[var(--g-text-primary)]"
      style={{ borderRadius: "var(--g-radius-full)" }}
      title={`${chip.reference} · ${chip.version} · ${chip.validationState}`}
    >
      <span className="shrink-0 font-semibold">{chip.type}</span>
      <span aria-hidden="true">·</span>
      <span className="truncate">{chip.reference}</span>
      <span className="shrink-0 text-[var(--g-text-secondary)]">({chip.validationState})</span>
    </span>
  );
}

function StatusPill({ label, tone }: { label: string; tone: "ok" | "warn" | "block" | "info" }) {
  const cls =
    tone === "ok"
      ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
      : tone === "block"
        ? "bg-[var(--status-error)] text-[var(--g-text-inverse)]"
        : tone === "info"
          ? "bg-[var(--status-info)] text-[var(--g-text-inverse)]"
          : "bg-[var(--status-warning)] text-[var(--g-text-inverse)]";
  return (
    <span className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls}`} style={{ borderRadius: "var(--g-radius-full)" }}>
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
