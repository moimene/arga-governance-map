/**
 * TemplateImportWizard — wizard de 5 pasos para importar plantillas JSON.
 *
 * Sprint 1 — Commit 6 (Task 6.5). Spec §6.3.
 *
 * Pasos:
 *  1. Descargar base — link al fichero estático `plantilla-base-
 *     importacion.v1.json` + botón "Saltar" para usuarios expertos.
 *  2. Subir JSON — file input. Al parsear con `JSON.parse` y `parseImport`
 *     se muestran los errores línea/columna del ZodError. Si OK avanza al
 *     paso 3.
 *  3. Preflight — botón "Ejecutar preflight" invoca `useTemplatePreflight`.
 *     Si hay BLOCKING se muestran issues sin escribir. Si hay WARNING se
 *     avanza al paso 4 para reconocerlas. Si todo OK se avanza al paso 5.
 *  4. Reconocer warnings (solo si `summary.warning > 0 && blocking === 0`):
 *     textarea ≥20 chars. Al pulsar Continuar se avanza al paso 5.
 *  5. Crear borrador — invoca `useImportPlantillaPackage` como commit
 *     explícito. Re-ejecuta preflight defensivo y escribe changelog.
 *
 * Tokens Garrigues estrictos; sin emojis; ARIA-labels en botones icon-only.
 */

import { useState } from "react";
import { Upload, AlertTriangle, CheckCircle2, Loader2, Download } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useImportPlantillaPackage } from "@/hooks/secretaria/useImportPlantillaPackage";
import { useTemplatePreflight } from "@/hooks/secretaria/useTemplatePreflight";
import { parseImport } from "@/lib/secretaria/template-admin/template-importer";
import { mapSchemaIssues, type SchemaIssue } from "@/lib/secretaria/template-admin/schema-issue-mapper";
import type { GatePreResult } from "@/lib/secretaria/template-admin/types";
import { mergeUrlSearchParams } from "@/lib/secretaria/template-configuration-routing";

type Step = 1 | 2 | 3 | 4 | 5;

const STEP_LABELS: Record<Step, string> = {
  1: "Descargar base",
  2: "Subir JSON",
  3: "Comprobación previa",
  4: "Revisar advertencias",
  5: "Crear borrador",
};

export function TemplateImportWizard() {
  const [step, setStep] = useState<Step>(1);
  const [json, setJson] = useState<unknown>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [schemaIssues, setSchemaIssues] = useState<SchemaIssue[] | null>(null);
  const [gatePre, setGatePre] = useState<GatePreResult | null>(null);
  const [ack, setAck] = useState("");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preflightMut = useTemplatePreflight();
  const importMut = useImportPlantillaPackage();

  function onFile(file: File) {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        setJson(parsed);
        setGatePre(null);
        // Parse local rápido para detectar errores de schema antes del
        // preflight (que requiere ida a Cloud para Gate PRE contexto).
        const r = parseImport(parsed);
        if (!r.ok) {
          setSchemaIssues(
            mapSchemaIssues((r as { ok: false; error: { issues: unknown[] } }).error.issues),
          );
        } else {
          setSchemaIssues(null);
          setStep(3);
        }
      } catch (e) {
        setSchemaIssues([
          {
            code: "(fichero)",
            message: "El fichero no es JSON válido y no se pudo leer.",
            hint: e instanceof Error ? e.message : "Revisa que sea un .json bien formado.",
          },
        ]);
      }
    };
    reader.readAsText(file);
  }

  async function runPreflight() {
    setGatePre(null);
    const result = await preflightMut.mutateAsync({ json });
    // Narrowing manual del discriminated union (strictNullChecks=false):
    // TS no estrecha de forma fiable, así que tipeamos cada rama.
    if (result.ok) {
      const ok = result as { ok: true; gatePre: GatePreResult };
      setGatePre(ok.gatePre);
      if (ok.gatePre.summary.warning > 0) {
        setStep(4);
        return;
      }
      setStep(5);
      return;
    }
    const fail = result as
      | { ok: false; reason: "PARSE_FAILED"; details: unknown }
      | { ok: false; reason: "GATE_PRE_BLOCKING"; gatePre: GatePreResult }
      | { ok: false; reason: "WARNINGS_NEED_ACK"; gatePre: GatePreResult }
      | { ok: false; reason: "INSERT_FAILED"; details: unknown };
    if (fail.reason === "PARSE_FAILED") {
      setSchemaIssues(mapSchemaIssues(fail.details));
      setStep(2);
      toast.error("Estructura no válida: revisa el archivo JSON");
    } else if (fail.reason === "GATE_PRE_BLOCKING") {
      setGatePre(fail.gatePre);
      toast.error("Comprobación documental bloqueante: corrige las incidencias antes de continuar");
    } else if (fail.reason === "WARNINGS_NEED_ACK") {
      setGatePre(fail.gatePre);
      setStep(4);
    } else if (fail.reason === "INSERT_FAILED") {
      // ITEM-075: incluir el detalle del error (antes se descartaba fail.details).
      toast.error("Error al insertar el borrador", {
        description:
          fail.details instanceof Error
            ? fail.details.message
            : typeof fail.details === "string"
              ? fail.details
              : fail.details
                ? JSON.stringify(fail.details)
                : undefined,
      });
    }
  }

  async function createDraft() {
    const result = await importMut.mutateAsync({
      json,
      ackMotivo: ack.length >= 20 ? ack : undefined,
    });
    if (result.ok) {
      const ok = result as { ok: true; plantillaId: string; gatePre: GatePreResult };
      setGatePre(ok.gatePre);
      toast.success("Borrador creado correctamente");
      navigate(
        mergeUrlSearchParams(
          `/secretaria/gestor-plantillas?tab=catalogo&plantilla=${ok.plantillaId}&estado=BORRADOR`,
          searchParams,
        ),
      );
      return;
    }

    const fail = result as
      | { ok: false; reason: "PARSE_FAILED"; details: unknown }
      | { ok: false; reason: "GATE_PRE_BLOCKING"; gatePre: GatePreResult }
      | { ok: false; reason: "WARNINGS_NEED_ACK"; gatePre: GatePreResult }
      | { ok: false; reason: "INSERT_FAILED"; details: unknown };
    if (fail.reason === "PARSE_FAILED") {
      setSchemaIssues(mapSchemaIssues(fail.details));
      setStep(2);
      toast.error("Estructura no válida: revisa el archivo JSON");
    } else if (fail.reason === "GATE_PRE_BLOCKING") {
      setGatePre(fail.gatePre);
      setStep(3);
      toast.error("Comprobación documental bloqueante: corrige las incidencias antes de continuar");
    } else if (fail.reason === "WARNINGS_NEED_ACK") {
      setGatePre(fail.gatePre);
      setStep(4);
    } else if (fail.reason === "INSERT_FAILED") {
      // ITEM-075: incluir el detalle del error (antes se descartaba fail.details).
      toast.error("Error al insertar el borrador", {
        description:
          fail.details instanceof Error
            ? fail.details.message
            : typeof fail.details === "string"
              ? fail.details
              : fail.details
                ? JSON.stringify(fail.details)
                : undefined,
      });
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <nav aria-label="Pasos del wizard">
        <ol className="flex flex-wrap items-center gap-3 text-sm">
          {([1, 2, 3, 4, 5] as Step[]).map((n) => (
            <li
              key={n}
              className={
                n === step
                  ? "font-semibold text-[var(--g-brand-3308)]"
                  : "text-[var(--g-text-secondary)]"
              }
              aria-current={n === step ? "step" : undefined}
            >
              <span aria-hidden="true">{n}/5</span>{" "}
              <span className="hidden sm:inline">— {STEP_LABELS[n]}</span>
            </li>
          ))}
        </ol>
      </nav>

      {step === 1 && (
        <section
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-6"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <h2 className="mb-3 text-lg font-semibold text-[var(--g-text-primary)]">
            1. Descargar plantilla base
          </h2>
          <p className="mb-4 text-sm text-[var(--g-text-secondary)]">
            Empieza con un paquete v1 válido y modifícalo a tu materia. El JSON
            descargable ya cumple la estructura y la comprobación documental previa
            en un entorno vacío.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="/templates/secretaria/plantilla-base-importacion.v1.json"
              download="plantilla-base-importacion.v1.json"
              className="inline-flex min-h-11 items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--g-surface-card)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <Download className="h-4 w-4" aria-hidden="true" /> Descargar base v1.json
            </a>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-[var(--g-link)] underline hover:text-[var(--g-link-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--g-surface-card)]"
            >
              Saltar a subir
            </button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-6"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <h2 className="mb-3 text-lg font-semibold text-[var(--g-text-primary)]">
            2. Subir JSON
          </h2>
          <p className="mb-4 text-sm text-[var(--g-text-secondary)]">
            Selecciona el fichero JSON con el paquete v1. Su estructura se comprueba
            localmente antes de consultar las reglas documentales.
          </p>
          <label className="block">
            <span className="sr-only">Archivo JSON</span>
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
              aria-label="Subir paquete JSON"
              className="block min-h-11 w-full text-sm text-[var(--g-text-primary)] file:mr-3 file:min-h-11 file:cursor-pointer file:border-0 file:bg-[var(--g-surface-subtle)] file:px-3 file:py-2 file:text-sm file:font-medium file:text-[var(--g-text-primary)] hover:file:bg-[var(--g-sec-100)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--g-surface-card)]"
            />
          </label>
          {fileName && (
            <p className="mt-3 text-xs text-[var(--g-text-secondary)]">
              Archivo seleccionado: <code className="font-mono">{fileName}</code>
            </p>
          )}
          {schemaIssues && schemaIssues.length > 0 && (
            <div className="mt-4 space-y-2" aria-label="Errores de validación del paquete">
              <p className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">
                {schemaIssues.length}{" "}
                {schemaIssues.length === 1 ? "error de estructura" : "errores de estructura"} a corregir
              </p>
              {schemaIssues.map((i, idx) => (
                <div
                  key={`${i.code}-${idx}`}
                  className="flex gap-2 border border-[var(--status-error)] bg-[var(--status-error)]/10 p-3 text-sm text-[var(--g-text-primary)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="flex-1">
                    <strong className="font-mono text-xs text-[var(--g-text-primary)]">
                      {i.code}
                    </strong>{" "}
                    <span className="text-[var(--g-text-secondary)]">— {i.message}</span>
                    {i.hint && (
                      <p className="mt-1 text-xs text-[var(--g-text-secondary)]">{i.hint}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {step === 3 && (
        <section
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-6"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <h2 className="mb-3 text-lg font-semibold text-[var(--g-text-primary)]">
            3. Comprobación documental previa (Gate PRE)
          </h2>
          <p className="mb-4 text-sm text-[var(--g-text-secondary)]">
            Detecta plantillas activas equivalentes, fuentes no registradas y
            expresiones no permitidas. No modifica datos hasta el paso 5.
          </p>
          {schemaIssues && schemaIssues.length > 0 && (
            <div
              className="mb-4 border border-[var(--status-error)] bg-[var(--status-error)]/10 p-3 text-sm text-[var(--g-text-primary)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              La estructura del JSON no es válida. Vuelve al paso 2 y corrige los errores
              antes de continuar.
            </div>
          )}
          <button
            type="button"
            onClick={() => runPreflight()}
            disabled={preflightMut.isPending || !!(schemaIssues && schemaIssues.length) || !json}
            className="inline-flex min-h-11 items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--g-surface-card)] disabled:cursor-not-allowed disabled:opacity-50"
            style={{ borderRadius: "var(--g-radius-md)" }}
            aria-busy={preflightMut.isPending}
          >
            {preflightMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            )}
            Ejecutar comprobación
          </button>
          {gatePre && (
            <div className="mt-5 space-y-2" aria-label="Resultado de la comprobación documental previa">
              <p className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">
                {gatePre.summary.blocking} bloqueantes · {gatePre.summary.warning}{" "}
                advertencias · {gatePre.summary.info} informativas
              </p>
              {gatePre.issues.map((i, idx) => (
                <div
                  key={`${i.code}-${idx}`}
                  className={`flex gap-2 border p-3 text-sm ${
                    i.severity === "BLOCKING"
                      ? "border-[var(--status-error)] bg-[var(--status-error)]/10 text-[var(--g-text-primary)]"
                      : i.severity === "WARNING"
                      ? "border-[var(--status-warning)] bg-[var(--status-warning)]/10 text-[var(--g-text-primary)]"
                      : "border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] text-[var(--g-text-secondary)]"
                  }`}
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <AlertTriangle
                    className="h-4 w-4 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <div className="flex-1">
                    <strong className="text-[var(--g-text-primary)]">{i.code}</strong>{" "}
                    <span className="text-[var(--g-text-secondary)]">— {i.message}</span>
                    {i.hint && (
                      <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
                        {i.hint}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {step === 4 && (
        <section
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-6"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <h2 className="mb-3 text-lg font-semibold text-[var(--g-text-primary)]">
            4. Revisar advertencias
          </h2>
          <p className="mb-4 text-sm text-[var(--g-text-secondary)]">
            La comprobación detectó advertencias no bloqueantes. Para crear el
            borrador, confirma su revisión con un motivo de al menos 20 caracteres;
            quedará registrado en el historial como evidencia documental.
          </p>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-[var(--g-text-primary)]">
              Motivo (≥20 caracteres)
            </span>
            <textarea
              value={ack}
              onChange={(e) => setAck(e.target.value)}
              placeholder="P. ej.: Advertencias revisadas con el Comité Legal; se acepta importar sin cambios."
              className="w-full border border-[var(--g-border-default)] bg-[var(--g-surface-card)] p-3 text-sm text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)] focus:border-[var(--g-border-focus)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] focus:ring-offset-2 focus:ring-offset-[var(--g-surface-card)]"
              rows={4}
              aria-describedby="ack-help"
              aria-invalid={ack.length > 0 && ack.length < 20 ? "true" : undefined}
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
            <p
              id="ack-help"
              className="mt-1 text-xs text-[var(--g-text-secondary)]"
            >
              {ack.length}/20 caracteres mínimos
            </p>
          </label>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setStep(5)}
              disabled={ack.length < 20}
              className="inline-flex min-h-11 items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--g-surface-card)] disabled:cursor-not-allowed disabled:opacity-50"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              Continuar
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="min-h-11 px-4 py-2 text-sm font-medium text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--g-surface-card)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              Volver a la comprobación
            </button>
          </div>
        </section>
      )}

      {step === 5 && (
        <section
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-6"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <h2 className="mb-3 text-lg font-semibold text-[var(--g-text-primary)]">
            5. Crear borrador
          </h2>
          <p className="mb-4 text-sm text-[var(--g-text-secondary)]">
            La comprobación no tiene incidencias bloqueantes. Al crear el borrador
            se repite la validación y se registra la importación en auditoría.
          </p>
          {gatePre && (
            <p className="mb-4 text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">
              {gatePre.summary.blocking} bloqueantes · {gatePre.summary.warning}{" "}
              advertencias · {gatePre.summary.info} informativas
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={createDraft}
              disabled={importMut.isPending || !json}
              className="inline-flex min-h-11 items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--g-surface-card)] disabled:cursor-not-allowed disabled:opacity-50"
              style={{ borderRadius: "var(--g-radius-md)" }}
              aria-busy={importMut.isPending}
            >
              {importMut.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              Crear borrador
            </button>
            <button
              type="button"
              onClick={() => setStep(gatePre?.summary.warning ? 4 : 3)}
              className="min-h-11 px-4 py-2 text-sm font-medium text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--g-surface-card)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              Volver
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
