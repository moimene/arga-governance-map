import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { policies } from "@/data/policies";
import { AlertTriangle, FileText, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PoliticasList() {
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() =>
    policies.filter((p) =>
      (typeFilter === "all" || p.type === typeFilter) &&
      (statusFilter === "all" || p.status === statusFilter) &&
      (search === "" || p.title.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase()))
    ), [typeFilter, statusFilter, search]);

  const types = Array.from(new Set(policies.map((p) => p.type)));
  const statuses = Array.from(new Set(policies.map((p) => p.status)));

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <FileText className="h-6 w-6 text-primary" />Políticas y Normativa
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{policies.length} políticas y normas en el catálogo del grupo</p>
        </div>
        <Button className="gap-1.5"><Plus className="h-4 w-4" />Nueva política</Button>
      </div>

      <div className="mb-5 flex items-start gap-3 rounded-md border border-status-warning/30 border-l-4 border-l-status-warning bg-status-warning-bg p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-status-warning" />
        <div className="flex-1 text-sm">
          <div className="font-semibold text-status-warning">3 políticas requieren atención inmediata</div>
          <div className="mt-1 text-xs text-status-warning/90">
            <Link to="/politicas/PR-003" className="hover:underline">PR-003</Link> vence 30/04/2026 ·{" "}
            <Link to="/politicas/PR-008" className="hover:underline">PR-008</Link> pendiente aprobación Consejo 22/04 ·{" "}
            <Link to="/politicas/PR-021" className="hover:underline">PR-021</Link> en revisión
          </div>
        </div>
      </div>

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
              {statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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
              <TableHead className="w-40">Tipo</TableHead>
              <TableHead>Propietario</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-32">Vigente desde</TableHead>
              <TableHead className="w-36">Próxima revisión</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => {
              const isPr003 = p.code === "PR-003";
              return (
                <TableRow key={p.code}>
                  <TableCell><Link to={`/politicas/${p.code}`} className="font-mono text-xs text-primary hover:underline">{p.code}</Link></TableCell>
                  <TableCell><Link to={`/politicas/${p.code}`} className="text-sm font-medium hover:text-primary">{p.title}</Link></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.type}</TableCell>
                  <TableCell className="text-sm">{p.owner}</TableCell>
                  <TableCell><StatusBadge label={p.status} /></TableCell>
                  <TableCell className="font-mono text-xs">{p.effectiveDate ?? "—"}</TableCell>
                  <TableCell className={cn("font-mono text-xs", isPr003 && "text-status-critical font-semibold")}>
                    {p.nextReview ?? "—"}{isPr003 && " ⚠"}
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
