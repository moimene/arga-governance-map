import { Card } from "@/components/ui/card";
import { KpiCard } from "@/components/KpiCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { esgEntities, esgEvolution, esgGroupScore, esgTargets, esgTotals } from "@/data/esg";
import { socialAverages, socialEntities, socialTargets } from "@/data/esgSocial";
import { findings } from "@/data/findings";
import { conflicts } from "@/data/conflicts";
import { delegations } from "@/data/delegations";
import { Activity, AlertTriangle, Factory, GraduationCap, Leaf, Scale, ShieldAlert, TrendingDown, TrendingUp, Users, Zap, Minus, Target, FileWarning, Gavel } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const fmt = (n: number) => n.toLocaleString("es-ES");

const ratingTone: Record<string, "active" | "info" | "warning" | "critical"> = {
  AAA: "active",
  AA: "active",
  A: "info",
  BBB: "info",
  BB: "warning",
  B: "critical",
};

function TrendIcon({ trend }: { trend: "up" | "down" | "flat" }) {
  if (trend === "up") return <TrendingUp className="h-4 w-4 text-status-active" />;
  if (trend === "down") return <TrendingDown className="h-4 w-4 text-destructive" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

export default function Esg() {
  const totalEmissions = esgTotals.scope1 + esgTotals.scope2 + esgTotals.scope3;

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">ESG — Sostenibilidad e Impacto</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Métricas de emisiones GEI (Scope 1/2/3), rating ESG por entidad y evolución hacia objetivos Net Zero {esgTargets.netZeroYear}.
          </p>
        </div>
        <StatusBadge label={`Objetivo 2030: −${esgTargets.scope1And2Reduction2030}% Scope 1+2`} tone="info" />
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <KpiCard label="Score ESG Grupo" value={esgGroupScore} icon={Leaf} tone="success" />
        <KpiCard label="Scope 1 (tCO₂e)" value={fmt(esgTotals.scope1)} icon={Factory} tone="warning" />
        <KpiCard label="Scope 2 (tCO₂e)" value={fmt(esgTotals.scope2)} icon={Zap} tone="warning" />
        <KpiCard label="Scope 3 (tCO₂e)" value={fmt(esgTotals.scope3)} icon={Activity} tone="critical" />
        <KpiCard label="Total emisiones" value={fmt(totalEmissions)} icon={Target} tone="primary" />
      </div>

      {/* Charts */}
      <Tabs defaultValue="emissions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="emissions">Evolución emisiones</TabsTrigger>
          <TabsTrigger value="score">Score ESG histórico</TabsTrigger>
          <TabsTrigger value="byEntity">Emisiones por entidad</TabsTrigger>
        </TabsList>

        <TabsContent value="emissions">
          <Card className="p-5">
            <h2 className="mb-1 text-sm font-semibold">Emisiones GEI 2020–2024 (tCO₂e)</h2>
            <p className="mb-4 text-xs text-muted-foreground">
              Reducción acumulada Scope 1+2: <span className="font-semibold text-status-active">−20,7%</span> desde 2020.
            </p>
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={esgEvolution} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="scope1" name="Scope 1" stroke="hsl(var(--status-warning))" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="scope2" name="Scope 2" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="scope3" name="Scope 3" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="score">
          <Card className="p-5">
            <h2 className="mb-1 text-sm font-semibold">Score ESG del Grupo (0–100)</h2>
            <p className="mb-4 text-xs text-muted-foreground">
              Mejora sostenida: <span className="font-semibold text-status-active">+12 puntos</span> desde 2020.
            </p>
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={esgEvolution} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Line type="monotone" dataKey="score" name="Score ESG" stroke="hsl(var(--status-active))" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="byEntity">
          <Card className="p-5">
            <h2 className="mb-4 text-sm font-semibold">Emisiones por entidad (tCO₂e)</h2>
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={esgEntities} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="entity" stroke="hsl(var(--muted-foreground))" fontSize={11} angle={-20} textAnchor="end" height={60} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="scope1" name="Scope 1" stackId="a" fill="hsl(var(--status-warning))" />
                  <Bar dataKey="scope2" name="Scope 2" stackId="a" fill="hsl(var(--primary))" />
                  <Bar dataKey="scope3" name="Scope 3" stackId="a" fill="hsl(var(--destructive))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Table */}
      <Card>
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">Detalle por entidad</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entidad</TableHead>
              <TableHead>País</TableHead>
              <TableHead className="text-right">Scope 1</TableHead>
              <TableHead className="text-right">Scope 2</TableHead>
              <TableHead className="text-right">Scope 3</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-center">Score</TableHead>
              <TableHead className="text-center">Rating</TableHead>
              <TableHead className="text-center">Tendencia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {esgEntities.map((e) => {
              const total = e.scope1 + e.scope2 + e.scope3;
              return (
                <TableRow key={e.entityId}>
                  <TableCell className="font-medium">{e.entity}</TableCell>
                  <TableCell className="text-muted-foreground">{e.country}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(e.scope1)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(e.scope2)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(e.scope3)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{fmt(total)}</TableCell>
                  <TableCell className="text-center font-semibold">{e.esgScore}</TableCell>
                  <TableCell className="text-center">
                    <StatusBadge label={e.rating} tone={ratingTone[e.rating]} />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-center"><TrendIcon trend={e.trend} /></div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
