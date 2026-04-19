import { BPSection } from "./BPSection";
import { BoardPackDelegation } from "@/hooks/useBoardPackData";

interface BPDelegacionesProps {
  delegations: BoardPackDelegation[];
}

function expiryBadge(days: number): { cls: string; label: string } {
  if (days < 0)
    return {
      cls: "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
      label: "CADUCADA",
    };
  if (days <= 60)
    return {
      cls: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
      label: `${days}d`,
    };
  if (days <= 90)
    return {
      cls: "bg-[var(--status-info)] text-[var(--g-text-inverse)]",
      label: `${days}d`,
    };
  return {
    cls: "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
    label: `${days}d`,
  };
}

export function BPDelegaciones({ delegations }: BPDelegacionesProps) {
  if (delegations.length === 0) {
    return (
      <BPSection title="8. Delegaciones de poderes">
        <p className="text-sm text-[var(--g-text-secondary)]">Sin delegaciones vigentes.</p>
      </BPSection>
    );
  }

  return (
    <BPSection title="8. Delegaciones de poderes">
      <div className="space-y-3">
        {delegations.map((d) => {
          const { cls: expiryCls, label: expiryLabel } = expiryBadge(d.days_to_expiry);
          return (
            <div
              key={d.code}
              className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] overflow-hidden"
              style={{ borderRadius: "var(--g-radius-md)", boxShadow: "var(--g-shadow-card)" }}
            >
              <div className="flex items-start justify-between gap-3 bg-[var(--g-surface-subtle)] px-4 py-3">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <span className="shrink-0 font-mono text-xs font-semibold text-[var(--g-text-secondary)] mt-0.5">
                    {d.code}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-[var(--g-text-primary)]">
                      {d.delegation_type}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--g-text-secondary)]">
                      {d.delegate_name}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold ${expiryCls}`}
                    style={{ borderRadius: "var(--g-radius-sm)" }}
                    title={`Vence ${new Date(d.end_date).toLocaleDateString("es-ES")}`}
                  >
                    {expiryLabel}
                  </span>
                  <span className="text-[10px] text-[var(--g-text-secondary)]">
                    Vence {new Date(d.end_date).toLocaleDateString("es-ES")}
                  </span>
                </div>
              </div>
              <div className="px-4 py-2.5 space-y-1">
                <p className="text-xs text-[var(--g-text-secondary)] leading-relaxed line-clamp-2">
                  <span className="font-medium text-[var(--g-text-primary)]">Ámbito: </span>
                  {d.scope}
                </p>
                {d.limits && (
                  <p className="text-xs text-[var(--g-text-secondary)] leading-relaxed line-clamp-1">
                    <span className="font-medium text-[var(--g-text-primary)]">Límites: </span>
                    {d.limits}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-[var(--g-text-secondary)]">
        Delegaciones ordenadas por fecha de vencimiento · Alerta automática a &lt; 60 días
      </p>
    </BPSection>
  );
}
