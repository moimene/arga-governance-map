/**
 * Medidas Adicionales (MA): las salvaguardas propias de la organización.
 *
 * Se evalúan con los MISMOS controles que una medida guía y entran en el mismo
 * mapa de evaluaciones: mientras tuvieron estado propio, ni se graduaban, ni
 * contaban en las estadísticas, ni llegaban al payload — se añadían, se
 * pintaban y se perdían al enviar.
 *
 * La identidad de la MA (su `id`) la acuña la página, que es quien conoce las
 * que ya existen. Aquí sólo se recoge lo que el usuario escribe.
 */
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { subpartTitle, calculateAdaptationPlan, type RequirementDef } from "@/lib/aims/catalog-aesia";
import type { MedidaAdicionalRef } from "@/lib/aims/evaluacion-payload";
import ControlesDeMedida, {
  BadgePlan,
  ESTADO_VACIO,
  SELECT_CLASSES,
  TEXTAREA_CLASSES,
  type MeasureEvaluationState,
} from "./ControlesDeMedida";

export type BotonNuevaMedidaAdicionalProps = {
  requirement: RequirementDef;
  onAdd: (descripcion: string, subpartId: string) => void;
};

export function BotonNuevaMedidaAdicional({ requirement, onAdd }: BotonNuevaMedidaAdicionalProps) {
  const [abierto, setAbierto] = useState(false);
  const [subpartId, setSubpartId] = useState("");
  const [descripcion, setDescripcion] = useState("");

  const confirmar = () => {
    if (!descripcion.trim()) {
      toast.error("Indica una descripción para la Medida Adicional.");
      return;
    }
    onAdd(descripcion.trim(), subpartId || requirement?.subparts[0]?.subpartId || "");
    setDescripcion("");
    setAbierto(false);
    toast.success("Medida Adicional (MA) agregada al requisito");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] text-xs font-medium transition-colors"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        <Plus className="w-3.5 h-3.5 text-[var(--g-brand-3308)]" />
        <span>Añadir Medida Adicional (MA)</span>
      </button>

      {abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div
            className="p-6 bg-[var(--g-surface-card)] border border-[var(--g-border-default)] w-full max-w-lg space-y-4 shadow-xl"
            style={{ borderRadius: "var(--g-radius-lg)" }}
          >
            <h3 className="text-base font-bold text-[var(--g-text-primary)]">
              Nueva Medida Adicional (MA)
            </h3>
            <p className="text-xs text-[var(--g-text-secondary)]">
              Define una salvaguarda propia de la organización para complementar el cumplimiento de este requisito.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--g-text-primary)] mb-1">
                  Bloque del requisito
                </label>
                <select
                  value={subpartId}
                  onChange={(e) => setSubpartId(e.target.value)}
                  className={SELECT_CLASSES}
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  {requirement.subparts.map((sub) => (
                    <option key={sub.subpartId} value={sub.subpartId}>
                      {sub.titleShort}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--g-text-primary)] mb-1">
                  Descripción de la Medida *
                </label>
                <textarea
                  rows={3}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Descripción de la salvaguarda, control o procedimiento técnico..."
                  className={TEXTAREA_CLASSES}
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--g-border-subtle)]">
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="px-3 py-1.5 border border-[var(--g-border-subtle)] text-[var(--g-text-secondary)] hover:bg-[var(--g-surface-subtle)] text-xs font-medium transition-colors"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmar}
                className="px-4 py-1.5 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] text-xs font-medium transition-colors"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                Añadir Medida
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export type ListaMedidasAdicionalesProps = {
  requirement: RequirementDef;
  medidas: MedidaAdicionalRef[];
  evaluations: Record<string, MeasureEvaluationState>;
  onEvaluationChange: (measureId: string, key: keyof MeasureEvaluationState, value: string) => void;
  onRemove: (measureId: string) => void;
};

export function ListaMedidasAdicionales({
  requirement,
  medidas,
  evaluations,
  onEvaluationChange,
  onRemove,
}: ListaMedidasAdicionalesProps) {
  return (
    <>
      {medidas.map((ma) => {
        const state = evaluations[ma.id] || ESTADO_VACIO;
        const plan = calculateAdaptationPlan(state.maturity);
        return (
          <div
            key={ma.id}
            className="p-5 bg-[var(--g-surface-subtle)] border-2 border-dashed border-[var(--g-brand-3308)]/40 space-y-4"
            style={{ borderRadius: "var(--g-radius-lg)" }}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="font-mono text-xs font-bold text-[var(--g-brand-3308)] bg-[var(--g-surface-card)] px-2 py-0.5 border border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-sm)" }}>
                  MEDIDA ADICIONAL • {ma.id}
                </span>
                <h4 className="text-sm font-bold text-[var(--g-text-primary)] mt-1">{ma.description}</h4>
                <span className="text-xs text-[var(--g-text-secondary)]">Bloque: {subpartTitle(requirement, ma.subpartId)}</span>
              </div>
              <div className="flex items-start gap-2">
                <BadgePlan code={plan.code} label={plan.label} />
                <button
                  type="button"
                  onClick={() => onRemove(ma.id)}
                  aria-label={`Eliminar la medida adicional ${ma.id}`}
                  className="p-1 text-[var(--status-error)] hover:bg-[var(--g-surface-card)] transition-colors"
                  style={{ borderRadius: "var(--g-radius-sm)" }}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            {/* Los mismos controles que una MG: una MA sin nivel no es
                evaluable y su requisito queda PENDIENTE. */}
            <ControlesDeMedida
              state={state}
              onChange={(key, value) => onEvaluationChange(ma.id, key, value)}
            />
          </div>
        );
      })}
    </>
  );
}
