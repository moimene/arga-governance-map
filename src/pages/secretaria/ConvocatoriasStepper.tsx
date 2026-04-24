import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, ChevronDown, Globe } from "lucide-react";
import { evaluarConvocatoria } from "@/lib/rules-engine/convocatoria-engine";
import type { ConvocatoriaInput } from "@/lib/rules-engine/types";
import { checkNoticePeriodByType, useEntityRules } from "@/hooks/useJurisdiccionRules";
import { useEntitiesList } from "@/hooks/useEntities";

const STEPS = [
  { n: 1, label: "Sociedad y órgano",         hint: "Seleccionar sociedad, jurisdicción, tipo de reunión y órgano convocante" },
  { n: 2, label: "Fecha y plazo legal",        hint: "Calcular antelación según jurisdicción y forma jurídica" },
  { n: 3, label: "Orden del día",              hint: "Clasificar ítems en ordinaria / estatutaria / estructural" },
  { n: 4, label: "Destinatarios",              hint: "Seleccionar miembros del órgano o socios" },
  { n: 5, label: "Canales de publicación",     hint: "BORME / PSM / JORNAL / web corporativa" },
  { n: 6, label: "Adjuntos",                   hint: "Documentos de referencia y propuestas" },
  { n: 7, label: "Revisión y emisión",         hint: "Verificación de compliance y cierre" },
];

const JURIS_FLAGS: Record<string, string> = { ES: "🇪🇸", PT: "🇵🇹", BR: "🇧🇷", MX: "🇲🇽" };

const ENGINE_V2 = true;

export default function ConvocatoriasStepper() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandExplain, setExpandExplain] = useState(false);

  // Entity selector state
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const { data: entities = [] } = useEntitiesList();
  const selectedEntity = entities.find((e) => e.id === selectedEntityId) ?? null;
  const jurisdiction = selectedEntity?.jurisdiction ?? "ES";
  const tipoSocial = (selectedEntity as any)?.tipo_social ?? "SA";

  // Live jurisdiction rules from DB
  const { data: ruleSets = [] } = useEntityRules(
    selectedEntityId ? jurisdiction : undefined,
    selectedEntityId ? tipoSocial : undefined
  );
  const activeRuleSet = ruleSets.find((r) => r.is_active) ?? ruleSets[0] ?? null;
  const liveNoticeDays = activeRuleSet?.rule_config?.notice_min_days_first_call ?? null;

  const meetingDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
  const meeting_type = "ORDINARIA" as const;

  // V1 fallback (uses live days if available, else hardcoded map)
  const noticeOkV1 = checkNoticePeriodByType({
    meetingDate: meetingDate,
    jurisdiction: jurisdiction,
    convocationType: meeting_type,
    tipoSocial: tipoSocial,
  });

  // V2 engine evaluation
  const convocatoriaInput: ConvocatoriaInput = {
    tipoSocial: tipoSocial as any,
    organoTipo: "JUNTA_GENERAL",
    adoptionMode: "MEETING",
    fechaJunta: meetingDate,
    esCotizada: false,
    webInscrita: true,
    primeraConvocatoria: true,
    esJuntaUniversal: false,
    materias: ["APROBACION_CUENTAS"],
  };

  const evaluacionV2 = ENGINE_V2 ? evaluarConvocatoria(convocatoriaInput, []) : null;
  const noticeOk = ENGINE_V2 && evaluacionV2 ? evaluacionV2.ok : noticeOkV1;

  function handleEmitir() {
    if (!noticeOk || isSubmitting) return;
    setIsSubmitting(true);
    // En producción: llamada a Supabase para crear/actualizar la convocatoria
    setTimeout(() => {
      setIsSubmitting(false);
      navigate("/secretaria/convocatorias");
    }, 1000);
  }

  const isLastStep = current === STEPS.length;

  return (
    <div className="mx-auto max-w-[1200px] p-6">
      <button
        type="button"
        onClick={() => navigate("/secretaria/convocatorias")}
        className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--g-text-secondary)] hover:text-[var(--g-brand-3308)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Cancelar y volver
      </button>

      <div className="mb-6">
        <div className="text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
          Secretaría · Nueva convocatoria
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
          Asistente de convocatoria
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        {/* Stepper rail */}
        <nav
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-2"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          aria-label="Pasos"
        >
          {STEPS.map((s) => {
            const done = s.n < current;
            const active = s.n === current;
            return (
              <button
                key={s.n}
                type="button"
                onClick={() => setCurrent(s.n)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${
                  active
                    ? "bg-[var(--g-surface-subtle)] font-semibold text-[var(--g-brand-3308)]"
                    : "text-[var(--g-text-secondary)] hover:bg-[var(--g-surface-subtle)]/50"
                }`}
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center text-[11px] font-bold ${
                    done
                      ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                      : active
                      ? "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]"
                      : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
                  }`}
                  style={{ borderRadius: "var(--g-radius-full)" }}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : s.n}
                </span>
                <span className="flex-1 truncate">{s.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Step body */}
        <div
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-6"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <h2 className="text-lg font-semibold text-[var(--g-text-primary)]">
            Paso {current}. {STEPS[current - 1].label}
          </h2>
          <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
            {STEPS[current - 1].hint}
          </p>

          {/* Step 2: Motor V2 explain panel */}
          {current === 2 && ENGINE_V2 && evaluacionV2 && (
            <div
              className="mt-6 border-l-4 border-[var(--g-sec-300)] bg-[var(--g-sec-100)] p-4"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-[var(--g-text-primary)]">
                    Evaluación de antelación
                  </p>
                  <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
                    Motor de Reglas LSC v2
                  </p>
                </div>
                <span
                  className={`inline-flex h-6 rounded-full px-2.5 py-1 text-[11px] font-semibold text-[var(--g-text-inverse)]`}
                  style={{
                    backgroundColor: evaluacionV2.ok
                      ? "var(--status-success)"
                      : "var(--status-error)",
                  }}
                >
                  {evaluacionV2.ok ? "OK" : "ERROR"}
                </span>
              </div>

              {/* Main rule */}
              {evaluacionV2.explain[0] && (
                <div className="mt-3 space-y-2">
                  <p className="text-sm font-medium text-[var(--g-text-primary)]">
                    {evaluacionV2.antelacionDiasRequerida} días de antelación requerida
                  </p>
                  <div className="flex gap-2 text-xs text-[var(--g-text-secondary)]">
                    <span>📋 Fuente: {evaluacionV2.explain[0].fuente}</span>
                    {evaluacionV2.explain[0].referencia && (
                      <span>📝 {evaluacionV2.explain[0].referencia}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Documentos obligatorios checklist */}
              {evaluacionV2.documentosObligatorios.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-[var(--g-text-primary)]">
                    Documentos obligatorios
                  </p>
                  <div className="mt-2 space-y-2">
                    {evaluacionV2.documentosObligatorios.map((doc) => (
                      <label
                        key={doc.id}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded"
                          disabled
                        />
                        <span className="text-xs text-[var(--g-text-secondary)]">
                          {doc.nombre}
                          {doc.condicion && ` (${doc.condicion})`}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Inline error when notice period not met */}
              {!evaluacionV2.ok && (
                <div
                  className="mt-3 border-l-4 border-[var(--status-error)] bg-[var(--g-surface-card)] p-3"
                  role="alert"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <p className="text-xs font-medium text-[var(--status-error)]">
                    El plazo mínimo de antelación no está cumplido para la jurisdicción seleccionada.
                    Ajusta la fecha de la reunión antes de continuar.
                  </p>
                </div>
              )}

              {/* Expand explain tree */}
              <button
                type="button"
                onClick={() => setExpandExplain(!expandExplain)}
                className="mt-3 flex items-center gap-1 text-xs font-medium text-[var(--g-brand-3308)] hover:text-[var(--g-sec-700)]"
              >
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${
                    expandExplain ? "rotate-180" : ""
                  }`}
                />
                {expandExplain ? "Ocultar detalles" : "Ver detalles de evaluación"}
              </button>

              {/* Expanded explain tree */}
              {expandExplain && (
                <div className="mt-3 space-y-2 border-t border-[var(--g-border-subtle)] pt-3">
                  {evaluacionV2.explain.map((node, idx) => (
                    <div
                      key={idx}
                      className="text-xs text-[var(--g-text-secondary)]"
                    >
                      <p className="font-medium text-[var(--g-text-primary)]">
                        {node.regla}
                      </p>
                      <p>{node.mensaje}</p>
                      {node.referencia && (
                        <p className="text-[11px] text-[var(--g-text-secondary)]">
                          {node.fuente}: {node.referencia}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 1: Entity / Jurisdiction selector */}
          {current === 1 && (
            <div className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--g-text-primary)]">
                  Sociedad convocante
                </label>
                <select
                  value={selectedEntityId ?? ""}
                  onChange={(e) => setSelectedEntityId(e.target.value || null)}
                  className="w-full rounded border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <option value="">— Seleccionar sociedad —</option>
                  {entities.map((e) => (
                    <option key={e.id} value={e.id}>
                      {JURIS_FLAGS[(e as any).jurisdiction ?? "ES"] ?? "🏢"}{" "}
                      {e.legal_name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedEntity && (
                <div
                  className="flex items-center gap-3 p-3 bg-[var(--g-sec-100)] border border-[var(--g-sec-300)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <Globe className="h-4 w-4 shrink-0 text-[var(--g-brand-3308)]" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--g-text-primary)]">
                      {JURIS_FLAGS[jurisdiction] ?? "🏢"} {jurisdiction}
                      {(selectedEntity as any).tipo_social && (
                        <span className="ml-2 text-xs text-[var(--g-text-secondary)]">
                          {(selectedEntity as any).tipo_social}
                        </span>
                      )}
                    </p>
                    {liveNoticeDays != null && (
                      <p className="text-xs text-[var(--g-text-secondary)] mt-0.5">
                        Preaviso mínimo (TGMS): <span className="font-semibold text-[var(--g-brand-3308)]">{liveNoticeDays} días</span>
                        {activeRuleSet?.legal_reference && (
                          <span className="ml-1 text-[10px]">· {activeRuleSet.legal_reference}</span>
                        )}
                      </p>
                    )}
                    {activeRuleSet?.statutory_override && (
                      <p className="text-xs text-[var(--status-warning)] mt-0.5">
                        ⚠ statutory_override — confirmar plazos con estatutos de la entidad
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div
                className="border-l-4 border-[var(--g-sec-300)] bg-[var(--g-sec-100)] p-4"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <p className="text-sm text-[var(--g-text-primary)]">
                  Selecciona la sociedad para cargar las reglas jurisdiccionales aplicables.
                  El motor validará plazos, quórum y canales de publicación según la jurisdicción.
                </p>
              </div>
            </div>
          )}

          {/* Generic placeholder for steps 3-7 */}
          {current !== 1 && current !== 2 && (
            <div
              className="mt-6 border-l-4 border-[var(--g-sec-300)] bg-[var(--g-sec-100)] p-4"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <p className="text-sm text-[var(--g-text-primary)]">
                {isLastStep
                  ? "Revisa los datos de la convocatoria antes de emitirla. El sistema validará el plazo mínimo según la jurisdicción seleccionada."
                  : `Formulario del paso ${current} — implementación pendiente. En el demo se usan las convocatorias ya sembradas (CONV-001, CONV-002, CONV-003).`}
              </p>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrent((n) => Math.max(1, n - 1))}
              disabled={current === 1}
              className="inline-flex items-center gap-1 border border-[var(--g-border-subtle)] px-4 py-2 text-sm text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)] disabled:opacity-40"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              Anterior
            </button>

            {isLastStep ? (
              <div className="flex flex-col items-end gap-2">
                <button
                  type="button"
                  disabled={!noticeOk || isSubmitting}
                  onClick={handleEmitir}
                  aria-busy={isSubmitting}
                  className="inline-flex items-center gap-1 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  {isSubmitting ? "Emitiendo…" : "Emitir convocatoria"}
                </button>
                {!noticeOk && (
                  <p className="text-xs text-[var(--status-error)]">
                    El plazo mínimo de convocatoria no está cumplido para la jurisdicción seleccionada.
                  </p>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCurrent((n) => Math.min(STEPS.length, n + 1))}
                disabled={current === 2 && !noticeOk}
                aria-disabled={current === 2 && !noticeOk}
                className="inline-flex items-center gap-1 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:cursor-not-allowed disabled:opacity-50"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                Siguiente
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
