import { forwardRef } from "react";
import { toast } from "sonner";
import { FileCheck2 } from "lucide-react";
import { useAprobarActa } from "@/hooks/useActas";
import { useHasCapability } from "@/hooks/useCapabilityMatrix";

interface AprobarActaButtonProps {
  minuteId: string;
  /** Rol del usuario actual — mismo gate de capability que la certificación. */
  userRole?: string;
  /** El acta debe tener contenido generado para poder aprobarse (art. 202 LSC). */
  hasContent: boolean;
  onApproved?: () => void;
}

/**
 * Acción "Aprobar y firmar acta" (ITEM-003): escribe minutes.signed_at vía
 * fn_aprobar_acta y bloquea el acta (is_locked, inmutabilidad garantizada por
 * trg_minutes_lock_guard). Es el paso previo que exige el gate de
 * certificación de ActaDetalle (RRM arts. 108-109).
 */
export const AprobarActaButton = forwardRef<HTMLButtonElement, AprobarActaButtonProps>(
  function AprobarActaButton({ minuteId, userRole = "SECRETARIO", hasContent, onApproved }, ref) {
    const canApprove = useHasCapability(userRole, "CERTIFICATION");
    const aprobar = useAprobarActa(minuteId);

    if (!canApprove) return null;

    const disabledReason = !hasContent
      ? "El acta no tiene contenido: genera el documento del acta antes de aprobarla."
      : null;
    const disabled = !!disabledReason || aprobar.isPending;

    async function handleClick() {
      if (disabled) return;
      const confirmed = window.confirm(
        "Aprobar y firmar el acta la bloquea de forma permanente: el contenido y los firmantes no podrán modificarse después (art. 202 LSC). ¿Continuar?",
      );
      if (!confirmed) return;
      try {
        const result = await aprobar.mutateAsync();
        if (result?.already_signed) {
          toast.info("El acta ya estaba aprobada y firmada", {
            description: "No se ha modificado la fecha de firma original.",
          });
        } else {
          toast.success("Acta aprobada y firmada", {
            description:
              "El acta queda bloqueada (inmutable) y lista para emitir certificaciones.",
          });
        }
        onApproved?.();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error("No se pudo aprobar el acta", { description: msg });
      }
    }

    return (
      <button
        ref={ref}
        type="button"
        onClick={handleClick}
        disabled={disabled}
        aria-busy={aprobar.isPending}
        title={disabledReason ?? undefined}
        className="inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-3 py-1.5 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:cursor-not-allowed disabled:opacity-50"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        <FileCheck2 className="h-4 w-4" aria-hidden="true" />
        {aprobar.isPending ? "Aprobando…" : "Aprobar y firmar acta"}
      </button>
    );
  },
);
