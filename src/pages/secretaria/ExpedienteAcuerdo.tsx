import { useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  FileCheck2,
  CheckCircle2,
  AlertTriangle,
  Circle,
  Scale,
  FileSignature,
  FileText,
  Building2,
  Gavel,
  Megaphone,
  ChevronDown,
  ChevronUp,
  Shield,
  Handshake,
  UserCheck,
  ClipboardCheck,
  Lock,
} from "lucide-react";
import { useAgreement, useAgreementCompliance, type ComplianceResult } from "@/hooks/useAgreementCompliance";
import { useAgreementSignedDocumentUrl } from "@/hooks/useEvidenceBundleSignedUrl";
import { useCurrentUserRole } from "@/hooks/useCurrentUser";
import { useQTSPVerification } from "@/hooks/useQTSPVerification";
import { usePactosVigentes } from "@/hooks/usePactosParasociales";
import { useAgreementNormativeSnapshot } from "@/hooks/useNormativeFramework";
import { useAgreementRuleSnapshot } from "@/hooks/useRuleManager";
import { isLegacyMeetingAdoptionSnapshot } from "@/lib/rules-engine";
import {
  classifyFrozenSnapshot,
  type FrozenSnapshotClassification,
  type FrozenSnapshotHealth,
} from "@/lib/secretaria/rule-manager-contract";
import { evaluarPactosParasociales } from "@/lib/rules-engine/pactos-engine";
import type { PactosEvalInput } from "@/lib/rules-engine/pactos-engine";
import type { AdoptionMode, MateriaClase } from "@/lib/rules-engine";
import type { AgreementNormativeSnapshot, NormativeFrameworkStatus } from "@/lib/secretaria/normative-framework";
import { statusLabel } from "@/lib/secretaria/status-labels";
import { evaluarDesfaseNormativo } from "@/lib/secretaria/desfase-normativo";
import { supabase } from "@/integrations/supabase/client";
import { PreviewGatePanel } from "@/components/secretaria/PreviewGatePanel";
import { AutorizacionesRegulatoriasCard } from "@/components/secretaria/AutorizacionesRegulatoriasCard";
import { AgreementDocumentRequirementsPanel } from "@/components/secretaria/AgreementDocumentRequirementsPanel";
import { useSecretariaScope } from "@/components/secretaria/shell";
import { REVIEW_STATE_VIEW } from "@/lib/motor-plantillas";
import { useTenantContext } from "@/context/TenantContext";

interface RuleEvaluationResult {
  id: string;
  etapa: string;
  ok: boolean;
  severity: "OK" | "WARNING" | "BLOCKING";
  // ITEM-107: la columna real de rule_evaluation_results es `explain` (jsonb),
  // no `explain_json`; el campo anterior quedaba siempre undefined y la sección
  // de detalle de evaluación no se renderizaba nunca.
  explain: Record<string, unknown> | null;
  blocking_issues: string[] | null;
  warnings: string[] | null;
}

// ITEM-104
interface AgreementCertRow {
  id: string;
  tipo_certificacion: string | null;
  signature_status: string | null;
  created_at: string;
  agreement_id: string | null;
  agreements_certified: string[] | null;
  minute_id: string | null;
}

interface AgreementRegistryFilingRow {
  id: string;
  status: string;
  filing_via: string;
  filing_number: string | null;
  presentation_date: string | null;
  inscription_number: string | null;
  created_at: string;
}

const STATUS_TONE: Record<string, string> = {
  DRAFT:              "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]",
  PROPOSED:           "bg-[var(--status-info)] text-[var(--g-text-inverse)]",
  ADOPTED:            "bg-[var(--g-sec-300)] text-[var(--g-brand-3308)]",
  CERTIFIED:          "bg-[var(--g-brand-bright)] text-[var(--g-text-inverse)]",
  INSTRUMENTED:       "bg-[var(--g-sec-700)] text-[var(--g-text-inverse)]",
  FILED:              "bg-[var(--status-info)] text-[var(--g-text-inverse)]",
  REGISTERED:         "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  REJECTED_REGISTRY:  "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  PUBLISHED:          "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
};

const TIMELINE = [
  "DRAFT",
  "PROPOSED",
  "ADOPTED",
  "CERTIFIED",
  "INSTRUMENTED",
  "FILED",
  "REGISTERED",
  "PUBLISHED",
];

const TIMELINE_LABEL: Record<string, string> = {
  DRAFT:        "Borrador",
  PROPOSED:     "Propuesto",
  ADOPTED:      "Adoptado",
  CERTIFIED:    "Certificado",
  INSTRUMENTED: "Instrumentado",
  FILED:        "Preparado para registro",
  REGISTERED:   "Inscrito",
  PUBLISHED:    "Publicado",
  // ITEM-147: rama terminal de rechazo registral (no es etapa lineal del TIMELINE,
  // por eso no se añade al array; solo a la etiqueta para el badge).
  REJECTED_REGISTRY: "Rechazado por el Registro Mercantil",
};

const ADOPTION_MODES: AdoptionMode[] = [
  "MEETING",
  "UNIVERSAL",
  "NO_SESSION",
  "UNIPERSONAL_SOCIO",
  "UNIPERSONAL_ADMIN",
  "CO_APROBACION",
  "SOLIDARIO",
];

const MATERIA_CLASES: MateriaClase[] = ["ORDINARIA", "ESTATUTARIA", "ESTRUCTURAL", "ESPECIAL"];

function toAdoptionMode(value: string | null | undefined): AdoptionMode {
  return ADOPTION_MODES.includes(value as AdoptionMode) ? (value as AdoptionMode) : "MEETING";
}

function toMateriaClase(value: string | null | undefined): MateriaClase {
  return MATERIA_CLASES.includes(value as MateriaClase) ? (value as MateriaClase) : "ORDINARIA";
}

function adoptionModeLabel(value: string | null | undefined) {
  const labels: Record<string, string> = {
    MEETING: "Sesión formal",
    UNIVERSAL: "Junta universal",
    NO_SESSION: "Acuerdo sin sesión",
    UNIPERSONAL_SOCIO: "Decisión de socio único",
    UNIPERSONAL_ADMIN: "Decisión de administrador único",
    CO_APROBACION: "Decisión mancomunada",
    SOLIDARIO: "Decisión de administrador solidario",
  };
  return labels[value ?? ""] ?? "Sesión formal";
}

function matterClassLabel(value: string | null | undefined) {
  const labels: Record<string, string> = {
    ORDINARIA: "Ordinaria",
    ESTATUTARIA: "Estatutaria",
    ESTRUCTURAL: "Estructural",
    ESPECIAL: "Especial",
  };
  return labels[value ?? ""] ?? "Ordinaria";
}

// F3.G3 — Reemplaza el enlace directo al documento (anteriormente href con
// agreement document URL) por un enlace firmado vía Edge Function
// sign-evidence-url. Resuelve agreementId → evidence_bundle.id → signed URL
// con TTL 5min (no más URLs públicas sobre bucket privado).
function AgreementArchivedDocLink({ agreementId }: { agreementId: string }) {
  const { signedUrl, isLoading, isError, hasBundle } = useAgreementSignedDocumentUrl(agreementId);

  if (!hasBundle && !isLoading) {
    return (
      <div className="flex flex-col gap-1">
        <span className="inline-flex items-center gap-1.5 border border-[var(--g-border-subtle)] px-3 py-2 text-sm text-[var(--g-text-secondary)]"
              style={{ borderRadius: "var(--g-radius-md)" }}>
          <FileText className="h-4 w-4" />
          Documento archivado (bundle pendiente de migración)
        </span>
        <span className="text-xs text-[var(--g-text-secondary)]">
          Promocion a expediente pendiente de {REVIEW_STATE_VIEW}.
        </span>
      </div>
    );
  }

  if (isLoading) {
    return (
      <span className="inline-flex items-center gap-1.5 border border-[var(--g-border-subtle)] px-3 py-2 text-sm text-[var(--g-text-secondary)]"
            style={{ borderRadius: "var(--g-radius-md)" }}>
        <FileText className="h-4 w-4 animate-pulse" />
        Generando enlace firmado…
      </span>
    );
  }

  if (isError || !signedUrl) {
    return (
      <span className="inline-flex items-center gap-1.5 border border-[var(--status-error)] px-3 py-2 text-sm text-[var(--status-error)]"
            style={{ borderRadius: "var(--g-radius-md)" }}>
        <FileText className="h-4 w-4" />
        Error generando enlace
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <a
        href={signedUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 border border-[var(--g-border-subtle)] px-3 py-2 text-sm text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] transition-colors"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        <FileText className="h-4 w-4 text-[var(--g-brand-3308)]" />
        Ver documento archivado
      </a>
      <span className="text-xs text-[var(--g-text-secondary)]">
        Promocion a expediente pendiente de {REVIEW_STATE_VIEW}.
      </span>
    </div>
  );
}

export default function ExpedienteAcuerdo() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const scope = useSecretariaScope();
  const { data: agreement, isLoading } = useAgreement(id);
  const { data: compliance } = useAgreementCompliance(id);
  const { data: verification, isLoading: verificationLoading } = useQTSPVerification(id);
  const { data: normativeSnapshot, isLoading: normativeLoading } = useAgreementNormativeSnapshot(agreement);
  const { data: frozenSnapshot, isLoading: frozenSnapshotLoading } = useAgreementRuleSnapshot(id);
  const { primaryRole, displayName } = useCurrentUserRole();

  // T11 (run-log UX 2026-06-20 §6.9.4) — aviso de desfase del marco normativo.
  // Compara el hash congelado al adoptar con el fingerprint vivo; solo avisa si el
  // congelado es CANÓNICO (los de origen reunión son PAYLOAD, no comparables → sin
  // falsos positivos). Lógica pura en desfase-normativo.ts.
  const desfaseNormativo = (() => {
    const snap = (agreement as { compliance_snapshot?: unknown } | undefined)?.compliance_snapshot as
      | { normative_profile_hash?: string | null; normative_profile_hash_kind?: string | null }
      | null
      | undefined;
    return evaluarDesfaseNormativo({
      frozenProfileHash: snap?.normative_profile_hash ?? null,
      frozenProfileHashKind: snap?.normative_profile_hash_kind ?? null,
      liveProfileHash: normativeSnapshot?.profile_hash ?? null,
    });
  })();

  const { data: ruleEvaluations = [] } = useQuery({
    queryKey: ["rule_evaluations", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rule_evaluation_results")
        .select("*")
        .eq("agreement_id", id);
      if (error) throw error;
      return (data ?? []) as RuleEvaluationResult[];
    },
    enabled: !!id,
  });

  // ITEM-104: cross-link inverso — certificaciones de este acuerdo (por agreement_id
  // directo o por pertenencia al array agreements_certified de una certificación
  // minute-based) y el expediente registral más reciente.
  const { data: certificaciones = [], isLoading: certsLoading } = useQuery({
    queryKey: ["agreement_certifications", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("certifications")
        .select(
          "id, tipo_certificacion, signature_status, created_at, agreement_id, agreements_certified, minute_id",
        )
        .or(`agreement_id.eq.${id},agreements_certified.cs.{${id}}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AgreementCertRow[];
    },
    enabled: !!id,
  });

  const { data: registryFiling = null } = useQuery({
    queryKey: ["agreement_registry_filing", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registry_filings")
        .select(
          "id, status, filing_via, filing_number, presentation_date, inscription_number, created_at",
        )
        .eq("agreement_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as AgreementRegistryFilingRow | null;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1200px] p-6 text-sm text-[var(--g-text-secondary)]">
        Cargando expediente…
      </div>
    );
  }
  if (!agreement) {
    return (
      <div className="mx-auto max-w-[1200px] p-6 text-sm text-[var(--g-text-secondary)]">
        Acuerdo no encontrado.
      </div>
    );
  }

  const a = agreement;
  const statusIndex = TIMELINE.indexOf(a.status);
  const generarTo = scope.createScopedTo(`/secretaria/acuerdos/${id}/generar`);

  return (
    <div className="mx-auto max-w-[1200px] p-6">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--g-text-secondary)] hover:text-[var(--g-brand-3308)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver
      </button>

      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
          <FileCheck2 className="h-3.5 w-3.5" />
          Expediente del acuerdo · {a.agreement_kind}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
            {a.proposal_text?.split("\n")[0] ?? a.agreement_kind}
          </h1>
          <span
            className={`inline-flex items-center px-2.5 py-1 text-[11px] font-semibold ${
              STATUS_TONE[a.status] ?? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
            }`}
            style={{ borderRadius: "var(--g-radius-full)" }}
          >
            {TIMELINE_LABEL[a.status] ?? a.status}
          </span>
        </div>
        <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
          {a.entities?.common_name ?? "—"} · {a.entities?.jurisdiction ?? ""} ·{" "}
          {a.entities?.legal_form ?? ""} · {a.governing_bodies?.name ?? "—"}
        </p>
        {/* Generar documento — visible when ADOPTED or later */}
        {statusIndex >= TIMELINE.indexOf("ADOPTED") && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(generarTo)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] transition-colors"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <FileSignature className="h-4 w-4" />
              Generar documento
            </button>
            {a.document_url && (
              <AgreementArchivedDocLink agreementId={a.id} />
            )}
          </div>
        )}
      </div>

      {/* Timeline */}
      <div
        className="mb-6 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-5"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <h2 className="mb-4 text-sm font-semibold text-[var(--g-text-primary)]">Ciclo del acuerdo</h2>
        <ol className="grid grid-cols-8 gap-2">
          {TIMELINE.map((s, i) => {
            const done = i <= statusIndex;
            const active = i === statusIndex;
            return (
              <li key={s} className="flex flex-col items-center text-center">
                <div
                  className={`flex h-7 w-7 items-center justify-center text-[11px] font-semibold ${
                    done
                      ? "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]"
                      : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
                  }`}
                  style={{ borderRadius: "var(--g-radius-full)" }}
                >
                  {i + 1}
                </div>
                <div
                  className={`mt-1.5 text-[11px] ${
                    active
                      ? "font-semibold text-[var(--g-brand-3308)]"
                      : done
                        ? "text-[var(--g-text-primary)]"
                        : "text-[var(--g-text-secondary)]"
                  }`}
                >
                  {TIMELINE_LABEL[s]}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card icon={<Scale className="h-4 w-4" />} title="Propuesta">
            <pre className="whitespace-pre-wrap font-sans text-sm text-[var(--g-text-primary)]">
              {a.proposal_text ?? "— Sin propuesta —"}
            </pre>
          </Card>

          <Card icon={<Gavel className="h-4 w-4" />} title="Adopción">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <KV label="Forma de adopción" value={adoptionModeLabel(a.adoption_mode)} />
              <KV label="Tipo de materia" value={matterClassLabel(a.matter_class)} />
              <KV label="Quórum exigido" value={a.required_quorum_code ?? "—"} />
              <KV label="Mayoría exigida" value={a.required_majority_code ?? "—"} />
              <KV
                label="Fecha decisión"
                value={a.decision_date ? new Date(a.decision_date).toLocaleDateString("es-ES") : "—"}
              />
              <KV
                label="Efectos"
                value={a.effective_date ? new Date(a.effective_date).toLocaleDateString("es-ES") : "—"}
              />
            </div>
            {a.decision_text ? (
              <pre className="mt-4 whitespace-pre-wrap rounded bg-[var(--g-surface-subtle)] p-3 font-sans text-[12px] leading-relaxed text-[var(--g-text-primary)]">
                {a.decision_text}
              </pre>
            ) : null}
          </Card>

          <Card icon={<FileSignature className="h-4 w-4" />} title="Origen">
            {a.parent_meeting_id ? (
              <p className="text-sm text-[var(--g-text-primary)]">
                Adoptado en reunión{" "}
                <Link
                  to={scope.createScopedTo(`/secretaria/reuniones/${a.parent_meeting_id}`)}
                  className="text-[var(--g-link)] underline-offset-2 hover:text-[var(--g-link-hover)] hover:underline"
                >
                  ver reunión
                </Link>
              </p>
            ) : a.unipersonal_decision_id ? (
              <p className="text-sm text-[var(--g-text-primary)]">
                Origen: decisión unipersonal{" "}
                <Link
                  to={scope.createScopedTo(`/secretaria/decisiones-unipersonales/${a.unipersonal_decision_id}`)}
                  className="text-[var(--g-link)] underline-offset-2 hover:text-[var(--g-link-hover)] hover:underline"
                >
                  ver decisión
                </Link>
              </p>
            ) : a.no_session_resolution_id ? (
              <p className="text-sm text-[var(--g-text-primary)]">
                Origen: acuerdo sin sesión{" "}
                <Link
                  to={scope.createScopedTo(`/secretaria/acuerdos-sin-sesion/${a.no_session_resolution_id}`)}
                  className="text-[var(--g-link)] underline-offset-2 hover:text-[var(--g-link-hover)] hover:underline"
                >
                  ver acuerdo
                </Link>
              </p>
            ) : (
              <p className="text-sm text-[var(--g-text-secondary)]">Sin origen registrado.</p>
            )}
            {a.statutory_basis ? (
              <p className="mt-2 text-xs text-[var(--g-text-secondary)]">
                Base estatutaria: <span className="font-mono">{a.statutory_basis}</span>
              </p>
            ) : null}
          </Card>

          {desfaseNormativo.desfase && (
            <div
              role="status"
              className="flex items-start gap-3 border border-[var(--status-warning)] bg-[var(--g-surface-subtle)] px-4 py-3"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-warning)]" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-[var(--g-text-primary)]">
                  Marco normativo posiblemente desfasado
                </p>
                <p className="mt-1 text-xs text-[var(--g-text-secondary)]">{desfaseNormativo.mensaje}</p>
              </div>
            </div>
          )}

          <NormativeSnapshotCard snapshot={normativeSnapshot} isLoading={normativeLoading} />

          <AgreementDocumentRequirementsPanel agreement={a} />

          <FrozenRuleSnapshotCard
            snapshot={frozenSnapshot}
            isLoading={frozenSnapshotLoading}
            agreementEntityId={a.entity_id}
            agreementMatter={a.agreement_kind}
            agreementAdoptionMode={a.adoption_mode}
          />

          <Card icon={<Building2 className="h-4 w-4" />} title="Instrumentación y registro">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <KV
                label="Inscribible"
                value={compliance?.inscribable ? "Sí" : "No"}
              />
              <KV
                label="Instrumento"
                value={compliance?.instrument_required ?? (a.inscribable ? "ESCRITURA" : "NINGUNO")}
              />
              <KV
                label="Requiere registro"
                value={compliance?.registry_required ? "Sí" : "No"}
              />
              <KV
                label="Publicación"
                value={
                  compliance?.publication_required
                    ? compliance?.publication_channel ?? "Requerida"
                    : "No requerida"
                }
              />
            </div>
            {/* ITEM-104: link al expediente registral más reciente del acuerdo. */}
            {registryFiling ? (
              <div className="mt-3 border-t border-[var(--g-border-subtle)] pt-3 text-sm">
                <Link
                  to={scope.createScopedTo(`/secretaria/tramitador/${registryFiling.id}`)}
                  className="text-[var(--g-link)] underline-offset-2 hover:text-[var(--g-link-hover)] hover:underline"
                >
                  Ver expediente registral
                </Link>
                <span className="text-[var(--g-text-secondary)]">
                  {" "}· {statusLabel(registryFiling.status)}
                  {registryFiling.filing_number ? ` · ${registryFiling.filing_number}` : ""}
                </span>
              </div>
            ) : null}
          </Card>

          {/* ITEM-104: card de certificaciones del acuerdo (cross-link inverso). */}
          {certificaciones.length > 0 ? (
            <Card icon={<FileSignature className="h-4 w-4" />} title="Certificaciones">
              <ul className="space-y-2">
                {certificaciones.map((c) => {
                  const agreementParam = a.entity_id
                    ? `&agreement=${encodeURIComponent(id!)}`
                    : "";
                  const tramTo = a.entity_id
                    ? `/secretaria/tramitador/nuevo?certificacion=${encodeURIComponent(c.id)}${agreementParam}&scope=sociedad&entity=${encodeURIComponent(a.entity_id)}`
                    : scope.createScopedTo(
                        `/secretaria/tramitador/nuevo?certificacion=${encodeURIComponent(c.id)}${agreementParam}`,
                      );
                  return (
                    <li
                      key={c.id}
                      className="flex items-center justify-between gap-3 border border-[var(--g-border-subtle)] px-3 py-2 text-sm"
                      style={{ borderRadius: "var(--g-radius-md)" }}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[var(--g-text-primary)]">
                          {c.tipo_certificacion ?? "Certificación"}
                        </span>
                        <span className="text-xs text-[var(--g-text-secondary)]">
                          {statusLabel(c.signature_status ?? "—")}
                        </span>
                      </span>
                      <Link
                        to={tramTo}
                        className="shrink-0 text-[var(--g-link)] underline-offset-2 hover:text-[var(--g-link-hover)] hover:underline"
                      >
                        Abrir en tramitador
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ) : certsLoading ? null : (
            <Card icon={<FileSignature className="h-4 w-4" />} title="Certificaciones">
              <p className="text-sm text-[var(--g-text-secondary)]">
                Todavía no se han generado certificaciones para este expediente.
              </p>
            </Card>
          )}

          {compliance?.publication_required ? (
            <Card icon={<Megaphone className="h-4 w-4" />} title="Publicación">
              <p className="text-sm text-[var(--g-text-primary)]">
                Canal obligatorio:{" "}
                <span className="font-semibold">{compliance.publication_channel}</span>
              </p>
              <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
                El acuerdo {a.agreement_kind} exige publicación en boletín oficial para surtir efectos
                frente a terceros.
              </p>
            </Card>
          ) : null}

          {ruleEvaluations.length > 0 && (
            <Card icon={<Scale className="h-4 w-4" />} title="Validación normativa">
              <div className="space-y-2">
                {(() => {
                  const grouped = ruleEvaluations.reduce(
                    (acc, r) => {
                      if (!acc[r.etapa]) acc[r.etapa] = [];
                      acc[r.etapa].push(r);
                      return acc;
                    },
                    {} as Record<string, RuleEvaluationResult[]>
                  );
                  return Object.entries(grouped).map(([etapa, results]) => (
                    <RuleValidationRow key={etapa} etapa={etapa} results={results} />
                  ));
                })()}
              </div>
            </Card>
          )}

          <PactosParasocialesCard agreement={a} />

          <AutorizacionesRegulatoriasCard entityId={a.entity_id} materia={a.agreement_kind} />

          <ApprovalWorkflowCard
            agreementId={a.id}
            onNavigateGenerar={() => navigate(generarTo)}
            currentUserRole={primaryRole}
            currentUserName={displayName}
            initialWorkflow={normalizeApprovalWorkflow(a.approval_workflow)}
            /* ITEM-105: cuando el documento ya está firmado/archivado (document_url),
               el paso QES_FIRMA puede completarse y alcanzar 'totalmente aprobado'. */
            documentArchived={Boolean(a.document_url)}
          />

          {/* Trust Center — Evidencias de confianza */}
          <div
            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-5"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="mb-4 flex items-center gap-2">
              <Shield className="h-4 w-4 text-[var(--g-brand-3308)]" />
              <h3 className="text-sm font-semibold text-[var(--g-text-primary)]">
                Evidencias de confianza
              </h3>
              {/* ITEM-107: solo mostrar el badge verde cuando realmente se ha
                  verificado al menos un artefacto. Antes lucía "Verificación OK"
                  incluso con checks=[] (señal de confianza vacua). */}
              {verification?.ok && (verification.checks?.length ?? 0) > 0 && (
                <span
                  className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                  style={{ borderRadius: "var(--g-radius-full)" }}
                >
                  Verificación OK
                </span>
              )}
            </div>

            {verificationLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-start gap-3 py-2">
                    <div className="h-4 w-4 mt-0.5 rounded-full bg-[var(--g-surface-muted)] animate-pulse" />
                    <div className="flex-1 space-y-1">
                      <div className="h-3 w-1/3 bg-[var(--g-surface-muted)] animate-pulse" style={{ borderRadius: "var(--g-radius-sm)" }} />
                      <div className="h-3 w-2/3 bg-[var(--g-surface-muted)] animate-pulse" style={{ borderRadius: "var(--g-radius-sm)" }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : verification?.checks && verification.checks.length > 0 ? (
              <div className="space-y-3">
                {verification.checks.map((check, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 py-2 border-b border-[var(--g-border-subtle)] last:border-0"
                  >
                    {check.passed ? (
                      <CheckCircle2 className="h-4 w-4 mt-0.5 text-[var(--status-success)]" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 mt-0.5 text-[var(--status-error)]" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[var(--g-text-primary)]">
                        {check.label}
                      </p>
                      <p className="text-xs text-[var(--g-text-secondary)]">
                        {check.detail}
                      </p>
                    </div>
                    {check.timestamp && (
                      <span className="text-xs text-[var(--g-text-secondary)] whitespace-nowrap">
                        {new Date(check.timestamp).toLocaleString("es-ES")}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--g-text-secondary)]">
                No hay artefactos de confianza para verificar
              </p>
            )}

            {verification?.errors && verification.errors.length > 0 && (
              <div
                className="mt-4 bg-[var(--status-error)]/10 border border-[var(--status-error)]/30 p-3 text-xs text-[var(--g-text-primary)]"
                style={{ borderRadius: "var(--g-radius-sm)" }}
              >
                <div className="flex items-center gap-1 font-semibold text-[var(--status-error)] mb-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Errores detectados
                </div>
                <ul className="list-inside list-disc space-y-0.5 ml-1">
                  {verification.errors.map((error, i) => (
                    <li key={i} className="text-[11px]">{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-6">
          <PreviewGatePanel
            params={{
              materia: a.agreement_kind,
              adoptionMode: toAdoptionMode(a.adoption_mode),
              tipoSocial: a.entities?.legal_form?.toUpperCase() === "SA" ? "SA" : "SL",
              materiaClase: toMateriaClase(a.matter_class),
            }}
          />

          <LegalControlPanel status={a.status} compliance={compliance} />

          <div
            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="border-b border-[var(--g-border-subtle)] px-5 py-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
                  Snapshot normativo congelado
                </h2>
                {isLegacyMeetingAdoptionSnapshot(a.compliance_snapshot) && (
                  <span
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]"
                    style={{ borderRadius: "var(--g-radius-sm)" }}
                    title="Snapshot anterior. Este resultado fue calculado con una versión anterior del sistema. La evaluación actual puede diferir."
                    aria-label="Snapshot anterior: calculado con una versión anterior del sistema"
                  >
                    <AlertTriangle className="h-3 w-3 text-[var(--status-warning)]" aria-hidden="true" />
                    Snapshot anterior
                  </span>
                )}
              </div>
              {isLegacyMeetingAdoptionSnapshot(a.compliance_snapshot) && (
                <p className="mt-2 text-[11px] leading-relaxed text-[var(--g-text-secondary)]">
                  Este resultado fue calculado con una versión anterior del sistema. La evaluación actual puede diferir.
                </p>
              )}
            </div>
            <div className="space-y-2 p-5 text-sm">
              {compliance ? (
                <>
                  <CheckRow ok={compliance.convocation_compliant} label="Convocatoria" />
                  <CheckRow ok={compliance.quorum_compliant} label="Quórum" />
                  <CheckRow ok={compliance.majority_compliant} label="Mayoría" />
                  <CheckRow ok={compliance.conflict_handled} label="Conflictos de interés" />
                  {compliance.blocking_issues.length > 0 ? (
                    <div
                      className="mt-3 bg-[var(--g-sec-100)]/60 p-3 text-xs text-[var(--g-text-primary)]"
                      style={{ borderRadius: "var(--g-radius-sm)" }}
                    >
                      <div className="flex items-center gap-1 font-semibold">
                        <AlertTriangle className="h-3.5 w-3.5 text-[var(--status-warning)]" />
                        Incidencias
                      </div>
                      <ul className="mt-1 list-inside list-disc space-y-0.5">
                        {compliance.blocking_issues.map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="mt-3 text-xs text-[var(--status-success)]">
                      Sin incidencias bloqueantes.
                    </div>
                  )}
                </>
              ) : (
                <p className="text-[var(--g-text-secondary)]">Calculando…</p>
              )}
            </div>
          </div>

          <div
            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="border-b border-[var(--g-border-subtle)] px-5 py-3">
              <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">Metadatos</h2>
            </div>
            <div className="space-y-2 p-5 text-sm">
              <KV label="Entidad" value={a.entities?.common_name ?? "—"} />
              <KV label="Órgano" value={a.governing_bodies?.name ?? "—"} />
              <KV label="Creado" value={new Date(a.created_at).toLocaleString("es-ES")} />
              <KV label="ID" value={<span className="font-mono text-[11px]">{a.id}</span>} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Card({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="flex items-center gap-2 border-b border-[var(--g-border-subtle)] px-5 py-3 text-[var(--g-text-primary)]">
        {icon}
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function LegalControlPanel({
  status,
  compliance,
}: {
  status: string | null | undefined;
  compliance: ComplianceResult | null | undefined;
}) {
  const blocking = compliance?.blocking_issues ?? [];
  const warnings = compliance?.warnings ?? [];
  const canDo =
    status === "DRAFT"
      ? ["Completar propuesta", "Incluir en orden del día o circular para firma"]
      : status === "PROPOSED"
        ? ["Registrar votación", "Proclamar resultado cuando proceda"]
        : status === "ADOPTED"
          ? ["Generar acta", "Emitir certificación"]
          : status === "CERTIFIED"
            ? ["Preparar elevación a público", "Abrir tramitación registral si procede"]
            : ["Consultar expediente y evidencias"];
  const missing = [
    compliance?.convocation_compliant === false ? "Convocatoria pendiente de subsanar" : null,
    compliance?.quorum_compliant === false ? "Quórum pendiente de acreditar" : null,
    compliance?.majority_compliant === false ? "Resultado de votación pendiente de validar" : null,
    compliance?.registry_required && status !== "REGISTERED" ? "Inscripción registral pendiente" : null,
    compliance?.publication_required ? "Publicación pendiente cuando proceda" : null,
    ...warnings,
  ].filter(Boolean) as string[];
  const nextActions = compliance?.next_actions?.length
    ? compliance.next_actions
    : status === "ADOPTED"
      ? ["Cerrar acta y congelar evidencia documental"]
      : status === "CERTIFIED"
        ? ["Preparar instrumento y presentación registral"]
        : ["Continuar con la siguiente fase del expediente"];

  return (
    <section
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="border-b border-[var(--g-border-subtle)] px-5 py-3">
        <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">Mesa de control del acuerdo</h2>
        <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
          Resumen operativo de requisitos, bloqueos y próximos pasos.
        </p>
      </div>
      <div className="space-y-4 p-5">
        <ControlList title="Qué puedo hacer" items={canDo} icon={CheckCircle2} />
        <ControlList title="Qué falta" items={missing.length ? missing : ["Sin pendientes relevantes."]} icon={ClipboardCheck} />
        <ControlList title="Qué bloquea" items={blocking.length ? blocking : ["Sin bloqueos societarios."]} icon={AlertTriangle} tone={blocking.length ? "error" : "ok"} />
        <ControlList title="Próximos pasos" items={nextActions} icon={ArrowLeft} />
      </div>
    </section>
  );
}

function ControlList({
  title,
  items,
  icon: Icon,
  tone = "default",
}: {
  title: string;
  items: string[];
  icon: React.ElementType;
  tone?: "default" | "error" | "ok";
}) {
  const iconClass = tone === "error" ? "text-[var(--status-error)]" : tone === "ok" ? "text-[var(--status-success)]" : "text-[var(--g-brand-3308)]";
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--g-text-primary)]">{title}</div>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-xs leading-5 text-[var(--g-text-secondary)]">
            <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${iconClass}`} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-[var(--g-text-secondary)]">{label}</span>
      <span className="text-right font-medium text-[var(--g-text-primary)]">{value}</span>
    </div>
  );
}

function CheckRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-[var(--status-success)]" />
      ) : (
        <Circle className="h-4 w-4 text-[var(--status-warning)]" />
      )}
      <span
        className={ok ? "text-[var(--g-text-primary)]" : "text-[var(--g-text-secondary)]"}
      >
        {label}
      </span>
    </div>
  );
}

function normativeStatusTone(status: NormativeFrameworkStatus | null | undefined) {
  if (status === "COMPLETO") return "bg-[var(--status-success)] text-[var(--g-text-inverse)]";
  if (status === "CONFLICTO") return "bg-[var(--status-error)] text-[var(--g-text-inverse)]";
  if (status === "DESACTUALIZADO") return "bg-[var(--status-warning)] text-[var(--g-text-inverse)]";
  return "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]";
}

function NormativeSnapshotCard({
  snapshot,
  isLoading,
}: {
  snapshot: AgreementNormativeSnapshot | null;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <Card icon={<Scale className="h-4 w-4" />} title="Marco normativo del acuerdo">
        <p className="text-sm text-[var(--g-text-secondary)]">Calculando ancla normativa…</p>
      </Card>
    );
  }

  if (!snapshot) {
    return (
      <Card icon={<Scale className="h-4 w-4" />} title="Marco normativo del acuerdo">
        <p className="text-sm text-[var(--g-text-secondary)]">
          No hay perfil normativo proyectable para este acuerdo.
        </p>
      </Card>
    );
  }

  const sourceLayers = Array.from(new Set(snapshot.sources.map((source) => source.layer)));
  const activeSources = snapshot.sources.filter((source) => source.status === "ACTIVE");

  return (
    <Card icon={<Scale className="h-4 w-4" />} title="Marco normativo del acuerdo">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center px-2.5 py-1 text-[11px] font-semibold ${normativeStatusTone(snapshot.framework_status)}`}
              style={{ borderRadius: "var(--g-radius-full)" }}
            >
              {snapshot.framework_status}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--g-text-secondary)]">
            El documento, la revisión y la promoción al expediente conservan esta traza normativa como
            fuente de control.
          </p>
          <details className="mt-2 text-xs">
            <summary className="cursor-pointer text-[var(--g-text-secondary)] hover:text-[var(--g-brand-3308)]">
              Detalle avanzado
            </summary>
            <div className="mt-1 space-y-0.5 font-mono text-[10px] text-[var(--g-text-secondary)]">
              <div>profile_hash: {snapshot.profile_hash}</div>
              <div>snapshot_id: {snapshot.snapshot_id}</div>
            </div>
          </details>
        </div>
        <div className="text-right text-xs text-[var(--g-text-secondary)]">
          <div>Fuentes activas: {activeSources.length}</div>
          <div>Capas: {sourceLayers.join(" · ") || "—"}</div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {snapshot.formalization_requirements.map((requirement) => (
          <span
            key={requirement.kind}
            className="inline-flex items-center border border-[var(--g-border-subtle)] bg-[var(--g-surface-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--g-text-secondary)]"
            style={{ borderRadius: "var(--g-radius-full)" }}
            title={requirement.reason}
          >
            {requirement.label}
          </span>
        ))}
      </div>

      {snapshot.warnings.length > 0 ? (
        <div
          className="mt-4 border border-[var(--g-border-subtle)] bg-[var(--g-sec-100)]/60 p-3 text-xs text-[var(--g-text-primary)]"
          style={{ borderRadius: "var(--g-radius-sm)" }}
        >
          <div className="mb-1 font-semibold text-[var(--g-text-primary)]">Advertencias</div>
          <ul className="list-inside list-disc space-y-0.5">
            {snapshot.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}

function FrozenRuleSnapshotCard({
  snapshot,
  isLoading,
  agreementEntityId,
  agreementMatter,
  agreementAdoptionMode,
}: {
  snapshot: AgreementNormativeSnapshot | null;
  isLoading: boolean;
  agreementEntityId: string | null;
  agreementMatter: string | null;
  agreementAdoptionMode: string | null;
}) {
  if (isLoading) {
    return (
      <Card icon={<Lock className="h-4 w-4" />} title="Regla efectiva congelada">
        <p className="text-sm text-[var(--g-text-secondary)]">Cargando snapshot inmutable…</p>
      </Card>
    );
  }

  // Acuerdo legacy: card compacta con deep-link al simulador.
  if (!snapshot) {
    const ruleManagerLink =
      agreementEntityId && agreementMatter && agreementAdoptionMode
        ? `/secretaria/catalogo-materias?entity=${agreementEntityId}&materia=${encodeURIComponent(agreementMatter)}&adoption=${encodeURIComponent(agreementAdoptionMode)}`
        : "/secretaria/catalogo-materias";
    return (
      <Card icon={<Lock className="h-4 w-4" />} title="Regla efectiva congelada">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[var(--g-text-secondary)]">
            Este acuerdo no tiene snapshot inmutable. La regla efectiva no se congeló al materializarse.
          </p>
          <Link
            to={ruleManagerLink}
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[var(--g-brand-3308)] hover:text-[var(--g-sec-700)]"
          >
            Ver mantenimiento →
          </Link>
        </div>
      </Card>
    );
  }

  // Classifier honesto: lectura del snapshot SIN inferir veredictos jurídicos.
  const classification = classifyFrozenSnapshot(snapshot);
  if (!classification) {
    return (
      <Card icon={<Lock className="h-4 w-4" />} title="Regla efectiva congelada">
        <p className="text-sm text-[var(--g-text-secondary)]">
          Snapshot presente pero no interpretable.
        </p>
      </Card>
    );
  }

  const blockers = Array.isArray(snapshot.blockers) ? snapshot.blockers : [];
  const warnings = Array.isArray(snapshot.warnings) ? snapshot.warnings : [];

  return (
    <Card icon={<Lock className="h-4 w-4" />} title="Regla efectiva congelada">
      <div className="mb-3 flex items-center gap-2 text-xs text-[var(--g-text-secondary)]">
        <Lock className="h-3 w-3" aria-hidden />
        <span>Snapshot inmutable: estas eran las reglas en el momento de adopción.</span>
      </div>

      {/* Línea técnica: framework_status + salud del profile + fecha. NO veredicto jurídico. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center px-2.5 py-1 text-[11px] font-semibold ${normativeStatusTone(classification.framework_status)}`}
          style={{ borderRadius: "var(--g-radius-full)" }}
        >
          {classification.framework_status}
        </span>
        <ProfileHealthChip health={classification.health} />
        {classification.evaluated_at && (
          <span className="text-xs text-[var(--g-text-secondary)]">
            Evaluado: {new Date(classification.evaluated_at).toLocaleDateString("es-ES")}
          </span>
        )}
      </div>

      <p className="mb-3 text-xs text-[var(--g-text-secondary)]">{classification.health_detail}</p>

      {/* Capas normativas presentes (status ACTIVE) */}
      {classification.source_layers.length > 0 && (
        <div className="mb-3">
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-[var(--g-text-secondary)]">
            Capas normativas usadas
          </div>
          <div className="flex flex-wrap gap-1">
            {classification.source_layers.map((layer) => (
              <span
                key={layer}
                className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[var(--g-text-primary)]"
                style={{ borderRadius: "var(--g-radius-sm)" }}
              >
                {layer}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Resumen estructurado de pactos / estatutos sin string-matching */}
      <div className="mb-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
        <FactRow
          label="Pacto parasocial activo"
          present={classification.has_pacto_layer}
        />
        <FactRow
          label="Estatutos como override"
          present={classification.has_estatutos_layer}
        />
        <FactRow
          label="Reglamento de órgano"
          present={classification.has_reglamento_layer}
        />
      </div>

      {/* Formalización congelada — descriptivo, sin "OK" */}
      <div className="mb-3 text-xs">
        <div className="mb-1 font-medium uppercase tracking-wider text-[var(--g-text-secondary)] text-[10px]">
          Formalización congelada
        </div>
        <p className="text-[var(--g-text-secondary)]">
          {classification.formalization_required_count} requerido
          {classification.formalization_required_count === 1 ? "" : "s"} ·{" "}
          {classification.formalization_conditional_count} condicional
          {classification.formalization_conditional_count === 1 ? "" : "es"}.
        </p>
        {classification.formalization_requirements.length > 0 && (
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[var(--g-text-secondary)]">
            {classification.formalization_requirements.map((req, idx) => (
              <li key={idx}>
                <span className="font-medium text-[var(--g-text-primary)]">{req.label}</span>
                {" — "}
                {req.status === "REQUIRED"
                  ? "requerido"
                  : req.status === "CONDITIONAL"
                    ? "condicional"
                    : "informativo"}
              </li>
            ))}
          </ul>
        )}
      </div>

      {blockers.length > 0 && (
        <div
          className="mb-3 border-l-4 border-[var(--status-error)] bg-[var(--g-surface-subtle)] px-3 py-2"
          style={{ borderRadius: "var(--g-radius-sm)" }}
        >
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-[var(--status-error)]">
            Bloqueos del profile al adoptar
          </div>
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-[var(--g-text-secondary)]">
            {blockers.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      {warnings.length > 0 && (
        <div
          className="mb-3 border-l-4 border-[var(--status-warning)] bg-[var(--g-surface-subtle)] px-3 py-2"
          style={{ borderRadius: "var(--g-radius-sm)" }}
        >
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-[var(--status-warning)]">
            Advertencias del profile
          </div>
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-[var(--g-text-secondary)]">
            {warnings.slice(0, 5).map((w, i) => (
              <li key={i}>{w}</li>
            ))}
            {warnings.length > 5 && (
              <li className="italic">+ {warnings.length - 5} más</li>
            )}
          </ul>
        </div>
      )}

      <details className="text-xs">
        <summary className="cursor-pointer text-[var(--g-text-secondary)] hover:text-[var(--g-brand-3308)]">
          Traza técnica del snapshot
        </summary>
        <div className="mt-2 space-y-1 font-mono text-[10px] text-[var(--g-text-secondary)]">
          {classification.snapshot_id && <div>snapshot_id: {classification.snapshot_id}</div>}
          {classification.profile_hash && <div>profile_hash: {classification.profile_hash}</div>}
          {classification.meeting_rule_pack_version && (
            <div>meeting_rule_pack_version: {classification.meeting_rule_pack_version}</div>
          )}
          {classification.meeting_ruleset_snapshot_id && (
            <div>meeting_ruleset_snapshot_id: {classification.meeting_ruleset_snapshot_id}</div>
          )}
        </div>
      </details>
    </Card>
  );
}

function ProfileHealthChip({ health }: { health: FrozenSnapshotHealth }) {
  const tone =
    health === "PROFILE_OK"
      ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
      : health === "PROFILE_INCOMPLETE"
        ? "bg-[var(--status-warning)] text-[var(--g-text-inverse)]"
        : "bg-[var(--status-error)] text-[var(--g-text-inverse)]";
  const label =
    health === "PROFILE_OK"
      ? "PROFILE OK"
      : health === "PROFILE_INCOMPLETE"
        ? "PROFILE INCOMPLETO"
        : "PROFILE EN CONFLICTO";
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${tone}`}
      style={{ borderRadius: "var(--g-radius-full)" }}
    >
      {label}
    </span>
  );
}

function FactRow({ label, present }: { label: string; present: boolean }) {
  return (
    <div
      className="flex items-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-2 py-1.5"
      style={{ borderRadius: "var(--g-radius-md)" }}
    >
      {present ? (
        <CheckCircle2 className="h-3 w-3 text-[var(--g-brand-3308)]" aria-hidden />
      ) : (
        <Circle className="h-3 w-3 text-[var(--g-text-secondary)]" aria-hidden />
      )}
      <span className="text-[10px] uppercase tracking-wider text-[var(--g-text-primary)]">
        {label}
      </span>
      <span className="ml-auto text-[10px] text-[var(--g-text-secondary)]">
        {present ? "presente" : "no"}
      </span>
    </div>
  );
}

function RuleValidationRow({
  etapa,
  results,
}: {
  etapa: string;
  results: RuleEvaluationResult[];
}) {
  const [expanded, setExpanded] = useState(false);
  const ok = results.every((r) => r.ok);
  const severity = results.some((r) => r.severity === "BLOCKING")
    ? "BLOCKING"
    : results.some((r) => r.severity === "WARNING")
    ? "WARNING"
    : "OK";

  return (
    <div
      className="border border-[var(--g-border-subtle)]"
      style={{ borderRadius: "var(--g-radius-md)" }}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-[var(--g-surface-subtle)]/50"
      >
        <div className="flex items-center gap-2">
          {ok ? (
            <CheckCircle2 className="h-4 w-4 text-[var(--status-success)]" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-[var(--status-error)]" />
          )}
          <span className="text-xs font-semibold text-[var(--g-text-primary)]">
            {etapa}
          </span>
          <span
            className={`inline-flex px-2 py-0.5 text-[10px] font-semibold ${
              severity === "BLOCKING"
                ? "bg-[var(--status-error)] text-[var(--g-text-inverse)]"
                : severity === "WARNING"
                ? "bg-[var(--status-warning)] text-[var(--g-text-inverse)]"
                : "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
            }`}
            style={{ borderRadius: "var(--g-radius-full)" }}
          >
            {severity}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-[var(--g-text-secondary)]" />
        ) : (
          <ChevronDown className="h-4 w-4 text-[var(--g-text-secondary)]" />
        )}
      </button>

      {expanded && (
        <div className="space-y-1 border-t border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)]/30 p-3">
          {results.map((r) => (
            <div key={r.id} className="text-xs text-[var(--g-text-secondary)]">
              {r.explain ? (
                <>
                  {typeof r.explain === "object" &&
                    Object.entries(r.explain).map(([key, value]) => (
                      <div key={key} className="ml-2">
                        <span className="font-mono text-[10px]">{key}:</span>{" "}
                        <span className="text-[var(--g-text-primary)]">
                          {String(value)}
                        </span>
                      </div>
                    ))}
                </>
              ) : (
                <div className="text-[var(--g-text-primary)]">
                  Sin detalles de evaluación
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface AgreementRow {
  id: string;
  agreement_kind: string;
  entity_id: string;
  entities?: { common_name?: string };
}

function PactosParasocialesCard({ agreement }: { agreement: AgreementRow }) {
  const { data: pactos = [] } = usePactosVigentes(agreement.entity_id);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Material mapping: agreement_kind → materias del vocabulario de cláusulas
  // (materia_ambito de pacto_clausulas). ITEM-049: incluye los kinds
  // estructurales que generan los steppers y alinea capital con el
  // vocabulario real (AUMENTO_CAPITAL, no AMPLIACION_CAPITAL).
  const MATERIA_MAP: Record<string, string[]> = {
    FUSION: ["FUSION"],
    ESCISION: ["ESCISION"],
    FUSION_ESCISION: ["FUSION", "ESCISION"],
    DISOLUCION: ["DISOLUCION"],
    TRANSFORMACION: ["TRANSFORMACION"],
    OPERACION_ESTRUCTURAL: ["FUSION", "ESCISION", "TRANSFORMACION", "CESION_GLOBAL_ACTIVO", "DISOLUCION"],
    VENTA_ACTIVOS_SUSTANCIALES: ["CESION_GLOBAL_ACTIVO"],
    CESION_GLOBAL_ACTIVO: ["CESION_GLOBAL_ACTIVO"],
    AMPLIACION_CAPITAL: ["AUMENTO_CAPITAL"],
    AUMENTO_CAPITAL: ["AUMENTO_CAPITAL"],
    REDUCCION_CAPITAL: ["REDUCCION_CAPITAL"],
    EMISION_CONVERTIBLES: ["EMISION_OBLIGACIONES"],
    EMISION_OBLIGACIONES: ["EMISION_OBLIGACIONES"],
    OPERACION_VINCULADA: ["OPERACION_VINCULADA"],
    MOD_ESTATUTOS: ["MOD_ESTATUTOS"],
    MODIFICACION_ESTATUTOS: ["MOD_ESTATUTOS"],
    APROBACION_CUENTAS: ["APROBACION_CUENTAS"],
  };

  // ITEM-049: la evaluación de cumplimiento solo es legítima con la votación
  // REAL. El compliance_snapshot congelado al adoptar (origen reunión) trae
  // vote_summary; sin votos reales la card opera en modo "aplicabilidad"
  // (qué pactos aplican a la materia) sin veredictos de cumplimiento.
  const snapshotVotes = (() => {
    const snap = (agreement as { compliance_snapshot?: unknown }).compliance_snapshot as
      | { vote_summary?: { favor?: number; contra?: number; voting_weight?: number; capital_total?: number } }
      | null
      | undefined;
    const vs = snap?.vote_summary;
    if (!vs || typeof vs.favor !== "number" || typeof vs.contra !== "number") return null;
    return vs;
  })();
  const modoAplicabilidad = snapshotVotes === null;

  if (pactos.length === 0) {
    return (
      <Card icon={<Handshake className="h-4 w-4" />} title="Pactos parasociales">
        <p className="text-sm text-[var(--g-text-secondary)]">
          No hay pactos parasociales vigentes para esta entidad.
        </p>
      </Card>
    );
  }

  // Prepare evaluation input (votos reales del snapshot o neutros para el
  // modo aplicabilidad — en ese modo solo se muestra `aplica`, nunca
  // cumple/incumple).
  const evalInput: PactosEvalInput = {
    materias: MATERIA_MAP[agreement.agreement_kind] ?? [agreement.agreement_kind],
    capitalPresente: snapshotVotes
      ? (snapshotVotes.voting_weight ?? snapshotVotes.favor + snapshotVotes.contra)
      : 0,
    capitalTotal: snapshotVotes ? (snapshotVotes.capital_total ?? 100) : 100,
    votosFavor: snapshotVotes?.favor ?? 0,
    votosContra: snapshotVotes?.contra ?? 0,
    consentimientosPrevios: [],
    vetoRenunciado: [],
  };

  // Run evaluation
  const evalResult = evaluarPactosParasociales(pactos, evalInput);

  // Color mapping for severity
  const severityClass = (severity: string) => {
    switch (severity) {
      case "OK":
        return "bg-[var(--status-success)] text-[var(--g-text-inverse)]";
      case "WARNING":
        return "bg-[var(--status-warning)] text-[var(--g-text-inverse)]";
      case "BLOCKING":
        return "bg-[var(--status-error)] text-[var(--g-text-inverse)]";
      default:
        return "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]";
    }
  };

  const severityIcon = (severity: string) => {
    switch (severity) {
      case "OK":
        return <CheckCircle2 className="h-4 w-4 text-[var(--status-success)]" />;
      case "WARNING":
        return <AlertTriangle className="h-4 w-4 text-[var(--status-warning)]" />;
      case "BLOCKING":
        return <AlertTriangle className="h-4 w-4 text-[var(--status-error)]" />;
      default:
        return <Circle className="h-4 w-4 text-[var(--g-text-secondary)]" />;
    }
  };

  return (
    <Card icon={<Handshake className="h-4 w-4" />} title="Pactos parasociales">
      {modoAplicabilidad ? (
        <div
          className="mb-4 border-l-4 border-[var(--status-info)] bg-[var(--g-surface-muted)] p-3 text-xs text-[var(--g-text-secondary)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          Sin votación real registrada en el expediente: se muestra la
          aplicabilidad de los pactos a la materia. La evaluación de
          cumplimiento se realiza con la votación real en el momento de la
          adopción (ver snapshot legal del punto en el acta).
        </div>
      ) : null}
      <div className={`mb-4 grid ${modoAplicabilidad ? "grid-cols-2" : "grid-cols-3"} gap-3 text-sm`}>
        <div className="border border-[var(--g-border-subtle)] p-3" style={{ borderRadius: "var(--g-radius-md)" }}>
          <div className="text-[11px] font-semibold text-[var(--g-text-secondary)] uppercase">Evaluados</div>
          <div className="mt-1 text-lg font-bold text-[var(--g-text-primary)]">{evalResult.pactos_evaluados}</div>
        </div>
        <div className="border border-[var(--g-border-subtle)] p-3" style={{ borderRadius: "var(--g-radius-md)" }}>
          <div className="text-[11px] font-semibold text-[var(--g-text-secondary)] uppercase">Aplicables</div>
          <div className="mt-1 text-lg font-bold text-[var(--g-text-primary)]">{evalResult.pactos_aplicables}</div>
        </div>
        {!modoAplicabilidad ? (
          <div className="border border-[var(--g-border-subtle)] p-3" style={{ borderRadius: "var(--g-radius-md)" }}>
            <div className="text-[11px] font-semibold text-[var(--g-text-secondary)] uppercase">Cumplidos</div>
            <div className="mt-1 text-lg font-bold text-[var(--g-text-primary)]">{evalResult.pactos_cumplidos}</div>
          </div>
        ) : null}
      </div>

      {evalResult.resultados.length > 0 && (
        <div className="space-y-2">
          {evalResult.resultados.map((result) => (
            <div
              key={result.pacto_id}
              className="border border-[var(--g-border-subtle)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <button
                type="button"
                onClick={() =>
                  setExpanded(expanded === result.pacto_id ? null : result.pacto_id)
                }
                className="flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-[var(--g-surface-subtle)]/50"
              >
                <div className="flex items-center gap-2 flex-1">
                  {modoAplicabilidad ? (
                    <Circle className="h-4 w-4 text-[var(--g-text-secondary)]" />
                  ) : (
                    severityIcon(result.severity)
                  )}
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-[var(--g-text-primary)]">
                      {result.pacto_titulo}
                    </p>
                    <p className="text-[11px] text-[var(--g-text-secondary)]">
                      {result.tipo}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {modoAplicabilidad ? (
                      <span
                        className={`inline-flex px-2 py-0.5 text-[10px] font-semibold ${
                          result.aplica
                            ? "bg-[var(--status-info)] text-[var(--g-text-inverse)]"
                            : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]"
                        }`}
                        style={{ borderRadius: "var(--g-radius-full)" }}
                      >
                        {result.aplica ? "APLICA" : "No aplica"}
                      </span>
                    ) : (
                      <>
                        <span
                          className={`inline-flex px-2 py-0.5 text-[10px] font-semibold ${severityClass(
                            result.severity
                          )}`}
                          style={{ borderRadius: "var(--g-radius-full)" }}
                        >
                          {result.severity}
                        </span>
                        {result.aplica && !result.cumple && (
                          <span className="text-[10px] font-semibold text-[var(--status-error)]">
                            INCUMPLE
                          </span>
                        )}
                        {!result.aplica && (
                          <span className="text-[10px] text-[var(--g-text-secondary)]">
                            No aplica
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {expanded === result.pacto_id ? (
                  <ChevronUp className="h-4 w-4 text-[var(--g-text-secondary)] ml-2" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-[var(--g-text-secondary)] ml-2" />
                )}
              </button>

              {expanded === result.pacto_id && (
                <div className="border-t border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)]/30 p-3 space-y-2">
                  <div className="text-sm text-[var(--g-text-primary)]">
                    {modoAplicabilidad
                      ? result.aplica
                        ? "Esta cláusula aplica a la materia del acuerdo. El cumplimiento se evalúa con la votación real registrada en el acta."
                        : "Esta cláusula no aplica a la materia del acuerdo."
                      : result.explain.mensaje}
                  </div>
                  {!modoAplicabilidad && result.explain.hijos && result.explain.hijos.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-[var(--g-border-subtle)] text-xs space-y-1">
                      {result.explain.hijos.map((hijo, idx) => (
                        <div key={idx} className="flex flex-col gap-1">
                          <span className="font-semibold text-[var(--g-text-primary)]">{hijo.regla}</span>
                          <span className="text-[11px] text-[var(--g-text-secondary)]">{hijo.mensaje}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {evalResult.blocking_issues.length > 0 && (
        <div
          className="mt-4 bg-[var(--status-error)]/10 border border-[var(--status-error)]/30 p-3 text-xs text-[var(--g-text-primary)]"
          style={{ borderRadius: "var(--g-radius-sm)" }}
        >
          <div className="flex items-center gap-1 font-semibold text-[var(--status-error)] mb-1">
            <AlertTriangle className="h-3.5 w-3.5" />
            Incumplimientos detectados
          </div>
          <ul className="list-inside list-disc space-y-0.5 ml-1">
            {evalResult.blocking_issues.map((issue, i) => (
              <li key={i} className="text-[11px]">{issue}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

// ─── Approval Workflow Card (E-D8) ──────────────────────────────────────────

interface ApprovalStep {
  id: string;
  label: string;
  role: string;
  approvedAt: string | null;
  approvedBy: string | null;
}

function normalizeApprovalWorkflow(value: Record<string, unknown>[] | null): ApprovalStep[] | null {
  if (!Array.isArray(value)) return null;

  const steps = value
    .map((raw): ApprovalStep | null => {
      const id = typeof raw.id === "string" ? raw.id : "";
      if (!id) return null;

      const role = typeof raw.role === "string" && raw.role.trim()
        ? raw.role
        : id;
      const label = typeof raw.label === "string" && raw.label.trim()
        ? raw.label
        : role;

      return {
        id,
        label,
        role,
        approvedAt: typeof raw.approvedAt === "string" ? raw.approvedAt : null,
        approvedBy: typeof raw.approvedBy === "string" ? raw.approvedBy : null,
      };
    })
    .filter((step): step is ApprovalStep => step !== null);

  return steps.length > 0 ? steps : null;
}

const DEMO_APPROVERS: Record<string, string> = {
  SECRETARIO:    "Lucía Martín (Secretaria CdA)",
  COMITE_LEGAL:  "Garrigues — Comité Legal",
  PRESIDENTE:    "Antonio García (Presidente)",
};

function makeDefaultSteps(): ApprovalStep[] {
  return [
    { id: "SECRETARIO",   label: "Revisión Secretaría",         role: "SECRETARIO",   approvedAt: null, approvedBy: null },
    { id: "COMITE_LEGAL", label: "Validación comité legal",     role: "COMITE_LEGAL", approvedAt: null, approvedBy: null },
    { id: "PRESIDENTE",   label: "Aprobación Presidente",        role: "PRESIDENTE",   approvedAt: null, approvedBy: null },
    { id: "QES_FIRMA",    label: "Firma QES cualificada",        role: "QES_FIRMA",    approvedAt: null, approvedBy: null },
  ];
}

function ApprovalWorkflowCard({
  agreementId,
  onNavigateGenerar,
  currentUserRole = "SECRETARIO",
  currentUserName,
  initialWorkflow,
  documentArchived = false,
}: {
  agreementId: string;
  onNavigateGenerar: () => void;
  currentUserRole?: string;
  currentUserName?: string;
  initialWorkflow?: ApprovalStep[] | null;
  documentArchived?: boolean;
}) {
  const { tenantId } = useTenantContext();
  const qc = useQueryClient();

  const [steps, setSteps] = useState<ApprovalStep[]>(
    () => (Array.isArray(initialWorkflow) && initialWorkflow.length > 0
      ? initialWorkflow
      : makeDefaultSteps())
  );

  const currentIdx = steps.findIndex((s) => s.approvedAt === null);
  const allApproved = currentIdx === -1;

  // ITEM-105: saveWorkflow ya no ignora el error del update. Si la escritura falla,
  // se revierte el estado en memoria al valor previo y se avisa con toast.error, en
  // vez de mostrar pasos "aprobados" que no se persistieron.
  const saveWorkflow = useCallback(async (next: ApprovalStep[] | null, prev?: ApprovalStep[]) => {
    const { error } = await supabase
      .from("agreements")
      .update({ approval_workflow: next })
      .eq("id", agreementId)
      .eq("tenant_id", tenantId!);
    if (error) {
      if (prev) setSteps(prev);
      toast.error("No se pudo guardar el flujo de aprobación", { description: error.message });
      return;
    }
    qc.invalidateQueries({ queryKey: ["agreement", tenantId, agreementId] });
  }, [agreementId, tenantId, qc]);

  const approveStep = useCallback((idx: number) => {
    const isLast = idx === steps.length - 1;
    // ITEM-105: el último paso (QES_FIRMA) solo se marca aprobado cuando el documento
    // ya está firmado/archivado (document_url presente). Si aún no se ha firmado, se
    // navega al generador de documento para ejecutar la firma; al volver con el
    // documento archivado, este paso ya es completable y se alcanza 'totalmente
    // aprobado'. Antes el último paso solo navegaba y nunca marcaba approvedAt, dejando
    // el estado allApproved inalcanzable.
    if (isLast && !documentArchived) {
      onNavigateGenerar();
      return;
    }
    const prev = steps;
    const step = steps[idx];
    const approverName =
      step.role === currentUserRole && currentUserName
        ? currentUserName
        : DEMO_APPROVERS[step.role] ?? step.role;
    const next = steps.map((s, i) =>
      i === idx
        ? { ...s, approvedAt: new Date().toISOString(), approvedBy: approverName }
        : s
    );
    setSteps(next);
    saveWorkflow(next, prev);
  }, [steps, onNavigateGenerar, currentUserRole, currentUserName, saveWorkflow, documentArchived]);

  const resetWorkflow = useCallback(() => {
    const fresh = makeDefaultSteps();
    setSteps(fresh);
    saveWorkflow(null);
  }, [saveWorkflow]);

  const stepIcons = [UserCheck, ClipboardCheck, CheckCircle2, Lock];

  return (
    <Card icon={<ClipboardCheck className="h-4 w-4 text-[var(--g-brand-3308)]" />} title="Flujo de aprobación">
      {allApproved ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-[var(--status-success)]">
            <CheckCircle2 className="h-5 w-5" />
            Acuerdo totalmente aprobado y firmado
          </div>
          <button
            type="button"
            onClick={resetWorkflow}
            className="text-xs text-[var(--g-text-secondary)] hover:text-[var(--g-brand-3308)] underline"
          >
            Reiniciar flujo (demo)
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {steps.map((step, i) => {
            const StepIcon = stepIcons[i] ?? CheckCircle2;
            const isActive = i === currentIdx;
            const isDone = step.approvedAt !== null;
            const isPending = !isDone && !isActive;

            return (
              <div
                key={step.id}
                className={`flex items-start gap-3 p-3 transition-colors ${
                  isActive
                    ? "bg-[var(--g-sec-100)] border border-[var(--g-brand-3308)]"
                    : isDone
                    ? "bg-[var(--status-success)]/5 border border-[var(--status-success)]/20"
                    : "bg-[var(--g-surface-subtle)] border border-[var(--g-border-subtle)]"
                }`}
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <StepIcon
                  className={`mt-0.5 h-4 w-4 shrink-0 ${
                    isDone
                      ? "text-[var(--status-success)]"
                      : isActive
                      ? "text-[var(--g-brand-3308)]"
                      : "text-[var(--g-text-secondary)]"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold ${isActive ? "text-[var(--g-brand-3308)]" : "text-[var(--g-text-primary)]"}`}>
                      {step.label}
                    </span>
                    {isDone && (
                      <span
                        className="px-1.5 py-0.5 text-[9px] font-semibold bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      >
                        APROBADO
                      </span>
                    )}
                    {isPending && (
                      <span
                        className="px-1.5 py-0.5 text-[9px] font-medium bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      >
                        PENDIENTE
                      </span>
                    )}
                  </div>
                  {isDone && step.approvedAt && (
                    <p className="text-[11px] text-[var(--g-text-secondary)] mt-0.5">
                      {step.approvedBy} · {new Date(step.approvedAt).toLocaleString("es-ES")}
                    </p>
                  )}
                  {isActive && (
                    <>
                      {currentUserName && (
                        <p className="mt-1 text-[11px] text-[var(--g-text-secondary)]">
                          Actuando como: <span className="font-medium text-[var(--g-brand-3308)]">{currentUserName}</span>
                        </p>
                      )}
                    <button
                      type="button"
                      onClick={() => approveStep(i)}
                      className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)]"
                      style={{ borderRadius: "var(--g-radius-md)" }}
                    >
                      {step.id === "QES_FIRMA" ? (
                        <>
                          <Lock className="h-3 w-3" />
                          Firmar con QES
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-3 w-3" />
                          Aprobar
                        </>
                      )}
                    </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
