import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileArchive, Loader2, RotateCcw, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import {
  ANNUAL_ACCOUNTS_COMPONENT_LABELS,
  ANNUAL_ACCOUNTS_COMPONENTS,
  useArchiveAnnualAccountsComponent,
  useAnnualAccountsEvidenceCandidates,
  useAnnualAccountsSetHead,
  useFixAnnualAccountsSet,
  type AnnualAccountsComponentKind,
} from "@/hooks/useAnnualAccountsArtifacts";

const CORE_COMPONENTS: AnnualAccountsComponentKind[] = [
  "BALANCE_SHEET",
  "PROFIT_AND_LOSS_STATEMENT",
  "NOTES",
  "CHANGES_IN_EQUITY_STATEMENT",
];

const MAX_EAD_COMPONENT_BYTES = 15 * 1024 * 1024;

function shortHash(hash: string) {
  return `${hash.slice(0, 12)}…${hash.slice(-8)}`;
}

export function AnnualAccountsArtifactPanel({
  meetingId,
  agendaItemId,
}: {
  meetingId: string;
  agendaItemId: string;
}) {
  const [replaceCurrent, setReplaceCurrent] = useState(false);
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear() - 1);
  const [isConsolidated, setIsConsolidated] = useState(false);
  const [cashFlowApplicable, setCashFlowApplicable] = useState(true);
  const [managementReportApplicable, setManagementReportApplicable] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Partial<Record<AnnualAccountsComponentKind, string>>>({});
  const [pendingFiles, setPendingFiles] = useState<Partial<Record<AnnualAccountsComponentKind, File>>>({});
  const [uploadingKind, setUploadingKind] = useState<AnnualAccountsComponentKind | null>(null);
  const { data: head, isLoading: headLoading } = useAnnualAccountsSetHead(meetingId, agendaItemId);
  const { data: candidates = [], isLoading: candidatesLoading } =
    useAnnualAccountsEvidenceCandidates(meetingId, agendaItemId, fiscalYear);
  const archiveComponent = useArchiveAnnualAccountsComponent();
  const fixSet = useFixAnnualAccountsSet();

  useEffect(() => {
    if (!head || !replaceCurrent) return;
    setFiscalYear(head.fiscal_year);
    setIsConsolidated(head.is_consolidated);
    setCashFlowApplicable(head.cash_flow_statement_applicable);
    setManagementReportApplicable(head.management_report_applicable);
  }, [head, replaceCurrent]);

  const candidatesByKind = useMemo(() => {
    const map = new Map<AnnualAccountsComponentKind, typeof candidates>();
    for (const kind of ANNUAL_ACCOUNTS_COMPONENTS) {
      map.set(kind, candidates.filter((candidate) => candidate.binary.component_kind === kind));
    }
    return map;
  }, [candidates]);

  const visibleKinds = useMemo(() => {
    const result = [...CORE_COMPONENTS];
    if (cashFlowApplicable) result.push("CASH_FLOW_STATEMENT");
    if (managementReportApplicable) result.push("MANAGEMENT_REPORT");
    return result;
  }, [cashFlowApplicable, managementReportApplicable]);

  const selections = useMemo(() => {
    const result: Partial<Record<AnnualAccountsComponentKind, (typeof candidates)[number]>> = {};
    for (const kind of visibleKinds) {
      const selected = candidates.find((candidate) => candidate.id === selectedIds[kind]);
      if (selected) result[kind] = selected;
    }
    return result;
  }, [candidates, selectedIds, visibleKinds]);

  async function handleFixSet() {
    if (visibleKinds.some((kind) => !selections[kind])) {
      toast.error("Selecciona evidencia estructurada para cada componente obligatorio.");
      return;
    }
    try {
      const result = await fixSet.mutateAsync({
        meetingId,
        agendaItemId,
        fiscalYear,
        isConsolidated,
        cashFlowStatementApplicable: cashFlowApplicable,
        managementReportApplicable,
        selections,
        supersedesSetId: replaceCurrent ? head?.id : null,
      });
      setReplaceCurrent(false);
      setSelectedIds({});
      toast.success(
        `Versión ${result.version_number} aprobada para el Consejo e inmovilizada con ${result.component_count} componentes.`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo fijar el conjunto de cuentas.");
    }
  }

  async function handleArchiveComponent(kind: AnnualAccountsComponentKind) {
    const artifact = pendingFiles[kind];
    if (!artifact) {
      toast.error("Selecciona primero el fichero que quieres custodiar.");
      return;
    }
    if (artifact.size > MAX_EAD_COMPONENT_BYTES) {
      toast.error("El fichero supera el límite de 15 MB de Evidence Manager.");
      return;
    }
    setUploadingKind(kind);
    try {
      const result = await archiveComponent.mutateAsync({
        meetingId,
        agendaItemId,
        fiscalYear,
        componentKind: kind,
        artifact,
      });
      setPendingFiles((current) => ({ ...current, [kind]: undefined }));
      setSelectedIds((current) => ({ ...current, [kind]: result.evidenceBundleId }));
      toast.success(
        `${ANNUAL_ACCOUNTS_COMPONENT_LABELS[kind]} custodiado y verificado por EAD Trust Evidence Manager.`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo custodiar el componente en EAD Trust.",
      );
    } finally {
      setUploadingKind(null);
    }
  }

  if (headLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-[var(--g-text-secondary)]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Verificando el conjunto autoritativo de cuentas…
      </div>
    );
  }

  if (head && !replaceCurrent) {
    return (
      <section
        className="border border-[var(--status-success)] bg-[var(--g-sec-100)] p-4"
        style={{ borderRadius: "var(--g-radius-lg)" }}
        aria-label="Conjunto de cuentas anuales fijado"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--status-success)]" />
            <div>
              <p className="text-sm font-semibold text-[var(--g-text-primary)]">
                Cuentas {head.fiscal_year}: versión {head.version_number} aprobada para someter e inmutable
              </p>
              <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
                {head.components.length} componentes vinculados por Evidence Manager · manifiesto {shortHash(head.manifest_hash_sha256)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setReplaceCurrent(true)}
            className="inline-flex items-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-xs font-medium text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] focus:ring-offset-2"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Crear versión sustitutiva
          </button>
        </div>
        <ul className="mt-3 grid gap-2 md:grid-cols-2">
          {head.components.map((component) => (
            <li key={component.id} className="text-xs text-[var(--g-text-secondary)]">
              <span className="font-medium text-[var(--g-text-primary)]">
                {ANNUAL_ACCOUNTS_COMPONENT_LABELS[component.component_kind]}
              </span>{" "}
              · SHA-256 {shortHash(component.content_hash_sha256)} · objeto EAD verificado · versión {shortHash(component.storage_version)}
            </li>
          ))}
        </ul>
        <div
          className="mt-3 flex items-start gap-2 border border-[var(--status-warning)] bg-[var(--g-surface-card)] p-3 text-xs text-[var(--g-text-primary)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-warning)]" aria-hidden="true" />
          <p>
            Esta inmovilización pre-sesión no acredita el cumplimiento del artículo 253.2 LSC.
            Tras la formulación deberá constar la firma de todos los administradores o, para cada
            ausencia, su causa expresa. La custodia EAD no sustituye esa evidencia societaria.
          </p>
        </div>
        <div
          className="mt-3 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-3"
          style={{ borderRadius: "var(--g-radius-md)" }}
          aria-label="Custodia final de cuentas anuales no disponible"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-[var(--g-text-primary)]">
              EAD Trust · Custodia final/e-archiving
            </p>
            <span
              className="bg-[var(--g-surface-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--g-text-secondary)]"
              style={{ borderRadius: "var(--g-radius-sm)" }}
            >
              Pendiente de renderer autoritativo
            </span>
          </div>
          <p className="mt-2 text-xs text-[var(--g-text-secondary)]">
            La aplicación no acepta un PDF o DOCX del navegador como ejecución final ni lo marca
            como FINAL_ARCHIVED. La custodia final permanecerá bloqueada hasta que un binario sea
            generado y registrado de forma autoritativa en servidor.
          </p>
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="mt-3 inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-3 py-2 text-xs font-medium text-[var(--g-text-inverse)] disabled:cursor-not-allowed disabled:opacity-50"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <FileArchive className="h-3.5 w-3.5" aria-hidden="true" />
            Custodia final no disponible
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-muted)] p-4"
      style={{ borderRadius: "var(--g-radius-lg)" }}
      aria-label="Preparar conjunto estructurado de cuentas anuales"
    >
      <div className="flex items-start gap-3">
        <FileArchive className="mt-0.5 h-5 w-5 shrink-0 text-[var(--g-brand-3308)]" />
        <div>
          <p className="text-sm font-semibold text-[var(--g-text-primary)]">
            {replaceCurrent ? "Versión sustitutiva de las cuentas" : "Conjunto autoritativo de cuentas"}
          </p>
          <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
            Archiva cada fichero en Evidence Manager o selecciona un objeto ya custodiado para este punto y ejercicio.
            El sistema usa tipo de componente, identificador de objeto, versión y hashes; nunca el nombre del fichero.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <label className="text-xs font-medium text-[var(--g-text-secondary)]">
          Ejercicio
          <input
            type="number"
            min={1900}
            max={9999}
            value={fiscalYear}
            onChange={(event) => setFiscalYear(Number(event.target.value))}
            className="mt-1 w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] focus:ring-offset-2"
            style={{ borderRadius: "var(--g-radius-md)" }}
          />
        </label>
        <label className="flex items-center gap-2 pt-6 text-xs font-medium text-[var(--g-text-primary)]">
          <input
            type="checkbox"
            checked={isConsolidated}
            onChange={(event) => setIsConsolidated(event.target.checked)}
            className="h-4 w-4 accent-[var(--g-brand-3308)]"
          />
          Cuentas consolidadas
        </label>
        <div className="space-y-2 pt-5">
          <label className="flex items-center gap-2 text-xs font-medium text-[var(--g-text-primary)]">
            <input
              type="checkbox"
              checked={cashFlowApplicable}
              onChange={(event) => setCashFlowApplicable(event.target.checked)}
              className="h-4 w-4 accent-[var(--g-brand-3308)]"
            />
            EFE aplicable
          </label>
          <label className="flex items-center gap-2 text-xs font-medium text-[var(--g-text-primary)]">
            <input
              type="checkbox"
              checked={managementReportApplicable}
              onChange={(event) => setManagementReportApplicable(event.target.checked)}
              className="h-4 w-4 accent-[var(--g-brand-3308)]"
            />
            Informe de gestión aplicable
          </label>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {visibleKinds.map((kind) => {
          const options = candidatesByKind.get(kind) ?? [];
          const selectId = `annual-accounts-${kind}-evidence`;
          const inputId = `annual-accounts-${kind}-upload`;
          const isUploading = uploadingKind === kind;
          return (
            <div
              key={kind}
              className="space-y-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-3"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <label
                htmlFor={selectId}
                className="block text-xs font-medium text-[var(--g-text-secondary)]"
              >
                {ANNUAL_ACCOUNTS_COMPONENT_LABELS[kind]}
              </label>
              <select
                id={selectId}
                value={selectedIds[kind] ?? ""}
                onChange={(event) => setSelectedIds((current) => ({ ...current, [kind]: event.target.value }))}
                aria-invalid={options.length === 0}
                aria-describedby={options.length === 0 ? `annual-accounts-${kind}-error` : undefined}
                className="mt-1 w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] focus:ring-offset-2"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <option value="">Seleccionar evidencia estructurada…</option>
                {options.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.referenceCode ?? candidate.binary.storage_object_id} · v{candidate.binary.storage_version} · {shortHash(candidate.binary.hash_sha256)}
                  </option>
                ))}
              </select>
              {options.length === 0 ? (
                <span id={`annual-accounts-${kind}-error`} className="mt-1 block text-[var(--status-error)]">
                  No hay un objeto custodiado con este tipo y doble hash.
                </span>
              ) : null}
              <label
                htmlFor={inputId}
                className="block text-xs font-medium text-[var(--g-text-secondary)]"
              >
                Fichero nuevo para custodia EAD
              </label>
              <input
                id={inputId}
                type="file"
                accept=".pdf,.docx,.xlsx,.xls,.ods,.csv,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(event) => {
                  const artifact = event.target.files?.[0];
                  if (artifact && artifact.size > MAX_EAD_COMPONENT_BYTES) {
                    event.target.value = "";
                    setPendingFiles((current) => ({ ...current, [kind]: undefined }));
                    toast.error("El fichero supera el límite de 15 MB de Evidence Manager.");
                    return;
                  }
                  setPendingFiles((current) => ({ ...current, [kind]: artifact }));
                }}
                className="block w-full text-xs text-[var(--g-text-secondary)] file:mr-3 file:border file:border-[var(--g-border-subtle)] file:bg-[var(--g-surface-subtle)] file:px-3 file:py-2 file:text-xs file:font-medium file:text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] focus:ring-offset-2"
              />
              <button
                type="button"
                onClick={() => handleArchiveComponent(kind)}
                disabled={!pendingFiles[kind] || archiveComponent.isPending}
                aria-busy={isUploading}
                className="inline-flex min-h-10 items-center gap-2 border border-[var(--g-brand-3308)] bg-[var(--g-surface-card)] px-3 py-2 text-xs font-medium text-[var(--g-brand-3308)] hover:bg-[var(--g-surface-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] focus:ring-offset-2 disabled:opacity-50"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UploadCloud className="h-4 w-4" />
                )}
                Custodiar con EAD Trust
              </button>
              <p className="text-xs text-[var(--g-text-secondary)]">
                Máximo 15 MB. La custodia acredita la interposición y conservación del binario; no afirma una firma.
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleFixSet}
          disabled={
            candidatesLoading ||
            fixSet.isPending ||
            visibleKinds.some((kind) => !selections[kind])
          }
          aria-busy={fixSet.isPending}
          className="inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] focus:ring-offset-2 disabled:opacity-50"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          {fixSet.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileArchive className="h-4 w-4" />}
          Aprobar para someter e inmovilizar
        </button>
        {replaceCurrent ? (
          <button
            type="button"
            onClick={() => setReplaceCurrent(false)}
            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-4 py-2 text-sm text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] focus:ring-offset-2"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Cancelar sustitución
          </button>
        ) : null}
      </div>
      <div
        className="mt-3 flex items-start gap-2 border border-[var(--status-warning)] bg-[var(--g-surface-card)] p-3 text-xs text-[var(--g-text-primary)]"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-warning)]" aria-hidden="true" />
        <p>
          Este paso fija el conjunto que se someterá al Consejo. No acredita todavía la firma de
          todos los administradores exigida por el artículo 253.2 LSC ni las causas de las firmas
          ausentes; ambas evidencias deben cerrarse después de la formulación.
        </p>
      </div>
    </section>
  );
}
