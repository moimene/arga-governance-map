import { useState } from "react";
import { 
  ClipboardCheck, CheckCircle2, Clock, Calendar, 
  ShieldCheck, AlertTriangle, FileText, ExternalLink 
} from "lucide-react";
import { Link } from "react-router-dom";

interface AuditEngagement {
  id: string;
  code: string;
  title: string;
  quarter: "Q1" | "Q2" | "Q3" | "Q4";
  scope: string;
  frameworkRef: string;
  auditorLead: string;
  status: "Completada" | "En Ejecución" | "Planificada" | "En Informe Final";
  approvalByCommittee: "Aprobada en Plan Anual" | "Ad-hoc Ratificada";
  findingsTotal: number;
  criticalFindings: number;
}

const AUDIT_PLAN_2026: AuditEngagement[] = [
  {
    id: "aud-01",
    code: "AUD-2026-01",
    title: "Auditoría de Gobernanza y Marco de Gestión del Riesgo TIC (DORA)",
    quarter: "Q1",
    scope: "Gobierno TIC, gestión de incidentes y perímetro regulatorio",
    frameworkRef: "DORA Arts. 5-16 · IIA 2024 Dominio IV",
    auditorLead: "Auditor Senior de Sistemas TIC",
    status: "Completada",
    approvalByCommittee: "Aprobada en Plan Anual",
    findingsTotal: 3,
    criticalFindings: 0,
  },
  {
    id: "aud-02",
    code: "AUD-2026-02",
    title: "Auditoría de Cálculo de Provisiones Técnicas y Solvencia II",
    quarter: "Q2",
    scope: "Modelos actuariales, calidad de datos y cálculo de SCR",
    frameworkRef: "Solvencia II Arts. 75-86 · ROSSP",
    auditorLead: "Auditor Actuarial Senior",
    status: "Completada",
    approvalByCommittee: "Aprobada en Plan Anual",
    findingsTotal: 2,
    criticalFindings: 0,
  },
  {
    id: "aud-03",
    code: "AUD-2026-03",
    title: "Auditoría de Terceros TIC, Cloud y Cadena de Subcontratación",
    quarter: "Q3",
    scope: "Registro DORA de información, due diligence y cláusulas",
    frameworkRef: "DORA Arts. 28-30 · RTS Subcontratación",
    auditorLead: "Auditor de Riesgo Operacional y TI",
    status: "En Ejecución",
    approvalByCommittee: "Aprobada en Plan Anual",
    findingsTotal: 4,
    criticalFindings: 1,
  },
  {
    id: "aud-04",
    code: "AUD-2026-04",
    title: "Auditoría del Modelo de Prevención Penal y Canal Interno",
    quarter: "Q4",
    scope: "Eficacia de controles penales (Art. 31 bis CP) y Ley 2/2023",
    frameworkRef: "Código Penal · UNE 19601 · Ley 2/2023",
    auditorLead: "Auditor Legal y Cumplimiento",
    status: "Planificada",
    approvalByCommittee: "Aprobada en Plan Anual",
    findingsTotal: 0,
    criticalFindings: 0,
  },
];

export default function Program() {
  const [selectedQuarter, setSelectedQuarter] = useState<string>("ALL");

  const filtered = selectedQuarter === "ALL" 
    ? AUDIT_PLAN_2026 
    : AUDIT_PLAN_2026.filter(a => a.quarter === selectedQuarter);

  return (
    <div className="p-6 space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ClipboardCheck className="h-6 w-6 text-[var(--g-brand-3308)]" />
            <h1 className="text-2xl font-bold text-[var(--g-text-primary)]">
              Plan Anual de Auditoría Interna (Estándares Globales IIA 2024)
            </h1>
          </div>
          <p className="text-sm text-[var(--g-text-secondary)]">
            Programación anual de auditorías aprobada por la Comisión de Auditoría y Control conforme a Solvencia II Art. 47 y QAIP.
          </p>
        </div>
        <Link
          to="/grc/m/audit/operate/findings"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] transition-colors"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <span>Ver Hallazgos y Planes de Acción</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </header>

      {/* KPI Cards de Auditoría */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { label: "Misiones Planificadas", val: AUDIT_PLAN_2026.length, sub: "100% Universo Crítico" },
          { label: "Ejecutadas / En Curso", val: "75%", sub: "Q1 y Q2 completadas" },
          { label: "Marco Metodológico", val: "IIA 2024 Global", sub: "QAIP quinquenal vigente" },
          { label: "Independencia Estatutaria", val: "Garantizada", sub: "Reporte directo a Comisión" },
        ].map((k) => (
          <div
            key={k.label}
            className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-4"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="text-xs uppercase font-bold text-[var(--g-text-secondary)]">{k.label}</div>
            <div className="text-2xl font-bold text-[var(--g-brand-3308)] my-1">{k.val}</div>
            <div className="text-[11px] text-[var(--g-text-secondary)]">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabla del Plan de Auditoría */}
      <div
        className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] overflow-hidden"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="px-5 py-4 border-b border-[var(--g-border-subtle)] flex items-center justify-between">
          <h2 className="text-sm font-bold text-[var(--g-text-primary)]">
            Calendario de Misiones y Cobertura por Trimestre
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--g-text-secondary)]">Trimestre:</span>
            <select
              value={selectedQuarter}
              onChange={(e) => setSelectedQuarter(e.target.value)}
              className="text-xs bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] text-[var(--g-text-primary)] px-2 py-1"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <option value="ALL">Todos los trimestres (Q1-Q4)</option>
              <option value="Q1">Q1</option>
              <option value="Q2">Q2</option>
              <option value="Q3">Q3</option>
              <option value="Q4">Q4</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--g-surface-subtle)] border-b border-[var(--g-border-subtle)]">
                {["Código / Título de Auditoría", "Trimestre", "Alcance y Referencia", "Auditor Principal", "Hallazgos", "Estado"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-[var(--g-text-primary)] uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--g-border-subtle)]">
              {filtered.map((a) => {
                const isDone = a.status === "Completada";
                const isRunning = a.status === "En Ejecución";
                return (
                  <tr key={a.id} className="hover:bg-[var(--g-surface-subtle)]/50 transition-colors">
                    <td className="px-5 py-3">
                      <span className="font-mono text-xs font-bold text-[var(--g-brand-3308)] block">
                        {a.code}
                      </span>
                      <span className="font-semibold text-[var(--g-text-primary)] text-xs">
                        {a.title}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs font-bold text-[var(--g-brand-3308)]">
                      {a.quarter}
                    </td>
                    <td className="px-5 py-3 text-xs">
                      <div className="text-[var(--g-text-primary)]">{a.scope}</div>
                      <div className="font-mono text-[10px] text-[var(--g-text-secondary)]">{a.frameworkRef}</div>
                    </td>
                    <td className="px-5 py-3 text-xs text-[var(--g-text-secondary)]">
                      {a.auditorLead}
                    </td>
                    <td className="px-5 py-3 text-xs">
                      {a.findingsTotal > 0 ? (
                        <span className="text-[var(--g-brand-3308)] font-semibold">
                          {a.findingsTotal} hallazgos {a.criticalFindings > 0 && `(${a.criticalFindings} crítico)`}
                        </span>
                      ) : (
                        <span className="text-[var(--g-text-secondary)]">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 ${
                          isDone
                            ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                            : isRunning
                            ? "bg-[var(--status-info)] text-[var(--g-text-inverse)]"
                            : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]"
                        }`}
                        style={{ borderRadius: "var(--g-radius-full)" }}
                      >
                        {isDone && <CheckCircle2 className="h-3 w-3" />}
                        {isRunning && <Clock className="h-3 w-3" />}
                        {a.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
