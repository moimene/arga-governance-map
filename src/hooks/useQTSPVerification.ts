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
} from "@/lib/rules-engine";


interface EvidenceBundleRow {
  id: string;
  agreement_id: string;
  artifacts: Array<{
    type: string;
    ref: string;
    hash: string;
    signer_id?: string;
    signer_role?: string;
    timestamp?: string;
  }>;
  created_at: string;
}

interface RuleEvaluationResultRow {
  id: string;
  agreement_id: string;
  etapa: string;
  ok: boolean;
  severity: string;
  explain_json: Record<string, unknown> | null;
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
): Array<{
  type: "QES" | "QSEAL" | "TSQ" | "NOTIFICATION";
  ref: string;
  hash: string;
  signer_id?: string;
  signer_role?: string;
  timestamp?: string;
}> {
  const artifacts: Array<{
    type: "QES" | "QSEAL" | "TSQ" | "NOTIFICATION";
    ref: string;
    hash: string;
    signer_id?: string;
    signer_role?: string;
    timestamp?: string;
  }> = [];

  // Extract artifacts from evidence bundles
  for (const bundle of bundles) {
    if (bundle.artifacts && Array.isArray(bundle.artifacts)) {
      for (const art of bundle.artifacts) {
        // Validate artifact has required fields
        if (
          art.type &&
          (art.type === "QES" ||
            art.type === "QSEAL" ||
            art.type === "TSQ" ||
            art.type === "NOTIFICATION") &&
          art.ref &&
          art.hash
        ) {
          artifacts.push({
            type: art.type,
            ref: art.ref,
            hash: art.hash,
            signer_id: art.signer_id,
            signer_role: art.signer_role,
            timestamp: art.timestamp,
          });
        }
      }
    }
  }

  // Extract QES artifacts from rule evaluations (if they contain signature data)
  for (const evaluation of evaluations) {
    if (
      evaluation.explain_json &&
      typeof evaluation.explain_json === "object"
    ) {
      const explainData = evaluation.explain_json;

      // Check for signature ref in explain data
      if ("signature_ref" in explainData && typeof explainData.signature_ref === "string") {
        artifacts.push({
          type: "QES",
          ref: `evaluation-${evaluation.id}-signature`,
          hash: typeof explainData.signature_hash === "string"
            ? explainData.signature_hash
            : `eval-${evaluation.id}`,
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
