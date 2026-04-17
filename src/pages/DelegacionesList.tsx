import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { useDelegationsList, delegationStatusLabel, delegationStatusTone, formatDate } from "@/hooks/useDelegations";
import { AlertTriangle, Ban, Clock, Key, Plus, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const toneMap = {
  primary: { bg: "bg-primary/10", text: "text-primary", value: "text-primary" },
  success: { bg: "bg-status-active/10", text: "text-status-active", value: "text-status-active" },
  warning: { bg: "bg-status-warning/10", text: "text-status-warning", value: "text-status-warning" },
  critical: { bg: "bg-destructive/10", text: "text-destructive", value: "text-destructive" },
  archived: { bg: "bg-muted", text: "text-muted-foreground", value: "text-muted-foreground" },
} as const;

function Kpi({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof Key; tone: keyof typeof toneMap }) {
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

const statusOrder: Record<string, number> = { "Caducada": 0, "Próxima a vencer": 1, "Próximo a vencer": 1, "Vigente": 2, "Revocada": 3 };

export default function DelegacionesList() {
  const { data: delegations = [], isLoading } = useDelegationsList();
  const [status, setStatus] = useState("all");
  const [entity, setEntity] = useState("all");
  const [search, setSearch] = useState("");

  const entityOptions = useMemo(() => {
    const seen = new Map<string, string>();
    delegations.forEach((d) => {
      if (d.entity_id && d.entity_name) seen.set(d.entity_id, d.entity_name);
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [delegations]);

  const filtered = useMemo(() => delegations
    .filter((d) =>
      (status === "all" || d.status === status) &&
      (entity === "all" || d.entity_id === entity) &&
      (search === "" || (d.delegate_name ?? "").toLowerCase().includes(search.toLowerCase()) || d.code.toLowerCase().includes(search.toLowerCase()))
    )
    .sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9)),
  [delegations, status, entity, search]);

  const kpis = {
    vigente: delegations.filter((d) => d.status === "Vigente").length,
    proxima: delegations.filter((d) => d.status === "Próxima a vencer" || d.status === "Próximo a vencer").length,
    caducada: delegations.filter((d) => d.status === "Caducada").length,
    revocada: delegations.filter((d) => d.status === "Revocada").length,
  };

  const expiredAlert = delegations.find((d) => d.status === "Caducada");

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Key className="h-6 w-6 text-primary" />Delegaciones y Poderes
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Quién tiene poderes de representación, con qué límites y por cuánto tiempo</p>
        </div>
        <Button className="gap-1.5"><Plus className="h-4 w-4" />Nueva delegación</Button>
      </div>

      <div className="mb-5 grid grid-cols-4 gap-4">
        <Kpi label="Vigentes" value={kpis.vigente} icon={Key} tone="success" />
        <Kpi label="Próximas a vencer (<90 días)" value={kpis.proxima} icon={Clock} tone="warning" />
        <Kpi label="Caducadas" value={kpis.caducada} icon={XCircle} tone="critical" />
        <Kpi label="Revocadas" value={kpis.revocada} icon={Ban} tone="archived" />
      </div>

      {expiredAlert && (
        <div className="mb-3 tour-target flex items-start gap-3 rounded-md border border-status-critical/30 border-l-4 border-l-status-critical bg-status-critical-bg p-4" data-tour="deleg-row">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-status-critical" />
          <div className="flex-1 text-sm">
            <div className="font-semibold text-status-critical">{kpis.caducada} delegación{kpis.caducada !== 1 ? "es" : ""} caducada{kpis.caducada !== 1 ? "s" : ""} sin revocación formal — {expiredAlert.delegate_name}</div>
            <div className="mt-1 text-xs text-status-critical/90">Posible riesgo jurídico para actos realizados tras el vencimiento.</div>
          </div>
          <Button asChild size="sm" variant="outline" className="border-status-critical/40 text-status-critical hover:bg-status-critical/5">
            <Link to={`/delegaciones/${expiredAlert.slug}`}>Ver delegación →</Link>
          </Button>
        </div>
      )}

      {kpis.proxima > 0 && (
        <div className="mb-5 flex items-start gap-3 rounded-md border border-status-warning/30 border-l-4 border-l-status-warning bg-status-warning-bg p-4">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-status-warning" />
          <div className="flex-1 text-sm">
            <div className="font-semibold text-status-warning">{kpis.proxima} delegación{kpis.proxima !== 1 ? "es" : ""} vence{kpis.proxima === 1 ? "" : "n"} en menos de 90 días</div>
            <div className="mt-1 text-xs text-status-warning/90">Revisar y renovar antes de la fecha de caducidad.</div>
          </div>
        </div>
      )}

      <Card className="mb-5 p-4">
        <div className="grid grid-cols-3 gap-3">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="Vigente">Vigente</SelectItem>
              <SelectItem value="Próxima a vencer">Próxima vencimiento</SelectItem>
              <SelectItem value="Caducada">Caducada</SelectItem>
              <SelectItem value="Revocada">Revocada</SelectItem>
            </SelectContent>
          </Select>
          <Select value={entity} onValueChange={setEntity}>
            <SelectTrigger><SelectValue placeholder="Entidad" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las entidades</SelectItem>
              {entityOptions.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Buscar titular o código..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Código</TableHead>
              <TableHead>Titular</TableHead>
              <TableHead>Entidad</TableHead>
              <TableHead>Ámbito</TableHead>
              <TableHead className="w-44">Estado</TableHead>
              <TableHead className="w-32">Vencimiento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell>
              </TableRow>
            ))}
            {!isLoading && filtered.map((d) => {
              const isCaducada = d.status === "Caducada";
              const isProxima = d.status === "Próxima a vencer" || d.status === "Próximo a vencer";
              const isRevocada = d.status === "Revocada";
              const tone = delegationStatusTone(d.status);
              const rowClass = isCaducada ? "bg-status-critical-bg hover:bg-status-critical-bg" :
                isProxima ? "bg-status-warning-bg/60 hover:bg-status-warning-bg" :
                isRevocada ? "bg-muted/30 hover:bg-muted/40" : "";
              return (
                <TableRow key={d.id} className={cn(rowClass, isCaducada && "tour-target")} data-tour={isCaducada ? "deleg-row-vaz" : undefined}>
                  <TableCell><Link to={`/delegaciones/${d.slug}`} className="font-mono text-xs text-primary hover:underline">{d.code}</Link></TableCell>
                  <TableCell><Link to={`/delegaciones/${d.slug}`} className="text-sm font-medium hover:text-primary">{d.delegate_name ?? "—"}</Link></TableCell>
                  <TableCell className="text-sm">{d.entity_name ?? "—"}</TableCell>
                  <TableCell className="max-w-md text-xs text-muted-foreground line-clamp-2">{d.scope ?? "—"}</TableCell>
                  <TableCell><StatusBadge label={delegationStatusLabel(d.status)} tone={tone} /></TableCell>
                  <TableCell className="font-mono text-xs">{formatDate(d.end_date)}</TableCell>
                </TableRow>
              );
            })}
            {!isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">Sin delegaciones que coincidan con los filtros.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
