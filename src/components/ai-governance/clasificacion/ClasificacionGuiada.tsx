import { useMemo, useState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import {
  ETIQUETA_PERFIL,
  MINIMO_MOTIVACION_ART63,
  PREGUNTAS,
  bloqueosParaConfirmar,
  preguntasVisibles,
  resultadoProvisional,
  type Respuestas,
  type ResultadoCuestionario,
} from "@/lib/aims/cuestionario-calificacion";
import { ETIQUETA_ROL, type RolRegulatorio } from "@/lib/aims/rol-regulatorio";
import { claseNivelRiesgo, etiqueta } from "@/lib/aims/vocabulario";
import PreguntaGuiada from "./PreguntaGuiada";
import ResultadoProvisional from "./ResultadoProvisional";

/**
 * Cuestionario guiado de calificación regulatoria, en cuatro fases.
 *
 * Esta pantalla NO decide nada: el rol, el nivel, los marcos y el perfil los
 * deriva `resultadoProvisional`, y lo que impide confirmar lo dice
 * `bloqueosParaConfirmar`. Aquí sólo se pinta y se navega. Si el criterio
 * viviera en el componente, corregirlo llegaría a esta pantalla y el alta, la
 * ficha y el informe seguirían diciendo lo contrario.
 *
 * El autosave no vive aquí tampoco: `onCambio` se dispara en cada cambio y
 * quien monta el componente decide si lo persiste y con qué retardo.
 */

export type ClasificacionConfirmada = {
  respuestas: Respuestas;
  justificacionArt63: string;
  resultado: ResultadoCuestionario;
};

export interface ClasificacionGuiadaProps {
  modo: "alta" | "reclasificacion";
  respuestasIniciales?: Respuestas;
  justificacionInicial?: string;
  tieneOwner: boolean;
  onCambio?: (respuestas: Respuestas, justificacionArt63: string) => void;
  onConfirmar: (c: ClasificacionConfirmada) => void | Promise<void>;
  onCancelar?: () => void;
  confirmando?: boolean;
}

const FASES = [
  { n: 1, label: "Rol" },
  { n: 2, label: "Riesgo" },
  { n: 3, label: "Marcos" },
  { n: 4, label: "Confirmación" },
] as const;

const TEXTO_BLOQUEO =
  "Este sistema realiza una práctica prohibida por el art. 5 del Reglamento. No puede registrarse.";
const TEXTO_ART63 =
  "Un proveedor que considere que un sistema del Anexo III no es de alto riesgo debe documentar su evaluación antes de introducirlo en mercado o ponerlo en servicio (art. 6.3 RIA).";

const BOTON_PRIMARIO =
  "px-4 py-2 text-sm font-semibold bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:opacity-50";
const BOTON_SECUNDARIO =
  "px-4 py-2 text-sm font-semibold border border-[var(--g-border-subtle)] text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)] disabled:opacity-50";

const CIRCULO: Record<string, string> = {
  hecha: "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  activa: "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]",
  pendiente: "border border-[var(--g-border-subtle)] text-[var(--g-text-secondary)]",
};
const ROTULO: Record<string, string> = {
  hecha: "font-medium text-[var(--status-success)]",
  activa: "font-semibold text-[var(--g-brand-3308)]",
  pendiente: "text-[var(--g-text-secondary)]",
};

function faseDe(id: string): number {
  return PREGUNTAS.find((p) => p.id === id)?.fase ?? 0;
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-xs font-semibold text-[var(--status-warning)]">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export default function ClasificacionGuiada({
  modo,
  respuestasIniciales,
  justificacionInicial,
  tieneOwner,
  onCambio,
  onConfirmar,
  onCancelar,
  confirmando,
}: ClasificacionGuiadaProps) {
  const [fase, setFase] = useState(1);
  const [respuestas, setRespuestas] = useState<Respuestas>(respuestasIniciales ?? {});
  const [justificacion, setJustificacion] = useState(justificacionInicial ?? "");

  const resultado = useMemo(() => resultadoProvisional(respuestas), [respuestas]);
  const { bloqueos, avisos } = bloqueosParaConfirmar(respuestas, justificacion, tieneOwner);

  const aplicar = (r: Respuestas, j: string) => {
    setRespuestas(r);
    setJustificacion(j);
    onCambio?.(r, j);
  };

  const visiblesDeFase = (f: number) => preguntasVisibles(respuestas).filter((p) => p.fase === f);
  const pendientesDeFase = (f: number) => resultado.pendientes.filter((id) => faseDe(id) === f);
  const puedeAvanzar = !resultado.bloqueado && (fase >= 3 || pendientesDeFase(fase).length === 0);

  const motivacionArt63 = resultado.exigeArt63 && (
    <div
      className="space-y-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-3"
      style={{ borderRadius: "var(--g-radius-md)" }}
    >
      <Aviso>{TEXTO_ART63}</Aviso>
      <label htmlFor="art63-motivacion" className="block text-xs font-semibold text-[var(--g-text-primary)]">
        Motivación de la evaluación *
      </label>
      <textarea
        id="art63-motivacion"
        rows={4}
        value={justificacion}
        onChange={(e) => aplicar(respuestas, e.target.value)}
        placeholder="Por qué este sistema concreto no genera un riesgo real para la salud, la seguridad o los derechos de las personas."
        className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-2 text-sm text-[var(--g-text-primary)] focus:border-[var(--g-brand-3308)] focus:outline-none"
        style={{ borderRadius: "var(--g-radius-md)" }}
      />
      <p className="text-xs text-[var(--g-text-secondary)]">
        {justificacion.trim().length} / {MINIMO_MOTIVACION_ART63} caracteres mínimos. Queda
        registrada y puede ser revisada por la autoridad competente.
      </p>
    </div>
  );

  return (
    <section
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <ol className="flex flex-wrap items-center gap-4 border-b border-[var(--g-border-subtle)] px-4 py-3">
        {FASES.map((f) => {
          const e = f.n < fase ? "hecha" : f.n === fase ? "activa" : "pendiente";
          return (
            <li key={f.n} className="flex items-center gap-1.5 text-xs" aria-current={e === "activa" ? "step" : undefined}>
              <span
                className={`flex h-5 w-5 items-center justify-center text-[11px] font-semibold ${CIRCULO[e]}`}
                style={{ borderRadius: "var(--g-radius-full)" }}
              >
                {e === "hecha" ? <Check className="h-3 w-3" /> : f.n}
              </span>
              <span className={ROTULO[e]}>{f.label}</span>
            </li>
          );
        })}
      </ol>

      {resultado.bloqueado && (
        <div
          role="alert"
          className="mx-4 mt-4 border border-[var(--status-error)] p-3 text-sm font-semibold text-[var(--status-error)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          {TEXTO_BLOQUEO}
        </div>
      )}

      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-3">
          {(fase === 1 || fase === 2) &&
            visiblesDeFase(fase).map((p) => (
              <PreguntaGuiada
                key={p.id}
                pregunta={p}
                valor={respuestas[p.id]}
                onChange={(v) => aplicar({ ...respuestas, [p.id]: v }, justificacion)}
              />
            ))}

          {fase === 2 && motivacionArt63}

          {fase === 3 && (
            <div className="space-y-2">
              <p className="text-xs text-[var(--g-text-secondary)]">
                Marcos que resultan de las respuestas anteriores. No se eligen: se derivan.
              </p>
              {resultado.marcos.map((m) => (
                <div
                  key={m.code}
                  className="border border-[var(--g-border-subtle)] p-3"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <p className="text-sm font-semibold text-[var(--g-text-primary)]">
                    {m.articulos} — {m.titulo}
                  </p>
                  {m.nota && <p className="mt-1 text-xs text-[var(--g-text-secondary)]">{m.nota}</p>}
                </div>
              ))}
            </div>
          )}

          {fase === 4 && (
            <div className="space-y-3">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--g-text-primary)]">
                <span className="font-semibold">
                  {resultado.rol ? ETIQUETA_ROL[resultado.rol as RolRegulatorio] ?? resultado.rol : "Pendiente"}
                </span>
                {resultado.nivel && (
                  <span className={`px-2 py-0.5 text-xs ${claseNivelRiesgo(resultado.nivel)}`} style={{ borderRadius: "var(--g-radius-full)" }}>
                    {etiqueta("nivel", resultado.nivel)}
                  </span>
                )}
                <span className="font-semibold">
                  {resultado.perfil ? ETIQUETA_PERFIL[resultado.perfil] : "Perfil pendiente"}
                </span>
                <span className="text-[var(--g-text-secondary)]">
                  Modelo de uso general: {resultado.gpai ? "Sí" : "No"}
                </span>
              </p>
              <p className="text-xs text-[var(--g-text-secondary)]">
                {resultado.motivoRol} {resultado.motivoNivel}
              </p>
              <ul className="space-y-0.5 text-xs text-[var(--g-text-secondary)]">
                {resultado.marcos.map((m) => (
                  <li key={m.code}>
                    · {m.articulos} — {m.titulo}
                    {m.nota && <span className="block pl-3">{m.nota}</span>}
                  </li>
                ))}
              </ul>
              {motivacionArt63}
              {avisos.map((a) => (
                <Aviso key={a}>{a}</Aviso>
              ))}
            </div>
          )}
        </div>

        <ResultadoProvisional resultado={resultado} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--g-border-subtle)] p-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setFase((f) => Math.max(1, f - 1))}
            disabled={fase === 1}
            className={BOTON_SECUNDARIO}
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Volver
          </button>
          {onCancelar && (
            <button type="button" onClick={onCancelar} className={BOTON_SECUNDARIO} style={{ borderRadius: "var(--g-radius-md)" }}>
              Cancelar
            </button>
          )}
        </div>
        {fase < 4 ? (
          <button
            type="button"
            onClick={() => setFase((f) => Math.min(4, f + 1))}
            disabled={!puedeAvanzar}
            className={BOTON_PRIMARIO}
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Continuar
          </button>
        ) : (
          <div className="space-y-2 text-right">
            <button
              type="button"
              onClick={() => onConfirmar({ respuestas, justificacionArt63: justificacion, resultado })}
              disabled={bloqueos.length > 0 || confirmando}
              aria-busy={confirmando}
              className={BOTON_PRIMARIO}
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              {modo === "reclasificacion" ? "Confirmar nueva clasificación" : "Confirmar clasificación"}
            </button>
            {bloqueos.length > 0 && (
              <ul role="alert" className="space-y-1 text-xs text-[var(--status-error)]">
                {bloqueos.map((b) => (
                  <li key={b}>· {b}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
