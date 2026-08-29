import { useState } from "react";
import { 
  AlertOctagon, CheckCircle2, Sliders, ShieldAlert, 
  HelpCircle, Clock, Send, Users, Activity, FileText 
} from "lucide-react";
import { 
  classifyDoraIncident, 
  type DoraIncidentThresholdCriteria 
} from "@/lib/grc/regulatory-clocks";

const DEFAULT_CRITERIA: DoraIncidentThresholdCriteria = {
  clientsAffectedPct: 12,
  durationHours: 3.5,
  economicImpactEuros: 150000,
  affectsCriticalFunctions: true,
  dataIntegrityLoss: false,
  thirdPartyImpact: true,
};

export default function Thresholds() {
  const [criteria, setCriteria] = useState<DoraIncidentThresholdCriteria>(DEFAULT_CRITERIA);
  const result = classifyDoraIncident(criteria);

  return (
    <div className="p-6 space-y-6">
      <header>
        <div className="flex items-center gap-2 mb-1">
          <Sliders className="h-6 w-6 text-[var(--g-brand-3308)]" />
          <h1 className="text-2xl font-bold text-[var(--g-text-primary)]">
            Umbrales DORA y Clasificación de Incidentes Mayores
          </h1>
        </div>
        <p className="text-sm text-[var(--g-text-secondary)]">
          Configuración y simulación de criterios de materialidad conforme a DORA Art. 19 y Reglamento Delegado (UE) 2025/301.
        </p>
      </header>

      {/* Criterios Oficiales DORA Art. 19 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            title: "1. Afección a Clientes y Contrapartes",
            threshold: "≥ 10% de clientes o >100.000 usuarios",
            desc: "Clientes afectados por indisponibilidad, retrasos de transacciones o degradación de servicio.",
            icon: Users,
          },
          {
            title: "2. Duración e Indisponibilidad",
            threshold: "≥ 2 horas en funciones esenciales",
            desc: "Tiempo transcurrido desde la interrupción hasta el restablecimiento completo del servicio ordinario.",
            icon: Clock,
          },
          {
            title: "3. Impacto Financiero Material",
            threshold: "≥ 100.000 € en pérdidas directas",
            desc: "Costes directos de respuesta, multas, indemnizaciones o pérdidas económicas operativas.",
            icon: Activity,
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-4 space-y-2"
              style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-[var(--g-brand-3308)]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--g-text-primary)]">
                  {item.title}
                </h2>
              </div>
              <div className="inline-block px-2 py-0.5 text-xs font-semibold bg-[var(--g-surface-subtle)] text-[var(--g-brand-3308)] border border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-sm)" }}>
                Umbral: {item.threshold}
              </div>
              <p className="text-xs text-[var(--g-text-secondary)] leading-relaxed">
                {item.desc}
              </p>
            </div>
          );
        })}
      </div>

      {/* Simulador Interactivo de Clasificación */}
      <div
        className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-6 space-y-6"
        style={{ borderRadius: "var(--g-radius-xl)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="border-b border-[var(--g-border-subtle)] pb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[var(--g-text-primary)]">
              Simulador en Tiempo Real de Clasificación DORA
            </h2>
            <p className="text-xs text-[var(--g-text-secondary)]">
              Ajusta los parámetros del incidente para comprobar si se clasifica como Grave TIC y qué obligaciones perentorias se activan.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCriteria(DEFAULT_CRITERIA)}
            className="text-xs text-[var(--g-brand-3308)] hover:text-[var(--g-sec-700)] underline font-medium"
          >
            Restablecer valores demo
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Controles del Simulador */}
          <div className="space-y-5">
            <div>
              <div className="flex justify-between text-xs font-semibold text-[var(--g-text-primary)] mb-1">
                <span>% Clientes o Transacciones Afectadas:</span>
                <span className="font-mono text-[var(--g-brand-3308)]">{criteria.clientsAffectedPct}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={criteria.clientsAffectedPct}
                onChange={(e) => setCriteria({ ...criteria, clientsAffectedPct: Number(e.target.value) })}
                className="w-full h-2 bg-[var(--g-surface-muted)] accent-[var(--g-brand-3308)] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[var(--g-text-secondary)]">
                <span>0% (Sin afección)</span>
                <span className="text-[var(--status-error)]">≥10% Umbral Mayor</span>
                <span>100%</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-[var(--g-text-primary)] mb-1">
                <span>Duración Estimada de Indisponibilidad:</span>
                <span className="font-mono text-[var(--g-brand-3308)]">{criteria.durationHours} horas</span>
              </div>
              <input
                type="range"
                min="0"
                max="24"
                step="0.5"
                value={criteria.durationHours}
                onChange={(e) => setCriteria({ ...criteria, durationHours: Number(e.target.value) })}
                className="w-full h-2 bg-[var(--g-surface-muted)] accent-[var(--g-brand-3308)] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[var(--g-text-secondary)]">
                <span>0h</span>
                <span className="text-[var(--status-error)]">≥2h Umbral Mayor</span>
                <span>24h+</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-[var(--g-text-primary)] mb-1">
                <span>Impacto Económico Directo / Indirecto:</span>
                <span className="font-mono text-[var(--g-brand-3308)]">{criteria.economicImpactEuros.toLocaleString("es-ES")} €</span>
              </div>
              <input
                type="range"
                min="0"
                max="500000"
                step="10000"
                value={criteria.economicImpactEuros}
                onChange={(e) => setCriteria({ ...criteria, economicImpactEuros: Number(e.target.value) })}
                className="w-full h-2 bg-[var(--g-surface-muted)] accent-[var(--g-brand-3308)] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[var(--g-text-secondary)]">
                <span>0 €</span>
                <span className="text-[var(--status-error)]">≥100.000 € Umbral Mayor</span>
                <span>500.000 €+</span>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={criteria.affectsCriticalFunctions}
                  onChange={(e) => setCriteria({ ...criteria, affectsCriticalFunctions: e.target.checked })}
                  className="h-4 w-4 rounded border-[var(--g-border-default)] text-[var(--g-brand-3308)] focus:ring-[var(--g-brand-3308)]"
                />
                <span className="text-xs text-[var(--g-text-primary)] font-medium">
                  Afecta a funciones críticas o importantes (CIFA / Servicios Esenciales)
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={criteria.dataIntegrityLoss}
                  onChange={(e) => setCriteria({ ...criteria, dataIntegrityLoss: e.target.checked })}
                  className="h-4 w-4 rounded border-[var(--g-border-default)] text-[var(--g-brand-3308)] focus:ring-[var(--g-brand-3308)]"
                />
                <span className="text-xs text-[var(--g-text-primary)] font-medium">
                  Compromiso de integridad o confidencialidad de datos de clientes
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={criteria.thirdPartyImpact}
                  onChange={(e) => setCriteria({ ...criteria, thirdPartyImpact: e.target.checked })}
                  className="h-4 w-4 rounded border-[var(--g-border-default)] text-[var(--g-brand-3308)] focus:ring-[var(--g-brand-3308)]"
                />
                <span className="text-xs text-[var(--g-text-primary)] font-medium">
                  Impacto sistémico en cadena hacia terceros regulados o infraestructuras críticas
                </span>
              </label>
            </div>
          </div>

          {/* Resultado de la Clasificación y Relojes Activados */}
          <div
            className={`p-5 flex flex-col justify-between border ${
              result.isMajorIncident
                ? "bg-[var(--status-error)]/5 border-[var(--status-error)]/30"
                : "bg-[var(--g-surface-subtle)] border-[var(--g-border-subtle)]"
            }`}
            style={{ borderRadius: "var(--g-radius-lg)" }}
          >
            <div>
              <div className="flex items-center gap-2 mb-2">
                {result.isMajorIncident ? (
                  <ShieldAlert className="h-5 w-5 text-[var(--status-error)]" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-[var(--status-success)]" />
                )}
                <span className="text-xs uppercase font-bold text-[var(--g-text-secondary)]">
                  Resultado de Calificación
                </span>
              </div>
              <div
                className={`text-xl font-bold ${
                  result.isMajorIncident ? "text-[var(--status-error)]" : "text-[var(--status-success)]"
                }`}
              >
                {result.severityLevel}
              </div>
              <p className="text-xs text-[var(--g-text-primary)] mt-2 leading-relaxed">
                {result.rationale}
              </p>

              {/* Criterios activados */}
              <div className="mt-4 space-y-1.5">
                <div className="text-[11px] font-bold uppercase text-[var(--g-text-secondary)]">
                  Criterios concurrentes ({result.criteriaTriggered.length}):
                </div>
                {result.criteriaTriggered.length === 0 ? (
                  <div className="text-xs text-[var(--g-text-secondary)] italic">
                    Ningún umbral crítico superado.
                  </div>
                ) : (
                  result.criteriaTriggered.map((c, i) => (
                    <div key={i} className="text-xs text-[var(--g-text-primary)] flex items-start gap-1.5">
                      <span className="text-[var(--status-error)] font-bold">•</span>
                      <span>{c}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Acciones Obligatorias DORA */}
            <div className="mt-6 pt-4 border-t border-[var(--g-border-subtle)] space-y-2">
              <div className="text-xs font-bold text-[var(--g-text-primary)] uppercase">
                Obligaciones Legales Activadas:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className={`p-2 rounded border ${result.requiresSupervisoryNotification ? "bg-[var(--status-error)]/10 text-[var(--status-error)] border-[var(--status-error)]/30 font-semibold" : "bg-[var(--g-surface-card)] text-[var(--g-text-secondary)] border-[var(--g-border-subtle)]"}`}>
                  🔔 Notificación Supervisor: {result.requiresSupervisoryNotification ? "OBLIGATORIA (4h/24h)" : "No requerida"}
                </div>
                <div className={`p-2 rounded border ${result.requiresClientNotification ? "bg-[var(--status-warning)]/10 text-[var(--status-warning)] border-[var(--status-warning)]/30 font-semibold" : "bg-[var(--g-surface-card)] text-[var(--g-text-secondary)] border-[var(--g-border-subtle)]"}`}>
                  👥 Comunicación Clientes: {result.requiresClientNotification ? "OBLIGATORIA (Art. 19)" : "No requerida"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
