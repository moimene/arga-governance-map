import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { useWhistleblowingReports } from "@/hooks/useWhistleblowing";
import { computeWhistleblowingDeadlines } from "@/lib/sii/whistleblowing-engine";
import {
  AlertOctagon,
  ShieldCheck,
  PlusCircle,
  KeyRound,
  Gavel,
  Clock,
  Layers,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Search,
  Filter,
  FileLock2,
  Users,
  EyeOff,
} from "lucide-react";

export default function SiiDashboard() {
  const navigate = useNavigate();
  const { data: reports = [], isLoading } = useWhistleblowingReports();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("ALL");

  const totalReports = reports.length;
  const activeReports = reports.filter((r) => r.status !== "RESUELTO_MEDIDAS" && r.status !== "ARCHIVADO_MOTIVADO").length;
  const totalSubcases = reports.reduce((acc, r) => acc + r.subcases.length, 0);
  const ackComplied = reports.filter((r) => !!r.acknowledgmentSentDate || !!r.acknowledgmentExemptReason).length;

  const filteredReports = reports.filter((r) => {
    const matchesSearch =
      r.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.entityName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSeverity = filterSeverity === "ALL" || r.severity === filterSeverity;
    return matchesSearch && matchesSeverity;
  });

  return (
    <div className="mx-auto max-w-[1440px] p-6 space-y-6 animate-fade-in">
      {/* Top Banner & Title */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--status-warning)] animate-pulse" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--status-warning)]">
              Zona Segregada de Información Confidencial
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[var(--t-text-primary)]">
            Sistema Interno de Información (SII) — Canal de Denuncias
          </h1>
          <p className="text-xs text-[var(--t-text-secondary)] mt-1">
            Gobernanza conforme a la <strong>Ley 2/2023</strong>, <strong>Directiva (UE) 2019/1937</strong> y <strong>Código Penal Art. 31 bis</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => navigate("/sii/nuevo")}
            className="bg-[var(--t-brand)] text-white hover:bg-[var(--t-brand)]/90 text-xs gap-1.5"
          >
            <PlusCircle className="h-4 w-4" /> Registrar Comunicación
          </Button>

          <Button
            variant="outline"
            onClick={() => navigate("/sii/buzon")}
            className="text-xs gap-1.5 text-[var(--t-text-primary)]"
          >
            <KeyRound className="h-4 w-4 text-[var(--t-brand)]" /> Safe Inbox Informante
          </Button>

          <Button
            variant="outline"
            onClick={() => navigate("/sii/libro-registro")}
            className="text-xs gap-1.5 text-[var(--t-text-primary)]"
          >
            <Gavel className="h-4 w-4 text-[var(--t-brand)]" /> Libro-Registro (Art. 34)
          </Button>
        </div>
      </div>

      {/* KPI Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-[var(--t-border-default)] bg-[var(--t-surface-card)] p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-[var(--t-text-secondary)] uppercase font-semibold">
            <span>Expedientes Totales</span>
            <AlertOctagon className="h-4 w-4 text-[var(--t-brand)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--t-text-primary)]">{totalReports}</div>
          <div className="text-[11px] text-[var(--t-text-secondary)]">{activeReports} en instrucción activa</div>
        </Card>

        <Card className="border-[var(--t-border-default)] bg-[var(--t-surface-card)] p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-[var(--t-text-secondary)] uppercase font-semibold">
            <span>Cumplimiento Acuse (7d)</span>
            <CheckCircle2 className="h-4 w-4 text-[var(--status-success)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--status-success)]">
            {totalReports > 0 ? `${Math.round((ackComplied / totalReports) * 100)}%` : "100%"}
          </div>
          <div className="text-[11px] text-[var(--t-text-secondary)]">SLA legal Art. 9.2.c Ley 2/2023</div>
        </Card>

        <Card className="border-[var(--t-border-default)] bg-[var(--t-surface-card)] p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-[var(--t-text-secondary)] uppercase font-semibold">
            <span>Subexpedientes Autónomos</span>
            <Layers className="h-4 w-4 text-[var(--t-brand)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--t-text-primary)]">{totalSubcases}</div>
          <div className="text-[11px] text-[var(--t-text-secondary)]">Penal, RGPD, DORA, AIMS, Laboral</div>
        </Card>

        <Card className="border-[var(--t-border-default)] bg-[var(--t-surface-card)] p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-[var(--t-text-secondary)] uppercase font-semibold">
            <span>Garantías de Protección</span>
            <ShieldCheck className="h-4 w-4 text-[var(--status-success)]" />
          </div>
          <div className="text-2xl font-bold text-[var(--status-success)]">100%</div>
          <div className="text-[11px] text-[var(--t-text-secondary)]">Anti-represalias & Safe Inbox EAD</div>
        </Card>
      </div>

      {/* Controles de Filtrado */}
      <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="h-3.5 w-3.5 absolute left-3 top-3 text-[var(--t-text-secondary)]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por código, materia, resumen o entidad..."
              className="w-full pl-9 pr-3 py-2 border border-[var(--t-border-default)] rounded bg-[var(--t-surface-card)] text-[var(--t-text-primary)]"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[var(--t-text-secondary)] font-medium">Severidad:</span>
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="px-3 py-2 border border-[var(--t-border-default)] rounded bg-[var(--t-surface-card)] text-[var(--t-text-primary)]"
          >
            <option value="ALL">Todas las severidades</option>
            <option value="MUY_GRAVE">Muy Grave</option>
            <option value="GRAVE">Grave</option>
            <option value="LEVE">Leve</option>
          </select>
        </div>
      </div>

      {/* Tabla Principal de Expedientes */}
      <Card className="border-[var(--t-border-default)] bg-[var(--t-surface-card)] overflow-hidden">
        <Table className="text-xs">
          <TableHeader>
            <TableRow className="bg-[var(--t-surface-subtle)]">
              <TableHead className="font-bold">Código Expediente</TableHead>
              <TableHead className="font-bold">Materia / Categoría</TableHead>
              <TableHead className="font-bold">Entidad</TableHead>
              <TableHead className="font-bold">Canal / Modalidad</TableHead>
              <TableHead className="font-bold">Subexpedientes Autónomos</TableHead>
              <TableHead className="font-bold">Acuse (7d)</TableHead>
              <TableHead className="font-bold">Plazo Resolución</TableHead>
              <TableHead className="font-bold">Estado</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredReports.map((r) => {
              const deadlines = computeWhistleblowingDeadlines(r.intakeDate, r.acknowledgmentSentDate, r.extensionApproved);
              return (
                <TableRow key={r.id} className="hover:bg-[var(--t-surface-subtle)]/40 transition-colors">
                  <TableCell className="font-mono font-bold text-[var(--t-brand)]">
                    {r.code}
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold text-[var(--t-text-primary)]">{r.category}</div>
                    <div className="text-[11px] text-[var(--t-text-secondary)] max-w-sm truncate">{r.summary}</div>
                  </TableCell>
                  <TableCell className="font-medium text-[var(--t-text-primary)]">{r.entityName}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 font-medium">
                      {r.anonymityMode === "ANONIMO_ESTRICTO" ? <EyeOff className="h-3.5 w-3.5 text-[var(--t-brand)]" /> : <Users className="h-3.5 w-3.5 text-[var(--t-text-secondary)]" />}
                      <span>{r.channel.replace(/_/g, " ")}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {r.subcases.map((s) => (
                        <span key={s.id} className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[var(--t-surface-subtle)] text-[var(--t-brand)] border border-[var(--t-border-default)]">
                          {s.regime.replace("_", " ")}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {r.acknowledgmentSentDate ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--status-success)]/10 text-[var(--status-success)] flex items-center gap-1 w-fit">
                        <CheckCircle2 className="h-3 w-3" /> Emitido
                      </span>
                    ) : (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${deadlines.ackIsOverdue ? "bg-[var(--status-error)]/10 text-[var(--status-error)]" : "bg-[var(--status-warning)]/10 text-[var(--status-warning)]"}`}>
                        {deadlines.ackDaysRemaining}d restantes
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-[11px] font-medium text-[var(--t-text-primary)]">
                      {new Date(r.resolutionDeadline).toLocaleDateString("es-ES")}
                    </div>
                    {r.extensionApproved && (
                      <span className="text-[10px] text-[var(--status-warning)] font-semibold block">Prórroga +3m</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--t-surface-subtle)] text-[var(--t-brand)] border border-[var(--t-border-default)]">
                      {r.status.replace(/_/g, " ")}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" asChild className="h-7 text-xs gap-1">
                      <Link to={`/sii/${r.code}`}>
                        Instruir <ChevronRight className="h-3 w-3" />
                      </Link>
                    </Button>
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
