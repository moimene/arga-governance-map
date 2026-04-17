import { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  AlertOctagon,
  ArrowRight,
  BarChart3,
  Building,
  Eye,
  FileText,
  Globe,
  HelpCircle,
  CheckCircle,
  Key,
  Leaf,
  Link as LinkIcon,
  Lock,
  Network,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Users,
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
  { icon: ShieldCheck, title: "Obligaciones y Controles", desc: "Trazabilidad obligación → control → evidencia.", to: "/obligaciones" },
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

export default function Documentacion() {
  const [active, setActive] = useState("que-es");
  const [showCompleted, setShowCompleted] = useState(() => typeof window !== "undefined" && window.localStorage.getItem("tgms.tour.justFinished") === "true");

  const dismissCompleted = () => {
    setShowCompleted(false);
    if (typeof window !== "undefined") window.localStorage.removeItem("tgms.tour.justFinished");
  };

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      {showCompleted && (
        <Card className="mb-6 flex items-start gap-3 border-l-4 border-l-status-active bg-status-active-bg p-4">
          <CheckCircle className="mt-0.5 h-6 w-6 shrink-0 text-status-active" />
          <div className="flex-1">
            <h3 className="text-base font-semibold text-status-active">Has completado el tour de TGMS</h3>
            <p className="mt-1 text-sm text-foreground">
              Has recorrido las 10 áreas del sistema: desde el Dashboard hasta el canal SII. Explora la documentación para conocer la filosofía del sistema y el marco regulatorio que lo sustenta.
            </p>
            <Link to="/" onClick={dismissCompleted} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-status-active hover:underline">
              Volver al Dashboard <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <button onClick={dismissCompleted} className="text-status-active hover:underline text-xs">cerrar</button>
        </Card>
      )}
      <div className="grid grid-cols-12 gap-6">
        {/* Internal sidebar */}
        <aside className="col-span-3">
          <Card className="sticky top-20 p-2">
            <nav className="space-y-0.5">
              {sections.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setActive(s.id);
                    document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className={cn(
                    "block w-full rounded-md px-3 py-2 text-left text-sm font-medium transition-colors",
                    active === s.id ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </nav>
          </Card>
        </aside>

        <div className="col-span-9 space-y-12">
          {/* ¿Qué es? */}
          <section id="que-es" className="scroll-mt-20">
            <div className="text-xs font-semibold uppercase tracking-wider text-primary">Total Governance Management System</div>
            <h1 className="mt-1 text-4xl font-bold tracking-tight">¿Qué es TGMS?</h1>
            <p className="mt-2 text-lg text-muted-foreground">Plataforma central de gobernanza de grupo</p>

            <p className="mt-6 text-base leading-relaxed text-foreground">
              TGMS existe para responder de forma auditable las preguntas que importan:
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              {[
                "¿Qué norma aplica a esta entidad y por qué?",
                "¿Qué órgano aprobó esta decisión y qué obligaciones activa?",
                "¿Qué control demuestra cumplimiento?",
                "¿Qué hallazgo cuestiona la evidencia?",
                "¿Qué excepción local fue autorizada y quién la aprobó?",
                "¿Qué delegación estaba vigente en la fecha del acto?",
              ].map((q, i) => (
                <Card key={i} className="flex items-start gap-3 p-4">
                  <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span className="text-sm font-medium text-foreground">{q}</span>
                </Card>
              ))}
            </div>

            <p className="mt-6 rounded-md border-l-4 border-primary bg-accent/40 p-4 text-sm italic text-foreground">
              El valor no está en subir PDFs al Consejo, sino en tener trazabilidad extremo a extremo entre decisión, norma, obligación, control, evidencia y remediación.
            </p>
          </section>

          {/* Principios */}
          <section id="principios" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight">Principios del sistema</h2>
            <div className="mt-4 grid grid-cols-3 gap-4">
              {principios.map((p) => (
                <Card key={p.title} className="p-5">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <p.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-base font-semibold">{p.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{p.desc}</p>
                </Card>
              ))}
            </div>
          </section>

          {/* Módulos */}
          <section id="modulos" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight">Módulos</h2>
            <div className="mt-4 grid grid-cols-2 gap-4">
              {modulos.map((m) => (
                <Card key={m.title} className="flex items-start gap-4 p-5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <m.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-semibold">{m.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{m.desc}</p>
                    <Link to={m.to} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                      Ir al módulo <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          </section>

          {/* Marco regulatorio */}
          <section id="marco" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight">Marco regulatorio</h2>
            <p className="mt-1 text-sm text-muted-foreground">TGMS está alineado con los siguientes marcos:</p>
            <TooltipProvider delayDuration={200}>
              <div className="mt-4 flex flex-wrap gap-2">
                {frameworks.map((f) => (
                  <Tooltip key={f.name}>
                    <TooltipTrigger asChild>
                      <span className="inline-flex cursor-help items-center rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:border-primary hover:text-primary">
                        {f.name}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">{f.tip}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </TooltipProvider>
          </section>

          {/* Glosario */}
          <section id="glosario" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight">Glosario</h2>
            <Card className="mt-4 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Término</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Definición</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ejemplo</th>
                  </tr>
                </thead>
                <tbody>
                  {glosario.map((g) => (
                    <tr key={g.term} className="border-t border-border">
                      <td className="px-4 py-3 font-semibold text-foreground">{g.term}</td>
                      <td className="px-4 py-3 text-muted-foreground">{g.def}</td>
                      <td className="px-4 py-3">
                        <Link to={g.example.to} className="text-primary hover:underline">{g.example.label}</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </section>

          <div className="pt-6 text-center">
            <Link to="/" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              Volver al Dashboard <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
