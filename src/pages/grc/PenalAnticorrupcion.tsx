import { Link } from "react-router-dom";
import { Activity, ArrowRight, FileText, PlusCircle, Scale, ShieldCheck } from "lucide-react";
import { useRisks } from "@/hooks/useRisks";
import {
  controlStatusLabel,
  useAllControlsByObligationIds,
  useObligationsList,
} from "@/hooks/usePoliciesObligations";

const TAXONOMY_TERMS = [
  "penal",
  "anticorrup",
  "corrupcion",
  "corrupción",
  "soborno",
  "cohecho",
  "fraude",
  "blanqueo",
  "sancion",
  "sanción",
  "aml",
  "compliance penal",
  "canal interno",
];

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function matchesTaxonomy(...values: Array<string | null | undefined>) {
  const text = normalize(values.join(" "));
  return TAXONOMY_TERMS.some((term) => text.includes(normalize(term)));
}

export default function PenalAnticorrupcion() {
  const { data: risks = [], isLoading: loadingRisks } = useRisks();
  const { data: obligations = [], isLoading: loadingObligations } = useObligationsList();

  const penalRisks = risks.filter((risk) =>
    risk.module_id === "penal" ||
    matchesTaxonomy(risk.code, risk.title, risk.description, risk.module_id, risk.obligations?.title),
  );

  const penalObligations = obligations.filter((obligation) =>
    matchesTaxonomy(obligation.code, obligation.title, obligation.source, obligation.policy_title),
  );
  const obligationIds = penalObligations.map((obligation) => obligation.id);
  const { data: controls = [], isLoading: loadingControls } = useAllControlsByObligationIds(obligationIds);

  const loading = loadingRisks || loadingObligations || loadingControls;
  const openRisks = penalRisks.filter((risk) => risk.status !== "Cerrado").length;
  const weakControls = controls.filter((control) => control.status !== "Efectivo").length;

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Scale className="h-5 w-5 text-[var(--g-brand-3308)]" />
            <h1 className="text-2xl font-bold text-[var(--g-text-primary)]">
              Penal / Anticorrupción
            </h1>
          </div>
          <p className="max-w-3xl text-sm leading-6 text-[var(--g-text-secondary)]">
            Vista GRC conectada sobre riesgos, obligaciones y controles existentes. No usa tabla penal dedicada ni adopta el backbone GRC futuro.
          </p>
        </div>
        <Link
          to="/grc/risk-360/nuevo?module=penal"
          className="inline-flex items-center justify-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <PlusCircle className="h-4 w-4" />
          Nuevo riesgo penal
        </Link>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {[
          { label: "Riesgos taxonomía penal", value: penalRisks.length, icon: Activity },
          { label: "Riesgos abiertos", value: openRisks, icon: ShieldCheck },
          { label: "Obligaciones vinculadas", value: penalObligations.length, icon: FileText },
          { label: "Controles no efectivos", value: weakControls, icon: Scale },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="border border-[var(--g-border-default)] bg-[var(--g-surface-card)] p-4"
              style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
            >
              <Icon className="mb-3 h-5 w-5 text-[var(--g-brand-3308)]" />
              <div className="text-2xl font-bold text-[var(--g-text-primary)]">{loading ? "..." : item.value}</div>
              <div className="mt-1 text-xs text-[var(--g-text-secondary)]">{item.label}</div>
            </div>
          );
        })}
      </div>

      <div
        className="border border-[var(--g-border-default)] bg-[var(--g-surface-card)]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="flex items-center justify-between border-b border-[var(--g-border-subtle)] px-6 py-4">
          <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
            Riesgos penales y anticorrupción
          </h2>
          <span className="text-xs text-[var(--g-text-secondary)]">Source: risks</span>
        </div>
        {loadingRisks ? (
          <div className="p-6 text-sm text-[var(--g-text-secondary)]">Cargando riesgos...</div>
        ) : penalRisks.length === 0 ? (
          <div className="p-8 text-center text-sm text-[var(--g-text-secondary)]">
            Sin riesgos clasificados con la taxonomía penal actual.
          </div>
        ) : (
          <div className="divide-y divide-[var(--g-border-subtle)]">
            {penalRisks.map((risk) => (
              <div key={risk.id} className="flex flex-col gap-3 px-6 py-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--g-text-primary)]">{risk.code}</span>
                    <span
                      className="bg-[var(--g-surface-subtle)] px-2 py-0.5 text-xs font-medium text-[var(--g-text-secondary)]"
                      style={{ borderRadius: "var(--g-radius-full)" }}
                    >
                      {risk.status ?? "Sin estado"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--g-text-primary)]">{risk.title}</p>
                  {risk.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-[var(--g-text-secondary)]">{risk.description}</p>
                  )}
                </div>
                <Link
                  to={`/grc/risk-360/${risk.id}/editar`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-[var(--g-link)] hover:text-[var(--g-link-hover)]"
                >
                  Editar
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div
          className="border border-[var(--g-border-default)] bg-[var(--g-surface-card)]"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div className="border-b border-[var(--g-border-subtle)] px-6 py-4">
            <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
              Obligaciones de referencia
            </h2>
            <p className="mt-1 text-xs text-[var(--g-text-secondary)]">Source: obligations</p>
          </div>
          <div className="divide-y divide-[var(--g-border-subtle)]">
            {penalObligations.slice(0, 8).map((obligation) => (
              <div key={obligation.id} className="px-6 py-4">
                <div className="text-sm font-semibold text-[var(--g-text-primary)]">{obligation.code}</div>
                <div className="mt-1 text-sm text-[var(--g-text-secondary)]">{obligation.title}</div>
              </div>
            ))}
            {!loadingObligations && penalObligations.length === 0 && (
              <div className="p-6 text-sm text-[var(--g-text-secondary)]">
                Sin obligaciones etiquetadas por la taxonomía actual.
              </div>
            )}
          </div>
        </div>

        <div
          className="border border-[var(--g-border-default)] bg-[var(--g-surface-card)]"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div className="border-b border-[var(--g-border-subtle)] px-6 py-4">
            <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
              Controles vinculados
            </h2>
            <p className="mt-1 text-xs text-[var(--g-text-secondary)]">Source: controls por obligación</p>
          </div>
          <div className="divide-y divide-[var(--g-border-subtle)]">
            {controls.slice(0, 8).map((control) => (
              <div key={control.id} className="px-6 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[var(--g-text-primary)]">{control.code}</div>
                    <div className="mt-1 text-sm text-[var(--g-text-secondary)]">{control.name}</div>
                  </div>
                  <span
                    className="shrink-0 bg-[var(--g-surface-subtle)] px-2 py-0.5 text-xs font-medium text-[var(--g-text-secondary)]"
                    style={{ borderRadius: "var(--g-radius-full)" }}
                  >
                    {controlStatusLabel(control.status)}
                  </span>
                </div>
              </div>
            ))}
            {!loadingControls && controls.length === 0 && (
              <div className="p-6 text-sm text-[var(--g-text-secondary)]">
                Sin controles vinculados a obligaciones penales en la taxonomía actual.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
