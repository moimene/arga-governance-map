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

  // Governance indicators (derived from existing demo data)
  const openFindings = findings.filter((f) => f.status !== "CERRADO");
  const criticalOrHigh = openFindings.filter((f) => f.severity === "CRÍTICA" || f.severity === "ALTA");
  const undeclaredConflicts = conflicts.filter((c) => c.status.includes("NO DECLARADO"));
  const expiredDelegations = delegations.filter((d) => d.status === "CADUCADA");
  const findingsByEntity = Object.entries(
    findings.reduce<Record<string, number>>((acc, f) => {
      acc[f.entity] = (acc[f.entity] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([entity, count]) => ({ entity, count }));

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">ESG — Sostenibilidad e Impacto</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Métricas Environmental, Social y Governance del Grupo ARGA. Objetivo Net Zero {esgTargets.netZeroYear}.
          </p>
        </div>
        <StatusBadge label={`Objetivo 2030: −${esgTargets.scope1And2Reduction2030}% Scope 1+2`} tone="info" />
      </header>

      <Tabs defaultValue="environmental" className="space-y-6">
        <TabsList>
          <TabsTrigger value="environmental" className="gap-2"><Leaf className="h-4 w-4" />Environmental</TabsTrigger>
          <TabsTrigger value="social" className="gap-2"><Users className="h-4 w-4" />Social</TabsTrigger>
          <TabsTrigger value="governance" className="gap-2"><Gavel className="h-4 w-4" />Governance</TabsTrigger>
        </TabsList>

        {/* ========================= ENVIRONMENTAL ========================= */}
        <TabsContent value="environmental" className="space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <KpiCard label="Score ESG Grupo" value={esgGroupScore} icon={Leaf} tone="success" />
            <KpiCard label="Scope 1 (tCO₂e)" value={fmt(esgTotals.scope1)} icon={Factory} tone="warning" />
            <KpiCard label="Scope 2 (tCO₂e)" value={fmt(esgTotals.scope2)} icon={Zap} tone="warning" />
            <KpiCard label="Scope 3 (tCO₂e)" value={fmt(esgTotals.scope3)} icon={Activity} tone="critical" />
            <KpiCard label="Total emisiones" value={fmt(totalEmissions)} icon={Target} tone="primary" />
          </div>

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
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
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
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
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
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
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
                      <TableCell className="text-center"><StatusBadge label={e.rating} tone={ratingTone[e.rating]} /></TableCell>
                      <TableCell><div className="flex justify-center"><TrendIcon trend={e.trend} /></div></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ========================= SOCIAL ========================= */}
        <TabsContent value="social" className="space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <KpiCard
              label={`Mujeres en Consejos (obj. ≥${socialTargets.boardWomenPctTarget}%)`}
              value={`${socialAverages.boardWomenPct}%`}
              icon={Users}
              tone={socialAverages.boardWomenPct >= socialTargets.boardWomenPctTarget ? "success" : "warning"}
            />
            <KpiCard
              label="Mujeres alta dirección"
              value={`${socialAverages.execWomenPct}%`}
              icon={Users}
              tone="primary"
            />
            <KpiCard
              label={`Brecha salarial (obj. ≤${socialTargets.payGapPctTarget}%)`}
              value={`${socialAverages.payGapPct}%`}
              icon={Scale}
              tone={socialAverages.payGapPct <= socialTargets.payGapPctTarget ? "success" : "warning"}
            />
            <KpiCard
              label={`Formación compliance (obj. ≥${socialTargets.complianceTrainingPctTarget}%)`}
              value={`${socialAverages.complianceTrainingPct}%`}
              icon={GraduationCap}
              tone={socialAverages.complianceTrainingPct >= socialTargets.complianceTrainingPctTarget ? "success" : "warning"}
            />
          </div>

          <Card className="p-5">
            <h2 className="mb-1 text-sm font-semibold">Diversidad de género en órganos de gobierno</h2>
            <p className="mb-4 text-xs text-muted-foreground">% mujeres en Consejo de Administración y Alta Dirección por entidad.</p>
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={socialEntities} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="entity" stroke="hsl(var(--muted-foreground))" fontSize={11} angle={-20} textAnchor="end" height={60} />
                  <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="boardWomenPct" name="% mujeres Consejo" fill="hsl(var(--primary))" />
                  <Bar dataKey="execWomenPct" name="% mujeres Alta Dirección" fill="hsl(var(--status-active))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <div className="border-b border-border px-5 py-3">
              <h2 className="text-sm font-semibold">Detalle Social por entidad</h2>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entidad</TableHead>
                  <TableHead className="text-right">Plantilla</TableHead>
                  <TableHead className="text-center">% Mujeres Consejo</TableHead>
                  <TableHead className="text-right">% Mujeres Dirección</TableHead>
                  <TableHead className="text-center">Brecha salarial</TableHead>
                  <TableHead>Formación compliance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {socialEntities.map((e) => {
                  const boardOk = e.boardWomenPct >= socialTargets.boardWomenPctTarget;
                  const gapOk = e.payGapPct <= socialTargets.payGapPctTarget;
                  return (
                    <TableRow key={e.entityId}>
                      <TableCell className="font-medium">{e.entity}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(e.headcount)}</TableCell>
                      <TableCell className="text-center">
                        <StatusBadge label={`${e.boardWomenPct}%`} tone={boardOk ? "active" : "warning"} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{e.execWomenPct}%</TableCell>
                      <TableCell className="text-center">
                        <StatusBadge label={`${e.payGapPct}%`} tone={gapOk ? "active" : "warning"} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={e.complianceTrainingPct} className="h-2 w-32" />
                          <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{e.complianceTrainingPct}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ========================= GOVERNANCE ========================= */}
        <TabsContent value="governance" className="space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <KpiCard label={`Hallazgos abiertos (${criticalOrHigh.length} críticos/altos)`} value={openFindings.length} icon={FileWarning} tone="warning" />
            <KpiCard label="Conflictos no declarados" value={undeclaredConflicts.length} icon={AlertTriangle} tone={undeclaredConflicts.length > 0 ? "critical" : "success"} />
            <KpiCard label="Delegaciones caducadas" value={expiredDelegations.length} icon={ShieldAlert} tone={expiredDelegations.length > 0 ? "critical" : "success"} />
            <KpiCard label="Conflictos totales gestionados" value={conflicts.length} icon={Gavel} tone="primary" />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <h2 className="text-sm font-semibold">Hallazgos críticos / altos abiertos</h2>
                <Link to="/hallazgos" className="text-xs text-primary hover:underline">Ver todos →</Link>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Entidad</TableHead>
                    <TableHead>Severidad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {criticalOrHigh.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell>
                        <Link to={`/hallazgos/${f.id}`} className="font-medium text-primary hover:underline">{f.id}</Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{f.entity}</TableCell>
                      <TableCell>
                        <StatusBadge label={f.severity} tone={f.severity === "CRÍTICA" ? "critical" : "warning"} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            <Card>
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <h2 className="text-sm font-semibold">Conflictos de interés</h2>
                <Link to="/conflictos" className="text-xs text-primary hover:underline">Ver todos →</Link>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Persona</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conflicts.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.id}</TableCell>
                      <TableCell className="text-sm">{c.person}</TableCell>
                      <TableCell>
                        <StatusBadge
                          label={c.status.includes("NO DECLARADO") ? "NO DECLARADO" : "GESTIONADO"}
                          tone={c.status.includes("NO DECLARADO") ? "critical" : "active"}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>

          <Card>
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="text-sm font-semibold">Delegaciones caducadas</h2>
              <Link to="/delegaciones" className="text-xs text-primary hover:underline">Ver todas →</Link>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Apoderado</TableHead>
                  <TableHead>Otorgada</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Hallazgo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expiredDelegations.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.code}</TableCell>
                    <TableCell>
                      <Link to={`/delegaciones/${d.id}`} className="text-primary hover:underline">{d.grantedTo}</Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{d.grantedDate}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{d.expirationDate}</TableCell>
                    <TableCell><StatusBadge label={d.status} tone="critical" /></TableCell>
                    <TableCell>
                      {d.findingId ? (
                        <Link to={`/hallazgos/${d.findingId}`} className="text-xs text-primary hover:underline">{d.findingId}</Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 text-sm font-semibold">Hallazgos por entidad</h2>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={findingsByEntity} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="entity" stroke="hsl(var(--muted-foreground))" fontSize={11} angle={-20} textAnchor="end" height={60} />
                  <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" name="Hallazgos" fill="hsl(var(--status-warning))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
