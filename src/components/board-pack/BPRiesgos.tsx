import { BPSection } from "./BPSection";
import { BoardPackRisk } from "@/hooks/useBoardPackData";

interface BPRiesgosProps {
  risks: BoardPackRisk[];
}

function scoreBadge(score: number): string {
  if (score >= 15) return "bg-[var(--status-error)] text-[var(--g-text-inverse)]";
  if (score >= 10) return "bg-[var(--status-warning)] text-[var(--g-text-inverse)]";
  return "bg-[var(--status-success)] text-[var(--g-text-inverse)]";
}

function scoreLabel(score: number): string {
  if (score >= 15) return "Crítico";
  if (score >= 10) return "Alto";
  return "Moderado";
}

export function BPRiesgos({ risks }: BPRiesgosProps) {
  if (risks.length === 0) {
    return (
      <BPSection title="4. Dashboard de riesgos">
        <p className="text-sm text-[var(--g-text-secondary)]">Sin riesgos registrados.</p>
      </BPSection>
    );
  }

  return (
    <BPSection title="4. Dashboard de riesgos — Top 5">
      <table className="w-full">
        <thead>
          <tr className="bg-[var(--g-surface-subtle)]">
            <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
              Código
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
              Riesgo
            </th>
            <th className="px-4 py-2 text-center text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
              Score inherente
            </th>
            <th className="px-4 py-2 text-center text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
              Score residual
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
              Estado
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--g-border-subtle)]">
          {risks.map((r) => (
            <tr key={r.code} className="hover:bg-[var(--g-surface-subtle)]/40 transition-colors">
              <td className="px-4 py-3 font-mono text-xs text-[var(--g-text-secondary)]">
                {r.code}
              </td>
              <td className="px-4 py-3 text-sm font-medium text-[var(--g-text-primary)]">
                {r.title}
              </td>
              <td className="px-4 py-3 text-center">
                <div className="flex flex-col items-center gap-0.5">
                  <span
                    className={`inline-flex h-8 w-8 items-center justify-center text-sm font-bold ${scoreBadge(r.inherent_score)}`}
                    style={{ borderRadius: "var(--g-radius-sm)" }}
                  >
                    {r.inherent_score}
                  </span>
                  <span className="text-[10px] text-[var(--g-text-secondary)]">
                    {scoreLabel(r.inherent_score)}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 text-center">
                {r.residual_score != null ? (
                  <div className="flex flex-col items-center gap-0.5">
                    <span
                      className={`inline-flex h-8 w-8 items-center justify-center text-sm font-bold ${scoreBadge(r.residual_score)}`}
                      style={{ borderRadius: "var(--g-radius-sm)" }}
                    >
                      {r.residual_score}
                    </span>
                    <span className="text-[10px] text-[var(--g-text-secondary)]">
                      {scoreLabel(r.residual_score)}
                    </span>
                  </div>
                ) : (
                  <span className="text-sm text-[var(--g-text-secondary)]">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-sm text-[var(--g-text-secondary)]">
                {r.status}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-[var(--g-text-secondary)]">
        Escala: ≥ 15 Crítico · 10–14 Alto · &lt; 10 Moderado / Bajo
      </p>
    </BPSection>
  );
}
