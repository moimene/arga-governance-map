import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Brain,
  CheckCircle2,
  ClipboardList,
  Compass,
  Database,
  FileWarning,
  Link2,
  LockKeyhole,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { NotificationRow } from "@/hooks/useDashboardData";
import type { ModuleStatus } from "@/hooks/useModuleStatus";
import {
  consoleDataContracts,
  consoleSourceNotes,
  type ConsoleSourcePosture,
} from "@/lib/arga-console/contracts";
import {
  getPlatformReadinessSummary,
  platformReadinessLanes,
  type PlatformLaneStatus,
} from "@/lib/arga-console/platform-readiness";

type WorkTone = "danger" | "warning" | "success" | "neutral";

interface ConsoleWorkItem {
  id: string;
  label: string;
  detail: string;
  owner: string;
  source: string;
  route: string;
  count: number | undefined;
  tone: WorkTone;
}

interface ErpConsolePanelProps {
  moduleStatus: ModuleStatus | undefined;
  alerts: NotificationRow[];
}

const postureLabel: Record<ConsoleSourcePosture, string> = {
  Cloud: "Cloud",
  legacy: "Legacy",
  "local pending": "Local pendiente",
  "generated types only": "Solo tipos",
  none: "Contrato pendiente",
};

const postureClass: Record<ConsoleSourcePosture, string> = {
  Cloud: "bg-status-active-bg text-status-active",
  legacy: "bg-status-warning/10 text-status-warning",
  "local pending": "bg-secondary text-muted-foreground",
  "generated types only": "bg-secondary text-muted-foreground",
  none: "bg-destructive/10 text-destructive",
};

const laneStatusLabel: Record<PlatformLaneStatus, string> = {
  operational: "Operativo",
  read_only: "Read-only",
  pending: "Pendiente",
  hold: "HOLD",
};

const laneStatusClass: Record<PlatformLaneStatus, string> = {
  operational: "bg-status-active-bg text-status-active",
  read_only: "bg-secondary text-muted-foreground",
  pending: "bg-status-warning/10 text-status-warning",
  hold: "bg-destructive/10 text-destructive",
};

function toneClass(tone: WorkTone) {
  if (tone === "danger") return "text-destructive bg-destructive/10";
  if (tone === "warning") return "text-status-warning bg-status-warning/10";
  if (tone === "success") return "text-status-active bg-status-active-bg";
  return "text-muted-foreground bg-secondary";
}

function buildWorkItems(moduleStatus: ModuleStatus | undefined, alerts: NotificationRow[]): ConsoleWorkItem[] {
  const unreadAlerts = alerts.length;
  const acuerdos = moduleStatus?.secretaria.acuerdosPendientes;
  const dora = moduleStatus?.grc.incidentesDoraAbiertos;
  const ai = moduleStatus?.aiGovernance.altosNoAprobados;

  return [
    {
      id: "core-alerts",
      label: "Alertas no leídas",
      detail: "Prioridad desde notifications, con ruta al owner.",
      owner: "TGMS Core",
      source: "notifications",
      route: "/notificaciones",
      count: unreadAlerts,
      tone: unreadAlerts > 0 ? "warning" : "success",
    },
    {
      id: "secretaria-registry",
      label: "Acuerdos inscribibles",
      detail: "Pendientes de tramo registral en Secretaría.",
      owner: "Secretaría",
      source: "agreements",
      route: "/secretaria/tramitador",
      count: acuerdos,
      tone: (acuerdos ?? 0) > 0 ? "warning" : "success",
    },
    {
      id: "grc-dora",
      label: "Incidentes DORA abiertos",
      detail: "Lectura GRC legacy; escalada requiere contrato.",
      owner: "GRC Compass",
      source: "incidents",
      route: "/grc/incidentes",
      count: dora,
      tone: (dora ?? 0) > 0 ? "danger" : "success",
    },
    {
      id: "aims-high-risk",
      label: "IA alto riesgo sin evaluación",
      detail: "Compatibilidad AIMS legacy hasta Track E.",
      owner: "AIMS",
      source: "ai_systems + ai_risk_assessments",
      route: "/ai-governance/evaluaciones",
      count: ai,
      tone: (ai ?? 0) > 0 ? "danger" : "success",
    },
  ];
}

export function ErpConsolePanel({ moduleStatus, alerts }: ErpConsolePanelProps) {
  const workItems = buildWorkItems(moduleStatus, alerts);
  const readinessSummary = getPlatformReadinessSummary();
  const visibleContracts = consoleDataContracts.filter((contract) =>
    ["core-identity", "secretaria-agreements", "grc-incidents", "aims-systems", "cross-module-contracts"].includes(contract.id)
  );

  return (
    <section className="grid grid-cols-12 gap-4">
      <Card className="col-span-12 overflow-hidden lg:col-span-8">
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Consola General ARGA</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Bandeja ERP derivada de owners canónicos. {consoleSourceNotes.readModel}
            </p>
          </div>
          <span className="shrink-0 rounded-md bg-secondary px-2 py-1 text-[11px] font-medium text-muted-foreground">
            Read-only
          </span>
        </div>

        <div className="divide-y divide-border">
          {workItems.map((item) => (
            <Link
              key={item.id}
              to={item.route}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-3.5 transition-colors hover:bg-accent/40"
            >
              <span className={cn("flex h-9 w-9 items-center justify-center rounded-md", toneClass(item.tone))}>
                {item.id === "core-alerts" && <Bell className="h-4 w-4" />}
                {item.id === "secretaria-registry" && <ClipboardList className="h-4 w-4" />}
                {item.id === "grc-dora" && <Compass className="h-4 w-4" />}
                {item.id === "aims-high-risk" && <Brain className="h-4 w-4" />}
              </span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{item.label}</span>
                  <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {item.owner}
                  </span>
                  <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {item.source}
                  </span>
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{item.detail}</span>
              </span>
              <span className="flex items-center gap-3">
                <span className={cn("min-w-8 rounded-md px-2 py-1 text-center text-sm font-bold tabular-nums", toneClass(item.tone))}>
                  {item.count ?? "—"}
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </span>
            </Link>
          ))}
        </div>
      </Card>

      <Card className="col-span-12 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <LockKeyhole className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Postura de plataforma</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Estado ejecutivo por carril: operativo, read-only, pendiente o HOLD. No crea writes ni dependencias nuevas.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-md bg-status-active-bg px-2 py-1 font-semibold text-status-active">
              {readinessSummary.operational} operativo
            </span>
            <span className="rounded-md bg-secondary px-2 py-1 font-semibold text-muted-foreground">
              {readinessSummary.read_only} read-only
            </span>
            <span className="rounded-md bg-status-warning/10 px-2 py-1 font-semibold text-status-warning">
              {readinessSummary.pending} pendiente
            </span>
            <span className="rounded-md bg-destructive/10 px-2 py-1 font-semibold text-destructive">
              {readinessSummary.hold} HOLD
            </span>
          </div>
        </div>

        <div className="grid divide-y divide-border lg:grid-cols-5 lg:divide-x lg:divide-y-0">
          {platformReadinessLanes.map((lane) => (
            <Link key={lane.id} to={lane.route} className="flex min-h-[188px] flex-col justify-between p-4 transition-colors hover:bg-accent/40">
              <span>
                <span className="mb-3 flex items-start justify-between gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                    {lane.status === "hold" ? <FileWarning className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                  </span>
                  <span className={cn("shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold", laneStatusClass[lane.status])}>
                    {laneStatusLabel[lane.status]}
                  </span>
                </span>
                <span className="block text-sm font-semibold text-foreground">{lane.label}</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">{lane.summary}</span>
              </span>
              <span className="mt-4 flex flex-wrap gap-1.5">
                <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-semibold", postureClass[lane.sourcePosture])}>
                  {postureLabel[lane.sourcePosture]}
                </span>
                <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {lane.owner}
                </span>
                <span className="w-full text-[11px] leading-5 text-muted-foreground">{lane.nextAction}</span>
              </span>
            </Link>
          ))}
        </div>
      </Card>

      <Card className="col-span-12 overflow-hidden lg:col-span-4 lg:col-start-9 lg:row-start-1">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <Link2 className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Contratos de datos</h2>
        </div>
        <div className="divide-y divide-border">
          {visibleContracts.map((contract) => (
            <div key={contract.id} className="px-5 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-foreground">{contract.label}</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{contract.sourceTable}</div>
                </div>
                <span className={cn("shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold", postureClass[contract.sourcePosture])}>
                  {postureLabel[contract.sourcePosture]}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                {contract.evidence === "verifiable" ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-status-active" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 text-status-warning" />
                )}
                <span className="truncate">Owner: {contract.owner}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}
