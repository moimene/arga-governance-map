import { Link } from "react-router-dom";
import { useCallback, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import {
  useObligationsList,
  useAllControlsByObligationIds,
  controlStatusLabel,
  controlStatusTone,
  obligationCriticalityTone,
  isExclusionTitle,
  exclusionKind,
  splitFirmeza,
  type ObligationWithPolicy,
  type ControlWithOwner,
} from "@/hooks/usePoliciesObligations";
import { useTenantBranding } from "@/context/TenantBrandContext";
import { AlertTriangle, CheckCircle, AlertCircle, XCircle, ClipboardList, ShieldCheck, Info } from "lucide-react";
import { cn } from "@/lib/utils";

// El criterio de exclusión y la extracción de la cautela de firmeza viven en
// el hook (usePoliciesObligations), compartidos con la ficha de obligación y
// con la pestaña "Obligaciones" de la ficha de política.
const isExclusion = (o: ObligationWithPolicy) => isExclusionTitle(o.title);

interface KpiProps { label: string; value: number; icon: typeof ClipboardList; tone: "primary" | "success" | "warning" | "critical"; }
const toneMap = {
  primary: { bg: "bg-primary/10", text: "text-primary", value: "text-primary" },
  success: { bg: "bg-status-active/10", text: "text-status-active", value: "text-status-active" },
  warning: { bg: "bg-status-warning/10", text: "text-status-warning", value: "text-status-warning" },
  critical: { bg: "bg-destructive/10", text: "text-destructive", value: "text-destructive" },
};
function Kpi({ label, value, icon: Icon, tone }: KpiProps) {
  const s = toneMap[tone];
  return (
    <Card className="p-4">
      <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", s.bg)}>
        <Icon className={cn("h-5 w-5", s.text)} />
      </div>
      <div className={cn("mt-3 text-[32px] font-bold leading-none tracking-tight", s.value)}>{value}</div>
      <div className="mt-2 text-[13px] font-medium text-muted-foreground">{label}</div>
    </Card>
  );
}

export default function ObligacionesList() {
  const [framework, setFramework] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");

  const { data: allObligations = [], isLoading } = useObligationsList();
  const obligationIds = useMemo(() => allObligations.map((o) => o.id), [allObligations]);
  const { data: controls = [] } = useAllControlsByObligationIds(obligationIds);
  // G4 Task 7: aviso de postura demo sobre los estados de control, gateado
  // por tenant (branding NULL = ARGA = sin aviso nuevo). No hay columna que
  // distinga postura demo de real, así que el gate es el tenant.
  const branding = useTenantBranding();

  // Las exclusiones (no sujeción / excepción legal) no son obligaciones
  // cubiertas: fuera del recuento y de la tabla principal, tratamiento propio.
  const obligations = useMemo(() => allObligations.filter((o) => !isExclusion(o)), [allObligations]);
  const exclusions = useMemo(() => allObligations.filter(isExclusion), [allObligations]);

  const ctrlsByObl = useMemo(() => {
    const m = new Map<string, typeof controls>();
    for (const c of controls) {
      if (!c.obligation_id) continue;
      const arr = m.get(c.obligation_id) ?? [];
      arr.push(c);
      m.set(c.obligation_id, arr);
    }
    return m;
  }, [controls]);

  const obligationStatus = useCallback((o: ObligationWithPolicy): { label: string; tone: "active" | "warning" | "critical"; pulse: boolean } => {
    const cs = ctrlsByObl.get(o.id) ?? [];
    if (cs.length === 0) return { label: "SIN CONTROL", tone: "critical", pulse: true };
    // Deuda conocida y consciente (decisión del usuario, round 2 de Task 7):
    // "Deficiente" no es un valor real del CHECK de controls.status (real:
    // Efectivo | Parcial | Inefectivo) — este branch nunca se activa. ARGA
    // tiene un control real con status="Inefectivo" (CTR-008) que por eso cae
    // en el fallback "EN PROCESO" de abajo en vez de mostrarse como estado
    // crítico propio. Se conserva deliberadamente para no alterar la demo del
    // 21/07; no reportar como hallazgo nuevo.
    if (cs.some((c) => c.status === "Deficiente")) return { label: "DEFICIENTE", tone: "critical", pulse: false };
    if (cs.some((c) => c.status === "Parcial")) return { label: "EN REMEDIACIÓN", tone: "warning", pulse: false };
    if (cs.every((c) => c.status === "Efectivo")) return { label: "CUBIERTA", tone: "active", pulse: false };
    return { label: "EN PROCESO", tone: "warning", pulse: false };
  }, [ctrlsByObl]);

  // Marcos derivados del dato: reemplaza los 3 grupos cableados (dora/sol/others)
  // y el <Select> DORA/Solv/GDPR/LGPD fijo. Para Garrigues da 1 marco real
  // (PBC/FT — Ley 10/2010); para ARGA da sus 5 `source` reales tal cual están.
  const frameworks = useMemo(() => {
    const set = new Set(obligations.map((o) => o.source).filter((s): s is string => !!s));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [obligations]);

  const filtered = useMemo(() => obligations.filter((o) => {
    const st = obligationStatus(o);
    return (framework === "all" || o.source === framework) &&
      (status === "all" || st.label === status) &&
      (search === "" || o.title.toLowerCase().includes(search.toLowerCase()) || o.code.toLowerCase().includes(search.toLowerCase()));
  }), [obligations, framework, obligationStatus, status, search]);

  const groupedBySource = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, ObligationWithPolicy[]>();
    for (const o of filtered) {
      const key = o.source ?? "Sin marco";
      if (!map.has(key)) { map.set(key, []); order.push(key); }
      map.get(key)!.push(o);
    }
    return order.map((source) => ({ source, rows: map.get(source)! }));
  }, [filtered]);

  const kpis = {
    total: obligations.length,
    cubiertas: obligations.filter((o) => obligationStatus(o).label === "CUBIERTA").length,
    parcial: obligations.filter((o) => ["EN REMEDIACIÓN", "EN PROCESO"].includes(obligationStatus(o).label)).length,
    sin: obligations.filter((o) => obligationStatus(o).label === "SIN CONTROL").length,
  };

  const sinControl = obligations.find((o) => obligationStatus(o).label === "SIN CONTROL");

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <ShieldCheck className="h-6 w-6 text-primary" />Obligaciones y Controles
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Trazabilidad norma → obligación → control → evidencia</p>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-4 gap-4">
        <Kpi label="Total obligaciones" value={kpis.total} icon={ClipboardList} tone="primary" />
        <Kpi label="Cubiertas" value={kpis.cubiertas} icon={CheckCircle} tone="success" />
        <Kpi label="Cobertura parcial / en remediación" value={kpis.parcial} icon={AlertCircle} tone="warning" />
        <Kpi label="Sin control asignado" value={kpis.sin} icon={XCircle} tone="critical" />
      </div>

      {sinControl && (
        <div className="mb-5 tour-target flex items-start gap-3 rounded-md border border-status-critical/30 border-l-4 border-l-status-critical bg-status-critical-bg p-4" data-tour="obl-banner">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-status-critical" />
          <div className="flex-1 text-sm">
            <div className="font-semibold text-status-critical">{sinControl.code} no tiene ningún control asignado</div>
            <div className="mt-1 text-xs text-status-critical/90">{sinControl.title} — acción inmediata requerida.</div>
          </div>
          <Button asChild size="sm" variant="outline" className="border-status-critical/40 text-status-critical hover:bg-status-critical/5">
            <Link to={`/obligaciones/${sinControl.code}`}>Ver obligación →</Link>
          </Button>
        </div>
      )}

      {branding && (
        <div className="mb-5 flex items-start gap-3 rounded-md border border-status-warning/30 border-l-4 border-l-status-warning bg-status-warning-bg p-4">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-status-warning" />
          <div className="flex-1 text-sm">
            <div className="font-semibold text-status-warning">Postura de demostración</div>
            <div className="mt-1 text-xs text-status-warning/90">
              Los estados de control ("Efectivo" / "En remediación") y la criticidad asignada a cada obligación ("Crítico" / "Alto" / "Medio") son una postura de demostración sobre obligaciones y controles reales de la firma, no el resultado de una auditoría verificada ni un juicio de riesgo.
            </div>
          </div>
        </div>
      )}

      <Card className="mb-5 p-4">
        <div className="grid grid-cols-3 gap-3">
          <Select value={framework} onValueChange={setFramework}>
            <SelectTrigger><SelectValue placeholder="Marco" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los marcos</SelectItem>
              {frameworks.map((f) => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="CUBIERTA">Cubierta</SelectItem>
              <SelectItem value="EN REMEDIACIÓN">En remediación</SelectItem>
              <SelectItem value="SIN CONTROL">Sin control</SelectItem>
              <SelectItem value="DEFICIENTE">Deficiente</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Buscar obligación..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </Card>

      <Card className="overflow-hidden">
        {isLoading && <div className="p-4 space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>}
        {!isLoading && groupedBySource.map((g) => (
          <div key={g.source}>
            <div className="border-b bg-muted px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {g.source}
            </div>
            <ObligationTable rows={g.rows} ctrlsByObl={ctrlsByObl} obligationStatus={obligationStatus} />
          </div>
        ))}
        {!isLoading && filtered.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">No hay obligaciones que coincidan con los filtros.</div>
        )}
      </Card>

      {exclusions.length > 0 && (
        <Card className="mt-5 overflow-hidden">
          <div className="border-b bg-muted px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Exenciones y excepciones — no son obligaciones cubiertas
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Código</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="w-32">Marco</TableHead>
                <TableHead className="w-28">Tipo</TableHead>
                <TableHead className="w-40">Control asociado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exclusions.map((o) => {
                const kind = exclusionKind(o.title);
                const { title: cleanTitle, pending } = splitFirmeza(o.title);
                const cs = ctrlsByObl.get(o.id) ?? [];
                return (
                  <TableRow key={o.id}>
                    <TableCell><Link to={`/obligaciones/${o.code}`} className="font-mono text-xs text-primary hover:underline">{o.code}</Link></TableCell>
                    <TableCell>
                      <Link to={`/obligaciones/${o.code}`} title={cleanTitle} className="block max-w-md truncate text-sm font-medium hover:text-primary">
                        {cleanTitle}
                      </Link>
                      {pending && (
                        <StatusBadge label="Pendiente confirmación Comité Legal" tone="warning" className="mt-1" />
                      )}
                      {o.owner_body_slug && (
                        <Link to={`/organos/${o.owner_body_slug}`} className="mt-0.5 block text-[11px] text-muted-foreground hover:text-primary hover:underline">
                          Comité responsable: {o.owner_body_name}
                        </Link>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {o.source ?? "—"}
                      {o.legal_reference && <div className="mt-0.5 text-[10px] text-muted-foreground/80">{o.legal_reference}</div>}
                    </TableCell>
                    <TableCell><StatusBadge label={kind} tone="neutral" /></TableCell>
                    <TableCell className="font-mono text-xs">
                      {cs.length === 0 ? <span className="text-muted-foreground">(ninguno)</span> : cs.map((c) => c.code).join(", ")}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

interface ObligationTableProps {
  rows: ObligationWithPolicy[];
  ctrlsByObl: Map<string, ControlWithOwner[]>;
  obligationStatus: (o: ObligationWithPolicy) => { label: string; tone: "active" | "warning" | "critical"; pulse: boolean };
}

function ObligationTable({ rows, ctrlsByObl, obligationStatus }: ObligationTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-32">Código</TableHead>
          <TableHead>Obligación</TableHead>
          <TableHead className="w-32">Marco</TableHead>
          <TableHead className="w-32">Criticidad</TableHead>
          <TableHead className="w-28">Política</TableHead>
          <TableHead className="w-40">Control(es)</TableHead>
          <TableHead className="w-44">Estado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((o) => {
          const st = obligationStatus(o);
          const noCoverage = st.label === "SIN CONTROL";
          const warn = st.tone === "warning";
          const cs = ctrlsByObl.get(o.id) ?? [];
          return (
            <TableRow key={o.id} className={cn(noCoverage && "bg-status-critical-bg hover:bg-status-critical-bg", warn && "bg-status-warning-bg/60 hover:bg-status-warning-bg")}>
              <TableCell><Link to={`/obligaciones/${o.code}`} className="font-mono text-xs text-primary hover:underline">{o.code}</Link></TableCell>
              <TableCell>
                <Link to={`/obligaciones/${o.code}`} title={o.title} className="block line-clamp-2 text-sm font-medium hover:text-primary">
                  {o.title}
                </Link>
                {/* Ownership navegable por FK, en sublínea (mismo patrón que
                    legal_reference bajo Marco): como columna propia estrujaba
                    el título de la obligación. Sin FK — ARGA — no se pinta. */}
                {o.owner_body_slug && (
                  <Link to={`/organos/${o.owner_body_slug}`} className="mt-0.5 block text-[11px] text-muted-foreground hover:text-primary hover:underline">
                    Comité responsable: {o.owner_body_name}
                  </Link>
                )}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {o.source ?? "—"}
                {o.legal_reference && <div className="mt-0.5 text-[10px] text-muted-foreground/80">{o.legal_reference}</div>}
              </TableCell>
              <TableCell>{o.criticality && <StatusBadge label={o.criticality} tone={obligationCriticalityTone(o.criticality)} />}</TableCell>
              <TableCell>
                {o.policy_code ? (
                  <Link to={`/politicas/${o.policy_code}`} className="font-mono text-xs text-primary hover:underline">{o.policy_code}</Link>
                ) : <span className="text-xs text-muted-foreground">—</span>}
              </TableCell>
              <TableCell>
                {cs.length === 0 ? (
                  <span className="font-mono text-xs text-muted-foreground">—</span>
                ) : (
                  <div className="flex flex-col gap-0.5">
                    {cs.map((c) => (
                      <Link key={c.id} to={`/obligaciones/controles/${c.code}`} className="font-mono text-xs text-primary hover:underline">{c.code}</Link>
                    ))}
                  </div>
                )}
              </TableCell>
              <TableCell>
                <StatusBadge label={st.label} pulse={st.pulse} tone={st.tone} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
