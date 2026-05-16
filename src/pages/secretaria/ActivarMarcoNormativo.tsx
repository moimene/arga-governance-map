import { useMemo, useState, type ElementType, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  FileText,
  Landmark,
  Link2,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { useBodiesByEntity } from "@/hooks/useBodies";
import { useCurrentUserRole } from "@/hooks/useCurrentUser";
import { useMateriaCatalogoSocietario } from "@/hooks/useMesaControlSocietaria";
import {
  useAssignTemplateBinding,
  useMaterializeEffectiveRuleMatrix,
  usePublishStatuteVersion,
} from "@/hooks/useNormativeGovernance";
import { usePlantillasProtegidas } from "@/hooks/usePlantillasProtegidas";
import { useRuleManagerProfile } from "@/hooks/useRuleManager";
import { useSociedad } from "@/hooks/useSociedades";
import {
  buildFeatureFlagDecision,
  buildMateriaCatalogRows,
  buildNormativeAuditEvent,
  buildNormativeHistoryEntries,
  buildNormativeRolloutPlan,
  buildNormativeTelemetryEvent,
  buildP1A11yI18nContract,
  buildP1LegacyBackfillPlan,
  buildP1OperationalKpiContract,
  buildP1PerformanceBudgetContract,
  buildTemplateDocumentBindings,
  canPerformNormativeAction,
  detectConflictOfLaws,
  displaySocietyLegalForm,
  evaluateTemplateReadiness,
  normativeRoleFromAppRole,
  sanitizeBusinessLabel,
  type NormativeMaintenanceAction,
} from "@/lib/secretaria/mesa-control-societaria";

type WizardStepId = "diagnostico" | "regla" | "estatutos" | "clausulas" | "plantillas" | "publicacion";

const STEPS: Array<{ id: WizardStepId; label: string }> = [
  { id: "diagnostico", label: "Diagnóstico" },
  { id: "regla", label: "Regla base" },
  { id: "estatutos", label: "Estatutos" },
  { id: "clausulas", label: "Mapeo de cláusulas" },
  { id: "plantillas", label: "Plantillas" },
  { id: "publicacion", label: "Publicación" },
];

export default function ActivarMarcoNormativo() {
  const { id: entityId } = useParams<{ id: string }>();
  const [step, setStep] = useState<WizardStepId>("diagnostico");
  const { primaryRole, displayName } = useCurrentUserRole();
  const normativeRole = normativeRoleFromAppRole(primaryRole);
  const sociedadQuery = useSociedad(entityId);
  const sociedad = sociedadQuery.data;
  const profileQuery = useRuleManagerProfile(entityId);
  const { data: bodies = [] } = useBodiesByEntity(entityId);
  const { data: plantillas = [] } = usePlantillasProtegidas();
  const materiasQuery = useMateriaCatalogoSocietario();
  const publishStatutes = usePublishStatuteVersion();
  const assignTemplate = useAssignTemplateBinding();
  const materializeMatrix = useMaterializeEffectiveRuleMatrix();

  const materias = useMemo(
    () => buildMateriaCatalogRows(materiasQuery.data ?? []),
    [materiasQuery.data],
  );
  const criticalMatter = materias.find((materia) => materia.materia === "MODIFICACION_ESTATUTOS") ?? materias[0] ?? null;
  const templateBindings = criticalMatter
    ? buildTemplateDocumentBindings(plantillas, {
        materia: criticalMatter.materia,
        jurisdiction: sociedad?.jurisdiction,
        tipoSocial: sociedad?.tipo_social,
      })
    : [];
  const readiness = evaluateTemplateReadiness(templateBindings);
  const conflict = sociedad
    ? detectConflictOfLaws({
        jurisdiction: sociedad.jurisdiction,
        tipoSocial: sociedad.tipo_social,
        legalForm: sociedad.legal_form,
        appliedReferences: profileQuery.data?.sources.map((source) => `${source.label} ${source.reference ?? ""}`),
      })
    : null;

  const diagnostics = useMemo(() => {
    const profile = profileQuery.data;
    const hasRuleSet = profile?.sources.some((source) => source.layer === "LEY" && source.status === "ACTIVE") === true;
    const hasPublishedStatutes = profile?.sources.some((source) => source.layer === "ESTATUTOS" && source.status === "ACTIVE") === true;
    const hasOrgans = bodies.length > 0;
    const hasCriticalTemplates = readiness.canStartCase;
    const hasConflict = conflict?.conflict_of_laws_flag === true;
    return [
      {
        id: "rule-set",
        label: "Regla legal base activa",
        ok: hasRuleSet,
        blocking: !hasRuleSet,
        cta: "Activar regla legal base",
        detail: hasRuleSet ? "Hay fuente legal base activa." : "No hay regla legal base aplicable a jurisdicción y forma social.",
      },
      {
        id: "statutes",
        label: "Estatutos versionados",
        ok: hasPublishedStatutes,
        blocking: false,
        cta: "Versionar estatutos",
        detail: hasPublishedStatutes ? "Hay regla estatutaria estructurada." : "Estatutos no versionados; aplican reglas legales por defecto.",
      },
      {
        id: "organs",
        label: "Órganos definidos",
        ok: hasOrgans,
        blocking: !hasOrgans,
        cta: "Definir órgano",
        detail: hasOrgans ? `${bodies.length} órgano(s) disponible(s).` : "No hay órgano competente que pueda vincularse a materias.",
      },
      {
        id: "templates",
        label: "Plantillas mínimas",
        ok: hasCriticalTemplates,
        blocking: !hasCriticalTemplates,
        cta: "Asignar plantillas",
        detail: hasCriticalTemplates ? "Plantillas mínimas cubiertas." : readiness.blockingMessage ?? "Faltan plantillas mínimas.",
      },
      {
        id: "conflict",
        label: "Coherencia jurisdiccional",
        ok: !hasConflict,
        blocking: hasConflict,
        cta: "Resolver conflicto",
        detail: conflict?.explanation ?? "Sin conflicto detectado.",
      },
    ];
  }, [bodies.length, conflict, profileQuery.data, readiness.blockingMessage, readiness.canStartCase]);

  const blockers = diagnostics.filter((item) => item.blocking && !item.ok);
  const canPublish = blockers.length === 0;
  const history = buildNormativeHistoryEntries({
    sources: profileQuery.data?.sources,
    actor: displayName,
    effectiveAt: profileQuery.data?.effective_at,
  });
  const rollout = buildNormativeRolloutPlan();
  const kpis = buildP1OperationalKpiContract();
  const performanceBudget = buildP1PerformanceBudgetContract();
  const a11yI18n = buildP1A11yI18nContract();
  const backfillPlan = buildP1LegacyBackfillPlan();
  const flagDecisions = Object.keys(rollout.flags).map((flag) =>
    buildFeatureFlagDecision(flag as keyof typeof rollout.flags),
  );
  const publishDecision = canPerformNormativeAction(normativeRole, "publish_statutes");
  const publicationEvent = entityId
    ? buildNormativeAuditEvent({
        action: "statute_version_published",
        societyId: entityId,
        userRole: normativeRole,
        before: { status: profileQuery.data?.status ?? "INCOMPLETO" },
        after: { status: canPublish ? "OK" : "INCOMPLETO" },
      })
    : null;

  return (
    <div className="mx-auto max-w-[1280px] p-6">
      <div className="mb-4">
        <Link
          to={entityId ? `/secretaria/sociedades/${entityId}` : "/secretaria/sociedades"}
          className="inline-flex items-center gap-1 text-xs text-[var(--g-text-secondary)] hover:text-[var(--g-brand-3308)]"
        >
          <ChevronLeft className="h-3 w-3" /> Volver a la sociedad
        </Link>
      </div>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
            <ShieldCheck className="h-3.5 w-3.5" />
            Secretaría · Activar marco normativo
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
            Wizard de activación normativa
          </h1>
          <p className="mt-1 max-w-4xl text-sm leading-6 text-[var(--g-text-secondary)]">
            Diagnostica y resuelve regla legal base, estatutos, órganos, pactos y plantillas antes de
            publicar el marco normativo de la sociedad.
          </p>
          {sociedad ? (
            <p className="mt-2 text-xs text-[var(--g-text-secondary)]">
              {sociedad.common_name ?? sociedad.legal_name} · {sociedad.jurisdiction ?? "jurisdicción no informada"} ·{" "}
              {displaySocietyLegalForm({
                jurisdiction: sociedad.jurisdiction,
                tipoSocial: sociedad.tipo_social,
                legalForm: sociedad.legal_form,
              })}
            </p>
          ) : null}
        </div>
        <StatusPanel canPublish={canPublish} blockers={blockers.length} />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-2 md:grid-cols-6">
        {STEPS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setStep(item.id)}
            className={`border px-3 py-2 text-left text-xs font-semibold transition-colors ${
              step === item.id
                ? "border-[var(--g-brand-3308)] bg-[var(--g-surface-subtle)] text-[var(--g-text-primary)]"
                : "border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] text-[var(--g-text-secondary)] hover:bg-[var(--g-surface-subtle)]"
            }`}
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {sociedadQuery.isLoading ? (
        <Panel>Cargando sociedad…</Panel>
      ) : !sociedad ? (
        <Panel>Sociedad no encontrada.</Panel>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <main>
            {step === "diagnostico" && <DiagnosticStep diagnostics={diagnostics} />}
            {step === "regla" && <RuleSetStep sociedadName={sociedad.common_name ?? sociedad.legal_name} conflict={conflict} role={normativeRole} />}
            {step === "estatutos" && (
              <StatutesStep
                hasPublished={diagnostics.find((item) => item.id === "statutes")?.ok === true}
                role={normativeRole}
                isPending={publishStatutes.isPending}
                error={publishStatutes.error}
                onPublish={() => {
                  if (!entityId || !criticalMatter) return;
                  publishStatutes.mutate({
                    entityId,
                    versionLabel: `Estatutos ${new Date().getFullYear()}`,
                    documentUri: "secretaria://estatutos/version-demo",
                    documentHash: `demo-${entityId.slice(0, 8)}-${criticalMatter.materia}`,
                    mappingCoverage: 85,
                    criticalMappingsComplete: true,
                    userRole: normativeRole,
                    mappings: [
                      {
                        clauseRef: "Estatutos · cláusula de mayoría y competencias",
                        matterCode: criticalMatter.materia,
                        requirementKey: "votacion.mayoria",
                        requirementValue: { majority_code: "REFORZADA_2_3" },
                        sourceExcerpt: "Mayoría reforzada para materias estructurales y estatutarias.",
                        confidence: "VALIDADO",
                      },
                    ],
                  });
                }}
              />
            )}
            {step === "clausulas" && <ClauseMappingStep matterLabel={criticalMatter?.materia_label_es ?? "materia crítica"} role={normativeRole} />}
            {step === "plantillas" && (
              <TemplatesStep
                readiness={readiness}
                matter={criticalMatter?.materia ?? "MODIFICACION_ESTATUTOS"}
                role={normativeRole}
                isPending={assignTemplate.isPending}
                error={assignTemplate.error}
                onAssign={() => {
                  const binding = templateBindings.find((item) => item.template.estado === "ACTIVA") ?? templateBindings[0];
                  if (!binding || !criticalMatter) return;
                  assignTemplate.mutate({
                    materia: criticalMatter.materia,
                    organoTipo: binding.template.organo_tipo ?? "ANY",
                    tipoSocial: sociedad.tipo_social ?? "ANY",
                    jurisdiccion: sociedad.jurisdiction ?? "ES",
                    adoptionMode: binding.template.adoption_mode ?? "ANY",
                    docType: binding.template.tipo,
                    templateId: binding.template.id,
                    priority: 100,
                    selectionReason: binding.selectionReason || "Selección automática por materia y fase documental",
                    userRole: normativeRole,
                  });
                }}
              />
            )}
            {step === "publicacion" && (
              <PublicationStep
                canPublish={canPublish}
                blockers={blockers}
                decision={publishDecision}
                auditEvent={publicationEvent}
                isPending={materializeMatrix.isPending}
                materializedRows={materializeMatrix.data?.rows_materialized}
                materializeError={materializeMatrix.error}
                onMaterialize={() => materializeMatrix.mutate({ entityId })}
              />
            )}
          </main>
          <aside className="space-y-4">
            <Panel>
              <div className="text-sm font-semibold text-[var(--g-text-primary)]">Checklist de publicación</div>
              <ul className="mt-3 space-y-2 text-sm text-[var(--g-text-secondary)]">
                {diagnostics.map((item) => (
                  <li key={item.id} className="flex items-start gap-2">
                    {item.ok ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-success)]" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-warning)]" />
                    )}
                    <span>{item.label}</span>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel>
              <div className="text-sm font-semibold text-[var(--g-text-primary)]">Trazabilidad prevista</div>
              <p className="mt-2 text-sm text-[var(--g-text-secondary)]">
                Al publicar se registrará usuario, fecha, versión, fuentes modificadas y comentario de
                validación. En esta fase queda preparado el contrato de auditoría sin escritura Cloud.
              </p>
            </Panel>
            <Panel>
              <div className="text-sm font-semibold text-[var(--g-text-primary)]">Historial</div>
              <ul className="mt-3 space-y-2 text-xs text-[var(--g-text-secondary)]">
                {history.slice(0, 5).map((item) => (
                  <li key={item.id} className="border-b border-[var(--g-border-subtle)] pb-2 last:border-b-0 last:pb-0">
                    <div className="font-semibold text-[var(--g-text-primary)]">{item.action}</div>
                    <div>{item.after}</div>
                    <div>{item.comment}</div>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel>
              <div className="text-sm font-semibold text-[var(--g-text-primary)]">Rollout</div>
              <ul className="mt-3 space-y-1 text-xs text-[var(--g-text-secondary)]">
                {rollout.cohorts.map((cohort) => (
                  <li key={cohort.label}>
                    {cohort.percentage}% · {cohort.label}: {cohort.condition}
                  </li>
                ))}
              </ul>
              <div className="mt-3 border-t border-[var(--g-border-subtle)] pt-3">
                <div className="text-xs font-semibold text-[var(--g-text-primary)]">Controles de despliegue</div>
                <ul className="mt-2 space-y-1 text-xs text-[var(--g-text-secondary)]">
                  {flagDecisions.map((flag) => (
                    <li key={flag.flag}>
                      {flag.enabled ? "Activo" : "Solo lectura"} · {flag.label}
                    </li>
                  ))}
                </ul>
              </div>
            </Panel>
            <Panel>
              <div className="text-sm font-semibold text-[var(--g-text-primary)]">Criterios de salida</div>
              <ul className="mt-3 space-y-1 text-xs text-[var(--g-text-secondary)]">
                <li>Marco incompleto a OK: p50 ≤ {kpis.incompleteToOkMinutesP50} min · p95 ≤ {kpis.incompleteToOkMinutesP95} min.</li>
                <li>Cobertura de fuentes objetivo: {kpis.sourceCoverageTargetPct}%.</li>
                <li>Expedientes con plantillas mínimas faltantes permitidos: {kpis.expedienteMissingTemplatesAllowed}.</li>
                <li>Presupuesto de carga: TTFB p95 ≤ {performanceBudget.ttfbP95Ms} ms · render ≤ {performanceBudget.renderP95Ms} ms.</li>
                <li>Accesibilidad: WCAG {a11yI18n.wcag} · idiomas {a11yI18n.languages.join("/")}. </li>
                <li>Backfill legacy: marcar incompleto si falta {backfillPlan.markIncompleteWhenMissing.slice(0, 3).join(", ")}.</li>
              </ul>
            </Panel>
          </aside>
        </div>
      )}
    </div>
  );
}

function StatusPanel({ canPublish, blockers }: { canPublish: boolean; blockers: number }) {
  return (
    <div
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
        Estado general
      </div>
      <div className="mt-1 text-lg font-semibold text-[var(--g-text-primary)]">
        {canPublish ? "OK" : "INCOMPLETO"}
      </div>
      <div className="mt-1 text-xs text-[var(--g-text-secondary)]">
        {canPublish ? "Marco preparado para publicación." : `${blockers} bloqueo(s) antes de publicar.`}
      </div>
    </div>
  );
}

function DiagnosticStep({
  diagnostics,
}: {
  diagnostics: Array<{ id: string; label: string; ok: boolean; blocking: boolean; cta: string; detail: string }>;
}) {
  return (
    <Panel>
      <h2 className="text-lg font-semibold text-[var(--g-text-primary)]">Diagnóstico</h2>
      <div className="mt-4 space-y-3">
        {diagnostics.map((item) => (
          <div key={item.id} className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-3" style={{ borderRadius: "var(--g-radius-md)" }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[var(--g-text-primary)]">{item.label}</div>
                <p className="mt-1 text-sm text-[var(--g-text-secondary)]">{item.detail}</p>
              </div>
              <StateChip ok={item.ok} blocking={item.blocking} />
            </div>
            {!item.ok ? (
              <button
                type="button"
                className="mt-3 inline-flex items-center gap-1 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-xs font-semibold text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                {item.cta} <ArrowRight className="h-3 w-3" />
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </Panel>
  );
}

function RuleSetStep({
  sociedadName,
  conflict,
  role,
}: {
  sociedadName: string;
  conflict: ReturnType<typeof detectConflictOfLaws> | null;
  role: ReturnType<typeof normativeRoleFromAppRole>;
}) {
  return (
    <Panel>
      <StepHeader icon={Scale} title="Activar regla legal base" />
      <p className="mt-2 text-sm text-[var(--g-text-secondary)]">
        Selecciona jurisdicción, forma social y paquete legal sugerido para {sociedadName}. La
        activación definitiva deberá registrar quién activa el marco y qué versión queda vigente.
      </p>
      <div className="mt-4 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-3 text-sm text-[var(--g-text-primary)]" style={{ borderRadius: "var(--g-radius-md)" }}>
        Ley esperada: {conflict?.expectedLawLabel ?? "Pendiente de sociedad"}.
      </div>
      {conflict?.conflict_of_laws_flag ? (
        <div className="mt-3 border border-[var(--status-error)] bg-[var(--g-surface-card)] p-3 text-sm text-[var(--g-text-secondary)]" role="alert" style={{ borderRadius: "var(--g-radius-md)" }}>
          <strong className="text-[var(--status-error)]">Posible conflicto de ley aplicable.</strong>{" "}
          {conflict.explanation}
        </div>
      ) : null}
      <GovernedButton action="activate_rule_set" role={role} className="mt-4" />
    </Panel>
  );
}

function StatutesStep({
  hasPublished,
  role,
  isPending,
  error,
  onPublish,
}: {
  hasPublished: boolean;
  role: ReturnType<typeof normativeRoleFromAppRole>;
  isPending: boolean;
  error: unknown;
  onPublish: () => void;
}) {
  const decision = canPerformNormativeAction(role, "publish_statutes");
  return (
    <Panel>
      <StepHeader icon={FileText} title="Versionar estatutos" />
      <p className="mt-2 text-sm text-[var(--g-text-secondary)]">
        Carga o selecciona la versión vigente de estatutos, informa referencia documental y prepara
        el mapeo de cláusulas a materias.
      </p>
      <div className="mt-4">
        <StateChip ok={hasPublished} blocking={false} />
      </div>
      <button
        type="button"
        disabled={!decision.allowed || isPending}
        aria-disabled={!decision.allowed}
        aria-busy={isPending}
        onClick={onPublish}
        className={`mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold ${
          decision.allowed
            ? "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)]"
            : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
        } disabled:cursor-not-allowed disabled:opacity-70`}
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        {decision.allowed ? "Publicar versión de estatutos" : "Solicitar edición"}
      </button>
      {error ? <InlineActionError error={error} /> : null}
    </Panel>
  );
}

function ClauseMappingStep({
  matterLabel,
  role,
}: {
  matterLabel: string;
  role: ReturnType<typeof normativeRoleFromAppRole>;
}) {
  return (
    <Panel>
      <StepHeader icon={Link2} title="Mapear cláusulas a materias" />
      <p className="mt-2 text-sm text-[var(--g-text-secondary)]">
        Cada cláusula debe vincularse a una materia y a un requisito: órgano, mayoría, quórum,
        plazo o documento. Materia crítica de referencia: {matterLabel}.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        {["Órgano competente", "Mayoría", "Quórum", "Plazos", "Documentos"].map((item) => (
          <div key={item} className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-3 text-sm text-[var(--g-text-primary)]" style={{ borderRadius: "var(--g-radius-md)" }}>
            {item} · fuente pendiente de enlace
          </div>
        ))}
      </div>
      <GovernedButton action="map_clause" role={role} className="mt-4" />
    </Panel>
  );
}

function TemplatesStep({
  readiness,
  matter,
  role,
  isPending,
  error,
  onAssign,
}: {
  readiness: ReturnType<typeof evaluateTemplateReadiness>;
  matter: string;
  role: ReturnType<typeof normativeRoleFromAppRole>;
  isPending: boolean;
  error: unknown;
  onAssign: () => void;
}) {
  const decision = canPerformNormativeAction(role, "assign_template");
  return (
    <Panel>
      <StepHeader icon={BookOpen} title="Validar plantillas mínimas" />
      <div className="mt-4 space-y-3">
        {readiness.items.map((item) => (
          <div key={item.stage} className="flex items-center justify-between gap-3 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-3" style={{ borderRadius: "var(--g-radius-md)" }}>
            <div>
              <div className="text-sm font-semibold text-[var(--g-text-primary)]">{item.stage}</div>
              <div className="text-xs text-[var(--g-text-secondary)]">{sanitizeBusinessLabel(item.status)}</div>
            </div>
            {decision.allowed ? (
              <Link
                to={`/secretaria/gestor-plantillas?materia=${matter}`}
                className="text-xs font-semibold text-[var(--g-brand-3308)] hover:text-[var(--g-sec-700)]"
              >
                {item.actionLabel}
              </Link>
            ) : (
              <span className="text-xs font-semibold text-[var(--g-text-secondary)]">Solicitar edición</span>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={!decision.allowed || isPending}
        aria-disabled={!decision.allowed}
        aria-busy={isPending}
        onClick={onAssign}
        className="mt-4 inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-semibold text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] disabled:cursor-not-allowed disabled:bg-[var(--g-surface-muted)] disabled:text-[var(--g-text-secondary)]"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        Asignar plantilla sugerida
      </button>
      {error ? <InlineActionError error={error} /> : null}
    </Panel>
  );
}

function PublicationStep({
  canPublish,
  blockers,
  decision,
  auditEvent,
  isPending,
  materializedRows,
  materializeError,
  onMaterialize,
}: {
  canPublish: boolean;
  blockers: Array<{ label: string; detail: string }>;
  decision: ReturnType<typeof canPerformNormativeAction>;
  auditEvent: ReturnType<typeof buildNormativeAuditEvent> | null;
  isPending: boolean;
  materializedRows?: number;
  materializeError: unknown;
  onMaterialize: () => void;
}) {
  const disabled = !canPublish || !decision.allowed;
  const telemetryEvent = auditEvent ? buildNormativeTelemetryEvent(auditEvent) : null;
  return (
    <Panel>
      <StepHeader icon={Landmark} title="Publicar marco normativo" />
      {canPublish ? (
        <p className="mt-2 text-sm text-[var(--g-text-secondary)]">
          El marco está preparado para publicación. La escritura Cloud se deja condicionada al
          contrato de auditoría y permisos.
        </p>
      ) : (
        <div className="mt-3 border border-[var(--status-error)] bg-[var(--g-surface-card)] p-3" role="alert" style={{ borderRadius: "var(--g-radius-md)" }}>
          <div className="text-sm font-semibold text-[var(--status-error)]">Publicación bloqueada</div>
          <ul className="mt-2 space-y-1 text-sm text-[var(--g-text-secondary)]">
            {blockers.map((blocker) => (
              <li key={blocker.label}>· {blocker.label}: {blocker.detail}</li>
            ))}
          </ul>
        </div>
      )}
      {auditEvent ? (
        <div className="mt-3 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-3 text-xs text-[var(--g-text-secondary)]" style={{ borderRadius: "var(--g-radius-md)" }}>
          Evento de auditoría preparado: {auditEvent.action} · rol {auditEvent.userRole}.
          {telemetryEvent ? (
            <span className="block">
              Telemetría preparada para la publicación del marco · sociedad {telemetryEvent.attributes.society_id}.
            </span>
          ) : null}
        </div>
      ) : null}
      <button
        type="button"
        disabled={disabled}
        aria-disabled={disabled}
        className={`mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold ${
          !disabled
            ? "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)]"
            : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
        }`}
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        {decision.allowed ? "Publicar marco normativo" : "Solicitar edición"}
      </button>
      {decision.reason ? (
        <p className="mt-2 text-xs text-[var(--g-text-secondary)]">{decision.reason}</p>
      ) : null}
      <button
        type="button"
        disabled={isPending}
        aria-busy={isPending}
        onClick={onMaterialize}
        className="mt-3 inline-flex items-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-4 py-2 text-sm font-semibold text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] disabled:cursor-not-allowed disabled:opacity-60"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        Materializar matriz de regla efectiva
      </button>
      {typeof materializedRows === "number" ? (
        <p className="mt-2 text-xs text-[var(--g-text-secondary)]">
          Matriz actualizada: {materializedRows} filas materializadas.
        </p>
      ) : null}
      {materializeError ? <InlineActionError error={materializeError} /> : null}
    </Panel>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <section
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-5 text-[var(--g-text-primary)]"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      {children}
    </section>
  );
}

function StepHeader({ icon: Icon, title }: { icon: ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[var(--g-brand-3308)]">
      <Icon className="h-4 w-4" />
      {title}
    </div>
  );
}

function StateChip({ ok, blocking }: { ok: boolean; blocking: boolean }) {
  const cls = ok
    ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
    : blocking
      ? "bg-[var(--status-error)] text-[var(--g-text-inverse)]"
      : "bg-[var(--status-warning)] text-[var(--g-text-inverse)]";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls}`} style={{ borderRadius: "var(--g-radius-full)" }}>
      {ok ? "OK" : blocking ? "Bloqueante" : "Pendiente"}
    </span>
  );
}

function InlineActionError({ error }: { error: unknown }) {
  return (
    <div
      className="mt-3 border border-[var(--status-error)] bg-[var(--g-surface-card)] p-3 text-xs text-[var(--g-text-secondary)]"
      role="alert"
      style={{ borderRadius: "var(--g-radius-md)" }}
    >
      <span className="font-semibold text-[var(--status-error)]">Acción no completada.</span>{" "}
      {error instanceof Error ? error.message : "Error desconocido en el mantenimiento normativo."}
    </div>
  );
}

function GovernedButton({
  action,
  role,
  className = "",
}: {
  action: NormativeMaintenanceAction;
  role: ReturnType<typeof normativeRoleFromAppRole>;
  className?: string;
}) {
  const decision = canPerformNormativeAction(role, action);
  return (
    <button
      type="button"
      disabled={!decision.allowed}
      aria-disabled={!decision.allowed}
      className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold ${
        decision.allowed
          ? "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)]"
          : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
      } ${className}`}
      style={{ borderRadius: "var(--g-radius-md)" }}
    >
      {decision.ctaLabel}
    </button>
  );
}
