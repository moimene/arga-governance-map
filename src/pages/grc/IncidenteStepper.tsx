import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateIncident } from "@/hooks/useIncidents";
import { toast } from "sonner";
import { CheckCircle, ChevronRight, AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

type StepNum = 1 | 2 | 3 | 4;

type FormState = {
  incident_type: string;
  title: string;
  description: string;
  severity: string;
  country_code: string;
  detection_date: string;
  is_major_incident: boolean;
  status: string;
};

const AUTHORITY_BY_TYPE: Record<string, string> = {
  DORA: "BdE",
  GDPR: "AEPD",
};

const STEPS = [
  { label: "Tipología" },
  { label: "Descripción" },
  { label: "Evaluación" },
  { label: "Confirmación" },
];

const SELECT_CLASSES =
  "h-10 w-full px-3 text-sm bg-[var(--g-surface-card)] text-[var(--g-text-primary)] border border-[var(--g-border-subtle)] focus:border-[var(--g-brand-3308)] focus:outline-none transition-colors";

const INPUT_CLASSES =
  "h-10 w-full px-3 text-sm bg-[var(--g-surface-card)] text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)]/60 border border-[var(--g-border-subtle)] focus:border-[var(--g-brand-3308)] focus:outline-none transition-colors";

const TEXTAREA_CLASSES =
  "w-full px-3 py-2 text-sm bg-[var(--g-surface-card)] text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)]/60 border border-[var(--g-border-subtle)] focus:border-[var(--g-brand-3308)] focus:outline-none transition-colors resize-none";

const LABEL_CLASSES = "block text-sm font-medium text-[var(--g-text-primary)] mb-1";

function StepIndicator({ current }: { current: StepNum }) {
  return (
    <div className="flex items-center gap-1 mb-6">
      {STEPS.map((s, idx) => {
        const n = (idx + 1) as StepNum;
        const done = current > n;
        const active = current === n;
        return (
          <div key={s.label} className="flex items-center gap-1">
            <div
              className={cn(
                "h-7 w-7 flex items-center justify-center text-xs font-semibold transition-all",
                done
                  ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                  : active
                  ? "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]"
                  : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
              )}
              style={{ borderRadius: "var(--g-radius-full)" }}
            >
              {done ? <CheckCircle className="h-4 w-4" /> : n}
            </div>
            <span
              className={cn(
                "text-xs hidden sm:block",
                active ? "font-semibold text-[var(--g-text-primary)]" : "text-[var(--g-text-secondary)]"
              )}
            >
              {s.label}
            </span>
            {idx < STEPS.length - 1 && (
              <ChevronRight className="h-3.5 w-3.5 text-[var(--g-text-secondary)] mx-1" />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function IncidenteStepper() {
  const navigate = useNavigate();
  const createIncident = useCreateIncident();
  const [step, setStep] = useState<StepNum>(1);
  const [form, setForm] = useState<FormState>({
    incident_type: "DORA",
    title: "",
    description: "",
    severity: "Alto",
    country_code: "ES",
    detection_date: new Date().toISOString().slice(0, 16),
    is_major_incident: false,
    status: "Abierto",
  });

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const canAdvance = (s: StepNum) => {
    if (s === 1) return form.title.trim().length >= 3 && !!form.incident_type;
    if (s === 2) return !!form.severity && !!form.detection_date;
    return true;
  };

  const authority = AUTHORITY_BY_TYPE[form.incident_type];
  const isDora = form.incident_type === "DORA";
  const isGdpr = form.incident_type === "GDPR";
  const needsNotif = (isDora || isGdpr) && form.is_major_incident;

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      toast.error("El título del incidente es obligatorio.");
      setStep(1);
      return;
    }
    try {
      const created = await createIncident.mutateAsync({
        title: form.title,
        description: form.description || undefined,
        severity: form.severity,
        incident_type: form.incident_type,
        is_major_incident: form.is_major_incident,
        status: form.status,
        country_code: form.country_code,
        detection_date: new Date(form.detection_date).toISOString(),
        regulatory_notification_required: needsNotif,
      });
      toast.success(
        needsNotif
          ? `Incidente creado. Notificación ${authority} programada con deadline 72h.`
          : "Incidente creado correctamente."
      );
      navigate(`/grc/incidentes/${(created as { id: string }).id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Error al crear: ${msg}`);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--g-text-primary)]">
          Nuevo incidente regulatorio
        </h1>
        <p className="text-sm text-[var(--g-text-secondary)] mt-0.5">
          Registra el incidente y, si supera el umbral, se generará la notificación
          al regulador automáticamente.
        </p>
      </div>

      {/* Card */}
      <div
        className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-6"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <StepIndicator current={step} />

        {/* Step 1 — Tipología */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label htmlFor="incident_type" className={LABEL_CLASSES}>
                Tipología / Regulación *
              </label>
              <select
                id="incident_type"
                value={form.incident_type}
                onChange={(e) => set("incident_type", e.target.value)}
                className={SELECT_CLASSES}
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <option value="DORA">DORA · Resiliencia ICT</option>
                <option value="GDPR">GDPR · Protección de datos</option>
                <option value="CYBER">CYBER · Ciberseguridad</option>
                <option value="OPERATIVO">OPERATIVO</option>
              </select>
              {(isDora || isGdpr) && (
                <div
                  className="mt-2 flex items-center gap-2 px-3 py-2 bg-[var(--status-error)] text-[var(--g-text-inverse)] text-xs font-semibold"
                  style={{ borderRadius: "var(--g-radius-sm)" }}
                >
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  Deadline legal: 72h si es incidente mayor{" "}
                  {authority ? `(${authority})` : ""}
                </div>
              )}
            </div>
            <div>
              <label htmlFor="inc_title" className={LABEL_CLASSES}>
                Título del incidente *
              </label>
              <input
                id="inc_title"
                type="text"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="Descripción breve del incidente"
                className={INPUT_CLASSES}
                style={{ borderRadius: "var(--g-radius-md)" }}
              />
              {form.title.trim().length > 0 && form.title.trim().length < 3 && (
                <p className="mt-1 text-xs text-[var(--status-error)]">
                  Mínimo 3 caracteres.
                </p>
              )}
            </div>
            <div>
              <label htmlFor="inc_desc" className={LABEL_CLASSES}>
                Descripción inicial
              </label>
              <textarea
                id="inc_desc"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Detalla los hechos conocidos en este momento…"
                rows={4}
                className={TEXTAREA_CLASSES}
                style={{ borderRadius: "var(--g-radius-md)" }}
              />
            </div>
          </div>
        )}

        {/* Step 2 — Descripción / Severidad */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label htmlFor="severity" className={LABEL_CLASSES}>
                Severidad *
              </label>
              <select
                id="severity"
                value={form.severity}
                onChange={(e) => set("severity", e.target.value)}
                className={SELECT_CLASSES}
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <option value="Crítico">Crítico</option>
                <option value="Alto">Alto</option>
                <option value="Medio">Medio</option>
                <option value="Bajo">Bajo</option>
              </select>
            </div>
            <div>
              <label htmlFor="country_code" className={LABEL_CLASSES}>
                País afectado (para filtrado por Pack) *
              </label>
              <select
                id="country_code"
                value={form.country_code}
                onChange={(e) => set("country_code", e.target.value)}
                className={SELECT_CLASSES}
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <option value="ES">España 🇪🇸</option>
                <option value="BR">Brasil 🇧🇷</option>
                <option value="MX">México 🇲🇽</option>
              </select>
            </div>
            <div>
              <label htmlFor="detection_date" className={LABEL_CLASSES}>
                Fecha y hora de detección *
              </label>
              <input
                id="detection_date"
                type="datetime-local"
                value={form.detection_date}
                onChange={(e) => set("detection_date", e.target.value)}
                className={INPUT_CLASSES}
                style={{ borderRadius: "var(--g-radius-md)" }}
              />
            </div>
          </div>
        )}

        {/* Step 3 — Evaluación umbral */}
        {step === 3 && (
          <div className="space-y-4">
            <div
              className="p-4 bg-[var(--g-surface-subtle)] border border-[var(--g-border-default)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <div className="text-sm font-semibold text-[var(--g-text-primary)] mb-2">
                Evaluación de umbral de incidente mayor
              </div>
              <p className="text-xs text-[var(--g-text-secondary)] leading-relaxed">
                Según {form.incident_type}, un incidente es <strong>mayor</strong> si
                cumple criterios como: impacto en servicio crítico, afectación a más de 1.000
                clientes, pérdida de datos personales masiva, o indisponibilidad superior al
                RTO de función crítica.
              </p>
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_major_incident}
                onChange={(e) => set("is_major_incident", e.target.checked)}
                className="h-4 w-4 accent-[var(--g-brand-3308)]"
              />
              <span className="text-sm font-medium text-[var(--g-text-primary)]">
                Marcar como <strong>incidente mayor</strong>
              </span>
            </label>

            {needsNotif && (
              <div
                className="flex items-start gap-3 p-4 border border-[var(--status-error)]/40 bg-[var(--status-error)]/10"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <AlertTriangle className="h-5 w-5 text-[var(--status-error)] shrink-0 mt-0.5" />
                <div className="text-sm">
                  <div className="font-semibold text-[var(--g-text-primary)] mb-0.5">
                    Se generará notificación automática a <strong>{authority}</strong>
                  </div>
                  <div className="text-[var(--g-text-secondary)]">
                    Deadline:{" "}
                    <strong className="text-[var(--status-error)]">
                      72 horas desde la detección
                    </strong>
                    . El trigger de Supabase creará el registro en{" "}
                    <code className="text-xs">regulatory_notifications</code>.
                  </div>
                </div>
              </div>
            )}

            {form.is_major_incident && !authority && (
              <div
                className="p-3 text-sm text-[var(--g-text-secondary)] bg-[var(--g-surface-muted)] border border-[var(--g-border-subtle)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                Para el tipo <strong>{form.incident_type}</strong>, no se genera notificación
                automática a regulador.
              </div>
            )}
          </div>
        )}

        {/* Step 4 — Confirmación */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="text-sm font-semibold text-[var(--g-text-primary)] mb-3">
              Resumen del incidente
            </div>
            <div
              className="border border-[var(--g-border-default)] divide-y divide-[var(--g-border-subtle)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              {[
                { label: "Tipología", value: form.incident_type },
                { label: "Título", value: form.title },
                { label: "Severidad", value: form.severity },
                { label: "País", value: form.country_code },
                { label: "Detección", value: form.detection_date },
                {
                  label: "Incidente mayor",
                  value: form.is_major_incident ? "Sí" : "No",
                },
              ].map((row) => (
                <div key={row.label} className="flex gap-4 px-4 py-2.5 text-sm">
                  <span className="w-36 shrink-0 text-[var(--g-text-secondary)]">{row.label}</span>
                  <span className="font-medium text-[var(--g-text-primary)]">{row.value}</span>
                </div>
              ))}
            </div>

            {needsNotif && (
              <div
                className="flex items-start gap-3 p-4 border border-[var(--status-error)]/40 bg-[var(--status-error)]/10"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <Clock className="h-5 w-5 text-[var(--status-error)] shrink-0 mt-0.5" />
                <div className="text-sm">
                  <div className="font-semibold text-[var(--g-text-primary)] mb-0.5">
                    Notificación automática a {authority}
                  </div>
                  <div className="text-[var(--g-text-secondary)]">
                    Al confirmar, el sistema generará la notificación con deadline de{" "}
                    <strong className="text-[var(--status-error)]">72 horas</strong>.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div
          className="flex justify-between pt-5 mt-5 border-t border-[var(--g-border-subtle)]"
        >
          <button
            type="button"
            disabled={step === 1}
            onClick={() => setStep((s) => (s - 1) as StepNum)}
            className="inline-flex items-center gap-2 px-4 h-10 text-sm font-medium border border-[var(--g-border-subtle)] bg-transparent text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] disabled:opacity-40 disabled:pointer-events-none transition-colors"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Atrás
          </button>

          {step < 4 ? (
            <button
              type="button"
              disabled={!canAdvance(step)}
              onClick={() => setStep((s) => (s + 1) as StepNum)}
              className="inline-flex items-center gap-2 px-4 h-10 text-sm font-medium bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] disabled:opacity-40 disabled:pointer-events-none transition-colors"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={createIncident.isPending}
              onClick={handleSubmit}
              aria-busy={createIncident.isPending}
              className="inline-flex items-center gap-2 px-4 h-10 text-sm font-medium bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] disabled:opacity-40 disabled:pointer-events-none transition-colors"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              {createIncident.isPending ? "Creando…" : "Confirmar y crear"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
