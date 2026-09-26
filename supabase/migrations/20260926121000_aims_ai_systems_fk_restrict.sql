-- MOI-210 — decision D-12 (por delegacion de Moises, ledger
-- docs/superpowers/plans/2026-09-26-ledger-cierre-masivo-linear.md): opcion b).
--
-- QUE CIERRA
-- ----------
-- `ai_systems` es el unico registro del modulo AIMS donde `authenticated`
-- conserva DELETE (DA-16 del ledger del refactor, `20260914120000`). Cuatro
-- tablas con valor probatorio referencian `ai_systems.id` con ON DELETE
-- CASCADE, asi que borrar un sistema arrastraba en silencio su cuestionario
-- de clasificacion sellado, sus versiones, su expediente tecnico y sus
-- indicadores de vigilancia:
--   * aims_classification_questionnaires (cuestionario sellado, SHA-512 de
--     servidor, inmutable)
--   * aims_system_versions (versiones)
--   * aims_technical_file_sections (expediente tecnico)
--   * aims_monitoring_indicators (indicadores)
--
-- Esta migracion pasa esas 4 FK de CASCADE a RESTRICT: un sistema con
-- cualquiera de esos 4 registros deja de poder borrarse desde la aplicacion.
-- Adelanta la regla RS-TABLA 9 del programa RIA
-- (docs/superpowers/specs/2026-09-19-aims-cobertura-ria-experto-design.md,
-- enmienda E-02) antes de que Garrigues clasifique sus sistemas.
--
-- El permiso DELETE de `authenticated` sobre `ai_systems` NO se toca aqui: la
-- decision fue mantenerlo (opcion b, no a). Un sistema SIN ninguno de esos 4
-- registros sigue siendo borrable como hoy.
--
-- Cero cambio de dato: ninguna fila se inserta, actualiza ni borra. Cero
-- cambio ARGA. Cero cambio Garrigues. Cero cambio visible en pantalla.
--
-- Idempotente: solo altera la FK cuando su `confdeltype` no es ya 'r'
-- (RESTRICT), asi que reaplicar esta migracion no falla ni repite trabajo.

do $$
declare
  v_conname text;
begin
  select conname into v_conname
    from pg_constraint
    where conrelid = 'public.aims_classification_questionnaires'::regclass
      and confrelid = 'public.ai_systems'::regclass
      and contype = 'f';
  if v_conname is not null then
    execute format(
      'alter table public.aims_classification_questionnaires drop constraint %I, add constraint %I foreign key (system_id) references public.ai_systems(id) on delete restrict',
      v_conname, v_conname
    );
  end if;

  select conname into v_conname
    from pg_constraint
    where conrelid = 'public.aims_system_versions'::regclass
      and confrelid = 'public.ai_systems'::regclass
      and contype = 'f';
  if v_conname is not null then
    execute format(
      'alter table public.aims_system_versions drop constraint %I, add constraint %I foreign key (system_id) references public.ai_systems(id) on delete restrict',
      v_conname, v_conname
    );
  end if;

  select conname into v_conname
    from pg_constraint
    where conrelid = 'public.aims_technical_file_sections'::regclass
      and confrelid = 'public.ai_systems'::regclass
      and contype = 'f';
  if v_conname is not null then
    execute format(
      'alter table public.aims_technical_file_sections drop constraint %I, add constraint %I foreign key (system_id) references public.ai_systems(id) on delete restrict',
      v_conname, v_conname
    );
  end if;

  select conname into v_conname
    from pg_constraint
    where conrelid = 'public.aims_monitoring_indicators'::regclass
      and confrelid = 'public.ai_systems'::regclass
      and contype = 'f';
  if v_conname is not null then
    execute format(
      'alter table public.aims_monitoring_indicators drop constraint %I, add constraint %I foreign key (system_id) references public.ai_systems(id) on delete restrict',
      v_conname, v_conname
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Verificacion: aborta si alguna de las 4 FK no quedo en RESTRICT.
-- Control positivo del propio instrumento: una FK hacia ai_systems que la
-- migracion NO toca (aims_evidence_packs, tabla muerta declarada, DA-9) debe
-- seguir en CASCADE; si la consulta de control dejara de encontrar ninguna FK
-- en 'c', la propia comprobacion estaria rota (falso positivo silencioso).
-- ---------------------------------------------------------------------------
do $$
declare
  v_restrict_count integer;
  v_control_cascade_count integer;
begin
  select count(*) into v_restrict_count
    from pg_constraint
    where contype = 'f'
      and confrelid = 'public.ai_systems'::regclass
      and conrelid = any (array[
        'public.aims_classification_questionnaires'::regclass,
        'public.aims_system_versions'::regclass,
        'public.aims_technical_file_sections'::regclass,
        'public.aims_monitoring_indicators'::regclass
      ])
      and confdeltype = 'r';

  if v_restrict_count <> 4 then
    raise exception 'MOI-210: se esperaban 4 FK en RESTRICT hacia ai_systems (cuestionario, versiones, expediente tecnico, indicadores); se encontraron %', v_restrict_count;
  end if;

  select count(*) into v_control_cascade_count
    from pg_constraint
    where contype = 'f'
      and confrelid = 'public.ai_systems'::regclass
      and conrelid = 'public.aims_evidence_packs'::regclass
      and confdeltype = 'c';

  if v_control_cascade_count <> 1 then
    raise exception 'MOI-210: control positivo fallido — aims_evidence_packs deberia seguir en CASCADE (no forma parte de esta migracion) y no lo esta; la comprobacion de arriba no es de fiar';
  end if;
end $$;
