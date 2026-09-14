import { useRef } from "react";
import { AiSystem } from "@/hooks/useAiSystems";
import { useTenantBranding, useTenantBrandingLoading } from "@/context/TenantBrandContext";
import { groupFullLabel } from "@/lib/tenant-brand-labels";
import { isModuleEnabled } from "@/lib/tenant-modules";
import { derivarMarcos, tieneClasificacionGuiada } from "@/lib/aims/cuestionario-calificacion";
import { vinculaArt47 } from "@/lib/aims/expediente-tecnico";
import { ETIQUETA_ROL, type RolRegulatorio } from "@/lib/aims/rol-regulatorio";
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
  // D-5: DORA no alcanza a todos los tenants y `branding.modules` lo oculta en
  // el resto del producto; NIS2 tampoco es un régimen de todos. Enumerarlos como
  // marco de referencia en un documento que el usuario DESCARGA los afirmaba
  // para cualquiera. NIS2 va con DORA porque su aplicabilidad se declara junto
  // a la de DORA y este documento no tiene ningún otro dato con que decidirla.
  const marcoResilienciaVisible = isModuleEnabled(branding, "dora");
  // Si el art. 47 vincula lo dice la hoja, no esta pantalla: sólo el proveedor
  // de un sistema de alto riesgo declara. Sin cuestionario COMPLETED el rol y
  // el nivel de la ficha son dato declarado, no clasificación: `null`, como
  // sin rol o sin nivel. Mismo criterio que el chip de la cabecera.
  const vincula = tieneClasificacionGuiada(system) ? vinculaArt47(system.regulatory_role, system.risk_level) : null;
  const rolLabel = ETIQUETA_ROL[system.regulatory_role as RolRegulatorio] ?? system.regulatory_role ?? "";
  const marcos = derivarMarcos(
    system.regulatory_role,
    system.risk_level,
    Boolean(system.regulatory_profile?.gpai),
  );

  if (!isOpen) return null;

  if (vincula !== true) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[color-mix(in_srgb,var(--g-text-primary)_60%,transparent)] backdrop-blur-sm">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="art47-titulo"
          className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] w-full max-w-lg p-6 space-y-4 shadow-2xl"
          style={{ borderRadius: "var(--g-radius-lg)" }}
        >
          <div className="flex items-center justify-between border-b border-[var(--g-border-subtle)] pb-3">
            <h2 id="art47-titulo" className="text-base font-bold text-[var(--g-text-primary)]">Declaración de Conformidad UE (Art. 47 RIA)</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar modal"
              className="p-1 text-[var(--g-text-secondary)] hover:text-[var(--g-text-primary)] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-[var(--g-text-primary)]">
            {vincula === null
              ? "Sin clasificación guiada: el art. 47 no se afirma para este sistema. Clasifícalo desde la ficha."
              : "El art. 47 (declaración UE de conformidad) sólo vincula al proveedor de un sistema de alto riesgo; a este rol y nivel no le aplica."}
          </p>
          <div className="flex justify-end pt-3 border-t border-[var(--g-border-subtle)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-[var(--g-border-subtle)] text-[var(--g-text-secondary)] hover:bg-[var(--g-surface-subtle)] text-xs font-medium transition-colors"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    );
  }

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

2. RESPONSABLE DE LA DECLARACIÓN:
   - Rol regulatorio: ${rolLabel}
   - Entidad: ${entidad}
   - Persona / Cargo Responsable: [por completar antes de la emisión]

3. DECLARACIÓN DE RESPONSABILIDAD:
   La presente declaración de conformidad se expide bajo la exclusiva 
   responsabilidad del proveedor identificado anteriormente.

4. FINALIDAD PREVISTA:
   ${system.use_case || system.description || "No declarada."}

5. MARCOS DERIVADOS DEL ROL Y DEL NIVEL (su aplicación efectiva se acredita con
   las evaluaciones registradas del sistema, no con esta enumeración):
${marcos.map((m) => `   - ${m.articulos} — ${m.titulo}`).join("\n")}

6. INTEGRIDAD Y CUSTODIA PROBATORIA:
   - Registro del manifiesto técnico: interno, sin hash de integridad
   - Estado del expediente técnico: no se determina desde esta vista
   - Sin sello ni preservación cualificada: no interviene prestador de confianza

Lugar de Emisión: [por completar antes de la emisión]
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[color-mix(in_srgb,var(--g-text-primary)_60%,transparent)] backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="art47-titulo"
        className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
        style={{ borderRadius: "var(--g-radius-lg)" }}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)]/50">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[var(--g-brand-3308)]" />
            <h2 id="art47-titulo" className="text-base font-bold text-[var(--g-text-primary)]">
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
              Conforme al Reglamento (UE) 2024/1689 (Reglamento de Inteligencia Artificial)
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
                <span className="font-semibold text-[var(--g-text-secondary)] block">Rol regulatorio:</span>
                <span>{rolLabel}</span>
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
                2. Marcos derivados del rol y del nivel
              </h3>
              <ul className="list-disc list-inside space-y-1 text-[var(--g-text-secondary)] pl-1">
                {marcos.map((m) => (
                  <li key={m.code}>{m.articulos} — {m.titulo}</li>
                ))}
                {marcoResilienciaVisible && (
                  <li>Marco de Ciberseguridad y Resiliencia Operativa Digital (DORA / NIS2).</li>
                )}
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
                {/* El lugar de emisión era «Madrid» en duro. Ni `ai_systems` ni
                    `tenants` tienen domicilio, así que no hay dato del que
                    resolverlo: se retira en vez de inventarlo, y queda como
                    hueco a completar antes de emitir, igual que el firmante. */}
                <span className="font-semibold text-[var(--g-text-secondary)] block">Fecha:</span>
                <span>{new Date().toLocaleDateString("es-ES")}</span>
                <span className="font-semibold text-[var(--g-text-secondary)] block pt-2">Lugar de emisión:</span>
                <span className="italic">[por completar antes de la emisión]</span>
                <span className="font-semibold text-[var(--g-text-secondary)] block pt-2">Custodia:</span>
                {/* No hay hash: las tablas del expediente técnico no tienen
                    columna donde guardarlo y esta pantalla no calcula ninguno. */}
                <span className="text-[10px] text-[var(--g-text-secondary)]">Registro interno, sin hash de integridad</span>
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
