import {
  FileText,
  ChevronRight,
  CheckCircle,
  Clock,
  Archive,
  AlertCircle,
  Play,
  FolderOpen,
  Building2,
  ShieldCheck,
  Filter,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePlantillasProtegidas, useUpdateEstadoPlantilla, PlantillaProtegidaRow } from "@/hooks/usePlantillasProtegidas";
import { useSecretariaScope } from "@/components/secretaria/shell";
import { getTemplateUsageTarget } from "@/lib/secretaria/template-routing";
import { toast } from "sonner";

const ESTADO_BADGE = {
  BORRADOR: "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]",
  REVISADA: "bg-[var(--status-info)] text-[var(--g-text-inverse)]",
  APROBADA: "bg-[var(--g-sec-300)] text-[var(--g-brand-3308)]",
  ACTIVA: "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  ARCHIVADA: "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]",
};

const ESTADO_LABEL = {
  BORRADOR: "Borrador",
  REVISADA: "Revisada",
  APROBADA: "Aprobada",
  ACTIVA: "Activa",
  ARCHIVADA: "Archivada",
};

const WORKFLOW_TRANSITIONS: Record<string, { label: string; nextState: string; icon: LucideIcon }> = {
  BORRADOR: { label: "Marcar como revisada", nextState: "REVISADA", icon: Clock },
  REVISADA: { label: "Aprobar", nextState: "APROBADA", icon: CheckCircle },
  APROBADA: { label: "Activar", nextState: "ACTIVA", icon: CheckCircle },
  ACTIVA: { label: "Archivar", nextState: "ARCHIVADA", icon: Archive },
};

const MATERIAS_ACUERDO = [
  'APROBACION_CUENTAS',
  'DISTRIBUCION_DIVIDENDOS',
  'NOMBRAMIENTO_CONSEJERO',
  'CESE_CONSEJERO',
  'DELEGACION_FACULTADES',
  'MODIFICACION_ESTATUTOS',
  'AUMENTO_CAPITAL',
  'REDUCCION_CAPITAL',
  'OPERACION_VINCULADA',
  'NOMBRAMIENTO_AUDITOR',
  'APROBACION_PLAN_NEGOCIO',
  'AUTORIZACION_GARANTIA',
  'RATIFICACION_ACTOS',
];

const JURISDICTION_LABEL: Record<string, string> = {
  ES: "España",
  PT: "Portugal",
  BR: "Brasil",
  MX: "México",
  GLOBAL: "Global",
  MULTI: "Multijurisdicción",
};

const TIPO_LABEL: Record<string, string> = {
  ACTA_SESION: "Acta de sesión",
  ACTA_CONSIGNACION: "Acta de consignación",
  ACTA_ACUERDO_ESCRITO: "Acta acuerdo escrito sin sesión",
  CERTIFICACION: "Certificación de acuerdos",
  CONVOCATORIA: "Convocatoria",
  CONVOCATORIA_SL_NOTIFICACION: "Convocatoria SL con notificación",
  INFORME_PRECEPTIVO: "Informe preceptivo",
  INFORME_DOCUMENTAL_PRE: "Informe documental PRE",
  INFORME_GESTION: "Informe de gestión",
  MODELO_ACUERDO: "Modelo de acuerdo",
};

const INFORME_TIPOS = new Set([
  "INFORME_PRECEPTIVO",
  "INFORME_DOCUMENTAL_PRE",
  "INFORME_GESTION",
]);

function jurisdictionLabel(code?: string | null) {
  if (!code) return "Jurisdicción pendiente";
  return JURISDICTION_LABEL[code] ?? code;
}

function tipoLabel(value?: string | null) {
  if (!value) return "—";
  return TIPO_LABEL[value] ?? value.replace(/_/g, " ");
}

function materiaLabel(value?: string | null) {
  return value ? value.replace(/_/g, " ") : "—";
}

function templateAppliesToJurisdiction(plantilla: PlantillaProtegidaRow, jurisdiction?: string | null) {
  if (!jurisdiction) return true;
  return (
    !plantilla.jurisdiccion ||
    plantilla.jurisdiccion === jurisdiction ||
    plantilla.jurisdiccion === "GLOBAL" ||
    plantilla.jurisdiccion === "MULTI"
  );
}

export default function Plantillas() {
  const navigate = useNavigate();
  const scope = useSecretariaScope();
  const { data, isLoading } = usePlantillasProtegidas();
  const updateEstado = useUpdateEstadoPlantilla();
  const [selected, setSelected] = useState<PlantillaProtegidaRow | null>(null);
  const [activeTab, setActiveTab] = useState<'proceso' | 'modelos'>('proceso');
  const [filterMateria, setFilterMateria] = useState<string>('');
  const isSociedadMode = scope.mode === "sociedad";
  const selectedEntity = scope.selectedEntity;
  const selectedEntityName = selectedEntity?.legalName ?? selectedEntity?.name ?? "Sociedad seleccionada";
  const selectedJurisdiction = selectedEntity?.jurisdiction ?? null;

  const scopedData = useMemo(() => {
    const rows = data ?? [];
    if (!isSociedadMode) return rows;
    return rows.filter((plantilla) => templateAppliesToJurisdiction(plantilla, selectedJurisdiction));
  }, [data, isSociedadMode, selectedJurisdiction]);

  const scopeMetrics = useMemo(() => {
    const active = scopedData.filter((p) => p.estado === "ACTIVA").length;
    const modelos = scopedData.filter((p) => p.tipo === "MODELO_ACUERDO").length;
    const informes = scopedData.filter((p) => INFORME_TIPOS.has(p.tipo)).length;
    const exactJurisdiction = selectedJurisdiction
      ? scopedData.filter((p) => p.jurisdiccion === selectedJurisdiction).length
      : 0;
    return { active, modelos, informes, exactJurisdiction };
  }, [scopedData, selectedJurisdiction]);

  const handleTransicion = (plantilla: PlantillaProtegidaRow) => {
    const transition = WORKFLOW_TRANSITIONS[plantilla.estado];
    if (!transition) return;

    updateEstado.mutate(
      { id: plantilla.id, nuevo_estado: transition.nextState },
      {
        onSuccess: () => {
          toast.success(`Plantilla transicionada a ${ESTADO_LABEL[transition.nextState as keyof typeof ESTADO_LABEL]}`);
          setSelected(null);
        },
        onError: () => {
          toast.error("Error al actualizar el estado de la plantilla");
        },
      }
    );
  };

  const procesoDatos = scopedData.filter((p) => p.tipo !== 'MODELO_ACUERDO');
  const modelosDatos = scopedData.filter((p) => p.tipo === 'MODELO_ACUERDO');
  const displayData = activeTab === 'proceso' ? procesoDatos : modelosDatos;
  const procesoCoverage = [...new Set(procesoDatos.map((p) => p.tipo))].map((tipo) => {
    const rows = procesoDatos.filter((p) => p.tipo === tipo);
    return {
      tipo,
      label: tipoLabel(tipo),
      total: rows.length,
      activas: rows.filter((p) => p.estado === "ACTIVA").length,
    };
  });

  const filteredData = activeTab === 'modelos' && filterMateria
    ? displayData.filter((p) => p.materia_acuerdo === filterMateria)
    : displayData;

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      {/* Encabezado */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
          <FileText className="h-3.5 w-3.5" />
          Secretaría · Plantillas
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
          {isSociedadMode ? `Plantillas aplicables a ${selectedEntityName}` : "Plantillas documentales protegidas"}
        </h1>
        <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
          {isSociedadMode
            ? `Biblioteca filtrada por jurisdicción ${jurisdictionLabel(selectedJurisdiction)} y preparada para crear expedientes de la sociedad.`
            : "Ciclo de vida: Borrador → Revisada → Aprobada → Activa → Archivada"}
        </p>
      </div>

      {isSociedadMode && selectedEntity ? (
        <div
          className="mb-5 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-4 py-4"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
                <Building2 className="h-3.5 w-3.5" />
                Sociedad en contexto
              </div>
              <div className="mt-1 text-base font-semibold text-[var(--g-text-primary)]">
                {selectedEntityName}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--g-text-secondary)]">
                <span>{selectedEntity.legalForm}</span>
                <span aria-hidden="true">·</span>
                <span>{jurisdictionLabel(selectedEntity.jurisdiction)}</span>
                <span aria-hidden="true">·</span>
                <span>{selectedEntity.status}</span>
              </div>
              <p className="mt-2 max-w-3xl text-sm text-[var(--g-text-secondary)]">
                El tramitador arranca desde estas plantillas y conserva el ámbito de la sociedad para resolver variables, órgano competente y rule pack aplicable.
              </p>
            </div>

            <dl className="grid min-w-full grid-cols-1 gap-3 text-sm sm:min-w-[480px] sm:grid-cols-4 lg:min-w-[640px]">
              <div className="border-l border-[var(--g-border-subtle)] pl-3">
                <dt className="flex items-center gap-1 text-xs font-medium text-[var(--g-text-secondary)]">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Activas
                </dt>
                <dd className="mt-1 text-lg font-semibold text-[var(--g-text-primary)]">{scopeMetrics.active}</dd>
              </div>
              <div className="border-l border-[var(--g-border-subtle)] pl-3">
                <dt className="flex items-center gap-1 text-xs font-medium text-[var(--g-text-secondary)]">
                  <FileText className="h-3.5 w-3.5" />
                  Modelos
                </dt>
                <dd className="mt-1 text-lg font-semibold text-[var(--g-text-primary)]">{scopeMetrics.modelos}</dd>
              </div>
              <div className="border-l border-[var(--g-border-subtle)] pl-3">
                <dt className="flex items-center gap-1 text-xs font-medium text-[var(--g-text-secondary)]">
                  <Archive className="h-3.5 w-3.5" />
                  Informes
                </dt>
                <dd className="mt-1 text-lg font-semibold text-[var(--g-text-primary)]">{scopeMetrics.informes}</dd>
              </div>
              <div className="border-l border-[var(--g-border-subtle)] pl-3">
                <dt className="flex items-center gap-1 text-xs font-medium text-[var(--g-text-secondary)]">
                  <Filter className="h-3.5 w-3.5" />
                  Jurisdicción
                </dt>
                <dd className="mt-1 text-lg font-semibold text-[var(--g-text-primary)]">{scopeMetrics.exactJurisdiction}</dd>
              </div>
            </dl>
          </div>
        </div>
      ) : null}

      {/* Tab bar */}
      <div className="mb-5 flex gap-1 border-b border-[var(--g-border-subtle)]">
        {(['proceso', 'modelos'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => { setActiveTab(tab); setSelected(null); setFilterMateria(''); }}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'border-b-2 border-[var(--g-brand-3308)] text-[var(--g-brand-3308)]'
                : 'text-[var(--g-text-secondary)] hover:text-[var(--g-text-primary)]'
            }`}
          >
            {tab === 'proceso' ? 'Plantillas de proceso' : 'Modelos de acuerdo'}
          </button>
        ))}
      </div>

      {activeTab === 'proceso' && procesoCoverage.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {procesoCoverage.map((item) => (
            <span
              key={item.tipo}
              className="inline-flex items-center gap-1.5 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-2.5 py-1 text-xs text-[var(--g-text-secondary)]"
              style={{ borderRadius: "var(--g-radius-full)" }}
            >
              <span className="font-medium text-[var(--g-text-primary)]">{item.label}</span>
              <span>{item.activas}/{item.total} activas</span>
            </span>
          ))}
        </div>
      )}

      {/* Materia filter (Modelos tab only) */}
      {activeTab === 'modelos' && (
        <div className="mb-4 flex items-center gap-3">
          <label className="text-xs font-medium text-[var(--g-text-secondary)]">Materia:</label>
          <select
            value={filterMateria}
            onChange={(e) => setFilterMateria(e.target.value)}
            className="px-3 py-1.5 text-sm border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)]"
            style={{ borderRadius: 'var(--g-radius-md)' }}
          >
            <option value="">Todas</option>
            {MATERIAS_ACUERDO.map((m) => (
              <option key={m} value={m}>{materiaLabel(m)}</option>
            ))}
          </select>
        </div>
      )}

      {/* Master-Detail Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
        {/* Tabla Master */}
        <div
          className="overflow-hidden border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <table className="w-full">
            <thead>
              <tr className="bg-[var(--g-surface-subtle)]">
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                  {activeTab === 'modelos' ? 'Materia' : 'Tipo'}
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                  {activeTab === 'modelos' ? 'Variante' : 'Materia'}
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                  Jurisdicción
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                  v.
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                  Estado
                </th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--g-border-subtle)]">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-[var(--g-text-secondary)]">
                    Cargando…
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                      <FolderOpen className="mb-3 h-10 w-10 text-[var(--g-text-secondary)]/40" />
                      <p className="text-sm font-medium text-[var(--g-text-secondary)]">
                        {activeTab === 'modelos' && filterMateria
                          ? `Sin modelos para la materia "${materiaLabel(filterMateria)}".`
                          : activeTab === 'modelos'
                          ? isSociedadMode
                            ? 'No hay modelos de acuerdo aplicables a esta sociedad.'
                            : 'No hay modelos de acuerdo disponibles.'
                          : isSociedadMode
                          ? 'Sin plantillas protegidas aplicables a esta sociedad.'
                          : 'Sin plantillas protegidas.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => navigate(scope.createScopedTo('/secretaria/gestor-plantillas'))}
                        className="mt-4 inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)]"
                        style={{ borderRadius: 'var(--g-radius-md)' }}
                      >
                        <FileText className="h-4 w-4" />
                        Crear nueva plantilla
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredData.map((plantilla) => (
                  <tr
                    key={plantilla.id}
                    onClick={() => setSelected(plantilla)}
                    className={`cursor-pointer transition-colors hover:bg-[var(--g-surface-subtle)]/50 ${
                      selected?.id === plantilla.id ? "bg-[var(--g-surface-subtle)]" : ""
                    }`}
                  >
                    <td className="px-5 py-3 text-sm font-medium text-[var(--g-text-primary)]">
                      {activeTab === 'modelos'
                        ? materiaLabel(plantilla.materia_acuerdo ?? plantilla.tipo)
                        : tipoLabel(plantilla.tipo)}
                    </td>
                    <td className="px-5 py-3 text-sm text-[var(--g-text-secondary)]">
                      {activeTab === 'modelos'
                        ? (plantilla.contenido_template?.substring(0, 40) ?? '—')
                        : (plantilla.materia || "—")}
                    </td>
                    <td className="px-5 py-3 text-sm text-[var(--g-text-secondary)]">
                      {jurisdictionLabel(plantilla.jurisdiccion)}
                    </td>
                    <td className="px-5 py-3 text-sm text-[var(--g-text-secondary)]">
                      {plantilla.version}
                    </td>
                    <td className="px-5 py-3 text-sm">
                      <span
                        className={`inline-block px-2.5 py-1 text-xs font-medium ${
                          ESTADO_BADGE[plantilla.estado as keyof typeof ESTADO_BADGE] ||
                          "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
                        }`}
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      >
                        {ESTADO_LABEL[plantilla.estado as keyof typeof ESTADO_LABEL] || plantilla.estado}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <ChevronRight className="inline h-4 w-4 text-[var(--g-text-secondary)]" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Detail Panel */}
        <div
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          {selected ? (
            <div className="flex h-full flex-col">
              {/* Detail Header */}
              <div className="border-b border-[var(--g-border-subtle)] px-5 py-4">
                <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">Detalles</h2>
              </div>

              {/* Detail Body */}
              <div className="flex-1 overflow-y-auto p-5">
                {/* Tipo */}
                <div className="mb-4">
                  <div className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">Tipo</div>
                  <div className="mt-1 text-sm font-medium text-[var(--g-text-primary)]">
                    {tipoLabel(selected.tipo)}
                  </div>
                </div>

                {/* Materia / materia_acuerdo */}
                <div className="mb-4">
                  <div className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">Materia</div>
                  <div className="mt-1 text-sm text-[var(--g-text-primary)]">
                    {materiaLabel(selected.materia_acuerdo ?? selected.materia)}
                  </div>
                </div>

                {/* Jurisdicción */}
                <div className="mb-4">
                  <div className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">Jurisdicción</div>
                  <div className="mt-1 text-sm text-[var(--g-text-primary)]">
                    {jurisdictionLabel(selected.jurisdiccion)}
                  </div>
                </div>

                {isSociedadMode && selectedEntity && (
                  <div
                    className="mb-4 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-3 py-2"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <div className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">
                      Aplicación
                    </div>
                    <div className="mt-1 text-sm text-[var(--g-text-primary)]">
                      {templateAppliesToJurisdiction(selected, selectedEntity.jurisdiction)
                        ? `Disponible para ${selectedEntity.legalName}`
                        : "No aplica a la jurisdicción seleccionada"}
                    </div>
                  </div>
                )}

                {/* Versión */}
                <div className="mb-4">
                  <div className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">Versión</div>
                  <div className="mt-1 text-sm text-[var(--g-text-primary)]">
                    v{selected.version}
                  </div>
                </div>

                {/* Estado */}
                <div className="mb-4">
                  <div className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">Estado</div>
                  <div className="mt-1">
                    <span
                      className={`inline-block px-2.5 py-1 text-xs font-medium ${
                        ESTADO_BADGE[selected.estado as keyof typeof ESTADO_BADGE] ||
                        "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
                      }`}
                      style={{ borderRadius: "var(--g-radius-sm)" }}
                    >
                      {ESTADO_LABEL[selected.estado as keyof typeof ESTADO_LABEL] || selected.estado}
                    </span>
                  </div>
                </div>

                {/* Referencia Legal */}
                {selected.referencia_legal && (
                  <div className="mb-4">
                    <div className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">
                      Referencia Legal
                    </div>
                    <div className="mt-1 text-sm text-[var(--g-text-primary)]">
                      {selected.referencia_legal}
                    </div>
                  </div>
                )}

                {/* Capa 1 Inmutable */}
                {selected.capa1_inmutable && (
                  <div className="mb-4">
                    {activeTab === 'modelos' && (
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--g-brand-3308)]">
                        Variables del sistema
                      </div>
                    )}
                    <div className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">
                      Capa 1 (Inmutable)
                    </div>
                    <pre
                      className="mt-2 max-h-[120px] overflow-y-auto rounded bg-[var(--g-surface-subtle)] p-2 font-mono text-[11px] text-[var(--g-text-secondary)]"
                    >
                      {selected.capa1_inmutable.substring(0, 300)}
                      {selected.capa1_inmutable.length > 300 ? "…" : ""}
                    </pre>
                  </div>
                )}

                {/* Capa 2 Variables */}
                {selected.capa2_variables && Array.isArray(selected.capa2_variables) && selected.capa2_variables.length > 0 && (
                  <div className="mb-4">
                    <div className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">
                      Variables (Capa 2)
                    </div>
                    <div className="mt-2 space-y-1 text-[11px] text-[var(--g-text-secondary)]">
                      {selected.capa2_variables.map((v, i) => (
                        <div key={i} className="rounded bg-[var(--g-surface-subtle)] px-2 py-1">
                          <span className="font-mono font-medium">{v.variable}</span>
                          {" — "}
                          <span className="text-[10px]">{v.fuente}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Capa 3 Editables (Modelos de acuerdo) */}
                {selected.capa3_editables && selected.capa3_editables.length > 0 && (
                  <div className="mb-4">
                    {activeTab === 'modelos' && (
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--g-brand-3308)]">
                        Campos del secretario
                      </div>
                    )}
                    <div className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">
                      Campos del secretario (Capa 3)
                    </div>
                    <div className="mt-2 space-y-1 text-[11px] text-[var(--g-text-secondary)]">
                      {selected.capa3_editables.map((v, i) => (
                        <div key={i} className="rounded bg-[var(--g-surface-muted)] px-2 py-1">
                          <span className="font-mono font-medium">{v.campo}</span>
                          {v.obligatoriedad === 'OBLIGATORIO' && (
                            <span className="ml-2 text-[var(--status-error)]">*</span>
                          )}
                          {v.descripcion && (
                            <span className="ml-2 text-[10px] text-[var(--g-text-secondary)]">{v.descripcion}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Aprobación */}
                {selected.aprobada_por && (
                  <div className="mb-4">
                    <div className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">
                      Aprobada por
                    </div>
                    <div className="mt-1 text-sm text-[var(--g-text-primary)]">
                      {selected.aprobada_por}
                    </div>
                  </div>
                )}

                {selected.fecha_aprobacion && (
                  <div className="mb-4">
                    <div className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">
                      Fecha aprobación
                    </div>
                    <div className="mt-1 text-sm text-[var(--g-text-primary)]">
                      {new Date(selected.fecha_aprobacion).toLocaleDateString("es-ES")}
                    </div>
                  </div>
                )}

                {/* Checklist de aprobación */}
                {selected.approval_checklist && selected.approval_checklist.length > 0 && (
                  <div className="mb-4">
                    <div className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">Checklist de aprobación</div>
                    <div className="mt-2 space-y-1">
                      {selected.approval_checklist.map((item, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          {item.passed ? <CheckCircle className="h-3.5 w-3.5 text-[var(--status-success)]" /> : <AlertCircle className="h-3.5 w-3.5 text-[var(--status-error)]" />}
                          <span className="text-[var(--g-text-primary)]">{item.check}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Historial de estado */}
                {selected.version_history && selected.version_history.length > 0 && (
                  <div className="mb-4">
                    <div className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">Historial de estado</div>
                    <div className="mt-2 space-y-1">
                      {selected.version_history.map((h, i) => (
                        <div key={i} className="text-xs text-[var(--g-text-secondary)]">
                          <span className="font-medium text-[var(--g-text-primary)]">{h.from} → {h.to}</span>
                          {" · "}{new Date(h.at).toLocaleDateString("es-ES")}
                          {h.by && h.by !== "system" && ` · ${h.by}`}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Creación */}
                <div className="mb-4 border-t border-[var(--g-border-subtle)] pt-4">
                  <div className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">
                    Creada
                  </div>
                  <div className="mt-1 text-sm text-[var(--g-text-secondary)]">
                    {new Date(selected.created_at).toLocaleDateString("es-ES")}
                  </div>
                </div>
              </div>

              {/* Detail Footer - Action Buttons */}
              <div className="border-t border-[var(--g-border-subtle)] px-5 py-4 flex flex-col gap-2">
                {selected.estado === 'ACTIVA' && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = getTemplateUsageTarget(selected).to;
                      navigate(scope.createScopedTo(target));
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-all bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)]"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <Play className="h-4 w-4" />
                    {getTemplateUsageTarget(selected).label}
                  </button>
                )}
                {selected.estado === "ACTIVA" ? (
                  <p className="text-xs text-[var(--g-text-secondary)]">
                    {getTemplateUsageTarget(selected).hint}
                  </p>
                ) : null}
                {WORKFLOW_TRANSITIONS[selected.estado] && (
                  (() => {
                    const transition = WORKFLOW_TRANSITIONS[selected.estado];
                    const IconComponent = transition.icon;
                    return (
                      <button
                        onClick={() => handleTransicion(selected)}
                        disabled={updateEstado.isPending}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-all disabled:opacity-60 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
                        style={{ borderRadius: "var(--g-radius-md)" }}
                      >
                        <IconComponent className="h-4 w-4" />
                        {updateEstado.isPending ? "Procesando…" : transition.label}
                      </button>
                    );
                  })()
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center p-5">
              <div className="text-center">
                <AlertCircle className="mx-auto h-8 w-8 text-[var(--g-text-secondary)] opacity-50" />
                <p className="mt-2 text-sm text-[var(--g-text-secondary)]">
                  Selecciona una plantilla para ver detalles y gestionar su ciclo de vida.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
