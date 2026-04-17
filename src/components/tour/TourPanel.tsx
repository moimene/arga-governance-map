import { useLocation } from "react-router-dom";
import { ChevronLeft, ChevronRight, Compass, X, CheckCircle2, Compass as CompassIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTour, tourSteps } from "@/context/TourContext";
import { useTourHighlight } from "@/hooks/useTourHighlight";
import { cn } from "@/lib/utils";

const toneClasses: Record<string, string> = {
  critical: "bg-status-critical-bg text-status-critical border-status-critical/30",
  warning: "bg-status-warning-bg text-status-warning border-status-warning/30",
  info: "bg-accent text-primary border-primary/20",
  pending: "bg-status-pending-bg text-status-pending border-status-pending/30",
  neutral: "bg-muted text-muted-foreground border-border",
};

export function TourPanel() {
  useTourHighlight();
  const { step, total, next, prev, close, finish, goTo, isFreelyExploring, stepForPath } = useTour();
  const { pathname } = useLocation();
  if (step === 0) return null;

  const data = tourSteps[step - 1];
  const isLast = step === total;
  const exploring = isFreelyExploring(pathname);
  const matchedStep = stepForPath(pathname);

  return (
    <aside className="fixed right-0 top-14 z-20 flex h-[calc(100vh-3.5rem)] w-[420px] flex-col border-l border-border bg-card shadow-2xl animate-slide-in-right">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Tour TGMS — Paso {step} de {total}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={close}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* 10 segments progress */}
      <TooltipProvider delayDuration={150}>
        <div className="flex gap-1 px-5 pt-3">
          {tourSteps.map((s, i) => {
            const idx = i + 1;
            const completed = idx < step;
            const current = idx === step;
            const seg = (
              <button
                key={idx}
                disabled={!completed}
                onClick={() => completed && goTo(idx)}
                className={cn(
                  "h-2 flex-1 rounded-full transition-colors",
                  current && "bg-primary ring-2 ring-card ring-offset-2 ring-offset-primary",
                  completed && "bg-primary cursor-pointer hover:bg-primary-hover",
                  !current && !completed && "bg-border",
                )}
                aria-label={`Paso ${idx}: ${s.module}`}
              />
            );
            return completed ? (
              <Tooltip key={idx}>
                <TooltipTrigger asChild>{seg}</TooltipTrigger>
                <TooltipContent side="bottom">{s.module}</TooltipContent>
              </Tooltip>
            ) : seg;
          })}
        </div>
      </TooltipProvider>

      <div className="flex-1 overflow-y-auto px-6 py-5 scrollbar-thin">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
          <CompassIcon className="h-6 w-6 text-primary" />
        </div>

        <h2 className="text-lg font-semibold leading-tight text-foreground">{data.title}</h2>

        {exploring && (
          <div className="mt-3 rounded-md border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
            Navegando libremente · El tour continúa desde el paso {step}.
            <div className="mt-2 flex gap-2">
              {matchedStep > 0 && matchedStep !== step && (
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => goTo(matchedStep)}>
                  Retomar desde aquí (paso {matchedStep})
                </Button>
              )}
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => goTo(step)}>
                Volver al paso {step}
              </Button>
            </div>
          </div>
        )}

        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{data.description}</p>

        {data.bullets.length > 0 && (
          <>
            <div className="mt-6 mb-2 text-sm font-semibold text-foreground">🔍 Fíjate en:</div>
            <ul className="space-y-2">
              {data.bullets.map((b, i) => (
                <li key={i} className="flex gap-2 text-sm text-foreground">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        {data.badges && data.badges.length > 0 && (
          <>
            <div className="mt-5 mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">En esta pantalla hay:</div>
            <div className="flex flex-wrap gap-1.5">
              {data.badges.map((b, i) => (
                <span
                  key={i}
                  className={cn(
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                    toneClasses[b.tone] ?? toneClasses.neutral,
                  )}
                >
                  {b.label}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border bg-secondary/40 px-5 py-3">
        <Button variant="outline" size="sm" onClick={prev} disabled={step === 1} className="gap-1">
          <ChevronLeft className="h-4 w-4" /> Anterior
        </Button>
        {isLast ? (
          <Button size="sm" className="gap-1 bg-status-active text-white hover:bg-status-active/90" onClick={finish}>
            <CheckCircle2 className="h-4 w-4" /> Finalizar tour
          </Button>
        ) : (
          <Button size="sm" onClick={next} className="gap-1">
            Siguiente <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </aside>
  );
}
