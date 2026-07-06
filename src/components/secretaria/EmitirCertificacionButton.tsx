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
 * D5.5 (L23 + RRM art. 109): doble verificación de referencia de
 * inscripción registral antes de habilitar la emisión cuando el flujo
 * es de Secretario (SA con Vº Bº). Si falta `inscripcion_rm_referencia`
 * en cualquiera de los dos cargos (Secretario certificante o Presidente
 * VºBº), bloqueamos el botón y mostramos un alert role="alert" que
 * identifica con precisión cuál falla. Para ADMIN_UNICO / ADMIN_SOLIDARIO
 * no aplica este chequeo — esos roles certifican sin VºBº.
 *
 * Garrigues tokens estrictos: bg-[var(--g-brand-3308)] + hover sec-700,
 * radius-md, sin colores nativos Tailwind. Estados error usan
 * `--status-error`.
 */
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileSignature, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import { useHasCapability } from "@/hooks/useCapabilityMatrix";
import {
  useAuthorityEvidence,
  usePresidenteVigente,
  CARGO_CERT_LABELS,
  type AuthorityEvidenceDetailRow,
} from "@/hooks/useAuthorityEvidence";
import { useCertificationAnnexGate } from "@/hooks/useSecretariaDocumentArtifacts";
import { isUuidReference } from "@/lib/secretaria/certification-registry-intake";
import { buildCertificacionBody } from "@/lib/secretaria/certificacion-body";

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
  /** Nombres para componer el cuerpo canónico de la certificación (W0 #4). */
  entidadNombre?: string | null;
  organoNombre?: string | null;
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
  entidadNombre,
  organoNombre,
  onEmitted,
  disabledReason,
}: EmitirCertificacionButtonProps) {
  const queryClient = useQueryClient();
  const { tenantId } = useTenantContext();
  const canCertify = useHasCapability(userRole, "CERTIFICATION");
  const { data: presidenteAE } = usePresidenteVigente(entityId ?? undefined, bodyId);
  // Para el dual check necesitamos resolver:
  //  - certificante: SECRETARIO o VICESECRETARIO con `body_id` coincidente.
  //  - visto bueno: PRESIDENTE o VICEPRESIDENTE con `body_id` coincidente.
  // `useAuthorityEvidence` devuelve TODAS las AE VIGENTE para la sociedad;
  // filtramos client-side por cargo + body_id. El presidente se solapa con
  // `presidenteAE` cuando existe — el orden de preferencia es:
  // PRESIDENTE > VICEPRESIDENTE para VºBº y SECRETARIO > VICESECRETARIO
  // para certificante.
  const { data: authorityList } = useAuthorityEvidence(entityId ?? undefined);
  const [busy, setBusy] = useState(false);
  const validAgreementRefs = useMemo(
    () => agreementIds.filter((agreementId) => isUuidReference(agreementId)),
    [agreementIds],
  );
  const {
    data: certificationRequirements = [],
    isLoading: annexGateLoading,
    error: annexGateError,
  } = useCertificationAnnexGate(validAgreementRefs);

  // L23: dual check de RM solo aplica cuando el flujo es de Secretario
  // (SA + VºBº). Para ADMIN_UNICO/ADMIN_SOLIDARIO la certificación es propia,
  // sin co-firma de presidente.
  const flujoConVistoBueno = certificanteRole === "SECRETARIO";

  const certificanteAE = useMemo<AuthorityEvidenceDetailRow | null>(() => {
    if (!flujoConVistoBueno) return null;
    if (!authorityList) return null;
    const matchBody = (ae: AuthorityEvidenceDetailRow) =>
      bodyId ? ae.body_id === bodyId : ae.body_id === null;
    const titular = authorityList.find(
      (ae) => ae.cargo === "SECRETARIO" && matchBody(ae),
    );
    if (titular) return titular;
    const vice = authorityList.find(
      (ae) => ae.cargo === "VICESECRETARIO" && matchBody(ae),
    );
    return vice ?? null;
  }, [authorityList, bodyId, flujoConVistoBueno]);

  const vistoBuenoAE = useMemo<AuthorityEvidenceDetailRow | null>(() => {
    if (!flujoConVistoBueno) return null;
    if (presidenteAE) return presidenteAE;
    if (!authorityList) return null;
    const matchBody = (ae: AuthorityEvidenceDetailRow) =>
      bodyId ? ae.body_id === bodyId : ae.body_id === null;
    const vice = authorityList.find(
      (ae) => ae.cargo === "VICEPRESIDENTE" && matchBody(ae),
    );
    return vice ?? null;
  }, [authorityList, bodyId, flujoConVistoBueno, presidenteAE]);

  // Resultados del dual check.
  const certificanteFaltante = flujoConVistoBueno && !certificanteAE;
  const vistoBuenoFaltante = flujoConVistoBueno && !vistoBuenoAE;
  const certificanteFaltaRM =
    flujoConVistoBueno && !!certificanteAE && !certificanteAE.inscripcion_rm_referencia;
  const vistoBuenoFaltaRM =
    flujoConVistoBueno && !!vistoBuenoAE && !vistoBuenoAE.inscripcion_rm_referencia;
  const bloqueaRM =
    certificanteFaltante ||
    vistoBuenoFaltante ||
    certificanteFaltaRM ||
    vistoBuenoFaltaRM;

  if (!canCertify) return null;
  if (!entityId) return null;
  const invalidAgreementRefs = agreementIds.filter((agreementId) => !isUuidReference(agreementId));
  const blockingAnnexRequirements = certificationRequirements.filter(
    (requirement) =>
      requirement.status !== "SATISFIED" &&
      requirement.status !== "WAIVED_WITH_OVERRIDE" &&
      requirement.status !== "NOT_APPLICABLE" &&
      requirement.blocking_policy === "BLOCKING" &&
      (requirement.fase === "CERTIFICACION" || requirement.annex_targets?.includes("CERTIFICACION")),
  );
  const annexGateReason = annexGateLoading
    ? "Comprobando anexos documentales obligatorios."
    : blockingAnnexRequirements.length > 0
      ? `Faltan ${blockingAnnexRequirements.length} anexo(s) documental(es) bloqueante(s) para certificar.`
      : null;
  const effectiveDisabledReason =
    disabledReason ??
    (invalidAgreementRefs.length > 0
      ? "La certificación contiene referencias por punto sin Acuerdo 360 materializado."
      : agreementIds.length === 0
        ? "No hay acuerdos proclamables para certificar."
        : annexGateReason);

  async function handleClick() {
    if (busy) return;
    if (effectiveDisabledReason) return;
    if (bloqueaRM) return;
    setBusy(true);
    try {
      // P2 Codex iter-3 (commit 49ba53b): si el AE encontrado es VICESECRETARIO
      // (fallback porque no hay SECRETARIO vigente), pasamos su cargo real al
      // RPC, no el certificanteRole default ("SECRETARIO"). Sin esto,
      // fn_generar_certificacion busca AE por SECRETARIO y falla con
      // "No hay autoridad vigente para SECRETARIO" o registra rol incorrecto.
      // L17 coherence: el vicesecretario certifica en suplencia (RRM art. 109
      // + LSC 529 octies), debe identificarse correctamente en el RPC.
      const effectiveCertificanteRole = certificanteAE?.cargo ?? certificanteRole;

      // Paso 1 — fn_generar_certificacion
      const { data: certId, error: e1 } = await supabase.rpc(
        "fn_generar_certificacion",
        {
          p_minute_id: minuteId,
          p_tipo: "ACUERDO",
          p_agreements_certified: agreementIds,
          p_certificante_role: effectiveCertificanteRole,
          p_visto_bueno_persona_id: vistoBuenoAE?.person_id ?? presidenteAE?.person_id ?? null,
        },
      );
      if (e1) throw new Error(`Generar: ${e1.message}`);
      const certificationId = String(certId);

      // W0 #4 — persistir el cuerpo canónico de la certificación (hasta ahora
      // `content` quedaba NULL). DEBE ir antes de firmar: fn_firmar_certificacion
      // computa hash_certificacion = SHA-256(gate_hash ‖ content ‖ tsq_token),
      // así que el contenido tiene que estar presente para que el hash lo cubra.
      const certBody = buildCertificacionBody({
        certificanteCargoLabel:
          CARGO_CERT_LABELS[effectiveCertificanteRole as keyof typeof CARGO_CERT_LABELS] ??
          effectiveCertificanteRole,
        certificanteNombre: certificanteAE?.person?.full_name ?? null,
        vistoBuenoCargoLabel: vistoBuenoAE ? CARGO_CERT_LABELS[vistoBuenoAE.cargo] : null,
        vistoBuenoNombre:
          vistoBuenoAE?.person?.full_name ?? presidenteAE?.person?.full_name ?? null,
        entidadNombre: entidadNombre ?? "la sociedad",
        organoNombre: organoNombre ?? null,
        numAcuerdos: agreementIds.length,
        fechaISO: new Date().toISOString(),
      });
      const { error: eContent } = await supabase
        .from("certifications")
        .update({ content: certBody })
        .eq("id", certificationId)
        .eq("tenant_id", tenantId ?? "");
      if (eContent) throw new Error(`Cuerpo certificación: ${eContent.message}`);

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
      queryClient.invalidateQueries({ queryKey: ["certifications", tenantId, "byMinute", minuteId] });
      queryClient.invalidateQueries({ queryKey: ["certification_plan", tenantId, "forMinute", minuteId] });
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

  const isDisabled = busy || !!effectiveDisabledReason || bloqueaRM;

  return (
    <div className="flex max-w-[360px] flex-col items-end gap-2">
      {bloqueaRM && (
        <div
          role="alert"
          aria-live="polite"
          className="w-full border border-[var(--status-error)]/40 bg-[var(--status-error)]/10 p-3 text-xs text-[var(--g-text-primary)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--status-error)]"
              aria-hidden="true"
            />
            <div className="flex-1">
              <p className="font-semibold">No se puede emitir certificación</p>
              <ul className="mt-1 list-disc pl-4 text-[var(--g-text-secondary)]">
                {certificanteFaltante && (
                  <li>
                    No hay <strong>Secretario/Vicesecretario vigente</strong> asignado al órgano.
                    Designa el cargo antes de emitir (RRM art. 109).
                  </li>
                )}
                {certificanteFaltaRM && certificanteAE && (
                  <li>
                    El cargo certificante{" "}
                    <strong>{CARGO_CERT_LABELS[certificanteAE.cargo]}</strong> no tiene referencia
                    de inscripción registral (RRM art. 109).
                  </li>
                )}
                {vistoBuenoFaltante && (
                  <li>
                    No hay <strong>Presidente/Vicepresidente vigente</strong> para el Vº Bº.
                    Designa el cargo antes de emitir.
                  </li>
                )}
                {vistoBuenoFaltaRM && vistoBuenoAE && (
                  <li>
                    El cargo de Vº Bº <strong>{CARGO_CERT_LABELS[vistoBuenoAE.cargo]}</strong> no
                    tiene referencia de inscripción registral.
                  </li>
                )}
              </ul>
              <p className="mt-2 text-[var(--g-text-primary)]">
                Completa la referencia RM en la ficha del cargo y vuelve a intentarlo.
              </p>
            </div>
          </div>
        </div>
      )}
      {blockingAnnexRequirements.length > 0 ? (
        <div
          role="alert"
          aria-live="polite"
          className="w-full border border-[var(--status-error)]/40 bg-[var(--status-error)]/10 p-3 text-xs text-[var(--g-text-primary)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--status-error)]" aria-hidden="true" />
            <div>
              <p className="font-semibold">Anexos obligatorios pendientes</p>
              <ul className="mt-1 list-disc pl-4 text-[var(--g-text-secondary)]">
                {blockingAnnexRequirements.slice(0, 4).map((requirement) => (
                  <li key={requirement.id}>{requirement.title}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
      {annexGateError ? (
        <p className="w-full text-right text-xs leading-relaxed text-[var(--status-warning)]">
          No se pudo comprobar la matriz de anexos; aplica la migración documental para activar este gate.
        </p>
      ) : null}
      <button
        type="button"
        onClick={handleClick}
        disabled={isDisabled}
        aria-busy={busy}
        title={effectiveDisabledReason ?? (bloqueaRM ? "Faltan datos registrales" : undefined)}
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
