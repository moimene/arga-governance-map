import { forwardRef, type ReactNode } from "react";
import { HelpCircle } from "lucide-react";

export interface MateriaHelpItem {
  id: string;
  label: string;
  definition: string;
  consequence: string;
  action: string;
}

export interface MateriaHelpSection {
  id: string;
  title: string;
  items: MateriaHelpItem[];
}

interface MateriaCatalogHelpProps {
  sections: MateriaHelpSection[];
  title?: string;
}

export const MateriaCatalogHelp = forwardRef<HTMLDetailsElement, MateriaCatalogHelpProps>(
  ({ sections, title = "Cómo interpretar el catálogo" }, ref) => (
    <details
      ref={ref}
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-3"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <summary className="min-h-11 cursor-pointer py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--g-text-primary)]">
          <HelpCircle className="h-4 w-4 text-[var(--g-brand-3308)]" aria-hidden="true" />
          {title}
        </h2>
      </summary>
      <p className="mt-1 text-xs leading-5 text-[var(--g-text-secondary)]">
        Abre cualquier concepto para ver su definición, su consecuencia práctica y la acción recomendada.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        {sections.map((section) => (
          <section key={section.id} aria-labelledby={`materia-help-${section.id}`}>
            <h3
              id={`materia-help-${section.id}`}
              className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-primary)]"
            >
              {section.title}
            </h3>
            <div className="mt-2 space-y-2">
              {section.items.map((item) => (
                <details
                  key={item.id}
                  className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 open:bg-[var(--g-surface-subtle)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-[var(--g-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2">
                    {item.label}
                  </summary>
                  <dl className="mt-3 space-y-2 text-xs leading-5 text-[var(--g-text-secondary)]">
                    <HelpDefinition label="Definición">{item.definition}</HelpDefinition>
                    <HelpDefinition label="Consecuencia">{item.consequence}</HelpDefinition>
                    <HelpDefinition label="Qué hacer">{item.action}</HelpDefinition>
                  </dl>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </details>
  ),
);

MateriaCatalogHelp.displayName = "MateriaCatalogHelp";

function HelpDefinition({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="font-semibold text-[var(--g-text-primary)]">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
