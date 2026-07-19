import { useMemo } from "react";
import { useTenantContext } from "@/context/TenantContext";
import { useSociedad } from "@/hooks/useSociedades";
import { useEntityRules } from "@/hooks/useJurisdiccionRules";
import { useRulePacksForEntity, useRulePackForMateria } from "@/hooks/useRulePacks";
import { usePactosVigentes } from "@/hooks/usePactosParasociales";
import { useAgreementById } from "@/hooks/useAgreementsList";
import {
  buildEntityNormativeProfile,
  normalizeSocietyFormForRuleSet,
  type EntityNormativeProfile,
  type AgreementNormativeSnapshot,
} from "@/lib/secretaria/normative-framework";
import {
  buildEffectiveAgreementRule,
  type EffectiveAgreementRule,
  type RuleManagerInput,
} from "@/lib/secretaria/rule-manager-contract";
import { extractMajorityFromRulePackParams } from "@/lib/secretaria/rule-pack-params";
import type { PactoParasocial } from "@/lib/rules-engine/pactos-engine";

// ─── useRuleManagerProfile ──────────────────────────────────────────────────
//
// Devuelve el perfil normativo y los pactos vigentes crudos para una sociedad.
// Es el equivalente al "marco normativo" que verá el equipo legal en la página
// /secretaria/reglas.

export interface RuleManagerProfileQuery {
  data: EntityNormativeProfile | null;
  pactos: PactoParasocial[];
  isLoading: boolean;
  error: unknown;
}

export function useRuleManagerProfile(entityId?: string | null): RuleManagerProfileQuery {
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
    pactos: pactosQuery.data ?? [],
    isLoading:
      sociedadQuery.isLoading ||
      ruleSetsQuery.isLoading ||
      rulePacksQuery.isLoading ||
      pactosQuery.isLoading,
    error:
      sociedadQuery.error ??
      ruleSetsQuery.error ??
      rulePacksQuery.error ??
      pactosQuery.error ??
      null,
  };
}

// ─── useAgreementRulePreview ────────────────────────────────────────────────
//
// Simulador read-only: dado (sociedad, materia, modo de adopción, etc.)
// devuelve la regla efectiva del acuerdo según el contrato puro
// `buildEffectiveAgreementRule`. No requiere acuerdo persistido.

export interface AgreementRulePreviewInput {
  entityId?: string | null;
  bodyType?: string | null;
  matter?: string;
  matterClass?: string | null;
  adoptionMode?: string;
  inscribable?: boolean | null;
  legalMajority?: RuleManagerInput["agreement"]["legal_majority"];
  pactosEval?: RuleManagerInput["pactosEval"];
  statutoryEnshrinedPactoIds?: string[];
}

export interface AgreementRulePreviewQuery {
  data: EffectiveAgreementRule | null;
  isLoading: boolean;
  error: unknown;
  enabled: boolean;
}

export function useAgreementRulePreview(input: AgreementRulePreviewInput): AgreementRulePreviewQuery {
  const { tenantId } = useTenantContext();
  const sociedadQuery = useSociedad(input.entityId ?? undefined);
  const sociedad = sociedadQuery.data;
  const ruleSetCompanyForm = useMemo(
    () =>
      normalizeSocietyFormForRuleSet(sociedad?.tipo_social ?? sociedad?.legal_form, {
        listed: sociedad?.es_cotizada,
      }) ?? undefined,
    [sociedad?.es_cotizada, sociedad?.legal_form, sociedad?.tipo_social],
  );
  const ruleSetsQuery = useEntityRules(sociedad?.jurisdiction ?? undefined, ruleSetCompanyForm);
  const rulePacksQuery = useRulePacksForEntity(input.entityId ?? undefined);
  const pactosQuery = usePactosVigentes(input.entityId ?? undefined);
  // El órgano ya viaja en el input (se usa más abajo como `body_type` del
  // acuerdo); pasarlo aquí evita derivar la mayoría legal de un pack de otro
  // órgano. Si el llamador no lo conoce —hoy el simulador de reglas no tiene
  // selector de órgano— el hook se niega a elegir entre packs de órganos
  // distintos y `legal_majority` queda sin suministrar, con lo que el contrato
  // degrada a una inferencia etiquetada como tal.
  const rulePackQuery = useRulePackForMateria(input.matter, input.bodyType);

  const enabled = !!input.entityId && !!input.matter && !!input.adoptionMode && !!tenantId;

  const isLoading =
    sociedadQuery.isLoading ||
    ruleSetsQuery.isLoading ||
    rulePacksQuery.isLoading ||
    pactosQuery.isLoading ||
    (!!input.matter && rulePackQuery.isLoading);

  const error =
    sociedadQuery.error ??
    ruleSetsQuery.error ??
    rulePacksQuery.error ??
    pactosQuery.error ??
    rulePackQuery.error ??
    null;

  const result = useMemo<EffectiveAgreementRule | null>(() => {
    if (!enabled || !sociedad || !input.matter || !input.adoptionMode || !tenantId) return null;

    // Si el caller no suministra legal_majority, intentamos extraerla del rule pack activo.
    const derivedMajority =
      input.legalMajority ?? extractMajorityFromRulePackParams(rulePackQuery.data?.params);

    return buildEffectiveAgreementRule({
      tenantId,
      entity: sociedad,
      jurisdictionRuleSets: ruleSetsQuery.data ?? [],
      rulePacks: rulePacksQuery.data?.packs ?? [],
      overrides: rulePacksQuery.data?.overrides ?? [],
      pactos: pactosQuery.data ?? [],
      agreement: {
        matter: input.matter,
        matter_class: input.matterClass ?? null,
        body_type: input.bodyType ?? null,
        adoption_mode: input.adoptionMode,
        inscribable: input.inscribable ?? null,
        legal_majority: derivedMajority ?? undefined,
      },
      pactosEval: input.pactosEval,
      options: {
        statutoryEnshrinedPactoIds: input.statutoryEnshrinedPactoIds,
      },
    });
  }, [
    enabled,
    input.adoptionMode,
    input.bodyType,
    input.inscribable,
    input.legalMajority,
    input.matter,
    input.matterClass,
    input.pactosEval,
    input.statutoryEnshrinedPactoIds,
    pactosQuery.data,
    rulePackQuery.data,
    rulePacksQuery.data,
    ruleSetsQuery.data,
    sociedad,
    tenantId,
  ]);

  return { data: result, isLoading, error, enabled };
}

// ─── useAgreementRuleSnapshot ───────────────────────────────────────────────
//
// Lectura del snapshot ya almacenado en `agreements.compliance_explain`.
// NO recalcula la regla; sólo lee lo que se congeló al adoptar/documentar.

export interface AgreementRuleSnapshotQuery {
  data: AgreementNormativeSnapshot | null;
  agreement: ReturnType<typeof useAgreementById>["data"] | null;
  isLoading: boolean;
  error: unknown;
}

export function useAgreementRuleSnapshot(agreementId?: string | null): AgreementRuleSnapshotQuery {
  const agreementQuery = useAgreementById(agreementId ?? undefined);
  const agreement = agreementQuery.data ?? null;

  const snapshot = useMemo<AgreementNormativeSnapshot | null>(() => {
    if (!agreement) return null;
    const explain = (agreement as { compliance_explain?: Record<string, unknown> | null })
      .compliance_explain;
    if (!explain) return null;
    // agreement-360.ts only writes `normative_snapshot` into compliance_explain.
    // No fallback to `normative_profile` (which lives inside compliance_snapshot).
    return (explain.normative_snapshot as AgreementNormativeSnapshot | undefined) ?? null;
  }, [agreement]);

  return {
    data: snapshot,
    agreement,
    isLoading: agreementQuery.isLoading,
    error: agreementQuery.error,
  };
}
