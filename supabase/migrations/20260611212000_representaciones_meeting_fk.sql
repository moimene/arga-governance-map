-- Hallazgo derivado de ITEM-021 (Iteración 24) — loop estabilización (2026-06-11)
-- ============================================================================
-- `representaciones.meeting_id` no tenía FK a `meetings`: el embed PostgREST
-- `meeting:meeting_id(...)` de useRepresentaciones fallaba SIEMPRE
-- ("Could not find a relationship between 'representaciones' and
-- 'meeting_id'"), el hook lanzaba error y la pestaña Representaciones de la
-- ficha societaria mostraba "Sin representaciones vigentes" con datos
-- existentes (e2e 34 en rojo). El modelo canónico declara la FK
-- (JUNTA_PROXY/CONSEJO_DELEGACION van ancladas a reunión); 0 huérfanos
-- verificados antes de crearla.

ALTER TABLE public.representaciones
  ADD CONSTRAINT representaciones_meeting_id_fkey
  FOREIGN KEY (meeting_id) REFERENCES public.meetings(id);

-- PostgREST recarga el schema cache con NOTIFY:
NOTIFY pgrst, 'reload schema';
