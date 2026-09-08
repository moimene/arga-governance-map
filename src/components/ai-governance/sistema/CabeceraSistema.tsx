import { ChevronLeft, Cpu, Edit, FileCheck, Plus, Send } from "lucide-react";
import type { AiSystem } from "@/hooks/useAiSystems";
import type { AimsSystemVersion } from "@/hooks/useAimsTechnicalFile";
import { systemStatusChipClass, systemStatusLabel } from "@/lib/aims/readiness";
import { claseNivelRiesgo } from "@/lib/aims/vocabulario";
import { ETIQUETA_ROL, type RolRegulatorio } from "@/lib/aims/rol-regulatorio";

/**
 * Cabecera de la ficha de un sistema de IA: migas, barra de acciones y los
 * metadatos que salen de la fila.
 *
 * No decide nada. El chip de nivel, el de estado y la etiqueta del rol salen de
 * `@/lib/aims`, y las acciones son callbacks: las rutas viven en la página.
 */

export interface CabeceraSistemaProps {
  system: AiSystem;
  versionActual?: AimsSystemVersion | null;
  onVolver: () => void;
  onEditar: () => void;
  onNuevoAutodiagnostico: () => void;
  onDeclaracion: () => void;
  onEscalar: () => void;
}

const BOTON_SECUNDARIO =
  "flex items-center gap-1.5 px-3 py-1.5 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] text-xs font-medium transition-colors";

export default function CabeceraSistema({
  system,
  versionActual,
  onVolver,
  onEditar,
  onNuevoAutodiagnostico,
  onDeclaracion,
  onEscalar,
}: CabeceraSistemaProps) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={onVolver}
          className="flex items-center gap-1.5 text-xs text-[var(--g-text-secondary)] hover:text-[var(--g-brand-3308)] transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Inventario de Sistemas IA</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onEditar} className={BOTON_SECUNDARIO} style={{ borderRadius: "var(--g-radius-md)" }}>
            <Edit className="w-3.5 h-3.5" />
            <span>Editar Ficha</span>
          </button>
          <button
            type="button"
            onClick={onNuevoAutodiagnostico}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] text-xs font-medium transition-colors"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nuevo Autodiagnóstico</span>
          </button>
          <button
            type="button"
            onClick={onDeclaracion}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--g-surface-subtle)] border border-[var(--g-brand-3308)] text-[var(--g-brand-3308)] hover:bg-[var(--g-brand-3308)] hover:text-[var(--g-text-inverse)] text-xs font-medium transition-colors"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <FileCheck className="w-3.5 h-3.5" />
            <span>Declaración de Conformidad UE</span>
          </button>
          <button type="button" onClick={onEscalar} className={BOTON_SECUNDARIO} style={{ borderRadius: "var(--g-radius-md)" }}>
            <Send className="w-3.5 h-3.5" />
            <span>Escalar a Secretaría</span>
          </button>
        </div>
      </div>

      <div
        className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-6 space-y-4"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center bg-[var(--g-sec-100)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <Cpu className="h-6 w-6 text-[var(--g-brand-3308)]" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className="font-mono text-xs font-bold text-[var(--g-brand-3308)] bg-[var(--g-surface-subtle)] px-2 py-0.5"
                  style={{ borderRadius: "var(--g-radius-sm)" }}
                >
                  {system.aims_reference_code || `SYS-${system.id.slice(0, 8).toUpperCase()}`}
                </span>
                <span className="text-xs text-[var(--g-text-secondary)]">
                  Versión actual: {versionActual?.version_label || "sin versión registrada"}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-[var(--g-text-primary)]">{system.name}</h1>
              <p className="text-sm text-[var(--g-text-secondary)] max-w-2xl">{system.description}</p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <span
              className={`shrink-0 inline-flex items-center px-3 py-1 text-xs font-bold ${claseNivelRiesgo(system.risk_level)}`}
              style={{ borderRadius: "var(--g-radius-full)" }}
            >
              Riesgo {system.risk_level || "sin clasificar"}
            </span>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold ${systemStatusChipClass(system.status)}`}
              style={{ borderRadius: "var(--g-radius-full)" }}
            >
              {systemStatusLabel(system.status)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-[var(--g-border-subtle)] text-xs">
          <div>
            <span className="text-[var(--g-text-secondary)] block mb-0.5">Tipo de Sistema:</span>
            <span className="font-semibold text-[var(--g-text-primary)]">{system.system_type || "No declarado"}</span>
          </div>
          {/* El rol determina qué obligaciones aplican. Sin él, el
              autodiagnóstico mide contra el catálogo de un proveedor de alto
              riesgo aunque la entidad sólo despliegue. */}
          <div>
            <span className="text-[var(--g-text-secondary)] block mb-0.5">Rol regulatorio:</span>
            <span
              className={`font-semibold ${system.regulatory_role ? "text-[var(--g-text-primary)]" : "text-[var(--status-warning)]"}`}
            >
              {system.regulatory_role
                ? ETIQUETA_ROL[system.regulatory_role as RolRegulatorio] ?? system.regulatory_role
                : "No declarado"}
            </span>
          </div>
          <div>
            <span className="text-[var(--g-text-secondary)] block mb-0.5">Proveedor / Responsable:</span>
            <span className="font-semibold text-[var(--g-text-primary)]">{system.vendor || "No declarado"}</span>
          </div>
          <div>
            <span className="text-[var(--g-text-secondary)] block mb-0.5">Fecha Despliegue:</span>
            <span className="font-semibold text-[var(--g-text-primary)]">
              {system.deployment_date
                ? new Date(system.deployment_date).toLocaleDateString("es-ES")
                : "Sin fecha de despliegue registrada"}
            </span>
          </div>
        </div>

        {system.use_case && (
          <div className="pt-3 border-t border-[var(--g-border-subtle)] text-xs">
            <span className="font-bold text-[var(--g-text-secondary)] block mb-0.5">Finalidad y Caso de Uso:</span>
            <p className="text-[var(--g-text-primary)]">{system.use_case}</p>
          </div>
        )}
      </div>
    </>
  );
}
