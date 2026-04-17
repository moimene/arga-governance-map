import { useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { getSiiCaseById } from "@/data/sii";
import { ChevronRight, Lock, Eye, ClipboardCheck } from "lucide-react";

export default function SiiCaseDetalle() {
  const { id } = useParams<{ id: string }>();
  const c = id ? getSiiCaseById(id) : undefined;
  if (!c) return <div className="p-6 text-sii-foreground">Caso no encontrado.</div>;

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <nav className="mb-3 flex items-center gap-1 text-xs text-sii-foreground/70">
        <Link to="/sii" className="hover:text-sii-foreground">SII</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-sii-foreground">{c.id}</span>
      </nav>

      <Card className="border-sii-border p-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge label={c.status} tone="info" />
          <StatusBadge label={c.confidentiality.split("—")[0].trim()} tone="warning" />
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-sii-foreground">{c.id} — {c.category}</h1>
        <div className="mt-1 text-sm text-sii-foreground/80">
          Recibido: {c.receivedDate} · Canal: {c.channel} · Investigadora: {c.investigator}
        </div>
      </Card>

      <Tabs defaultValue="expediente" className="mt-6">
        <TabsList>
          <TabsTrigger value="expediente">Expediente</TabsTrigger>
          <TabsTrigger value="actuaciones">Actuaciones</TabsTrigger>
          <TabsTrigger value="evidencias">Evidencias</TabsTrigger>
          <TabsTrigger value="resolucion">Resolución</TabsTrigger>
          <TabsTrigger value="log">Log de auditoría</TabsTrigger>
        </TabsList>

        <TabsContent value="expediente">
          <Card className="space-y-4 p-6 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-muted-foreground">Recepción:</span> <strong>{c.receivedDate}</strong></div>
              <div><span className="text-muted-foreground">Canal:</span> <strong>{c.channel}</strong></div>
              <div><span className="text-muted-foreground">Categoría:</span> <strong>{c.category}</strong></div>
              <div><span className="text-muted-foreground">Investigadora:</span> <strong>{c.investigator}</strong></div>
              <div className="col-span-2"><span className="text-muted-foreground">Confidencialidad:</span> <strong>{c.confidentiality}</strong></div>
            </div>
            <div className="rounded-md bg-status-warning-bg p-4 text-sii-foreground">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide">Resumen</div>
              <p>{c.summary}</p>
            </div>
            <p className="text-xs italic text-muted-foreground">La identidad del denunciante es desconocida (canal anónimo). Protección garantizada por Ley 2/2023.</p>
            {c.relatedFinding && (
              <div className="flex items-center gap-2 text-sm">
                <span>Correlación:</span>
                <Link to={`/hallazgos/${c.relatedFinding}`}>
                  <StatusBadge label={`${c.relatedFinding} correlacionado`} tone="critical" />
                </Link>
                <span className="text-xs italic text-muted-foreground">(saliendo de zona SII)</span>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="actuaciones">
          <Card className="p-5">
            <ol className="space-y-4">
              {c.actions.map((a, i) => (
                <li key={i} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span className="h-2.5 w-2.5 rounded-full bg-sii-border" />
                    {i < c.actions.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
                  </div>
                  <div className="flex-1 pb-3">
                    <div className="text-sm font-medium text-foreground">{a.action}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{a.date} · {a.actor}</div>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </TabsContent>

        <TabsContent value="evidencias">
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {c.evidences.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-xs font-semibold">{e.id}</TableCell>
                    <TableCell className="text-sm">{e.title}</TableCell>
                    <TableCell className="text-sm">{e.type}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 rounded-full border border-sii-border bg-status-warning-bg px-2 py-0.5 text-[11px] font-semibold uppercase text-sii-foreground">
                        <Lock className="h-3 w-3" /> {e.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => toast("Acceso a evidencias cifradas requiere autenticación reforzada — disponible en producción")}>
                        <Eye className="h-3 w-3" />Ver metadatos
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="border-t border-border p-3 text-xs italic text-muted-foreground">
              Todas las evidencias en el expediente SII están cifradas en reposo y en tránsito. El acceso está auditado de forma independiente.
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="resolucion">
          <Card className="p-10 text-center">
            <ClipboardCheck className="mx-auto h-10 w-10 text-muted-foreground/50" />
            {c.closedDate ? (
              <>
                <h3 className="mt-3 text-base font-semibold">Caso cerrado el {c.closedDate}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{c.closingReason}</p>
              </>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">La resolución se registrará cuando la investigación concluya. Estado actual: <strong>{c.status}</strong>.</p>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="log">
          <Card className="p-5">
            <ol className="space-y-3 text-sm">
              <li>10/04/2026 09:02 — Caso creado en sistema SII — Sistema SII</li>
              <li>10/04/2026 09:02 — Caso asignado a Dña. Elena Navarro — Sistema SII</li>
              <li>11/04/2026 10:15 — Acceso: Dña. Elena Navarro — consulta expediente</li>
              <li>14/04/2026 16:20 — Acceso: Dña. Elena Navarro — añadida actuación</li>
              <li>17/04/2026 09:00 — Acceso: Dña. Elena Navarro — consulta expediente</li>
            </ol>
            <p className="mt-4 text-xs italic text-muted-foreground">
              Este log es independiente del log de auditoría del sistema principal TGMS. Los accesos a la zona SII se registran en un sistema separado para garantizar la independencia funcional.
            </p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
