import { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  AlertOctagon,
  ArrowRight,
  Building,
  CheckCircle,
  Eye,
  FileText,
  Globe,
  HelpCircle,
  Key,
  Leaf,
  Link as LinkIcon,
  Lock,
  Network,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

const sections = [
  { id: "que-es", label: "¿Qué es TGMS?" },
  { id: "principios", label: "Principios del sistema" },
  { id: "modulos", label: "Módulos" },
  { id: "marco", label: "Marco regulatorio" },
  { id: "glosario", label: "Glosario" },
];

const principios = [
  { icon: Network, title: "Governance-centric", desc: "La unidad central es la relación de gobernanza, no el documento." },
  { icon: Globe, title: "Federado por diseño", desc: "Corporativo define mínimos; las filiales gestionan particularidades locales." },
  { icon: LinkIcon, title: "Trazabilidad visible", desc: "Toda decisión es trazable hasta la norma, el control y la evidencia." },
  { icon: Lock, title: "Permisos granulares", desc: "RBAC + ABAC + scope = acceso solo a lo que necesitas." },
  { icon: Eye, title: "Auditoría nativa", desc: "Todo cambio queda registrado de forma inmutable." },
  { icon: ShieldAlert, title: "SII segregado", desc: "El canal interno tiene su propio entorno técnico y funcional." },
];

const modulos = [
  { icon: Network, title: "Governance Map", desc: "Grafo interactivo de entidades, órganos, normas y hallazgos.", to: "/governance-map" },
  { icon: Building, title: "Entidades", desc: "Registro maestro de las sociedades del grupo.", to: "/entidades" },
  { icon: Users, title: "Órganos y Reuniones", desc: "Composición, reglamentos, agenda y actas.", to: "/organos" },
  { icon: FileText, title: "Políticas y Normativa", desc: "Catálogo único con versiones, ámbito y revisión.", to: "/politicas" },
  { icon: ShieldCheck, title: "Obligaciones y Controles", desc: "Trazabilidad obligación -> control -> evidencia.", to: "/obligaciones" },
  { icon: Key, title: "Delegaciones y Poderes", desc: "Quién, qué, hasta cuándo — con alertas de vencimiento.", to: "/delegaciones" },
  { icon: ShieldAlert, title: "Hallazgos y Acciones", desc: "Observaciones, severidades, planes de remediación.", to: "/hallazgos" },
  { icon: Scale, title: "Conflictos e Integridad", desc: "Attestations anuales y operaciones vinculadas.", to: "/conflictos" },
  { icon: Leaf, title: "ESG", desc: "Sostenibilidad, clima y métricas no financieras.", to: "/esg" },
  { icon: AlertOctagon, title: "SII — Canal Interno", desc: "Canal de denuncias segregado (Ley 2/2023).", to: "/sii" },
];

const frameworks = [
  { name: "Solvencia II", tip: "Directiva 2009/138/CE — gobierno y solvencia de aseguradoras." },
  { name: "EIOPA Guidelines", tip: "Guidelines on System of Governance — autoridad europea." },
  { name: "DORA", tip: "Reglamento UE 2022/2554 — resiliencia operativa digital." },
  { name: "CSRD", tip: "Directiva UE 2022/2464 — reporte de sostenibilidad." },
  { name: "Ley 2/2023", tip: "España — Sistema interno de información (canal de denuncias)." },
  { name: "Directiva 2019/1937", tip: "Whistleblowing UE — protección de denunciantes." },
  { name: "Tres Líneas (IIA)", tip: "Modelo de las Tres Líneas de defensa — IIA 2020." },
  { name: "Código CNMV", tip: "Código de Buen Gobierno de las sociedades cotizadas." },
  { name: "ISO 37301", tip: "Sistema de gestión de compliance." },
  { name: "COSO", tip: "Marco internacional de control interno." },
];

const glosario = [
  { term: "Attestation", def: "Declaración formal de un consejero o directivo.", example: { label: "Campaña 2026", to: "/conflictos" } },
  { term: "Control", def: "Mecanismo que mitiga una obligación.", example: { label: "CTR-004", to: "/obligaciones/controles/CTR-004" } },
  { term: "Delegación", def: "Poder conferido a una persona con límites y vigencia.", example: { label: "D. Carlos Vaz", to: "/delegaciones/carlos-vaz-latam" } },
  { term: "Entidad", def: "Persona jurídica del grupo.", example: { label: "ARGA Brasil", to: "/entidades/arga-brasil" } },
  { term: "Evidencia", def: "Prueba documentada de la ejecución de un control.", example: { label: "Adjuntas a CTR-004", to: "/obligaciones/controles/CTR-004" } },
  { term: "Excepción", def: "Desviación autorizada de una norma corporativa.", example: { label: "ARGA Turquía", to: "/entidades/arga-turquia" } },
  { term: "Governance Map", def: "Grafo interactivo de relaciones de gobernanza.", example: { label: "Abrir mapa", to: "/governance-map" } },
  { term: "Hallazgo", def: "Observación de auditoría o cumplimiento.", example: { label: "HALL-008", to: "/hallazgos/HALL-008" } },
  { term: "Mandato", def: "Período de cargo de un miembro de un órgano.", example: { label: "Composición CdA", to: "/organos/consejo-administracion" } },
  { term: "Materialidad", def: "Clasificación de importancia de una entidad.", example: { label: "Ver entidades", to: "/entidades" } },
  { term: "Obligación", def: "Requisito normativo interno o externo.", example: { label: "OBL-DORA-003", to: "/obligaciones/OBL-DORA-003" } },
  { term: "Órgano", def: "Consejo, comisión u órgano de gobierno.", example: { label: "Consejo", to: "/organos/consejo-administracion" } },
  { term: "Política", def: "Norma interna del grupo.", example: { label: "PR-008", to: "/politicas/PR-008" } },
  { term: "SII", def: "Sistema Interno de Información (canal de denuncias).", example: { label: "Acceder", to: "/sii" } },
  { term: "Scope", def: "Ámbito de visión: Grupo, Región, País, Entidad.", example: { label: "Switcher arriba", to: "/" } },
];

const quickRoutes = [
  {
    icon: Network,
    title: "Entender una relación",
    desc: "Abre el mapa y localiza entidad, órgano, norma o hallazgo.",
    to: "/governance-map",
  },
  {
    icon: AlertOctagon,
    title: "Acceder al canal SII",
    desc: "Entra por la zona segregada y revisa casos admitidos.",
    to: "/sii",
  },
  {
    icon: ShieldCheck,
    title: "Seguir una obligación",
    desc: "Consulta obligación, control asociado y evidencia disponible.",
    to: "/obligaciones",
  },
];

function navigateToSection(id: string, setActive: (value: string) => void) {
  setActive(id);
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function SectionNav({ active, onNavigate, testId }: { active: string; onNavigate: (id: string) => void; testId: string }) {
  return (
    <nav data-testid={testId} className="space-y-1">
      {sections.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onNavigate(s.id)}
          className={cn(
            "block w-full rounded-md px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--t-border-focus)] focus-visible:ring-offset-2",
            active === s.id
              ? "bg-[var(--t-brand)] text-[var(--t-text-inverse)]"
              : "text-[var(--t-text-primary)] hover:bg-[var(--t-surface-subtle)]",
          )}
        >
          {s.label}
        </button>
      ))}
    </nav>
  );
}

function ModuleCard({ icon: Icon, title, desc, to }: { icon: LucideIcon; title: string; desc: string; to: string }) {
  return (
    <Card className="flex min-w-0 items-start gap-4 border-[var(--t-border-default)] bg-[var(--t-surface-card)] p-5">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[var(--t-surface-subtle)] text-[var(--t-brand)]">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-semibold text-[var(--t-text-primary)]">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-[var(--t-text-secondary)]">{desc}</p>
        <Link
          to={to}
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--t-brand)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--t-border-focus)] focus-visible:ring-offset-2"
        >
          Ir al módulo <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </Card>
  );
}

export default function Documentacion() {
  const [active, setActive] = useState("que-es");
  const [showCompleted, setShowCompleted] = useState(() => typeof window !== "undefined" && window.localStorage.getItem("tgms.tour.justFinished") === "true");

  const dismissCompleted = () => {
    setShowCompleted(false);
    if (typeof window !== "undefined") window.localStorage.removeItem("tgms.tour.justFinished");
  };

  const onNavigate = (id: string) => navigateToSection(id, setActive);

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-5 text-[var(--t-text-primary)] sm:px-6 lg:px-8">
      {showCompleted && (
        <Card className="mb-6 flex items-start gap-3 border-[var(--t-border-default)] border-l-4 border-l-[var(--t-status-success)] bg-[var(--t-surface-card)] p-4">
          <CheckCircle className="mt-0.5 h-6 w-6 shrink-0 text-[var(--t-status-success)]" />
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-[var(--t-text-primary)]">Has completado el tour de TGMS</h3>
            <p className="mt-1 text-sm leading-6 text-[var(--t-text-secondary)]">
              Has recorrido las áreas principales del sistema. Usa esta guía para conectar módulos, términos y marcos regulatorios.
            </p>
            <Link to="/" onClick={dismissCompleted} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[var(--t-brand)] hover:underline">
              Volver al Dashboard <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <button type="button" onClick={dismissCompleted} className="text-xs font-semibold text-[var(--t-brand)] hover:underline">
            cerrar
          </button>
        </Card>
      )}

      <header>
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--t-brand)]">Total Governance Management System</div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-[var(--t-text-primary)] sm:text-4xl">Centro de ayuda TGMS</h1>
        <p className="mt-2 max-w-3xl text-base leading-7 text-[var(--t-text-secondary)]">
          Referencia rápida para entender el modelo de gobernanza, navegar los módulos y localizar el marco regulatorio que sustenta la demo ARGA.
        </p>
      </header>

      <section className="mt-5 grid gap-3 md:grid-cols-3">
        {quickRoutes.map((route) => {
          const Icon = route.icon;
          return (
            <Link
              key={route.title}
              to={route.to}
              className="group rounded-lg border border-[var(--t-border-default)] bg-[var(--t-surface-card)] p-4 transition-colors hover:bg-[var(--t-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--t-border-focus)] focus-visible:ring-offset-2"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--t-surface-subtle)] text-[var(--t-brand)]">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[var(--t-text-primary)]">{route.title}</span>
                  <span className="mt-1 block text-sm leading-6 text-[var(--t-text-secondary)]">{route.desc}</span>
                </span>
              </div>
            </Link>
          );
        })}
      </section>

      <div className="sticky top-14 z-20 -mx-4 mt-5 border-y border-[var(--t-border-default)] bg-[var(--t-surface-card)] px-4 py-2 lg:hidden">
        <div data-testid="doc-mobile-nav" className="flex gap-2 overflow-x-auto pb-1">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onNavigate(s.id)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--t-border-focus)] focus-visible:ring-offset-2",
                active === s.id
                  ? "border-[var(--t-brand)] bg-[var(--t-brand)] text-[var(--t-text-inverse)]"
                  : "border-[var(--t-border-default)] bg-[var(--t-surface-card)] text-[var(--t-text-primary)]",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <Card className="sticky top-20 border-[var(--t-border-default)] bg-[var(--t-surface-card)] p-2">
            <SectionNav active={active} onNavigate={onNavigate} testId="doc-desktop-nav" />
          </Card>
        </aside>

        <main className="min-w-0 space-y-12">
          <section id="que-es" className="scroll-mt-28">
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--t-text-primary)]">¿Qué es TGMS?</h2>
            <p className="mt-2 text-base leading-7 text-[var(--t-text-secondary)]">
              TGMS existe para responder de forma auditable las preguntas que importan:
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                "¿Qué norma aplica a esta entidad y por qué?",
                "¿Qué órgano aprobó esta decisión y qué obligaciones activa?",
                "¿Qué control demuestra cumplimiento?",
                "¿Qué hallazgo cuestiona la evidencia?",
                "¿Qué excepción local fue autorizada y quién la aprobó?",
                "¿Qué delegación estaba vigente en la fecha del acto?",
              ].map((q) => (
                <Card key={q} className="flex min-w-0 items-start gap-3 border-[var(--t-border-default)] bg-[var(--t-surface-card)] p-4">
                  <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--t-brand)]" />
                  <span className="text-sm font-medium leading-6 text-[var(--t-text-primary)]">{q}</span>
                </Card>
              ))}
            </div>

            <p className="mt-6 rounded-md border-l-4 border-[var(--t-brand)] bg-[var(--t-surface-subtle)] p-4 text-sm italic leading-6 text-[var(--t-text-primary)]">
              El valor no está en subir PDFs al Consejo, sino en tener trazabilidad extremo a extremo entre decisión, norma, obligación, control, evidencia y remediación.
            </p>
          </section>

          <section id="principios" className="scroll-mt-28">
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--t-text-primary)]">Principios del sistema</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {principios.map((p) => (
                <Card key={p.title} className="border-[var(--t-border-default)] bg-[var(--t-surface-card)] p-5">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-[var(--t-surface-subtle)] text-[var(--t-brand)]">
                    <p.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-semibold text-[var(--t-text-primary)]">{p.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-[var(--t-text-secondary)]">{p.desc}</p>
                </Card>
              ))}
            </div>
          </section>

          <section id="modulos" className="scroll-mt-28">
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--t-text-primary)]">Módulos</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {modulos.map((m) => (
                <ModuleCard key={m.title} {...m} />
              ))}
            </div>
          </section>

          <section id="marco" className="scroll-mt-28">
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--t-text-primary)]">Marco regulatorio</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--t-text-secondary)]">TGMS está alineado con los siguientes marcos:</p>
            <TooltipProvider delayDuration={200}>
              <div className="mt-4 flex flex-wrap gap-2">
                {frameworks.map((f) => (
                  <Tooltip key={f.name}>
                    <TooltipTrigger asChild>
                      <span className="inline-flex cursor-help items-center rounded-full border border-[var(--t-border-default)] bg-[var(--t-surface-card)] px-3 py-1.5 text-sm font-medium text-[var(--t-text-primary)] hover:border-[var(--t-brand)] hover:text-[var(--t-brand)]">
                        {f.name}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">{f.tip}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </TooltipProvider>
          </section>

          <section id="glosario" className="scroll-mt-28">
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--t-text-primary)]">Glosario</h2>
            <Card className="mt-4 hidden overflow-hidden border-[var(--t-border-default)] bg-[var(--t-surface-card)] md:block">
              <table className="w-full text-sm">
                <thead className="bg-[var(--t-surface-muted)]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--t-text-secondary)]">Término</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--t-text-secondary)]">Definición</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--t-text-secondary)]">Ejemplo</th>
                  </tr>
                </thead>
                <tbody>
                  {glosario.map((g) => (
                    <tr key={g.term} className="border-t border-[var(--t-border-subtle)]">
                      <td className="px-4 py-3 font-semibold text-[var(--t-text-primary)]">{g.term}</td>
                      <td className="px-4 py-3 leading-6 text-[var(--t-text-secondary)]">{g.def}</td>
                      <td className="px-4 py-3">
                        <Link to={g.example.to} className="text-[var(--t-brand)] hover:underline">{g.example.label}</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            <div className="mt-4 grid gap-3 md:hidden">
              {glosario.map((g) => (
                <Card key={g.term} className="border-[var(--t-border-default)] bg-[var(--t-surface-card)] p-4">
                  <h3 className="text-sm font-semibold text-[var(--t-text-primary)]">{g.term}</h3>
                  <p className="mt-1 text-sm leading-6 text-[var(--t-text-secondary)]">{g.def}</p>
                  <Link to={g.example.to} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--t-brand)] hover:underline">
                    {g.example.label} <ArrowRight className="h-3 w-3" />
                  </Link>
                </Card>
              ))}
            </div>
          </section>

          <div className="pt-6 text-center">
            <Link to="/" className="inline-flex items-center gap-1 text-sm font-medium text-[var(--t-brand)] hover:underline">
              Volver al Dashboard <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
