import { Copy } from "lucide-react";
import { toast } from "sonner";
import { ETIQUETA_PERFIL, type PerfilCatalogo } from "@/lib/aims/cuestionario-calificacion";
import { ETIQUETA_ROL, type RolRegulatorio } from "@/lib/aims/rol-regulatorio";
import { claseNivelRiesgo, etiqueta } from "@/lib/aims/vocabulario";

/**
 * Historial de clasificaciones de un sistema.
 *
 * Una reclasificación no pisa a la anterior: la sustituye y las dos quedan. El
 * autor se muestra como identificador abreviado y no como nombre porque el
 * módulo no resuelve identidades — inventar aquí un nombre sería peor que no
 * ponerlo.
 */

export type CuestionarioResumen = {
  id: string;
  version: number;
  status: "DRAFT" | "COMPLETED" | "SUPERSEDED";
  completed_at: string | null;
  completed_by: string | null;
  content_hash: string | null;
  computed_role: string | null;
  computed_risk_level: string | null;
  catalog_profile: string | null;
  questionnaire_version: string;
};

const ETIQUETA_ESTADO: Record<CuestionarioResumen["status"], string> = {
  DRAFT: "Borrador",
  COMPLETED: "Vigente",
  SUPERSEDED: "Sustituida",
};

const CHIP_ESTADO: Record<CuestionarioResumen["status"], string> = {
  DRAFT: "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
  COMPLETED: "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  SUPERSEDED: "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
};

const TH = "px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]";
const TD = "px-3 py-2 text-sm text-[var(--g-text-secondary)] align-top";

function copiar(hash: string) {
  navigator.clipboard
    ?.writeText(hash)
    .then(() => toast.success("Huella copiada."))
    .catch(() => toast.error("No se pudo copiar la huella."));
}

export default function HistorialClasificaciones({
  cuestionarios,
}: {
  cuestionarios: CuestionarioResumen[];
}) {
  const filas = [...cuestionarios].sort((a, b) => b.version - a.version);

  if (filas.length === 0) {
    return (
      <p className="text-sm text-[var(--g-text-secondary)]">
        Este sistema no tiene ninguna clasificación guiada registrada.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr className="bg-[var(--g-surface-subtle)]">
            <th className={TH}>Versión</th>
            <th className={TH}>Estado</th>
            <th className={TH}>Fecha</th>
            <th className={TH}>Autor</th>
            <th className={TH}>Huella</th>
            <th className={TH}>Rol</th>
            <th className={TH}>Nivel</th>
            <th className={TH}>Perfil</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--g-border-subtle)]">
          {filas.map((c) => (
            <tr key={c.id}>
              <td className={TD}>
                <span className="font-semibold text-[var(--g-text-primary)]">v{c.version}</span>
                <span className="block text-xs">Cuestionario {c.questionnaire_version}</span>
              </td>
              <td className={TD}>
                <span
                  className={`inline-block px-2 py-0.5 text-xs ${CHIP_ESTADO[c.status]}`}
                  style={{ borderRadius: "var(--g-radius-full)" }}
                >
                  {ETIQUETA_ESTADO[c.status]}
                </span>
              </td>
              <td className={TD}>
                {c.completed_at ? new Date(c.completed_at).toLocaleString("es-ES") : "—"}
              </td>
              <td className={TD}>{c.completed_by ? `${c.completed_by.slice(0, 8)}…` : "—"}</td>
              <td className={TD}>
                {c.content_hash ? (
                  <span className="flex items-center gap-1.5">
                    <code className="text-xs">{c.content_hash.slice(0, 16)}</code>
                    <button
                      type="button"
                      onClick={() => copiar(c.content_hash!)}
                      aria-label="Copiar hash"
                      className="text-[var(--g-text-secondary)] transition-colors hover:text-[var(--g-brand-3308)]"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td className={TD}>
                {c.computed_role
                  ? ETIQUETA_ROL[c.computed_role as RolRegulatorio] ?? c.computed_role
                  : "—"}
              </td>
              <td className={TD}>
                {c.computed_risk_level ? (
                  <span
                    className={`inline-block px-2 py-0.5 text-xs ${claseNivelRiesgo(c.computed_risk_level)}`}
                    style={{ borderRadius: "var(--g-radius-full)" }}
                  >
                    {etiqueta("nivel", c.computed_risk_level)}
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td className={TD}>
                {c.catalog_profile
                  ? ETIQUETA_PERFIL[c.catalog_profile as PerfilCatalogo] ?? c.catalog_profile
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-[var(--g-text-secondary)]">
        Huella SHA-512 calculada en servidor: acredita integridad y autoría; no acredita fecha cierta.
      </p>
    </div>
  );
}
