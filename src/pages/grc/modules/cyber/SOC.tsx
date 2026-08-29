import { useState } from "react";
import { 
  Activity, ShieldAlert, Wifi, Terminal, Radar, 
  CheckCircle2, AlertTriangle, ExternalLink, Play, ArrowUpRight 
} from "lucide-react";
import { Link } from "react-router-dom";

interface ThreatDetection {
  id: string;
  timestamp: string;
  source: string;
  mitreTactic: string;
  mitreTechnique: string;
  severity: "Crítico" | "Alto" | "Medio" | "Bajo";
  description: string;
  status: "Bloqueado por EDR/SIEM" | "Bajo Análisis SOC" | "Escalado a Incidente";
  targetAsset: string;
}

const LIVE_DETECTIONS: ThreatDetection[] = [
  {
    id: "soc-det-01",
    timestamp: "2026-08-28 16:42:10",
    source: "Microsoft Sentinel / OTel Collector",
    mitreTactic: "TA0001 Initial Access",
    mitreTechnique: "T1190 Exploit Public-Facing App",
    severity: "Alto",
    description: "Múltiples intentos de SQL Injection contra el endpoint de tarificación pública de pólizas.",
    status: "Bloqueado por EDR/SIEM",
    targetAsset: "SRV-WAF-PROD-01 (10.240.12.15)",
  },
  {
    id: "soc-det-02",
    timestamp: "2026-08-28 15:10:04",
    source: "CrowdStrike Falcon EDR",
    mitreTactic: "TA0006 Credential Access",
    mitreTechnique: "T1110 Brute Force / Password Spraying",
    severity: "Medio",
    description: "Patrón anómalo de autenticaciones fallidas en portal de mediadores desde IPs anónimas Tor.",
    status: "Bajo Análisis SOC",
    targetAsset: "IDP-AUTH-CLUSTER-02",
  },
  {
    id: "soc-det-03",
    timestamp: "2026-08-28 13:22:50",
    source: "CloudTrail & GuardDuty",
    mitreTactic: "TA0010 Exfiltration",
    mitreTechnique: "T1567 Exfiltration Over Web Service",
    severity: "Crítico",
    description: "Descarga inusual de 12.000 registros desde el bucket de peritajes digitales hacia IP externa no reconocida.",
    status: "Escalado a Incidente",
    targetAsset: "s3-peritajes-docs-prod",
  },
];

export default function SOC() {
  const [activeTab, setActiveTab] = useState<"detections" | "siem">("detections");

  return (
    <div className="p-6 space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Radar className="h-6 w-6 text-[var(--g-brand-3308)]" />
            <h1 className="text-2xl font-bold text-[var(--g-text-primary)]">
              Centro de Operaciones de Seguridad (SOC & Threat Cockpit)
            </h1>
          </div>
          <p className="text-sm text-[var(--g-text-secondary)]">
            Supervisión continua de ciberamenazas, correlación SIEM/OTel y mapeo MITRE ATT&CK conforme a NIS2 y DORA.
          </p>
        </div>
        <Link
          to="/grc/incidentes/nuevo"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] transition-colors"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <span>Escalar a Incidente Formal</span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </header>

      {/* KPI Cards de Seguridad */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { label: "Nivel de Alerta Global", val: "NIVEL 2 (ELEVADO)", color: "text-[var(--status-warning)]" },
          { label: "Conector SIEM / OTel", val: "Conectado y Activo", color: "text-[var(--status-success)]" },
          { label: "Eventos Analizados 24h", val: "4.820.000 EPS", color: "text-[var(--g-brand-3308)]" },
          { label: "Detecciones Bloqueadas", val: "99.8%", color: "text-[var(--status-success)]" },
        ].map((k) => (
          <div
            key={k.label}
            className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-4"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="text-xs uppercase font-bold text-[var(--g-text-secondary)]">{k.label}</div>
            <div className={`text-lg font-bold my-1 ${k.color}`}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Integración SIEM Status Banner */}
      <div
        className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-5"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-[var(--status-success)] animate-ping" />
            <div>
              <h2 className="text-sm font-bold text-[var(--g-text-primary)]">
                Feed OTel / SIEM Microsoft Sentinel Activo
              </h2>
              <p className="text-xs text-[var(--g-text-secondary)]">
                Ingesta de telemetría de red, firewalls perimetrales, WAF, EDR e identidad con retención de logs inmutable WORM conforme a DORA.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div>
              <span className="text-[var(--g-text-secondary)]">Latencia de Ingesta:</span>{" "}
              <span className="font-mono font-semibold text-[var(--g-brand-3308)]">180 ms</span>
            </div>
            <div>
              <span className="text-[var(--g-text-secondary)]">Reglas de Detección:</span>{" "}
              <span className="font-mono font-semibold text-[var(--g-text-primary)]">240 Activas</span>
            </div>
          </div>
        </div>
      </div>

      {/* Feed de Detecciones en Tiempo Real */}
      <div
        className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] overflow-hidden"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="px-5 py-4 border-b border-[var(--g-border-subtle)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-[var(--g-brand-3308)]" />
            <h2 className="text-sm font-bold text-[var(--g-text-primary)]">
              Detecciones de Seguridad y Ciberamenazas Recientes
            </h2>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--g-surface-subtle)] border-b border-[var(--g-border-subtle)]">
                {["Timestamp / Fuente", "Táctica MITRE ATT&CK", "Severidad", "Descripción del Evento", "Activo Afectado", "Estado SOC"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-[var(--g-text-primary)] uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--g-border-subtle)]">
              {LIVE_DETECTIONS.map((det) => (
                <tr key={det.id} className="hover:bg-[var(--g-surface-subtle)]/50 transition-colors">
                  <td className="px-5 py-3 text-xs">
                    <div className="font-mono text-[var(--g-text-primary)]">{det.timestamp}</div>
                    <div className="text-[10px] text-[var(--g-text-secondary)]">{det.source}</div>
                  </td>
                  <td className="px-5 py-3 text-xs">
                    <div className="font-semibold text-[var(--g-brand-3308)]">{det.mitreTactic}</div>
                    <div className="font-mono text-[10px] text-[var(--g-text-secondary)]">{det.mitreTechnique}</div>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold ${
                        det.severity === "Crítico" 
                          ? "bg-[var(--status-error)] text-[var(--g-text-inverse)]" 
                          : det.severity === "Alto"
                          ? "bg-[var(--status-warning)] text-[var(--g-text-inverse)]"
                          : "bg-[var(--status-info)] text-[var(--g-text-inverse)]"
                      }`}
                      style={{ borderRadius: "var(--g-radius-full)" }}
                    >
                      {det.severity}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-[var(--g-text-primary)] max-w-sm">
                    {det.description}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-[var(--g-text-secondary)]">
                    {det.targetAsset}
                  </td>
                  <td className="px-5 py-3 text-xs">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 font-medium ${
                        det.status === "Escalado a Incidente"
                          ? "bg-[var(--status-error)]/10 text-[var(--status-error)] border border-[var(--status-error)]/30"
                          : "bg-[var(--g-surface-subtle)] text-[var(--g-brand-3308)] border border-[var(--g-border-subtle)]"
                      }`}
                      style={{ borderRadius: "var(--g-radius-sm)" }}
                    >
                      {det.status}
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
