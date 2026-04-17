import { Card } from "@/components/ui/card";
import { Bot, Brain, ShieldAlert, Sparkles } from "lucide-react";

export default function AimsDashboard() {
  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <div className="mb-6 flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Brain className="h-6 w-6" />
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-primary">Módulo</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">AIms</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Cumplimiento de Inteligencia Artificial. Inventario de sistemas IA, evaluación de riesgo
            conforme al AI Act de la UE, registro de modelos y evidencias de gobernanza algorítmica.
          </p>
        </div>
      </div>

      <Card className="flex items-start gap-4 border-dashed p-6">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
          <Sparkles className="h-6 w-6" />
        </div>
        <div>
          <div className="text-base font-semibold text-foreground">Próximamente</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Estamos preparando el módulo de cumplimiento de IA. Las secciones internas se habilitarán
            en las próximas iteraciones.
          </p>
        </div>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { icon: Bot, label: "Inventario de sistemas IA", description: "Registro centralizado de modelos en uso." },
          { icon: ShieldAlert, label: "Evaluación de riesgo (AI Act)", description: "Clasificación por nivel de riesgo." },
          { icon: Brain, label: "Evidencias y auditoría", description: "Trazabilidad de decisiones algorítmicas." },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <Card key={t.label} className="flex items-start gap-3 p-4 opacity-70">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">{t.label}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{t.description}</div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
