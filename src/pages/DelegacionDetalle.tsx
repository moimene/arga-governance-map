import { Link, useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ObjectHeader } from "@/components/ObjectHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { useDelegationBySlug, delegationStatusLabel, delegationStatusTone, formatDate } from "@/hooks/useDelegations";
import { AlertTriangle, AlertCircle, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

export default function DelegacionDetalle() {
  const { slug } = useParams();
  const { data: d, isLoading } = useDelegationBySlug(slug);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1440px] p-6 space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!d) return <div className="p-6">Delegación no encontrada.</div>;

  const isCaducada = d.status === "Caducada";
  const isProxima = d.status === "Próxima a vencer" || d.status === "Próximo a vencer";
  const tone = delegationStatusTone(d.status);

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <ObjectHeader
        crumbs={[
          { label: "Inicio", to: "/" },
          { label: "Delegaciones y Poderes", to: "/delegaciones" },
          { label: d.code },
        ]}
        title={`Delegación — ${d.delegate_name ?? d.code}`}
        badges={
          <>
            <StatusBadge label={delegationStatusLabel(d.status)} tone={tone} />
            {d.entity_name && <StatusBadge label={d.entity_name} tone="info" />}
          </>
        }
        metadata={`${d.code} · Otorgada: ${formatDate(d.start_date)} · ${isCaducada ? "Caducó" : "Vence"}: ${formatDate(d.end_date)} · Otorgante: ${d.grantor_name ?? "—"}`}
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
              Esta delegación caducó el {formatDate(d.end_date)} sin renovación ni revocación formal. Los actos realizados en nombre de {d.entity_name ?? "la entidad"} tras esa fecha podrían carecer de respaldo jurídico.
            </div>
          </div>
        </div>
      )}

      {isProxima && (
        <div className="mt-4 flex items-start gap-3 rounded-md border border-status-warning/30 border-l-4 border-l-status-warning bg-status-warning-bg p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-status-warning" />
          <div className="flex-1 text-sm">
            <div className="font-semibold text-status-warning">Delegación próxima a vencer</div>
            <div className="mt-1 text-xs text-status-warning/90">Esta delegación vence el {formatDate(d.end_date)}. Inicia el proceso de renovación.</div>
          </div>
        </div>
      )}

      <Tabs defaultValue="detalle" className="mt-6">
        <TabsList>
          <TabsTrigger value="detalle">Detalle</TabsTrigger>
          <TabsTrigger value="alertas">Alertas</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
        </TabsList>

        <TabsContent value="detalle" className="mt-4 space-y-4">
          <Card className="p-6">
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <Field label="Código" value={d.code} mono />
              <Field label="Titular" value={d.delegate_name ?? "—"} />
              <Field label="Entidad" value={d.entity_legal_name ?? d.entity_name ?? "—"} />
              <Field label="Otorgante" value={d.grantor_name ?? "—"} />
              <Field label="Otorgada" value={formatDate(d.start_date)} mono />
              <Field label={isCaducada ? "Caducó" : "Vence"} value={formatDate(d.end_date)} mono />
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Estado</div>
                <div className="mt-1"><StatusBadge label={delegationStatusLabel(d.status)} tone={tone} /></div>
              </div>
              {d.delegation_type && <Field label="Tipo" value={d.delegation_type} />}
            </div>
          </Card>

          {d.scope && (
            <Card className="p-6">
              <div className="mb-2 text-sm font-semibold">Ámbito</div>
              <p className="text-sm text-foreground">{d.scope}</p>
            </Card>
          )}

          {d.limits && (
            <Card className="p-6">
              <div className="mb-2 text-sm font-semibold">Límites y restricciones</div>
              <p className="text-sm text-foreground">{d.limits}</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="alertas" className="mt-4">
          <Card className="p-6">
            <div className="mb-3 text-sm font-semibold">Alertas de vencimiento</div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <AlertChip label="T-90" sent={d.alert_t90} />
              <AlertChip label="T-60" sent={d.alert_t60} />
              <AlertChip label="T-30" sent={d.alert_t30} />
            </div>
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

function AlertChip({ label, sent }: { label: string; sent: boolean | null | undefined }) {
  return (
    <div className={cn("rounded-md border p-3", sent ? "border-status-warning/40 bg-status-warning-bg" : "border-border bg-card")}>
      <div className="font-mono text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{sent ? "Enviada" : "No enviada"}</div>
    </div>
  );
}
