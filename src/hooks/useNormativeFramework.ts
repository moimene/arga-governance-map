import { useMemo } from "react";
import { useTenantContext } from "@/context/TenantContext";
import { useSociedad } from "@/hooks/useSociedades";
import { useEntityRules } from "@/hooks/useJurisdiccionRules";
import { useRulePacksForEntity } from "@/hooks/useRulePacks";
import { usePactosVigentes } from "@/hooks/usePactosParasociales";
import {
  buildAgreementNormativeSnapshot,
  buildEntityNormativeProfile,
  normalizeSocietyFormForRuleSet,
  type AgreementNormativeSnapshot,
  type EntityNormativeProfile,
} from "@/lib/secretaria/normative-framework";

export type NormativeFrameworkQuery = {
  data: EntityNormativeProfile | null;
  isLoading: boolean;
  error: unknown;
};

export type AgreementNormativeSnapshotQuery = {
  data: AgreementNormativeSnapshot | null;
  profile: EntityNormativeProfile | null;
  isLoading: boolean;
  error: unknown;
};

type AgreementForNormativeSnapshot = {
  id?: string | null;
  entity_id?: string | null;
  agreement_kind?: string | null;
  matter_class?: string | null;
  adoption_mode?: string | null;
  status?: string | null;
  inscribable?: boolean | null;
  compliance_snapshot?: Record<string, unknown> | null;
};

export function useEntityNormativeProfile(entityId?: string | null): NormativeFrameworkQuery {
  const { tenantId } = useTenantContext();
  const sociedadQuery = useSociedad(entityId ?? undefined);
  const sociedad = sociedadQuery.data;
  const ruleSetCompanyForm = useMemo(
    () =>
      normalizeSocietyFormForRuleSet(sociedad?.tipo_social ?? sociedad?.legal_form, {
        listed: sociedad?.es_cotizada,
      }) ?? undefined,
    [sociedad?.es_cotizada, sociedad?.legal_form, sociedad?.tipo_social],
  );
  const ruleSetsQuery = useEntityRules(sociedad?.jurisdiction ?? undefined, ruleSetCompanyForm);
  const rulePacksQuery = useRulePacksForEntity(entityId ?? undefined);
  const pactosQuery = usePactosVigentes(entityId ?? undefined);

  const profile = useMemo(() => {
    if (!tenantId || !sociedad) return null;
    return buildEntityNormativeProfile({
      tenantId,
      entity: sociedad,
      jurisdictionRuleSets: ruleSetsQuery.data ?? [],
      rulePacks: rulePacksQuery.data?.packs ?? [],
      overrides: rulePacksQuery.data?.overrides ?? [],
      pactos: pactosQuery.data ?? [],
    });
  }, [pactosQuery.data, rulePacksQuery.data, ruleSetsQuery.data, sociedad, tenantId]);

  return {
    data: profile,
    isLoading:
      sociedadQuery.isLoading ||
      ruleSetsQuery.isLoading ||
      rulePacksQuery.isLoading ||
      pactosQuery.isLoading,
    error: sociedadQuery.error ?? ruleSetsQuery.error ?? rulePacksQuery.error ?? pactosQuery.error ?? null,
  };
}

export function useAgreementNormativeSnapshot(
  agreement?: AgreementForNormativeSnapshot | null,
): AgreementNormativeSnapshotQuery {
  const profileQuery = useEntityNormativeProfile(agreement?.entity_id ?? undefined);
  const snapshot = useMemo(() => {
    if (!agreement || !profileQuery.data) return null;
    return buildAgreementNormativeSnapshot({
      agreement,
      profile: profileQuery.data,
    });
  }, [agreement, profileQuery.data]);

  return {
    data: snapshot,
    profile: profileQuery.data,
    isLoading: profileQuery.isLoading,
    error: profileQuery.error,
  };
}
