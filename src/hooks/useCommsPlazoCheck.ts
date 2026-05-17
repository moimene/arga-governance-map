import { useMemo } from 'react';
import { useEntityNormativeProfile } from '@/hooks/useNormativeFramework';
import { calcularPlazoComunicacion } from '@/lib/rules-engine/comms-plazo-engine';
import type { TipoComunicacion, OrganoTipo } from '@/lib/comms/types';

export interface CommunicationDraft {
  tipo_comunicacion: TipoComunicacion;
  organo_tipo: OrganoTipo;
  entity_id: string;
  meeting_date: Date | null;
  agreement_date: Date | null;
  fecha_programada: Date | null;
  template_id: string | null;
}

export interface PlazoCheckResult {
  isValid: boolean;
  minDate: Date | null;
  reason: string;
  warnings: string[];
}

export function useCommsPlazoCheck(draft: CommunicationDraft): PlazoCheckResult {
  const profileQuery = useEntityNormativeProfile(draft.entity_id);
  const profile = (profileQuery as unknown as { data: unknown }).data;

  return useMemo<PlazoCheckResult>(() => {
    if (!profile) {
      return { isValid: false, minDate: null, reason: 'Cargando perfil normativo...', warnings: [] };
    }
    const p = profile as { tipo_social?: string; es_cotizada?: boolean; jurisdiction?: string };
    const result = calcularPlazoComunicacion({
      tipo_comunicacion: draft.tipo_comunicacion,
      organo_tipo: draft.organo_tipo,
      entity_id: draft.entity_id,
      fecha_evento_referenciado: draft.meeting_date ?? draft.agreement_date ?? null,
      normative_profile: {
        tipo_social: p.tipo_social ?? 'SA',
        es_cotizada: Boolean(p.es_cotizada),
        jurisdiction: p.jurisdiction ?? 'ES',
      },
      template_id: draft.template_id,
    });
    if (!draft.fecha_programada) {
      return { isValid: false, minDate: result.min_envio_date, reason: 'Fecha sin programar', warnings: result.warnings };
    }
    // min_envio_date is the latest legal send date (meeting - plazo_dias).
    // Sending BEFORE it (more advance notice) is always valid.
    // Sending AFTER it (less than required notice) invalidates the convocation.
    if (result.min_envio_date && draft.fecha_programada > result.min_envio_date) {
      return {
        isValid: false,
        minDate: result.min_envio_date,
        reason: `Plazo legal incumplido: envío debe ser a más tardar el ${result.min_envio_date.toLocaleDateString('es')} (${result.referencia_legal}, ${result.plazo_dias} días ${result.unidad.toLowerCase()})`,
        warnings: result.warnings,
      };
    }
    return { isValid: true, minDate: result.min_envio_date, reason: 'OK', warnings: result.warnings };
  }, [
    draft.tipo_comunicacion,
    draft.organo_tipo,
    draft.entity_id,
    draft.meeting_date,
    draft.agreement_date,
    draft.fecha_programada,
    draft.template_id,
    profile,
  ]);
}
