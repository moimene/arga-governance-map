import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, FileCheck2, Hash, Loader2, RefreshCw, Send } from "lucide-react";
import { useSecretariaScope } from "@/components/secretaria/shell";
import { useEntitiesList } from "@/hooks/useEntities";
import { usePresidenteVigente } from "@/hooks/useAuthorityEvidence";
import { useHasCapability } from "@/hooks/useCapabilityMatrix";
import { useCurrentUserRole } from "@/hooks/useCurrentUser";
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

export default function CertificacionesAutonomas() {
  const scope = useSecretariaScope();
  const [searchParams] = useSearchParams();
  const { data: entities = [] } = useEntitiesList({ sociedadesOnly: true });
  const { primaryRole } = useCurrentUserRole();
  const canCertify = useHasCapability(primaryRole, "CERTIFICATION");
  const { data: kinds = [], isLoading: kindsLoading, error: kindsError } = useStandaloneCertificationKinds();
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
              onChange={(e) => setEntityId(e.target.value)}
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
          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--g-text-primary)]">Órgano</span>
            <input
              value={bodyId}
              onChange={(e) => setBodyId(e.target.value)}
              placeholder="UUID opcional"
              className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)] focus:ring-2 focus:ring-[var(--g-border-focus)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
          </label>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {[
            ["Persona", personId, setPersonId],
            ["Cargo/condición", conditionId, setConditionId],
            ["Libro", bookId, setBookId],
            ["Movimiento", movementId, setMovementId],
            ["Acuerdo", agreementId, setAgreementId],
            ["Decisión", decisionId, setDecisionId],
          ].map(([label, value, setter]) => (
            <label key={label as string} className="space-y-1 text-sm">
              <span className="font-medium text-[var(--g-text-primary)]">{label as string}</span>
              <input
                value={value as string}
                onChange={(e) => (setter as (next: string) => void)(e.target.value)}
                placeholder="UUID opcional"
                className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)] focus:ring-2 focus:ring-[var(--g-border-focus)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              />
            </label>
          ))}
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
            Tu rol actual puede consultar certificaciones y hashes, pero no preparar ni emitir certificaciones.
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
