import { useMemo } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, FileCheck2, FileText, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { useSecretariaScope } from "@/components/secretaria/shell";
import {
  useAgreementDocumentRequirements,
  useCreateAndLinkAgreementDocumentArtifact,
  useRefreshAgreementDocumentRequirements,
  type AgreementDocumentRequirementRow,
} from "@/hooks/useSecretariaDocumentArtifacts";
import { usePlantillasProtegidas } from "@/hooks/usePlantillasProtegidas";
import type { AgreementFull } from "@/hooks/useAgreementCompliance";
import { statusLabel } from "@/lib/secretaria/status-labels";

const PHASE_LABEL: Record<string, string> = {
  PRE_CONVOCATORIA: "Preconvocatoria",
  CONVOCATORIA: "Convocatoria",
  PRE_REUNION: "Pre-reunión",
  REUNION: "Reunión",
  POST_ACUERDO: "Post-acuerdo",
  CERTIFICACION: "Certificación",
  REGISTRO: "Registro",
  BOARD_PACK: "Board pack",
};

const KIND_LABEL: Record<string, string> = {
  INFORME_PRECEPTIVO: "Informe preceptivo",
  INFORME_DOCUMENTAL_PRE: "Informe documental PRE",
  INFORME_GESTION: "Informe de gestión",
  CERTIFICACION_SOPORTE: "Certificación soporte",
  DOCUMENTO_REGISTRAL: "Documento registral",
  ANEXO_EXTERNO: "Anexo externo",
  OTRO_SOPORTE: "Soporte",
};

function statusTone(status: string) {
  if (status === "SATISFIED") return "bg-[var(--status-success)] text-[var(--g-text-inverse)]";
  if (status === "BLOCKED") return "bg-[var(--status-error)] text-[var(--g-text-inverse)]";
  if (status === "WAIVED_WITH_OVERRIDE") return "bg-[var(--status-warning)] text-[var(--g-text-inverse)]";
  return "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]";
}

function requirementIsInforme(requirement: AgreementDocumentRequirementRow) {
  return requirement.document_kind === "INFORME_PRECEPTIVO"
    || requirement.document_kind === "INFORME_DOCUMENTAL_PRE"
    || requirement.document_kind === "INFORME_GESTION";
}

function certificationKindForAgreement(agreement: AgreementFull) {
  if (agreement.adoption_mode === "NO_SESSION") return "CERT_ACUERDO_SIN_SESION";
  if (agreement.adoption_mode === "UNIPERSONAL_SOCIO") return "CERT_DECISION_SOCIO_UNICO";
  return "CERT_ACUERDO_360";
}

function requirementPayload(requirement: AgreementDocumentRequirementRow, agreement: AgreementFull) {
  return {
    agreement_id: agreement.id,
    matter_code: requirement.matter_code,
    requirement_code: requirement.requirement_code,
    document_kind: requirement.document_kind,
    phase: requirement.fase,
    adoption_mode: agreement.adoption_mode,
    entity_id: agreement.entity_id,
    body_id: agreement.body_id,
    entity_name: agreement.entities?.common_name,
    body_name: agreement.governing_bodies?.name,
    legal_basis: requirement.legal_basis,
    annex_targets: requirement.annex_targets,
    generated_from: "AgreementDocumentRequirementsPanel",
  };
}

export function AgreementDocumentRequirementsPanel({ agreement }: { agreement: AgreementFull }) {
  const scope = useSecretariaScope();
  const requirements = useAgreementDocumentRequirements(agreement.id);
  const plantillas = usePlantillasProtegidas();
  const refreshRequirements = useRefreshAgreementDocumentRequirements();
  const createArtifact = useCreateAndLinkAgreementDocumentArtifact();
  const rows = requirements.data ?? [];
  const activeRows = rows.filter((row) => row.status !== "SUPERSEDED" && row.status !== "NOT_APPLICABLE");
  const counts = useMemo(() => {
    const satisfied = activeRows.filter((row) => row.status === "SATISFIED").length;
    const blocking = activeRows.filter((row) => row.status !== "SATISFIED" && row.blocking_policy === "BLOCKING").length;
    const warning = activeRows.filter((row) => row.status !== "SATISFIED" && row.blocking_policy !== "BLOCKING").length;
    return { satisfied, blocking, warning, total: activeRows.length };
  }, [activeRows]);

  async function handleRefresh() {
    try {
      const count = await refreshRequirements.mutateAsync(agreement.id);
      toast.success("Requisitos documentales sincronizados", { description: `${count} requisitos activos` });
    } catch (e) {
      toast.error("No se pudieron sincronizar los requisitos", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  async function handleCreateInforme(requirement: AgreementDocumentRequirementRow) {
    try {
      await createArtifact.mutateAsync({
        agreementId: agreement.id,
        entityId: agreement.entity_id,
        bodyId: agreement.body_id,
        meetingId: agreement.parent_meeting_id,
        entityName: agreement.entities?.common_name,
        bodyName: agreement.governing_bodies?.name,
        agreementKind: agreement.agreement_kind,
        requirementId: requirement.id,
        requirementCode: requirement.requirement_code,
        artifactKind: requirement.document_kind,
        title: requirement.title,
        templateBindingKey: requirement.template_binding_key,
        legalBasis: requirement.legal_basis,
        plantillas: plantillas.data ?? [],
        sourcePayload: requirementPayload(requirement, agreement),
        metadata: {
          template_binding_key: requirement.template_binding_key,
          legal_basis: requirement.legal_basis,
          source: "agreement_document_requirement",
        },
      });
      toast.success("Artefacto documental enlazado", { description: requirement.title });
    } catch (e) {
      toast.error("No se pudo enlazar el artefacto", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const certificationKind = certificationKindForAgreement(agreement);
  const certificationTo = scope.createScopedTo(
    `/secretaria/certificaciones?entity=${encodeURIComponent(agreement.entity_id ?? "")}`
      + `&body=${encodeURIComponent(agreement.body_id ?? "")}`
      + `&agreement=${encodeURIComponent(agreement.id)}`
      + (certificationKind ? `&kind=${encodeURIComponent(certificationKind)}` : ""),
  );
  const informesTo = scope.createScopedTo(`/secretaria/informes?agreement=${encodeURIComponent(agreement.id)}`);
  const tramitadorTo = scope.createScopedTo(`/secretaria/tramitador/nuevo?agreement=${encodeURIComponent(agreement.id)}`);

  if (requirements.error) {
    return (
      <section
        className="border border-[var(--status-warning)]/40 bg-[var(--status-warning)]/10 p-5"
        style={{ borderRadius: "var(--g-radius-lg)" }}
        role="alert"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-[var(--status-warning)]" />
          <div>
            <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">Requisitos documentales pendientes de schema</h2>
            <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
              Aplica la migración de informes y certificaciones para activar la checklist del expediente.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="flex flex-col gap-3 border-b border-[var(--g-border-subtle)] px-5 py-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[var(--g-brand-3308)]" />
            <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">Informes y certificaciones del expediente</h2>
          </div>
          <p className="mt-1 text-xs leading-5 text-[var(--g-text-secondary)]">
            Checklist materializada por acuerdo, con artefactos anexables a convocatoria, acta, certificación, board pack y registro.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshRequirements.isPending}
          aria-busy={refreshRequirements.isPending}
          className="inline-flex items-center justify-center gap-2 border border-[var(--g-border-subtle)] px-3 py-2 text-sm font-medium text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] disabled:opacity-60"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          {refreshRequirements.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {rows.length ? "Recalcular" : "Sincronizar"}
        </button>
      </div>

      <div className="grid gap-3 border-b border-[var(--g-border-subtle)] p-5 md:grid-cols-4">
        <Metric label="Total" value={counts.total} tone="neutral" />
        <Metric label="Satisfechos" value={counts.satisfied} tone="ok" />
        <Metric label="Bloqueantes" value={counts.blocking} tone={counts.blocking ? "error" : "ok"} />
        <Metric label="Avisos" value={counts.warning} tone={counts.warning ? "warning" : "neutral"} />
      </div>

      <div className="space-y-3 p-5">
        {requirements.isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((index) => (
              <div key={index} className="h-16 animate-pulse bg-[var(--g-surface-muted)]" style={{ borderRadius: "var(--g-radius-md)" }} />
            ))}
          </div>
        ) : activeRows.length ? (
          activeRows.map((requirement) => (
            <div
              key={requirement.id}
              className="border border-[var(--g-border-subtle)] p-3"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex px-2 py-0.5 text-[11px] font-semibold ${statusTone(requirement.status)}`}
                      style={{ borderRadius: "var(--g-radius-full)" }}
                    >
                      {statusLabel(requirement.status)}
                    </span>
                    <span className="text-xs font-medium text-[var(--g-brand-3308)]">
                      {PHASE_LABEL[requirement.fase] ?? requirement.fase}
                    </span>
                    <span className="text-xs text-[var(--g-text-secondary)]">
                      {KIND_LABEL[requirement.document_kind] ?? requirement.document_kind}
                    </span>
                  </div>
                  <h3 className="mt-2 text-sm font-semibold text-[var(--g-text-primary)]">{requirement.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-[var(--g-text-secondary)]">
                    {requirement.required_level.replace(/_/g, " ")} · {requirement.blocking_policy.replace(/_/g, " ")}
                    {requirement.legal_basis ? ` · ${requirement.legal_basis}` : ""}
                  </p>
                  {requirement.annex_targets?.length ? (
                    <p className="mt-1 text-[11px] text-[var(--g-text-secondary)]">
                      Anexos: {requirement.annex_targets.map((target) => PHASE_LABEL[target] ?? target).join(" · ")}
                    </p>
                  ) : null}
                </div>
                <RequirementAction
                  requirement={requirement}
                  isPending={createArtifact.isPending || plantillas.isLoading}
                  onCreateInforme={handleCreateInforme}
                  certificationTo={certificationTo}
                  informesTo={informesTo}
                  tramitadorTo={tramitadorTo}
                />
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col gap-3 text-sm text-[var(--g-text-secondary)] md:flex-row md:items-center md:justify-between">
            <span>No hay requisitos materializados todavía para este acuerdo.</span>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshRequirements.isPending}
              aria-busy={refreshRequirements.isPending}
              className="inline-flex items-center justify-center gap-2 bg-[var(--g-brand-3308)] px-3 py-2 text-sm font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] disabled:opacity-60"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              {refreshRequirements.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Materializar checklist
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-3 border-t border-[var(--g-border-subtle)] pt-4">
          <Link
            to={informesTo}
            className="inline-flex items-center gap-2 border border-[var(--g-border-subtle)] px-3 py-2 text-sm font-medium text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <FileText className="h-4 w-4" />
            Bandeja de informes
          </Link>
          <Link
            to={certificationTo}
            className="inline-flex items-center gap-2 border border-[var(--g-border-subtle)] px-3 py-2 text-sm font-medium text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <FileCheck2 className="h-4 w-4" />
            Certificación autónoma
          </Link>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: "neutral" | "ok" | "warning" | "error" }) {
  const valueClass =
    tone === "ok"
      ? "text-[var(--status-success)]"
      : tone === "warning"
        ? "text-[var(--status-warning)]"
        : tone === "error"
          ? "text-[var(--status-error)]"
          : "text-[var(--g-text-primary)]";
  return (
    <div className="border border-[var(--g-border-subtle)] px-3 py-2" style={{ borderRadius: "var(--g-radius-md)" }}>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${valueClass}`}>{value}</div>
    </div>
  );
}

function RequirementAction({
  requirement,
  isPending,
  onCreateInforme,
  certificationTo,
  informesTo,
  tramitadorTo,
}: {
  requirement: AgreementDocumentRequirementRow;
  isPending: boolean;
  onCreateInforme: (requirement: AgreementDocumentRequirementRow) => void;
  certificationTo: string;
  informesTo: string;
  tramitadorTo: string;
}) {
  if (requirement.status === "SATISFIED") {
    return (
      <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--status-success)]">
        <CheckCircle2 className="h-4 w-4" />
        Enlazado
      </span>
    );
  }

  if (requirementIsInforme(requirement)) {
    return (
      <div className="flex shrink-0 flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onCreateInforme(requirement)}
          disabled={isPending}
          aria-busy={isPending}
          className="inline-flex items-center justify-center gap-2 bg-[var(--g-brand-3308)] px-3 py-2 text-sm font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] disabled:opacity-60"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          Crear y enlazar
        </button>
        <Link
          to={informesTo}
          className="inline-flex items-center justify-center gap-2 border border-[var(--g-border-subtle)] px-3 py-2 text-sm font-medium text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          Ver informes
        </Link>
      </div>
    );
  }

  if (requirement.document_kind === "CERTIFICACION_SOPORTE") {
    return (
      <Link
        to={certificationTo}
        className="inline-flex shrink-0 items-center justify-center gap-2 bg-[var(--g-brand-3308)] px-3 py-2 text-sm font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)]"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        <FileCheck2 className="h-4 w-4" />
        Preparar certificación
      </Link>
    );
  }

  if (requirement.document_kind === "DOCUMENTO_REGISTRAL") {
    return (
      <Link
        to={tramitadorTo}
        className="inline-flex shrink-0 items-center justify-center gap-2 border border-[var(--g-border-subtle)] px-3 py-2 text-sm font-medium text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        Abrir tramitador
      </Link>
    );
  }

  return (
    <Link
      to={informesTo}
      className="inline-flex shrink-0 items-center justify-center gap-2 border border-[var(--g-border-subtle)] px-3 py-2 text-sm font-medium text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
      style={{ borderRadius: "var(--g-radius-md)" }}
    >
      Gestionar
    </Link>
  );
}
