import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { usePoliciesList, policyStatusLabel } from "@/hooks/usePoliciesObligations";
import { AlertTriangle, FileText, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const TIER_CHIP: Record<string, string> = {
  POLITICA:      "bg-[var(--status-info)] text-[var(--g-text-inverse)]",
  NORMA:         "bg-[var(--g-surface-muted)] text-[var(--g-text-primary)] border border-[var(--g-border-subtle)]",
  PROCEDIMIENTO: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  DOCUMENTO:     "bg-[var(--g-surface-subtle)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
};

const fmtDate = (d: string | null) => {
  if (!d) return null;
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};

export default function PoliticasList() {
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const { data: policies = [], isLoading } = usePoliciesList();

  const filtered = useMemo(() =>
    policies.filter((p) =>
      (typeFilter === "all" || p.policy_type === typeFilter) &&
      (statusFilter === "all" || p.status === statusFilter) &&
      (search === "" || p.title.toLowerCase().includes(search.toLowerCase()) || p.policy_code.toLowerCase().includes(search.toLowerCase()))
    ), [policies, typeFilter, statusFilter, search]);

  const types = Array.from(new Set(policies.map((p) => p.policy_type).filter(Boolean) as string[]));
  const statuses = Array.from(new Set(policies.map((p) => p.status)));

  // Compute attention count: in review, approval pending, or past next_review_date
  const today = new Date().toISOString().slice(0, 10);
  const attention = policies.filter(
    (p) => p.status === "In Review" || p.status === "Approval Pending" ||
           (p.next_review_date && p.next_review_date <= today)
  );

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <FileText className="h-6 w-6 text-primary" />Políticas y Normativa
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLoading ? "Cargando…" : `${policies.length} políticas y normas en el catálogo del grupo`}
          </p>
        </div>
        <Button className="gap-1.5"><Plus className="h-4 w-4" />Nueva política</Button>
      </div>

      {attention.length > 0 && (
        <div className="mb-5 flex items-start gap-3 rounded-md border border-status-warning/30 border-l-4 border-l-status-warning bg-status-warning-bg p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-status-warning" />
          <div className="flex-1 text-sm">
            <div className="font-semibold text-status-warning">{attention.length} políticas requieren atención inmediata</div>
            <div className="mt-1 text-xs text-status-warning/90">
              {attention.slice(0, 3).map((p, i) => (
                <span key={p.policy_code}>
                  {i > 0 && " · "}
                  <Link to={`/politicas/${p.policy_code}`} className="hover:underline">{p.policy_code}</Link>
                  {" "}({policyStatusLabel(p.status).toLowerCase()})
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <Card className="mb-5 p-4">
        <div className="grid grid-cols-4 gap-3">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              {types.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {statuses.map((s) => <SelectItem key={s} value={s}>{policyStatusLabel(s)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select defaultValue="grupo">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="grupo">Ámbito: Grupo</SelectItem>
              <SelectItem value="espana">España</SelectItem>
              <SelectItem value="filial">Filial específica</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Buscar política..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Código</TableHead>
              <TableHead>Título</TableHead>
              <TableHead className="w-36">Tipo</TableHead>
              <TableHead className="w-32">Nivel</TableHead>
              <TableHead>Propietario</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-32">Vigente desde</TableHead>
              <TableHead className="w-36">Próxima revisión</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={8}><Skeleton className="h-5 w-full" /></TableCell>
              </TableRow>
            ))}
            {!isLoading && filtered.map((p) => {
              const overdue = p.next_review_date && p.next_review_date <= today;
              return (
                <TableRow key={p.policy_code}>
                  <TableCell><Link to={`/politicas/${p.policy_code}`} className="font-mono text-xs text-primary hover:underline">{p.policy_code}</Link></TableCell>
                  <TableCell><Link to={`/politicas/${p.policy_code}`} className="text-sm font-medium hover:text-primary">{p.title}</Link></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.policy_type ?? "—"}</TableCell>
                  <TableCell>
                    {p.normative_tier ? (
                      <span className={cn("inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium", TIER_CHIP[p.normative_tier] ?? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]")}>
                        {p.normative_tier}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-sm">{p.owner_function ?? "—"}</TableCell>
                  <TableCell><StatusBadge label={policyStatusLabel(p.status)} /></TableCell>
                  <TableCell className="font-mono text-xs">{fmtDate(p.effective_date) ?? "—"}</TableCell>
                  <TableCell className={cn("font-mono text-xs", overdue && "text-status-critical font-semibold")}>
                    {fmtDate(p.next_review_date) ?? "—"}{overdue && " ⚠"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
