import { useNavigate } from "react-router-dom";
import { FileSignature, Lock, Unlock } from "lucide-react";
import { useActasList } from "@/hooks/useActas";

export default function ActasLista() {
  const navigate = useNavigate();
  const { data, isLoading } = useActasList();

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
          <FileSignature className="h-3.5 w-3.5" />
          Secretaría · Actas
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
          Actas y certificaciones
        </h1>
        <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
          Redacción del acta, firma secretario/presidente y emisión de certificaciones de acuerdos.
        </p>
      </div>

      <div
        className="overflow-hidden border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <table className="w-full">
          <thead>
            <tr className="bg-[var(--g-surface-subtle)]">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Órgano
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Entidad
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Tipo reunión
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Firmada
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Estado
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--g-border-subtle)]">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-[var(--g-text-secondary)]">
                  Cargando…
                </td>
              </tr>
            ) : !data || data.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-[var(--g-text-secondary)]">
                  Sin actas.
                </td>
              </tr>
            ) : (
              data.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => navigate(`/secretaria/actas/${a.id}`)}
                  className="cursor-pointer transition-colors hover:bg-[var(--g-surface-subtle)]/50"
                >
                  <td className="px-6 py-4 text-sm font-medium text-[var(--g-text-primary)]">
                    {a.body_name ?? "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">
                    {a.entity_name ?? "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">
                    {a.meeting_type ?? "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">
                    {a.signed_at ? new Date(a.signed_at).toLocaleDateString("es-ES") : "—"}
                  </td>
                  <td className="px-6 py-4">
                    {a.is_locked ? (
                      <span
                        className="inline-flex items-center gap-1 bg-[var(--status-success)] px-2 py-0.5 text-[11px] font-medium text-[var(--g-text-inverse)]"
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      >
                        <Lock className="h-3 w-3" />
                        Firmada
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 bg-[var(--status-warning)] px-2 py-0.5 text-[11px] font-medium text-[var(--g-text-inverse)]"
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      >
                        <Unlock className="h-3 w-3" />
                        Borrador
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
