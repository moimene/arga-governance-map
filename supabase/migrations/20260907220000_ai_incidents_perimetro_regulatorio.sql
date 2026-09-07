-- Perímetro regulatorio del incidente: lo que los relojes necesitan saber.
--
-- EL HUECO
-- --------
-- `src/lib/aims/incident-clocks.ts` calcula los tres relojes —art. 73 del
-- Reglamento (UE) 2024/1689, art. 33 del RGPD y art. 19 de DORA— y está
-- probado. Pero la ficha del incidente los alimenta con TRES CONSTANTES a
-- `false`, porque no había dónde declarar si el incidente afecta a datos
-- personales o a una función crítica. Se dejaron en `false` a conciencia el
-- 2026-09-06 —antes arrancaban en `true` y TODO incidente de TODO tenant
-- activaba los tres plazos— y la pantalla lo dice. Pero el motor estaba muerto.
--
-- Un incidente activa obligaciones bajo regímenes DISTINTOS y con plazos
-- distintos: 15 días como máximo general del art. 73, 2 días si hay infracción
-- generalizada, 10 en caso de fallecimiento; 72 horas en el art. 33 del RGPD.
-- Cuál aplica depende de hechos que hay que declarar, no presumir.
--
-- Todas las columnas son NULLABLE: `null` es «no declarado», que no es lo mismo
-- que «no». El motor ya distingue los dos casos —con la clasificación sin
-- registrar muestra el plazo ADVERTIDO, porque ocultar uno que puede aplicar es
-- peor que mostrarlo con la cautela—.

alter table public.ai_incidents
  add column if not exists incident_type text,
  add column if not exists ria_severity text,
  add column if not exists affects_personal_data boolean,
  add column if not exists high_risk_to_subjects boolean,
  add column if not exists affected_count integer,
  add column if not exists ict_related boolean,
  add column if not exists affects_critical_function boolean,
  add column if not exists knowledge_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.ai_incidents'::regclass and conname='ai_incidents_type_check') then
    alter table public.ai_incidents add constraint ai_incidents_type_check
      check (incident_type is null or incident_type in (
        'ALUCINACION', 'FUGA_DATOS', 'USO_INDEBIDO', 'SESGO', 'CAIDA_SERVICIO',
        'DECISION_ERRONEA', 'OTRO'
      ));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.ai_incidents'::regclass and conname='ai_incidents_ria_severity_check') then
    -- Vocabulario EXACTO de `RiaIncidentSeverity` en `incident-clocks.ts`: si
    -- la columna admitiera otro valor, el motor recibiría algo que no sabe leer
    -- y caería al plazo genérico sin decirlo.
    alter table public.ai_incidents add constraint ai_incidents_ria_severity_check
      check (ria_severity is null or ria_severity in (
        'ORDINARY_SERIOUS', 'WIDESPREAD_INFRINGEMENT', 'DEATH_INCIDENT'
      ));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.ai_incidents'::regclass and conname='ai_incidents_affected_count_check') then
    alter table public.ai_incidents add constraint ai_incidents_affected_count_check
      check (affected_count is null or affected_count >= 0);
  end if;
end $$;

comment on column public.ai_incidents.knowledge_at is
  'Momento en que la entidad tuvo CONOCIMIENTO del incidente. Es el que arranca los plazos (art. 33 RGPD, art. 73 RIA), y no tiene por qué coincidir con reported_at.';
comment on column public.ai_incidents.affects_personal_data is
  'NULL = no declarado. El motor de relojes distingue «no declarado» de «no»: con la clasificación sin registrar advierte en vez de ocultar el plazo.';

do $verificacion$
declare
  v_cols int;
  v_checks int;
  v_instrumento int;
begin
  select count(*) into v_cols from information_schema.columns
   where table_schema='public' and table_name='ai_incidents'
     and column_name in ('incident_type','ria_severity','affects_personal_data','high_risk_to_subjects',
                         'affected_count','ict_related','affects_critical_function','knowledge_at');
  if v_cols <> 8 then
    raise exception 'VERIFICACION: esperadas 8 columnas, hay %', v_cols;
  end if;

  select count(*) into v_checks from pg_constraint
   where conrelid='public.ai_incidents'::regclass
     and conname in ('ai_incidents_type_check','ai_incidents_ria_severity_check','ai_incidents_affected_count_check');
  if v_checks <> 3 then
    raise exception 'VERIFICACION: esperados 3 CHECK, hay %', v_checks;
  end if;

  select count(*) into v_instrumento from information_schema.columns
   where table_schema='public' and table_name='tabla_que_no_existe_jamas';
  if v_instrumento <> 0 then
    raise exception 'VERIFICACION: el instrumento encuentra lo que no existe';
  end if;

  raise notice 'VERIFICACION OK: 8 columnas de perímetro y 3 CHECK';
end;
$verificacion$;
