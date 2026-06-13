import { ShieldCheck, AlertTriangle } from "lucide-react";
import { useAutorizacionesRegulatorias } from "@/hooks/useAutorizacionesRegulatorias";
import { evaluarAutorizacionesRegulatorias } from "@/lib/secretaria/autorizaciones-regulatorias";

/**
 * W7 — surface read-only del gate de autorizaciones regulatorias sectoriales
 * (G13). Muestra, para el acto del expediente, qué autorizaciones de supervisor
 * (DGSFP…) exige la materia en una entidad regulada y su estado (presente /
 * faltante / caducada). No bloquea (el enforcement como hard-block es trabajo
 * futuro); informa, igual que la card de pactos parasociales.
 *
 * Se oculta si la materia/entidad no exige ninguna autorización.
 */
export function AutorizacionesRegulatoriasCard({
  entityId,
  materia,
}: {
  entityId: string | null;
  materia: string;
}) {
  const { data } = useAutorizacionesRegulatorias(entityId);
  if (!entityId || !data) return null;

  const esEntidadRegulada = data.esCotizada || !!data.regulatedSector;
  const res = evaluarAutorizacionesRegulatorias({
    materia,
    esEntidadRegulada,
    sectorRegulado: data.regulatedSector,
    jurisdiccion: data.jurisdiction ?? "ES",
    autorizaciones: data.autorizaciones,
    hoyISO: new Date().toISOString(),
  });

  if (res.required.length === 0) return null;

  const pendiente = res.blocking;

  return (
    <div
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="mb-2 flex items-center gap-2">
        {pendiente ? (
          <AlertTriangle className="h-4 w-4 text-[var(--status-warning)]" aria-hidden="true" />
        ) : (
          <ShieldCheck className="h-4 w-4 text-[var(--status-success)]" aria-hidden="true" />
        )}
        <h3 className="text-sm font-semibold text-[var(--g-text-primary)]">
          Autorizaciones regulatorias sectoriales
        </h3>
      </div>
      <p className="mb-3 text-xs text-[var(--g-text-secondary)]">
        Esta materia, en una entidad regulada, exige autorización previa del supervisor antes de
        inscribir el acuerdo. Estado informativo (no bloqueante en esta versión).
      </p>
      <ul className="space-y-1.5">
        {res.required.map((org) => {
          const estado = res.present.includes(org)
            ? { txt: "Vigente", cls: "text-[var(--status-success)]" }
            : res.expired.includes(org)
              ? { txt: "Caducada / revocada", cls: "text-[var(--status-warning)]" }
              : { txt: "Falta", cls: "text-[var(--status-error)]" };
          return (
            <li key={org} className="flex items-center justify-between text-sm">
              <span className="font-medium text-[var(--g-text-primary)]">{org}</span>
              <span className={`text-xs font-medium ${estado.cls}`}>{estado.txt}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
