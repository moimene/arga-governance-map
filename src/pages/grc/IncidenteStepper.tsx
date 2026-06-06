import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateIncident } from "@/hooks/useIncidents";
import { toast } from "sonner";
import { CheckCircle, ChevronRight, AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSecretariaScope } from "@/components/secretaria/shell";
import { SEVERITY_OPTIONS } from "@/lib/grc/status-labels";

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
  const scope = useSecretariaScope();
  const scopedEntityId = scope.mode === "sociedad" ? scope.selectedEntity?.id ?? null : null;
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

  const [doraRts, setDoraRts] = useState({
    q1_clients: false,
    q2_geographic: false,
    q3_downtime: false,
    q4_dataloss: false,
    q5_ecosystem: false,
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
  
  const calculatedIsMajor = isDora
    ? (doraRts.q1_clients || doraRts.q2_geographic || doraRts.q3_downtime || doraRts.q4_dataloss || doraRts.q5_ecosystem)
    : form.is_major_incident;

  const needsNotif = (isDora || isGdpr) && calculatedIsMajor;

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      toast.error("El título del incidente es obligatorio.");
      setStep(1);
      return;
    }
    try {
      const payload = isDora ? {
        dora_rts: {
          q1_clients: doraRts.q1_clients,
          q2_geographic: doraRts.q2_geographic,
          q3_downtime: doraRts.q3_downtime,
          q4_dataloss: doraRts.q4_dataloss,
          q5_ecosystem: doraRts.q5_ecosystem,
        }
      } : null;

      const created = await createIncident.mutateAsync({
        title: form.title,
        description: form.description || undefined,
        severity: form.severity,
        incident_type: form.incident_type,
        is_major_incident: calculatedIsMajor,
        status: form.status,
        country_code: form.country_code,
        detection_date: new Date(form.detection_date).toISOString(),
        regulatory_notification_required: needsNotif,
        entity_id: scopedEntityId,
        payload,
      });
      toast.success(
        needsNotif
          ? `Incidente creado. Marcado para notificación ${authority} con deadline 72h.`
          : "Incidente creado correctamente."
      );
      navigate(scope.createScopedTo(`/grc/incidentes/${(created as { id: string }).id}`));
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
          Registra el incidente y, si supera el umbral, lo marca para intake de notificación
          regulatoria en GRC.
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
                {SEVERITY_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
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
                {isDora ? (
                  <>
                    Bajo el estándar técnico RTS de <strong>DORA</strong>, evalúa los siguientes criterios críticos para clasificar si este incidente ICT califica como <strong>Incidente Mayor</strong>.
                  </>
                ) : (
                  <>
                    Según {form.incident_type}, un incidente es <strong>mayor</strong> si cumple criterios como: impacto en servicio crítico, afectación a más de 1.000 clientes, pérdida de datos personales masiva, o indisponibilidad superior al RTO de función crítica.
                  </>
                )}
              </p>
            </div>

            {isDora ? (
              <div className="space-y-3">
                <span className="text-xs font-semibold text-[var(--g-text-secondary)] uppercase tracking-wider block mb-1">
                  Cuestionario RTS DORA
                </span>
                
                {[
                  {
                    key: "q1_clients" as const,
                    label: "1. Impacto en clientes y transacciones",
                    desc: "¿Afecta a más del 10% de clientes activos o a más de 100.000 clientes/transacciones financieras?",
                  },
                  {
                    key: "q2_geographic" as const,
                    label: "2. Impacto geográfico transfronterizo",
                    desc: "¿Tiene impacto en más de un Estado miembro de la UE o afecta a nodos internacionales del grupo?",
                  },
                  {
                    key: "q3_downtime" as const,
                    label: "3. Indisponibilidad de funciones críticas",
                    desc: "¿La interrupción del servicio supera las 2 horas para una función crítica o importante de la aseguradora?",
                  },
                  {
                    key: "q4_dataloss" as const,
                    label: "4. Gravedad de pérdida de datos",
                    desc: "¿Se ha producido una alteración, pérdida de confidencialidad o indisponibilidad de datos transaccionales o de clientes?",
                  },
                  {
                    key: "q5_ecosystem" as const,
                    label: "5. Impacto sistémico o en terceros",
                    desc: "¿Afecta a otros proveedores de servicios críticos de terceros o compromete la estabilidad operativa del ecosistema?",
                  },
                ].map((q) => (
                  <div
                    key={q.key}
                    className="p-3 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] transition-colors hover:border-[var(--g-border-default)]"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-[var(--g-text-primary)] block">
                          {q.label}
                        </span>
                        <span className="text-xs text-[var(--g-text-secondary)] leading-relaxed block">
                          {q.desc}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setDoraRts((prev) => ({ ...prev, [q.key]: true }))}
                          className={cn(
                            "px-2.5 py-1 text-xs font-semibold border transition-all",
                            doraRts[q.key]
                              ? "bg-[var(--status-error)] text-[var(--g-text-inverse)] border-[var(--status-error)]"
                              : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border-[var(--g-border-subtle)] hover:bg-[var(--g-surface-subtle)]"
                          )}
                          style={{ borderRadius: "var(--g-radius-sm)" }}
                        >
                          Sí
                        </button>
                        <button
                          type="button"
                          onClick={() => setDoraRts((prev) => ({ ...prev, [q.key]: false }))}
                          className={cn(
                            "px-2.5 py-1 text-xs font-semibold border transition-all",
                            !doraRts[q.key]
                              ? "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] border-[var(--g-brand-3308)]"
                              : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border-[var(--g-border-subtle)] hover:bg-[var(--g-surface-subtle)]"
                          )}
                          style={{ borderRadius: "var(--g-radius-sm)" }}
                        >
                          No
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
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
            )}

            {calculatedIsMajor && isDora && (
              <div
                className="p-3 bg-[var(--status-error)]/10 border border-[var(--status-error)] text-[var(--status-error)] font-semibold text-xs flex items-center gap-2"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Clasificación DORA: INCIDENTE MAYOR IDENTIFICADO (Criterios RTS activos).</span>
              </div>
            )}

            {needsNotif && (
              <div
                className="flex items-start gap-3 p-4 border border-[var(--status-error)]/40 bg-[var(--status-error)]/10"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <AlertTriangle className="h-5 w-5 text-[var(--status-error)] shrink-0 mt-0.5" />
                <div className="text-sm">
                  <div className="font-semibold text-[var(--g-text-primary)] mb-0.5">
                    Se marcará notificación a <strong>{authority}</strong>
                  </div>
                  <div className="text-[var(--g-text-secondary)]">
                    Deadline:{" "}
                    <strong className="text-[var(--status-error)]">
                      24 horas para Notificación Inicial bajo DORA
                    </strong>
                    .
                  </div>
                </div>
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
                  value: calculatedIsMajor ? "Sí" : "No",
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
                    Intake de notificación a {authority}
                  </div>
                  <div className="text-[var(--g-text-secondary)]">
                    Al confirmar, el incidente quedará marcado con deadline de{" "}
                    <strong className="text-[var(--status-error)]">24 horas (Notificación Inicial)</strong> para el flujo owner de GRC.
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
