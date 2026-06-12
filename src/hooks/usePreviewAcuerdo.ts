import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import {
  evaluarAcuerdoCompleto,
  evaluarPuntoOrdenDia,
  type RulePack,
  type AdoptionMode,
  type AgendaItemKind,
  type TipoSocial,
  type TipoOrgano,
  type MateriaClase,
  type ComplianceResult,
} from "@/lib/rules-engine";

export interface PreviewParams {
  materia?: string;
  adoptionMode?: AdoptionMode;
  tipoSocial?: TipoSocial;
  organoTipo?: TipoOrgano;
  materiaClase?: MateriaClase;
  agendaItemKind?: AgendaItemKind;
  materializeAgreement?: boolean;
  capitalPresentePct?: number;
  votosFavorPct?: number;
  // ITEM-116 (DL-2): entidad del acuerdo, para leer el dato canónico
  // `entities.es_cotizada` en vez de asumir que toda SA es cotizada.
  entityId?: string;
}

type RpRow = {
  materia: string;
  organo_tipo: string | null;
  rule_pack_versions: { id: string; payload: unknown; is_active: boolean | null }[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function payloadClase(payload: unknown): string | null {
  return isRecord(payload) && typeof payload.clase === "string" ? payload.clase : null;
}

export function usePreviewAcuerdo(params: PreviewParams) {
  const { tenantId } = useTenantContext();

  return useQuery<ComplianceResult | null, Error>({
    queryKey: [
      "preview_acuerdo",
      tenantId,
      params.materia,
      params.adoptionMode,
      params.tipoSocial,
      params.organoTipo,
      params.materiaClase,
      params.agendaItemKind,
      params.materializeAgreement,
      params.capitalPresentePct,
      params.votosFavorPct,
      params.entityId,
    ],
    enabled: !!params.materia && !!tenantId,
    staleTime: 30_000,
    queryFn: async (): Promise<ComplianceResult | null> => {
      if (!params.materia) return null;

      const agendaBoundary = evaluarPuntoOrdenDia({
        kind: params.agendaItemKind ?? "DECISORIO",
        title: params.materia,
        hasAgreement: params.materializeAgreement ?? true,
      });

      if (!agendaBoundary.shouldRunAgreementGates) {
        return {
          ok: agendaBoundary.ok,
          adoptionMode: params.adoptionMode ?? "MEETING",
          path: "A",
          etapas: [agendaBoundary],
          explain: agendaBoundary.explain,
          blocking_issues: agendaBoundary.blocking_issues,
          warnings: agendaBoundary.warnings,
        };
      }

      // Query from rule_packs side — is_active is on rule_pack_versions, not status
      const { data: rulePacks, error } = await supabase
        .from("rule_packs")
        .select("materia, organo_tipo, rule_pack_versions!inner(id, payload, is_active)")
        .eq("tenant_id", tenantId!)
        .eq("materia", params.materia)
        .eq("rule_pack_versions.is_active", true);

      if (error || !rulePacks?.length) return null;

      const rows = rulePacks as unknown as RpRow[];

      // Best match: prefer exact organo_tipo + clase, fall back to first
      const candidates = rows.filter((rp) => {
        const versionPayload = rp.rule_pack_versions?.[0]?.payload;
        if (params.organoTipo && rp.organo_tipo && rp.organo_tipo !== params.organoTipo) return false;
        if (params.materiaClase && payloadClase(versionPayload) !== params.materiaClase) return false;
        return true;
      });
      const best = (candidates[0] ?? rows[0]);
      const version = best?.rule_pack_versions?.[0];
      if (!version?.payload) return null;

      // ITEM-116 (DL-2): leer el dato canónico `entities.es_cotizada` cuando hay entidad,
      // en vez del antiguo hardcode `tipoSocial === "SA"` (falso positivo para SA no cotizadas).
      // Sin entidad, por defecto NO cotizada. El cableado de evaluarBordesNoComputables al
      // orquestador queda pendiente (criterio legal LMV documentado para Garrigues).
      let esCotizada = false;
      if (params.entityId) {
        const { data: ent } = await supabase
          .from("entities")
          .select("es_cotizada")
          .eq("tenant_id", tenantId!)
          .eq("id", params.entityId)
          .maybeSingle();
        esCotizada = ent?.es_cotizada === true;
      }

      const pack = version.payload as RulePack;
      const mode: AdoptionMode = params.adoptionMode ?? "NO_SESSION";
      const tipoSocial: TipoSocial = params.tipoSocial ?? "SA";
      const organoTipo: TipoOrgano = params.organoTipo ?? "JUNTA_GENERAL";
      const materiaClase: MateriaClase = params.materiaClase ?? (pack.clase as MateriaClase) ?? "ORDINARIA";

      const capitalTotal = 1000;
      const capitalPresentePct = params.capitalPresentePct ?? 0.75;
      const capitalPresente = Math.round(capitalTotal * capitalPresentePct);
      const votosFavorPct = params.votosFavorPct ?? 0.7;
      const votosFavor = Math.round(capitalPresente * votosFavorPct);
      const votosContra = Math.round(capitalPresente * 0.1);
      const abstenciones = capitalPresente - votosFavor - votosContra;

      const esUniversal = mode === "UNIVERSAL";
      const esColegiado = mode === "MEETING" || esUniversal;

      return evaluarAcuerdoCompleto(mode, [pack], [], {
        convocatoria: esColegiado
          ? {
              tipoSocial,
              organoTipo,
              adoptionMode: mode,
              fechaJunta: new Date().toISOString(),
              esCotizada, // ITEM-116: dato canónico entities.es_cotizada (DL-2)
              webInscrita: false,
              primeraConvocatoria: true,
              esJuntaUniversal: esUniversal,
              materias: [params.materia],
            }
          : undefined,
        constitucion: esColegiado
          ? {
              tipoSocial,
              organoTipo,
              adoptionMode: mode,
              primeraConvocatoria: true,
              materiaClase,
              capitalConDerechoVoto: capitalTotal,
              capitalPresenteRepresentado: capitalPresente,
            }
          : undefined,
        votacion: {
          tipoSocial,
          organoTipo,
          adoptionMode: mode,
          materiaClase,
          materias: [params.materia],
          votos: {
            favor: votosFavor,
            contra: votosContra,
            abstenciones: Math.max(0, abstenciones),
            en_blanco: 0,
            capital_presente: capitalPresente,
            capital_total: capitalTotal,
          },
          decisionFirmada: mode === "UNIPERSONAL_SOCIO" || mode === "UNIPERSONAL_ADMIN",
        },
        documentacion: {
          adoptionMode: mode,
          materias: [params.materia],
          documentosDisponibles: [],
        },
      });
    },
  });
}
