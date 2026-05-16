BEGIN;

CREATE OR REPLACE FUNCTION prevent_active_block_text_modification()
RETURNS TRIGGER AS $$
BEGIN
  -- R5a: Reactivar un bloque ARCHIVADA -> ACTIVA esta prohibido.
  IF OLD.estado = 'ARCHIVADA' AND NEW.estado = 'ACTIVA' THEN
    RAISE EXCEPTION 'No se permite reactivar bloque ARCHIVADA -> ACTIVA (clave=%, version=%). Para sustituir: crear nueva fila con misma clave_bloque y nueva version.', OLD.clave_bloque, OLD.version;
  END IF;

  -- R5b: texto_aprobado inmutable cuando OLD o NEW estado es ACTIVA.
  IF (OLD.estado = 'ACTIVA' OR NEW.estado = 'ACTIVA')
     AND NEW.texto_aprobado IS DISTINCT FROM OLD.texto_aprobado THEN
    RAISE EXCEPTION 'No se permite modificar texto_aprobado cuando estado anterior o nuevo es ACTIVA (clave=%, version=%). Para corregir: ARCHIVAR + crear nueva (clave, version).', OLD.clave_bloque, OLD.version;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION prevent_active_block_text_modification() IS 'WORM guard hardened (000059): bloquea reactivacion ARCHIVADA->ACTIVA y cambios de texto_aprobado cuando OLD o NEW estado es ACTIVA. Cierra bypass detectado por Codex sobre 000058.';

COMMIT;
