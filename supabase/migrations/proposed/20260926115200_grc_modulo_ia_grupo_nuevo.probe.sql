-- Ensayo revertido de 20260926115200_grc_modulo_ia_grupo_nuevo.sql (MOI-152).
-- Solo lectura sobre el resultado final: aplica la migración completa dentro
-- de una transacción que SIEMPRE termina en rollback. No se ejecuta desde
-- este agente (restricción de tarea); lo ejecuta el orquestador antes de
-- autorizar la aplicación real.

begin;

insert into public.grc_modules (tenant_id, id, name, description, owner)
values (
  '00000000-0000-0000-0000-000000000003',
  'ai',
  'Gobernanza de la IA',
  'Obligaciones de organización del Reglamento (UE) 2024/1689 (RIA): alfabetización, gestión de la calidad y protocolos de uso. El inventario de sistemas y su clasificación viven en el módulo de IA.',
  'Pendiente de designación'
)
on conflict (tenant_id, id) do nothing;

-- Control positivo: una OBL-RIA-* ya resuelve a 'ai' con el módulo creado.
insert into public.obligations (tenant_id, code, title)
values ('00000000-0000-0000-0000-000000000003', 'OBL-RIA-VERIF-PROBE', 'ensayo revertido MOI-152');

-- Comprobación de lectura: 1 fila del módulo, 7 en total, ARGA/Garrigues intactos,
-- y la obligación de control cayó en 'ai' (no en 'risk').
select
  (select count(*) from public.grc_modules where tenant_id = '00000000-0000-0000-0000-000000000003' and id = 'ai') as ai_en_nuevo,
  (select count(*) from public.grc_modules where tenant_id = '00000000-0000-0000-0000-000000000003') as total_modulos_nuevo,
  (select count(*) from public.grc_modules where id = 'ai' and tenant_id in ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002')) as ai_en_arga_garrigues,
  (select module_id from public.grc_obligations where tenant_id = '00000000-0000-0000-0000-000000000003' and reference = 'OBL-RIA-VERIF-PROBE') as modulo_resuelto;
-- Esperado: ai_en_nuevo=1, total_modulos_nuevo=7, ai_en_arga_garrigues=2, modulo_resuelto='ai'.

rollback;
