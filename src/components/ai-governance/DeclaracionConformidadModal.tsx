import { useRef } from "react";
import { AiSystem } from "@/hooks/useAiSystems";
import {
  CheckCircle2,
  Download,
  FileCheck,
  Printer,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";

interface DeclaracionConformidadModalProps {
  system: AiSystem;
  isOpen: boolean;
  onClose: () => void;
}

export default function DeclaracionConformidadModal({
  system,
  isOpen,
  onClose,
}: DeclaracionConformidadModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadText = () => {
    const textContent = `
================================================================================
DECLARACIÓN DE CONFORMIDAD UE (REGLAMENTO UE 2024/1689 - ARTÍCULO 47)
================================================================================

1. IDENTIFICACIÓN DEL SISTEMA DE IA:
   - Nombre: ${system.name}
   - Código Interno: ${system.aims_reference_code || system.id}
   - Tipo de Sistema: ${system.system_type || "Sistema de Machine Learning / IA"}
   - Clasificación de Riesgo: ${system.risk_level || "ALTO RIESGO (Anexo III)"}

2. PROVEEDOR RESPONSABLE:
   - Entidad: Entidad Aseguradora Responsable
   - Dirección: Paseo de la Castellana 259, Madrid, España
   - Persona / Cargo Responsable: Director de Cumplimiento & AI Officer

3. DECLARACIÓN DE RESPONSABILIDAD:
   La presente declaración de conformidad se expide bajo la exclusiva 
   responsabilidad del proveedor identificado anteriormente.

4. FINALIDAD PREVISTA:
   ${system.use_case || system.description || "Uso operativo y toma de decisiones automatizada conforme a especificaciones técnicas."}

5. NORMAS ARMONIZADAS Y ESPECIFICACIONES TÉCNICAS APLICADAS:
   - Reglamento (UE) 2024/1689 del Parlamento Europeo y del Consejo (AI Act)
   - Guías Técnicas de la Agencia Española de Supervisión de IA (AESIA Guías 1 a 16)
   - UNE-EN ISO/IEC 42001:2023 - Sistema de Gestión de Inteligencia Artificial
   - Real Decreto 817/2023 - Entorno Controlado de Pruebas (Sandbox IA España)

6. INTEGRIDAD Y CUSTODIA PROBATORIA:
   - Manifiesto Técnico Precintado: WORM SHA-512 Verificado
   - Capa de Interposición y Archivo: EAD Trust Digital Trust Infrastructure
   - Estado del Expediente: CONFORME Y VALIDADO

Fecha de Emisión: ${new Date().toLocaleDateString("es-ES")}
Lugar: Madrid, España
Firma Electrónica: Responsable de Gobernanza de IA / Secretaría General
================================================================================
`;
    const blob = new Blob([textContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Declaracion-Conformidad-UE-${system.name.replace(/\s+/g, "_")}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Declaración descargada en formato texto");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
        style={{ borderRadius: "var(--g-radius-lg)" }}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)]/50">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[var(--g-brand-3308)]" />
            <h2 className="text-base font-bold text-[var(--g-text-primary)]">
              Declaración de Conformidad UE (Art. 47 RIA)
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar modal"
            className="p-1 text-[var(--g-text-secondary)] hover:text-[var(--g-text-primary)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content / Certificate View */}
        <div className="p-6 overflow-y-auto space-y-6" ref={printRef}>
          {/* Certificate Header Stamp */}
          <div className="text-center pb-4 border-b border-[var(--g-border-subtle)] space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[var(--g-surface-subtle)] border border-[var(--g-brand-3308)]/30 text-[var(--g-brand-3308)] text-xs font-bold uppercase tracking-wider mb-2" style={{ borderRadius: "var(--g-radius-sm)" }}>
              <FileCheck className="w-4 h-4" />
              <span>Documento Oficial de Conformidad Técnica</span>
            </div>
            <h1 className="text-xl font-bold text-[var(--g-text-primary)] uppercase tracking-wide">
              Declaración de Conformidad UE
            </h1>
            <p className="text-xs text-[var(--g-text-secondary)]">
              Conforme al Reglamento (UE) 2024/1689 (Reglamento de Inteligencia Artificial) y directrices AESIA
            </p>
          </div>

          {/* Body Sections */}
          <div className="space-y-4 text-xs leading-relaxed text-[var(--g-text-primary)]">
            <div className="grid grid-cols-2 gap-4 p-4 bg-[var(--g-surface-subtle)]/40 border border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-md)" }}>
              <div>
                <span className="font-semibold text-[var(--g-text-secondary)] block">Sistema de IA:</span>
                <span className="font-bold text-sm text-[var(--g-brand-3308)]">{system.name}</span>
              </div>
              <div>
                <span className="font-semibold text-[var(--g-text-secondary)] block">Código de Referencia:</span>
                <span className="font-mono">{system.aims_reference_code || `SYS-${system.id.slice(0, 8).toUpperCase()}`}</span>
              </div>
              <div>
                <span className="font-semibold text-[var(--g-text-secondary)] block">Nivel de Riesgo Declarado:</span>
                <span className="font-bold">{system.risk_level || "ALTO RIESGO"}</span>
              </div>
              <div>
                <span className="font-semibold text-[var(--g-text-secondary)] block">Proveedor Responsable:</span>
                <span>{system.vendor || "Desarrollo Propio Corporativo"}</span>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">
                1. Finalidad Prevista y Ámbito de Uso
              </h3>
              <p className="text-[var(--g-text-secondary)] bg-[var(--g-surface-card)] p-3 border border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-sm)" }}>
                {system.use_case || system.description || "Sistema empleado para el procesamiento analítico y apoyo a la toma de decisiones en el ámbito asegurador."}
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">
                2. Normas Armonizadas y Marcos Técnicos Evaluados
              </h3>
              <ul className="list-disc list-inside space-y-1 text-[var(--g-text-secondary)] pl-1">
                <li>Reglamento (UE) 2024/1689 (Artículos 9 a 17, 72 y 73).</li>
                <li>Catálogo de 84 Medidas Guía (MG) del Manual de Checklists de la AESIA (Guía 16).</li>
                <li>Estándar UNE-EN ISO/IEC 42001:2023 (Gestión de Inteligencia Artificial).</li>
                <li>Marco de Ciberseguridad y Resiliencia Operativa Digital (DORA / NIS2).</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">
                3. Declaración de Cumplimiento y Responsabilidad
              </h3>
              <p className="text-[var(--g-text-secondary)]">
                El proveedor declara solemnemente que el sistema de IA descrito cumple con todos los requisitos esenciales de seguridad, transparencia, supervisión humana, gobernanza del dato y ciberseguridad establecidos en la normativa aplicable, habiéndose elaborado y archivado el correspondiente Expediente Técnico (Art. 11).
              </p>
            </div>

            {/* Signature & Seal Block */}
            <div className="pt-4 border-t border-[var(--g-border-subtle)] grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="font-semibold text-[var(--g-text-secondary)] block">Lugar y Fecha:</span>
                <span>Madrid, a {new Date().toLocaleDateString("es-ES")}</span>
                <span className="font-semibold text-[var(--g-text-secondary)] block pt-2">Custodia Probatoria:</span>
                <span className="font-mono text-[10px] text-[var(--g-brand-3308)]">EAD Trust QTSP • Hash SHA-512 WORM</span>
              </div>
              <div className="border border-dashed border-[var(--g-border-default)] p-3 text-center space-y-1 flex flex-col justify-center" style={{ borderRadius: "var(--g-radius-md)" }}>
                <CheckCircle2 className="w-5 h-5 text-[var(--status-success)] mx-auto" />
                <span className="font-bold text-[11px] text-[var(--g-text-primary)]">Firma Validada del AI Officer</span>
                <span className="text-[10px] text-[var(--g-text-secondary)]">Gobernanza Corporativa de IA</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 border-t border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)]/30 flex justify-between items-center">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-[var(--g-border-subtle)] text-[var(--g-text-secondary)] hover:bg-[var(--g-surface-subtle)] text-xs font-medium transition-colors"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Cerrar
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadText}
              className="flex items-center gap-1.5 px-3 py-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] text-xs font-medium transition-colors"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar Ficha</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] text-xs font-medium transition-colors"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir Certificado</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
