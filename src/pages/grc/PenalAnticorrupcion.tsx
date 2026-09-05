import { useState } from "react";
import { Link } from "react-router-dom";
import { 
  Activity, ArrowRight, FileText, PlusCircle, Scale, ShieldCheck, 
  ChevronDown, ChevronUp, ChevronRight, AlertTriangle, PenTool, ExternalLink, HelpCircle, Loader2, CheckCircle2, Lock
} from "lucide-react";
import { useRisks, type RiskRow } from "@/hooks/useRisks";
import { ETIQUETA_BANDA } from "@/lib/grc/assessed-band";
import { esRiesgoPenal, nivelRiesgo } from "@/lib/grc/penal-scope";
import { DemoFixtureNotice } from "@/components/grc/DemoFixtureNotice";
import { CONTROLES_PPD } from "../../../scripts/garrigues/normativo/obligaciones-pbcft";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useSecretariaScope } from "@/components/secretaria/shell";
import { useTenantBranding } from "@/context/TenantBrandContext";
import { groupFullLabel } from "@/lib/tenant-brand-labels";
import {
  controlStatusLabel,
  type ControlRow,
  useAllControlsByObligationIds,
  useObligationsList,
} from "@/hooks/usePoliciesObligations";
import { useEvidenceBundlesList } from "@/hooks/useEvidenceBundles";
import { isFinalSealedEvidence } from "@/lib/secretaria/evidence-sandbox-gate";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const SELECT_CLASSES =
  "h-10 w-full px-3 text-sm bg-[var(--g-surface-card)] text-[var(--g-text-primary)] border border-[var(--g-border-subtle)] focus:border-[var(--g-brand-3308)] focus:outline-none transition-colors";

const INPUT_CLASSES =
  "h-10 w-full px-3 text-sm bg-[var(--g-surface-card)] text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)]/60 border border-[var(--g-border-subtle)] focus:border-[var(--g-brand-3308)] focus:outline-none transition-colors";

const TEXTAREA_CLASSES =
  "w-full px-3 py-2 text-sm bg-[var(--g-surface-card)] text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)]/60 border border-[var(--g-border-subtle)] focus:border-[var(--g-brand-3308)] focus:outline-none transition-colors resize-none";

const LABEL_CLASSES = "block text-xs font-semibold text-[var(--g-text-primary)] uppercase mb-1";

// Lo que se pinta cuando la consulta falla. Un error NO es un cero: un cero
// afirma que se midió y salió cero.
const SIN_DATO = "sin dato";

// El catálogo del que salen estos controles declara por escrito que su `status`
// es «SIMULADO para la demo» y no una evaluación de la eficacia real. La
// pantalla lo dice donde se pintan, en vez de rotular «Estado Evaluado» encima.
const CONTROLES_ESTADO_SIMULADO = new Set(CONTROLES_PPD.map((c) => c.code));

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

function matchesTaxonomy(keywords: string[], ...values: Array<string | null | undefined>) {
  const text = normalize(values.join(" "));
  return keywords.some((term) => text.includes(normalize(term)));
}

type PenalRiskLike = RiskRow;

type PenalControl = Pick<ControlRow, "id" | "code" | "name" | "status" | "last_test_date">;
type PenalSubTab = "risks" | "controls" | "evidences";

interface DelitoCategory {
  id: string;
  title: string;
  lawRef: string;
  description: string;
  keywords: string[];
}

// Las cinco categorías NO traen ya riesgos ni controles de relleno. Los tenían:
// `fallbackRisks` / `fallbackControls` con pólizas, primas y reaseguro de una
// aseguradora, que se pintaban cuando la categoría no casaba nada del tenant —y
// el chip de cumplimiento se calculaba SOBRE ELLOS, así que un despacho veía
// «4. Fraude · CONFORME» sostenido por controles que no existen en ninguna
// tabla. Sin dato, estado vacío honesto y sin veredicto.
const DELITOS_TAXONOMY: DelitoCategory[] = [
  {
    id: "cohecho-corrupcion",
    title: "1. Cohecho y Corrupción en los Negocios",
    lawRef: "Art. 286 bis, 419 CP | ISO 37001",
    description: "Previene sobornos, dádivas o favores a funcionarios públicos o entre particulares en relaciones comerciales.",
    keywords: ["cohecho", "corrupcion", "corrupción", "soborno", "regalo", "hospitalidad", "anticorrup"],
  },
  {
    id: "blanqueo-capitales",
    title: "2. Blanqueo de Capitales y Financiación de Terrorismo",
    lawRef: "Art. 301 CP | Ley 10/2010 SEPBLAC",
    description: "Previene la introducción en el tráfico financiero de fondos procedentes de actividades delictivas.",
    keywords: ["blanqueo", "aml", "terrorismo", "capitales", "sancion", "sanción", "kyc", "sepblac"],
  },
  {
    id: "delitos-informaticos",
    title: "3. Delitos Informáticos y Revelación de Secretos",
    lawRef: "Art. 197 bis, 264 CP | DORA RTS / GDPR",
    description: "Previene accesos no autorizados, daños en sistemas informáticos y la revelación indebida de datos confidenciales.",
    keywords: ["cyber", "ciber", "informatico", "informático", "acceso", "secreto", "revelacion", "revelación", "intrusion", "intrusión"],
  },
  {
    id: "fraude-hacienda",
    title: "4. Fraude, Estafa y Delitos contra la Hacienda Pública",
    lawRef: "Art. 248, 305 CP | LSC / Prevención de Fraude",
    description: "Previene el fraude en el reporte fiscal, la manipulación de balances contables y las declaraciones incorrectas ante Hacienda.",
    keywords: ["fraude", "estafa", "fiscal", "impuesto", "hacienda", "contabil", "balance", "tributario", "seguridad social"],
  },
  {
    id: "propiedad-intelectual",
    title: "5. Delitos contra la Propiedad Intelectual e Industrial",
    lawRef: "Art. 270 CP | Ley de Patentes",
    description: "Previene la utilización o explotación no autorizada de obras protegidas, patentes o secretos industriales.",
    keywords: ["propiedad", "intelectual", "patente", "licencia", "software", "industrial", "marca", "copyright"],
  },
];



export default function PenalAnticorrupcion() {
  const { user } = useCurrentUser();
  const branding = useTenantBranding();
  const scope = useSecretariaScope();
  const scopedEntityId = scope.mode === "sociedad" ? scope.selectedEntity?.id ?? null : null;
  const scopeLabel =
    scope.mode === "sociedad" && scope.selectedEntity
      ? scope.selectedEntity.legalName
      : groupFullLabel(branding);

  // Data queries
  const { data: risks = [], isLoading: loadingRisks, error: risksError, refetch: refetchRisks } = useRisks({ entityId: scopedEntityId });
  const { data: obligations = [], isLoading: loadingObligations, error: obligationsError } = useObligationsList();
  
  const penalObligations = obligations.filter((obligation) =>
    TAXONOMY_TERMS.some((term) => matchesTaxonomy([term], obligation.code, obligation.title, obligation.source, obligation.policy_title))
  );
  
  const obligationIds = penalObligations.map((obligation) => obligation.id);
  const { data: controls = [], isLoading: loadingControls, refetch: refetchControls } = useAllControlsByObligationIds(obligationIds);
  const { data: evidences = [], refetch: refetchEvidences } = useEvidenceBundlesList();

  const penalRisks = risks.filter(esRiesgoPenal);
  // Un riesgo penal que no case con ninguna de las cinco categorías ya no se
  // reparte por todas: se cuenta aparte y se dice en pantalla, para que su
  // desaparición del acordeón no se lea como que no existe.
  const riesgosSinCategoria = penalRisks.filter(
    (r) => !DELITOS_TAXONOMY.some((d) => matchesTaxonomy(d.keywords, r.code, r.title, r.description, r.obligations?.title)),
  );


  // Accordion State
  const [expandedDelito, setExpandedDelito] = useState<string | null>("cohecho-corrupcion");
  const [activeSubTab, setActiveSubTab] = useState<PenalSubTab>("risks");

  // Estado del formulario de preparación de custodia. Fail-closed: no firma.
  const [sealingObject, setSealingObject] = useState<{
    type: "RISK" | "CONTROL";
    id: string;
    code: string;
    title: string;
    delitoId: string;
  } | null>(null);

  const [auditorName, setAuditorName] = useState("");
  const [auditorEmail, setAuditorEmail] = useState(() => user?.email ?? "");
  const [evidenceDocName, setEvidenceDocName] = useState("");
  const [signingProgress, setSigningProgress] = useState<string | null>(null);

  const toggleAccordion = (id: string) => {
    setExpandedDelito(expandedDelito === id ? null : id);
  };

  // Pertenencia a categoría SOLO por palabras clave. Antes bastaba con
  // `module_id === "penal"` para entrar en TODAS las categorías, así que los 18
  // riesgos penales de ARGA se repetían en los cinco acordeones y el contador
  // «N Riesgos» no medía nada. Sin fallback: una categoría sin nada del tenant
  // se queda vacía y lo dice.
  const perteneceACategoria = (delito: DelitoCategory, r: PenalRiskLike) =>
    matchesTaxonomy(delito.keywords, r.code, r.title, r.description, r.obligations?.title);

  const getMappedItems = (delito: DelitoCategory) => {
    const finalRisks = penalRisks.filter((r) => perteneceACategoria(delito, r));

    // Obligations linked
    const matchedObs = penalObligations.filter((o) =>
      matchesTaxonomy(delito.keywords, o.code, o.title, o.source, o.policy_title)
    );
    const matchedObIds = matchedObs.map((o) => o.id);

    // Controls
    const finalControls = controls.filter((c) => matchedObIds.includes(c.obligation_id || ""));

    // Gather Evidence associated with these risks or controls
    const allIds = [
      ...finalRisks.map((r) => r.id),
      ...finalRisks.map((r) => r.code),
      ...finalControls.map((c) => c.id),
      ...finalControls.map((c) => c.code)
    ];
    const delitoEvidences = evidences.filter((e) => allIds.includes(e.source_object_id || ""));

    return {
      risks: finalRisks,
      controls: finalControls,
      evidences: delitoEvidences
    };
  };

  // Resume el ESTADO REGISTRADO de los controles del tenant. No dice
  // «CONFORME»: ese era un veredicto de cumplimiento derivado de un `status`
  // que la propia fuente declara postura simulada de demo, y que además se
  // calculaba sobre los controles de relleno cuando no había ninguno real.
  const getDelitoCompliance = (controlsList: PenalControl[]) => {
    if (controlsList.length === 0) {
      return {
        label: "SIN CONTROLES REGISTRADOS",
        color: "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
      };
    }
    const statuses = controlsList.map((c) => (c.status ?? "").toUpperCase());
    if (statuses.includes("DEFICIENTE") || statuses.includes("INEFECTIVO")) {
      return {
        label: "ALGÚN CONTROL DEFICIENTE",
        color: "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
      };
    }
    if (statuses.every((st) => st === "EFECTIVO")) {
      return {
        label: "TODOS EFECTIVOS (ESTADO REGISTRADO)",
        color: "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
      };
    }
    return {
      label: "CONTROLES PARCIALES",
      color: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
    };
  };

  // La custodia tendría su propio endpoint source-bound; este flujo es fail-closed.
  const handlePerformSeal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSigningProgress(null);
    toast.info("Custodia electrónica no conectada en este flujo", {
      description: "La ruta genérica de firma está retirada. No se emite sello ni firma, ni se atribuye custodia a ningún prestador.",
    });
  };

  const loading = loadingRisks || loadingObligations || loadingControls;

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Scale className="h-6 w-6 text-[var(--g-brand-3308)] animate-pulse" />
            <h1 className="text-2xl font-bold text-[var(--g-text-primary)]">
              Matriz de Compliance Penal e ISO 37001
            </h1>
          </div>
          <p className="max-w-3xl text-sm leading-6 text-[var(--g-text-secondary)]">
            Supervisión interactiva del Modelo de Prevención de Delitos (Art. 31 bis CP) y Antisoborno (ISO 37001).
            Vincula riesgos y controles mitigantes registrados para este grupo. La custodia electrónica de evidencia
            no está conectada en este entorno: no se emite firma, sello ni acuse.
          </p>
        </div>
        <Link
          to={scope.createScopedTo("/grc/risk-360/nuevo?module=penal")}
          className="inline-flex items-center justify-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2.5 text-sm font-semibold text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] shrink-0"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <PlusCircle className="h-4 w-4" />
          Registrar Riesgo Penal
        </Link>
      </header>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {[
          { label: "Delitos Catalogados", value: DELITOS_TAXONOMY.length, icon: Activity },
          // Sin `|| 9` ni `|| 12`. Un 0 real se pinta 0; un error de consulta se
          // pinta «sin dato», que es lo que un fallback literal escondía.
          { label: "Riesgos penales registrados", value: risksError ? SIN_DATO : penalRisks.length, icon: AlertTriangle },
          { label: "Obligaciones jurídicas", value: obligationsError ? SIN_DATO : penalObligations.length, icon: FileText },
          { label: "Evidencias archivadas", value: evidences.filter(e => e.source_module === "GRC_PENAL" && isFinalSealedEvidence(e.status)).length, icon: ShieldCheck },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="border border-[var(--g-border-default)] bg-[var(--g-surface-card)] p-4 flex flex-col justify-between"
              style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
            >
              <Icon className="h-5 w-5 text-[var(--g-brand-3308)] mb-2" />
              <div>
                <div className="text-2xl font-bold text-[var(--g-text-primary)]">
                  {loading ? "..." : item.value}
                </div>
                <div className="mt-1 text-xs text-[var(--g-text-secondary)] font-medium">
                  {item.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Banner de Integración con el Sistema Interno de Información (SII - Ley 2/2023) */}
      <div 
        className="p-5 bg-[var(--g-surface-subtle)] border border-[var(--g-brand-3308)]/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] rounded-md shrink-0">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[var(--g-text-primary)]">
                Canal Interno de Información / Denuncias (Ley 2/2023 & CP Art. 31 bis)
              </h3>
              {/* Era un chip verde que declaraba el nivel de servicio en vigor. Los plazos existen —art.
                  9.2.c y 9.2.d— pero son EXIGENCIA LEGAL, no un nivel de servicio
                  que se esté cumpliendo: el canal no tiene ni un expediente. El
                  chip los enuncia sin afirmar cumplimiento. */}
              <span className="px-2 py-0.5 text-[10px] font-bold bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)] rounded-full">
                Plazos legales: 7 días / 3 meses
              </span>
            </div>
            <p className="text-xs text-[var(--g-text-secondary)] mt-1 max-w-2xl leading-relaxed">
              Consola de recepción, buzón de confidencialidad reforzada, subexpedientes autónomos,
              acuse de recibo en 7 días naturales (art. 9.2.c) e investigación en 3 meses prorrogables
              (art. 9.2.d), con Registro de informaciones (art. 26).{" "}
              <span className="italic">Entorno de validación funcional — sin eficacia jurídica cualificada productiva.</span>
            </p>
          </div>
        </div>

        <Link
          to="/sii"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] text-xs font-bold rounded-md hover:bg-[var(--g-sec-700)] transition-colors shrink-0"
        >
          Acceder al Canal SII <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Riesgos penales del tenant que no encajan en ninguna de las cinco
          categorías. Se dicen en voz alta: antes entraban en TODAS por el
          atajo `module_id === "penal"`, y al quitarlo desaparecerían sin
          rastro, que es otra forma de mentir. */}
      {riesgosSinCategoria.length > 0 && (
        <div
          className="border border-[var(--g-border-default)] bg-[var(--g-surface-muted)] p-4 text-xs leading-relaxed text-[var(--g-text-primary)]"
          style={{ borderRadius: "var(--g-radius-lg)" }}
        >
          <strong>{riesgosSinCategoria.length} riesgos penales registrados fuera de estas cinco categorías.</strong>{" "}
          La taxonomía de esta pantalla no cubre todo el catálogo penal del grupo. Consúltalos en{" "}
          <Link to={scope.createScopedTo("/grc/risk-360")} className="text-[var(--g-link)] hover:text-[var(--g-link-hover)] underline">
            Risk 360
          </Link>.
        </div>
      )}

      {/* Interactive Compliance Matrix */}
      <div className="space-y-4">
        {DELITOS_TAXONOMY.map((delito) => {
          const isExpanded = expandedDelito === delito.id;
          const { risks: delitoRisks, controls: delitoControls, evidences: delitoEvidences } = getMappedItems(delito);
          const compliance = getDelitoCompliance(delitoControls);

          return (
            <div
              key={delito.id}
              className={cn(
                "border transition-all overflow-hidden",
                isExpanded 
                  ? "border-[var(--g-brand-3308)] bg-[var(--g-surface-card)]" 
                  : "border-[var(--g-border-default)] bg-[var(--g-surface-card)] hover:border-[var(--g-border-subtle)]"
              )}
              style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
            >
              {/* Accordion Trigger Header */}
              <div
                onClick={() => toggleAccordion(delito.id)}
                className="p-5 flex items-center justify-between gap-4 cursor-pointer select-none"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-base font-bold text-[var(--g-text-primary)]">
                      {delito.title}
                    </h3>
                    <span
                      className={cn("px-2 py-0.5 text-[10px] font-bold", compliance.color)}
                      style={{ borderRadius: "var(--g-radius-sm)" }}
                    >
                      {compliance.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[var(--g-text-secondary)] font-mono">
                    <span className="text-[var(--g-brand-3308)] font-semibold">{delito.lawRef}</span>
                    <span>•</span>
                    <span>{delitoRisks.length} Riesgos</span>
                    <span>•</span>
                    <span>{delitoControls.length} Controles</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {delitoEvidences.some(e => isFinalSealedEvidence(e.status)) ? (
                    <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-[var(--status-success)] font-semibold font-mono bg-[var(--status-success)]/10 px-2 py-1 border border-[var(--status-success)]/20" style={{ borderRadius: "var(--g-radius-sm)" }}>
                      <CheckCircle2 className="h-3 w-3" /> ARCHIVADA
                    </span>
                  ) : delitoEvidences.length > 0 ? (
                    <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-[var(--status-warning)] font-semibold font-mono bg-[var(--status-warning)]/10 px-2 py-1 border border-[var(--status-warning)]/20" style={{ borderRadius: "var(--g-radius-sm)" }} title="Registro de demo en sandbox: sin sello">
                      SANDBOX
                    </span>
                  ) : null}
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-[var(--g-text-secondary)]" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-[var(--g-text-secondary)]" />
                  )}
                </div>
              </div>

              {/* Accordion Content Panel */}
              {isExpanded && (
                <div className="border-t border-[var(--g-border-subtle)]">
                  {/* Category Description */}
                  <div className="p-5 bg-[var(--g-surface-subtle)]/40 border-b border-[var(--g-border-subtle)] text-xs text-[var(--g-text-secondary)] leading-relaxed">
                    <strong>Descripción del Ámbito Penal:</strong> {delito.description}
                  </div>

                  {/* Tabs for details */}
                  <div className="flex border-b border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]">
                    {([
                      { id: "risks", label: `Riesgos Penales (${delitoRisks.length})` },
                      { id: "controls", label: `Controles Mitigantes (${delitoControls.length})` },
                      { id: "evidences", label: `Evidencias registradas (${delitoEvidences.length})` },
                    ] satisfies Array<{ id: PenalSubTab; label: string }>).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveSubTab(tab.id)}
                        className={cn(
                          "px-5 py-3 text-xs font-semibold border-b-2 transition-colors",
                          activeSubTab === tab.id
                            ? "border-[var(--g-brand-3308)] text-[var(--g-brand-3308)] bg-[var(--g-surface-subtle)]/30"
                            : "border-transparent text-[var(--g-text-secondary)] hover:text-[var(--g-brand-3308)]"
                        )}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="p-5 space-y-4">
                    
                    {/* Tab: Risks */}
                    {activeSubTab === "risks" && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="bg-[var(--g-surface-subtle)] text-[var(--g-text-primary)] font-semibold border-b border-[var(--g-border-subtle)]">
                              <th className="px-4 py-3">Código</th>
                              <th className="px-4 py-3">Riesgo Penal Identificado</th>
                              <th className="px-4 py-3 text-center">Inherente / Residual o banda</th>
                              <th className="px-4 py-3">Estado</th>
                              <th className="px-4 py-3 text-right">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--g-border-subtle)]">
                            {delitoRisks.map((risk) => {
                              // El nivel lo decide `nivelRiesgo`, que nunca
                              // devuelve un número que no esté en la fila.
                              const nivel = nivelRiesgo(risk);
                              const isHigh = nivel.tipo === "SCORE" && (nivel.inherente ?? 0) >= 12;

                              return (
                                <tr key={risk.id} className="hover:bg-[var(--g-surface-subtle)]/20 transition-colors">
                                  <td className="px-4 py-3.5 font-mono font-bold text-[var(--g-brand-3308)]">
                                    {risk.code}
                                  </td>
                                  <td className="px-4 py-3.5">
                                    <span className="font-semibold block text-[var(--g-text-primary)]">{risk.title}</span>
                                    <span className="text-[var(--g-text-secondary)] line-clamp-1 mt-0.5">{risk.description}</span>
                                  </td>
                                  <td className="px-4 py-3.5 text-center font-mono">
                                    {nivel.tipo === "BANDA" ? (
                                      <span className="font-semibold text-[var(--g-text-primary)]">
                                        {ETIQUETA_BANDA[nivel.banda] ?? nivel.banda}
                                      </span>
                                    ) : nivel.tipo === "SIN_DATO" ? (
                                      <span className="text-[var(--g-text-secondary)]">{SIN_DATO}</span>
                                    ) : (
                                      <>
                                        <span className={cn(
                                          "font-bold",
                                          isHigh ? "text-[var(--status-error)]" : "text-[var(--g-text-primary)]"
                                        )}>
                                          {nivel.inherente ?? SIN_DATO}
                                        </span>
                                        <span className="text-[var(--g-text-secondary)]/50 mx-1">/</span>
                                        <span className="font-semibold text-[var(--g-text-primary)]">
                                          {nivel.residual ?? SIN_DATO}
                                        </span>
                                      </>
                                    )}
                                  </td>
                                  <td className="px-4 py-3.5">
                                    <span className="px-2 py-0.5 text-[9px] font-bold bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-sm)" }}>
                                      {(risk.status || "Abierto").toUpperCase()}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3.5 text-right space-x-2">
                                    <button
                                      type="button"
                                      onClick={() => setSealingObject({
                                        type: "RISK",
                                        id: risk.id,
                                        code: risk.code,
                                        title: risk.title,
                                        delitoId: delito.id
                                      })}
                                      className="inline-flex items-center gap-1 text-[var(--g-brand-3308)] hover:underline font-semibold"
                                    >
                                      <PenTool className="h-3 w-3" /> Custodia (no conectada)
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Tab: Controls */}
                    {activeSubTab === "controls" && (
                      <div className="space-y-3">
                      {delitoControls.some((c) => CONTROLES_ESTADO_SIMULADO.has(c.code)) && (
                        <DemoFixtureNotice>
                          El estado de estos controles procede del catálogo de seguimiento del programa,
                          que lo declara <strong>postura simulada para la demo</strong>. No es el resultado
                          de una prueba de eficacia realizada en este entorno.
                        </DemoFixtureNotice>
                      )}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="bg-[var(--g-surface-subtle)] text-[var(--g-text-primary)] font-semibold border-b border-[var(--g-border-subtle)]">
                              <th className="px-4 py-3">Código</th>
                              <th className="px-4 py-3">Medida de Control / Salvaguarda</th>
                              <th className="px-4 py-3">Estado registrado</th>
                              <th className="px-4 py-3">Última prueba registrada</th>
                              <th className="px-4 py-3 text-right">Custodia</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--g-border-subtle)]">
                            {delitoControls.map((control) => {
                              const isEffective = control.status === "Efectivo" || control.status === "EFECTIVO";
                              const statusLabel = controlStatusLabel(control.status);
                              
                              // ¿Hay ya un bundle de evidencia archivado?
                              const controlEvidence = delitoEvidences.filter(e => e.source_object_id === control.id);
                              // Codex #2-UI: solo cuenta como "Firmado" la evidencia final (SEALED/VERIFIED);
                              // los bundles sandbox quedan en OPEN y no deben presentarse como firmados.
                              const controlFinalEvidence = controlEvidence.filter(e => isFinalSealedEvidence(e.status));
                              const controlHasSandbox = controlEvidence.some(e => !isFinalSealedEvidence(e.status));

                              return (
                                <tr key={control.id} className="hover:bg-[var(--g-surface-subtle)]/20 transition-colors">
                                  <td className="px-4 py-3.5 font-mono font-bold text-[var(--g-brand-3308)]">
                                    {control.code}
                                  </td>
                                  <td className="px-4 py-3.5 font-semibold text-[var(--g-text-primary)]">
                                    {control.name}
                                  </td>
                                  <td className="px-4 py-3.5">
                                    <span
                                      className={cn(
                                        "px-2 py-0.5 text-[10px] font-bold",
                                        isEffective
                                          ? "bg-[var(--status-success)]/10 text-[var(--status-success)] border border-[var(--status-success)]/20"
                                          : "bg-[var(--status-warning)]/10 text-[var(--status-warning)] border border-[var(--status-warning)]/20"
                                      )}
                                      style={{ borderRadius: "var(--g-radius-sm)" }}
                                    >
                                      {statusLabel}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3.5 text-[var(--g-text-secondary)] font-mono">
                                    {control.last_test_date ? new Date(control.last_test_date).toLocaleDateString("es-ES") : "Pendiente"}
                                  </td>
                                  <td className="px-4 py-3.5 text-right">
                                    {controlFinalEvidence.length > 0 ? (
                                      <span className="inline-flex items-center gap-0.5 text-[9px] text-[var(--status-success)] font-semibold">
                                        <CheckCircle2 className="h-3.5 w-3.5" /> Firmado
                                      </span>
                                    ) : (
                                      <div className="inline-flex items-center gap-1.5 justify-end">
                                        {controlHasSandbox && (
                                          <span className="text-[9px] text-[var(--status-warning)] font-semibold" title="Existe un registro de demo en sandbox, sin sello">sandbox</span>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => setSealingObject({
                                            type: "CONTROL",
                                            id: control.id,
                                            code: control.code,
                                            title: control.name,
                                            delitoId: delito.id
                                          })}
                                          className="inline-flex items-center gap-1 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] px-2.5 py-1 font-semibold transition-colors"
                                          style={{ borderRadius: "var(--g-radius-sm)" }}
                                        >
                                          <PenTool className="h-3 w-3" /> Custodia (no conectada)
                                        </button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      </div>
                    )}

                    {/* Tab: Evidence WORM */}
                    {activeSubTab === "evidences" && (
                      <div className="space-y-4">
                        {delitoEvidences.length === 0 ? (
                          <div className="p-6 text-center text-xs text-[var(--g-text-secondary)] bg-[var(--g-surface-subtle)]/20 border border-dashed border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-md)" }}>
                            <HelpCircle className="h-6 w-6 text-[var(--g-text-secondary)]/40 mx-auto mb-2" />
                            <span className="block font-semibold">Sin registros archivados</span>
                            <span className="block mt-0.5">La custodia electrónica no está conectada en este entorno: no se emite ningún sello ni firma.</span>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {delitoEvidences.map((evidence) => {
                              // Codex #2-UI: distingue evidencia final (SEALED/VERIFIED) de sandbox (OPEN).
                              const isFinalSeal = isFinalSealedEvidence(evidence.status);
                              return (
                              <div
                                key={evidence.id}
                                className={cn(
                                  "border p-4 space-y-3",
                                  isFinalSeal
                                    ? "border-[var(--status-success)]/40 bg-[var(--status-success)]/5"
                                    : "border-[var(--status-warning)]/40 bg-[var(--status-warning)]/5"
                                )}
                                style={{ borderRadius: "var(--g-radius-md)" }}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className={cn("font-mono text-[9px] font-bold", isFinalSeal ? "text-[var(--status-success)]" : "text-[var(--status-warning)]")}>
                                    {/* Sin `|| \`WORM-${id}\``: fabricaba una referencia de custodia
                                        WORM para toda evidencia sin `reference_code`. La referencia
                                        se muestra si existe; si no, se dice que no la hay. */}
                                    {evidence.reference_code || "sin referencia registrada"}
                                  </span>
                                  {isFinalSeal ? (
                                    <span className="inline-flex items-center gap-0.5 text-[9px] text-[var(--g-text-secondary)] font-bold">
                                      <CheckCircle2 className="h-3 w-3" /> Archivada
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-0.5 text-[9px] text-[var(--status-warning)] font-bold" title="Registro de demo en sandbox: sin sello ni custodia cualificada">
                                      SANDBOX
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-[var(--g-text-secondary)] font-mono space-y-1">
                                  {/* Sin `|| "Apoderado de Cumplimiento"`: inventaba un responsable para toda evidencia sin `signed_by`. */}
                                  <div><strong>Responsable registrado:</strong> {evidence.signed_by || "sin responsable registrado"}</div>
                                  <div><strong>Fecha de archivo:</strong> {evidence.created_at ? new Date(evidence.created_at).toLocaleString("es-ES") : "—"}</div>
                                  <div className="line-clamp-1"><strong>Hash SHA-512:</strong> <span className="break-all font-mono text-[9px]">{evidence.hash_sha512 || "Pendiente"}</span></div>
                                  <div className="line-clamp-1"><strong>Audit ID:</strong> {evidence.id}</div>
                                </div>
                                <div className="pt-2 border-t border-[var(--g-border-subtle)] flex items-center justify-between text-[10px]">
                                  {isFinalSeal ? (
                                    <>
                                      {/* Ninguna evidencia de este módulo tiene token de sello, y EAD
                                          Trust no es prestador de firma ni de sello en el alcance
                                          vigente: se retiran «Prueba forense inmutable», «Verificar
                                          QSeal» y el «EAD Trust Custody ID». */}
                                      <span className="text-[var(--g-text-secondary)]">Registro archivado con hash — sin sello ni firma atribuidos</span>
                                      <a
                                        href="#"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          toast.info(`Identificador del registro: ${evidence.id}\nHash: ${evidence.hash_sha512 ?? "sin hash registrado"}`);
                                        }}
                                        className="text-[var(--g-brand-3308)] hover:underline inline-flex items-center gap-0.5"
                                      >
                                        Ver identificador y hash <ExternalLink className="h-3 w-3" />
                                      </a>
                                    </>
                                  ) : (
                                    <span className="text-[var(--status-warning)]">Registro de demo en sandbox — sin sello ni custodia cualificada.</span>
                                  )}
                                </div>
                              </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ============================================================ */}
      {/* Modal: preparación de custodia (fail-closed, sin sello)       */}
      {/* ============================================================ */}
      {sealingObject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div 
            className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] w-full max-w-lg overflow-hidden"
            style={{ borderRadius: "var(--g-radius-xl)", boxShadow: "var(--g-shadow-modal)" }}
          >
            <div className="px-6 py-4 border-b border-[var(--g-border-subtle)] flex items-center justify-between bg-[var(--g-surface-subtle)]">
              <h3 className="text-base font-bold text-[var(--g-text-primary)] flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-[var(--g-brand-3308)]" />
                Preparar custodia de evidencia
              </h3>
              <button 
                type="button" 
                onClick={() => setSealingObject(null)}
                className="text-[var(--g-text-secondary)] hover:text-[var(--g-brand-3308)] text-lg"
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handlePerformSeal} className="p-6 space-y-4">
              <div className="p-3 bg-[var(--g-surface-subtle)]/50 border border-[var(--g-border-subtle)] text-xs text-[var(--g-text-secondary)]" style={{ borderRadius: "var(--g-radius-md)" }}>
                <span>
                  La custodia electrónica no está conectada en este flujo. Puede revisar los datos, pero
                  no se emitirá sello, firma ni acuse, ni se contactará con ningún prestador:
                </span>
                <strong className="block mt-1 text-[var(--g-text-primary)] font-mono">{sealingObject.code} — {sealingObject.title}</strong>
              </div>

              <div className="space-y-1">
                <label htmlFor="auditor-name-input" className={LABEL_CLASSES}>Nombre del responsable *</label>
                <input
                  id="auditor-name-input"
                  type="text"
                  required
                  value={auditorName}
                  onChange={(e) => setAuditorName(e.target.value)}
                  className={INPUT_CLASSES}
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="auditor-email-input" className={LABEL_CLASSES}>Email del responsable *</label>
                <input
                  id="auditor-email-input"
                  type="email"
                  required
                  value={auditorEmail}
                  onChange={(e) => setAuditorEmail(e.target.value)}
                  className={INPUT_CLASSES}
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="evidence-docname-input" className={LABEL_CLASSES}>Nombre del Fichero Evidencia *</label>
                <input
                  id="evidence-docname-input"
                  type="text"
                  required
                  value={evidenceDocName}
                  onChange={(e) => setEvidenceDocName(e.target.value)}
                  placeholder={`EVIDENCIA-${sealingObject.code}-AUDITORIA.pdf`}
                  className={INPUT_CLASSES}
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="evidence-manifest-input" className={LABEL_CLASSES}>Manifest Metadatos (Ledger Payload)</label>
                <textarea
                  id="evidence-manifest-input"
                  rows={3}
                  readOnly
                  value={JSON.stringify({
                    standard: "UNE 19601 / ISO 37001",
                    compliance_reference: "Spanish Penal Code Art 31 bis",
                    // Sin `custody_provider: "EAD Trust Qualified TSP"`: atribuía
                    // custodia cualificada a un prestador que en el alcance
                    // vigente solo hace interposición, mensajería y e-archiving.
                    custody_provider: null,
                    evidence_scope: scopeLabel,
                    object_code: sealingObject.code
                  }, null, 2)}
                  className={cn(TEXTAREA_CLASSES, "font-mono text-[10px] bg-[var(--g-surface-subtle)]/20")}
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>

              {signingProgress ? (
                <div className="py-6 flex flex-col items-center justify-center text-center space-y-2">
                  <Loader2 className="h-6 w-6 animate-spin text-[var(--g-brand-3308)]" />
                  <span className="text-xs font-semibold text-[var(--g-text-primary)] animate-pulse">{signingProgress}</span>
                </div>
              ) : (
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setSealingObject(null)}
                    className="flex-1 h-10 border border-[var(--g-border-subtle)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] text-sm font-semibold transition-colors"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled
                    title="La custodia electrónica requiere su propia integración source-bound; la ruta genérica de firma no se reutiliza."
                    className="flex-1 h-10 bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] text-sm font-semibold cursor-not-allowed opacity-70 flex items-center justify-center gap-1.5"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <PenTool className="h-4 w-4" />
                    Custodia no conectada
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
