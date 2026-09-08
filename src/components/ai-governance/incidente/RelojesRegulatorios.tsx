import { Clock } from "lucide-react";
import {
  formatDeadline,
  formatRemainingTime,
  type MultiregimeClocks,
} from "@/lib/aims/incident-clocks";

export interface RelojesRegulatoriosProps {
  /** Ya evaluados en la página con `evaluateMultiregimeIncident`. */
  clocks: MultiregimeClocks;
  /** D-5: DORA no alcanza a todos los tenants y `branding.modules` lo oculta. */
  doraVisible: boolean;
}

/** Los tres plazos paralelos. No decide ninguno: sólo los pinta. */
export default function RelojesRegulatorios({ clocks, doraVisible }: RelojesRegulatoriosProps) {
  const riaRemaining = clocks.ria ? formatRemainingTime(clocks.ria.deadlineDate) : null;
  const gdprRemaining = clocks.gdpr ? formatRemainingTime(clocks.gdpr.deadlineDate) : null;
  const doraRemaining = clocks.dora ? formatRemainingTime(clocks.dora.initialDeadlineDate) : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-[var(--g-brand-3308)]" />
          <h2 className="text-base font-bold text-[var(--g-text-primary)]">
            Relojes Regulatorios Paralelos
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Reloj 1: RIA Art. 73 */}
        <div
          className="p-4 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] space-y-3"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div className="flex justify-between items-start">
            <div>
              <span className="font-mono text-[10px] font-bold bg-[var(--g-surface-subtle)] text-[var(--g-brand-3308)] px-2 py-0.5" style={{ borderRadius: "var(--g-radius-sm)" }}>
                EU AI ACT (Art. 73)
              </span>
              <h3 className="text-sm font-bold text-[var(--g-text-primary)] mt-1.5">Vigilancia de Mercado (AESIA)</h3>
            </div>
            {riaRemaining && (
              <span className={`px-2 py-0.5 text-[10px] ${riaRemaining.badgeClass}`} style={{ borderRadius: "var(--g-radius-full)" }}>
                {riaRemaining.label}
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--g-text-secondary)] leading-relaxed">
            {clocks.ria?.ruleDescription ??
              "El sistema asociado consta clasificado fuera del alto riesgo, así que el art. 73 no le alcanza: no hay plazo que contar."}
            {/* Este texto SÓLO se pinta cuando el motor ha omitido el reloj, y
                el motor lo omite únicamente con `isAiHighRisk === false`, es
                decir con clasificación registrada. Sin clasificación devuelve
                el reloj con `highRiskUnconfirmed`, y lo que se lee es el aviso
                de abajo. */}
          </p>
          {clocks.ria?.highRiskUnconfirmed && (
            <p className="text-[11px] text-[var(--status-warning)] leading-relaxed">
              El sistema asociado no tiene clasificación de riesgo registrada: no consta que el
              art. 73 le alcance. El plazo se muestra por prudencia, no como obligación acreditada.
            </p>
          )}
          <div className="pt-2 border-t border-[var(--g-border-subtle)] flex justify-between items-center text-xs">
            <span className="text-[var(--g-text-secondary)]">Vencimiento:</span>
            <span className="font-mono font-bold text-[var(--g-text-primary)]">
              {formatDeadline(clocks.ria?.deadlineDate)}
            </span>
          </div>
          {clocks.ria && (
            <p className="text-[11px] text-[var(--g-text-secondary)] leading-relaxed">
              Tipología del art. 73 no registrada: el incidente no tiene columna donde guardarla.
              El plazo se calcula asumiendo incidente grave ordinario (15 días naturales); al
              editar puede elegirse otra tipología, pero el cambio no se guarda con el incidente.
            </p>
          )}
        </div>

        {/* Reloj 2: RGPD Art. 33/34 */}
        <div
          className="p-4 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] space-y-3"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div className="flex justify-between items-start">
            <div>
              <span className="font-mono text-[10px] font-bold bg-[var(--g-surface-subtle)] text-[var(--g-brand-3308)] px-2 py-0.5" style={{ borderRadius: "var(--g-radius-sm)" }}>
                RGPD (Art. 33 / 34)
              </span>
              <h3 className="text-sm font-bold text-[var(--g-text-primary)] mt-1.5">Protección de Datos (AEPD)</h3>
            </div>
            {gdprRemaining && (
              <span className={`px-2 py-0.5 text-[10px] ${gdprRemaining.badgeClass}`} style={{ borderRadius: "var(--g-radius-full)" }}>
                {gdprRemaining.label}
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--g-text-secondary)] leading-relaxed">
            {clocks.gdpr?.ruleDescription ??
              "No consta declarado que el incidente afecte a datos personales, así que no se cuenta plazo del art. 33 RGPD."}
          </p>
          {clocks.gdpr?.dataSubjectNoticeArticleRef && (
            <p className="text-[11px] text-[var(--g-text-secondary)] leading-relaxed">
              Además, comunicación al interesado ({clocks.gdpr.dataSubjectNoticeArticleRef}) sin
              dilación indebida: no tiene plazo de 72 h.
            </p>
          )}
          <div className="pt-2 border-t border-[var(--g-border-subtle)] flex justify-between items-center text-xs">
            <span className="text-[var(--g-text-secondary)]">Vencimiento 72h:</span>
            <span className="font-mono font-bold text-[var(--g-text-primary)]">
              {formatDeadline(clocks.gdpr?.deadlineDate)}
            </span>
          </div>
        </div>

        {/* Reloj 3: DORA Art. 19 — sólo si el tenant tiene el módulo (D-5). */}
        {doraVisible && (
          <div
            className="p-4 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] space-y-3"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="flex justify-between items-start">
              <div>
                <span className="font-mono text-[10px] font-bold bg-[var(--g-surface-subtle)] text-[var(--g-brand-3308)] px-2 py-0.5" style={{ borderRadius: "var(--g-radius-sm)" }}>
                  DORA (Art. 19 · Rgto. Delegado 2025/301)
                </span>
                <h3 className="text-sm font-bold text-[var(--g-text-primary)] mt-1.5">Supervisor Financiero (DGSFP)</h3>
              </div>
              {doraRemaining && (
                <span className={`px-2 py-0.5 text-[10px] ${doraRemaining.badgeClass}`} style={{ borderRadius: "var(--g-radius-full)" }}>
                  {doraRemaining.label}
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--g-text-secondary)] leading-relaxed">
              {clocks.dora?.ruleDescription ??
                "No consta que la entidad esté sujeta a DORA ni que el incidente afecte a funciones críticas TIC: no se cuenta plazo."}
            </p>
            {clocks.dora?.assumesPriorReportsAtDeadline && (
              <p className="text-[11px] text-[var(--g-text-secondary)] leading-relaxed">
                Los hitos intermedio y final se calculan sobre el vencimiento del anterior, no sobre
                su envío real: son los últimos permisibles si cada informe se presenta justo en plazo.
              </p>
            )}
            <div className="pt-2 border-t border-[var(--g-border-subtle)] flex justify-between items-center text-xs">
              <span className="text-[var(--g-text-secondary)]">
                {clocks.dora?.initialRule === "24H_CAP_FROM_KNOWLEDGE"
                  ? "Informe inicial (tope 24 h desde conocimiento):"
                  : "Informe inicial (4 h desde clasificación):"}
              </span>
              <span className="font-mono font-bold text-[var(--g-text-primary)]">
                {formatDeadline(clocks.dora?.initialDeadlineDate)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
