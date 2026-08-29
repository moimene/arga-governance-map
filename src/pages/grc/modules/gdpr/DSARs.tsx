import { useState } from "react";
import { dsarStatusChip } from "@/lib/grc/status-labels";
import { computeDsarSla, type DsarSlaCalculation } from "@/lib/grc/regulatory-clocks";
import { Clock, PlusCircle, AlertTriangle, CheckCircle2, User, FileText } from "lucide-react";
import { toast } from "sonner";

interface DsarItem {
  id: string;
  code: string;
  type: "Acceso" | "Rectificación" | "Supresión (Olvido)" | "Limitación" | "Portabilidad" | "Oposición";
  status: "En curso" | "Resuelto" | "Prorrogado" | "Denegado (Motivado)";
  receiptDate: string;
  isExtended: boolean;
  extensionReason?: string;
  subject: string;
  channel: "Portal Web" | "Email DPO" | "Correo Postal / Presencial";
}

const INITIAL_DSARS: DsarItem[] = [
  {
    id: "dsar-01",
    code: "DSAR-2026-012",
    type: "Acceso",
    status: "En curso",
    receiptDate: "2026-08-10",
    isExtended: false,
    subject: "Cliente tomador póliza #4412",
    channel: "Portal Web",
  },
  {
    id: "dsar-02",
    code: "DSAR-2026-013",
    type: "Supresión (Olvido)",
    status: "Prorrogado",
    receiptDate: "2026-07-15",
    isExtended: true,
    extensionReason: "Elevado volumen de pólizas históricas e interconexión con peritajes judiciales en curso (Art. 12.3 RGPD).",
    subject: "Ex-asegurado particular #1180",
    channel: "Email DPO",
  },
  {
    id: "dsar-03",
    code: "DSAR-2026-014",
    type: "Oposición",
    status: "Resuelto",
    receiptDate: "2026-08-01",
    isExtended: false,
    subject: "Usuario web / Lead comercial #892",
    channel: "Portal Web",
  },
];

export default function DSARs() {
  const [dsars, setDsars] = useState<DsarItem[]>(INITIAL_DSARS);
  const [selectedDsar, setSelectedDsar] = useState<DsarItem | null>(null);
  const [extensionModalOpen, setExtensionModalOpen] = useState(false);
  const [extensionReasonInput, setExtensionReasonInput] = useState("");

  const handleExtendSla = (id: string) => {
    if (!extensionReasonInput.trim()) {
      toast.error("Debe indicar la justificación de complejidad o volumen para la prórroga.");
      return;
    }
    setDsars((prev) =>
      prev.map((d) =>
        d.id === id
          ? { ...d, isExtended: true, status: "Prorrogado", extensionReason: extensionReasonInput }
          : d
      )
    );
    setExtensionModalOpen(false);
    setExtensionReasonInput("");
    toast.success("SLA prorrogado 2 meses adicionales conforme al Art. 12.3 RGPD.");
  };

  return (
    <div className="p-6 space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-6 w-6 text-[var(--g-brand-3308)]" />
            <h1 className="text-2xl font-bold text-[var(--g-text-primary)]">
              Gestión de Derechos de Interesados (DSARs - Art. 12-22 RGPD)
            </h1>
          </div>
          <p className="text-sm text-[var(--g-text-secondary)]">
            Reloj de SLA legal: 1 mes de calendario desde la recepción + prórroga motivada de 2 meses adicionales.
          </p>
        </div>
      </header>

      {/* Grid de Solicitudes */}
      <div
        className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] overflow-hidden"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="px-5 py-4 border-b border-[var(--g-border-subtle)] flex items-center justify-between">
          <h2 className="text-sm font-bold text-[var(--g-text-primary)]">
            Solicitudes de Ejercicio de Derechos
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--g-surface-subtle)] border-b border-[var(--g-border-subtle)]">
                {["Código", "Derecho Ejercido", "Interesado", "Canal", "Recepción", "Vencimiento SLA", "Estado", "Acciones"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-[var(--g-text-primary)] uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--g-border-subtle)]">
              {dsars.map((d) => {
                const sla = computeDsarSla(d.receiptDate, d.isExtended);
                const isOverdue = sla.isOverdue;
                const isUrgent = sla.daysRemaining <= 5 && !isOverdue;

                return (
                  <tr key={d.id} className="hover:bg-[var(--g-surface-subtle)]/50 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs font-bold text-[var(--g-brand-3308)]">
                      {d.code}
                    </td>
                    <td className="px-5 py-3 font-medium text-[var(--g-text-primary)] text-xs">
                      {d.type}
                    </td>
                    <td className="px-5 py-3 text-xs text-[var(--g-text-secondary)]">
                      {d.subject}
                    </td>
                    <td className="px-5 py-3 text-xs text-[var(--g-text-secondary)]">
                      {d.channel}
                    </td>
                    <td className="px-5 py-3 text-xs text-[var(--g-text-secondary)]">
                      {d.receiptDate}
                    </td>
                    <td className="px-5 py-3 text-xs">
                      <div className={`font-semibold ${isOverdue ? "text-[var(--status-error)]" : isUrgent ? "text-[var(--status-warning)]" : "text-[var(--g-text-primary)]"}`}>
                        {sla.effectiveDeadline.toLocaleDateString("es-ES")}
                      </div>
                      <div className="text-[10px] text-[var(--g-text-secondary)]">
                        {isOverdue ? "Plazo Vencido" : `${sla.daysRemaining} días restantes ${d.isExtended ? "(Prorrogado)" : ""}`}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${dsarStatusChip(d.status)}`}
                        style={{ borderRadius: "var(--g-radius-full)" }}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right space-x-2">
                      {!d.isExtended && d.status === "En curso" && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDsar(d);
                            setExtensionModalOpen(true);
                          }}
                          className="px-2 py-1 text-[11px] font-semibold bg-[var(--g-surface-subtle)] text-[var(--g-brand-3308)] hover:bg-[var(--g-brand-3308)] hover:text-[var(--g-text-inverse)] transition-colors border border-[var(--g-border-subtle)]"
                          style={{ borderRadius: "var(--g-radius-sm)" }}
                        >
                          +2m Prórroga Art. 12.3
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Prórroga Art. 12.3 RGPD */}
      {extensionModalOpen && selectedDsar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div
            className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] w-full max-w-lg overflow-hidden"
            style={{ borderRadius: "var(--g-radius-xl)", boxShadow: "var(--g-shadow-modal)" }}
          >
            <div className="px-6 py-4 border-b border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] flex items-center justify-between">
              <h3 className="text-base font-bold text-[var(--g-text-primary)]">
                Prórroga Excepcional de 2 Meses (Art. 12.3 RGPD)
              </h3>
              <button
                type="button"
                onClick={() => setExtensionModalOpen(false)}
                className="text-[var(--g-text-secondary)] hover:text-[var(--g-text-primary)] text-lg"
              >
                ×
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <p className="text-[var(--g-text-secondary)]">
                El plazo general de 1 mes podrá prorrogarse otros dos meses teniendo en cuenta la complejidad y el número de solicitudes. El responsable debe informar al interesado de cualquiera de dichas prórrogas en el plazo de un mes a partir de la recepción.
              </p>
              <div>
                <label className="block font-bold text-[var(--g-text-primary)] uppercase text-[10px] mb-1">
                  Motivación Jurídica y Técnica de la Prórroga:
                </label>
                <textarea
                  rows={3}
                  value={extensionReasonInput}
                  onChange={(e) => setExtensionReasonInput(e.target.value)}
                  placeholder="Describir la complejidad del tratamiento, dispersión de sistemas o volumen de expedientes..."
                  className="w-full p-2 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] text-[var(--g-text-primary)] focus:outline-none focus:border-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>
            </div>
            <div className="px-6 py-3 border-t border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setExtensionModalOpen(false)}
                className="px-3 py-1.5 text-xs text-[var(--g-text-secondary)] hover:text-[var(--g-text-primary)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleExtendSla(selectedDsar.id)}
                className="px-4 py-1.5 text-xs font-semibold bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                Aplicar Prórroga Legal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
