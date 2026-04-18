import { Link, useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { ObjectHeader } from "@/components/ObjectHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { StatusBadgeTip } from "@/components/StatusBadgeTip";
import { WorkflowStepper } from "@/components/WorkflowStepper";
import { Button } from "@/components/ui/button";
import {
  useFindingByCode,
  useFindingRelatedControls,
  useActionPlansByFinding,
  severityLabel,
  severityTone,
  findingStatusLabel,
  findingStatusToStep,
  originLabel,
  formatDate,
} from "@/hooks/useFindings";
import { controlStatusLabel, controlStatusTone } from "@/hooks/usePoliciesObligations";
import { Map, Upload, ExternalLink, Activity } from "lucide-react";
import { useNavigate } from "react-router-dom";

const workflowSteps = [
  { label: "Abierto" },
  { label: "Asignado" },
  { label: "En investigación" },
  { label: "En remediación" },
  { label: "Pendiente validación" },
  { label: "Cerrado" },
];

export default function HallazgoDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: finding, isLoading } = useFindingByCode(id);
  const { data: relatedControls = [] } = useFindingRelatedControls(finding?.obligation_id);
  const { data: actionPlans = [] } = useActionPlansByFinding(finding?.id);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1440px] p-6 space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!finding) return <div className="p-6">Hallazgo no encontrado.</div>;

  const step = findingStatusToStep(finding.status);
  const isCritical = finding.severity === "Crítico";

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <ObjectHeader
        crumbs={[{ label: "Inicio", to: "/" }, { label: "Hallazgos y Acciones", to: "/hallazgos" }, { label: finding.code }]}
        title={finding.title}
        badges={
          <>
            <span className="tour-target" data-tour="finding-badge">
              <StatusBadgeTip label={severityLabel(finding.severity)} tone={severityTone(finding.severity)} pulse={isCritical} />
            </span>
            <StatusBadge label={findingStatusLabel(finding.status)} />
            <StatusBadge label={originLabel(finding.origin)} tone="neutral" />
          </>
        }
        metadata={`${finding.code} · ${finding.entity_name ?? "—"} · Detectado: ${formatDate(finding.opened_at)} · Responsable: ${finding.owner_name ?? "—"} · Vence: ${formatDate(finding.due_date)}`}
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1"><Map className="h-4 w-4" />Ver en mapa</Button>
            <Button variant="outline" size="sm" className="gap-1"><Upload className="h-4 w-4" />Cargar evidencia</Button>
            <Button variant="outline" size="sm" className="gap-1" onClick={() => navigate(`/grc/risk-360?finding=${finding.code}`)}>
              <Activity className="h-4 w-4" />Ver riesgo GRC
            </Button>
            {finding.origin === "AuditInterna" && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => navigate("/grc/m/audit/operate/findings")}
              >
                <ExternalLink className="h-4 w-4" />Ver en GRC Audit
              </Button>
            )}
          </>
        }
      />

      <div className="mt-4">
        <WorkflowStepper steps={workflowSteps} current={step} caption={`Estado actual: ${findingStatusLabel(finding.status)}${finding.owner_name ? ` — ${finding.owner_name}` : ""}.`} />
      </div>

      <Tabs defaultValue="descripcion" className="mt-6">
        <TabsList>
          <TabsTrigger value="descripcion">Descripción</TabsTrigger>
          <TabsTrigger value="acciones">Planes de acción ({actionPlans.length})</TabsTrigger>
          <TabsTrigger value="controles">Controles vinculados ({relatedControls.length})</TabsTrigger>
          <TabsTrigger value="vinculados">Objetos vinculados</TabsTrigger>
        </TabsList>

        <TabsContent value="descripcion">
          <Card className="space-y-4 p-6 text-sm">
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Descripción</div>
              <p className="leading-relaxed text-foreground">{finding.title}</p>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              <Field label="Código" value={finding.code} mono />
              <Field label="Severidad" value={severityLabel(finding.severity)} />
              <Field label="Estado" value={findingStatusLabel(finding.status)} />
              <Field label="Origen" value={originLabel(finding.origin)} />
              <Field label="Entidad" value={finding.entity_name ?? "—"} />
              <Field label="Responsable" value={finding.owner_name ?? "—"} />
              <Field label="Detectado" value={formatDate(finding.opened_at)} mono />
              <Field label="Vence" value={formatDate(finding.due_date)} mono />
              {finding.closed_at && <Field label="Cerrado" value={formatDate(finding.closed_at)} mono />}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="acciones">
          <Card className="p-5">
            {actionPlans.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-6">Sin planes de acción registrados.</div>
            )}
            <ul className="space-y-4">
              {actionPlans.map((p) => {
                const pct = p.progress_pct ?? 0;
                const tone = p.status === "Completado" ? "active" : p.status === "En progreso" ? "warning" : "neutral";
                return (
                  <li key={p.id} className="rounded-md border border-border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-foreground">{p.title}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Responsable: {p.responsible_name ?? "—"} · Vence: {formatDate(p.due_date)}
                        </div>
                      </div>
                      <StatusBadge label={p.status} tone={tone as any} />
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <Progress value={pct} className="h-2 flex-1" />
                      <span className="font-mono text-xs text-muted-foreground w-10 text-right">{pct}%</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </TabsContent>

        <TabsContent value="controles">
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Código</TableHead>
                  <TableHead>Control</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead className="w-40">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {relatedControls.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">Sin controles vinculados a la obligación de este hallazgo.</TableCell></TableRow>
                )}
                {relatedControls.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell><Link to={`/obligaciones/controles/${c.code}`} className="font-mono text-xs text-primary hover:underline">{c.code}</Link></TableCell>
                    <TableCell className="text-sm">{c.name}</TableCell>
                    <TableCell className="text-sm">{c.owner_name ?? "—"}</TableCell>
                    <TableCell><StatusBadge label={controlStatusLabel(c.status)} tone={controlStatusTone(c.status)} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="vinculados">
          <Card className="space-y-2 p-5">
            {finding.entity_slug && (
              <Link to={`/entidades/${finding.entity_slug}`} className="flex items-center justify-between rounded-md border border-border p-3 hover:bg-accent/40">
                <span className="text-sm font-medium">Entidad: {finding.entity_name}</span>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </Link>
            )}
            {finding.obligation_code && (
              <Link to={`/obligaciones/${finding.obligation_code}`} className="flex items-center justify-between rounded-md border border-border p-3 hover:bg-accent/40">
                <span className="text-sm font-medium">{finding.obligation_code} — {finding.obligation_title}</span>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </Link>
            )}
            {!finding.entity_slug && !finding.obligation_code && (
              <p className="text-sm text-muted-foreground">Sin objetos vinculados directamente.</p>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={mono ? "mt-1 font-mono text-xs" : "mt-1 text-sm"}>{value}</div>
    </div>
  );
}
