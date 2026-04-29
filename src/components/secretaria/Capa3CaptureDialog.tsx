import { Download, FileText, Loader2, X } from "lucide-react";
import { Capa3Form } from "./Capa3Form";
import { normalizeCapa3Draft, type NormalizedCapa3Field } from "@/lib/secretaria/capa3-fields";

interface Capa3CaptureDialogProps {
  open: boolean;
  title?: string;
  subtitle?: string;
  fields: NormalizedCapa3Field[];
  values: Record<string, string>;
  errors?: Record<string, string>;
  loading?: boolean;
  submitLabel?: string;
  onChange: (values: Record<string, string>) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export function Capa3CaptureDialog({
  open,
  title = "Completar campos editables",
  subtitle = "Plantilla documental",
  fields,
  values,
  errors = {},
  loading = false,
  submitLabel = "Generar DOCX",
  onChange,
  onClose,
  onSubmit,
}: Capa3CaptureDialogProps) {
  if (!open) return null;
  const normalizedValues = normalizeCapa3Draft(fields, values).values;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--g-brand-3308)]/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="capa3-capture-title"
        className="max-h-[90vh] w-full max-w-[720px] overflow-hidden border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
        style={{ borderRadius: "var(--g-radius-xl)", boxShadow: "var(--g-shadow-modal)" }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--g-border-subtle)] px-5 py-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
              <FileText className="h-3.5 w-3.5" />
              Capa 3 documental
            </div>
            <h2 id="capa3-capture-title" className="mt-1 text-lg font-semibold text-[var(--g-text-primary)]">
              {title}
            </h2>
            <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
              {subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
            aria-label="Cerrar captura de campos editables"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
          <Capa3Form
            fields={fields}
            values={normalizedValues}
            onChange={onChange}
          />
          {Object.keys(errors).length > 0 ? (
            <div
              className="mt-4 border border-[var(--status-error)] bg-[var(--status-error)]/5 px-3 py-2 text-sm text-[var(--status-error)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              {Object.values(errors).slice(0, 3).join(" ")}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--g-border-subtle)] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="border border-[var(--g-border-subtle)] px-4 py-2 text-sm font-medium text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={loading}
            aria-busy={loading}
            className="inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:opacity-50"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {loading ? "Generando..." : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
