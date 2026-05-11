// src/components/secretaria/BloquesSectorialesPanel.tsx
import { useState } from "react";
import { toast } from "sonner";
import { useBloquesSectoriales, useInsertBloque, type BloqueSectorialRow } from "@/hooks/useBloquesSectoriales";
import { useEntitySettingsCatalog } from "@/hooks/useEntitySettingsCatalog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface Props {
  entityId: string;
  agreementId: string;
  materia: string;
  /**
   * `capa3_editables` de la plantilla activa. Necesaria para detectar
   * `campo_libre_sectorial` (graceful degradation §5.3).
   */
  capa3Editables: Array<{ campo: string; [k: string]: unknown }>;
  /** Valor actual del textarea capa3 + setter para append literal. */
  campoLibreValue: string;
  onCampoLibreChange: (newValue: string) => void;
}

function useEntitySectorRegulado(entityId: string) {
  return useQuery({
    queryKey: ["entity-setting-sector", entityId],
    enabled: !!entityId,
    queryFn: async (): Promise<string | undefined> => {
      const { data } = await supabase
        .from("entity_settings")
        .select("value")
        .eq("entity_id", entityId)
        .eq("key", "sector_regulado")
        .maybeSingle();
      return (data?.value as string | undefined) ?? undefined;
    },
  });
}

export function BloquesSectorialesPanel({
  entityId,
  agreementId,
  materia,
  capa3Editables,
  campoLibreValue,
  onCampoLibreChange,
}: Props) {
  const [showAll, setShowAll] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const sectorQuery = useEntitySectorRegulado(entityId);
  const sector = sectorQuery.data;
  const catalogQuery = useEntitySettingsCatalog();
  const sectorDefault = catalogQuery.byKey.get("sector_regulado")?.default_value as string | undefined;
  const effectiveSector = sector ?? sectorDefault ?? "GENERICO";

  const bloquesQuery = useBloquesSectoriales({ sector: effectiveSector, materia, showAll });
  const insertMutation = useInsertBloque();

  // Graceful degradation §5.3
  const hasCampoLibre = capa3Editables.some((f) => f.campo === "campo_libre_sectorial");

  // R10: oculto por defecto si GENERICO y showAll=false
  const shouldHideByDefault = effectiveSector === "GENERICO" && !showAll;

  if (shouldHideByDefault) {
    return (
      <div className="p-3 border-l border-[var(--g-border-subtle)]">
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="text-sm text-[var(--g-link)] hover:text-[var(--g-link-hover)]"
          aria-label="Mostrar bloques sectoriales aunque la sociedad sea GENERICO"
        >
          Mostrar bloques disponibles
        </button>
      </div>
    );
  }

  if (collapsed) {
    return (
      <div className="p-3 border-l border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="text-sm font-medium text-[var(--g-text-primary)]"
          aria-label="Expandir panel de bloques sectoriales"
        >
          Bloques sectoriales ({bloquesQuery.data?.length ?? 0}) ▸
        </button>
      </div>
    );
  }

  const bloques = bloquesQuery.data ?? [];

  return (
    <aside
      className="w-80 border-l border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4 flex flex-col gap-3"
      aria-label="Bloques sectoriales sugeridos"
    >
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--g-text-primary)]">
          Bloques sectoriales sugeridos
          <span className="ml-2 inline-block px-2 py-0.5 text-xs bg-[var(--g-surface-subtle)] text-[var(--g-text-secondary)]"
            style={{ borderRadius: "var(--g-radius-full)" }}>
            {bloques.length}
          </span>
        </h3>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          aria-label="Colapsar panel"
          className="text-[var(--g-text-secondary)] hover:text-[var(--g-text-primary)]"
        >
          ◂
        </button>
      </header>

      <label className="flex items-center gap-2 text-xs text-[var(--g-text-secondary)]">
        <input
          type="checkbox"
          checked={showAll}
          onChange={(e) => setShowAll(e.target.checked)}
        />
        Mostrar todos los sectores (filtro actual: {effectiveSector})
      </label>

      {!hasCampoLibre && (
        <div
          className="p-2 text-xs text-[var(--status-warning)] bg-[var(--g-surface-subtle)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
          role="status"
        >
          Esta plantilla no admite bloques sectoriales todavía. Pendiente de bumpar a versión compatible. Mientras tanto, puedes copiar el texto del bloque manualmente.
        </div>
      )}

      {bloquesQuery.isLoading && (
        <p className="text-sm text-[var(--g-text-secondary)]">Cargando bloques…</p>
      )}

      {bloques.length === 0 && !bloquesQuery.isLoading && (
        <p className="text-sm text-[var(--g-text-secondary)]">
          No hay bloques sugeridos para esta sociedad y materia.
        </p>
      )}

      {bloques.map((b) => (
        <BloqueCard
          key={`${b.clave_bloque}-${b.version}`}
          bloque={b}
          disabled={!hasCampoLibre}
          onInsert={async () => {
            // WORM contract: persist audit row FIRST (blocking). Only update the
            // textarea if the audit row succeeded. This prevents generated documents
            // containing untracked sector text when the INSERT into bloque_insertions
            // fails (RLS, constraint, transient network). On failure, the textarea
            // is unchanged and the secretary can retry — guarantees that every byte
            // of sector text in capa3 has a matching WORM row in bloque_insertions.
            try {
              await insertMutation.mutateAsync({ agreementId, bloque: b });
              const sep = campoLibreValue && !campoLibreValue.endsWith("\n\n") ? "\n\n" : "";
              const newValue = `${campoLibreValue}${sep}${b.texto_aprobado}`;
              onCampoLibreChange(newValue);
              toast.success(
                `Bloque ${b.clave_bloque} v${b.version} insertado. Puedes editarlo antes de generar el documento.`,
              );
            } catch (e) {
              toast.error("Falló el registro de auditoría del bloque. El texto NO se ha insertado para preservar trazabilidad WORM. Reintenta o consulta a soporte.");
              console.error("[BloquesSectorialesPanel] audit insert failed; textarea NOT modified", e);
            }
          }}
        />
      ))}
    </aside>
  );
}

interface CardProps {
  bloque: BloqueSectorialRow;
  disabled: boolean;
  onInsert: () => void;
}

function BloqueCard({ bloque, disabled, onInsert }: CardProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  return (
    <article
      className="p-3 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
      style={{ borderRadius: "var(--g-radius-md)" }}
      role="article"
      aria-label={`Bloque ${bloque.clave_bloque} versión ${bloque.version}`}
    >
      <h4 className="text-sm font-medium text-[var(--g-text-primary)]">
        {bloque.clave_bloque}{" "}
        <span className="text-xs text-[var(--g-text-secondary)]">v{bloque.version}</span>
      </h4>
      {bloque.descripcion && (
        <p className="mt-1 text-xs text-[var(--g-text-secondary)]">{bloque.descripcion}</p>
      )}
      {bloque.referencia_legal && (
        <p className="mt-1 text-xs italic text-[var(--g-text-secondary)]">
          {bloque.referencia_legal}
        </p>
      )}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="text-xs px-2 py-1 border border-[var(--g-border-subtle)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
          style={{ borderRadius: "var(--g-radius-sm)" }}
          aria-label={`Vista previa del bloque ${bloque.clave_bloque}`}
        >
          Vista previa
        </button>
        <button
          type="button"
          onClick={onInsert}
          disabled={disabled}
          aria-disabled={disabled}
          className="text-xs px-2 py-1 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] disabled:opacity-50"
          style={{ borderRadius: "var(--g-radius-sm)" }}
          aria-label={`Insertar bloque ${bloque.clave_bloque} en campo libre sectorial`}
        >
          Insertar
        </button>
      </div>
      {previewOpen && (
        <div
          className="mt-2 p-2 bg-[var(--g-surface-subtle)] text-xs text-[var(--g-text-primary)] max-h-40 overflow-y-auto whitespace-pre-wrap"
          style={{ borderRadius: "var(--g-radius-sm)" }}
        >
          {bloque.texto_aprobado}
          <button
            type="button"
            onClick={() => setPreviewOpen(false)}
            className="block mt-1 text-[var(--g-link)] underline"
          >
            Cerrar vista previa
          </button>
        </div>
      )}
    </article>
  );
}
