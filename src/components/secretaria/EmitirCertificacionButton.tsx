// src/components/secretaria/EmitirCertificacionButton.tsx
/**
 * F9.1 — Botón "Emitir certificación" respetando `capability_matrix`.
 *
 * Ejecuta el pipeline completo F8.1→F8.2 en tres pasos:
 *   1. `fn_generar_certificacion` — crea la cert con gate_hash.
 *   2. `fn_firmar_certificacion`  — QES stub (TSQ base64 determinista).
 *   3. `fn_emitir_certificacion`  — URI del bundle operativo demo.
 *
 * El botón se oculta si el usuario no tiene la capability CERTIFICATION
 * en `capability_matrix`. Para el demo, confiamos en el rol SECRETARIO
 * (que por seed tiene CERTIFICATION=true) en lugar de leer un `userRole`
 * real — la auth real se añadirá en un sprint futuro.
 *
 * En SA, precargamos `vb_persona_id` con el PRESIDENTE vigente mediante
 * `usePresidenteVigente`. Si no hay presidente disponible y la sociedad
 * es SA pero el certificante no es ADMIN_UNICO, la RPC fallará con un
 * mensaje claro: lo dejamos caer al usuario como toast.error — NO
 * intentamos "adivinar" el Vº Bº.
 *
 * Garrigues tokens estrictos: bg-[var(--g-brand-3308)] + hover sec-700,
 * radius-md, sin colores nativos Tailwind.
 */
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileSignature, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useHasCapability } from "@/hooks/useCapabilityMatrix";
import { usePresidenteVigente } from "@/hooks/useAuthorityEvidence";

export interface EmitirCertificacionButtonProps {
  minuteId: string;
  entityId: string | null;
  bodyId?: string | null;
  agreementIds: string[];
  /** Rol del certificante — por defecto SECRETARIO (el caso más común). */
  certificanteRole?:
    | "SECRETARIO"
    | "ADMIN_UNICO"
    | "ADMIN_SOLIDARIO"
    | "PRESIDENTE";
  /** Rol del usuario actual — por ahora hardcodeado SECRETARIO en demo. */
  userRole?: string;
  /** Cuando la certificación termina (o falla), el padre puede hookearse. */
  onEmitted?: (certId: string, uri: string) => void;
  disabledReason?: string | null;
}

export function EmitirCertificacionButton({
  minuteId,
  entityId,
  bodyId,
  agreementIds,
  certificanteRole = "SECRETARIO",
  userRole = "SECRETARIO", // demo default — auth real en sprint futuro
  onEmitted,
  disabledReason,
}: EmitirCertificacionButtonProps) {
  const queryClient = useQueryClient();
  const canCertify = useHasCapability(userRole, "CERTIFICATION");
  const { data: presidente } = usePresidenteVigente(entityId ?? undefined, bodyId);
  const [busy, setBusy] = useState(false);

  if (!canCertify) return null;
  if (!entityId) return null;
  const effectiveDisabledReason =
    disabledReason ?? (agreementIds.length === 0 ? "No hay acuerdos proclamables para certificar." : null);

  async function handleClick() {
    if (busy) return;
    if (disabledReason || agreementIds.length === 0) return;
    setBusy(true);
    try {
      // Paso 1 — fn_generar_certificacion
      const { data: certId, error: e1 } = await supabase.rpc(
        "fn_generar_certificacion",
        {
          p_minute_id: minuteId,
          p_tipo: "ACUERDO",
          p_agreements_certified: agreementIds,
          p_certificante_role: certificanteRole,
          p_visto_bueno_persona_id: presidente?.person_id ?? null,
        },
      );
      if (e1) throw new Error(`Generar: ${e1.message}`);
      const certificationId = String(certId);

      // Paso 2 — firma QES (stub determinista base64). El pipeline
      // productivo reemplaza este bloque con la llamada al QTSP EAD Trust.
      const qtspToken = btoa(`qtsp:demo:${certificationId}`);
      const tsqToken = btoa(`tsq:demo:${certificationId}:${new Date().toISOString()}`);
      const { error: e2 } = await supabase.rpc("fn_firmar_certificacion", {
        p_certification_id: certificationId,
        p_qtsp_token: qtspToken,
        p_tsq_token: tsqToken,
      });
      if (e2) throw new Error(`Firmar: ${e2.message}`);

      // Paso 3 — emitir (registra audit + URI bundle)
      const { data: uri, error: e3 } = await supabase.rpc(
        "fn_emitir_certificacion",
        { p_certification_id: certificationId },
      );
      if (e3) throw new Error(`Emitir: ${e3.message}`);

      toast.success(`Certificación emitida`, {
        description: `Referencia operativa demo creada (${String(uri)}). Pendiente de audit/retention/legal hold; no constituye evidencia final productiva.`,
      });
      queryClient.invalidateQueries({ queryKey: ["certifications"] });
      queryClient.invalidateQueries({ queryKey: ["certification_plan"] });
      onEmitted?.(certificationId, String(uri));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Error al emitir certificación", { description: msg });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex max-w-[320px] flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy || !!effectiveDisabledReason}
        aria-busy={busy}
        title={effectiveDisabledReason ?? undefined}
        className="inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] disabled:bg-[var(--g-surface-muted)] disabled:text-[var(--g-text-secondary)] disabled:opacity-100"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <FileSignature className="h-4 w-4" aria-hidden="true" />
        )}
        {busy ? "Emitiendo…" : "Emitir certificación"}
      </button>
      {effectiveDisabledReason ? (
        <p className="text-right text-xs leading-relaxed text-[var(--g-text-secondary)]">
          {effectiveDisabledReason}
        </p>
      ) : null}
    </div>
  );
}
