import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KpiCard } from "@/components/KpiCard";
import { StatusBadge } from "@/components/StatusBadge";
import { findings } from "@/data/findings";
import { AlertOctagon, AlertTriangle, CheckCircle, ClipboardList, Clock, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const severityOrder: Record<string, number> = { "CRÍTICA": 0, "ALTA": 1, "MEDIA": 2, "BAJA": 3 };
const severityTone = (s: string) => s === "CRÍTICA" ? "critical" : s === "ALTA" ? "critical" : s === "MEDIA" ? "warning" : "neutral";

export default function HallazgosList() {
  const sorted = [...findings].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  const open = findings.filter((f) => f.status !== "CERRADO").length;
  const critical = findings.filter((f) => f.severity === "CRÍTICA").length;
  const closed = findings.filter((f) => f.status === "CERRADO").length;

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Hallazgos y Acciones</h1>
          <p className="mt-1 text-sm text-muted-foreground">Observaciones de auditoría, cumplimiento y planes de remediación.</p>
        </div>
        <Button className="gap-1"><Plus className="h-4 w-4" />Nuevo hallazgo</Button>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <KpiCard label="Total hallazgos" value={findings.length} icon={ClipboardList} tone="primary" />
        <KpiCard label="Críticos" value={critical} icon={AlertOctagon} tone="critical" />
        <KpiCard label="Abiertos / En remediación" value={open} icon={AlertTriangle} tone="warning" />
        <KpiCard label="Cerrados" value={closed} icon={CheckCircle} tone="success" />
        <KpiCard label="Vencidos" value={1} icon={Clock} tone="critical" />
      </div>

      <Card className="mt-6 overflow-hidden border-l-4 border-l-destructive bg-status-critical-bg">
        <div className="flex items-center justify-between gap-4 p-4">
          <div className="flex items-start gap-3">
            <AlertOctagon className="mt-0.5 h-5 w-5 shrink-0 text-destructive pulse-ring rounded-full" />
            <div>
              <div className="text-sm font-semibold text-destructive">HALL-008 CRÍTICO — Conflicto de interés no declarado en ARGA Brasil</div>
              <p className="mt-0.5 text-xs text-foreground/80">Bajo investigación de Auditoría Interna. 4 acciones correctivas activas.</p>
            </div>
          </div>
          <Button asChild size="sm" variant="destructive"><Link to="/hallazgos/HALL-008">Ver hallazgo →</Link></Button>
        </div>
      </Card>

      <Card className="mt-6 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Severidad</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Entidad</TableHead>
              <TableHead>Responsable</TableHead>
              <TableHead>Vence</TableHead>
              <TableHead>Origen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((f) => (
              <TableRow key={f.id} className={cn("cursor-pointer", f.severity === "CRÍTICA" && "bg-status-critical-bg")}>
                <TableCell className="font-mono text-xs font-semibold">
                  <Link to={`/hallazgos/${f.id}`} className="text-primary hover:underline">{f.id}</Link>
                </TableCell>
                <TableCell className="max-w-md text-sm">{f.title}</TableCell>
                <TableCell><StatusBadge label={f.severity} tone={severityTone(f.severity) as any} pulse={f.severity === "CRÍTICA"} /></TableCell>
                <TableCell><StatusBadge label={f.status} /></TableCell>
                <TableCell className="text-sm">{f.entity}</TableCell>
                <TableCell className="text-sm">{f.responsible}</TableCell>
                <TableCell className="text-sm">{f.dueDate}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{f.origin}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
