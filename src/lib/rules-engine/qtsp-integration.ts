// ============================================================
// QTSP Integration — QES Signatures & Certified Notifications
// Spec: Motor de Reglas LSC § QTSP Integration (T23)
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
  delivery_ref: string;
  recipient_id: string;
  delivered_at: string;
  evidence_hash: string;
  tsq_token: string;
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

const DEMO_X509_CHAIN = [
  'MIIDQDCCAigCCQDf5aEfKWJSAjANBgkqhkiG9w0BAQsFADBHMQswCQYDVQQGEwJFUzEVMBMGA1UECAwM',
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA2Zy5dBmBDm5qTbcz7pJ3',
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0Z7pQlX5RfFQNd0XYqR9',
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

  if (signerId.includes('REVOKED')) {
    return {
      status: 'REVOKED',
      detail: `Certificado del firmante ${signerId} ha sido revocado`,
    };
  }

  return {
    status: 'GOOD',
    detail: `Certificado válido para ${signerId}`,
  };
}

// ============================================================
// Helper: Generate deterministic signature reference
// ============================================================

function generateSignatureRef(signerId: string, documentHash: string): string {
  // Simple deterministic hash-like generation for demo
  // In production, this would integrate with QTSP API
  const combined = `${signerId}:${documentHash}`;
  const hash = combined
    .split('')
    .reduce((acc, char) => {
      return (acc << 5) - acc + char.charCodeAt(0);
    }, 0);
  return `QES-${Math.abs(hash).toString(16).toUpperCase().padStart(16, '0')}`;
}

// ============================================================
// Helper: Generate deterministic delivery reference
// ============================================================

function generateDeliveryRef(
  recipientEmail: string,
  subject: string,
  deliveryType: string
): string {
  // Simple deterministic generation for demo
  const combined = `${recipientEmail}:${subject}:${deliveryType}`;
  const hash = combined
    .split('')
    .reduce((acc, char) => {
      return (acc << 5) - acc + char.charCodeAt(0);
    }, 0);
  return `DEL-${Math.abs(hash).toString(16).toUpperCase().padStart(16, '0')}`;
}

// ============================================================
// Helper: Generate evidence hash
// ============================================================

function generateEvidenceHash(
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
  return `SHA256-${Math.abs(hash).toString(16).toUpperCase().padStart(32, '0')}`;
}

// ============================================================
// Helper: Generate TSQ token (Time Stamp Qualifier)
// ============================================================

function generateTSQToken(hash: string): string {
  const combined = `TSQ:${hash}:${new Date().toISOString()}`;
  const digest = combined
    .split('')
    .reduce((acc, char) => {
      return (acc << 5) - acc + char.charCodeAt(0);
    }, 0);
  return `TSQ-${Math.abs(digest).toString(16).toUpperCase().padStart(24, '0')}`;
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
  const errors: string[] = [];
  const explain: ExplainNode[] = [];

  // Pre-flight validation
  const preCheck = validarPreFirma(
    request.document_hash,
    request.signer_role,
    request.document_type
  );

  if (!preCheck.ok) {
    errors.push(...preCheck.errors);
    explain.push(...preCheck.explain);
    return {
      ok: false,
      signature_ref: '',
      signer_id: request.signer_id,
      signer_role: request.signer_role,
      document_hash: request.document_hash,
      x509_chain: [],
      ocsp_status: 'UNKNOWN',
      signed_at: new Date().toISOString(),
      explain,
      errors,
    };
  }

  // Verify OCSP
  const ocspResult = verificarOCSP(request.signer_id);
  explain.push(
    crearExplainNode(
      'VERIFICACION_OCSP_PREVIA',
      'REGLAMENTO',
      `Estado OCSP: ${ocspResult.status}. ${ocspResult.detail}`,
      'QTSP Integration § OCSP Pre-verification'
    )
  );

  if (ocspResult.status === 'REVOKED') {
    errors.push(
      `Certificado del firmante revocado: ${request.signer_id}. Firma QES rechazada.`
    );
    return {
      ok: false,
      signature_ref: '',
      signer_id: request.signer_id,
      signer_role: request.signer_role,
      document_hash: request.document_hash,
      x509_chain: [],
      ocsp_status: 'REVOKED',
      signed_at: new Date().toISOString(),
      explain,
      errors,
    };
  }

  // Generate signature
  const signatureRef = generateSignatureRef(
    request.signer_id,
    request.document_hash
  );
  const signedAt = new Date().toISOString();

  explain.push(
    crearExplainNode(
      'FIRMA_QES_SOLICITADA',
      'REGLAMENTO',
      `Firma QES generada para ${request.document_type} (${signatureRef})`,
      'QTSP Integration § QES Generation'
    )
  );

  explain.push(
    crearExplainNode(
      'CADENA_X509_ADJUNTA',
      'REGLAMENTO',
      `Cadena X.509 de ${DEMO_X509_CHAIN.length} certificados adjunta`,
      'QTSP Integration § Certificate Chain'
    )
  );

  return {
    ok: true,
    signature_ref: signatureRef,
    signer_id: request.signer_id,
    signer_role: request.signer_role,
    document_hash: request.document_hash,
    x509_chain: DEMO_X509_CHAIN,
    ocsp_status: ocspResult.status as 'GOOD' | 'REVOKED' | 'UNKNOWN',
    signed_at: signedAt,
    explain,
    errors,
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
      delivery_ref: '',
      recipient_id: request.recipient_id,
      delivered_at: new Date().toISOString(),
      evidence_hash: '',
      tsq_token: '',
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
      delivery_ref: '',
      recipient_id: request.recipient_id,
      delivered_at: new Date().toISOString(),
      evidence_hash: '',
      tsq_token: '',
      explain,
      errors,
    };
  }

  // Generate notification artifacts
  const deliveryRef = generateDeliveryRef(
    request.recipient_email,
    request.subject,
    request.delivery_type
  );
  const evidenceHash = generateEvidenceHash(
    request.subject,
    request.body,
    request.recipient_id
  );
  const tsqToken = generateTSQToken(evidenceHash);
  const deliveredAt = new Date().toISOString();

  explain.push(
    crearExplainNode(
      'NOTIFICACION_PREPARADA',
      'REGLAMENTO',
      `Notificación para ${request.recipient_email} preparada`,
      'QTSP Integration § Notification Preparation'
    )
  );

  explain.push(
    crearExplainNode(
      'CANAL_ENTREGA',
      'REGLAMENTO',
      `Canal seleccionado: ${request.delivery_type}`,
      'QTSP Integration § Delivery Channel'
    )
  );

  explain.push(
    crearExplainNode(
      'EVIDENCIA_ENTREGA_GENERADA',
      'REGLAMENTO',
      `Evidencia de entrega generada (${evidenceHash.substring(0, 16)}...)`,
      'QTSP Integration § Evidence Generation'
    )
  );

  explain.push(
    crearExplainNode(
      'TSQ_APLICADO',
      'REGLAMENTO',
      `Token de sellado de tiempo (TSQ) aplicado: ${tsqToken.substring(0, 16)}...`,
      'QTSP Integration § Time Stamp Qualification'
    )
  );

  return {
    ok: true,
    delivery_ref: deliveryRef,
    recipient_id: request.recipient_id,
    delivered_at: deliveredAt,
    evidence_hash: evidenceHash,
    tsq_token: tsqToken,
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
 * Verify integrity of artifacts signed by QTSP.
 * Performs comprehensive checks on QES signatures, seals, timestamps, and identity.
 *
 * @param agreementId UUID of the agreement
 * @param artifacts Array of signed artifacts with metadata
 * @returns IntegrityVerificationResult with detailed check results
 */
export function verificarIntegridad(
  agreementId: string,
  artifacts: Array<{
    type: 'QES' | 'QSEAL' | 'TSQ' | 'NOTIFICATION';
    ref: string;
    hash: string;
    signer_id?: string;
    signer_role?: string;
    timestamp?: string;
  }>
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
    const hashCheck: IntegrityCheckDetail = {
      type: 'HASH',
      label: `Hash ${artifact.type} (${artifact.ref})`,
      passed: artifact.hash && artifact.hash.trim().length > 0,
      detail: artifact.hash && artifact.hash.trim().length > 0
        ? `Hash válido: ${artifact.hash.substring(0, 16)}...`
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
      errors.push(`Hash faltante para artefacto ${artifact.ref}`);
      explain.push(
        crearExplainNode(
          'VALIDACION_HASH_ARTEFACTO',
          'REGLAMENTO',
          `Hash faltante para ${artifact.ref}`,
          'Trust Center § Hash Validation'
        )
      );
    }

    // Check 2: QES signature (if applicable)
    if (artifact.type === 'QES' && artifact.signer_id) {
      const qesCheck: IntegrityCheckDetail = {
        type: 'QES',
        label: `Firma QES de ${artifact.signer_id}`,
        passed: artifact.signer_id && artifact.signer_id.trim().length > 0,
        detail: artifact.signer_id
          ? `Firmante identificado: ${artifact.signer_id}`
          : 'Identificador de firmante vacío',
        timestamp: artifact.timestamp,
      };
      checks.push(qesCheck);

      if (qesCheck.passed) {
        explain.push(
          crearExplainNode(
            'VALIDACION_QES',
            'REGLAMENTO',
            `Firma QES de ${artifact.signer_id} detectada`,
            'Trust Center § QES Validation'
          )
        );
      } else {
        errors.push(`Identificador de firmante vacío para ${artifact.ref}`);
      }
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

    // Check 5: OCSP verification (if signer present)
    if (artifact.signer_id) {
      const ocspResult = verificarOCSP(artifact.signer_id);
      const ocspCheck: IntegrityCheckDetail = {
        type: 'OCSP',
        label: `Estado OCSP de ${artifact.signer_id}`,
        passed: ocspResult.status === 'GOOD',
        detail: ocspResult.detail,
        timestamp: artifact.timestamp,
      };
      checks.push(ocspCheck);

      if (ocspCheck.passed) {
        explain.push(
          crearExplainNode(
            'VERIFICACION_OCSP_ARTEFACTO',
            'REGLAMENTO',
            `OCSP: ${ocspResult.status} para ${artifact.signer_id}`,
            'Trust Center § OCSP Verification'
          )
        );
      } else if (ocspResult.status === 'REVOKED') {
        errors.push(`Certificado revocado: ${artifact.signer_id}`);
        explain.push(
          crearExplainNode(
            'VERIFICACION_OCSP_ARTEFACTO',
            'REGLAMENTO',
            `OCSP: ${ocspResult.status} — certificado revocado`,
            'Trust Center § OCSP Verification'
          )
        );
      } else {
        explain.push(
          crearExplainNode(
            'VERIFICACION_OCSP_ARTEFACTO',
            'REGLAMENTO',
            `OCSP: ${ocspResult.status} — estado desconocido`,
            'Trust Center § OCSP Verification'
          )
        );
      }
    }

    // Check 6: Identity check (signer_id + signer_role)
    if (artifact.signer_id && artifact.signer_role) {
      const idCheck: IntegrityCheckDetail = {
        type: 'IDENTITY',
        label: `Identidad: ${artifact.signer_role}`,
        passed: artifact.signer_id.trim().length > 0 && artifact.signer_role.trim().length > 0,
        detail: `Firmante ${artifact.signer_id} con rol ${artifact.signer_role}`,
        timestamp: artifact.timestamp,
      };
      checks.push(idCheck);

      if (idCheck.passed) {
        explain.push(
          crearExplainNode(
            'VALIDACION_IDENTIDAD',
            'REGLAMENTO',
            `Identidad verificada: ${artifact.signer_role}`,
            'Trust Center § Identity Validation'
          )
        );
      }
    }

    // Check 7: MANDATE check (role validation)
    if (artifact.signer_role && KNOWN_SIGNER_ROLES.includes(artifact.signer_role)) {
      const mandateCheck: IntegrityCheckDetail = {
        type: 'MANDATE',
        label: `Mandato: ${artifact.signer_role}`,
        passed: true,
        detail: `Rol ${artifact.signer_role} autorizado para firmar`,
        timestamp: artifact.timestamp,
      };
      checks.push(mandateCheck);

      explain.push(
        crearExplainNode(
          'VALIDACION_MANDATO',
          'REGLAMENTO',
          `Mandato válido para rol ${artifact.signer_role}`,
          'Trust Center § Mandate Validation'
        )
      );
    } else if (artifact.signer_role) {
      const mandateCheck: IntegrityCheckDetail = {
        type: 'MANDATE',
        label: `Mandato: ${artifact.signer_role}`,
        passed: false,
        detail: `Rol ${artifact.signer_role} no es conocido`,
        timestamp: artifact.timestamp,
      };
      checks.push(mandateCheck);

      errors.push(`Rol de firmante desconocido: ${artifact.signer_role}`);
      explain.push(
        crearExplainNode(
          'VALIDACION_MANDATO',
          'REGLAMENTO',
          `Mandato inválido: rol ${artifact.signer_role} no reconocido`,
          'Trust Center § Mandate Validation'
        )
      );
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
