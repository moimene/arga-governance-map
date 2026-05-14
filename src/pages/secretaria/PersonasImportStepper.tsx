import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, FileSpreadsheet, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import { useAsignarCargo } from "@/hooks/useCondicionesPersonaMutations";
import { useImportPersonaRow, type PersonType } from "@/hooks/usePersonasCanonical";
import { CARGO_LABELS, type FuenteDesignacion, type TipoCondicion } from "@/hooks/useCargos";
import { requiresBodyId } from "@/lib/secretaria/cargo-validation";

type ImportStatus = "valid" | "existing" | "error" | "applied";

interface ParsedPersonRow {
  rowNumber: number;
  full_name: string;
  person_type: PersonType | "";
  tax_id: string;
  email: string;
  denomination: string;
  tipo_condicion: TipoCondicion | "";
  entity_id: string;
  body_id: string;
  fecha_inicio: string;
  fuente_designacion: FuenteDesignacion | "";
  status: ImportStatus;
  messages: string[];
}

const HEADER_ALIASES = {
  full_name: ["full_name", "nombre", "nombre_completo", "persona", "razon_social"],
  person_type: ["person_type", "tipo_persona", "tipo", "pf_pj"],
  tax_id: ["tax_id", "nif", "cif", "documento", "documento_fiscal"],
  email: ["email", "correo", "correo_electronico"],
  denomination: ["denomination", "denominacion", "razon_social"],
  tipo_condicion: ["tipo_condicion", "cargo", "rol"],
  entity_id: ["entity_id", "sociedad_id"],
  body_id: ["body_id", "organo_id"],
  fecha_inicio: ["fecha_inicio", "inicio", "fecha"],
  fuente_designacion: ["fuente_designacion", "fuente", "origen"],
} as const;

function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function asCell(value: unknown) {
  if (value == null) return "";
  return String(value).trim();
}

function pick(row: Record<string, unknown>, aliases: readonly string[]) {
  for (const alias of aliases) {
    const value = row[alias];
    if (asCell(value)) return asCell(value);
  }
  return "";
}

function normalizePersonType(value: string): PersonType | "" {
  const v = value.trim().toUpperCase();
  if (v === "PF" || v.includes("FISICA") || v.includes("FÍSICA")) return "PF";
  if (v === "PJ" || v.includes("JURIDICA") || v.includes("JURÍDICA")) return "PJ";
  return "";
}

function normalizeCargo(value: string): TipoCondicion | "" {
  const v = normalizeHeader(value);
  const aliasMap: Record<string, TipoCondicion> = {
    administrador_unico: "ADMIN_UNICO",
    admin_unico: "ADMIN_UNICO",
    administrador_solidario: "ADMIN_SOLIDARIO",
    admin_solidario: "ADMIN_SOLIDARIO",
    administrador_mancomunado: "ADMIN_MANCOMUNADO",
    admin_mancomunado: "ADMIN_MANCOMUNADO",
    administrador_persona_juridica: "ADMIN_PJ",
    administrador_pj: "ADMIN_PJ",
    admin_pj: "ADMIN_PJ",
  };
  if (aliasMap[v]) return aliasMap[v];
  const match = (Object.keys(CARGO_LABELS) as TipoCondicion[]).find((cargo) => {
    return normalizeHeader(cargo) === v || normalizeHeader(CARGO_LABELS[cargo]) === v;
  });
  return match ?? "";
}

function normalizeFuente(value: string): FuenteDesignacion | "" {
  const v = normalizeHeader(value).toUpperCase();
  if (v === "ACTA_NOMBRAMIENTO" || v.includes("ACTA")) return "ACTA_NOMBRAMIENTO";
  if (v === "ESCRITURA") return "ESCRITURA";
  if (v === "DECISION_UNIPERSONAL" || v.includes("UNIPERSONAL")) return "DECISION_UNIPERSONAL";
  if (v === "BOOTSTRAP") return "BOOTSTRAP";
  return "";
}

function parseDelimited(text: string): Record<string, unknown>[] {
  const rows: string[][] = [];
  let cell = "";
  let current: string[] = [];
  let quoted = false;
  const delimiter = text.split(/\r?\n/, 1)[0]?.includes(";") ? ";" : ",";

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      current.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      current.push(cell);
      if (current.some((value) => value.trim())) rows.push(current);
      current = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  current.push(cell);
  if (current.some((value) => value.trim())) rows.push(current);

  const [headers, ...body] = rows;
  if (!headers) return [];
  const normalized = headers.map(normalizeHeader);
  return body.map((row) =>
    normalized.reduce<Record<string, unknown>>((acc, key, index) => {
      acc[key] = row[index] ?? "";
      return acc;
    }, {}),
  );
}

async function parseFile(file: File): Promise<Record<string, unknown>[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const XLSX = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    return rows.map((row) =>
      Object.entries(row).reduce<Record<string, unknown>>((acc, [key, value]) => {
        acc[normalizeHeader(key)] = value;
        return acc;
      }, {}),
    );
  }
  return parseDelimited(await file.text());
}

export default function PersonasImportStepper() {
  const navigate = useNavigate();
  const { tenantId } = useTenantContext();
  const importPersona = useImportPersonaRow();
  const asignarCargo = useAsignarCargo();
  const [rows, setRows] = useState<ParsedPersonRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const stats = useMemo(() => {
    const errors = rows.filter((row) => row.status === "error").length;
    const existing = rows.filter((row) => row.status === "existing").length;
    const applied = rows.filter((row) => row.status === "applied").length;
    return { errors, existing, applied, ready: rows.length - errors - applied };
  }, [rows]);

  const loadFile = async (file: File | null) => {
    if (!file || !tenantId) return;
    setIsParsing(true);
    setFileName(file.name);
    try {
      const raw = await parseFile(file);
      const taxIds = raw
        .map((row) => pick(row, HEADER_ALIASES.tax_id))
        .filter(Boolean);
      const duplicatedTaxIds = new Set(
        taxIds.filter((taxId, index) => taxIds.indexOf(taxId) !== index),
      );
      const { data: existing, error } = taxIds.length
        ? await supabase
            .from("persons")
            .select("id, tax_id")
            .eq("tenant_id", tenantId)
            .in("tax_id", Array.from(new Set(taxIds)))
        : { data: [], error: null };
      if (error) throw error;
      const existingTaxIds = new Set(((existing ?? []) as Array<{ tax_id: string | null }>).map((p) => p.tax_id).filter(Boolean));

      const parsed = raw.map<ParsedPersonRow>((row, index) => {
        const fullName = pick(row, HEADER_ALIASES.full_name);
        const personType = normalizePersonType(pick(row, HEADER_ALIASES.person_type));
        const taxId = pick(row, HEADER_ALIASES.tax_id);
        const tipoCondicion = normalizeCargo(pick(row, HEADER_ALIASES.tipo_condicion));
        const bodyId = pick(row, HEADER_ALIASES.body_id);
        const entityId = pick(row, HEADER_ALIASES.entity_id);
        const fechaInicio = pick(row, HEADER_ALIASES.fecha_inicio);
        const fuente = normalizeFuente(pick(row, HEADER_ALIASES.fuente_designacion)) || "ACTA_NOMBRAMIENTO";
        const messages: string[] = [];

        if (!fullName) messages.push("Nombre obligatorio");
        if (!personType) messages.push("Tipo PF/PJ obligatorio");
        if (taxId && duplicatedTaxIds.has(taxId)) messages.push("Documento fiscal duplicado en el fichero");
        if (tipoCondicion) {
          if (!entityId) messages.push("El cargo requiere sociedad_id");
          if (!fechaInicio) messages.push("El cargo requiere fecha_inicio");
          if (requiresBodyId(tipoCondicion) && !bodyId) messages.push("El cargo requiere organo_id");
          if (!requiresBodyId(tipoCondicion) && bodyId) messages.push("El cargo no admite organo_id");
        }

        const status: ImportStatus = messages.length > 0 ? "error" : existingTaxIds.has(taxId) ? "existing" : "valid";
        return {
          rowNumber: index + 2,
          full_name: fullName,
          person_type: personType,
          tax_id: taxId,
          email: pick(row, HEADER_ALIASES.email),
          denomination: pick(row, HEADER_ALIASES.denomination),
          tipo_condicion: tipoCondicion,
          entity_id: entityId,
          body_id: bodyId,
          fecha_inicio: fechaInicio,
          fuente_designacion: fuente,
          status,
          messages,
        };
      });
      setRows(parsed);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo leer el fichero";
      toast.error(message);
    } finally {
      setIsParsing(false);
    }
  };

  const applyRows = async () => {
    setIsApplying(true);
    try {
      const next = [...rows];
      for (let index = 0; index < next.length; index += 1) {
        const row = next[index];
        if (row.status === "error" || row.status === "applied") continue;

        const person = await importPersona.mutateAsync({
          full_name: row.full_name,
          person_type: row.person_type as PersonType,
          tax_id: row.tax_id || null,
          email: row.email || null,
          denomination: row.denomination || null,
          row_key: `${fileName}:${row.rowNumber}`,
        });

        if (row.tipo_condicion && row.entity_id && row.fecha_inicio) {
          await asignarCargo.mutateAsync({
            person_id: person.id,
            entity_id: row.entity_id,
            body_id: row.body_id || null,
            tipo_condicion: row.tipo_condicion,
            fecha_inicio: row.fecha_inicio,
            fuente_designacion: (row.fuente_designacion || "ACTA_NOMBRAMIENTO") as FuenteDesignacion,
          });
        }

        next[index] = { ...row, status: "applied", messages: ["Aplicada"] };
        setRows([...next]);
      }
      toast.success("Importación aplicada");
      navigate("/secretaria/personas");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo aplicar la importación";
      toast.error(message);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1280px] p-4 sm:p-6">
      <Link
        to="/secretaria/personas"
        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--g-brand-3308)] hover:text-[var(--g-sec-700)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a personas
      </Link>

      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Secretaría · Personas y cargos
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
            Importar personas
          </h1>
          <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
            Carga controlada de personas físicas o jurídicas, con alta opcional de cargo.
          </p>
        </div>
        <label
          className="inline-flex cursor-pointer items-center justify-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-4 py-2 text-sm font-semibold text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <Upload className="h-4 w-4" />
          Seleccionar fichero
          <input
            type="file"
            accept=".csv,.tsv,.txt,.xlsx,.xls,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="sr-only"
            onChange={(event) => loadFile(event.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      <section
        className="mb-4 grid gap-3 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4 sm:grid-cols-4"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <Metric label="Fichero" value={fileName || "Pendiente"} />
        <Metric label="Filas listas" value={String(stats.ready)} />
        <Metric label="Ya existentes" value={String(stats.existing)} />
        <Metric label="Errores" value={String(stats.errors)} />
      </section>

      <div
        className="overflow-hidden border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <table className="w-full">
          <thead>
            <tr className="bg-[var(--g-surface-subtle)]">
              {["Fila", "Persona", "Tipo", "Documento", "Cargo", "Estado"].map((header) => (
                <th key={header} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--g-border-subtle)]">
            {isParsing ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-[var(--g-text-secondary)]">
                  Leyendo fichero...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-[var(--g-text-secondary)]">
                  Sin fichero cargado.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.rowNumber} className="align-top hover:bg-[var(--g-surface-subtle)]/50">
                  <td className="px-4 py-3 text-sm text-[var(--g-text-secondary)]">{row.rowNumber}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-[var(--g-text-primary)]">{row.full_name || "—"}</td>
                  <td className="px-4 py-3 text-sm text-[var(--g-text-secondary)]">{row.person_type || "—"}</td>
                  <td className="px-4 py-3 text-sm text-[var(--g-text-secondary)]">{row.tax_id || "—"}</td>
                  <td className="px-4 py-3 text-sm text-[var(--g-text-secondary)]">
                    {row.tipo_condicion ? CARGO_LABELS[row.tipo_condicion] : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <StatusChip row={row} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <button
          type="button"
          onClick={applyRows}
          disabled={rows.length === 0 || stats.errors > 0 || stats.ready === 0 || isApplying}
          aria-busy={isApplying}
          className="inline-flex items-center justify-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-semibold text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:pointer-events-none disabled:opacity-50"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <CheckCircle2 className="h-4 w-4" />
          Aplicar importación
        </button>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium text-[var(--g-text-secondary)]">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold text-[var(--g-text-primary)]">{value}</div>
    </div>
  );
}

function StatusChip({ row }: { row: ParsedPersonRow }) {
  if (row.status === "applied") {
    return (
      <span className="inline-flex rounded-full bg-[var(--status-success)] px-2 py-0.5 text-xs font-semibold text-[var(--g-text-inverse)]">
        Aplicada
      </span>
    );
  }
  if (row.status === "existing") {
    return (
      <span className="inline-flex rounded-full bg-[var(--status-info)] px-2 py-0.5 text-xs font-semibold text-[var(--g-text-inverse)]">
        Existente
      </span>
    );
  }
  if (row.status === "error") {
    return (
      <span className="inline-flex rounded-full bg-[var(--status-error)] px-2 py-0.5 text-xs font-semibold text-[var(--g-text-inverse)]">
        {row.messages.join(" · ")}
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-[var(--status-success)] px-2 py-0.5 text-xs font-semibold text-[var(--g-text-inverse)]">
      Lista
    </span>
  );
}
