import { ETIQUETA_PERFIL, type ResultadoCuestionario } from "@/lib/aims/cuestionario-calificacion";
import { ETIQUETA_ROL, type RolRegulatorio } from "@/lib/aims/rol-regulatorio";
import { claseNivelRiesgo, etiqueta } from "@/lib/aims/vocabulario";

/**
 * Lo que quedó confirmado, en fijo, mientras se termina de rellenar el alta.
 *
 * No decide nada ni recalcula: pinta el `resultado` que derivó la hoja. Volver
 * a clasificar lo descarta y devuelve el stepper con las respuestas dentro.
 */
export default function ResumenClasificacionConfirmada({
  resultado,
  onVolverAClasificar,
}: {
  resultado: ResultadoCuestionario;
  onVolverAClasificar: () => void;
}) {
  return (
    <div
      className="space-y-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-4"
      style={{ borderRadius: "var(--g-radius-md)" }}
    >
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--g-text-primary)]">
        <span className="font-semibold">
          {resultado.rol ? ETIQUETA_ROL[resultado.rol as RolRegulatorio] ?? resultado.rol : "Rol pendiente"}
        </span>
        {resultado.nivel && (
          <span
            className={`px-2 py-0.5 text-xs ${claseNivelRiesgo(resultado.nivel)}`}
            style={{ borderRadius: "var(--g-radius-full)" }}
          >
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
      <ul className="space-y-0.5 text-xs text-[var(--g-text-secondary)]">
        {resultado.marcos.map((m) => (
          <li key={m.code}>
            · {m.articulos} — {m.titulo}
            {m.nota && <span className="block pl-3">{m.nota}</span>}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onVolverAClasificar}
        className="inline-flex items-center justify-center border border-[var(--g-border-subtle)] bg-transparent px-4 py-2 text-sm font-medium text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)]"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        Volver a clasificar
      </button>
    </div>
  );
}
