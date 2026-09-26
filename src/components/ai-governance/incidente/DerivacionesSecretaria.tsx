import { Link } from "react-router-dom";
import { FileCheck2 } from "lucide-react";
import { useAimsSecretariaDerivationsForIncident } from "@/hooks/useAimsSecretariaDerivations";

/**
 * MOI-56: consulta de retorno desde AIMS. Muestra qué reunión o acuerdo de
 * Secretaría resolvió este incidente -- SOLO LECTURA, no copia ni modifica el
 * acta ni el acuerdo (el link lleva al detalle real de Secretaría, esta
 * pantalla no renderiza su contenido). Sin filas, no se pinta nada: no hay
 * "0 derivaciones" que anunciar de más para un incidente que nunca se derivó.
 */
export default function DerivacionesSecretaria({ incidentId }: { incidentId: string }) {
  const { data: derivaciones = [] } = useAimsSecretariaDerivationsForIncident(incidentId);
  if (derivaciones.length === 0) return null;

  return (
    <div
      className="p-4 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] space-y-2"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--g-text-primary)]">
        <FileCheck2 className="h-4 w-4 text-[var(--g-brand-3308)]" />
        Seguimiento en Secretaría
      </h3>
      <ul className="space-y-1.5">
        {derivaciones.map((derivacion) => {
          const isMeeting = derivacion.target_meeting_id !== null;
          const to = isMeeting
            ? `/secretaria/reuniones/${derivacion.target_meeting_id}`
            : `/secretaria/acuerdos/${derivacion.target_agreement_id}`;
          const label = isMeeting
            ? `Reunión · ${derivacion.meetings?.status ?? "estado no disponible"}`
            : `Acuerdo · ${derivacion.agreements?.agreement_kind ?? "sin materia"} · ${derivacion.agreements?.status ?? "estado no disponible"}`;
          return (
            <li key={derivacion.id} className="text-sm">
              <Link
                to={to}
                className="font-medium text-[var(--g-brand-3308)] hover:underline"
              >
                {label}
              </Link>
              {derivacion.evidence_ref ? (
                <span className="ml-2 text-xs text-[var(--g-text-secondary)]">
                  Justificante: {derivacion.evidence_ref}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
