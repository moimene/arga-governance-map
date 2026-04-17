import { Link, useParams } from "react-router-dom";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ObjectHeader } from "@/components/ObjectHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { controls } from "@/data/controls";
import { obligations } from "@/data/obligations";
import { AlertTriangle, ChevronDown, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ControlDetalle() {
  const { id } = useParams();
  const control = controls.find((c) => c.code === id);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!control) return <div className="p-6">Control no encontrado.</div>;

  const obligation = obligations.find((o) => o.id === control.obligationId);

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <ObjectHeader
        crumbs={[
          { label: "Inicio", to: "/" },
          { label: "Obligaciones y Controles", to: "/obligaciones" },
          { label: control.code },
        ]}
        title={control.title}
        badges={
          <>
            <StatusBadge label={control.status} tone={control.status === "EFECTIVO" ? "active" : control.status === "DEFICIENTE" || control.status === "EXCEPCIÓN VENCIDA" ? "critical" : "warning"} />
            <StatusBadge label={control.frequency} tone="neutral" />
            {obligation && <StatusBadge label={obligation.framework} tone="info" />}
          </>
        }
        metadata={
          <>
            <div>Código: {control.code} · Obligación: <Link to={`/obligaciones/${control.obligationId}`} className="text-primary hover:underline">{control.obligationId}</Link> · Owner: {control.owner}</div>
            <div className="mt-0.5">Última ejecución: {control.lastExecution} · Próxima ejecución: {control.nextExecution}</div>
          </>
        }
      />

      {control.findingId && (
        <div className="mt-4 flex items-start gap-3 rounded-md border border-status-warning/30 border-l-4 border-l-status-warning bg-status-warning-bg p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-status-warning" />
          <div className="flex-1 text-sm">
            <div className="font-semibold text-status-warning">Control calificado como {control.status} por Auditoría Interna</div>
            <div className="mt-1 text-xs text-status-warning/90">Ver hallazgo {control.findingId} para el detalle del seguimiento.</div>
          </div>
          <Button asChild size="sm" variant="outline" className="border-status-warning/40 text-status-warning hover:bg-status-warning/5">
            <Link to={`/hallazgos/${control.findingId}`}>Ver {control.findingId} →</Link>
          </Button>
        </div>
      )}

      <Tabs defaultValue="evidencias" className="mt-6">
        <TabsList>
          <TabsTrigger value="evidencias">Evidencias</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="evidencias" className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">ID</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead className="w-40">Tipo</TableHead>
                  <TableHead>Subido por</TableHead>
                  <TableHead className="w-28">Fecha</TableHead>
                  <TableHead className="w-44">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {control.evidences.map((ev) => {
                  const rejected = ev.status === "RECHAZADA";
                  const isExpanded = expanded === ev.id;
                  return (
                    <>
                      <TableRow
                        key={ev.id}
                        className={cn(rejected && "bg-status-critical-bg hover:bg-status-critical-bg cursor-pointer")}
                        onClick={() => rejected && setExpanded(isExpanded ? null : ev.id)}
                      >
                        <TableCell className="font-mono text-xs">
                          <div className="flex items-center gap-1">
                            {rejected && (isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />)}
                            {ev.id}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {ev.title}
                          {rejected && ev.rejectionReason && (
                            <div className="mt-1 line-clamp-2 text-xs text-status-critical/90">{ev.rejectionReason}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{ev.type}</TableCell>
                        <TableCell className="text-sm">{ev.uploadedBy}</TableCell>
                        <TableCell className="font-mono text-xs">{ev.uploadedDate}</TableCell>
                        <TableCell><StatusBadge label={ev.status} tone={ev.status === "VALIDADA" ? "active" : ev.status === "RECHAZADA" || ev.status === "VENCIDA" ? "critical" : "warning"} /></TableCell>
                      </TableRow>
                      {rejected && isExpanded && (
                        <TableRow key={`${ev.id}-detail`} className="bg-status-critical-bg/60 hover:bg-status-critical-bg/60">
                          <TableCell colSpan={6} className="py-3">
                            <div className="rounded-md border border-status-critical/30 bg-card p-4 text-sm">
                              <div className="font-semibold text-status-critical">Motivo del rechazo</div>
                              <p className="mt-1 text-foreground">
                                Rechazada por {ev.validatedBy} (Auditoría Interna) el {ev.uploadedDate}. {ev.rejectionReason}
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
            <div className="border-t p-4">
              <Button variant="outline" className="gap-1.5"><Plus className="h-4 w-4" />Cargar nueva evidencia</Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="historial" className="mt-4">
          <Card className="p-6">
            <ol className="relative space-y-5 border-l border-border pl-6">
              {[
                { date: "01/01/2025", text: "CTR-004 creado — vinculado a OBL-SOL-004" },
                { date: "01/04/2026", text: "EV-CTR004-002 y EV-CTR004-003 validadas — D. Álvaro Mendoza" },
                { date: "01/04/2026", text: "EV-001 rechazada — cobertura de LATAM insuficiente — D. Álvaro Mendoza" },
                { date: "02/04/2026", text: "HALL-001 creado y vinculado a CTR-004 — D. Álvaro Mendoza" },
                { date: "05/04/2026", text: "EV-CTR004-004 cargada por Dña. Lucía Paredes" },
              ].map((e, i) => (
                <li key={i}>
                  <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-primary" />
                  <div className="font-mono text-xs text-muted-foreground">{e.date}</div>
                  <div className="mt-0.5 text-sm">{e.text}</div>
                </li>
              ))}
            </ol>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
