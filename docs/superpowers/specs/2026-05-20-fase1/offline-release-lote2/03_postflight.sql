-- Postflight Lote 2 - schema/NA rule packs Secretaria 360.
-- Ejecutar tras 02_patch.sql y antes de reconstruir artefactos read-only.

select
  action,
  count(*) as audit_entries,
  min(created_at) as first_entry_at,
  max(created_at) as last_entry_at
from public.audit_log
where action = 'SECRETARIA_RULEPACK_LOTE2_SCHEMA_FIX'
group by action;

select
  object_id::uuid as rule_pack_version_id,
  previous_hash,
  current_hash,
  delta ->> 'pack_id' as pack_id,
  delta ->> 'materia' as materia,
  delta ->> 'organo_tipo' as organo_tipo,
  delta ->> 'version' as version
from public.audit_log
where action = 'SECRETARIA_RULEPACK_LOTE2_SCHEMA_FIX'
order by delta ->> 'materia';

select
  rpv.pack_id,
  rpv.id::text as rule_pack_version_id,
  rpv.version,
  rpv.payload_hash
from public.rule_pack_versions rpv
where rpv.id in (
  select object_id::uuid
  from public.audit_log
  where action = 'SECRETARIA_RULEPACK_LOTE2_SCHEMA_FIX'
)
order by rpv.pack_id;

-- La verificacion completa de contadores se hace con los scripts read-only:
--   bun run rulepacks:fase1:extract -- --out /tmp/arga-fase1-current --read-only
--   bun run rulepacks:fase1:validate -- --actual-dir /tmp/arga-fase1-current
--   bun run rulepacks:fase1:lint-gates:strict -- --dir /tmp/arga-fase1-current
--   bun run rulepacks:fase1:delta
