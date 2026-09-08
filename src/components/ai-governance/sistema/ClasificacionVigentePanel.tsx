import { useEffect, useRef, useState } from "react";
import { Copy, History, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import {
  aPayloadCuestionario,
  useCompletarCuestionario,
  useCuestionariosDeSistema,
  useGuardarBorradorCuestionario,
  useIniciarCuestionario,
} from "@/hooks/useAimsClasificacion";
import {
  ETIQUETA_PERFIL,
  resultadoProvisional,
  type PerfilCatalogo,
  type Respuestas,
} from "@/lib/aims/cuestionario-calificacion";
import { ETIQUETA_ROL, type RolRegulatorio } from "@/lib/aims/rol-regulatorio";
import { claseNivelRiesgo, etiqueta } from "@/lib/aims/vocabulario";
import ClasificacionGuiada, {
  type ClasificacionConfirmada,
} from "@/components/ai-governance/clasificacion/ClasificacionGuiada";
import HistorialClasificaciones from "@/components/ai-governance/clasificacion/HistorialClasificaciones";

/**
 * Clasificación regulatoria vigente del sistema, con su historial.
 *
 * Todo lo que se pinta sale de `aims_classification_questionnaires`; el
 * criterio, de la hoja del cuestionario. Sin fila COMPLETED no se infiere una
 * clasificación de ningún otro sitio: se dice que no la hay y qué implica.
 *
 * El autor se muestra abreviado y no como nombre —el módulo no resuelve
 * identidades— y la huella se declara por lo que es: SHA-512 de servidor sobre
 * el contenido, que no acredita fecha cierta.
 */

export interface ClasificacionVigentePanelProps {
  systemId: string;
  tieneOwner: boolean;
}

const MARGEN_AUTOGUARDADO_MS = 800;

const mensaje = (e: unknown) =>
  (e as { message?: string })?.message ?? (e instanceof Error ? e.message : String(e));

const BOTON_PRIMARIO =
  "px-3 py-1.5 text-xs font-semibold bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:opacity-50";

function Dato({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="block mb-0.5 text-[var(--g-text-secondary)]">{rotulo}</span>
      <span className="font-semibold text-[var(--g-text-primary)]">{children}</span>
    </div>
  );
}

export default function ClasificacionVigentePanel({ systemId, tieneOwner }: ClasificacionVigentePanelProps) {
  const { data: cuestionarios = [], refetch } = useCuestionariosDeSistema(systemId);
  const vigente = cuestionarios.find((c) => c.status === "COMPLETED") ?? null;
  const borrador = cuestionarios.find((c) => c.status === "DRAFT") ?? null;

  const iniciar = useIniciarCuestionario();
  const guardar = useGuardarBorradorCuestionario();
  const completar = useCompletarCuestionario();

  const [draftId, setDraftId] = useState<string | null>(null);
  const [verHistorial, setVerHistorial] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (temporizador.current) clearTimeout(temporizador.current); }, []);

  const abrir = async () => {
    try {
      const fila = borrador ?? (await iniciar.mutateAsync(systemId));
      setDraftId(fila.id);
    } catch (err) {
      // Sólo puede haber un DRAFT por sistema (índice parcial): si otra pestaña
      // lo creó y la caché no lo sabía, se recupera y se reutiliza en vez de
      // enseñar «duplicate key».
      if ((err as { code?: string })?.code === "23505") {
        const { data } = await refetch();
        const existente = (data ?? []).find((c) => c.status === "DRAFT");
        if (existente) { setDraftId(existente.id); return; }
      }
      toast.error(`No se pudo abrir la clasificación: ${mensaje(err)}`);
    }
  };

  /** Autoguardado del borrador. Sin aviso por pulsación: sólo si falla al confirmar. */
  const alCambiar = (respuestas: Respuestas, justificacionArt63: string) => {
    if (!draftId) return;
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => {
      guardar
        .mutateAsync({
          id: draftId,
          systemId,
          payload: aPayloadCuestionario({
            respuestas,
            justificacionArt63,
            resultado: resultadoProvisional(respuestas),
          }),
        })
        .catch(() => undefined);
    }, MARGEN_AUTOGUARDADO_MS);
  };

  const confirmar = async (c: ClasificacionConfirmada) => {
    if (!draftId) return;
    if (temporizador.current) clearTimeout(temporizador.current);
    try {
      await guardar.mutateAsync({ id: draftId, systemId, payload: aPayloadCuestionario(c) });
      const fila = await completar.mutateAsync({ id: draftId, systemId });
      toast.success(`Clasificación v${fila.version} registrada`);
      setDraftId(null);
    } catch (err) {
      toast.error(mensaje(err));
    }
  };

  if (draftId) {
    return (
      <ClasificacionGuiada
        modo="reclasificacion"
        respuestasIniciales={{ ...(borrador?.phase1_responses ?? {}), ...(borrador?.phase2_responses ?? {}) }}
        justificacionInicial={borrador?.phase2_art63_justification ?? ""}
        tieneOwner={tieneOwner}
        onCambio={alCambiar}
        onConfirmar={confirmar}
        onCancelar={() => setDraftId(null)}
        confirmando={guardar.isPending || completar.isPending}
      />
    );
  }

  return (
    <section
      className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-5 space-y-3"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--g-border-subtle)] pb-3">
        <div>
          <h2 className="text-base font-bold text-[var(--g-text-primary)]">Clasificación regulatoria</h2>
          {vigente && (
            <p className="text-xs text-[var(--g-text-secondary)]">
              Versión {vigente.version} · cuestionario {vigente.questionnaire_version}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={abrir} disabled={iniciar.isPending} className={BOTON_PRIMARIO} style={{ borderRadius: "var(--g-radius-md)" }}>
            {borrador ? "Continuar borrador" : vigente ? "Nueva clasificación" : "Iniciar clasificación guiada"}
          </button>
          {cuestionarios.length > 0 && (
            <button
              type="button"
              onClick={() => setVerHistorial((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-[var(--g-border-subtle)] text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <History className="h-3.5 w-3.5" />
              <span>Historial ({cuestionarios.length})</span>
            </button>
          )}
        </div>
      </div>

      {!vigente ? (
        <p className="flex items-start gap-1.5 text-xs font-semibold text-[var(--status-warning)]">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Sin clasificación guiada — este sistema se mide contra el catálogo completo</span>
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <Dato rotulo="Rol regulatorio:">
              {vigente.computed_role
                ? ETIQUETA_ROL[vigente.computed_role as RolRegulatorio] ?? vigente.computed_role
                : "No derivado"}
            </Dato>
            <div>
              <span className="block mb-0.5 text-[var(--g-text-secondary)]">Nivel de riesgo:</span>
              <span
                className={`inline-block px-2 py-0.5 font-semibold ${claseNivelRiesgo(vigente.computed_risk_level)}`}
                style={{ borderRadius: "var(--g-radius-full)" }}
              >
                {etiqueta("nivel", vigente.computed_risk_level) || "No derivado"}
              </span>
            </div>
            <Dato rotulo="Catálogo aplicable:">
              {vigente.catalog_profile
                ? ETIQUETA_PERFIL[vigente.catalog_profile as PerfilCatalogo] ?? vigente.catalog_profile
                : "No derivado"}
            </Dato>
            <Dato rotulo="Modelo de uso general:">{vigente.gpai_dependency ? "Sí" : "No"}</Dato>
            <Dato rotulo="Fecha de la clasificación:">
              {vigente.completed_at ? new Date(vigente.completed_at).toLocaleString("es-ES") : "Sin fecha registrada"}
            </Dato>
            <Dato rotulo="Registrada por:">
              {vigente.completed_by ? `${vigente.completed_by.slice(0, 8)}…` : "Sin autor registrado"}
            </Dato>
            <div className="md:col-span-2">
              <span className="block mb-0.5 text-[var(--g-text-secondary)]">
                Huella del contenido (SHA-512 de servidor; no acredita fecha cierta):
              </span>
              {vigente.content_hash ? (
                <span className="flex items-center gap-1.5">
                  <code className="text-[var(--g-text-primary)]">{vigente.content_hash.slice(0, 16)}</code>
                  <button
                    type="button"
                    aria-label="Copiar huella"
                    onClick={() =>
                      navigator.clipboard
                        ?.writeText(vigente.content_hash!)
                        .then(() => toast.success("Huella copiada."))
                        .catch(() => toast.error("No se pudo copiar la huella."))
                    }
                    className="text-[var(--g-text-secondary)] transition-colors hover:text-[var(--g-brand-3308)]"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </span>
              ) : (
                <span className="text-[var(--g-text-secondary)]">Sin huella registrada</span>
              )}
            </div>
          </div>

          <div className="space-y-1 border-t border-[var(--g-border-subtle)] pt-3 text-xs">
            <span className="block font-semibold text-[var(--g-text-primary)]">Marcos derivados</span>
            {vigente.applicable_frameworks.length === 0 ? (
              <p className="text-[var(--g-text-secondary)]">Ninguno derivado por el cuestionario.</p>
            ) : (
              vigente.applicable_frameworks.map((m) => (
                <p key={m.code} className="text-[var(--g-text-secondary)]">
                  · <span className="font-semibold text-[var(--g-text-primary)]">{m.articulos}</span> — {m.titulo}
                  {m.nota ? ` · ${m.nota}` : ""}
                </p>
              ))
            )}
          </div>
        </>
      )}

      {verHistorial && (
        <div className="border-t border-[var(--g-border-subtle)] pt-3">
          <HistorialClasificaciones cuestionarios={cuestionarios} />
        </div>
      )}
    </section>
  );
}
