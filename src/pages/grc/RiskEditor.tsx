import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Activity, ChevronLeft, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useCreateRisk, useRiskById, useUpdateRisk, type RiskWriteInput } from "@/hooks/useRisks";

type FormState = {
  code: string;
  title: string;
  description: string;
  module_id: string;
  status: string;
  probability: number;
  impact: number;
};

const INPUT_CLASSES =
  "h-10 w-full px-3 text-sm bg-[var(--g-surface-card)] text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)]/60 border border-[var(--g-border-subtle)] focus:border-[var(--g-brand-3308)] focus:outline-none transition-colors";

const TEXTAREA_CLASSES =
  "w-full px-3 py-2 text-sm bg-[var(--g-surface-card)] text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)]/60 border border-[var(--g-border-subtle)] focus:border-[var(--g-brand-3308)] focus:outline-none transition-colors resize-none";

const SELECT_CLASSES =
  "h-10 w-full px-3 text-sm bg-[var(--g-surface-card)] text-[var(--g-text-primary)] border border-[var(--g-border-subtle)] focus:border-[var(--g-brand-3308)] focus:outline-none transition-colors";

const LABEL_CLASSES = "block text-sm font-medium text-[var(--g-text-primary)] mb-1";

const MODULE_OPTIONS = [
  { value: "dora", label: "DORA" },
  { value: "gdpr", label: "GDPR" },
  { value: "cyber", label: "Cyber" },
  { value: "audit", label: "Auditoría" },
  { value: "penal", label: "Penal / Anticorrupción" },
];

const BASE_STATUS_OPTIONS = ["Abierto", "En tratamiento"];

const emptyToNull = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const defaultCode = () => {
  const timestamp = new Date()
    .toISOString()
    .slice(2, 19)
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace("T", "");
  const suffix = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `RISK-${timestamp}-${suffix}`;
};

export default function RiskEditor() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialModule = params.get("module") ?? "gdpr";
  const { data: risk, isLoading } = useRiskById(id);
  const createRisk = useCreateRisk();
  const updateRisk = useUpdateRisk(id);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState<FormState>({
    code: defaultCode(),
    title: "",
    description: "",
    module_id: initialModule,
    status: "Abierto",
    probability: 3,
    impact: 3,
  });

  useEffect(() => {
    if (!risk) return;
    setForm({
      code: risk.code,
      title: risk.title,
      description: risk.description ?? "",
      module_id: risk.module_id ?? "gdpr",
      status: risk.status ?? "Abierto",
      probability: risk.probability ?? 3,
      impact: risk.impact ?? 3,
    });
  }, [risk]);

  const errors = useMemo(() => {
    if (!submitted) return { code: "", title: "" };
    return {
      code: form.code.trim().length < 3 ? "El código debe tener al menos 3 caracteres." : "",
      title: form.title.trim().length < 3 ? "El título debe tener al menos 3 caracteres." : "",
    };
  }, [form.code, form.title, submitted]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);

    if (form.code.trim().length < 3 || form.title.trim().length < 3) {
      toast.error("Revisa los campos obligatorios.");
      return;
    }

    const input: RiskWriteInput = {
      code: form.code.trim(),
      title: form.title.trim(),
      description: emptyToNull(form.description),
      module_id: form.module_id,
      status: form.status,
      probability: form.probability,
      impact: form.impact,
    };

    try {
      if (isEdit) {
        await updateRisk.mutateAsync(input);
        toast.success("Riesgo actualizado en GRC.");
      } else {
        await createRisk.mutateAsync(input);
        toast.success("Riesgo creado en GRC.");
      }
      navigate("/grc/risk-360");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`No se pudo guardar el riesgo: ${message}`);
    }
  };

  const isSaving = createRisk.isPending || updateRisk.isPending;
  const inherentPreview = form.probability * form.impact;
  const statusOptions = BASE_STATUS_OPTIONS.includes(form.status)
    ? BASE_STATUS_OPTIONS
    : [...BASE_STATUS_OPTIONS, form.status];

  if (isEdit && isLoading) {
    return (
      <div className="p-6 max-w-[920px] mx-auto space-y-4">
        {[1, 2, 3].map((item) => (
          <div key={item} className="skeleton h-24" style={{ borderRadius: "var(--g-radius-lg)" }} />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[920px] mx-auto">
      <button
        type="button"
        onClick={() => navigate("/grc/risk-360")}
        className="mb-4 flex items-center gap-1.5 text-sm text-[var(--g-text-secondary)] transition-colors hover:text-[var(--g-brand-3308)]"
      >
        <ChevronLeft className="h-4 w-4" />
        Risk 360
      </button>

      <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Activity className="h-5 w-5 text-[var(--g-brand-3308)]" />
            <h1 className="text-xl font-bold text-[var(--g-text-primary)]">
              {isEdit ? "Editar riesgo" : "Nuevo riesgo"}
            </h1>
          </div>
          <p className="text-sm text-[var(--g-text-secondary)]">
            Registro owner de GRC sobre risks; no crea actos Secretaría ni registros AIMS.
          </p>
        </div>
        <div
          className="inline-flex items-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-3 py-2 text-xs font-semibold text-[var(--g-text-primary)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <ShieldCheck className="h-4 w-4 text-[var(--g-brand-3308)]" />
          legacy_write · risks
        </div>
      </header>

      <form
        onSubmit={handleSubmit}
        className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="border-b border-[var(--g-border-subtle)] px-6 py-4">
          <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
            Identificación, módulo y valoración
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-5 p-6 md:grid-cols-2">
          <div>
            <label htmlFor="grc-risk-code" className={LABEL_CLASSES}>
              Código *
            </label>
            <input
              id="grc-risk-code"
              type="text"
              value={form.code}
              onChange={(event) => set("code", event.target.value)}
              aria-invalid={!!errors.code}
              aria-describedby={errors.code ? "grc-risk-code-error" : undefined}
              className={INPUT_CLASSES}
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
            {errors.code && (
              <p id="grc-risk-code-error" className="mt-1 text-xs text-[var(--status-error)]">
                {errors.code}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="grc-risk-module" className={LABEL_CLASSES}>
              Módulo GRC
            </label>
            <select
              id="grc-risk-module"
              value={form.module_id}
              onChange={(event) => set("module_id", event.target.value)}
              className={SELECT_CLASSES}
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              {MODULE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="grc-risk-title" className={LABEL_CLASSES}>
              Título *
            </label>
            <input
              id="grc-risk-title"
              type="text"
              value={form.title}
              onChange={(event) => set("title", event.target.value)}
              placeholder="Ej. Incumplimiento de control clave de privacidad"
              aria-invalid={!!errors.title}
              aria-describedby={errors.title ? "grc-risk-title-error" : undefined}
              className={INPUT_CLASSES}
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
            {errors.title && (
              <p id="grc-risk-title-error" className="mt-1 text-xs text-[var(--status-error)]">
                {errors.title}
              </p>
            )}
          </div>

          <div className="md:col-span-2">
            <label htmlFor="grc-risk-description" className={LABEL_CLASSES}>
              Descripción
            </label>
            <textarea
              id="grc-risk-description"
              value={form.description}
              onChange={(event) => set("description", event.target.value)}
              placeholder="Contexto, causa, alcance y controles asociados"
              rows={4}
              className={TEXTAREA_CLASSES}
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
          </div>

          <div>
            <label htmlFor="grc-risk-probability" className={LABEL_CLASSES}>
              Probabilidad
            </label>
            <select
              id="grc-risk-probability"
              value={form.probability}
              onChange={(event) => set("probability", Number(event.target.value))}
              className={SELECT_CLASSES}
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="grc-risk-impact" className={LABEL_CLASSES}>
              Impacto
            </label>
            <select
              id="grc-risk-impact"
              value={form.impact}
              onChange={(event) => set("impact", Number(event.target.value))}
              className={SELECT_CLASSES}
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="grc-risk-status" className={LABEL_CLASSES}>
              Estado
            </label>
            <select
              id="grc-risk-status"
              value={form.status}
              onChange={(event) => set("status", event.target.value)}
              className={SELECT_CLASSES}
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div
            className="flex items-center justify-between border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-4 py-3"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <span className="text-sm font-medium text-[var(--g-text-primary)]">Score inherente estimado</span>
            <span className="text-xl font-bold text-[var(--g-brand-3308)]">{inherentPreview}</span>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-[var(--g-border-subtle)] px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => navigate("/grc/risk-360")}
            className="inline-flex items-center justify-center border border-[var(--g-border-subtle)] bg-transparent px-4 py-2 text-sm font-medium text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            aria-busy={isSaving}
            disabled={isSaving}
            className="inline-flex items-center justify-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:cursor-not-allowed disabled:opacity-70"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear riesgo"}
          </button>
        </div>
      </form>
    </div>
  );
}
