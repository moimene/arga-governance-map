import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTour } from "@/context/TourContext";
import { useScope } from "@/context/ScopeContext";
import { useDashboardKpis, useDashboardAlerts, useUpcomingMeetings } from "@/hooks/useDashboardData";
import { useModuleStatus } from "@/hooks/useModuleStatus";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { KpiCard } from "@/components/KpiCard";
import { StatusBadge } from "@/components/StatusBadge";
import {
  AlertTriangle,
  Building,
  Clock,
  FileWarning,
  Play,
  ShieldAlert,
  Calendar,
  CheckSquare,
  Activity,
  Network,
  ArrowRight,
  CheckCircle,
  Compass,
  ClipboardList,
  Brain,
} from "lucide-react";
import { personalTasks, recentActivity } from "@/data/dashboard";
import { scopeData } from "@/data/scopeData";
import { esgGroupScore, esgTotals } from "@/data/esg";
import { socialAverages } from "@/data/esgSocial";
import { Leaf } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const { start, step, completed } = useTour();
  const { scope } = useScope();
  const data = scopeData[scope];
  const navigate = useNavigate();

  const { data: kpis } = useDashboardKpis();
  const { data: alerts = [] } = useDashboardAlerts();
  const { data: meetings = [] } = useUpcomingMeetings();
  const { data: moduleStatus } = useModuleStatus();

  // Animate KPIs on scope change
  const [animKey, setAnimKey] = useState(0);
  useEffect(() => { setAnimKey((k) => k + 1); }, [scope]);

  const alertTone = (t: string): "critical" | "warning" =>
    t === "error" ? "critical" : "warning";
  const alertDot = (t: string) =>
    t === "error" ? "bg-destructive" : t === "warning" ? "bg-status-warning" : "bg-primary";
  const alertLabel = (t: string) =>
    t === "error" ? "CRÍTICA" : t === "warning" ? "ALERTA" : "INFO";

  const fmtMeetingDate = (iso: string) =>
    new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });

  const label = step > 0 ? "Continuar tour" : completed ? "↺ Repetir Tour" : "Iniciar Tour del Sistema";

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Buen día, Lucía</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Vista de <span className="font-medium text-foreground">{scope}</span> — operación al {new Date().toLocaleDateString("es-ES")}.
          </p>
        </div>
        <Button onClick={start} className="gap-2 shadow-sm">
          <Play className="h-4 w-4 fill-current" />
          {label}
        </Button>
      </div>

      {/* KPIs */}
      <div key={animKey} className="grid grid-cols-5 gap-4 animate-fade-in">
        <KpiCard label="Entidades activas" value={kpis?.entidades ?? data.entidades} icon={Building} tone="primary" to="/entidades" />
        <KpiCard label="Mandatos próximos a vencer" value={kpis?.mandatosVencimiento ?? data.mandatosVencimiento} icon={Clock} tone="warning" to="/organos" />
        <KpiCard label="Políticas pendientes de revisión" value={kpis?.politicasPendientes ?? data.politicasPendientes} icon={FileWarning} tone="warning" to="/politicas" />
        <KpiCard label="Hallazgos abiertos" value={kpis?.hallazgosAbiertos ?? data.hallazgosAbiertos} icon={AlertTriangle} tone="critical" to="/hallazgos" />
        <KpiCard label="Excepciones / Delegaciones caducadas" value={kpis?.delegacionesCaducadas ?? data.excepcionesActivas} icon={ShieldAlert} tone="critical" to="/delegaciones" />
      </div>

      {/* Mid row */}
      <div className="mt-6 grid grid-cols-12 gap-6">
        {/* Alertas críticas */}
        <Card className={cn(
          "col-span-8 overflow-hidden",
          alerts.length > 0 ? "border-l-4 border-l-destructive" : "border-l-4 border-l-status-active",
        )}>
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className={cn("h-4 w-4", alerts.length > 0 ? "text-destructive" : "text-status-active")} />
              <h2 className="text-sm font-semibold">Alertas críticas</h2>
            </div>
            {alerts.length > 0 && (
              <Link to="/notificaciones" className="text-xs font-medium text-primary hover:underline">Ver todas</Link>
            )}
          </div>
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 bg-status-active-bg/50 px-5 py-12 text-center">
              <CheckCircle className="h-10 w-10 text-status-active" />
              <p className="text-sm font-medium text-foreground">No hay alertas críticas en este ámbito.</p>
              <p className="text-xs text-muted-foreground">Operación nominal en {scope}.</p>
            </div>
          ) : (
            <ul key={animKey} className="divide-y divide-border animate-fade-in">
              {alerts.map((a, i) => (
                <li key={a.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-accent/40">
                  <button
                    type="button"
                    onClick={() => a.route && navigate(a.route)}
                    className="flex flex-1 items-start gap-3 text-left"
                  >
                    <span className={cn("mt-1 inline-block h-2 w-2 rounded-full", alertDot(a.type), i === 0 && a.type === "error" && "pulse-ring")} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <StatusBadge label={alertLabel(a.type)} tone={alertTone(a.type)} pulse={i === 0 && a.type === "error"} />
                      </div>
                      <p className="mt-1 text-sm font-medium text-foreground">{a.title}</p>
                      {a.body && <p className="mt-0.5 text-xs text-muted-foreground">{a.body}</p>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Próximas reuniones */}
        <Card className="col-span-4 overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Próximas reuniones</h2>
            </div>
            <Link to="/organos" className="text-xs font-medium text-primary hover:underline">Ver agenda</Link>
          </div>
          <ul>
            {meetings.length === 0 && (
              <li className="px-5 py-6 text-center text-xs text-muted-foreground">Sin reuniones convocadas.</li>
            )}
            {meetings.map((m, i) => (
              <li
                key={m.id}
                className={cn(
                  "border-b border-border last:border-0 px-5 py-3 hover:bg-accent/40",
                  i === 0 && "border-l-4 border-l-primary bg-accent/40",
                )}
              >
                <Link to={`/organos/${m.body_slug}`} className="block">
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-xs text-muted-foreground">{fmtMeetingDate(m.scheduled_start)}</span>
                    <StatusBadge label={m.status} tone="info" />
                  </div>
                  <div className="mt-1 text-sm font-medium text-foreground">{m.body_name}</div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="mt-6 grid grid-cols-12 gap-6">
        {/* Tareas */}
        <Card className="col-span-6 overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Mis tareas pendientes</h2>
            </div>
            <span className="text-xs text-muted-foreground">5 tareas</span>
          </div>
          <ul>
            {personalTasks.map((t, i) => (
              <li key={i} className="flex items-start gap-3 border-b border-border last:border-0 px-5 py-3 hover:bg-accent/40">
                <input type="checkbox" className="mt-1 h-4 w-4 rounded border-border accent-primary" />
                <div className="flex-1">
                  <div className="text-sm text-foreground">{t.text}</div>
                  <div
                    className={cn(
                      "mt-0.5 text-xs font-medium",
                      t.level === "overdue" && "text-destructive",
                      t.level === "warning" && "text-status-warning",
                      t.level === "normal" && "text-muted-foreground",
                    )}
                  >
                    Vence: {t.due}
                    {t.level === "overdue" && " · Vencida"}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        {/* Mini governance map */}
        <Card className="col-span-3 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-5 py-3">
            <Network className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Governance Map</h2>
          </div>
          <div className="px-4 py-5">
            <svg viewBox="0 0 240 200" className="w-full">
              <line x1="120" y1="40" x2="50" y2="130" stroke="hsl(var(--border))" strokeWidth="1.5" />
              <line x1="120" y1="40" x2="120" y2="130" stroke="hsl(var(--border))" strokeWidth="1.5" />
              <line x1="120" y1="40" x2="190" y2="130" stroke="hsl(var(--border))" strokeWidth="1.5" />
              <line x1="50" y1="155" x2="50" y2="175" stroke="hsl(var(--destructive))" strokeWidth="1.5" strokeDasharray="3 2" />
              <g>
                <rect x="70" y="20" width="100" height="36" rx="6" fill="hsl(var(--primary))" />
                <text x="120" y="42" textAnchor="middle" fontSize="11" fontWeight="600" fill="white">ARGA Seguros</text>
              </g>
              <g>
                <rect x="15" y="130" width="70" height="28" rx="6" fill="hsl(var(--accent))" stroke="hsl(var(--primary)/0.3)" />
                <text x="50" y="148" textAnchor="middle" fontSize="10" fill="hsl(var(--foreground))">España</text>
              </g>
              <g>
                <rect x="85" y="130" width="70" height="28" rx="6" fill="hsl(var(--accent))" stroke="hsl(var(--primary)/0.3)" />
                <text x="120" y="148" textAnchor="middle" fontSize="10" fill="hsl(var(--foreground))">LATAM</text>
              </g>
              <g>
                <rect x="155" y="130" width="70" height="28" rx="6" fill="hsl(var(--accent))" stroke="hsl(var(--primary)/0.3)" />
                <text x="190" y="148" textAnchor="middle" fontSize="10" fill="hsl(var(--foreground))">RE</text>
              </g>
              <g>
                <rect x="15" y="172" width="70" height="22" rx="6" fill="hsl(var(--status-critical-bg))" stroke="hsl(var(--destructive))" />
                <text x="50" y="187" textAnchor="middle" fontSize="9" fontWeight="600" fill="hsl(var(--destructive))">Brasil ⚠</text>
              </g>
            </svg>
          </div>
          <Link
            to="/governance-map"
            className="flex items-center justify-center gap-1 border-t border-border py-2.5 text-xs font-medium text-primary hover:bg-accent/40"
          >
            Ver mapa completo <ArrowRight className="h-3 w-3" />
          </Link>
        </Card>

        {/* Actividad */}
        <Card className="col-span-3 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-5 py-3">
            <Activity className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Actividad reciente</h2>
          </div>
          <ul className="px-5 py-3">
            {recentActivity.map((a, i) => (
              <li key={i} className="relative flex gap-3 pb-3 last:pb-0">
                <div className="flex flex-col items-center">
                  <span className="mt-1.5 h-2 w-2 rounded-full bg-primary" />
                  {i < recentActivity.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
                </div>
                <div className="flex-1 pb-2">
                  <div className="text-xs leading-snug text-foreground">{a.text}</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{a.time}</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Estado de Módulos Garrigues — cross-module KPIs */}
      <div className="mt-6">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">Estado de Módulos</h2>
          <span className="text-xs text-muted-foreground">Garrigues Platform</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Secretaría */}
          <Link to="/secretaria">
            <Card className="overflow-hidden hover:border-primary/50 transition-colors cursor-pointer group">
              <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                  <ClipboardList className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm font-semibold text-foreground group-hover:underline">Secretaría</span>
                <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="grid grid-cols-2 divide-x divide-border">
                <div className="px-4 py-3">
                  <div className="text-lg font-bold tabular-nums text-foreground">
                    {moduleStatus?.secretaria.convocatoriasEmitidas ?? "—"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">Convoc. emitidas</div>
                </div>
                <div className="px-4 py-3">
                  <div className={cn(
                    "text-lg font-bold tabular-nums",
                    (moduleStatus?.secretaria.acuerdosPendientes ?? 0) > 0 ? "text-status-warning" : "text-foreground"
                  )}>
                    {moduleStatus?.secretaria.acuerdosPendientes ?? "—"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">Acuerdos pend.</div>
                </div>
              </div>
            </Card>
          </Link>

          {/* GRC Compass */}
          <Link to="/grc">
            <Card className="overflow-hidden hover:border-primary/50 transition-colors cursor-pointer group">
              <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                  <Compass className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm font-semibold text-foreground group-hover:underline">GRC Compass</span>
                <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="grid grid-cols-2 divide-x divide-border">
                <div className="px-4 py-3">
                  <div className={cn(
                    "text-lg font-bold tabular-nums",
                    (moduleStatus?.grc.incidentesDoraAbiertos ?? 0) > 0 ? "text-destructive" : "text-foreground"
                  )}>
                    {moduleStatus?.grc.incidentesDoraAbiertos ?? "—"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">Incid. DORA abiert.</div>
                </div>
                <div className="px-4 py-3">
                  <div className={cn(
                    "text-lg font-bold tabular-nums",
                    (moduleStatus?.grc.notificacionesUrgentes ?? 0) > 0 ? "text-status-warning" : "text-foreground"
                  )}>
                    {moduleStatus?.grc.notificacionesUrgentes ?? "—"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">Notif. &lt;72h</div>
                </div>
              </div>
            </Card>
          </Link>

          {/* AI Governance */}
          <Link to="/ai-governance">
            <Card className="overflow-hidden hover:border-primary/50 transition-colors cursor-pointer group">
              <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                  <Brain className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm font-semibold text-foreground group-hover:underline">AI Governance</span>
                <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="grid grid-cols-2 divide-x divide-border">
                <div className="px-4 py-3">
                  <div className={cn(
                    "text-lg font-bold tabular-nums",
                    (moduleStatus?.aiGovernance.altosNoAprobados ?? 0) > 0 ? "text-destructive" : "text-foreground"
                  )}>
                    {moduleStatus?.aiGovernance.altosNoAprobados ?? "—"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">Alto sin eval.</div>
                </div>
                <div className="px-4 py-3">
                  <div className={cn(
                    "text-lg font-bold tabular-nums",
                    (moduleStatus?.aiGovernance.incidentesAbiertos ?? 0) > 0 ? "text-status-warning" : "text-foreground"
                  )}>
                    {moduleStatus?.aiGovernance.incidentesAbiertos ?? "—"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">Incid. abiertos</div>
                </div>
              </div>
            </Card>
          </Link>

          {/* SII */}
          <Link to="/sii">
            <Card className="overflow-hidden hover:border-primary/50 transition-colors cursor-pointer group">
              <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-status-warning/10">
                  <AlertTriangle className="h-4 w-4 text-status-warning" />
                </div>
                <span className="text-sm font-semibold text-foreground group-hover:underline">SII</span>
                <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="grid grid-cols-1">
                <div className="px-4 py-3">
                  <div className={cn(
                    "text-lg font-bold tabular-nums",
                    (moduleStatus?.sii.casosAbiertos ?? 0) > 0 ? "text-status-warning" : "text-foreground"
                  )}>
                    {moduleStatus?.sii.casosAbiertos ?? "—"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">Casos abiertos</div>
                </div>
              </div>
            </Card>
          </Link>
        </div>
      </div>

      {/* ESG mini-summary */}
      <div className="mt-6">
        <Card className="overflow-hidden border-l-4 border-l-status-active">
          <Link to="/esg" className="group flex items-center justify-between gap-6 px-5 py-4 hover:bg-accent/40">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-status-active/10">
                <Leaf className="h-5 w-5 text-status-active" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground group-hover:underline">ESG — Sostenibilidad e Impacto</h2>
                <p className="text-xs text-muted-foreground">Métricas Environmental, Social y Governance del Grupo.</p>
              </div>
            </div>
            <div className="flex items-center gap-8">
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Score ESG</div>
                <div className="text-2xl font-bold tabular-nums text-status-active">{esgGroupScore}</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Scope 1+2 (tCO₂e)</div>
                <div className="text-2xl font-bold tabular-nums text-status-warning">
                  {(esgTotals.scope1 + esgTotals.scope2).toLocaleString("es-ES")}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Mujeres en Consejos</div>
                <div className="text-2xl font-bold tabular-nums text-primary">{socialAverages.boardWomenPct}%</div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
        </Card>
      </div>
    </div>
  );
}
