import { Link, useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { ObjectHeader } from "@/components/ObjectHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { WorkflowStepper } from "@/components/WorkflowStepper";
import { entities } from "@/data/entities";
import {
  usePolicyByCode,
  usePolicyObligations,
  useAllControlsByObligationIds,
  policyStatusLabel,
  policyStatusToStep,
  controlStatusLabel,
  controlStatusTone,
} from "@/hooks/usePoliciesObligations";
import { Check, Download, GitCompare, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

const PR008_SECTIONS = [
  { title: "Objeto y ámbito de aplicación", body: "La presente Política establece el marco de gestión de la resiliencia operativa digital del Grupo ARGA Seguros, en cumplimiento del Reglamento (UE) 2022/2554 (DORA). Es de aplicación a todas las entidades del Grupo y a sus proveedores TIC críticos." },
  { title: "Marco regulatorio de referencia", body: "DORA · Reglamento (UE) 2022/2554 · Directrices EIOPA sobre Sistema de Gobernanza · ISO 22301 — Continuidad de Negocio · Solvencia II Art. 41 (Sistema de Gobernanza)." },
  { title: "Principios de resiliencia digital", body: "1) Identificación continua de riesgos TIC. 2) Protección proporcional al riesgo. 3) Detección temprana de incidentes. 4) Respuesta y recuperación documentadas. 5) Aprendizaje y mejora continua." },
  { title: "Gestión del riesgo TIC", body: "El CIO mantiene un registro actualizado de activos TIC clasificados por criticidad. Se realizan análisis de riesgo trimestrales. Reporte semestral a la Comisión de Riesgos." },
  { title: "Proveedores TIC críticos", body: "Clasificación inicial y revisión anual. Cláusulas contractuales DORA obligatorias. Registro centralizado en la Función de Cumplimiento. (OBL-DORA-001, OBL-DORA-002)" },
  { title: "Pruebas de resiliencia", body: "Pruebas anuales de continuidad para sistemas críticos. Pruebas avanzadas (TLPT) cada tres años para entidades significativas. (OBL-DORA-003)" },
  { title: "Notificación de incidentes", body: "Incidentes graves notificados al supervisor en un máximo de 4 horas tras clasificación. Procedimiento detallado en el anexo I." },
  { title: "Revisión y actualización", body: "Revisión anual o ante cambios regulatorios significativos. Aprobación por el Consejo de Administración." },
];

const WORKFLOW_STEPS = [
  { label: "Borrador" },
  { label: "Revisión interna" },
  { label: "Revisión jurídica" },
  { label: "Pendiente aprobación" },
  { label: "Aprobada" },
  { label: "Vigente" },
  { label: "Sustituida / Archivada" },
];

const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};

export default function PoliticaDetalle() {
  const { id: code } = useParams();
  const { data: policy, isLoading } = usePolicyByCode(code);
  const { data: obligations = [] } = usePolicyObligations(policy?.id);
  const obligationIds = useMemo(() => obligations.map((o) => o.id), [obligations]);
  const { data: controls = [] } = useAllControlsByObligationIds(obligationIds);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1440px] space-y-4 p-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!policy) {
    return <div className="p-10 text-center text-sm text-muted-foreground">Política no encontrada. <Link to="/politicas" className="text-primary underline">Volver</Link></div>;
  }

  const isPR008 = policy.policy_code === "PR-008";
  const currentStep = policyStatusToStep(policy.status);
  const stepCaption =
    policy.status === "Approval Pending"
      ? `Pendiente aprobación${policy.approval_body_name ? ` por ${policy.approval_body_name}` : ""}.`
      : policy.status === "In Review" || policy.status === "Legal Review"
      ? "Política en proceso de revisión."
      : policy.status === "Published"
      ? `Vigente desde ${fmtDate(policy.effective_date)}.`
      : undefined;

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <ObjectHeader
        crumbs={[{ label: "Inicio", to: "/" }, { label: "Políticas y Normativa", to: "/politicas" }, { label: policy.policy_code }]}
        title={policy.title}
        badges={
          <>
            <StatusBadge label={policyStatusLabel(policy.status)} />
            {policy.policy_type && <StatusBadge label={policy.policy_type} tone="neutral" />}
            {policy.scope_level && <StatusBadge label={policy.scope_level} tone="info" />}
          </>
        }
        metadata={<>Código: <span className="font-mono text-xs">{policy.policy_code}</span> · Propietario: {policy.owner_function ?? "—"}{policy.approval_body_name ? ` · Aprobación: ${policy.approval_body_name}` : ""}</>}
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5"><History className="h-3.5 w-3.5" />Ver historial</Button>
            <Button variant="outline" size="sm" className="gap-1.5"><GitCompare className="h-3.5 w-3.5" />Comparar versiones</Button>
            <Button variant="outline" size="sm" className="gap-1.5"><Download className="h-3.5 w-3.5" />Exportar</Button>
          </>
        }
      />

      <div className="mt-6 tour-target" data-tour="policy-stepper">
        <WorkflowStepper
          steps={WORKFLOW_STEPS}
          current={currentStep}
          caption={stepCaption}
        />
      </div>

      <Tabs defaultValue="contenido" className="mt-6">
        <TabsList className="grid w-full max-w-2xl grid-cols-5">
          <TabsTrigger value="contenido">Contenido</TabsTrigger>
          <TabsTrigger value="aplicabilidad">Aplicabilidad</TabsTrigger>
          <TabsTrigger value="obligaciones">Obligaciones</TabsTrigger>
          <TabsTrigger value="aprobaciones">Aprobaciones</TabsTrigger>
          <TabsTrigger value="versiones">Versiones</TabsTrigger>
        </TabsList>

        <TabsContent value="contenido" className="mt-4">
          <Card className="p-6">
            <Accordion type="multiple" className="w-full" defaultValue={["s0"]}>
              {(isPR008 ? PR008_SECTIONS : []).map((s, i) => (
                <AccordionItem key={i} value={`s${i}`}>
                  <AccordionTrigger className="text-sm font-semibold">{i + 1}. {s.title}</AccordionTrigger>
                  <AccordionContent className="text-sm leading-relaxed text-muted-foreground">{s.body}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            {!isPR008 && <p className="text-sm text-muted-foreground">El contenido íntegro de esta política está disponible para descarga.</p>}
          </Card>
        </TabsContent>

        <TabsContent value="aplicabilidad" className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entidad</TableHead>
                  <TableHead>Jurisdicción</TableHead>
                  <TableHead className="w-20">Aplica</TableHead>
                  <TableHead>Excepción</TableHead>
                  <TableHead>Notas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entities.map((e) => {
                  const isTurkey = e.id === "arga-turquia" && isPR008;
                  return (
                    <TableRow key={e.id} className={cn(isTurkey && "bg-status-warning-bg")}>
                      <TableCell className="font-medium">{e.commonName}</TableCell>
                      <TableCell className="text-sm">{e.jurisdiction}</TableCell>
                      <TableCell><Check className="h-4 w-4 text-status-active" /></TableCell>
                      <TableCell>
                        {isTurkey && <StatusBadge label="EXCEPCIÓN REGULATORIA" tone="warning" />}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {isTurkey && (
                          <>Marco local no compatible con artículo 12. Excepción aprobada — VENCIDA 22/04/2026. <Link to="/hallazgos/HALL-010" className="text-primary hover:underline">HALL-010</Link></>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="obligaciones" className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Obligación</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Control asignado</TableHead>
                  <TableHead className="w-40">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {obligations.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">Sin obligaciones vinculadas registradas.</TableCell></TableRow>
                )}
                {obligations.map((o) => {
                  const obCtrls = controls.filter((c) => c.obligation_id === o.id);
                  const noCoverage = obCtrls.length === 0;
                  return (
                    <TableRow key={o.id} className={cn(noCoverage && "bg-status-critical-bg")}>
                      <TableCell><Link to={`/obligaciones/${o.code}`} className="font-mono text-xs text-primary hover:underline">{o.code}</Link></TableCell>
                      <TableCell className="text-sm">{o.title}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {obCtrls.length === 0 ? <span className="text-muted-foreground">(ninguno)</span> :
                          obCtrls.map((c) => c.code).join(", ")}
                      </TableCell>
                      <TableCell>
                        {noCoverage
                          ? <StatusBadge label="SIN COBERTURA" tone="critical" />
                          : <StatusBadge label={controlStatusLabel(obCtrls[0].status)} tone={controlStatusTone(obCtrls[0].status)} />}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="aprobaciones" className="mt-4">
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">
              {policy.approval_body_name
                ? `Órgano competente para la aprobación: ${policy.approval_body_name}.`
                : "Órgano de aprobación no asignado."}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">Estado actual: <span className="font-semibold text-foreground">{policyStatusLabel(policy.status)}</span>.</p>
          </Card>
        </TabsContent>

        <TabsContent value="versiones" className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Versión</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="w-32 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="bg-accent/40">
                  <TableCell className="font-mono text-xs font-semibold">v{policy.current_version ?? 1} (actual)</TableCell>
                  <TableCell><StatusBadge label={policyStatusLabel(policy.status)} /></TableCell>
                  <TableCell className="font-mono text-xs">{fmtDate(policy.effective_date)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="h-7 px-2"><Download className="h-3.5 w-3.5" /></Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
