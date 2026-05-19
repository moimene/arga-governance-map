-- T1 Arga test A, SL — convocatoria de Junta SL.
--
-- Las plantillas activas de convocatoria de Junta estaban etiquetadas como
-- ORGANO_ADMIN, pero el asistente de convocatorias selecciona plantillas por el
-- órgano convocado. Para juntas de SL el órgano efectivo es JUNTA_GENERAL.

update public.plantillas_protegidas
set organo_tipo = 'JUNTA_GENERAL'
where tenant_id = '00000000-0000-0000-0000-000000000001'
  and estado = 'ACTIVA'
  and adoption_mode = 'MEETING'
  and tipo in ('CONVOCATORIA_SL_NOTIFICACION', 'CONVOCATORIA')
  and materia in ('NOTIFICACION_CONVOCATORIA_SL', 'CONVOCATORIA_JUNTA')
  and organo_tipo = 'ORGANO_ADMIN';
