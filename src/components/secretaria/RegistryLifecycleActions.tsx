import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  useRecordRegistryInscription,
  useRecordRegistryPresentation,
  useRecordRegistryPublication,
  useRecordRegistryQualification,
  useSubmitRegistryRemedy,
} from "@/hooks/useRegistryLifecycle";
import { useUploadRegistryEvidenceArtifact } from "@/hooks/useRegistryEvidenceUpload";
import { useSecretariaDocumentArtifacts } from "@/hooks/useSecretariaDocumentArtifacts";
import {
  isRegistryTerminal,
  registryTerminal,
  type RegistryQualificationOutcome,
} from "@/lib/secretaria/registry-lifecycle";

interface RegistryLifecycleActionsProps {
  filingId: string;
  entityId: string;
  status: string;
  filingVia?: string | null;
  qualificationOutcome?: string | null;
  procedureProfileCode?: string | null;
}

const inputClass = "w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]";
const primaryButton = "inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] disabled:bg-[var(--g-surface-muted)] disabled:text-[var(--g-text-secondary)] disabled:opacity-100";

function nowIso() {
  return new Date().toISOString();
}

export function RegistryLifecycleActions({
  filingId,
  entityId,
  status,
  filingVia,
  qualificationOutcome,
  procedureProfileCode,
}: RegistryLifecycleActionsProps) {
  // El deposito de cuentas y la legalizacion de libros no causan inscripcion:
  // el rotulo y el terminal los decide la via, igual que en el servidor.
  const terminal = registryTerminal(procedureProfileCode);
  const terminalNounCap = terminal.noun.charAt(0).toUpperCase() + terminal.noun.slice(1);
  const uploadEvidence = useUploadRegistryEvidenceArtifact();
  const recordPresentation = useRecordRegistryPresentation();
  const recordQualification = useRecordRegistryQualification();
  const submitRemedy = useSubmitRegistryRemedy();
  const recordInscription = useRecordRegistryInscription();
  const recordPublication = useRecordRegistryPublication();
  const artifacts = useSecretariaDocumentArtifacts({ entityId });

  const [filingNumber, setFilingNumber] = useState("");
  const [presentationDate, setPresentationDate] = useState("");
  const [presentationFile, setPresentationFile] = useState<File | null>(null);
  const [presentationArtifactId, setPresentationArtifactId] = useState<string | null>(null);
  const [qualification, setQualification] = useState<RegistryQualificationOutcome>("POSITIVA");
  const [qualificationDate, setQualificationDate] = useState("");
  const [qualificationGrounds, setQualificationGrounds] = useState("");
  const [qualificationFile, setQualificationFile] = useState<File | null>(null);
  const [qualificationArtifactId, setQualificationArtifactId] = useState<string | null>(null);
  const [remedyDescription, setRemedyDescription] = useState("");
  const [remedyFile, setRemedyFile] = useState<File | null>(null);
  const [remedyArtifactId, setRemedyArtifactId] = useState<string | null>(null);
  const [inscriptionNumber, setInscriptionNumber] = useState("");
  const [inscriptionDate, setInscriptionDate] = useState("");
  const [inscriptionArtifactId, setInscriptionArtifactId] = useState("");
  const [publicationReference, setPublicationReference] = useState("");
  const [publicationDate, setPublicationDate] = useState("");
  const [publicationArtifactId, setPublicationArtifactId] = useState("");

  const presentationOperation = useRef(crypto.randomUUID());
  const presentationEffectiveAt = useRef(nowIso());
  const qualificationOperation = useRef(crypto.randomUUID());
  const remedyOperation = useRef(crypto.randomUUID());
  const remedyEffectiveAt = useRef(nowIso());
  const inscriptionOperation = useRef(crypto.randomUUID());
  const publicationOperation = useRef(crypto.randomUUID());

  const verifiedArtifacts = (artifacts.data ?? []).filter((artifact) =>
    artifact.evidence_status === "EVIDENCE_VERIFIED" &&
    ["APPROVED", "SIGNED", "ARCHIVED", "ATTACHED"].includes(artifact.status) &&
    Boolean(artifact.document_url) &&
    Boolean(artifact.hash_sha512 ?? artifact.content_hash ?? artifact.source_hash)
  );
  // El terminal registral exige, en cliente y en servidor
  // (fn_registry_record_inscription, p_require_verified), un artefacto con
  // `evidence_status = 'EVIDENCE_VERIFIED'`. Hoy NINGÚN RPC, hook ni Edge
  // Function escribe ese valor: los hooks crean artefactos en DEMO_OPERATIVA y
  // en Cloud solo existen DEMO_OPERATIVA y EVIDENCE_OPEN (medido 2026-09-05).
  // Es decir, el terminal es inalcanzable desde la aplicación. Mientras el
  // camino de escritura no exista, la UI explica el bloqueo en vez de ofrecer
  // un formulario que no puede completarse.
  const sinEvidenciaVerificada = !artifacts.isLoading && verifiedArtifacts.length === 0;

  async function uploadForRole(
    file: File,
    role: "PRESENTATION_RECEIPT" | "QUALIFICATION_NOTICE" | "REMEDY_SUBMISSION",
    kind: "ANEXO_EXTERNO" | "SUBSANACION_REGISTRAL",
  ) {
    return uploadEvidence.mutateAsync({
      file,
      entityId,
      title: role === "PRESENTATION_RECEIPT"
        ? "Justificante de presentación registral"
        : role === "QUALIFICATION_NOTICE"
          ? "Nota de calificación registral"
          : "Documento de subsanación registral",
      artifactKind: kind,
      sourceDomain: "registry_filing",
      sourceId: filingId,
      metadata: { registry_evidence_role: role },
    });
  }

  async function handlePresentation() {
    try {
      let artifactId = presentationArtifactId;
      if (!artifactId && presentationFile) {
        const artifact = await uploadForRole(presentationFile, "PRESENTATION_RECEIPT", "ANEXO_EXTERNO");
        artifactId = artifact.id;
        setPresentationArtifactId(artifact.id);
      }
      if (!artifactId) throw new Error("Adjunte el justificante de presentación.");
      await recordPresentation.mutateAsync({
        filingId,
        operationId: presentationOperation.current,
        filingNumber: filingNumber.trim(),
        presentationDate,
        filingVia: filingVia ?? "",
        evidenceArtifactId: artifactId,
        effectiveAt: presentationEffectiveAt.current,
      });
      toast.success("Presentación registrada con evidencia.");
    } catch (error) {
      toast.error("No se pudo registrar la presentación", { description: error instanceof Error ? error.message : String(error) });
    }
  }

  async function handleQualification() {
    try {
      let artifactId = qualificationArtifactId;
      if (!artifactId && qualificationFile) {
        const artifact = await uploadForRole(qualificationFile, "QUALIFICATION_NOTICE", "ANEXO_EXTERNO");
        artifactId = artifact.id;
        setQualificationArtifactId(artifact.id);
      }
      if (!artifactId) throw new Error("Adjunte la nota de calificación.");
      await recordQualification.mutateAsync({
        filingId,
        operationId: qualificationOperation.current,
        outcome: qualification,
        effectiveAt: new Date(`${qualificationDate}T12:00:00`).toISOString(),
        evidenceArtifactId: artifactId,
        defectDescription: qualification === "POSITIVA" ? null : qualificationGrounds.trim(),
      });
      toast.success("Calificación registral tipificada y registrada.");
    } catch (error) {
      toast.error("No se pudo registrar la calificación", { description: error instanceof Error ? error.message : String(error) });
    }
  }

  async function handleRemedy() {
    try {
      let artifactId = remedyArtifactId;
      if (!artifactId && remedyFile) {
        const artifact = await uploadForRole(remedyFile, "REMEDY_SUBMISSION", "SUBSANACION_REGISTRAL");
        artifactId = artifact.id;
        setRemedyArtifactId(artifact.id);
      }
      if (!artifactId) throw new Error("Adjunte el documento presentado para subsanar.");
      await submitRemedy.mutateAsync({
        filingId,
        operationId: remedyOperation.current,
        remedyDescription: remedyDescription.trim(),
        evidenceArtifactId: artifactId,
        effectiveAt: remedyEffectiveAt.current,
      });
      toast.success("Subsanación registrada con evidencia.");
    } catch (error) {
      toast.error("No se pudo registrar la subsanación", { description: error instanceof Error ? error.message : String(error) });
    }
  }

  async function handleInscription() {
    try {
      await recordInscription.mutateAsync({
        filingId,
        operationId: inscriptionOperation.current,
        inscriptionNumber: inscriptionNumber.trim(),
        registeredAt: new Date(`${inscriptionDate}T12:00:00`).toISOString(),
        evidenceArtifactId: inscriptionArtifactId,
      });
      toast.success(`${terminalNounCap} ${terminal.participle} con evidencia verificada.`);
    } catch (error) {
      toast.error(`No se pudo acreditar ${terminal.article} ${terminal.noun}`, { description: error instanceof Error ? error.message : String(error) });
    }
  }

  async function handlePublication() {
    try {
      await recordPublication.mutateAsync({
        filingId,
        operationId: publicationOperation.current,
        publicationReference: publicationReference.trim(),
        publishedAt: new Date(`${publicationDate}T12:00:00`).toISOString(),
        evidenceArtifactId: publicationArtifactId,
      });
      toast.success("Publicación acreditada con evidencia verificada.");
    } catch (error) {
      toast.error("No se pudo acreditar la publicación", { description: error instanceof Error ? error.message : String(error) });
    }
  }

  const busy = uploadEvidence.isPending || recordPresentation.isPending || recordQualification.isPending ||
    submitRemedy.isPending || recordInscription.isPending || recordPublication.isPending;

  return (
    <section
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-5"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">Siguiente hecho registral</h2>
      <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
        Cada transición exige documento real, hash y evidencia de la sociedad. Inscripción y publicación solo admiten evidencia verificada.
      </p>

      {status === "PREPARADA" || status === "ELEVADA" ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-[var(--g-text-primary)]">Número de entrada o asiento
            <input value={filingNumber} onChange={(event) => setFilingNumber(event.target.value)} className={`${inputClass} mt-1`} style={{ borderRadius: "var(--g-radius-md)" }} />
          </label>
          <label className="text-xs font-medium text-[var(--g-text-primary)]">Fecha de presentación
            <input type="date" value={presentationDate} onChange={(event) => setPresentationDate(event.target.value)} className={`${inputClass} mt-1`} style={{ borderRadius: "var(--g-radius-md)" }} />
          </label>
          <label className="text-xs font-medium text-[var(--g-text-primary)] sm:col-span-2">Justificante de presentación
            <input type="file" onChange={(event) => {
              setPresentationFile(event.target.files?.[0] ?? null);
              setPresentationArtifactId(null);
              presentationOperation.current = crypto.randomUUID();
              presentationEffectiveAt.current = nowIso();
            }} className="mt-1 block w-full text-xs text-[var(--g-text-secondary)]" />
          </label>
          <button type="button" disabled={busy || !filingNumber.trim() || !presentationDate || !presentationFile || !filingVia} aria-busy={busy} onClick={handlePresentation} className={primaryButton} style={{ borderRadius: "var(--g-radius-md)" }}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Registrar presentación
          </button>
        </div>
      ) : null}

      {status === "PRESENTADA" && qualificationOutcome !== "POSITIVA" ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-[var(--g-text-primary)]">Resultado
            <select value={qualification} onChange={(event) => setQualification(event.target.value as RegistryQualificationOutcome)} className={`${inputClass} mt-1`} style={{ borderRadius: "var(--g-radius-md)" }}>
              <option value="POSITIVA">Positiva</option>
              <option value="SUSPENSION_SUBSANABLE">Suspensión subsanable</option>
              <option value="DENEGACION">Denegación</option>
            </select>
          </label>
          <label className="text-xs font-medium text-[var(--g-text-primary)]">Fecha de calificación
            <input type="date" value={qualificationDate} onChange={(event) => setQualificationDate(event.target.value)} className={`${inputClass} mt-1`} style={{ borderRadius: "var(--g-radius-md)" }} />
          </label>
          {qualification !== "POSITIVA" ? (
            <label className="text-xs font-medium text-[var(--g-text-primary)] sm:col-span-2">Fundamento comunicado por el Registro
              <textarea value={qualificationGrounds} onChange={(event) => setQualificationGrounds(event.target.value)} rows={3} className={`${inputClass} mt-1`} style={{ borderRadius: "var(--g-radius-md)" }} />
            </label>
          ) : null}
          <label className="text-xs font-medium text-[var(--g-text-primary)] sm:col-span-2">Nota de calificación
            <input type="file" onChange={(event) => {
              setQualificationFile(event.target.files?.[0] ?? null);
              setQualificationArtifactId(null);
              qualificationOperation.current = crypto.randomUUID();
            }} className="mt-1 block w-full text-xs text-[var(--g-text-secondary)]" />
          </label>
          <button type="button" disabled={busy || !qualificationDate || !qualificationFile || (qualification !== "POSITIVA" && !qualificationGrounds.trim())} aria-busy={busy} onClick={handleQualification} className={primaryButton} style={{ borderRadius: "var(--g-radius-md)" }}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Registrar calificación
          </button>
        </div>
      ) : null}

      {status === "SUBSANACION" ? (
        <div className="mt-4 space-y-3">
          <label className="block text-xs font-medium text-[var(--g-text-primary)]">Descripción de la subsanación
            <textarea value={remedyDescription} onChange={(event) => setRemedyDescription(event.target.value)} rows={3} className={`${inputClass} mt-1`} style={{ borderRadius: "var(--g-radius-md)" }} />
          </label>
          <label className="block text-xs font-medium text-[var(--g-text-primary)]">Documento presentado
            <input type="file" onChange={(event) => {
              setRemedyFile(event.target.files?.[0] ?? null);
              setRemedyArtifactId(null);
              remedyOperation.current = crypto.randomUUID();
              remedyEffectiveAt.current = nowIso();
            }} className="mt-1 block w-full text-xs text-[var(--g-text-secondary)]" />
          </label>
          <button type="button" disabled={busy || !remedyDescription.trim() || !remedyFile} aria-busy={busy} onClick={handleRemedy} className={primaryButton} style={{ borderRadius: "var(--g-radius-md)" }}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Registrar subsanación
          </button>
        </div>
      ) : null}

      {status === "PRESENTADA" && qualificationOutcome === "POSITIVA" && sinEvidenciaVerificada ? (
        <div
          className="mt-4 border border-[var(--status-warning)] bg-[var(--g-surface-subtle)] p-4"
          style={{ borderRadius: "var(--g-radius-md)" }}
          role="status"
        >
          <h3 className="text-sm font-semibold text-[var(--g-text-primary)]">
            {`No se puede acreditar ${terminal.article} ${terminal.noun} todavía`}
          </h3>
          <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
            El servidor solo admite el cierre registral contra un documento cuya evidencia esté
            verificada, y esta sociedad no tiene ninguno en ese estado. El circuito que marca un
            documento como verificado no está disponible en esta versión, así que el paso queda
            bloqueado: no se ofrece un formulario que no podría completarse.
          </p>
        </div>
      ) : null}

      {status === "PRESENTADA" && qualificationOutcome === "POSITIVA" && !sinEvidenciaVerificada ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-[var(--g-text-primary)]">{`Número de ${terminal.noun}`}
            <input value={inscriptionNumber} onChange={(event) => setInscriptionNumber(event.target.value)} className={`${inputClass} mt-1`} style={{ borderRadius: "var(--g-radius-md)" }} />
          </label>
          <label className="text-xs font-medium text-[var(--g-text-primary)]">{`Fecha de ${terminal.noun}`}
            <input type="date" value={inscriptionDate} onChange={(event) => setInscriptionDate(event.target.value)} className={`${inputClass} mt-1`} style={{ borderRadius: "var(--g-radius-md)" }} />
          </label>
          <label className="text-xs font-medium text-[var(--g-text-primary)] sm:col-span-2">Evidencia verificada
            <select value={inscriptionArtifactId} onChange={(event) => setInscriptionArtifactId(event.target.value)} className={`${inputClass} mt-1`} style={{ borderRadius: "var(--g-radius-md)" }}>
              <option value="">Seleccionar evidencia</option>
              {verifiedArtifacts.map((artifact) => <option key={artifact.id} value={artifact.id}>{artifact.title}</option>)}
            </select>
          </label>
          <button type="button" disabled={busy || !inscriptionNumber.trim() || !inscriptionDate || !inscriptionArtifactId} aria-busy={busy} onClick={handleInscription} className={primaryButton} style={{ borderRadius: "var(--g-radius-md)" }}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} {`Acreditar ${terminal.noun}`}
          </button>
        </div>
      ) : null}

      {isRegistryTerminal(status) && sinEvidenciaVerificada ? (
        <div
          className="mt-4 border border-[var(--status-warning)] bg-[var(--g-surface-subtle)] p-4"
          style={{ borderRadius: "var(--g-radius-md)" }}
          role="status"
        >
          <h3 className="text-sm font-semibold text-[var(--g-text-primary)]">
            No se puede acreditar la publicación todavía
          </h3>
          <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
            Igual que el cierre registral, la publicación exige un documento con evidencia verificada
            y esta sociedad no tiene ninguno. El paso queda bloqueado hasta que exista.
          </p>
        </div>
      ) : null}

      {isRegistryTerminal(status) && !sinEvidenciaVerificada ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium text-[var(--g-text-primary)]">Referencia de publicación
            <input value={publicationReference} onChange={(event) => setPublicationReference(event.target.value)} className={`${inputClass} mt-1`} style={{ borderRadius: "var(--g-radius-md)" }} />
          </label>
          <label className="text-xs font-medium text-[var(--g-text-primary)]">Fecha de publicación
            <input type="date" value={publicationDate} onChange={(event) => setPublicationDate(event.target.value)} className={`${inputClass} mt-1`} style={{ borderRadius: "var(--g-radius-md)" }} />
          </label>
          <label className="text-xs font-medium text-[var(--g-text-primary)] sm:col-span-2">Evidencia verificada
            <select value={publicationArtifactId} onChange={(event) => setPublicationArtifactId(event.target.value)} className={`${inputClass} mt-1`} style={{ borderRadius: "var(--g-radius-md)" }}>
              <option value="">Seleccionar evidencia</option>
              {verifiedArtifacts.map((artifact) => <option key={artifact.id} value={artifact.id}>{artifact.title}</option>)}
            </select>
          </label>
          <button type="button" disabled={busy || !publicationReference.trim() || !publicationDate || !publicationArtifactId} aria-busy={busy} onClick={handlePublication} className={primaryButton} style={{ borderRadius: "var(--g-radius-md)" }}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Acreditar publicación
          </button>
        </div>
      ) : null}
    </section>
  );
}
