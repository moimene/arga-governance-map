/**
 * Deterministic, dependency-free OOXML renderer for the authoritative
 * convocatoria manifest.  Keeping ZIP creation here (instead of in the
 * browser) makes the exact Word binary a reproducible server artifact.
 */

export const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const RENDERER_CONTRACT_VERSION = '2026-07-21.1';

type JsonRecord = Record<string, unknown>;

export interface RenderedConvocationDocx {
  bytes: Uint8Array;
  fileName: string;
  documentXml: string;
}

interface Paragraph {
  text: string;
  style?: 'Title' | 'Subtitle' | 'Heading1' | 'Heading2' | 'Warning' | 'Small';
  boldPrefix?: string;
  pageBreakBefore?: boolean;
}

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return fallback;
}

interface CodePresentation {
  label: string;
  preserveCode?: boolean;
}

const CODE_PRESENTATIONS: Record<string, CodePresentation> = {
  ES: { label: 'España', preserveCode: true },
  CDA: { label: 'Consejo de Administración', preserveCode: true },
  CONSEJO_ADMINISTRACION: { label: 'Consejo de Administración', preserveCode: true },
  DEMO: { label: 'Datos de demostración', preserveCode: true },
  DEMO_OPERATIONAL_DRAFT_RECORDED: {
    label: 'Borrador operativo DEMO registrado',
    preserveCode: true,
  },
  PRESIDENTE: { label: 'Presidente' },
  VOCAL: { label: 'Vocal' },
  VIGENTE: { label: 'Vigente' },
  AUTHORITY_EVIDENCE: { label: 'Censo de autoridad', preserveCode: true },
  PRESIDENTE_ART_246_1: {
    label: 'Competencia del Presidente conforme al artículo 246.1 LSC',
    preserveCode: true,
  },
  GENERAL_PUBLIC_POWER_ART_183_1: {
    label: 'Poder general en documento público conforme al artículo 183.1 LSC',
    preserveCode: true,
  },
  DEMO_SYSTEM_RECORD_NO_LEGAL_EFFECT: {
    label: 'Registro técnico DEMO sin efecto jurídico',
    preserveCode: true,
  },
  DEMO_WORM_RECORD_NO_LEGAL_EFFECT: {
    label: 'Registro WORM DEMO sin efecto jurídico',
    preserveCode: true,
  },
  DEMO_SIMULATION_NO_LEGAL_EFFECT: {
    label: 'Simulación DEMO sin efecto jurídico',
    preserveCode: true,
  },
  PRESENCIAL: { label: 'Presencial' },
  INFORMATIVA: { label: 'Informativo' },
  INFORMATIVO: { label: 'Informativo' },
  DECISORIA: { label: 'Decisorio' },
  DECISORIO: { label: 'Decisorio' },
  CONSTITUTIVE: { label: 'Constitutivo', preserveCode: true },
  INFORME_DG_MARCHA_SOCIEDAD: {
    label: 'Informe del Director General sobre la marcha de la Sociedad',
    preserveCode: true,
  },
  INFORME_GOBIERNO_CORPORATIVO_CUMPLIMIENTO: {
    label: 'Informe de gobierno corporativo y cumplimiento',
    preserveCode: true,
  },
  INFORME_GOBIERNO_CUMPLIMIENTO: {
    label: 'Informe de gobierno corporativo y cumplimiento',
    preserveCode: true,
  },
  FORMULACION_CUENTAS: {
    label: 'Formulación de cuentas anuales',
    preserveCode: true,
  },
  DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL: {
    label: 'Designación de representante de la socia única en la filial',
    preserveCode: true,
  },
  OTORGAMIENTO_PODERES: {
    label: 'Otorgamiento de poderes',
    preserveCode: true,
  },
  OTORGAMIENTO_PODERES_CFO: {
    label: 'Otorgamiento de poderes generales al CFO',
    preserveCode: true,
  },
  SANDBOX_ONLY: { label: 'Solo entorno de simulación', preserveCode: true },
  EAD_INTERPOSITION: { label: 'Interposición EAD Trust', preserveCode: true },
  SANDBOX_EAD_INTERPOSITION: {
    label: 'Interposición EAD Trust en entorno de simulación',
    preserveCode: true,
  },
  EMAIL_SIMPLE: { label: 'Correo electrónico ordinario', preserveCode: true },
  SANDBOX_EMAIL_SIMPLE: {
    label: 'Correo electrónico ordinario en entorno de simulación',
    preserveCode: true,
  },
  ERDS: { label: 'Canal heredado no admitido', preserveCode: true },
  SANDBOX_ERDS: {
    label: 'Canal heredado no admitido en entorno de simulación',
    preserveCode: true,
  },
};

function displayCode(value: unknown): string {
  const raw = text(value);
  if (!raw) return '';
  const presentation = CODE_PRESENTATIONS[raw.toLocaleUpperCase('es-ES')];
  if (presentation) {
    return `${presentation.label} (${raw})`;
  }
  const readable = raw.replaceAll('_', ' ').toLocaleLowerCase('es-ES');
  const label = readable.charAt(0).toLocaleUpperCase('es-ES') + readable.slice(1);
  return /^[A-Z0-9][A-Z0-9_.:-]*$/.test(raw) ? `${label} (${raw})` : label;
}

function displayLabel(value: unknown): string {
  const raw = text(value);
  if (!raw) return '';
  const presentation = CODE_PRESENTATIONS[raw.toLocaleUpperCase('es-ES')];
  if (presentation) return presentation.label;
  const readable = raw.replaceAll('_', ' ').toLocaleLowerCase('es-ES');
  return readable.charAt(0).toLocaleUpperCase('es-ES') + readable.slice(1);
}

function displayBoolean(value: unknown): string {
  if (value === true) return 'Sí';
  if (value === false) return 'No';
  return '';
}

function displayPercent(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 6 }).format(value)} %`;
  }
  const raw = text(value);
  return raw ? `${raw} %` : 'No consta';
}

function xmlEscape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function safeFilePart(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'convocatoria';
}

const UUID_REFERENCE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;
const INTERNAL_URI_REFERENCE = /\b(?:evidence-bundle|supabase|storage|s3):\/\//i;
const FORBIDDEN_CERTIFIED_CHANNEL = /^(?:SANDBOX_)?(?:ERDS|BUROFAX_ERDS|EMAIL_CERTIFICADO)$/i;
const ALLOWED_PUBLICATION_CHANNEL = /^(?:SANDBOX_)?(?:EAD_INTERPOSITION|EMAIL_SIMPLE)$/i;

function assertLegalTextIsPublicFacing(value: unknown, field: string): void {
  if (typeof value !== 'string' || value.length === 0) return;
  if (UUID_REFERENCE.test(value) || INTERNAL_URI_REFERENCE.test(value)) {
    throw new Error(`${field} exposes an internal technical reference`);
  }
}

function assertRendererContract(manifest: JsonRecord): void {
  if (text(manifest.renderer_contract_version) !== RENDERER_CONTRACT_VERSION) {
    throw new Error(`Manifest renderer contract must be ${RENDERER_CONTRACT_VERSION}`);
  }
  const publication = record(manifest.publication);
  const recipients = array(manifest.recipients).map(record);
  const supportingDocuments = record(manifest.supporting_documents);
  const supportingIntents = array(supportingDocuments.intents).map(record);
  if (
    supportingDocuments.schema_version !== 'secretaria.convocation-supporting-intents.v1'
    || supportingDocuments.completion_policy !== 'EXACT_SET_REQUIRED_BEFORE_FINAL'
    || supportingDocuments.expected_count !== supportingIntents.length
  ) {
    throw new Error('Manifest supporting-document intent set is missing or inconsistent');
  }
  const channels = [
    ...array(publication.requested_channels),
    ...array(publication.sandbox_channels),
    ...recipients.map((recipient) => recipient.channel),
  ].map((channel) => text(channel)).filter(Boolean);
  if (
    channels.length === 0
    || channels.some((channel) => (
      FORBIDDEN_CERTIFIED_CHANNEL.test(channel)
      || !ALLOWED_PUBLICATION_CHANNEL.test(channel)
    ))
  ) {
    throw new Error('Manifest contains a forbidden or unsupported publication channel');
  }
  if (
    publication.delivery_mode !== 'SANDBOX_ONLY'
    || publication.real_delivery_allowed !== false
    || publication.ead_interposition_separate !== true
    || publication.ead_signature_service_required !== false
    || publication.legal_signature_status !== 'NOT_ASSERTED'
  ) {
    throw new Error('Manifest publication policy is not the EAD interposition sandbox contract');
  }

  assertLegalTextIsPublicFacing(manifest.reviewed_demo_draft_text, 'reviewed_demo_draft_text');
  for (const [index, agendaItem] of array(manifest.agenda).map(record).entries()) {
    assertLegalTextIsPublicFacing(agendaItem.title, `agenda[${index}].title`);
    assertLegalTextIsPublicFacing(agendaItem.proposal_text, `agenda[${index}].proposal_text`);
  }
}

function addField(paragraphs: Paragraph[], label: string, value: unknown): void {
  const resolved = text(value);
  if (!resolved) return;
  paragraphs.push({ text: `${label}: ${resolved}`, boldPrefix: `${label}:` });
}

function addVerbatimMultiline(paragraphs: Paragraph[], value: unknown): void {
  if (typeof value !== 'string' || value.length === 0) return;
  // Do not trim or discard blank lines: this is the exact reviewed DEMO body whose
  // source hash is part of the immutable manifest.
  for (const line of value.split(/\r?\n/)) paragraphs.push({ text: line });
}

function addPublicMultiline(paragraphs: Paragraph[], value: unknown): void {
  const resolved = text(value);
  if (!resolved) return;
  for (const line of resolved.split(/\r?\n/)) {
    if (line.trim()) paragraphs.push({ text: line.trim() });
  }
}

/**
 * Produces the complete human-facing content.  Fields which carry a DEMO
 * legal posture remain visibly qualified; EAD is described only as a
 * separate interposition/messaging/custody service.
 */
export function buildConvocationParagraphs(
  manifestValue: unknown,
  manifestHashSha512: string,
): Paragraph[] {
  const manifest = record(manifestValue);
  assertRendererContract(manifest);
  const entity = record(manifest.entity);
  const body = record(manifest.body);
  const authority = record(manifest.authority);
  const meeting = record(manifest.meeting);
  const publication = record(manifest.publication);
  const approvedTemplate = record(manifest.approved_template);
  const documentSource = record(manifest.document_source);
  const agenda = array(manifest.agenda).map(record);
  const recipients = array(manifest.recipients).map(record);
  const supportingDocuments = record(manifest.supporting_documents);
  const supportingIntents = array(supportingDocuments.intents).map(record);

  const entityName = text(entity.legal_name, 'Sociedad no identificada');
  const bodyName = text(body.name, 'Órgano no identificado');
  const legalEffect = text(manifest.legal_effect);
  const isDemo = text(manifest.data_class) === 'DEMO'
    && legalEffect === 'DEMO_SIMULATION_NO_LEGAL_EFFECT';

  const paragraphs: Paragraph[] = [
    { text: 'SIMULACIÓN DEMO — BORRADOR OPERATIVO DE CONVOCATORIA', style: 'Title' },
    { text: entityName, style: 'Subtitle' },
  ];

  if (isDemo) {
    paragraphs.push({
      text: 'DOCUMENTO DE DEMOSTRACIÓN — SIN EFECTOS JURÍDICOS. La interposición, la mensajería y la custodia documental de EAD Trust son servicios separados y no sustituyen los actos jurídicos exigibles.',
      style: 'Warning',
    });
  }

  paragraphs.push({ text: 'Texto íntegro revisado de la convocatoria DEMO', style: 'Heading1' });
  addVerbatimMultiline(paragraphs, manifest.reviewed_demo_draft_text);

  paragraphs.push({ text: 'Propuestas sometidas al órgano', style: 'Heading1' });
  for (const [index, item] of agenda.entries()) {
    if (!text(item.proposal_text)) continue;
    const orderNumber = text(item.order_number, String(index + 1));
    const title = text(item.title, 'Punto sin título');
    paragraphs.push({ text: `Punto ${orderNumber}. ${title}`, style: 'Heading2' });
    addPublicMultiline(paragraphs, item.proposal_text);

    const hasRepresentation = Boolean(
      text(item.target_entity_id)
      || text(item.representative_person_id)
      || text(item.representation_delegation_id),
    );
    if (hasRepresentation) {
      paragraphs.push({
        text: 'Referencias estructuradas DEMO, no acreditadas: la eficacia queda condicionada a verificar el poder público, la titularidad del capital y la ausencia de administradora persona jurídica.',
        style: 'Warning',
      });
      addField(paragraphs, 'Filial objetivo', item.target_entity_name);
      addField(paragraphs, 'Representante propuesto', item.representative_name);
      addField(paragraphs, 'Dato DEMO de participación en capital', displayPercent(item.capital_ownership_percentage));
      addField(paragraphs, 'Dato DEMO de derechos de voto', displayPercent(item.capital_voting_percentage));
    }
  }

  paragraphs.push({ text: 'Destinatarios y canal de puesta a disposición', style: 'Heading1' });
  if (recipients.length === 0) {
    paragraphs.push({
      text: 'No constan destinatarios individualizados en el manifiesto autoritativo.',
      style: 'Warning',
    });
  } else {
    for (const [index, recipient] of recipients.entries()) {
      const name = text(recipient.name ?? recipient.full_name ?? recipient.person_name, `Destinatario ${index + 1}`);
      const office = displayLabel(recipient.office ?? recipient.role);
      const email = text(recipient.email);
      const channel = displayLabel(recipient.channel);
      const details = [office, email, channel].filter(Boolean).join(' — ');
      paragraphs.push({ text: `${index + 1}. ${name}${details ? ` — ${details}` : ''}` });
    }
  }

  paragraphs.push({ text: 'Nota sobre EAD Trust', style: 'Heading1' });
  paragraphs.push({
    text: 'La eventual interposición de EAD Trust se limita a la mensajería básica, la custodia y el e-archiving del registro documental. Es un servicio separado del acto societario y no constituye ni sustituye una firma jurídica, el consentimiento del convocante ni ningún otro requisito legal.',
  });
  paragraphs.push({
    text: publication.real_delivery_allowed === false
      ? 'No se autoriza ninguna entrega real desde este expediente DEMO.'
      : 'El manifiesto no contiene una prohibición expresa de entrega real.',
    style: publication.real_delivery_allowed === false ? 'Warning' : 'Small',
  });

  paragraphs.push({
    text: 'Anexo técnico de trazabilidad',
    style: 'Heading1',
    pageBreakBefore: true,
  });
  paragraphs.push({
    text: 'Este anexo conserva identificadores, códigos, rutas, estados, fuentes y huellas del manifiesto. No forma parte del contenido jurídico propuesto ni acredita una actuación personal del Presidente.',
    style: 'Small',
  });

  paragraphs.push({ text: 'A. Identidad e integridad del artefacto', style: 'Heading2' });
  addField(paragraphs, 'Versión de esquema', manifest.schema_version);
  addField(paragraphs, 'Referencia de expediente', manifest.convocatoria_id);
  addField(paragraphs, 'Tenant', manifest.tenant_id);
  addField(paragraphs, 'Clase de datos', displayCode(manifest.data_class));
  addField(paragraphs, 'Efecto jurídico', displayCode(manifest.legal_effect));
  addField(paragraphs, 'Estado del registro', displayCode(manifest.record_status));
  addField(paragraphs, 'Estado de base de datos', displayCode(manifest.database_state));
  addField(paragraphs, 'Fecha de registro DEMO', text(manifest.recorded_at ?? manifest.recorded_on));
  addField(paragraphs, 'Fecha de referencia', manifest.recorded_on);
  addField(paragraphs, 'Usuario registrador', manifest.recorded_by_user_id);
  addField(paragraphs, 'No constituye convocatoria jurídica', displayBoolean(manifest.not_a_legal_convocation));
  addField(paragraphs, 'Actuación del Presidente no afirmada', displayBoolean(manifest.president_action_not_asserted));
  addField(paragraphs, 'SHA-256 del borrador DEMO revisado', manifest.reviewed_demo_draft_text_hash_sha256);
  addField(paragraphs, 'SHA-512 del manifiesto autoritativo', manifestHashSha512);

  paragraphs.push({ text: 'B. Plantilla aprobada y fuente documental', style: 'Heading2' });
  addField(paragraphs, 'ID de plantilla', approvedTemplate.id);
  addField(paragraphs, 'Tipo de plantilla', displayCode(approvedTemplate.type));
  addField(paragraphs, 'Materia de plantilla', displayCode(approvedTemplate.matter));
  addField(paragraphs, 'Versión de plantilla', approvedTemplate.version);
  addField(paragraphs, 'SHA-256 del contenido de plantilla', approvedTemplate.content_hash_sha256);
  addField(paragraphs, 'SHA-256 del texto fuente revisado', documentSource.reviewed_text_hash_sha256);
  addField(paragraphs, 'SHA-512 del texto fuente revisado', documentSource.reviewed_text_hash_sha512);
  addField(paragraphs, 'Política de renderizado', displayCode(documentSource.render_policy));

  paragraphs.push({ text: 'C. Sociedad y órgano — referencias técnicas', style: 'Heading2' });
  addField(paragraphs, 'ID de sociedad', entity.id);
  addField(paragraphs, 'ID de persona jurídica', entity.person_id);
  addField(paragraphs, 'Jurisdicción', displayCode(entity.jurisdiction));
  addField(paragraphs, 'Estado de sociedad', displayCode(entity.entity_status));
  addField(paragraphs, 'Clase de datos de sociedad', displayCode(entity.data_class));
  addField(paragraphs, 'ID de órgano', body.id);
  addField(paragraphs, 'Tipo de órgano', displayCode(body.body_type));

  paragraphs.push({ text: 'D. Competencia y censo — referencias técnicas', style: 'Heading2' });
  addField(paragraphs, 'Titular del cargo de referencia', authority.person_name);
  addField(paragraphs, 'ID de persona titular', authority.person_id);
  addField(paragraphs, 'Cargo acreditado', displayCode(authority.office));
  addField(paragraphs, 'Ruta jurídica de referencia', displayCode(authority.route));
  addField(paragraphs, 'ID de evidencia del cargo', authority.office_evidence_id);
  addField(paragraphs, 'Estado de evidencia del cargo', displayCode(authority.office_evidence_status));
  addField(paragraphs, 'Fuente de evidencia del cargo', displayCode(authority.office_evidence_source));
  addField(paragraphs, 'ID del registro técnico', authority.act_id);
  addField(paragraphs, 'SHA-512 del registro técnico', authority.act_hash_sha512);
  addField(paragraphs, 'Tipo de registro técnico', displayCode(authority.act_type));
  addField(paragraphs, 'Usuario registrador del acto', authority.act_recorded_by);
  addField(paragraphs, 'Fecha del registro técnico', authority.act_recorded_at);
  addField(paragraphs, 'Base del registro técnico DEMO', displayCode(authority.act_basis));
  addField(paragraphs, 'Efecto del registro técnico DEMO', displayCode(authority.act_legal_effect));
  addField(paragraphs, 'Cargo usado solo como referencia', displayBoolean(authority.actor_role_reference_only));
  addField(paragraphs, 'Actuación presidencial no afirmada', displayBoolean(authority.president_action_not_asserted));
  addField(paragraphs, 'Evidencia del cargo no equivale al acto', displayBoolean(authority.office_evidence_is_not_convocation_act));
  addField(paragraphs, 'Servicio de firma EAD requerido', displayBoolean(authority.ead_signature_service_required));
  addField(paragraphs, 'Estado de firma jurídica', displayCode(authority.legal_signature_status));
  addField(paragraphs, 'Requisitos de firma externa', displayCode(authority.external_signature_requirements));
  paragraphs.push({
    text: 'La persona figura exclusivamente como titular del cargo derivado del censo. El registro no afirma que el Presidente haya ordenado, consentido, emitido o firmado una convocatoria.',
    style: 'Warning',
  });

  paragraphs.push({ text: 'E. Sesión y publicación — valores canónicos', style: 'Heading2' });
  addField(paragraphs, 'Primera convocatoria (ISO)', meeting.first_call_at);
  addField(paragraphs, 'Segunda convocatoria (ISO)', meeting.second_call_at);
  addField(paragraphs, 'Modalidad (código)', displayCode(meeting.modality));
  addField(paragraphs, 'Lugar canónico', meeting.place);
  const requestedChannels = array(publication.requested_channels).map(displayCode).filter(Boolean);
  const sandboxChannels = array(publication.sandbox_channels).map(displayCode).filter(Boolean);
  if (requestedChannels.length) addField(paragraphs, 'Canales solicitados', requestedChannels.join(', '));
  if (sandboxChannels.length) addField(paragraphs, 'Canales habilitados en DEMO', sandboxChannels.join(', '));
  addField(paragraphs, 'Modo de entrega', displayCode(publication.delivery_mode));
  addField(paragraphs, 'Entrega real permitida', displayBoolean(publication.real_delivery_allowed));
  addField(paragraphs, 'Interposición EAD separada', displayBoolean(publication.ead_interposition_separate));
  addField(paragraphs, 'Servicio de firma EAD requerido', displayBoolean(publication.ead_signature_service_required));
  addField(paragraphs, 'Estado de firma jurídica', displayCode(publication.legal_signature_status));
  addField(paragraphs, 'Requisitos de firma externa', displayCode(publication.external_signature_requirements));

  paragraphs.push({ text: 'F. Orden del día — referencias técnicas', style: 'Heading2' });
  for (const [index, item] of agenda.entries()) {
    const orderNumber = text(item.order_number, String(index + 1));
    const title = text(item.title, 'Punto sin título');
    paragraphs.push({ text: `F.${orderNumber}. ${title}`, style: 'Small' });
    addField(paragraphs, 'Número de orden canónico', orderNumber);
    addField(paragraphs, 'Naturaleza (código)', displayCode(item.kind ?? item.type));
    addField(paragraphs, 'Materia (código)', displayCode(item.matter_code));
    addField(paragraphs, 'Subtipo de decisión (código)', displayCode(item.decision_subtype));
    addField(paragraphs, 'Adjuntos requeridos', displayBoolean(item.requires_attachments));
    addField(paragraphs, 'ID de filial objetivo', item.target_entity_id);
    addField(paragraphs, 'Filial objetivo', item.target_entity_name);
    addField(paragraphs, 'ID de representante', item.representative_person_id);
    addField(paragraphs, 'Representante propuesto', item.representative_name);
    addField(paragraphs, 'ID de delegación representativa', item.representation_delegation_id);
    addField(paragraphs, 'Ruta de representación', displayCode(item.representation_authority_route));
    addField(paragraphs, 'Estado de evidencia representativa', displayCode(item.representation_evidence_status));
    addField(paragraphs, 'Referencia de la fuente representativa', item.representation_source_reference);
    addField(paragraphs, 'URI de la fuente representativa', item.representation_source_uri);
    addField(paragraphs, 'SHA-512 de la fuente representativa', item.representation_source_hash_sha512);
    addField(paragraphs, 'Efecto de la representación', displayCode(item.representation_legal_effect));
    addField(paragraphs, 'ID de sociedad socia', item.source_shareholder_entity_id);
    addField(paragraphs, 'ID de persona jurídica socia', item.source_shareholder_person_id);
    if (text(item.capital_ownership_percentage)) {
      addField(paragraphs, 'Porcentaje de capital canónico', displayPercent(item.capital_ownership_percentage));
    }
    if (text(item.capital_voting_percentage)) {
      addField(paragraphs, 'Porcentaje de voto canónico', displayPercent(item.capital_voting_percentage));
    }
    addField(paragraphs, 'Estado de evidencia de capital', displayCode(item.capital_evidence_status));
    addField(paragraphs, 'Clase de datos del punto', displayCode(item.data_class));
    addField(paragraphs, 'Efecto jurídico declarado', displayCode(item.legal_effect));
    addField(paragraphs, 'Versión del gate de autoridad', displayCode(item.authority_gate_version));
  }

  if (recipients.length > 0) {
    paragraphs.push({ text: 'G. Destinatarios — referencias técnicas', style: 'Heading2' });
    for (const [index, recipient] of recipients.entries()) {
      const name = text(recipient.name ?? recipient.full_name ?? recipient.person_name, `Destinatario ${index + 1}`);
      paragraphs.push({ text: `G.${index + 1}. ${name}`, style: 'Small' });
      addField(paragraphs, 'ID de persona destinataria', recipient.person_id);
      addField(paragraphs, 'ID de condición censal', recipient.condition_id);
      addField(paragraphs, 'Cargo o rol (código)', displayCode(recipient.office ?? recipient.role));
      addField(paragraphs, 'Destino de mensajería', recipient.email);
      addField(paragraphs, 'Canal (código)', displayCode(recipient.channel));
    }
  }

  paragraphs.push({ text: 'H. Anexos precomprometidos — identidad binaria', style: 'Heading2' });
  if (supportingIntents.length === 0) {
    paragraphs.push({ text: 'El manifiesto WORM no prevé anexos documentales para esta convocatoria.' });
  } else {
    for (const [index, intent] of supportingIntents.entries()) {
      const fileName = text(intent.file_name, `Anexo ${index + 1}`);
      paragraphs.push({ text: `H.${index + 1}. ${fileName}`, style: 'Small' });
      addField(paragraphs, 'Nombre descriptivo', intent.display_name);
      addField(paragraphs, 'Descripción', intent.description);
      addField(paragraphs, 'Tamaño verificado previsto (bytes)', intent.size_bytes);
      addField(paragraphs, 'MIME verificado previsto', intent.mime_type);
      addField(paragraphs, 'SHA-256 previsto', intent.hash_sha256);
      addField(paragraphs, 'SHA-512 previsto', intent.hash_sha512);
      addField(paragraphs, 'Índice de punto del orden del día', intent.agenda_item_index);
      addField(paragraphs, 'Estado de intención', displayCode(intent.intent_state));
    }
  }

  paragraphs.push({
    text: 'Este Word se ha generado en servidor exclusivamente desde el manifiesto autoritativo inmutable. Sus huellas binarias se calculan después del renderizado y no proceden del navegador.',
    style: 'Small',
  });

  return paragraphs;
}

function runXml(textValue: string, bold = false): string {
  const preserve = /^\s|\s$|\s{2,}/.test(textValue) ? ' xml:space="preserve"' : '';
  return `<w:r>${bold ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t${preserve}>${xmlEscape(textValue)}</w:t></w:r>`;
}

function paragraphXml(paragraph: Paragraph): string {
  const properties: string[] = [];
  if (paragraph.style) properties.push(`<w:pStyle w:val="${paragraph.style}"/>`);
  if (paragraph.pageBreakBefore) properties.push('<w:pageBreakBefore/>');
  let runs = '';
  if (paragraph.boldPrefix && paragraph.text.startsWith(paragraph.boldPrefix)) {
    runs = runXml(paragraph.boldPrefix, true)
      + runXml(paragraph.text.slice(paragraph.boldPrefix.length));
  } else {
    runs = runXml(paragraph.text);
  }
  return `<w:p>${properties.length ? `<w:pPr>${properties.join('')}</w:pPr>` : ''}${runs}</w:p>`;
}

function buildDocumentXml(paragraphs: Paragraph[]): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${paragraphs.map(paragraphXml).join('\n    ')}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

const DOCUMENT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
</Relationships>`;

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:sz w:val="21"/><w:lang w:val="es-ES"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Título"/><w:basedOn w:val="Normal"/><w:next w:val="Subtitle"/><w:qFormat/><w:pPr><w:jc w:val="center"/><w:spacing w:before="240" w:after="180"/></w:pPr><w:rPr><w:b/><w:color w:val="004438"/><w:sz w:val="32"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtítulo"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:jc w:val="center"/><w:spacing w:after="300"/></w:pPr><w:rPr><w:b/><w:color w:val="4A4A49"/><w:sz w:val="24"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="Título 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="300" w:after="120"/></w:pPr><w:rPr><w:b/><w:color w:val="004438"/><w:sz w:val="25"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="Título 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="220" w:after="90"/></w:pPr><w:rPr><w:b/><w:color w:val="007362"/><w:sz w:val="22"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Warning"><w:name w:val="Aviso demo"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:shd w:fill="D8ECE7"/><w:spacing w:before="120" w:after="180"/><w:ind w:left="180" w:right="180"/></w:pPr><w:rPr><w:b/><w:color w:val="004438"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Small"><w:name w:val="Trazabilidad"/><w:basedOn w:val="Normal"/><w:qFormat/><w:rPr><w:color w:val="50564F"/><w:sz w:val="18"/></w:rPr></w:style>
</w:styles>`;

const SETTINGS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:zoom w:percent="100"/><w:defaultTabStop w:val="708"/><w:compat/></w:settings>`;

function coreProperties(createdAt: string): string {
  const parsed = new Date(createdAt);
  const iso = Number.isNaN(parsed.getTime())
    ? '1980-01-01T00:00:00.000Z'
    : parsed.toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Convocatoria autoritativa</dc:title><dc:creator>TGMS Secretaría Societaria</dc:creator><cp:lastModifiedBy>TGMS Secretaría Societaria</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${xmlEscape(iso)}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${xmlEscape(iso)}</dcterms:modified>
</cp:coreProperties>`;
}

const APP_PROPERTIES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>TGMS Secretaría Societaria</Application><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop><Company>ARGA</Company><AppVersion>1.0</AppVersion></Properties>`;

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value: number): Uint8Array {
  const result = new Uint8Array(2);
  new DataView(result.buffer).setUint16(0, value, true);
  return result;
}

function u32(value: number): Uint8Array {
  const result = new Uint8Array(4);
  new DataView(result.buffer).setUint32(0, value >>> 0, true);
  return result;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}

/** Creates a deterministic ZIP using STORE entries and the DOS epoch. */
export function createDeterministicZip(files: Array<[string, Uint8Array]>): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  for (const [name, data] of files) {
    const fileName = encoder.encode(name);
    const checksum = crc32(data);
    const localHeader = concat([
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0x0021),
      u32(checksum), u32(data.byteLength), u32(data.byteLength),
      u16(fileName.byteLength), u16(0), fileName,
    ]);
    localParts.push(localHeader, data);
    centralParts.push(concat([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0x0021),
      u32(checksum), u32(data.byteLength), u32(data.byteLength),
      u16(fileName.byteLength), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), fileName,
    ]));
    offset += localHeader.byteLength + data.byteLength;
  }
  const centralDirectory = concat(centralParts);
  const end = concat([
    u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
    u32(centralDirectory.byteLength), u32(offset), u16(0),
  ]);
  return concat([...localParts, centralDirectory, end]);
}

export function renderConvocationDocx(
  manifestValue: unknown,
  manifestHashSha512: string,
): RenderedConvocationDocx {
  const manifest = record(manifestValue);
  const paragraphs = buildConvocationParagraphs(manifest, manifestHashSha512);
  const documentXml = buildDocumentXml(paragraphs);
  const encoder = new TextEncoder();
  const files: Array<[string, Uint8Array]> = [
    ['[Content_Types].xml', encoder.encode(CONTENT_TYPES)],
    ['_rels/.rels', encoder.encode(ROOT_RELS)],
    ['docProps/app.xml', encoder.encode(APP_PROPERTIES)],
    ['docProps/core.xml', encoder.encode(coreProperties(text(manifest.recorded_at ?? manifest.recorded_on)))],
    ['word/_rels/document.xml.rels', encoder.encode(DOCUMENT_RELS)],
    ['word/document.xml', encoder.encode(documentXml)],
    ['word/settings.xml', encoder.encode(SETTINGS)],
    ['word/styles.xml', encoder.encode(STYLES)],
  ];
  const entityName = text(record(manifest.entity).legal_name, 'ARGA');
  const recordedOn = text(manifest.recorded_on, 'sin_fecha');
  return {
    bytes: createDeterministicZip(files),
    fileName: `${safeFilePart(`Simulacion_DEMO_Convocatoria_${entityName}_${recordedOn}`)}.docx`,
    documentXml,
  };
}

export function assertExactBinaryIdentity(
  expected: { hashSha256: string; hashSha512: string; sizeBytes: number; storageUri: string },
  actual: { hashSha256?: string | null; hashSha512?: string | null; sizeBytes?: number | null; storageUri?: string | null },
): void {
  if (
    actual.hashSha256 !== expected.hashSha256
    || actual.hashSha512 !== expected.hashSha512
    || actual.sizeBytes !== expected.sizeBytes
    || actual.storageUri !== expected.storageUri
  ) {
    throw new Error('An immutable convocatoria binary already exists with a different identity');
  }
}
