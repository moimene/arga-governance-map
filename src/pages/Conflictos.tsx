import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiCard } from "@/components/KpiCard";
import { StatusBadge } from "@/components/StatusBadge";
import { useConflictsList, useAttestationsList } from "@/hooks/useConflicts";
import { relatedPartyTransactions, type RelatedPartyTransaction } from "@/data/conflicts";
import { Scale, ShieldAlert, CheckCircle, AlertTriangle, Bell, Download } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ConflictosList() {
  const [selectedOpv, setSelectedOpv] = useState<RelatedPartyTransaction | null>(null);
  const { data: conflicts = [], isLoading: loadingConflicts } = useConflictsList();
  const { data: attestations = [], isLoading: loadingAtts } = useAttestationsList();

  const conflictKpis = useMemo(() => {
    const permanentes = conflicts.filter((c) => c.conflict_type === "Permanente").length;
    const situacionales = conflicts.filter((c) => c.conflict_type === "Situacional").length;
    const noDeclarados = conflicts.filter((c) => c.status === "Pendiente" || c.status === "No declarado" || !!c.related_finding_id).length;
    return { permanentes, situacionales, noDeclarados };
  }, [conflicts]);

  const completed = attestations.filter((a) => a.status === "Completada").length;
  const total = attestations.length;
  const pending = total - completed;
  const progress = total === 0 ? 0 : Math.round((completed / total) * 100);

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
        <Scale className="h-6 w-6 text-primary" />Conflictos, Operaciones Vinculadas y Attestations
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">Los tres vectores de integridad del Grupo ARGA Seguros.</p>

      <Tabs defaultValue="conflictos" className="mt-6">
        <TabsList>
          <TabsTrigger value="conflictos">Conflictos de Interés</TabsTrigger>
          <TabsTrigger value="operaciones">Operaciones Vinculadas</TabsTrigger>
          <TabsTrigger value="attestations">Attestations</TabsTrigger>
        </TabsList>

        {/* === CONFLICTOS === */}
        <TabsContent value="conflictos" className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <KpiCard label="Conflictos permanentes declarados" value={conflictKpis.permanentes} icon={CheckCircle} tone="success" />
            <KpiCard label="Conflictos situacionales" value={conflictKpis.situacionales} icon={CheckCircle} tone="success" />
            <KpiCard label="Pendientes / No declarados" value={conflictKpis.noDeclarados} icon={ShieldAlert} tone="critical" />
          </div>

          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Persona</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingConflicts && Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                ))}
                {!loadingConflicts && conflicts.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">Sin conflictos registrados.</TableCell></TableRow>
                )}
                {!loadingConflicts && conflicts.map((c) => {
                  const isPending = c.status === "Pendiente" || c.status === "No declarado";
                  return (
                    <TableRow key={c.id} className={cn(isPending && "bg-status-critical-bg tour-target")} data-tour={isPending ? "conflict-row" : undefined}>
                      <TableCell className="font-mono text-xs font-semibold">{c.code}</TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{c.person_name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{c.person_role ?? "—"}</div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge label={c.conflict_type.toUpperCase()} tone={c.conflict_type === "Permanente" ? "info" : "warning"} />
                      </TableCell>
                      <TableCell className="max-w-md text-sm">{c.description}</TableCell>
                      <TableCell>
                        {c.finding_code ? (
                          <Link to={`/hallazgos/${c.finding_code}`}>
                            <StatusBadge label={`PENDIENTE — VER ${c.finding_code}`} tone="critical" pulse />
                          </Link>
                        ) : isPending ? (
                          <StatusBadge label="PENDIENTE" tone="critical" pulse />
                        ) : (
                          <StatusBadge label={c.status.toUpperCase()} tone="active" />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* === OPERACIONES VINCULADAS === */}
        <TabsContent value="operaciones">
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Importe</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Precio mercado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {relatedPartyTransactions.map((o) => (
                  <TableRow key={o.id} onClick={() => setSelectedOpv(o)} className={cn("cursor-pointer", o.status.includes("REVISIÓN") && "bg-status-warning-bg")}>
                    <TableCell className="font-mono text-xs font-semibold">{o.id}</TableCell>
                    <TableCell className="max-w-md text-sm">
                      <div>{o.title}</div>
                      {o.relatedPerson && <div className="mt-0.5 text-xs italic text-muted-foreground">{o.relatedPerson}</div>}
                    </TableCell>
                    <TableCell className="text-sm">{o.type}</TableCell>
                    <TableCell className="text-sm font-medium">{o.amount}</TableCell>
                    <TableCell><StatusBadge label={o.status} tone={o.status === "APROBADA" ? "active" : "warning"} /></TableCell>
                    <TableCell className="text-sm">{o.armLength}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <Sheet open={!!selectedOpv} onOpenChange={(o) => !o && setSelectedOpv(null)}>
            <SheetContent className="w-[480px] sm:max-w-md">
              {selectedOpv && (
                <>
                  <SheetHeader>
                    <SheetTitle>{selectedOpv.id}</SheetTitle>
                    <SheetDescription>{selectedOpv.title}</SheetDescription>
                  </SheetHeader>
                  <div className="mt-6 space-y-3 text-sm">
                    <div><strong>Tipo:</strong> {selectedOpv.type}</div>
                    <div><strong>Importe:</strong> {selectedOpv.amount}</div>
                    <div><strong>Aprobado por:</strong> {selectedOpv.approvedBy}</div>
                    <div><strong>Fecha aprobación:</strong> {selectedOpv.approvalDate ?? "—"}</div>
                    <div><strong>Precio de mercado:</strong> {selectedOpv.armLength}</div>
                    {selectedOpv.relatedPerson && <div><strong>Parte vinculada:</strong> {selectedOpv.relatedPerson}</div>}
                    <div className="rounded-md bg-status-warning-bg p-3 text-xs">{selectedOpv.notes}</div>
                    {selectedOpv.findingId && (
                      <Link to={`/hallazgos/${selectedOpv.findingId}`} className="inline-flex items-center text-sm text-primary hover:underline">
                        Ver hallazgo {selectedOpv.findingId} →
                      </Link>
                    )}
                  </div>
                </>
              )}
            </SheetContent>
          </Sheet>
        </TabsContent>

        {/* === ATTESTATIONS === */}
        <TabsContent value="attestations" className="space-y-4">
          {pending > 0 && (
            <Card className="border-l-4 border-l-status-warning bg-status-warning-bg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-status-warning" />
                <p className="text-sm text-foreground">
                  <strong>{pending} consejeros y directivos</strong> no han completado la attestation anual. Campaña activa — completar antes de la fecha límite.
                </p>
              </div>
            </Card>
          )}

          <Card className="p-5">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-semibold">Progreso de la campaña</span>
              <span className="font-mono">{completed} / {total} completadas ({progress}%)</span>
            </div>
            <Progress value={progress} className="h-3" />
            <div className="mt-2 text-xs text-muted-foreground">{completed} completadas · {pending} pendientes</div>
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" className="gap-1" onClick={() => toast.success(`Recordatorio enviado a ${pending} personas`)}>
              <Bell className="h-4 w-4" />Enviar recordatorio a pendientes
            </Button>
            <Button variant="outline" size="sm" className="gap-1" onClick={() => toast("Exportación generada (simulada)")}>
              <Download className="h-4 w-4" />Exportar estado campaña
            </Button>
          </div>

          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Campaña</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingAtts && Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                ))}
                {!loadingAtts && attestations.map((a) => {
                  const isPending = a.status === "Pendiente";
                  return (
                    <TableRow key={a.id} className={cn(isPending && "bg-status-warning-bg/50")}>
                      <TableCell className="text-sm font-medium">{a.person_name ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{a.person_role ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{a.campaign}</TableCell>
                      <TableCell>
                        <StatusBadge label={a.status.toUpperCase()} tone={a.status === "Completada" ? "active" : "warning"} />
                      </TableCell>
                      <TableCell className="text-sm">{a.completed_at ?? "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
