import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Leaf, BarChart3, Settings, ShieldAlert, AlertOctagon } from "lucide-react";
import { Placeholder } from "@/components/Placeholder";

export function Esg() {
  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2"><Leaf className="h-6 w-6 text-status-active" />ESG — Sostenibilidad y Gobierno</h1>
      <p className="mt-1 text-sm text-muted-foreground">Métricas de sostenibilidad y gobierno del Grupo ARGA.</p>
      <div className="mt-6 grid grid-cols-3 gap-4">
        {[
          { label: "Emisiones (tCO₂e)", value: "—" },
          { label: "Score ESG", value: "—" },
          { label: "Rating externo", value: "—" },
        ].map((k) => (
          <Card key={k.label} className="p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{k.label}</div>
            <div className="mt-2 text-3xl font-bold text-muted-foreground/40">{k.value}</div>
          </Card>
        ))}
      </div>
      <Card className="mt-6 p-8 text-center text-sm text-muted-foreground">
        Módulo en desarrollo — próxima versión.
      </Card>
    </div>
  );
}

export function Dashboards() {
  const ds = [
    { title: "Dashboard Secretaría General", desc: "Órganos, mandatos, actas." },
    { title: "Dashboard Cumplimiento", desc: "Obligaciones, controles, hallazgos." },
    { title: "Dashboard Riesgos", desc: "Mapa de riesgos, KRIs, apetito." },
    { title: "Dashboard Auditoría", desc: "Plan anual, hallazgos, remediación." },
  ];
  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2"><BarChart3 className="h-6 w-6 text-primary" />Dashboards Ejecutivos</h1>
      <p className="mt-1 text-sm text-muted-foreground">Vistas analíticas por función.</p>
      <div className="mt-6 grid grid-cols-2 gap-4">
        {ds.map((d) => (
          <Card key={d.title} className="p-6">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-muted-foreground/50" />
              <h3 className="text-base font-semibold">{d.title}</h3>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{d.desc}</p>
            <div className="mt-4 text-xs font-medium text-muted-foreground">Próximamente</div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function Admin() {
  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2"><Settings className="h-6 w-6 text-primary" />Administración</h1>
      <Tabs defaultValue="usuarios" className="mt-4">
        <TabsList>
          <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
          <TabsTrigger value="roles">Roles y permisos</TabsTrigger>
          <TabsTrigger value="catalogos">Catálogos</TabsTrigger>
          <TabsTrigger value="integraciones">Integraciones</TabsTrigger>
          <TabsTrigger value="config">Configuración</TabsTrigger>
        </TabsList>
        {["usuarios", "roles", "catalogos", "integraciones", "config"].map((t) => (
          <TabsContent key={t} value={t} className="mt-4">
            <Card className="p-10 text-center text-sm text-muted-foreground">Próximamente</Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

export function PlaceholderRoute({ name }: { name: string }) {
  return <Placeholder title={name} />;
}
