/**
 * F3.G3 — useEvidenceBundleSignedUrl
 * Plan: docs/superpowers/plans/2026-05-16-tgms-gaps-coverage-plan-v1.md §5
 *
 * Reemplaza el patrón anti-pattern `supabase.storage.getPublicUrl(...)` que
 * el frontend usaba sobre el bucket PRIVADO `matter-documents`. La URL
 * pública nunca funciona (403). El hook llama a la Edge Function
 * `sign-evidence-url` que verifica auth + tenant + legal hold y devuelve
 * una URL firmada con TTL 5min.
 */

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { SOURCE_OBJECT_TYPE } from "@/lib/secretaria/evidence-source-types";

const SIGNED_URL_TTL_MS = 300_000; // 5 min, mismo TTL que la Edge Function

type SignedUrlResponse = {
  url: string;
  expires_at: string;
  bundle_id: string;
};

export function useEvidenceBundleSignedUrl(
  bundleId: string | null | undefined,
): UseQueryResult<string, Error> {
  return useQuery({
    queryKey: ["evidence-signed-url", bundleId ?? null],
    enabled: !!bundleId,
    // Re-fetch antes de que expire (TTL 5 min, refresca a los 4).
    staleTime: SIGNED_URL_TTL_MS - 60_000,
    gcTime: SIGNED_URL_TTL_MS,
    queryFn: async (): Promise<string> => {
      const { data, error } = await supabase.functions.invoke<SignedUrlResponse>(
        "sign-evidence-url",
        { body: { bundle_id: bundleId } },
      );
      if (error) {
        throw new Error(
          `sign-evidence-url failed: ${error.message ?? String(error)}`,
        );
      }
      if (!data?.url) {
        throw new Error("sign-evidence-url returned no url");
      }
      return data.url;
    },
  });
}

/**
 * F3.G3 — Helper para resolver el documento firmado de un agreement.
 *
 * Cuando GenerarDocumentoStepper archiva un acuerdo, crea un
 * `evidence_bundles` row con `source_object_id = agreement.id` +
 * `source_object_type = 'AGREEMENT'` y popula `agreements.document_url`
 * como shadow legacy. Este hook resuelve la cadena:
 *   agreementId → evidence_bundles.id → signed URL (Edge Function).
 *
 * Si no encuentra evidence_bundle (agreement sin archivar todavía), el
 * resultado es null y el componente que lo consume no muestra el enlace.
 */
export function useAgreementSignedDocumentUrl(
  agreementId: string | null | undefined,
): {
  signedUrl: string | null;
  isLoading: boolean;
  isError: boolean;
  hasBundle: boolean;
} {
  const bundleQuery = useQuery({
    queryKey: ["agreement-evidence-bundle", agreementId ?? null],
    enabled: !!agreementId,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from("evidence_bundles")
        .select("id")
        .eq("source_object_id", agreementId!)
        .eq("source_object_type", SOURCE_OBJECT_TYPE.AGREEMENT)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (data?.id) return data.id;
      // ITEM-044: fallback por agreement_id para bundles legacy creados sin
      // provenance (33 OPEN del archivador antiguo y 6 SEALED seed con
      // 'agreement' en minúsculas). No se mutan filas WORM existentes: el
      // fallback de lectura las hace recuperables.
      const { data: legacy, error: legacyError } = await supabase
        .from("evidence_bundles")
        .select("id")
        .eq("agreement_id", agreementId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (legacyError) throw new Error(legacyError.message);
      return legacy?.id ?? null;
    },
  });

  const bundleId = useMemo(() => bundleQuery.data ?? null, [bundleQuery.data]);
  const urlQuery = useEvidenceBundleSignedUrl(bundleId);

  return {
    signedUrl: urlQuery.data ?? null,
    isLoading: bundleQuery.isLoading || urlQuery.isLoading,
    isError: bundleQuery.isError || urlQuery.isError,
    hasBundle: !!bundleId,
  };
}
