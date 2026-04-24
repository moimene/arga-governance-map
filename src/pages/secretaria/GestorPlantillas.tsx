import { useState } from "react";
import {
  FileText, Shield, ChevronRight, ChevronDown,
  CheckCircle2, Clock, AlertTriangle, Eye, Lock,
  Layers, Variable, Edit3, ArrowRight, BookOpen,
} from "lucide-react";
import {
  usePlantillasProtegidas,
  useUpdateEstadoPlantilla,
  useUpdateContenidoPlantilla,
  type PlantillaProtegidaRow,
} from "@/hooks/usePlantillasProtegidas";

// ── Constants ──────────────────────────────────────────────────────────

const ESTADO_CONFIG: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  BORRADOR:  { label: "Borrador",  className: "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]", icon: Edit3 },
  REVISADA:  { label: "Revisada",  className: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]", icon: Eye },
  APROBADA:  { label: "Aprobada",  className: "bg-[var(--g-sec-100)] text-[var(--g-brand-3308)]", icon: CheckCircle2 },
  ACTIVA:    { label: "Activa",    className: "bg-[var(--status-success)] text-[var(--g-text-inverse)]", icon: Shield },
  DEPRECADA: { label: "Deprecada", className: "bg-[var(--status-error)] text-[var(--g-text-inverse)]", icon: AlertTriangle },
};

const TIPO_LABELS: Record<string, string> = {
  ACTA_SESION: "Acta de sesión",
  ACTA_CONSIGNACION: "Acta de consignación",
  ACTA_ACUERDO_ESCRITO: "Acta acuerdo escrito sin sesión",
  CERTIFICACION: "Certificación de acuerdos",
  CONVOCATORIA: "Convocatoria",
};

const ORGANO_LABELS: Record<string, string> = {
  JUNTA_GENERAL: "Junta General",
  CONSEJO: "Consejo de Administración",
};

const MODE_LABELS: Record<string, string> = {
  MEETING: "Sesión",
  UNIVERSAL: "Universal",
  NO_SESSION: "Sin sesión",
  UNIPERSONAL_SOCIO: "Socio único",
  UNIPERSONAL_ADMIN: "Admin. único",
};

const TRANSITION_MAP: Record<string, { next: string; label: string; confirm: string }> = {
  BORRADOR:  { next: "REVISADA",  label: "Marcar como revisada", confirm: "¿Confirmar que el contenido jurídico ha sido revisado?" },
  REVISADA:  { next: "APROBADA",  label: "Aprobar",              confirm: "¿Confirmar la aprobación formal por el Comité Legal?" },
  APROBADA:  { next: "ACTIVA",    label: "Activar en producción", confirm: "¿Activar esta plantilla para uso en producción? Esta acción habilita el Gate PRE." },
};

const OBLIGATORIEDAD_STYLE: Record<string, string> = {
  OBLIGATORIO:              "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  OBLIGATORIO_SI_CONFLICTOS: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  OPCIONAL:                 "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]",
};

// ── Subcomponents ──────────────────────────────────────────────────────

function EstadoBadge({ estado }: { estado: string }) {
  const config = ESTADO_CONFIG[estado] || ESTADO_CONFIG.BORRADOR;
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold ${config.className}`}
      style={{ borderRadius: "var(--g-radius-full)" }}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

function SectionToggle({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
  count,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
  count?: number;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-[var(--g-border-subtle)] last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-5 py-3 text-left text-sm font-semibold text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]/50 transition-colors"
      >
        {open ? <ChevronDown className="h-4 w-4 text-[var(--g-brand-3308)]" /> : <ChevronRight className="h-4 w-4 text-[var(--g-text-secondary)]" />}
        <Icon className="h-4 w-4 text-[var(--g-brand-3308)]" />
        <span>{title}</span>
        {count !== undefined && (
          <span className="ml-auto text-xs text-[var(--g-text-secondary)]">{count}</span>
        )}
      </button>
      {open && <div className="px-5 pb-4">{children}</div>}
    </div>
  );
}

function PlantillaDetailPanel({ plantilla }: { plantilla: PlantillaProtegidaRow }) {
  const updateEstado = useUpdateEstadoPlantilla();
  const updateContenido = useUpdateContenidoPlantilla();
  const [editingCapa1, setEditingCapa1] = useState(false);
  const [capa1Draft, setCapa1Draft] = useState("");
  const transition = TRANSITION_MAP[plantilla.estado];
  const tipoLabel = TIPO_LABELS[plantilla.tipo] || plantilla.tipo;
  const organoLabel = plantilla.organo_tipo ? ORGANO_LABELS[plantilla.organo_tipo] || plantilla.organo_tipo : null;
  const modeLabel = plantilla.adoption_mode ? MODE_LABELS[plantilla.adoption_mode] || plantilla.adoption_mode : "Todos";

  const handleTransition = () => {
    if (!transition) return;
    if (!window.confirm(transition.confirm)) return;
    updateEstado.mutate({
      id: plantilla.id,
      nuevo_estado: transition.next,
      aprobada_por: "Comité Legal TGMS",
    });
  };

  const capa2 = plantilla.capa2_variables ?? [];
  const capa3 = plantilla.capa3_editables ?? [];
  const hasCapa1 = !!plantilla.capa1_inmutable;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-[var(--g-border-subtle)] px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[var(--g-text-primary)]">{tipoLabel}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--g-text-secondary)]">
              {organoLabel && (
                <span className="bg-[var(--g-sec-100)] px-2 py-0.5 text-[var(--g-brand-3308)]" style={{ borderRadius: "var(--g-radius-sm)" }}>
                  {organoLabel}
                </span>
              )}
              <span className="bg-[var(--g-surface-muted)] px-2 py-0.5" style={{ borderRadius: "var(--g-radius-sm)" }}>
                {modeLabel}
              </span>
              <span>v{plantilla.version}</span>
              <span>·</span>
              <span>{plantilla.jurisdiccion}</span>
            </div>
            {plantilla.referencia_legal && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-[var(--g-text-secondary)]">
                <BookOpen className="h-3 w-3" />
                {plantilla.referencia_legal}
              </div>
            )}
          </div>
          <EstadoBadge estado={plantilla.estado} />
        </div>

        {/* Transition button */}
        {transition && (
          <button
            type="button"
            onClick={handleTransition}
            disabled={updateEstado.isPending}
            className="mt-3 flex items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] disabled:opacity-50 transition-colors"
            style={{ borderRadius: "var(--g-radius-md)" }}
            aria-busy={updateEstado.isPending}
          >
            <ArrowRight className="h-4 w-4" />
            {updateEstado.isPending ? "Procesando…" : transition.label}
          </button>
        )}

        {plantilla.fecha_aprobacion && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-[var(--g-text-secondary)]">
            <Clock className="h-3 w-3" />
            Aprobada: {new Date(plantilla.fecha_aprobacion).toLocaleDateString("es-ES")}
            {plantilla.aprobada_por && ` por ${plantilla.aprobada_por}`}
          </div>
        )}
      </div>

      {/* Content sections */}
      <div className="flex-1 overflow-y-auto">
        {/* Capa 1 — Inmutable */}
        <SectionToggle title="Capa 1 — Contenido inmutable" icon={Lock} defaultOpen={true}>
          {editingCapa1 ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={capa1Draft}
                onChange={(e) => setCapa1Draft(e.target.value)}
                rows={16}
                className="w-full resize-y rounded border border-[var(--g-border-default)] bg-[var(--g-surface-card)] p-3 font-mono text-[12px] leading-relaxed text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={updateContenido.isPending}
                  onClick={() => {
                    updateContenido.mutate(
                      { id: plantilla.id, capa1_inmutable: capa1Draft },
                      { onSuccess: () => setEditingCapa1(false) }
                    );
                  }}
                  className="flex items-center gap-1.5 bg-[var(--g-brand-3308)] px-3 py-1.5 text-xs font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] disabled:opacity-50 transition-colors"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  {updateContenido.isPending ? "Guardando…" : "Guardar"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingCapa1(false)}
                  className="flex items-center gap-1.5 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-3 py-1.5 text-xs font-medium text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] transition-colors"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : hasCapa1 ? (
            <div className="flex flex-col gap-2">
              <pre className="whitespace-pre-wrap bg-[var(--g-surface-subtle)] p-4 text-[12px] leading-relaxed text-[var(--g-text-primary)] font-sans max-h-[400px] overflow-y-auto" style={{ borderRadius: "var(--g-radius-md)" }}>
                {plantilla.capa1_inmutable}
              </pre>
              {plantilla.estado === "BORRADOR" && (
                <button
                  type="button"
                  onClick={() => { setCapa1Draft(plantilla.capa1_inmutable ?? ""); setEditingCapa1(true); }}
                  className="self-start flex items-center gap-1.5 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-3 py-1.5 text-xs font-medium text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] transition-colors"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Editar contenido
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 py-2 text-sm text-[var(--status-warning)]">
                <AlertTriangle className="h-4 w-4" />
                Sin contenido jurídico todavía.
              </div>
              {plantilla.estado === "BORRADOR" && (
                <button
                  type="button"
                  onClick={() => { setCapa1Draft(""); setEditingCapa1(true); }}
                  className="self-start flex items-center gap-1.5 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-3 py-1.5 text-xs font-medium text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] transition-colors"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Añadir contenido
                </button>
              )}
            </div>
          )}
        </SectionToggle>

        {/* Capa 2 — Variables parametrizadas */}
        <SectionToggle title="Capa 2 — Variables del motor" icon={Variable} count={capa2.length}>
          {capa2.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[var(--g-surface-subtle)]">
                    <th className="px-3 py-2 text-left font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Variable</th>
                    <th className="px-3 py-2 text-left font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Fuente</th>
                    <th className="px-3 py-2 text-left font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Condición</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--g-border-subtle)]">
                  {capa2.map((v, i) => (
                    <tr key={i} className="hover:bg-[var(--g-surface-subtle)]/50">
                      <td className="px-3 py-2 font-mono text-[var(--g-brand-3308)]">{`{{${v.variable}}}`}</td>
                      <td className="px-3 py-2 text-[var(--g-text-secondary)]">{v.fuente}</td>
                      <td className="px-3 py-2 text-[var(--g-text-secondary)]">{v.condicion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-2 text-xs text-[var(--g-text-secondary)]">Sin variables definidas.</p>
          )}
        </SectionToggle>

        {/* Capa 3 — Campos editables */}
        <SectionToggle title="Capa 3 — Campos editables (usuario)" icon={Edit3} count={capa3.length}>
          {capa3.length > 0 ? (
            <div className="space-y-3">
              {capa3.map((f, i) => (
                <div key={i} className="flex items-start gap-3 border border-[var(--g-border-subtle)] p-3" style={{ borderRadius: "var(--g-radius-md)" }}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-[var(--g-brand-3308)]">{`{{${f.campo}}}`}</span>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-semibold ${OBLIGATORIEDAD_STYLE[f.obligatoriedad] || OBLIGATORIEDAD_STYLE.OPCIONAL}`}
                        style={{ borderRadius: "var(--g-radius-full)" }}
                      >
                        {f.obligatoriedad.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--g-text-secondary)] leading-relaxed">{f.descripcion}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-2 text-xs text-[var(--g-text-secondary)]">Sin campos editables definidos.</p>
          )}
        </SectionToggle>

        {/* Notas legales */}
        {plantilla.notas_legal && (
          <SectionToggle title="Notas para Legal" icon={BookOpen}>
            <p className="text-xs text-[var(--g-text-secondary)] leading-relaxed whitespace-pre-wrap">
              {plantilla.notas_legal}
            </p>
          </SectionToggle>
        )}

        {/* Gate PRE info */}
        <SectionToggle title="Gate PRE — Configuración" icon={Shield}>
          <div className="space-y-2 text-xs text-[var(--g-text-secondary)]">
            <div className="flex items-center gap-2">
              <span className="font-medium text-[var(--g-text-primary)]">Snapshot requerido:</span>
              {plantilla.snapshot_rule_pack_required ? (
                <span className="text-[var(--status-success)]">Sí — Rule Pack obligatorio</span>
              ) : (
                <span>No</span>
              )}
            </div>
            {plantilla.contrato_variables_version && (
              <div className="flex items-center gap-2">
                <span className="font-medium text-[var(--g-text-primary)]">Contrato de variables:</span>
                <span>{plantilla.contrato_variables_version}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="font-medium text-[var(--g-text-primary)]">Protecciones:</span>
              <span className="font-mono">{JSON.stringify(plantilla.protecciones)}</span>
            </div>
          </div>
        </SectionToggle>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────

export default function GestorPlantillas() {
  const { data: plantillas, isLoading } = usePlantillasProtegidas();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterEstado, setFilterEstado] = useState<string>("ALL");
  const [filterTipo, setFilterTipo] = useState<string>("ALL");

  const filtered = (plantillas ?? []).filter((p) => {
    if (filterEstado !== "ALL" && p.estado !== filterEstado) return false;
    if (filterTipo !== "ALL" && p.tipo !== filterTipo) return false;
    return true;
  });

  const selected = filtered.find((p) => p.id === selectedId) ?? null;

  // Auto-select first if nothing selected
  if (!selected && filtered.length > 0 && !selectedId) {
    // Use effect-free approach: just compute
  }

  const tipos = [...new Set((plantillas ?? []).map((p) => p.tipo))];
  const estados = [...new Set((plantillas ?? []).map((p) => p.estado))];

  // Stats
  const totalActivas = (plantillas ?? []).filter((p) => p.estado === "ACTIVA").length;
  const totalRevisadas = (plantillas ?? []).filter((p) => p.estado === "REVISADA").length;
  const totalBorradores = (plantillas ?? []).filter((p) => p.estado === "BORRADOR").length;
  const conContenido = (plantillas ?? []).filter((p) => !!p.capa1_inmutable).length;

  return (
    <div className="mx-auto max-w-[1600px] p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
          <Layers className="h-4 w-4" />
          Secretaría · Gestor de plantillas protegidas
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--g-text-primary)]">
          Plantillas con contenido jurídico
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--g-text-secondary)]">
          Gestión del ciclo de vida de las plantillas protegidas del Motor de Reglas LSC.
          Cada plantilla tiene 3 capas: inmutable (protegida por hash), parametrizada (variables del motor),
          y editable (campos que completa el secretario).
        </p>
      </div>

      {/* KPI summary bar */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4 text-center" style={{ borderRadius: "var(--g-radius-lg)" }}>
          <div className="text-2xl font-bold text-[var(--g-text-primary)]">{plantillas?.length ?? 0}</div>
          <div className="text-[11px] uppercase tracking-widest text-[var(--g-text-secondary)]">Total</div>
        </div>
        <div className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4 text-center" style={{ borderRadius: "var(--g-radius-lg)" }}>
          <div className="text-2xl font-bold text-[var(--status-success)]">{totalActivas}</div>
          <div className="text-[11px] uppercase tracking-widest text-[var(--g-text-secondary)]">Activas</div>
        </div>
        <div className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4 text-center" style={{ borderRadius: "var(--g-radius-lg)" }}>
          <div className="text-2xl font-bold text-[var(--g-brand-3308)]">{conContenido}</div>
          <div className="text-[11px] uppercase tracking-widest text-[var(--g-text-secondary)]">Con contenido</div>
        </div>
        <div className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4 text-center" style={{ borderRadius: "var(--g-radius-lg)" }}>
          <div className="text-2xl font-bold text-[var(--status-warning)]">{totalRevisadas + totalBorradores}</div>
          <div className="text-[11px] uppercase tracking-widest text-[var(--g-text-secondary)]">Pendientes</div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={filterTipo}
          onChange={(e) => setFilterTipo(e.target.value)}
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <option value="ALL">Todos los tipos</option>
          {tipos.map((t) => (
            <option key={t} value={t}>{TIPO_LABELS[t] || t}</option>
          ))}
        </select>
        <select
          value={filterEstado}
          onChange={(e) => setFilterEstado(e.target.value)}
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <option value="ALL">Todos los estados</option>
          {estados.map((e) => (
            <option key={e} value={e}>{ESTADO_CONFIG[e]?.label || e}</option>
          ))}
        </select>
        <span className="text-xs text-[var(--g-text-secondary)]">
          {filtered.length} de {plantillas?.length ?? 0} plantillas
        </span>
      </div>

      {/* Master-detail layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
        {/* Master list */}
        <div
          className="overflow-hidden border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div className="border-b border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-5 py-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--g-text-primary)]">
              Plantillas
            </h2>
          </div>
          <div className="max-h-[calc(100vh-380px)] overflow-y-auto divide-y divide-[var(--g-border-subtle)]">
            {isLoading ? (
              <div className="px-5 py-8 text-center text-sm text-[var(--g-text-secondary)]">Cargando…</div>
            ) : filtered.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-[var(--g-text-secondary)]">Sin plantillas que coincidan con los filtros.</div>
            ) : (
              filtered.map((p) => {
                const isSelected = selectedId === p.id;
                const tipoLabel = TIPO_LABELS[p.tipo] || p.tipo;
                const organoLabel = p.organo_tipo ? ORGANO_LABELS[p.organo_tipo] : null;
                const hasCapa1 = !!p.capa1_inmutable;

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className={`w-full px-5 py-3.5 text-left transition-colors ${
                      isSelected
                        ? "bg-[var(--g-sec-100)] border-l-[3px] border-l-[var(--g-brand-3308)]"
                        : "hover:bg-[var(--g-surface-subtle)]/50 border-l-[3px] border-l-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-[var(--g-text-primary)] truncate">
                        {tipoLabel}
                      </span>
                      <EstadoBadge estado={p.estado} />
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-[var(--g-text-secondary)]">
                      {organoLabel && <span>{organoLabel}</span>}
                      {organoLabel && <span>·</span>}
                      <span>{MODE_LABELS[p.adoption_mode ?? ""] || "Todos"}</span>
                      <span>·</span>
                      <span>v{p.version}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      {hasCapa1 ? (
                        <span className="flex items-center gap-1 text-[10px] text-[var(--status-success)]">
                          <CheckCircle2 className="h-3 w-3" /> Contenido jurídico
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] text-[var(--status-warning)]">
                          <AlertTriangle className="h-3 w-3" /> Sin contenido
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Detail panel */}
        <div
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] overflow-hidden"
          style={{
            borderRadius: "var(--g-radius-lg)",
            boxShadow: "var(--g-shadow-card)",
            minHeight: "500px",
          }}
        >
          {selected ? (
            <PlantillaDetailPanel plantilla={selected} />
          ) : (
            <div className="flex h-full items-center justify-center p-8">
              <div className="text-center">
                <FileText className="mx-auto h-12 w-12 text-[var(--g-border-subtle)]" />
                <p className="mt-3 text-sm text-[var(--g-text-secondary)]">
                  Selecciona una plantilla para ver su detalle y contenido jurídico.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
