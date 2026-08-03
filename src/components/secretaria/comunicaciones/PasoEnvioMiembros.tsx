import { useMemo, useState } from 'react';
import { useBodyMandates } from '@/hooks/useBodies';
import { useCommsPlazoCheck } from '@/hooks/useCommsPlazoCheck';
import { triggerDispatcher } from '@/hooks/useCommunicationActions';
import { useTenantContext } from '@/context/TenantContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { Canal, NivelCertificacion, OrganoTipo, TipoComunicacion } from '@/lib/comms/types';
import { EAD_INTERPOSITION_CHANNEL } from '@/lib/secretaria/ead-channel-semantics';

type NewCommunicationChannel =
  | Exclude<Canal, 'EMAIL_CERTIFICADO' | 'BUROFAX_ERDS' | 'PORTAL_PUSH'>
  | typeof EAD_INTERPOSITION_CHANNEL
  | 'EMAIL_SIMPLE';

type NewConstancyLevel =
  | Exclude<NivelCertificacion, 'EMAIL_CERTIFICADO' | 'BUROFAX_ERDS'>
  | typeof EAD_INTERPOSITION_CHANNEL;

export interface PasoEnvioMiembrosProps {
  bodyId: string;
  entityId: string;
  organoTipo: OrganoTipo;
  convocatoriaId?: string | null;
  meetingId?: string | null;
  agreementId?: string | null;
  meetingDate?: Date | null;
  agreementDate?: Date | null;
  documentUri: string;
  sourceAttachmentId?: string | null;
  documentHashSha256?: string | null;
  /** SHA-512 del binario real, nunca del URI lógico. */
  documentHash?: string;
  documentLabel?: string;
  documentMimeType?: string;
  documentTipo?: 'DOCUMENTO_GENERADO' | 'INFORME_PRECEPTIVO' | 'EXPEDIENTE_REF' | 'TEXTO_INTEGRO' | 'ORDEN_DIA' | 'OTRO';
  documentSizeBytes?: number;
  documentModoEntrega?: 'ADJUNTO' | 'LINK_FIRMADO';
  supportingAttachments?: Array<{
    id: string;
    fileName: string;
    fileUrl: string;
    hashSha256: string | null;
    hashSha512: string | null;
    agendaItemIndex?: number | null;
  }>;
  /** Snapshot WORM de destinatarios de la convocatoria. Cuando existe, es la
   * única fuente permitida para preparar su comunicación y conserva las
   * exclusiones revisadas en el stepper. */
  canonicalRecipients?: Array<{
    personId: string;
    conditionId: string;
    name: string;
    office: string;
    email: string;
    channel: typeof EAD_INTERPOSITION_CHANNEL | 'EMAIL_SIMPLE';
  }>;
  templateId?: string | null;
  tipoComunicacion?: TipoComunicacion;
  /**
   * Circuito DEMO sin entrega: crea únicamente el agregado BORRADOR y nunca
   * despierta el dispatcher ni permite que exista una reserva de proveedor.
   */
  demoSandboxOnly?: boolean;
  asunto: string;
  cuerpoHtml: string;
  onProgramado?: (
    communicationId: string,
    result: {
      estado: 'BORRADOR' | 'PROGRAMADA';
      dispatcherTriggered: boolean;
      providerInteraction: 'NONE' | 'DISPATCHER_TRIGGERED';
    },
  ) => void | Promise<void>;
  onCancel?: () => void;
}

function attachmentMimeFromName(fileName: string): string {
  return fileName.toLowerCase().endsWith('.docx')
    ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    : 'application/pdf';
}

const DEFAULT_NIVEL_BY_ORGANO: Record<
  OrganoTipo,
  Exclude<NivelCertificacion, 'EMAIL_CERTIFICADO' | 'BUROFAX_ERDS'>
> = {
  JUNTA_GENERAL: 'EMAIL_NORMAL',
  CONSEJO_ADMIN: 'EMAIL_NORMAL',
  COMISION_DELEGADA: 'EMAIL_NORMAL',
  SOCIO_UNICO: 'EMAIL_NORMAL',
  ADMIN_UNICO: 'EMAIL_NORMAL',
  ADMIN_CONJUNTA: 'EMAIL_NORMAL',
  ADMIN_SOLIDARIOS: 'EMAIL_NORMAL',
};

function transportChannelForNewCapture(
  channel: NewCommunicationChannel,
): Exclude<Canal, 'EMAIL_CERTIFICADO' | 'BUROFAX_ERDS' | 'PORTAL_PUSH'> {
  // En sandbox no existe transporte EAD: el valor autoritativo se conserva en
  // metadata y la columna legacy queda neutral para impedir cualquier claim.
  return channel === EAD_INTERPOSITION_CHANNEL || channel === 'EMAIL_SIMPLE'
    ? 'EMAIL_NORMAL'
    : channel;
}

const POLITICAL_SEAT_ROLES = new Set([
  'CONSEJERO',
  'PRESIDENTE',
  'VICEPRESIDENTE',
  'CONSEJERO_COORDINADOR',
]);

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
  const { data: mandates, isLoading: loadingMembers } = useBodyMandates(props.bodyId);
  const activeMembers = useMemo(() => {
    if (props.canonicalRecipients) {
      return props.canonicalRecipients.map((recipient) => ({
        id: recipient.conditionId,
        person_id: recipient.personId,
        role: recipient.office,
        full_name: recipient.name,
        email: recipient.email,
      }));
    }
    const effectiveDay = (props.meetingDate ?? new Date()).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    const byPerson = new Map<string, NonNullable<typeof mandates>[number]>();
    for (const mandate of mandates ?? []) {
      const role = String(mandate.role ?? '').toUpperCase();
      const state = String(mandate.source_status ?? '').toUpperCase();
      const stateValid = effectiveDay > today
        ? state === 'VIGENTE' || state === 'PROGRAMADO'
        : effectiveDay < today
          ? state === 'VIGENTE' || state === 'CESADO'
          : state === 'VIGENTE';
      if (
        !mandate.person_id ||
        !POLITICAL_SEAT_ROLES.has(role) ||
        String(mandate.seat_semantics ?? 'PRIMARY').toUpperCase() === 'ACCESSORY' ||
        !stateValid ||
        (mandate.start_date && mandate.start_date > effectiveDay) ||
        (mandate.end_date && mandate.end_date < effectiveDay)
      ) continue;
      if (!byPerson.has(mandate.person_id)) byPerson.set(mandate.person_id, mandate);
    }
    return [...byPerson.values()];
  }, [mandates, props.canonicalRecipients, props.meetingDate]);

  const defaultNivel: NewConstancyLevel = props.demoSandboxOnly
    ? EAD_INTERPOSITION_CHANNEL
    : DEFAULT_NIVEL_BY_ORGANO[props.organoTipo];
  const [nivel, setNivel] = useState<NewConstancyLevel>(defaultNivel);
  const [fechaProgramada, setFechaProgramada] = useState<Date>(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 5);
    return d;
  });
  const [recipientChannels, setRecipientChannels] = useState<
    Record<string, { primario: NewCommunicationChannel; fallback: NewCommunicationChannel | null }>
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

  function channelFor(personId: string): NewCommunicationChannel {
    if (props.canonicalRecipients) {
      return props.canonicalRecipients.find((recipient) => recipient.personId === personId)?.channel
        ?? EAD_INTERPOSITION_CHANNEL;
    }
    return recipientChannels[personId]?.primario ?? nivel;
  }
  function fallbackFor(personId: string): NewCommunicationChannel | null {
    if (props.canonicalRecipients) return null;
    return recipientChannels[personId]?.fallback ?? null;
  }

  async function handleProgramar() {
    if (submitting) return;
    setError(null);
    if (activeMembers.length === 0) {
      setError('No hay miembros vigentes en el órgano.');
      return;
    }
    const sandboxDraft = props.demoSandboxOnly === true;
    if (!sandboxDraft && !plazo.isValid) {
      setError(plazo.reason);
      return;
    }

    const requestedChannelIntents = activeMembers.map((member) => ({
      person_id: member.person_id,
      canal_primario: channelFor(member.person_id),
      canal_fallback: fallbackFor(member.person_id),
    }));
    const usesEadInterposition = requestedChannelIntents.some(
      (recipient) =>
        recipient.canal_primario === EAD_INTERPOSITION_CHANNEL ||
        recipient.canal_fallback === EAD_INTERPOSITION_CHANNEL,
    );
    if (!sandboxDraft && usesEadInterposition) {
      setError(
        'La interposición EAD solo está habilitada en este flujo como preparación sandbox. ' +
        'Falta evidencia contractual explícita para una entrega real.',
      );
      return;
    }

    const isConvocatoria = (props.tipoComunicacion ?? 'CONVOCATORIA') === 'CONVOCATORIA';
    if (isConvocatoria) {
      if (!props.convocatoriaId) {
        setError('Falta el vínculo autoritativo con la convocatoria emitida.');
        return;
      }
      if (!props.sourceAttachmentId) {
        setError('Genera y archiva primero el DOCX final de la convocatoria.');
        return;
      }
      if (!props.documentUri.startsWith(`evidence-bundle://convocatorias/${props.convocatoriaId}/`)) {
        setError('El documento no apunta al objeto privado de Storage de esta convocatoria.');
        return;
      }
      if (!/^[0-9a-f]{64}$/.test(props.documentHashSha256 ?? '')) {
        setError('Falta el SHA-256 verificado del binario de la convocatoria.');
        return;
      }
      if (!/^[0-9a-f]{128}$/.test(props.documentHash ?? '')) {
        setError('Falta el SHA-512 verificado del binario de la convocatoria.');
        return;
      }
      const invalidSupportingAttachment = (props.supportingAttachments ?? []).find(
        (attachment) =>
          !attachment.fileUrl.startsWith(`evidence-bundle://convocatorias/${props.convocatoriaId}/`) ||
          !/^[0-9a-f]{64}$/.test(attachment.hashSha256 ?? '') ||
          !/^[0-9a-f]{128}$/.test(attachment.hashSha512 ?? ''),
      );
      if (invalidSupportingAttachment) {
        setError(
          `El documento de soporte «${invalidSupportingAttachment.fileName}» no tiene URI privada y hashes SHA-256/SHA-512 válidos.`,
        );
        return;
      }
    }

    const recipientsWithoutEmail = activeMembers.filter((m) => !m.email?.trim());
    if (recipientsWithoutEmail.length > 0) {
      setError(
        `Falta un destino para ${recipientsWithoutEmail.length} miembro(s) del censo. ` +
        'Completa el directorio o registra una alternativa formal con método, destino, causa y referencia de evidencia.',
      );
      return;
    }
    const recipientsWithEmail = activeMembers;

    setSubmitting(true);
    try {
      // CRITICAL fix: cuerpo_hash and document_hash are DISTINCT.
      // cuerpo_hash_sha512 = SHA-512 del cuerpo HTML exacto.
      // attachment.hash_sha512 = SHA-512 of the attached document (separate evidence)
      const cuerpoHash = await sha512Hex(props.cuerpoHtml);
      const docHash = props.documentHash ?? (await sha512Hex(props.documentUri));

      const attachments = [
        {
          tipo: props.documentTipo ?? 'DOCUMENTO_GENERADO',
          label: props.documentLabel ?? 'Documento',
          source_attachment_id: props.sourceAttachmentId ?? null,
          storage_uri: props.documentUri,
          hash_sha256: props.documentHashSha256 ?? null,
          hash_sha512: docHash,
          size_bytes: props.documentSizeBytes ?? null,
          mime_type: props.documentMimeType ?? 'application/pdf',
          orden: 0,
          modo_entrega: props.documentModoEntrega ?? 'ADJUNTO',
          signed_url_expiry_hours: 168,
        },
        ...(props.supportingAttachments ?? []).map((attachment, index) => ({
          tipo: 'OTRO' as const,
          label: attachment.fileName,
          source_attachment_id: attachment.id,
          storage_uri: attachment.fileUrl,
          hash_sha256: attachment.hashSha256,
          hash_sha512: attachment.hashSha512,
          size_bytes: null,
          mime_type: attachmentMimeFromName(attachment.fileName),
          orden: index + 1,
          modo_entrega: 'ADJUNTO' as const,
          signed_url_expiry_hours: 168,
        })),
      ];

      const recipientsPayload = recipientsWithEmail.map((m) => {
        const requestedChannel = channelFor(m.person_id);
        const requestedFallback = fallbackFor(m.person_id);
        const canal = transportChannelForNewCapture(requestedChannel);
        const persistedFallback = requestedFallback
          ? transportChannelForNewCapture(requestedFallback)
          : null;
        const fb = persistedFallback === canal ? null : persistedFallback;
        return {
          person_id: m.person_id,
          cargo_en_organo: m.role,
          canal_primario: canal,
          canal_fallback: fb,
          destino_primario: m.email,
          destino_fallback: null,
          delivery_alternative: null,
        };
      });
      const requestedState = sandboxDraft ? 'BORRADOR' : 'PROGRAMADA';
      const persistedNivel = nivel === EAD_INTERPOSITION_CHANNEL
        ? 'EMAIL_NORMAL'
        : nivel;

      // ATOMIC RPC: communications + attachments + recipients in one transaction.
      // If any insert fails (e.g. tg_communications_validate_plazo blocks), all rollback.
      const { data: commId, error: rpcErr } = await supabase.rpc('fn_create_communication_atomic', {
        p_comm: {
          entity_id: props.entityId,
          body_id: props.bodyId,
          organo_tipo: props.organoTipo,
          agreement_id: props.agreementId ?? null,
          meeting_id: props.meetingId ?? null,
          convocatoria_id: props.convocatoriaId ?? null,
          template_id: props.templateId ?? null,
          tipo_comunicacion: props.tipoComunicacion ?? 'CONVOCATORIA',
          tipo_respuesta_esperada: 'ACUSE',
          nivel_certificacion_minimo: persistedNivel,
          asunto: props.asunto,
          cuerpo_render: props.cuerpoHtml,
          cuerpo_hash_sha512: cuerpoHash,
          estado: requestedState,
          fecha_programada: sandboxDraft ? null : fechaProgramada.toISOString(),
          metadata: {
            source: 'PasoEnvioMiembros',
            sandbox_only: sandboxDraft,
            delivery_disabled: sandboxDraft,
            convocatoria_id: props.convocatoriaId ?? null,
            source_attachment_id: props.sourceAttachmentId ?? null,
            document_hash_sha256: props.documentHashSha256 ?? null,
            document_hash_sha512: docHash,
            supporting_attachment_ids: (props.supportingAttachments ?? []).map((attachment) => attachment.id),
            channel_semantics: {
              version: 1,
              requested_minimum: nivel,
              recipients: requestedChannelIntents,
            },
            ead_service: usesEadInterposition
              ? {
                  mode: EAD_INTERPOSITION_CHANNEL,
                  policy_scope: ['BASIC_MESSAGING', 'CUSTODY', 'EARCHIVING'],
                  environment: sandboxDraft ? 'SANDBOX' : 'UNAVAILABLE',
                  delivery_allowed: false,
                  provider_interaction: false,
                  provider_contract_evidence: null,
                  signature_claim: false,
                  erds_claim: false,
                }
              : null,
            // El dispatcher legacy solo activa Notice Manager con un modo EAD
            // contractual expreso. Esta demo no lo tiene.
            ead_delivery_mode: null,
          },
        },
        p_attachments: attachments,
        p_recipients: recipientsPayload,
      });

      if (rpcErr || !commId) {
        throw new Error(rpcErr?.message ?? 'Failed to create communication');
      }

      // En sandbox el agregado queda deliberadamente en BORRADOR: no se
      // despierta el dispatcher y, por tanto, no puede existir claim ni
      // interacción con proveedor. El flujo ordinario conserva la promoción
      // atómica a PROGRAMADA y el cron sigue siendo su fallback.
      if (!sandboxDraft) {
        await triggerDispatcher();
      }
      await props.onProgramado?.(commId as string, {
        estado: requestedState,
        dispatcherTriggered: !sandboxDraft,
        providerInteraction: sandboxDraft ? 'NONE' : 'DISPATCHER_TRIGGERED',
      });
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
        <h3 className="text-xl font-semibold text-[var(--g-text-primary)]">
          {props.demoSandboxOnly ? 'Preparación sandbox para miembros del órgano' : 'Envío a miembros del órgano'}
        </h3>
        <p className="text-sm text-[var(--g-text-secondary)] mt-1">
          {activeMembers.length} miembros vigentes
          {missingEmail.length > 0 && (
            <span className="text-[var(--status-warning)]"> · {missingEmail.length} sin email</span>
          )}
        </p>
      </header>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-[var(--g-text-primary)]">
          Modo de comunicación y constancia
        </label>
        <select
          value={nivel}
          disabled={Boolean(props.canonicalRecipients)}
          onChange={(e) => setNivel(e.target.value as NewConstancyLevel)}
          className="border border-[var(--g-border-default)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)] px-3 py-2 disabled:cursor-not-allowed disabled:opacity-70"
          style={{ borderRadius: 'var(--g-radius-md)' }}
        >
          <option value="EMAIL_NORMAL">Email ordinario (sin prueba de entrega)</option>
          {props.demoSandboxOnly ? (
            <option value={EAD_INTERPOSITION_CHANNEL}>
              EAD Trust · interposición sandbox, mensajería básica y custodia
            </option>
          ) : null}
        </select>
        {nivel === EAD_INTERPOSITION_CHANNEL ? (
          <p className="text-xs text-[var(--g-text-secondary)]">
            Registra una intención de interposición y e-archiving. No afirma firma, ERDS, envío, entrega ni interacción con EAD Trust.
          </p>
        ) : null}
      </div>

      {props.demoSandboxOnly ? (
        <div
          className="border-l-4 border-[var(--status-warning)] bg-[var(--g-surface-subtle)] p-3 text-sm text-[var(--g-text-primary)]"
          style={{ borderRadius: 'var(--g-radius-sm)' }}
        >
          Se preparará una comunicación en estado Borrador. La semántica EAD quedará registrada como interposición/mensajería básica/custodia; no se programará el envío, no se activará el dispatcher y no se creará ningún claim ni petición a proveedor.
        </div>
      ) : (
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
      )}

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
                    disabled={Boolean(props.canonicalRecipients)}
                    onChange={(e) =>
                      setRecipientChannels({
                        ...recipientChannels,
                        [m.person_id]: {
                          primario: e.target.value as NewCommunicationChannel,
                          fallback: fallbackFor(m.person_id),
                        },
                      })
                    }
                    className="border border-[var(--g-border-default)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)] px-2 py-1 disabled:cursor-not-allowed disabled:opacity-70"
                    style={{ borderRadius: 'var(--g-radius-sm)' }}
                  >
                    <option value="EMAIL_NORMAL">Email</option>
                    {props.canonicalRecipients?.some((recipient) => recipient.channel === 'EMAIL_SIMPLE') ? (
                      <option value="EMAIL_SIMPLE">Email simple (semántica del manifiesto)</option>
                    ) : null}
                    {props.demoSandboxOnly ? (
                      <option value={EAD_INTERPOSITION_CHANNEL}>EAD Trust · interposición sandbox</option>
                    ) : null}
                  </select>
                </td>
                <td className="px-4 py-2">
                  <select
                    value={fallbackFor(m.person_id) ?? ''}
                    disabled={Boolean(props.canonicalRecipients)}
                    onChange={(e) =>
                      setRecipientChannels({
                        ...recipientChannels,
                        [m.person_id]: {
                          primario: channelFor(m.person_id),
                          fallback: e.target.value ? (e.target.value as NewCommunicationChannel) : null,
                        },
                      })
                    }
                    className="border border-[var(--g-border-default)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)] px-2 py-1 disabled:cursor-not-allowed disabled:opacity-70"
                    style={{ borderRadius: 'var(--g-radius-sm)' }}
                  >
                    <option value="">Ninguno</option>
                    <option value="EMAIL_NORMAL">Email</option>
                    {props.canonicalRecipients?.some((recipient) => recipient.channel === 'EMAIL_SIMPLE') ? (
                      <option value="EMAIL_SIMPLE">Email simple (semántica del manifiesto)</option>
                    ) : null}
                    {props.demoSandboxOnly ? (
                      <option value={EAD_INTERPOSITION_CHANNEL}>EAD Trust · interposición sandbox</option>
                    ) : null}
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
          disabled={(!props.demoSandboxOnly && !plazo.isValid) || submitting || missingEmail.length > 0}
          className="bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ borderRadius: 'var(--g-radius-md)' }}
          aria-busy={submitting}
        >
          {submitting
            ? props.demoSandboxOnly ? 'Preparando borrador…' : 'Programando…'
            : props.demoSandboxOnly ? 'Preparar comunicación sandbox' : 'Programar envío'}
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
