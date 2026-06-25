import { useMemo } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  FileSearch,
  Loader2,
  RefreshCw,
  RotateCcw,
  SearchCheck,
} from "lucide-react";
import {
  useSecretariaDocumentArtifacts,
  useUpdateSecretariaDocumentArtifactStatus,
  type SecretariaDocumentArtifactRow,
} from "@/hooks/useSecretariaDocumentArtifacts";
import { useHasCapability } from "@/hooks/useCapabilityMatrix";
import { useCurrentUserRole } from "@/hooks/useCurrentUser";
import { statusLabel } from "@/lib/secretaria/status-labels";
import { REVIEWABLE_STATUSES, artifactKindLabel } from "@/lib/secretaria/document-artifact-labels";

// Toasts de trazabilidad por acción (informe legal §8.3). Copy aprobado.
const REVIEW_SUCCESS_TOAST: Record<string, string> = {
  APPROVED: "Documento aprobado documentalmente para su incorporación al expediente.",
  ARCHIVED: "Documento archivado con trazabilidad. Conservamos su huella y versión.",
  SUPERSEDED: "Documento marcado como sustituido. La versión anterior se conserva.",
  IN_REVIEW: "Documento en revisión.",
};

function statusTone(status: string) {
  if (status === "APPROVED" || status === "ARCHIVED" || status === "ATTACHED" || status === "SIGNED") {
    return "bg-[var(--status-success)] text-[var(--g-text-inverse)]";
  }
  if (status === "FAILED" || status === "REVOKED") return "bg-[var(--status-error)] text-[var(--g-text-inverse)]";
  if (status === "SUPERSEDED" || status === "WAIVED_WITH_OVERRIDE") return "bg-[var(--status-warning)] text-[var(--g-text-inverse)]";
  return "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]";
}

function shortHash(artifact: SecretariaDocumentArtifactRow) {
  const hash = artifact.hash_sha512 ?? artifact.content_hash ?? artifact.source_hash;
  if (!hash) return "Pendiente";
  return hash.length > 20 ? `${hash.slice(0, 12)}…${hash.slice(-8)}` : hash;
}

export default function DocumentosPendientesRevision() {
  const artifacts = useSecretariaDocumentArtifacts();
  const updateStatus = useUpdateSecretariaDocumentArtifactStatus();
  const { primaryRole } = useCurrentUserRole();
  const canCertify = useHasCapability(primaryRole, "CERTIFICATION");
  const rows = useMemo(() => artifacts.data ?? [], [artifacts.data]);
  const pendingRows = useMemo(
    () => rows.filter((row) => REVIEWABLE_STATUSES.has(row.status)),
    [rows],
  );
  const closedRows = useMemo(
    () => rows.filter((row) => !REVIEWABLE_STATUSES.has(row.status)).slice(0, 20),
    [rows],
  );

  async function setStatus(artifact: SecretariaDocumentArtifactRow, status: string, reviewed = false) {
    try {
      await updateStatus.mutateAsync({ artifactId: artifact.id, status, reviewed });
      toast.success(REVIEW_SUCCESS_TOAST[status] ?? "Estado actualizado", { description: artifact.title });
    } catch (e) {
      toast.error("No se pudo actualizar el documento", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
            <FileSearch className="h-3.5 w-3.5" />
            Secretaría · Revisión documental
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--g-text-primary)]">
            Revisión documental
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-[var(--g-text-secondary)]">
            Revisa documentos generados o anexados antes de aprobarlos, archivarlos o marcarlos como sustituidos.
          </p>
        </div>
        <button
          type="button"
          onClick={() => artifacts.refetch()}
          className="inline-flex items-center gap-2 border border-[var(--g-border-subtle)] px-3 py-2 text-sm text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
          aria-busy={artifacts.isFetching}
        >
          {artifacts.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Actualizar
        </button>
      </div>

      {artifacts.error ? (
        <div
          role="alert"
          className="flex items-start gap-3 border border-[var(--status-warning)]/40 bg-[var(--status-warning)]/10 p-4 text-sm text-[var(--g-text-primary)]"
          style={{ borderRadius: "var(--g-radius-lg)" }}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 text-[var(--status-warning)]" />
          <div>
            <p className="font-semibold">Schema documental pendiente</p>
            <p className="mt-1 text-[var(--g-text-secondary)]">
              Esta función requiere la migración documental de informes y certificaciones.
            </p>
          </div>
        </div>
      ) : null}

      <section className="grid gap-3 md:grid-cols-4">
        <Metric label="Pendientes" value={pendingRows.length} tone={pendingRows.length ? "warning" : "ok"} />
        <Metric label="Total documentos" value={rows.length} tone="neutral" />
        <Metric label="Aprobados" value={rows.filter((row) => row.status === "APPROVED").length} tone="ok" />
        <Metric label="Archivados" value={rows.filter((row) => row.status === "ARCHIVED").length} tone="ok" />
      </section>

      {!canCertify ? (
        <div
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4 text-sm text-[var(--g-text-secondary)]"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          Tu rol actual puede consultar documentos y hashes, pero no aprobar, archivar ni sustituir documentos.
        </div>
      ) : null}

      <DocumentTable
        title="Pendientes de revisión"
        rows={pendingRows}
        isLoading={artifacts.isLoading}
        isUpdating={updateStatus.isPending}
        onSetStatus={setStatus}
        canMutate={canCertify}
        empty="No hay documentos pendientes de revisión. Los documentos generados o anexados aparecerán aquí antes de su cierre."
        reviewMode
      />

      <DocumentTable
        title="Documentos cerrados"
        rows={closedRows}
        isLoading={artifacts.isLoading}
        isUpdating={updateStatus.isPending}
        onSetStatus={setStatus}
        canMutate={canCertify}
        empty="No hay documentos cerrados todavía. Cuando apruebes, archives o sustituyas un documento, aparecerá aquí con su trazabilidad."
      />
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: "neutral" | "ok" | "warning" }) {
  const valueClass =
    tone === "ok"
      ? "text-[var(--status-success)]"
      : tone === "warning"
        ? "text-[var(--status-warning)]"
        : "text-[var(--g-text-primary)]";
  return (
    <div
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-4 py-3"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${valueClass}`}>{value}</div>
    </div>
  );
}

function DocumentTable({
  title,
  rows,
  isLoading,
  isUpdating,
  onSetStatus,
  canMutate,
  empty,
  reviewMode = false,
}: {
  title: string;
  rows: SecretariaDocumentArtifactRow[];
  isLoading: boolean;
  isUpdating: boolean;
  onSetStatus: (artifact: SecretariaDocumentArtifactRow, status: string, reviewed?: boolean) => void;
  canMutate: boolean;
  empty: string;
  reviewMode?: boolean;
}) {
  return (
    <section
      className="overflow-hidden border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="border-b border-[var(--g-border-subtle)] px-5 py-4">
        <h2 className="text-base font-semibold text-[var(--g-text-primary)]">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[var(--g-border-subtle)]">
          <thead>
            <tr className="bg-[var(--g-surface-subtle)]">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--g-text-primary)]">Documento</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--g-text-primary)]">Estado</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--g-text-primary)]">Fuente</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--g-text-primary)]">Hash</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-[var(--g-text-primary)]">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--g-border-subtle)]">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-[var(--g-text-secondary)]">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando documentos…
                  </span>
                </td>
              </tr>
            ) : rows.length ? (
              rows.map((artifact) => (
                <tr key={artifact.id} className="hover:bg-[var(--g-surface-subtle)]/50">
                  <td className="px-4 py-3 text-sm text-[var(--g-text-primary)]">
                    <div className="font-semibold">{artifact.title}</div>
                    <div className="text-xs text-[var(--g-text-secondary)]">
                      {artifactKindLabel(artifact.artifact_kind)} · v{artifact.version}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 text-xs font-medium ${statusTone(artifact.status)}`}
                      style={{ borderRadius: "var(--g-radius-full)" }}
                    >
                      {statusLabel(artifact.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--g-text-secondary)]">
                    <div>{artifact.source_domain ?? "—"}</div>
                    <div className="font-mono text-[11px]">{artifact.source_id ?? "sin fuente"}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--g-text-secondary)]">{shortHash(artifact)}</td>
                  <td className="px-4 py-3 text-right">
                     {reviewMode ? (
                       <div className="flex flex-wrap justify-end gap-2">
                         <ActionButton
                           label="En revisión"
                           icon={SearchCheck}
                           disabled={!canMutate || isUpdating || artifact.status === "IN_REVIEW"}
                           onClick={() => onSetStatus(artifact, "IN_REVIEW")}
                         />
                         <ActionButton
                           label="Aprobar"
                           icon={CheckCircle2}
                           disabled={!canMutate || isUpdating}
                           onClick={() => onSetStatus(artifact, "APPROVED", true)}
                           primary
                         />
                         <ActionButton
                           label="Archivar"
                           icon={Archive}
                           disabled={!canMutate || isUpdating}
                           onClick={() => onSetStatus(artifact, "ARCHIVED", true)}
                         />
                      </div>
                    ) : (
                       <ActionButton
                         label="Marcar sustituido"
                         icon={RotateCcw}
                         title="Usa esta acción cuando exista una versión posterior o el documento ya no deba utilizarse."
                         disabled={!canMutate || isUpdating || artifact.status === "SUPERSEDED"}
                         onClick={() => onSetStatus(artifact, "SUPERSEDED")}
                       />
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-[var(--g-text-secondary)]">
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ActionButton({
  label,
  icon: Icon,
  disabled,
  onClick,
  primary = false,
  title,
}: {
  label: string;
  icon: React.ElementType;
  disabled: boolean;
  onClick: () => void;
  primary?: boolean;
  title?: string;
}) {
  const cls = primary
    ? "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)]"
    : "border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${cls}`}
      style={{ borderRadius: "var(--g-radius-md)" }}
      aria-busy={disabled}
      title={title}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
