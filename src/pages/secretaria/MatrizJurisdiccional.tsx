// MatrizJurisdiccional — Multi-jurisdicción MVP (filiales dependientes)
// Modelo correcto: la gobernanza real es en España (ARGA Seguros S.A.).
// Las filiales BR/MX/PT son instrumentos de tenencia controlados al 100%.
// El proceso local se reduce a: ejecutar la decisión del grupo + inscribir localmente.

import { useState } from "react";
import {
  Globe, Building2, FileCheck2, AlertTriangle, Clock,
  ChevronRight, CheckCircle2, ArrowRight, Info,
  Gavel, ScrollText, Flag, LayoutGrid, GitCompare,
  ShieldCheck, Languages, CircleDot, Lock, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useFilialEntitiesByJurisdiction,
  useFilialAgreementCounts,
} from "@/hooks/useFilialEntities";
import { useEntityRules } from "@/hooks/useJurisdiccionRules";

/* ── Tipos ────────────────────────────────────────────────────────────────── */

type JurisCode = "ES" | "PT" | "BR" | "MX";

// Lo que realmente varía para una filial dependiente (no la gobernanza, sino la formalización)
interface FilialFormalizacion {
  code: JurisCode;
  bandera: string;
  nombre: string;
  ley_marco: string;
  forma_juridica_tipica: string;    // Qué forma jurídica usan las filiales 100%
  // La decisión del grupo necesita...
  requiere_acuerdo_local: boolean;  // ¿Hace falta acuerdo formal del órgano local?
  forma_acuerdo_local: string;      // Cómo se adopta (junta universal, decisión escrita, etc.)
  plazo_convocatoria_local: string; // Si hay junta: plazo exigido
  requiere_escritura_pub: boolean;  // ¿Notario obligatorio?
  registro_local: string;           // Dónde inscribir
  plazo_inscripcion_dias: number;
  idioma_doc: string;               // Idioma de los documentos locales
  traduccion_jurada: boolean;       // ¿Traducción jurada de la decisión española?
  // Operativa TGMS
  entidades: { nombre: string; participacion: string; ciudad: string; acuerdos_pendientes: number; alertas: number }[];
  vencimientos: { label: string; tipo: string; dias: number }[];
  // Lo que NO aplica (a diferencia de entidad independiente)
  simplificaciones: string[];
}

/* ── Datos por jurisdicción — modelo FILIAL DEPENDIENTE ──────────────────── */

const FILIALES: Record<JurisCode, FilialFormalizacion> = {
  ES: {
    code: "ES", bandera: "🇪🇸", nombre: "España",
    ley_marco: "LSC — RD Leg. 1/2010",
    forma_juridica_tipica: "Sociedad Unipersonal (SLU / SAU)",
    requiere_acuerdo_local: true,
    forma_acuerdo_local: "Decisión del socio único (art. 15 LSC) — sin junta presencial",
    plazo_convocatoria_local: "No aplica — socio único",
    requiere_escritura_pub: false,
    registro_local: "Registro Mercantil",
    plazo_inscripcion_dias: 30,
    idioma_doc: "Español",
    traduccion_jurada: false,
    entidades: [
      { nombre: "Cartera ARGA S.L.U.", participacion: "100%", ciudad: "Madrid", acuerdos_pendientes: 1, alertas: 0 },
    ],
    vencimientos: [
      { label: "Inscripción decisión socio único — Cartera ARGA", tipo: "REGISTRO", dias: 12 },
      { label: "Depósito cuentas anuales Cartera ARGA", tipo: "LIBRO", dias: 28 },
    ],
    simplificaciones: [
      "No requiere convocatoria ni plazo de antelación (socio único)",
      "No hay riesgo de quórum insuficiente",
      "No existen minorías que proteger",
      "Las actas son sustituid as por decisiones escritas del socio único",
    ],
  },
  PT: {
    code: "PT", bandera: "🇵🇹", nombre: "Portugal",
    ley_marco: "CSC — DL 262/86",
    forma_juridica_tipica: "Sociedade Unipessoal por Quotas (SUQ)",
    requiere_acuerdo_local: true,
    forma_acuerdo_local: "Decisão do sócio único — sem assembleia presencial (art. 270-G CSC)",
    plazo_convocatoria_local: "No aplica — socio único",
    requiere_escritura_pub: false,
    registro_local: "Conservatória do Registo Comercial (IRN)",
    plazo_inscripcion_dias: 60,
    idioma_doc: "Portugués (PT)",
    traduccion_jurada: true,   // La decisión española requiere traducción jurada
    entidades: [
      { nombre: "ARGA Seguros Portugal, Unipessoal Lda.", participacion: "100%", ciudad: "Lisboa", acuerdos_pendientes: 2, alertas: 0 },
    ],
    vencimientos: [
      { label: "Registo decisão sócio único — Portugal", tipo: "REGISTRO", dias: 45 },
      { label: "Depósito contas IRN", tipo: "LIBRO", dias: 19 },
    ],
    simplificaciones: [
      "Sin assembleia geral — decisión del sócio único basta (CSC art. 270-G)",
      "Sin plazo de convocatoria (no hay socios que convocar)",
      "Sin quórum ni mayorías locales — socio único vota el 100%",
      "Solo formalidad: decisión escrita + traducción jurada + IRN",
    ],
  },
  BR: {
    code: "BR", bandera: "🇧🇷", nombre: "Brasil",
    ley_marco: "LSAB — Lei 6.404/76 + CC para Ltda",
    forma_juridica_tipica: "Sociedade Limitada Unipessoal (SLU — desde 2021)",
    requiere_acuerdo_local: true,
    forma_acuerdo_local: "Decisão do sócio único — dispensada reunião (CC art. 1.072 §1)",
    plazo_convocatoria_local: "No aplica — socio único",
    requiere_escritura_pub: false,
    registro_local: "Junta Comercial (JUCESP / JUCERJA según estado)",
    plazo_inscripcion_dias: 30,
    idioma_doc: "Portugués (BR)",
    traduccion_jurada: true,
    entidades: [
      { nombre: "ARGA Seguros Brasil Ltda.", participacion: "100%", ciudad: "São Paulo", acuerdos_pendientes: 4, alertas: 2 },
    ],
    vencimientos: [
      { label: "Registro alteração contratual JUCESP", tipo: "REGISTRO", dias: 3 },
      { label: "Publicação ata Ltda. (si requirida)", tipo: "REGISTRO", dias: 7 },
      { label: "Entrega DEFIS Receita Federal", tipo: "LIBRO", dias: 22 },
    ],
    simplificaciones: [
      "SLU: sin reunião de sócios — decisão escrita do sócio único (CC art. 1.072 §1)",
      "Sin quórum — el socio único ES el 100% del capital",
      "Sin minorías ni socios disidentes",
      "Sin publicación en Diário Oficial (Ltda. no cotizada)",
      "Atenção: SUSEP puede exigir comunicación previa en seguradoras",
    ],
  },
  MX: {
    code: "MX", bandera: "🇲🇽", nombre: "México",
    ley_marco: "LGSM — DOF 1934 (reforma 2016)",
    forma_juridica_tipica: "Sociedad Anónima de Capital Variable (SA de CV)",
    requiere_acuerdo_local: true,
    forma_acuerdo_local: "Asamblea universal (accionista único presente = quórum automático art. 189 LGSM)",
    plazo_convocatoria_local: "Se puede celebrar sin previo aviso si el accionista único está presente",
    requiere_escritura_pub: true,    // México siempre requiere acta notarial para inscribir
    registro_local: "Registro Público de Comercio (RPC) vía notario",
    plazo_inscripcion_dias: 15,
    idioma_doc: "Español (MX)",
    traduccion_jurada: false,
    entidades: [
      { nombre: "ARGA Seguros México S.A. de C.V.", participacion: "100%", ciudad: "Ciudad de México", acuerdos_pendientes: 2, alertas: 1 },
    ],
    vencimientos: [
      { label: "Protocolo notarial acuerdo — México", tipo: "REGISTRO", dias: 8 },
      { label: "Inscripción RPC acuerdo estructural", tipo: "REGISTRO", dias: 12 },
    ],
    simplificaciones: [
      "Sin convocatoria previa — asamblea universal válida si el accionista único asiste",
      "Sin quórum ni mayorías: el accionista único aprueba el 100%",
      "Sin protección de minorías",
      "ATENCIÓN: escritura ante notario siempre obligatoria para inscripción RPC",
      "ATENCIÓN: CNSF puede requerir autorización previa para cambios de control",
    ],
  },
};

const JURIS_ORDER: JurisCode[] = ["ES", "PT", "BR", "MX"];

// Materias del grupo y cómo se formaliza en cada filial
interface MateriaGrupo {
  materia: string;
  descripcion: string;
  decide_en: string;          // Siempre "CdA ARGA Seguros S.A. (ES)"
  formaliza: Record<JurisCode, {
    requiere: string;         // Qué documentación local hace falta
    bloqueo: string | null;   // Requisito regulatorio específico (SUSEP, CNSF…)
  }>;
}

const MATERIAS_GRUPO: MateriaGrupo[] = [
  {
    materia: "Nombramiento / cese de administrador",
    descripcion: "Cambios en el órgano de administración de una filial",
    decide_en: "CdA ARGA Seguros S.A. (ES) o delegado",
    formaliza: {
      ES: { requiere: "Decisión socio único + inscripción RM", bloqueo: null },
      PT: { requiere: "Decisão sócio único + tradução jurada + IRN", bloqueo: null },
      BR: { requiere: "Ata de decisão sócio único + JUCESP", bloqueo: "Notificar SUSEP si el cargo es Diretor" },
      MX: { requiere: "Acta notarial asamblea universal + RPC", bloqueo: "Comunicar CNSF cambio de apoderado general" },
    },
  },
  {
    materia: "Modificación de estatutos",
    descripcion: "Cambio de objeto, denominación, capital, domicilio",
    decide_en: "CdA / JGA ARGA Seguros S.A. (ES)",
    formaliza: {
      ES: { requiere: "Escritura notarial + RM + BORME", bloqueo: null },
      PT: { requiere: "Decisão + tradução jurada + escritura + IRN + depósito contas", bloqueo: null },
      BR: { requiere: "Alteração contratual + JUCESP", bloqueo: "Seguradoras: SUSEP aprueba cambio de objeto" },
      MX: { requiere: "Escritura notarial + RPC", bloqueo: "Cambio objeto social: autorización CNSF previa" },
    },
  },
  {
    materia: "Distribución de dividendos / reservas",
    descripcion: "Acuerdo de reparto de beneficios a la matriz española",
    decide_en: "CdA ARGA Seguros S.A. (ES)",
    formaliza: {
      ES: { requiere: "Decisión socio único + retención IRNR si procede", bloqueo: null },
      PT: { requiere: "Decisão sócio único + retención fonte (IRC/IRS)", bloqueo: null },
      BR: { requiere: "Ata sócio único + retención IRRF 15% (remessa ao exterior)", bloqueo: "IOF sobre remesa — consultar banco" },
      MX: { requiere: "Acta asamblea universal + retención ISR 10%", bloqueo: "Notificar SAT para pago de impuesto" },
    },
  },
  {
    materia: "Operación estructural (fusión / escisión / liquidación)",
    descripcion: "Reorganizaciones societarias del grupo",
    decide_en: "JGA ARGA Seguros S.A. (ES) — mayoría reforzada 2/3",
    formaliza: {
      ES: { requiere: "Proyecto + balance + escritura + RM + BORME + plazo impugnación 1 mes", bloqueo: null },
      PT: { requiere: "Proyecto fusão + registo preliminar + assembleia (1 mes publicación) + IRN", bloqueo: "BdP: autorización previa para seguradoras" },
      BR: { requiere: "Protocolo + JUCESP + publicación DOU + 60 días oposición acreedores", bloqueo: "SUSEP: autorización previa obligatoria" },
      MX: { requiere: "Acuerdos asamblea + protocolización + RPC + 3 meses plazo acreedores", bloqueo: "CNSF: autorización previa + dictamen actuarial" },
    },
  },
  {
    materia: "Préstamo / garantía intragrupo",
    descripcion: "Operaciones financieras entre la matriz y una filial",
    decide_en: "Comité Ejecutivo / CdA según cuantía",
    formaliza: {
      ES: { requiere: "Contrato intercompany + precios transferencia (art. 18 LIS)", bloqueo: null },
      PT: { requiere: "Contrato + preços transferência + registo BdP si >1M€", bloqueo: null },
      BR: { requiere: "Contrato + registro BACEN (ROF) si préstamo exterior", bloqueo: "IOF financeiro + preços de transferência OCDE" },
      MX: { requiere: "Contrato + precios transferencia + estudio IMSS/SAT", bloqueo: null },
    },
  },
];

/* ── Helpers UI ──────────────────────────────────────────────────────────── */

function urgencyBadge(dias: number) {
  if (dias <= 7)  return "bg-[var(--status-error)] text-white";
  if (dias <= 30) return "bg-[var(--status-warning)] text-white";
  return "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]";
}

function tipoLabel(tipo: string): string {
  return { REGISTRO: "Inscripción", LIBRO: "Depósito / Libro", SIN_SESION: "Sin sesión" }[tipo] ?? tipo;
}

type ViewMode = "dashboard" | "materias";

/* ── Componente principal ────────────────────────────────────────────────── */

export default function MatrizJurisdiccional() {
  const [activeTab, setActiveTab] = useState<JurisCode>("ES");
  const [viewMode, setViewMode] = useState<ViewMode>("dashboard");
  const f = FILIALES[activeTab];

  const totalEntidades = JURIS_ORDER.reduce((s, k) => s + FILIALES[k].entidades.length, 0);
  const totalAcuerdos  = JURIS_ORDER.reduce((s, k) => s + FILIALES[k].entidades.reduce((a, e) => a + e.acuerdos_pendientes, 0), 0);
  const totalAlertas   = JURIS_ORDER.reduce((s, k) => s + FILIALES[k].entidades.reduce((a, e) => a + e.alertas, 0), 0);

  return (
    <div className="min-h-screen bg-[var(--g-surface-page)]">
      {/* ── Banner: modelo filial dependiente ─────────────────────────── */}
      <div className="flex items-center gap-3 border-b border-[var(--g-sec-300)] bg-[var(--g-sec-100)] px-8 py-2.5 text-sm">
        <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--g-brand-3308)]" />
        <span className="text-[var(--g-text-primary)]">
          <span className="font-semibold text-[var(--g-brand-3308)]">Modelo: filiales 100% dependientes.</span>
          {" "}La gobernanza real ocurre en{" "}
          <span className="font-semibold">ARGA Seguros S.A. (España)</span>.
          Las filiales solo formalizan localmente la decisión del grupo.
          Quórum, mayorías y convocatoria son irrelevantes en la mayoría de materias.
        </span>
      </div>

      {/* ── Cabecera ──────────────────────────────────────────────────── */}
      <div className="bg-[var(--g-surface-card)] border-b border-[var(--g-border-subtle)] px-8 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Globe className="h-6 w-6 text-[var(--g-brand-3308)]" />
            <div>
              <h1 className="text-xl font-bold text-[var(--g-text-primary)]">
                Secretaría Multi-jurisdicción
              </h1>
              <p className="text-sm text-[var(--g-text-secondary)] mt-0.5">
                Grupo ARGA Seguros · {JURIS_ORDER.length} jurisdicciones ·
                Formalización local de decisiones del grupo
              </p>
            </div>
          </div>

          <div
            className="flex items-center bg-[var(--g-surface-muted)] p-1"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <button
              onClick={() => setViewMode("dashboard")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm transition-all",
                viewMode === "dashboard"
                  ? "bg-[var(--g-surface-card)] text-[var(--g-brand-3308)] font-medium shadow-sm"
                  : "text-[var(--g-text-secondary)]"
              )}
              style={{ borderRadius: "var(--g-radius-sm)" }}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Por filial
            </button>
            <button
              onClick={() => setViewMode("materias")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm transition-all",
                viewMode === "materias"
                  ? "bg-[var(--g-surface-card)] text-[var(--g-brand-3308)] font-medium shadow-sm"
                  : "text-[var(--g-text-secondary)]"
              )}
              style={{ borderRadius: "var(--g-radius-sm)" }}
            >
              <GitCompare className="h-3.5 w-3.5" />
              Por materia
            </button>
          </div>
        </div>

        {/* KPIs globales */}
        <div className="mt-4 flex items-center gap-6">
          {[
            { label: "Filiales", value: totalEntidades, icon: Building2 },
            { label: "Formalizaciones pendientes", value: totalAcuerdos, icon: FileCheck2 },
            { label: "Alertas regulatorias", value: totalAlertas, icon: AlertTriangle },
          ].map((k) => {
            const Icon = k.icon;
            return (
              <div key={k.label} className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-[var(--g-brand-3308)]" />
                <span className="text-2xl font-bold text-[var(--g-text-primary)]">{k.value}</span>
                <span className="text-sm text-[var(--g-text-secondary)]">{k.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Tabs jurisdicción ─────────────────────────────────────────── */}
      <div className="flex border-b border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-8">
        {JURIS_ORDER.map((code) => {
          const ff = FILIALES[code];
          const alerts = ff.entidades.reduce((a, e) => a + e.alertas, 0);
          return (
            <button
              key={code}
              onClick={() => setActiveTab(code)}
              className={cn(
                "relative flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors",
                activeTab === code
                  ? "border-[var(--g-brand-3308)] text-[var(--g-brand-3308)]"
                  : "border-transparent text-[var(--g-text-secondary)] hover:text-[var(--g-text-primary)]"
              )}
            >
              <span className="text-base">{ff.bandera}</span>
              <span>{ff.nombre}</span>
              {alerts > 0 && (
                <span
                  className="flex h-4 w-4 items-center justify-center text-[10px] font-bold text-white bg-[var(--status-error)]"
                  style={{ borderRadius: "var(--g-radius-full)" }}
                >
                  {alerts}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Contenido ─────────────────────────────────────────────────── */}
      <div className="px-8 py-6">
        {viewMode === "dashboard" ? (
          <FilialDashboard f={f} />
        ) : (
          <MateriasCrossView activeCode={activeTab} />
        )}
      </div>
    </div>
  );
}

/* ── Dashboard por filial ────────────────────────────────────────────────── */

function FilialDashboard({ f }: { f: FilialFormalizacion }) {
  const { data: byJuris, filiales, isLoading: filialesLoading } = useFilialEntitiesByJurisdiction();
  const liveEntities = byJuris[f.code] ?? [];
  const { data: agreementCounts = {} } = useFilialAgreementCounts(
    liveEntities.length > 0 ? liveEntities.map((e) => e.id) : []
  );
  const { data: ruleSets = [] } = useEntityRules(
    f.code,
    liveEntities[0]?.tipo_social ?? undefined
  );
  const activeRuleSet = ruleSets.find((r) => r.is_active) ?? ruleSets[0] ?? null;

  return (
    <div className="space-y-5">
      {/* Encabezado filial */}
      <div className="flex items-center gap-3">
        <span className="text-2xl">{f.bandera}</span>
        <div>
          <h2 className="text-lg font-bold text-[var(--g-text-primary)]">{f.nombre}</h2>
          <p className="text-sm text-[var(--g-text-secondary)]">
            {f.ley_marco} · Forma: <span className="font-medium text-[var(--g-text-primary)]">{f.forma_juridica_tipica}</span>
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span
            className="px-2.5 py-1 text-xs font-semibold text-[var(--g-brand-3308)] bg-[var(--g-sec-100)] border border-[var(--g-sec-300)]"
            style={{ borderRadius: "var(--g-radius-full)" }}
          >
            Filial 100%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Proceso de formalización */}
        <div className="col-span-2 space-y-4">
          {/* Card: cómo se adopta la decisión local */}
          <div
            className="bg-[var(--g-surface-card)] p-5 border border-[var(--g-border-subtle)]"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <h3 className="text-sm font-semibold text-[var(--g-text-primary)] mb-4">
              Proceso tipo — formalización de decisión del grupo
            </h3>
            <div className="relative pl-6">
              {/* línea vertical */}
              <div className="absolute left-2 top-2 bottom-2 w-px bg-[var(--g-border-subtle)]" />

              {[
                {
                  num: "1",
                  titulo: "Decisión en España",
                  desc: "CdA o Comité Ejecutivo ARGA Seguros S.A. adopta el acuerdo. Compliance verifica pactos parasociales y motor LSC.",
                  where: "TGMS España",
                  highlight: true,
                },
                {
                  num: "2",
                  titulo: "Instrucciones a la filial",
                  desc: `Secretaría emite instrucción formal a la filial de ${f.nombre}. Se adjunta copia certificada del acuerdo del grupo${f.traduccion_jurada ? " + TRADUCCIÓN JURADA requerida" : ""}.`,
                  where: f.traduccion_jurada ? "⚠ Traducción jurada" : "Carta instrucción",
                  highlight: false,
                },
                {
                  num: "3",
                  titulo: f.requiere_acuerdo_local ? "Acuerdo local (simplificado)" : "Solo trámite registral",
                  desc: f.forma_acuerdo_local,
                  where: f.idioma_doc,
                  highlight: false,
                },
                {
                  num: "4",
                  titulo: f.requiere_escritura_pub ? "Escritura notarial (obligatoria)" : "Registro local",
                  desc: `Inscripción en ${f.registro_local}. Plazo: ${f.plazo_inscripcion_dias} días.${f.requiere_escritura_pub ? " ⚠ Notario obligatorio en MX para toda inscripción RPC." : ""}`,
                  where: f.registro_local,
                  highlight: f.requiere_escritura_pub,
                },
              ].map((step, i) => (
                <div key={i} className="relative mb-4 last:mb-0 flex gap-3">
                  <div
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center text-xs font-bold -translate-x-full",
                      step.highlight
                        ? "bg-[var(--g-brand-3308)] text-white"
                        : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-default)]"
                    )}
                    style={{ borderRadius: "var(--g-radius-full)" }}
                  >
                    {step.num}
                  </div>
                  <div className="flex-1 pb-1">
                    <div className="flex items-baseline gap-2">
                      <p className={cn("text-sm font-semibold", step.highlight ? "text-[var(--g-brand-3308)]" : "text-[var(--g-text-primary)]")}>
                        {step.titulo}
                      </p>
                      <span className="text-xs text-[var(--g-text-secondary)] bg-[var(--g-surface-muted)] px-1.5 py-0.5" style={{ borderRadius: "var(--g-radius-sm)" }}>
                        {step.where}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--g-text-secondary)] mt-0.5">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card: lo que NO aplica */}
          <div
            className="bg-[var(--g-surface-card)] p-5 border border-[var(--g-border-subtle)]"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Lock className="h-4 w-4 text-[var(--g-brand-3308)]" />
              <h3 className="text-sm font-semibold text-[var(--g-text-primary)]">
                Simplificaciones por ser filial 100%
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {f.simplificaciones.map((s, i) => {
                const isWarn = s.startsWith("ATENCIÓN") || s.startsWith("Atenção");
                return (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    {isWarn
                      ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[var(--status-error)]" />
                      : <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[var(--status-success)]" />
                    }
                    <span className={isWarn ? "text-[var(--status-error)]" : "text-[var(--g-text-secondary)]"}>{s}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Panel derecho */}
        <div className="space-y-4">
          {/* Entidades — live DB data */}
          <div
            className="bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)]"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="px-5 py-4 border-b border-[var(--g-border-subtle)] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--g-text-primary)]">Filiales en {f.nombre}</h3>
              {liveEntities.length > 0 && (
                <span className="text-[10px] font-semibold px-2 py-0.5 text-[var(--g-brand-bright)] bg-[var(--g-sec-100)]"
                  style={{ borderRadius: "var(--g-radius-full)" }}>
                  TGMS
                </span>
              )}
            </div>
            <div className="divide-y divide-[var(--g-border-subtle)]">
              {filialesLoading ? (
                <div className="flex items-center gap-2 px-5 py-3 text-sm text-[var(--g-text-secondary)]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Cargando…
                </div>
              ) : liveEntities.length > 0 ? (
                liveEntities.map((e) => {
                  const pending = agreementCounts[e.id] ?? 0;
                  return (
                    <div key={e.id} className="flex items-center gap-3 px-5 py-3">
                      <Building2 className="h-4 w-4 shrink-0 text-[var(--g-text-secondary)]" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--g-text-primary)] truncate">
                          {e.common_name ?? e.legal_name}
                        </p>
                        <p className="text-xs text-[var(--g-text-secondary)]">
                          {e.legal_form ?? e.tipo_social} ·{" "}
                          <span className="font-semibold text-[var(--g-brand-3308)]">
                            {e.ownership_percentage != null ? `${e.ownership_percentage}%` : "100%"}
                          </span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {pending > 0 && (
                          <span className="text-xs font-semibold px-1.5 py-0.5 text-[var(--g-brand-3308)] bg-[var(--g-sec-100)]"
                            style={{ borderRadius: "var(--g-radius-sm)" }}>
                            {pending}
                          </span>
                        )}
                        <ChevronRight className="h-3.5 w-3.5 text-[var(--g-text-secondary)]" />
                      </div>
                    </div>
                  );
                })
              ) : (
                f.entidades.map((e) => (
                  <div key={e.nombre} className="flex items-center gap-3 px-5 py-3">
                    <Building2 className="h-4 w-4 shrink-0 text-[var(--g-text-secondary)]" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--g-text-primary)] truncate">{e.nombre}</p>
                      <p className="text-xs text-[var(--g-text-secondary)]">
                        {e.ciudad} ·{" "}
                        <span className="font-semibold text-[var(--g-brand-3308)]">{e.participacion}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {e.acuerdos_pendientes > 0 && (
                        <span className="text-xs font-semibold px-1.5 py-0.5 text-[var(--g-brand-3308)] bg-[var(--g-sec-100)]"
                          style={{ borderRadius: "var(--g-radius-sm)" }}>
                          {e.acuerdos_pendientes}
                        </span>
                      )}
                      <ChevronRight className="h-3.5 w-3.5 text-[var(--g-text-secondary)]" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Reglas jurisdiccionales activas — live DB data */}
          {activeRuleSet && (
            <div
              className="bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] p-4"
              style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Gavel className="h-4 w-4 text-[var(--g-brand-3308)]" />
                <h3 className="text-sm font-semibold text-[var(--g-text-primary)]">
                  Reglas activas en TGMS
                </h3>
              </div>
              <div className="space-y-1.5 text-xs text-[var(--g-text-secondary)]">
                <div className="flex justify-between">
                  <span>Preaviso 1ª conv.</span>
                  <span className="font-medium text-[var(--g-text-primary)]">
                    {activeRuleSet.rule_config?.notice_min_days_first_call ?? "—"} días
                  </span>
                </div>
                {activeRuleSet.rule_config?.quorum?.first_call_pct != null && (
                  <div className="flex justify-between">
                    <span>Quórum 1ª conv.</span>
                    <span className="font-medium text-[var(--g-text-primary)]">
                      {activeRuleSet.rule_config.quorum.first_call_pct === 0
                        ? "Sin mínimo"
                        : `${activeRuleSet.rule_config.quorum.first_call_pct}%`}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Junta universal</span>
                  <span className={cn(
                    "font-medium",
                    activeRuleSet.rule_config?.allows_universal ? "text-[var(--status-success)]" : "text-[var(--status-warning)]"
                  )}>
                    {activeRuleSet.rule_config?.allows_universal ? "Permitida" : "No permitida"}
                  </span>
                </div>
                {activeRuleSet.rule_config?.registry_submission && (
                  <div className="flex justify-between">
                    <span>Plazo inscripción</span>
                    <span className="font-medium text-[var(--g-text-primary)]">
                      {activeRuleSet.rule_config.registry_submission.deadline_days_from_deed} días
                    </span>
                  </div>
                )}
                {activeRuleSet.statutory_override && (
                  <p className="mt-2 text-[var(--status-warning)] leading-tight">
                    ⚠ statutory_override: confirmar con estatutos de la entidad
                  </p>
                )}
                <p className="mt-2 text-[10px] text-[var(--g-text-secondary)] leading-tight">
                  {activeRuleSet.legal_reference ?? activeRuleSet.name}
                </p>
              </div>
            </div>
          )}

          {/* Vencimientos */}
          <div
            className="bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)]"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="px-5 py-4 border-b border-[var(--g-border-subtle)]">
              <h3 className="text-sm font-semibold text-[var(--g-text-primary)]">Plazos pendientes</h3>
            </div>
            <div className="divide-y divide-[var(--g-border-subtle)]">
              {f.vencimientos.map((v) => (
                <div key={v.label} className="flex items-start gap-3 px-5 py-3">
                  <Clock className="h-4 w-4 shrink-0 text-[var(--g-text-secondary)] mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--g-text-primary)] leading-snug">{v.label}</p>
                    <p className="text-xs text-[var(--g-text-secondary)]">{tipoLabel(v.tipo)}</p>
                  </div>
                  <span
                    className={cn("text-xs font-semibold px-2 py-0.5 shrink-0", urgencyBadge(v.dias))}
                    style={{ borderRadius: "var(--g-radius-full)" }}
                  >
                    {v.dias}d
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Detalles idioma / traducción */}
          <div
            className="bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] p-4"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Languages className="h-4 w-4 text-[var(--g-brand-3308)]" />
              <h3 className="text-sm font-semibold text-[var(--g-text-primary)]">Documentación</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--g-text-secondary)]">Idioma documentos</span>
                <span className="font-medium text-[var(--g-text-primary)]">{f.idioma_doc}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--g-text-secondary)]">Traducción jurada</span>
                <span className={cn(
                  "text-xs font-semibold px-2 py-0.5",
                  f.traduccion_jurada
                    ? "text-[var(--status-error)] bg-[hsl(0,84%,97%)]"
                    : "text-[var(--status-success)] bg-[var(--g-sec-100)]"
                )} style={{ borderRadius: "var(--g-radius-sm)" }}>
                  {f.traduccion_jurada ? "Requerida" : "No necesaria"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--g-text-secondary)]">Escritura notarial</span>
                <span className={cn(
                  "text-xs font-semibold px-2 py-0.5",
                  f.requiere_escritura_pub
                    ? "text-[var(--status-error)] bg-[hsl(0,84%,97%)]"
                    : "text-[var(--g-text-secondary)] bg-[var(--g-surface-muted)] border border-[var(--g-border-subtle)]"
                )} style={{ borderRadius: "var(--g-radius-sm)" }}>
                  {f.requiere_escritura_pub ? "Siempre" : "Solo en estructurales"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--g-text-secondary)]">Plazo inscripción</span>
                <span className="font-medium text-[var(--g-text-primary)]">{f.plazo_inscripcion_dias} días</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Vista por materia — tabla cross-jurisdicción ────────────────────────── */

function MateriasCrossView({ activeCode }: { activeCode: JurisCode }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm text-[var(--g-text-secondary)]">
        <Info className="h-4 w-4 shrink-0" />
        <span>
          Por cada materia: quién decide (siempre España) y qué formalización local exige cada jurisdicción.
          Las alertas regulatorias sectoriales (SUSEP, CNSF…) aparecen en rojo.
        </span>
      </div>

      <div className="space-y-4">
        {MATERIAS_GRUPO.map((m) => (
          <div
            key={m.materia}
            className="bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] overflow-hidden"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            {/* Header materia */}
            <div className="flex items-start gap-3 px-6 py-4 border-b border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)]">
              <ScrollText className="h-4 w-4 shrink-0 text-[var(--g-brand-3308)] mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-[var(--g-text-primary)]">{m.materia}</h3>
                <p className="text-sm text-[var(--g-text-secondary)] mt-0.5">{m.descripcion}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Flag className="h-3.5 w-3.5 text-[var(--g-brand-3308)]" />
                <span className="text-xs font-semibold text-[var(--g-brand-3308)]">Decide: {m.decide_en}</span>
              </div>
            </div>

            {/* Grid jurisdicciones */}
            <div className="grid grid-cols-4 divide-x divide-[var(--g-border-subtle)]">
              {JURIS_ORDER.map((code) => {
                const ff = FILIALES[code];
                const local = m.formaliza[code];
                const isActive = code === activeCode;
                return (
                  <div
                    key={code}
                    className={cn(
                      "p-4",
                      isActive ? "bg-[var(--g-sec-100)]/40" : ""
                    )}
                  >
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-base">{ff.bandera}</span>
                      <span className="text-xs font-semibold text-[var(--g-text-primary)]">{code}</span>
                      {isActive && (
                        <span className="text-[10px] font-bold text-[var(--g-brand-3308)] bg-[var(--g-sec-100)] border border-[var(--g-brand-3308)] px-1" style={{ borderRadius: "var(--g-radius-sm)" }}>
                          activo
                        </span>
                      )}
                    </div>
                    <div className="flex items-start gap-1.5 mb-2">
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--g-brand-bright)] mt-0.5" />
                      <p className="text-xs text-[var(--g-text-secondary)] leading-snug">{local.requiere}</p>
                    </div>
                    {local.bloqueo && (
                      <div className="flex items-start gap-1.5 mt-2 p-2 bg-[hsl(0,84%,97%)]" style={{ borderRadius: "var(--g-radius-sm)" }}>
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[var(--status-error)] mt-0.5" />
                        <p className="text-xs text-[var(--status-error)] leading-snug">{local.bloqueo}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Nota MVP */}
      <div
        className="bg-[var(--g-surface-subtle)] border border-[var(--g-sec-300)] p-5 text-sm"
        style={{ borderRadius: "var(--g-radius-lg)" }}
      >
        <h4 className="font-semibold text-[var(--g-brand-3308)] mb-2 flex items-center gap-2">
          <CircleDot className="h-4 w-4" />
          Alcance MVP multi-jurisdicción
        </h4>
        <div className="grid grid-cols-3 gap-6 text-[var(--g-text-secondary)]">
          <div>
            <p className="font-medium text-[var(--g-text-primary)] mb-1">Lo que implementa el motor en MVP</p>
            <ul className="space-y-1 list-none">
              {[
                "Seguimiento de formalizaciones pendientes por filial",
                "Alertas de plazo de inscripción por jurisdicción",
                "Generación de instrucción a filial (plantilla multilingüe)",
                "Control de traducción jurada si procede (PT, BR)",
              ].map((item) => (
                <li key={item} className="flex items-start gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[var(--status-success)] mt-0.5" />
                  <span className="text-xs">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-medium text-[var(--g-text-primary)] mb-1">Lo que NO implementa el motor (post-MVP)</p>
            <ul className="space-y-1 list-none">
              {[
                "Validación de quórum / mayorías en filiales (irrelevante — socio único)",
                "Motor de reglas locales BR/MX/PT completo",
                "Integración directa con JUCESP / IRN / RPC",
                "Gestión de autorizaciones SUSEP / CNSF / BdP",
              ].map((item) => (
                <li key={item} className="flex items-start gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[var(--status-warning)] mt-0.5" />
                  <span className="text-xs">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-medium text-[var(--g-text-primary)] mb-1">Atención regulatoria sectorial</p>
            <ul className="space-y-1 list-none">
              {[
                "Brasil: SUSEP exige autorización previa para fusiones / cambio director",
                "México: CNSF previa para cambio de objeto social o control",
                "Portugal: BdP notificación para operaciones estructurales",
                "Estas alertas las gestiona el departamento legal, no el motor",
              ].map((item) => (
                <li key={item} className="flex items-start gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[var(--status-error)] mt-0.5" />
                  <span className="text-xs">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
