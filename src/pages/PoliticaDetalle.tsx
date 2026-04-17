import { Link, useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ObjectHeader } from "@/components/ObjectHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { WorkflowStepper } from "@/components/WorkflowStepper";
import { policies } from "@/data/policies";
import { entities } from "@/data/entities";
import { Check, Clock, Download, GitCompare, History } from "lucide-react";
import { cn } from "@/lib/utils";

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
  { label: "Aprob. Comité Técnico" },
  { label: "Revisión jurídica" },
  { label: "Pendiente Consejo" },
  { label: "Aprobado por Consejo" },
  { label: "Vigente" },
];

const APPROVALS = [
  { date: "15/09/2025", actor: "D. Roberto García Prieto", action: "Borrador inicial preparado por Tecnología", done: true },
  { date: "15/11/2025", actor: "Equipo Tecnología", action: "Revisión interna completada — 12 comentarios resueltos", done: true },
  { date: "20/01/2026", actor: "D. Roberto García Prieto", action: "Aprobado por Comité Técnico", done: true },
  { date: "15/04/2026", actor: "D. Miguel Ortega Sánchez", action: "Revisión jurídica completada — texto consolidado", done: true },
  { date: "Previsto 22/04/2026", actor: "D. Antonio Ríos Valverde", action: "Pendiente aprobación Consejo de Administración", done: false },
];

const VERSIONS = [
  { v: "v0.1", status: "BORRADOR", date: "15/09/2025" },
  { v: "v0.2", status: "EN REVISIÓN", date: "15/11/2025" },
  { v: "v0.9", status: "PRE-DEFINITIVA", date: "20/01/2026" },
  { v: "v1.0", status: "PENDIENTE APROBACIÓN", date: "15/04/2026", current: true },
];

const OBLIGACIONES = [
  { id: "OBL-DORA-001", desc: "Registro de activos TIC críticos", control: "CTR-005", coverage: "COMPLETA", tone: "active" as const },
  { id: "OBL-DORA-002", desc: "Clasificación proveedores TIC", control: "CTR-006 (EN REMEDIACIÓN)", coverage: "PARCIAL", tone: "warning" as const },
  { id: "OBL-DORA-003", desc: "Pruebas de resiliencia operativa", control: "(ninguno)", coverage: "SIN COBERTURA", tone: "critical" as const },
];

export default function PoliticaDetalle() {
  const { code = "PR-008" } = useParams();
  const policy = policies.find((p) => p.code === code);

  if (!policy) {
    return <div className="p-10 text-center text-sm text-muted-foreground">Política no encontrada. <Link to="/politicas" className="text-primary underline">Volver</Link></div>;
  }

  const isPR008 = policy.code === "PR-008";

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <ObjectHeader
        crumbs={[{ label: "Inicio", to: "/" }, { label: "Políticas y Normativa", to: "/politicas" }, { label: policy.code }]}
        title={policy.title}
        badges={
          <>
            <StatusBadge label={policy.status} />
            <StatusBadge label={policy.type} tone="neutral" />
            <StatusBadge label={policy.scope} tone="info" />
          </>
        }
        metadata={<>Código: <span className="font-mono text-xs">{policy.code}</span> · Propietario: {policy.owner} · Última modificación: 15/04/2026</>}
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5"><History className="h-3.5 w-3.5" />Ver historial</Button>
            <Button variant="outline" size="sm" className="gap-1.5"><GitCompare className="h-3.5 w-3.5" />Comparar versiones</Button>
            <Button variant="outline" size="sm" className="gap-1.5"><Download className="h-3.5 w-3.5" />Exportar</Button>
          </>
        }
      />

      {isPR008 && (
        <div className="mt-6">
          <WorkflowStepper
            steps={WORKFLOW_STEPS}
            current={5}
            caption="Pendiente de aprobación por el Consejo de Administración — próxima sesión: 22/04/2026."
          />
        </div>
      )}

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
                  <TableHead className="w-40">Cobertura</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(isPR008 ? OBLIGACIONES : []).map((o) => (
                  <TableRow key={o.id} className={cn(o.tone === "critical" && "bg-status-critical-bg")}>
                    <TableCell><Link to="/obligaciones" className="font-mono text-xs text-primary hover:underline">{o.id}</Link></TableCell>
                    <TableCell className="text-sm">{o.desc}</TableCell>
                    <TableCell className="font-mono text-xs">{o.control}</TableCell>
                    <TableCell><StatusBadge label={o.coverage} tone={o.tone} /></TableCell>
                  </TableRow>
                ))}
                {!isPR008 && <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">Sin obligaciones vinculadas registradas.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="aprobaciones" className="mt-4">
          <Card className="p-6">
            <ul className="space-y-4">
              {(isPR008 ? APPROVALS : []).map((a, i) => (
                <li key={i} className="flex items-start gap-4">
                  <div className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", a.done ? "bg-status-active text-white" : "bg-status-pending-bg text-status-pending border-2 border-status-pending")}>
                    {a.done ? <Check className="h-4 w-4" /> : <Clock className="h-3.5 w-3.5" />}
                  </div>
                  <div className="flex-1">
                    <div className={cn("text-sm", a.done ? "text-foreground" : "font-semibold text-status-pending")}>{a.action}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{a.date} · {a.actor}</div>
                  </div>
                </li>
              ))}
            </ul>
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
                {(isPR008 ? VERSIONS : []).map((v) => (
                  <TableRow key={v.v} className={cn(v.current && "bg-accent/40")}>
                    <TableCell className="font-mono text-xs font-semibold">{v.v}{v.current && " (actual)"}</TableCell>
                    <TableCell><StatusBadge label={v.status} /></TableCell>
                    <TableCell className="font-mono text-xs">{v.date}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="h-7 px-2"><Download className="h-3.5 w-3.5" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!isPR008 && <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">Historial de versiones no disponible.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
