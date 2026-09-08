import { Link } from "react-router-dom";
import { ArrowRight, ListChecks } from "lucide-react";
import { useCuestionariosVigentesDelTenant } from "@/hooks/useAimsClasificacion";
import { ETIQUETA_PERFIL, type PerfilCatalogo } from "@/lib/aims/cuestionario-calificacion";

export interface ClasificacionGuiadaCardProps {
  /** El inventario YA filtrado por ámbito: se cuenta contra lo que la pantalla enseña. */
  systems: { id: string }[];
}

const PERFILES: PerfilCatalogo[] = ["PROFILE_A", "PROFILE_B", "PROFILE_C"];

/**
 * Cuántos sistemas del inventario tienen clasificación guiada vigente.
 *
 * Se cuenta por intersección con el inventario, no por el total de la tabla: un
 * cuestionario de un sistema que el ámbito no muestra no clasifica nada de lo
 * que hay en pantalla. Y sin inventario —o si la consulta no llega— no se pinta
 * un 0: se dice que no consta, mismo criterio que las KPI.
 */
export function ClasificacionGuiadaCard({ systems }: ClasificacionGuiadaCardProps) {
  const { data: vigentes = [], isLoading, isError } = useCuestionariosVigentesDelTenant();

  const enInventario = new Set(systems.map((s) => s.id));
  const delInventario = vigentes.filter((v) => enInventario.has(v.system_id));
  const clasificados = new Set(delInventario.map((v) => v.system_id));
  const noConsta = systems.length === 0 || isError;

  const porPerfil = PERFILES.map((perfil) => ({
    perfil,
    total: delInventario.filter((v) => v.catalog_profile === perfil).length,
  }));
  const sinPerfil = delInventario.filter(
    (v) => !v.catalog_profile || !PERFILES.includes(v.catalog_profile as PerfilCatalogo),
  ).length;

  return (
    <Link
      to="/ai-governance/sistemas"
      className="mb-6 block border border-[var(--g-border-default)] bg-[var(--g-surface-card)] p-5 transition-colors hover:border-[var(--g-brand-3308)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center bg-[var(--g-surface-subtle)] text-[var(--g-brand-3308)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <ListChecks className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">Clasificación guiada</h2>
            <p className="mt-1 text-xs leading-relaxed text-[var(--g-text-secondary)]">
              Rol regulatorio y nivel de riesgo derivados del cuestionario, no escritos a mano.
            </p>
          </div>
        </div>
        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[var(--g-text-secondary)]" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <div
            className={`text-2xl font-bold ${
              noConsta ? "text-[var(--g-text-secondary)]" : "text-[var(--status-info)]"
            }`}
          >
            {noConsta ? "—" : isLoading ? "…" : clasificados.size}
          </div>
          <div className="mt-0.5 text-xs font-medium text-[var(--g-text-primary)]">Con clasificación vigente</div>
        </div>
        <div>
          <div
            className={`text-2xl font-bold ${
              noConsta ? "text-[var(--g-text-secondary)]" : "text-[var(--g-text-primary)]"
            }`}
          >
            {noConsta ? "—" : isLoading ? "…" : systems.length - clasificados.size}
          </div>
          <div className="mt-0.5 text-xs font-medium text-[var(--g-text-primary)]">Sin clasificar por cuestionario</div>
        </div>
        <div className="col-span-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--g-text-secondary)]">
            Perfil del catálogo aplicado
          </div>
          {noConsta || isLoading ? (
            <p className="mt-1 text-xs text-[var(--g-text-secondary)]">No consta</p>
          ) : (
            <ul className="mt-1 space-y-0.5">
              {porPerfil.map(({ perfil, total }) => (
                <li key={perfil} className="text-xs text-[var(--g-text-secondary)]">
                  <span className="font-semibold text-[var(--g-text-primary)]">{total}</span>{" "}
                  {ETIQUETA_PERFIL[perfil]}
                </li>
              ))}
              {sinPerfil > 0 && (
                <li className="text-xs text-[var(--g-text-secondary)]">
                  <span className="font-semibold text-[var(--g-text-primary)]">{sinPerfil}</span> sin perfil declarado
                </li>
              )}
            </ul>
          )}
        </div>
      </div>

      {noConsta && (
        <p className="mt-3 text-xs text-[var(--g-text-secondary)]">
          {systems.length === 0
            ? "Sin inventario con que contarlo."
            : "La clasificación guiada no se ha podido leer: no consta, no es un cero."}
        </p>
      )}
    </Link>
  );
}
