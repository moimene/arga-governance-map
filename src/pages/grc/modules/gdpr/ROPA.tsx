import { useState } from "react";
import { riskLevelChip } from "@/lib/grc/status-labels";
import { 
  FileText, Search, ShieldCheck, Database, Lock, 
  Globe2, Clock, CheckCircle2, ChevronRight 
} from "lucide-react";
import { DemoFixtureNotice } from "@/components/grc/DemoFixtureNotice";

interface RopaRecord {
  id: string;
  code: string;
  purpose: string;
  legal_basis: string;
  data_subjects: string;
  data_categories: string;
  recipients: string;
  intl_transfers: string;
  retention: string;
  security_measures: string;
  risk: "Alto" | "Medio" | "Bajo";
  owner: string;
}

const ROPA_DATA: RopaRecord[] = [
  {
    id: "r-01",
    code: "RAT-ASEG-001",
    purpose: "Contratación, tarificación y emisión de pólizas de seguro",
    legal_basis: "Ejecución de contrato de seguro (Art. 6.1.b RGPD)",
    data_subjects: "Tomadores, asegurados, beneficiarios",
    data_categories: "Identificativos, contacto, económicos, solvencia",
    recipients: "Entidades reaseguradoras, coaseguro, mediadores",
    intl_transfers: "No aplica (Tratamiento en EEE)",
    retention: "10 años tras extinción de la póliza (plazo prescripción)",
    security_measures: "Cifrado AES-256 en reposo, TLS 1.3, control de acceso RBAC",
    risk: "Medio",
    owner: "Dirección de Suscripción",
  },
  {
    id: "r-02",
    code: "RAT-ASEG-002",
    purpose: "Tramitación, peritaje y liquidación de siniestros y prestaciones",
    legal_basis: "Ejecución de contrato y cumplimiento de obligación legal (Art. 6.1.b/c)",
    data_subjects: "Asegurados, perjudicados, peritos, talleres, terceros",
    data_categories: "Identificativos, datos de salud (art. 9.2.f), peritajes, bancarios",
    recipients: "Peritos, abogados, procuradores, centros médicos, reaseguradoras",
    intl_transfers: "No aplica (Tratamiento en EEE)",
    retention: "15 años desde liquidación definitiva (plazo penal/civil)",
    security_measures: "Cifrado de campos de salud, auditoría de accesos WORM",
    risk: "Alto",
    owner: "Dirección de Prestaciones y Siniestros",
  },
  {
    id: "r-03",
    code: "RAT-ASEG-003",
    purpose: "Prevención, detección y persecución del fraude en el seguro",
    legal_basis: "Interés legítimo del responsable (Art. 6.1.f RGPD)",
    data_subjects: "Tomadores, asegurados, reclamantes, testigos",
    data_categories: "Identificativos, historial de siniestralidad, análisis de scoring",
    recipients: "Fuerzas y Cuerpos de Seguridad, Juzgados, peritos judiciales",
    intl_transfers: "No aplica",
    retention: "5 años desde archivo de la investigación",
    security_measures: "Segregación lógica de expedientes de fraude, logs inmutables",
    risk: "Alto",
    owner: "Unidad Especial de Prevención del Fraude",
  },
  {
    id: "r-04",
    code: "RAT-ASEG-004",
    purpose: "Marketing, fidelización y comunicaciones comerciales",
    legal_basis: "Consentimiento explícito (Art. 6.1.a) / LSSI Art. 21.2",
    data_subjects: "Clientes y usuarios web",
    data_categories: "Identificativos, contacto, preferencias",
    recipients: "Plataformas de email marketing (Encargados de tratamiento)",
    intl_transfers: "EE.UU. (Cláusulas Contractuales Tipo + DPF)",
    retention: "Hasta la retirada del consentimiento o baja voluntaria",
    security_measures: "Anonimización de métricas de tracking, gestión de opt-out",
    risk: "Bajo",
    owner: "Dirección de Marketing",
  },
];

export default function ROPA() {
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [selectedRecord, setSelectedRecord] = useState<RopaRecord | null>(null);

  const filtered = ROPA_DATA.filter((r) => {
    const matchesSearch =
      r.purpose.toLowerCase().includes(search.toLowerCase()) ||
      r.code.toLowerCase().includes(search.toLowerCase()) ||
      r.legal_basis.toLowerCase().includes(search.toLowerCase());
    const matchesRisk = riskFilter === "ALL" || r.risk === riskFilter;
    return matchesSearch && matchesRisk;
  });

  return (
    <div className="p-6 space-y-6">
      <DemoFixtureNotice>
        Los registros de actividad de tratamiento de esta pantalla son un guion fijo del código. No proceden de ninguna tabla ni del registro real del grupo.
      </DemoFixtureNotice>
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Database className="h-6 w-6 text-[var(--g-brand-3308)]" />
            <h1 className="text-2xl font-bold text-[var(--g-text-primary)]">
              Registro de Actividades de Tratamiento (RoPA - Art. 30 RGPD)
            </h1>
          </div>
          <p className="text-sm text-[var(--g-text-secondary)]">
            Inventario normativo de tratamientos de datos personales conforme al Art. 30 del RGPD y Art. 31 de la LOPDGDD.
          </p>
        </div>
      </header>

      {/* Barra de Filtros y Búsqueda */}
      <div
        className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-4 flex flex-col sm:flex-row items-center justify-between gap-4"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--g-text-secondary)]" />
          <input
            type="text"
            placeholder="Buscar por finalidad, código o base legal..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 text-xs bg-[var(--g-surface-card)] text-[var(--g-text-primary)] border border-[var(--g-border-subtle)] focus:outline-none focus:border-[var(--g-brand-3308)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-[var(--g-text-secondary)]">Nivel de Riesgo:</span>
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="text-xs h-9 bg-[var(--g-surface-card)] text-[var(--g-text-primary)] border border-[var(--g-border-subtle)] px-2"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <option value="ALL">Todos los niveles</option>
            <option value="Alto">Alto</option>
            <option value="Medio">Medio</option>
            <option value="Bajo">Bajo</option>
          </select>
        </div>
      </div>

      {/* Tabla RoPA */}
      <div
        className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] overflow-hidden"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--g-surface-subtle)] border-b border-[var(--g-border-subtle)]">
                {["Código", "Finalidad del Tratamiento", "Base Jurídica", "Interesados", "Plazo de Conservación", "Nivel de Riesgo", ""].map((h, i) => (
                  <th key={i} className="px-5 py-3 text-left text-xs font-semibold text-[var(--g-text-primary)] uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--g-border-subtle)]">
              {filtered.map((r) => (
                <tr 
                  key={r.id} 
                  onClick={() => setSelectedRecord(r)}
                  className="hover:bg-[var(--g-surface-subtle)]/50 transition-colors cursor-pointer"
                >
                  <td className="px-5 py-3 font-mono text-xs font-bold text-[var(--g-brand-3308)]">
                    {r.code}
                  </td>
                  <td className="px-5 py-3 font-medium text-[var(--g-text-primary)] text-xs">
                    {r.purpose}
                  </td>
                  <td className="px-5 py-3 text-xs text-[var(--g-text-secondary)]">
                    {r.legal_basis}
                  </td>
                  <td className="px-5 py-3 text-xs text-[var(--g-text-secondary)]">
                    {r.data_subjects}
                  </td>
                  <td className="px-5 py-3 text-xs text-[var(--g-text-secondary)]">
                    {r.retention}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${riskLevelChip(r.risk)}`}
                      style={{ borderRadius: "var(--g-radius-full)" }}
                    >
                      {r.risk}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <ChevronRight className="h-4 w-4 text-[var(--g-text-secondary)] inline" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Detalle Ficha Art. 30 RGPD */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div
            className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] w-full max-w-2xl overflow-hidden"
            style={{ borderRadius: "var(--g-radius-xl)", boxShadow: "var(--g-shadow-modal)" }}
          >
            <div className="px-6 py-4 border-b border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] flex items-center justify-between">
              <div>
                <span className="font-mono text-xs font-bold text-[var(--g-brand-3308)]">
                  {selectedRecord.code}
                </span>
                <h3 className="text-base font-bold text-[var(--g-text-primary)]">
                  Ficha de Actividad de Tratamiento (Art. 30 RGPD)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="text-[var(--g-text-secondary)] hover:text-[var(--g-text-primary)] text-xl font-bold"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="font-bold text-[var(--g-text-secondary)] uppercase text-[10px]">Finalidad:</div>
                  <div className="text-[var(--g-text-primary)] font-medium mt-0.5">{selectedRecord.purpose}</div>
                </div>
                <div>
                  <div className="font-bold text-[var(--g-text-secondary)] uppercase text-[10px]">Base Legitimadora:</div>
                  <div className="text-[var(--g-text-primary)] font-medium mt-0.5">{selectedRecord.legal_basis}</div>
                </div>
                <div>
                  <div className="font-bold text-[var(--g-text-secondary)] uppercase text-[10px]">Colectivos de Interesados:</div>
                  <div className="text-[var(--g-text-primary)] mt-0.5">{selectedRecord.data_subjects}</div>
                </div>
                <div>
                  <div className="font-bold text-[var(--g-text-secondary)] uppercase text-[10px]">Categorías de Datos:</div>
                  <div className="text-[var(--g-text-primary)] mt-0.5">{selectedRecord.data_categories}</div>
                </div>
                <div>
                  <div className="font-bold text-[var(--g-text-secondary)] uppercase text-[10px]">Destinatarios / Cesiones:</div>
                  <div className="text-[var(--g-text-primary)] mt-0.5">{selectedRecord.recipients}</div>
                </div>
                <div>
                  <div className="font-bold text-[var(--g-text-secondary)] uppercase text-[10px]">Transferencias Internacionales:</div>
                  <div className="text-[var(--g-text-primary)] mt-0.5">{selectedRecord.intl_transfers}</div>
                </div>
                <div>
                  <div className="font-bold text-[var(--g-text-secondary)] uppercase text-[10px]">Plazo de Supresión:</div>
                  <div className="text-[var(--g-text-primary)] mt-0.5">{selectedRecord.retention}</div>
                </div>
                <div>
                  <div className="font-bold text-[var(--g-text-secondary)] uppercase text-[10px]">Área Responsable:</div>
                  <div className="text-[var(--g-text-primary)] mt-0.5">{selectedRecord.owner}</div>
                </div>
              </div>

              <div className="border-t border-[var(--g-border-subtle)] pt-3">
                <div className="font-bold text-[var(--g-text-secondary)] uppercase text-[10px]">Medidas Técnicas y Organizativas de Seguridad:</div>
                <div className="text-[var(--g-text-primary)] mt-1 font-medium bg-[var(--g-surface-subtle)] p-2 rounded">
                  {selectedRecord.security_measures}
                </div>
              </div>
            </div>

            <div className="px-6 py-3 border-t border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] text-right">
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-1.5 text-xs font-semibold bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                Cerrar Ficha
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
