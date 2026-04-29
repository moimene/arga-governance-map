import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  FileCheck2,
  Gavel,
  LockKeyhole,
  PlayCircle,
  ScrollText,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { buildPresenterScenarioPath, runAllDemoScenarios } from "@/lib/demo-operable";
import type { DemoOutcome, DemoStepId } from "@/lib/demo-operable";
import { cn } from "@/lib/utils";

const demoRuns = runAllDemoScenarios();

const stepIcons: Record<DemoStepId, typeof FileCheck2> = {
  CONVOCATORIA: FileCheck2,
  SESION: Gavel,
  GATE: ShieldCheck,
  ACTA: ScrollText,
  CERTIFICACION: BadgeCheck,
  EVIDENCIA: LockKeyhole,
};

function outcomeClass(outcome: DemoOutcome) {
  return outcome === "ADOPTADO"
    ? "bg-status-active-bg text-status-active"
    : "bg-destructive/10 text-destructive";
}

function outcomeLabel(outcome: DemoOutcome) {
  return outcome === "ADOPTADO" ? "Adoptable" : "Bloqueada";
}

export function DemoOperablePanel() {
  const primaryRun = demoRuns[0];

  return (
    <Card className="overflow-hidden border-l-4 border-l-primary">
      <div className="flex flex-col gap-4 border-b border-border px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Consola de decisión del Consejo</h2>
            <span className="rounded-md bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary">
              DEMO MODE
            </span>
            <span className="rounded-md bg-secondary px-2 py-1 text-[11px] font-medium text-muted-foreground">
              Sandbox verificable
            </span>
          </div>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            Simula constitución, votación, acta, certificación y evidencia sandbox para ARGA Seguros S.A. La consola
            presenta la decisión; Secretaría Societaria conserva el expediente y la lógica jurídica.
          </p>
        </div>
        <Link
          to={buildPresenterScenarioPath("JUNTA_UNIVERSAL_OK")}
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover"
          aria-label="Simular junta universal ordinaria"
        >
          <PlayCircle className="h-4 w-4" />
          Simular junta universal
        </Link>
      </div>

      <div className="grid gap-4 p-5 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Casos de consejo
            </h3>
            <span className="text-[11px] text-muted-foreground">Objetivo: demo completa &lt; 10 min</span>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {demoRuns.map((run) => (
              <Link
                key={run.scenario.id}
                to={`/demo-operable/${run.scenario.id}`}
                aria-label={`Ver decisión: ${run.scenario.label}, resultado ${outcomeLabel(run.outcome)}`}
                className="group flex min-h-[152px] flex-col justify-between rounded-md border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-accent/40"
              >
                <span>
                  <span className="block text-xs font-medium text-primary">{run.scenario.facts.matter}</span>
                  <span className="mt-1 block text-sm font-semibold text-foreground group-hover:underline">
                    {run.scenario.label}
                  </span>
                  <span className="mt-2 block text-xs leading-5 text-muted-foreground">{run.narrative}</span>
                </span>
                <span className="mt-3 flex items-center justify-between gap-2">
                  <span className={cn("rounded-md px-2 py-1 text-[10px] font-bold", outcomeClass(run.outcome))}>
                    {outcomeLabel(run.outcome)}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                    Ver decisión
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-border bg-secondary/30 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Cadena demostrable
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {primaryRun.steps.map((step) => {
              const Icon = stepIcons[step.id];
              return (
                <div key={step.label} className="flex items-center gap-2 rounded-md bg-card px-2.5 py-2 text-xs text-foreground">
                  <Icon className="h-3.5 w-3.5 text-primary" />
                  <span className="truncate">{step.label}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 grid gap-2 text-xs text-muted-foreground">
            <div className="rounded-md bg-card px-2.5 py-2">
              <span className="font-semibold text-foreground">Entorno sandbox controlado</span>
            </div>
            <div className="rounded-md bg-card px-2.5 py-2">
              Sin firma productiva, sin presentación registral, sin escritura externa.
            </div>
            <div className="rounded-md bg-card px-2.5 py-2">
              Modo presentación con reset local y avance entre cinco escenarios.
            </div>
            <div className="rounded-md bg-card px-2.5 py-2">
              Detalle técnico disponible en la vista de resultado.
            </div>
          </div>
          <div className="mt-4 space-y-2 text-xs leading-relaxed text-muted-foreground">
            <p>La demo mantiene integridad y trazabilidad sin contaminar datos productivos.</p>
          </div>
        </div>
      </div>
    </Card>
  );
}
