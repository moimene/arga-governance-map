import { AVISO_ROLES_NO_DERIVABLES, ETIQUETA_PERFIL, type ResultadoCuestionario } from "@/lib/aims/cuestionario-calificacion";
import { ETIQUETA_ROL, type RolRegulatorio } from "@/lib/aims/rol-regulatorio";
import { claseNivelRiesgo, etiqueta } from "@/lib/aims/vocabulario";

/**
 * Lo que el árbol deriva HASTA AHORA, visible mientras se contesta.
 *
 * No es el dictamen: es lo que sale de las respuestas dadas, y cambia con cada
 * una. Que se vea desde la primera pregunta —«Posible proveedor» en cuanto se
 * afirma haber creado el sistema— es lo que evita que alguien conteste ocho
 * preguntas y descubra al final que se le mide contra el catálogo equivocado.
 */

const PENDIENTE = "Pendiente";

function Fila({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-[var(--g-text-secondary)]">{rotulo}</p>
      <div className="text-sm font-semibold text-[var(--g-text-primary)]">{children}</div>
    </div>
  );
}

export default function ResultadoProvisional({ resultado }: { resultado: ResultadoCuestionario }) {
  const rol = resultado.rol
    ? ETIQUETA_ROL[resultado.rol as RolRegulatorio] ?? resultado.rol
    : PENDIENTE;
  const perfil = resultado.perfil ? ETIQUETA_PERFIL[resultado.perfil] : PENDIENTE;

  return (
    <aside
      className="space-y-3 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-4"
      style={{ borderRadius: "var(--g-radius-lg)" }}
      aria-label="Resultado provisional"
    >
      <h3 className="text-sm font-semibold text-[var(--g-text-primary)]">Resultado provisional</h3>

      <Fila rotulo="Rol probable">
        {resultado.rol === "PROVEEDOR" ? "Posible proveedor" : rol}
      </Fila>

      <Fila rotulo="Nivel probable">
        {resultado.nivel ? (
          <span
            className={`inline-block px-2 py-0.5 text-xs ${claseNivelRiesgo(resultado.nivel)}`}
            style={{ borderRadius: "var(--g-radius-full)" }}
          >
            {etiqueta("nivel", resultado.nivel)}
          </span>
        ) : (
          PENDIENTE
        )}
      </Fila>

      <Fila rotulo="Perfil probable">{perfil}</Fila>

      <p className="text-xs text-[var(--g-text-secondary)]">{AVISO_ROLES_NO_DERIVABLES}</p>

      <Fila rotulo="Modelo de uso general">{resultado.gpai ? "Sí" : "No"}</Fila>

      {resultado.pendientes.length > 0 && (
        <p className="text-xs text-[var(--g-text-secondary)]">
          Quedan {resultado.pendientes.length} preguntas por responder: lo anterior puede cambiar.
        </p>
      )}
    </aside>
  );
}
