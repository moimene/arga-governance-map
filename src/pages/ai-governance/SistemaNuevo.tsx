import { FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Cpu, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useCreateAiSystem, type AiSystem } from "@/hooks/useAiSystems";

type FormState = {
  name: string;
  system_type: string;
  risk_level: string;
  vendor: string;
  deployment_date: string;
  status: string;
  use_case: string;
  description: string;
};

const INPUT_CLASSES =
  "h-10 w-full px-3 text-sm bg-[var(--g-surface-card)] text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)]/60 border border-[var(--g-border-subtle)] focus:border-[var(--g-brand-3308)] focus:outline-none transition-colors";

const TEXTAREA_CLASSES =
  "w-full px-3 py-2 text-sm bg-[var(--g-surface-card)] text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)]/60 border border-[var(--g-border-subtle)] focus:border-[var(--g-brand-3308)] focus:outline-none transition-colors resize-none";

const SELECT_CLASSES =
  "h-10 w-full px-3 text-sm bg-[var(--g-surface-card)] text-[var(--g-text-primary)] border border-[var(--g-border-subtle)] focus:border-[var(--g-brand-3308)] focus:outline-none transition-colors";

const LABEL_CLASSES = "block text-sm font-medium text-[var(--g-text-primary)] mb-1";

const emptyToNull = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export default function SistemaNuevo() {
  const navigate = useNavigate();
  const createSystem = useCreateAiSystem();
  const [form, setForm] = useState<FormState>({
    name: "",
    system_type: "Modelo predictivo",
    risk_level: "Alto",
    vendor: "",
    deployment_date: "",
    status: "EN_EVALUACION",
    use_case: "",
    description: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const nameError = useMemo(() => {
    if (!submitted) return "";
    if (form.name.trim().length < 3) return "El nombre debe tener al menos 3 caracteres.";
    return "";
  }, [form.name, submitted]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);

    if (form.name.trim().length < 3) {
      toast.error("Revisa los campos obligatorios.");
      return;
    }

    const payload: Partial<AiSystem> = {
      name: form.name.trim(),
      system_type: emptyToNull(form.system_type),
      risk_level: emptyToNull(form.risk_level),
      vendor: emptyToNull(form.vendor),
      deployment_date: emptyToNull(form.deployment_date),
      status: form.status,
      use_case: emptyToNull(form.use_case),
      description: emptyToNull(form.description),
    };

    try {
      const created = await createSystem.mutateAsync(payload);
      toast.success("Sistema IA registrado en AIMS.");
      navigate(`/ai-governance/sistemas/${created.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`No se pudo registrar el sistema: ${message}`);
    }
  };

  return (
    <div className="p-6 max-w-[920px] mx-auto">
      <button
        type="button"
        onClick={() => navigate("/ai-governance/sistemas")}
        className="mb-4 flex items-center gap-1.5 text-sm text-[var(--g-text-secondary)] transition-colors hover:text-[var(--g-brand-3308)]"
      >
        <ChevronLeft className="h-4 w-4" />
        Inventario de Sistemas IA
      </button>

      <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Cpu className="h-5 w-5 text-[var(--g-brand-3308)]" />
            <h1 className="text-xl font-bold text-[var(--g-text-primary)]">
              Nuevo sistema IA
            </h1>
          </div>
          <p className="text-sm text-[var(--g-text-secondary)]">
            Alta owner de AIMS sobre inventario operativo.
          </p>
        </div>
        <div
          className="inline-flex items-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-3 py-2 text-xs font-semibold text-[var(--g-text-primary)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <ShieldCheck className="h-4 w-4 text-[var(--g-brand-3308)]" />
          legacy_write · ai_systems
        </div>
      </header>

      <form
        onSubmit={handleSubmit}
        className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="border-b border-[var(--g-border-subtle)] px-6 py-4">
          <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
            Identificación y clasificación
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-5 p-6 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="ai-system-name" className={LABEL_CLASSES}>
              Nombre del sistema *
            </label>
            <input
              id="ai-system-name"
              type="text"
              value={form.name}
              onChange={(event) => set("name", event.target.value)}
              placeholder="Ej. Motor de tarificación predictiva"
              aria-invalid={!!nameError}
              aria-describedby={nameError ? "ai-system-name-error" : undefined}
              className={INPUT_CLASSES}
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
            {nameError && (
              <p id="ai-system-name-error" className="mt-1 text-xs text-[var(--status-error)]">
                {nameError}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="ai-system-type" className={LABEL_CLASSES}>
              Tipo
            </label>
            <select
              id="ai-system-type"
              value={form.system_type}
              onChange={(event) => set("system_type", event.target.value)}
              className={SELECT_CLASSES}
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <option value="Modelo predictivo">Modelo predictivo</option>
              <option value="Asistente generativo">Asistente generativo</option>
              <option value="Scoring automatizado">Scoring automatizado</option>
              <option value="Motor de decisión">Motor de decisión</option>
              <option value="Monitorización">Monitorización</option>
            </select>
          </div>

          <div>
            <label htmlFor="ai-risk-level" className={LABEL_CLASSES}>
              Riesgo EU AI Act
            </label>
            <select
              id="ai-risk-level"
              value={form.risk_level}
              onChange={(event) => set("risk_level", event.target.value)}
              className={SELECT_CLASSES}
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <option value="Alto">Alto</option>
              <option value="Limitado">Limitado</option>
              <option value="Mínimo">Mínimo</option>
              <option value="Inaceptable">Inaceptable</option>
            </select>
          </div>

          <div>
            <label htmlFor="ai-vendor" className={LABEL_CLASSES}>
              Vendor / proveedor
            </label>
            <input
              id="ai-vendor"
              type="text"
              value={form.vendor}
              onChange={(event) => set("vendor", event.target.value)}
              placeholder="Equipo interno, proveedor o plataforma"
              className={INPUT_CLASSES}
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
          </div>

          <div>
            <label htmlFor="ai-deployment-date" className={LABEL_CLASSES}>
              Fecha de despliegue
            </label>
            <input
              id="ai-deployment-date"
              type="date"
              value={form.deployment_date}
              onChange={(event) => set("deployment_date", event.target.value)}
              className={INPUT_CLASSES}
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
          </div>

          <div>
            <label htmlFor="ai-status" className={LABEL_CLASSES}>
              Estado
            </label>
            <select
              id="ai-status"
              value={form.status}
              onChange={(event) => set("status", event.target.value)}
              className={SELECT_CLASSES}
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <option value="EN_EVALUACION">En evaluación</option>
              <option value="ACTIVO">Activo</option>
              <option value="RETIRADO">Retirado</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="ai-use-case" className={LABEL_CLASSES}>
              Caso de uso
            </label>
            <textarea
              id="ai-use-case"
              value={form.use_case}
              onChange={(event) => set("use_case", event.target.value)}
              placeholder="Describe el uso operativo del sistema"
              rows={3}
              className={TEXTAREA_CLASSES}
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="ai-description" className={LABEL_CLASSES}>
              Descripción técnica
            </label>
            <textarea
              id="ai-description"
              value={form.description}
              onChange={(event) => set("description", event.target.value)}
              placeholder="Alcance, datos usados, supervisión humana o límites conocidos"
              rows={4}
              className={TEXTAREA_CLASSES}
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-[var(--g-border-subtle)] px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => navigate("/ai-governance/sistemas")}
            className="inline-flex items-center justify-center border border-[var(--g-border-subtle)] bg-transparent px-4 py-2 text-sm font-medium text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            aria-busy={createSystem.isPending}
            disabled={createSystem.isPending}
            className="inline-flex items-center justify-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:cursor-not-allowed disabled:opacity-70"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <Save className="h-4 w-4" />
            {createSystem.isPending ? "Registrando..." : "Registrar sistema"}
          </button>
        </div>
      </form>
    </div>
  );
}
