import { describe, it, expect } from 'vitest';
import {
  firmarDocumentoQES,
  notificarCertificado,
  validarPreFirma,
  verificarOCSP,
} from '../qtsp-integration';
import type {
  QTSPSignRequest,
  QTSPNotificationRequest,
} from '../types';

describe('QTSP Integration', () => {
  // ========================================================
  // Test 1: verificarOCSP with valid signer ID
  // ========================================================
  describe('verificarOCSP', () => {
    it('no infiere GOOD para un identificador válido', () => {
      const result = verificarOCSP('SECRETARIO-001');

      expect(result.status).toBe('UNKNOWN');
      expect(result.detail).toContain('retirada');
      expect(result.detail).toContain('SECRETARIO-001');
    });

    it('no usa convenciones demo para inventar REVOKED', () => {
      const result = verificarOCSP('REVOKED-CERT');

      expect(result.status).toBe('UNKNOWN');
      expect(result.detail).toContain('no se infiere validez');
    });

    it('debería retornar UNKNOWN si el signer ID está vacío', () => {
      const result = verificarOCSP('');

      expect(result.status).toBe('UNKNOWN');
      expect(result.detail).toContain('vacío');
    });

    it('debería retornar UNKNOWN si el signer ID es solo espacios', () => {
      const result = verificarOCSP('   ');

      expect(result.status).toBe('UNKNOWN');
      expect(result.detail).toContain('vacío');
    });
  });

  // ========================================================
  // Test 2: validarPreFirma with valid inputs
  // ========================================================
  describe('validarPreFirma', () => {
    it('debería retornar ok=true con hash, role, y tipo válidos', () => {
      const result = validarPreFirma(
        'SHA256-abc123def456',
        'SECRETARIO',
        'ACTA'
      );

      expect(result.ok).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.explain).toBeDefined();
      expect(result.explain.length).toBeGreaterThan(0);
    });

    it('debería retornar error si el hash está vacío', () => {
      const result = validarPreFirma('', 'SECRETARIO', 'ACTA');

      expect(result.ok).toBe(false);
      expect(result.errors).toContain(
        'El hash del documento no puede estar vacío'
      );
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('debería retornar error si el rol está vacío', () => {
      const result = validarPreFirma('SHA256-abc123', '', 'ACTA');

      expect(result.ok).toBe(false);
      expect(result.errors.some(e => e.includes('rol'))).toBe(true);
    });

    it('debería retornar error si el rol es inválido', () => {
      const result = validarPreFirma(
        'SHA256-abc123',
        'ROL_DESCONOCIDO',
        'ACTA'
      );

      expect(result.ok).toBe(false);
      expect(result.errors.some(e => e.includes('desconocido'))).toBe(true);
    });

    it('debería retornar error si el tipo de documento está vacío', () => {
      const result = validarPreFirma('SHA256-abc123', 'SECRETARIO', '');

      expect(result.ok).toBe(false);
      expect(result.errors.some(e => e.includes('tipo'))).toBe(true);
    });

    it('debería retornar error si el tipo de documento es inválido', () => {
      const result = validarPreFirma(
        'SHA256-abc123',
        'SECRETARIO',
        'TIPO_DESCONOCIDO'
      );

      expect(result.ok).toBe(false);
      expect(result.errors.some(e => e.includes('desconocido'))).toBe(true);
    });

    it('debería contener explain nodes cuando todo es válido', () => {
      const result = validarPreFirma(
        'SHA256-abc123',
        'PRESIDENTE',
        'CERTIFICACION'
      );

      expect(result.explain.length).toBeGreaterThanOrEqual(3);
      expect(result.explain.some(n => n.regla.includes('HASH'))).toBe(true);
      expect(result.explain.some(n => n.regla.includes('ROL'))).toBe(true);
      expect(result.explain.some(n => n.regla.includes('TIPO_DOC'))).toBe(true);
    });

    it('debería aceptar todos los roles válidos', () => {
      const rolesValidos = [
        'SECRETARIO',
        'PRESIDENTE',
        'CONSEJERO',
        'ADMINISTRADOR',
        'SOCIO',
      ];

      rolesValidos.forEach(rol => {
        const result = validarPreFirma('SHA256-abc123', rol, 'ACTA');
        expect(result.ok).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('debería aceptar todos los tipos de documento válidos', () => {
      const tiposValidos = [
        'ACTA',
        'CERTIFICACION',
        'CONVOCATORIA',
        'ACUERDO',
        'PODER',
      ];

      tiposValidos.forEach(tipo => {
        const result = validarPreFirma(
          'SHA256-abc123',
          'SECRETARIO',
          tipo
        );
        expect(result.ok).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });
  });

  // ========================================================
  // Test 3: firmarDocumentoQES with valid request
  // ========================================================
  describe('firmarDocumentoQES', () => {
    it('bloquea incluso un request formalmente válido', () => {
      const request: QTSPSignRequest = {
        document_hash: 'SHA256-abc123def456',
        signer_id: 'SECRETARIO-001',
        signer_role: 'SECRETARIO',
        document_type: 'ACTA',
      };

      const result = firmarDocumentoQES(request);

      expect(result.ok).toBe(false);
      expect(result.signature_ref).toBe('');
      expect(result.signer_id).toBe('SECRETARIO-001');
      expect(result.signer_role).toBe('SECRETARIO');
      expect(result.document_hash).toBe('SHA256-abc123def456');
      expect(result.ocsp_status).toBe('UNKNOWN');
      expect(result.x509_chain).toEqual([]);
      expect(result.errors.some(e => e.includes('firma QES está retirada'))).toBe(true);
    });

    it('no fabrica signed_at', () => {
      const request: QTSPSignRequest = {
        document_hash: 'SHA256-abc123',
        signer_id: 'SECRETARIO-001',
        signer_role: 'SECRETARIO',
        document_type: 'ACTA',
      };

      const result = firmarDocumentoQES(request);

      expect(result.signed_at).toBe('');
    });

    it('debería retornar ok=false si el documento_hash está vacío', () => {
      const request: QTSPSignRequest = {
        document_hash: '',
        signer_id: 'SECRETARIO-001',
        signer_role: 'SECRETARIO',
        document_type: 'ACTA',
      };

      const result = firmarDocumentoQES(request);

      expect(result.ok).toBe(false);
      expect(result.signature_ref).toBe('');
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('no ejecuta OCSP ni siquiera para un identificador demo REVOKED', () => {
      const request: QTSPSignRequest = {
        document_hash: 'SHA256-abc123',
        signer_id: 'REVOKED-CERT-001',
        signer_role: 'SECRETARIO',
        document_type: 'ACTA',
      };

      const result = firmarDocumentoQES(request);

      expect(result.ok).toBe(false);
      expect(result.ocsp_status).toBe('UNKNOWN');
      expect(result.signature_ref).toBe('');
      expect(result.errors.some(e => e.includes('retirada'))).toBe(true);
    });

    it('nunca genera signature_ref', () => {
      const request: QTSPSignRequest = {
        document_hash: 'SHA256-abc123',
        signer_id: 'SECRETARIO-001',
        signer_role: 'SECRETARIO',
        document_type: 'ACTA',
      };

      const result1 = firmarDocumentoQES(request);
      const result2 = firmarDocumentoQES(request);

      expect(result1.signature_ref).toBe(result2.signature_ref);
      expect(result1.signature_ref).toBe('');
    });

    it('conserva solo la explicación de validación y añade el bloqueo explícito', () => {
      const request: QTSPSignRequest = {
        document_hash: 'SHA256-abc123',
        signer_id: 'SECRETARIO-001',
        signer_role: 'SECRETARIO',
        document_type: 'ACTA',
      };

      const result = firmarDocumentoQES(request);

      expect(result.explain.length).toBeGreaterThan(0);
      expect(result.explain.some(n => n.regla.includes('VALIDACION_HASH'))).toBe(true);
      expect(result.explain.some(n => n.regla.includes('OCSP'))).toBe(false);
      expect(result.errors.some(e => e.includes('retirada'))).toBe(true);
    });

    it('bloquea todos los tipos de documento aunque sean formalmente válidos', () => {
      const tiposValidos = [
        'ACTA',
        'CERTIFICACION',
        'CONVOCATORIA',
        'ACUERDO',
        'PODER',
      ];

      tiposValidos.forEach(tipo => {
        const request: QTSPSignRequest = {
          document_hash: 'SHA256-abc123',
          signer_id: 'SECRETARIO-001',
          signer_role: 'SECRETARIO',
          document_type: tipo,
        };

        const result = firmarDocumentoQES(request);
        expect(result.ok).toBe(false);
        expect(result.signature_ref).toBe('');
      });
    });

    it('no fabrica una cadena x509', () => {
      const request: QTSPSignRequest = {
        document_hash: 'SHA256-abc123',
        signer_id: 'SECRETARIO-001',
        signer_role: 'SECRETARIO',
        document_type: 'ACTA',
      };

      const result = firmarDocumentoQES(request);

      expect(result.x509_chain).toBeDefined();
      expect(Array.isArray(result.x509_chain)).toBe(true);
      expect(result.x509_chain).toEqual([]);
    });
  });

  // ========================================================
  // Test 4: notificarCertificado with valid request
  // ========================================================
  describe('notificarCertificado', () => {
    it('debería retornar ok=true con request válido', () => {
      const request: QTSPNotificationRequest = {
        recipient_id: 'PERSON-001',
        recipient_email: 'person@example.com',
        subject: 'Notificación de Acuerdo',
        body: 'Contenido de la notificación',
        delivery_type: 'CERTIFICADA',
      };

      const result = notificarCertificado(request);

      expect(result.ok).toBe(true);
      expect(result.status).toBe('PENDING');
      expect(result.delivery_ref).toBeNull();
      expect(result.provider_request_id).toBeNull();
      expect(result.recipient_id).toBe('PERSON-001');
      expect(result.local_message_fingerprint).toMatch(/^LOCAL-NONCRYPTO-/);
      expect(result.evidence_hash).toBeNull();
      expect(result.tsq_token).toBeNull();
      expect(result.delivery_proven).toBe(false);
      expect(result.errors).toHaveLength(0);
    });

    it('debería retornar ok=false si el recipient_email está vacío', () => {
      const request: QTSPNotificationRequest = {
        recipient_id: 'PERSON-001',
        recipient_email: '',
        subject: 'Notificación',
        body: 'Contenido',
        delivery_type: 'CERTIFICADA',
      };

      const result = notificarCertificado(request);

      expect(result.ok).toBe(false);
      expect(result.delivery_ref).toBeNull();
      expect(result.delivered_at).toBeNull();
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('debería retornar error si delivery_type es inválido', () => {
      const request: QTSPNotificationRequest = {
        recipient_id: 'PERSON-001',
        recipient_email: 'person@example.com',
        subject: 'Notificación',
        body: 'Contenido',
        delivery_type: 'TIPO_INVALIDO' as unknown as QTSPNotificationRequest['delivery_type'],
      };

      const result = notificarCertificado(request);

      expect(result.ok).toBe(false);
      expect(result.errors.some(e => e.includes('no válido'))).toBe(true);
    });

    it('debería aceptar todos los tipos de entrega válidos', () => {
      const tiposEntrega = ['EDELIVERY', 'BUROFAX', 'CERTIFICADA'];

      tiposEntrega.forEach(tipo => {
        const request: QTSPNotificationRequest = {
          recipient_id: 'PERSON-001',
          recipient_email: 'person@example.com',
          subject: 'Notificación',
          body: 'Contenido',
          delivery_type: tipo as QTSPNotificationRequest['delivery_type'],
        };

        const result = notificarCertificado(request);
        expect(result.ok).toBe(true);
      });
    });

    it('no debe fabricar una referencia de entrega', () => {
      const request: QTSPNotificationRequest = {
        recipient_id: 'PERSON-001',
        recipient_email: 'person@example.com',
        subject: 'Notificación',
        body: 'Contenido',
        delivery_type: 'CERTIFICADA',
      };

      const result = notificarCertificado(request);
      expect(result.delivery_ref).toBeNull();
      expect(result.provider_request_id).toBeNull();
    });

    it('no debe fabricar delivered_at', () => {
      const request: QTSPNotificationRequest = {
        recipient_id: 'PERSON-001',
        recipient_email: 'person@example.com',
        subject: 'Notificación',
        body: 'Contenido',
        delivery_type: 'CERTIFICADA',
      };

      const result = notificarCertificado(request);

      expect(result.delivered_at).toBeNull();
      expect(result.delivery_proven).toBe(false);
    });

    it('debería incluir explain nodes en el resultado', () => {
      const request: QTSPNotificationRequest = {
        recipient_id: 'PERSON-001',
        recipient_email: 'person@example.com',
        subject: 'Notificación',
        body: 'Contenido',
        delivery_type: 'CERTIFICADA',
      };

      const result = notificarCertificado(request);

      expect(result.explain.length).toBeGreaterThan(0);
      expect(result.explain.some(n => n.regla.includes('NOTIFICACION_PREPARADA'))).toBe(true);
      expect(result.explain.some(n => n.regla.includes('CANAL_SOLICITADO'))).toBe(true);
      expect(result.explain.some(n => n.regla.includes('HASH_MENSAJE_LOCAL'))).toBe(true);
      expect(result.explain.some(n => n.regla.includes('EARCHIVE_PENDIENTE'))).toBe(true);
    });

    it('debería aceptar attachments opcionales', () => {
      const request: QTSPNotificationRequest = {
        recipient_id: 'PERSON-001',
        recipient_email: 'person@example.com',
        subject: 'Notificación con anexos',
        body: 'Contenido',
        attachments: [
          { name: 'acta.pdf', hash: 'SHA256-abc123' },
          { name: 'certificacion.pdf', hash: 'SHA256-def456' },
        ],
        delivery_type: 'CERTIFICADA',
      };

      const result = notificarCertificado(request);

      expect(result.ok).toBe(true);
      expect(result.status).toBe('PENDING');
    });

    it('debería generar una huella local no criptográfica basada en contenido', () => {
      const request1: QTSPNotificationRequest = {
        recipient_id: 'PERSON-001',
        recipient_email: 'person@example.com',
        subject: 'Notificación 1',
        body: 'Contenido diferente',
        delivery_type: 'CERTIFICADA',
      };

      const request2: QTSPNotificationRequest = {
        recipient_id: 'PERSON-001',
        recipient_email: 'person@example.com',
        subject: 'Notificación 2',
        body: 'Otro contenido',
        delivery_type: 'CERTIFICADA',
      };

      const result1 = notificarCertificado(request1);
      const result2 = notificarCertificado(request2);

      expect(result1.local_message_fingerprint).not.toBe(result2.local_message_fingerprint);
      expect(result1.evidence_hash).toBeNull();
      expect(result2.evidence_hash).toBeNull();
    });

    it('no debe fabricar un token TSQ', () => {
      const request: QTSPNotificationRequest = {
        recipient_id: 'PERSON-001',
        recipient_email: 'person@example.com',
        subject: 'Notificación',
        body: 'Contenido',
        delivery_type: 'CERTIFICADA',
      };

      const result = notificarCertificado(request);
      expect(result.tsq_token).toBeNull();
      expect(result.archive_status).toBe('PENDING');
    });
  });

  // ========================================================
  // Integration tests
  // ========================================================
  describe('Integration scenarios', () => {
    it('separa validación y mensajería local del flujo de firma retirado', () => {
      // Pre-firma validation
      const preCheck = validarPreFirma(
        'SHA256-abc123',
        'SECRETARIO',
        'ACTA'
      );
      expect(preCheck.ok).toBe(true);

      // Sign
      const signRequest: QTSPSignRequest = {
        document_hash: 'SHA256-abc123',
        signer_id: 'SECRETARIO-001',
        signer_role: 'SECRETARIO',
        document_type: 'ACTA',
      };
      const signResult = firmarDocumentoQES(signRequest);
      expect(signResult.ok).toBe(false);

      // Notify
      const notifyRequest: QTSPNotificationRequest = {
        recipient_id: 'PERSON-001',
        recipient_email: 'person@example.com',
        subject: 'Acta disponible',
        body: 'El acta está disponible en el expediente',
        delivery_type: 'CERTIFICADA',
      };
      const notifyResult = notificarCertificado(notifyRequest);
      expect(notifyResult.ok).toBe(true);

      // Results should have explain nodes
      expect(signResult.explain.length).toBeGreaterThan(0);
      expect(notifyResult.explain.length).toBeGreaterThan(0);
    });

    it('bloquea siempre el adaptador de firma y no ejecuta OCSP', () => {
      const signRequest: QTSPSignRequest = {
        document_hash: 'SHA256-abc123',
        signer_id: 'REVOKED-001',
        signer_role: 'SECRETARIO',
        document_type: 'ACTA',
      };

      const result = firmarDocumentoQES(signRequest);

      expect(result.ok).toBe(false);
      expect(result.ocsp_status).toBe('UNKNOWN');
      // Notification should not proceed in real flow
    });
  });
});
