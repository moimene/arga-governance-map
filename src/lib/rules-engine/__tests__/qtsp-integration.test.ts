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
    it('debería retornar GOOD para un signer ID válido', () => {
      const result = verificarOCSP('SECRETARIO-001');

      expect(result.status).toBe('GOOD');
      expect(result.detail).toContain('válido');
      expect(result.detail).toContain('SECRETARIO-001');
    });

    it('debería retornar REVOKED si el signer ID contiene "REVOKED"', () => {
      const result = verificarOCSP('REVOKED-CERT');

      expect(result.status).toBe('REVOKED');
      expect(result.detail).toContain('revocado');
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
    it('debería retornar ok=true con request válido', () => {
      const request: QTSPSignRequest = {
        document_hash: 'SHA256-abc123def456',
        signer_id: 'SECRETARIO-001',
        signer_role: 'SECRETARIO',
        document_type: 'ACTA',
      };

      const result = firmarDocumentoQES(request);

      expect(result.ok).toBe(true);
      expect(result.signature_ref).toBeTruthy();
      expect(result.signature_ref.startsWith('QES-')).toBe(true);
      expect(result.signer_id).toBe('SECRETARIO-001');
      expect(result.signer_role).toBe('SECRETARIO');
      expect(result.document_hash).toBe('SHA256-abc123def456');
      expect(result.ocsp_status).toBe('GOOD');
      expect(result.x509_chain.length).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
    });

    it('debería incluir signed_at en formato ISO', () => {
      const request: QTSPSignRequest = {
        document_hash: 'SHA256-abc123',
        signer_id: 'SECRETARIO-001',
        signer_role: 'SECRETARIO',
        document_type: 'ACTA',
      };

      const result = firmarDocumentoQES(request);

      expect(result.signed_at).toBeTruthy();
      expect(new Date(result.signed_at)).toBeInstanceOf(Date);
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

    it('debería retornar ok=false y REVOKED status si el signer está revocado', () => {
      const request: QTSPSignRequest = {
        document_hash: 'SHA256-abc123',
        signer_id: 'REVOKED-CERT-001',
        signer_role: 'SECRETARIO',
        document_type: 'ACTA',
      };

      const result = firmarDocumentoQES(request);

      expect(result.ok).toBe(false);
      expect(result.ocsp_status).toBe('REVOKED');
      expect(result.signature_ref).toBe('');
      expect(result.errors.some(e => e.includes('revocado'))).toBe(true);
    });

    it('debería generar signature_ref determinístico para el mismo input', () => {
      const request: QTSPSignRequest = {
        document_hash: 'SHA256-abc123',
        signer_id: 'SECRETARIO-001',
        signer_role: 'SECRETARIO',
        document_type: 'ACTA',
      };

      const result1 = firmarDocumentoQES(request);
      const result2 = firmarDocumentoQES(request);

      expect(result1.signature_ref).toBe(result2.signature_ref);
    });

    it('debería incluir explain nodes en el resultado', () => {
      const request: QTSPSignRequest = {
        document_hash: 'SHA256-abc123',
        signer_id: 'SECRETARIO-001',
        signer_role: 'SECRETARIO',
        document_type: 'ACTA',
      };

      const result = firmarDocumentoQES(request);

      expect(result.explain.length).toBeGreaterThan(0);
      expect(result.explain.some(n => n.regla.includes('OCSP'))).toBe(true);
      expect(result.explain.some(n => n.regla.includes('FIRMA_QES'))).toBe(true);
      expect(
        result.explain.some(n => n.regla.includes('CADENA_X509'))
      ).toBe(true);
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
        const request: QTSPSignRequest = {
          document_hash: 'SHA256-abc123',
          signer_id: 'SECRETARIO-001',
          signer_role: 'SECRETARIO',
          document_type: tipo,
        };

        const result = firmarDocumentoQES(request);
        expect(result.ok).toBe(true);
      });
    });

    it('debería incluir x509_chain en el resultado', () => {
      const request: QTSPSignRequest = {
        document_hash: 'SHA256-abc123',
        signer_id: 'SECRETARIO-001',
        signer_role: 'SECRETARIO',
        document_type: 'ACTA',
      };

      const result = firmarDocumentoQES(request);

      expect(result.x509_chain).toBeDefined();
      expect(Array.isArray(result.x509_chain)).toBe(true);
      expect(result.x509_chain.length).toBeGreaterThan(0);
      result.x509_chain.forEach(cert => {
        expect(typeof cert).toBe('string');
      });
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
      expect(result.delivery_ref).toBeTruthy();
      expect(result.delivery_ref.startsWith('DEL-')).toBe(true);
      expect(result.recipient_id).toBe('PERSON-001');
      expect(result.evidence_hash).toBeTruthy();
      expect(result.tsq_token).toBeTruthy();
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
      expect(result.delivery_ref).toBe('');
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('debería retornar error si delivery_type es inválido', () => {
      const request: QTSPNotificationRequest = {
        recipient_id: 'PERSON-001',
        recipient_email: 'person@example.com',
        subject: 'Notificación',
        body: 'Contenido',
        delivery_type: 'TIPO_INVALIDO' as any,
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
          delivery_type: tipo as any,
        };

        const result = notificarCertificado(request);
        expect(result.ok).toBe(true);
      });
    });

    it('debería generar delivery_ref determinístico para el mismo input', () => {
      const request: QTSPNotificationRequest = {
        recipient_id: 'PERSON-001',
        recipient_email: 'person@example.com',
        subject: 'Notificación',
        body: 'Contenido',
        delivery_type: 'CERTIFICADA',
      };

      const result1 = notificarCertificado(request);
      const result2 = notificarCertificado(request);

      expect(result1.delivery_ref).toBe(result2.delivery_ref);
    });

    it('debería incluir delivered_at en formato ISO', () => {
      const request: QTSPNotificationRequest = {
        recipient_id: 'PERSON-001',
        recipient_email: 'person@example.com',
        subject: 'Notificación',
        body: 'Contenido',
        delivery_type: 'CERTIFICADA',
      };

      const result = notificarCertificado(request);

      expect(result.delivered_at).toBeTruthy();
      expect(new Date(result.delivered_at)).toBeInstanceOf(Date);
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
      expect(result.explain.some(n => n.regla.includes('CANAL_ENTREGA'))).toBe(true);
      expect(result.explain.some(n => n.regla.includes('EVIDENCIA_ENTREGA'))).toBe(true);
      expect(result.explain.some(n => n.regla.includes('TSQ_APLICADO'))).toBe(true);
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
      expect(result.delivery_ref).toBeTruthy();
    });

    it('debería generar evidence_hash basado en contenido', () => {
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

      expect(result1.evidence_hash).not.toBe(result2.evidence_hash);
    });

    it('debería generar TSQ token determinístico para el mismo evidence_hash', () => {
      const request: QTSPNotificationRequest = {
        recipient_id: 'PERSON-001',
        recipient_email: 'person@example.com',
        subject: 'Notificación',
        body: 'Contenido',
        delivery_type: 'CERTIFICADA',
      };

      const result1 = notificarCertificado(request);
      const result2 = notificarCertificado(request);

      expect(result1.tsq_token).toBe(result2.tsq_token);
    });
  });

  // ========================================================
  // Integration tests
  // ========================================================
  describe('Integration scenarios', () => {
    it('debería permitir flujo completo: validación → firma → notificación', () => {
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
      expect(signResult.ok).toBe(true);

      // Notify
      const notifyRequest: QTSPNotificationRequest = {
        recipient_id: 'PERSON-001',
        recipient_email: 'person@example.com',
        subject: 'Acta firmada',
        body: 'El acta ha sido firmada y está disponible',
        delivery_type: 'CERTIFICADA',
      };
      const notifyResult = notificarCertificado(notifyRequest);
      expect(notifyResult.ok).toBe(true);

      // Results should have explain nodes
      expect(signResult.explain.length).toBeGreaterThan(0);
      expect(notifyResult.explain.length).toBeGreaterThan(0);
    });

    it('debería bloquear flujo si signer está revocado', () => {
      const signRequest: QTSPSignRequest = {
        document_hash: 'SHA256-abc123',
        signer_id: 'REVOKED-001',
        signer_role: 'SECRETARIO',
        document_type: 'ACTA',
      };

      const result = firmarDocumentoQES(signRequest);

      expect(result.ok).toBe(false);
      expect(result.ocsp_status).toBe('REVOKED');
      // Notification should not proceed in real flow
    });
  });
});
