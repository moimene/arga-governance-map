import { Link, useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ObjectHeader } from "@/components/ObjectHeader";
import { StatusBadge } from "@/components/StatusBadge";
import {
  useMeetingBySlug,
  useMeetingAgenda,
  useMeetingParticipants,
  useBodyBySlug,
  formatDate,
  formatTime,
} from "@/hooks/useBodies";
import { BellRing, Check, Clock, Download, FileCheck, FilePlus, Vote } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ReunionDetalle() {
  const { id = "", meetingId = "" } = useParams();
  const { data: body } = useBodyBySlug(id);
  const { data: meeting, isLoading } = useMeetingBySlug(meetingId);
  const { data: agenda = [] } = useMeetingAgenda(meeting?.id);
  const { data: participants = [] } = useMeetingParticipants(meeting?.body_id);

  if (isLoading) {
    return <div className="p-10 text-center text-sm text-muted-foreground">Cargando…</div>;
  }

  if (!meeting) {
    return (
      <div className="mx-auto max-w-[1440px] p-6">
        <Card className="p-12 text-center">
          <Clock className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Reunión no encontrada</h2>
          <p className="mt-2 text-sm text-muted-foreground">La reunión no existe o aún no se ha convocado.</p>
          <Button asChild variant="outline" className="mt-6"><Link to="/organos">Volver</Link></Button>
        </Card>
      </div>
    );
  }

  const isConvocada = meeting.status === "CONVOCADA";
  const isCelebrada = meeting.status === "CELEBRADA";
  const meetingDate = formatDate(meeting.scheduled_start);
  const meetingTime = formatTime(meeting.scheduled_start);
  const monthNames = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  let titleDate = meetingDate;
  if (meeting.scheduled_start) {
    const d = new Date(meeting.scheduled_start);
    if (!isNaN(d.getTime())) titleDate = `${d.getDate()} de ${monthNames[d.getMonth()]} de ${d.getFullYear()}`;
  }
  const bodyName = body?.name ?? "Órgano";

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <ObjectHeader
        crumbs={[
          { label: "Inicio", to: "/" },
          { label: "Órganos y Reuniones", to: "/organos" },
          { label: bodyName, to: `/organos/${id}` },
          { label: `Reunión ${meetingDate}` },
        ]}
        title={`${bodyName} — ${titleDate}`}
        badges={
          <>
            <StatusBadge label={meeting.status ?? "—"} />
            {meeting.modality && <StatusBadge label={meeting.modality} tone="neutral" />}
          </>
        }
        metadata={<>{meetingDate} · {meetingTime}h{meeting.venue ? ` · ${meeting.venue}` : ""}</>}
        owner={meeting.secretary_name && <>Convocada por: <span className="font-medium text-foreground">{meeting.secretary_name}</span></>}
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

      <Tabs defaultValue={isCelebrada ? "acta" : "agenda"} className="mt-6">
        <TabsList className="grid w-full max-w-3xl grid-cols-4">
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
          <TabsTrigger value="participantes">Participantes</TabsTrigger>
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
                {agenda.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">Sin agenda registrada</TableCell></TableRow>
                ) : agenda.map((a) => {
                  const highlight = a.related_object === "PR-008";
                  return (
                    <TableRow key={a.id} className={cn(highlight && "bg-status-warning-bg border-l-4 border-l-status-warning")}>
                      <TableCell className="font-mono text-xs">{a.order_number}</TableCell>
                      <TableCell>
                        <div className={cn("text-sm", highlight && "font-semibold")}>{a.title}</div>
                        {a.notes && <div className="mt-0.5 text-xs text-muted-foreground">{a.notes}</div>}
                        {highlight && <Link to={`/politicas/${a.related_object}`} className="mt-1 inline-block text-xs text-primary hover:underline">Ver política →</Link>}
                      </TableCell>
                      <TableCell className="text-sm">{a.type ?? "—"}</TableCell>
                      <TableCell><StatusBadge label={a.status ?? "—"} tone={a.status === "PENDIENTE APROBACIÓN" ? "pending" : "warning"} /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* PARTICIPANTES */}
        <TabsContent value="participantes" className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead className="w-40">Estado mandato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {participants.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-8">Sin participantes activos</TableCell></TableRow>
                ) : participants.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.full_name ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{m.role ?? "—"}</TableCell>
                    <TableCell><StatusBadge label={m.status ?? "—"} tone="active" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ACTA */}
        <TabsContent value="acta" className="mt-4">
          {isCelebrada && meeting.minutes_status === "FIRMADA" ? (
            <Card className="border-status-active/30 bg-status-active-bg p-6">
              <div className="flex items-start gap-4">
                <FileCheck className="h-10 w-10 shrink-0 text-status-active" />
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-foreground">Acta de la sesión de {meetingDate}</h3>
                  <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-status-active/30 bg-card px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-status-active">
                    <Check className="h-3 w-3" />FIRMADA — documento inmutable
                  </div>
                  {meeting.secretary_name && (
                    <p className="mt-3 text-sm text-foreground">
                      Firmada por: {meeting.secretary_name}{meeting.president_name ? ` + ${meeting.president_name}` : ""}
                    </p>
                  )}
                  <Button variant="outline" className="mt-4 gap-1.5"><Download className="h-4 w-4" />Descargar acta firmada</Button>
                  <p className="mt-4 text-xs text-muted-foreground">
                    Las actas firmadas son inmutables en TGMS. Solo pueden ser complementadas por diligencias posteriores, no modificadas.
                  </p>
                </div>
              </div>
            </Card>
          ) : (
            <EmptyState icon={FileCheck} text="El acta se redacta y firma tras la celebración de la reunión." />
          )}
        </TabsContent>

        {/* TIMELINE */}
        <TabsContent value="timeline" className="mt-4">
          <Card className="p-10 text-center text-sm text-muted-foreground">Timeline de auditoría disponible próximamente.</Card>
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
