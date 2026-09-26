import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, FileCheck2, Hash, Loader2, RefreshCw, Send } from "lucide-react";
import { useSecretariaScope } from "@/components/secretaria/shell";
import { useEntitiesList } from "@/hooks/useEntities";
import { usePresidenteVigente } from "@/hooks/useAuthorityEvidence";
import { useHasCapability } from "@/hooks/useCapabilityMatrix";
import { useCurrentUserRole } from "@/hooks/useCurrentUser";
import { useBodiesByEntity } from "@/hooks/useBodies";
import { usePersonasCanonical } from "@/hooks/usePersonasCanonical";
import { CARGO_LABELS, useCargosPersona } from "@/hooks/useCargos";
import { useLibrosList } from "@/hooks/useLibros";
import { persistedBookIdForActions } from "@/lib/secretaria/libros-societarios";
import { useCapitalMovements } from "@/hooks/useCapitalMovements";
import { useAgreementsList } from "@/hooks/useAgreementsList";
import { useDecisionesUnipersList } from "@/hooks/useDecisionesUnipers";
import {
  useCreateStandaloneCertification,
  useEmitStandaloneCertification,
  useGenerateStandaloneCertificationDocument,
  usePrepareStandaloneCertificationSource,
  useStandaloneCertificationKinds,
  useStandaloneCertifications,
  type PreparedStandaloneCertificationSource,
  type StandaloneCertificationKindRow,
  type StandaloneCertificationRow,
} from "@/hooks/useStandaloneCertifications";
import { legalEffectLabel, statusLabel } from "@/lib/secretaria/status-labels";
import { EvidenceStatusBadge } from "@/components/secretaria/EvidenceStatusBadge";
import { filterCertificationKindsInScope } from "@/lib/secretaria/certification-kind-scope";

function pickDefaultKind(kinds: StandaloneCertificationKindRow[]) {
  return (
    kinds.find((kind) => kind.kind_code === "CERT_LIBRO_SOCIOS_TITULARIDAD") ??
    kinds[0] ??
    null
  );
}

function sourceInputForKind(params: {
  kindCode: string;
  entityId: string;
  bodyId: string;
  personId: string;
  conditionId: string;
  bookId: string;
  movementId: string;
  agreementId: string;
  decisionId: string;
  certificanteRole: string;
  vistoBuenoPersonaId?: string | null;
}) {
  const input: Record<string, unknown> = {
    entity_id: params.entityId,
    certificante_role: params.certificanteRole,
  };
  if (params.bodyId) input.body_id = params.bodyId;
  if (params.vistoBuenoPersonaId) input.visto_bueno_persona_id = params.vistoBuenoPersonaId;

  if (params.kindCode === "CERT_LIBRO_SOCIOS_TITULARIDAD" && params.personId) input.person_id = params.personId;
  if (params.kindCode === "CERT_LIBRO_SOCIOS_TRANSMISION") {
    if (params.movementId) input.movement_id = params.movementId;
    if (params.agreementId) input.agreement_id = params.agreementId;
  }
  if (params.kindCode === "CERT_VIGENCIA_CARGO") {
    if (params.conditionId) input.condition_id = params.conditionId;
    if (params.personId) input.person_id = params.personId;
  }
  if (params.kindCode === "CERT_LIBROS_LEGALIZACION" && params.bookId) input.book_id = params.bookId;
  if ((params.kindCode === "CERT_ACUERDO_360" || params.kindCode === "CERT_ACUERDO_SIN_SESION") && params.agreementId) {
    input.agreement_id = params.agreementId;
  }
  if (params.kindCode === "CERT_DECISION_SOCIO_UNICO" && params.decisionId) input.decision_id = params.decisionId;
  return input;
}

function StatusChip({ status }: { status: string }) {
  const cls =
    status === "EMITTED" || status === "SIGNED"
      ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
      : status === "SUPERSEDED" || status === "REVOKED" || status === "FAILED"
        ? "bg-[var(--status-error)] text-[var(--g-text-inverse)]"
        : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]";
  return (
    <span className={`inline-flex px-2 py-0.5 text-xs font-medium ${cls}`} style={{ borderRadius: "var(--g-radius-full)" }}>
      {statusLabel(status)}
    </span>
  );
}

function metadataString(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : null;
}

function shortHash(value?: string | null) {
  if (!value) return "Pendiente";
  return value.length > 22 ? `${value.slice(0, 12)}...${value.slice(-8)}` : value;
}

interface ReferenceOption {
  value: string;
  label: string;
}

/**
 * Selector de referencia (órgano, persona, cargo, libro, movimiento, acuerdo,
 * decisión) que sustituye a los antiguos inputs de texto libre (MOI-195).
 * Nunca pintar un placeholder que invite a escribir a mano un identificador
 * interno de la base de datos: `src/test/schema/secretaria-informes-certificaciones.test.ts`
 * falla si reaparece.
 */
function ReferenceSelect({
  label,
  value,
  onChange,
  options,
  loading,
  emptyMessage,
  disabled,
  placeholder = "Sin seleccionar",
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: ReferenceOption[];
  loading?: boolean;
  emptyMessage?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  const blankLabel = loading ? "Cargando…" : options.length === 0 && emptyMessage ? emptyMessage : placeholder;
  return (
    <label className="space-y-1 text-sm">
      <span className="font-medium text-[var(--g-text-primary)]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || loading}
        aria-busy={loading}
        className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:ring-2 focus:ring-[var(--g-border-focus)] disabled:opacity-60"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        <option value="">{blankLabel}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function CertificacionesAutonomas() {
  const scope = useSecretariaScope();
  const [searchParams] = useSearchParams();
  const { data: entities = [] } = useEntitiesList({ sociedadesOnly: true });
  const { primaryRole } = useCurrentUserRole();
  const canCertify = useHasCapability(primaryRole, "CERTIFICATION");
  const { data: allKinds = [], isLoading: kindsLoading, error: kindsError } = useStandaloneCertificationKinds();
  // Cloud tiene tipos ACTIVOS que afirman ERDS, entrega o firma cualificada:
  // capacidades que EAD Trust no presta en el alcance vigente. El dato no se
  // toca desde aquí, así que el selector no las ofrece. Criterio y prueba en
  // `certification-kind-scope.ts`.
  const kinds = useMemo(() => filterCertificationKindsInScope(allKinds), [allKinds]);
  const fueraDeAlcance = allKinds.length - kinds.length;
  const defaultKind = useMemo(() => pickDefaultKind(kinds), [kinds]);
  const [entityId, setEntityId] = useState(searchParams.get("entity") ?? scope.selectedEntity?.id ?? "");
  const effectiveEntityId = entityId || scope.selectedEntity?.id || entities[0]?.id || "";
  const [kindCode, setKindCode] = useState(searchParams.get("kind") ?? "");
  const effectiveKindCode = kindCode || defaultKind?.kind_code || "";
  const selectedKind = kinds.find((kind) => kind.kind_code === effectiveKindCode) ?? defaultKind;
  const effectiveEntity =
    entities.find((entity) => entity.id === effectiveEntityId) ??
    (scope.selectedEntity
      ? {
          id: scope.selectedEntity.id,
          common_name: scope.selectedEntity.name,
          legal_name: scope.selectedEntity.legalName,
        }
      : null);
  const effectiveEntityName = effectiveEntity?.common_name || effectiveEntity?.legal_name || undefined;
  const [bodyId, setBodyId] = useState(searchParams.get("body") ?? "");
  const [personId, setPersonId] = useState(searchParams.get("person") ?? "");
  const [conditionId, setConditionId] = useState(searchParams.get("condition") ?? "");
  const [bookId, setBookId] = useState(searchParams.get("book") ?? "");
  const [movementId, setMovementId] = useState(searchParams.get("movement") ?? "");
  const [agreementId, setAgreementId] = useState(searchParams.get("agreement") ?? "");
  const [decisionId, setDecisionId] = useState(searchParams.get("decision") ?? "");
  const [issuedTo, setIssuedTo] = useState("");
  const [certificanteRole, setCertificanteRole] = useState("SECRETARIO");
  const [prepared, setPrepared] = useState<PreparedStandaloneCertificationSource | null>(null);

  useEffect(() => {
    const nextEntity = searchParams.get("entity");
    const nextKind = searchParams.get("kind");
    const nextBody = searchParams.get("body");
    const nextPerson = searchParams.get("person");
    const nextCondition = searchParams.get("condition");
    const nextBook = searchParams.get("book");
    const nextMovement = searchParams.get("movement");
    const nextAgreement = searchParams.get("agreement");
    const nextDecision = searchParams.get("decision");
    if (nextEntity) setEntityId(nextEntity);
    if (nextKind) setKindCode(nextKind);
    if (nextBody) setBodyId(nextBody);
    if (nextPerson) setPersonId(nextPerson);
    if (nextCondition) setConditionId(nextCondition);
    if (nextBook) setBookId(nextBook);
    if (nextMovement) setMovementId(nextMovement);
    if (nextAgreement) setAgreementId(nextAgreement);
    if (nextDecision) setDecisionId(nextDecision);
  }, [searchParams]);

  const { data: presidente } = usePresidenteVigente(effectiveEntityId || undefined, bodyId || null);
  const sourceInput = useMemo(
    () =>
      effectiveKindCode && effectiveEntityId
        ? sourceInputForKind({
            kindCode: effectiveKindCode,
            entityId: effectiveEntityId,
            bodyId,
            personId,
            conditionId,
            bookId,
            movementId,
            agreementId,
            decisionId,
            certificanteRole,
            vistoBuenoPersonaId: selectedKind?.requires_visto_bueno ? presidente?.person_id : null,
          })
        : {},
    [
      agreementId,
      bodyId,
      bookId,
      certificanteRole,
      conditionId,
      decisionId,
      effectiveEntityId,
      effectiveKindCode,
      movementId,
      personId,
      presidente?.person_id,
      selectedKind?.requires_visto_bueno,
    ],
  );
  const certifications = useStandaloneCertifications({ entityId: effectiveEntityId || null });
  const prepareSource = usePrepareStandaloneCertificationSource();
  const createCert = useCreateStandaloneCertification();
  const generateCertDocument = useGenerateStandaloneCertificationDocument();
  const emitCert = useEmitStandaloneCertification();

  // MOI-195: cada referencia se elige de una lista del propio grupo, nunca se
  // escribe a mano. Todas se filtran por el tenant de la sesión (vía los
  // hooks) y, cuando aplica, por la sociedad seleccionada.
  const { data: bodies = [], isLoading: bodiesLoading } = useBodiesByEntity(effectiveEntityId || undefined);
  const { data: personas = [], isLoading: personasLoading } = usePersonasCanonical();
  const { data: cargosPersona = [], isLoading: cargosLoading } = useCargosPersona(personId || undefined);
  const { data: librosRaw = [], isLoading: librosLoading } = useLibrosList(effectiveEntityId || null);
  const { data: movimientos = [], isLoading: movimientosLoading } = useCapitalMovements(effectiveEntityId || undefined);
  const { data: agreementsAll = [], isLoading: agreementsLoading } = useAgreementsList();
  const { data: decisiones = [], isLoading: decisionesLoading } = useDecisionesUnipersList(effectiveEntityId || null);

  const bodyOptions: ReferenceOption[] = useMemo(
    () => bodies.map((b) => ({ value: b.id, label: b.name })),
    [bodies],
  );
  const personaOptions: ReferenceOption[] = useMemo(
    () => personas.map((p) => ({ value: p.id, label: p.tax_id ? `${p.full_name} (${p.tax_id})` : p.full_name })),
    [personas],
  );
  const cargoOptions: ReferenceOption[] = useMemo(
    () =>
      cargosPersona
        .filter((c) => c.estado === "VIGENTE" && c.entity_id === effectiveEntityId)
        .map((c) => ({
          value: c.id,
          label: `${CARGO_LABELS[c.tipo_condicion] ?? c.tipo_condicion}${c.body?.name ? ` · ${c.body.name}` : ""}`,
        })),
    [cargosPersona, effectiveEntityId],
  );
  const libroOptions: ReferenceOption[] = useMemo(
    () =>
      librosRaw
        .map((b) => ({ id: persistedBookIdForActions(b), label: `${b.display_label} · vol. ${b.volume_number}/${b.period}` }))
        .filter((o): o is { id: string; label: string } => !!o.id)
        .map((o) => ({ value: o.id, label: o.label })),
    [librosRaw],
  );
  const movimientoOptions: ReferenceOption[] = useMemo(
    () =>
      movimientos.map((m) => ({
        value: m.id,
        label: `${new Date(m.effective_date).toLocaleDateString("es-ES")} · ${m.movement_type}${
          m.persons?.full_name ? ` · ${m.persons.full_name}` : ""
        }`,
      })),
    [movimientos],
  );
  const agreementOptions: ReferenceOption[] = useMemo(
    () =>
      agreementsAll
        .filter((a) => !effectiveEntityId || a.entity_id === effectiveEntityId)
        .map((a) => ({
          value: a.id,
          label: `${a.agreement_kind}${a.decision_date ? ` · ${new Date(a.decision_date).toLocaleDateString("es-ES")}` : ""} · ${statusLabel(a.status)}`,
        })),
    [agreementsAll, effectiveEntityId],
  );
  const decisionOptions: ReferenceOption[] = useMemo(
    () =>
      decisiones.map((d) => ({
        value: d.id,
        label: `${d.title}${d.decision_date ? ` · ${new Date(d.decision_date).toLocaleDateString("es-ES")}` : ""}`,
      })),
    [decisiones],
  );

  function handleEntityChange(nextEntityId: string) {
    setEntityId(nextEntityId);
    setBodyId("");
    setPersonId("");
    setConditionId("");
    setBookId("");
    setMovementId("");
    setAgreementId("");
    setDecisionId("");
    setPrepared(null);
  }

  function handlePersonChange(nextPersonId: string) {
    setPersonId(nextPersonId);
    setConditionId("");
  }

  async function handlePrepare() {
    if (!effectiveKindCode || !effectiveEntityId) return;
    try {
      const result = await prepareSource.mutateAsync({ kindCode: effectiveKindCode, sourceInput });
      setPrepared(result);
      toast.success("Fuente preparada", { description: result.source_hash });
    } catch (e) {
      toast.error("No se pudo preparar la fuente", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  async function handleCreate() {
    if (!effectiveKindCode || !effectiveEntityId) return;
    try {
      const certId = await createCert.mutateAsync({
        kindCode: effectiveKindCode,
        sourceInput,
        issuedTo: issuedTo || null,
        capa3: { issued_to: issuedTo || null },
      });
      toast.success("Certificación creada", { description: certId });
      setPrepared(null);
    } catch (e) {
      toast.error("No se pudo crear la certificación", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  async function handleEmit(cert: StandaloneCertificationRow) {
    try {
      const needsArchive =
        !cert.artifact?.document_url ||
        !cert.artifact.hash_sha512 ||
        !cert.artifact.evidence_bundle_id ||
        !cert.evidence_bundle_id;
      if (needsArchive) {
        await generateCertDocument.mutateAsync({
          certification: cert,
          entityName: effectiveEntityName,
        });
      }
      const uri = await emitCert.mutateAsync({ certificationId: cert.id, artifactId: cert.artifact_id });
      toast.success("Certificación emitida", { description: uri });
    } catch (e) {
      toast.error("No se pudo emitir la certificación", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
            <FileCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
            Secretaría · Documentación
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
            Certificaciones autónomas
          </h1>
          <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
            Emisión desde libros, registros, capital, cargos y fuentes canónicas con huella propia.
          </p>
        </div>
        <button
          type="button"
          onClick={() => certifications.refetch()}
          className="inline-flex items-center justify-center gap-2 border border-[var(--g-border-subtle)] px-3 py-2 text-sm font-medium text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
          aria-busy={certifications.isFetching}
        >
          {certifications.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Actualizar
        </button>
      </div>

      {kindsError ? (
        <div
          role="alert"
          className="flex items-start gap-3 border border-[var(--status-warning)]/40 bg-[var(--status-warning)]/10 p-4 text-sm text-[var(--g-text-primary)]"
          style={{ borderRadius: "var(--g-radius-lg)" }}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 text-[var(--status-warning)]" />
          <div>
            <p className="font-semibold">Schema pendiente</p>
            <p className="mt-1 text-[var(--g-text-secondary)]">
              Aplica la migración de informes y certificaciones antes de usar esta bandeja.
            </p>
          </div>
        </div>
      ) : null}

      <section
        className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-5"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--g-text-primary)]">Sociedad</span>
            <select
              value={effectiveEntityId}
              onChange={(e) => handleEntityChange(e.target.value)}
              className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:ring-2 focus:ring-[var(--g-border-focus)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              {entities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.common_name || entity.legal_name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm lg:col-span-2">
            <span className="font-medium text-[var(--g-text-primary)]">Tipo</span>
            <select
              value={effectiveKindCode}
              onChange={(e) => {
                setKindCode(e.target.value);
                setPrepared(null);
              }}
              disabled={kindsLoading}
              className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:ring-2 focus:ring-[var(--g-border-focus)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              {kinds.map((kind) => (
                <option key={kind.id} value={kind.kind_code}>
                  {kind.label}
                </option>
              ))}
            </select>

            {fueraDeAlcance > 0 ? (
              <p className="text-xs text-[var(--g-text-secondary)]" role="note">
                {fueraDeAlcance === 1
                  ? "1 tipo configurado no se ofrece"
                  : `${fueraDeAlcance} tipos configurados no se ofrecen`}
                : su enunciado atribuye a un tercero capacidades de firma, envío o entrega que no están
                disponibles en el alcance vigente.
              </p>
            ) : null}
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--g-text-primary)]">Rol certificante</span>
            <select
              value={certificanteRole}
              onChange={(e) => setCertificanteRole(e.target.value)}
              className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:ring-2 focus:ring-[var(--g-border-focus)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <option value="SECRETARIO">Secretario</option>
              <option value="VICESECRETARIO">Vicesecretario</option>
              <option value="ADMIN_UNICO">Administrador único</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--g-text-primary)]">Destinatario</span>
            <input
              value={issuedTo}
              onChange={(e) => setIssuedTo(e.target.value)}
              className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:ring-2 focus:ring-[var(--g-border-focus)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
          </label>
          <ReferenceSelect
            label="Órgano"
            value={bodyId}
            onChange={setBodyId}
            options={bodyOptions}
            loading={bodiesLoading}
            emptyMessage="Esta sociedad no tiene órganos registrados"
          />
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <ReferenceSelect
            label="Persona"
            value={personId}
            onChange={handlePersonChange}
            options={personaOptions}
            loading={personasLoading}
            emptyMessage="No hay personas registradas"
          />
          <ReferenceSelect
            label="Cargo/condición"
            value={conditionId}
            onChange={setConditionId}
            options={cargoOptions}
            loading={cargosLoading}
            disabled={!personId}
            emptyMessage={personId ? "Esta persona no tiene cargos vigentes en la sociedad" : "Selecciona primero una persona"}
          />
          <ReferenceSelect
            label="Libro"
            value={bookId}
            onChange={setBookId}
            options={libroOptions}
            loading={librosLoading}
            emptyMessage="Esta sociedad no tiene libros registrados"
          />
          <ReferenceSelect
            label="Movimiento"
            value={movementId}
            onChange={setMovementId}
            options={movimientoOptions}
            loading={movimientosLoading}
            emptyMessage="Esta sociedad no tiene movimientos de capital registrados"
          />
          <ReferenceSelect
            label="Acuerdo"
            value={agreementId}
            onChange={setAgreementId}
            options={agreementOptions}
            loading={agreementsLoading}
            emptyMessage="Esta sociedad no tiene acuerdos registrados"
          />
          <ReferenceSelect
            label="Decisión"
            value={decisionId}
            onChange={setDecisionId}
            options={decisionOptions}
            loading={decisionesLoading}
            emptyMessage="Esta sociedad no tiene decisiones unipersonales registradas"
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handlePrepare}
            disabled={!canCertify || !effectiveKindCode || !effectiveEntityId || prepareSource.isPending}
            aria-busy={prepareSource.isPending}
            className="inline-flex items-center gap-2 border border-[var(--g-border-subtle)] px-4 py-2 text-sm font-medium text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] disabled:opacity-60"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            {prepareSource.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Hash className="h-4 w-4" />}
            Preparar fuente
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!canCertify || !effectiveKindCode || !effectiveEntityId || createCert.isPending}
            aria-busy={createCert.isPending}
            className="inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] disabled:opacity-60"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            {createCert.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />}
            Crear certificación
          </button>
        </div>

        {selectedKind?.requires_visto_bueno ? (
          <p className="mt-3 text-xs text-[var(--g-text-secondary)]">
            Vº Bº precargado: {presidente?.person?.full_name ?? "pendiente de autoridad vigente"}.
          </p>
        ) : null}
        {!canCertify ? (
          <p className="mt-3 text-xs text-[var(--g-text-secondary)]">
            Tu rol puede consultar esta información, pero no ejecutar esta acción.
          </p>
        ) : null}
        {prepared ? (
          <div
            className="mt-4 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)]/40 p-3 text-sm"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <div className="flex items-center gap-2 font-medium text-[var(--g-text-primary)]">
              <CheckCircle2 className="h-4 w-4 text-[var(--status-success)]" />
              Fuente canónica preparada
            </div>
            <p className="mt-2 break-all font-mono text-xs text-[var(--g-text-secondary)]">{prepared.source_hash}</p>
          </div>
        ) : null}
      </section>

      <section
        className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="border-b border-[var(--g-border-subtle)] px-5 py-4">
          <h2 className="text-base font-semibold text-[var(--g-text-primary)]">Emitidas y preparadas</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--g-border-subtle)]">
            <thead>
              <tr className="bg-[var(--g-surface-subtle)]">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--g-text-primary)]">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--g-text-primary)]">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--g-text-primary)]">Huella de fuente</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--g-text-primary)]">Evidencia</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-[var(--g-text-primary)]">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--g-border-subtle)]">
              {(certifications.data ?? []).map((cert) => (
                <tr key={cert.id} className="hover:bg-[var(--g-surface-subtle)]/50">
                  <td className="px-4 py-3 text-sm text-[var(--g-text-primary)]">
                    <div className="font-medium">{cert.kind?.label ?? cert.kind_code}</div>
                    <div className="text-xs text-[var(--g-text-secondary)]">{legalEffectLabel(cert.legal_effect)}</div>
                  </td>
                  <td className="px-4 py-3"><StatusChip status={cert.status} /></td>
                  <td className="max-w-[320px] px-4 py-3">
                    <p className="truncate font-mono text-xs text-[var(--g-text-secondary)]">{cert.source_hash}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--g-text-secondary)]">
                    <EvidenceStatusBadge status={cert.artifact?.evidence_status} />
                    <div className="mt-1 font-mono text-[11px] text-[var(--g-text-secondary)]">
                      Anexos: {shortHash(metadataString(cert.artifact?.metadata, "annex_manifest_hash"))}
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-[var(--g-text-secondary)]">
                      SHA-512: {shortHash(cert.artifact?.hash_sha512)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleEmit(cert)}
                      disabled={!canCertify || cert.status === "EMITTED" || emitCert.isPending || generateCertDocument.isPending}
                      aria-busy={emitCert.isPending || generateCertDocument.isPending}
                      className="inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-3 py-1.5 text-xs font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] disabled:opacity-60"
                      style={{ borderRadius: "var(--g-radius-md)" }}
                    >
                      {emitCert.isPending || generateCertDocument.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                      Emitir
                    </button>
                  </td>
                </tr>
              ))}
              {certifications.data?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-[var(--g-text-secondary)]">
                    No hay certificaciones autónomas para la sociedad seleccionada.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
