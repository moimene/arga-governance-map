import { useMemo, useState, type ElementType, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  FileText,
  Landmark,
  Layers,
  Scale,
  ScrollText,
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
  displaySocietyLegalForm,
  documentRequirements,
  evaluateTemplateReadiness,
  getMateriaFunctionalGroup,
  majorityLabel,
  matterComplexityLabel,
  normativeRoleFromAppRole,
  plazoLabel,
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

const DOCUMENT_TYPE_LABEL: Record<string, string> = {
  INFORME_PRECEPTIVO: "Informe preceptivo",
  INFORME_DOCUMENTAL_PRE: "Expediente previo",
  CONVOCATORIA: "Convocatoria",
  CONVOCATORIA_SL_NOTIFICACION: "Notificación individual",
  MODELO_ACUERDO: "Modelo de acuerdo",
  ACTA_SESION: "Acta de sesión",
  ACTA_ACUERDO_ESCRITO: "Acta de acuerdo escrito",
  ACTA_CONSIGNACION: "Acta de consignación",
  ACTA_DECISION_CONJUNTA: "Acta de decisión conjunta",
  ACTA_ORGANO_ADMIN: "Acta de órgano de administración",
  CERTIFICACION: "Certificación",
  DOCUMENTO_REGISTRAL: "Documento registral",
  SUBSANACION_REGISTRAL: "Subsanación registral",
};

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
  const selectedMatterCode = searchParams.get("materia") || localSelected || materias[0]?.materia || "";
  const selectedMatter = materias.find((materia) => materia.materia === selectedMatterCode) ?? materias[0] ?? null;
  const matrixRows = useMemo(
    () => buildNormativeMatrixRows(materias, {
      tipoSocial: selectedSociedad?.tipo_social ?? selectedSociedad?.legal_form,
      overrides: ruleData?.overrides ?? [],
      pactos,
    }),
    [materias, pactos, ruleData?.overrides, selectedSociedad?.legal_form, selectedSociedad?.tipo_social],
  );
  const selectedMatrixRow = matrixRows.find((row) => row.materia === selectedMatter?.materia);
  const templateBindings = selectedMatter
    ? buildTemplateDocumentBindings(plantillas, {
        materia: selectedMatter.materia,
        jurisdiction: selectedSociedad?.jurisdiction,
        tipoSocial: selectedSociedad?.tipo_social,
      })
    : [];
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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_480px]">
        <section className="space-y-5">
          {FUNCTIONAL_MATTER_GROUPS.map((group) => {
            const rows = materias.filter((materia) => getMateriaFunctionalGroup(materia.materia).id === group.id);
            if (rows.length === 0) return null;
            return (
              <div key={group.id} className="space-y-3">
                <div>
                  <h2 className="text-base font-semibold text-[var(--g-text-primary)]">{group.title}</h2>
                  <p className="mt-1 text-sm text-[var(--g-text-secondary)]">{group.description}</p>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {rows.map((materia) => {
                    const selected = materia.materia === selectedMatter?.materia;
                    const complexity = matterComplexityLabel(materia);
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
                          >
                            {complexity}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[var(--g-text-secondary)]">
                          {materia.requires_notary ? <Chip label="Escritura pública" /> : null}
                          {materia.requires_registry || materia.inscribable ? <Chip label="Inscripción" /> : null}
                          {materia.publication_required ? <Chip label="Publicación" /> : null}
                          {!materia.requires_notary && !materia.requires_registry && !materia.publication_required ? (
                            <Chip label={getMateriaFunctionalGroup(materia.materia).complexity === "informativa" ? "Constancia" : "Archivo interno"} />
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
              normativeRole={normativeRole}
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
  normativeRole,
}: {
  materia: MateriaCatalogRow;
  selectedSociedadName: string | null;
  matrixRow: ReturnType<typeof buildNormativeMatrixRows>[number] | undefined;
  templateBindings: ReturnType<typeof buildTemplateDocumentBindings>;
  overrides: RuleParamOverrideRow[];
  pactos: PactoParasocial[];
  entityId: string;
  conflictOfLaws: ReturnType<typeof detectConflictOfLaws> | null;
  normativeRole: ReturnType<typeof normativeRoleFromAppRole>;
}) {
  const group = getMateriaFunctionalGroup(materia.materia);
  const applicableOverrides = overrides.filter((override) => override.materia === materia.materia);
  const applicablePactos = pactos.filter((pacto) => (pacto.materias_aplicables ?? []).includes(materia.materia));
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
              {selectedSociedadName ? `Regla efectiva para ${selectedSociedadName}.` : "Reglas legales por defecto; selecciona sociedad para ver estatutos y pactos."}
            </p>
          </div>
          <Scale className="h-5 w-5 text-[var(--g-brand-3308)]" />
        </div>
      </div>

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
        ) : (
          <p className="text-sm text-[var(--g-text-secondary)]">
            Estatutos no modelados para esta materia. Aplican reglas legales por defecto.
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

      <DetailSection icon={CheckCircle2} title="Regla efectiva para esta sociedad">
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
          <KeyValue label="Fuentes aplicadas" value={matrixRow?.fuente ?? "Ley"} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {sourceChips.map((chip) => (
            <SourceChip key={`${chip.type}-${chip.reference}`} chip={chip} />
          ))}
        </div>
        {conflictOfLaws?.conflict_of_laws_flag ? (
          <div className="mt-3 border border-[var(--status-error)] bg-[var(--g-surface-card)] p-3 text-xs text-[var(--g-text-secondary)]" style={{ borderRadius: "var(--g-radius-md)" }}>
            <strong className="text-[var(--status-error)]">Conflicto jurisdiccional:</strong>{" "}
            {conflictOfLaws.explanation}
          </div>
        ) : null}
      </DetailSection>

      <DetailSection icon={FileText} title="Documentos asociados">
        <div className="space-y-3">
          {TEMPLATE_DOCUMENT_STAGES.map((stage) => {
            const stageBindings = templateBindings.filter((binding) => binding.stage === stage);
            const readiness = templateReadiness.items.find((item) => item.stage === stage);
            return (
              <div key={stage} className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-3" style={{ borderRadius: "var(--g-radius-md)" }}>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-primary)]">{stage}</div>
                  <StatusPill label={readiness?.status === "faltante" ? "Faltante" : readiness?.status === "pendiente_revision" ? "Pendiente revisión" : "Activa"} tone={readiness?.blocking ? "block" : readiness?.status === "activa" ? "ok" : "warn"} />
                </div>
                {stageBindings.length === 0 ? (
                  <div className="mt-2 space-y-2">
                    <p className="text-xs text-[var(--g-text-secondary)]">Sin plantilla activa asociada.</p>
                    {assignTemplateDecision.allowed ? (
                      <div className="flex flex-wrap gap-2">
                        <Link
                          to={`/secretaria/plantillas?tipo=${encodeURIComponent(stage)}&materia=${materia.materia}`}
                          className="inline-flex items-center justify-center border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-2 py-1 text-xs font-semibold text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
                          style={{ borderRadius: "var(--g-radius-sm)" }}
                        >
                          Asignar plantilla
                        </Link>
                        <Link
                          to={`/secretaria/gestor-plantillas?materia=${materia.materia}`}
                          className="inline-flex items-center justify-center border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-2 py-1 text-xs font-semibold text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
                          style={{ borderRadius: "var(--g-radius-sm)" }}
                        >
                          Crear desde modelo
                        </Link>
                      </div>
                    ) : (
                      <div className="text-xs font-semibold text-[var(--g-text-secondary)]">
                        Solicitar edición
                      </div>
                    )}
                  </div>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {stageBindings.slice(0, 3).map((binding) => (
                      <li key={binding.template.id} className="text-xs text-[var(--g-text-secondary)]">
                        <div className="font-semibold text-[var(--g-text-primary)]">
                          {DOCUMENT_TYPE_LABEL[binding.template.tipo] ?? binding.template.tipo} · v{binding.template.version}
                        </div>
                        <div>{binding.statusLabel} · {binding.selectionReason}</div>
                        <div>
                          Variables automáticas {binding.automaticVariablesValid ? "válidas" : "pendientes"} · campos editables pendientes: {binding.editableFieldsPending}
                        </div>
                        <div className="mt-1">
                          <Link
                            to={`/secretaria/gestor-plantillas?plantilla=${binding.template.id}`}
                            className="font-semibold text-[var(--g-brand-3308)] hover:text-[var(--g-sec-700)]"
                          >
                            Probar fusión
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </DetailSection>

      <DetailSection icon={ClipboardList} title="Formalización posterior">
        <RequirementList
          items={[
            `Certificación → ${materia.requires_notary ? "elevación a público → " : ""}${materia.requires_registry || materia.inscribable ? "inscripción registral" : "archivo interno"}.`,
            `Dependencia de plazo: ${plazoLabel(materia)}.`,
            "Si el documento firmado ya existe con el mismo contenido, se reutiliza por hash coincidente.",
          ]}
        />
      </DetailSection>

      {!templateReadiness.canStartCase ? (
        <div
          className="border border-[var(--status-error)] bg-[var(--g-surface-card)] p-3 text-sm text-[var(--g-text-secondary)]"
          role="alert"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <strong className="text-[var(--status-error)]">Expediente bloqueado.</strong>{" "}
          {templateReadiness.blockingMessage}
          {blockedTelemetry ? (
            <span className="mt-1 block text-xs">
              Trazabilidad preparada para el bloqueo del expediente.
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        {templateReadiness.canStartCase ? (
          <Link
            to={`/secretaria/tramitador/nuevo?materia=${materia.materia}${entityId ? `&entity=${entityId}` : ""}`}
            className="inline-flex flex-1 items-center justify-center gap-2 bg-[var(--g-brand-3308)] px-3 py-2 text-sm font-semibold text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Iniciar expediente <ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <span
            aria-disabled="true"
            aria-label="No se puede iniciar expediente porque falta plantilla mínima"
            className="inline-flex flex-1 items-center justify-center gap-2 bg-[var(--g-surface-muted)] px-3 py-2 text-sm font-semibold text-[var(--g-text-secondary)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Iniciar expediente bloqueado
          </span>
        )}
        <Link
          to={`/secretaria/reglas?matter=${materia.materia}${entityId ? `&entity=${entityId}` : ""}`}
          className="inline-flex flex-1 items-center justify-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm font-semibold text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          Resolver mantenimiento <Layers className="h-4 w-4" />
        </Link>
      </div>
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
      className="inline-flex items-center gap-1 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-2 py-1 text-[11px] text-[var(--g-text-primary)]"
      style={{ borderRadius: "var(--g-radius-full)" }}
      title={`${chip.reference} · ${chip.version} · ${chip.validationState}`}
    >
      Fuente: {chip.type}
    </span>
  );
}

function StatusPill({ label, tone }: { label: string; tone: "ok" | "warn" | "block" }) {
  const cls =
    tone === "ok"
      ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
      : tone === "block"
        ? "bg-[var(--status-error)] text-[var(--g-text-inverse)]"
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
