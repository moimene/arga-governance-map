import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ExternalLink,
  Fingerprint,
  Info,
  LockKeyhole,
  Pause,
  PlayCircle,
  RotateCcw,
  Route,
  ShieldCheck,
  UserCheck,
  XCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import {
  buildDemoRunScenarioResponse,
  buildDemoPresenterPlan,
  buildPresenterScenarioPath,
  demoScenarioDefinitions,
  gateCopyLabels,
  getBoardDecisionCopy,
  getEvidenceTrustCopy,
  getNextPresenterScenario,
  getPresenterScenarioIndex,
  getPreviousPresenterScenario,
  getRolePerspectives,
  getStepOwnerLabel,
  nextPresenterIndex,
  previousPresenterIndex,
  runDemoScenario,
} from "@/lib/demo-operable";
import type { DemoPresenterStatus, DemoScenarioId } from "@/lib/demo-operable";
import { cn } from "@/lib/utils";

function isDemoScenarioId(value: string | undefined): value is DemoScenarioId {
  return Boolean(value && demoScenarioDefinitions.some((scenario) => scenario.id === value));
}

function OutcomeBadge({ outcome }: { outcome: "ADOPTADO" | "BLOQUEADO" }) {
  return (
    <StatusBadge
      label={outcome}
      tone={outcome === "ADOPTADO" ? "active" : "critical"}
      className="text-[12px]"
    />
  );
}

export default function DemoScenarioResult() {
  const { scenarioId } = useParams();
  const [searchParams] = useSearchParams();
  const presenterMode = searchParams.get("presenter") === "1";

  if (!isDemoScenarioId(scenarioId)) {
    return (
      <div className="mx-auto max-w-[1040px] p-6">
        <Card className="p-6">
          <StatusBadge label="DEMO MODE" tone="info" />
          <h1 className="mt-4 text-xl font-semibold text-foreground">Escenario no disponible</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            El identificador solicitado no pertenece al Demo Pack ARGA.
          </p>
          <Link
            to={presenterMode ? buildPresenterScenarioPath("JUNTA_UNIVERSAL_OK") : "/"}
            className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            {presenterMode ? "Reiniciar demo" : "Volver a consola"}
          </Link>
        </Card>
      </div>
    );
  }

  return <DemoScenarioResultContent scenarioId={scenarioId} presenterMode={presenterMode} />;
}

function presenterStatusLabel(status: DemoPresenterStatus) {
  if (status === "PREPARED") return "Preparado";
  if (status === "AUTO_RUNNING") return "Auto-running";
  if (status === "PAUSED") return "Pausado";
  if (status === "RESULT") return "Resultado";
  return "Seguro";
}

function DemoScenarioResultContent({
  scenarioId,
  presenterMode,
}: {
  scenarioId: DemoScenarioId;
  presenterMode: boolean;
}) {
  const navigate = useNavigate();
  const run = useMemo(() => runDemoScenario(scenarioId), [scenarioId]);
  const response = useMemo(() => buildDemoRunScenarioResponse({ scenario: scenarioId }), [scenarioId]);
  const decisionCopy = getBoardDecisionCopy(run);
  const evidenceCopy = getEvidenceTrustCopy();
  const rolePerspectives = getRolePerspectives(run);
  const presenterPlan = useMemo(() => buildDemoPresenterPlan(run), [run]);
  const [presenterStatus, setPresenterStatus] = useState<DemoPresenterStatus>("PREPARED");
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const activePresenterStep = presenterPlan.steps[activeStepIndex];
  const scenarioPosition = getPresenterScenarioIndex(scenarioId) + 1;
  const previousScenarioId = getPreviousPresenterScenario(scenarioId);
  const nextScenarioId = getNextPresenterScenario(scenarioId);
  const progressPct =
    presenterPlan.steps.length > 1
      ? Math.round((activeStepIndex / (presenterPlan.steps.length - 1)) * 100)
      : 100;

  useEffect(() => {
    setActiveStepIndex(0);
    setPresenterStatus("PREPARED");
  }, [scenarioId, presenterMode]);

  useEffect(() => {
    if (presenterStatus !== "AUTO_RUNNING") return undefined;

    const timer = window.setInterval(() => {
      setActiveStepIndex((current) => {
        if (current >= presenterPlan.steps.length - 1) {
          window.clearInterval(timer);
          setPresenterStatus("RESULT");
          return current;
        }

        return nextPresenterIndex(current, presenterPlan.steps.length);
      });
    }, 1200);

    return () => window.clearInterval(timer);
  }, [presenterPlan.steps.length, presenterStatus]);

  const startPresenter = () => {
    if (presenterStatus !== "PAUSED") {
      setActiveStepIndex(0);
    }
    setPresenterStatus("AUTO_RUNNING");
  };

  const pausePresenter = () => setPresenterStatus("PAUSED");

  const resetFullDemo = () => {
    setActiveStepIndex(0);
    setPresenterStatus("PREPARED");
    if (presenterMode && scenarioId !== "JUNTA_UNIVERSAL_OK") {
      navigate(buildPresenterScenarioPath("JUNTA_UNIVERSAL_OK"));
    }
  };

  const goToPresenterScenario = (targetScenarioId: DemoScenarioId) => {
    setActiveStepIndex(0);
    setPresenterStatus("PREPARED");
    navigate(buildPresenterScenarioPath(targetScenarioId, presenterMode));
  };

  const movePresenterStep = (direction: "previous" | "next") => {
    setActiveStepIndex((current) =>
      direction === "previous"
        ? previousPresenterIndex(current)
        : nextPresenterIndex(current, presenterPlan.steps.length)
    );
    setPresenterStatus("PAUSED");
  };

  return (
    <div className="mx-auto max-w-[1280px] space-y-6 p-6">
      <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge label="DEMO MODE" tone="info" />
              <StatusBadge label="Sandbox verificable" tone="neutral" />
              {presenterMode && <StatusBadge label="Modo presentación activo" tone="info" />}
              <OutcomeBadge outcome={response.agreement_result} />
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
              {decisionCopy.headline}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{decisionCopy.summary}</p>
            <p className="mt-3 max-w-3xl text-sm font-medium text-foreground">{run.scenario.label}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              <ArrowLeft className="h-4 w-4" />
              Consola
            </Link>
            {presenterMode ? (
              <div className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border bg-secondary/60 px-3 py-2 text-sm font-medium text-muted-foreground">
                <LockKeyhole className="h-4 w-4" />
                Handoff pausado en modo presentación
              </div>
            ) : (
              <Link
                to={run.scenario.route}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
              >
                <ExternalLink className="h-4 w-4" />
                Continuar en Secretaría Societaria
              </Link>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <div className="rounded-md border border-border bg-secondary/40 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Sociedad</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{response.entity_context.entity_name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{response.entity_context.body_name}</p>
          </div>
          <div className="rounded-md border border-border bg-secondary/40 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Materia</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{run.scenario.facts.matter}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Secretaría Societaria</p>
          </div>
          <div className="rounded-md border border-border bg-secondary/40 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Resultado</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{response.agreement_result}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{response.gate_preview.estado === "OK" ? "Validación superada" : "Validación bloqueante"}</p>
          </div>
          <div className="rounded-md border border-border bg-secondary/40 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Evidencia</p>
            <p className="mt-1 text-sm font-semibold text-foreground">Sandbox</p>
            <p className="mt-0.5 text-xs text-muted-foreground">No productiva</p>
          </div>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          <UserCheck className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Dashboard por rol de gobierno</h2>
        </div>
        <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-4">
          {rolePerspectives.map((perspective) => (
            <div key={perspective.role} className="rounded-md border border-border bg-card p-4">
              <p className="text-sm font-semibold text-foreground">{perspective.role}</p>
              <p className="mt-1 text-xs font-medium text-primary">{perspective.focus}</p>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">{perspective.insight}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <PlayCircle className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Modo presentación</h2>
              <StatusBadge
                label={presenterStatusLabel(presenterStatus)}
                tone={presenterStatus === "FAILED_SAFE" ? "critical" : presenterStatus === "RESULT" ? "active" : "info"}
              />
              <span className="rounded-md bg-secondary px-2 py-1 text-[11px] font-medium text-muted-foreground">
                Caso {scenarioPosition}/5
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Guion auto-avanzable para presentar el caso en menos de 10 minutos, con reset local y sin escrituras externas.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => previousScenarioId && goToPresenterScenario(previousScenarioId)}
              disabled={!previousScenarioId}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Escenario anterior
            </button>
            <button
              type="button"
              onClick={startPresenter}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
            >
              <PlayCircle className="h-4 w-4" />
              {presenterStatus === "PAUSED" ? "Reanudar" : "Iniciar presentación"}
            </button>
            <button
              type="button"
              onClick={pausePresenter}
              disabled={presenterStatus !== "AUTO_RUNNING"}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Pause className="h-4 w-4" />
              Pausar
            </button>
            <button
              type="button"
              onClick={resetFullDemo}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              <RotateCcw className="h-4 w-4" />
              Reset demo
            </button>
            <button
              type="button"
              onClick={() => nextScenarioId && goToPresenterScenario(nextScenarioId)}
              disabled={!nextScenarioId}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              Siguiente escenario
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="grid gap-5 p-5 lg:grid-cols-[1fr_320px]">
          <div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div className="h-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
            </div>
            <div className="mt-4 rounded-md border border-border bg-secondary/30 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Paso {activeStepIndex + 1} de {presenterPlan.steps.length}
              </p>
              <h3 className="mt-1 text-lg font-semibold text-foreground">{activePresenterStep.presenterLabel}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{activePresenterStep.presenterNarrative}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => movePresenterStep("previous")}
                  disabled={activeStepIndex === 0}
                  className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Paso anterior
                </button>
                <button
                  type="button"
                  onClick={() => movePresenterStep("next")}
                  disabled={activeStepIndex === presenterPlan.steps.length - 1}
                  className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Siguiente paso
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {presenterPlan.steps.map((step, index) => (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => {
                      setActiveStepIndex(index);
                      setPresenterStatus("PAUSED");
                    }}
                    className={cn(
                      "rounded-md border px-2.5 py-1.5 text-xs font-medium",
                      index === activeStepIndex
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:bg-accent"
                    )}
                  >
                    {step.presenterLabel}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="rounded-md border border-border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Métricas demo</p>
              <p className="mt-2 text-sm font-semibold text-foreground">{presenterPlan.totalSeconds}s estimados</p>
              <p className="mt-1 text-xs text-muted-foreground">Reset objetivo: &lt; {presenterPlan.resetTargetSeconds}s</p>
              <p className="mt-1 text-xs text-muted-foreground">Progreso: {progressPct}%</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Checklist comercial/legal</p>
              <ul className="mt-2 space-y-2">
                {presenterPlan.readiness.map((item) => (
                  <li key={item.id} className="flex gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", item.ok ? "text-status-active" : "text-destructive")} />
                    <span>{item.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Validación del acuerdo</h2>
              </div>
              <StatusBadge
                label={response.gate_preview.estado === "OK" ? "Validación superada" : "Validación bloqueante"}
                tone={response.gate_preview.estado === "OK" ? "active" : "critical"}
              />
            </div>
            <div className="border-b border-border bg-secondary/30 px-5 py-3">
              <p className="text-sm text-muted-foreground">{response.narrative}</p>
            </div>
            <div className="grid gap-3 p-5 md:grid-cols-3">
              {gateCopyLabels.map((gate) => {
                const ok = response.gate_preview.detalles[gate.key];
                return (
                  <div key={gate.key} className="rounded-md border border-border bg-card px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-foreground">{gate.label}</span>
                      {ok ? (
                        <CheckCircle2 className="h-4 w-4 text-status-active" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                    <p className={cn("mt-1 text-xs font-semibold", ok ? "text-status-active" : "text-destructive")}>
                      {ok ? gate.ok : gate.fail}
                    </p>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border px-5 py-3">
              <ClipboardCheck className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Explicación para el consejero</h2>
            </div>
            <div className="grid gap-5 p-5 lg:grid-cols-2">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Por qué</h3>
                <ul className="mt-3 space-y-2">
                  {response.explain.why_adopted.map((item) => (
                    <li key={item} className="flex gap-2 text-sm leading-5 text-foreground">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Base legal</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {response.explain.legal_basis.map((basis) => (
                    <span key={basis} className="rounded-md border border-border px-2 py-1 text-xs text-foreground">
                      {basis}
                    </span>
                  ))}
                </div>
                <div className="mt-4 rounded-md border border-border bg-secondary/30 p-3">
                  <div className="flex gap-2">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <p className="text-xs leading-5 text-muted-foreground">{decisionCopy.nextAction}</p>
                  </div>
                </div>
                {response.explain.warnings.length > 0 && (
                  <div className="mt-3 rounded-md border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
                    {response.explain.warnings.join(" ")}
                  </div>
                )}
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border px-5 py-3">
              <Route className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Recorrido demostrable</h2>
            </div>
            <div className="grid gap-3 p-5 md:grid-cols-3">
              {run.steps.map((step) => (
                <div key={step.id} className="rounded-md border border-border px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-foreground">{step.label}</span>
                    <StatusBadge
                      label={step.status === "DONE" ? "Completo" : step.status === "SKIPPED" ? "No aplica" : "Bloqueado"}
                      tone={step.status === "DONE" ? "active" : step.status === "SKIPPED" ? "neutral" : "critical"}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{getStepOwnerLabel(step.owner)}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border px-5 py-3">
              <LockKeyhole className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Confianza demo</h2>
            </div>
            <div className="space-y-4 p-5 text-sm">
              <div>
                <p className="font-semibold text-foreground">{evidenceCopy.headline}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{evidenceCopy.body}</p>
              </div>
              <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Integración QTSP API preparada</p>
                <p className="mt-1 font-medium text-foreground">
                  {response.trust_center.provider} · {response.trust_center.mode}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Proxy servidor requerido para client_credentials; la demo no invoca API productiva.
                </p>
              </div>
              <div className="rounded-md border border-border bg-secondary/40 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Proveedor sandbox</p>
                <p className="mt-1 font-medium text-foreground">
                  {response.trust_center.signature.level} / {response.trust_center.timestamp.level}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {response.trust_center.signature.status === "SIMULATED_READY" ? "Firma simulada preparada" : "Firma no procede por gate bloqueante"}
                </p>
              </div>
              <div className="rounded-md border border-border bg-secondary/40 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Postura</p>
                <p className="mt-1 font-medium text-foreground">No evidencia productiva final</p>
              </div>
              <div className="rounded-md border border-border bg-secondary/40 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Contrato API objetivo</p>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {response.trust_center.apiContract.endpoints.slice(0, 3).map((endpoint) => (
                    <li key={endpoint.id}>{endpoint.method} {endpoint.path}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-md bg-secondary/50 px-3 py-2 font-mono text-xs text-muted-foreground">
                finalEvidence=false
              </div>
              <div className="rounded-md bg-secondary/50 px-3 py-2 font-mono text-xs text-muted-foreground">
                source_of_truth=none
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border px-5 py-3">
              <BriefcaseBusiness className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Demo Pack ARGA</h2>
            </div>
            <div className="space-y-2 p-5 text-sm">
              <p className="font-medium text-foreground">{response.entity_context.entity_name}</p>
              <p className="text-xs text-muted-foreground">{response.entity_context.body_name}</p>
              <p className="text-xs text-muted-foreground">{response.demo_pack_version}</p>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border px-5 py-3">
              <Fingerprint className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Trazabilidad técnica</h2>
            </div>
            <dl className="space-y-3 p-5 text-xs">
              <div>
                <dt className="text-muted-foreground">scenario_run_id</dt>
                <dd className="mt-1 break-all font-mono text-foreground">{response.scenario_run_id}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">snapshot_hash</dt>
                <dd className="mt-1 break-all font-mono text-foreground">{response.hashes.snapshotHash}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">ruleset_hash</dt>
                <dd className="mt-1 break-all font-mono text-foreground">{response.hashes.rulesetHash}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">output_hash</dt>
                <dd className="mt-1 break-all font-mono text-foreground">{response.hashes.outputHash}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
