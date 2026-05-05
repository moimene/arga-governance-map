import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FileSignature, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePresidenteVigente } from "@/hooks/useAuthorityEvidence";
import { useHasCapability } from "@/hooks/useCapabilityMatrix";
import { isMissingSupabaseRpcError } from "@/lib/secretaria/supabase-rpc-fallback";

export interface EmitirCertificacionAcuerdoButtonProps {
  agreementId: string;
  entityId: string | null;
  bodyId?: string | null;
  certificanteRole?: "SECRETARIO" | "ADMIN_UNICO" | "ADMIN_SOLIDARIO" | "PRESIDENTE";
  userRole?: string;
}

export function EmitirCertificacionAcuerdoButton({
  agreementId,
  entityId,
  bodyId,
  certificanteRole = "SECRETARIO",
  userRole,
}: EmitirCertificacionAcuerdoButtonProps) {
  const queryClient = useQueryClient();
  const canCertify = useHasCapability(userRole, "CERTIFICATION");
  const { data: presidente } = usePresidenteVigente(entityId ?? undefined, bodyId);
  const [busy, setBusy] = useState(false);

  if (!canCertify || !entityId) return null;

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    try {
      const { data: certId, error: generateError } = await supabase.rpc(
        "fn_generar_certificacion_acuerdo_sin_sesion",
        {
          p_agreement_id: agreementId,
          p_tipo: "NO_SESSION",
          p_certificante_role: certificanteRole,
          p_visto_bueno_persona_id: presidente?.person_id ?? null,
        },
      );
      if (generateError) {
        if (isMissingSupabaseRpcError(generateError)) {
          throw new Error("Requiere aplicar la migración P0 de certificación directa desde acuerdo sin sesión.");
        }
        throw new Error(`Generar: ${generateError.message}`);
      }
      const certificationId = String(certId);

      const qtspToken = btoa(`qtsp:demo:no-session:${certificationId}`);
      const tsqToken = btoa(`tsq:demo:no-session:${certificationId}:${new Date().toISOString()}`);
      const { error: signError } = await supabase.rpc("fn_firmar_certificacion", {
        p_certification_id: certificationId,
        p_qtsp_token: qtspToken,
        p_tsq_token: tsqToken,
      });
      if (signError) throw new Error(`Firmar: ${signError.message}`);

      const { data: uri, error: emitError } = await supabase.rpc("fn_emitir_certificacion", {
        p_certification_id: certificationId,
      });
      if (emitError) throw new Error(`Emitir: ${emitError.message}`);

      toast.success("Certificación emitida", {
        description: `Referencia operativa demo creada (${String(uri)}). Preparada para registro; no implica envío al Registro Mercantil.`,
      });
      queryClient.invalidateQueries({ queryKey: ["certifications"] });
      queryClient.invalidateQueries({ queryKey: ["agreements"] });
    } catch (e) {
      toast.error("Error al emitir certificación", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      aria-busy={busy}
      className="inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:opacity-60"
      style={{ borderRadius: "var(--g-radius-md)" }}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <FileSignature className="h-4 w-4" aria-hidden="true" />
      )}
      {busy ? "Emitiendo…" : "Emitir certificación"}
    </button>
  );
}
