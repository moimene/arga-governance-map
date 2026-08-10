// src/components/secretaria/EmitirCertificacionButton.tsx
/**
 * Acción progresiva de certificación autoritativa.
 *
 * Prepara el borrador únicamente desde un acta APPROVED_SIGNED y POSTED. La
 * emisión posterior exige el artefacto final inmutable y verificaciones EAD
 * Trust reales por interposición. No exige ni afirma un nivel de firma
 * electrónica y nunca fabrica tokens probatorios.
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
import { toast } from "sonner";
import { FileSignature, Loader2, AlertTriangle } from "lucide-react";
import { useHasCapability } from "@/hooks/useCapabilityMatrix";
import {
  useAuthoritativeLegalEvidence,
  useEmitirCertificacionAutoritativa,
  useFirmarCertificacionAutoritativa,
  useGenerateAuthoritativeCertification,
  type CertificationRow,
} from "@/hooks/useActas";
import {
  useAuthorityEvidence,
  usePresidenteVigente,
  CARGO_CERT_LABELS,
  type AuthorityEvidenceDetailRow,
} from "@/hooks/useAuthorityEvidence";
import { useCertificationAnnexGate } from "@/hooks/useSecretariaDocumentArtifacts";
import { isUuidReference } from "@/lib/secretaria/certification-registry-intake";
import { secretariaErrorMessage } from "@/lib/secretaria/supabase-error-message";
import {
  certificationLegalGateLabel,
  resolveCertificationSourceGate,
  verifiedSigner,
  type MinuteLegalGateStatus,
} from "@/lib/secretaria/authoritative-legal-state";

export interface EmitirCertificacionButtonProps {
  minuteId: string;
  entityId: string | null;
  bodyId?: string | null;
  agreementIds: string[];
  certifications: CertificationRow[];
  minuteLegalGateStatus: MinuteLegalGateStatus;
  bookDestinationStatus?: string | null;
  minuteApprovalEvidenceMode?: string | null;
  minuteApprovalSignatureClaim?: boolean | null;
  minuteApprovalCanonicalStatus?: string | null;
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
  certifiedAgreementsText: string;
  /** Circunstancias de aprobación del acta exigibles en la certificación. */
  actaApprovalMethod: string;
  actaApprovalDateISO: string;
  /** Fecha societaria de emisión; nunca se sustituye por la fecha técnica del sistema. */
  legalEmissionDateISO: string;
  /** Cuando la certificación termina (o falla), el padre puede hookearse. */
  onEmitted?: (certId: string, uri: string) => void;
  disabledReason?: string | null;
}

export function EmitirCertificacionButton({
  minuteId,
  entityId,
  bodyId,
  agreementIds,
  certifications,
  minuteLegalGateStatus,
  bookDestinationStatus,
  minuteApprovalEvidenceMode,
  minuteApprovalSignatureClaim,
  minuteApprovalCanonicalStatus,
  certificanteRole = "SECRETARIO",
  userRole = "SECRETARIO", // demo default — auth real en sprint futuro
  certifiedAgreementsText,
  onEmitted,
  disabledReason,
}: EmitirCertificacionButtonProps) {
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
  const agreementSetKey = useMemo(
    () => [...validAgreementRefs].sort().join("|"),
    [validAgreementRefs],
  );
  const activeCertification = useMemo(
    () =>
      certifications.find(
        (certification) =>
          [...(certification.agreements_certified ?? [])].sort().join("|") ===
          agreementSetKey,
      ) ?? null,
    [agreementSetKey, certifications],
  );
  const certificationEvidence = useAuthoritativeLegalEvidence(
    "CERTIFICATION",
    activeCertification?.id,
    activeCertification?.final_legal_artifact_id,
  );
  const generateCertification = useGenerateAuthoritativeCertification(minuteId);
  const signCertification = useFirmarCertificacionAutoritativa(
    minuteId,
    activeCertification?.id,
  );
  const emitCertification = useEmitirCertificacionAutoritativa(
    minuteId,
    activeCertification?.id,
  );

  // L23: dual check de RM solo aplica cuando el flujo es de Secretario
  // (SA + VºBº). Para ADMIN_UNICO/ADMIN_SOLIDARIO la certificación es propia,
  // sin visto bueno de presidente.
  const flujoConVistoBueno = certificanteRole === "SECRETARIO";
  // RRM art. 109 + art. 31.3 Estatutos (Garrigues): el administrador único o
  // solidario certifica por sí mismo sin Vº Bº. Sin este guard, un PRESIDENTE
  // vigente de la sociedad (p. ej. una SA con presidente y secretario) se
  // colaba como vistoBuenoPersonaId vía el fallback de abajo y la RPC
  // rechazaba con RAISE ("unexpected approval person for non-secretary
  // certifier").
  const esAdminUnico =
    certificanteRole === "ADMIN_UNICO" || certificanteRole === "ADMIN_SOLIDARIO";

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
  const sourceGate = resolveCertificationSourceGate({
    minuteLegalGateStatus,
    bookDestinationStatus,
    approvalEvidenceMode: minuteApprovalEvidenceMode,
    approvalSignatureClaim: minuteApprovalSignatureClaim,
    approvalCanonicalStatus: minuteApprovalCanonicalStatus,
  });
  const certificationStatus = activeCertification?.legal_gate_status ?? null;
  const certifierVerification = verifiedSigner(
    certificationEvidence.data?.verifications ?? [],
    "CERTIFICANTE",
  );
  const vistoBuenoVerification = verifiedSigner(
    certificationEvidence.data?.verifications ?? [],
    "VISTO_BUENO",
  );
  const authoritativeStageReason = (() => {
    if (!activeCertification) return null;
    if (certificationStatus === "DEMO_SIMULATION") {
      return "La certificación es una simulación demo y no puede emitirse con efecto jurídico.";
    }
    if (certificationStatus === "LEGACY_REVIEW") {
      return "La certificación legacy requiere remediación probatoria antes de emitirse.";
    }
    if (certificationStatus === "EMITTED") {
      return "La certificación ya ha sido emitida con evidencia EAD verificada.";
    }
    if (certificationStatus === "DRAFT" && activeCertification.content) {
      return "Genere el candidato DOCX, solicite la interposición EAD, recupere el output y e-archive ese resultado antes de registrar el artefacto final.";
    }
    if (certificationStatus === "ARTIFACT_FINAL") {
      if (certificationEvidence.isLoading) {
        return "Comprobando el artefacto final y las constancias de EAD Trust.";
      }
      if (certificationEvidence.error) {
        return secretariaErrorMessage(
          certificationEvidence.error,
          "No se pudo comprobar la evidencia EAD de la certificación.",
        );
      }
      if (
        !certificationEvidence.data?.artifact ||
        certificationEvidence.data.artifact.id !== activeCertification.final_legal_artifact_id ||
        certificationEvidence.data.artifact.artifact_status !== "FINAL_IMMUTABLE" ||
        certificationEvidence.data.artifact.source_domain !== "CERTIFICATION" ||
        certificationEvidence.data.artifact.artifact_kind !== "CERTIFICATION_FINAL" ||
        certificationEvidence.data.artifact.evidence_mode !== "INTERPOSITION_CUSTODY" ||
        certificationEvidence.data.artifact.signature_packaging !== null
      ) {
        return "La certificación no está vinculada a su artefacto final inmutable.";
      }
      if (!certifierVerification) {
        return "Falta la constancia individual EAD Trust de la persona certificante.";
      }
      if (flujoConVistoBueno && !vistoBuenoVerification) {
        return "Falta la constancia individual EAD Trust del visto bueno de Presidencia.";
      }
      if (
        flujoConVistoBueno &&
        certifierVerification &&
        vistoBuenoVerification &&
        (certifierVerification.signer_person_id === vistoBuenoVerification.signer_person_id ||
          certifierVerification.provider_reference === vistoBuenoVerification.provider_reference)
      ) {
        return "La persona certificante y el visto bueno necesitan evidencias EAD individuales y diferenciadas.";
      }
    }
    return null;
  })();
  const effectiveDisabledReason =
    disabledReason ??
    (!sourceGate.ready
      ? sourceGate.reason
      : invalidAgreementRefs.length > 0
      ? "La certificación contiene referencias por punto sin Acuerdo 360 materializado."
      : agreementIds.length === 0
        ? "No hay acuerdos proclamables para certificar."
        : !certifiedAgreementsText.trim()
          ? "Falta la transcripción íntegra de los acuerdos que se pretenden certificar."
          : annexGateReason ?? authoritativeStageReason);

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

      if (!activeCertification || certificationStatus === "DRAFT") {
        const certificationId = activeCertification?.id ??
          await generateCertification.mutateAsync({
            tipo: "ACUERDO",
            agreementIds: validAgreementRefs,
            certificanteRole: effectiveCertificanteRole,
            vistoBuenoPersonaId: esAdminUnico
              ? null
              : vistoBuenoAE?.person_id ?? presidenteAE?.person_id ?? null,
          });
        toast.success("Borrador de certificación preparado", {
          description:
            "El cuerpo canónico ha sido compuesto en servidor. Genere el candidato DOCX; el artefacto final solo podrá registrarse después de recuperar y e-archivar el output de la interposición EAD.",
        });
        return;
      }

      if (certificationStatus === "ARTIFACT_FINAL") {
        const artifact = certificationEvidence.data?.artifact;
        if (!artifact || !certifierVerification) {
          throw new Error("Falta el artefacto final o la constancia EAD de la persona certificante.");
        }
        await signCertification.mutateAsync({
          finalLegalArtifactId: artifact.id,
          certifierVerificationId: certifierVerification.id,
          vistoBuenoVerificationId: vistoBuenoVerification?.id ?? null,
        });
      }

      if (
        certificationStatus !== "ARTIFACT_FINAL" &&
        certificationStatus !== "INTERPOSITION_VERIFIED"
      ) {
        throw new Error(
          `La certificación no está lista para emisión (${certificationStatus ?? "sin estado"}).`,
        );
      }
      const uri = await emitCertification.mutateAsync();

      toast.success("Certificación emitida con evidencia EAD verificada", {
        description: `Referencia probatoria ${uri}`,
      });
      onEmitted?.(activeCertification.id, uri);
    } catch (e) {
      const msg = secretariaErrorMessage(e, "No se pudo emitir la certificación.");
      toast.error("Error al emitir certificación", { description: msg });
    } finally {
      setBusy(false);
    }
  }

  const isDisabled =
    busy ||
    generateCertification.isPending ||
    signCertification.isPending ||
    emitCertification.isPending ||
    !!effectiveDisabledReason ||
    bloqueaRM;
  const buttonLabel = !activeCertification
    ? "Preparar certificación"
    : certificationStatus === "INTERPOSITION_VERIFIED"
      ? "Emitir certificación"
      : certificationStatus === "ARTIFACT_FINAL"
        ? "Validar evidencia y emitir"
        : certificationStatus === "EMITTED"
          ? "Certificación emitida"
          : "Pendiente de artefacto final";

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
      {activeCertification?.legal_gate_status ? (
        <p className="w-full text-right text-xs text-[var(--g-text-secondary)]">
          Estado jurídico: {certificationLegalGateLabel(activeCertification.legal_gate_status)}
          {activeCertification.verified_ead_signature_type
            ? " · intervención EAD verificada"
            : ""}
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
        {busy ? "Procesando…" : buttonLabel}
      </button>
      {effectiveDisabledReason ? (
        <p className="text-right text-xs leading-relaxed text-[var(--g-text-secondary)]">
          {effectiveDisabledReason}
        </p>
      ) : null}
    </div>
  );
}
