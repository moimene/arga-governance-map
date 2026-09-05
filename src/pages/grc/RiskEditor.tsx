import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Activity, ChevronLeft, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useCreateRisk, useRiskById, useUpdateRisk, type RiskWriteInput } from "@/hooks/useRisks";
import { useGrcModules } from "@/hooks/useGrcDashboard";
import { useSecretariaScope } from "@/components/secretaria/shell";
import { RISK_STATUS_OPTIONS } from "@/lib/grc/status-labels";
import { ETIQUETA_BANDA, NOTA_ESCALA, type Banda } from "@/lib/grc/assessed-band";

type FormState = {
  code: string;
  title: string;
  description: string;
  module_id: string;
  status: string;
  probability: number;
  impact: number;
  assessed_band: Banda | null;
};

const INPUT_CLASSES =
  "h-10 w-full px-3 text-sm bg-[var(--g-surface-card)] text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)]/60 border border-[var(--g-border-subtle)] focus:border-[var(--g-brand-3308)] focus:outline-none transition-colors";

const TEXTAREA_CLASSES =
  "w-full px-3 py-2 text-sm bg-[var(--g-surface-card)] text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)]/60 border border-[var(--g-border-subtle)] focus:border-[var(--g-brand-3308)] focus:outline-none transition-colors resize-none";

const SELECT_CLASSES =
  "h-10 w-full px-3 text-sm bg-[var(--g-surface-card)] text-[var(--g-text-primary)] border border-[var(--g-border-subtle)] focus:border-[var(--g-brand-3308)] focus:outline-none transition-colors";

const LABEL_CLASSES = "block text-sm font-medium text-[var(--g-text-primary)] mb-1";

// Etiquetas legibles de los módulos conocidos. NO es la lista de opciones: la
// lista sale de `grc_modules` del tenant. Antes era estática y ofrecía
// dora/gdpr/audit/penal a un tenant que solo tiene aml/cyber/ethics/risk.
const MODULE_LABELS: Record<string, string> = {
  dora: "DORA",
  gdpr: "GDPR",
  cyber: "Cyber",
  audit: "Auditoría",
  penal: "Penal / Anticorrupción",
  risk: "Riesgos penales",
  aml: "Prevención de blanqueo",
  ethics: "Ética y conducta",
};

const emptyToNull = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const defaultCode = () => {
  const timestamp = new Date()
    .toISOString()
    .slice(2, 19)
    .replace(/-/g, "")
    .replace(/:/g, "")
    .replace("T", "");
  const suffix = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `RISK-${timestamp}-${suffix}`;
};

export default function RiskEditor() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const scope = useSecretariaScope();
  const [params] = useSearchParams();
  const { data: tenantModules = [], isLoading: loadingModules } = useGrcModules();
  // El nombre autoritativo es el que el tenant guarda en `grc_modules`;
  // MODULE_LABELS solo cubre un módulo que llegue por `?module=` y no esté
  // declarado para este grupo.
  const moduleOptions = tenantModules.map((m) => ({
    value: m.id,
    label: m.name ?? MODULE_LABELS[m.id] ?? m.id,
  }));
  // Sin preselección inventada: `?? "gdpr"` daba de alta riesgos en un módulo
  // que el tenant puede no tener. Si no viene por query, se deja vacío y el
  // usuario elige.
  const initialModule = params.get("module") ?? "";
  const scopedEntityId = scope.mode === "sociedad" ? scope.selectedEntity?.id ?? null : null;
  const riskListPath = scope.createScopedTo("/grc/risk-360");
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
    assessed_band: null,
  });

  const evaluadoPorBanda = !!risk?.assessed_band;

  useEffect(() => {
    if (!risk) return;
    setForm({
      code: risk.code,
      title: risk.title,
      description: risk.description ?? "",
      module_id: risk.module_id ?? "",
      status: risk.status ?? "Abierto",
      probability: risk.probability != null ? risk.probability : 3,
      impact: risk.impact != null ? risk.impact : 3,
      assessed_band: risk.assessed_band ?? null,
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
      module_id: emptyToNull(form.module_id),
      status: form.status,
      entity_id: isEdit ? risk?.entity_id ?? null : scopedEntityId,
      ...(evaluadoPorBanda
        ? { assessed_band: form.assessed_band }
        : { probability: form.probability, impact: form.impact }),
    };

    try {
      if (isEdit) {
        await updateRisk.mutateAsync(input);
        toast.success("Riesgo actualizado en GRC.");
      } else {
        await createRisk.mutateAsync(input);
        toast.success("Riesgo creado en GRC.");
      }
      navigate(riskListPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`No se pudo guardar el riesgo: ${message}`);
    }
  };

  const isSaving = createRisk.isPending || updateRisk.isPending;
  const inherentPreview = form.probability * form.impact;
  const baseStatusOptions: string[] = [...RISK_STATUS_OPTIONS];
  const statusOptions = baseStatusOptions.includes(form.status)
    ? baseStatusOptions
    : [...baseStatusOptions, form.status];

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
        onClick={() => navigate(riskListPath)}
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
              <option value="">{loadingModules ? "Cargando módulos…" : "— Selecciona un módulo —"}</option>
              {/* Un módulo que venga por `?module=` y no esté en `grc_modules`
                  se muestra igualmente, marcado, para no perder la selección
                  del handoff en silencio. */}
              {form.module_id && !moduleOptions.some((o) => o.value === form.module_id) && (
                <option value={form.module_id}>
                  {(MODULE_LABELS[form.module_id] ?? form.module_id)} (no declarado para este grupo)
                </option>
              )}
              {moduleOptions.map((option) => (
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

          {evaluadoPorBanda ? (
            <div
              className="md:col-span-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-4"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <p className="text-sm font-medium text-[var(--g-text-primary)]">
                Nivel evaluado en origen: {ETIQUETA_BANDA[form.assessed_band!]}
              </p>
              <p className="mt-1 text-xs leading-5 text-[var(--g-text-secondary)]">
                {NOTA_ESCALA} Este riesgo no se edita por probabilidad e impacto: su fuente no los descompone.
              </p>
            </div>
          ) : (
            <>
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

              <div
                className="flex items-center justify-between border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-4 py-3 md:col-span-2"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <span className="text-sm font-medium text-[var(--g-text-primary)]">Score inherente estimado</span>
                <span className="text-xl font-bold text-[var(--g-brand-3308)]">{inherentPreview}</span>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-[var(--g-border-subtle)] px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => navigate(riskListPath)}
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
