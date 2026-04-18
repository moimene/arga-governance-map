import { Link, useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ObjectHeader } from "@/components/ObjectHeader";
import { StatusBadge } from "@/components/StatusBadge";
import {
  useObligationByCode,
  useObligationControls,
  useEvidencesByControlIds,
  controlStatusLabel,
  controlStatusTone,
  evidenceStatusLabel,
  evidenceStatusTone,
  obligationCriticalityTone,
} from "@/hooks/usePoliciesObligations";
import { AlertTriangle, ShieldOff, Plus, ShieldCheck, Siren, Clock } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};

export default function ObligacionDetalle() {
  const { id } = useParams();
  const { data: obligation, isLoading } = useObligationByCode(id);
  const { data: controls = [] } = useObligationControls(obligation?.id);
  const controlIds = useMemo(() => controls.map((c) => c.id), [controls]);
  const { data: evidences = [] } = useEvidencesByControlIds(controlIds);

  // Incidentes GRC vinculados por FK obligation_id (Ola 3 Gap 3).
  type IncidentLinked = {
    id: string;
    code: string;
    title: string;
    status: string;
    severity: string | null;
    incident_type: string | null;
    is_major_incident: boolean;
    regulatory_notification_required: boolean;
    detection_date: string | null;
    resolution_date: string | null;
  };
  const { data: linkedIncidents = [] } = useQuery<IncidentLinked[]>({
    enabled: !!obligation?.id,
    queryKey: ["incidents", "byObligation", obligation?.id ?? "none"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incidents")
        .select("id, code, title, status, severity, incident_type, is_major_incident, regulatory_notification_required, detection_date, resolution_date")
        .eq("obligation_id", obligation!.id)
        .order("detection_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as IncidentLinked[];
    },
  });
  const openIncidents = linkedIncidents.filter(
    (i) => i.status !== "Cerrado" && i.status !== "Resuelto",
  ).length;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1440px] space-y-4 p-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const navigate = useNavigate();

  if (!obligation) return <div className="p-6">Obligación no encontrada.</div>;

  const noCoverage = controls.length === 0;
  const coverageLabel = noCoverage
    ? "SIN COBERTURA"
    : controls.some((c) => c.status === "Deficiente") ? "DEFICIENTE"
    : controls.some((c) => c.status === "Parcial") ? "PARCIAL"
    : "COMPLETA";
  const coverageTone = noCoverage ? "critical" : coverageLabel === "COMPLETA" ? "active" : "warning";

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
            <StatusBadge label={coverageLabel} tone={coverageTone} pulse={noCoverage} />
            {obligation.source && <StatusBadge label={obligation.source} tone="info" />}
            {obligation.criticality && <StatusBadge label={obligation.criticality} tone={obligationCriticalityTone(obligation.criticality)} />}
          </>
        }
        metadata={
          <>
            Código: {obligation.code}
            {obligation.policy_code && (
              <> · Política: <Link to={`/politicas/${obligation.policy_code}`} className="text-primary hover:underline">{obligation.policy_code}</Link></>
            )}
            {obligation.country_scope && obligation.country_scope.length > 0 && (
              <> · Ámbito: {obligation.country_scope.join(", ")}</>
            )}
          </>
        }
      />

      {/* GRC cross-module link */}
      <div className="mt-3 flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          onClick={() => navigate(`/grc/m/dora/operate/incidents?obligation=${obligation.code}`)}
        >
          <ShieldCheck className="h-4 w-4" />
          Gestionar en GRC
        </Button>
      </div>

      {noCoverage && (
        <div className="mt-4 flex items-start gap-3 rounded-md border border-status-critical/30 border-l-4 border-l-status-critical bg-status-critical-bg p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-status-critical" />
          <div className="flex-1 text-sm">
            <div className="font-semibold text-status-critical">Sin cobertura de control</div>
            <div className="mt-1 text-xs text-status-critical/90">Esta obligación no tiene ningún control asignado.</div>
          </div>
        </div>
      )}

      <Tabs defaultValue="descripcion" className="mt-6">
        <TabsList>
          <TabsTrigger value="descripcion">Descripción</TabsTrigger>
          <TabsTrigger value="controles">Controles ({controls.length})</TabsTrigger>
          <TabsTrigger value="evidencias">Evidencias ({evidences.length})</TabsTrigger>
          <TabsTrigger value="incidentes" className="flex items-center gap-1">
            <Siren className="h-3.5 w-3.5" />
            Incidentes ({linkedIncidents.length})
            {openIncidents > 0 && (
              <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-status-critical px-1 text-[9px] font-bold text-status-critical-foreground">
                {openIncidents}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="descripcion" className="mt-4">
          <Card className="p-6 space-y-5">
            <p className="text-sm leading-relaxed text-foreground">
              {obligation.title}. Obligación derivada del marco regulatorio {obligation.source ?? "—"}
              {obligation.policy_title ? `, vinculada a la política «${obligation.policy_title}» (${obligation.policy_code}).` : "."}
            </p>

            {obligation.country_scope && obligation.country_scope.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ámbito geográfico</div>
                <div className="flex flex-wrap gap-2">
                  {obligation.country_scope.map((c) => (
                    <StatusBadge key={c} label={c} tone="info" />
                  ))}
                </div>
              </div>
            )}

            {obligation.policy_code && (
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Política vinculada</div>
                <Link to={`/politicas/${obligation.policy_code}`} className="text-sm font-medium text-primary hover:underline">
                  {obligation.policy_code} — {obligation.policy_title}
                </Link>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="controles" className="mt-4 space-y-3">
          {controls.length === 0 ? (
            <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
              <ShieldOff className="h-12 w-12 text-status-critical" />
              <div className="text-base font-semibold">No hay ningún control asignado a esta obligación</div>
              <p className="max-w-md text-sm text-muted-foreground">Asigna un control para comenzar el proceso de cobertura.</p>
              <Button onClick={() => toast({ title: "Función disponible en entorno de producción" })} className="gap-1.5">
                <Plus className="h-4 w-4" />Asignar control
              </Button>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead className="w-32">Última prueba</TableHead>
                    <TableHead className="w-32">Próxima prueba</TableHead>
                    <TableHead className="w-40">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {controls.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell><Link to={`/obligaciones/controles/${c.code}`} className="font-mono text-xs text-primary hover:underline">{c.code}</Link></TableCell>
                      <TableCell className="text-sm font-medium">{c.name}</TableCell>
                      <TableCell className="text-sm">{c.owner_name ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{fmtDate(c.last_test_date)}</TableCell>
                      <TableCell className="font-mono text-xs">{fmtDate(c.next_test_date)}</TableCell>
                      <TableCell><StatusBadge label={controlStatusLabel(c.status)} tone={controlStatusTone(c.status)} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="evidencias" className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Control</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead className="w-32">Tipo</TableHead>
                  <TableHead className="w-28">Fecha</TableHead>
                  <TableHead className="w-44">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evidences.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">No hay evidencias cargadas.</TableCell></TableRow>
                )}
                {evidences.map((ev) => {
                  const ctrl = controls.find((c) => c.id === ev.control_id);
                  return (
                    <TableRow key={ev.id}>
                      <TableCell className="font-mono text-xs">{ctrl?.code ?? "—"}</TableCell>
                      <TableCell className="text-sm font-medium">
                        {ev.title}
                        {ev.status === "Rechazada" && ev.rejection_reason && (
                          <div className="mt-1 line-clamp-2 text-xs text-status-critical/90">{ev.rejection_reason}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{ev.ev_type ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{fmtDate(ev.created_at.slice(0, 10))}</TableCell>
                      <TableCell><StatusBadge label={evidenceStatusLabel(ev.status)} tone={evidenceStatusTone(ev.status)} /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="incidentes" className="mt-4">
          {linkedIncidents.length === 0 ? (
            <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
              <Siren className="h-10 w-10 text-muted-foreground" />
              <div className="text-base font-semibold">No hay incidentes registrados para esta obligación</div>
              <p className="max-w-md text-sm text-muted-foreground">
                Los incidentes GRC se vinculan vía <code className="font-mono">obligation_id</code> y aparecen aquí automáticamente.
              </p>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">Código</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="w-28">Severidad</TableHead>
                    <TableHead className="w-36">Estado</TableHead>
                    <TableHead className="w-32">Detección</TableHead>
                    <TableHead className="w-40">Notificación BdE</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linkedIncidents.map((inc) => (
                    <TableRow key={inc.id}>
                      <TableCell>
                        <Link
                          to={`/grc/m/dora/operate/incidents/${inc.id}`}
                          className="font-mono text-xs text-primary hover:underline"
                        >
                          {inc.code}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {inc.title}
                        {inc.is_major_incident && (
                          <div className="mt-1 flex items-center gap-1 text-[11px] text-status-critical">
                            <Clock className="h-3 w-3" /> Incidente grave — plazo 4h notificación
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {inc.severity && (
                          <StatusBadge
                            label={inc.severity}
                            tone={inc.severity === "Crítico" ? "critical" : inc.severity === "Alto" ? "warning" : "neutral"}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          label={inc.status}
                          tone={
                            inc.status === "Cerrado" || inc.status === "Resuelto"
                              ? "active"
                              : inc.status === "En investigación"
                              ? "warning"
                              : "critical"
                          }
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {inc.detection_date ? fmtDate(inc.detection_date.slice(0, 10)) : "—"}
                      </TableCell>
                      <TableCell>
                        {inc.regulatory_notification_required ? (
                          <StatusBadge label="REQUERIDA" tone="critical" />
                        ) : (
                          <span className="text-xs text-muted-foreground">No aplica</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
