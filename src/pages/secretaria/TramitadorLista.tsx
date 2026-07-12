import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Gavel, Plus, FolderOpen } from "lucide-react";
import { useTramitacionesList, type FilingRow } from "@/hooks/useTramitador";
import { statusLabel } from "@/lib/secretaria/status-labels";
import { useSecretariaScope } from "@/components/secretaria/shell";
import {
  buildUrlWithSearchParams,
  pickTemplateHandoffSearchParams,
} from "@/lib/secretaria/template-configuration-routing";

type TramitadorVista = "todas" | "en-tramite" | "subsanaciones" | "presentaciones" | "inscritas";

const VISTA_CONFIG: Record<TramitadorVista, { label: string; estado?: string }> = {
  todas: { label: "Todas" },
  "en-tramite": { label: "En trámite", estado: "EN_TRAMITE" },
  subsanaciones: { label: "Subsanaciones", estado: "SUBSANACION" },
  presentaciones: { label: "Presentaciones", estado: "PRESENTADA" },
  inscritas: { label: "Inscritas", estado: "INSCRITA" },
};

const ESTADO_TO_VISTA: Record<string, TramitadorVista> = {
  EN_TRAMITE: "en-tramite",
  SUBSANACION: "subsanaciones",
  PRESENTADA: "presentaciones",
  INSCRITA: "inscritas",
};

const STATUS_TONE: Record<string, string> = {
  BORRADOR:    "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]",
  PREPARADA:   "bg-[var(--status-info)] text-[var(--g-text-inverse)]",
  PRESENTADA:  "bg-[var(--status-info)] text-[var(--g-text-inverse)]",
  EN_TRAMITE:  "bg-[var(--status-info)] text-[var(--g-text-inverse)]",
  SUBSANACION: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  INSCRITA:    "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  ELEVADA:     "bg-[var(--status-success)] text-[var(--g-text-inverse)]", // ITEM-102
  DENEGADA:    "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
};

function registryRef(f: FilingRow): string {
  const refs = [
    f.borme_ref && `BORME: ${f.borme_ref}`,
    f.psm_ref && `PSM: ${f.psm_ref}`,
    f.siger_ref && `SIGER: ${f.siger_ref}`,
    f.conservatoria_ref && `CONSERV.: ${f.conservatoria_ref}`,
    f.jucerja_ref && `JUCERJA: ${f.jucerja_ref}`,
    f.diario_oficial_ref && `D.O.: ${f.diario_oficial_ref}`,
  ].filter(Boolean);
  return refs.length > 0 ? refs.join(" · ") : "—";
}

export default function TramitadorLista() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const scope = useSecretariaScope();
  const scopedEntityId = scope.mode === "sociedad" ? scope.selectedEntity?.id ?? null : null;
  const { data, isLoading } = useTramitacionesList(scopedEntityId);
  const requestedEstado = searchParams.get("estado") ?? "";
  const activeVista: TramitadorVista = ESTADO_TO_VISTA[requestedEstado] ?? "todas";
  const activeEstado = VISTA_CONFIG[activeVista].estado;
  const rows = (data ?? []).filter((filing) => !activeEstado || filing.status === activeEstado);

  function setVista(next: TramitadorVista) {
    const params = new URLSearchParams(searchParams);
    const estado = VISTA_CONFIG[next].estado;
    if (estado) params.set("estado", estado);
    else params.delete("estado");
    setSearchParams(params, { replace: true });
  }

  function startFromAgreement() {
    const handoff = pickTemplateHandoffSearchParams(searchParams);
    const target = buildUrlWithSearchParams("/secretaria/tramitador/nuevo", handoff);
    navigate(scope.createScopedTo(target));
  }

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
            <Gavel className="h-3.5 w-3.5" />
            Secretaría · Tramitador registral
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
            Tramitaciones registrales
          </h1>
          <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
            Elevación a público, presentación en BORME / PSM / SIGER / JUCERJA / CONSERVATORIA y
            seguimiento de subsanaciones. La tramitación se inicia desde un acuerdo o certificación
            inscribible, nunca como expediente libre.
          </p>
        </div>
        <button
          type="button"
          onClick={startFromAgreement}
          className="inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <Plus className="h-4 w-4" />
          Iniciar desde acuerdo
        </button>
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

      <div className="mb-4 flex flex-wrap gap-2" aria-label="Vistas del tramitador registral">
        {(Object.keys(VISTA_CONFIG) as TramitadorVista[]).map((key) => {
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
              {VISTA_CONFIG[key].label}
            </button>
          );
        })}
      </div>

      <div
        className="overflow-hidden border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <table className="w-full">
          <thead>
            <tr className="bg-[var(--g-surface-subtle)]">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Nº presentación
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Vía
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Registro destino
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Fecha
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Estado
              </th>
              {/* Audit #6: affordance explícito de cross-link al Acuerdo 360 */}
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Acuerdo 360
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--g-border-subtle)]">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-sm text-[var(--g-text-secondary)]">
                  Cargando…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                    <FolderOpen className="h-12 w-12 text-[var(--g-text-secondary)]/40 mb-3" />
                    <p className="text-sm font-medium text-[var(--g-text-secondary)]">
                      {activeVista === "todas" ? "Sin tramitaciones registradas." : "Sin tramitaciones para esta vista."}
                    </p>
                    <p className="text-xs text-[var(--g-text-secondary)]/70 mt-1">
                      Inicia el proceso desde un acuerdo o certificación inscribible con origen trazable.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((f) => {
                const detailPath = scope.createScopedTo(`/secretaria/tramitador/${f.id}`);
                return (
                <tr
                  key={f.id}
                  onClick={() => navigate(detailPath)}
                  className="cursor-pointer transition-colors hover:bg-[var(--g-surface-subtle)]/50"
                >
                  <td className="px-6 py-4 text-sm font-medium">
                    <Link
                      to={detailPath}
                      onClick={(event) => event.stopPropagation()}
                      className="text-[var(--g-link)] hover:text-[var(--g-link-hover)]"
                    >
                      {f.filing_number ?? "s/n"}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">
                    {f.filing_via ?? "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">
                    {registryRef(f)}
                  </td>
                  <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">
                    {f.presentation_date ? new Date(f.presentation_date).toLocaleDateString("es-ES") : "—"}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium ${
                        STATUS_TONE[f.status] ?? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
                      }`}
                      style={{ borderRadius: "var(--g-radius-sm)" }}
                    >
                      {statusLabel(f.status)}
                    </span>
                  </td>
                  {/* Audit #6: cross-link explícito y estable al Acuerdo 360 origen */}
                  <td className="px-6 py-4 text-sm">
                    {f.agreement_id ? (
                      <Link
                        to={scope.createScopedTo(`/secretaria/acuerdos/${f.agreement_id}`)}
                        onClick={(event) => event.stopPropagation()}
                        className="text-[var(--g-link)] hover:text-[var(--g-link-hover)]"
                        data-testid="tramitador-acuerdo-link"
                      >
                        Ver Acuerdo 360
                      </Link>
                    ) : (
                      <span className="text-[var(--g-text-secondary)]">—</span>
                    )}
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
