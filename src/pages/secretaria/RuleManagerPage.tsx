import { useEffect, useMemo, useRef, useState, type ElementType, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  BookMarked,
  CheckCircle2,
  ChevronLeft,
  FileText,
  Gavel,
  Landmark,
  PauseCircle,
  Scale,
  Shield,
  ShieldAlert,
  Users,
  XCircle,
} from "lucide-react";
import { useCurrentUserRole } from "@/hooks/useCurrentUser";
import {
  useEffectiveRuleMatrix,
  useMaterializeEffectiveRuleMatrix,
  useNormativeOverrides,
  usePublishNormativeOverride,
  useStatuteVersions,
  useTemplateBindings,
} from "@/hooks/useNormativeGovernance";
import { useSociedades } from "@/hooks/useSociedades";
import { useRulePacks } from "@/hooks/useRulePacks";
import {
  useNormativeFrameworkCloudStatus,
  useRecordNormativeMaintenanceEvent,
  useRunNormativeFrameworkBackfill,
} from "@/hooks/useNormativeMaintenanceCloud";
import {
  useAgreementRulePreview,
  useRuleManagerProfile,
  type AgreementRulePreviewInput,
} from "@/hooks/useRuleManager";
import type {
  EffectiveAgreementRule,
  EffectiveRuleConsequence,
  LegalConsequence,
} from "@/lib/secretaria/rule-manager-contract";
import type { PactoParasocial } from "@/lib/rules-engine/pactos-engine";
import {
  buildFeatureFlagDecision,
  buildNormativeAuditEvent,
  buildNormativeHistoryEntries,
  buildNormativeTelemetryEvent,
  canPerformNormativeAction,
  detectConflictOfLaws,
  displaySocietyLegalForm,
  normativeRoleFromAppRole,
  requirementStateLabel,
  type NormativeMaintenanceRole,
  type RequirementOperationalState,
} from "@/lib/secretaria/mesa-control-societaria";

// ── Catálogo de materias y modos de adopción para el simulador ─────────────

type MatterEntry = {
  matter: string;
  label: string;
  matter_class: "ORDINARIA" | "ESTATUTARIA" | "ESTRUCTURAL";
  inscribable: boolean;
};

const MATTER_DEFAULTS: MatterEntry[] = [
  { matter: "APROBACION_CUENTAS", label: "Aprobación de cuentas anuales", matter_class: "ORDINARIA", inscribable: false },
  { matter: "DELEGACION_FACULTADES", label: "Delegación de facultades", matter_class: "ORDINARIA", inscribable: true },
  { matter: "NOMBRAMIENTO_CONSEJERO", label: "Nombramiento de consejero", matter_class: "ORDINARIA", inscribable: true },
  { matter: "CESE_CONSEJERO", label: "Cese de consejero", matter_class: "ORDINARIA", inscribable: true },
  { matter: "NOMBRAMIENTO_AUDITOR", label: "Nombramiento de auditor", matter_class: "ORDINARIA", inscribable: true },
  { matter: "MODIFICACION_ESTATUTOS", label: "Modificación de estatutos", matter_class: "ESTATUTARIA", inscribable: true },
  { matter: "AUMENTO_CAPITAL", label: "Aumento de capital", matter_class: "ESTRUCTURAL", inscribable: true },
  { matter: "REDUCCION_CAPITAL", label: "Reducción de capital", matter_class: "ESTRUCTURAL", inscribable: true },
  { matter: "FUSION", label: "Fusión", matter_class: "ESTRUCTURAL", inscribable: true },
  { matter: "ESCISION", label: "Escisión", matter_class: "ESTRUCTURAL", inscribable: true },
  { matter: "DISOLUCION", label: "Disolución", matter_class: "ESTRUCTURAL", inscribable: true },
  { matter: "TRANSFORMACION", label: "Transformación", matter_class: "ESTRUCTURAL", inscribable: true },
];

function humanizeMatter(slug: string) {
  return slug
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function mergeMattersWithRulePacks(
  defaults: MatterEntry[],
  rulePackMatters: Array<{ materia?: string }>,
): MatterEntry[] {
  const byMatter = new Map(defaults.map((m) => [m.matter, m]));
  for (const pack of rulePackMatters) {
    if (!pack.materia || byMatter.has(pack.materia)) continue;
    byMatter.set(pack.materia, {
      matter: pack.materia,
      label: humanizeMatter(pack.materia),
      // Defaults seguros para materias del rule pack que no están en hardcoded.
      // Legal puede ajustar con el dropdown de matter_class si lo añadimos en el futuro.
      matter_class: "ESTATUTARIA",
      inscribable: true,
    });
  }
  return Array.from(byMatter.values()).sort((a, b) => a.label.localeCompare(b.label));
}

const ADOPTION_MODES: Array<{ value: string; label: string }> = [
  { value: "MEETING", label: "Acuerdo en sesión" },
  { value: "UNIVERSAL", label: "Junta universal" },
  { value: "NO_SESSION", label: "Acuerdo sin sesión" },
  { value: "CO_APROBACION", label: "Co-aprobación de administradores" },
  { value: "SOLIDARIO", label: "Decisión de administrador solidario" },
  { value: "UNIPERSONAL_SOCIO", label: "Decisión de socio único" },
  { value: "UNIPERSONAL_ADMIN", label: "Decisión de administrador único" },
];

// ── Tabla de consecuencias jurídicas a etiqueta humana ─────────────────────

const CONSEQUENCE_META: Record<
  LegalConsequence,
  { label: string; tone: "block" | "breach" | "hold" | "warning" | "ok"; description: string }
> = {
  VALIDITY_BLOCK: {
    label: "Bloqueo societario",
    tone: "block",
    description: "El acuerdo no podría proclamarse válidamente sin remediar la causa.",
  },
  CONTRACTUAL_BREACH: {
    label: "Incumplimiento contractual",
    tone: "breach",
    description: "El acuerdo es válido societariamente pero rompe un pacto.",
  },
  OPERATIONAL_HOLD: {
    label: "Hold operativo",
    tone: "hold",
    description: "Parar ejecución/registro hasta obtener waiver o consentimiento.",
  },
  WARNING: {
    label: "Advertencia",
    tone: "warning",
    description: "Información a tener en cuenta sin bloqueo automático.",
  },
  NO_EFFECT: {
    label: "Sin efecto",
    tone: "ok",
    description: "La fuente no aplica al acuerdo evaluado.",
  },
};

const CONSEQUENCE_TONE_CLASS: Record<typeof CONSEQUENCE_META[LegalConsequence]["tone"], string> = {
  block:
    "bg-[var(--status-error)] text-[var(--g-text-inverse)] border border-[var(--status-error)]",
  breach:
    "bg-[var(--status-warning)] text-[var(--g-text-inverse)] border border-[var(--status-warning)]",
  hold:
    "bg-[var(--g-surface-subtle)] text-[var(--g-text-primary)] border border-[var(--g-border-default)]",
  warning:
    "bg-[var(--g-sec-100)] text-[var(--g-text-primary)] border border-[var(--g-border-subtle)]",
  ok:
    "bg-[var(--g-surface-card)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
};

const STATUS_TONE: Record<EffectiveAgreementRule["status"], { label: string; chip: string }> = {
  PROCLAMABLE_AND_EXECUTABLE: {
    label: "Proclamable y ejecutable",
    chip: "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  },
  PROCLAMABLE_HELD: {
    label: "Proclamable con hold/breach",
    chip: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  },
  BLOCKED: {
    label: "Bloqueado societariamente",
    chip: "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  },
};

// ── Componente principal ────────────────────────────────────────────────────

export default function RuleManagerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const entityId = searchParams.get("entity");
  const initialMatter = searchParams.get("matter") ?? "MODIFICACION_ESTATUTOS";
  const initialAdoption = searchParams.get("adoption") ?? "MEETING";

  const sociedadesQuery = useSociedades();
  const rulePacksQuery = useRulePacks();
  const { primaryRole, displayName } = useCurrentUserRole();
  const normativeRole = normativeRoleFromAppRole(primaryRole);
  const wizardFlag = buildFeatureFlagDecision("ff_ruleset_wizard");
  const organsFlag = buildFeatureFlagDecision("ff_organs_catalog");
  const [matter, setMatter] = useState<string>(initialMatter);
  const [adoptionMode, setAdoptionMode] = useState<string>(initialAdoption);

  // Hipótesis de votación / waivers / consentimientos / estatutarización.
  // Por defecto el simulador trabaja en modo PRE_VOTE (sin cifras de votación).
  const [skipVotes, setSkipVotes] = useState<boolean>(true);
  const [capitalPresenteRaw, setCapitalPresenteRaw] = useState<string>("");
  const [votosFavorRaw, setVotosFavorRaw] = useState<string>("");
  const [vetoRenunciado, setVetoRenunciado] = useState<Set<string>>(new Set());
  const [consentimientosPrevios, setConsentimientosPrevios] = useState<Set<string>>(new Set());
  const [statutoryPactoIds, setStatutoryPactoIds] = useState<Set<string>>(new Set());

  // Materias: hardcoded defaults + materias únicas de rule packs activos en Cloud.
  const matters = useMemo(
    () => mergeMattersWithRulePacks(MATTER_DEFAULTS, rulePacksQuery.data ?? []),
    [rulePacksQuery.data],
  );
  const matterMeta = matters.find((m) => m.matter === matter) ?? matters[0] ?? MATTER_DEFAULTS[0];
  const matterUnknown = !matters.find((m) => m.matter === matter);

  const profileQuery = useRuleManagerProfile(entityId ?? undefined);
  const pactosVigentes = profileQuery.pactos;
  const sociedades = useMemo(
    () => sociedadesQuery.data ?? [],
    [sociedadesQuery.data],
  );
  const sociedad = useMemo(
    () => sociedades.find((s) => s.id === entityId) ?? null,
    [entityId, sociedades],
  );

  // Si el usuario desactiva el modo pre-votación pero todavía no ha introducido
  // cifras válidas, mantener el modo PRE_VOTE en el contrato. Esto evita el
  // falso CONTRACTUAL_BREACH que aparecería al evaluar mayoría con
  // `capitalPresente=0, votosFavor=0`.
  const capitalPresenteValue =
    capitalPresenteRaw.trim() === "" ? null : Number(capitalPresenteRaw);
  const votosFavorValue = votosFavorRaw.trim() === "" ? null : Number(votosFavorRaw);
  const votingFiguresIncomplete =
    capitalPresenteValue === null ||
    votosFavorValue === null ||
    Number.isNaN(capitalPresenteValue) ||
    Number.isNaN(votosFavorValue);
  const effectiveSkipVotes = skipVotes || votingFiguresIncomplete;

  const previewInput: AgreementRulePreviewInput = {
    entityId: entityId ?? undefined,
    matter,
    matterClass: matterMeta.matter_class,
    adoptionMode,
    inscribable: matterMeta.inscribable,
    pactosEval: effectiveSkipVotes
      ? {
          skipVoteDependentEvaluations: true,
          vetoRenunciado: Array.from(vetoRenunciado),
          consentimientosPrevios: Array.from(consentimientosPrevios),
        }
      : {
          capitalPresente: capitalPresenteValue ?? 0,
          votosFavor: votosFavorValue ?? 0,
          vetoRenunciado: Array.from(vetoRenunciado),
          consentimientosPrevios: Array.from(consentimientosPrevios),
        },
    statutoryEnshrinedPactoIds: Array.from(statutoryPactoIds),
  };
  const previewQuery = useAgreementRulePreview(previewInput);
  const cloudStatusQuery = useNormativeFrameworkCloudStatus(entityId);
  const matrixQuery = useEffectiveRuleMatrix(entityId);
  const statuteVersionsQuery = useStatuteVersions(entityId);
  const overridesQuery = useNormativeOverrides(entityId);
  const templateBindingsQuery = useTemplateBindings({
    materia: matter,
    jurisdiction: sociedad?.jurisdiction,
    tipoSocial: sociedad?.tipo_social,
  });
  const materializeMatrix = useMaterializeEffectiveRuleMatrix();
  const recordNormativeEvent = useRecordNormativeMaintenanceEvent();
  const telemetryKeyRef = useRef<string | null>(null);

  const conflictOfLaws = useMemo(
    () =>
      sociedad
        ? detectConflictOfLaws({
            jurisdiction: sociedad.jurisdiction,
            tipoSocial: sociedad.tipo_social,
            legalForm: sociedad.legal_form,
            appliedReferences: profileQuery.data?.sources.map((source) => `${source.label} ${source.reference ?? ""}`),
          })
        : null,
    [profileQuery.data?.sources, sociedad],
  );
  const history = useMemo(
    () =>
      buildNormativeHistoryEntries({
        sources: profileQuery.data?.sources,
        actor: displayName,
        effectiveAt: profileQuery.data?.effective_at,
      }),
    [displayName, profileQuery.data?.effective_at, profileQuery.data?.sources],
  );
  const sociedadMissing = !!entityId && !sociedadesQuery.isLoading && !sociedad;

  useEffect(() => {
    if (!entityId || !profileQuery.data) return;
    const key = `${entityId}:${matter}:${profileQuery.data.profile_hash}`;
    if (telemetryKeyRef.current === key) return;
    telemetryKeyRef.current = key;
    recordNormativeEvent.mutate({
      action: "effective_rule_viewed",
      societyId: entityId,
      matter,
      userRole: normativeRole,
      eventDedupeKey: key,
      after: {
        framework_status: profileQuery.data.status,
        profile_hash: profileQuery.data.profile_hash,
      },
      attributes: {
        source_count: profileQuery.data.sources.length,
        blocker_count: profileQuery.data.blockers.length,
        warning_count: profileQuery.data.warnings.length,
      },
    });
  }, [entityId, matter, normativeRole, profileQuery.data, recordNormativeEvent]);

  const handleEntityChange = (next: string) => {
    const params = new URLSearchParams(searchParams);
    if (next) params.set("entity", next);
    else params.delete("entity");
    setSearchParams(params, { replace: true });
    // Reset hipótesis al cambiar de sociedad — los pactos cambian.
    setVetoRenunciado(new Set());
    setConsentimientosPrevios(new Set());
    setStatutoryPactoIds(new Set());
  };

  const handleMatterChange = (next: string) => {
    setMatter(next);
    const params = new URLSearchParams(searchParams);
    params.set("matter", next);
    setSearchParams(params, { replace: true });
  };

  const handleAdoptionChange = (next: string) => {
    setAdoptionMode(next);
    const params = new URLSearchParams(searchParams);
    params.set("adoption", next);
    setSearchParams(params, { replace: true });
  };

  const togglePactoSet = (
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    pactoId: string,
  ) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(pactoId)) next.delete(pactoId);
      else next.add(pactoId);
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-[1200px] p-6">
      <div className="mb-6">
        <Link
          to="/secretaria"
          className="inline-flex items-center gap-1 text-xs text-[var(--g-text-secondary)] hover:text-[var(--g-brand-3308)]"
        >
          <ChevronLeft className="h-3 w-3" /> Volver al panel
        </Link>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
          <BookMarked className="h-3.5 w-3.5" /> Secretaría · Regla efectiva y mantenimiento
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
          Regla efectiva y mantenimiento
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-[var(--g-text-secondary)]">
          Lectura legal del marco normativo aplicable a un acuerdo: ley → estatutos → reglamento →
          pactos parasociales. Separa los tres planos jurídicos relevantes (validez societaria,
          cumplimiento contractual y retención operativa) y ofrece rutas de resolución cuando falta
          una fuente, un órgano o una plantilla mínima.
        </p>
        {entityId ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {wizardFlag.enabled ? (
              <TopAction to={`/secretaria/sociedades/${entityId}/marco-normativo/activar`} icon={Shield} label="Activar marco normativo" />
            ) : null}
            {organsFlag.enabled ? (
              <TopAction to={`/secretaria/catalogo-organos?entity=${entityId}&matter=${matter}`} icon={Landmark} label="Catálogo de órganos" />
            ) : null}
            <TopAction to={`/secretaria/plantillas?materia=${matter}`} icon={FileText} label="Asignar plantillas" />
          </div>
        ) : null}
      </div>

      {/* ── Selector de sociedad ──────────────────────────────────────────── */}
      <div
        className="mb-6 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <label className="block text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
          Sociedad
        </label>
        <select
          aria-label="Sociedad"
          value={entityId ?? ""}
          onChange={(event) => handleEntityChange(event.target.value)}
          className="mt-1 w-full border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:border-[var(--g-brand-3308)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <option value="">— Selecciona una sociedad —</option>
          {sociedades.map((s) => (
            <option key={s.id} value={s.id}>
              {s.common_name ?? s.legal_name} ({s.tipo_social ?? s.legal_form ?? "?"})
            </option>
          ))}
        </select>
        {sociedad && (
          <p className="mt-2 text-xs text-[var(--g-text-secondary)]">
            Jurisdicción: {sociedad.jurisdiction ?? "—"} · Forma:{" "}
            {displaySocietyLegalForm({
              jurisdiction: sociedad.jurisdiction,
              tipoSocial: sociedad.tipo_social,
              legalForm: sociedad.legal_form,
            })}
            {sociedad.es_cotizada ? " · Cotizada" : ""}
          </p>
        )}
      </div>

      {!entityId && (
        <div className="rounded-md border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-6 text-sm text-[var(--g-text-secondary)]">
          Selecciona una sociedad para ver su marco normativo y simular un acuerdo.
        </div>
      )}

      {sociedadMissing && (
        <ErrorBanner
          title="Sociedad no encontrada"
          message={`No hay ninguna sociedad con identificador ${entityId} en este tenant.`}
        />
      )}

      {entityId && !sociedadMissing && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {conflictOfLaws?.conflict_of_laws_flag ? (
            <div className="lg:col-span-2">
              <ErrorBanner
                title="Posible conflicto de ley aplicable"
                message={`${conflictOfLaws.explanation} Ley esperada: ${conflictOfLaws.expectedLawLabel}. Ley aplicada: ${conflictOfLaws.appliedLawLabel}.`}
              />
            </div>
          ) : null}
          {/* ── Marco normativo ─────────────────────────────────────────── */}
          <NormativeFrameworkCard
            isLoading={profileQuery.isLoading}
            profile={profileQuery.data}
            error={profileQuery.error}
            conflictOfLaws={conflictOfLaws}
            entityId={entityId}
            cloudStatus={cloudStatusQuery.data}
          />

          {/* ── Pactos vigentes ─────────────────────────────────────────── */}
          <PactosVigentesCard
            isLoading={profileQuery.isLoading}
            pactos={pactosVigentes}
            error={profileQuery.error}
            statutoryIds={statutoryPactoIds}
            onToggleStatutory={(id) => togglePactoSet(setStatutoryPactoIds, id)}
            vetoRenunciado={vetoRenunciado}
            onToggleVetoRenunciado={(id) => togglePactoSet(setVetoRenunciado, id)}
            consentimientosPrevios={consentimientosPrevios}
            onToggleConsentimiento={(id) => togglePactoSet(setConsentimientosPrevios, id)}
          />

          {/* ── Simulador (full width) ──────────────────────────────────── */}
          <div className="lg:col-span-2">
            <CloudPersistenceCard entityId={entityId} statusError={cloudStatusQuery.error} />
          </div>
          <div className="lg:col-span-2">
            <GovernedMaintenanceCard
              entityId={entityId}
              matter={matter}
              matrixRows={matrixQuery.data ?? []}
              statuteVersions={statuteVersionsQuery.data ?? []}
              overrides={overridesQuery.data ?? []}
              templateBindings={templateBindingsQuery.data ?? []}
              isLoading={
                matrixQuery.isLoading ||
                statuteVersionsQuery.isLoading ||
                overridesQuery.isLoading ||
                templateBindingsQuery.isLoading
              }
              materializePending={materializeMatrix.isPending}
              materializeRows={materializeMatrix.data?.rows_materialized}
              materializeError={materializeMatrix.error}
              onMaterialize={() => materializeMatrix.mutate({ entityId })}
              role={normativeRole}
            />
          </div>
          <div className="lg:col-span-2">
            <SimuladorReglaCard
              matter={matter}
              adoptionMode={adoptionMode}
              matters={matters}
              matterUnknown={matterUnknown}
              onMatterChange={handleMatterChange}
              onAdoptionChange={handleAdoptionChange}
              previewQuery={previewQuery}
              skipVotes={skipVotes}
              onSkipVotesChange={setSkipVotes}
              capitalPresenteRaw={capitalPresenteRaw}
              onCapitalPresenteChange={setCapitalPresenteRaw}
              votosFavorRaw={votosFavorRaw}
              onVotosFavorChange={setVotosFavorRaw}
              effectiveSkipVotes={effectiveSkipVotes}
              votingFiguresIncomplete={votingFiguresIncomplete}
              entityId={entityId}
            />
          </div>
          <div className="lg:col-span-2">
            <MaintenanceHistoryCard
              history={history}
              role={normativeRole}
              entityId={entityId}
              matter={matter}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── ErrorBanner ─────────────────────────────────────────────────────────────

function ErrorBanner({ title, message }: { title: string; message: string }) {
  return (
    <div
      className="flex items-start gap-2 border border-[var(--status-error)] bg-[var(--g-surface-card)] p-3 text-sm text-[var(--g-text-primary)]"
      role="alert"
      style={{ borderRadius: "var(--g-radius-md)" }}
    >
      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-error)]" aria-hidden />
      <div>
        <div className="font-medium uppercase tracking-wider text-[10px] text-[var(--status-error)]">
          {title}
        </div>
        <div className="mt-0.5 text-xs text-[var(--g-text-secondary)]">{message}</div>
      </div>
    </div>
  );
}

// ── Cards ───────────────────────────────────────────────────────────────────

function NormativeFrameworkCard({
  isLoading,
  profile,
  error,
  conflictOfLaws,
  entityId,
  cloudStatus,
}: {
  isLoading: boolean;
  profile: ReturnType<typeof useRuleManagerProfile>["data"];
  error: unknown;
  conflictOfLaws: ReturnType<typeof detectConflictOfLaws> | null;
  entityId: string;
  cloudStatus: ReturnType<typeof useNormativeFrameworkCloudStatus>["data"];
}) {
  return (
    <Card title="Marco normativo" icon={Scale}>
      {error ? (
        <ErrorBanner
          title="No se pudo cargar el marco"
          message={error instanceof Error ? error.message : "Error desconocido al consultar Cloud."}
        />
      ) : isLoading ? (
        <Loading label="Cargando marco normativo…" />
      ) : !profile ? (
        <Empty label="Sin datos" />
      ) : (
        <div className="space-y-3 text-sm text-[var(--g-text-primary)]">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">
              Estado:
            </span>
            <FrameworkStatusChip status={conflictOfLaws?.conflict_of_laws_flag ? "CONFLICTO_JURISDICCIONAL" : profile.status} />
          </div>
          {cloudStatus ? (
            <div className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-3 text-xs text-[var(--g-text-primary)]" style={{ borderRadius: "var(--g-radius-md)" }}>
              <div className="font-semibold">Diagnóstico Cloud persistido</div>
              <div className="mt-1 text-[var(--g-text-secondary)]">
                Estado: {cloudStatus.status} · Cobertura: {cloudStatus.source_coverage_pct}% ·
                Última actualización: {new Date(cloudStatus.updated_at).toLocaleString("es-ES")}
              </div>
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Link
              to={`/secretaria/sociedades/${entityId}/marco-normativo/activar`}
              className="inline-flex items-center justify-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-xs font-semibold text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              Activar marco normativo
            </Link>
            <Link
              to={`/secretaria/catalogo-organos?entity=${entityId}`}
              className="inline-flex items-center justify-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-xs font-semibold text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              Revisar órganos
            </Link>
          </div>
          {profile.warnings.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-xs text-[var(--g-text-secondary)]">
              {profile.warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          )}
          <div className="border-t border-[var(--g-border-subtle)] pt-3">
            <div className="text-xs font-medium uppercase tracking-wider text-[var(--g-text-secondary)]">
              Fuentes ({profile.sources.length})
            </div>
            <ul className="mt-2 space-y-1 text-xs">
              {profile.sources.map((source) => (
                <li key={source.id} className="flex items-start gap-2">
                  <SourceStatusDot status={source.status} />
                  <div>
                    <div className="font-medium text-[var(--g-text-primary)]">
                      {source.layer === "POLITICA" && source.label.startsWith("Rule pack ")
                        ? `Parámetro operativo ${source.materia ?? source.reference ?? ""}`.trim()
                        : source.label}
                    </div>
                    {source.reference && (
                      <div className="text-[var(--g-text-secondary)]">
                        Fuente: {source.reference} · Versión {source.version ?? "vigente"}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Card>
  );
}

function CloudPersistenceCard({
  entityId,
  statusError,
}: {
  entityId: string;
  statusError: unknown;
}) {
  const backfill = useRunNormativeFrameworkBackfill();
  const result = backfill.data;

  return (
    <Card title="Persistencia Cloud" icon={Shield}>
      <div className="space-y-3 text-sm text-[var(--g-text-primary)]">
        <p className="text-xs text-[var(--g-text-secondary)]">
          El diagnóstico del marco normativo se puede ejecutar en modo simulación o aplicar sobre las sociedades existentes. La aplicación actualiza el estado materializado y deja traza en auditoría.
        </p>
        {statusError ? (
          <ErrorBanner
            title="Diagnóstico Cloud no disponible"
            message={statusError instanceof Error ? statusError.message : "La migración de persistencia todavía no está disponible en Cloud."}
          />
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => backfill.mutate({ apply: false })}
            disabled={backfill.isPending}
            aria-busy={backfill.isPending}
            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-xs font-semibold text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] disabled:cursor-not-allowed disabled:opacity-60"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Simular backfill
          </button>
          <button
            type="button"
            onClick={() => backfill.mutate({ apply: true })}
            disabled={backfill.isPending}
            aria-busy={backfill.isPending}
            className="bg-[var(--g-brand-3308)] px-3 py-2 text-xs font-semibold text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] disabled:cursor-not-allowed disabled:opacity-60"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Aplicar diagnóstico
          </button>
        </div>
        {backfill.error ? (
          <ErrorBanner
            title="No se pudo ejecutar"
            message={backfill.error instanceof Error ? backfill.error.message : "Error desconocido al ejecutar el backfill."}
          />
        ) : null}
        {result ? (
          <div className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-3 text-xs" style={{ borderRadius: "var(--g-radius-md)" }}>
            <div className="font-semibold text-[var(--g-text-primary)]">
              {result.mode === "APPLY" ? "Backfill aplicado" : "Simulación completada"}
            </div>
            <div className="mt-1 text-[var(--g-text-secondary)]">
              Sociedades revisadas: {result.entities_scanned}. Actualizadas: {result.entities_updated}. Sociedad en pantalla: {entityId}.
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function GovernedMaintenanceCard({
  entityId,
  matter,
  matrixRows,
  statuteVersions,
  overrides,
  templateBindings,
  isLoading,
  materializePending,
  materializeRows,
  materializeError,
  onMaterialize,
  role,
}: {
  entityId: string;
  matter: string;
  matrixRows: Array<{
    matter_code: string;
    operational_status: string;
    confidence: string;
    majority_rule: string;
    quorum_rule: string;
    source_layers: Array<{ type?: string; reference?: string }>;
    generated_at: string;
  }>;
  statuteVersions: Array<{ id: string; version_label: string; status: string; mapping_coverage: number; published_at: string | null }>;
  overrides: Array<{ id: string; matter_code: string; requirement_key: string; source_ref: string; status: string }>;
  templateBindings: Array<{ id: string; doc_type: string; template_id: string; selection_reason: string; priority: number }>;
  isLoading: boolean;
  materializePending: boolean;
  materializeRows?: number;
  materializeError: unknown;
  onMaterialize: () => void;
  role: NormativeMaintenanceRole;
}) {
  const publishOverride = usePublishNormativeOverride();
  const [overrideDraft, setOverrideDraft] = useState({
    requirementKey: "votacion.mayoria",
    requirementValue: "UNANIMIDAD",
    sourceType: "ESTATUTOS" as "ESTATUTOS" | "REGLAMENTO",
    sourceRef: "",
    justification: "Eleva el requisito aplicable respecto del mínimo legal.",
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveUntil: "",
  });
  const matterMatrix = matrixRows.find((row) => row.matter_code === matter);
  const publishedStatute = statuteVersions.find((version) => version.status === "PUBLICADA");
  const matterOverrides = overrides.filter((override) => override.matter_code === matter);
  const overrideDecision = canPerformNormativeAction(role, "map_clause");
  const canPublishOverride =
    overrideDecision.allowed &&
    overrideDraft.requirementKey.trim().length > 0 &&
    overrideDraft.requirementValue.trim().length > 0 &&
    overrideDraft.sourceRef.trim().length > 0 &&
    overrideDraft.justification.trim().length > 0;

  return (
    <Card title="Mantenimiento gobernado P2" icon={Landmark}>
      <div className="space-y-4 text-sm text-[var(--g-text-primary)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <p className="max-w-3xl text-xs leading-5 text-[var(--g-text-secondary)]">
            Persistencia real de órganos, estatutos, overrides y plantillas. La matriz materializada
            es la vista operativa que usa la sociedad antes de iniciar un expediente.
          </p>
          <button
            type="button"
            disabled={materializePending}
            aria-busy={materializePending}
            onClick={onMaterialize}
            className="inline-flex items-center justify-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-xs font-semibold text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] disabled:cursor-not-allowed disabled:opacity-60"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Recalcular matriz
          </button>
        </div>
        {isLoading ? (
          <Loading label="Cargando mantenimiento gobernado…" />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <P2Metric label="Estatutos publicados" value={publishedStatute ? publishedStatute.version_label : "Pendiente"} detail={publishedStatute ? `Cobertura ${publishedStatute.mapping_coverage}%` : "Sin versión publicada"} />
            <P2Metric label="Overrides vigentes" value={`${matterOverrides.length}`} detail={`Materia ${humanizeMatter(matter)}`} />
            <P2Metric label="Plantillas vinculadas" value={`${templateBindings.length}`} detail={templateBindings[0]?.selection_reason ?? "Sin binding persistido"} />
            <P2Metric label="Matriz efectiva" value={matterMatrix?.operational_status ?? "Pendiente"} detail={matterMatrix ? `Confianza ${matterMatrix.confidence}` : "No materializada"} />
          </div>
        )}
        {matterMatrix ? (
          <div
            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-3 text-xs text-[var(--g-text-secondary)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <div className="font-semibold text-[var(--g-text-primary)]">Regla efectiva materializada</div>
            <div className="mt-1">
              Mayoría: {matterMatrix.majority_rule} · Quórum: {matterMatrix.quorum_rule}
            </div>
            <div className="mt-1">
              Fuentes: {matterMatrix.source_layers.map((source) => source.reference ?? source.type ?? "fuente").join(" · ")}
            </div>
          </div>
        ) : null}
        <div className="border-t border-[var(--g-border-subtle)] pt-4">
          <div className="text-sm font-semibold text-[var(--g-text-primary)]">
            Publicar override estatutario o reglamentario
          </div>
          <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
            El override exige referencia documental y justificación. Si intenta rebajar un mínimo
            legal, la publicación queda bloqueada por la validación de ley.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-primary)]">
              Requisito afectado
              <select
                value={overrideDraft.requirementKey}
                onChange={(event) => setOverrideDraft((current) => ({ ...current, requirementKey: event.target.value }))}
                className="mt-1 w-full border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-3 py-2 text-sm font-normal normal-case tracking-normal text-[var(--g-text-primary)] focus:border-[var(--g-brand-3308)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <option value="votacion.mayoria">Mayoría</option>
                <option value="constitucion.quorum">Quórum</option>
                <option value="organo.competente">Órgano competente</option>
                <option value="convocatoria.plazo">Plazo</option>
                <option value="documento.obligatorio">Documento obligatorio</option>
                <option value="formalizacion">Formalización</option>
              </select>
            </label>
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-primary)]">
              Fuente
              <select
                value={overrideDraft.sourceType}
                onChange={(event) => setOverrideDraft((current) => ({ ...current, sourceType: event.target.value as typeof overrideDraft.sourceType }))}
                className="mt-1 w-full border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-3 py-2 text-sm font-normal normal-case tracking-normal text-[var(--g-text-primary)] focus:border-[var(--g-brand-3308)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <option value="ESTATUTOS">Estatutos</option>
                <option value="REGLAMENTO">Reglamento</option>
              </select>
            </label>
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-primary)]">
              Valor
              <input
                value={overrideDraft.requirementValue}
                onChange={(event) => setOverrideDraft((current) => ({ ...current, requirementValue: event.target.value }))}
                className="mt-1 w-full border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-3 py-2 text-sm font-normal normal-case tracking-normal text-[var(--g-text-primary)] focus:border-[var(--g-brand-3308)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              />
            </label>
            <label className="md:col-span-2 text-xs font-semibold uppercase tracking-wider text-[var(--g-text-primary)]">
              Referencia documental
              <input
                value={overrideDraft.sourceRef}
                onChange={(event) => setOverrideDraft((current) => ({ ...current, sourceRef: event.target.value }))}
                placeholder="Estatutos art. 15"
                className="mt-1 w-full border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-3 py-2 text-sm font-normal normal-case tracking-normal text-[var(--g-text-primary)] focus:border-[var(--g-brand-3308)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              />
            </label>
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-primary)]">
              Vigencia desde
              <input
                type="date"
                value={overrideDraft.effectiveFrom}
                onChange={(event) => setOverrideDraft((current) => ({ ...current, effectiveFrom: event.target.value }))}
                className="mt-1 w-full border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-3 py-2 text-sm font-normal normal-case tracking-normal text-[var(--g-text-primary)] focus:border-[var(--g-brand-3308)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              />
            </label>
            <label className="md:col-span-3 text-xs font-semibold uppercase tracking-wider text-[var(--g-text-primary)]">
              Justificación
              <textarea
                value={overrideDraft.justification}
                onChange={(event) => setOverrideDraft((current) => ({ ...current, justification: event.target.value }))}
                className="mt-1 min-h-20 w-full border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-3 py-2 text-sm font-normal normal-case tracking-normal text-[var(--g-text-primary)] focus:border-[var(--g-brand-3308)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!canPublishOverride || publishOverride.isPending}
              aria-busy={publishOverride.isPending}
              onClick={() => {
                if (!canPublishOverride) return;
                const requirementValue =
                  overrideDraft.requirementKey === "votacion.mayoria"
                    ? { majority_code: overrideDraft.requirementValue }
                    : overrideDraft.requirementKey === "constitucion.quorum"
                      ? { quorum_code: overrideDraft.requirementValue }
                      : { value: overrideDraft.requirementValue };
                publishOverride.mutate({
                  entityId,
                  matterCode: matter,
                  requirementKey: overrideDraft.requirementKey,
                  requirementValue,
                  sourceType: overrideDraft.sourceType,
                  sourceRef: overrideDraft.sourceRef,
                  justification: overrideDraft.justification,
                  effectiveFrom: overrideDraft.effectiveFrom,
                  effectiveUntil: overrideDraft.effectiveUntil || null,
                  userRole: role,
                });
              }}
              className="inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-3 py-2 text-xs font-semibold text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] disabled:cursor-not-allowed disabled:bg-[var(--g-surface-muted)] disabled:text-[var(--g-text-secondary)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              Publicar override
            </button>
            {!overrideDecision.allowed ? (
              <span className="text-xs text-[var(--g-text-secondary)]">Solicitar edición</span>
            ) : !canPublishOverride ? (
              <span className="text-xs text-[var(--g-text-secondary)]">
                Completa valor, fuente documental y justificación.
              </span>
            ) : null}
          </div>
          {publishOverride.error ? (
            <ErrorBanner
              title="Override bloqueado"
              message={publishOverride.error instanceof Error ? publishOverride.error.message : "No se pudo publicar el override."}
            />
          ) : null}
        </div>
        {materializeRows !== undefined ? (
          <p className="text-xs text-[var(--g-text-secondary)]">
            Matriz actualizada para {entityId}: {materializeRows} filas materializadas.
          </p>
        ) : null}
        {materializeError ? (
          <ErrorBanner
            title="No se pudo materializar"
            message={materializeError instanceof Error ? materializeError.message : "La migración P2 todavía no está disponible en Cloud."}
          />
        ) : null}
      </div>
    </Card>
  );
}

function P2Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-3"
      style={{ borderRadius: "var(--g-radius-md)" }}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-[var(--g-text-primary)]">{value}</div>
      <div className="mt-1 truncate text-xs text-[var(--g-text-secondary)]">{detail}</div>
    </div>
  );
}

function PactosVigentesCard({
  isLoading,
  pactos,
  error,
  statutoryIds,
  onToggleStatutory,
  vetoRenunciado,
  onToggleVetoRenunciado,
  consentimientosPrevios,
  onToggleConsentimiento,
}: {
  isLoading: boolean;
  pactos: PactoParasocial[];
  error: unknown;
  statutoryIds: Set<string>;
  onToggleStatutory: (id: string) => void;
  vetoRenunciado: Set<string>;
  onToggleVetoRenunciado: (id: string) => void;
  consentimientosPrevios: Set<string>;
  onToggleConsentimiento: (id: string) => void;
}) {
  return (
    <Card title="Pactos parasociales vigentes" icon={Users}>
      {error ? (
        <ErrorBanner
          title="No se pudieron cargar los pactos"
          message={error instanceof Error ? error.message : "Error desconocido al consultar Cloud."}
        />
      ) : isLoading ? (
        <Loading label="Cargando pactos…" />
      ) : pactos.length === 0 ? (
        <p className="text-sm text-[var(--g-text-secondary)]">
          No hay pactos vigentes registrados para esta sociedad.
        </p>
      ) : (
        <ul className="space-y-3">
          {pactos.map((pacto) => {
            const isStatutory = statutoryIds.has(pacto.id);
            const isVetoRenunciado = vetoRenunciado.has(pacto.id);
            const isConsentObtenido = consentimientosPrevios.has(pacto.id);
            return (
              <li
                key={pacto.id}
                className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-3"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-[var(--g-text-primary)]">{pacto.titulo}</div>
                  <span
                    className="bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] px-2 py-0.5 text-[10px] uppercase tracking-wider"
                    style={{ borderRadius: "var(--g-radius-sm)" }}
                  >
                    {pacto.tipo_clausula}
                  </span>
                </div>
                {pacto.titular_veto && (
                  <div className="mt-1 text-xs text-[var(--g-text-secondary)]">
                    Titular: {pacto.titular_veto}
                  </div>
                )}
                {pacto.materias_aplicables.length > 0 && (
                  <div className="mt-1 text-xs text-[var(--g-text-secondary)]">
                    Materias: {pacto.materias_aplicables.join(", ")}
                  </div>
                )}
                {pacto.umbral_activacion !== undefined && (
                  <div className="mt-1 text-xs text-[var(--g-text-secondary)]">
                    Umbral pactado: {(pacto.umbral_activacion * 100).toFixed(1)}%
                  </div>
                )}
                <div className="mt-2 space-y-1 border-t border-[var(--g-border-subtle)] pt-2 text-xs">
                  <PactoToggle
                    checked={isStatutory}
                    onChange={() => onToggleStatutory(pacto.id)}
                    label="Estatutarizado (eleva a VALIDITY_BLOCK si incumple)"
                  />
                  {pacto.tipo_clausula === "VETO" && (
                    <PactoToggle
                      checked={isVetoRenunciado}
                      onChange={() => onToggleVetoRenunciado(pacto.id)}
                      label="Veto renunciado por el titular (waiver documentado)"
                    />
                  )}
                  {pacto.tipo_clausula === "CONSENTIMIENTO_INVERSOR" && (
                    <PactoToggle
                      checked={isConsentObtenido}
                      onChange={() => onToggleConsentimiento(pacto.id)}
                      label="Consentimiento previo obtenido"
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function PactoToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[var(--g-text-primary)]">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-3 w-3 cursor-pointer accent-[var(--g-brand-3308)]"
      />
      <span>{label}</span>
    </label>
  );
}

function SimuladorReglaCard({
  matter,
  adoptionMode,
  matters,
  matterUnknown,
  onMatterChange,
  onAdoptionChange,
  previewQuery,
  skipVotes,
  onSkipVotesChange,
  capitalPresenteRaw,
  onCapitalPresenteChange,
  votosFavorRaw,
  onVotosFavorChange,
  effectiveSkipVotes,
  votingFiguresIncomplete,
  entityId,
}: {
  matter: string;
  adoptionMode: string;
  matters: MatterEntry[];
  matterUnknown: boolean;
  onMatterChange: (value: string) => void;
  onAdoptionChange: (value: string) => void;
  previewQuery: ReturnType<typeof useAgreementRulePreview>;
  skipVotes: boolean;
  onSkipVotesChange: (value: boolean) => void;
  capitalPresenteRaw: string;
  onCapitalPresenteChange: (value: string) => void;
  votosFavorRaw: string;
  onVotosFavorChange: (value: string) => void;
  effectiveSkipVotes: boolean;
  votingFiguresIncomplete: boolean;
  entityId?: string | null;
}) {
  const result = previewQuery.data;
  return (
    <Card title="Vista previa de requisitos" icon={Gavel}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
            Materia
          </label>
          <select
            aria-label="Materia del acuerdo"
            value={matter}
            onChange={(event) => onMatterChange(event.target.value)}
            className="mt-1 w-full border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:border-[var(--g-brand-3308)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            {matters.map((m) => (
              <option key={m.matter} value={m.matter}>
                {m.label}
              </option>
            ))}
          </select>
          {matterUnknown && (
            <div className="mt-2 border border-[var(--status-warning)] bg-[var(--g-surface-card)] p-2 text-xs text-[var(--g-text-secondary)]" style={{ borderRadius: "var(--g-radius-md)" }}>
              Materia no registrada en el catálogo. Se aplican criterios conservadores hasta darla
              de alta con fuente documental.
              <Link
                to={`/secretaria/catalogo-materias${entityId ? `?entity=${entityId}` : ""}`}
                className="ml-2 font-semibold text-[var(--g-brand-3308)] hover:text-[var(--g-sec-700)]"
              >
                Solicitar alta de materia
              </Link>
            </div>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
            Forma de adopción
          </label>
          <select
            aria-label="Forma de adopción"
            value={adoptionMode}
            onChange={(event) => onAdoptionChange(event.target.value)}
            className="mt-1 w-full border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:border-[var(--g-brand-3308)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            {ADOPTION_MODES.map((mode) => (
              <option key={mode.value} value={mode.value}>
                {mode.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Hipótesis de votación ───────────────────────────────────────── */}
      <div
        className="mt-4 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-3"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
            Hipótesis de votación
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--g-text-primary)]">
            <input
              type="checkbox"
              checked={skipVotes}
              onChange={(event) => onSkipVotesChange(event.target.checked)}
              className="h-3 w-3 cursor-pointer accent-[var(--g-brand-3308)]"
            />
            <span>Pre-votación (no evaluar mayoría pactada)</span>
          </label>
        </div>
        {!skipVotes && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-[10px] font-medium uppercase tracking-wider text-[var(--g-text-secondary)]">
                Capital presente (unidades)
              </label>
              <input
                type="number"
                min="0"
                value={capitalPresenteRaw}
                onChange={(event) => onCapitalPresenteChange(event.target.value)}
                placeholder="ej. 100"
                className="mt-1 w-full border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:border-[var(--g-brand-3308)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium uppercase tracking-wider text-[var(--g-text-secondary)]">
                Votos a favor
              </label>
              <input
                type="number"
                min="0"
                value={votosFavorRaw}
                onChange={(event) => onVotosFavorChange(event.target.value)}
                placeholder="ej. 75"
                className="mt-1 w-full border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:border-[var(--g-brand-3308)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              />
            </div>
          </div>
        )}
        <p className="mt-2 text-[10px] text-[var(--g-text-secondary)]">
          {effectiveSkipVotes
            ? !skipVotes && votingFiguresIncomplete
              ? "Faltan cifras: el simulador trata los pactos de mayoría como pendientes hasta que introduzcas capital presente y votos a favor."
              : "Modo pre-votación: los pactos de mayoría reforzada se reportan como pendientes, no como incumplidos."
            : "Modo con cifras: los pactos de mayoría reforzada se evalúan con los votos suministrados."}
        </p>
      </div>

      {previewQuery.error ? (
        <div className="mt-4">
          <ErrorBanner
            title="No se pudo calcular la regla efectiva"
            message={
              previewQuery.error instanceof Error
                ? previewQuery.error.message
                : "Error desconocido al consultar Cloud."
            }
          />
        </div>
      ) : previewQuery.isLoading ? (
        <Loading label="Calculando regla efectiva…" />
      ) : !previewQuery.enabled ? (
        <p className="mt-4 text-sm text-[var(--g-text-secondary)]">
          Selecciona sociedad, materia y modo de adopción.
        </p>
      ) : !result ? (
        <p className="mt-4 text-sm text-[var(--g-text-secondary)]">
          No se pudo construir la regla efectiva con los datos disponibles.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <ResultStatusBanner status={result.status} isPreVote={effectiveSkipVotes} />
          <ConsequencesList consequences={result.consequences} />
          <RequirementsGrid requirements={result.requirements} isPreVote={effectiveSkipVotes} />
        </div>
      )}
    </Card>
  );
}

// ── Subcomponentes ──────────────────────────────────────────────────────────

function Card({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <div
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[var(--g-brand-3308)]">
        <Icon className="h-3.5 w-3.5" /> {title}
      </div>
      {children}
    </div>
  );
}

function Loading({ label }: { label: string }) {
  return <div className="p-3 text-sm text-[var(--g-text-secondary)]">{label}</div>;
}

function Empty({ label }: { label: string }) {
  return <div className="p-3 text-sm text-[var(--g-text-secondary)]">{label}</div>;
}

function FrameworkStatusChip({ status }: { status: string }) {
  const labelMap: Record<string, string> = {
    COMPLETO: "OK",
    CONFLICTO: "CONFLICTO",
    CONFLICTO_JURISDICCIONAL: "CONFLICTO JURISDICCIONAL",
    DESACTUALIZADO: "REQUIERE REVISIÓN",
    INCOMPLETO: "INCOMPLETO",
    REQUIERE_REVISION: "REQUIERE REVISIÓN",
  };
  const tone =
    status === "COMPLETO" || status === "OK"
      ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
      : status === "INCOMPLETO" || status === "DESACTUALIZADO" || status === "REQUIERE_REVISION"
        ? "bg-[var(--status-warning)] text-[var(--g-text-inverse)]"
        : "bg-[var(--status-error)] text-[var(--g-text-inverse)]";
  return (
    <span
      className={`px-2 py-0.5 text-[10px] uppercase tracking-wider ${tone}`}
      style={{ borderRadius: "var(--g-radius-sm)" }}
    >
      {labelMap[status] ?? status.split("_").join(" ")}
    </span>
  );
}

function SourceStatusDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    ACTIVE: "bg-[var(--status-success)]",
    MISSING: "bg-[var(--status-error)]",
    WARNING: "bg-[var(--status-warning)]",
    CONFLICT: "bg-[var(--status-error)]",
  };
  const tone = map[status] ?? "bg-[var(--g-border-default)]";
  return <span className={`mt-1 inline-block h-2 w-2 ${tone} rounded-full shrink-0`} aria-hidden />;
}

function ResultStatusBanner({ status, isPreVote }: { status: EffectiveAgreementRule["status"]; isPreVote: boolean }) {
  if (isPreVote) {
    return (
      <div
        className="flex items-center gap-2 bg-[var(--status-warning)] px-3 py-2 text-[var(--g-text-inverse)]"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        <AlertTriangle className="h-4 w-4" aria-hidden />
        <span className="text-sm font-medium">
          Validación preliminar. No ejecutable hasta cierre de votación y proclamación.
        </span>
      </div>
    );
  }
  const meta = STATUS_TONE[status];
  const Icon =
    status === "PROCLAMABLE_AND_EXECUTABLE"
      ? CheckCircle2
      : status === "PROCLAMABLE_HELD"
        ? PauseCircle
        : ShieldAlert;
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 ${meta.chip}`}
      style={{ borderRadius: "var(--g-radius-md)" }}
    >
      <Icon className="h-4 w-4" aria-hidden />
      <span className="text-sm font-medium">{meta.label}</span>
    </div>
  );
}

function ConsequencesList({ consequences }: { consequences: EffectiveRuleConsequence[] }) {
  if (consequences.length === 0) {
    return (
      <div className="text-xs text-[var(--g-text-secondary)]">
        Sin consecuencias jurídicas pendientes para esta combinación.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium uppercase tracking-wider text-[var(--g-text-secondary)]">
        Consecuencias jurídicas
      </div>
      <ul className="space-y-2">
        {consequences.map((consequence, index) => (
          <li
            key={`${consequence.source_id ?? "x"}-${index}`}
            className={`flex items-start gap-2 px-3 py-2 ${CONSEQUENCE_TONE_CLASS[CONSEQUENCE_META[consequence.consequence].tone]}`}
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <Shield className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div className="text-xs">
              <div className="font-medium uppercase tracking-wider">
                {CONSEQUENCE_META[consequence.consequence].label}
              </div>
              <div className="mt-0.5">{consequence.reason}</div>
              {consequence.remediation_hint && (
                <div className="mt-1 italic">→ {consequence.remediation_hint}</div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RequirementsGrid({
  requirements,
  isPreVote,
}: {
  requirements: EffectiveAgreementRule["requirements"];
  isPreVote: boolean;
}) {
  return (
    <div className="border-t border-[var(--g-border-subtle)] pt-3">
      <div className="text-xs font-medium uppercase tracking-wider text-[var(--g-text-secondary)]">
        Requisitos por categoría
      </div>
      <div className="mt-2 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
        <RequirementRow label="Convocatoria" required={requirements.convocatoria?.required} notes={requirements.convocatoria?.notes} source="Ley / estatutos" isPreVote={isPreVote} />
        <RequirementRow label="Quórum" required={requirements.quorum?.required} notes={requirements.quorum?.notes} source="Ley / órgano" isPreVote={isPreVote} dependency="Convocatoria" />
        <RequirementRow
          label="Mayoría"
          required={requirements.majority?.code !== null}
          extra={
            requirements.majority?.effective_threshold !== null &&
            requirements.majority?.effective_threshold !== undefined
              ? `${(requirements.majority.effective_threshold * 100).toFixed(1)}% (${requirements.majority.effective_source ?? "—"})`
              : (requirements.majority?.code ?? "—")
          }
          notes={requirements.majority?.notes}
          source="Ley / estatutos / pacto"
          isPreVote={isPreVote}
          dependency="Quórum"
        />
        <RequirementRow
          label="Unanimidad"
          required={requirements.unanimity?.required}
          notes={requirements.unanimity?.notes}
          source="Ley / forma de adopción"
          isPreVote={isPreVote}
          dependency="Votación"
        />
        <RequirementRow
          label="Veto pactado"
          required={requirements.veto?.applies}
          extra={requirements.veto?.titulares.join(", ") || undefined}
          notes={requirements.veto?.notes}
          source="Pacto parasocial"
          isPreVote={isPreVote}
        />
        <RequirementRow
          label="Consentimiento previo"
          required={requirements.consent?.required}
          extra={requirements.consent?.from.join(", ") || undefined}
          notes={requirements.consent?.notes}
          source="Pacto parasocial"
          isPreVote={isPreVote}
        />
        <RequirementRow
          label="Inscripción registral"
          required={requirements.registry?.required}
          notes={requirements.registry?.notes}
          source="Registro Mercantil"
          isPreVote={isPreVote}
          dependency="Elevación a público"
        />
        <RequirementRow
          label="Publicación supervisor"
          required={requirements.publication?.required}
          notes={requirements.publication?.notes}
          source="Ley / supervisor"
          isPreVote={isPreVote}
        />
      </div>
      {requirements.documentation.length > 0 && (
        <div className="mt-3 border-t border-[var(--g-border-subtle)] pt-2">
          <div className="text-xs font-medium uppercase tracking-wider text-[var(--g-text-secondary)]">
            Documentación / formalización
          </div>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-[var(--g-text-secondary)]">
            {requirements.documentation.map((req, index) => (
              <li key={index}>
                <span className="font-medium text-[var(--g-text-primary)]">{req.label}</span>
                {req.status === "REQUIRED" ? " (requerido)" : req.status === "CONDITIONAL" ? " (condicional)" : " (informativo)"}
                {" — "}
                {req.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function MaintenanceHistoryCard({
  history,
  role,
  entityId,
  matter,
}: {
  history: ReturnType<typeof buildNormativeHistoryEntries>;
  role: ReturnType<typeof normativeRoleFromAppRole>;
  entityId: string;
  matter: string;
}) {
  const resolveDecision = canPerformNormativeAction(role, "resolve_conflict");
  const auditEvent = buildNormativeAuditEvent({
    action: "effective_rule_viewed",
    societyId: entityId,
    matter,
    userRole: role,
  });
  const telemetryEvent = buildNormativeTelemetryEvent(auditEvent);
  return (
    <Card title="Historial y trazabilidad" icon={BookMarked}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          {history.length === 0 ? (
            <p className="text-sm text-[var(--g-text-secondary)]">
              No hay historial estructurado de fuentes para esta combinación.
            </p>
          ) : (
            <ul className="space-y-2">
              {history.slice(0, 6).map((item) => (
                <li
                  key={item.id}
                  className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-3 text-xs text-[var(--g-text-secondary)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <div className="font-semibold text-[var(--g-text-primary)]">{item.action}</div>
                  <div>{item.after}</div>
                  <div className="mt-1">{item.comment}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-3" style={{ borderRadius: "var(--g-radius-md)" }}>
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-primary)]">
            Gobernanza
          </div>
          <p className="mt-2 text-xs text-[var(--g-text-secondary)]">
            Evento preparado: {auditEvent.action}. Rol operativo: {auditEvent.userRole}.
          </p>
          <p className="mt-2 text-xs text-[var(--g-text-secondary)]">
            Telemetría preparada para la consulta de regla efectiva · sociedad {telemetryEvent.attributes.society_id}.
          </p>
          <button
            type="button"
            disabled={!resolveDecision.allowed}
            aria-disabled={!resolveDecision.allowed}
            className={`mt-3 w-full px-3 py-2 text-xs font-semibold ${
              resolveDecision.allowed
                ? "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)]"
                : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
            }`}
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            {resolveDecision.ctaLabel}
          </button>
          {resolveDecision.reason ? (
            <p className="mt-2 text-xs text-[var(--g-text-secondary)]">{resolveDecision.reason}</p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function RequirementRow({
  label,
  required,
  notes,
  extra,
  source,
  dependency,
  isPreVote,
}: {
  label: string;
  required?: boolean;
  notes?: string[];
  extra?: string;
  source: string;
  dependency?: string;
  isPreVote: boolean;
}) {
  const state: RequirementOperationalState = required ? (isPreVote ? "pendiente" : "cumplido") : "no_aplica";
  const stateTone =
    state === "cumplido"
      ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
      : state === "pendiente"
        ? "bg-[var(--status-warning)] text-[var(--g-text-inverse)]"
        : "bg-[var(--g-surface-card)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]";
  return (
    <div
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-2"
      style={{ borderRadius: "var(--g-radius-md)" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-[var(--g-text-secondary)]">
          {label}
        </span>
        <span
          className={`px-2 py-0.5 text-[10px] uppercase tracking-wider ${stateTone}`}
          style={{ borderRadius: "var(--g-radius-sm)" }}
        >
          {requirementStateLabel(state)}
        </span>
      </div>
      <div className="mt-1 text-[10px] text-[var(--g-text-secondary)]">Fuente: {source}</div>
      {dependency ? (
        <div className="mt-1 text-[10px] text-[var(--g-text-secondary)]">Depende de: {dependency}</div>
      ) : null}
      {extra && (
        <div className="mt-1 text-xs font-medium text-[var(--g-text-primary)]">{extra}</div>
      )}
      {notes && notes.length > 0 && (
        <ul className="mt-1 list-none space-y-0.5 text-xs text-[var(--g-text-secondary)]">
          {notes.map((note, index) => (
            <li key={index} className="flex items-start gap-1">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
              <span>{note}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TopAction({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: ElementType;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-xs font-semibold text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
      style={{ borderRadius: "var(--g-radius-md)" }}
    >
      <Icon className="h-3.5 w-3.5 text-[var(--g-brand-3308)]" />
      {label}
    </Link>
  );
}
