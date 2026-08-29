import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Loader2, AlertTriangle, CheckCircle2, Gavel } from "lucide-react";
import { toast } from "sonner";
import { StepperShell, type StepDef } from "./_shared/StepperShell";
import { useAgreementsList, useAgreementById, type AgreementListRow } from "@/hooks/useAgreementsList";
import { useEntitiesList } from "@/hooks/useEntities";
import { useBodiesByEntity } from "@/hooks/useBodies";
import { resolveOrganoTipoStrict } from "@/lib/secretaria/organo-resolver";
import { isUnreliableRulePackSelection } from "@/lib/secretaria/rule-pack-selection";
import {
  RegistryRuleProvenanceNotice,
  type RegistryRuleProvenance,
} from "@/components/secretaria/RegistryRuleProvenanceNotice";
import { useRulePackForMateria } from "@/hooks/useRulePackForMateria";
import { useModelosAcuerdo } from "@/hooks/useModelosAcuerdo";
import { useCertificationRegistryIntake, useTramitacionById, useAgreementHasCertification } from "@/hooks/useTramitador";
import { useTenantContext } from "@/context/TenantContext";
import { useTenantBranding } from "@/context/TenantBrandContext";
import { groupFullLabel } from "@/lib/tenant-brand-labels";
import { supabase } from "@/integrations/supabase/client";
import { ProcessDocxButton } from "@/components/secretaria/ProcessDocxButton";
import { Capa3CaptureDialog } from "@/components/secretaria/Capa3CaptureDialog";
import {
  useCreateSecretariaDocumentArtifact,
  useDocumentAnnexLinks,
  useSecretariaDocumentArtifacts,
  useSecretariaDocumentArtifactsByIds,
  type DocumentAnnexLinkRow,
} from "@/hooks/useSecretariaDocumentArtifacts";
import {
  usePrepareRegistryFiling,
  useRegistryFilingEvents,
  useRecordRegistryPresentation,
  useSubmitRegistryRemedy,
} from "@/hooks/useRegistryLifecycle";
import { useUploadRegistryEvidenceArtifact } from "@/hooks/useRegistryEvidenceUpload";
import type { ProcessDocumentGenerationResult } from "@/lib/doc-gen/process-documents";
import type { RegistryBaseDocumentKind } from "@/lib/secretaria/registry-lifecycle";
import { validateCapa3 } from "@/lib/secretaria/capa3-form-validation";
import { capa3ValueHasContent, type Capa3Values } from "@/lib/secretaria/capa3-fields";
import type { PlantillaProtegidaRow } from "@/hooks/usePlantillasProtegidas";
import { resolveTemplateProcessMatrix } from "@/lib/secretaria/template-process-matrix";
import { buildPrototypeRegistryRulePackFallback } from "@/lib/secretaria/prototype-registry-rule-fallback";
import { registryChannelsForJurisdiction } from "@/lib/secretaria/registry-channels";
import { statusLabel } from "@/lib/secretaria/status-labels";
import { adoptionModeBusinessLabel, matterClassBusinessLabel } from "@/lib/secretaria/mesa-control-societaria";
import { resolveAdoptionRoute } from "@/lib/secretaria/adoption-routing";
import { resolveRegistryProcedureProfile } from "@/lib/secretaria/registry-procedure-profile";
import { extractRulePackAdoptionModes } from "@/lib/secretaria/materia-catalog-ux";
import { labelMateria } from "@/lib/secretaria/agenda-materias";
import { MatterExecutionProfilePanel } from "@/components/secretaria/MatterExecutionProfilePanel";
import { RegistryLifecycleActions } from "@/components/secretaria/RegistryLifecycleActions";
import {
  buildRegistryFallback,
  buildRegistryVariables,
  registryDocumentGeneratedAt,
} from "@/lib/secretaria/registry-document-variables";
import { resolveRegistryEventTimelineDate } from "@/lib/secretaria/workflow-date-semantics";

const STEPS: StepDef[] = [
  {
    n: 1,
    label: "Seleccionar acuerdo",
    hint: "El acuerdo debe estar certificado o adoptado para tramitación",
  },
  {
    n: 2,
    label: "Vía de presentación",
    hint: "Análisis del instrumento requerido (escritura/instancia) según motor de reglas",
  },
  {
    n: 3,
    label: "Datos del instrumento",
    hint: "Notaría, fecha de escritura y datos registrales",
  },
  {
    n: 4,
    label: "Presentación",
    hint: "Preparación registral demo por Registro Mercantil (ES), SIGER/PSM (MX), JUCERJA (BR) o Conservatória (PT) según jurisdicción",
  },
  {
    n: 5,
    label: "Seguimiento",
    hint: "Monitorización de estado, subsanaciones y publicación",
  },
];

function buildSubsanacionFallback({
  agreement,
  entityName,
  legalName,
  subsanacionMotivo,
  subsanacionDocs,
}: {
  agreement: AgreementListRow;
  entityName: string;
  legalName: string;
  subsanacionMotivo: string;
  subsanacionDocs: string;
}) {
  return [
    "RESPUESTA DE SUBSANACION REGISTRAL",
    "",
    `Sociedad: ${legalName || entityName}`,
    `Acuerdo: ${agreement.agreement_kind}`,
    "",
    "MOTIVO",
    subsanacionMotivo || "Sin motivo informado.",
    "",
    "DOCUMENTOS ADJUNTOS",
    subsanacionDocs || "Sin documentos informados.",
  ].join("\n");
}

type TramitacionDetalleRow = {
  workflow_version?: number | null;
  entity_id?: string | null;
  base_document_kind?: string | null;
  base_document_artifact_id?: string | null;
  qualification_outcome?: string | null;
  agreement_id?: string | null;
  filing_number?: string | null;
  filing_via?: string | null;
  presentation_date?: string | null;
  status?: string | null;
  estimated_resolution?: string | null;
  notary_name?: string | null;
  deed_date?: string | null;
  protocol_number?: string | null;
  elevated_at?: string | null;
  inscription_number?: string | null;
  borme_ref?: string | null;
  psm_ref?: string | null;
  siger_ref?: string | null;
  conservatoria_ref?: string | null;
  jucerja_ref?: string | null;
  deeds?: {
    notary?: string | null;
    deed_date?: string | null;
    status?: string | null;
  } | null;
};

const REGISTRY_EVENT_LABEL: Record<string, string> = {
  EXPEDIENTE_PREPARADO: "Expediente preparado",
  DOCUMENTO_BASE_VINCULADO: "Documento base vinculado",
  PRESENTACION_ASENTADA: "Presentación registrada",
  CALIFICACION_REGISTRADA: "Calificación registrada",
  SUBSANACION_PREPARADA: "Subsanación preparada",
  SUBSANACION_PRESENTADA: "Subsanación presentada",
  INSCRIPCION_ACREDITADA: "Inscripción acreditada",
  PUBLICACION_ACREDITADA: "Publicación acreditada",
};

function formatDetailDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(new Date(value));
}

function supportHash(row: DocumentAnnexLinkRow) {
  const hash = row.artifact?.hash_sha512 ?? row.artifact?.content_hash ?? row.artifact?.source_hash;
  if (!hash) return "Pendiente";
  return hash.length > 24 ? `${hash.slice(0, 14)}...${hash.slice(-8)}` : hash;
}

function RegistrySupportDocuments({
  agreementId,
  baseDocumentArtifactId,
}: {
  agreementId: string | null | undefined;
  baseDocumentArtifactId: string | null | undefined;
}) {
  const annexes = useDocumentAnnexLinks({ linkedDomain: "agreement", linkedIds: agreementId ? [agreementId] : [] });
  const baseArtifacts = useSecretariaDocumentArtifactsByIds(baseDocumentArtifactId ? [baseDocumentArtifactId] : []);
  const directArtifacts = useSecretariaDocumentArtifacts({
    kinds: ["DOCUMENTO_REGISTRAL", "INFORME_DOCUMENTAL_PRE"],
    sourceDomain: "agreement",
    sourceIds: agreementId ? [agreementId] : [],
  });
  const linkedRows = (annexes.data ?? []).filter(
    (row) =>
      row.included_in_export ||
      row.annex_role.includes("REGISTRO") ||
      row.artifact?.artifact_kind === "DOCUMENTO_REGISTRAL" ||
      row.artifact?.artifact_kind === "INFORME_DOCUMENTAL_PRE",
  );
  const linkedArtifactIds = new Set(linkedRows.map((row) => row.artifact_id));
  const baseRows: DocumentAnnexLinkRow[] = (baseArtifacts.data ?? [])
    .filter((artifact) => !linkedArtifactIds.has(artifact.id))
    .map((artifact) => ({
      id: `base:${artifact.id}`,
      tenant_id: artifact.tenant_id,
      artifact_id: artifact.id,
      linked_domain: "registry_filing",
      linked_id: baseDocumentArtifactId ?? "",
      annex_role: "DOCUMENTO_BASE_EXPEDIENTE",
      annex_order: -1,
      is_mandatory_annex: true,
      included_in_export: true,
      included_in_certification_bundle: false,
      frozen_at: artifact.created_at,
      created_at: artifact.created_at,
      artifact,
    }));
  const occupiedArtifactIds = new Set([...linkedArtifactIds, ...baseRows.map((row) => row.artifact_id)]);
  const directRows: DocumentAnnexLinkRow[] = (directArtifacts.data ?? [])
    .filter((artifact) => !occupiedArtifactIds.has(artifact.id))
    .map((artifact, index) => ({
      id: `direct:${artifact.id}`,
      tenant_id: artifact.tenant_id,
      artifact_id: artifact.id,
      linked_domain: "agreement",
      linked_id: agreementId ?? "",
      annex_role: "REGISTRO_DIRECTO",
      annex_order: linkedRows.length + index + 1,
      is_mandatory_annex: false,
      included_in_export: true,
      included_in_certification_bundle: false,
      frozen_at: null,
      created_at: artifact.created_at,
      artifact,
    }));
  const rows = [...baseRows, ...linkedRows, ...directRows];
  const loading = annexes.isLoading || directArtifacts.isLoading || baseArtifacts.isLoading;
  const supportError = annexes.error ?? directArtifacts.error ?? baseArtifacts.error;

  return (
    <section
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-5 lg:col-span-2"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">Soportes documentales registrales</h2>
      {supportError ? (
        <p className="mt-3 text-sm text-[var(--status-warning)]">
          No se pudo consultar la capa documental. Aplica la migración de informes y certificaciones para activar anexos.
        </p>
      ) : loading ? (
        <div className="mt-3 flex items-center gap-2 text-sm text-[var(--g-text-secondary)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando soportes...
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--g-text-secondary)]">
          Sin soportes REGISTRO anexados al acuerdo. Los informes documentales PRE y documentos registrales creados desde el expediente aparecerán aquí.
        </p>
      ) : (
        <div className="mt-4 overflow-hidden border border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-md)" }}>
          <table className="w-full">
            <thead>
              <tr className="bg-[var(--g-surface-subtle)]">
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-[var(--g-text-primary)]">Documento</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-[var(--g-text-primary)]">Estado</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-[var(--g-text-primary)]">Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--g-border-subtle)]">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2 text-sm text-[var(--g-text-primary)]">
                    <div className="font-medium">{row.artifact?.title ?? row.annex_role}</div>
                    <div className="text-xs text-[var(--g-text-secondary)]">
                      {row.artifact?.artifact_kind ?? row.annex_role}
                      {row.artifact_id === baseDocumentArtifactId ? " · Documento base del expediente" : " · Versión archivada"}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-sm text-[var(--g-text-secondary)]">
                    {statusLabel(row.artifact?.status ?? "PENDING")}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-[var(--g-text-secondary)]">{supportHash(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function TramitacionDetalle({ id }: { id: string }) {
  const { data, isLoading, error } = useTramitacionById(id);
  const events = useRegistryFilingEvents(id);
  const filing = data as TramitacionDetalleRow | null | undefined;
  const refs = [
    filing?.inscription_number && ["Inscripción", filing.inscription_number],
    filing?.borme_ref && ["BORME", filing.borme_ref],
    filing?.psm_ref && ["PSM", filing.psm_ref],
    filing?.siger_ref && ["SIGER", filing.siger_ref],
    filing?.conservatoria_ref && ["Conservatoria", filing.conservatoria_ref],
    filing?.jucerja_ref && ["JUCERJA", filing.jucerja_ref],
  ].filter(Boolean) as [string, string][];

  return (
    <main
      className="min-h-screen bg-[var(--g-surface-page)] p-6 text-[var(--g-text-primary)]"
      style={{ fontFamily: "'Montserrat', 'Inter', sans-serif" }}
    >
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center gap-4">
          <Link
            to="/secretaria/tramitador"
            className="inline-flex items-center text-sm font-medium text-[var(--g-link)] hover:text-[var(--g-link-hover)]"
          >
            ← Volver al tramitador
          </Link>
          {/* ITEM-104: enlace al expediente del acuerdo de origen (antes el
              detalle registral era un dead-end con solo "Volver al tramitador",
              pese a tener agreement_id cargado). */}
          {filing?.agreement_id && (
            <Link
              to={`/secretaria/acuerdos/${filing.agreement_id}`}
              className="inline-flex items-center text-sm font-medium text-[var(--g-link)] hover:text-[var(--g-link-hover)]"
            >
              Ver expediente del acuerdo →
            </Link>
          )}
          {/* ITEM-103: CTA para responder la subsanación desde el detalle,
              preseleccionando el acuerdo en el stepper (antes el usuario tenía que
              adivinar que debía ir a /nuevo y re-seleccionar el mismo acuerdo). */}
          {filing?.status === "SUBSANACION" && filing?.agreement_id && (
            <Link
              to={`/secretaria/tramitador/nuevo?agreement=${filing.agreement_id}&filing=${id}`}
              className="inline-flex items-center gap-1 bg-[var(--g-brand-3308)] px-3 py-1.5 text-sm font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <Gavel className="h-4 w-4" /> Responder subsanación
            </Link>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--g-brand-3308)]">
            Secretaría · Expediente registral
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--g-text-primary)]">
            {filing?.filing_number ?? "Tramitación registral"}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--g-text-secondary)]">
            Vista owner read-only del expediente existente. Las altas, subsanaciones y documentos se gestionan desde el
            stepper de tramitación, manteniendo la fuente de verdad en Secretaría.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-[var(--g-text-secondary)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando expediente…
          </div>
        ) : error ? (
          <div
            className="border border-[var(--status-error)] bg-[var(--g-surface-card)] p-4 text-sm text-[var(--status-error)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            No se pudo cargar la tramitación: {error instanceof Error ? error.message : String(error)}
          </div>
        ) : !filing ? (
          <div
            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-5 text-sm text-[var(--g-text-secondary)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            No existe una tramitación registrada para este identificador.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <section
              className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-5"
              style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
            >
              <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">Estado y presentación</h2>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  ["Estado", statusLabel(filing.status ?? "—")],
                  ["Vía", filing.filing_via ?? "—"],
                  ["Presentación", formatDetailDate(filing.presentation_date)],
                  ["Resolución estimada", formatDetailDate(filing.estimated_resolution)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-[var(--g-text-secondary)]">{label}</dt>
                    <dd className="mt-1 text-sm font-medium text-[var(--g-text-primary)]">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section
              className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-5"
              style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
            >
              <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">Instrumento</h2>
              <dl className="mt-4 space-y-3">
                <div>
                  <dt className="text-xs text-[var(--g-text-secondary)]">Notaría</dt>
                  <dd className="mt-1 text-sm font-medium text-[var(--g-text-primary)]">
                    {filing.notary_name ?? filing.deeds?.notary ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--g-text-secondary)]">Fecha escritura</dt>
                  <dd className="mt-1 text-sm font-medium text-[var(--g-text-primary)]">
                    {formatDetailDate(filing.deed_date ?? filing.deeds?.deed_date)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--g-text-secondary)]">Protocolo</dt>
                  <dd className="mt-1 text-sm font-medium text-[var(--g-text-primary)]">{filing.protocol_number ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--g-text-secondary)]">Estado instrumento</dt>
                  <dd className="mt-1 text-sm font-medium text-[var(--g-text-primary)]">
                    {statusLabel(filing.deeds?.status ?? filing.status ?? "—")}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--g-text-secondary)]">Documento de base</dt>
                  <dd className="mt-1 text-sm font-medium text-[var(--g-text-primary)]">
                    {filing.base_document_kind ?? "Legacy sin tipificar"}
                  </dd>
                </div>
              </dl>
            </section>

            <section
              className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-5 lg:col-span-2"
              style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
            >
              <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">Referencias registrales</h2>
              {refs.length > 0 ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {refs.map(([label, value]) => (
                    <div key={label} className="border border-[var(--g-border-subtle)] p-3" style={{ borderRadius: "var(--g-radius-md)" }}>
                      <div className="text-xs text-[var(--g-text-secondary)]">{label}</div>
                      <div className="mt-1 text-sm font-medium text-[var(--g-text-primary)]">{value}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-[var(--g-text-secondary)]">Sin referencias registrales informadas.</p>
              )}
            </section>

            <section
              className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-5 lg:col-span-2"
              style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
            >
              <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">Timeline registral</h2>
              {filing.workflow_version !== 2 ? (
                <p className="mt-3 text-sm text-[var(--g-text-secondary)]">
                  Expediente legacy: se conserva sin reinterpretar ni fabricar eventos históricos.
                </p>
              ) : events.isLoading ? (
                <div className="mt-3 flex items-center gap-2 text-sm text-[var(--g-text-secondary)]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando eventos…
                </div>
              ) : events.error ? (
                <p className="mt-3 text-sm text-[var(--status-error)]">No se pudo cargar el timeline registral.</p>
              ) : (events.data ?? []).length === 0 ? (
                <p className="mt-3 text-sm text-[var(--status-warning)]">Expediente v2 sin eventos: requiere revisión.</p>
              ) : (
                <ol className="mt-4 space-y-3">
                  {(events.data ?? []).map((event) => {
                    const timelineDate = resolveRegistryEventTimelineDate({
                      eventType: event.event_type,
                      effectiveAt: event.effective_at,
                      payload: event.payload,
                      deedDate: filing.deed_date,
                    });
                    return (
                      <li key={event.id} className="flex gap-3">
                        <span className="mt-1 h-2.5 w-2.5 shrink-0 bg-[var(--g-brand-bright)]" style={{ borderRadius: "var(--g-radius-full)" }} />
                        <div>
                          <p className="text-sm font-medium text-[var(--g-text-primary)]">
                            {REGISTRY_EVENT_LABEL[event.event_type] ?? event.event_type}
                          </p>
                          <p className="text-xs text-[var(--g-text-secondary)]">
                            {timelineDate.businessDateLabel && timelineDate.businessDate
                              ? `${timelineDate.businessDateLabel}: ${formatDetailDate(timelineDate.businessDate)} · `
                              : ""}
                            {statusLabel(event.to_status)} · evento {event.sequence_no}
                          </p>
                          <p className="text-xs text-[var(--g-text-secondary)]">
                            Traza técnica: {formatDetailDate(timelineDate.recordedAt)}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>

            {filing.workflow_version === 2 && filing.entity_id ? (
              <div className="lg:col-span-2">
                <RegistryLifecycleActions
                  filingId={id}
                  entityId={filing.entity_id}
                  status={filing.status ?? "PREPARADA"}
                  filingVia={filing.filing_via}
                  qualificationOutcome={filing.qualification_outcome}
                />
              </div>
            ) : null}

            <RegistrySupportDocuments
              agreementId={filing.agreement_id}
              baseDocumentArtifactId={filing.base_document_artifact_id}
            />
          </div>
        )}
      </div>
    </main>
  );
}

function TramitadorNuevo() {
  const { tenantId } = useTenantContext();
  const branding = useTenantBranding();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const requestedMateria = searchParams.get("materia") || "";
  const requestedPlantillaId = searchParams.get("plantilla");
  const requestedTemplateType = searchParams.get("tipo");
  const requestedCertificationId = searchParams.get("certificacion");
  const requestedAgreementId = searchParams.get("agreement");
  const requestedFilingId = searchParams.get("filing");
  const scopedEntityId =
    searchParams.get("scope") === "sociedad" ? searchParams.get("entity") : null;
  const isSociedadScoped = Boolean(scopedEntityId);
  const scopedBackTo = isSociedadScoped && scopedEntityId
    ? `/secretaria/tramitador?scope=sociedad&entity=${encodeURIComponent(scopedEntityId)}`
    : "/secretaria/tramitador";
  const { data: entities = [] } = useEntitiesList({ sociedadesOnly: true });
  const { data: agreements = [], isLoading: agreementsLoading } = useAgreementsList([
    "CERTIFIED",
    "ADOPTED",
  ]);
  const scopedEntity = entities.find((entity) => entity.id === scopedEntityId) ?? null;
  const visibleAgreements = useMemo(
    () => scopedEntityId
      ? agreements.filter((agreement) => agreement.entity_id === scopedEntityId)
      : agreements,
    [agreements, scopedEntityId],
  );
  const materiaMatchedAgreements = useMemo(
    () => requestedMateria
      ? visibleAgreements.filter((agreement) => agreement.agreement_kind === requestedMateria)
      : [],
    [requestedMateria, visibleAgreements],
  );
  // Lote 1 coherencia (A3): si la materia solicitada no tiene acuerdos
  // tramitables, NO se degrada en silencio a la lista completa — el rescate es
  // iniciar la ADOPCIÓN de la materia; la lista completa solo se muestra si el
  // usuario la pide explícitamente.
  const [showAllTramitables, setShowAllTramitables] = useState(false);
  const requestedMateriaWithoutAgreement = Boolean(
    requestedMateria && !agreementsLoading && materiaMatchedAgreements.length === 0,
  );
  // El rescate hacia la adopción solo aplica a la entrada por materia pura:
  // con ?agreement= o ?certificacion= el intake ya trae su propio contexto de
  // acuerdo (pre-selección por defaultAgreementId) y ocultar la lista dejaría
  // una selección válida invisible bajo un panel de "no hay acuerdos".
  const materiaRescueActive =
    requestedMateriaWithoutAgreement && !requestedAgreementId && !requestedCertificationId;
  const baseDisplayedAgreements = useMemo(() => {
    if (requestedMateria && materiaMatchedAgreements.length > 0) return materiaMatchedAgreements;
    if (materiaRescueActive && !showAllTramitables) return [];
    return visibleAgreements;
  }, [
    materiaMatchedAgreements,
    materiaRescueActive,
    requestedMateria,
    showAllTramitables,
    visibleAgreements,
  ]);
  const { data: requestedMateriaRulePack } = useRulePackForMateria(
    materiaRescueActive ? requestedMateria : undefined,
  );
  const adoptionRescueTarget = useMemo(
    () =>
      resolveAdoptionRoute({
        materia: requestedMateria,
        adoptionModes: extractRulePackAdoptionModes(requestedMateriaRulePack?.version.payload).map(
          (mode) => mode.code,
        ),
        // Si se llegó con un MODELO_ACUERDO, el rescate conserva el modelo:
        // los steppers de adopción lo consumen vía ?plantilla=.
        plantillaId: requestedTemplateType === "MODELO_ACUERDO" ? requestedPlantillaId : null,
        scope: searchParams.get("scope") === "sociedad"
          ? "sociedad"
          : searchParams.get("scope") === "grupo"
            ? "grupo"
            : null,
        entityId: scopedEntityId,
      }),
    [requestedMateria, requestedMateriaRulePack?.version.payload, requestedPlantillaId, requestedTemplateType, scopedEntityId, searchParams],
  );
  const {
    data: certificationIntake,
    isLoading: certificationLoading,
  } = useCertificationRegistryIntake(requestedCertificationId);
  const certifiedAgreementIds = useMemo(
    () => new Set(certificationIntake?.agreementIds ?? []),
    [certificationIntake?.agreementIds],
  );
  const displayedAgreements = useMemo(
    () => requestedCertificationId
      ? certificationIntake
        ? baseDisplayedAgreements.filter((agreement) => certifiedAgreementIds.has(agreement.id))
        : []
      : baseDisplayedAgreements,
    [baseDisplayedAgreements, certificationIntake, certifiedAgreementIds, requestedCertificationId],
  );
  const certificationWithoutRegistryAgreements = Boolean(
    requestedCertificationId &&
      certificationIntake &&
      certificationIntake.agreementIds.length === 0,
  );
  const certificationAgreementsOutOfScope = Boolean(
    requestedCertificationId &&
      certificationIntake &&
      certificationIntake.agreementIds.length > 0 &&
      displayedAgreements.length === 0,
  );

  const [selectedAgreementId, setSelectedAgreementId] = useState<string | null>(null);
  const defaultAgreementId =
    requestedAgreementId ??
    (certificationIntake?.agreementIds.length === 1 ? certificationIntake.agreementIds[0] : null);
  const effectiveSelectedAgreementId = selectedAgreementId ?? defaultAgreementId;
  const { data: selectedAgreement } = useAgreementById(effectiveSelectedAgreementId || undefined);
  // ITEM-106 (Comité Legal + Garrigues): en la vía DIRECTA (sin ?certificacion=)
  // se comprueba que el acuerdo tenga certificación emitida y evidenciada antes de permitir la
  // elevación a público (art. 107 RRM). Cuando se entra por certificación, el
  // intake ya garantiza el título y este check no aplica.
  const { data: agreementHasCertification, isLoading: agreementCertCheckLoading } =
    useAgreementHasCertification(!requestedCertificationId ? effectiveSelectedAgreementId || undefined : undefined);
  const agreementLacksCertification = Boolean(
    !requestedCertificationId &&
      effectiveSelectedAgreementId &&
      !agreementCertCheckLoading &&
      agreementHasCertification === false,
  );
  const [deedCertificationOverride, setDeedCertificationOverride] = useState(false);

  // Codex adversarial (P1): sin el órgano, una materia con packs de Junta y de
  // Consejo resolvía a la primera fila cronológica — el análisis registral y el
  // panel podían mostrar las reglas del órgano equivocado.
  const { data: agreementBodies = [] } = useBodiesByEntity(
    selectedAgreement?.entity_id ?? undefined,
    { adoptingOnly: true },
  );
  // Se usa el resolver canónico del proyecto (organo-resolver), que ya conoce
  // que CDA es umbrella diferenciada por config.organo_tipo y que COMITE sigue
  // la convención de comisión delegada. Un mapa ad-hoc aquí volvería a la
  // duplicación con criterios distintos que ese módulo vino a corregir.
  const selectedAgreementBody =
    agreementBodies.find((body) => body.id === selectedAgreement?.body_id) ?? null;
  // Variante estricta: para MOSTRAR el régimen aplicable no vale el fallback a
  // Junta del resolver. Un órgano irreconocible debe dejar el panel mudo, no
  // presentarlo como Junta General.
  const selectedAgreementOrganoTipo = selectedAgreementBody
    ? resolveOrganoTipoStrict(selectedAgreementBody)
    : null;
  const { data: rulePackData, isLoading: rulesLoading } = useRulePackForMateria(
    selectedAgreement?.agreement_kind,
    selectedAgreementOrganoTipo,
  );
  const registryRulePackData = rulePackData ?? (
    selectedAgreement && !rulesLoading
      ? buildPrototypeRegistryRulePackFallback(selectedAgreement)
      : null
  );
  const usingPrototypeRegistryRuleFallback = Boolean(selectedAgreement && !rulesLoading && !rulePackData);

  // Procedencia de la regla que se está aplicando, para poder advertirlo allí
  // donde se decide y no solo en el paso 2. `FALLBACK_ORGANO_DISTINTO` significa
  // que hay regla activa para la materia pero no del órgano que adopta.
  const registryRuleProvenance: RegistryRuleProvenance = usingPrototypeRegistryRuleFallback
    ? "PROTOTIPO"
    : isUnreliableRulePackSelection(rulePackData?.selectionReason)
      ? "OTRO_ORGANO"
      : null;

  const [selectedModeloId, setSelectedModeloId] = useState<string | null>(null);
  const [modeloCapa3Open, setModeloCapa3Open] = useState(false);
  const [modeloCapa3Values, setModeloCapa3Values] = useState<Capa3Values>({});
  const [modeloCapa3Errors, setModeloCapa3Errors] = useState<Record<string, string>>({});

  const materia = selectedAgreement?.agreement_kind ?? "";
  const { data: modelos = [], isLoading: modelosLoading } = useModelosAcuerdo(
    materia,
    undefined,
    selectedAgreement?.adoption_mode,
  );
  const selectedModelo = useMemo(
    () => modelos.find((modelo) => modelo.id === selectedModeloId) ?? null,
    [modelos, selectedModeloId],
  );
  const requestedModeloAvailable = Boolean(
    requestedPlantillaId && modelos.some((modelo) => modelo.id === requestedPlantillaId),
  );
  const requestedModeloMissing = Boolean(
    requestedPlantillaId && selectedAgreement && !modelosLoading && modelos.length > 0 && !requestedModeloAvailable,
  );

  const [instrumentData, setInstrumentData] = useState({
    notary: "",
    deedDate: "",
    protocolNumber: "",
  });

  const [filingChannel, setFilingChannel] = useState<string>("");
  const [filingStatus, setFilingStatus] = useState<string>("DRAFT");
  const [deedSaved, setDeedSaved] = useState(false);
  const [deedSaving, setDeedSaving] = useState(false);
  const [subsanacionMotivo, setSubsanacionMotivo] = useState("");
  const [subsanacionDocs, setSubsanacionDocs] = useState("");
  const [subsanacionSaving, setSubsanacionSaving] = useState(false);
  const [subsanacionDone, setSubsanacionDone] = useState(false);
  const [registryLinkSaved, setRegistryLinkSaved] = useState(false);
  const [registryLinkMessage, setRegistryLinkMessage] = useState<string | null>(null);
  const [registryFilingId, setRegistryFilingId] = useState<string | null>(null);
  const [registryWorkflowVersion, setRegistryWorkflowVersion] = useState<number | null>(null);
  const [baseDocumentArtifactId, setBaseDocumentArtifactId] = useState<string | null>(null);
  const [baseDocumentArtifactMessage, setBaseDocumentArtifactMessage] = useState<string | null>(null);
  const [filingNumber, setFilingNumber] = useState("");
  const [presentationDate, setPresentationDate] = useState("");
  const [presentationEvidenceFile, setPresentationEvidenceFile] = useState<File | null>(null);
  const [presentationEvidenceArtifactId, setPresentationEvidenceArtifactId] = useState<string | null>(null);
  const [subsanacionEvidenceFile, setSubsanacionEvidenceFile] = useState<File | null>(null);
  const [subsanacionEvidenceArtifactId, setSubsanacionEvidenceArtifactId] = useState<string | null>(null);
  const prepareOperationId = useRef(crypto.randomUUID());
  const presentationOperationId = useRef(crypto.randomUUID());
  const remedyOperationId = useRef(crypto.randomUUID());
  const presentationRecordedAt = useRef(new Date().toISOString());
  const remedyEffectiveAt = useRef(new Date().toISOString());
  const createArtifact = useCreateSecretariaDocumentArtifact();
  const prepareFiling = usePrepareRegistryFiling();
  const recordPresentation = useRecordRegistryPresentation();
  const submitRemedy = useSubmitRegistryRemedy();
  const uploadRegistryEvidence = useUploadRegistryEvidenceArtifact();

  useEffect(() => {
    if (!requestedAgreementId || selectedAgreementId) return;
    setSelectedAgreementId(requestedAgreementId);
  }, [requestedAgreementId, selectedAgreementId]);

  useEffect(() => {
    if (!selectedAgreementId) return;
    if (certificationIntake && certifiedAgreementIds.has(selectedAgreementId)) return;
    if (requestedAgreementId === selectedAgreementId) return;
    if (displayedAgreements.some((agreement) => agreement.id === selectedAgreementId)) return;
    setSelectedAgreementId(null);
    setSelectedModeloId(null);
    setInstrumentData({
      notary: "",
      deedDate: "",
      protocolNumber: "",
    });
    setFilingChannel("");
    setFilingStatus("DRAFT");
    setDeedSaved(false);
    setSubsanacionMotivo("");
    setSubsanacionDocs("");
    setSubsanacionDone(false);
    setRegistryLinkSaved(false);
    setRegistryLinkMessage(null);
    setRegistryFilingId(null);
    setRegistryWorkflowVersion(null);
    setBaseDocumentArtifactId(null);
    setBaseDocumentArtifactMessage(null);
    setFilingNumber("");
    setPresentationDate("");
    setPresentationEvidenceFile(null);
    setPresentationEvidenceArtifactId(null);
    setSubsanacionEvidenceFile(null);
    setSubsanacionEvidenceArtifactId(null);
    prepareOperationId.current = crypto.randomUUID();
    presentationOperationId.current = crypto.randomUUID();
    remedyOperationId.current = crypto.randomUUID();
    presentationRecordedAt.current = new Date().toISOString();
    remedyEffectiveAt.current = new Date().toISOString();
  }, [certificationIntake, certifiedAgreementIds, displayedAgreements, requestedAgreementId, selectedAgreementId]);

  useEffect(() => {
    if (requestedCertificationId) return;
    if (selectedAgreementId || materiaMatchedAgreements.length !== 1) return;
    setSelectedAgreementId(materiaMatchedAgreements[0].id);
  }, [materiaMatchedAgreements, requestedCertificationId, selectedAgreementId]);

  useEffect(() => {
    if (!certificationIntake || selectedAgreementId) return;
    if (certificationIntake.agreementIds.length === 1) {
      setSelectedAgreementId(certificationIntake.agreementIds[0]);
      return;
    }
    const matches = displayedAgreements.filter((agreement) =>
      certificationIntake.agreementIds.includes(agreement.id)
    );
    if (matches.length === 1) {
      setSelectedAgreementId(matches[0].id);
    }
  }, [certificationIntake, displayedAgreements, selectedAgreementId]);

  useEffect(() => {
    if (!requestedPlantillaId || modelosLoading) return;
    if (modelos.some((modelo) => modelo.id === requestedPlantillaId)) {
      setSelectedModeloId(requestedPlantillaId);
    }
  }, [modelos, modelosLoading, requestedPlantillaId]);

  useEffect(() => {
    setModeloCapa3Values({});
    setModeloCapa3Errors({});
  }, [selectedModeloId]);

  // Hidrata `registryFilingId` y `filingStatus` cuando el acuerdo
  // seleccionado ya tiene un registry_filing en Cloud. Antes el stepper
  // arrancaba siempre en DRAFT, ocultando subsanaciones pendientes y
  // forzando al usuario a re-elevar la escritura. Se re-ejecuta cuando
  // `filingStatus` vuelve a DRAFT (p.ej. tras `handleSelectAgreement`)
  // y el id del filing aún no está cargado para el agreement actual,
  // para no perder la hidratación tras el click del usuario en el
  // botón del agreement. Bug detectado por e2e/58.
  useEffect(() => {
    if (!effectiveSelectedAgreementId || !tenantId) return;
    if (filingStatus !== "DRAFT" && registryFilingId) return;
    let cancelled = false;
    (async () => {
      let query = supabase
        .from("registry_filings")
        .select("id, status, workflow_version, base_document_artifact_id, filing_number, presentation_date")
        .eq("tenant_id", tenantId)
        .eq("agreement_id", effectiveSelectedAgreementId);
      query = requestedFilingId
        ? query.eq("id", requestedFilingId)
        : query.order("created_at", { ascending: false }).limit(1);
      const { data, error } = await query;
      if (cancelled) return;
      if (error) return;
      const row = (data ?? [])[0];
      if (!row) return;
      setRegistryFilingId(row.id as string);
      setFilingStatus(String(row.status ?? "DRAFT"));
      setRegistryWorkflowVersion(Number(row.workflow_version ?? 1));
      setBaseDocumentArtifactId(row.base_document_artifact_id ?? null);
      setFilingNumber(row.filing_number ?? "");
      setPresentationDate(row.presentation_date ?? "");
      setDeedSaved(["ELEVADA", "PRESENTADA", "INSCRITA", "ELEVATED", "SUBMITTED", "INSCRIBED"].includes(String(row.status ?? ""))); // ITEM-102: vocabulario ES canónico (+ inglés legacy)
    })();
    return () => { cancelled = true; };
  }, [effectiveSelectedAgreementId, filingStatus, registryFilingId, requestedFilingId, tenantId]);

  const registryProcedureProfile = selectedAgreement && registryRulePackData
    ? resolveRegistryProcedureProfile(selectedAgreement.agreement_kind, registryRulePackData.payload)
    : null;
  const registryBaseDocumentKind: RegistryBaseDocumentKind | null =
    registryProcedureProfile?.baseDocumentKind ?? null;
  const isDeedRequired = registryBaseDocumentKind === "ESCRITURA";
  const baseDocumentBusinessLabel = registryBaseDocumentKind === "ESCRITURA"
    ? "Escritura pública"
    : registryBaseDocumentKind === "INSTANCIA"
      ? "Instancia"
      : registryBaseDocumentKind === "CERTIFICACION"
        ? "Certificación"
        : "Documento de base";
  const registryDocumentTitleLabel = registryBaseDocumentKind === "ESCRITURA"
    ? "Documento preparatorio para escritura pública"
    : "Documento preparatorio registral";
  const filingType = (() => {
    if (registryProcedureProfile?.procedureProfileCode) {
      return registryProcedureProfile.procedureProfileCode;
    }
    if (!registryRulePackData) return null;
    const payload = registryRulePackData.payload as Record<string, unknown>;
    if (typeof payload.filing_type === "string" && payload.filing_type.trim()) {
      return payload.filing_type;
    }
    if (
      Array.isArray(payload.registry_filing_types) &&
      typeof payload.registry_filing_types[0] === "string" &&
      payload.registry_filing_types[0].trim()
    ) {
      return payload.registry_filing_types[0];
    }
    return registryRulePackData.payload.instrumentoRequerido;
  })();
  const selectedAgreementEntity = selectedAgreement?.entity_id
    ? entities.find((entity) => entity.id === selectedAgreement.entity_id) ?? null
    : null;
  const selectedAgreementEntityName =
    selectedAgreementEntity?.legal_name ??
    selectedAgreementEntity?.common_name ??
    scopedEntity?.legal_name ??
    scopedEntity?.common_name ??
    groupFullLabel(branding);
  const selectedAgreementLegalName =
    selectedAgreementEntity?.legal_name ??
    scopedEntity?.legal_name ??
    selectedAgreementEntityName;

  useEffect(() => {
    if (registryBaseDocumentKind !== "CERTIFICACION") return;
    if (!certificationIntake?.baseDocumentArtifactId) return;
    if (registryFilingId || baseDocumentArtifactId) return;
    setBaseDocumentArtifactId(certificationIntake.baseDocumentArtifactId);
    setBaseDocumentArtifactMessage(
      "Certificación emitida y custodiada reutilizada como documento base; conserva el mismo bundle y hash de evidencia.",
    );
  }, [
    baseDocumentArtifactId,
    certificationIntake?.baseDocumentArtifactId,
    registryBaseDocumentKind,
    registryFilingId,
  ]);
  const selectedModeloTemplate = useMemo(() => selectedModelo
    ? ({
      ...selectedModelo,
      tenant_id: "cloud-modelo-acuerdo",
      tipo: "MODELO_ACUERDO",
      materia: selectedModelo.materia_acuerdo,
      jurisdiccion: selectedModelo.jurisdiccion ?? selectedAgreementEntity?.jurisdiction ?? scopedEntity?.jurisdiction ?? "ES",
      aprobada_por: selectedModelo.aprobada_por ?? null,
      fecha_aprobacion: selectedModelo.fecha_aprobacion ?? null,
      protecciones: {},
      snapshot_rule_pack_required: true,
      adoption_mode: selectedModelo.adoption_mode ?? selectedAgreement?.adoption_mode ?? null,
      organo_tipo: selectedModelo.organo_tipo ?? null,
      contrato_variables_version: selectedModelo.contrato_variables_version ?? null,
      created_at: "2026-04-29T00:00:00.000Z",
      approval_checklist: null,
      version_history: null,
      variables: [],
    } as PlantillaProtegidaRow)
    : null,
    [
      scopedEntity?.jurisdiction,
      selectedAgreement?.adoption_mode,
      selectedAgreementEntity?.jurisdiction,
      selectedModelo,
    ]);
  const selectedModeloMatrix = useMemo(
    () => resolveTemplateProcessMatrix(selectedModeloTemplate, {
      processHint: "tramitador_acuerdo",
      variables: {
        denominacion_social: selectedAgreementLegalName,
        materia_acuerdo: selectedAgreement?.agreement_kind ?? selectedModelo?.materia_acuerdo ?? "",
        estado_acuerdo: selectedAgreement ? statusLabel(selectedAgreement.status) : "",
        modo_adopcion: selectedAgreement?.adoption_mode ?? "",
        clase_materia: selectedAgreement?.matter_class ?? "",
        agreement_id: selectedAgreement?.id ?? "",
      },
      capa3Values: modeloCapa3Values,
    }),
    [
      modeloCapa3Values,
      selectedAgreement,
      selectedAgreementLegalName,
      selectedModelo?.materia_acuerdo,
      selectedModeloTemplate,
    ],
  );
  const selectedModeloCapa3Fields = selectedModeloMatrix?.capa3Fields ?? [];
  const selectedModeloPendingCapa3 = selectedModeloCapa3Fields.filter(
    (field) => field.obligatoriedad === "OBLIGATORIO" && !capa3ValueHasContent(modeloCapa3Values[field.campo]),
  ).length;

  function openModeloCapa3Capture() {
    if (!selectedAgreement || selectedModeloCapa3Fields.length === 0) return;
    setModeloCapa3Values((currentValues) =>
      Object.keys(currentValues).length > 0
        ? currentValues
        : selectedModeloMatrix?.initialCapa3Values ?? {},
    );
    setModeloCapa3Errors({});
    setModeloCapa3Open(true);
  }

  function submitModeloCapa3Capture() {
    const errors = validateCapa3(selectedModeloCapa3Fields, modeloCapa3Values);
    if (Object.keys(errors).length > 0) {
      setModeloCapa3Errors(errors);
      return;
    }
    setModeloCapa3Errors({});
    setModeloCapa3Open(false);
  }

  function preferredTemplateIdFor(processHint: string) {
    if (!requestedPlantillaId || !requestedTemplateType) return null;
    const probe = {
      ...(selectedModeloTemplate ?? {}),
      id: requestedPlantillaId,
      tipo: requestedTemplateType,
      tenant_id: "template-query-param",
      jurisdiccion: selectedAgreementEntity?.jurisdiction ?? scopedEntity?.jurisdiction ?? "ES",
      estado: "ACTIVA",
      version: "query",
      materia_acuerdo: selectedAgreement?.agreement_kind ?? (requestedMateria || null),
      adoption_mode: selectedAgreement?.adoption_mode ?? null,
      protecciones: {},
      variables: [],
      snapshot_rule_pack_required: true,
    } as PlantillaProtegidaRow;
    return resolveTemplateProcessMatrix(probe, { processHint }) ? requestedPlantillaId : null;
  }

  const certificationRegistryVariables = certificationIntake
    ? {
        certificacion_id: certificationIntake.id,
        certificacion_minute_id: certificationIntake.minuteId ?? "",
        certificacion_estado_firma: statusLabel(certificationIntake.signatureStatus),
        certificacion_referencias: certificationIntake.references,
        certificacion_acuerdos_enlazables: certificationIntake.agreementIds,
        certificacion_referencias_punto: certificationIntake.pointReferences,
        certificacion_evidence_id: certificationIntake.evidenceId ?? "",
        certificacion_gate_hash: certificationIntake.gateHash ?? "",
      }
    : {};
  const registryDocVariables = selectedAgreement && registryRulePackData
    ? {
        ...buildRegistryVariables({
          agreement: selectedAgreement,
          entityName: selectedAgreementEntityName,
          legalName: selectedAgreementLegalName,
          instrumentData,
          filingChannel,
          filingStatus,
          filingType,
          instrumentRequired: registryBaseDocumentKind ?? registryRulePackData.payload.instrumentoRequerido,
          registryFilingId,
        }),
        ...certificationRegistryVariables,
      }
    : null;
  const registryDocFallback = selectedAgreement && registryRulePackData
    ? buildRegistryFallback({
      agreement: selectedAgreement,
      entityName: selectedAgreementEntityName,
      legalName: selectedAgreementLegalName,
      instrumentData,
      filingChannel,
      filingStatus,
      filingType,
      instrumentRequired: registryBaseDocumentKind ?? registryRulePackData.payload.instrumentoRequerido,
    })
    : "";
  const subsanacionDocVariables = selectedAgreement && registryRulePackData
    ? {
        ...buildRegistryVariables({
          agreement: selectedAgreement,
          entityName: selectedAgreementEntityName,
          legalName: selectedAgreementLegalName,
          instrumentData,
          filingChannel,
          filingStatus,
          filingType,
          instrumentRequired: registryBaseDocumentKind ?? registryRulePackData.payload.instrumentoRequerido,
          registryFilingId,
          isSubsanacion: true,
          subsanacionMotivo,
          subsanacionDocs,
        }),
        ...certificationRegistryVariables,
      }
    : null;
  const subsanacionDocFallback = selectedAgreement
    ? buildSubsanacionFallback({
      agreement: selectedAgreement,
      entityName: selectedAgreementEntityName,
      legalName: selectedAgreementLegalName,
      subsanacionMotivo,
      subsanacionDocs,
    })
    : "";
  const selectedAgreementAllowedByCertification = !certificationIntake ||
    certifiedAgreementIds.has(selectedAgreement?.id ?? "");
  const certificationRegistryReady = !certificationIntake || certificationIntake.readyForRegistry;
  const selectedAgreementVisible = Boolean(
    selectedAgreement &&
      (
        displayedAgreements.some((agreement) => agreement.id === selectedAgreement.id) ||
        Boolean(certificationIntake && certifiedAgreementIds.has(selectedAgreement.id)) ||
        requestedAgreementId === selectedAgreement.id
      ),
  );
  const step1CanAdvance = Boolean(
    selectedAgreement &&
      selectedAgreementVisible &&
      selectedAgreementAllowedByCertification &&
      !agreementsLoading &&
      !certificationLoading &&
      !certificationWithoutRegistryAgreements &&
      !certificationAgreementsOutOfScope,
  );

  const canRegisterDeed = Boolean(
    tenantId &&
      selectedAgreement &&
      selectedAgreementAllowedByCertification &&
      certificationRegistryReady &&
      // ITEM-106: bloqueo duro si el acuerdo no tiene certificación emitida y evidenciada en la
      // vía directa, salvo override justificado del usuario (art. 107 RRM).
      !(isDeedRequired && agreementLacksCertification && !deedCertificationOverride) &&
      registryBaseDocumentKind &&
      baseDocumentArtifactId &&
      filingChannel &&
      filingType &&
      (
        !isDeedRequired || (
          instrumentData.notary.trim() &&
          instrumentData.deedDate &&
          instrumentData.protocolNumber.trim()
        )
      )
  );

  const handleSelectAgreement = (agreementId: string) => {
    if (certificationIntake && !certifiedAgreementIds.has(agreementId)) {
      toast.error("Ese acuerdo no está incluido en la certificación de entrada.");
      return;
    }
    setSelectedAgreementId(agreementId);
    setSelectedModeloId(null);
    setInstrumentData({
      notary: "",
      deedDate: "",
      protocolNumber: "",
    });
    setFilingChannel("");
    setFilingStatus("DRAFT");
    setDeedSaved(false);
    setSubsanacionMotivo("");
    setSubsanacionDocs("");
    setSubsanacionDone(false);
    setRegistryLinkSaved(false);
    setRegistryLinkMessage(null);
    setRegistryFilingId(null);
    setRegistryWorkflowVersion(null);
    setBaseDocumentArtifactId(null);
    setBaseDocumentArtifactMessage(null);
    setFilingNumber("");
    setPresentationDate("");
    setPresentationEvidenceFile(null);
    setPresentationEvidenceArtifactId(null);
    setSubsanacionEvidenceFile(null);
    setSubsanacionEvidenceArtifactId(null);
    prepareOperationId.current = crypto.randomUUID();
    presentationOperationId.current = crypto.randomUUID();
    remedyOperationId.current = crypto.randomUUID();
    presentationRecordedAt.current = new Date().toISOString();
    remedyEffectiveAt.current = new Date().toISOString();
  };

  async function handleRegistryDocumentGenerated(result: ProcessDocumentGenerationResult) {
    if (!selectedAgreement?.entity_id) {
      throw new Error("El acuerdo no tiene una sociedad resuelta para archivar el documento registral.");
    }
    const documentUrl = result.archive.documentUrls[0] ?? null;
    if (!result.archive.archived || !documentUrl) {
      throw new Error("El documento debe quedar archivado antes de vincularlo al expediente registral.");
    }
    const evidenceBundleId = result.archive.evidenceBundleIds[0] ?? null;
    if (!evidenceBundleId) {
      throw new Error("El documento archivado no tiene bundle de evidencia para el expediente registral.");
    }
    const { data: evidenceBundle, error: evidenceBundleError } = await supabase
      .from("evidence_bundles")
      .select("hash_sha512")
      .eq("id", evidenceBundleId)
      .eq("tenant_id", tenantId!)
      .maybeSingle();
    if (evidenceBundleError) throw evidenceBundleError;
    if (!evidenceBundle?.hash_sha512) {
      throw new Error("El bundle registral no contiene el hash SHA-512 del binario archivado.");
    }

    const artifact = await createArtifact.mutateAsync({
      artifactKind: "DOCUMENTO_REGISTRAL",
      title: `${registryDocumentTitleLabel}: ${selectedAgreement.decision_text || selectedAgreement.proposal_text || selectedAgreement.agreement_kind}`,
      entityId: selectedAgreement.entity_id,
      status: "ARCHIVED",
      evidenceStatus: "DEMO_OPERATIVA",
      documentUrl,
      contentHash: result.contentHash,
      hashSha512: evidenceBundle.hash_sha512,
      evidenceBundleId,
      sourceDomain: "agreement",
      sourceId: selectedAgreement.id,
      sourceHash: result.contentHash,
      sourcePayload: {
        filing_type: filingType,
        base_document_kind: registryBaseDocumentKind,
        certification_id: certificationIntake?.id ?? null,
        agreement_decision: selectedAgreement.decision_text ?? selectedAgreement.proposal_text ?? null,
      },
      metadata: {
        filename: result.filename,
        template_id: result.templateId,
        template_version: result.templateVersion,
        registry_base_artifact: true,
        document_purpose: registryProcedureProfile?.kind ?? null,
      },
    });
    setBaseDocumentArtifactId(artifact.id);
    setBaseDocumentArtifactMessage(
      `Documento base archivado y vinculado por hash ${result.contentHash.slice(0, 12)}.`,
    );
  }

  async function handleRegisterDeed() {
    if (!tenantId || !selectedAgreement || !registryRulePackData) {
      toast.error("No se pudo preparar el expediente registral para este acuerdo.");
      return;
    }

    if (!selectedAgreementAllowedByCertification) {
      toast.error("El acuerdo seleccionado no pertenece a la certificación de entrada.");
      return;
    }

    if (!certificationRegistryReady) {
      toast.error("La certificación debe estar emitida, custodiada y tener constancia vinculada antes de preparar el expediente.");
      return;
    }

    if (!registryBaseDocumentKind) {
      toast.error("El perfil registral no determina un documento de base soportado.");
      return;
    }

    if (!baseDocumentArtifactId) {
      toast.error("Genere y archive primero el documento de base del expediente.");
      return;
    }

    if (!filingChannel) {
      toast.error("Seleccione el canal de presentación.");
      return;
    }

    if (isDeedRequired && (
      !instrumentData.notary.trim() ||
      !instrumentData.deedDate ||
      !instrumentData.protocolNumber.trim()
    )) {
      toast.error("Complete notaría, fecha de escritura y número de protocolo.");
      return;
    }

    setDeedSaving(true);
    try {
      const result = await prepareFiling.mutateAsync({
        operationId: prepareOperationId.current,
        entityId: selectedAgreement.entity_id,
        sourceDomain: certificationIntake ? "CERTIFICATION" : "AGREEMENT",
        sourceId: certificationIntake?.id ?? selectedAgreement.id,
        baseDocumentKind: registryBaseDocumentKind,
        baseDocumentArtifactId,
        filingVia: filingChannel,
        agreementId: selectedAgreement.id,
        rulePackVersionId: rulePackData?.version.id ?? null,
        procedureProfileCode: filingType,
        procedureSnapshot: {
          instrument_required: registryBaseDocumentKind,
          filing_type: filingType,
          procedure_kind: registryProcedureProfile?.kind ?? null,
          source_agreement_kind: selectedAgreement.agreement_kind,
          source_agreement_decision: selectedAgreement.decision_text ?? selectedAgreement.proposal_text ?? null,
          rule_pack_selection: rulePackData?.selectionReason ?? "PROTOTIPO",
          certification_id: certificationIntake?.id ?? null,
        },
        deedDate: isDeedRequired ? instrumentData.deedDate : null,
        notaryName: isDeedRequired ? instrumentData.notary.trim() : null,
        protocolNumber: isDeedRequired ? instrumentData.protocolNumber.trim() : null,
      });
      const nextRegistryFilingId = result.filing_id;

      if (nextRegistryFilingId && certificationIntake) {
        setRegistryLinkSaved(true);
        setRegistryLinkMessage(
          "La certificación figura como origen explícito del expediente v2; la RPC ha validado la constancia documental, la evidencia, el tenant y la sociedad, sin atribuir firma a EAD Trust.",
        );
      }

      setDeedSaved(true);
      setRegistryFilingId(nextRegistryFilingId);
      setRegistryWorkflowVersion(2);
      setFilingStatus(result.status);
      await queryClient.invalidateQueries({ queryKey: ["evidence_bundles", tenantId] });
      toast.success(
        registryBaseDocumentKind === "ESCRITURA"
          ? "Escritura vinculada al expediente"
          : "Documento de base vinculado al expediente",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`No se pudo preparar el expediente: ${message}`);
    } finally {
      setDeedSaving(false);
    }
  }

  async function handleRecordPresentation() {
    if (!registryFilingId || registryWorkflowVersion !== 2 || !selectedAgreement?.entity_id) {
      toast.error("Prepare primero un expediente registral v2 para este acuerdo.");
      return;
    }
    const missingPresentationFields = [
      !filingNumber.trim() ? "número de entrada" : null,
      !presentationDate ? "fecha de presentación" : null,
      !filingChannel ? "canal de presentación" : null,
    ].filter((field): field is string => Boolean(field));
    if (missingPresentationFields.length > 0) {
      toast.error(`Complete: ${missingPresentationFields.join(", ")}.`);
      return;
    }
    if (!presentationEvidenceFile && !presentationEvidenceArtifactId) {
      toast.error("Adjunte el justificante real de presentación.");
      return;
    }

    try {
      let evidenceArtifactId = presentationEvidenceArtifactId;
      if (!evidenceArtifactId && presentationEvidenceFile) {
        const artifact = await uploadRegistryEvidence.mutateAsync({
          file: presentationEvidenceFile,
          entityId: selectedAgreement.entity_id,
          title: `Justificante de presentación ${filingNumber.trim()}`,
          artifactKind: "ANEXO_EXTERNO",
          sourceDomain: "registry_filing",
          sourceId: registryFilingId,
          metadata: { registry_evidence_role: "PRESENTATION_RECEIPT" },
        });
        evidenceArtifactId = artifact.id;
        setPresentationEvidenceArtifactId(artifact.id);
      }
      if (!evidenceArtifactId) throw new Error("No se pudo persistir el justificante de presentación.");

      const result = await recordPresentation.mutateAsync({
        filingId: registryFilingId,
        operationId: presentationOperationId.current,
        filingNumber: filingNumber.trim(),
        presentationDate,
        filingVia: filingChannel,
        evidenceArtifactId,
        // La firma histórica de la RPC conserva `effectiveAt`; semánticamente
        // es el timestamp técnico del asiento. La fecha de negocio es
        // `presentationDate` y se presenta separada en el timeline.
        effectiveAt: presentationRecordedAt.current,
      });
      setFilingStatus(result.status);
      setDeedSaved(true);
      toast.success("Presentación registrada con justificante y evento de auditoría");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error("No se pudo registrar la presentación", { description: message });
    }
  }

  async function handleSubsanacionSubmit() {
    if (!effectiveSelectedAgreementId || !tenantId || !selectedAgreement?.entity_id) {
      toast.error("No se puede preparar la subsanación sin acuerdo y contexto activos.");
      return;
    }
    if (!registryFilingId || registryWorkflowVersion !== 2) {
      toast.error("La subsanación requiere un expediente registral v2 identificado de forma exacta.");
      return;
    }
    if (!subsanacionEvidenceFile && !subsanacionEvidenceArtifactId) {
      toast.error("Adjunte el documento real presentado para subsanar.");
      return;
    }
    setSubsanacionSaving(true);
    try {
      let evidenceArtifactId = subsanacionEvidenceArtifactId;
      if (!evidenceArtifactId && subsanacionEvidenceFile) {
        const artifact = await uploadRegistryEvidence.mutateAsync({
          file: subsanacionEvidenceFile,
          entityId: selectedAgreement.entity_id,
          title: `Documento de subsanación: ${selectedAgreement.agreement_kind}`,
          artifactKind: "SUBSANACION_REGISTRAL",
          sourceDomain: "registry_filing",
          sourceId: registryFilingId,
          metadata: {
            registry_evidence_role: "REMEDY_SUBMISSION",
            document_reference: subsanacionDocs.trim() || null,
          },
        });
        evidenceArtifactId = artifact.id;
        setSubsanacionEvidenceArtifactId(artifact.id);
      }
      if (!evidenceArtifactId) throw new Error("No se pudo persistir la evidencia de subsanación.");

      const result = await submitRemedy.mutateAsync({
        filingId: registryFilingId,
        operationId: remedyOperationId.current,
        remedyDescription: subsanacionMotivo.trim(),
        evidenceArtifactId,
        effectiveAt: remedyEffectiveAt.current,
      });
      setFilingStatus(result.status);
      setSubsanacionDone(true);
    } catch (error) {
      const description = error instanceof Error ? error.message : "Inténtelo de nuevo.";
      toast.error("No se pudo registrar la respuesta de subsanación", { description });
    } finally {
      setSubsanacionSaving(false);
    }
  }

  // Step 1: Select agreement
  const step1Body = (
    <div className="space-y-4">
      {isSociedadScoped && (
        <div
          className="border border-[var(--g-sec-300)] bg-[var(--g-sec-100)] px-4 py-3 text-sm text-[var(--g-text-primary)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          Modo Sociedad activo: el tramitador solo muestra acuerdos de{" "}
          <span className="font-semibold">
            {scopedEntity?.legal_name ?? scopedEntity?.common_name ?? "la sociedad seleccionada"}
          </span>
          .
        </div>
      )}
      {requestedCertificationId ? (
        <div
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-4 py-3 text-sm text-[var(--g-text-secondary)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="font-semibold text-[var(--g-text-primary)]">
                Entrada desde certificación
              </div>
              <div className="mt-1">
                {certificationLoading ? (
                  <span>Cargando certificación…</span>
                ) : certificationIntake ? (
                  <>
                    Certificación <span className="font-mono text-xs">{certificationIntake.id.slice(0, 8)}</span>
                    {" "}· evidencia {statusLabel(certificationIntake.signatureStatus)}
                    {" "}· {certificationIntake.references.length} referencia(s) certificada(s).
                  </>
                ) : (
                  <span>No se ha encontrado la certificación indicada en el contexto activo.</span>
                )}
              </div>
              {certificationIntake?.pointReferences.length ? (
                <div className="mt-2 text-xs text-[var(--g-text-secondary)]">
                  {certificationIntake.unresolvedPointReferences.length > 0 ? (
                    <>
                      Hay {certificationIntake.unresolvedPointReferences.length} referencia(s) por punto sin expediente Acuerdo 360 canónico.
                      Para presentar al registro, cree o enlace el expediente canónico desde el acta.
                    </>
                  ) : (
                    <>
                      Las {certificationIntake.pointReferences.length} referencia(s) por punto ya enlazan con expediente Acuerdo 360 sin alterar la certificación original.
                    </>
                  )}
                </div>
              ) : null}
            </div>
            {certificationIntake ? (
              <div className="flex flex-wrap gap-2">
                <span
                  className={`px-2 py-0.5 text-[11px] font-semibold ${
                    certificationIntake.evidenced
                      ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                      : "bg-[var(--status-warning)] text-[var(--g-text-inverse)]"
                  }`}
                  style={{ borderRadius: "var(--g-radius-full)" }}
                >
                  {certificationIntake.evidenced ? "Constancia verificada" : "Constancia pendiente"}
                </span>
                <span
                  className={`px-2 py-0.5 text-[11px] font-semibold ${
                    certificationIntake.hasEvidenceBundle
                      ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                      : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
                  }`}
                  style={{ borderRadius: "var(--g-radius-full)" }}
                >
                  {certificationIntake.hasEvidenceBundle ? "Evidencia demo/operativa vinculada" : "Evidencia operativa pendiente"}
                </span>
                {certificationIntake.resolvedPointAgreementIds.length > 0 ? (
                  <span
                    className="bg-[var(--g-sec-100)] px-2 py-0.5 text-[11px] font-semibold text-[var(--g-brand-3308)]"
                    style={{ borderRadius: "var(--g-radius-full)" }}
                  >
                    Refs. enlazadas
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {(requestedMateria || requestedPlantillaId) && (
        <div
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-4 py-3 text-sm text-[var(--g-text-primary)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          {/* Lote 1 coherencia (A4): el origen sin plantilla es Materias y reglas. */}
          {requestedPlantillaId ? "Entrada desde plantilla" : "Entrada desde Materias y reglas"}
          {requestedMateria ? (
            <>
              {" "}para materia <span className="font-semibold">{requestedMateria}</span>
            </>
          ) : null}
          {requestedPlantillaId ? (
            <>
              {" "}· plantilla <span className="font-mono text-xs">{requestedPlantillaId.slice(0, 8)}</span>
            </>
          ) : null}
          . El asistente prioriza acuerdos compatibles certificados o adoptados.
          {materiaMatchedAgreements.length > 1 ? (
            <>
              {" "}Hay {materiaMatchedAgreements.length} acuerdos compatibles; seleccione el expediente concreto.
            </>
          ) : null}
        </div>
      )}
      {materiaRescueActive && !showAllTramitables && (
        <div
          className="space-y-3 border border-[var(--status-warning)] bg-[var(--g-surface-card)] px-4 py-3 text-sm text-[var(--g-text-secondary)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-warning)]" />
            <span>
              <strong className="text-[var(--g-text-primary)]">
                No hay acuerdos de la materia {labelMateria(requestedMateria)} certificados o adoptados en el ámbito actual.
              </strong>{" "}
              La tramitación registral llega después de la adopción: primero se adopta el acuerdo en el
              órgano competente y, una vez certificado, se tramita aquí.
            </span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              to={adoptionRescueTarget.to}
              className="inline-flex items-center justify-center gap-2 bg-[var(--g-brand-3308)] px-3 py-2 text-sm font-semibold text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              Iniciar adopción de esta materia
            </Link>
            <button
              type="button"
              onClick={() => setShowAllTramitables(true)}
              className="inline-flex items-center justify-center gap-2 border border-[var(--g-border-subtle)] bg-transparent px-3 py-2 text-sm font-semibold text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              Ver otros acuerdos tramitables
            </button>
          </div>
        </div>
      )}
      {requestedMateriaWithoutAgreement && (showAllTramitables || !materiaRescueActive) && (
        <div
          className="flex items-start gap-2 px-4 py-3 text-sm text-[var(--status-warning)] bg-[var(--g-surface-muted)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          No hay acuerdos disponibles de materia {requestedMateria} en el ámbito actual. Se muestran el resto de acuerdos tramitables.
        </div>
      )}
      {agreementsLoading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-[var(--g-text-secondary)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando acuerdos...
        </div>
      ) : displayedAgreements.length === 0 ? (
        materiaRescueActive && !showAllTramitables ? null : (
        <div
          className="flex items-start gap-2 px-4 py-3 text-sm text-[var(--status-warning)] bg-[var(--g-surface-muted)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {certificationLoading
              ? "Cargando acuerdos incluidos en la certificación…"
              : certificationWithoutRegistryAgreements
                ? "La certificación solo contiene referencias por punto y todavía no tiene un expediente de acuerdo inscribible enlazable."
                : certificationAgreementsOutOfScope
                  ? "La certificación contiene acuerdos, pero ninguno está disponible en el ámbito de sociedad actual."
                  : isSociedadScoped
                    ? "No hay acuerdos certificados o adoptados disponibles para esta sociedad"
                    : "No hay acuerdos certificados o adoptados disponibles"}
          </span>
        </div>
        )
      ) : (
        <div className="space-y-2">
          {displayedAgreements.map((agreement) => {
            const includedInCertification = certifiedAgreementIds.has(agreement.id);
            return (
              <button
                key={agreement.id}
                type="button"
                onClick={() => handleSelectAgreement(agreement.id)}
                className={`w-full text-left flex items-center justify-between px-4 py-3 border transition-colors ${
                  effectiveSelectedAgreementId === agreement.id
                    ? "border-[var(--g-brand-3308)] bg-[var(--g-sec-100)]"
                    : includedInCertification
                      ? "border-[var(--g-sec-300)] bg-[var(--g-surface-subtle)]"
                      : "border-[var(--g-border-subtle)] hover:border-[var(--g-brand-3308)] hover:bg-[var(--g-surface-subtle)]/50"
                }`}
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-[var(--g-text-primary)]">
                    {agreement.agreement_kind}
                    {includedInCertification ? (
                      <span
                        className="bg-[var(--g-sec-100)] px-2 py-0.5 text-[10px] font-semibold text-[var(--g-brand-3308)]"
                        style={{ borderRadius: "var(--g-radius-full)" }}
                      >
                        Incluido en certificación
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-[var(--g-text-secondary)] mt-0.5">
                    Tipo de materia: {matterClassBusinessLabel(agreement.matter_class)} · Forma de adopción: {adoptionModeBusinessLabel(agreement.adoption_mode)}
                  </div>
                  <div className="mt-1 text-xs font-medium text-[var(--g-text-primary)]">
                    {agreement.decision_text || agreement.proposal_text || `Expediente ${agreement.id.slice(0, 8)}`}
                  </div>
                </div>
                <span
                  className={`px-2 py-1 text-[10px] font-semibold rounded-full ${
                    agreement.status === "CERTIFIED"
                      ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                      : "bg-[var(--g-brand-bright)] text-[var(--g-text-inverse)]"
                  }`}
                >
                  {statusLabel(agreement.status)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  // Step 2: Inscription analysis
  const step2Body = selectedAgreement && registryRulePackData ? (
    <div className="space-y-4">
      <RegistryRuleProvenanceNotice
        provenance={registryRuleProvenance}
        packOrgano={rulePackData?.pack.organo_tipo}
        agreementOrgano={selectedAgreementOrganoTipo ?? selectedAgreementBody?.body_type}
      />
      {/* Nota: el mismo aviso se repite junto al botón que eleva a escritura
          (paso 5), porque es allí donde se persiste en `registry_filings`. */}
      <div
        className="border border-[var(--g-border-subtle)] rounded-lg p-4 bg-[var(--g-surface-subtle)]"
      >
        <div className="text-sm font-semibold text-[var(--g-text-primary)] mb-3">
          Análisis de inscribibilidad
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--g-text-secondary)]">Acuerdo inscribible:</span>
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                registryRulePackData.payload.inscribible
                  ? "bg-[var(--status-success)]/10 text-[var(--status-success)]"
                  : "bg-[var(--status-warning)]/10 text-[var(--status-warning)]"
              }`}
            >
              {registryRulePackData.payload.inscribible ? "Sí" : "No"}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--g-text-secondary)]">Documento base del procedimiento:</span>
            <span className="px-2 py-0.5 text-xs font-medium text-[var(--g-text-primary)]">
              {registryBaseDocumentKind ?? "Ninguno"}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--g-text-secondary)]">Procedimiento aplicable:</span>
            <span className="px-2 py-0.5 text-xs font-medium text-[var(--g-text-primary)]">
              {registryProcedureProfile?.label ?? "Sin determinar"}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--g-text-secondary)]">Publicación requerida:</span>
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                registryRulePackData.payload.publicacionRequerida
                  ? "bg-[var(--status-warning)]/10 text-[var(--status-warning)]"
                  : "bg-[var(--status-success)]/10 text-[var(--status-success)]"
              }`}
            >
              {registryRulePackData.payload.publicacionRequerida ? "Sí" : "No"}
            </span>
          </div>
        </div>
      </div>

      {registryProcedureProfile?.kind === "DEPOSITO_CUENTAS" ? (
        <div
          className="border border-[var(--g-sec-300)] bg-[var(--g-sec-100)] px-4 py-3 text-sm text-[var(--g-text-primary)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          La aprobación de las cuentas no se presenta como inscripción del acuerdo. Este expediente
          tramita el depósito posterior y reutiliza la certificación emitida y custodiada como documento de base.
        </div>
      ) : null}

      {registryProcedureProfile?.deadlineDays != null && (
        <div
          className="px-4 py-2 text-sm text-[var(--g-text-secondary)] bg-[var(--g-surface-muted)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          {/* ITEM-135: el plazo puede ser escalar o estructurado {dias} — extraer el número. */}
          Plazo del procedimiento: {registryProcedureProfile.deadlineDays} días
        </div>
      )}

      {/* Lote 1-bis (fase 1): perfil de ejecución formal — panel informativo
          no disruptivo autorizado en el dossier (2026-07-18). No bloquea. */}
      <MatterExecutionProfilePanel
        materia={selectedAgreement?.agreement_kind}
        adoptionMode={selectedAgreement?.adoption_mode}
        organoTipo={selectedAgreementOrganoTipo}
        entity={entities.find((e) => e.id === selectedAgreement?.entity_id) ?? null}
        rulePack={rulePackData ?? null}
      />

      {/* Modelo de acuerdo */}
      <div className="border border-[var(--g-border-subtle)] p-4 space-y-3"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        <div className="text-sm font-semibold text-[var(--g-text-primary)]">
          Modelo de acuerdo (referencia)
        </div>

        {modelosLoading ? (
          <div className="flex items-center gap-2 text-sm text-[var(--g-text-secondary)]">
            <Loader2 className="h-3 w-3 animate-spin" />
            Cargando modelos...
          </div>
        ) : modelos.length === 0 ? (
          <div className="text-xs text-[var(--g-text-secondary)] px-3 py-2 bg-[var(--g-surface-muted)]"
            style={{ borderRadius: "var(--g-radius-sm)" }}
          >
            No hay modelo de acuerdo disponible para esta materia en este momento.
          </div>
        ) : (
          <div className="space-y-2">
            {requestedModeloMissing ? (
              <div
                className="flex items-start gap-2 px-3 py-2 text-xs text-[var(--status-warning)] bg-[var(--g-surface-muted)]"
                style={{ borderRadius: "var(--g-radius-sm)" }}
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                La plantilla indicada no corresponde a los modelos disponibles para esta materia. Seleccione un modelo alternativo.
              </div>
            ) : null}
            {modelos.map((m) => (
              <label key={m.id} className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="modelo_acuerdo"
                  value={m.id}
                  checked={selectedModeloId === m.id}
                  onChange={() => setSelectedModeloId(m.id)}
                  className="mt-0.5 accent-[var(--g-brand-3308)]"
                />
                <div className="flex-1">
                  <span className="text-sm text-[var(--g-text-primary)]">
                    {m.contenido_template ?? m.materia_acuerdo}
                  </span>
                  {requestedPlantillaId === m.id && (
                    <span
                      className="ml-2 bg-[var(--g-sec-100)] px-2 py-0.5 text-[10px] font-semibold text-[var(--g-brand-3308)]"
                      style={{ borderRadius: "var(--g-radius-full)" }}
                    >
                      Plantilla indicada
                    </span>
                  )}
                  {m.referencia_legal && (
                    <span className="ml-2 text-xs text-[var(--g-text-secondary)]">
                      ({m.referencia_legal})
                    </span>
                  )}
                </div>
              </label>
            ))}
          </div>
        )}

        {selectedModelo?.capa1_inmutable ? (
            <div className="space-y-1">
              <div className="text-xs font-medium text-[var(--g-text-secondary)] uppercase tracking-wide">
                Texto del modelo
              </div>
              <textarea
                readOnly
                rows={6}
                value={selectedModelo.capa1_inmutable}
                className="w-full px-3 py-2 text-xs text-[var(--g-text-secondary)] bg-[var(--g-surface-muted)] border border-[var(--g-border-subtle)] resize-none"
                style={{ borderRadius: "var(--g-radius-sm)", fontFamily: "monospace" }}
              />
              <p className="text-xs text-[var(--g-text-secondary)]">
                El texto puede ser editado en la pantalla de redacción del acuerdo.
              </p>
              {selectedModeloCapa3Fields.length > 0 ? (
                <div
                  className="mt-3 flex flex-wrap items-center justify-between gap-3 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <div>
                    <p className="text-xs font-medium text-[var(--g-text-primary)]">
                      Capa 3 del modelo de acuerdo
                    </p>
                    <p className="text-xs text-[var(--g-text-secondary)]">
                      {selectedModeloCapa3Fields.length} campo(s) editable(s)
                      {selectedModeloPendingCapa3 > 0
                        ? ` · ${selectedModeloPendingCapa3} obligatorio(s) pendiente(s)`
                        : " · captura preparada"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={openModeloCapa3Capture}
                    className="border border-[var(--g-border-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)]"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    Completar Capa 3
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
      </div>

      {rulesLoading && (
        <div className="flex items-center gap-2 py-4 text-sm text-[var(--g-text-secondary)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando reglas...
        </div>
      )}
    </div>
  ) : (
    <div
      className="flex items-center gap-2 px-4 py-3 text-sm text-[var(--status-warning)] bg-[var(--g-surface-muted)]"
      style={{ borderRadius: "var(--g-radius-md)" }}
    >
      <AlertTriangle className="h-4 w-4" />
      Seleccione un acuerdo en el paso anterior
    </div>
  );

  // Step 3: Instrument data (only if ESCRITURA or INSTANCIA)
  const showInstrumentForm = Boolean(registryProcedureProfile?.canPrepareFiling);

  const step3Body = showInstrumentForm ? (
    <div className="space-y-4">
      {registryBaseDocumentKind === "ESCRITURA" && (
        <>
          <div>
            <label htmlFor="registry-notary" className="block text-sm font-medium text-[var(--g-text-primary)] mb-2">
              Notaría
            </label>
            <input
              id="registry-notary"
              type="text"
              placeholder="Ej: Notaría López García, Madrid"
              value={instrumentData.notary}
              onChange={(e) => setInstrumentData({ ...instrumentData, notary: e.target.value })}
              onInput={(e) => setInstrumentData({ ...instrumentData, notary: e.currentTarget.value })}
              className="w-full px-3 py-2 border border-[var(--g-border-subtle)] text-sm text-[var(--g-text-primary)] placeholder-[var(--g-text-secondary)] bg-[var(--g-surface-card)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
          </div>

          <div>
            <label htmlFor="registry-deed-date" className="block text-sm font-medium text-[var(--g-text-primary)] mb-2">
              Fecha de escritura
            </label>
            <input
              id="registry-deed-date"
              type="date"
              value={instrumentData.deedDate}
              onChange={(e) => setInstrumentData({ ...instrumentData, deedDate: e.target.value })}
              onInput={(e) => setInstrumentData({ ...instrumentData, deedDate: e.currentTarget.value })}
              className="w-full px-3 py-2 border border-[var(--g-border-subtle)] text-sm text-[var(--g-text-primary)] bg-[var(--g-surface-card)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
          </div>

          <div>
            <label htmlFor="registry-protocol-number" className="block text-sm font-medium text-[var(--g-text-primary)] mb-2">
              Número de protocolo
            </label>
            <input
              id="registry-protocol-number"
              type="text"
              placeholder="Ej: 2026/5432"
              value={instrumentData.protocolNumber}
              onChange={(e) =>
                setInstrumentData({ ...instrumentData, protocolNumber: e.target.value })
              }
              onInput={(e) =>
                setInstrumentData({ ...instrumentData, protocolNumber: e.currentTarget.value })
              }
              className="w-full px-3 py-2 border border-[var(--g-border-subtle)] text-sm text-[var(--g-text-primary)] placeholder-[var(--g-text-secondary)] bg-[var(--g-surface-card)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
          </div>
        </>
      )}

      {registryBaseDocumentKind === "INSTANCIA" && (
        <div
          className="px-4 py-3 text-sm text-[var(--g-text-secondary)] bg-[var(--g-surface-muted)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          Tramitación vía instancia notarial. Los datos se completarán en el paso siguiente.
        </div>
      )}

      {registryBaseDocumentKind === "CERTIFICACION" && (
        <div
          className="border border-[var(--g-sec-300)] bg-[var(--g-sec-100)] px-4 py-3 text-sm text-[var(--g-text-primary)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          La certificación emitida y archivada se utilizará sin recomponerla. El expediente conserva
          su artefacto, bundle de evidencia y hash originales.
        </div>
      )}
    </div>
  ) : (
    <div
      className="flex items-center gap-2 px-4 py-3 text-sm text-[var(--status-warning)] bg-[var(--g-surface-muted)]"
      style={{ borderRadius: "var(--g-radius-md)" }}
    >
      <AlertTriangle className="h-4 w-4" />
      El rule pack no determina un procedimiento registral para este acuerdo.
    </div>
  );

  // Step 4: Filing submission
  const step4Body = (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-[var(--g-text-primary)] mb-2">
          Canal de presentación
        </label>
        <select
          value={filingChannel}
          onChange={(e) => setFilingChannel(e.target.value)}
          className="w-full px-3 py-2 border border-[var(--g-border-subtle)] text-sm text-[var(--g-text-primary)] bg-[var(--g-surface-card)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <option value="">Seleccionar canal</option>
          {/* ITEM-025: canales filtrados por la jurisdicción de la entidad (un acto
              ES no se presenta en la JUCERJA brasileña). BORME es publicación
              posterior a la inscripción, no un canal → no aparece. */}
          {registryChannelsForJurisdiction(
            selectedAgreementEntity?.jurisdiction ?? scopedEntity?.jurisdiction ?? "ES",
          ).map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {filingChannel && (
        <div
          className="px-4 py-3 text-sm text-[var(--g-text-secondary)] bg-[var(--g-surface-subtle)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          Canal "{filingChannel}" seleccionado. El expediente queda preparado para presentación;
          este entorno demo no realiza envío telemático al Registro.
        </div>
      )}

      {selectedAgreement && registryRulePackData && registryDocVariables && showInstrumentForm ? (
        <div
          className="space-y-3 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div>
            <h3 className="text-sm font-semibold text-[var(--g-text-primary)]">Documento de base</h3>
            <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
              {registryBaseDocumentKind === "CERTIFICACION"
                ? "La certificación ya emitida y custodiada se reutiliza con su misma evidencia, sin generar una copia divergente."
                : "Genere y archive el documento preparatorio antes de crear el expediente. El hash y la sociedad quedan vinculados al trámite."}
            </p>
          </div>
          {registryBaseDocumentKind === "CERTIFICACION" && baseDocumentArtifactId ? (
            <div
              className="inline-flex items-center gap-2 bg-[var(--g-sec-100)] px-3 py-2 text-xs font-semibold text-[var(--g-brand-3308)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <CheckCircle2 className="h-4 w-4 text-[var(--status-success)]" />
              Certificación emitida vinculada
            </div>
          ) : (
            <ProcessDocxButton
              label={registryBaseDocumentKind === "ESCRITURA" ? "Documento preparatorio de escritura DOCX" : "Documento registral DOCX"}
              variant="outline"
              onGenerated={handleRegistryDocumentGenerated}
              input={{
                kind: "DOCUMENTO_REGISTRAL",
                recordId: selectedAgreement.id,
                title: `${registryDocumentTitleLabel}: ${selectedAgreement.decision_text || selectedAgreement.proposal_text || selectedAgreement.agreement_kind}`,
                subtitle: selectedAgreementLegalName,
                entityName: selectedAgreementLegalName,
                templateTypes: ["DOCUMENTO_REGISTRAL"],
                variables: registryDocVariables,
                templateCriteria: {
                  jurisdiction: selectedAgreementEntity?.jurisdiction ?? scopedEntity?.jurisdiction,
                  materia: selectedAgreement.agreement_kind,
                  adoptionMode: selectedAgreement.adoption_mode,
                },
                preferredTemplateId: preferredTemplateIdFor("DOCUMENTO_REGISTRAL"),
                fallbackText: registryDocFallback,
                filenamePrefix: "documento_registral",
                generatedAt: registryDocumentGeneratedAt(instrumentData),
              }}
            />
          )}
          {baseDocumentArtifactMessage ? (
            <p className="text-xs text-[var(--status-success)]">{baseDocumentArtifactMessage}</p>
          ) : null}

          {deedSaved ? (
            <div className="inline-flex items-center gap-2 bg-[var(--g-sec-100)] px-3 py-1 text-xs font-semibold text-[var(--g-brand-3308)]" style={{ borderRadius: "var(--g-radius-full)" }}>
              <CheckCircle2 className="h-4 w-4 text-[var(--status-success)]" />
              Expediente v2 preparado
            </div>
          ) : (
            <button
              type="button"
              onClick={handleRegisterDeed}
              disabled={!canRegisterDeed || deedSaving}
              aria-busy={deedSaving}
              className="inline-flex items-center justify-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:bg-[var(--g-surface-muted)] disabled:text-[var(--g-text-secondary)] disabled:opacity-100"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              {deedSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {deedSaving
                ? "Preparando expediente..."
                : "Preparar expediente registral"}
            </button>
          )}
        </div>
      ) : null}

      {registryWorkflowVersion === 2 && ["PREPARADA", "ELEVADA"].includes(filingStatus) ? (
        <div
          className="space-y-3 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <h3 className="text-sm font-semibold text-[var(--g-text-primary)]">Asiento de presentación</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="registry-filing-number" className="block text-xs font-medium text-[var(--g-text-primary)]">
                Número de entrada o asiento
              </label>
              <input
                id="registry-filing-number"
                value={filingNumber}
                onChange={(event) => setFilingNumber(event.target.value)}
                onInput={(event) => setFilingNumber(event.currentTarget.value)}
                className="mt-1 w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              />
            </div>
            <div>
              <label htmlFor="registry-presentation-date" className="block text-xs font-medium text-[var(--g-text-primary)]">
                Fecha de presentación
              </label>
              <input
                id="registry-presentation-date"
                type="date"
                value={presentationDate}
                onChange={(event) => setPresentationDate(event.target.value)}
                onInput={(event) => setPresentationDate(event.currentTarget.value)}
                className="mt-1 w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              />
            </div>
          </div>
          <div>
            <label htmlFor="registry-presentation-evidence" className="block text-xs font-medium text-[var(--g-text-primary)]">
              Justificante de presentación
            </label>
            <input
              id="registry-presentation-evidence"
              type="file"
              onChange={(event) => {
                setPresentationEvidenceFile(event.target.files?.[0] ?? null);
                setPresentationEvidenceArtifactId(null);
                presentationOperationId.current = crypto.randomUUID();
                presentationRecordedAt.current = new Date().toISOString();
              }}
              className="mt-1 block w-full text-xs text-[var(--g-text-secondary)] file:mr-3 file:border-0 file:bg-[var(--g-surface-subtle)] file:px-3 file:py-2 file:text-xs file:font-medium file:text-[var(--g-text-primary)]"
            />
          </div>
          <button
            type="button"
            onClick={handleRecordPresentation}
            disabled={recordPresentation.isPending || uploadRegistryEvidence.isPending}
            aria-busy={recordPresentation.isPending || uploadRegistryEvidence.isPending}
            className="inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] disabled:opacity-50"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            {(recordPresentation.isPending || uploadRegistryEvidence.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
            Registrar presentación
          </button>
        </div>
      ) : null}
    </div>
  );

  // Step 5: Tracking status
  const step5Body = (
    <div className="space-y-4">
      <div
        className={`flex items-center gap-2 px-4 py-3 rounded-lg ${
          deedSaved
            ? "bg-[var(--status-success)]/10 text-[var(--status-success)]"
            : isDeedRequired
              ? "bg-[var(--status-warning)]/10 text-[var(--status-warning)]"
              : "bg-[var(--status-success)]/10 text-[var(--status-success)]"
        }`}
      >
        <CheckCircle2 className="h-5 w-5" />
        <span className="text-sm font-medium">
          {deedSaved
            ? `${baseDocumentBusinessLabel} vinculada al expediente`
            : isDeedRequired
              ? "Pendiente de registrar escritura en expediente"
              : registryProcedureProfile?.canPrepareFiling
                ? `Pendiente de vincular ${baseDocumentBusinessLabel.toLocaleLowerCase("es-ES")}`
                : "Sin procedimiento registral aplicable"}
        </span>
      </div>

      {isDeedRequired && (
        <div
          className="border border-[var(--g-border-subtle)] rounded-lg p-4 bg-[var(--g-surface-card)]"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-[var(--g-text-primary)]">
                Escritura pública
              </div>
              <div className="mt-1 text-xs text-[var(--g-text-secondary)]">
                {certificationIntake && !certificationIntake.readyForRegistry
                  ? "Antes de registrar, emita y archive la certificación DOCX con constancia de interposición; no constituye por sí sola prueba de presentación registral."
                  : deedSaved
                    ? "Datos notariales y artefacto declarados en el expediente demo. La prueba no acredita por sí sola un otorgamiento productivo."
                    : "Al preparar el expediente se registrarán los datos notariales y el artefacto aportado, sin atribuirles efectos jurídicos no acreditados."}
              </div>
            </div>

            {agreementLacksCertification && !deedSaved && (
              <div
                className="flex items-start gap-2 border border-[var(--status-error)] bg-[var(--g-surface-muted)] p-3 text-sm text-[var(--g-text-primary)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
                role="alert"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-error)]" />
                <div className="space-y-1.5">
                  <div className="font-medium">
                    Acuerdo sin certificación emitida — no inscribible (art. 107 RRM)
                  </div>
                  <p className="text-xs text-[var(--g-text-secondary)]">
                    La elevación a público exige un título inscribible (escritura o certificación del
                    acuerdo). Este acuerdo no tiene una certificación emitida y evidenciada vinculada. Emite primero
                    la certificación desde el acta, o marca el override justificado para proceder bajo
                    tu responsabilidad.
                  </p>
                  <label className="flex items-center gap-2 text-xs text-[var(--g-text-primary)]">
                    <input
                      type="checkbox"
                      checked={deedCertificationOverride}
                      onChange={(e) => setDeedCertificationOverride(e.target.checked)}
                      className="h-3.5 w-3.5 accent-[var(--g-brand-3308)]"
                    />
                    Proceder sin certificación (override justificado)
                  </label>
                </div>
              </div>
            )}

            {/* El aviso de procedencia se repite aquí, junto al botón: es este
                paso —y no el 2, donde también aparece— el que persiste la
                elevación en `registry_filings`. Advierte, no bloquea. */}
            <RegistryRuleProvenanceNotice
              provenance={registryRuleProvenance}
              packOrgano={rulePackData?.pack.organo_tipo}
              agreementOrgano={selectedAgreementOrganoTipo ?? selectedAgreementBody?.body_type}
              className="mb-3"
            />

            {deedSaved ? (
              <div className="inline-flex items-center gap-2 rounded-full bg-[var(--g-sec-100)] px-3 py-1 text-xs font-semibold text-[var(--g-brand-3308)]">
                <CheckCircle2 className="h-4 w-4 text-[var(--status-success)]" />
                Persistida
              </div>
            ) : (
              <button
                type="button"
                onClick={handleRegisterDeed}
                disabled={!canRegisterDeed || deedSaving}
                className="inline-flex items-center justify-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:bg-[var(--g-surface-muted)] disabled:text-[var(--g-text-secondary)] disabled:opacity-100"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                {deedSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                {deedSaving ? "Vinculando escritura..." : "Vincular escritura al expediente"}
              </button>
            )}
          </div>
          {certificationIntake ? (
            <div
              className="mt-4 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-3 py-2 text-xs text-[var(--g-text-secondary)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <div className="font-semibold text-[var(--g-text-primary)]">
                Vínculo probatorio operativo de certificación
              </div>
              <div className="mt-1">
                {!certificationIntake.readyForRegistry
                  ? "Certificación pendiente: debe estar emitida, custodiada y con constancia vinculada desde el acta antes de registrar la escritura."
                  : registryLinkSaved
                  ? registryLinkMessage ?? "Vínculo registrado."
                  : "Al preparar el expediente, la certificación quedará como origen explícito y la RPC validará constancia, custodia, tenant y sociedad."}
              </div>
            </div>
          ) : null}
        </div>
      )}

      <div
        className="border border-[var(--g-border-subtle)] rounded-lg p-4 bg-[var(--g-surface-subtle)]"
      >
        <div className="text-sm font-semibold text-[var(--g-text-primary)] mb-3">
          Estado del trámite
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--g-text-secondary)]">Estado:</span>
            <span className="px-2 py-0.5 text-xs font-medium text-[var(--g-text-primary)]">
              {statusLabel(filingStatus)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--g-text-secondary)]">Canal:</span>
            <span className="px-2 py-0.5 text-xs font-medium text-[var(--g-text-primary)]">
              {filingChannel || "No asignado"}
            </span>
          </div>
        </div>

      </div>

      {filingStatus === "SUBSANACION" && (
        <div className="space-y-3 border border-[var(--status-warning)] bg-[var(--g-surface-muted)] p-4"
          style={{ borderRadius: "var(--g-radius-lg)" }}
        >
          {subsanacionDone ? (
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--status-success)]" />
              <div>
                <p className="text-sm font-semibold text-[var(--g-text-primary)]">Subsanación preparada</p>
                <p className="mt-0.5 text-xs text-[var(--g-text-secondary)]">
                  La respuesta ha quedado registrada en el expediente demo. No se realiza envío registral.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--status-warning)]">
                <AlertTriangle className="h-4 w-4" />
                Subsanación requerida por el Registro Mercantil
              </div>
              <p className="text-xs text-[var(--g-text-secondary)]">
                El Registro Mercantil ha solicitado subsanación. Indique el motivo de la respuesta y los documentos adjuntos.
              </p>
              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--g-text-primary)]">
                  Motivo de la subsanación
                </label>
                <textarea
                  rows={3}
                  value={subsanacionMotivo}
                  onChange={(e) => setSubsanacionMotivo(e.target.value)}
                  placeholder="Describa la corrección realizada…"
                  className="w-full resize-none rounded border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--g-text-primary)]">
                  Documentos adjuntos (referencia)
                </label>
                <input
                  type="text"
                  value={subsanacionDocs}
                  onChange={(e) => setSubsanacionDocs(e.target.value)}
                  placeholder="Ej: Escritura corregida, certificado notarial…"
                  className="w-full rounded border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="registry-remedy-evidence" className="text-xs font-medium text-[var(--g-text-primary)]">
                  Documento presentado para subsanar
                </label>
                <input
                  id="registry-remedy-evidence"
                  type="file"
                  onChange={(event) => {
                    setSubsanacionEvidenceFile(event.target.files?.[0] ?? null);
                    setSubsanacionEvidenceArtifactId(null);
                    remedyOperationId.current = crypto.randomUUID();
                    remedyEffectiveAt.current = new Date().toISOString();
                  }}
                  className="block w-full text-xs text-[var(--g-text-secondary)] file:mr-3 file:border-0 file:bg-[var(--g-surface-subtle)] file:px-3 file:py-2 file:text-xs file:font-medium file:text-[var(--g-text-primary)]"
                />
              </div>
              <button
                type="button"
                onClick={handleSubsanacionSubmit}
                disabled={!subsanacionMotivo.trim() || (!subsanacionEvidenceFile && !subsanacionEvidenceArtifactId) || subsanacionSaving}
                aria-busy={subsanacionSaving}
                className="inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:opacity-50"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                {subsanacionSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                {subsanacionSaving ? "Registrando…" : "Preparar respuesta de subsanación"}
              </button>
              {selectedAgreement && subsanacionDocVariables ? (
                <ProcessDocxButton
                  label="Subsanación DOCX"
                  input={{
                    kind: "SUBSANACION_REGISTRAL",
                    recordId: selectedAgreement.id,
                    title: `Respuesta de subsanación: ${selectedAgreement.agreement_kind}`,
                    subtitle: selectedAgreementLegalName,
                    entityName: selectedAgreementLegalName,
                    templateTypes: ["SUBSANACION_REGISTRAL", "DOCUMENTO_REGISTRAL"],
                    variables: subsanacionDocVariables,
                    templateCriteria: {
                      jurisdiction: selectedAgreementEntity?.jurisdiction ?? scopedEntity?.jurisdiction,
                      materia: selectedAgreement.agreement_kind,
                      adoptionMode: selectedAgreement.adoption_mode,
                    },
                    preferredTemplateId: preferredTemplateIdFor("SUBSANACION_REGISTRAL"),
                    fallbackText: subsanacionDocFallback,
                    filenamePrefix: "subsanacion_registral",
                  }}
                />
              ) : null}
            </>
          )}
        </div>
      )}

      <div
        className="px-4 py-3 text-xs text-[var(--g-text-secondary)] bg-[var(--g-surface-muted)]"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        El sistema monitorizará automáticamente el estado de la presentación y le notificará de
        cambios o subsanaciones requeridas.
      </div>
    </div>
  );

  const step2CanAdvance = Boolean(registryProcedureProfile?.canPrepareFiling);
  const step3CanAdvance = Boolean(
    registryProcedureProfile?.canPrepareFiling &&
      (!isDeedRequired || (
        instrumentData.notary.trim() &&
        instrumentData.deedDate &&
        instrumentData.protocolNumber.trim()
      )),
  );
  const step4CanAdvance = Boolean(registryFilingId && deedSaved);

  return (
    <>
      <StepperShell
        eyebrow="Secretaría · Tramitación registral"
        title="Asistente de tramitación"
        backTo={scopedBackTo}
        steps={[
          { ...STEPS[0], body: step1Body, canAdvance: step1CanAdvance },
          { ...STEPS[1], body: step2Body, canAdvance: step2CanAdvance },
          { ...STEPS[2], body: step3Body, canAdvance: step3CanAdvance },
          { ...STEPS[3], body: step4Body, canAdvance: step4CanAdvance },
          { ...STEPS[4], body: step5Body },
        ]}
        /* ITEM-068/062: tras registrar la escritura/subsanación, el último paso
           ofrece un CTA al expediente registral creado (antes era dead-end: el
           stepper no tenía ninguna llamada a navigate). */
        finishTo={registryFilingId ? `/secretaria/tramitador/${registryFilingId}` : null}
        finishLabel="Ver expediente registral"
      />
      <Capa3CaptureDialog
        open={modeloCapa3Open}
        title="Completar Capa 3 del modelo"
        subtitle={selectedModelo ? `${selectedModelo.materia_acuerdo} · ${selectedModelo.version}` : "Modelo de acuerdo"}
        fields={selectedModeloCapa3Fields}
        values={modeloCapa3Values}
        errors={modeloCapa3Errors}
        submitLabel="Guardar captura"
        onChange={(values) => {
          setModeloCapa3Values(values);
          setModeloCapa3Errors({});
        }}
        onClose={() => setModeloCapa3Open(false)}
        onSubmit={submitModeloCapa3Capture}
      />
    </>
  );
}

export default function TramitadorStepper() {
  const { id } = useParams();
  return id ? <TramitacionDetalle id={id} /> : <TramitadorNuevo />;
}
