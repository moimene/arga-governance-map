import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import {
  evaluarAcuerdoCompleto,
  type RulePack,
  type AdoptionMode,
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
  capitalPresentePct?: number;
  votosFavorPct?: number;
}

type RpVersionRow = { id: string; params: unknown; status: string; rule_packs: { materia: string; clase: string; organo_tipo: string } | null };

export function usePreviewAcuerdo(params: PreviewParams) {
  const { tenantId } = useTenantContext();

  return useQuery<ComplianceResult | null, Error>({
    queryKey: ["preview_acuerdo", tenantId, params.materia, params.adoptionMode, params.tipoSocial, params.materiaClase, params.capitalPresentePct, params.votosFavorPct],
    enabled: !!params.materia && !!tenantId,
    staleTime: 30_000,
    queryFn: async (): Promise<ComplianceResult | null> => {
      if (!params.materia) return null;

      const { data: rpVersions } = await supabase
        .from("rule_pack_versions")
        .select("*, rule_packs!inner(materia, clase, organo_tipo)")
        .eq("tenant_id", tenantId!)
        .eq("status", "ACTIVE");

      const rows = (rpVersions ?? []) as RpVersionRow[];
      const match = rows.find((v) => v.rule_packs?.materia === params.materia);
      if (!match?.params) return null;

      const pack = match.params as RulePack;
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
              esCotizada: tipoSocial === "SA",
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
