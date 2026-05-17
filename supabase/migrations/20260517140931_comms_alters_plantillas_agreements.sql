ALTER TABLE plantillas_protegidas
  ADD COLUMN IF NOT EXISTS requiere_comunicacion boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS comunicacion_config jsonb DEFAULT NULL;

ALTER TABLE agreements
  ADD COLUMN IF NOT EXISTS comunicacion_manual boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN plantillas_protegidas.comunicacion_config IS
  'Shape: { destinatarios_tipo[], tipo_comunicacion_default, tipo_respuesta_esperada, nivel_certificacion_minimo, canales_permitidos[], plazo_legal_dias, condicional, condicion_expresion, referencia_legal }';

COMMENT ON COLUMN agreements.comunicacion_manual IS
  'TRUE si el secretario eligió saltar el envío vía comms module (gestiona canales fuera del sistema). Dashboard no alerta.';
