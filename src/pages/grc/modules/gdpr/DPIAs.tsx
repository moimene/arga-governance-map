import { useState } from "react";
import { dpiaStatusChip, riskLevelChip } from "@/lib/grc/status-labels";
import { 
  FileCheck, ShieldAlert, CheckCircle2, AlertTriangle, 
  Brain, ExternalLink, Sliders, ChevronRight 
} from "lucide-react";
import { Link } from "react-router-dom";

interface DpiaItem {
  id: string;
  code: string;
  name: string;
  status: "Aprobada" | "En revisión" | "Pendiente Mitigaciones" | "Consulta Previa AEPD";
  inherentRisk: "Alto" | "Crítico" | "Medio";
  residualRisk: "Medio" | "Bajo" | "Alto";
  date: string;
  treatmentType: "Modelo IA / Scoring" | "Profiling de Clientes" | "Datos de Salud / Biometría" | "Monitorización Masiva";
  dpoOpinion: "Favorable con salvaguardas" | "En análisis" | "Desfavorable";
  linkedAiSystem?: string;
  mitigations: string[];
}

const DPIAS_DATA: DpiaItem[] = [
  {
    id: "dpia-01",
    code: "EIPD-2026-001",
    name: "Modelo IA de Scoring Automatizado de Siniestros y Probabilidad de Fraude",
    status: "Aprobada",
    inherentRisk: "Alto",
    residualRisk: "Bajo",
    date: "2026-01-20",
    treatmentType: "Modelo IA / Scoring",
    dpoOpinion: "Favorable con salvaguardas",
    linkedAiSystem: "SIST-IA-003 (Scoring Siniestros)",
    mitigations: [
      "Supervisión humana 'Human-in-the-loop' en denegaciones",
      "Auditoría algorítmica de sesgo y explicabilidad de factores",
      "Cifrado de variables sensibles y minimización estricta",
    ],
  },
  {
    id: "dpia-02",
    code: "EIPD-2026-002",
    name: "Plataforma de Analítica de Comportamiento Web y Detección de Telemetría",
    status: "En revisión",
    inherentRisk: "Medio",
    residualRisk: "Bajo",
    date: "2026-03-04",
    treatmentType: "Profiling de Clientes",
    dpoOpinion: "En análisis",
    mitigations: [
      "Consentimiento granular por capas en banner CMP",
      "Anonimización de IPs en ingesta y expiración de cookies a 6 meses",
    ],
  },
  {
    id: "dpia-03",
    code: "EIPD-2026-003",
    name: "Peritaje Digital de Siniestros de Salud con Reconocimiento Facial e Imágenes",
    status: "Pendiente Mitigaciones",
    inherentRisk: "Crítico",
    residualRisk: "Medio",
    date: "2026-06-15",
    treatmentType: "Datos de Salud / Biometría",
    dpoOpinion: "Favorable con salvaguardas",
    linkedAiSystem: "SIST-IA-005 (Peritaje Visión)",
    mitigations: [
      "Consentimiento explícito reforzado para datos de categoría especial (Art. 9.2.a)",
      "Procesamiento local en dispositivo sin persistencia de vectores biométricos",
    ],
  },
];

export default function DPIAs() {
  const [selectedDpia, setSelectedDpia] = useState<DpiaItem | null>(null);

  return (
    <div className="p-6 space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileCheck className="h-6 w-6 text-[var(--g-brand-3308)]" />
            <h1 className="text-2xl font-bold text-[var(--g-text-primary)]">
              Evaluaciones de Impacto en Protección de Datos (DPIAs / EIPD)
            </h1>
          </div>
          <p className="text-sm text-[var(--g-text-secondary)]">
            Evaluación preceptiva de riesgos para los derechos y libertades de las personas conforme al Art. 35 del RGPD y vinculación con AI Governance.
          </p>
        </div>
      </header>

      {/* Grid de EIPD */}
      <div
        className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] overflow-hidden"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="px-5 py-4 border-b border-[var(--g-border-subtle)] flex items-center justify-between">
          <h2 className="text-sm font-bold text-[var(--g-text-primary)]">
            Registro de Evaluaciones de Impacto
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--g-surface-subtle)] border-b border-[var(--g-border-subtle)]">
                {["Código / Tratamiento", "Tipología", "Riesgo Inherente", "Riesgo Residual", "Dictamen DPO", "Estado", ""].map((h, i) => (
                  <th key={i} className="px-5 py-3 text-left text-xs font-semibold text-[var(--g-text-primary)] uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--g-border-subtle)]">
              {DPIAS_DATA.map((d) => (
                <tr
                  key={d.id}
                  onClick={() => setSelectedDpia(d)}
                  className="hover:bg-[var(--g-surface-subtle)]/50 transition-colors cursor-pointer"
                >
                  <td className="px-5 py-3">
                    <span className="font-mono text-xs font-bold text-[var(--g-brand-3308)] block">
                      {d.code}
                    </span>
                    <span className="font-medium text-[var(--g-text-primary)] text-xs">
                      {d.name}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-[var(--g-text-secondary)]">
                    {d.treatmentType}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${riskLevelChip(d.inherentRisk)}`}
                      style={{ borderRadius: "var(--g-radius-full)" }}
                    >
                      {d.inherentRisk}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${riskLevelChip(d.residualRisk)}`}
                      style={{ borderRadius: "var(--g-radius-full)" }}
                    >
                      {d.residualRisk}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs font-medium text-[var(--g-text-primary)]">
                    {d.dpoOpinion}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${dpiaStatusChip(d.status)}`}
                      style={{ borderRadius: "var(--g-radius-full)" }}
                    >
                      {d.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <ChevronRight className="h-4 w-4 text-[var(--g-text-secondary)] inline" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Detalle EIPD */}
      {selectedDpia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div
            className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] w-full max-w-2xl overflow-hidden"
            style={{ borderRadius: "var(--g-radius-xl)", boxShadow: "var(--g-shadow-modal)" }}
          >
            <div className="px-6 py-4 border-b border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] flex items-center justify-between">
              <div>
                <span className="font-mono text-xs font-bold text-[var(--g-brand-3308)]">
                  {selectedDpia.code}
                </span>
                <h3 className="text-base font-bold text-[var(--g-text-primary)]">
                  Evaluación de Impacto en Privacidad (Art. 35 RGPD)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDpia(null)}
                className="text-[var(--g-text-secondary)] hover:text-[var(--g-text-primary)] text-xl font-bold"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              <div>
                <div className="font-bold text-[var(--g-text-secondary)] uppercase text-[10px]">Tratamiento Evaluado:</div>
                <div className="text-[var(--g-text-primary)] font-medium text-sm mt-0.5">{selectedDpia.name}</div>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-[var(--g-border-subtle)] pt-3">
                <div>
                  <div className="font-bold text-[var(--g-text-secondary)] uppercase text-[10px]">Tipología de Alto Riesgo:</div>
                  <div className="text-[var(--g-text-primary)] mt-0.5">{selectedDpia.treatmentType}</div>
                </div>
                <div>
                  <div className="font-bold text-[var(--g-text-secondary)] uppercase text-[10px]">Fecha de Evaluación:</div>
                  <div className="text-[var(--g-text-primary)] mt-0.5">{selectedDpia.date}</div>
                </div>
                <div>
                  <div className="font-bold text-[var(--g-text-secondary)] uppercase text-[10px]">Riesgo Inherente:</div>
                  <div className="font-semibold text-[var(--status-error)] mt-0.5">{selectedDpia.inherentRisk}</div>
                </div>
                <div>
                  <div className="font-bold text-[var(--g-text-secondary)] uppercase text-[10px]">Riesgo Residual tras Mitigaciones:</div>
                  <div className="font-semibold text-[var(--status-success)] mt-0.5">{selectedDpia.residualRisk}</div>
                </div>
              </div>

              {selectedDpia.linkedAiSystem && (
                <div className="p-3 bg-[var(--g-surface-subtle)] rounded border border-[var(--g-border-subtle)] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-[var(--g-brand-3308)]" />
                    <div>
                      <div className="font-semibold text-[var(--g-text-primary)]">Vinculado a Sistema de IA</div>
                      <div className="text-[11px] text-[var(--g-text-secondary)]">{selectedDpia.linkedAiSystem}</div>
                    </div>
                  </div>
                  <Link
                    to="/ai-governance/sistemas"
                    className="text-xs text-[var(--g-brand-3308)] font-semibold underline flex items-center gap-1"
                  >
                    <span>Ver en AI Gov</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              )}

              <div className="border-t border-[var(--g-border-subtle)] pt-3">
                <div className="font-bold text-[var(--g-text-secondary)] uppercase text-[10px] mb-2">
                  Medidas y Salvaguardas de Mitigación Obligatorias:
                </div>
                <ul className="space-y-1.5 pl-4 list-disc text-[var(--g-text-primary)]">
                  {selectedDpia.mitigations.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="px-6 py-3 border-t border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] text-right">
              <button
                type="button"
                onClick={() => setSelectedDpia(null)}
                className="px-4 py-1.5 text-xs font-semibold bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                Cerrar EIPD
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
