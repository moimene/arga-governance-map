import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { FileSignature, Lock, Unlock, FolderOpen, Loader2 } from "lucide-react";
import { useActasList } from "@/hooks/useActas";
import { useSecretariaScope } from "@/components/secretaria/shell";

type ActasVista = "todas" | "pendientes" | "borradores" | "firma" | "certificaciones" | "cerradas";

const VISTA_LABEL: Record<ActasVista, string> = {
  todas: "Todas",
  pendientes: "Pendientes de generar",
  borradores: "Borradores",
  firma: "Pendientes de firma",
  certificaciones: "Certificaciones vinculadas",
  cerradas: "Cerradas",
};

export default function ActasLista() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const scope = useSecretariaScope();
  const scopedEntityId = scope.mode === "sociedad" ? scope.selectedEntity?.id ?? null : null;
  const { data, isLoading } = useActasList(scopedEntityId);
  const requestedPlantillaId = searchParams.get("plantilla");
  const requestedTemplateType = searchParams.get("tipo");
  const vista = (searchParams.get("vista") as ActasVista | null) ?? "todas";
  const activeVista: ActasVista = vista in VISTA_LABEL ? vista : "todas";

  function setVista(next: ActasVista) {
    const params = new URLSearchParams(searchParams);
    if (next === "todas") params.delete("vista");
    else params.set("vista", next);
    setSearchParams(params, { replace: true });
  }

  function actaDetailPath(actaId: string) {
    const params = new URLSearchParams();
    if (requestedPlantillaId) params.set("plantilla", requestedPlantillaId);
    if (requestedTemplateType) params.set("tipo", requestedTemplateType);
    const suffix = params.toString();
    return scope.createScopedTo(`/secretaria/actas/${actaId}${suffix ? `?${suffix}` : ""}`);
  }

  const rows = (data ?? []).filter((acta) => {
    if (activeVista === "borradores") return !acta.signed_at;
    if (activeVista === "firma") return !acta.signed_at;
    if (activeVista === "certificaciones") return acta.resolutions_count > 0;
    if (activeVista === "cerradas") return Boolean(acta.signed_at && acta.is_locked);
    if (activeVista === "pendientes") return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
          <FileSignature className="h-3.5 w-3.5" />
          Secretaría · Actas
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
          Actas y certificaciones vinculadas
        </h1>
        <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
          Bandeja documental. Las actas nacen desde reunión, acuerdo sin sesión o decisión documentable;
          las certificaciones se emiten desde un acta o acuerdo ya documentado.
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

      <div className="mb-4 flex flex-wrap gap-2" aria-label="Vistas de actas">
        {(Object.keys(VISTA_LABEL) as ActasVista[]).map((key) => {
          const active = activeVista === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setVista(key)}
              aria-pressed={active}
              className={`border px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "border-[var(--g-brand-3308)] bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]"
                  : "border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
              }`}
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              {VISTA_LABEL[key]}
            </button>
          );
        })}
      </div>

      {activeVista === "pendientes" ? (
        <div
          className="mb-4 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div className="text-sm font-semibold text-[var(--g-text-primary)]">
            Actas pendientes de origen trazable
          </div>
          <p className="mt-1 text-sm leading-6 text-[var(--g-text-secondary)]">
            Esta bandeja no crea actas libres. Abre el flujo fuente y genera el acta desde el expediente
            que ya acredita la adopción.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {[
              {
                label: "Reuniones cerradas sin acta",
                helper: "Generar acta desde una sesión celebrada o cerrada.",
                to: "/secretaria/reuniones",
              },
              {
                label: "Acuerdos sin sesión adoptados",
                helper: "Documentar acta de acuerdo escrito, co-aprobación o solidario.",
                to: "/secretaria/acuerdos-sin-sesion",
              },
              {
                label: "Decisiones unipersonales documentables",
                helper: "Documentar decisión de socio único o administrador único.",
                to: "/secretaria/decisiones-unipersonales",
              },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => navigate(scope.createScopedTo(item.to))}
                className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-3 text-left transition-colors hover:bg-[var(--g-surface-subtle)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <span className="block text-sm font-semibold text-[var(--g-text-primary)]">
                  {item.label}
                </span>
                <span className="mt-1 block text-xs leading-5 text-[var(--g-text-secondary)]">
                  {item.helper}
                </span>
              </button>
            ))}
          </div>
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
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                    <FolderOpen className="mb-3 h-10 w-10 text-[var(--g-text-secondary)]/40" />
                    <p className="text-sm font-medium text-[var(--g-text-secondary)]">
                      {activeVista === "todas"
                        ? "Sin actas registradas."
                        : "Sin actas para esta vista."}
                    </p>
                    <p className="mt-1 text-xs text-[var(--g-text-secondary)]/70">
                      Las actas se generan desde su origen societario: reunión, acuerdo sin sesión o decisión documentable.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((a) => (
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
