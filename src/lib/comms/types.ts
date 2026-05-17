// Comms module — shared types
// Spec: docs/superpowers/specs/2026-05-17-comunicaciones-portal-miembro-design.md

export type TipoComunicacion =
  | 'CONVOCATORIA' | 'NOTIFICACION_INDIVIDUAL' | 'PUESTA_DISPOSICION'
  | 'SOLICITUD_DECLARACION' | 'CIRCULAR_SIN_SESION' | 'RECORDATORIO'
  | 'NOTIFICACION_ACUERDO' | 'REMISION_ACTA' | 'CERTIFICACION'
  | 'NOTIFICACION_CARGO' | 'ALERTA_VENCIMIENTO' | 'CONSIGNACION'
  | 'COMUNICACION_INTER_ORGANO' | 'SOLICITUD_INFORMACION'
  | 'RESPUESTA_INFORMACION' | 'COMUNICACION_LIBRE';

export type TipoRespuestaEsperada =
  | 'ACUSE' | 'ACEPTACION' | 'VOTO' | 'DECLARACION' | 'DELEGACION' | 'INFORMATIVA';

export type Canal = 'EMAIL_NORMAL' | 'EMAIL_CERTIFICADO' | 'BUROFAX_ERDS' | 'PORTAL_PUSH';
export type NivelCertificacion = 'EMAIL_NORMAL' | 'EMAIL_CERTIFICADO' | 'BUROFAX_ERDS';

export type OrganoTipo =
  | 'JUNTA_GENERAL' | 'CONSEJO_ADMIN' | 'COMISION_DELEGADA'
  | 'SOCIO_UNICO' | 'ADMIN_UNICO' | 'ADMIN_CONJUNTA' | 'ADMIN_SOLIDARIOS';

export type EstadoComunicacion =
  | 'BORRADOR' | 'PROGRAMADA' | 'ENVIANDO' | 'ENVIADA'
  | 'ENTREGADA_PARCIAL' | 'ENTREGADA_TOTAL'
  | 'RESPONDIDA_PARCIAL' | 'RESPONDIDA_TOTAL'
  | 'EXPIRADA' | 'CANCELADA' | 'ERROR';

export type EstadoEntrega =
  | 'PENDIENTE' | 'ENVIANDO' | 'ENVIADO' | 'ENTREGADO'
  | 'LEIDO' | 'RESPONDIDO' | 'REBOTADO' | 'ERROR';

export type EventoDelivery =
  | 'SENT' | 'DELIVERED' | 'OPENED' | 'CLICKED' | 'BOUNCED'
  | 'COMPLAINED' | 'REPLIED' | 'EXPIRED' | 'ERROR';

export type Proveedor = 'RESEND' | 'EAD_TRUST' | 'INTERNAL';

export interface TemplateSnapshot {
  plantilla_protegida_id: string;
  plantilla_materia: string;
  plantilla_tipo: string;
  bloques: Array<{ clave_bloque: string; version: string; hash_sha512: string }>;
  renderizado_con: {
    capa2_variables_resueltas: Record<string, string>;
    capa3_valores_usuario: Record<string, unknown>;
  };
}

export interface ComunicacionConfig {
  destinatarios_tipo: Array<'MIEMBROS_ORGANO' | 'PERSONA_AFECTADA' | 'TERCERO_EXTERNO' | 'AUDITOR' | 'REGISTRO'>;
  tipo_comunicacion_default: TipoComunicacion;
  tipo_respuesta_esperada: TipoRespuestaEsperada;
  nivel_certificacion_minimo: NivelCertificacion;
  canales_permitidos: Canal[];
  plazo_legal_dias: number | null;
  condicional: boolean;
  condicion_expresion: string | null;
  referencia_legal: string;
}
