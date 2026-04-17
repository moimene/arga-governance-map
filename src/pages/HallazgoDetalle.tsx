import { Link, useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ObjectHeader } from "@/components/ObjectHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { StatusBadgeTip } from "@/components/StatusBadgeTip";
import { WorkflowStepper } from "@/components/WorkflowStepper";
import { Button } from "@/components/ui/button";
import { findings } from "@/data/findings";
import { hall008Actions, hall008Timeline } from "@/data/hall008";
import { Map, Upload, ShieldCheck, Info, ExternalLink } from "lucide-react";

const workflowSteps = [
  { label: "Creado" },
  { label: "Asignado" },
  { label: "En investigación" },
  { label: "En remediación" },
  { label: "Pendiente validación" },
  { label: "Cerrado" },
];

export default function HallazgoDetalle() {
  const { id } = useParams<{ id: string }>();
  const finding = findings.find((f) => f.id === id);
  if (!finding) return <div className="p-6">Hallazgo no encontrado.</div>;

  const isHall008 = id === "HALL-008";

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <ObjectHeader
        crumbs={[{ label: "Inicio", to: "/" }, { label: "Hallazgos y Acciones", to: "/hallazgos" }, { label: finding.id }]}
        title={finding.title}
        badges={
          <>
            <span className="tour-target" data-tour="finding-badge"><StatusBadgeTip label={finding.severity} tone="critical" pulse={finding.severity === "CRÍTICA"} /></span>
            <StatusBadge label={finding.status} />
            <StatusBadge label={finding.origin} tone="neutral" />
          </>
        }
        metadata={`${finding.id} · ${finding.entity} · Detectado: 19/04/2026 · Responsable: ${finding.responsible} · Vence: ${finding.dueDate}`}
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1"><Map className="h-4 w-4" />Ver en mapa</Button>
            <Button variant="outline" size="sm" className="gap-1"><Upload className="h-4 w-4" />Cargar evidencia</Button>
          </>
        }
      />

      {isHall008 && (
        <Card className="mt-4 border-l-4 border-l-primary bg-accent/40 p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p className="text-sm text-foreground">
              Este hallazgo fue creado por <strong>Auditoría Interna</strong> en ejercicio de su función independiente. La gestión del hallazgo corresponde al área responsable; el cierre lo valida exclusivamente Auditoría Interna.
            </p>
          </div>
        </Card>
      )}

      <div className="mt-4">
        <WorkflowStepper steps={workflowSteps} current={3} caption="En investigación activa por D. Álvaro Mendoza Torres — Auditoría Interna." />
      </div>

      <Tabs defaultValue="descripcion" className="mt-6">
        <TabsList>
          <TabsTrigger value="descripcion">Descripción</TabsTrigger>
          <TabsTrigger value="acciones">Acciones correctivas</TabsTrigger>
          <TabsTrigger value="personas">Personas involucradas</TabsTrigger>
          <TabsTrigger value="vinculados">Objetos vinculados</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="descripcion">
          <Card className="space-y-4 p-6 text-sm">
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Descripción completa</div>
              <p className="leading-relaxed text-foreground">
                Durante la revisión trimestral de operaciones corporativas Q1 2026, Auditoría Interna detectó indicios de que D. André Barbosa Lima, CEO de ARGA Brasil y miembro del Conselho de Administração local, participó activamente en la decisión de adquisición de un inmueble comercial en São Paulo sin declarar formalmente un conflicto de interés derivado de su participación societaria directa en la entidad vendedora.
              </p>
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Evidencia inicial</div>
              <p className="text-foreground">Análisis de documentación contractual y actas del Conselho de Administração de ARGA Brasil — sesiones de enero y febrero 2026.</p>
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Impacto potencial</div>
              <p className="text-foreground">Riesgo reputacional, regulatorio (EIOPA Guidelines Art. 42 Solvencia II) y de gobierno corporativo. Posible impugnación de los acuerdos adoptados.</p>
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Marco regulatorio afectado</div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge label="Solvencia II Art. 42" tone="info" />
                <StatusBadge label="PR-006" tone="info" />
                <StatusBadge label="OBL-SOL-002" tone="info" />
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="acciones">
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Acción</TableHead>
                  <TableHead>Responsable</TableHead>
                  <TableHead>Vence</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hall008Actions.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="font-mono text-xs font-semibold text-muted-foreground">{a.id}</div>
                      <div className="text-sm text-foreground">{a.title}</div>
                      {a.note && <div className="mt-1 text-xs italic text-muted-foreground">{a.note}</div>}
                    </TableCell>
                    <TableCell className="text-sm">{a.responsible}</TableCell>
                    <TableCell className="text-sm">{a.dueDate}</TableCell>
                    <TableCell><StatusBadge label={a.priority} tone={a.priority === "URGENTE" ? "critical" : "warning"} /></TableCell>
                    <TableCell><StatusBadge label={a.status} tone="warning" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="personas">
          <div className="grid grid-cols-3 gap-4">
            <Card className="p-5">
              <StatusBadge label="INVOLUCRADO PRINCIPAL" tone="critical" />
              <h3 className="mt-3 text-base font-semibold">D. André Barbosa Lima</h3>
              <p className="text-sm text-muted-foreground">CEO ARGA Brasil / Presidente Conselho</p>
              <p className="mt-3 text-sm">Directivo con posible conflicto no declarado.</p>
              <Link to="/entidades/arga-brasil" className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline">
                Ver entidad <ExternalLink className="h-3 w-3" />
              </Link>
            </Card>
            <Card className="p-5">
              <StatusBadge label="CONTRAPARTE COMERCIAL" tone="neutral" />
              <h3 className="mt-3 text-base font-semibold text-muted-foreground">[Nombre omitido]</h3>
              <p className="text-sm text-muted-foreground">Parte relacionada</p>
              <p className="mt-3 text-sm italic">La identidad de la contraparte está protegida durante la investigación conforme a la Política de Conflictos de Interés.</p>
            </Card>
            <Card className="p-5">
              <StatusBadge label="INVESTIGADOR" tone="info" />
              <h3 className="mt-3 text-base font-semibold">D. Álvaro Mendoza Torres</h3>
              <p className="text-sm text-muted-foreground">Director de Auditoría Interna</p>
              <p className="mt-3 text-sm">Auditor responsable de la investigación.</p>
              <p className="mt-2 text-xs italic text-primary">El investigador actúa con plena independencia funcional.</p>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="vinculados">
          <Card className="space-y-2 p-5">
            {[
              { label: "PR-006 — Política de Conflictos de Interés", to: "/politicas/PR-006", tone: "info" as const },
              { label: "OBL-SOL-002 — ORSA / Sistema de Gobierno", to: "/obligaciones/OBL-SOL-002", tone: "info" as const },
              { label: "ARGA Brasil Seguros S.A.", to: "/entidades/arga-brasil", tone: "neutral" as const },
              { label: "Conselho de Administração ARGA Brasil", to: "/organos/conselho-brasil", tone: "neutral" as const },
            ].map((x) => (
              <Link key={x.to} to={x.to} className="flex items-center justify-between rounded-md border border-border p-3 hover:bg-accent/40">
                <span className="text-sm font-medium">{x.label}</span>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
            <div className="flex items-center justify-between rounded-md border border-sii-border bg-status-warning-bg p-3">
              <div>
                <div className="text-sm font-medium text-sii-foreground">CASO-SII-001 — Caso correlacionado</div>
                <div className="text-xs italic text-sii-foreground/70">Acceso restringido — zona SII</div>
              </div>
              <Link to="/sii/CASO-SII-001" className="text-sm font-semibold text-sii-foreground hover:underline">Acceder zona SII →</Link>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="timeline">
          <Card className="p-5">
            <ol className="space-y-4">
              {hall008Timeline.map((e, i) => (
                <li key={i} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                    {i < hall008Timeline.length - 1 && <span className="mt-1 w-px flex-1 bg-border" />}
                  </div>
                  <div className="flex-1 pb-3">
                    <div className="text-sm font-medium text-foreground">{e.event}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{e.date} · {e.actor}</div>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </TabsContent>
      </Tabs>

      {!isHall008 && (
        <Card className="mt-6 p-5 text-sm text-muted-foreground">
          <Info className="mb-2 h-4 w-4" />
          Detalle completo de este hallazgo disponible en la siguiente iteración. Consulta los datos generales en la cabecera.
        </Card>
      )}
    </div>
  );
}
