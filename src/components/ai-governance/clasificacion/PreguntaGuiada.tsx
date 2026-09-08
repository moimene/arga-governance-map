import { useState } from "react";
import { HelpCircle } from "lucide-react";
import type { PreguntaGuiada as Pregunta } from "@/lib/aims/cuestionario-calificacion";

/**
 * Una pregunta del cuestionario guiado, con su ayuda al lado.
 *
 * Ni el enunciado ni la ayuda se escriben aquí: vienen de
 * `src/lib/aims/cuestionario-calificacion.ts`, que es donde están versionadas.
 * Un cuestionario persistido guarda su `questionnaire_version`, así que el día
 * que cambie una pregunta el histórico sigue siendo interpretable — eso sólo
 * se sostiene si el texto vive en un único sitio.
 *
 * El panel de ayuda arranca colapsado: quien ya sabe responder no tiene que
 * leer tres párrafos, y quien no, tiene el botón a la vista.
 */

const BOTON_BASE =
  "px-3 py-1.5 text-xs font-semibold transition-colors";

export default function PreguntaGuiada({
  pregunta,
  valor,
  onChange,
}: {
  pregunta: Pregunta;
  valor: boolean | undefined;
  onChange: (v: boolean) => void;
}) {
  const [ayudaAbierta, setAyudaAbierta] = useState(false);
  const panelId = `ayuda-${pregunta.id}`;

  return (
    <div
      className="space-y-2 border border-[var(--g-border-subtle)] p-3"
      style={{ borderRadius: "var(--g-radius-md)" }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-xl space-y-0.5">
          <p className="text-sm text-[var(--g-text-primary)]">{pregunta.titulo}</p>
          <p className="text-xs text-[var(--g-text-secondary)]">{pregunta.articulo}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {[
            { v: true, l: "Sí" },
            { v: false, l: "No" },
          ].map((o) => (
            <button
              key={o.l}
              type="button"
              onClick={() => onChange(o.v)}
              aria-pressed={valor === o.v}
              className={`${BOTON_BASE} ${
                valor === o.v
                  ? "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]"
                  : "border border-[var(--g-border-subtle)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
              }`}
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              {o.l}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setAyudaAbierta((v) => !v)}
            aria-label="Ayuda con esta pregunta"
            aria-expanded={ayudaAbierta}
            aria-controls={panelId}
            className="flex h-8 w-8 items-center justify-center border border-[var(--g-border-subtle)] text-[var(--g-text-secondary)] transition-colors hover:bg-[var(--g-surface-subtle)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!ayudaAbierta && (
        <button
          type="button"
          onClick={() => setAyudaAbierta(true)}
          aria-expanded={false}
          aria-controls={panelId}
          className="text-xs font-medium text-[var(--g-link)] underline underline-offset-2 hover:text-[var(--g-link-hover)]"
        >
          Necesito ayuda con esta pregunta
        </button>
      )}

      <div
        id={panelId}
        hidden={!ayudaAbierta}
        className="space-y-2 bg-[var(--g-surface-subtle)] p-3 text-xs text-[var(--g-text-secondary)]"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        <div>
          <p className="font-semibold text-[var(--g-text-primary)]">¿Qué significa esto?</p>
          <p>{pregunta.ayuda.queSignifica}</p>
        </div>
        <div>
          <p className="font-semibold text-[var(--g-text-primary)]">Ejemplos</p>
          <ul className="list-disc space-y-0.5 pl-4">
            {pregunta.ayuda.ejemplos.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-semibold text-[var(--g-text-primary)]">¿Cómo saberlo?</p>
          <p>{pregunta.ayuda.comoSaberlo}</p>
        </div>
      </div>
    </div>
  );
}
