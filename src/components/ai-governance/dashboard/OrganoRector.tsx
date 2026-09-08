import { Link } from "react-router-dom";
import { ArrowRight, UserCheck } from "lucide-react";

export interface OrganoRectorProps {
  /** Slug del órgano, tal como lo resolvió `aiGovernanceBodySlug(tenantId)` en la página. */
  slug: string;
  name: string;
}

/**
 * Enlace al órgano de gobierno de la IA del tenant.
 *
 * La ARISTA vive entre dos ficheros y así se prueba: la página resuelve el
 * órgano con `useBodyBySlug(aiGovernanceBodySlug(tenantId))` y sólo monta esto
 * cuando la consulta devuelve fila —un tenant sin órgano declarado no ve nada,
 * porque nadie se lo ha constituido—; aquí se pinta el enlace a su ficha.
 * `/organos/:id` resuelve por SLUG, no por UUID (`useBodyBySlug`).
 */
export function OrganoRector({ slug, name }: OrganoRectorProps) {
  return (
    <Link
      to={`/organos/${slug}`}
      className="mb-6 flex items-center gap-3 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-5 py-3 transition-colors hover:bg-[var(--g-surface-subtle)]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center bg-[var(--g-surface-subtle)] text-[var(--g-brand-3308)]"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        <UserCheck className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--g-brand-3308)]">
          Órgano de gobierno de la IA
        </span>
        <span className="block truncate text-sm font-medium text-[var(--g-text-primary)]">
          {name}
        </span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-[var(--g-text-secondary)]" />
    </Link>
  );
}
