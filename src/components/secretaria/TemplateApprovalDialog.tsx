import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

export interface TemplateApprovalValues {
  aprobadaPor: string;
  fechaAprobacion: string;
}

interface TemplateApprovalDialogProps {
  pending?: boolean;
  onConfirm: (values: TemplateApprovalValues) => void | Promise<void>;
  onCancel: () => void;
}

interface ApprovalErrors {
  aprobadaPor?: string;
  fechaAprobacion?: string;
}

function todayForDateInput() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function TemplateApprovalDialog({
  pending = false,
  onConfirm,
  onCancel,
}: TemplateApprovalDialogProps) {
  const dialogId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const approverRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const latestApprovalDate = todayForDateInput();
  const [aprobadaPor, setAprobadaPor] = useState("");
  const [fechaAprobacion, setFechaAprobacion] = useState(todayForDateInput);
  const [errors, setErrors] = useState<ApprovalErrors>({});

  const titleId = `${dialogId}-title`;
  const descriptionId = `${dialogId}-description`;
  const approverId = `${dialogId}-approver`;
  const approverErrorId = `${dialogId}-approver-error`;
  const dateId = `${dialogId}-date`;
  const dateErrorId = `${dialogId}-date-error`;

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    approverRef.current?.focus();
    return () => previouslyFocused?.focus();
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: ApprovalErrors = {};
    const normalizedApprover = aprobadaPor.trim();

    if (!normalizedApprover) {
      nextErrors.aprobadaPor = "Indica quién aprobó la plantilla.";
    }
    if (!fechaAprobacion) {
      nextErrors.fechaAprobacion = "Indica la fecha de aprobación.";
    } else if (fechaAprobacion > latestApprovalDate) {
      nextErrors.fechaAprobacion = "La fecha de aprobación no puede ser futura.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || pending) {
      if (nextErrors.aprobadaPor) approverRef.current?.focus();
      else if (nextErrors.fechaAprobacion) dateRef.current?.focus();
      return;
    }

    void onConfirm({
      aprobadaPor: normalizedApprover,
      fechaAprobacion,
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && !pending) {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--g-text-primary)]/40 p-4"
      onKeyDown={handleKeyDown}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="w-full max-w-lg border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-6"
        style={{ borderRadius: "var(--g-radius-xl)", boxShadow: "var(--g-shadow-modal)" }}
      >
        <h2 id={titleId} className="text-lg font-semibold text-[var(--g-text-primary)]">
          Confirmar aprobación
        </h2>
        <p id={descriptionId} className="mt-2 text-sm text-[var(--g-text-secondary)]">
          Registra los datos formales de la aprobación. Ambos campos quedarán asociados a
          esta versión de la plantilla.
        </p>

        <form className="mt-5 space-y-4" noValidate onSubmit={handleSubmit}>
          <div>
            <label
              htmlFor={approverId}
              className="block text-sm font-medium text-[var(--g-text-primary)]"
            >
              Aprobada por
            </label>
            <input
              ref={approverRef}
              id={approverId}
              type="text"
              value={aprobadaPor}
              required
              disabled={pending}
              autoComplete="name"
              aria-invalid={errors.aprobadaPor ? "true" : undefined}
              aria-describedby={errors.aprobadaPor ? approverErrorId : undefined}
              onChange={(event) => {
                setAprobadaPor(event.target.value);
                if (errors.aprobadaPor) {
                  setErrors((current) => ({ ...current, aprobadaPor: undefined }));
                }
              }}
              className="mt-1 min-h-11 w-full border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-[var(--g-border-focus)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--g-surface-card)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
            {errors.aprobadaPor ? (
              <p id={approverErrorId} role="alert" className="mt-1 text-sm text-[var(--status-error)]">
                {errors.aprobadaPor}
              </p>
            ) : null}
          </div>

          <div>
            <label
              htmlFor={dateId}
              className="block text-sm font-medium text-[var(--g-text-primary)]"
            >
              Fecha de aprobación
            </label>
            <input
              ref={dateRef}
              id={dateId}
              type="date"
              value={fechaAprobacion}
              max={latestApprovalDate}
              required
              disabled={pending}
              aria-invalid={errors.fechaAprobacion ? "true" : undefined}
              aria-describedby={errors.fechaAprobacion ? dateErrorId : undefined}
              onChange={(event) => {
                setFechaAprobacion(event.target.value);
                if (errors.fechaAprobacion) {
                  setErrors((current) => ({ ...current, fechaAprobacion: undefined }));
                }
              }}
              className="mt-1 min-h-11 w-full border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-[var(--g-border-focus)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--g-surface-card)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
            {errors.fechaAprobacion ? (
              <p id={dateErrorId} role="alert" className="mt-1 text-sm text-[var(--status-error)]">
                {errors.fechaAprobacion}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={pending}
              className="min-h-11 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-4 py-2 text-sm font-medium text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--g-surface-card)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              aria-busy={pending}
              className="min-h-11 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--g-surface-card)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              {pending ? "Aprobando…" : "Confirmar aprobación"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
