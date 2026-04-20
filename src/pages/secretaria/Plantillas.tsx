import { FileText, ChevronRight, CheckCircle, Clock, Archive, AlertCircle } from "lucide-react";
import { useState } from "react";
import { usePlantillasProtegidas, useUpdateEstadoPlantilla, PlantillaProtegidaRow } from "@/hooks/usePlantillasProtegidas";
import { toast } from "sonner";

const ESTADO_BADGE = {
  BORRADOR: "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]",
  REVISADA: "bg-[var(--status-info)] text-[var(--g-text-inverse)]",
  APROBADA: "bg-[var(--g-sec-300)] text-[var(--g-brand-3308)]",
  ACTIVA: "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  ARCHIVADA: "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]",
};

const ESTADO_LABEL = {
  BORRADOR: "Borrador",
  REVISADA: "Revisada",
  APROBADA: "Aprobada",
  ACTIVA: "Activa",
  ARCHIVADA: "Archivada",
};

const WORKFLOW_TRANSITIONS: Record<string, { label: string; nextState: string; icon: any }> = {
  BORRADOR: { label: "Marcar como revisada", nextState: "REVISADA", icon: Clock },
  REVISADA: { label: "Aprobar", nextState: "APROBADA", icon: CheckCircle },
  APROBADA: { label: "Activar", nextState: "ACTIVA", icon: CheckCircle },
  ACTIVA: { label: "Archivar", nextState: "ARCHIVADA", icon: Archive },
};

export default function Plantillas() {
  const { data, isLoading } = usePlantillasProtegidas();
  const updateEstado = useUpdateEstadoPlantilla();
  const [selected, setSelected] = useState<PlantillaProtegidaRow | null>(null);

  const handleTransicion = (plantilla: PlantillaProtegidaRow) => {
    const transition = WORKFLOW_TRANSITIONS[plantilla.estado];
    if (!transition) return;

    updateEstado.mutate(
      { id: plantilla.id, nuevo_estado: transition.nextState },
      {
        onSuccess: () => {
          toast.success(`Plantilla transicionada a ${ESTADO_LABEL[transition.nextState as keyof typeof ESTADO_LABEL]}`);
          setSelected(null);
        },
        onError: () => {
          toast.error("Error al actualizar el estado de la plantilla");
        },
      }
    );
  };

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      {/* Encabezado */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
          <FileText className="h-3.5 w-3.5" />
          Secretaría · Plantillas
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
          Plantillas documentales protegidas
        </h1>
        <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
          Ciclo de vida: Borrador → Revisada → Aprobada → Activa → Archivada
        </p>
      </div>

      {/* Master-Detail Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
        {/* Tabla Master */}
        <div
          className="overflow-hidden border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <table className="w-full">
            <thead>
              <tr className="bg-[var(--g-surface-subtle)]">
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                  Tipo
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                  Materia
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                  Jurisdicción
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                  v.
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                  Estado
                </th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--g-border-subtle)]">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-[var(--g-text-secondary)]">
                    Cargando…
                  </td>
                </tr>
              ) : !data || data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-[var(--g-text-secondary)]">
                    Sin plantillas protegidas.
                  </td>
                </tr>
              ) : (
                data.map((plantilla) => (
                  <tr
                    key={plantilla.id}
                    onClick={() => setSelected(plantilla)}
                    className={`cursor-pointer transition-colors hover:bg-[var(--g-surface-subtle)]/50 ${
                      selected?.id === plantilla.id ? "bg-[var(--g-surface-subtle)]" : ""
                    }`}
                  >
                    <td className="px-5 py-3 text-sm font-medium text-[var(--g-text-primary)]">
                      {plantilla.tipo}
                    </td>
                    <td className="px-5 py-3 text-sm text-[var(--g-text-secondary)]">
                      {plantilla.materia || "—"}
                    </td>
                    <td className="px-5 py-3 text-sm text-[var(--g-text-secondary)]">
                      {plantilla.jurisdiccion}
                    </td>
                    <td className="px-5 py-3 text-sm text-[var(--g-text-secondary)]">
                      {plantilla.version}
                    </td>
                    <td className="px-5 py-3 text-sm">
                      <span
                        className={`inline-block px-2.5 py-1 text-xs font-medium ${
                          ESTADO_BADGE[plantilla.estado as keyof typeof ESTADO_BADGE] ||
                          "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
                        }`}
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      >
                        {ESTADO_LABEL[plantilla.estado as keyof typeof ESTADO_LABEL] || plantilla.estado}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <ChevronRight className="inline h-4 w-4 text-[var(--g-text-secondary)]" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Detail Panel */}
        <div
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          {selected ? (
            <div className="flex h-full flex-col">
              {/* Detail Header */}
              <div className="border-b border-[var(--g-border-subtle)] px-5 py-4">
                <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">Detalles</h2>
              </div>

              {/* Detail Body */}
              <div className="flex-1 overflow-y-auto p-5">
                {/* Tipo */}
                <div className="mb-4">
                  <div className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">Tipo</div>
                  <div className="mt-1 text-sm font-medium text-[var(--g-text-primary)]">
                    {selected.tipo}
                  </div>
                </div>

                {/* Materia */}
                <div className="mb-4">
                  <div className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">Materia</div>
                  <div className="mt-1 text-sm text-[var(--g-text-primary)]">
                    {selected.materia || "—"}
                  </div>
                </div>

                {/* Jurisdicción */}
                <div className="mb-4">
                  <div className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">Jurisdicción</div>
                  <div className="mt-1 text-sm text-[var(--g-text-primary)]">
                    {selected.jurisdiccion}
                  </div>
                </div>

                {/* Versión */}
                <div className="mb-4">
                  <div className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">Versión</div>
                  <div className="mt-1 text-sm text-[var(--g-text-primary)]">
                    v{selected.version}
                  </div>
                </div>

                {/* Estado */}
                <div className="mb-4">
                  <div className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">Estado</div>
                  <div className="mt-1">
                    <span
                      className={`inline-block px-2.5 py-1 text-xs font-medium ${
                        ESTADO_BADGE[selected.estado as keyof typeof ESTADO_BADGE] ||
                        "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
                      }`}
                      style={{ borderRadius: "var(--g-radius-sm)" }}
                    >
                      {ESTADO_LABEL[selected.estado as keyof typeof ESTADO_LABEL] || selected.estado}
                    </span>
                  </div>
                </div>

                {/* Referencia Legal */}
                {selected.referencia_legal && (
                  <div className="mb-4">
                    <div className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">
                      Referencia Legal
                    </div>
                    <div className="mt-1 text-sm text-[var(--g-text-primary)]">
                      {selected.referencia_legal}
                    </div>
                  </div>
                )}

                {/* Capa 1 Inmutable */}
                {selected.capa1_inmutable && (
                  <div className="mb-4">
                    <div className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">
                      Capa 1 (Inmutable)
                    </div>
                    <pre
                      className="mt-2 max-h-[120px] overflow-y-auto rounded bg-[var(--g-surface-subtle)] p-2 font-mono text-[11px] text-[var(--g-text-secondary)]"
                    >
                      {selected.capa1_inmutable.substring(0, 300)}
                      {selected.capa1_inmutable.length > 300 ? "…" : ""}
                    </pre>
                  </div>
                )}

                {/* Capa 2 Variables */}
                {selected.capa2_variables && Array.isArray(selected.capa2_variables) && selected.capa2_variables.length > 0 && (
                  <div className="mb-4">
                    <div className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">
                      Variables (Capa 2)
                    </div>
                    <div className="mt-2 space-y-1 text-[11px] text-[var(--g-text-secondary)]">
                      {selected.capa2_variables.map((v, i) => (
                        <div key={i} className="rounded bg-[var(--g-surface-subtle)] px-2 py-1">
                          <span className="font-mono font-medium">{(v as any).variable}</span>
                          {" — "}
                          <span className="text-[10px]">{(v as any).fuente}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Aprobación */}
                {selected.aprobada_por && (
                  <div className="mb-4">
                    <div className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">
                      Aprobada por
                    </div>
                    <div className="mt-1 text-sm text-[var(--g-text-primary)]">
                      {selected.aprobada_por}
                    </div>
                  </div>
                )}

                {selected.fecha_aprobacion && (
                  <div className="mb-4">
                    <div className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">
                      Fecha aprobación
                    </div>
                    <div className="mt-1 text-sm text-[var(--g-text-primary)]">
                      {new Date(selected.fecha_aprobacion).toLocaleDateString("es-ES")}
                    </div>
                  </div>
                )}

                {/* Checklist de aprobación */}
                {(selected as any).approval_checklist && Array.isArray((selected as any).approval_checklist) && (selected as any).approval_checklist.length > 0 && (
                  <div className="mb-4">
                    <div className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">Checklist de aprobación</div>
                    <div className="mt-2 space-y-1">
                      {((selected as any).approval_checklist as Array<{ check: string; passed: boolean }>).map((item, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          {item.passed ? <CheckCircle className="h-3.5 w-3.5 text-[var(--status-success)]" /> : <AlertCircle className="h-3.5 w-3.5 text-[var(--status-error)]" />}
                          <span className="text-[var(--g-text-primary)]">{item.check}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Historial de estado */}
                {(selected as any).version_history && Array.isArray((selected as any).version_history) && (selected as any).version_history.length > 0 && (
                  <div className="mb-4">
                    <div className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">Historial de estado</div>
                    <div className="mt-2 space-y-1">
                      {((selected as any).version_history as Array<{ from: string; to: string; at: string; by: string }>).map((h, i) => (
                        <div key={i} className="text-xs text-[var(--g-text-secondary)]">
                          <span className="font-medium text-[var(--g-text-primary)]">{h.from} → {h.to}</span>
                          {" · "}{new Date(h.at).toLocaleDateString("es-ES")}
                          {h.by && h.by !== "system" && ` · ${h.by}`}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Creación */}
                <div className="mb-4 border-t border-[var(--g-border-subtle)] pt-4">
                  <div className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">
                    Creada
                  </div>
                  <div className="mt-1 text-sm text-[var(--g-text-secondary)]">
                    {new Date(selected.created_at).toLocaleDateString("es-ES")}
                  </div>
                </div>
              </div>

              {/* Detail Footer - Action Button */}
              {WORKFLOW_TRANSITIONS[selected.estado] && (
                <div className="border-t border-[var(--g-border-subtle)] px-5 py-4">
                  {(() => {
                    const transition = WORKFLOW_TRANSITIONS[selected.estado];
                    const IconComponent = transition.icon;
                    return (
                      <button
                        onClick={() => handleTransicion(selected)}
                        disabled={updateEstado.isPending}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-all disabled:opacity-60 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)]"
                        style={{ borderRadius: "var(--g-radius-md)" }}
                      >
                        <IconComponent className="h-4 w-4" />
                        {updateEstado.isPending ? "Procesando…" : transition.label}
                      </button>
                    );
                  })()}
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center p-5">
              <div className="text-center">
                <AlertCircle className="mx-auto h-8 w-8 text-[var(--g-text-secondary)] opacity-50" />
                <p className="mt-2 text-sm text-[var(--g-text-secondary)]">
                  Selecciona una plantilla para ver detalles y gestionar su ciclo de vida.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
