import { Shield, FileCheck2, Lock, ExternalLink } from "lucide-react";
import { useEvidenceBundlesList, useVerifyAuditChain } from "@/hooks/useEvidenceBundles";
import { useState } from "react";

export function EvidenceForenseSection() {
  const { data: bundles = [], isLoading } = useEvidenceBundlesList();
  const verifyMutation = useVerifyAuditChain();
  const [verifyResult, setVerifyResult] = useState<{ valid: boolean; chain_length?: number; errors?: string[] } | null>(null);

  const handleVerify = async () => {
    const result = await verifyMutation.mutateAsync();
    setVerifyResult(result);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--g-text-primary)] flex items-center gap-2">
          <Shield className="h-4 w-4 text-[var(--g-brand-3308)]" />
          Evidencia Forense
        </h3>
        <button
          type="button"
          onClick={handleVerify}
          disabled={verifyMutation.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[var(--g-border-subtle)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] transition-colors disabled:opacity-50"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <FileCheck2 className="h-3.5 w-3.5" />
          {verifyMutation.isPending ? "Verificando..." : "Verificar cadena"}
        </button>
      </div>

      {verifyResult && (
        <div
          className={`flex items-center gap-2 px-4 py-3 text-sm ${
            verifyResult[0]?.chain_valid
              ? "text-[var(--status-success)]"
              : "text-[var(--status-error)]"
          }`}
          style={{
            borderRadius: "var(--g-radius-md)",
            background: verifyResult[0]?.chain_valid ? "var(--g-sec-100)" : "hsl(0 84% 60% / 0.08)",
          }}
        >
          {verifyResult[0]?.chain_valid ? (
            <>
              <FileCheck2 className="h-4 w-4" />
              Cadena íntegra — {verifyResult[0]?.total_entries} entradas verificadas
            </>
          ) : (
            <>
              <Shield className="h-4 w-4" />
              ¡Cadena comprometida! Se ha detectado manipulación.
            </>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse bg-[var(--g-surface-muted)]" style={{ borderRadius: "var(--g-radius-md)" }} />
          ))}
        </div>
      ) : bundles.length === 0 ? (
        <div
          className="px-4 py-6 text-center text-sm text-[var(--g-text-secondary)]"
          style={{ borderRadius: "var(--g-radius-md)", background: "var(--g-surface-muted)" }}
        >
          No hay evidencias registradas aún
        </div>
      ) : (
        <div className="space-y-2">
          {bundles.map((b) => (
            <div
              key={b.id}
              className="border border-[var(--g-border-subtle)] p-4"
              style={{ borderRadius: "var(--g-radius-md)", background: "var(--g-surface-card)" }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-medium text-[var(--g-text-primary)] flex items-center gap-2">
                    {b.reference_code || b.id.slice(0, 8)}
                    {b.legal_hold && (
                      <span
                        className="px-1.5 py-0.5 text-[10px] font-semibold bg-[var(--status-warning)] text-[var(--g-text-inverse)]"
                        style={{ borderRadius: "var(--g-radius-full)" }}
                      >
                        <Lock className="h-2.5 w-2.5 inline mr-0.5" />
                        LEGAL HOLD
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[var(--g-text-secondary)] mt-1">
                    Firmado por: {b.signed_by || "—"} · {b.created_at ? new Date(b.created_at).toLocaleDateString("es-ES") : "—"}
                  </div>
                </div>
                {b.document_url && (
                  <a
                    href={b.document_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--g-brand-3308)] hover:text-[var(--g-sec-700)]"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
              {b.hash_sha512 && (
                <div
                  className="mt-2 px-3 py-2 font-mono text-[10px] text-[var(--g-text-secondary)] break-all"
                  style={{ borderRadius: "var(--g-radius-sm)", background: "var(--g-surface-muted)" }}
                >
                  SHA-512: {b.hash_sha512.slice(0, 32)}...{b.hash_sha512.slice(-16)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
