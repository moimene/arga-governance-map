import { Card } from "@/components/ui/card";
import { BookOpen, ClipboardList, FileSignature, Users } from "lucide-react";

export default function SecretariaDashboard() {
  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <div className="mb-6">
        <div className="text-xs font-bold uppercase tracking-widest text-primary">Módulo</div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">Secretaría</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Soporte a la Secretaría General del Consejo: convocatorias, actas, certificaciones y
          documentación corporativa.
        </p>
      </div>

      <Card className="flex items-start gap-4 border-dashed p-6">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
          <ClipboardList className="h-6 w-6" />
        </div>
        <div>
          <div className="text-base font-semibold text-foreground">Módulo en construcción</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Define qué secciones quieres incluir aquí (Reuniones, Actas, Documentación, Convocatorias…)
            y se conectarán a las páginas correspondientes.
          </p>
        </div>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { icon: Users, label: "Órganos y reuniones", description: "Pendiente de asignar." },
          { icon: FileSignature, label: "Actas y acuerdos", description: "Pendiente de asignar." },
          { icon: BookOpen, label: "Documentación", description: "Pendiente de asignar." },
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
