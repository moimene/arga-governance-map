/**
 * Qué catálogo se está midiendo, y por qué ése.
 *
 * El perfil se declara donde se evalúa: es lo que explica por qué hay 43
 * medidas y no 84, y de qué norma sale cada una. El criterio NO vive aquí —lo
 * calcula `perfilAplicable` en `@/lib/aims/perfil-aplicabilidad` y llega por
 * props—; este componente sólo lo pinta.
 *
 * Tres avisos, de más a menos grave:
 *   1. Sin clasificación guiada: el sistema no ha pasado el cuestionario, así
 *      que se mide contra el catálogo completo. Es fail-open declarado, no un
 *      resultado: medir de más y decirlo es conservador; medir de menos por un
 *      dato que falta esconde obligaciones.
 *   2. Cobertura provisional: el catálogo no lo ha validado el Comité de IA.
 *   3. El motivo del perfil, que es el que dice qué obligaciones vinculan.
 */
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { ETIQUETA_PERFIL, type PerfilCatalogo } from "@/lib/aims/cuestionario-calificacion";
import { AVISO_COBERTURA_PROVISIONAL } from "@/lib/aims/perfil-aplicabilidad";

/** Lo que la pantalla necesita del perfil. `PerfilAplicabilidad` lo cumple. */
export type PerfilPintable = {
  etiqueta: string;
  motivo: string;
  provisional: boolean;
  sinRolDeclarado: boolean;
  catalogProfile: PerfilCatalogo | null;
};

export type PerfilAplicabilidadBannerProps = {
  perfil: PerfilPintable;
  /** Cuántas medidas trae el catálogo aplicado. */
  totalMedidas: number;
  /** El sistema seleccionado, para saber si trae clasificación guiada. */
  sistema?: { id: string; regulatory_profile?: Record<string, unknown> | null } | null;
};

export default function PerfilAplicabilidadBanner({
  perfil,
  totalMedidas,
  sistema,
}: PerfilAplicabilidadBannerProps) {
  // La clave `cuestionario_id` la escribe la RPC del cuestionario guiado en
  // `ai_systems.regulatory_profile`: un sistema clasificado antes del
  // cuestionario —o sin clasificar— no la tiene.
  const sinClasificacionGuiada = Boolean(sistema) && !sistema?.regulatory_profile?.cuestionario_id;

  return (
    <div
      className={`p-4 border-l-4 space-y-1.5 ${
        perfil.sinRolDeclarado || sinClasificacionGuiada
          ? "bg-[var(--g-surface-subtle)] border-[var(--status-warning)]"
          : "bg-[var(--g-surface-subtle)] border-[var(--g-brand-3308)]"
      }`}
      style={{ borderRadius: "var(--g-radius-md)" }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-[var(--g-text-primary)]">
          Perfil de aplicabilidad: {perfil.etiqueta}
        </span>
        <span className="text-xs text-[var(--g-text-secondary)]">{totalMedidas} medidas</span>
        {perfil.catalogProfile && (
          <span
            className="px-2 py-0.5 text-[10px] font-bold bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]"
            style={{ borderRadius: "var(--g-radius-full)" }}
          >
            {ETIQUETA_PERFIL[perfil.catalogProfile]}
          </span>
        )}
        {perfil.provisional && (
          <span
            className="px-2 py-0.5 text-[10px] font-bold bg-[var(--status-warning)] text-[var(--g-text-inverse)]"
            style={{ borderRadius: "var(--g-radius-full)" }}
          >
            {AVISO_COBERTURA_PROVISIONAL}
          </span>
        )}
      </div>

      {sinClasificacionGuiada && sistema && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <AlertTriangle className="w-3.5 h-3.5 text-[var(--status-warning)]" />
          <span className="font-semibold text-[var(--g-text-primary)]">
            Sin clasificación guiada — catálogo completo por defecto
          </span>
          <Link
            to={`/ai-governance/sistemas/${sistema.id}`}
            className="underline text-[var(--g-link)] hover:text-[var(--g-link-hover)]"
          >
            Clasificar desde la ficha del sistema
          </Link>
        </div>
      )}

      <p className="text-xs text-[var(--g-text-secondary)] leading-relaxed">{perfil.motivo}</p>
    </div>
  );
}
