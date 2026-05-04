import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { FileSignature, Lock, Unlock, FolderOpen, Loader2 } from "lucide-react";
import { useActasList } from "@/hooks/useActas";
import { useSecretariaScope } from "@/components/secretaria/shell";

export default function ActasLista() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const scope = useSecretariaScope();
  const scopedEntityId = scope.mode === "sociedad" ? scope.selectedEntity?.id ?? null : null;
  const { data, isLoading } = useActasList(scopedEntityId);
  const requestedPlantillaId = searchParams.get("plantilla");
  const requestedTemplateType = searchParams.get("tipo");

  function actaDetailPath(actaId: string) {
    const params = new URLSearchParams();
    if (requestedPlantillaId) params.set("plantilla", requestedPlantillaId);
    if (requestedTemplateType) params.set("tipo", requestedTemplateType);
    const suffix = params.toString();
    return scope.createScopedTo(`/secretaria/actas/${actaId}${suffix ? `?${suffix}` : ""}`);
  }

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

      {scope.mode === "sociedad" && scope.selectedEntity ? (
        <div
          className="mb-4 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-4 py-3 text-sm text-[var(--g-text-secondary)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          Vista filtrada por sociedad:
          <span className="ml-1 font-semibold text-[var(--g-text-primary)]">
            {scope.selectedEntity.legalName}
          </span>
        </div>
      ) : null}

      {requestedPlantillaId ? (
        <div
          className="mb-4 border border-[var(--g-sec-300)] bg-[var(--g-sec-100)] px-4 py-3 text-sm text-[var(--g-text-primary)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          Plantilla documental seleccionada:
          <span className="ml-1 font-mono text-xs">{requestedPlantillaId.slice(0, 8)}</span>
          . Elige el acta o certificación sobre la que se aplicará.
        </div>
      ) : null}

      <div
        className="overflow-x-auto border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <table className="w-full min-w-[700px]">
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
                <td colSpan={5} className="px-6 py-8 text-center">
                  <div className="flex items-center justify-center gap-2 text-sm text-[var(--g-text-secondary)]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando…
                  </div>
                </td>
              </tr>
            ) : !data || data.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                    <FolderOpen className="mb-3 h-10 w-10 text-[var(--g-text-secondary)]/40" />
                    <p className="text-sm font-medium text-[var(--g-text-secondary)]">
                      Sin actas registradas.
                    </p>
                    <p className="mt-1 text-xs text-[var(--g-text-secondary)]/70">
                      Las actas se generan al completar el paso "Cierre" en el asistente de reunión.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => navigate(actaDetailPath(a.id))}
                  className="cursor-pointer transition-colors hover:bg-[var(--g-surface-subtle)]/50"
                >
                  <td className="px-6 py-4 text-sm font-medium text-[var(--g-text-primary)]">
                    <Link
                      to={actaDetailPath(a.id)}
                      onClick={(event) => event.stopPropagation()}
                      className="text-[var(--g-link)] hover:text-[var(--g-link-hover)]"
                    >
                      {a.body_name ?? "Acta"}
                    </Link>
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
                    {a.signed_at && a.is_locked ? (
                      <span
                        className="inline-flex items-center gap-1 bg-[var(--status-success)] px-2 py-0.5 text-[11px] font-medium text-[var(--g-text-inverse)]"
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      >
                        <Lock className="h-3 w-3" />
                        Firmada y cerrada
                      </span>
                    ) : a.signed_at ? (
                      <span
                        className="inline-flex items-center gap-1 bg-[var(--status-info)] px-2 py-0.5 text-[11px] font-medium text-[var(--g-text-inverse)]"
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      >
                        <Lock className="h-3 w-3" />
                        Firmada
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 bg-[var(--g-surface-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--g-text-secondary)]"
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
