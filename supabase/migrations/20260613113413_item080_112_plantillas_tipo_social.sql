-- ITEM-080/112: dimensión tipo_social en plantillas_protegidas para habilitar
-- DL-4 (selección/compatibilidad de plantilla por tipo social SA/SL).
-- Aditivo y nullable: NULL = la plantilla aplica a cualquier tipo social
-- (comportamiento actual preservado); un valor (SA/SL/SAU/SLU) restringe la
-- compatibilidad al tipo social de la entidad (con mapeo de régimen SAU→SA, SLU→SL
-- resuelto en el filtro de compatibilidad del frontend).
ALTER TABLE plantillas_protegidas ADD COLUMN IF NOT EXISTS tipo_social text;

COMMENT ON COLUMN plantillas_protegidas.tipo_social IS
  'ITEM-080/112: tipo social al que aplica la plantilla (SA/SL/SAU/SLU). NULL = aplica a todos. Eje de compatibilidad DL-4.';
