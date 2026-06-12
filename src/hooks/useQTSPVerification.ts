// ============================================================
// Hook: QTSP Verification — Trust Center integrity checks
// Spec: Motor de Reglas LSC § QTSP Integration (T22)
// ============================================================

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import {
  verificarIntegridad,
  type IntegrityVerificationResult,
  type VerifiableArtifact,
} from "@/lib/rules-engine";


// ITEM-107: la columna real es `manifest` (jsonb); los artefactos viven en
// manifest.artifacts (ver migración F3.G15). NO existe columna `artifacts`.
interface EvidenceManifestArtifact {
  type?: string;
  ref?: string;
  hash?: string;
  hash_sha512?: string;
  filename?: string;
  signer_id?: string;
  signer_role?: string;
  timestamp?: string;
  timestamp_iso?: string;
}

interface EvidenceBundleRow {
  id: string;
  agreement_id: string;
  manifest: { artifacts?: EvidenceManifestArtifact[] } | null;
  created_at: string;
}

interface RuleEvaluationResultRow {
  id: string;
  agreement_id: string;
  etapa: string;
  ok: boolean;
  severity: string;
  // ITEM-107: la columna real de rule_evaluation_results es `explain`, no `explain_json`.
  explain: Record<string, unknown> | null;
  blocking_issues: string[] | null;
  warnings: string[] | null;
  created_at: string;
}

/**
 * Hook: Load evidence bundles and rule evaluation results for an agreement,
 * then run QTSP integrity verification on the artifacts.
 *
 * @param agreementId UUID of the agreement
 * @returns Query result with IntegrityVerificationResult
 */
export function useQTSPVerification(agreementId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["qtsp-verification", tenantId, agreementId],
    enabled: !!agreementId && !!tenantId,
    staleTime: 60_000, // 1 minute
    queryFn: async () => {
      if (!agreementId) throw new Error("Agreement ID required");

      // 1. Load evidence bundles for this agreement
      const { data: bundles, error: bundleError } = await supabase
        .from("evidence_bundles")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("agreement_id", agreementId)
        .order("created_at", { ascending: false });

      if (bundleError) throw bundleError;

      // 2. Load rule evaluation results for this agreement
      const { data: evaluations, error: evalError } = await supabase
        .from("rule_evaluation_results")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("agreement_id", agreementId);

      if (evalError) throw evalError;

      // 3. Build artifact list from bundles and evaluations
      const bundlesTyped = (bundles ?? []) as EvidenceBundleRow[];
      const evaluationsTyped = (evaluations ?? []) as RuleEvaluationResultRow[];

      const artifacts = buildArtifactsFromData(bundlesTyped, evaluationsTyped);

      // 4. Run verification
      return verificarIntegridad(agreementId, artifacts);
    },
  });
}

/**
 * Internal: Build artifact list from Supabase evidence bundles and rule evaluations.
 *
 * @param bundles Evidence bundles from DB
 * @param evaluations Rule evaluation results from DB
 * @returns Array of artifacts suitable for verificarIntegridad
 */
function buildArtifactsFromData(
  bundles: EvidenceBundleRow[],
  evaluations: RuleEvaluationResultRow[]
): VerifiableArtifact[] {
  const artifacts: VerifiableArtifact[] = [];

  // ITEM-107: extraer artefactos de manifest.artifacts (la columna real es
  // `manifest` jsonb). En producción los artefactos son DOCX archivados con
  // hash SHA-512 en `hash_sha512`; se mapean a tipo HASH (integridad de
  // documento). Si en el futuro el manifest trae sellos QTSP tipados
  // (QES/QSEAL/TSQ/NOTIFICATION) con `hash`, se respetan tal cual.
  const KNOWN_QTSP_TYPES = new Set(["QES", "QSEAL", "TSQ", "NOTIFICATION"]);
  for (const bundle of bundles) {
    const manifestArtifacts = bundle.manifest?.artifacts;
    if (!Array.isArray(manifestArtifacts)) continue;
    for (const art of manifestArtifacts) {
      const hash = art.hash ?? art.hash_sha512;
      const ref = art.ref ?? art.filename;
      if (!hash || !ref) continue;
      const timestamp = art.timestamp ?? art.timestamp_iso;
      const isKnownQtsp = typeof art.type === "string" && KNOWN_QTSP_TYPES.has(art.type);
      artifacts.push({
        type: isKnownQtsp ? (art.type as VerifiableArtifact["type"]) : "HASH",
        ref,
        hash,
        signer_id: art.signer_id,
        signer_role: art.signer_role,
        timestamp,
      });
    }
  }

  // Extract QES artifacts from rule evaluations (if they contain signature data)
  for (const evaluation of evaluations) {
    if (
      evaluation.explain &&
      typeof evaluation.explain === "object"
    ) {
      const explainData = evaluation.explain;

      // Check for signature ref in explain data.
      // Codex (rev. ITEM-107): NO sintetizar hashes. Antes, si faltaba
      // signature_hash se fabricaba `eval-${id}`, lo que hacía pasar el check de
      // integridad sobre un valor inventado (confianza fabricada). Ahora se
      // toma el signature_hash real; si no existe, se incluye con hash vacío
      // para que verificarIntegridad lo marque como FALLIDO (fail-closed) en
      // vez de ocultarlo o falsearlo.
      if ("signature_ref" in explainData && typeof explainData.signature_ref === "string") {
        artifacts.push({
          type: "QES",
          ref: `evaluation-${evaluation.id}-signature`,
          hash: typeof explainData.signature_hash === "string"
            ? explainData.signature_hash
            : "",
          signer_id: typeof explainData.signer_id === "string"
            ? explainData.signer_id
            : undefined,
          signer_role: typeof explainData.signer_role === "string"
            ? explainData.signer_role
            : undefined,
          timestamp: evaluation.created_at,
        });
      }
    }
  }

  return artifacts;
}
