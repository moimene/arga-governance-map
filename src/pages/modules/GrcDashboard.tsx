import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import {
  AlertTriangle,
  BarChart3,
  Building,
  FileText,
  Key,
  Leaf,
  Network,
  Scale,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

interface Tile {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

const tiles: Tile[] = [
  { to: "/governance-map", label: "Governance Map", description: "Mapa societario y de órganos.", icon: Network },
  { to: "/entidades", label: "Entidades", description: "Sociedades del grupo y filiales.", icon: Building },
  { to: "/organos", label: "Órganos y Reuniones", description: "Consejos, comisiones y actas.", icon: Users },
  { to: "/politicas", label: "Políticas y Normativa", description: "Marco normativo interno.", icon: FileText },
  { to: "/obligaciones", label: "Obligaciones y Controles", description: "Deberes regulatorios y su control.", icon: ShieldCheck },
  { to: "/delegaciones", label: "Delegaciones y Poderes", description: "Apoderamientos y vigencias.", icon: Key },
  { to: "/hallazgos", label: "Hallazgos y Acciones", description: "Auditoría interna y remediación.", icon: AlertTriangle },
  { to: "/conflictos", label: "Conflictos / Attestations", description: "Conflictos de interés y atestaciones.", icon: Scale },
  { to: "/esg", label: "ESG", description: "Métricas e indicadores ESG.", icon: Leaf },
  { to: "/dashboards", label: "Dashboards", description: "KPIs corporativos.", icon: BarChart3 },
];

export default function GrcDashboard() {
  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <div className="mb-6">
        <div className="text-xs font-bold uppercase tracking-widest text-primary">Módulo</div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">GRC Compass</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Gobierno corporativo, riesgo y cumplimiento. Estructura societaria, órganos, normativa interna,
          obligaciones, delegaciones, hallazgos, conflictos de interés y ESG.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <Link key={t.to} to={t.to}>
              <Card className="group flex h-full items-start gap-3 p-4 transition-colors hover:border-primary hover:bg-accent/40">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground">{t.label}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{t.description}</div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
