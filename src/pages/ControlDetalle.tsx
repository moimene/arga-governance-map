import { Link, useParams } from "react-router-dom";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ObjectHeader } from "@/components/ObjectHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { useControlByCode, useControlEvidences, useControlRelatedFindings } from "@/hooks/useControls";
import { controlStatusLabel, controlStatusTone, evidenceStatusLabel, evidenceStatusTone } from "@/hooks/usePoliciesObligations";
import { severityLabel, severityTone, formatDate } from "@/hooks/useFindings";
import { AlertTriangle, ChevronDown, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ControlDetalle() {
  const { code } = useParams();
  const { data: control, isLoading } = useControlByCode(code);
  const { data: evidences = [] } = useControlEvidences(control?.id);
  const { data: relatedFindings = [] } = useControlRelatedFindings(control?.obligation_id);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1440px] p-6 space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!control) return <div className="p-6">Control no encontrado.</div>;

  const linkedFinding = relatedFindings[0] as any | undefined;

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <ObjectHeader
        crumbs={[
          { label: "Inicio", to: "/" },
          { label: "Obligaciones y Controles", to: "/obligaciones" },
          { label: control.code },
        ]}
        title={control.name}
        badges={
          <>
            <StatusBadge label={controlStatusLabel(control.status)} tone={controlStatusTone(control.status)} />
            {control.obligation_source && <StatusBadge label={control.obligation_source} tone="info" />}
          </>
        }
        metadata={
          <>
            <div>
              Código: {control.code}
              {control.obligation_code && (
                <> · Obligación: <Link to={`/obligaciones/${control.obligation_code}`} className="text-primary hover:underline">{control.obligation_code}</Link></>
              )}
              {control.owner_name && <> · Owner: {control.owner_name}</>}
            </div>
            <div className="mt-0.5">Última prueba: {formatDate(control.last_test_date)} · Próxima prueba: {formatDate(control.next_test_date)}</div>
          </>
        }
      />

      {linkedFinding && (
        <div className="mt-4 flex items-start gap-3 rounded-md border border-status-warning/30 border-l-4 border-l-status-warning bg-status-warning-bg p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-status-warning" />
          <div className="flex-1 text-sm">
            <div className="font-semibold text-status-warning">Hallazgo relacionado: {linkedFinding.code}</div>
            <div className="mt-1 text-xs text-status-warning/90">{linkedFinding.title}</div>
          </div>
          <Button asChild size="sm" variant="outline" className="border-status-warning/40 text-status-warning hover:bg-status-warning/5">
            <Link to={`/hallazgos/${linkedFinding.code}`}>Ver {linkedFinding.code} →</Link>
          </Button>
        </div>
      )}

      <Tabs defaultValue="evidencias" className="mt-6">
        <TabsList>
          <TabsTrigger value="evidencias">Evidencias ({evidences.length})</TabsTrigger>
          <TabsTrigger value="hallazgos">Hallazgos ({relatedFindings.length})</TabsTrigger>
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
                {evidences.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">Sin evidencias cargadas.</TableCell></TableRow>
                )}
                {evidences.flatMap((ev) => {
                  const rejected = ev.status === "Rechazada";
                  const isExpanded = expanded === ev.id;
                  const rows = [
                    <TableRow
                      key={ev.id}
                      className={cn(rejected && "bg-status-critical-bg hover:bg-status-critical-bg cursor-pointer")}
                      onClick={() => rejected && setExpanded(isExpanded ? null : ev.id)}
                    >
                      <TableCell className="font-mono text-xs">
                        <div className="flex items-center gap-1">
                          {rejected && (isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />)}
                          {ev.id.slice(0, 8)}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {ev.title}
                        {rejected && ev.rejection_reason && (
                          <div className="mt-1 line-clamp-2 text-xs text-status-critical/90">{ev.rejection_reason}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{ev.ev_type ?? "—"}</TableCell>
                      <TableCell className="text-sm">{ev.owner_name ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{formatDate(ev.created_at?.slice(0, 10))}</TableCell>
                      <TableCell><StatusBadge label={evidenceStatusLabel(ev.status)} tone={evidenceStatusTone(ev.status)} /></TableCell>
                    </TableRow>
                  ];
                  if (rejected && isExpanded && ev.rejection_reason) {
                    rows.push(
                      <TableRow key={`${ev.id}-detail`} className="bg-status-critical-bg/60 hover:bg-status-critical-bg/60">
                        <TableCell colSpan={6} className="py-3">
                          <div className="rounded-md border border-status-critical/30 bg-card p-4 text-sm">
                            <div className="font-semibold text-status-critical">Motivo del rechazo</div>
                            <p className="mt-1 text-foreground">{ev.rejection_reason}</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  }
                  return rows;
                })}
              </TableBody>
            </Table>
            <div className="border-t p-4">
              <Button variant="outline" className="gap-1.5"><Plus className="h-4 w-4" />Cargar nueva evidencia</Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="hallazgos" className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Código</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead className="w-32">Severidad</TableHead>
                  <TableHead className="w-40">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {relatedFindings.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">Sin hallazgos asociados a esta obligación.</TableCell></TableRow>
                )}
                {relatedFindings.map((f: any) => (
                  <TableRow key={f.id}>
                    <TableCell><Link to={`/hallazgos/${f.code}`} className="font-mono text-xs text-primary hover:underline">{f.code}</Link></TableCell>
                    <TableCell className="text-sm">{f.title}</TableCell>
                    <TableCell><StatusBadge label={severityLabel(f.severity)} tone={severityTone(f.severity)} /></TableCell>
                    <TableCell><StatusBadge label={f.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
