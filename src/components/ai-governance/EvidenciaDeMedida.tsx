import { useState } from "react";
import { Paperclip, Plus, Link2, FileCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  AVISO_HASH_CLIENTE,
  useRegistrarEvidencia,
  useVincularEvidencia,
  type AimsEvidenceItem,
} from "@/hooks/useAimsEvidence";

/**
 * Adjuntar o vincular evidencia a UNA medida del autodiagnóstico.
 *
 * Un `L5` sin nada detrás es una autodeclaración, y un porcentaje construido
 * con autodeclaraciones no vale ni para auditoría interna ni para
 * certificación. Hasta hoy el módulo no tenía dónde guardar la evidencia: en el
 * primer piloto real hay 40 medidas en L5 y cero evidencias en toda la
 * instalación.
 *
 * Una misma evidencia se ata a VARIAS medidas sin duplicar el fichero: un
 * informe SOC 2 del proveedor sirve a la vez para seguridad, gobernanza y
 * gestión de proveedor.
 */

const INPUT =
  "h-9 w-full px-2.5 text-xs bg-[var(--g-surface-card)] text-[var(--g-text-primary)] border border-[var(--g-border-subtle)] focus:border-[var(--g-brand-3308)] focus:outline-none";

const TIPOS = ["DOCUMENTO", "CERTIFICADO", "INFORME", "CONTRATO", "REGISTRO", "OTRO"] as const;

export default function EvidenciaDeMedida({
  systemId,
  measureId,
  vinculadas,
  delSistema,
}: {
  systemId: string;
  measureId: string;
  /** Evidencias VIGENTES ya atadas a esta medida. */
  vinculadas: AimsEvidenceItem[];
  /** Todas las del sistema, para poder reutilizar una sin volver a subirla. */
  delSistema: AimsEvidenceItem[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<string>("DOCUMENTO");
  const [file, setFile] = useState<File | null>(null);
  const [externalRef, setExternalRef] = useState("");
  const [documentDate, setDocumentDate] = useState("");
  const [expiresOn, setExpiresOn] = useState("");

  const registrar = useRegistrarEvidencia();
  const vincular = useVincularEvidencia();

  const yaVinculadas = new Set(vinculadas.map((e) => e.id));
  const reutilizables = delSistema.filter((e) => !yaVinculadas.has(e.id));

  const limpiar = () => {
    setTitle("");
    setKind("DOCUMENTO");
    setFile(null);
    setExternalRef("");
    setDocumentDate("");
    setExpiresOn("");
    setAbierto(false);
  };

  const handleRegistrar = async () => {
    if (!title.trim()) {
      toast.error("Ponle un título a la evidencia.");
      return;
    }
    try {
      await registrar.mutateAsync({
        systemId,
        kind,
        title,
        file,
        externalRef,
        documentDate,
        expiresOn,
        links: [{ tipo: "MEDIDA", ref: measureId }],
      });
      toast.success("Evidencia registrada y vinculada a la medida.");
      limpiar();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`No se pudo registrar la evidencia: ${msg}`);
    }
  };

  const handleVincular = async (e: AimsEvidenceItem) => {
    try {
      await vincular.mutateAsync({
        id: e.id,
        links: [...(e.links ?? []), { tipo: "MEDIDA", ref: measureId }],
      });
      toast.success("Evidencia vinculada. El fichero no se duplica.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`No se pudo vincular: ${msg}`);
    }
  };

  return (
    <div className="pt-2 border-t border-[var(--g-border-subtle)] space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--g-text-primary)]">
          <Paperclip className="w-3.5 h-3.5 text-[var(--g-brand-3308)]" />
          Evidencia ({vinculadas.length})
        </span>
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium border border-[var(--g-border-subtle)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] transition-colors"
          style={{ borderRadius: "var(--g-radius-sm)" }}
        >
          <Plus className="w-3 h-3" />
          Añadir
        </button>
        {vinculadas.length === 0 && (
          <span className="text-[11px] text-[var(--g-text-secondary)]">
            Sin evidencia, la medida se declara pero no se acredita.
          </span>
        )}
      </div>

      {vinculadas.length > 0 && (
        <ul className="space-y-1">
          {vinculadas.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-2 text-[11px]">
              <FileCheck className="w-3 h-3 text-[var(--status-success)]" />
              <span className="font-medium text-[var(--g-text-primary)]">{e.title}</span>
              <span className="text-[var(--g-text-secondary)]">{e.kind}</span>
              {e.content_hash && (
                <span
                  className="font-mono text-[10px] text-[var(--g-text-secondary)]"
                  title={`${e.hash_algorithm} · ${AVISO_HASH_CLIENTE}`}
                >
                  {e.hash_algorithm} {e.content_hash.slice(0, 12)}…
                </span>
              )}
              {e.expires_on && (
                <span className="text-[10px] text-[var(--g-text-secondary)]">caduca {e.expires_on}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {abierto && (
        <div
          className="p-3 bg-[var(--g-surface-subtle)] border border-[var(--g-border-subtle)] space-y-2"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título de la evidencia *"
              className={INPUT}
              style={{ borderRadius: "var(--g-radius-sm)" }}
              aria-label="Título de la evidencia"
            />
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className={INPUT}
              style={{ borderRadius: "var(--g-radius-sm)" }}
              aria-label="Tipo de evidencia"
            >
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0) + t.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className={`${INPUT} py-1.5`}
              style={{ borderRadius: "var(--g-radius-sm)" }}
              aria-label="Fichero de la evidencia"
            />
            <input
              type="text"
              value={externalRef}
              onChange={(e) => setExternalRef(e.target.value)}
              placeholder="…o referencia documental externa"
              className={INPUT}
              style={{ borderRadius: "var(--g-radius-sm)" }}
              aria-label="Referencia documental externa"
            />
            <label className="text-[11px] text-[var(--g-text-secondary)]">
              Fecha del documento
              <input
                type="date"
                value={documentDate}
                onChange={(e) => setDocumentDate(e.target.value)}
                className={INPUT}
                style={{ borderRadius: "var(--g-radius-sm)" }}
              />
            </label>
            <label className="text-[11px] text-[var(--g-text-secondary)]">
              Caduca el
              <input
                type="date"
                value={expiresOn}
                onChange={(e) => setExpiresOn(e.target.value)}
                className={INPUT}
                style={{ borderRadius: "var(--g-radius-sm)" }}
              />
            </label>
          </div>

          <p className="flex items-start gap-1.5 text-[11px] text-[var(--g-text-secondary)]">
            <AlertTriangle className="mt-0.5 w-3 h-3 shrink-0" />
            <span>{AVISO_HASH_CLIENTE}</span>
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRegistrar}
              disabled={registrar.isPending}
              aria-busy={registrar.isPending}
              className="px-3 py-1.5 text-xs font-medium bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] disabled:opacity-70 transition-colors"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              {registrar.isPending ? "Registrando…" : "Registrar evidencia"}
            </button>
            <button
              type="button"
              onClick={limpiar}
              className="px-3 py-1.5 text-xs text-[var(--g-text-secondary)] hover:bg-[var(--g-surface-card)] transition-colors"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              Cancelar
            </button>
          </div>

          {reutilizables.length > 0 && (
            <div className="pt-2 border-t border-[var(--g-border-subtle)] space-y-1">
              <span className="text-[11px] font-semibold text-[var(--g-text-primary)]">
                O vincula una ya registrada — el fichero no se duplica
              </span>
              <ul className="space-y-1">
                {reutilizables.slice(0, 8).map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => handleVincular(e)}
                      className="inline-flex items-center gap-1.5 text-[11px] text-[var(--g-link)] hover:text-[var(--g-link-hover)]"
                    >
                      <Link2 className="w-3 h-3" />
                      {e.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
