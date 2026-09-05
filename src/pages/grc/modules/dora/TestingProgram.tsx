import { useState } from "react";
import { 
  ShieldCheck, AlertTriangle, CheckCircle2, Clock, 
  Terminal, Flame, FileCheck, Layers, ExternalLink 
} from "lucide-react";
import { DemoFixtureNotice } from "@/components/grc/DemoFixtureNotice";

interface ResilienceTestItem {
  id: string;
  name: string;
  scope: string;
  testType: "TLPT / Red Team (TIBER-EU)" | "Análisis de Vulnerabilidades" | "Simulacro Switchover DRP" | "Revisión de Código / SAST" | "Auditoría de Red y Firewall";
  criticalFunction: string;
  frequency: string;
  lastExecuted: string;
  nextScheduled: string;
  findingsCount: number;
  criticalFindings: number;
  status: "Completado" | "En Curso" | "Programado" | "Requiere Remediación";
  thirdPartyInvolved: string;
  leadTester: string;
}

const TESTS_REGISTRY: ResilienceTestItem[] = [
  {
    id: "test-01",
    name: "TLPT Avanzado Basado en Amenazas (TIBER-ES / DORA Art. 26)",
    scope: "Core Asegurador, Pasarela de Pagos y Acceso Sede Electrónica",
    testType: "TLPT / Red Team (TIBER-EU)",
    criticalFunction: "Suscripción y Liquidación de Siniestros",
    frequency: "Trienal (conforme designación DORA)",
    lastExecuted: "2025-11-15",
    nextScheduled: "2026-11-15",
    findingsCount: 4,
    criticalFindings: 0,
    status: "Completado",
    thirdPartyInvolved: "Proveedor Cloud Primario + Pasarela Pagos",
    leadTester: "Probador Externo Certificado (CREST)",
  },
  {
    id: "test-02",
    name: "Simulacro Anual de Switchover a CPD Secundario y DRP",
    scope: "Infraestructura Cloud Híbrida y Bases de Datos Core",
    testType: "Simulacro Switchover DRP",
    criticalFunction: "Continuidad Operativa Global",
    frequency: "Anual obligatoria",
    lastExecuted: "2026-02-28",
    nextScheduled: "2027-02-28",
    findingsCount: 2,
    criticalFindings: 0,
    status: "Completado",
    thirdPartyInvolved: "Operador de Datacenter",
    leadTester: "Equipo Interno de Continuidad & CISO",
  },
  {
    id: "test-03",
    name: "Escaneo Continuo de Vulnerabilidades e Infraestructura Perimetral",
    scope: "APIs Públicas, Portales de Mediadores y Clientes",
    testType: "Análisis de Vulnerabilidades",
    criticalFunction: "Distribución y Atención al Cliente",
    frequency: "Mensual / Continuo",
    lastExecuted: "2026-08-15",
    nextScheduled: "2026-09-15",
    findingsCount: 7,
    criticalFindings: 1,
    status: "Requiere Remediación",
    thirdPartyInvolved: "SOC Externo",
    leadTester: "SOC / CISO",
  },
  {
    id: "test-04",
    name: "Auditoría de Código y Seguridad de Aplicaciones Móviles",
    scope: "App Móvil de Clientes y Portal de Peritaje Digital",
    testType: "Revisión de Código / SAST",
    criticalFunction: "Tramitación de Siniestros y Clientes",
    frequency: "Por release y Semestral",
    lastExecuted: "2026-05-10",
    nextScheduled: "2026-11-10",
    findingsCount: 3,
    criticalFindings: 0,
    status: "Completado",
    thirdPartyInvolved: "Desarrollador Software Tercero",
    leadTester: "Seguridad de Aplicaciones",
  },
];

export default function TestingProgram() {
  const [filterType, setFilterType] = useState<string>("ALL");

  const filteredTests = filterType === "ALL" 
    ? TESTS_REGISTRY 
    : TESTS_REGISTRY.filter(t => t.testType.includes(filterType));

  return (
    <div className="p-6 space-y-6">
      <DemoFixtureNotice>
        El programa de pruebas de resiliencia de esta pantalla es un guion fijo del código. Ninguna de estas pruebas se ha ejecutado ni consta en ninguna tabla.
      </DemoFixtureNotice>
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="h-6 w-6 text-[var(--g-brand-3308)]" />
            <h1 className="text-2xl font-bold text-[var(--g-text-primary)]">
              Programa de Pruebas de Resiliencia y TLPT (DORA Arts. 24-27)
            </h1>
          </div>
          <p className="text-sm text-[var(--g-text-secondary)]">
            Registro de pruebas anuales de resiliencia operativa digital, simulacros DRP y pruebas de penetración avanzadas TLPT.
          </p>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { label: "Pruebas Registradas", val: TESTS_REGISTRY.length, sub: "Cobertura de sistemas críticos" },
          { label: "TLPT Avanzado", val: "Activo (TIBER)", sub: "Conforme a DORA Art. 26" },
          { label: "Simulacros DRP", val: "100% Ejecutados", sub: "RTO verificado < 4h" },
          { label: "Vulnerabilidades en SLA", val: "94.2%", sub: "Remediación priorizada" },
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

      {/* Tabla de Pruebas */}
      <div
        className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] overflow-hidden"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="px-5 py-4 border-b border-[var(--g-border-subtle)] flex items-center justify-between">
          <h2 className="text-sm font-bold text-[var(--g-text-primary)]">
            Catálogo y Calendario de Pruebas de Resiliencia
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--g-text-secondary)]">Filtrar:</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="text-xs bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] text-[var(--g-text-primary)] px-2 py-1"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <option value="ALL">Todas las tipologías</option>
              <option value="TLPT">TLPT / Threat-Led</option>
              <option value="Vulnerabilidades">Vulnerabilidades</option>
              <option value="DRP">Simulacro DRP</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--g-surface-subtle)] border-b border-[var(--g-border-subtle)]">
                {["Prueba / Alcance", "Tipología DORA", "Función Crítica", "Terceros Involucrados", "Última / Próxima", "Estado"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-[var(--g-text-primary)] uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--g-border-subtle)]">
              {filteredTests.map((t) => {
                const isRemediation = t.status === "Requiere Remediación";
                return (
                  <tr key={t.id} className="hover:bg-[var(--g-surface-subtle)]/50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="font-semibold text-[var(--g-text-primary)]">{t.name}</div>
                      <div className="text-xs text-[var(--g-text-secondary)]">{t.scope}</div>
                    </td>
                    <td className="px-5 py-3 text-xs text-[var(--g-brand-3308)] font-medium">
                      {t.testType}
                    </td>
                    <td className="px-5 py-3 text-xs text-[var(--g-text-secondary)]">
                      {t.criticalFunction}
                    </td>
                    <td className="px-5 py-3 text-xs text-[var(--g-text-secondary)]">
                      {t.thirdPartyInvolved}
                    </td>
                    <td className="px-5 py-3 text-xs">
                      <div>Ejecutado: {t.lastExecuted}</div>
                      <div className="text-[var(--g-brand-3308)] font-medium">Próxima: {t.nextScheduled}</div>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 ${
                          isRemediation
                            ? "bg-[var(--status-warning)] text-[var(--g-text-inverse)]"
                            : "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                        }`}
                        style={{ borderRadius: "var(--g-radius-full)" }}
                      >
                        {isRemediation ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                        {t.status}
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
