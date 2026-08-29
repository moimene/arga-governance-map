import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateIncident } from "@/hooks/useIncidents";
import { toast } from "sonner";
import { CheckCircle, ChevronRight, AlertTriangle, Clock, ShieldAlert, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSecretariaScope } from "@/components/secretaria/shell";
import { SEVERITY_OPTIONS } from "@/lib/grc/status-labels";
import { computeDoraDeadlines, computeNis2Deadlines, computeGdprBreachDeadlines } from "@/lib/grc/regulatory-clocks";

type StepNum = 1 | 2 | 3 | 4;

type FormState = {
  incident_type: "DORA" | "NIS2" | "GDPR" | "CYBER" | "OPERATIVO";
  title: string;
  description: string;
  severity: string;
  country_code: string;
  knowledge_date: string;
  classification_date: string;
  is_major_incident: boolean;
  affects_clients: boolean;
  high_risk_data_subjects: boolean;
  status: string;
};

const AUTHORITY_BY_TYPE: Record<string, string> = {
  DORA: "DGSFP / Banco de España / BCE",
  NIS2: "CCN-CERT / INCIBE-CERT",
  GDPR: "AEPD",
  CYBER: "CERT Nacional",
  OPERATIVO: "Comité de Continuidad",
};

const STEPS = [
  { label: "Tipología y Perímetro" },
  { label: "Descripción y Detección" },
  { label: "Evaluación de Impacto" },
  { label: "Plazos y Confirmación" },
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
    knowledge_date: new Date().toISOString().slice(0, 16),
    classification_date: new Date().toISOString().slice(0, 16),
    is_major_incident: true,
    affects_clients: false,
    high_risk_data_subjects: false,
    status: "Abierto",
  });

  const [doraRts, setDoraRts] = useState({
    q1_clients: true,
    q2_geographic: false,
    q3_downtime: true,
    q4_dataloss: false,
    q5_ecosystem: false,
  });

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const canAdvance = (s: StepNum) => {
    if (s === 1) return form.title.trim().length >= 3 && !!form.incident_type;
    if (s === 2) return !!form.severity && !!form.knowledge_date;
    return true;
  };

  const authority = AUTHORITY_BY_TYPE[form.incident_type];
  const isDora = form.incident_type === "DORA";
  const isNis2 = form.incident_type === "NIS2";
  const isGdpr = form.incident_type === "GDPR";
  
  const calculatedIsMajor = isDora
    ? (doraRts.q1_clients || doraRts.q2_geographic || doraRts.q3_downtime || doraRts.q4_dataloss || doraRts.q5_ecosystem)
    : form.is_major_incident;

  const needsNotif = (isDora || isNis2 || isGdpr) && calculatedIsMajor;

  // Calculador de plazos en vivo
  const doraClocks = computeDoraDeadlines(form.knowledge_date, form.classification_date);
  const nis2Clocks = computeNis2Deadlines(form.knowledge_date);
  const gdprClocks = computeGdprBreachDeadlines(form.knowledge_date, form.high_risk_data_subjects);

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      toast.error("El título del incidente es obligatorio.");
      setStep(1);
      return;
    }
    try {
      const payload = {
        dora_rts: isDora ? doraRts : undefined,
        knowledge_date: form.knowledge_date,
        classification_date: form.classification_date,
        affects_clients: form.affects_clients,
        high_risk_data_subjects: form.high_risk_data_subjects,
        deadlines: isDora ? doraClocks : isNis2 ? nis2Clocks : isGdpr ? gdprClocks : undefined,
      };

      const created = await createIncident.mutateAsync({
        title: form.title,
        description: form.description || undefined,
        severity: form.severity,
        incident_type: form.incident_type,
        is_major_incident: calculatedIsMajor,
        status: form.status,
        country_code: form.country_code,
        detection_date: new Date(form.knowledge_date).toISOString(),
        regulatory_notification_required: needsNotif,
        entity_id: scopedEntityId,
        payload,
      });
      toast.success(
        needsNotif
          ? `Incidente registrado. Reloj regulatorio activo ante ${authority}.`
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
          Nuevo Incidente Regulatorio TIC / Ciberseguridad
        </h1>
        <p className="text-sm text-[var(--g-text-secondary)] mt-0.5">
          Asistente de registro, clasificación de perímetro DORA/NIS2 y activación de plazos perentorios.
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
                Régimen Normativo / Tipología *
              </label>
              <select
                id="incident_type"
                value={form.incident_type}
                onChange={(e) => set("incident_type", e.target.value as FormState["incident_type"])}
                className={SELECT_CLASSES}
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <option value="DORA">DORA · Resiliencia TIC Financiera (Desplaza NIS2)</option>
                <option value="NIS2">NIS2 · Ciberseguridad Entidad Esencial / Importante</option>
                <option value="GDPR">GDPR · Brecha de Datos Personales (Arts. 33/34)</option>
                <option value="CYBER">CYBER · Incidente Operativo General</option>
                <option value="OPERATIVO">OPERATIVO · Continuidad Interna</option>
              </select>
              {needsNotif && (
                <div
                  className="mt-2 flex items-center gap-2 px-3 py-2 bg-[var(--status-error)] text-[var(--g-text-inverse)] text-xs font-semibold"
                  style={{ borderRadius: "var(--g-radius-sm)" }}
                >
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  Autoridad Competente: {authority}
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
                placeholder="Ej. Indisponibilidad crítica del Core Asegurador por ataque DDoS"
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
                Descripción inicial de los hechos
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

        {/* Step 2 — Detección y Fechas */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="knowledge_date" className={LABEL_CLASSES}>
                  Fecha/Hora de Conocimiento *
                </label>
                <input
                  id="knowledge_date"
                  type="datetime-local"
                  value={form.knowledge_date}
                  onChange={(e) => set("knowledge_date", e.target.value)}
                  className={INPUT_CLASSES}
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
                <p className="text-[10px] text-[var(--g-text-secondary)] mt-1">
                  Momento exacto en que la entidad toma constancia técnica.
                </p>
              </div>
              <div>
                <label htmlFor="classification_date" className={LABEL_CLASSES}>
                  Fecha/Hora de Calificación
                </label>
                <input
                  id="classification_date"
                  type="datetime-local"
                  value={form.classification_date}
                  onChange={(e) => set("classification_date", e.target.value)}
                  className={INPUT_CLASSES}
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
                <p className="text-[10px] text-[var(--g-text-secondary)] mt-1">
                  Momento de clasificación como Grave TIC (DORA Art. 19).
                </p>
              </div>
            </div>

            <div>
              <label htmlFor="severity" className={LABEL_CLASSES}>
                Severidad Inicial *
              </label>
              <select
                id="severity"
                value={form.severity}
                onChange={(e) => set("severity", e.target.value)}
                className={SELECT_CLASSES}
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                {SEVERITY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Step 3 — Evaluación de Impacto */}
        {step === 3 && (
          <div className="space-y-4">
            {isDora && (
              <div className="space-y-3">
                <div className="text-xs font-bold text-[var(--g-brand-3308)] uppercase">
                  Criterios de Clasificación DORA Art. 19:
                </div>
                {[
                  { key: "q1_clients", label: "Afecta a más del 10% de clientes o >100.000 usuarios" },
                  { key: "q3_downtime", label: "Indisponibilidad superior a 2 horas en funciones críticas" },
                  { key: "q4_dataloss", label: "Pérdida de integridad o confidencialidad de datos" },
                  { key: "q5_ecosystem", label: "Impacto sistémico hacia terceros o mercados" },
                ].map((q) => (
                  <label key={q.key} className="flex items-center gap-3 p-2 bg-[var(--g-surface-subtle)] rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={doraRts[q.key as keyof typeof doraRts]}
                      onChange={(e) => setDoraRts({ ...doraRts, [q.key]: e.target.checked })}
                      className="h-4 w-4 rounded text-[var(--g-brand-3308)]"
                    />
                    <span className="text-xs text-[var(--g-text-primary)] font-medium">{q.label}</span>
                  </label>
                ))}

                <div className="pt-2 border-t border-[var(--g-border-subtle)]">
                  <label className="flex items-center gap-3 p-2 bg-[var(--status-warning)]/10 border border-[var(--status-warning)]/30 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.affects_clients}
                      onChange={(e) => set("affects_clients", e.target.checked)}
                      className="h-4 w-4 rounded text-[var(--g-brand-3308)]"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-[var(--g-text-primary)] block">Afecta a los intereses financieros de los clientes</span>
                      <span className="text-[var(--g-text-secondary)]">Activa la obligación de comunicación inmediata a clientes bajo DORA Art. 19.</span>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {isGdpr && (
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-3 bg-[var(--status-error)]/10 border border-[var(--status-error)]/30 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.high_risk_data_subjects}
                    onChange={(e) => set("high_risk_data_subjects", e.target.checked)}
                    className="h-4 w-4 rounded text-[var(--g-brand-3308)]"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-[var(--status-error)] block">Entraña Alto Riesgo para los derechos y libertades (Art. 34 RGPD)</span>
                    <span className="text-[var(--g-text-secondary)]">Requiere comunicación obligatoria y sin dilación indebida a los interesados afectados.</span>
                  </div>
                </label>
              </div>
            )}
          </div>
        )}

        {/* Step 4 — Plazos y Confirmación */}
        {step === 4 && (
          <div className="space-y-5 text-xs">
            <div className="p-4 bg-[var(--g-surface-subtle)] border border-[var(--g-border-subtle)] rounded space-y-2">
              <h2 className="text-sm font-bold text-[var(--g-text-primary)]">
                Resumen de Relojes Regulatorios Activados
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
                {isDora ? (
                  <>
                    <div className="p-2.5 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] rounded">
                      <div className="text-[10px] uppercase font-bold text-[var(--status-error)]">1. Notificación Inicial:</div>
                      <div className="font-semibold mt-0.5">{doraClocks.initialNotificationDeadline.toLocaleString("es-ES")}</div>
                      <div className="text-[9px] text-[var(--g-text-secondary)]">Max 4h tras clasificar / 24h conocer</div>
                    </div>
                    <div className="p-2.5 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] rounded">
                      <div className="text-[10px] uppercase font-bold text-[var(--g-brand-3308)]">2. Informe Intermedio:</div>
                      <div className="font-semibold mt-0.5">{doraClocks.intermediateReportDeadline.toLocaleString("es-ES")}</div>
                      <div className="text-[9px] text-[var(--g-text-secondary)]">Max 72h tras notificación inicial</div>
                    </div>
                    <div className="p-2.5 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] rounded">
                      <div className="text-[10px] uppercase font-bold text-[var(--g-text-secondary)]">3. Informe Final:</div>
                      <div className="font-semibold mt-0.5">{doraClocks.finalReportDeadline.toLocaleDateString("es-ES")}</div>
                      <div className="text-[9px] text-[var(--g-text-secondary)]">Max 1 mes tras informe intermedio</div>
                    </div>
                  </>
                ) : isNis2 ? (
                  <>
                    <div className="p-2.5 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] rounded">
                      <div className="text-[10px] uppercase font-bold text-[var(--status-error)]">Alerta Temprana:</div>
                      <div className="font-semibold mt-0.5">{nis2Clocks.earlyWarningDeadline.toLocaleString("es-ES")}</div>
                      <div className="text-[9px] text-[var(--g-text-secondary)]">Max 24 horas</div>
                    </div>
                    <div className="p-2.5 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] rounded">
                      <div className="text-[10px] uppercase font-bold text-[var(--g-brand-3308)]">Notificación:</div>
                      <div className="font-semibold mt-0.5">{nis2Clocks.incidentNotificationDeadline.toLocaleString("es-ES")}</div>
                      <div className="text-[9px] text-[var(--g-text-secondary)]">Max 72 horas</div>
                    </div>
                    <div className="p-2.5 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] rounded">
                      <div className="text-[10px] uppercase font-bold text-[var(--g-text-secondary)]">Informe Final:</div>
                      <div className="font-semibold mt-0.5">{nis2Clocks.finalReportDeadline.toLocaleDateString("es-ES")}</div>
                      <div className="text-[9px] text-[var(--g-text-secondary)]">Max 1 mes</div>
                    </div>
                  </>
                ) : (
                  <div className="p-2.5 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] rounded col-span-3">
                    <div className="text-[10px] uppercase font-bold text-[var(--status-error)]">Notificación AEPD:</div>
                    <div className="font-semibold mt-0.5">{gdprClocks.authorityNotificationDeadline.toLocaleString("es-ES")} (72 horas)</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Bottom actions */}
        <div className="mt-6 flex items-center justify-between pt-4 border-t border-[var(--g-border-subtle)]">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s - 1) as StepNum)}
              className="px-4 py-2 text-xs font-semibold border border-[var(--g-border-subtle)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] transition-colors"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              Anterior
            </button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <button
              type="button"
              disabled={!canAdvance(step)}
              onClick={() => setStep((s) => (s + 1) as StepNum)}
              className="px-5 py-2 text-xs font-semibold bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] disabled:opacity-50 transition-colors"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              Siguiente
            </button>
          ) : (
            <button
              type="button"
              disabled={createIncident.isPending}
              onClick={handleSubmit}
              className="px-6 py-2 text-xs font-semibold bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] transition-colors flex items-center gap-2"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              {createIncident.isPending ? "Registrando…" : "Registrar y Activar Relojes"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
