import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, FileText, Loader2, Plus, RefreshCw } from "lucide-react";
import { useCreateSecretariaDocumentArtifact, useInformesArtifacts } from "@/hooks/useSecretariaDocumentArtifacts";
import { statusLabel } from "@/lib/secretaria/status-labels";
import { EvidenceStatusBadge } from "@/components/secretaria/EvidenceStatusBadge";

const INFORME_TYPES = [
  { value: "INFORME_PRECEPTIVO", label: "Informe preceptivo" },
  { value: "INFORME_DOCUMENTAL_PRE", label: "Informe documental PRE" },
  { value: "INFORME_GESTION", label: "Informe de gestión" },
];

function StatusChip({ status }: { status: string }) {
  const cls =
    status === "APPROVED" || status === "ARCHIVED" || status === "ATTACHED"
      ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
      : status === "FAILED"
        ? "bg-[var(--status-error)] text-[var(--g-text-inverse)]"
        : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]";
  return (
    <span className={`inline-flex px-2 py-0.5 text-xs font-medium ${cls}`} style={{ borderRadius: "var(--g-radius-full)" }}>
      {statusLabel(status)}
    </span>
  );
}

export default function InformesPreceptivos() {
  const [searchParams] = useSearchParams();
  const agreementId = searchParams.get("agreement");
  const informes = useInformesArtifacts();
  const createArtifact = useCreateSecretariaDocumentArtifact();
  const [title, setTitle] = useState(agreementId ? "Informe preceptivo del acuerdo" : "");
  const [artifactKind, setArtifactKind] = useState("INFORME_PRECEPTIVO");
  const [sourceRef, setSourceRef] = useState(agreementId ? `agreement:${agreementId}` : "");

  async function handleCreate() {
    if (!title.trim()) return;
    try {
      await createArtifact.mutateAsync({
        artifactKind,
        title: title.trim(),
        sourceDomain: agreementId ? "agreement" : sourceRef.trim() ? "manual_preceptive_document" : null,
        sourceId: agreementId,
        sourceHash: agreementId ? null : sourceRef.trim() || null,
        sourcePayload: agreementId
          ? { agreement_id: agreementId, source_ref: sourceRef.trim() }
          : sourceRef.trim()
            ? { source_ref: sourceRef.trim() }
            : {},
        metadata: {
          creation_channel: "informes_preceptivos_page",
          trust_boundary: "DEMO_OPERATIVA",
          agreement_id: agreementId,
        },
      });
      toast.success("Informe creado");
      setTitle("");
      setSourceRef("");
    } catch (e) {
      toast.error("No se pudo crear el informe", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            Secretaría · Documentación
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
            Informes preceptivos
          </h1>
          <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
            Artefactos documentales exigibles por materia, anexables a convocatoria, acta, certificación y registro.
          </p>
        </div>
        <button
          type="button"
          onClick={() => informes.refetch()}
          className="inline-flex items-center justify-center gap-2 border border-[var(--g-border-subtle)] px-3 py-2 text-sm font-medium text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
          aria-busy={informes.isFetching}
        >
          {informes.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Actualizar
        </button>
      </div>

      {informes.error ? (
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
        <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--g-text-primary)]">Tipo</span>
            <select
              value={artifactKind}
              onChange={(e) => setArtifactKind(e.target.value)}
              className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:ring-2 focus:ring-[var(--g-border-focus)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              {INFORME_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--g-text-primary)]">Título</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:ring-2 focus:ring-[var(--g-border-focus)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-[var(--g-text-primary)]">Referencia/hash fuente</span>
            <input
              value={sourceRef}
              onChange={(e) => setSourceRef(e.target.value)}
              className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:ring-2 focus:ring-[var(--g-border-focus)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
          </label>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!title.trim() || createArtifact.isPending}
            aria-busy={createArtifact.isPending}
            className="inline-flex items-center justify-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] disabled:opacity-60"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            {createArtifact.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Crear
          </button>
        </div>
      </section>

      <section
        className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--g-border-subtle)]">
            <thead>
              <tr className="bg-[var(--g-surface-subtle)]">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--g-text-primary)]">Documento</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--g-text-primary)]">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--g-text-primary)]">Evidencia</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--g-text-primary)]">Huella</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--g-border-subtle)]">
              {(informes.data ?? []).map((artifact) => (
                <tr key={artifact.id} className="hover:bg-[var(--g-surface-subtle)]/50">
                  <td className="px-4 py-3 text-sm text-[var(--g-text-primary)]">
                    <div className="font-medium">{artifact.title}</div>
                    <div className="text-xs text-[var(--g-text-secondary)]">{artifact.artifact_kind}</div>
                  </td>
                  <td className="px-4 py-3"><StatusChip status={artifact.status} /></td>
                  <td className="px-4 py-3"><EvidenceStatusBadge status={artifact.evidence_status} /></td>
                  <td className="max-w-[360px] px-4 py-3">
                    <p className="truncate font-mono text-xs text-[var(--g-text-secondary)]">
                      {artifact.hash_sha512 ?? artifact.source_hash ?? "Pendiente"}
                    </p>
                  </td>
                </tr>
              ))}
              {informes.data?.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-[var(--g-text-secondary)]">
                    No hay informes registrados.
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
