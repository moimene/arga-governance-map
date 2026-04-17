import { Link, useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ObjectHeader } from "@/components/ObjectHeader";
import { StatusBadgeTip } from "@/components/StatusBadgeTip";
import { StatusBadge } from "@/components/StatusBadge";
import { obligations } from "@/data/obligations";
import { findings } from "@/data/findings";
import { entities } from "@/data/entities";
import { policies } from "@/data/policies";
import { AlertTriangle, ShieldOff, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function ObligacionDetalle() {
  const { id } = useParams();
  const obligation = obligations.find((o) => o.code === id);
  if (!obligation) return <div className="p-6">Obligación no encontrada.</div>;

  const policy = policies.find((p) => p.code === obligation.policyId);
  const linkedFindings = findings.filter((f) =>
    (obligation.code === "OBL-DORA-003" && f.id === "HALL-009") ||
    (obligation.code === "OBL-DORA-002" && f.id === "HALL-007") ||
    (obligation.code === "OBL-SOL-004" && f.id === "HALL-001") ||
    (obligation.code === "OBL-SOL-007" && f.id === "HALL-010")
  );

  const noCoverage = obligation.status === "SIN CONTROL";

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <ObjectHeader
        crumbs={[
          { label: "Inicio", to: "/" },
          { label: "Obligaciones y Controles", to: "/obligaciones" },
          { label: obligation.code },
        ]}
        title={obligation.title}
        badges={
          <>
            <StatusBadgeTip label={obligation.coverage} tone={noCoverage ? "critical" : obligation.status === "EXCEPCIÓN ACTIVA" || obligation.status === "EN REMEDIACIÓN" ? "warning" : "active"} pulse={noCoverage} />
            <StatusBadge label={obligation.framework} tone="info" />
            <StatusBadge label={obligation.scope} tone="neutral" />
          </>
        }
        metadata={`Código: ${obligation.code} · Marco: ${obligation.framework} ${obligation.article} · Política: ${obligation.policyId}`}
      />

      {noCoverage && (
        <div className="mt-4 flex items-start gap-3 rounded-md border border-status-critical/30 border-l-4 border-l-status-critical bg-status-critical-bg p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-status-critical" />
          <div className="flex-1 text-sm">
            <div className="font-semibold text-status-critical">Sin cobertura de control</div>
            <div className="mt-1 text-xs text-status-critical/90">Esta obligación no tiene ningún control asignado. Sin evidencia de ejecución de pruebas TLPT. Ver hallazgo HALL-009.</div>
          </div>
          <Button asChild size="sm" variant="outline" className="border-status-critical/40 text-status-critical hover:bg-status-critical/5">
            <Link to="/hallazgos/HALL-009">Ver HALL-009 →</Link>
          </Button>
        </div>
      )}

      <Tabs defaultValue="descripcion" className="mt-6">
        <TabsList>
          <TabsTrigger value="descripcion">Descripción</TabsTrigger>
          <TabsTrigger value="controles">Controles</TabsTrigger>
          <TabsTrigger value="hallazgos">Hallazgos vinculados</TabsTrigger>
        </TabsList>

        <TabsContent value="descripcion" className="mt-4">
          <Card className="p-6 space-y-5">
            <p className="text-sm leading-relaxed text-foreground">
              {obligation.code === "OBL-DORA-003"
                ? "El Reglamento DORA (Art. 24) exige que las entidades financieras significativas realicen pruebas de penetración basadas en inteligencia de amenazas (TLPT) al menos cada 3 años. Grupo ARGA Seguros, como entidad significativa bajo DORA, debe demostrar haber ejecutado dichas pruebas con evidencia validada."
                : `Obligación derivada del marco ${obligation.framework} (${obligation.article}). Vinculada a la política ${obligation.policyId}.`}
            </p>

            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Entidades afectadas</div>
              <div className="flex flex-wrap gap-2">
                {obligation.entityIds.map((eid) => {
                  const e = entities.find((x) => x.id === eid);
                  return e ? (
                    <Link key={eid} to={`/entidades/${eid}`}>
                      <StatusBadge label={e.commonName} tone="info" />
                    </Link>
                  ) : null;
                })}
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Política vinculada</div>
              <div className="flex items-center gap-2">
                <Link to={`/politicas/${obligation.policyId}`} className="text-sm font-medium text-primary hover:underline">
                  {obligation.policyId} — {policy?.title}
                </Link>
                {policy && <StatusBadge label={policy.status} />}
              </div>
            </div>

            {obligation.code === "OBL-DORA-003" && (
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <span className="font-medium text-foreground">Fecha límite cumplimiento:</span>{" "}
                <span className="text-status-critical font-semibold">31/12/2026 (primera ejecución requerida)</span>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="controles" className="mt-4">
          {obligation.controlId ? (
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <Link to={`/obligaciones/controles/${obligation.controlId}`} className="font-mono text-sm text-primary hover:underline">{obligation.controlId}</Link>
                  <div className="mt-1 text-sm text-muted-foreground">Control asignado a esta obligación</div>
                </div>
                <Button asChild variant="outline"><Link to={`/obligaciones/controles/${obligation.controlId}`}>Ver control →</Link></Button>
              </div>
            </Card>
          ) : (
            <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
              <ShieldOff className="h-12 w-12 text-status-critical" />
              <div className="text-base font-semibold">No hay ningún control asignado a esta obligación</div>
              <p className="max-w-md text-sm text-muted-foreground">Asigna un control para comenzar el proceso de cobertura.</p>
              <Button onClick={() => toast({ title: "Función disponible en entorno de producción" })} className="gap-1.5">
                <Plus className="h-4 w-4" />Asignar control
              </Button>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="hallazgos" className="mt-4 space-y-3">
          {linkedFindings.length === 0 && (
            <Card className="p-8 text-center text-sm text-muted-foreground">No hay hallazgos vinculados.</Card>
          )}
          {linkedFindings.map((f) => (
            <Card key={f.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-primary">{f.id}</span>
                    <StatusBadge label={f.severity} tone={f.severity === "CRÍTICA" || f.severity === "ALTA" ? "critical" : "warning"} />
                    <StatusBadge label={f.status} />
                  </div>
                  <div className="mt-2 text-sm font-medium">{f.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">Responsable: {f.responsible} · Vence: {f.dueDate}</div>
                </div>
                <Button asChild variant="outline" size="sm"><Link to={`/hallazgos/${f.id}`}>Ver hallazgo →</Link></Button>
              </div>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
