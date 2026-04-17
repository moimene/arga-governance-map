import { ChevronLeft, ChevronRight, Compass, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useTour, tourSteps } from "@/context/TourContext";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

export function TourPanel() {
  const { step, total, next, prev, close } = useTour();
  const navigate = useNavigate();
  if (step === 0) return null;

  const data = tourSteps[step - 1];
  const progress = (step / total) * 100;
  const isLast = step === total;

  return (
    <aside
      className={cn(
        "fixed right-0 top-14 z-20 flex h-[calc(100vh-3.5rem)] w-[420px] flex-col border-l border-border bg-card shadow-2xl animate-slide-in-right",
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Tour TGMS — Paso {step} de {total}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={close}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="px-5 pt-3"><Progress value={progress} className="h-1.5" /></div>

      <div className="flex-1 overflow-y-auto px-6 py-5 scrollbar-thin">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
          <Compass className="h-6 w-6 text-primary" />
        </div>

        <h2 className="text-lg font-semibold leading-tight text-foreground">{data.title}</h2>

        {!data.available && (
          <div className="mt-3 inline-flex items-center rounded-full bg-status-pending-bg px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-status-pending">
            Próximamente
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
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border bg-secondary/40 px-5 py-3">
        <Button variant="outline" size="sm" onClick={prev} disabled={step === 1} className="gap-1">
          <ChevronLeft className="h-4 w-4" /> Anterior
        </Button>
        {isLast ? (
          <Button
            size="sm"
            className="gap-1"
            onClick={() => {
              close();
              navigate("/documentacion");
            }}
          >
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
