import { useState } from "react";
import { 
  ShieldCheck, Activity, Scale, FileText, CheckCircle2, 
  AlertTriangle, Clock, Calculator, ExternalLink, Send, ArrowUpRight 
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { buildMeetingHandoffPath } from "@/lib/secretaria/cross-module-handoff";
import { toast } from "sonner";
import { useTenantBranding } from "@/context/TenantBrandContext";
import { isModuleEnabled } from "@/lib/tenant-modules";
import { DemoFixtureNotice } from "@/components/grc/DemoFixtureNotice";

interface KeyFunctionData {
  id: string;
  name: string;
  solvencyArticle: string;
  responsible: string;
  fitAndProperStatus: "No medido" | "En Renovación" | "Pendiente";
  annualReportStatus: "No medido" | "En Elaboración" | "Planificado";
  opinionsMandatory: string[];
  currentHealth: "No medido" | "Atención Requerida" | "Crítico";
}

// Esta pantalla NO lee Cloud: los cuatro registros y los cuatro KPI son
// literales del código. Se conserva por decisión del usuario y se etiqueta como
// demo no medida; lo que desaparece son las afirmaciones que un lector podría
// tomar por hechos: idoneidad «Acreditada y Vigente», informes «Emitidos y
// Aprobados por CdA», salud «Óptimo», y sobre todo el ORSA «Remitido
// formalmente a DGSFP», que afirma una remisión a la autoridad supervisora.
const KEY_FUNCTIONS: KeyFunctionData[] = [
  {
    id: "kf-01",
    name: "1. Función de Gestión de Riesgos",
    solvencyArticle: "Solvencia II Art. 44 · Reg. Delegado 2015/35",
    responsible: "Chief Risk Officer (CRO)",
    fitAndProperStatus: "No medido",
    annualReportStatus: "No medido",
    opinionsMandatory: [
      "Informe Anual de Riesgos e Idoneidad de Modelos",
      "Coordinación del Informe ORSA y Stress Testing",
      "Supervisión del Marco de Apetito al Riesgo (RAF)",
    ],
    currentHealth: "No medido",
  },
  {
    id: "kf-02",
    name: "2. Función de Cumplimiento Normativo",
    solvencyArticle: "Solvencia II Art. 46 · ROSSP",
    responsible: "Director de Cumplimiento (CCO)",
    fitAndProperStatus: "No medido",
    annualReportStatus: "No medido",
    opinionsMandatory: [
      "Evaluación del impacto de modificaciones legislativas",
      "Dictamen de idoneidad y honorabilidad (Fit & Proper)",
      "Supervisión del Canal Interno de Denuncias (Ley 2/2023)",
    ],
    currentHealth: "No medido",
  },
  {
    id: "kf-03",
    name: "3. Función de Auditoría Interna",
    solvencyArticle: "Solvencia II Art. 47 · IIA 2024",
    responsible: "Director de Auditoría Interna (CAE)",
    fitAndProperStatus: "No medido",
    annualReportStatus: "No medido",
    opinionsMandatory: [
      "Informe Anual de Eficacia del Control Interno",
      "Seguimiento de Recomendaciones y Planes de Acción",
      "Garantía de Independencia ante Comisión de Auditoría",
    ],
    currentHealth: "No medido",
  },
  {
    id: "kf-04",
    name: "4. Función Actuarial",
    solvencyArticle: "Solvencia II Art. 48 · Directrices EIOPA",
    responsible: "Actuario Jefe Responsable",
    fitAndProperStatus: "No medido",
    annualReportStatus: "No medido",
    opinionsMandatory: [
      "Coordinación del cálculo de Provisiones Técnicas",
      "Opinión preceptiva sobre la Política Global de Suscripción",
      "Opinión preceptiva sobre los Convenios y Programa de Reaseguro",
    ],
    currentHealth: "No medido",
  },
];

export default function SolvenciaII() {
  const navigate = useNavigate();
  const branding = useTenantBranding();
  const [activeTab, setActiveTab] = useState<"functions" | "orsa">("functions");
  const [extraordinaryOrsaTriggered, setExtraordinaryOrsaTriggered] = useState(false);

  const handleEscalateOrsaToBoard = () => {
    toast.success("Abriendo intake de Secretaría con la propuesta de ORSA extraordinario…");
    navigate(buildMeetingHandoffPath({
      source: "grc",
      event: "GRC_INCIDENT_MATERIAL",
      sourceId: "ORSA-EXTRA-2026",
      organ: "CDA",
      matter: "Aprobación y Remisión de ORSA Extraordinario por Modificación del Perfil de Riesgo",
      rationale: "El Comité de Riesgos eleva al Consejo de Administración los resultados del ORSA Extraordinario tras el impacto material simulado y la validación de la ratio de solvencia proyectada.",
    }));
  };

  // El régimen de Solvencia II es sectorial asegurador. El item de menú ya va
  // gateado; esto cierra además la URL directa. Falla ABIERTO: ARGA, sin
  // `branding.modules`, no ve ningún cambio.
  if (!isModuleEnabled(branding, "solvencia-ii")) {
    return (
      <div className="p-6 space-y-3">
        <h1 className="text-2xl font-bold text-[var(--g-text-primary)]">Gobernanza Solvencia II</h1>
        <p className="text-sm text-[var(--g-text-secondary)]">
          El régimen de Solvencia II no está habilitado para este grupo.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Scale className="h-6 w-6 text-[var(--g-brand-3308)]" />
            <h1 className="text-2xl font-bold text-[var(--g-text-primary)]">
              Gobernanza Solvencia II y Evaluación ORSA
            </h1>
          </div>
          <p className="text-sm text-[var(--g-text-secondary)]">
            Supervisión estatutaria de las 4 Funciones Clave, Idoneidad (Fit & Proper), Provisiones Técnicas y Evaluación Interna de Riesgos y Solvencia (ORSA).
          </p>
        </div>
      </header>

      <DemoFixtureNotice>
        Esta pantalla no lee ninguna tabla: las cuatro funciones clave, sus estados y los indicadores
        son un guion fijo de demostración. Ninguna cifra está medida y no consta ninguna remisión a
        la Dirección General de Seguros y Fondos de Pensiones.
      </DemoFixtureNotice>

      {/* KPI Solvencia Global */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { label: "Ratio de Solvencia (SCR)", val: "sin dato", sub: "Mínimo regulatorio: 100%. No se calcula en este entorno.", color: "text-[var(--g-text-secondary)]" },
          { label: "Ratio de Cobertura MCR", val: "sin dato", sub: "No se calcula en este entorno.", color: "text-[var(--g-text-secondary)]" },
          { label: "Funciones clave catalogadas", val: String(KEY_FUNCTIONS.length), sub: "Idoneidad Fit & Proper: no medida.", color: "text-[var(--g-text-primary)]" },
          { label: "Ciclo ORSA 2026", val: "sin dato", sub: "No consta remisión a la autoridad supervisora.", color: "text-[var(--g-text-secondary)]" },
        ].map((k) => (
          <div
            key={k.label}
            className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-4"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="text-xs uppercase font-bold text-[var(--g-text-secondary)]">{k.label}</div>
            <div className={`text-2xl font-bold my-1 ${k.color}`}>{k.val}</div>
            <div className="text-[11px] text-[var(--g-text-secondary)]">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] rounded-t">
        <button
          type="button"
          onClick={() => setActiveTab("functions")}
          className={`px-5 py-3 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === "functions"
              ? "border-[var(--g-brand-3308)] text-[var(--g-brand-3308)] bg-[var(--g-surface-subtle)]/40"
              : "border-transparent text-[var(--g-text-secondary)] hover:text-[var(--g-brand-3308)]"
          }`}
        >
          4 Funciones Clave del Sistema de Gobernanza (Arts. 44-48)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("orsa")}
          className={`px-5 py-3 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === "orsa"
              ? "border-[var(--g-brand-3308)] text-[var(--g-brand-3308)] bg-[var(--g-surface-subtle)]/40"
              : "border-transparent text-[var(--g-text-secondary)] hover:text-[var(--g-brand-3308)]"
          }`}
        >
          Proceso y Disparadores ORSA (Art. 45)
        </button>
      </div>

      {/* Tab: 4 Funciones Clave */}
      {activeTab === "functions" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {KEY_FUNCTIONS.map((kf) => (
            <div
              key={kf.id}
              className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-5 flex flex-col justify-between space-y-4"
              style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-mono text-xs font-bold text-[var(--g-brand-3308)]">
                    {kf.solvencyArticle}
                  </span>
                  <span
                    className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]"
                    style={{ borderRadius: "var(--g-radius-full)" }}
                  >
                    {kf.currentHealth}
                  </span>
                </div>
                <h2 className="text-base font-bold text-[var(--g-text-primary)]">
                  {kf.name}
                </h2>
                <div className="text-xs text-[var(--g-text-secondary)] mt-1">
                  Titular responsable: <strong>{kf.responsible}</strong>
                </div>
              </div>

              <div className="space-y-2 border-t border-[var(--g-border-subtle)] pt-3 text-xs">
                <div className="font-bold uppercase text-[10px] text-[var(--g-text-secondary)]">
                  Informes e Informes Preceptivos Anuales:
                </div>
                <ul className="space-y-1 pl-4 list-disc text-[var(--g-text-primary)]">
                  {kf.opinionsMandatory.map((op, i) => (
                    <li key={i}>{op}</li>
                  ))}
                </ul>
              </div>

              <div className="border-t border-[var(--g-border-subtle)] pt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[var(--g-text-secondary)] block">Idoneidad Fit & Proper:</span>
                  <span className="text-[var(--g-text-secondary)] font-semibold">{kf.fitAndProperStatus}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[var(--g-text-secondary)] block">Informe al Consejo:</span>
                  <span className="text-[var(--g-text-primary)] font-medium">{kf.annualReportStatus}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: ORSA */}
      {activeTab === "orsa" && (
        <div className="space-y-6">
          <div
            className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-6 space-y-4"
            style={{ borderRadius: "var(--g-radius-xl)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--g-border-subtle)] pb-4">
              <div>
                <h2 className="text-base font-bold text-[var(--g-text-primary)]">
                  Evaluación Interna de Riesgos y Solvencia (ORSA Anual y Extraordinario)
                </h2>
                <p className="text-xs text-[var(--g-text-secondary)]">
                  Conforme al Art. 45 de Solvencia II, el ORSA es parte integrante de la estrategia empresarial y se evalúa continuamente.
                </p>
              </div>
              <button
                type="button"
                onClick={handleEscalateOrsaToBoard}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] transition-colors"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <Send className="h-3.5 w-3.5" />
                Elevar ORSA a Consejo de Administración
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* ORSA Ordinario */}
              <div className="p-4 bg-[var(--g-surface-subtle)] border border-[var(--g-border-subtle)] rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[var(--status-success)]" />
                  <h3 className="text-xs font-bold uppercase text-[var(--g-text-primary)]">
                    ORSA Ordinario Anual 2026
                  </h3>
                </div>
                <p className="text-xs text-[var(--g-text-secondary)] leading-relaxed">
                  Evaluación global de necesidades globales de solvencia para el horizonte temporal del plan estratégico (2026-2028).
                </p>
                <div className="pt-2 text-xs space-y-1">
                  <div>• Escenarios base y de estrés macroeconómico / tipos de interés</div>
                  <div>• Cumplimiento continuado de provisiones técnicas y SCR</div>
                  <div>• Aprobación por CdA: <strong>no consta</strong></div>
                </div>
              </div>

              {/* ORSA Extraordinario Triggers */}
              <div className="p-4 bg-[var(--status-warning)]/10 border border-[var(--status-warning)]/30 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-[var(--status-warning)]" />
                  <h3 className="text-xs font-bold uppercase text-[var(--g-text-primary)]">
                    Disparadores de ORSA Extraordinario
                  </h3>
                </div>
                <p className="text-xs text-[var(--g-text-secondary)] leading-relaxed">
                  Se activa preceptivamente ante alteraciones sustanciales del perfil de riesgo (adquisiciones, catástrofes o caída del SCR &lt; 160%).
                </p>
                <div className="pt-2 text-xs space-y-1">
                  <div>• Variación del SCR &gt; 20 puntos porcentuales</div>
                  <div>• Evento de ciberseguridad o interrupción TIC mayor DORA</div>
                  <div>• Operaciones corporativas de fusión, escisión o cesión de cartera</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
