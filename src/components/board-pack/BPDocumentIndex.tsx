import { AlertTriangle, FileText } from "lucide-react";
import { BPSection } from "./BPSection";
import { useDocumentAnnexLinks, type DocumentAnnexLinkRow } from "@/hooks/useSecretariaDocumentArtifacts";

function shortHash(value?: string | null) {
  if (!value) return "Pendiente";
  return value.length > 20 ? `${value.slice(0, 12)}...${value.slice(-8)}` : value;
}

function artifactHash(row: DocumentAnnexLinkRow) {
  return row.artifact?.hash_sha512 ?? row.artifact?.content_hash ?? row.artifact?.source_hash ?? null;
}

function artifactTitle(row: DocumentAnnexLinkRow) {
  return row.artifact?.title ?? row.annex_role.replace(/_/g, " ");
}

export function BPDocumentIndex({
  meetingId,
  agreementIds,
}: {
  meetingId: string;
  agreementIds: string[];
}) {
  const meetingLinks = useDocumentAnnexLinks({ linkedDomain: "meeting", linkedIds: [meetingId] });
  const boardPackLinks = useDocumentAnnexLinks({ linkedDomain: "board_pack", linkedIds: [meetingId] });
  const agreementLinks = useDocumentAnnexLinks({ linkedDomain: "agreement", linkedIds: agreementIds });
  const rowsByKey = new Map<string, DocumentAnnexLinkRow>();

  [...(meetingLinks.data ?? []), ...(boardPackLinks.data ?? []), ...(agreementLinks.data ?? [])].forEach((row) => {
    const key = row.artifact_id || row.id;
    if (!rowsByKey.has(key)) rowsByKey.set(key, row);
  });
  const rows = Array.from(rowsByKey.values());
  const isLoading = meetingLinks.isLoading || boardPackLinks.isLoading || agreementLinks.isLoading;
  const error = meetingLinks.error ?? boardPackLinks.error ?? agreementLinks.error;

  return (
    <BPSection title="2.b Índice documental y evidencias">
      {error ? (
        <div
          className="flex items-start gap-2 border border-[var(--status-warning)]/40 bg-[var(--status-warning)]/10 p-3 text-xs text-[var(--g-text-primary)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-warning)]" />
          <span>Índice documental pendiente de migración de informes y certificaciones.</span>
        </div>
      ) : isLoading ? (
        <p className="text-sm text-[var(--g-text-secondary)]">Cargando índice documental...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-[var(--g-text-secondary)]">
          Sin informes, certificaciones o anexos documentales asociados al Board Pack.
        </p>
      ) : (
        <div className="overflow-hidden border border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-md)" }}>
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[var(--g-surface-subtle)]">
                <th className="px-3 py-2 text-xs font-semibold uppercase text-[var(--g-text-primary)]">Documento</th>
                <th className="px-3 py-2 text-xs font-semibold uppercase text-[var(--g-text-primary)]">Destino</th>
                <th className="px-3 py-2 text-xs font-semibold uppercase text-[var(--g-text-primary)]">Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--g-border-subtle)]">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2 text-sm text-[var(--g-text-primary)]">
                    <span className="inline-flex items-center gap-2">
                      <FileText className="h-4 w-4 text-[var(--g-brand-3308)]" />
                      <span>
                        <span className="block font-medium">{artifactTitle(row)}</span>
                        <span className="text-xs text-[var(--g-text-secondary)]">
                          {row.artifact?.artifact_kind ?? row.annex_role}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-[var(--g-text-secondary)]">
                    {row.linked_domain} · {row.annex_role}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-[var(--g-text-secondary)]">
                    {shortHash(artifactHash(row))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </BPSection>
  );
}
