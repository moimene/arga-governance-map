import { Link, useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ObjectHeader } from "@/components/ObjectHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { useBodyBySlug, useBodyMandates, useBodyMeetings, formatDate, formatTime } from "@/hooks/useBodies";
import { useConvocatoriasList, type ConvocatoriaWithBody } from "@/hooks/useConvocatorias";
import { getRegulationById } from "@/data/regulations";
import { AlertTriangle, CalendarPlus, Download, FileCheck2, Network, Plus, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

type BodyAgreement = {
  id: string;
  agreement_kind: string;
  matter_class: string;
  status: string;
  decision_date: string | null;
  proposal_text: string | null;
};

export default function OrganoDetalle() {
  const { id = "" } = useParams();
  const { data: body, isLoading } = useBodyBySlug(id);
  const { data: members = [] } = useBodyMandates(body?.id);
  const { data: bodyMeetings = [] } = useBodyMeetings(body?.id);
  const { data: allConvocatorias = [] } = useConvocatoriasList();
  const bodyId = body?.id;
  const bodyConvocatorias = (allConvocatorias as ConvocatoriaWithBody[])
    .filter((c) => c.body_id === bodyId)
    .slice(0, 5);
  const { data: bodyAgreements = [] } = useQuery<BodyAgreement[]>({
    queryKey: ["agreements", "by-body", bodyId ?? "none"],
    enabled: !!bodyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agreements")
        .select("id, agreement_kind, matter_class, status, decision_date, proposal_text")
        .eq("body_id", bodyId!)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as BodyAgreement[];
    },
  });

  if (isLoading) {
    return <div className="p-10 text-center text-sm text-muted-foreground">Cargando…</div>;
  }
  if (!body) {
    return <div className="p-10 text-center text-sm text-muted-foreground">Órgano no encontrado. <Link to="/organos" className="text-primary underline">Volver</Link></div>;
  }
  const entity = (body as typeof body & { entity?: { common_name?: string; legal_name?: string | null } | null }).entity ?? null;
  const regulation = body.regulation_id ? getRegulationById(body.regulation_id) : null;
  const alertCount = members.filter((m) => m.status && m.status !== "Activo" && m.status !== "VIGENTE").length;

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <ObjectHeader
        crumbs={[{ label: "Inicio", to: "/" }, { label: "Órganos y Reuniones", to: "/organos" }, { label: body.name }]}
        title={body.name}
        badges={
          <>
            <StatusBadge label={body.status === "Activo" ? "ACTIVO" : "INACTIVO"} tone={body.status === "Activo" ? "active" : "neutral"} />
            <StatusBadge label="Grupo" tone="neutral" />
            {entity && <StatusBadge label={entity.legal_name ?? entity.common_name} tone="info" />}
          </>
        }
        metadata={
          <>Reglamento: <span className="font-mono text-xs">{body.regulation_id ?? "—"}</span> · Quórum: {body.quorum ?? "—"} · Frecuencia: {body.frequency ?? "—"}</>
        }
        owner={<>Secretaría: <span className="font-medium text-foreground">{body.secretary ?? "—"}</span></>}
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5"><CalendarPlus className="h-3.5 w-3.5" />Nueva reunión</Button>
            <Button variant="outline" size="sm" asChild className="gap-1.5"><Link to="/governance-map"><Network className="h-3.5 w-3.5" />Ver en mapa</Link></Button>
            <Button variant="outline" size="sm" className="gap-1.5"><Download className="h-3.5 w-3.5" />Exportar</Button>
          </>
        }
      />

      {alertCount > 0 && (
        <div className="mt-4 tour-target flex items-start gap-3 rounded-md border border-status-warning/30 border-l-4 border-l-status-warning bg-status-warning-bg p-4" data-tour="organ-banner">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-status-warning" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-status-warning">{alertCount} mandatos vencidos o próximos a vencer en este órgano</div>
            <div className="mt-0.5 text-xs text-status-warning/80">Acción requerida.</div>
          </div>
          <Button size="sm" variant="outline" className="border-status-warning/40 text-status-warning hover:bg-status-warning/10">Ver mandatos</Button>
        </div>
      )}

      <Tabs defaultValue="composicion" className="mt-6">
        <TabsList className="grid w-full max-w-3xl grid-cols-5">
          <TabsTrigger value="composicion">Composición</TabsTrigger>
          <TabsTrigger value="calendario">Calendario</TabsTrigger>
          <TabsTrigger value="reglamento">Reglamento</TabsTrigger>
          <TabsTrigger value="secretaria">Secretaría</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="composicion" className="mt-4">
          <Card>
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="text-sm font-semibold">Miembros ({members.length})</div>
              <Button size="sm" variant="outline" className="gap-1.5"><UserPlus className="h-3.5 w-3.5" />Añadir miembro</Button>
            </div>
            {members.length > 0 ? (
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
                  {members.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.full_name ?? "—"}</TableCell>
                      <TableCell className="text-sm">{m.role ?? "—"}</TableCell>
                      <TableCell className="text-sm">{m.type ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{formatDate(m.start_date)}</TableCell>
                      <TableCell className="font-mono text-xs">{formatDate(m.end_date)}</TableCell>
                      <TableCell><StatusBadge label={m.status ?? "—"} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-10 text-center text-sm text-muted-foreground">Sin miembros registrados.</div>
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
                  <TableHead>Acta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bodyMeetings.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">Sin reuniones</TableCell></TableRow>
                ) : bodyMeetings.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell><Link to={`/organos/${body.slug}/reuniones/${m.slug}`} className="font-mono text-xs text-primary hover:underline">{formatDate(m.scheduled_start)}</Link></TableCell>
                    <TableCell className="font-mono text-xs">{formatTime(m.scheduled_start)}</TableCell>
                    <TableCell className="text-sm">{m.modality ?? "—"}</TableCell>
                    <TableCell><StatusBadge label={m.status ?? "—"} /></TableCell>
                    <TableCell className="text-sm">{m.minutes_status === "FIRMADA" ? <span className="text-status-active">Firmada</span> : "—"}</TableCell>
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

        <TabsContent value="secretaria" className="mt-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <div className="text-sm font-semibold">Últimas convocatorias</div>
                <Button asChild size="sm" variant="outline" className="gap-1.5">
                  <Link to="/secretaria/convocatorias"><FileCheck2 className="h-3.5 w-3.5" />Ver todas</Link>
                </Button>
              </div>
              {bodyConvocatorias.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Sin convocatorias registradas.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bodyConvocatorias.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <Link to={`/secretaria/convocatorias/${c.id}`} className="font-mono text-xs text-primary hover:underline">
                            {c.slug ?? c.id.slice(0, 8)}
                          </Link>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{formatDate(c.fecha_1)}</TableCell>
                        <TableCell><StatusBadge label={c.estado ?? "—"} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
            <Card>
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <div className="text-sm font-semibold">Acuerdos adoptados</div>
                <Button asChild size="sm" variant="outline" className="gap-1.5">
                  <Link to="/secretaria"><FileCheck2 className="h-3.5 w-3.5" />Secretaría</Link>
                </Button>
              </div>
              {bodyAgreements.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Sin acuerdos registrados.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Materia</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bodyAgreements.map((ag) => (
                      <TableRow key={ag.id}>
                        <TableCell className="text-sm">
                          <Link to={`/secretaria/acuerdos/${ag.id}`} className="text-primary hover:underline">
                            {ag.agreement_kind}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm">{ag.matter_class}</TableCell>
                        <TableCell className="font-mono text-xs">{formatDate(ag.decision_date)}</TableCell>
                        <TableCell><StatusBadge label={ag.status} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="historial" className="mt-4">
          <Card className="p-10 text-center text-sm text-muted-foreground">Historial de auditoría disponible próximamente.</Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
