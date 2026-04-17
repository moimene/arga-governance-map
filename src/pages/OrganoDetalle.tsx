import { Link, useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ObjectHeader } from "@/components/ObjectHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { getBodyById } from "@/data/bodies";
import { getRegulationById } from "@/data/regulations";
import { cdaMembers, getMeetingsByBody } from "@/data/meetings";
import { getEntityById } from "@/data/entities";
import { people } from "@/data/people";
import { AlertTriangle, CalendarPlus, Download, Network, Plus, UserPlus } from "lucide-react";

export default function OrganoDetalle() {
  const { id = "consejo-administracion" } = useParams();
  const body = getBodyById(id);
  if (!body) {
    return <div className="p-10 text-center text-sm text-muted-foreground">Órgano no encontrado. <Link to="/organos" className="text-primary underline">Volver</Link></div>;
  }
  const entity = getEntityById(body.entityId);
  const regulation = body.regulationId ? getRegulationById(body.regulationId) : null;
  const bodyMeetings = getMeetingsByBody(body.id);
  const isCda = body.id === "consejo-administracion";
  const members = isCda ? cdaMembers : [];
  const alertCount = members.filter((m) => m.status !== "VIGENTE").length;

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <ObjectHeader
        crumbs={[{ label: "Inicio", to: "/" }, { label: "Órganos y Reuniones", to: "/organos" }, { label: body.name }]}
        title={body.name}
        badges={
          <>
            <StatusBadge label={body.status === "Activo" ? "ACTIVO" : "INACTIVO"} tone={body.status === "Activo" ? "active" : "neutral"} />
            <StatusBadge label="Grupo" tone="neutral" />
            {entity && <StatusBadge label={entity.legalName} tone="info" />}
          </>
        }
        metadata={
          <>Reglamento: <span className="font-mono text-xs">{body.regulationId ?? "—"}</span> · Quórum: {body.quorum} · Frecuencia: {body.frequency}</>
        }
        owner={<>Secretaría: <span className="font-medium text-foreground">{body.secretary}</span></>}
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5"><CalendarPlus className="h-3.5 w-3.5" />Nueva reunión</Button>
            <Button variant="outline" size="sm" asChild className="gap-1.5"><Link to="/governance-map"><Network className="h-3.5 w-3.5" />Ver en mapa</Link></Button>
            <Button variant="outline" size="sm" className="gap-1.5"><Download className="h-3.5 w-3.5" />Exportar</Button>
          </>
        }
      />

      {isCda && alertCount > 0 && (
        <div className="mt-4 flex items-start gap-3 rounded-md border border-status-warning/30 border-l-4 border-l-status-warning bg-status-warning-bg p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-status-warning" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-status-warning">{alertCount} mandatos vencidos o próximos a vencer en este órgano</div>
            <div className="mt-0.5 text-xs text-status-warning/80">Acción requerida antes del 30/04/2026.</div>
          </div>
          <Button size="sm" variant="outline" className="border-status-warning/40 text-status-warning hover:bg-status-warning/10">Ver mandatos</Button>
        </div>
      )}

      <Tabs defaultValue="composicion" className="mt-6">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="composicion">Composición</TabsTrigger>
          <TabsTrigger value="calendario">Calendario</TabsTrigger>
          <TabsTrigger value="reglamento">Reglamento</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="composicion" className="mt-4">
          <Card>
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="text-sm font-semibold">Miembros ({members.length})</div>
              <Button size="sm" variant="outline" className="gap-1.5"><UserPlus className="h-3.5 w-3.5" />Añadir miembro</Button>
            </div>
            {isCda ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Inicio mandato</TableHead>
                    <TableHead>Vencimiento</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((m) => {
                    const p = people.find((x) => x.id === m.personId);
                    return (
                      <TableRow key={m.personId}>
                        <TableCell className="font-medium">{p?.name}</TableCell>
                        <TableCell className="text-sm">{m.role}</TableCell>
                        <TableCell className="text-sm">{m.type}</TableCell>
                        <TableCell className="font-mono text-xs">{m.mandateStart ?? "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{m.mandateEnd ?? "—"}</TableCell>
                        <TableCell><StatusBadge label={m.status} /></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="p-10 text-center text-sm text-muted-foreground">Composición disponible en módulo extendido.</div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="calendario" className="mt-4">
          <Card>
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="text-sm font-semibold">Reuniones ({bodyMeetings.length})</div>
              <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" />Convocar reunión</Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Hora</TableHead>
                  <TableHead>Modalidad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acuerdos</TableHead>
                  <TableHead>Acta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bodyMeetings.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell><Link to={`/organos/${body.id}/reuniones/${m.id}`} className="font-mono text-xs text-primary hover:underline">{m.date}</Link></TableCell>
                    <TableCell className="font-mono text-xs">{m.time}</TableCell>
                    <TableCell className="text-sm">{m.modality}</TableCell>
                    <TableCell><StatusBadge label={m.status} /></TableCell>
                    <TableCell className="text-sm">{m.agreements?.length ?? "—"}</TableCell>
                    <TableCell className="text-sm">{m.minutesStatus === "FIRMADA" ? <span className="text-status-active">Firmada</span> : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="reglamento" className="mt-4">
          {regulation ? (
            <Card className="p-6">
              <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
                <div>
                  <h2 className="text-lg font-semibold">{regulation.title}</h2>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Versión {regulation.version} · Aprobado por {regulation.approvedBy} · {regulation.approvalDate}
                  </div>
                </div>
                <StatusBadge label={regulation.status} />
              </div>
              {regulation.sections.length > 0 ? (
                <Accordion type="multiple" className="mt-4">
                  {regulation.sections.map((s, i) => (
                    <AccordionItem key={i} value={`s${i}`}>
                      <AccordionTrigger className="text-sm font-semibold">{i + 1}. {s.title}</AccordionTrigger>
                      <AccordionContent className="text-sm leading-relaxed text-muted-foreground">{s.body}</AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <div className="mt-6 text-center text-sm text-muted-foreground">Texto íntegro disponible bajo descarga.</div>
              )}
              <div className="mt-6 flex justify-end">
                <Button variant="outline" className="gap-1.5"><Download className="h-4 w-4" />Descargar {regulation.id} PDF</Button>
              </div>
            </Card>
          ) : (
            <Card className="p-10 text-center text-sm text-muted-foreground">Este órgano no tiene reglamento formal asociado.</Card>
          )}
        </TabsContent>

        <TabsContent value="historial" className="mt-4">
          <Card className="p-6">
            <ul className="space-y-4">
              {[
                { date: "15/01/2024", actor: "Junta General", action: "REG-001 aprobado en versión 3.2" },
                { date: "01/03/2024", actor: "Junta General", action: "Nombramiento Dña. Isabel Moreno como Consejera Dominical" },
                { date: "01/09/2023", actor: "Junta General", action: "Inicio mandato D. Ricardo Vega como Consejero Ejecutivo" },
                { date: "30/06/2025", actor: "Sistema", action: "Vencimiento mandato Dña. Carmen Delgado — sin renovación formal", alert: true },
              ].map((e, i) => (
                <li key={i} className="flex items-start gap-4">
                  <div className="w-24 shrink-0 font-mono text-xs text-muted-foreground">{e.date}</div>
                  <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${e.alert ? "bg-status-critical" : "bg-primary"}`} />
                  <div className="flex-1 text-sm">
                    <div className={e.alert ? "text-status-critical font-medium" : "text-foreground"}>{e.action}</div>
                    <div className="text-xs text-muted-foreground">por {e.actor}</div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
