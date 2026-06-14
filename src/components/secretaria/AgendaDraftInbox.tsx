import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Inbox } from "lucide-react";
import { useAgendaDrafts, useAgendaDraftTransicion } from "@/hooks/useAgendaDrafts";
import {
  availableAgendaDraftActions,
  type AgendaDraftAction,
} from "@/lib/secretaria/agenda-draft";
import { statusLabel } from "@/lib/secretaria/status-labels";

/**
 * W9 — bandeja de borradores de agenda propuestos por GRC/AIMS/Compliance. El
 * Secretario decide (aprobar/posponer/rechazar) y convoca un APROBADO. Se oculta
 * si no hay borradores activos. Surface read/write con tokens Garrigues.
 */
const ACTION_LABEL: Record<AgendaDraftAction, string> = {
  APROBAR: "Aprobar",
  POSPONER: "Posponer",
  RECHAZAR: "Rechazar",
  CONVOCAR: "Convocar reunión",
};

export function AgendaDraftInbox() {
  const navigate = useNavigate();
  const { data: drafts = [] } = useAgendaDrafts(true);
  const transicion = useAgendaDraftTransicion();
  if (drafts.length === 0) return null;

  const onFail = (e: unknown) =>
    toast.error(e instanceof Error ? e.message : "No se pudo actualizar el borrador.");

  return (
    <section
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-5"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="mb-3 flex items-center gap-2">
        <Inbox className="h-4 w-4 text-[var(--g-brand-3308)]" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
          Borradores de agenda ({drafts.length})
        </h2>
      </div>
      <p className="mb-4 text-xs text-[var(--g-text-secondary)]">
        Puntos propuestos por otros módulos. Como Secretario, deciden su elevación: nada se
        convoca sin tu aprobación.
      </p>
      <ul className="space-y-3">
        {drafts.map((d) => {
          const actions = availableAgendaDraftActions(d.estado);
          const busy = transicion.isPending;
          return (
            <li
              key={d.id}
              className="border border-[var(--g-border-subtle)] p-3"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--g-text-primary)]">{d.titulo}</p>
                  {d.descripcion ? (
                    <p className="mt-0.5 text-xs text-[var(--g-text-secondary)]">{d.descripcion}</p>
                  ) : null}
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[var(--g-text-secondary)]">
                    <span className="font-medium text-[var(--g-text-primary)]">{d.origen_modulo}</span>
                    {d.materia ? <span>· {d.materia}</span> : null}
                    <span>· {statusLabel(d.estado)}</span>
                  </div>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {actions.map((a) => {
                  const isConvocar = a === "CONVOCAR";
                  const cls = isConvocar
                    ? "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)]"
                    : "border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]";
                  return (
                    <button
                      key={a}
                      type="button"
                      disabled={busy}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-60 ${cls}`}
                      style={{ borderRadius: "var(--g-radius-md)" }}
                      onClick={() =>
                        transicion.mutate(
                          { draftId: d.id, action: a },
                          {
                            onSuccess: () => {
                              toast.success(`${ACTION_LABEL[a]} — hecho.`);
                              if (isConvocar) {
                                const ent = d.entity_id
                                  ? `&entity=${encodeURIComponent(d.entity_id)}&scope=sociedad`
                                  : "";
                                navigate(
                                  `/secretaria/reuniones/nueva?source=agenda&draft=${encodeURIComponent(d.id)}${ent}`,
                                );
                              }
                            },
                            onError: onFail,
                          },
                        )
                      }
                    >
                      {ACTION_LABEL[a]}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
