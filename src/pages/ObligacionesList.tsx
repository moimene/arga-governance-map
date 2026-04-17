import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { obligations } from "@/data/obligations";
import { AlertTriangle, CheckCircle, AlertCircle, XCircle, ClipboardList, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiProps { label: string; value: number; icon: typeof ClipboardList; tone: "primary" | "success" | "warning" | "critical"; }
const toneMap = {
  primary: { bg: "bg-primary/10", text: "text-primary", value: "text-primary" },
  success: { bg: "bg-status-active/10", text: "text-status-active", value: "text-status-active" },
  warning: { bg: "bg-status-warning/10", text: "text-status-warning", value: "text-status-warning" },
  critical: { bg: "bg-destructive/10", text: "text-destructive", value: "text-destructive" },
};
function Kpi({ label, value, icon: Icon, tone }: KpiProps) {
  const s = toneMap[tone];
  return (
    <Card className="p-4">
      <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", s.bg)}>
        <Icon className={cn("h-5 w-5", s.text)} />
      </div>
      <div className={cn("mt-3 text-[32px] font-bold leading-none tracking-tight", s.value)}>{value}</div>
      <div className="mt-2 text-[13px] font-medium text-muted-foreground">{label}</div>
    </Card>
  );
}

export default function ObligacionesList() {
  const [framework, setFramework] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => obligations.filter((o) =>
    (framework === "all" || o.framework.startsWith(framework)) &&
    (status === "all" || o.status === status) &&
    (search === "" || o.title.toLowerCase().includes(search.toLowerCase()) || o.code.toLowerCase().includes(search.toLowerCase()))
  ), [framework, status, search]);

  const dora = filtered.filter((o) => o.framework.startsWith("DORA"));
  const sol = filtered.filter((o) => o.framework.startsWith("Solvencia"));

  const kpis = {
    total: obligations.length,
    cubiertas: obligations.filter((o) => o.status === "CUBIERTA").length,
    parcial: obligations.filter((o) => o.status === "EN REMEDIACIÓN" || o.status === "EXCEPCIÓN ACTIVA").length,
    sin: obligations.filter((o) => o.status === "SIN CONTROL").length,
  };

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <ShieldCheck className="h-6 w-6 text-primary" />Obligaciones y Controles
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Trazabilidad norma → obligación → control → evidencia</p>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-4 gap-4">
        <Kpi label="Total obligaciones" value={kpis.total} icon={ClipboardList} tone="primary" />
        <Kpi label="Cubiertas" value={kpis.cubiertas} icon={CheckCircle} tone="success" />
        <Kpi label="Cobertura parcial / en remediación" value={kpis.parcial} icon={AlertCircle} tone="warning" />
        <Kpi label="Sin control asignado" value={kpis.sin} icon={XCircle} tone="critical" />
      </div>

      <div className="mb-5 flex items-start gap-3 rounded-md border border-status-critical/30 border-l-4 border-l-status-critical bg-status-critical-bg p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-status-critical" />
        <div className="flex-1 text-sm">
          <div className="font-semibold text-status-critical">OBL-DORA-003 no tiene ningún control asignado</div>
          <div className="mt-1 text-xs text-status-critical/90">Pruebas de resiliencia operativa (DORA Art. 24) — acción inmediata requerida.</div>
        </div>
        <Button asChild size="sm" variant="outline" className="border-status-critical/40 text-status-critical hover:bg-status-critical/5">
          <Link to="/obligaciones/OBL-DORA-003">Ver obligación →</Link>
        </Button>
      </div>

      <Card className="mb-5 p-4">
        <div className="grid grid-cols-3 gap-3">
          <Select value={framework} onValueChange={setFramework}>
            <SelectTrigger><SelectValue placeholder="Marco" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los marcos</SelectItem>
              <SelectItem value="DORA">DORA</SelectItem>
              <SelectItem value="Solvencia">Solvencia II</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="CUBIERTA">Cubierta</SelectItem>
              <SelectItem value="EN REMEDIACIÓN">En remediación</SelectItem>
              <SelectItem value="SIN CONTROL">Sin control</SelectItem>
              <SelectItem value="EXCEPCIÓN ACTIVA">Excepción activa</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Buscar obligación..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </Card>

      <Card className="overflow-hidden">
        {dora.length > 0 && (
          <>
            <div className="border-b bg-accent/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-primary">
              DORA — Resiliencia Operativa Digital
            </div>
            <ObligationTable rows={dora} />
          </>
        )}
        {sol.length > 0 && (
          <>
            <div className="border-y bg-status-warning-bg px-4 py-2 text-xs font-semibold uppercase tracking-wide text-status-warning">
              Solvencia II
            </div>
            <ObligationTable rows={sol} />
          </>
        )}
      </Card>
    </div>
  );
}

function ObligationTable({ rows }: { rows: typeof obligations }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-32">Código</TableHead>
          <TableHead>Obligación</TableHead>
          <TableHead className="w-32">Marco</TableHead>
          <TableHead className="w-40">Artículo</TableHead>
          <TableHead className="w-28">Política</TableHead>
          <TableHead className="w-32">Control</TableHead>
          <TableHead className="w-44">Cobertura / Estado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((o) => {
          const noCoverage = o.status === "SIN CONTROL";
          const remediation = o.status === "EN REMEDIACIÓN";
          const exception = o.status === "EXCEPCIÓN ACTIVA";
          return (
            <TableRow key={o.id} className={cn(noCoverage && "bg-status-critical-bg hover:bg-status-critical-bg", (remediation || exception) && "bg-status-warning-bg/60 hover:bg-status-warning-bg")}>
              <TableCell><Link to={`/obligaciones/${o.code}`} className="font-mono text-xs text-primary hover:underline">{o.code}</Link></TableCell>
              <TableCell><Link to={`/obligaciones/${o.code}`} className="text-sm font-medium hover:text-primary">{o.title}</Link></TableCell>
              <TableCell className="text-xs text-muted-foreground">{o.framework}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{o.article}</TableCell>
              <TableCell><Link to={`/politicas/${o.policyId}`} className="font-mono text-xs text-primary hover:underline">{o.policyId}</Link></TableCell>
              <TableCell>
                {o.controlId ? (
                  <Link to={`/obligaciones/controles/${o.controlId}`} className="font-mono text-xs text-primary hover:underline">{o.controlId}</Link>
                ) : (
                  <span className="font-mono text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <StatusBadge label={o.coverage} pulse={noCoverage} tone={noCoverage ? "critical" : exception ? "warning" : remediation ? "warning" : "active"} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
