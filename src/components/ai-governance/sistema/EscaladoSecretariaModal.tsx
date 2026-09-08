import { useState } from "react";
import { Send, X } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useBodiesList } from "@/hooks/useBodies";
import { buildMeetingHandoffPath } from "@/lib/secretaria/cross-module-handoff";
import type { AiSystem } from "@/hooks/useAiSystems";

/**
 * Escalado a Secretaría: handoff read-only, no escribe nada.
 *
 * El órgano destino sale de `governing_bodies` del tenant y NO se preselecciona
 * —`bodies[0]` es el primero que devuelve la consulta, no una elección—, y la
 * justificación nace vacía: el prerrelleno anterior encuadraba la propuesta
 * «bajo el marco RIA / AESIA» y ese texto VIAJABA al expediente de Secretaría
 * como `rationale`.
 */

export interface EscaladoSecretariaModalProps {
  system: AiSystem;
  onClose: () => void;
}

export default function EscaladoSecretariaModal({ system, onClose }: EscaladoSecretariaModalProps) {
  const navigate = useNavigate();
  const { data: bodies = [] } = useBodiesList();
  const [materia, setMateria] = useState(
    `Propuesta de aprobación del Expediente Técnico para el Sistema de IA: ${system.name}`,
  );
  const [organo, setOrgano] = useState("");
  const [justificacion, setJustificacion] = useState("");

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
          organ: organo || null,
          matter: materia,
          rationale: justificacion,
        }),
      );
    } catch (err) {
      console.error(err);
      toast.error("Error al preparar el handoff de escalado");
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
          <div>
            <label htmlFor="aims-escalate-body" className="block font-semibold text-[var(--g-text-primary)] mb-1">
              Órgano de Gobierno Destino
            </label>
            <select
              id="aims-escalate-body"
              value={organo}
              onChange={(e) => setOrgano(e.target.value)}
              disabled={bodies.length === 0}
              className="w-full h-9 px-3 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)] disabled:opacity-60"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <option value="">Sin órgano indicado</option>
              {bodies.map((b) => (
                <option key={b.id} value={b.name}>
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
              onChange={(e) => setMateria(e.target.value)}
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
