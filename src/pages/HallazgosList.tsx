import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KpiCard } from "@/components/KpiCard";
import { StatusBadge } from "@/components/StatusBadge";
import { useFindingsList, severityLabel, severityTone, findingStatusLabel, originLabel, formatDate } from "@/hooks/useFindings";
import { AlertOctagon, AlertTriangle, CheckCircle, ClipboardList, Clock, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const severityOrder: Record<string, number> = { "Crítico": 0, "Alto": 1, "Medio": 2, "Bajo": 3 };

export default function HallazgosList() {
  const { data: findings = [], isLoading } = useFindingsList();
  const sorted = [...findings].sort((a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9));
  const open = findings.filter((f) => f.status !== "Cerrado").length;
  const critical = findings.filter((f) => f.severity === "Crítico").length;
  const closed = findings.filter((f) => f.status === "Cerrado").length;
  const today = new Date().toISOString().slice(0, 10);
  const overdue = findings.filter((f) => f.status !== "Cerrado" && f.due_date && f.due_date < today).length;

  const criticalFinding = findings.find((f) => f.severity === "Crítico");

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
        <KpiCard label="Vencidos" value={overdue} icon={Clock} tone="critical" />
      </div>

      {criticalFinding && (
        <Card className="mt-6 overflow-hidden border-l-4 border-l-destructive bg-status-critical-bg">
          <div className="flex items-center justify-between gap-4 p-4">
            <div className="flex items-start gap-3">
              <AlertOctagon className="mt-0.5 h-5 w-5 shrink-0 text-destructive pulse-ring rounded-full" />
              <div>
                <div className="text-sm font-semibold text-destructive">{criticalFinding.code} CRÍTICO — {criticalFinding.title}</div>
                <p className="mt-0.5 text-xs text-foreground/80">Bajo gestión activa. Responsable: {criticalFinding.owner_name ?? "—"}</p>
              </div>
            </div>
            <Button asChild size="sm" variant="destructive"><Link to={`/hallazgos/${criticalFinding.code}`}>Ver hallazgo →</Link></Button>
          </div>
        </Card>
      )}

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
            {isLoading && Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
            ))}
            {!isLoading && sorted.map((f) => (
              <TableRow key={f.id} className={cn("cursor-pointer", f.severity === "Crítico" && "bg-status-critical-bg")}>
                <TableCell className="font-mono text-xs font-semibold">
                  <Link to={`/hallazgos/${f.code}`} className="text-primary hover:underline">{f.code}</Link>
                </TableCell>
                <TableCell className="max-w-md text-sm">{f.title}</TableCell>
                <TableCell><StatusBadge label={severityLabel(f.severity)} tone={severityTone(f.severity)} pulse={f.severity === "Crítico"} /></TableCell>
                <TableCell><StatusBadge label={findingStatusLabel(f.status)} /></TableCell>
                <TableCell className="text-sm">{f.entity_name ?? "—"}</TableCell>
                <TableCell className="text-sm">{f.owner_name ?? "—"}</TableCell>
                <TableCell className="text-sm">{formatDate(f.due_date)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{originLabel(f.origin)}</TableCell>
              </TableRow>
            ))}
            {!isLoading && sorted.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">Sin hallazgos registrados.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
