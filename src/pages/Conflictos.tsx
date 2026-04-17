import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import { KpiCard } from "@/components/KpiCard";
import { StatusBadge } from "@/components/StatusBadge";
import { conflicts, relatedPartyTransactions, attestations2026, type RelatedPartyTransaction } from "@/data/conflicts";
import { people } from "@/data/people";
import { Scale, ShieldAlert, CheckCircle, AlertTriangle, Bell, Download } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ConflictosList() {
  const [selectedOpv, setSelectedOpv] = useState<RelatedPartyTransaction | null>(null);

  const completed = attestations2026.filter((a) => a.status === "COMPLETADA").length;
  const pending = attestations2026.length - completed;
  const progress = Math.round((completed / attestations2026.length) * 100);

  const personById = (id: string) => people.find((p) => p.id === id);

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><Scale className="h-6 w-6 text-primary" />Conflictos, Operaciones Vinculadas y Attestations</h1>
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
            <KpiCard label="Conflictos permanentes declarados" value={4} icon={CheckCircle} tone="success" />
            <KpiCard label="Conflictos situacionales" value={1} icon={CheckCircle} tone="success" />
            <KpiCard label="No declarados / En investigación" value={1} icon={ShieldAlert} tone="critical" />
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
                  <TableHead>Abstención</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...conflicts].sort((a) => a.findingId ? -1 : 1).map((c) => (
                  <TableRow key={c.id} className={cn(c.findingId && "bg-status-critical-bg tour-target")} data-tour={c.findingId ? "conflict-row" : undefined}>
                    <TableCell className="font-mono text-xs font-semibold">{c.id}</TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{c.person}</div>
                      <div className="text-xs text-muted-foreground">{c.role}</div>
                    </TableCell>
                    <TableCell><StatusBadge label={c.type} tone={c.type === "PERMANENTE" ? "info" : "warning"} /></TableCell>
                    <TableCell className="max-w-md text-sm">{c.description}</TableCell>
                    <TableCell>
                      {c.findingId ? (
                        <Link to={`/hallazgos/${c.findingId}`}>
                          <StatusBadge label={`NO DECLARADO — VER ${c.findingId}`} tone="critical" pulse />
                        </Link>
                      ) : c.status.includes("ABSTENCIÓN") ? (
                        <StatusBadge label="ABSTENCIÓN REGISTRADA ✅" tone="active" />
                      ) : (
                        <StatusBadge label="DECLARADO Y GESTIONADO" tone="active" />
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{c.abstentionRequired ? "Sí" : "No"}</TableCell>
                  </TableRow>
                ))}
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
          <Card className="border-l-4 border-l-status-warning bg-status-warning-bg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-status-warning" />
              <p className="text-sm text-foreground">
                <strong>{pending} consejeros y directivos</strong> no han completado la attestation anual 2026. Campaña lanzada el 01/04/2026 — fecha límite: 30/04/2026.
              </p>
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-semibold">Progreso de la campaña</span>
              <span className="font-mono">{completed} / {attestations2026.length} completadas ({progress}%)</span>
            </div>
            <Progress value={progress} className="h-3" />
            <div className="mt-2 text-xs text-muted-foreground">{completed} completadas · {pending} pendientes · 0 vencidas</div>
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
                  <TableHead>Entidad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Conflictos declarados</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attestations2026.map((a) => {
                  const p = personById(a.personId);
                  if (!p) return null;
                  return (
                    <TableRow key={a.personId}>
                      <TableCell className="text-sm font-medium">{p.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.role}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.entity}</TableCell>
                      <TableCell>
                        <StatusBadge label={a.status} tone={a.status === "COMPLETADA" ? "active" : "warning"} />
                        {a.note && <div className="mt-1 text-xs italic text-muted-foreground">{a.note}</div>}
                      </TableCell>
                      <TableCell className="text-sm">{a.completedDate ?? "—"}</TableCell>
                      <TableCell className="text-sm">{a.conflicts ?? "—"}</TableCell>
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
