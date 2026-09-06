-- Endurecimiento de RLS y grants. Cierra DA-2..DA-7 y DA-22 del ledger
-- 2026-09-05, más un defecto que el informe describía a medias y que resultó
-- ser más grave de lo registrado (bloque 1).
--
-- Todo lo de aquí se midió antes de escribirlo, con `pg_policies`,
-- `information_schema.role_table_grants` y `column_privileges` sobre
-- governance_OS el 2026-09-06.

-- ---------------------------------------------------------------------------
-- 1. user_profiles — escalada de privilegio y salto de tenant
-- ---------------------------------------------------------------------------
-- El ledger registró que el usuario podía reescribir su `person_id`. La
-- medición de hoy es peor: el grant de UPDATE por columna a `anon` y
-- `authenticated` incluye `tenant_id`, `role_code` y `user_id`, y la política
-- `user_profiles_self_update` (UPDATE, {public}, USING auth.uid() = user_id)
-- NO tiene WITH CHECK.
--
-- Comprobado en vivo con la sesión demo de Garrigues (escritura no destructiva,
-- mismo valor): `update user_profiles set role_code = <su propio valor>` y
-- `set tenant_id = <su propio valor>` devuelven 1 fila y ningún error. Es decir:
-- la capacidad de escribir esas dos columnas existe. Y `fn_current_tenant_id()`
-- resuelve el tenant leyendo precisamente `user_profiles.tenant_id` cuando el
-- JWT no trae claim, así que un usuario podía cambiarse de tenant y de rol.
--
-- Ninguna superficie de cliente escribe esta tabla: `TenantContext.tsx:50`,
-- `useCurrentUser.ts:40` y `Login.tsx:86` solo hacen SELECT; las escrituras
-- vienen de Edge Functions y scripts, que usan service_role.
revoke update on public.user_profiles from anon, authenticated;
drop policy if exists user_profiles_self_update on public.user_profiles;

-- ---------------------------------------------------------------------------
-- 2. rule_pack_versions — lectura pública de los payloads de mayorías (DA-2)
-- ---------------------------------------------------------------------------
-- `rule_pack_versions_read` era SELECT para {public} con `USING (true)` sobre
-- una tabla sin `tenant_id`: una sesión anónima leía las 94 versiones con los
-- payloads de quórum y mayoría de los dos tenants. Se scoping vía `rule_packs`,
-- que sí tiene `tenant_id` (medido: 0 versiones huérfanas, 2 tenants).
drop policy if exists rule_pack_versions_read on public.rule_pack_versions;

create policy rule_pack_versions_tenant_read
  on public.rule_pack_versions for select to authenticated
  using (
    exists (
      select 1 from public.rule_packs p
      where p.id = rule_pack_versions.pack_id
        and p.tenant_id = public.fn_current_tenant_id()
    )
  );

-- El grant traía DELETE/INSERT/UPDATE/TRUNCATE/REFERENCES/TRIGGER además de
-- SELECT. Las escrituras las bloqueaba la RLS por ausencia de política, pero
-- TRUNCATE **no pasa por RLS**: el grant era la única defensa y no había ninguna.
revoke all on public.rule_pack_versions from anon, authenticated;
grant select on public.rule_pack_versions to authenticated;

-- ---------------------------------------------------------------------------
-- 3. pack_rules — mismo patrón (DA-5)
-- ---------------------------------------------------------------------------
-- OJO: `pack_rules.pack_id` referencia `country_packs`, no `rule_packs`
-- (pack_rules_pack_id_fkey). `country_packs` sí tiene `tenant_id`.
drop policy if exists pack_rules_public_read on public.pack_rules;

create policy pack_rules_tenant_read
  on public.pack_rules for select to authenticated
  using (
    exists (
      select 1 from public.country_packs cp
      where cp.id = pack_rules.pack_id
        and cp.tenant_id = public.fn_current_tenant_id()
    )
  );

revoke all on public.pack_rules from anon, authenticated;
grant select on public.pack_rules to authenticated;

-- ---------------------------------------------------------------------------
-- 4. jurisdiction_rule_sets — permisiva pública que anulaba el aislamiento (DA-3)
-- ---------------------------------------------------------------------------
-- Convivían `jurisdiction_rule_sets_public_read` (SELECT, {public},
-- USING true) y `jurisdiction_rule_sets_tenant_isolation` (ALL, authenticated,
-- tenant_id = fn_current_tenant_id()). Al ser ambas PERMISIVAS se OR-ean, así
-- que la lectura quedaba pública y el aislamiento no restringía nada. Se retira
-- la pública; la de tenant ya cubre la lectura legítima (16 filas, 0 con
-- tenant_id NULL: nadie se queda sin ver lo suyo).
drop policy if exists jurisdiction_rule_sets_public_read on public.jurisdiction_rule_sets;

revoke all on public.jurisdiction_rule_sets from anon;
revoke truncate, references, trigger on public.jurisdiction_rule_sets from authenticated;

-- ---------------------------------------------------------------------------
-- 5. registry_filings / registry_filing_events — TRUNCATE a anon (DA-22)
-- ---------------------------------------------------------------------------
-- El DML ya estaba revocado. Quedaban TRUNCATE, REFERENCES y TRIGGER, y
-- TRUNCATE no pasa por RLS.
revoke truncate, references, trigger on public.registry_filings from anon, authenticated;
revoke truncate, references, trigger on public.registry_filing_events from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. reclassify_agenda_item_kind — EXECUTE a anon (DA-4)
-- ---------------------------------------------------------------------------
-- Drift respecto al repo, que solo concede a authenticated y service_role.
revoke execute on function public.reclassify_agenda_item_kind(
  p_agenda_item_id uuid, p_meeting_id uuid, p_new_kind text, p_motivo text
) from anon;

-- ---------------------------------------------------------------------------
-- 7. DEFAULT de tenant a ARGA en 10 columnas (DA-7)
-- ---------------------------------------------------------------------------
-- Un INSERT que olvide el tenant aterrizaba en ARGA en silencio. Ninguna
-- superficie depende del default: las 8 funciones que insertan en estas tablas
-- (`fn_create_governance_evidence_bundle`, `fn_save_meeting_resolutions`,
-- `fn_secretaria_materialize_convocation_agenda`, las cuatro de conciliación
-- EAD y `fn_aims_close_technical_file`) nombran `tenant_id` explícitamente en
-- su lista de columnas —verificado leyendo su `prosrc`—, y el cliente no
-- inserta en ninguna. Sin el default, un olvido futuro falla en voz alta.
alter table public.action_plans             alter column tenant_id drop default;
alter table public.agenda_items             alter column tenant_id drop default;
alter table public.decisions                alter column tenant_id drop default;
alter table public.evidence_bundles         alter column tenant_id drop default;
alter table public.jurisdiction_rule_sets   alter column tenant_id drop default;
alter table public.meeting_attendees        alter column tenant_id drop default;
alter table public.meeting_votes            alter column tenant_id drop default;
alter table public.pactos_parasociales      alter column tenant_id drop default;
alter table public.qtsp_signature_requests  alter column tenant_id drop default;
alter table public.rbac_user_roles          alter column tenant_id drop default;
-- `evidence_bundle_review_events` ya usaba `fn_current_tenant_id()`: se deja.
