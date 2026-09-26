import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Archive, FolderOpen, Loader2 } from "lucide-react";
import { useAgreementsList } from "@/hooks/useAgreementsList";
import { statusLabel } from "@/lib/secretaria/status-labels";
import { labelMateria } from "@/lib/secretaria/agenda-materias";
import { useSecretariaScope } from "@/components/secretaria/shell";

const TODOS = "__todos__";

/**
 * MOI-197 — índice navegable de expedientes de acuerdo (`agreements`).
 *
 * Antes de esta página, un acuerdo solo se alcanzaba desde la reunión, el acta
 * o el tramitador que lo originaron. Reutiliza `useAgreementsList` (sin
 * filtro de estado servidor: la vista por defecto debe cuadrar con el total
 * del tenant) y filtra estado/órgano/materia en cliente, tal y como autoriza
 * el propio issue ("en cliente o ampliando la consulta").
 */
export default function ExpedientesAcuerdoLista() {
  const navigate = useNavigate();
  const scope = useSecretariaScope();
  const { data, isLoading } = useAgreementsList();
  const [estado, setEstado] = useState(TODOS);
  const [organo, setOrgano] = useState(TODOS);
  const [materia, setMateria] = useState(TODOS);

  const rows = useMemo(() => data ?? [], [data]);

  const estados = useMemo(
    () => Array.from(new Set(rows.map((a) => a.status))).sort(),
    [rows]
  );
  const organos = useMemo(() => {
    const seen = new Map<string, string>();
    for (const a of rows) {
      if (a.body_id) seen.set(a.body_id, a.body_name ?? a.body_id);
    }
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);
  const materias = useMemo(
    () => Array.from(new Set(rows.map((a) => a.matter_class))).sort(),
    [rows]
  );

  const filtered = rows.filter((a) => {
    if (estado !== TODOS && a.status !== estado) return false;
    if (organo !== TODOS && a.body_id !== organo) return false;
    if (materia !== TODOS && a.matter_class !== materia) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
          <Archive className="h-3.5 w-3.5" />
          Secretaría · Adopción
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
          Expedientes de acuerdo
        </h1>
        <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
          Todos los acuerdos del grupo, con independencia de dónde se adoptaron. Filtra por estado,
          órgano o materia y abre la ficha completa de cada expediente.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-3" aria-label="Filtros de expedientes de acuerdo">
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--g-text-secondary)]">
          Estado
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-1.5 text-sm text-[var(--g-text-primary)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <option value={TODOS}>Todos</option>
            {estados.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--g-text-secondary)]">
          Órgano
          <select
            value={organo}
            onChange={(e) => setOrgano(e.target.value)}
            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-1.5 text-sm text-[var(--g-text-primary)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <option value={TODOS}>Todos</option>
            {organos.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--g-text-secondary)]">
          Materia
          <select
            value={materia}
            onChange={(e) => setMateria(e.target.value)}
            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-1.5 text-sm text-[var(--g-text-primary)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <option value={TODOS}>Todas</option>
            {materias.map((m) => (
              <option key={m} value={m}>
                {statusLabel(m)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        className="overflow-x-auto border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="bg-[var(--g-surface-subtle)]">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Acuerdo
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Órgano
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Materia
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Fecha
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Estado
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--g-border-subtle)]">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center">
                  <div className="flex items-center justify-center gap-2 text-sm text-[var(--g-text-secondary)]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando…
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                    <FolderOpen className="mb-3 h-10 w-10 text-[var(--g-text-secondary)]/40" />
                    <p className="text-sm font-medium text-[var(--g-text-secondary)]">
                      {rows.length === 0 ? "Sin expedientes de acuerdo registrados." : "Sin expedientes para este filtro."}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((a) => {
                const to = scope.createScopedTo(`/secretaria/acuerdos/${a.id}`);
                return (
                  <tr
                    key={a.id}
                    onClick={() => navigate(to)}
                    className="cursor-pointer transition-colors hover:bg-[var(--g-surface-subtle)]/50"
                  >
                    <td className="px-6 py-4 text-sm font-medium text-[var(--g-text-primary)]">
                      <Link
                        to={to}
                        onClick={(event) => event.stopPropagation()}
                        className="text-[var(--g-link)] hover:text-[var(--g-link-hover)]"
                      >
                        {labelMateria(a.agreement_kind)}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">
                      {a.body_name ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">
                      {statusLabel(a.matter_class)}
                    </td>
                    <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">
                      {a.decision_date ? new Date(a.decision_date).toLocaleDateString("es-ES") : "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className="inline-flex items-center gap-1 bg-[var(--g-surface-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--g-text-secondary)]"
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      >
                        {statusLabel(a.status)}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-[var(--g-text-secondary)]">
        {rows.length} expediente{rows.length === 1 ? "" : "s"} en total
        {filtered.length !== rows.length ? ` · ${filtered.length} con el filtro aplicado` : ""}.
      </p>
    </div>
  );
}
