import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useUpdateAiSystem, type AiSystem } from "@/hooks/useAiSystems";

/**
 * Edición de la ficha del sistema.
 *
 * SIN rol regulatorio ni nivel de riesgo, a propósito. Los dos los escribe la
 * RPC del cuestionario guiado y el trigger de Cloud rechaza cualquier otro
 * camino: ofrecerlos aquí era ofrecer un desplegable que el servidor deniega, y
 * antes de eso permitía cambiar la calificación jurídica de un sistema sin
 * motivación, sin versión y sin dejar rastro.
 */

export interface EditarSistemaModalProps {
  system: AiSystem;
  onClose: () => void;
}

const CAMPO =
  "w-full h-9 px-3 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)]";
const AREA =
  "w-full p-2.5 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)]";
const ETIQUETA = "block font-semibold text-[var(--g-text-primary)] mb-1";

export default function EditarSistemaModal({ system, onClose }: EditarSistemaModalProps) {
  const actualizar = useUpdateAiSystem();
  const [name, setName] = useState(system.name || "");
  const [systemType, setSystemType] = useState(system.system_type || "");
  const [vendor, setVendor] = useState(system.vendor || "");
  const [status, setStatus] = useState(system.status || "");
  const [useCase, setUseCase] = useState(system.use_case || "");
  const [description, setDescription] = useState(system.description || "");
  const [aimsCode, setAimsCode] = useState(system.aims_reference_code || "");

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await actualizar.mutateAsync({
        id: system.id,
        updates: {
          name,
          system_type: systemType,
          vendor,
          status,
          use_case: useCase,
          description,
          aims_reference_code: aimsCode,
        },
      });
      toast.success("Ficha del sistema actualizada correctamente");
      onClose();
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? String(err);
      toast.error(`Error al actualizar sistema: ${msg}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <form
        onSubmit={guardar}
        className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] w-full max-w-xl p-6 space-y-4 shadow-2xl"
        style={{ borderRadius: "var(--g-radius-lg)" }}
      >
        <div className="flex items-center justify-between border-b border-[var(--g-border-subtle)] pb-3">
          <h3 className="text-base font-bold text-[var(--g-text-primary)]">Editar Ficha del Sistema IA</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="text-[var(--g-text-secondary)] hover:text-[var(--g-text-primary)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <p className="text-[var(--g-text-secondary)]">
            El rol regulatorio y el nivel de riesgo se cambian con una nueva clasificación guiada.
          </p>

          <div>
            <label htmlFor="sis-nombre" className={ETIQUETA}>Nombre del Sistema *</label>
            <input
              id="sis-nombre"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`${CAMPO} focus:ring-2 focus:ring-[var(--g-brand-3308)]`}
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="sis-tipo" className={ETIQUETA}>Tipo de Sistema</label>
              <input
                id="sis-tipo"
                type="text"
                value={systemType}
                onChange={(e) => setSystemType(e.target.value)}
                placeholder="e.g. LLM, Scoring ML, Computer Vision..."
                className={CAMPO}
                style={{ borderRadius: "var(--g-radius-md)" }}
              />
            </div>
            <div>
              <label htmlFor="sis-codigo" className={ETIQUETA}>Código de referencia AIMS</label>
              <input
                id="sis-codigo"
                type="text"
                value={aimsCode}
                onChange={(e) => setAimsCode(e.target.value)}
                className={CAMPO}
                style={{ borderRadius: "var(--g-radius-md)" }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="sis-vendor" className={ETIQUETA}>Proveedor / Vendor</label>
              <input
                id="sis-vendor"
                type="text"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                className={CAMPO}
                style={{ borderRadius: "var(--g-radius-md)" }}
              />
            </div>
            <div>
              <label htmlFor="sis-estado" className={ETIQUETA}>Estado</label>
              <select
                id="sis-estado"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className={CAMPO}
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <option value="ACTIVO">ACTIVO (En producción)</option>
                <option value="EN_EVALUACION">EN EVALUACIÓN</option>
                <option value="SUSPENDIDO">SUSPENDIDO</option>
                <option value="RETIRADO">RETIRADO</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="sis-descripcion" className={ETIQUETA}>Descripción</label>
            <textarea
              id="sis-descripcion"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={AREA}
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
          </div>

          <div>
            <label htmlFor="sis-caso" className={ETIQUETA}>Caso de Uso y Finalidad</label>
            <textarea
              id="sis-caso"
              rows={2}
              value={useCase}
              onChange={(e) => setUseCase(e.target.value)}
              className={AREA}
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
            disabled={actualizar.isPending}
            aria-busy={actualizar.isPending}
            className="px-4 py-1.5 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] text-xs font-medium disabled:opacity-50"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            {actualizar.isPending ? "Guardando..." : "Guardar Cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}
