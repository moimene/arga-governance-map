-- G2 pase complementario (metadata/fecha_fin que fn_designar_cargo no acepta).
-- Ejecutar vía MCP execute_sql (current_user=postgres). El GUC habilita el
-- guard autoritativo para esta sesión.
SELECT set_config('secretaria.authoritative_writer', 'fn_registrar_inscripcion_rm_cargo', false);

UPDATE condiciones_persona SET
  fecha_fin = '2032-06-30',
  metadata = COALESCE(metadata,'{}'::jsonb) || '{"nota":"Reelección por 6 años (Junta 06/05/2026); mandato anterior vencía 31/01/2028"}'::jsonb
WHERE tenant_id = '00000000-0000-0000-0000-000000000002' AND tipo_condicion = 'ADMIN_UNICO'
  AND person_id = (SELECT id FROM persons WHERE tenant_id='00000000-0000-0000-0000-000000000002' AND full_name='Fernando Vives Ruiz');

UPDATE condiciones_persona SET
  metadata = COALESCE(metadata,'{}'::jsonb) || '{"cargo":"SENIOR_PARTNER","nota":"Preside el Consejo de Socios (art. 29 Estatutos); supervisa PPD y PBC/FT"}'::jsonb
WHERE tenant_id = '00000000-0000-0000-0000-000000000002' AND tipo_condicion = 'SOCIO' AND body_id IS NULL
  AND person_id = (SELECT id FROM persons WHERE tenant_id='00000000-0000-0000-0000-000000000002' AND full_name='Rosa Zarza Jimeno');

UPDATE condiciones_persona SET
  metadata = COALESCE(metadata,'{}'::jsonb) || '{"consejero_delegado":true,"fuente":"BORME (delegación inscrita desde 03/05/2023)"}'::jsonb
WHERE tenant_id = '00000000-0000-0000-0000-000000000002' AND tipo_condicion = 'CONSEJERO'
  AND person_id = (SELECT id FROM persons WHERE tenant_id='00000000-0000-0000-0000-000000000002' AND full_name='Eduardo Inza Blasco');

UPDATE condiciones_persona SET
  metadata = COALESCE(metadata,'{}'::jsonb) || '{"no_consejero":true}'::jsonb
WHERE tenant_id = '00000000-0000-0000-0000-000000000002' AND tipo_condicion IN ('SECRETARIO','VICESECRETARIO')
  AND person_id IN (SELECT id FROM persons WHERE tenant_id='00000000-0000-0000-0000-000000000002' AND full_name IN ('Roberto Delgado Gil','Belén Aguayo'));

SELECT set_config('secretaria.authoritative_writer', '', false);
