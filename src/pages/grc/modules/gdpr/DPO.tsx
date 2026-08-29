import { useState } from "react";
import { 
  ShieldCheck, FileText, CheckCircle2, Clock, AlertTriangle, 
  HelpCircle, UserCheck, Scale, Send, MessageSquare 
} from "lucide-react";

interface DpoOpinionItem {
  id: string;
  code: string;
  title: string;
  matter?: string;
  requester: string;
  legalBasisEvaluated: string;
  riskAssessment: "Favorable con mitigaciones" | "Favorable" | "Desfavorable / Alto Riesgo";
  date: string;
  status: "Dictamen Emitido" | "En Análisis" | "Elevado a Consejo";
}

const DPO_OPINIONS: DpoOpinionItem[] = [
  {
    id: "dpo-op-01",
    code: "DICT-DPO-2026-001",
    title: "Consulta sobre cesión de datos de siniestros a reaseguradoras internacionales",
    requester: "Dirección de Siniestros y Reaseguro",
    legalBasisEvaluated: "Interés Legítimo y Ejecución de Contrato (Art. 6.1.b/f RGPD)",
    riskAssessment: "Favorable con mitigaciones",
    date: "2026-02-18",
    status: "Dictamen Emitido",
  },
  {
    id: "dpo-op-02",
    code: "DICT-DPO-2026-002",
    title: "Evaluación de privacidad del nuevo modelo de IA para detección de fraude",
    requester: "Área de Analítica Avanzada & IA",
    legalBasisEvaluated: "Art. 35 RGPD (EIPD preceptiva) + Interés Legítimo",
    riskAssessment: "Favorable con mitigaciones",
    date: "2026-04-12",
    status: "Dictamen Emitido",
  },
  {
    id: "dpo-op-03",
    code: "DICT-DPO-2026-003",
    title: "Campaña de cross-selling y profiling de clientes de vida",
    requester: "Dirección Comercial y Marketing",
    legalBasisEvaluated: "Consentimiento explícito (Art. 6.1.a y 9.2.a RGPD)",
    riskAssessment: "Favorable",
    date: "2026-06-25",
    status: "Dictamen Emitido",
  },
];

export default function DPO() {
  return (
    <div className="p-6 space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <UserCheck className="h-6 w-6 text-[var(--g-brand-3308)]" />
            <h1 className="text-2xl font-bold text-[var(--g-text-primary)]">
              Oficina del Delegado de Protección de Datos (DPO)
            </h1>
          </div>
          <p className="text-sm text-[var(--g-text-secondary)]">
            Supervisión estatutaria, registro de dictámenes y garantía de independencia conforme a los Arts. 37-39 del RGPD.
          </p>
        </div>
      </header>

      {/* Tarjeta de Designación Oficial y Estatuto */}
      <div
        className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-5"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold bg-[var(--status-success)] text-[var(--g-text-inverse)]" style={{ borderRadius: "var(--g-radius-full)" }}>
              <ShieldCheck className="h-3.5 w-3.5" />
              Designación Vigente y Notificada ante AEPD
            </div>
            <h2 className="text-base font-bold text-[var(--g-text-primary)]">
              Estatuto de Independencia y Reporte Directo al Consejo
            </h2>
            <p className="text-xs text-[var(--g-text-secondary)] max-w-3xl leading-relaxed">
              El DPO ejerce sus funciones con autonomía técnica, sin recibir instrucciones sobre el ejercicio de sus funciones (Art. 38.3 RGPD) y con acceso directo a la Comisión de Auditoría y Consejo de Administración.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 border-t lg:border-t-0 lg:border-l border-[var(--g-border-subtle)] pt-3 lg:pt-0 lg:pl-6 text-xs">
            <div>
              <div className="text-[10px] uppercase font-bold text-[var(--g-text-secondary)]">Registro AEPD:</div>
              <div className="font-mono font-semibold text-[var(--g-brand-3308)]">DPO-REG-2024-8891</div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-[var(--g-text-secondary)]">Canal de Contacto:</div>
              <div className="text-[var(--g-text-primary)] font-medium">dpo@empresa.com</div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-[var(--g-text-secondary)]">Informe Anual:</div>
              <div className="text-[var(--status-success)] font-semibold">Emitido 2025/2026</div>
            </div>
          </div>
        </div>
      </div>

      {/* Funciones Estatutarias Art. 39 RGPD */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          {
            title: "1. Asesoramiento Normativo",
            desc: "Informar y asesorar a la alta dirección y empleados sobre obligaciones de privacidad.",
            metric: "18 Consultas Q1-Q3",
          },
          {
            title: "2. Supervisión del RGPD",
            desc: "Supervisar la observancia del RGPD, políticas internas, asignación de responsabilidades y formación.",
            metric: "100% Tratamientos Auditados",
          },
          {
            title: "3. Asesoramiento en EIPD",
            desc: "Supervisar evaluaciones de impacto en privacidad para tratamientos de alto riesgo.",
            metric: "3 DPIAs Supervisadas",
          },
          {
            title: "4. Enlace con AEPD",
            desc: "Punto de contacto y cooperación con la autoridad de control en inspecciones o brechas.",
            metric: "0 Reclamaciones Abiertas",
          },
        ].map((f) => (
          <div
            key={f.title}
            className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-4 space-y-2"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="text-xs font-bold text-[var(--g-brand-3308)] uppercase">{f.title}</div>
            <p className="text-xs text-[var(--g-text-secondary)] leading-relaxed">{f.desc}</p>
            <div className="text-xs font-semibold text-[var(--g-text-primary)] pt-1 border-t border-[var(--g-border-subtle)]">
              {f.metric}
            </div>
          </div>
        ))}
      </div>

      {/* Registro de Dictámenes y Consultas Emitidas */}
      <div
        className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] overflow-hidden"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="px-5 py-4 border-b border-[var(--g-border-subtle)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-[var(--g-brand-3308)]" />
            <h2 className="text-sm font-bold text-[var(--g-text-primary)]">
              Registro Oficial de Dictámenes y Consultas Formales del DPO
            </h2>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--g-surface-subtle)] border-b border-[var(--g-border-subtle)]">
                {["Código / Asunto", "Área Solicitante", "Base Legal Evaluada", "Sentido del Dictamen", "Fecha", "Estado"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-[var(--g-text-primary)] uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--g-border-subtle)]">
              {DPO_OPINIONS.map((op) => (
                <tr key={op.id} className="hover:bg-[var(--g-surface-subtle)]/50 transition-colors">
                  <td className="px-5 py-3">
                    <span className="font-mono text-xs font-bold text-[var(--g-brand-3308)] block">
                      {op.code}
                    </span>
                    <span className="font-medium text-[var(--g-text-primary)] text-xs">
                      {op.title}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-[var(--g-text-secondary)]">
                    {op.requester}
                  </td>
                  <td className="px-5 py-3 text-xs text-[var(--g-text-secondary)]">
                    {op.legalBasisEvaluated}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-[var(--g-surface-subtle)] text-[var(--g-brand-3308)] border border-[var(--g-border-subtle)]"
                      style={{ borderRadius: "var(--g-radius-full)" }}
                    >
                      {op.riskAssessment}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-[var(--g-text-secondary)]">
                    {op.date}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className="inline-flex items-center px-2 py-0.5 text-xs font-semibold bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                      style={{ borderRadius: "var(--g-radius-full)" }}
                    >
                      {op.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
