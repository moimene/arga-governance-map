import { useState } from "react";
import { Link } from "react-router-dom";
import { 
  Activity, ArrowRight, FileText, PlusCircle, Scale, ShieldCheck, 
  ChevronDown, ChevronUp, AlertTriangle, PenTool, ExternalLink, HelpCircle, Loader2, CheckCircle2, Lock
} from "lucide-react";
import { useRisks } from "@/hooks/useRisks";
import { useSecretariaScope } from "@/components/secretaria/shell";
import {
  controlStatusLabel,
  useAllControlsByObligationIds,
  useObligationsList,
} from "@/hooks/usePoliciesObligations";
import { useEvidenceBundlesList, useCreateEvidenceBundle } from "@/hooks/useEvidenceBundles";
import { isFinalSealedEvidence } from "@/lib/secretaria/evidence-sandbox-gate";
import { useQTSPSign } from "@/hooks/useQTSPSign";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const SELECT_CLASSES =
  "h-10 w-full px-3 text-sm bg-[var(--g-surface-card)] text-[var(--g-text-primary)] border border-[var(--g-border-subtle)] focus:border-[var(--g-brand-3308)] focus:outline-none transition-colors";

const INPUT_CLASSES =
  "h-10 w-full px-3 text-sm bg-[var(--g-surface-card)] text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)]/60 border border-[var(--g-border-subtle)] focus:border-[var(--g-brand-3308)] focus:outline-none transition-colors";

const TEXTAREA_CLASSES =
  "w-full px-3 py-2 text-sm bg-[var(--g-surface-card)] text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)]/60 border border-[var(--g-border-subtle)] focus:border-[var(--g-brand-3308)] focus:outline-none transition-colors resize-none";

const LABEL_CLASSES = "block text-xs font-semibold text-[var(--g-text-primary)] uppercase mb-1";

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

interface DelitoCategory {
  id: string;
  title: string;
  lawRef: string;
  description: string;
  keywords: string[];
  fallbackRisks: any[];
  fallbackControls: any[];
}

const DELITOS_TAXONOMY: DelitoCategory[] = [
  {
    id: "cohecho-corrupcion",
    title: "1. Cohecho y Corrupción en los Negocios",
    lawRef: "Art. 286 bis, 419 CP | ISO 37001",
    description: "Previene sobornos, dádivas o favores a funcionarios públicos o entre particulares en relaciones comerciales.",
    keywords: ["cohecho", "corrupcion", "corrupción", "soborno", "regalo", "hospitalidad", "penal", "anticorrup"],
    fallbackRisks: [
      { id: "RSK-PEN-001", code: "RSK-PEN-001", title: "Pagos de facilitación y sobornos a intermediarios comerciales", description: "Riesgo de que agentes o socios comerciales realicen pagos ilícitos en nombre de ARGA Seguros para retener cuentas corporativas.", status: "Abierto", probability: 3, impact: 4, inherent_score: 12, residual_score: 6 },
      { id: "RSK-PEN-002", code: "RSK-PEN-002", title: "Aceptación de regalos y hospitalidades fuera de política", description: "Riesgo de que empleados clave acepten invitaciones, viajes o obsequios de proveedores críticos comprometiendo la imparcialidad.", status: "En Tratamiento", probability: 2, impact: 3, inherent_score: 6, residual_score: 2 }
    ],
    fallbackControls: [
      { id: "CTL-PEN-001", code: "CTL-PEN-001", name: "Política General de Regalos y Hospitalidades", status: "Efectivo", last_test_date: "2026-04-10" },
      { id: "CTL-PEN-002", code: "CTL-PEN-002", name: "Due Diligence Penal en Contratación de Terceros", status: "Parcial", last_test_date: "2026-03-15" }
    ]
  },
  {
    id: "blanqueo-capitales",
    title: "2. Blanqueo de Capitales y Financiación de Terrorismo",
    lawRef: "Art. 301 CP | Ley 10/2010 SEPBLAC",
    description: "Previene la introducción en el tráfico financiero de fondos procedentes de actividades delictivas.",
    keywords: ["blanqueo", "aml", "terrorismo", "capitales", "sancion", "kyc", "sepblac"],
    fallbackRisks: [
      { id: "RSK-PEN-003", code: "RSK-PEN-003", title: "Uso de pólizas de seguro de vida para blanqueo de capitales", description: "Riesgo de que se contraten pólizas de prima única elevada para su cancelación y reembolso anticipado utilizando fondos de origen dudoso.", status: "Abierto", probability: 2, impact: 5, inherent_score: 10, residual_score: 5 },
      { id: "RSK-PEN-004", code: "RSK-PEN-004", title: "Omisión de identificación en Clientes PEP (Personas Expuestas)", description: "Riesgo de no identificar a un tomador como persona de alta exposición política o sometido a sanciones internacionales.", status: "Abierto", probability: 2, impact: 4, inherent_score: 8, residual_score: 4 }
    ],
    fallbackControls: [
      { id: "CTL-PEN-003", code: "CTL-PEN-003", name: "Procedimiento Integrado Conozca a su Cliente (KYC/CDD)", status: "Efectivo", last_test_date: "2026-05-01" },
      { id: "CTL-PEN-004", code: "CTL-PEN-004", name: "Monitoreo y Filtrado de Listas de Sanciones Internacionales", status: "Efectivo", last_test_date: "2026-05-18" }
    ]
  },
  {
    id: "delitos-informaticos",
    title: "3. Delitos Informáticos y Revelación de Secretos",
    lawRef: "Art. 197 bis, 264 CP | DORA RTS / GDPR",
    description: "Previene accesos no autorizados, daños en sistemas informáticos y la revelación indebida de datos confidenciales de clientes.",
    keywords: ["cyber", "seguridad", "ciber", "informatico", "tecnolog", "acceso", "dora", "datos", "secreto", "revelacion", "intrusiones"],
    fallbackRisks: [
      { id: "RSK-PEN-005", code: "RSK-PEN-005", title: "Acceso ilícito a censo y datos personales de asegurados", description: "Riesgo de intrusión externa o fuga interna de bases de datos que contienen información de salud o financiera protegida de asegurados.", status: "En Tratamiento", probability: 3, impact: 5, inherent_score: 15, residual_score: 5 },
      { id: "RSK-PEN-006", code: "RSK-PEN-006", title: "Alteración maliciosa de servidores de producción (Sabotaje)", description: "Riesgo de inyección de malware en plataformas cloud que alteren los datos transaccionales de cobro de primas.", status: "Abierto", probability: 2, impact: 4, inherent_score: 8, residual_score: 4 }
    ],
    fallbackControls: [
      { id: "CTL-PEN-005", code: "CTL-PEN-005", name: "Cifrado Homomórfico en Reposo para Datos de Salud", status: "Efectivo", last_test_date: "2026-04-20" },
      { id: "CTL-PEN-006", code: "CTL-PEN-006", name: "Auditoría de Accesos Privilegiados (PAM) y Doble Factor", status: "Parcial", last_test_date: "2026-02-10" }
    ]
  },
  {
    id: "fraude-hacienda",
    title: "4. Fraude, Estafa y Delitos contra la Hacienda Pública",
    lawRef: "Art. 248, 305 CP | LSC / Prevención de Fraude",
    description: "Previene el fraude en el reporte fiscal, la manipulación de balances contables y las declaraciones incorrectas ante Hacienda.",
    keywords: ["fraude", "estafa", "fiscal", "impuesto", "hacienda", "contabil", "balance", "tributario", "seguridad social"],
    fallbackRisks: [
      { id: "RSK-PEN-007", code: "RSK-PEN-007", title: "Defectos en el cálculo o liquidación de Impuestos de Primas", description: "Riesgo de errores u omisiones conscientes en las liquidaciones fiscales mensuales que conlleven multas administrativas y penales.", status: "Abierto", probability: 2, impact: 4, inherent_score: 8, residual_score: 4 },
      { id: "RSK-PEN-008", code: "RSK-PEN-008", title: "Fraude y colusión en pagos de reaseguro internacional", description: "Riesgo de manipulación de partes de siniestros para canalizar reembolsos ilícitos a entidades instrumentales.", status: "Abierto", probability: 1, impact: 5, inherent_score: 5, residual_score: 2 }
    ],
    fallbackControls: [
      { id: "MOCK-CTL-007", code: "CTL-PEN-007", name: "Procedimiento de Conciliación Fiscal de Doble Firma", status: "Efectivo", last_test_date: "2026-05-05" },
      { id: "MOCK-CTL-008", code: "CTL-PEN-008", name: "Canal de Denuncias para Alertas de Fraude Financiero", status: "Efectivo", last_test_date: "2026-05-15" }
    ]
  },
  {
    id: "propiedad-intelectual",
    title: "5. Delitos contra la Propiedad Intelectual e Industrial",
    lawRef: "Art. 270 CP | Ley de Patentes",
    description: "Previene la utilización o exploitation no autorizada de obras protegidas, patentes o secretos industriales.",
    keywords: ["propiedad", "intelectual", "patente", "licencia", "software", "industrial", "marca", "copyright"],
    fallbackRisks: [
      { id: "RSK-PEN-009", code: "RSK-PEN-009", title: "Uso no autorizado de librerías propietarias y software sin licencia", description: "Riesgo de que equipos de desarrollo utilicen recursos informáticos con licencias restringidas en productos comerciales.", status: "Abierto", probability: 2, impact: 3, inherent_score: 6, residual_score: 3 }
    ],
    fallbackControls: [
      { id: "CTL-PEN-009", code: "CTL-PEN-009", name: "Auditorías de Licenciamiento SAM (Software Asset Management)", status: "Efectivo", last_test_date: "2026-01-20" }
    ]
  }
];

export default function PenalAnticorrupcion() {
  const scope = useSecretariaScope();
  const scopedEntityId = scope.mode === "sociedad" ? scope.selectedEntity?.id ?? null : null;
  const scopeLabel =
    scope.mode === "sociedad" && scope.selectedEntity
      ? scope.selectedEntity.legalName
      : "Grupo ARGA Seguros";

  // Data queries
  const { data: risks = [], isLoading: loadingRisks, refetch: refetchRisks } = useRisks({ entityId: scopedEntityId });
  const { data: obligations = [], isLoading: loadingObligations } = useObligationsList();
  
  const penalObligations = obligations.filter((obligation) =>
    TAXONOMY_TERMS.some((term) => matchesTaxonomy([term], obligation.code, obligation.title, obligation.source, obligation.policy_title))
  );
  
  const obligationIds = penalObligations.map((obligation) => obligation.id);
  const { data: controls = [], isLoading: loadingControls, refetch: refetchControls } = useAllControlsByObligationIds(obligationIds);
  const { data: evidences = [], refetch: refetchEvidences } = useEvidenceBundlesList();

  const createEvidence = useCreateEvidenceBundle();
  const { signMutation } = useQTSPSign();

  // Accordion State
  const [expandedDelito, setExpandedDelito] = useState<string | null>("cohecho-corrupcion");
  const [activeSubTab, setActiveSubTab] = useState<"risks" | "controls" | "evidences">("risks");

  // QES Sealing State
  const [sealingObject, setSealingObject] = useState<{
    type: "RISK" | "CONTROL";
    id: string;
    code: string;
    title: string;
    delitoId: string;
  } | null>(null);

  const [auditorName, setAuditorName] = useState("Lucía Martín");
  const [auditorEmail, setAuditorEmail] = useState("lucia@arga-seguros.com");
  const [evidenceDocName, setEvidenceDocName] = useState("");
  const [signingProgress, setSigningProgress] = useState<string | null>(null);

  const toggleAccordion = (id: string) => {
    setExpandedDelito(expandedDelito === id ? null : id);
  };

  // Helper function to map risks & controls based on keywords fuzzy match + fallback
  const getMappedItems = (delito: DelitoCategory) => {
    // Risks
    const matchedRisks = risks.filter((r) =>
      r.module_id === "penal" ||
      matchesTaxonomy(delito.keywords, r.code, r.title, r.description, r.obligations?.title)
    );
    const finalRisks = matchedRisks.length > 0 ? matchedRisks : delito.fallbackRisks;

    // Obligations linked
    const matchedObs = penalObligations.filter((o) =>
      matchesTaxonomy(delito.keywords, o.code, o.title, o.source, o.policy_title)
    );
    const matchedObIds = matchedObs.map((o) => o.id);

    // Controls
    const matchedControls = controls.filter((c) => matchedObIds.includes(c.obligation_id || ""));
    const finalControls = matchedControls.length > 0 ? matchedControls : delito.fallbackControls;

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

  // Calculate high-level compliance label dynamically based on controls statuses
  const getDelitoCompliance = (controlsList: any[]) => {
    if (controlsList.length === 0) {
      return { 
        label: "SIN EVALUAR", 
        color: "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]" 
      };
    }
    const statuses = controlsList.map((c) => c.status);
    if (statuses.every((s) => s === "Efectivo" || s === "EFECTIVO")) {
      return { 
        label: "CONFORME", 
        color: "bg-[var(--status-success)] text-[var(--g-text-inverse)]" 
      };
    }
    if (statuses.includes("Deficiente") || statuses.includes("DEFICIENTE")) {
      return { 
        label: "DEFICIENTE", 
        color: "bg-[var(--status-error)] text-[var(--g-text-inverse)]" 
      };
    }
    return { 
      label: "REQUERIMIENTO", 
      color: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]" 
      };
  };

  // Trigger QES Evidential Seal
  const handlePerformSeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sealingObject) return;

    try {
      setSigningProgress("Inicializando cifrado y pre-validación de censo...");
      
      const docName = evidenceDocName || `EVIDENCIA-${sealingObject.code}-${new Date().getFullYear()}.pdf`;
      const docData = new TextEncoder().encode(
        `EVIDENCIA DE COMPLIANCE PENAL - CÓDIGO PENAL ART. 31 BIS\n` +
        `Entidad: ${scopeLabel}\n` +
        `Objeto Auditado: [${sealingObject.type}] ${sealingObject.code} - ${sealingObject.title}\n` +
        `Metodología de Auditoría: UNE 19601 / ISO 37001\n` +
        `Auditor Apoderado: ${auditorName} (${auditorEmail})\n` +
        `Fecha de Validación Forense: ${new Date().toLocaleDateString("es-ES")}`
      ).buffer;

      // Simulate Qualified Electronic Signature via QTSP hook
      const signRes = await signMutation.mutateAsync({
        documentName: docName,
        documentData: docData,
        signatories: [{ name: auditorName, email: auditorEmail }],
        createdBy: auditorName,
        onProgress: (step) => setSigningProgress(step),
      });

      if (!signRes.ok) {
        throw new Error(signRes.errors.join(", "));
      }

      setSigningProgress("Sellando certificado de firma y sellado de tiempo en Ledger WORM...");

      // Write Evidence Bundle RPC
      await createEvidence.mutateAsync({
        sourceModule: "GRC_PENAL",
        sourceObjectType: sealingObject.type,
        sourceObjectId: sealingObject.id,
        referenceCode: `CP31BIS-${sealingObject.code.toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
        manifest: {
          object_id: sealingObject.id,
          object_code: sealingObject.code,
          object_title: sealingObject.title,
          qtsp_transaction_id: signRes.srId,
          document_hash: signRes.documentHash,
          signed_at: signRes.signed_at,
          auditor: auditorName,
          auditor_email: auditorEmail,
          regulatory_standard: "Spanish Criminal Code Art 31 bis / ISO 37001 Compliance Matrix"
        },
        documentUrl: `https://hzqwefkwsxopwrmtksbg.supabase.co/storage/v1/object/public/evidence/penal/${docName}`,
        legalHold: false,
        status: "SEALED",
        sandbox: signRes.sandbox,
        signedBy: `${auditorName} (${auditorEmail})`
      });

      toast.success(
        signRes.sandbox
          ? "Certificación generada en modo SANDBOX (demo) — evidencia NO sellada como final (no es una transacción EAD Trust real)."
          : "Certificación Forense QSeal y bundle WORM generados correctamente."
      );
      setSealingObject(null);
      setEvidenceDocName("");
      refetchEvidences();
      refetchRisks();
      refetchControls();
    } catch (err: any) {
      console.error(err);
      toast.error(`Error al sellar evidencia: ${err.message || "Error desconocido"}`);
    } finally {
      setSigningProgress(null);
    }
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
            Vincule riesgos y controles mitigantes, y emita evidencias inmutables selladas mediante firma cualificada QES.
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
          { label: "Riesgos Penales Activos", value: risks.filter(r => r.module_id === "penal" || r.code.startsWith("RSK-PEN")).length || 9, icon: AlertTriangle },
          { label: "Obligaciones Jurídicas", value: penalObligations.length || 12, icon: FileText },
          { label: "Evidencias WORM Selladas", value: evidences.filter(e => e.source_module === "GRC_PENAL" && isFinalSealedEvidence(e.status)).length, icon: ShieldCheck },
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
                      <CheckCircle2 className="h-3 w-3" /> WORM Sealed
                    </span>
                  ) : delitoEvidences.length > 0 ? (
                    <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-[var(--status-warning)] font-semibold font-mono bg-[var(--status-warning)]/10 px-2 py-1 border border-[var(--status-warning)]/20" style={{ borderRadius: "var(--g-radius-sm)" }} title="Evidencia sandbox de demo: no sellada como final">
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
                    {[
                      { id: "risks", label: `Riesgos Penales (${delitoRisks.length})` },
                      { id: "controls", label: `Controles Mitigantes (${delitoControls.length})` },
                      { id: "evidences", label: `Evidencias Forenses (${delitoEvidences.length})` },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveSubTab(tab.id as any)}
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
                              <th className="px-4 py-3 text-center">Score Inh / Res</th>
                              <th className="px-4 py-3">Estado</th>
                              <th className="px-4 py-3 text-right">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--g-border-subtle)]">
                            {delitoRisks.map((risk) => {
                              const inherent = risk.inherent_score || (risk.probability && risk.impact ? risk.probability * risk.impact : 6);
                              const residual = risk.residual_score || Math.ceil(inherent / 2);
                              const isHigh = inherent >= 12;

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
                                    <span className={cn(
                                      "font-bold", 
                                      isHigh ? "text-[var(--status-error)]" : "text-[var(--g-text-primary)]"
                                    )}>
                                      {inherent}
                                    </span>
                                    <span className="text-[var(--g-text-secondary)]/50 mx-1">/</span>
                                    <span className="font-semibold text-[var(--status-success)]">
                                      {residual}
                                    </span>
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
                                      <PenTool className="h-3 w-3" /> QSeal
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
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="bg-[var(--g-surface-subtle)] text-[var(--g-text-primary)] font-semibold border-b border-[var(--g-border-subtle)]">
                              <th className="px-4 py-3">Código</th>
                              <th className="px-4 py-3">Medida de Control / Salvaguarda</th>
                              <th className="px-4 py-3">Estado Evaluado</th>
                              <th className="px-4 py-3">Prueba de Control</th>
                              <th className="px-4 py-3 text-right">Firma Evidencia</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--g-border-subtle)]">
                            {delitoControls.map((control) => {
                              const isEffective = control.status === "Efectivo" || control.status === "EFECTIVO";
                              const statusLabel = controlStatusLabel(control.status);
                              
                              // Check if there is already a QSeal evidence bundle
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
                                          <span className="text-[9px] text-[var(--status-warning)] font-semibold" title="Existe evidencia sandbox de demo (no sellada como final)">sandbox</span>
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
                                          <PenTool className="h-3 w-3" /> Sellar QSeal
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
                    )}

                    {/* Tab: Evidence WORM */}
                    {activeSubTab === "evidences" && (
                      <div className="space-y-4">
                        {delitoEvidences.length === 0 ? (
                          <div className="p-6 text-center text-xs text-[var(--g-text-secondary)] bg-[var(--g-surface-subtle)]/20 border border-dashed border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-md)" }}>
                            <HelpCircle className="h-6 w-6 text-[var(--g-text-secondary)]/40 mx-auto mb-2" />
                            <span className="block font-semibold">Sin sellos electrónicos forenses</span>
                            <span className="block mt-0.5">Utilice el botón de Sellar en las pestañas de Riesgos o Controles para emitir un bundle WORM cualificado.</span>
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
                                    {evidence.reference_code || `WORM-${evidence.id.slice(0, 8).toUpperCase()}`}
                                  </span>
                                  {isFinalSeal ? (
                                    <span className="inline-flex items-center gap-0.5 text-[9px] text-[var(--status-success)] font-bold">
                                      <CheckCircle2 className="h-3 w-3" /> QSeal Custodia
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-0.5 text-[9px] text-[var(--status-warning)] font-bold" title="Evidencia sandbox de demo: NO sellada como final (no es una transacción EAD Trust real)">
                                      SANDBOX
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-[var(--g-text-secondary)] font-mono space-y-1">
                                  <div><strong>Firmante:</strong> {evidence.signed_by || "Apoderado de Cumplimiento"}</div>
                                  <div><strong>Fecha Sellado:</strong> {evidence.created_at ? new Date(evidence.created_at).toLocaleString("es-ES") : "—"}</div>
                                  <div className="line-clamp-1"><strong>Hash SHA-512:</strong> <span className="break-all font-mono text-[9px]">{evidence.hash_sha512 || "Pendiente"}</span></div>
                                  <div className="line-clamp-1"><strong>Audit ID:</strong> {evidence.id}</div>
                                </div>
                                <div className="pt-2 border-t border-[var(--g-border-subtle)] flex items-center justify-between text-[10px]">
                                  {isFinalSeal ? (
                                    <>
                                      <span className="text-[var(--g-text-secondary)]">Prueba forense inmutable</span>
                                      <a
                                        href="#"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          toast.info(`EAD Trust Custody ID: ${evidence.id}\nHash: ${evidence.hash_sha512}`);
                                        }}
                                        className="text-[var(--g-brand-3308)] hover:underline inline-flex items-center gap-0.5"
                                      >
                                        Verificar QSeal <ExternalLink className="h-3 w-3" />
                                      </a>
                                    </>
                                  ) : (
                                    <span className="text-[var(--status-warning)]">Evidencia sandbox de demo — sin custodia QSeal verificable (no es una transacción EAD Trust real).</span>
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
      {/* Modal: Certificación Forense QSeal                           */}
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
                Certificación Forense QSeal (EAD Trust)
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
                <span>Está a punto de emitir una evidencia digital cualificada inmutable asociada al {sealingObject.type === "CONTROL" ? "control" : "riesgo"}:</span>
                <strong className="block mt-1 text-[var(--g-text-primary)] font-mono">{sealingObject.code} — {sealingObject.title}</strong>
              </div>

              <div className="space-y-1">
                <label htmlFor="auditor-name-input" className={LABEL_CLASSES}>Nombre Auditor Apoderado *</label>
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
                <label htmlFor="auditor-email-input" className={LABEL_CLASSES}>Email del Apoderado *</label>
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
                    custody_provider: "EAD Trust Qualified TSP",
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
                    type="submit"
                    className="flex-1 h-10 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] text-sm font-semibold transition-colors flex items-center justify-center gap-1.5"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <PenTool className="h-4 w-4" />
                    Sellar Evidencia QSeal
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
