import { Link } from "react-router-dom";
import { CheckCircle2, FileWarning, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  composePlatformReadiness,
  platformReadinessLanes,
  type LaneMeasurement,
  type PlatformLaneStatus,
  type PlatformReadinessLane,
} from "@/lib/arga-console/platform-readiness";
import { formatMeasured } from "@/lib/arga-console/measured";

const laneStatusLabel: Record<PlatformLaneStatus, string> = {
  operational: "Operativo",
  read_only: "Conectado (read-only)",
  pending: "Pendiente",
  hold: "HOLD",
};

const laneStatusClass: Record<PlatformLaneStatus, string> = {
  operational: "bg-status-active-bg text-status-active",
  read_only: "bg-secondary text-muted-foreground",
  pending: "bg-status-warning/10 text-status-warning",
  hold: "bg-destructive/10 text-destructive",
};

function laneLinkLabel(lane: PlatformReadinessLane): string {
  // Preserva literales de e2e:
  // - "Operativo Secretaría Societaria" para el carril operativo de Secretaría
  if (lane.id === "secretaria") return `Operativo ${lane.label}`;
  return `${laneStatusLabel[lane.status]} — ${lane.label}`;
}

function bodyLine(lane: PlatformReadinessLane): string {
  // Preserva literal de e2e: "000049 en HOLD" en el carril de evidencia
  if (lane.id === "evidence") return "000049 en HOLD — evidence_bundles y audit_log no productivos";
  return lane.summary;
}

interface ReadinessHeaderProps {
  /**
   * Recuentos medidos por carril. Acompañan al readiness DECLARADO; no lo
   * promocionan ni lo degradan. Un `null` se pinta «no medido», nunca 0.
   */
  measured?: Record<string, LaneMeasurement[]>;
}

export function ReadinessHeader({ measured = {} }: ReadinessHeaderProps) {
  const lanes = composePlatformReadiness(platformReadinessLanes, measured);
  return (
    <Card className="overflow-hidden border-l-4 border-l-primary">
      <div className="flex flex-col gap-2 border-b border-border px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Postura de plataforma</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            TGMS Console no muta owners — composición, búsqueda y readiness ejecutiva.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="rounded-md bg-secondary px-2 py-1 font-semibold text-foreground">
            TGMS Console no muta owners
          </span>
          <span className="rounded-md bg-destructive/10 px-2 py-1 font-semibold text-destructive">
            Evidencia / Legal hold — HOLD
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-y-0 sm:[&>*:nth-child(-n+2)]:border-b sm:[&>*:nth-child(-n+2)]:border-border xl:grid-cols-5 xl:divide-x xl:divide-y-0 xl:[&>*]:border-b-0">
        {lanes.map((lane) => (
          <Link
            key={lane.id}
            to={lane.route}
            aria-label={laneLinkLabel(lane)}
            className="group flex min-h-[156px] flex-col justify-between gap-3 p-4 transition-colors hover:bg-accent/40"
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                  {lane.status === "hold" ? <FileWarning className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                </span>
                <span className={cn("shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold", laneStatusClass[lane.status])}>
                  {laneStatusLabel[lane.status]}
                </span>
              </div>
              <div className="mt-3 text-sm font-semibold text-foreground group-hover:underline">
                {laneLinkLabel(lane)}
              </div>
              <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">
                {bodyLine(lane)}
              </p>
            </div>
            <div className="text-[11px] text-muted-foreground">
              {lane.measured.length > 0 && (
                <div className="mb-2 space-y-0.5">
                  {lane.measured.map((m) => (
                    <div key={m.label} className="flex items-baseline justify-between gap-2">
                      <span className="truncate">{m.label}</span>
                      <span className="shrink-0 font-medium tabular-nums text-foreground/80">
                        {m.absentReason ?? formatMeasured(m.value)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <span className="block font-medium text-foreground/80">Próxima acción</span>
              <span className="line-clamp-2">{lane.nextAction}</span>
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}