import { useEffect, useState } from "react";
import { Send, X } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useBodiesByEntity, useBodiesList } from "@/hooks/useBodies";
import { buildMeetingHandoffPath } from "@/lib/secretaria/cross-module-handoff";
import { useAiSystemRiaSubject, type AiSystem } from "@/hooks/useAiSystems";
import { defaultEscaladoMatter } from "@/lib/aims/sujeto-escalado";

/**
 * Escalado a Secretaría: handoff read-only, no escribe nada.
 *
 * F2.T14 (MOI-170): el órgano se resuelve por SOCIEDAD cuando el sistema
 * tiene sujeto RIA conocido (`aims_ria_subjects`, F2.T2) — solo órganos que
 * ADOPTAN (`adoptingOnly`), no los consultivos. Sin sujeto conocido (hoy, la
 * mayoría — F2.T16 los siembra) cae al listado completo del tenant, igual
 * que antes: no es una regresión, es el mismo comportamiento cuando no hay
 * de dónde acotar. `organo` sigue siendo el NOMBRE elegido (texto libre, lo
 * que ya viajaba); `organoId` viaja ADEMÁS, por id — no la sustituye, para no
 * tocar la semántica de los emisores no-AIMS (GRC) que mandan `organ` como
 * texto libre. Ninguno de los dos se preselecciona —el primero de la lista
 * no es una elección—, y la justificación nace vacía: el prerrelleno
 * anterior encuadraba la propuesta «bajo el marco RIA / AESIA» y ese texto
 * VIAJABA al expediente de Secretaría como `rationale`.
 */

export interface EscaladoSecretariaModalProps {
  system: AiSystem;
  onClose: () => void;
}

export default function EscaladoSecretariaModal({ system, onClose }: EscaladoSecretariaModalProps) {
  const navigate = useNavigate();
  const { data: subject } = useAiSystemRiaSubject(system.id);
  const { data: bodiesByEntity = [] } = useBodiesByEntity(subject?.entityId, { adoptingOnly: true });
  const { data: bodiesAllTenant = [] } = useBodiesList();
  const bodies = subject?.entityId ? bodiesByEntity : bodiesAllTenant;
  const [materia, setMateria] = useState(() => defaultEscaladoMatter(system.name, null));
  const [materiaTocada, setMateriaTocada] = useState(false);
  const [organoId, setOrganoId] = useState("");
  const [justificacion, setJustificacion] = useState("");

  // El sujeto llega asíncrono (query aparte): si el usuario no ha tocado la
  // materia todavía, refleja el sujeto en cuanto resuelve. No pisa un texto
  // que la persona ya editó a mano.
  useEffect(() => {
    if (materiaTocada || !subject) return;
    setMateria(defaultEscaladoMatter(system.name, subject));
  }, [subject, materiaTocada, system.name]);

  const organoSeleccionado = bodies.find((b) => b.id === organoId) ?? null;

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      onClose();
      toast.success("Abriendo intake de Secretaría con la propuesta...");
      navigate(
        buildMeetingHandoffPath({
          source: "aims",
          event: "AIMS_SYSTEM_CONFORMITY",
          sourceId: system.id,
          organ: organoSeleccionado?.name ?? null,
          organId: organoSeleccionado?.id ?? null,
          entityId: subject?.entityId ?? null,
          matter: materia,
          rationale: justificacion,
        }),
      );
    } catch (err) {
      console.error(err);
      toast.error("Error al preparar la derivación a Secretaría");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <form
        onSubmit={enviar}
        className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] w-full max-w-lg p-6 space-y-4 shadow-2xl"
        style={{ borderRadius: "var(--g-radius-lg)" }}
      >
        <div className="flex items-center justify-between border-b border-[var(--g-border-subtle)] pb-3">
          <div className="flex items-center gap-2">
            <Send className="w-5 h-5 text-[var(--g-brand-3308)]" />
            <h3 className="text-base font-bold text-[var(--g-text-primary)]">
              Escalar Asunto a Secretaría Societaria
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="text-[var(--g-text-secondary)] hover:text-[var(--g-text-primary)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-[var(--g-text-secondary)]">
          Genera una propuesta formal para incorporar la aprobación del expediente técnico de este sistema de IA
          en el orden del día del órgano que se indique. No convoca ni acuerda nada: abre el intake de Secretaría
          con los datos precargados.
        </p>

        <div className="space-y-3 text-xs">
          {subject?.entityName && (
            <p className="text-[11px] text-[var(--g-text-secondary)]">
              Sociedad: <span className="font-medium text-[var(--g-text-primary)]">{subject.entityName}</span>
            </p>
          )}

          <div>
            <label htmlFor="aims-escalate-body" className="block font-semibold text-[var(--g-text-primary)] mb-1">
              Órgano de Gobierno Destino
            </label>
            <select
              id="aims-escalate-body"
              value={organoId}
              onChange={(e) => setOrganoId(e.target.value)}
              disabled={bodies.length === 0}
              className="w-full h-9 px-3 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)] disabled:opacity-60"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <option value="">Sin órgano indicado</option>
              {bodies.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            {bodies.length === 0 && (
              <p className="mt-1 text-[11px] text-[var(--g-text-secondary)]">
                Este entorno no tiene órganos de gobierno registrados: la propuesta
                se envía a Secretaría sin órgano destino.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="aims-escalate-matter" className="block font-semibold text-[var(--g-text-primary)] mb-1">
              Materia / Título de la Propuesta
            </label>
            <input
              id="aims-escalate-matter"
              type="text"
              required
              value={materia}
              onChange={(e) => {
                setMateriaTocada(true);
                setMateria(e.target.value);
              }}
              className="w-full h-9 px-3 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
          </div>

          <div>
            <label htmlFor="aims-escalate-rationale" className="block font-semibold text-[var(--g-text-primary)] mb-1">
              Justificación y Rationale
            </label>
            <textarea
              id="aims-escalate-rationale"
              rows={3}
              value={justificacion}
              placeholder="Motivo de la propuesta. Este texto viaja al intake de Secretaría."
              onChange={(e) => setJustificacion(e.target.value)}
              className="w-full p-2.5 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-[var(--g-border-subtle)]">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 border border-[var(--g-border-subtle)] text-[var(--g-text-secondary)] hover:bg-[var(--g-surface-subtle)] text-xs font-medium"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-4 py-1.5 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] text-xs font-medium"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Crear Propuesta en Secretaría
          </button>
        </div>
      </form>
    </div>
  );
}
