import { Link } from "react-router-dom";
import { BookOpen, CheckCircle2, Clock, ExternalLink, ShieldCheck, AlertTriangle } from "lucide-react";
import { DemoFixtureNotice } from "@/components/grc/DemoFixtureNotice";

interface DoraPolicyItem {
  id: string;
  code: string;
  title: string;
  doraRef: string;
  approvedBy: string;
  reviewFrequency: string;
  status: "Aprobada por Consejo" | "En Revisión" | "Pendiente de Ratificación";
  lastReviewDate: string;
  nextReviewDate: string;
  owner: string;
}

const DORA_POLICIES: DoraPolicyItem[] = [
  {
    id: "pol-dora-01",
    code: "POL-TIC-001",
    title: "Marco General de Gestión del Riesgo TIC y Ciberseguridad",
    doraRef: "DORA Arts. 5 y 6 · Reg. Delegado (UE) 2024/1774",
    approvedBy: "Consejo de Administración",
    reviewFrequency: "Anual obligatoria",
    status: "Aprobada por Consejo",
    lastReviewDate: "2026-01-15",
    nextReviewDate: "2027-01-15",
    owner: "CISO / Resiliencia Operativa",
  },
  {
    id: "pol-dora-02",
    code: "POL-TIC-002",
    title: "Política de Continuidad de Negocio TIC y Plan de Recuperación (DRP)",
    doraRef: "DORA Art. 11 · Reg. Delegado (UE) 2024/1774",
    approvedBy: "Consejo de Administración",
    reviewFrequency: "Anual y tras cambio material",
    status: "Aprobada por Consejo",
    lastReviewDate: "2026-02-10",
    nextReviewDate: "2027-02-10",
    owner: "Responsable de Continuidad de Negocio",
  },
  {
    id: "pol-dora-03",
    code: "POL-TIC-003",
    title: "Política de Gestión del Riesgo TIC de Terceros y Subcontratación",
    doraRef: "DORA Arts. 28 a 30 · RTS Subcontratación",
    approvedBy: "Consejo de Administración",
    reviewFrequency: "Anual",
    status: "Aprobada por Consejo",
    lastReviewDate: "2026-03-01",
    nextReviewDate: "2027-03-01",
    owner: "Compras y Riesgo de Proveedores",
  },
  {
    id: "pol-dora-04",
    code: "POL-TIC-004",
    title: "Programa y Política de Pruebas de Resiliencia Operativa y TLPT",
    doraRef: "DORA Arts. 24 a 27 · Directrices RTS",
    approvedBy: "Comité de Riesgos y Auditoría",
    reviewFrequency: "Anual",
    status: "En Revisión",
    lastReviewDate: "2025-11-20",
    nextReviewDate: "2026-11-20",
    owner: "CISO / Auditoría de Seguridad",
  },
  {
    id: "pol-dora-05",
    code: "POL-TIC-005",
    title: "Política de Clasificación, Gestión y Notificación de Incidentes TIC",
    doraRef: "DORA Arts. 17 a 19 · Reg. Delegado (UE) 2025/301",
    approvedBy: "Consejo de Administración",
    reviewFrequency: "Anual obligatoria",
    status: "Aprobada por Consejo",
    lastReviewDate: "2026-01-20",
    nextReviewDate: "2027-01-20",
    owner: "SOC / Respuesta a Incidentes",
  },
  {
    id: "pol-dora-06",
    code: "POL-TIC-006",
    title: "Política de Control de Acceso Lógico, Criptografía y Ciberhigiene",
    doraRef: "DORA Art. 9 · Reg. Delegado (UE) 2024/1774",
    approvedBy: "Comité de Dirección",
    reviewFrequency: "Bianual",
    status: "Aprobada por Consejo",
    lastReviewDate: "2025-10-05",
    nextReviewDate: "2027-10-05",
    owner: "CISO / Seguridad IT",
  },
];

export default function PoliciesLink() {
  return (
    <div className="p-6 space-y-6">
      <DemoFixtureNotice>
        Las políticas TIC de esta pantalla son un guion fijo del código. No proceden de la tabla de políticas ni consta su aprobación por ningún órgano.
      </DemoFixtureNotice>
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="h-6 w-6 text-[var(--g-brand-3308)]" />
            <h1 className="text-2xl font-bold text-[var(--g-text-primary)]">
              Marco de Políticas DORA de Resiliencia TIC
            </h1>
          </div>
          <p className="text-sm text-[var(--g-text-secondary)]">
            Catálogo preceptivo de políticas y procedimientos de resiliencia operativa digital aprobados por el Consejo de Administración.
          </p>
        </div>
        <Link
          to="/politicas"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] transition-colors"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <span>Ir al Gestor Global de Políticas</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </header>

      {/* Grid de Políticas DORA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {DORA_POLICIES.map((pol) => {
          const isApproved = pol.status === "Aprobada por Consejo";
          return (
            <div
              key={pol.id}
              className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-5 flex flex-col justify-between space-y-4 hover:border-[var(--g-brand-3308)] transition-all"
              style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-mono text-xs font-bold text-[var(--g-brand-3308)] bg-[var(--g-surface-subtle)] px-2 py-0.5" style={{ borderRadius: "var(--g-radius-sm)" }}>
                    {pol.code}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 ${
                      isApproved 
                        ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                        : "bg-[var(--status-warning)] text-[var(--g-text-inverse)]"
                    }`}
                    style={{ borderRadius: "var(--g-radius-full)" }}
                  >
                    {isApproved ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                    {pol.status}
                  </span>
                </div>
                <h2 className="text-sm font-bold text-[var(--g-text-primary)] leading-snug">
                  {pol.title}
                </h2>
                <p className="text-xs font-mono text-[var(--g-text-secondary)] mt-1">
                  {pol.doraRef}
                </p>
              </div>

              <div className="border-t border-[var(--g-border-subtle)] pt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-[10px] uppercase font-bold text-[var(--g-text-secondary)]">Aprobado por:</div>
                  <div className="font-medium text-[var(--g-text-primary)]">{pol.approvedBy}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-[var(--g-text-secondary)]">Frecuencia:</div>
                  <div className="font-medium text-[var(--g-text-primary)]">{pol.reviewFrequency}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-[var(--g-text-secondary)]">Última Revisión:</div>
                  <div className="text-[var(--g-text-primary)]">{pol.lastReviewDate}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-[var(--g-text-secondary)]">Próxima Revisión:</div>
                  <div className="text-[var(--g-brand-3308)] font-semibold">{pol.nextReviewDate}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
