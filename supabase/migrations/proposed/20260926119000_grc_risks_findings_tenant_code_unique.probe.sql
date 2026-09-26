begin;

-- Aplica la migración completa dentro de la transacción de ensayo (inline,
-- no \i, para no depender del directorio desde el que se invoque psql).
DO $verify_before$
DECLARE
  v_risks_dupes int;
  v_findings_dupes int;
  v_null_codes int;
BEGIN
  SELECT count(*) INTO v_risks_dupes
    FROM (SELECT tenant_id, code FROM public.risks WHERE code IS NOT NULL GROUP BY 1,2 HAVING count(*) > 1) d;
  SELECT count(*) INTO v_findings_dupes
    FROM (SELECT tenant_id, code FROM public.findings WHERE code IS NOT NULL GROUP BY 1,2 HAVING count(*) > 1) d;
  SELECT
    (SELECT count(*) FROM public.risks WHERE code IS NULL)
    + (SELECT count(*) FROM public.findings WHERE code IS NULL)
    INTO v_null_codes;

  IF v_risks_dupes > 0 THEN
    RAISE EXCEPTION 'ABORTADO: % códigos (tenant_id, code) duplicados en risks; requiere decisión antes de crear el índice único', v_risks_dupes;
  END IF;
  IF v_findings_dupes > 0 THEN
    RAISE EXCEPTION 'ABORTADO: % códigos (tenant_id, code) duplicados en findings; requiere decisión antes de crear el índice único', v_findings_dupes;
  END IF;
  IF v_null_codes > 0 THEN
    RAISE EXCEPTION 'ABORTADO: % filas con code NULL en risks/findings; el índice único los trataría como distintos entre sí sin avisar', v_null_codes;
  END IF;
END
$verify_before$;

ALTER TABLE public.findings DROP CONSTRAINT IF EXISTS findings_code_key;

CREATE UNIQUE INDEX IF NOT EXISTS ux_risks_tenant_code ON public.risks (tenant_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS ux_findings_tenant_code ON public.findings (tenant_id, code);

DO $verify_after$
DECLARE
  v_old_constraint_exists boolean;
  v_risks_idx_ok boolean;
  v_findings_idx_ok boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'findings_code_key'
  ) INTO v_old_constraint_exists;
  IF v_old_constraint_exists THEN
    RAISE EXCEPTION 'ABORTADO: findings_code_key sigue existiendo tras el DROP CONSTRAINT';
  END IF;

  SELECT i.indisunique
    AND array_agg(a.attname ORDER BY k.ord) = ARRAY['tenant_id','code']
    INTO v_risks_idx_ok
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    JOIN unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord) ON true
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
    WHERE c.relname = 'ux_risks_tenant_code'
    GROUP BY i.indisunique;
  IF v_risks_idx_ok IS NOT TRUE THEN
    RAISE EXCEPTION 'ABORTADO: ux_risks_tenant_code no es un índice único (tenant_id, code) tal cual esperado';
  END IF;

  SELECT i.indisunique
    AND array_agg(a.attname ORDER BY k.ord) = ARRAY['tenant_id','code']
    INTO v_findings_idx_ok
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    JOIN unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord) ON true
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
    WHERE c.relname = 'ux_findings_tenant_code'
    GROUP BY i.indisunique;
  IF v_findings_idx_ok IS NOT TRUE THEN
    RAISE EXCEPTION 'ABORTADO: ux_findings_tenant_code no es un índice único (tenant_id, code) tal cual esperado';
  END IF;
END
$verify_after$;

-- Comprobación 1: findings_code_key ya no existe.
select count(*) as findings_code_key_restante
  from pg_constraint where conname = 'findings_code_key';

-- Comprobación 2: los dos índices únicos (tenant_id, code) existen.
select tablename, indexname, indexdef
  from pg_indexes
  where schemaname = 'public'
    and indexname in ('ux_risks_tenant_code', 'ux_findings_tenant_code')
  order by tablename;

-- Comprobación 3 (control positivo del propio instrumento): mismo código,
-- dos tenants distintos debe permitirse; mismo código repetido en el MISMO
-- tenant debe rechazarse. Se hace con savepoints para no dejar residuo si
-- alguna aserción falla, y todo se deshace igualmente por el ROLLBACK final.
savepoint sp_control_positivo;

insert into public.risks (tenant_id, code, title, description)
values ('00000000-0000-0000-0000-000000000001', 'PROBE-MOI-190', 'Sonda MOI-190 ARGA', 'sonda revertida');

insert into public.risks (tenant_id, code, title, description)
values ('00000000-0000-0000-0000-000000000002', 'PROBE-MOI-190', 'Sonda MOI-190 Garrigues', 'sonda revertida');
-- Debe haber insertado 2 filas (mismo code, tenants distintos = permitido).
select count(*) as debe_ser_2 from public.risks where code = 'PROBE-MOI-190';

-- Repetir el mismo código en el MISMO tenant (…0001) debe fallar por el
-- índice único nuevo. Se envuelve en su propio savepoint para poder seguir
-- leyendo el resultado del error sin abortar todo el bloque de control.
savepoint sp_debe_fallar;
insert into public.risks (tenant_id, code, title, description)
values ('00000000-0000-0000-0000-000000000001', 'PROBE-MOI-190', 'Sonda MOI-190 ARGA duplicada', 'sonda revertida');
-- Si la línea anterior no lanzó error, esta línea es la prueba de que el
-- control positivo FALLÓ (el índice no está enforceando):
select 1/0 as el_indice_no_esta_enforceando;

rollback to savepoint sp_debe_fallar;

rollback to savepoint sp_control_positivo;

rollback;
