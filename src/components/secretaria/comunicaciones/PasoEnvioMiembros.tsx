import { useMemo, useState } from 'react';
import { useBodyMandates } from '@/hooks/useBodies';
import { useCommsPlazoCheck } from '@/hooks/useCommsPlazoCheck';
import { useProgramCommunication } from '@/hooks/useCommunicationActions';
import { useTenantContext } from '@/context/TenantContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { Canal, NivelCertificacion, OrganoTipo, TipoComunicacion } from '@/lib/comms/types';

export interface PasoEnvioMiembrosProps {
  bodyId: string;
  entityId: string;
  organoTipo: OrganoTipo;
  meetingId?: string | null;
  agreementId?: string | null;
  meetingDate?: Date | null;
  agreementDate?: Date | null;
  documentUri: string;
  documentHash?: string;
  documentLabel?: string;
  documentMimeType?: string;
  documentTipo?: 'DOCUMENTO_GENERADO' | 'INFORME_PRECEPTIVO' | 'EXPEDIENTE_REF' | 'TEXTO_INTEGRO' | 'ORDEN_DIA' | 'OTRO';
  documentSizeBytes?: number;
  documentModoEntrega?: 'ADJUNTO' | 'LINK_FIRMADO';
  templateId?: string | null;
  tipoComunicacion?: TipoComunicacion;
  asunto: string;
  cuerpoHtml: string;
  onProgramado?: (communicationId: string) => void;
  onCancel?: () => void;
}

const DEFAULT_NIVEL_BY_ORGANO: Record<OrganoTipo, NivelCertificacion> = {
  JUNTA_GENERAL: 'BUROFAX_ERDS',
  CONSEJO_ADMIN: 'EMAIL_CERTIFICADO',
  COMISION_DELEGADA: 'EMAIL_CERTIFICADO',
  SOCIO_UNICO: 'EMAIL_NORMAL',
  ADMIN_UNICO: 'EMAIL_NORMAL',
  ADMIN_CONJUNTA: 'EMAIL_CERTIFICADO',
  ADMIN_SOLIDARIOS: 'EMAIL_CERTIFICADO',
};

async function sha512Hex(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-512', enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function PasoEnvioMiembros(props: PasoEnvioMiembrosProps) {
  useAuth();
  useTenantContext();
  const programar = useProgramCommunication();
  const { data: mandates, isLoading: loadingMembers } = useBodyMandates(props.bodyId);
  const activeMembers = useMemo(
    () => (mandates ?? []).filter((m) => m.status === 'Activo' && m.person_id),
    [mandates],
  );

  const defaultNivel = DEFAULT_NIVEL_BY_ORGANO[props.organoTipo];
  const [nivel, setNivel] = useState<NivelCertificacion>(defaultNivel);
  const [fechaProgramada, setFechaProgramada] = useState<Date>(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 5);
    return d;
  });
  const [recipientChannels, setRecipientChannels] = useState<
    Record<string, { primario: Canal; fallback: Canal | null }>
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plazo = useCommsPlazoCheck({
    tipo_comunicacion: (props.tipoComunicacion ?? 'CONVOCATORIA') as TipoComunicacion,
    organo_tipo: props.organoTipo,
    entity_id: props.entityId,
    meeting_date: props.meetingDate ?? null,
    agreement_date: props.agreementDate ?? null,
    fecha_programada: fechaProgramada,
    template_id: props.templateId ?? null,
  });

  function channelFor(personId: string): Canal {
    return recipientChannels[personId]?.primario ?? (nivel as Canal);
  }
  function fallbackFor(personId: string): Canal | null {
    return recipientChannels[personId]?.fallback ?? null;
  }

  async function handleProgramar() {
    if (submitting) return;
    setError(null);
    if (activeMembers.length === 0) {
      setError('No hay miembros vigentes en el órgano.');
      return;
    }
    if (!plazo.isValid) {
      setError(plazo.reason);
      return;
    }

    const recipientsWithEmail = activeMembers.filter((m) => m.email && m.email.trim().length > 0);
    if (recipientsWithEmail.length === 0) {
      setError('Ningún miembro vigente tiene email. Verifica el directorio de personas.');
      return;
    }

    setSubmitting(true);
    try {
      // CRITICAL fix: cuerpo_hash and document_hash are DISTINCT.
      // cuerpo_hash_sha512 = SHA-512 of the email body HTML (sealed by Resend+QTSP / EAD ERDS)
      // attachment.hash_sha512 = SHA-512 of the attached document (separate evidence)
      const cuerpoHash = await sha512Hex(props.cuerpoHtml);
      const docHash = props.documentHash ?? (await sha512Hex(props.documentUri));

      const attachments = [
        {
          tipo: props.documentTipo ?? 'DOCUMENTO_GENERADO',
          label: props.documentLabel ?? 'Documento',
          storage_uri: props.documentUri,
          hash_sha512: docHash,
          size_bytes: props.documentSizeBytes ?? null,
          mime_type: props.documentMimeType ?? 'application/pdf',
          orden: 0,
          modo_entrega: props.documentModoEntrega ?? 'ADJUNTO',
          signed_url_expiry_hours: 168,
        },
      ];

      const recipientsPayload = recipientsWithEmail.map((m) => {
        const canal = channelFor(m.person_id);
        const fb = fallbackFor(m.person_id);
        return {
          person_id: m.person_id,
          cargo_en_organo: m.role,
          canal_primario: canal,
          canal_fallback: fb,
          destino_primario: m.email,
          destino_fallback: null,
        };
      });

      // ATOMIC RPC: communications + attachments + recipients in one transaction.
      // If any insert fails (e.g. tg_communications_validate_plazo blocks), all rollback.
      const { data: commId, error: rpcErr } = await supabase.rpc('fn_create_communication_atomic', {
        p_comm: {
          entity_id: props.entityId,
          body_id: props.bodyId,
          organo_tipo: props.organoTipo,
          agreement_id: props.agreementId ?? null,
          meeting_id: props.meetingId ?? null,
          template_id: props.templateId ?? null,
          tipo_comunicacion: props.tipoComunicacion ?? 'CONVOCATORIA',
          tipo_respuesta_esperada: 'ACUSE',
          nivel_certificacion_minimo: nivel,
          asunto: props.asunto,
          cuerpo_render: props.cuerpoHtml,
          cuerpo_hash_sha512: cuerpoHash,
          estado: 'BORRADOR',
          fecha_programada: fechaProgramada.toISOString(),
          metadata: { source: 'PasoEnvioMiembros' },
        },
        p_attachments: attachments,
        p_recipients: recipientsPayload,
      });

      if (rpcErr || !commId) {
        throw new Error(rpcErr?.message ?? 'Failed to create communication');
      }

      // Promote to PROGRAMADA + trigger dispatcher
      await programar.mutateAsync(commId as string);
      props.onProgramado?.(commId as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingMembers) {
    return <div className="p-6 text-[var(--g-text-secondary)]">Cargando miembros del órgano…</div>;
  }
  if (activeMembers.length === 0) {
    return (
      <div
        className="p-6 border border-[var(--status-warning)] text-[var(--g-text-primary)] bg-[var(--g-surface-subtle)]"
        style={{ borderRadius: 'var(--g-radius-md)' }}
      >
        No hay miembros vigentes en este órgano. Añada miembros en{' '}
        <code>/secretaria/personas</code> antes de programar el envío.
      </div>
    );
  }

  const missingEmail = activeMembers.filter((m) => !m.email);

  return (
    <div className="space-y-6">
      <header>
        <h3 className="text-xl font-semibold text-[var(--g-text-primary)]">Envío a miembros del órgano</h3>
        <p className="text-sm text-[var(--g-text-secondary)] mt-1">
          {activeMembers.length} miembros vigentes
          {missingEmail.length > 0 && (
            <span className="text-[var(--status-warning)]"> · {missingEmail.length} sin email</span>
          )}
        </p>
      </header>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-[var(--g-text-primary)]">
          Nivel mínimo de certificación
        </label>
        <select
          value={nivel}
          onChange={(e) => setNivel(e.target.value as NivelCertificacion)}
          className="border border-[var(--g-border-default)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)] px-3 py-2"
          style={{ borderRadius: 'var(--g-radius-md)' }}
        >
          <option value="EMAIL_NORMAL">Email normal (sin valor probatorio)</option>
          <option value="EMAIL_CERTIFICADO">Email certificado (sello QTSP del cuerpo)</option>
          <option value="BUROFAX_ERDS">Burofax digital ERDS (EAD Trust)</option>
        </select>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-[var(--g-text-primary)]">
          Fecha y hora programadas
        </label>
        <input
          type="datetime-local"
          value={
            new Date(fechaProgramada.getTime() - fechaProgramada.getTimezoneOffset() * 60000)
              .toISOString()
              .slice(0, 16)
          }
          onChange={(e) => setFechaProgramada(new Date(e.target.value))}
          className="border border-[var(--g-border-default)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)] px-3 py-2"
          style={{ borderRadius: 'var(--g-radius-md)' }}
        />
        {!plazo.isValid && plazo.reason !== 'Fecha sin programar' && (
          <p className="text-sm text-[var(--status-error)]">{plazo.reason}</p>
        )}
        {plazo.warnings.length > 0 && (
          <ul className="text-sm text-[var(--status-warning)] list-disc list-inside">
            {plazo.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}
      </div>

      <div
        className="border border-[var(--g-border-subtle)] overflow-hidden"
        style={{ borderRadius: 'var(--g-radius-md)' }}
      >
        <table className="w-full text-sm">
          <thead className="bg-[var(--g-surface-subtle)]">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-[var(--g-text-primary)]">Miembro</th>
              <th className="px-4 py-2 text-left font-medium text-[var(--g-text-primary)]">Cargo</th>
              <th className="px-4 py-2 text-left font-medium text-[var(--g-text-primary)]">Email</th>
              <th className="px-4 py-2 text-left font-medium text-[var(--g-text-primary)]">Canal primario</th>
              <th className="px-4 py-2 text-left font-medium text-[var(--g-text-primary)]">Canal fallback</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--g-border-subtle)] bg-[var(--g-surface-card)]">
            {activeMembers.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-2 text-[var(--g-text-primary)]">{m.full_name ?? '—'}</td>
                <td className="px-4 py-2 text-[var(--g-text-secondary)]">{m.role ?? '—'}</td>
                <td className="px-4 py-2 text-[var(--g-text-secondary)]">
                  {m.email ?? (
                    <span className="text-[var(--status-warning)]">sin email</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <select
                    value={channelFor(m.person_id)}
                    onChange={(e) =>
                      setRecipientChannels({
                        ...recipientChannels,
                        [m.person_id]: {
                          primario: e.target.value as Canal,
                          fallback: fallbackFor(m.person_id),
                        },
                      })
                    }
                    className="border border-[var(--g-border-default)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)] px-2 py-1"
                    style={{ borderRadius: 'var(--g-radius-sm)' }}
                  >
                    <option value="EMAIL_NORMAL">Email</option>
                    <option value="EMAIL_CERTIFICADO">Email certificado</option>
                    <option value="BUROFAX_ERDS">Burofax ERDS</option>
                  </select>
                </td>
                <td className="px-4 py-2">
                  <select
                    value={fallbackFor(m.person_id) ?? ''}
                    onChange={(e) =>
                      setRecipientChannels({
                        ...recipientChannels,
                        [m.person_id]: {
                          primario: channelFor(m.person_id),
                          fallback: e.target.value ? (e.target.value as Canal) : null,
                        },
                      })
                    }
                    className="border border-[var(--g-border-default)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)] px-2 py-1"
                    style={{ borderRadius: 'var(--g-radius-sm)' }}
                  >
                    <option value="">Ninguno</option>
                    <option value="EMAIL_NORMAL">Email</option>
                    <option value="EMAIL_CERTIFICADO">Email certificado</option>
                    <option value="BUROFAX_ERDS">Burofax ERDS</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && (
        <div
          className="p-3 border border-[var(--status-error)] text-[var(--status-error)] bg-[var(--g-surface-card)]"
          style={{ borderRadius: 'var(--g-radius-md)' }}
        >
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleProgramar}
          disabled={!plazo.isValid || submitting}
          className="bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ borderRadius: 'var(--g-radius-md)' }}
          aria-busy={submitting}
        >
          {submitting ? 'Programando…' : 'Programar envío'}
        </button>
        {props.onCancel && (
          <button
            type="button"
            onClick={props.onCancel}
            className="border border-[var(--g-border-subtle)] bg-transparent text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] px-4 py-2"
            style={{ borderRadius: 'var(--g-radius-md)' }}
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}
