import { Plus, Trash2 } from "lucide-react";
import type { SupportDocDraft } from "@/lib/secretaria/sociedad-onboarding/types";
import { Field } from "./shared/Field";

function emptyDoc(index: number): SupportDocDraft {
  return {
    key: `doc-${Date.now()}-${index}`,
    tipo: "",
    nombre: "",
    uri: "",
    sha512: "",
  };
}

export function StepDocumentosSoporte({
  docs,
  onChange,
}: {
  docs: SupportDocDraft[];
  onChange: (docs: SupportDocDraft[]) => void;
}) {
  const updateDoc = (index: number, patch: Partial<SupportDocDraft>) => {
    onChange(docs.map((doc, i) => (i === index ? { ...doc, ...patch } : doc)));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => onChange([...docs, emptyDoc(docs.length)])}
          className="inline-flex items-center gap-1.5 bg-[var(--g-brand-3308)] px-3 py-2 text-sm font-semibold text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <Plus className="h-4 w-4" />
          Anadir documento
        </button>
      </div>

      {docs.map((doc, index) => (
        <div
          key={doc.key}
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-[var(--g-text-primary)]">{doc.nombre || "Documento"}</div>
            <button
              type="button"
              aria-label="Eliminar documento"
              onClick={() => onChange(docs.filter((_, i) => i !== index))}
              className="inline-flex h-8 w-8 items-center justify-center border border-[var(--g-border-subtle)] text-[var(--g-text-secondary)] hover:bg-[var(--g-surface-subtle)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Tipo" value={doc.tipo} onChange={(tipo) => updateDoc(index, { tipo })} />
            <Field label="Nombre" value={doc.nombre} onChange={(nombre) => updateDoc(index, { nombre })} />
            <Field label="URI" value={doc.uri} onChange={(uri) => updateDoc(index, { uri })} />
            <Field label="SHA-512" value={doc.sha512} onChange={(sha512) => updateDoc(index, { sha512 })} />
          </div>
        </div>
      ))}
    </div>
  );
}
