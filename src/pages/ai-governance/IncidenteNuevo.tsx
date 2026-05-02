import { FormEvent, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, ChevronLeft, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAiSystemsList } from "@/hooks/useAiSystems";
import { useCreateAiIncident, type AiIncident } from "@/hooks/useAiIncidents";

type FormState = {
  system_id: string;
  title: string;
  severity: string;
  status: string;
  reported_at: string;
  description: string;
  root_cause: string;
  corrective_action: string;
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

const nowForInput = () => new Date().toISOString().slice(0, 16);

export default function IncidenteNuevo() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const createIncident = useCreateAiIncident();
  const { data: systems = [], isLoading: loadingSystems } = useAiSystemsList();
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState<FormState>({
    system_id: params.get("system_id") ?? "",
    title: "",
    severity: "ALTO",
    status: "ABIERTO",
    reported_at: nowForInput(),
    description: "",
    root_cause: "",
    corrective_action: "",
  });

  const errors = useMemo(() => {
    if (!submitted) return { title: "", system_id: "" };
    return {
      title: form.title.trim().length < 3 ? "El título debe tener al menos 3 caracteres." : "",
      system_id: form.system_id ? "" : "Selecciona el sistema IA afectado.",
    };
  }, [form.system_id, form.title, submitted]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);

    if (form.title.trim().length < 3 || !form.system_id) {
      toast.error("Revisa los campos obligatorios.");
      return;
    }

    const payload: Partial<AiIncident> = {
      system_id: form.system_id,
      title: form.title.trim(),
      severity: form.severity,
      status: form.status,
      reported_at: new Date(form.reported_at).toISOString(),
      description: emptyToNull(form.description),
      root_cause: emptyToNull(form.root_cause),
      corrective_action: emptyToNull(form.corrective_action),
    };

    try {
      const created = await createIncident.mutateAsync(payload);
      toast.success("Incidente IA registrado en AIMS.");
      navigate(created.system_id ? `/ai-governance/sistemas/${created.system_id}` : "/ai-governance/incidentes");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`No se pudo registrar el incidente: ${message}`);
    }
  };

  return (
    <div className="p-6 max-w-[920px] mx-auto">
      <button
        type="button"
        onClick={() => navigate("/ai-governance/incidentes")}
        className="mb-4 flex items-center gap-1.5 text-sm text-[var(--g-text-secondary)] transition-colors hover:text-[var(--g-brand-3308)]"
      >
        <ChevronLeft className="h-4 w-4" />
        Incidentes IA
      </button>

      <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-5 w-5 text-[var(--status-error)]" />
            <h1 className="text-xl font-bold text-[var(--g-text-primary)]">
              Nuevo incidente IA
            </h1>
          </div>
          <p className="text-sm text-[var(--g-text-secondary)]">
            Registro owner de AIMS; cualquier escalado a GRC o Secretaría se mantiene como handoff read-only.
          </p>
        </div>
        <div
          className="inline-flex items-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-3 py-2 text-xs font-semibold text-[var(--g-text-primary)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <ShieldCheck className="h-4 w-4 text-[var(--g-brand-3308)]" />
          legacy_write · ai_incidents
        </div>
      </header>

      <form
        onSubmit={handleSubmit}
        className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="border-b border-[var(--g-border-subtle)] px-6 py-4">
          <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
            Señal, severidad y cierre operativo
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-5 p-6 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="ai-incident-system" className={LABEL_CLASSES}>
              Sistema IA afectado *
            </label>
            <select
              id="ai-incident-system"
              value={form.system_id}
              onChange={(event) => set("system_id", event.target.value)}
              aria-invalid={!!errors.system_id}
              aria-describedby={errors.system_id ? "ai-incident-system-error" : undefined}
              className={SELECT_CLASSES}
              style={{ borderRadius: "var(--g-radius-md)" }}
              disabled={loadingSystems}
            >
              <option value="">{loadingSystems ? "Cargando sistemas..." : "Selecciona un sistema"}</option>
              {systems.map((system) => (
                <option key={system.id} value={system.id}>
                  {system.name}
                </option>
              ))}
            </select>
            {errors.system_id && (
              <p id="ai-incident-system-error" className="mt-1 text-xs text-[var(--status-error)]">
                {errors.system_id}
              </p>
            )}
          </div>

          <div className="md:col-span-2">
            <label htmlFor="ai-incident-title" className={LABEL_CLASSES}>
              Título *
            </label>
            <input
              id="ai-incident-title"
              type="text"
              value={form.title}
              onChange={(event) => set("title", event.target.value)}
              placeholder="Ej. Sesgo detectado en recomendación automatizada"
              aria-invalid={!!errors.title}
              aria-describedby={errors.title ? "ai-incident-title-error" : undefined}
              className={INPUT_CLASSES}
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
            {errors.title && (
              <p id="ai-incident-title-error" className="mt-1 text-xs text-[var(--status-error)]">
                {errors.title}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="ai-incident-severity" className={LABEL_CLASSES}>
              Severidad
            </label>
            <select
              id="ai-incident-severity"
              value={form.severity}
              onChange={(event) => set("severity", event.target.value)}
              className={SELECT_CLASSES}
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <option value="CRITICO">Crítico</option>
              <option value="ALTO">Alto</option>
              <option value="MEDIO">Medio</option>
              <option value="BAJO">Bajo</option>
            </select>
          </div>

          <div>
            <label htmlFor="ai-incident-status" className={LABEL_CLASSES}>
              Estado
            </label>
            <select
              id="ai-incident-status"
              value={form.status}
              onChange={(event) => set("status", event.target.value)}
              className={SELECT_CLASSES}
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <option value="ABIERTO">Abierto</option>
              <option value="EN_INVESTIGACION">En investigación</option>
              <option value="CERRADO">Cerrado</option>
            </select>
          </div>

          <div>
            <label htmlFor="ai-incident-reported" className={LABEL_CLASSES}>
              Fecha y hora de reporte
            </label>
            <input
              id="ai-incident-reported"
              type="datetime-local"
              value={form.reported_at}
              onChange={(event) => set("reported_at", event.target.value)}
              className={INPUT_CLASSES}
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="ai-incident-description" className={LABEL_CLASSES}>
              Descripción inicial
            </label>
            <textarea
              id="ai-incident-description"
              value={form.description}
              onChange={(event) => set("description", event.target.value)}
              placeholder="Hechos conocidos, población afectada, señal técnica o impacto preliminar"
              rows={4}
              className={TEXTAREA_CLASSES}
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
          </div>

          <div>
            <label htmlFor="ai-incident-root-cause" className={LABEL_CLASSES}>
              Causa raíz
            </label>
            <textarea
              id="ai-incident-root-cause"
              value={form.root_cause}
              onChange={(event) => set("root_cause", event.target.value)}
              placeholder="Opcional en apertura"
              rows={3}
              className={TEXTAREA_CLASSES}
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
          </div>

          <div>
            <label htmlFor="ai-incident-corrective-action" className={LABEL_CLASSES}>
              Acción correctiva
            </label>
            <textarea
              id="ai-incident-corrective-action"
              value={form.corrective_action}
              onChange={(event) => set("corrective_action", event.target.value)}
              placeholder="Medidas de contención o remediación"
              rows={3}
              className={TEXTAREA_CLASSES}
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-[var(--g-border-subtle)] px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => navigate("/ai-governance/incidentes")}
            className="inline-flex items-center justify-center border border-[var(--g-border-subtle)] bg-transparent px-4 py-2 text-sm font-medium text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            aria-busy={createIncident.isPending}
            disabled={createIncident.isPending}
            className="inline-flex items-center justify-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:cursor-not-allowed disabled:opacity-70"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <Save className="h-4 w-4" />
            {createIncident.isPending ? "Registrando..." : "Registrar incidente"}
          </button>
        </div>
      </form>
    </div>
  );
}
