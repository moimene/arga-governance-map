// ============================================================
// QTSP legacy boundary — interposición, mensajería y custodia EAD.
// Las APIs de firma/OCSP se conservan solo como adaptadores fail-closed.
// ============================================================

import type {
  QTSPSignRequest,
  QTSPNotificationRequest,
  ExplainNode,
  Fuente,
} from './types';

// ============================================================
// Result types
// ============================================================

export interface QESSignResult {
  ok: boolean;
  signature_ref: string;
  signer_id: string;
  signer_role: string;
  document_hash: string;
  x509_chain: string[];
  ocsp_status: 'GOOD' | 'REVOKED' | 'UNKNOWN';
  signed_at: string;
  explain: ExplainNode[];
  errors: string[];
}

export interface CertifiedNotificationResult {
  ok: boolean;
  status: 'PENDING' | 'ERROR';
  delivery_ref: null;
  provider_request_id: null;
  requested_at: null;
  recipient_id: string;
  delivered_at: null;
  delivery_proven: false;
  local_message_fingerprint: string;
  evidence_hash: null;
  tsq_token: null;
  archive_status: 'PENDING';
  explain: ExplainNode[];
  errors: string[];
}

export interface PreFirmaValidationResult {
  ok: boolean;
  errors: string[];
  explain: ExplainNode[];
}

export interface OCSPVerificationResult {
  status: 'GOOD' | 'REVOKED' | 'UNKNOWN';
  detail: string;
}

// ============================================================
// Constants
// ============================================================

const KNOWN_SIGNER_ROLES = [
  'SECRETARIO',
  'PRESIDENTE',
  'CONSEJERO',
  'ADMINISTRADOR',
  'SOCIO',
];

const KNOWN_DOCUMENT_TYPES = [
  'ACTA',
  'CERTIFICACION',
  'CONVOCATORIA',
  'ACUERDO',
  'PODER',
];

// ============================================================
// Helper: OCSP Verification
// ============================================================

export function verificarOCSP(signerId: string): OCSPVerificationResult {
  if (!signerId || signerId.trim().length === 0) {
    return {
      status: 'UNKNOWN',
      detail: 'Identificador de firmante vacío — imposible validar',
    };
  }

  return {
    status: 'UNKNOWN',
    detail: `La validación OCSP de firma está retirada para ${signerId}; no se infiere validez.`,
  };
}

/**
 * Adaptador legacy fail-closed. No llama a EAD ni infiere el estado de un
 * certificado porque la aplicación no presta un flujo de firma personal.
 */
export async function verificarOCSPAsync(signerId: string): Promise<OCSPVerificationResult> {
  return verificarOCSP(signerId);
}

// ============================================================
// Helper: deterministic non-cryptographic fingerprint for UI comparison only
// ============================================================

function generateLocalMessageFingerprint(
  subject: string,
  body: string,
  recipient: string
): string {
  const combined = `${subject}:${body}:${recipient}`;
  const hash = combined
    .split('')
    .reduce((acc, char) => {
      return (acc << 5) - acc + char.charCodeAt(0);
    }, 0);
  return `LOCAL-NONCRYPTO-${Math.abs(hash).toString(16).toUpperCase().padStart(8, '0')}`;
}

// ============================================================
// Helper: Create ExplainNode
// ============================================================

function crearExplainNode(
  regla: string,
  fuente: Fuente,
  mensaje: string,
  referencia?: string
): ExplainNode {
  return {
    regla,
    fuente,
    referencia,
    resultado: 'OK',
    mensaje,
  };
}

// ============================================================
// Main: Pre-firma Validation
// ============================================================

export function validarPreFirma(
  documentHash: string,
  signerRole: string,
  documentType: string
): PreFirmaValidationResult {
  const errors: string[] = [];
  const explain: ExplainNode[] = [];

  // Check document hash
  if (!documentHash || documentHash.trim().length === 0) {
    errors.push('El hash del documento no puede estar vacío');
    explain.push(
      crearExplainNode(
        'VALIDACION_HASH',
        'REGLAMENTO',
        'Hash del documento vacío',
        'Motor de Reglas § Validaciones Pre-firma'
      )
    );
  } else {
    explain.push(
      crearExplainNode(
        'VALIDACION_HASH',
        'REGLAMENTO',
        `Hash del documento válido (${documentHash.substring(0, 16)}...)`,
        'Motor de Reglas § Validaciones Pre-firma'
      )
    );
  }

  // Check signer role
  if (!signerRole || signerRole.trim().length === 0) {
    errors.push('El rol del firmante no puede estar vacío');
    explain.push(
      crearExplainNode(
        'VALIDACION_ROL',
        'REGLAMENTO',
        'Rol del firmante vacío',
        'Motor de Reglas § Validaciones Pre-firma'
      )
    );
  } else if (!KNOWN_SIGNER_ROLES.includes(signerRole)) {
    errors.push(
      `Rol de firmante desconocido: ${signerRole}. Roles válidos: ${KNOWN_SIGNER_ROLES.join(', ')}`
    );
    explain.push(
      crearExplainNode(
        'VALIDACION_ROL',
        'REGLAMENTO',
        `Rol inválido: ${signerRole}`,
        'Motor de Reglas § Validaciones Pre-firma'
      )
    );
  } else {
    explain.push(
      crearExplainNode(
        'VALIDACION_ROL',
        'REGLAMENTO',
        `Rol del firmante válido: ${signerRole}`,
        'Motor de Reglas § Validaciones Pre-firma'
      )
    );
  }

  // Check document type
  if (!documentType || documentType.trim().length === 0) {
    errors.push('El tipo de documento no puede estar vacío');
    explain.push(
      crearExplainNode(
        'VALIDACION_TIPO_DOC',
        'REGLAMENTO',
        'Tipo de documento vacío',
        'Motor de Reglas § Validaciones Pre-firma'
      )
    );
  } else if (!KNOWN_DOCUMENT_TYPES.includes(documentType)) {
    errors.push(
      `Tipo de documento desconocido: ${documentType}. Tipos válidos: ${KNOWN_DOCUMENT_TYPES.join(', ')}`
    );
    explain.push(
      crearExplainNode(
        'VALIDACION_TIPO_DOC',
        'REGLAMENTO',
        `Tipo de documento inválido: ${documentType}`,
        'Motor de Reglas § Validaciones Pre-firma'
      )
    );
  } else {
    explain.push(
      crearExplainNode(
        'VALIDACION_TIPO_DOC',
        'REGLAMENTO',
        `Tipo de documento válido: ${documentType}`,
        'Motor de Reglas § Validaciones Pre-firma'
      )
    );
  }

  return {
    ok: errors.length === 0,
    errors,
    explain,
  };
}

// ============================================================
// Main: QES Signing
// ============================================================

export function firmarDocumentoQES(
  request: QTSPSignRequest
): QESSignResult {
  const preCheck = validarPreFirma(
    request.document_hash,
    request.signer_role,
    request.document_type
  );
  return {
    ok: false,
    signature_ref: '',
    signer_id: request.signer_id,
    signer_role: request.signer_role,
    document_hash: request.document_hash,
    x509_chain: [],
    ocsp_status: 'UNKNOWN',
    signed_at: '',
    explain: preCheck.explain,
    errors: [
      ...preCheck.errors,
      'La firma QES está retirada: EAD solo presta interposición, mensajería y custodia/e-archiving.',
    ],
  };
}

// ============================================================
// Main: Certified Notification
// ============================================================

export function notificarCertificado(
  request: QTSPNotificationRequest
): CertifiedNotificationResult {
  const errors: string[] = [];
  const explain: ExplainNode[] = [];

  // Validate recipient email
  if (!request.recipient_email || request.recipient_email.trim().length === 0) {
    errors.push('La dirección de correo del destinatario no puede estar vacía');
    explain.push(
      crearExplainNode(
        'VALIDACION_EMAIL',
        'REGLAMENTO',
        'Email del destinatario vacío',
        'QTSP Integration § Notification Validation'
      )
    );
    return {
      ok: false,
      status: 'ERROR',
      delivery_ref: null,
      provider_request_id: null,
      requested_at: null,
      recipient_id: request.recipient_id,
      delivered_at: null,
      delivery_proven: false,
      local_message_fingerprint: '',
      evidence_hash: null,
      tsq_token: null,
      archive_status: 'PENDING',
      explain,
      errors,
    };
  }

  // Validate delivery type
  const validDeliveryTypes = ['EDELIVERY', 'BUROFAX', 'CERTIFICADA'];
  if (!validDeliveryTypes.includes(request.delivery_type)) {
    errors.push(
      `Tipo de entrega no válido: ${request.delivery_type}. Válidos: ${validDeliveryTypes.join(', ')}`
    );
    explain.push(
      crearExplainNode(
        'VALIDACION_CANAL',
        'REGLAMENTO',
        `Canal de entrega no válido: ${request.delivery_type}`,
        'QTSP Integration § Notification Validation'
      )
    );
    return {
      ok: false,
      status: 'ERROR',
      delivery_ref: null,
      provider_request_id: null,
      requested_at: null,
      recipient_id: request.recipient_id,
      delivered_at: null,
      delivery_proven: false,
      local_message_fingerprint: '',
      evidence_hash: null,
      tsq_token: null,
      archive_status: 'PENDING',
      explain,
      errors,
    };
  }

  // Only prepare the content binding. A synchronous rules engine cannot assert
  // provider acceptance, delivery, timestamping or Evidence Manager custody.
  const localMessageFingerprint = generateLocalMessageFingerprint(
    request.subject,
    request.body,
    request.recipient_id
  );

  explain.push(
    crearExplainNode(
      'NOTIFICACION_PREPARADA',
      'REGLAMENTO',
      `Solicitud para ${request.recipient_email} validada; pendiente de Notice Manager`,
      'QTSP Integration § Notification Preparation'
    )
  );

  explain.push(
    crearExplainNode(
      'CANAL_SOLICITADO',
      'REGLAMENTO',
      `Canal seleccionado: ${request.delivery_type}`,
      'QTSP Integration § Delivery Channel'
    )
  );

  explain.push(
    crearExplainNode(
      'HASH_MENSAJE_LOCAL',
      'REGLAMENTO',
      `Huella local no criptográfica calculada (${localMessageFingerprint}); no es evidencia ni hash de custodia`,
      'QTSP Integration § Message Preparation'
    )
  );

  explain.push(
    crearExplainNode(
      'EARCHIVE_PENDIENTE',
      'REGLAMENTO',
      'Custodia en EAD Trust Evidence Manager pendiente de confirmación del proveedor',
      'QTSP Integration § Evidence Manager'
    )
  );

  return {
    ok: true,
    status: 'PENDING',
    delivery_ref: null,
    provider_request_id: null,
    requested_at: null,
    recipient_id: request.recipient_id,
    delivered_at: null,
    delivery_proven: false,
    local_message_fingerprint: localMessageFingerprint,
    evidence_hash: null,
    tsq_token: null,
    archive_status: 'PENDING',
    explain,
    errors,
  };
}

// ============================================================
// QTSP Trust Center — Integrity Verification
// ============================================================

export interface IntegrityCheckDetail {
  type: 'HASH' | 'QES' | 'QSEAL' | 'TSQ' | 'OCSP' | 'IDENTITY' | 'MANDATE';
  label: string;
  passed: boolean;
  detail: string;
  timestamp?: string;
}

export interface IntegrityVerificationResult {
  ok: boolean;
  checks: IntegrityCheckDetail[];
  explain: ExplainNode[];
  errors: string[];
}

/**
 * Artefacto verificable por el Trust Center. `HASH` representa la integridad de
 * un documento archivado (DOCX con SHA-512) sin sello QTSP tipado; el resto son
 * servicios no personales (QSEAL/TSQ), notificación o filas QES históricas.
 * QES se conserva solo para lectura y siempre falla cerrado como prueba canónica.
 */
export interface VerifiableArtifact {
  type: 'HASH' | 'QES' | 'QSEAL' | 'TSQ' | 'NOTIFICATION';
  ref: string;
  hash: string;
  signer_id?: string;
  signer_role?: string;
  timestamp?: string;
}

// Codex (rev. ITEM-107): el Trust Center debe fallar cerrado ante deriva de
// forma. Un digest plausible es hex/base64/base64url de longitud razonable
// (≥8); esto rechaza cadenas vacías, URIs ("evidence-bundle://…" tiene ":") y
// fragmentos demasiado cortos, que antes pasaban el check por ser meramente
// no-vacías. La defensa primaria contra hashes fabricados es no sintetizarlos
// en buildArtifactsFromData (un signature_hash ausente entra como "" → falla).
const DIGEST_PATTERN = /^[A-Za-z0-9+/=_-]{8,}$/;
function esDigestValido(hash: string | undefined | null): boolean {
  return typeof hash === 'string' && DIGEST_PATTERN.test(hash.trim());
}

/**
 * Verify integrity of artifacts signed by QTSP.
 * Comprueba hashes y servicios no personales. Una fila QES legacy nunca se
 * convierte en firma válida dentro del estado canónico.
 *
 * @param agreementId UUID of the agreement
 * @param artifacts Array of signed artifacts with metadata
 * @returns IntegrityVerificationResult with detailed check results
 */
export function verificarIntegridad(
  agreementId: string,
  artifacts: VerifiableArtifact[]
): IntegrityVerificationResult {
  const checks: IntegrityCheckDetail[] = [];
  const explain: ExplainNode[] = [];
  const errors: string[] = [];

  // Gate 1: Agreement ID validation
  if (!agreementId || agreementId.trim().length === 0) {
    errors.push('El identificador del acuerdo no puede estar vacío');
    explain.push(
      crearExplainNode(
        'VALIDACION_ACUERDO_ID',
        'REGLAMENTO',
        'ID del acuerdo vacío',
        'Trust Center § ID Validation'
      )
    );
  } else {
    explain.push(
      crearExplainNode(
        'VALIDACION_ACUERDO_ID',
        'REGLAMENTO',
        `ID del acuerdo válido: ${agreementId.substring(0, 8)}...`,
        'Trust Center § ID Validation'
      )
    );
  }

  // Gate 2: Non-empty artifacts list
  if (artifacts.length === 0) {
    // No artifacts to check — OK state (nothing to verify)
    explain.push(
      crearExplainNode(
        'ARTEFACTOS_VACIO',
        'REGLAMENTO',
        'No hay artefactos para verificar',
        'Trust Center § Artifact Validation'
      )
    );
    return {
      ok: true,
      checks: [],
      explain,
      errors,
    };
  }

  explain.push(
    crearExplainNode(
      'ARTEFACTOS_ENCONTRADOS',
      'REGLAMENTO',
      `${artifacts.length} artefacto(s) encontrado(s)`,
      'Trust Center § Artifact Count'
    )
  );

  // Check each artifact
  for (const artifact of artifacts) {
    // Check 1: HASH integrity
    const hashValido = esDigestValido(artifact.hash);
    const hashCheck: IntegrityCheckDetail = {
      type: 'HASH',
      label: `Hash ${artifact.type} (${artifact.ref})`,
      passed: hashValido,
      detail: hashValido
        ? `Hash válido: ${artifact.hash.substring(0, 16)}...`
        : artifact.hash && artifact.hash.trim().length > 0
          ? 'Hash con formato inválido (no es un digest reconocible)'
          : 'Hash no disponible o vacío',
      timestamp: artifact.timestamp,
    };
    checks.push(hashCheck);

    if (hashCheck.passed) {
      explain.push(
        crearExplainNode(
          'VALIDACION_HASH_ARTEFACTO',
          'REGLAMENTO',
          `Hash de ${artifact.ref} verificado`,
          'Trust Center § Hash Validation'
        )
      );
    } else {
      errors.push(`Hash inválido o faltante para artefacto ${artifact.ref}`);
      explain.push(
        crearExplainNode(
          'VALIDACION_HASH_ARTEFACTO',
          'REGLAMENTO',
          `Hash faltante para ${artifact.ref}`,
          'Trust Center § Hash Validation'
        )
      );
    }

    // Check 2: QES es una proyección legacy, nunca evidencia canónica nueva.
    if (artifact.type === 'QES') {
      const qesCheck: IntegrityCheckDetail = {
        type: 'QES',
        label: `Referencia QES histórica (${artifact.ref})`,
        passed: false,
        detail: 'Referencia legacy no aceptada como prueba canónica de firma',
        timestamp: artifact.timestamp,
      };
      checks.push(qesCheck);
      errors.push(`Referencia QES legacy no canónica: ${artifact.ref}`);
    }

    // Check 3: QSEAL token (if applicable)
    if (artifact.type === 'QSEAL') {
      const qsealCheck: IntegrityCheckDetail = {
        type: 'QSEAL',
        label: `Sello QSEAL (${artifact.ref})`,
        passed: artifact.hash && artifact.hash.trim().length > 0,
        detail: artifact.hash && artifact.hash.trim().length > 0
          ? `Sello presente: ${artifact.hash.substring(0, 16)}...`
          : 'Token de sello no disponible',
        timestamp: artifact.timestamp,
      };
      checks.push(qsealCheck);

      if (qsealCheck.passed) {
        explain.push(
          crearExplainNode(
            'VALIDACION_QSEAL',
            'REGLAMENTO',
            `Sello QSEAL detectado en ${artifact.ref}`,
            'Trust Center § QSEAL Validation'
          )
        );
      } else {
        errors.push(`Sello QSEAL no disponible para ${artifact.ref}`);
      }
    }

    // Check 4: TSQ timestamp (if applicable)
    if (artifact.type === 'TSQ' && artifact.timestamp) {
      const tsTry = new Date(artifact.timestamp);
      const tsPassed = !isNaN(tsTry.getTime());
      const tsqCheck: IntegrityCheckDetail = {
        type: 'TSQ',
        label: `Sello de tiempo (TSQ) ${artifact.ref}`,
        passed: tsPassed,
        detail: tsPassed
          ? `Timestamp válido: ${tsTry.toISOString()}`
          : 'Timestamp inválido o formato incorrecto',
        timestamp: artifact.timestamp,
      };
      checks.push(tsqCheck);

      if (tsqCheck.passed) {
        explain.push(
          crearExplainNode(
            'VALIDACION_TSQ',
            'REGLAMENTO',
            `Sello de tiempo (TSQ) válido: ${artifact.timestamp}`,
            'Trust Center § TSQ Validation'
          )
        );
      } else {
        errors.push(`Timestamp inválido para ${artifact.ref}`);
      }
    }

    // La custodia, el sello de entidad y el sello de tiempo no prueban una
    // identidad personal ni un mandato societario. Si una proyección legacy
    // intenta adjuntar esos campos a un artefacto no-QES, el Trust Center falla
    // cerrado en vez de convertir metadatos declarativos en una validación.
    if (artifact.type !== 'QES' && (artifact.signer_id || artifact.signer_role)) {
      const identityCheck: IntegrityCheckDetail = {
        type: 'IDENTITY',
        label: `Identidad personal no evaluada (${artifact.ref})`,
        passed: false,
        detail: 'La interposición/custodia EAD no acredita identidad personal',
        timestamp: artifact.timestamp,
      };
      checks.push(identityCheck);
      errors.push(`Metadatos personales no verificables en artefacto ${artifact.ref}`);

      if (artifact.signer_role) {
        checks.push({
          type: 'MANDATE',
          label: `Mandato no evaluado: ${artifact.signer_role}`,
          passed: false,
          detail: 'El rol declarado no sustituye la evidencia autoritativa de cargo o poder',
          timestamp: artifact.timestamp,
        });
      }
    }
  }

  const allChecksPassed = checks.every((c) => c.passed);
  if (allChecksPassed && errors.length === 0) {
    explain.push(
      crearExplainNode(
        'VERIFICACION_INTEGRIDAD_COMPLETA',
        'REGLAMENTO',
        `Todas las verificaciones de integridad completadas exitosamente para ${artifacts.length} artefacto(s)`,
        'Trust Center § Full Verification'
      )
    );
  }

  return {
    ok: allChecksPassed && errors.length === 0,
    checks,
    explain,
    errors,
  };
}
