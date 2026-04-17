import { Link, useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ObjectHeader } from "@/components/ObjectHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { delegations, type DelegationHistoryEntry } from "@/data/delegations";
import { entities } from "@/data/entities";
import { AlertTriangle, AlertCircle, CheckCircle2, FileText, XOctagon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

function HistoryItem({ entry }: { entry: DelegationHistoryEntry }) {
  const isAlert = entry.kind === "alert-unattended";
  const isExpired = entry.kind === "expired";
  const Icon = isExpired ? XOctagon : isAlert ? AlertCircle : CheckCircle2;
  return (
    <li className={cn(
      "rounded-md border p-3",
      isAlert && "border-status-warning/40 bg-status-warning-bg",
      isExpired && "border-status-critical/40 bg-status-critical-bg",
      !isAlert && !isExpired && "border-border bg-card"
    )}>
      <div className="flex items-start gap-3">
        <Icon className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          isExpired && "text-status-critical",
          isAlert && "text-status-warning",
          !isAlert && !isExpired && "text-status-active"
        )} />
        <div className="min-w-0 flex-1">
          <div className="font-mono text-xs text-muted-foreground">{entry.date}</div>
          <div className={cn("mt-0.5 text-sm", isExpired && "font-semibold text-status-critical")}>{entry.event}</div>
        </div>
      </div>
    </li>
  );
}

export default function DelegacionDetalle() {
  const { id } = useParams();
  const d = delegations.find((x) => x.id === id);
  if (!d) return <div className="p-6">Delegación no encontrada.</div>;

  const entity = entities.find((e) => e.id === d.entityId);
  const isCaducada = d.status === "CADUCADA";
  const isProxima = d.status === "PRÓXIMA VENCIMIENTO";
  const tone = isCaducada ? "critical" : isProxima ? "warning" : d.status === "REVOCADA" ? "archived" : "active";

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <ObjectHeader
        crumbs={[
          { label: "Inicio", to: "/" },
          { label: "Delegaciones y Poderes", to: "/delegaciones" },
          { label: d.code },
        ]}
        title={`Delegación — ${d.grantedTo}`}
        badges={
          <>
            <StatusBadge label={d.status} tone={tone} />
            <StatusBadge label={entity?.commonName ?? d.entityId} tone="info" />
          </>
        }
        metadata={`${d.code} · Otorgada: ${d.grantedDate} · ${isCaducada ? "Caducó" : "Vence"}: ${d.expirationDate} · Otorgante: ${d.grantedBy}`}
        actions={
          <>
            <Button variant="outline" size="sm">Ver en mapa</Button>
            {isCaducada && <Button variant="outline" size="sm">Revocar formalmente</Button>}
            {isProxima && <Button size="sm" onClick={() => toast({ title: "Renovación iniciada (simulación)" })}>Renovar delegación</Button>}
          </>
        }
      />

      {isCaducada && (
        <div className="mt-4 flex items-start gap-3 rounded-md border border-status-critical/30 border-l-4 border-l-status-critical bg-status-critical-bg p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-status-critical" />
          <div className="flex-1 text-sm">
            <div className="font-semibold text-status-critical">Delegación caducada sin revocación formal</div>
            <div className="mt-1 text-xs text-status-critical/90">
              Esta delegación caducó el {d.expirationDate} sin renovación ni revocación formal. Los actos realizados en nombre de {entity?.commonName} tras esa fecha podrían carecer de respaldo jurídico.
              {d.findingId && <> Ver hallazgo {d.findingId} para el plan de remediación.</>}
            </div>
          </div>
          {d.findingId && (
            <Button asChild size="sm" variant="outline" className="border-status-critical/40 text-status-critical hover:bg-status-critical/5">
              <Link to={`/hallazgos/${d.findingId}`}>Ver {d.findingId} →</Link>
            </Button>
          )}
        </div>
      )}

      {isProxima && (
        <div className="mt-4 flex items-start gap-3 rounded-md border border-status-warning/30 border-l-4 border-l-status-warning bg-status-warning-bg p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-status-warning" />
          <div className="flex-1 text-sm">
            <div className="font-semibold text-status-warning">Delegación próxima a vencer</div>
            <div className="mt-1 text-xs text-status-warning/90">Esta delegación vence el {d.expirationDate}. Inicia el proceso de renovación.</div>
          </div>
        </div>
      )}

      <Tabs defaultValue="detalle" className="mt-6">
        <TabsList>
          <TabsTrigger value="detalle">Detalle</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
        </TabsList>

        <TabsContent value="detalle" className="mt-4 space-y-4">
          <Card className="p-6">
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <Field label="Código" value={d.code} mono />
              <Field label="Titular" value={d.grantedTo} />
              <Field label="Entidad" value={entity?.legalName ?? d.entityId} />
              <Field label="Otorgante" value={d.grantedBy} />
              <Field label="Otorgada" value={d.grantedDate} mono />
              <Field label={isCaducada ? "Caducó" : "Vence"} value={d.expirationDate} mono />
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Estado</div>
                <div className="mt-1"><StatusBadge label={d.status} tone={tone} /></div>
              </div>
              {d.findingId && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Hallazgo vinculado</div>
                  <div className="mt-1">
                    <Link to={`/hallazgos/${d.findingId}`}><StatusBadge label={d.findingId} tone="critical" /></Link>
                  </div>
                </div>
              )}
              {d.revokedDate && <Field label="Fecha revocación" value={d.revokedDate} mono />}
              {d.revokedReason && <Field label="Motivo revocación" value={d.revokedReason} />}
            </div>
          </Card>

          {d.powers && d.powers.length > 0 && (
            <Card className="p-6">
              <div className="mb-3 text-sm font-semibold">Poderes conferidos</div>
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-foreground">
                {d.powers.map((p) => <li key={p}>{p}</li>)}
              </ul>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="historial" className="mt-4">
          <Card className="p-6">
            <ol className="space-y-2.5">
              {d.history.map((e, i) => <HistoryItem key={i} entry={e} />)}
            </ol>
          </Card>
        </TabsContent>

        <TabsContent value="documentos" className="mt-4">
          <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground" />
            <div className="text-base font-semibold">Sin documentos adjuntos</div>
            <p className="max-w-md text-sm text-muted-foreground">No hay documentos adjuntos a esta delegación. La escritura pública de poderes debe adjuntarse cuando esté disponible.</p>
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
      <div className={cn("mt-1", mono ? "font-mono text-xs" : "text-sm")}>{value}</div>
    </div>
  );
}
