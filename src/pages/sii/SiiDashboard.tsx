import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KpiCard } from "@/components/KpiCard";
import { StatusBadge } from "@/components/StatusBadge";
import { useSiiCasesList } from "@/hooks/useSii";
import { AlertOctagon, Archive, FolderOpen, Loader2 } from "lucide-react";

export default function SiiDashboard() {
  const { data: cases = [], isLoading } = useSiiCasesList();

  const isClosed = (s: string | null) => !!s && s.toUpperCase().startsWith("CERRAD");
  const active = cases.filter((c) => !isClosed(c.status)).length;
  const closed = cases.length - active;

  const toneFor = (s: string | null): "info" | "warning" | "neutral" => {
    const v = (s ?? "").toUpperCase();
    if (v.startsWith("EN INVESTIGAC")) return "info";
    if (v.startsWith("EN ANÁLISIS") || v.startsWith("EN ANALISIS")) return "warning";
    if (v.startsWith("CERRAD")) return "neutral";
    return "neutral";
  };

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <h1 className="text-2xl font-semibold tracking-tight text-sii-foreground">Casos del canal interno</h1>
      <p className="mt-1 text-sm text-sii-foreground/70">Gestión confidencial conforme a Ley 2/2023.</p>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <KpiCard label="Casos activos" value={active} icon={FolderOpen} tone="warning" />
        <KpiCard label="Casos cerrados (ejercicio)" value={closed} icon={Archive} tone="neutral" />
        <KpiCard label="Plazo medio de respuesta" value="5 días" icon={AlertOctagon} tone="primary" />
      </div>

      <Card className="mt-6 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Referencia</TableHead>
              <TableHead>Recibido</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Clasificación</TableHead>
              <TableHead>País</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Investigador</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                </TableCell>
              </TableRow>
            )}
            {!isLoading && cases.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  No hay casos registrados.
                </TableCell>
              </TableRow>
            )}
            {cases.map((c) => (
              <TableRow key={c.id} className="cursor-pointer">
                <TableCell className="font-mono text-xs font-semibold">
                  <Link to={`/sii/${c.display_id}`} className="text-sii-foreground hover:underline">
                    {c.display_id}
                  </Link>
                </TableCell>
                <TableCell className="text-sm">{c.received_date ?? "—"}</TableCell>
                <TableCell className="text-sm">{c.channel ?? "—"}</TableCell>
                <TableCell className="text-sm">{c.classification ?? c.category ?? "—"}</TableCell>
                <TableCell className="text-sm">{c.country ?? "—"}</TableCell>
                <TableCell>
                  <StatusBadge label={c.status ?? "—"} tone={toneFor(c.status)} />
                </TableCell>
                <TableCell className="text-sm">{c.investigator_name ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
