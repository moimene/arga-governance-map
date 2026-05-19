# Ruflo Secretaria sequential tests — context snapshot

Last update: 2026-05-18 20:25:00 CEST

## Baseline

- Repo/worktree: `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map`
- Branch: `main`
- Supabase target: `governance_OS (hzqwefkwsxopwrmtksbg)`
- Sociedad: `Arga test A, SL`
- `entity_id`: `16b28a35-663d-426b-bbf8-9f0d6e8a5d25`
- Consejo: `075a5339-4d58-43e7-8a36-4b11257a760e`
- Junta General: `d3618c8c-cde7-420a-be0d-23137acbdd34`

## Tests verdes

- T0: `SECRETARIA_E2E_ARGA_TEST_A=1 bun run e2e -- e2e/46-secretaria-arga-test-a-sociedad.spec.ts --project=chromium`
- T0: `SECRETARIA_E2E_ARGA_TEST_A_CONVOCATORIA=1 bun run e2e -- e2e/47-secretaria-arga-test-a-convocatoria.spec.ts --project=chromium`
- T1: `SECRETARIA_E2E_ARGA_TEST_A_JUNTA_CONVOCATORIA=1 bun run e2e -- e2e/48-secretaria-arga-test-a-junta-convocatoria.spec.ts --project=chromium`
- T2: `SECRETARIA_E2E_ARGA_TEST_A_REUNION_CONSEJO=1 bun run e2e -- e2e/49-secretaria-arga-test-a-reunion-consejo.spec.ts --project=chromium`
- T3: `SECRETARIA_E2E_ARGA_TEST_A_SIN_SESION_PODERES=1 bun run e2e -- e2e/50-secretaria-arga-test-a-acuerdo-sin-sesion-poderes.spec.ts --project=chromium`
- T4: `SECRETARIA_E2E_ARGA_TEST_A_JUNTA_UNIVERSAL=1 bun run e2e -- e2e/51-secretaria-arga-test-a-junta-universal-admin-unico.spec.ts --project=chromium`
- T5: `SECRETARIA_E2E_ARGA_TEST_A_DECISION_ADMIN_UNICO=1 bun run e2e -- e2e/52-secretaria-arga-test-a-decision-admin-unico-cuentas.spec.ts --project=chromium`
- T6: `SECRETARIA_E2E_ARGA_TEST_A_LIBROS=1 bun run e2e -- e2e/53-secretaria-arga-test-a-libros.spec.ts --project=chromium`
- T7: `SECRETARIA_E2E_ARGA_TEST_A_TRAMITADOR=1 bun run e2e -- e2e/54-secretaria-arga-test-a-tramitador-registro.spec.ts --project=chromium`

## Cloud IDs

- Convocatoria Consejo reutilizada: `0dcc11f0-b32d-46d6-a212-a21e3e3b9346`
- Convocatoria Junta SL T1: `31694b0b-1873-47c8-bff5-6d83d210a877`
- Reunión Consejo T2: `89442d39-61e8-49d4-8692-79d104e8c05f`
- Acta Consejo T2: `12c17178-4dca-417c-bf17-1714cd887fad`
- Resolución T2 — nombramiento consejera delegada: `948ee18d-8549-447f-9d34-61d7466ba66e`
- Acuerdo 360 T2 — nombramiento consejera delegada: `184bdd32-9a37-41ce-b311-17324ec28a26`
- Resolución T2 — presupuesto anual 2026: `4b2b106e-13bf-4b8b-816b-e7795cdaacd9`
- Acuerdo 360 T2 — presupuesto anual 2026: `16d0df28-36ec-40de-bddb-759919203256`
- No-session resolution T3 — concesión de poderes: `d21c0773-4725-4311-bc21-ce15f85133f3`
- Agreement T3 — concesión de poderes (NO_SESSION, ADOPTED): `51e8467b-9678-4b2e-82ec-96efdab404e2`
- Reunión Junta universal T4 (2026-06-16, CELEBRADA, 4 socios PRESENCIAL): `8d2e02f9-6d32-4253-90c8-5d74f9ba3bfd`
- Acta T4 (borrador, sin firmar): `35e2262b-aaa1-4e15-bee6-b487ee9fe440`
- Acuerdo 360 T4 — MODIFICACION_ESTATUTOS (UNIVERSAL, ADOPTED): `047ea232-955c-4806-90be-34794b75ead6`
- Acuerdo 360 T4 — NOMBRAMIENTO_CONSEJERO (UNIVERSAL, ADOPTED): `89657935-fd13-4346-a15b-db5be52a69bc`
- Decisión Admin Único T5 (FIRMADA, formulación cuentas 2026): `005af6f5-a2bb-4308-9d11-d9e2aaac388a`
- Agreement T5 (UNIPERSONAL_ADMIN, ADOPTED): `c28dfe70-6a5e-4b8d-b859-8a2408ffc67b`
- Registry filing T7 (ELEVATED, SIGER, MODIFICACION_ESTATUTOS): `7ef71e4c-0ebf-4b7c-ab61-7d7f6eb69530`

## Cambios T1 pendientes

- Nuevo spec: `e2e/48-secretaria-arga-test-a-junta-convocatoria.spec.ts`
- UI fix: `src/pages/secretaria/ConvocatoriasStepper.tsx`
  - Para `JUNTA_GENERAL`, destinatarios salen de `capital_holdings` vigentes con voto, no de `condiciones_persona`.
  - Variables anidadas para `CONVOCATORIA_SL_NOTIFICACION`: `entities`, `persons.socio_destinatario`, `meetings.junta_sl`, `agreements.convocatoria`, `SISTEMA`, `QTSP`.
- Migración: `supabase/migrations/20260518155932_fix_junta_convocatoria_template_organo.sql`
  - Reetiqueta plantillas activas de convocatoria de Junta SL de `ORGANO_ADMIN` a `JUNTA_GENERAL`.
  - Aplicado manualmente en Cloud para `1d7d5671-2588-4071-a9f6-e9b377d337bc` y `8dcfc85c-9422-4456-aa31-ceea5da6d64d`.

## Verificación post-T1

- `bun run typecheck` passed.
- `bun run build` passed.

## Cambios T2 pendientes

- Nuevo spec: `e2e/49-secretaria-arga-test-a-reunion-consejo.spec.ts`
- UI/hook fixes:
  - `src/hooks/useReunionSecretaria.ts`: deduplica miembros del órgano por `person_id`, priorizando cargos con voto sobre cargos técnicos como secretario; invalida la query de votaciones tras reemplazar asistentes para evitar votos con `attendee_id` obsoleto.
  - `src/lib/secretaria/meeting-agenda.ts`: al mezclar agenda formal y convocatoria, la materia/tipo de convocatoria prevalece sobre inferencias legacy de `agenda_items`.
  - `src/pages/secretaria/ReunionStepper.tsx`: añade materia `DELEGACION_FACULTADES`; estabiliza fallback de conflictos activos para evitar render loop en `VotacionesStep`.
  - `src/pages/secretaria/ActaDetalle.tsx`: bloquea emisión de certificación cuando el acta no está aprobada/firmada, con mensaje RRM arts. 108-109.
- Migración Cloud aplicada: `supabase/migrations/20260518173500_fix_meeting_resolutions_digest_schema.sql`
  - Parchea `fn_save_meeting_resolutions` para llamar `extensions.digest(...)` en Supabase Cloud.
  - Registrada en Cloud junto con `20260518155932_fix_junta_convocatoria_template_organo.sql`.

## Verificación post-T2

- `SECRETARIA_E2E_ARGA_TEST_A_REUNION_CONSEJO=1 bun run e2e -- e2e/49-secretaria-arga-test-a-reunion-consejo.spec.ts --project=chromium` passed.
- `bun run typecheck` passed.
- `bun run build` passed.
- `supabase migration list --linked` muestra `20260518155932` y `20260518173500` aplicadas en remoto.
- Cloud T2: reunión `CELEBRADA`, 2 resoluciones `ADOPTED`, 2 acuerdos 360 vinculados, acta `signed_at=null`, 0 certificaciones.

## Cambios T3 aplicados

- Nuevo spec: `e2e/50-secretaria-arga-test-a-acuerdo-sin-sesion-poderes.spec.ts`
  - Crea expediente por escrito sin sesión del Consejo (kind `DELEGACION_FACULTADES`, materia ORDINARIA) en favor de Laura Molina Poderes Arga Test, todos votan FAVOR.
  - Verifica `adoption_mode='NO_SESSION'`, `no_session_resolution_id` enlazado, agreement ADOPTED, ausencia de minute/certification y que el botón "Emitir certificación" no aparece en el expediente.
- Bug producto corregido: `src/pages/secretaria/AcuerdoSinSesionStepper.tsx` dedupea `activeMembers` por `person_id` antes de computar `total_members`. Sin dedup, las personas con dos `condiciones_persona` activas (ej. Mateo Soler CONSEJERO+SECRETARIO) inflaban el total y `fn_no_session_close_and_materialize_agreement` rechazaba el cierre con "no_session_resolution ... is not decided by WORM responses". Bug detectado por e2e/50.

## Verificación post-T3

- `bun run typecheck` passed.
- T0/T1/T2/T3 verdes en serie: 46 (1/1), 47 (2/2), 48 (2/2), 49 (1/1), 50 (1/1).
- Cloud T3: resolución `APROBADO` (votes_for=3, total_members=3 ya deduplicado), agreement `ADOPTED` con `adoption_mode='NO_SESSION'`, sin minute ni certification (cumple RRM 109: no se puede certificar sin acta_acuerdo_escrito aprobada).

## Cambios T4 aplicados

- Nuevo spec: `e2e/51-secretaria-arga-test-a-junta-universal-admin-unico.spec.ts`
  - Crea Junta universal SL (4 socios PRESENCIAL = 100% capital), aprueba MODIFICACION_ESTATUTOS (cambio a Admin Único) + NOMBRAMIENTO_CONSEJERO (Clara Rivas como Administradora Única). Verifica `quorum_data.is_universal=true`, `junta_universal=true`, 2 acuerdos 360 con `adoption_mode='UNIVERSAL'`, acta en borrador y bloqueo de certificación RRM 108-109.
- Bug producto corregido: `src/lib/secretaria/agreement-360.ts` `normalizeRequiredMajorityCode` ahora emite `REFORZADA_2_3` para clases ESTATUTARIA / ESTRUCTURAL en lugar de los códigos coloquiales `REFORZADA` / `ESTRUCTURAL`. El trigger SQL `fn_agreements_majority_check` mapea contra `materia_catalog.min_majority_code` usando `fn_majority_level` (sólo conoce SIMPLE / REFORZADA_2_3 / UNANIMIDAD), así que los códigos previos colapsaban a level 0 y bloqueaban materias estatutarias como MODIFICACION_ESTATUTOS.
- Bug producto corregido: `src/lib/secretaria/meeting-agenda.ts` `mergeMeetingAgendaSources` deja prevalecer la `materia/tipo` del saved debate sobre la inferencia legacy de `agenda_items` (`MEETING_AGENDA`). Antes, cualquier punto saved cuya materia se hubiera editado por el secretario quedaba sobreescrito por `defaultMateriaForTitle` (→ APROBACION_CUENTAS), salvo cuando el source provenía de CONVOCATORIA o PREPARED_AGREEMENT donde la materia sí es autoritativa.

## Verificación post-T4

- `bun run typecheck` passed.
- `bun test src/lib/secretaria/__tests__/` passed (551 pass / 2 skip / 0 fail).
- T0/T0c/T1/T2/T3/T4 verdes en serie: 46 (1/1), 47 (2/2), 48 (2/2), 49 (1/1), 50 (1/1), 51 (1/1).
- Cloud T4: meeting `CELEBRADA`, 4 attendees PRESENCIAL, 2 acuerdos 360 con `adoption_mode='UNIVERSAL'` y kinds `MODIFICACION_ESTATUTOS`/`NOMBRAMIENTO_CONSEJERO`, acta `signed_at=null`, sin certificación.

## Cambios T5/T6/T7 aplicados

T5 — Decisión del Administrador Único (formulación de cuentas):
- Nuevo spec: `e2e/52-secretaria-arga-test-a-decision-admin-unico-cuentas.spec.ts`.
  - Registra decisión `ADMINISTRADOR_UNICO` con materia `APROBACION_CUENTAS` (el catálogo no expone `FORMULACION_CUENTAS`; usamos la materia más cercana, la trazabilidad va en el texto).
  - Verifica `agreements.adoption_mode='UNIPERSONAL_ADMIN'`, `unipersonal_decision_id` enlazado, status `ADOPTED`, sin meeting/convocatoria, y que el expediente UI muestra el botón "Generar documento" pero NO "Emitir certificación".

T6 — Libros societarios:
- Nuevo spec: `e2e/53-secretaria-arga-test-a-libros.spec.ts`.
  - Verifica cap table en `LibroSocios`: 4 socios al 25%, clases A (ordinaria) y B (`economic_rights_coeff=1.25`, restricción `preferred_dividend=true`).
  - Verifica que el registro operativo de actas (`/secretaria/actas`) lista actas del Consejo (T2) y Junta universal (T4), todas en BORRADOR.
  - Reverifica gate de certificación RRM 108-109 al entrar a una acta sin firmar.

T7 — Tramitador registral:
- Nuevo spec: `e2e/54-secretaria-arga-test-a-tramitador-registro.spec.ts`.
  - Tramita la modificación estatutaria del Admin Único: paso por el stepper (steps 1-5), captura notaría/protocolo/fecha y canal SIGER, click "Registrar escritura".
  - Verifica creación de `registry_filings` con `agreement_id` correcto, `status='ELEVATED'`, `filing_via='SIGER'`, notario y protocolo persistidos.
- Bug producto corregido: `src/pages/secretaria/TramitadorStepper.tsx` ya no envía la columna inexistente `filing_type` al INSERT en `registry_filings`. El schema Cloud sólo expone `filing_via`, `filing_number`, `deed_*`, etc.; enviar `filing_type` provocaba `PGRST204 - schema cache miss` y reventaba el flujo registral completo. El valor calculado se conserva en memoria para plantillas y UI (variable usada por `buildRegistryVariables`); aplicar columna y backfill registral queda como deuda pendiente.

## Verificación post-T5/T6/T7

- `bun run typecheck`: pass.
- Secuencia T0-T7 verde end-to-end (46→54): 2/2, 3/3, 3/3, 2/2, 2/2, 2/2, 2/2, 2/2, 2/2.
- Cloud T5: decisión `FIRMADA`, agreement `ADOPTED/UNIPERSONAL_ADMIN`, sin acta ni certificación asociadas.
- Cloud T6: cap table de 4 socios, dos actas en borrador (Consejo y Junta universal), libros obligatorios vacíos (no hay seed para mandatory_books de la sociedad demo).
- Cloud T7: 1 `registry_filings ELEVATED` con `agreement_id=047ea232-955c-4806-90be-34794b75ead6` (MODIFICACION_ESTATUTOS T4), notario "Notaría López García, Madrid", protocolo "2026/5432-ARGA-TEST-A", canal SIGER.

## Estado final

Ejecutado el ciclo completo T0-T7 propuesto en el prompt Ruflo. Bugs producto detectados y corregidos:

1. `useReplaceAttendees.onSuccess` no invalidaba la query de votaciones tras delete+insert de attendees (T2 — `src/hooks/useReunionSecretaria.ts`).
2. `AcuerdoSinSesionStepper.activeMembers` no dedup por `person_id`, total_members incorrecto y RPC WORM rechazaba el cierre (T3 — `src/pages/secretaria/AcuerdoSinSesionStepper.tsx`).
3. `agreement-360.normalizeRequiredMajorityCode` emitía códigos coloquiales rechazados por el trigger SQL `fn_agreements_majority_check` (T4 — `src/lib/secretaria/agreement-360.ts`).
4. `meeting-agenda.mergeMeetingAgendaSources` permitía que la inferencia de materia desde agenda_items pisara la edición del secretario (T4 — `src/lib/secretaria/meeting-agenda.ts`).
5. `TramitadorStepper.handleRegisterDeed` enviaba columna inexistente `filing_type` al INSERT (T7 — `src/pages/secretaria/TramitadorStepper.tsx`).
6. e2e/47 strict-mode tolerante a fecha repetida tras T2 (`e2e/47-secretaria-arga-test-a-convocatoria.spec.ts`).

Próximos pasos (fuera del prompt): documentar cada fix en un PR independiente, considerar añadir las columnas faltantes `filing_type` y materia `FORMULACION_CUENTAS` al schema Cloud en una migración posterior, y revisar si `mandatory_books` debe poblarse automáticamente al crear una sociedad SL.
