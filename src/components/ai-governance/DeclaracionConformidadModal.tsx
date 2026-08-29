import { useRef } from "react";
import { AiSystem } from "@/hooks/useAiSystems";
import { useTenantBranding, useTenantBrandingLoading } from "@/context/TenantBrandContext";
import { groupFullLabel } from "@/lib/tenant-brand-labels";
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
  const branding = useTenantBranding();
  const brandingLoading = useTenantBrandingLoading();
  // La entidad sale del tenant. Antes se declaraba una aseguradora concreta con
  // dirección real en un documento que el usuario descarga.
  // `groupFullLabel(null)` devuelve el grupo de ARGA, y `useTenantBranding()`
  // también devuelve null MIENTRAS CARGA: sin este guard, un sistema de otro
  // tenant descargado antes de resolver el branding se declararía de ARGA.
  const entidad = brandingLoading ? "[entidad por resolver]" : groupFullLabel(branding);
  // Sin clasificación no se declara ninguna: un falso positivo regulatorio en un
  // papel con membrete del art. 47 es tan indefendible como un falso verde.
  const clasificacion = system.risk_level || "No clasificado";

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
   - Tipo de Sistema: ${system.system_type || "No declarado"}
   - Clasificación de Riesgo: ${clasificacion}

2. PROVEEDOR RESPONSABLE:
   - Entidad: ${entidad}
   - Persona / Cargo Responsable: [por completar antes de la emisión]

3. DECLARACIÓN DE RESPONSABILIDAD:
   La presente declaración de conformidad se expide bajo la exclusiva 
   responsabilidad del proveedor identificado anteriormente.

4. FINALIDAD PREVISTA:
   ${system.use_case || system.description || "No declarada."}

5. MARCOS NORMATIVOS DE REFERENCIA (su aplicación efectiva se acredita con las
   evaluaciones registradas del sistema, no con esta enumeración):
   - Reglamento (UE) 2024/1689 del Parlamento Europeo y del Consejo (AI Act)
   - Guías Técnicas de la Agencia Española de Supervisión de IA (AESIA Guías 1 a 16)
   - UNE-EN ISO/IEC 42001:2023 - Sistema de Gestión de Inteligencia Artificial
   - Real Decreto 817/2023 - Entorno Controlado de Pruebas (Sandbox IA España)

6. INTEGRIDAD Y CUSTODIA PROBATORIA:
   - Registro del manifiesto técnico: interno, con hash SHA-512
   - Estado del expediente técnico: no se determina desde esta vista
   - Sin sello ni preservación cualificada: no interviene prestador de confianza

Fecha de Emisión: ${new Date().toLocaleDateString("es-ES")}
Firmante: [sin firma; documento no firmado electrónicamente]

BORRADOR SIN EFECTO JURÍDICO. Este documento se genera en un entorno de
validación funcional y no constituye una declaración de conformidad emitida.
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
              <span>Borrador · sin efecto jurídico</span>
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
                <span className="font-bold">{clasificacion}</span>
              </div>
              <div>
                <span className="font-semibold text-[var(--g-text-secondary)] block">Proveedor Responsable:</span>
                <span>{system.vendor || "No declarado"}</span>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">
                1. Finalidad Prevista y Ámbito de Uso
              </h3>
              <p className="text-[var(--g-text-secondary)] bg-[var(--g-surface-card)] p-3 border border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-sm)" }}>
                {system.use_case || system.description || "Finalidad no declarada."}
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">
                2. Marcos Normativos de Referencia
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
                Espacio reservado a la declaración de responsabilidad del proveedor (art. 47 RIA).
                Su contenido debe redactarse y asumirse antes de la emisión: esta consola no puede
                declarar por el proveedor el cumplimiento de los requisitos del Reglamento.
              </p>
            </div>

            {/* Signature & Seal Block */}
            <div className="pt-4 border-t border-[var(--g-border-subtle)] grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="font-semibold text-[var(--g-text-secondary)] block">Lugar y Fecha:</span>
                <span>Madrid, a {new Date().toLocaleDateString("es-ES")}</span>
                <span className="font-semibold text-[var(--g-text-secondary)] block pt-2">Custodia:</span>
                <span className="font-mono text-[10px] text-[var(--g-brand-3308)]">Registro interno · hash SHA-512</span>
              </div>
              <div className="border border-dashed border-[var(--g-border-default)] p-3 text-center space-y-1 flex flex-col justify-center" style={{ borderRadius: "var(--g-radius-md)" }}>
<span className="font-bold text-[11px] text-[var(--g-text-primary)]">Espacio reservado para firma</span>
                <span className="text-[10px] text-[var(--g-text-secondary)]">Documento no firmado electrónicamente</span>
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
              <span>Descargar borrador</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] text-xs font-medium transition-colors"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir borrador</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
