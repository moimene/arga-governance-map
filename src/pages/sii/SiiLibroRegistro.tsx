import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useWhistleblowingLibroRegistro } from "@/hooks/useWhistleblowing";
import {
  Gavel,
  ShieldCheck,
  Download,
  Search,
  Filter,
  CheckCircle2,
  ChevronRight,
  FileLock2,
} from "lucide-react";

export default function SiiLibroRegistro() {
  const { data: entries = [], isLoading } = useWhistleblowingLibroRegistro();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("ALL");

  const filteredEntries = entries.filter((e) => {
    const matchesSearch =
      e.recordNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.reportCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.investigator.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = filterCategory === "ALL" || e.category.toLowerCase().includes(filterCategory.toLowerCase());
    return matchesSearch && matchesCategory;
  });

  const handleExportCertified = () => {
    const content = JSON.stringify(entries, null, 2);
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `LIBRO_REGISTRO_OFICIAL_SII_LEY2_2023_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Libro-Registro exportado. Entorno de validación funcional: la exportación no lleva firma ni manifiesto criptográfico.");
  };

  return (
    <div className="mx-auto max-w-[1440px] p-6 space-y-6 animate-fade-in">
      {/* Header & Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <nav className="mb-2 flex items-center gap-1 text-xs text-[var(--t-text-secondary)]">
            <Link to="/sii" className="hover:text-[var(--t-text-primary)]">SII — Canal Interno</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-[var(--t-text-primary)] font-semibold">Libro-Registro Oficial</span>
          </nav>
          <div className="flex items-center gap-2">
            <Gavel className="h-6 w-6 text-[var(--t-brand)]" />
            <h1 className="text-xl font-bold text-[var(--t-text-primary)]">
              Libro-Registro del Sistema Interno de Información (Art. 26 Ley 2/2023)
            </h1>
          </div>
        </div>

        <Button
          onClick={handleExportCertified}
          className="bg-[var(--t-brand)] text-white hover:bg-[var(--t-brand)]/90 text-xs gap-1.5"
        >
          <Download className="h-4 w-4" /> Exportar Libro-Registro Certificado (WORM)
        </Button>
      </div>

      {/* Explicación Normativa */}
      <Card className="border-[var(--t-border-default)] bg-[var(--t-surface-card)] p-5 text-xs text-[var(--t-text-secondary)] leading-relaxed">
        <div className="flex items-start gap-3">
          <FileLock2 className="h-5 w-5 text-[var(--t-brand)] shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-[var(--t-text-primary)] block mb-1">
              Registro Obligatorio de Informaciones y Conservación Limitada a 10 Años
            </span>
            Conforme al <strong>Artículo 34 de la Ley 2/2023</strong>, la entidad mantiene un libro-registro anonimizado de las comunicaciones recibidas y de las investigaciones a que hayan dado lugar. Los datos personales contenidos en el registro solo se conservarán durante el período imprescindible y, en ningún caso, por un plazo superior a diez años.
          </div>
        </div>
      </Card>

      {/* Controles de Búsqueda y Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="h-3.5 w-3.5 absolute left-3 top-3 text-[var(--t-text-secondary)]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por Nº Registro, expediente o materia..."
              className="w-full pl-9 pr-3 py-2 border border-[var(--t-border-default)] rounded bg-[var(--t-surface-card)] text-[var(--t-text-primary)]"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[var(--t-text-secondary)] font-medium">Categoría:</span>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 border border-[var(--t-border-default)] rounded bg-[var(--t-surface-card)] text-[var(--t-text-primary)]"
          >
            <option value="ALL">Todas las materias</option>
            <option value="Corrupción">Corrupción y Fraude</option>
            <option value="Conflicto">Conflicto de Interés</option>
            <option value="Privacidad">Privacidad y RGPD</option>
            <option value="TIC">Tecnología y DORA</option>
            <option value="Inteligencia">Inteligencia Artificial (AIMS 360)</option>
          </select>
        </div>
      </div>

      {/* Tabla Oficial de Asientos */}
      <Card className="border-[var(--t-border-default)] bg-[var(--t-surface-card)] overflow-hidden">
        <Table className="text-xs">
          <TableHeader>
            <TableRow className="bg-[var(--t-surface-subtle)]">
              <TableHead className="font-bold">Nº Asiento Oficial</TableHead>
              <TableHead className="font-bold">Código Expediente</TableHead>
              <TableHead className="font-bold">Fecha Entrada</TableHead>
              <TableHead className="font-bold">Canal</TableHead>
              <TableHead className="font-bold">Materia / Categoría</TableHead>
              <TableHead className="font-bold">Instructor</TableHead>
              <TableHead className="font-bold">Subexpedientes</TableHead>
              <TableHead className="font-bold">Resultado / Estado</TableHead>
              <TableHead className="font-bold">Límite 10 Años</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEntries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-[var(--t-text-secondary)]">
                  No se encontraron asientos registrados en el Libro-Registro.
                </TableCell>
              </TableRow>
            ) : (
              filteredEntries.map((e) => (
                <TableRow key={e.recordNumber} className="hover:bg-[var(--t-surface-subtle)]/40 transition-colors">
                  <TableCell className="font-mono font-bold text-[var(--t-brand)]">
                    {e.recordNumber}
                  </TableCell>
                  <TableCell className="font-mono">
                    <Link to={`/sii/${e.reportCode}`} className="hover:underline font-semibold">
                      {e.reportCode}
                    </Link>
                  </TableCell>
                  <TableCell>{new Date(e.entryDate).toLocaleDateString("es-ES")}</TableCell>
                  <TableCell className="font-medium">{e.channel.replace(/_/g, " ")}</TableCell>
                  <TableCell className="font-medium text-[var(--t-text-primary)] max-w-xs truncate">
                    {e.category}
                  </TableCell>
                  <TableCell>{e.investigator}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {e.subcasesOpened.map((sub) => (
                        <span key={sub} className="px-1.5 py-0.5 rounded bg-[var(--t-surface-subtle)] text-[10px] font-mono">
                          {sub}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[var(--status-success)]/10 text-[var(--status-success)]">
                      {e.resultOutcome ?? "En tramitación"}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-[10px] text-[var(--t-text-secondary)]">
                    {new Date(e.retentionLimitDate).getFullYear()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
