import { useState } from "react";
import { Layers, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  useIniciarExpedienteTecnico,
  useUpdateTechnicalFileSection,
  type AimsSystemVersion,
  type AimsTechnicalFileSection,
} from "@/hooks/useAimsTechnicalFile";
import {
  ESTADOS_SECCION,
  etiquetaEstadoSeccion,
  normalizarEstadoSeccion,
  vinculaArt11,
} from "@/lib/aims/expediente-tecnico";
import VersionesSistema from "./VersionesSistema";

/**
 * Expediente técnico del art. 11 y anexo IV.
 *
 * Si el art. 11 vincula a este sistema NO lo decide esta pantalla: lo dice
 * `vinculaArt11` a partir del rol y del nivel, y sin uno de los dos no se
 * afirma nada. Registro interno sin hash de integridad: ni
 * `aims_technical_file_sections` ni `aims_system_versions` tienen columna donde
 * guardarlo.
 */

export interface TabExpedienteTecnicoProps {
  systemId: string;
  rol: string | null | undefined;
  nivel: string | null | undefined;
  secciones: AimsTechnicalFileSection[];
  versiones: AimsSystemVersion[];
  onClasificar: () => void;
}

const CHIP_SECCION: Record<string, string> = {
  APPROVED: "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  SEALED: "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]",
  IN_REVIEW: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  PENDING: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  NON_CONFORMING: "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
};
const CHIP_NEUTRO =
  "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]";

/** Qué dice la cabecera. `null` = sin rol o sin nivel: no se afirma ni que sí ni que no. */
const TEXTO_ART11: Record<"true" | "false" | "null", string> = {
  true: "El art. 11 exige a este sistema documentación técnica (anexo IV).",
  false: "El art. 11 no vincula a este rol y nivel: el expediente es marco operativo, no obligación.",
  null: "Sin rol o nivel declarados no se afirma si el art. 11 vincula.",
};

function textoDeSeccion(sec: AimsTechnicalFileSection): string {
  const contenido = (sec.content ?? {}) as Record<string, unknown>;
  if (typeof contenido.summary === "string") return contenido.summary;
  return Object.keys(contenido).length > 0 ? JSON.stringify(contenido) : "";
}

export default function TabExpedienteTecnico({
  systemId,
  rol,
  nivel,
  secciones,
  versiones,
  onClasificar,
}: TabExpedienteTecnicoProps) {
  const iniciar = useIniciarExpedienteTecnico();
  const actualizar = useUpdateTechnicalFileSection();
  const [editando, setEditando] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState<string>("PENDING");

  const vincula = vinculaArt11(rol, nivel);

  const abrirEdicion = (sec: AimsTechnicalFileSection) => {
    setEditando(sec.id);
    setTexto(textoDeSeccion(sec));
    const n = normalizarEstadoSeccion(sec.status);
    setEstado((ESTADOS_SECCION as readonly string[]).includes(n) ? n : "PENDING");
  };

  const guardar = async (sec: AimsTechnicalFileSection) => {
    try {
      await actualizar.mutateAsync({
        id: sec.id,
        content: { ...((sec.content ?? {}) as Record<string, unknown>), summary: texto },
        status: estado,
      });
      toast.success("Sección actualizada.");
      setEditando(null);
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? String(err);
      toast.error(`No se pudo guardar la sección: ${msg}`);
    }
  };

  const iniciarExpediente = async () => {
    try {
      await iniciar.mutateAsync(systemId);
      toast.success("Esqueleto del anexo IV registrado: 9 secciones pendientes.");
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? String(err);
      toast.error(`No se pudo iniciar el expediente: ${msg}`);
    }
  };

  return (
    <div className="space-y-6">
      <div
        className="p-6 bg-[var(--g-surface-card)] border border-[var(--g-border-default)] space-y-4"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--g-border-subtle)] pb-4">
          <div className="max-w-3xl space-y-1">
            <h2 className="flex items-center gap-2 text-base font-bold text-[var(--g-text-primary)]">
              <Layers className="h-4 w-4 text-[var(--g-brand-3308)]" />
              Estructura del Expediente Técnico (Anexo IV Reglamento UE)
            </h2>
            <p className="text-xs font-semibold text-[var(--g-text-primary)]">
              {TEXTO_ART11[String(vincula) as "true" | "false" | "null"]}
              {vincula === null && (
                <button
                  type="button"
                  onClick={onClasificar}
                  className="ml-1.5 underline underline-offset-2 text-[var(--g-link)] hover:text-[var(--g-link-hover)]"
                >
                  Clasificar este sistema
                </button>
              )}
            </p>
            <p className="text-xs text-[var(--g-text-secondary)]">
              Registro interno sin hash de integridad: ni <code>aims_technical_file_sections</code> ni{" "}
              <code>aims_system_versions</code> guardan ninguno.
            </p>
          </div>

          {secciones.length === 0 && (
            <button
              type="button"
              onClick={iniciarExpediente}
              disabled={iniciar.isPending}
              aria-busy={iniciar.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] text-xs font-bold transition-colors disabled:opacity-50"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{iniciar.isPending ? "Registrando..." : "Iniciar expediente técnico (anexo IV)"}</span>
            </button>
          )}
        </div>

        <div className="space-y-3">
          {secciones.length === 0 ? (
            <div
              className="p-8 text-center text-xs text-[var(--g-text-secondary)] bg-[var(--g-surface-subtle)]/30 border border-dashed border-[var(--g-border-subtle)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              No se han generado secciones técnicas todavía para este sistema.
            </div>
          ) : (
            secciones.map((sec) => (
              <div
                key={sec.id}
                className="p-4 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] space-y-3 transition-all hover:border-[var(--g-brand-3308)]/50"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1 max-w-xl">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[var(--g-brand-3308)]">{sec.section_code}</span>
                      <h3 className="text-sm font-bold text-[var(--g-text-primary)]">{sec.title}</h3>
                    </div>
                    <p className="text-xs text-[var(--g-text-secondary)] line-clamp-1">
                      {(sec.evidence_refs?.length ?? 0) > 0
                        ? `${sec.evidence_refs!.length} referencia(s) de evidencia`
                        : "Sin evidencia registrada en esta sección."}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {sec.reviewed_at && (
                      <div className="text-right">
                        <span className="text-xs font-bold text-[var(--g-brand-3308)]">
                          {new Date(sec.reviewed_at).toLocaleDateString("es-ES")}
                        </span>
                        <span className="text-[10px] text-[var(--g-text-secondary)] block">Revisada</span>
                      </div>
                    )}
                    <span
                      className={`px-2.5 py-1 text-xs font-semibold ${CHIP_SECCION[normalizarEstadoSeccion(sec.status)] ?? CHIP_NEUTRO}`}
                      style={{ borderRadius: "var(--g-radius-full)" }}
                    >
                      {etiquetaEstadoSeccion(sec.status)}
                    </span>
                    <button
                      type="button"
                      onClick={() => (editando === sec.id ? setEditando(null) : abrirEdicion(sec))}
                      className="px-3 py-1.5 text-xs font-semibold border border-[var(--g-border-subtle)] text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)]"
                      style={{ borderRadius: "var(--g-radius-md)" }}
                    >
                      {editando === sec.id ? "Cerrar" : "Editar"}
                    </button>
                  </div>
                </div>

                {editando === sec.id && (
                  <div className="space-y-2 border-t border-[var(--g-border-subtle)] pt-3 text-xs">
                    <label htmlFor={`sec-texto-${sec.id}`} className="block font-semibold text-[var(--g-text-primary)]">
                      Contenido de la sección
                    </label>
                    <textarea
                      id={`sec-texto-${sec.id}`}
                      rows={5}
                      value={texto}
                      onChange={(e) => setTexto(e.target.value)}
                      className="w-full p-2.5 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)]"
                      style={{ borderRadius: "var(--g-radius-md)" }}
                    />
                    <p className="text-[var(--g-text-secondary)]">
                      Se guarda como resumen de la sección; el resto del contenido registrado se conserva.
                    </p>
                    <div className="flex flex-wrap items-end justify-end gap-2">
                      <div className="mr-auto">
                        <label htmlFor={`sec-estado-${sec.id}`} className="block font-semibold text-[var(--g-text-primary)] mb-1">
                          Estado
                        </label>
                        <select
                          id={`sec-estado-${sec.id}`}
                          value={estado}
                          onChange={(e) => setEstado(e.target.value)}
                          className="h-9 px-3 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)]"
                          style={{ borderRadius: "var(--g-radius-md)" }}
                        >
                          {ESTADOS_SECCION.map((e) => (
                            <option key={e} value={e}>
                              {etiquetaEstadoSeccion(e)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditando(null)}
                        className="px-3 py-1.5 border border-[var(--g-border-subtle)] text-[var(--g-text-secondary)] hover:bg-[var(--g-surface-subtle)] font-medium"
                        style={{ borderRadius: "var(--g-radius-md)" }}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => guardar(sec)}
                        disabled={actualizar.isPending}
                        aria-busy={actualizar.isPending}
                        className="px-4 py-1.5 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] font-medium disabled:opacity-50"
                        style={{ borderRadius: "var(--g-radius-md)" }}
                      >
                        {actualizar.isPending ? "Guardando..." : "Guardar sección"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <VersionesSistema systemId={systemId} versiones={versiones} />
    </div>
  );
}
