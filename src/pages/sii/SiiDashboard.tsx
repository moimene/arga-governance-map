import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KpiCard } from "@/components/KpiCard";
import { StatusBadge } from "@/components/StatusBadge";
import { siiCases } from "@/data/sii";
import { AlertOctagon, Archive, FolderOpen } from "lucide-react";

export default function SiiDashboard() {
  const active = siiCases.filter((c) => !c.status.startsWith("CERRADO")).length;
  const closed = siiCases.length - active;

  const toneFor = (s: string) => s.startsWith("EN INVESTIGACIÓN") ? "info" : s.startsWith("EN ANÁLISIS") ? "warning" : s.startsWith("CERRADO") ? "neutral" : "neutral";

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
              <TableHead>ID</TableHead>
              <TableHead>Recibido</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Investigador</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {siiCases.map((c) => (
              <TableRow key={c.id} className="cursor-pointer">
                <TableCell className="font-mono text-xs font-semibold">
                  <Link to={`/sii/${c.id}`} className="text-sii-foreground hover:underline">{c.id}</Link>
                </TableCell>
                <TableCell className="text-sm">{c.receivedDate}</TableCell>
                <TableCell className="text-sm">{c.channel}</TableCell>
                <TableCell className="text-sm">{c.category}</TableCell>
                <TableCell><StatusBadge label={c.status} tone={toneFor(c.status) as any} /></TableCell>
                <TableCell className="text-sm">{c.investigator}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
