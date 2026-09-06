-- Hueco de dato demo medido el 2026-09-06 y encontrado por el golden path, no
-- por ningún informe: `EmitirCertificacionButton` bloquea la certificación con
-- «Presidente no tiene referencia de inscripción registral» (`bloqueaRM`,
-- src/components/secretaria/EmitirCertificacionButton.tsx), y el CdA de la
-- captura canónica UAT era el ÚNICO órgano de ARGA cuya secretaría tenía
-- asiento registral y cuya presidencia no. Medido fila a fila: 1 sola fila en
-- todo el tenant con esa asimetría.
--
-- La convención del dato demo —comprobada en los 14 órganos que sí lo tienen—
-- es que presidencia y secretaría del MISMO órgano comparten referencia y
-- fecha, porque un solo asiento recoge los nombramientos del órgano. Se copia
-- por tanto el asiento de la secretaría hermana (`RM-DEMO-ARGA-CDA-2026`,
-- 2025-01-01), no se inventa uno nuevo.
--
-- NO se escribe con UPDATE: `trg_00_authoritative_writer_guard` rechaza con
-- 42501 cualquier escritura sobre `authority_evidence`/`condiciones_persona`
-- que no venga de una RPC autoritativa. Se usa la RPC canónica, que además
-- deja evento en `cargo_rm_registration_events` y evidencia WORM en
-- `audit_log` — el mismo rastro que dejaría el alta hecha desde la aplicación.
--
-- Idempotente por partida doble: el WHERE solo selecciona la fila si sigue sin
-- referencia, y la propia RPC devuelve el evento existente ante la misma clave.
do $migracion$
declare
  v_tenant constant uuid := '00000000-0000-0000-0000-000000000001';
  v_cond uuid;
begin
  select cp.id
    into v_cond
    from public.condiciones_persona cp
    join public.authority_evidence ae
      on ae.tenant_id = cp.tenant_id
     and ae.body_id = cp.body_id
     and ae.cargo = 'SECRETARIO'
     and ae.estado = 'VIGENTE'
     and ae.inscripcion_rm_referencia = 'RM-DEMO-ARGA-CDA-2026'
   where cp.tenant_id = v_tenant
     and cp.body_id = 'fe05ddd9-ce3e-47b0-8948-5b975c79ab59'
     and cp.tipo_condicion = 'PRESIDENTE'
     and cp.estado = 'VIGENTE'
     and cp.inscripcion_rm_referencia is null
   limit 1;

  if v_cond is null then
    raise notice 'Nada que corregir: la presidencia del CdA ya tiene asiento registral (o no existe la fila).';
    return;
  end if;

  -- La RPC exige claim de rol para saltar los asserts de tenant/capacidad. Es
  -- local a la transacción de la migración.
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);

  perform public.fn_registrar_inscripcion_rm_cargo(
    v_tenant,
    v_cond,
    'RM-DEMO-ARGA-CDA-2026',
    date '2025-01-01',
    'seed-cda-presidente-rm-2026-09-06'
  );
end
$migracion$;
