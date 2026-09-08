import { ClipboardList, Sliders } from "lucide-react";
import { MATURITY_LEVELS, difficultyLabel } from "@/lib/aims/catalog-aesia";
import { resumenPlan, type AccionPDA } from "@/lib/aims/plan-adaptacion";
import type { FindingPintable } from "./tipos";

export interface PlanYNotasProps {
  acciones: AccionPDA[] | null | undefined;
  findings: FindingPintable[] | null | undefined;
  /** Códigos que el marco conoce: lo que quede fuera es medida adicional. */
  catalogCodes: Set<string>;
  notes: string | null | undefined;
}

/**
 * El Plan de Adaptación como tabla de acciones.
 *
 * Cuando la evaluación no lo trae —las anteriores al 2026-09-07 no lo
 * tienen— no se pinta nada aquí y el plan sigue leyéndose en la sección de
 * notas, donde vivía como prosa. No se INVENTA un plan retroactivo.
 */
function PlanDeAdaptacionEstructurado({ acciones }: { acciones: AccionPDA[] | null | undefined }) {
  const items = Array.isArray(acciones) ? acciones : [];
  if (items.length === 0) return null;
  const resumen = resumenPlan(items, new Date());
  return (
    <section
      className="p-6 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] space-y-3 break-inside-avoid"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--g-border-subtle)] pb-3">
        <h2 className="text-sm font-bold text-[var(--g-text-primary)]">
          Plan de Adaptación ({resumen.total} acciones)
        </h2>
        <span className="text-xs text-[var(--g-text-secondary)]">
          {resumen.alta} de prioridad alta · {resumen.sinResponsable} sin responsable ·{" "}
          {resumen.vencidas} vencidas
        </span>
      </div>
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="border-b border-[var(--g-border-subtle)] text-[var(--g-text-secondary)]">
            <th className="pb-2 pr-3 font-semibold">Medida</th>
            <th className="pb-2 pr-3 font-semibold">Acción</th>
            <th className="pb-2 pr-3 font-semibold">Prioridad</th>
            <th className="pb-2 pr-3 font-semibold">Vence</th>
            <th className="pb-2 font-semibold">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--g-border-subtle)]">
          {items.map((a) => (
            <tr key={a.measureCode}>
              <td className="py-2 pr-3 font-mono font-semibold text-[var(--g-brand-3308)]">{a.measureCode}</td>
              <td className="py-2 pr-3 text-[var(--g-text-primary)]">{a.titulo}</td>
              <td className="py-2 pr-3">
                <span
                  className={`px-2 py-0.5 text-[10px] font-bold ${
                    a.prioridad === "ALTA"
                      ? "bg-[var(--status-error)] text-[var(--g-text-inverse)]"
                      : a.prioridad === "MEDIA"
                      ? "bg-[var(--status-warning)] text-[var(--g-text-inverse)]"
                      : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
                  }`}
                  style={{ borderRadius: "var(--g-radius-full)" }}
                >
                  {a.prioridad}
                </span>
              </td>
              <td className="py-2 pr-3 text-[var(--g-text-secondary)]">{a.vence_el ?? "Sin fecha"}</td>
              <td className="py-2 text-[var(--g-text-secondary)]">{a.estado}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/**
 * Medidas Adicionales: las que quien evalúa añade porque el catálogo no las
 * trae. Se pintan aparte porque no pertenecen a ningún requisito del marco y,
 * si se mezclaran, el desglose por artículo dejaría de cuadrar.
 *
 * Hasta el 2026-09-07 no había ninguna que pintar: se perdían al enviar.
 */
function MedidasAdicionales({
  findings,
  catalogCodes,
}: {
  findings: FindingPintable[] | null | undefined;
  catalogCodes: Set<string>;
}) {
  const adicionales = (findings ?? []).filter(
    (f) => f.kind === "MA" || (!catalogCodes.has(f.code) && f.code?.startsWith("MA_")),
  );
  if (adicionales.length === 0) return null;
  return (
    <section
      className="p-6 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] space-y-3 break-inside-avoid"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="flex items-center gap-2 border-b border-[var(--g-border-subtle)] pb-3">
        <Sliders className="w-4 h-4 text-[var(--g-brand-3308)]" />
        <h2 className="text-sm font-bold text-[var(--g-text-primary)]">
          Medidas adicionales ({adicionales.length})
        </h2>
      </div>
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="border-b border-[var(--g-border-subtle)] text-[var(--g-text-secondary)]">
            <th className="pb-2 font-semibold">Código</th>
            <th className="pb-2 font-semibold">Descripción</th>
            <th className="pb-2 font-semibold">Requisito</th>
            <th className="pb-2 font-semibold">Madurez</th>
            <th className="pb-2 font-semibold">Dificultad</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--g-border-subtle)]">
          {adicionales.map((f) => (
            <tr key={f.code}>
              <td className="py-2.5 font-mono text-[var(--g-brand-3308)] font-semibold">{f.code}</td>
              <td className="py-2.5 pr-4 text-[var(--g-text-primary)]">{f.title || "—"}</td>
              <td className="py-2.5 text-[var(--g-text-secondary)]">{f.requirementCode || "—"}</td>
              <td className="py-2.5 text-[var(--g-text-primary)]">
                {f.status ? `${f.status} — ${MATURITY_LEVELS[f.status]?.title ?? f.status}` : "Pendiente"}
              </td>
              <td className="py-2.5 text-[var(--g-text-secondary)]">{difficultyLabel(f.difficulty)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/**
 * Notas y Plan de Adaptación.
 *
 * No se renderizaban ni en el informe ni al imprimir. En el piloto de Harvey el
 * PDA —seis acciones con responsable, prioridad y fecha— vive entero en
 * `notes`, así que el documento imprimible salía sin el plan que lo justifica.
 *
 * `whitespace-pre-line` porque el texto persistido lleva sus propios saltos de
 * línea: renderizarlo en un párrafo normal los colapsaba y la lista numerada se
 * leía como un chorro.
 */
function NotasYPlanDeAdaptacion({ notes }: { notes: string | null | undefined }) {
  const texto = (notes ?? "").trim();
  if (!texto) return null;
  return (
    <section
      className="p-6 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] space-y-3 break-inside-avoid"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="flex items-center gap-2 border-b border-[var(--g-border-subtle)] pb-3">
        <ClipboardList className="w-4 h-4 text-[var(--g-brand-3308)]" />
        <h2 className="text-sm font-bold text-[var(--g-text-primary)]">
          Notas y Plan de Adaptación
        </h2>
      </div>
      <p className="text-sm text-[var(--g-text-primary)] whitespace-pre-line leading-relaxed">
        {texto}
      </p>
    </section>
  );
}

/** Cierre del informe: plan estructurado, medidas adicionales y notas. */
export default function PlanYNotas({ acciones, findings, catalogCodes, notes }: PlanYNotasProps) {
  return (
    <>
      <PlanDeAdaptacionEstructurado acciones={acciones} />
      <MedidasAdicionales findings={findings} catalogCodes={catalogCodes} />
      <NotasYPlanDeAdaptacion notes={notes} />
    </>
  );
}
