import { useTour } from "@/context/TourContext";
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
} from "lucide-react";
import { upcomingMeetings, personalTasks, recentActivity } from "@/data/dashboard";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const { start, step } = useTour();

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      {/* Header row */}
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Buen día, Lucía</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Vista del Grupo ARGA — operación al {new Date().toLocaleDateString("es-ES")}.
          </p>
        </div>
        <Button onClick={start} className="gap-2 shadow-sm">
          <Play className="h-4 w-4 fill-current" />
          {step > 0 ? "Continuar tour" : "Iniciar Tour del Sistema"}
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-5 gap-4">
        <KpiCard label="Entidades activas" value={25} icon={Building} tone="primary" to="/entidades" />
        <KpiCard label="Mandatos próximos a vencer" value={7} icon={Clock} tone="warning" to="/organos" />
        <KpiCard label="Políticas pendientes de revisión" value={4} icon={FileWarning} tone="warning" to="/politicas" />
        <KpiCard label="Hallazgos abiertos" value={10} icon={AlertTriangle} tone="critical" to="/hallazgos" />
        <KpiCard label="Excepciones regulatorias activas" value={2} icon={ShieldAlert} tone="critical" to="/obligaciones" />
      </div>

      {/* Mid row */}
      <div className="mt-6 grid grid-cols-12 gap-6">
        {/* Alertas críticas */}
        <Card className="col-span-8 overflow-hidden border-l-4 border-l-destructive">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <h2 className="text-sm font-semibold">Alertas críticas</h2>
            </div>
            <Link to="/hallazgos" className="text-xs font-medium text-primary hover:underline">
              Ver todas
            </Link>
          </div>
          <ul className="divide-y divide-border">
            <li className="flex items-start gap-3 px-5 py-3.5 hover:bg-accent/40">
              <Link to="/hallazgos/HALL-008" className="flex flex-1 items-start gap-3">
                <span className="mt-1 inline-block h-2 w-2 rounded-full bg-destructive pulse-ring" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-foreground">HALL-008</span>
                    <StatusBadge label="CRÍTICA" pulse />
                  </div>
                  <p className="mt-1 text-sm text-foreground">
                    Conflicto de interés no declarado — inversión inmobiliaria ARGA Brasil
                  </p>
                </div>
              </Link>
            </li>
            <li className="flex items-start gap-3 px-5 py-3.5 hover:bg-accent/40">
              <Link to="/hallazgos/HALL-003" className="flex flex-1 items-start gap-3">
                <span className="mt-1 inline-block h-2 w-2 rounded-full bg-destructive" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-foreground">HALL-003</span>
                    <StatusBadge label="ALTA" />
                  </div>
                  <p className="mt-1 text-sm text-foreground">
                    Delegación caducada — D. Carlos Eduardo Vaz (Director Regional LATAM)
                  </p>
                </div>
              </Link>
            </li>
            <li className="flex items-start gap-3 px-5 py-3.5 hover:bg-accent/40">
              <Link to="/obligaciones" className="flex flex-1 items-start gap-3">
                <span className="mt-1 inline-block h-2 w-2 rounded-full bg-destructive" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-foreground">OBL-DORA-003</span>
                    <StatusBadge label="SIN CONTROL" />
                  </div>
                  <p className="mt-1 text-sm text-foreground">
                    Resiliencia operativa digital — sin control específico asignado
                  </p>
                </div>
              </Link>
            </li>
            <li className="flex items-start gap-3 px-5 py-3.5 hover:bg-accent/40">
              <Link to="/hallazgos/HALL-010" className="flex flex-1 items-start gap-3">
                <span className="mt-1 inline-block h-2 w-2 rounded-full bg-status-warning" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-foreground">HALL-010</span>
                    <StatusBadge label="EN REVISIÓN" tone="warning" />
                  </div>
                  <p className="mt-1 text-sm text-foreground">
                    Excepción regulatoria de Turquía vencida — 22/04/2026
                  </p>
                </div>
              </Link>
            </li>
          </ul>
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
            {upcomingMeetings.map((m, i) => (
              <li
                key={i}
                className={cn(
                  "border-b border-border last:border-0 px-5 py-3 hover:bg-accent/40",
                  m.highlight && "border-l-4 border-l-primary bg-accent/40",
                )}
              >
                <Link to={m.link ?? "/organos"} className="block">
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-xs text-muted-foreground">{m.date}</span>
                    <StatusBadge label={m.status} tone={m.status === "Convocada" ? "info" : "neutral"} />
                  </div>
                  <div className="mt-1 text-sm font-medium text-foreground">{m.organ}</div>
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
              {/* edges */}
              <line x1="120" y1="40" x2="50" y2="130" stroke="hsl(var(--border))" strokeWidth="1.5" />
              <line x1="120" y1="40" x2="120" y2="130" stroke="hsl(var(--border))" strokeWidth="1.5" />
              <line x1="120" y1="40" x2="190" y2="130" stroke="hsl(var(--border))" strokeWidth="1.5" />
              <line x1="50" y1="155" x2="50" y2="175" stroke="hsl(var(--destructive))" strokeWidth="1.5" strokeDasharray="3 2" />
              {/* root */}
              <g>
                <rect x="70" y="20" width="100" height="36" rx="6" fill="hsl(var(--primary))" />
                <text x="120" y="42" textAnchor="middle" fontSize="11" fontWeight="600" fill="white">ARGA Seguros</text>
              </g>
              {/* children */}
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
    </div>
  );
}
