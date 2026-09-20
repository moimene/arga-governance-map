-- 20260920140000_grc_obligacion_ria_art4.sql
--
-- F5.T5 (primer paso) — la obligación del art. 4 del RIA, en el registro de GRC.
--
-- POR QUÉ ESTA Y NO OTRA
-- ----------------------
-- El experto lo dice en su propuesta de convergencia (§7, punto 5): «Empezar por
-- el art. 4, la única obligación de organización que ya vincula sin condiciones a
-- los dos tenants». Y es exacto: el art. 4, en la redacción del Reglamento (UE)
-- 2026/1744, obliga a proveedores y a responsables del despliegue de CUALQUIER
-- nivel de riesgo, y se aplica desde el 2-2-2025. No depende del anexo III, ni de
-- la fecha del capítulo III, ni de ningún hecho que no conste.
--
-- Hasta hoy el art. 4 se medía DENTRO de cada evaluación de sistema, y por eso no
-- se medía en ninguno de los 14: es una obligación de la organización, no del
-- sistema. Sacarla de ahí y ponerla donde viven las demás obligaciones de
-- organización es justo el punto 5 del experto.
--
-- QUÉ HACE, Y QUÉ NO
-- ------------------
--   * Una fila `OBL-RIA-ORG-04` por tenant, idempotente por código, con su órgano
--     responsable y su política de IA.
--   * FALLA CERRADO: si el órgano o la política no existen, la migración aborta.
--     Una obligación sin órgano acreditado no se da de alta (misma regla que G4).
--   * Resuelve el órgano por SLUG y la política por CÓDIGO, no por UUID: un UUID
--     copiado a mano es la forma más fácil de sembrar en el tenant equivocado.
--   * **NO crea ningún control.** `controls.status` solo admite Efectivo, Parcial
--     o Inefectivo: no hay valor para «declarado y todavía sin probar». Crear el
--     control obligaría a afirmar una efectividad que nadie ha medido. La
--     obligación aparece, por tanto, SIN COBERTURA — que es la verdad: ninguno de
--     los dos tenants tiene hoy acreditadas sus medidas del art. 4. El control
--     llega con el registro de formación (F5.T6), que es lo que da la evidencia.
--   * **NO toca el tenant `…0003`**, que es de otra sesión.
--
-- CAMBIO VISIBLE EN ARGA, DECLARADO
-- ---------------------------------
-- ARGA pasa de 5 a 6 obligaciones y estrena la sección «Gobernanza de la IA» en
-- `/obligaciones`. Es aditivo y es consecuencia de la decisión D-U2 del usuario
-- (aceptada el 2026-09-20), que fija el CATIT como su órgano de IA.

begin;

do $alta$
declare
  t record;
  v_body uuid;
  v_policy uuid;
begin
  for t in
    select * from (values
      ('00000000-0000-0000-0000-000000000001'::uuid, 'comite-tecnologia', 'PR-024'),
      ('00000000-0000-0000-0000-000000000002'::uuid, 'garrigues-comite-gobernanza-ia', 'PI-30')
    ) as v(tenant_id, body_slug, policy_code)
  loop
    select id into v_body from public.governing_bodies
     where tenant_id = t.tenant_id and slug = t.body_slug;
    if v_body is null then
      raise exception 'ALTA: el tenant % no tiene el órgano %; sin órgano acreditado no se da de alta la obligación', t.tenant_id, t.body_slug;
    end if;

    select id into v_policy from public.policies
     where tenant_id = t.tenant_id and policy_code = t.policy_code;
    if v_policy is null then
      raise exception 'ALTA: el tenant % no tiene la política %', t.tenant_id, t.policy_code;
    end if;

    insert into public.obligations
      (tenant_id, code, title, source, criticality, policy_id, country_scope, owner_body_id, legal_reference, periodicity)
    values (
      t.tenant_id,
      'OBL-RIA-ORG-04',
      'Alfabetización en materia de IA del personal que opera y utiliza sistemas de IA',
      'RIA — Reglamento (UE) 2024/1689',
      'Alto',
      v_policy,
      '{ES}',
      v_body,
      'Reglamento (UE) 2024/1689, art. 4, en la redacción del Reglamento (UE) 2026/1744. Aplicable desde el 2-2-2025. Vincula a proveedores y a responsables del despliegue de cualquier nivel de riesgo. Obligación de medios: se acredita con las medidas adoptadas —formación, instrucciones, política de uso—, no con un nivel de conocimiento garantizado.',
      'CONTINUA'
    )
    on conflict (tenant_id, code) do nothing;
  end loop;
end $alta$;

-- Verificación que ABORTA.
do $verificacion$
declare
  v_obl int;
  v_ai int;
  v_sin_organo int;
  v_otros int;
begin
  select count(*) into v_obl from public.obligations where code = 'OBL-RIA-ORG-04';
  if v_obl <> 2 then raise exception 'V1: se esperaban 2 obligaciones del art. 4 y hay %', v_obl; end if;

  -- Va al módulo 'ai' del espejo, no a 'risk' (es lo que arregló F5.T3).
  select count(*) into v_ai from public.grc_obligations
   where reference = 'OBL-RIA-ORG-04' and module_id = 'ai';
  if v_ai <> 2 then raise exception 'V2: solo % de las 2 llegaron al módulo ai', v_ai; end if;

  -- Ninguna queda sin órgano: es la condición de alta.
  select count(*) into v_sin_organo from public.obligations
   where code = 'OBL-RIA-ORG-04' and owner_body_id is null;
  if v_sin_organo <> 0 then raise exception 'V3: % obligaciones del art. 4 sin órgano', v_sin_organo; end if;

  -- Control negativo: no se ha sembrado en ningún otro tenant.
  select count(*) into v_otros from public.obligations
   where code = 'OBL-RIA-ORG-04'
     and tenant_id not in ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');
  if v_otros <> 0 then raise exception 'V4: se ha sembrado en % tenants ajenos al programa', v_otros; end if;

  raise notice 'F5.T5 OK: art. 4 dado de alta en los dos tenants, con órgano y en el módulo ai';
end $verificacion$;

commit;
