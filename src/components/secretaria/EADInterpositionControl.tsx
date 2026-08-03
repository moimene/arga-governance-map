import { ShieldCheck } from "lucide-react";
import type { ProcessDocumentGenerationResult } from "@/lib/doc-gen/process-documents";

type UnsignedCandidate = ProcessDocumentGenerationResult["candidate"];

interface EADInterpositionControlProps {
  sourceDomain: "MINUTE" | "CERTIFICATION";
  sourceId: string;
  domainContentHash?: string | null;
  candidate: UnsignedCandidate | null;
  /** Compatibilidad visual: la custodia no atribuye firma a estas personas. */
  signatories?: readonly unknown[];
  label: string;
  isDemoSimulation?: boolean;
}

/**
 * Estado fail-closed del futuro e-archiving final. Un documento generado en el
 * navegador es solo un candidato de revisión y nunca se eleva a artefacto final.
 */
export function EADInterpositionControl({
  domainContentHash,
  candidate,
  label,
  isDemoSimulation = false,
}: EADInterpositionControlProps) {
  const normalizedDomainHash = domainContentHash?.toLowerCase() ?? "";
  const blockedReason = isDemoSimulation
    ? "Simulación demo: no se contacta con EAD Trust."
    : !/^[0-9a-f]{64}$/.test(normalizedDomainHash)
      ? "La fuente jurídica todavía no tiene un hash canónico válido."
      : !candidate
        ? "Genere primero el candidato DOCX; la generación no contacta con EAD Trust."
        : candidate.contentHashSha256.toLowerCase() !== normalizedDomainHash
          ? "El candidato no coincide con la versión canónica; regénerelo antes de continuar."
          : "Custodia final bloqueada: falta un binario generado y registrado de forma autoritativa en servidor.";

  return (
    <div
      className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-3 text-left"
      style={{ borderRadius: "var(--g-radius-md)" }}
      aria-label={`Custodia EAD de ${label}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[var(--g-brand-3308)]" aria-hidden="true" />
          <span className="text-xs font-semibold text-[var(--g-text-primary)]">
            EAD Trust · Custodia/e-archiving
          </span>
        </div>
        <span
          className="bg-[var(--g-surface-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--g-text-secondary)]"
          style={{ borderRadius: "var(--g-radius-sm)" }}
        >
          Pendiente de renderer autoritativo
        </span>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-[var(--g-text-secondary)]">
        El DOCX generado aquí es solo un candidato descargable para revisión. La aplicación no lo
        envía a EAD Trust ni lo marca como final: esa custodia requerirá un render binario producido
        y verificado en servidor contra la fuente canónica.
      </p>
      {candidate ? (
        <p className="mt-1 break-all font-mono text-[10px] text-[var(--g-text-secondary)]">
          UNSIGNED_INPUT · SHA-256 {candidate.contentHashSha256}
        </p>
      ) : null}
      <p className="mt-2 text-xs text-[var(--status-error)]" role="alert">
        {blockedReason}
      </p>
      <button
        type="button"
        disabled
        aria-disabled="true"
        title={blockedReason}
        className="mt-3 inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-3 py-2 text-xs font-medium text-[var(--g-text-inverse)] disabled:cursor-not-allowed disabled:opacity-50"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        Custodia final no disponible
      </button>
    </div>
  );
}
