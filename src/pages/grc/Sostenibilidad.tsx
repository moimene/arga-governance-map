import { Link } from "react-router-dom";
import { Leaf, Users2, Scale, FileText, Info } from "lucide-react";
import { useTenantBranding } from "@/context/TenantBrandContext";
import { useTenantContext } from "@/context/TenantContext";
import { groupFullLabel } from "@/lib/tenant-brand-labels";
import {
  ESG_ORGANOS,
  ESG_POLITICA,
  esgVisibleParaTenant,
  PLAN_SOSTENIBILIDAD,
  COMPROMISOS_ESG,
  PRINCIPIOS_PACTO_MUNDIAL,
  type CompromisoEsg,
} from "../../../scripts/garrigues/esg/plan-sostenibilidad";

const EJE_LABEL: Record<CompromisoEsg["eje"], string> = {
  AMBIENTAL: "Ambiental",
  SOCIAL: "Social",
  GOBERNANZA: "Gobernanza",
};

const EJE_ICON: Record<CompromisoEsg["eje"], typeof Leaf> = {
  AMBIENTAL: Leaf,
  SOCIAL: Users2,
  GOBERNANZA: Scale,
};

function CompromisoCard({ compromiso }: { compromiso: CompromisoEsg }) {
  return (
    <article
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
      style={{ borderRadius: "var(--g-radius-md)" }}
    >
      <h3 className="text-sm font-semibold text-[var(--g-text-primary)]">{compromiso.titulo}</h3>
      <blockquote className="mt-2 border-l-2 border-[var(--g-brand-3308)] pl-3 text-xs italic leading-relaxed text-[var(--g-text-secondary)]">
        «{compromiso.cita}»
      </blockquote>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
        <span
          className="inline-flex items-center bg-[var(--g-surface-subtle)] px-2 py-0.5 font-medium text-[var(--g-text-primary)]"
          style={{ borderRadius: "var(--g-radius-full)" }}
        >
          {compromiso.fuente}
        </span>
        {compromiso.responsable ? (
          <span className="text-[var(--g-text-secondary)]">
            Responsable: <strong className="font-medium">{compromiso.responsable}</strong>
          </span>
        ) : (
          // El ownership solo se atribuye donde la fuente lo dice. Tres de los
          // siete compromisos no nombran responsable, y se dice en vez de
          // asignarlo al comité "que parece" que toca.
          <span className="text-[var(--g-text-secondary)] italic">
            La fuente no designa responsable para este compromiso
          </span>
        )}
      </div>
    </article>
  );
}

export default function Sostenibilidad() {
  const branding = useTenantBranding();
  const { tenantId } = useTenantContext();

  // Guard por DATO, no por literal de tenant: el catálogo declara a qué tenant
  // pertenece, y la pantalla solo lo sirve a ese. Sin esto, ARGA vería la
  // política y los comités de Garrigues — que es exactamente la contaminación
  // cruzada que este carril lleva el día cerrando. El día que otro tenant tenga
  // su propio catálogo ESG, esto sigue siendo correcto sin tocarlo.
  // Falla CERRADO — la regla vive en el catálogo y está probada allí.
  if (!esgVisibleParaTenant(tenantId)) {
    return (
      <div className="min-w-0 space-y-3 p-4 sm:p-6">
        <h1 className="text-2xl font-bold text-[var(--g-text-primary)]">Sostenibilidad y ESG</h1>
        <p className="text-sm text-[var(--g-text-secondary)]">
          No hay contenido de sostenibilidad publicado para este grupo.
        </p>
      </div>
    );
  }

  const grupo = branding ? groupFullLabel(branding) : "el grupo";

  const porEje = (["AMBIENTAL", "SOCIAL", "GOBERNANZA"] as const).map((eje) => ({
    eje,
    items: COMPROMISOS_ESG.filter((c) => c.eje === eje),
  }));

  return (
    <div className="min-w-0 space-y-6 p-4 sm:p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-[var(--g-text-primary)]">Sostenibilidad y ESG</h1>
        <p className="text-sm text-[var(--g-text-secondary)]">
          Gobernanza de la sostenibilidad de {grupo}: quién la dirige, con qué política y con qué
          compromisos suscritos.
        </p>
      </header>

      {/* Procedencia. Va ARRIBA y no en un pie: es la limitación que define este
          módulo, no una nota al margen. */}
      <section
        className="flex items-start gap-3 border border-[var(--g-border-default)] bg-[var(--g-surface-subtle)] p-4"
        style={{ borderRadius: "var(--g-radius-lg)" }}
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--g-brand-3308)]" aria-hidden="true" />
        <div className="text-xs leading-relaxed text-[var(--g-text-primary)]">
          <strong>Este módulo no publica indicadores.</strong> {PLAN_SOSTENIBILIDAD.motivo_ausencia}{" "}
          Lo que sí consta —los órganos que gobiernan la materia, la política aplicable y los
          compromisos suscritos— se muestra con su cita literal y su fuente.
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {ESG_ORGANOS.map((organo) => (
          <div
            key={organo.slug}
            className="border border-[var(--g-border-default)] bg-[var(--g-surface-card)] p-4"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--g-text-secondary)]">
              Órgano responsable
            </div>
            {/* La ficha de órgano resuelve por SLUG, no por UUID. */}
            <Link
              to={`/organos/${organo.slug}`}
              className="mt-1 block text-sm font-semibold text-[var(--g-link)] hover:text-[var(--g-link-hover)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--g-border-focus)]"
            >
              {organo.nombre}
            </Link>
            <p className="mt-2 text-xs leading-relaxed text-[var(--g-text-secondary)]">
              {organo.mision}
            </p>
            <div className="mt-3 text-[11px] text-[var(--g-text-secondary)]">
              {organo.miembros} miembros
            </div>
          </div>
        ))}

        <div
          className="border border-[var(--g-border-default)] bg-[var(--g-surface-card)] p-4"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--g-text-secondary)]">
            Política aplicable
          </div>
          <Link
            to={`/politicas/${ESG_POLITICA}`}
            className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-[var(--g-link)] hover:text-[var(--g-link-hover)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--g-border-focus)]"
          >
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            {ESG_POLITICA}
          </Link>
          <p className="mt-2 text-xs leading-relaxed text-[var(--g-text-secondary)]">
            Política sobre calidad, prevención de riesgos laborales, medio ambiente y
            responsabilidad social corporativa.
          </p>
        </div>
      </section>

      {/* El Plan: se nombra con su periodo y se declara lo que falta. Un estado
          vacío explicado es contenido; uno rellenado es ruido. */}
      <section
        className="border border-[var(--g-border-default)] bg-[var(--g-surface-card)] p-5"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
          {PLAN_SOSTENIBILIDAD.nombre}
        </h2>
        <div className="mt-1 text-[11px] text-[var(--g-text-secondary)]">
          Periodo {PLAN_SOSTENIBILIDAD.periodo}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-[var(--g-text-secondary)]">
          {PLAN_SOSTENIBILIDAD.motivo_ausencia}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-[var(--g-text-secondary)]">
          El seguimiento del Plan corresponde a la{" "}
          <Link
            to={`/organos/${ESG_ORGANOS[1].slug}`}
            className="text-[var(--g-link)] underline hover:text-[var(--g-link-hover)]"
          >
            {ESG_ORGANOS[1].nombre}
          </Link>
          , con apoyo del Grupo de Trabajo de Medioambiente.
        </p>
      </section>

      {porEje.map(({ eje, items }) => {
        const Icon = EJE_ICON[eje];
        return (
          <section key={eje} className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--g-text-primary)]">
              <Icon className="h-4 w-4 text-[var(--g-brand-3308)]" aria-hidden="true" />
              {EJE_LABEL[eje]}
              <span className="text-[11px] font-normal text-[var(--g-text-secondary)]">
                {items.length} compromiso{items.length === 1 ? "" : "s"}
              </span>
            </h2>
            <div className="grid gap-3 lg:grid-cols-2">
              {items.map((c) => (
                <CompromisoCard key={c.titulo} compromiso={c} />
              ))}
            </div>
          </section>
        );
      })}

      <section
        className="border border-[var(--g-border-default)] bg-[var(--g-surface-card)] p-5"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
          Los diez principios del Pacto Mundial de las Naciones Unidas
        </h2>
        <p className="mt-1 text-[11px] text-[var(--g-text-secondary)]">
          Adhesión suscrita en marzo de 2002 (PI-22 §3.4). Se sirven como el compromiso adquirido,
          no como indicadores de desempeño.
        </p>
        <ol className="mt-3 space-y-2">
          {PRINCIPIOS_PACTO_MUNDIAL.map((p, i) => (
            <li key={p} className="flex gap-3 text-xs leading-relaxed text-[var(--g-text-secondary)]">
              <span className="shrink-0 font-mono text-[var(--g-text-primary)]">{i + 1}.</span>
              <span>{p}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
