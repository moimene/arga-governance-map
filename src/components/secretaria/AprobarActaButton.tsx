import { forwardRef, useState } from "react";
import { toast } from "sonner";
import { FileCheck2 } from "lucide-react";
import { useAprobarActa, useAuthoritativeLegalEvidence } from "@/hooks/useActas";
import { useHasCapability } from "@/hooks/useCapabilityMatrix";
import { secretariaErrorMessage } from "@/lib/secretaria/supabase-error-message";
import {
  resolveMinuteApprovalGate,
  verifiedSigner,
  type MinuteApprovalMethod,
  type MinuteLegalGateStatus,
} from "@/lib/secretaria/authoritative-legal-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface AprobarActaButtonProps {
  minuteId: string;
  /** Rol del usuario actual — mismo gate de capability que la certificación. */
  userRole?: string;
  /** El acta debe tener contenido generado para poder aprobarse (art. 202 LSC). */
  hasContent: boolean;
  legalGateStatus: MinuteLegalGateStatus;
  finalLegalArtifactId?: string | null;
  bookDestinationStatus?: string | null;
  disabledReason?: string | null;
  onApproved?: () => void | Promise<void>;
}

/**
 * Aprueba el acta únicamente cuando el servidor ya ha vinculado el artefacto
 * final inmutable y ha registrado dos consentimientos individuales verificados
 * por EAD Trust. El producto solicita únicamente interposición; no exige ni
 * afirma un nivel de firma electrónica. Este componente no fabrica tokens ni
 * infiere fuerza jurídica desde la UI.
 */
export const AprobarActaButton = forwardRef<HTMLButtonElement, AprobarActaButtonProps>(
  function AprobarActaButton({
    minuteId,
    userRole = "SECRETARIO",
    hasContent,
    legalGateStatus,
    finalLegalArtifactId,
    bookDestinationStatus,
    disabledReason,
    onApproved,
  }, ref) {
    const canApprove = useHasCapability(userRole, "CERTIFICATION");
    const aprobar = useAprobarActa(minuteId);
    const evidence = useAuthoritativeLegalEvidence(
      "MINUTE",
      minuteId,
      finalLegalArtifactId,
    );
    const [approvalMethod, setApprovalMethod] =
      useState<MinuteApprovalMethod>("DENTRO_15_DIAS");
    const [approvalEffectiveAt, setApprovalEffectiveAt] = useState(() => {
      const now = new Date();
      const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
      return localNow.toISOString().slice(0, 16);
    });

    if (!canApprove) return null;

    const approvalGate = resolveMinuteApprovalGate({
      legalGateStatus,
      finalLegalArtifactId,
      bookDestinationStatus,
      evidence: evidence.data ?? { artifact: null, verifications: [] },
    });
    const effectiveDisabledReason = disabledReason ?? (!hasContent
      ? "El acta no tiene contenido: genera y revisa el acta antes de aprobarla."
      : evidence.isLoading
        ? "Comprobando artefacto final y verificaciones de EAD Trust."
        : evidence.error
          ? secretariaErrorMessage(
              evidence.error,
              "No se pudo comprobar la evidencia autoritativa del acta.",
            )
          : approvalGate.reason);
    const disabled = !!effectiveDisabledReason || aprobar.isPending;

    async function handleConfirm() {
      if (disabled) return;
      try {
        const artifact = evidence.data?.artifact;
        const president = verifiedSigner(evidence.data?.verifications ?? [], "PRESIDENTE");
        const secretary = verifiedSigner(evidence.data?.verifications ?? [], "SECRETARIO");
        if (!artifact || !president || !secretary) {
          throw new Error("Falta el artefacto final o una de las verificaciones EAD exigidas.");
        }
        const effectiveDate = new Date(approvalEffectiveAt);
        if (Number.isNaN(effectiveDate.getTime())) {
          throw new Error("Indique una fecha y hora de aprobación válidas.");
        }
        const result = await aprobar.mutateAsync({
          finalLegalArtifactId: artifact.id,
          approvalMethod,
          approvalEffectiveAt: effectiveDate.toISOString(),
          presidentConsentVerificationId: president.id,
          secretaryConsentVerificationId: secretary.id,
        });
        if (result?.already_evidenced) {
          toast.info("El acta ya estaba aprobada con la misma evidencia", {
            description: "No se ha alterado el artefacto ni la fecha efectiva original.",
          });
        } else {
          toast.success("Acta aprobada con evidencia EAD verificada", {
            description:
              "El artefacto queda bloqueado y ya puede practicarse el asiento idempotente en el libro.",
          });
        }
        await onApproved?.();
      } catch (e) {
        const msg = secretariaErrorMessage(e, "No se pudo aprobar el acta.");
        toast.error("No se pudo aprobar el acta", { description: msg });
      }
    }

    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            ref={ref}
            type="button"
            disabled={disabled}
            aria-busy={aprobar.isPending}
            title={effectiveDisabledReason ?? undefined}
            className="inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-3 py-1.5 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:cursor-not-allowed disabled:opacity-50"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <FileCheck2 className="h-4 w-4" aria-hidden="true" />
            {aprobar.isPending ? "Aprobando…" : "Aprobar con evidencia EAD"}
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent className="border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)]">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar aprobación autoritativa</AlertDialogTitle>
            <AlertDialogDescription className="text-[var(--g-text-secondary)]">
              La aprobación vincula de forma permanente el artefacto final, los
              consentimientos individuales verificados por EAD Trust y la fecha
              efectiva. El contenido no podrá modificarse después.
            </AlertDialogDescription>
            <div className="grid gap-4 pt-2 text-sm">
              <label className="grid gap-1.5 text-[var(--g-text-primary)]">
                Sistema de aprobación del acta
                <select
                  value={approvalMethod}
                  onChange={(event) =>
                    setApprovalMethod(event.target.value as MinuteApprovalMethod)
                  }
                  className="h-10 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-3 text-[var(--g-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <option value="DENTRO_15_DIAS">Dentro de los quince días siguientes</option>
                  <option value="AL_FINAL_SESION">Al final de la sesión</option>
                  <option value="POR_ACTA_NOTARIAL">Por acta notarial</option>
                </select>
              </label>
              <label className="grid gap-1.5 text-[var(--g-text-primary)]">
                Fecha y hora efectiva de aprobación
                <input
                  type="datetime-local"
                  value={approvalEffectiveAt}
                  onChange={(event) => setApprovalEffectiveAt(event.target.value)}
                  className="h-10 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-3 text-[var(--g-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </label>
              <p className="text-xs text-[var(--g-text-secondary)]">
                EAD Trust interviene y conserva la prueba del proceso. No se
                atribuye un nivel de firma electrónica; Presidencia y Secretaría
                se comprueban por separado.
              </p>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[var(--g-border-subtle)] bg-transparent text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] hover:text-[var(--g-text-primary)]">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleConfirm()}
              className="bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)]"
            >
              Aprobar y bloquear definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  },
);
