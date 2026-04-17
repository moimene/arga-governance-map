import { Link, useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ObjectHeader } from "@/components/ObjectHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { getMeetingById } from "@/data/meetings";
import { getBodyById } from "@/data/bodies";
import { cdaMembers } from "@/data/meetings";
import { people } from "@/data/people";
import { AlertTriangle, BellRing, Check, Clock, Download, FileCheck, FilePlus, Vote } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ReunionDetalle() {
  const { id = "", meetingId = "" } = useParams();
  const meeting = getMeetingById(meetingId);
  const body = getBodyById(id);

  if (!meeting || !body) {
    if (meetingId) {
      // Planned meeting placeholder
      return (
        <div className="mx-auto max-w-[1440px] p-6">
          <Card className="p-12 text-center">
            <Clock className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Reunión planificada</h2>
            <p className="mt-2 text-sm text-muted-foreground">Pendiente de convocatoria formal.</p>
            <Button asChild variant="outline" className="mt-6"><Link to="/organos">Volver</Link></Button>
          </Card>
        </div>
      );
    }
    return null;
  }

  const isConvocada = meeting.status === "CONVOCADA";
  const isCelebrada = meeting.status === "CELEBRADA";
  const isPr008 = (o: string | null) => o === "PR-008";
  const monthNames = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  const [d, m, y] = meeting.date.split("/");
  const titleDate = `${parseInt(d,10)} de ${monthNames[parseInt(m,10)-1]} de ${y}`;

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <ObjectHeader
        crumbs={[
          { label: "Inicio", to: "/" },
          { label: "Órganos y Reuniones", to: "/organos" },
          { label: body.name, to: `/organos/${body.id}` },
          { label: `Reunión ${meeting.date}` },
        ]}
        title={`${body.name} — ${titleDate}`}
        badges={
          <>
            <StatusBadge label={meeting.status} />
            <StatusBadge label={meeting.modality} tone="neutral" />
          </>
        }
        metadata={<>{meeting.date} · {meeting.time}h · {meeting.venue}{meeting.quorum ? ` · Quórum: ${meeting.quorum}` : ""}</>}
        owner={meeting.convener && <>Convocada por: <span className="font-medium text-foreground">{meeting.convener}</span></>}
        actions={
          isConvocada ? (
            <>
              <Button variant="outline" size="sm" className="gap-1.5"><BellRing className="h-3.5 w-3.5" />Enviar recordatorio</Button>
              <Button variant="outline" size="sm" className="gap-1.5"><Download className="h-3.5 w-3.5" />Descargar convocatoria</Button>
              <Button variant="outline" size="sm" className="gap-1.5"><FilePlus className="h-3.5 w-3.5" />Añadir material</Button>
            </>
          ) : null
        }
      />

      <Tabs defaultValue={isCelebrada ? "acuerdos" : "agenda"} className="mt-6">
        <TabsList className="grid w-full max-w-3xl grid-cols-7">
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
          <TabsTrigger value="materiales">Materiales</TabsTrigger>
          <TabsTrigger value="participantes">Participantes</TabsTrigger>
          <TabsTrigger value="votaciones">Votaciones</TabsTrigger>
          <TabsTrigger value="acuerdos">Acuerdos</TabsTrigger>
          <TabsTrigger value="acta">Acta</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        {/* AGENDA */}
        <TabsContent value="agenda" className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">N</TableHead>
                  <TableHead>Punto</TableHead>
                  <TableHead className="w-40">Tipo</TableHead>
                  <TableHead className="w-48">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {meeting.agenda?.map((a) => {
                  const highlight = isPr008(a.relatedObject);
                  return (
                    <TableRow key={a.order} className={cn(highlight && "bg-status-warning-bg border-l-4 border-l-status-warning")}>
                      <TableCell className="font-mono text-xs">{a.order}</TableCell>
                      <TableCell>
                        <div className={cn("text-sm", highlight && "font-semibold")}>{a.title}</div>
                        {a.notes && <div className="mt-0.5 text-xs text-muted-foreground">{a.notes}</div>}
                        {highlight && <Link to={`/politicas/${a.relatedObject}`} className="mt-1 inline-block text-xs text-primary hover:underline">Ver política →</Link>}
                      </TableCell>
                      <TableCell className="text-sm">{a.type}</TableCell>
                      <TableCell><StatusBadge label={a.status} tone={a.status === "PENDIENTE APROBACIÓN" ? "pending" : "warning"} /></TableCell>
                    </TableRow>
                  );
                }) ?? (
                  <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">Sin agenda registrada</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* MATERIALES */}
        <TabsContent value="materiales" className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Subido por</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="w-32">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {meeting.materials?.length ? meeting.materials.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.title}</TableCell>
                    <TableCell className="text-sm">{m.type}</TableCell>
                    <TableCell className="text-sm">{m.uploadedBy}</TableCell>
                    <TableCell className="font-mono text-xs">{m.uploadedDate}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-7 px-2"><Download className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">Ver</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">Sin materiales subidos</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* PARTICIPANTES */}
        <TabsContent value="participantes" className="mt-4">
          {(meeting.participantsPending?.length ?? 0) > 0 && (
            <div className="mb-4 flex items-start gap-3 rounded-md border border-status-warning/30 border-l-4 border-l-status-warning bg-status-warning-bg p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-status-warning" />
              <div className="flex-1 text-sm">
                <div className="font-semibold text-status-warning">{meeting.participantsPending!.length} consejeros aún no han confirmado asistencia</div>
                <div className="mt-0.5 text-xs text-status-warning/80">Reunión requiere quórum mínimo de 5.</div>
              </div>
              <Button size="sm" variant="outline" className="border-status-warning/40 text-status-warning hover:bg-status-warning/10">Enviar recordatorio</Button>
            </div>
          )}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead className="w-40">Confirmación</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cdaMembers.map((m) => {
                  const p = people.find((x) => x.id === m.personId);
                  const confirmed = meeting.participantsConfirmed?.includes(m.personId);
                  const pending = meeting.participantsPending?.includes(m.personId);
                  return (
                    <TableRow key={m.personId}>
                      <TableCell className="font-medium">{p?.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.role}</TableCell>
                      <TableCell>
                        {confirmed ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-status-active"><Check className="h-3.5 w-3.5" />Confirmado</span>
                        ) : pending ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-status-warning"><Clock className="h-3.5 w-3.5" />Pendiente</span>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* VOTACIONES */}
        <TabsContent value="votaciones" className="mt-4">
          {isCelebrada && meeting.agreements ? (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Acuerdo</TableHead>
                    <TableHead>Asunto</TableHead>
                    <TableHead className="w-20 text-center">A favor</TableHead>
                    <TableHead className="w-20 text-center">En contra</TableHead>
                    <TableHead className="w-24 text-center">Abstenciones</TableHead>
                    <TableHead>Resultado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {meeting.agreements.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono text-xs">{a.id}</TableCell>
                      <TableCell className="text-sm">{a.title}</TableCell>
                      <TableCell className="text-center font-semibold text-status-active">{a.votesFor}</TableCell>
                      <TableCell className="text-center text-status-critical">{a.votesAgainst}</TableCell>
                      <TableCell className="text-center text-muted-foreground">{a.abstentions}</TableCell>
                      <TableCell><StatusBadge label={a.result.includes("UNANIMIDAD") ? "UNANIMIDAD" : "APROBADO"} tone="active" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ) : (
            <EmptyState icon={Vote} text="Las votaciones se registran durante o tras la celebración de la reunión. La reunión aún no ha tenido lugar." />
          )}
        </TabsContent>

        {/* ACUERDOS */}
        <TabsContent value="acuerdos" className="mt-4">
          {isCelebrada && meeting.agreements ? (
            <div className="space-y-4">
              {meeting.agreements.map((a) => (
                <Card key={a.id} className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{a.id}</span>
                        <StatusBadge label={a.result.includes("UNANIMIDAD") ? "UNANIMIDAD" : "APROBADO"} tone="active" />
                      </div>
                      <h3 className="mt-1.5 text-base font-semibold">{a.title}</h3>
                      <div className="mt-2 text-sm text-muted-foreground">
                        <span className="text-status-active font-semibold">{a.votesFor} a favor</span> · {a.votesAgainst} en contra · {a.abstentions} abstenciones
                      </div>
                    </div>
                    {a.relatedObject && (
                      <Button variant="outline" size="sm" asChild><Link to={`/politicas/${a.relatedObject}`}>Ver {a.relatedObject}</Link></Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState icon={Vote} text="Los acuerdos se adoptan durante la sesión. Disponibles tras la celebración." />
          )}
        </TabsContent>

        {/* ACTA */}
        <TabsContent value="acta" className="mt-4">
          {isCelebrada && meeting.minutesStatus === "FIRMADA" ? (
            <Card className="border-status-active/30 bg-status-active-bg p-6">
              <div className="flex items-start gap-4">
                <FileCheck className="h-10 w-10 shrink-0 text-status-active" />
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-foreground">Acta de la sesión de {meeting.date}</h3>
                  <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-status-active/30 bg-card px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-status-active">
                    <Check className="h-3 w-3" />FIRMADA — documento inmutable
                  </div>
                  <p className="mt-3 text-sm text-foreground">
                    Firmada el <span className="font-medium">{meeting.minutesSignedDate}</span> por: {meeting.minutesSignedBy}
                  </p>
                  <Button variant="outline" className="mt-4 gap-1.5"><Download className="h-4 w-4" />Descargar acta firmada</Button>
                  <p className="mt-4 text-xs text-muted-foreground">
                    Las actas firmadas son inmutables en TGMS. Solo pueden ser complementadas por diligencias posteriores, no modificadas.
                  </p>
                </div>
              </div>
            </Card>
          ) : (
            <EmptyState icon={FileCheck} text="El acta se redacta y firma tras la celebración de la reunión. Estado: pendiente de celebración." />
          )}
        </TabsContent>

        {/* TIMELINE */}
        <TabsContent value="timeline" className="mt-4">
          <Card className="p-6">
            <ul className="space-y-4">
              {[
                { date: "10/04/2026 10:30", actor: "Dña. Lucía Paredes", action: "Convocatoria enviada a 9 consejeros" },
                { date: "15/04/2026 11:00", actor: "Dña. Elena Navarro", action: "Material MAT-003 (Borrador PR-008) subido" },
                { date: "16/04/2026 09:00", actor: "D. Miguel Ortega", action: "Material MAT-004 (Informe jurídico PR-008) subido" },
                { date: "17/04/2026 16:00", actor: "D. Pablo Navarro", action: "Material MAT-002 (Informe Q1) subido" },
                { date: "17/04/2026", actor: "Sistema", action: "D. Fernando López: confirmación de asistencia pendiente" },
              ].map((e, i) => (
                <li key={i} className="flex items-start gap-4">
                  <div className="w-32 shrink-0 font-mono text-xs text-muted-foreground">{e.date}</div>
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <div className="flex-1 text-sm">
                    <div className="text-foreground">{e.action}</div>
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

function EmptyState({ icon: Icon, text }: { icon: typeof Vote; text: string }) {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
      <Icon className="h-10 w-10 text-muted-foreground/40" />
      <p className="max-w-md text-sm text-muted-foreground">{text}</p>
    </Card>
  );
}
