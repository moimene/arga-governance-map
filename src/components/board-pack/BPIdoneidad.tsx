import { BPSection } from "./BPSection";
import { BoardPackData } from "@/hooks/useBoardPackData";

interface BPIdoneidadProps {
  attestations: BoardPackData["attestations"];
}

export function BPIdoneidad({ attestations }: BPIdoneidadProps) {
  const { campaign, completed, total, pending } = attestations;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const allComplete = pending.length === 0;

  return (
    <BPSection title="7. Idoneidad — Fit &amp; Proper">
      {/* Resumen campaña */}
      <div
        className="mb-4 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-4"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-sm font-medium text-[var(--g-text-primary)]">{campaign}</p>
            <p className="mt-0.5 text-xs text-[var(--g-text-secondary)]">
              {completed} de {total} declaraciones completadas
            </p>
          </div>
          <span
            className={`text-2xl font-bold ${
              allComplete ? "text-[var(--status-success)]" : "text-[var(--status-warning)]"
            }`}
          >
            {pct}%
          </span>
        </div>

        {/* Barra de progreso */}
        <div
          className="h-2 w-full overflow-hidden bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)]"
          style={{ borderRadius: "var(--g-radius-full)" }}
        >
          <div
            className={`h-full transition-all ${
              allComplete ? "bg-[var(--status-success)]" : "bg-[var(--status-warning)]"
            }`}
            style={{ width: `${pct}%`, borderRadius: "var(--g-radius-full)" }}
          />
        </div>
      </div>

      {/* Pendientes */}
      {allComplete ? (
        <div
          className="flex items-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-4 py-3 text-sm text-[var(--status-success)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          Todas las declaraciones de idoneidad completadas ✓
        </div>
      ) : (
        <>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--status-warning)]">
            Declaraciones pendientes ({pending.length})
          </p>
          <table className="w-full">
            <thead>
              <tr className="bg-[var(--g-surface-subtle)]">
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                  Consejero / Directivo
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                  Campaña
                </th>
                <th className="px-4 py-2 text-center text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--g-border-subtle)]">
              {pending.map((a, i) => (
                <tr key={i} className="hover:bg-[var(--g-surface-subtle)]/40 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-[var(--g-text-primary)]">
                    {a.person_name}
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--g-text-secondary)]">
                    {a.campaign}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium bg-[var(--status-warning)] text-[var(--g-text-inverse)]"
                      style={{ borderRadius: "var(--g-radius-sm)" }}
                    >
                      Pendiente
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-[var(--g-text-secondary)]">
            Plazo máximo para completar declaraciones: 15 días desde convocatoria CdA
          </p>
        </>
      )}
    </BPSection>
  );
}
