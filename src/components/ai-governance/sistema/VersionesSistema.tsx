import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useRegistrarVersion, type AimsSystemVersion } from "@/hooks/useAimsTechnicalFile";

/**
 * Versiones registradas del sistema. «Registrado» y nada más: no hay sello, ni
 * huella, ni custodia — la tabla no tiene columna para ninguna de las tres.
 */

export interface VersionesSistemaProps {
  systemId: string;
  versiones: AimsSystemVersion[];
}

/** Los tres valores que la columna admite hoy; `DRAFT` es su DEFAULT. */
const ETAPAS = [
  { value: "DRAFT", label: "En desarrollo" },
  { value: "PILOT", label: "Piloto" },
  { value: "PRODUCTION", label: "Producción" },
];

const CAMPO =
  "w-full h-9 px-3 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)]";
const ETIQUETA_CAMPO = "block font-semibold text-[var(--g-text-primary)] mb-1";

export default function VersionesSistema({ systemId, versiones }: VersionesSistemaProps) {
  const registrar = useRegistrarVersion();
  const [abierto, setAbierto] = useState(false);
  const [etiquetaVersion, setEtiquetaVersion] = useState("");
  const [etapa, setEtapa] = useState("DRAFT");
  const [desde, setDesde] = useState("");
  const [resumen, setResumen] = useState("");

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await registrar.mutateAsync({
        systemId,
        versionLabel: etiquetaVersion.trim(),
        releaseStage: etapa,
        effectiveFrom: desde || null,
        changeSummary: resumen.trim() || null,
      });
      toast.success("Versión registrada.");
      setAbierto(false);
      setEtiquetaVersion("");
      setDesde("");
      setResumen("");
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? String(err);
      toast.error(`No se pudo registrar la versión: ${msg}`);
    }
  };

  return (
    <div
      className="p-6 bg-[var(--g-surface-card)] border border-[var(--g-border-default)] space-y-4"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--g-border-subtle)] pb-3">
        <h2 className="text-base font-bold text-[var(--g-text-primary)]">Versiones del sistema</h2>
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] text-xs font-semibold transition-colors"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Registrar versión</span>
        </button>
      </div>

      {abierto && (
        <form
          onSubmit={guardar}
          className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 text-xs border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)]/30"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <div>
            <label htmlFor="ver-label" className={ETIQUETA_CAMPO}>Identificador de versión *</label>
            <input
              id="ver-label"
              required
              value={etiquetaVersion}
              onChange={(e) => setEtiquetaVersion(e.target.value)}
              placeholder="v1.3.0"
              className={CAMPO}
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
          </div>
          <div>
            <label htmlFor="ver-etapa" className={ETIQUETA_CAMPO}>Etapa</label>
            <select
              id="ver-etapa"
              value={etapa}
              onChange={(e) => setEtapa(e.target.value)}
              className={CAMPO}
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              {ETAPAS.map((e) => (
                <option key={e.value} value={e.value}>
                  {e.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ver-desde" className={ETIQUETA_CAMPO}>En vigor desde</label>
            <input
              id="ver-desde"
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className={CAMPO}
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
          </div>
          <div className="md:col-span-3">
            <label htmlFor="ver-resumen" className={ETIQUETA_CAMPO}>Resumen de cambios</label>
            <textarea
              id="ver-resumen"
              rows={2}
              value={resumen}
              onChange={(e) => setResumen(e.target.value)}
              className="w-full p-2.5 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
          </div>
          <div className="md:col-span-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="px-3 py-1.5 border border-[var(--g-border-subtle)] text-[var(--g-text-secondary)] hover:bg-[var(--g-surface-subtle)] font-medium"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={registrar.isPending}
              aria-busy={registrar.isPending}
              className="px-4 py-1.5 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] font-medium disabled:opacity-50"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              {registrar.isPending ? "Registrando..." : "Registrar"}
            </button>
          </div>
        </form>
      )}

      {versiones.length === 0 ? (
        <p className="text-xs text-[var(--g-text-secondary)] italic py-2">
          No hay versiones registradas para este sistema.
        </p>
      ) : (
        <div className="space-y-2">
          {versiones.map((v) => (
            <div
              key={v.id}
              className="p-3 bg-[var(--g-surface-subtle)]/40 border border-[var(--g-border-subtle)] space-y-1 text-xs"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-[var(--g-text-primary)]">{v.version_label}</span>
                <span className="text-[var(--g-text-secondary)]">
                  {v.release_stage || "Etapa no declarada"} ·{" "}
                  {v.effective_from
                    ? `en vigor desde ${new Date(v.effective_from).toLocaleDateString("es-ES")}`
                    : "sin fecha de vigor"}
                </span>
              </div>
              <p className="text-[var(--g-text-secondary)]">
                {v.change_summary || "Sin resumen de cambios registrado."}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
