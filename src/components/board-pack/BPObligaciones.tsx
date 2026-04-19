import { BPSection } from "./BPSection";
import { BoardPackObligation } from "@/hooks/useBoardPackData";

interface BPObligacionesProps {
  obligations: BoardPackObligation[];
}

const CRITICALITY_CHIP: Record<string, string> = {
  Alta:  "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  Media: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  Baja:  "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
};

export function BPObligaciones({ obligations }: BPObligacionesProps) {
  if (obligations.length === 0) {
    return (
      <BPSection title="5. Obligaciones regulatorias">
        <p className="text-sm text-[var(--g-text-secondary)]">Sin obligaciones registradas.</p>
      </BPSection>
    );
  }

  return (
    <BPSection title="5. Obligaciones regulatorias">
      <table className="w-full">
        <thead>
          <tr className="bg-[var(--g-surface-subtle)]">
            <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
              Código
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
              Obligación
            </th>
            <th className="px-4 py-2 text-center text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
              Criticidad
            </th>
            <th className="px-4 py-2 text-center text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
              Incidentes
            </th>
            <th className="px-4 py-2 text-center text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
              Controles
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--g-border-subtle)]">
          {obligations.map((obl) => (
            <tr key={obl.code} className="hover:bg-[var(--g-surface-subtle)]/40 transition-colors">
              <td className="px-4 py-3 font-mono text-xs text-[var(--g-text-secondary)]">
                {obl.code}
              </td>
              <td className="px-4 py-3 text-sm text-[var(--g-text-primary)]">
                {obl.title}
              </td>
              <td className="px-4 py-3 text-center">
                <span
                  className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium ${
                    CRITICALITY_CHIP[obl.criticality] ??
                    "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]"
                  }`}
                  style={{ borderRadius: "var(--g-radius-sm)" }}
                >
                  {obl.criticality}
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                {obl.incidents_count > 0 ? (
                  <span className="text-sm font-semibold text-[var(--status-error)]">
                    {obl.incidents_count}
                  </span>
                ) : (
                  <span className="text-sm text-[var(--g-text-secondary)]">0</span>
                )}
              </td>
              <td className="px-4 py-3 text-center text-sm text-[var(--g-text-secondary)]">
                {obl.controls_count}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </BPSection>
  );
}
