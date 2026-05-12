-- ============================================================================
-- Migration: 20260511_000059_v2_plantillas_overrides_worm_hardening.sql
-- Purpose: Cerrar bypass WORM en bloques_sectoriales (hallazgo Codex P1).
-- Context:
--   La 000058 estableció prevent_active_block_text_modification() para que
--   texto_aprobado de bloques en estado ACTIVA fuera inmutable. El guard solo
--   comprueba OLD.estado = 'ACTIVA'. Bypass detectado:
--     1. UPDATE estado: ACTIVA → ARCHIVADA  (OK, sin cambio de texto)
--     2. UPDATE estado: ARCHIVADA → ACTIVA + texto_aprobado distinto
--        → OLD.estado = 'ARCHIVADA', guard NO dispara, texto reescrito en sitio.
--   Como bloque_insertions referencia (clave_bloque, version) y guarda
--   texto_insertado snapshot, una reescritura del bloque ACTIVA con la misma
--   (clave, version) deja filas históricas de auditoría apuntando a un texto
--   distinto del actual — rompe la cadena forense.
--
-- Fix (Codex):
--   "Reject text changes whenever either the old or new row is active, OR
--    disallow reactivating archived versions."
--   Aplicamos AMBAS reglas como defensa en profundidad:
--     R5a: ARCHIVADA → ACTIVA está prohibido (reactivación bloqueada).
--          Para corregir un bloque archivado: crear nueva (clave_bloque, version).
--     R5b: Si OLD.estado = 'ACTIVA' OR NEW.estado = 'ACTIVA',
--          texto_aprobado debe ser idéntico al anterior.
--          (Cubre el caso ACTIVA→ACTIVA originalmente, y endurece la versión
--           previa por si se elimina R5a por necesidad de negocio).
--
-- Sin nuevas tablas, sin nuevas columnas. Solo reemplaza la función trigger.
-- Idempotente con CREATE OR REPLACE FUNCTION + trigger ya existe (no se recrea).
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION prevent_active_block_text_modification()
RETURNS TRIGGER AS $$
BEGIN
  -- R5a: Reactivar un bloque ARCHIVADA → ACTIVA está prohibido.
  -- Razón: bloque_insertions histórico referencia (clave, version) con
  -- texto_insertado snapshot. Reactivar permite reescribir texto_aprobado
  -- en sitio y romper la auditoría WORM. Para corregir un bloque archivado:
  -- crear nueva fila con la misma clave_bloque y version distinta.
  IF OLD.estado = 'ARCHIVADA' AND NEW.estado = 'ACTIVA' THEN
    RAISE EXCEPTION 'No se permite reactivar bloque ARCHIVADA → ACTIVA (clave=%, version=%). Para sustituir: crear nueva fila con misma clave_bloque y nueva version.', OLD.clave_bloque, OLD.version;
  END IF;

  -- R5b: texto_aprobado inmutable cuando OLD o NEW estado es ACTIVA.
  -- Antes solo se comprobaba OLD.estado='ACTIVA', lo que dejaba el bypass
  -- ARCHIVADA→ACTIVA con texto distinto (OLD='ARCHIVADA' evadía el guard).
  -- Ahora cualquier transición que toque el dominio ACTIVA bloquea cambios
  -- de texto. Combinado con R5a, la única forma de cambiar texto es:
  --   a) Sobre filas BORRADOR/no-existentes (nuevo INSERT sí permite texto)
  --   b) Si nunca hubo ACTIVA antes (no aplica en este schema, estado es
  --      NOT NULL y CHECK IN ('ACTIVA','ARCHIVADA'))
  IF (OLD.estado = 'ACTIVA' OR NEW.estado = 'ACTIVA')
     AND NEW.texto_aprobado IS DISTINCT FROM OLD.texto_aprobado THEN
    RAISE EXCEPTION 'No se permite modificar texto_aprobado cuando estado anterior o nuevo es ACTIVA (clave=%, version=%). Para corregir: ARCHIVAR + crear nueva (clave, version).', OLD.clave_bloque, OLD.version;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION prevent_active_block_text_modification() IS 'WORM guard hardened (000059): bloquea reactivación ARCHIVADA→ACTIVA y cambios de texto_aprobado cuando OLD o NEW estado es ACTIVA. Cierra bypass detectado por Codex sobre 000058.';

COMMIT;

-- ============================================================================
-- END migration 20260511_000059_v2_plantillas_overrides_worm_hardening
-- ============================================================================
