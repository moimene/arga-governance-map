// MOI-175 F5.T12 — pantalla EIPD (art. 35 RGPD).
//
// Objeto DISTINTO de la EIDF del art. 27 RIA (DS-37, RH-5): el rótulo dice
// siempre "EIPD (art. 35 RGPD)", nunca "EIDF". Visible en los dos tenants sin
// tocar el branding — tokens --g-*/--status-* únicamente.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Plus, ShieldQuestion, X } from "lucide-react";
import { toast } from "sonner";
import { useEntitiesList } from "@/hooks/useEntities";
import { useAiSystemsList } from "@/hooks/useAiSystems";
import {
  useDpias,
  useRegistrarEipd,
  type DpiaControllerRole,
  type DpiaNecessityResult,
} from "@/hooks/useDpias";

const NECESSITY_LABEL: Record<DpiaNecessityResult, string> = {
  PENDIENTE: "Pendiente de determinación por el DPO",
  REQUERIDA: "EIPD requerida",
  NO_REQUERIDA_MOTIVADA: "No requerida (motivada)",
};

const NECESSITY_CHIP: Record<DpiaNecessityResult, string> = {
  PENDIENTE: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  REQUERIDA: "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  NO_REQUERIDA_MOTIVADA: "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
};

const CONTROLLER_ROLE_LABEL: Record<DpiaControllerRole, string> = {
  RESPONSABLE: "Responsable del tratamiento",
  CORRESPONSABLE: "Corresponsable",
  ENCARGADO: "Encargado del tratamiento",
};

const DATE_FORMATTER = new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" });

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : DATE_FORMATTER.format(d);
}

function NuevaEipdForm({ onClose }: { onClose: () => void }) {
  const { data: entities = [] } = useEntitiesList();
  const { data: systems = [] } = useAiSystemsList();
  const registrar = useRegistrarEipd();

  const [code, setCode] = useState("");
  const [entityId, setEntityId] = useState("");
  const [aiSystemId, setAiSystemId] = useState("");
  const [controllerRole, setControllerRole] = useState<DpiaControllerRole>("RESPONSABLE");
  const [description, setDescription] = useState("");

  const canSubmit = code.trim() !== "" && entityId !== "" && description.trim() !== "";

  return (
    <form
      className="mb-6 space-y-4 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        registrar.mutate(
          {
            code: code.trim(),
            entityId,
            controllerRole,
            processingDescription: description.trim(),
            aiSystemId: aiSystemId || undefined,
          },
          {
            onSuccess: () => {
              toast.success("EIPD registrada como PENDIENTE de determinación por el DPO");
              onClose();
            },
            onError: (err) => toast.error(err instanceof Error ? err.message : String(err)),
          }
        );
      }}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">Nueva EIPD</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar formulario"
          className="text-[var(--g-text-secondary)] hover:text-[var(--g-text-primary)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <p className="text-xs text-[var(--g-text-secondary)]">
        La necesidad de EIPD nace siempre <strong>PENDIENTE</strong>: nunca se infiere del nivel de
        riesgo del RIA (art. 35 RGPD, criterio C5). La determina el DPO.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-[var(--g-text-secondary)]">
          Código
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="mt-1 h-9 w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 text-sm text-[var(--g-text-primary)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
            placeholder="EIPD-2026-001"
          />
        </label>

        <label className="text-xs font-medium text-[var(--g-text-secondary)]">
          Rol frente al tratamiento
          <select
            value={controllerRole}
            onChange={(e) => setControllerRole(e.target.value as DpiaControllerRole)}
            className="mt-1 h-9 w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 text-sm text-[var(--g-text-primary)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            {(Object.keys(CONTROLLER_ROLE_LABEL) as DpiaControllerRole[]).map((role) => (
              <option key={role} value={role}>
                {CONTROLLER_ROLE_LABEL[role]}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-medium text-[var(--g-text-secondary)]">
          Entidad responsable
          <select
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            className="mt-1 h-9 w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 text-sm text-[var(--g-text-primary)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <option value="">Seleccionar…</option>
            {entities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.common_name || e.legal_name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-medium text-[var(--g-text-secondary)]">
          Sistema de IA (opcional)
          <select
            value={aiSystemId}
            onChange={(e) => setAiSystemId(e.target.value)}
            className="mt-1 h-9 w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 text-sm text-[var(--g-text-primary)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <option value="">Sin sistema vinculado</option>
            {systems.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-xs font-medium text-[var(--g-text-secondary)]">
        Descripción del tratamiento
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="mt-1 w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-3 text-sm text-[var(--g-text-primary)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        />
      </label>

      <button
        type="submit"
        disabled={!canSubmit || registrar.isPending}
        className="inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] disabled:opacity-50"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        {registrar.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        Registrar EIPD
      </button>
    </form>
  );
}

export default function Eipd() {
  const { data: dpias = [], isLoading, error } = useDpias();
  const [showForm, setShowForm] = useState(false);

  const pendientes = useMemo(() => dpias.filter((d) => d.necessity_result === "PENDIENTE").length, [dpias]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-[var(--g-text-primary)]">
            <ShieldQuestion className="h-5 w-5 text-[var(--g-brand-3308)]" />
            EIPD (art. 35 RGPD)
          </h1>
          <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
            Evaluación de Impacto en Protección de Datos — objeto distinto de la EIDF del art. 27 RIA.
            {pendientes > 0 && ` ${pendientes} pendiente(s) de determinación por el DPO.`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm font-medium text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <Plus className="h-4 w-4" />
          Nueva EIPD
        </button>
      </header>

      {showForm && <NuevaEipdForm onClose={() => setShowForm(false)} />}

      {isLoading && <p className="text-sm text-[var(--g-text-secondary)]">Cargando…</p>}
      {error && (
        <p className="text-sm text-[var(--status-error)]">
          {error instanceof Error ? error.message : "Error al cargar las EIPD"}
        </p>
      )}

      {!isLoading && !error && dpias.length === 0 && (
        <p className="border border-dashed border-[var(--g-border-subtle)] p-6 text-center text-sm text-[var(--g-text-secondary)]" style={{ borderRadius: "var(--g-radius-lg)" }}>
          Sin EIPD registradas todavía en este tenant.
        </p>
      )}

      {dpias.length > 0 && (
        <div className="overflow-x-auto border border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-lg)" }}>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-[var(--g-surface-subtle)]">
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-[var(--g-text-primary)]">Código</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-[var(--g-text-primary)]">Tratamiento</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-[var(--g-text-primary)]">Rol</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-[var(--g-text-primary)]">Necesidad</th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-[var(--g-text-primary)]">Actualizada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--g-border-subtle)]">
              {dpias.map((d) => (
                <tr key={d.id} className="hover:bg-[var(--g-surface-subtle)]/50">
                  <td className="px-4 py-3 font-medium text-[var(--g-text-primary)]">{d.code}</td>
                  <td className="max-w-xs truncate px-4 py-3 text-[var(--g-text-secondary)]" title={d.processing_description}>
                    {d.processing_description}
                  </td>
                  <td className="px-4 py-3 text-[var(--g-text-secondary)]">{CONTROLLER_ROLE_LABEL[d.controller_role]}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2.5 py-1 text-xs font-medium ${NECESSITY_CHIP[d.necessity_result]}`}
                      style={{ borderRadius: "var(--g-radius-full)" }}
                      title={d.necessity_rationale}
                    >
                      {NECESSITY_LABEL[d.necessity_result]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--g-text-secondary)]">{formatDate(d.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-6 text-xs text-[var(--g-text-secondary)]">
        ¿Buscas la evaluación de impacto discriminatorio del art. 27 RIA? Es un objeto distinto:{" "}
        <Link to="/ai-governance" className="text-[var(--g-link)] hover:text-[var(--g-link-hover)]">
          ir al programa de AIMS
        </Link>
        .
      </p>
    </div>
  );
}
