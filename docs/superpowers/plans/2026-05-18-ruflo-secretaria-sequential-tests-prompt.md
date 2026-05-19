# Prompt — Ruflo supervisado para pruebas secuenciales de Secretaria

Usa este prompt en un hilo nuevo de Codex para continuar con bajo contexto.

---

## Rol

Actua como supervisor Codex del repo `arga-governance-map` y coordina trabajo secuencial en modo Ruflo. El objetivo no es avanzar en paralelo: es ejecutar un test E2E cada vez sobre la misma sociedad demo, corregir bugs del stepper correspondiente, verificar, registrar el resultado y solo entonces pasar al siguiente.

Trabaja siempre en:

`/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map`

Rama operativa: `main`. No abras worktrees nuevos. No reviertas cambios no tuyos. Antes de tocar Supabase ejecuta:

```bash
bun run db:check-target
```

El target valido es `governance_OS (hzqwefkwsxopwrmtksbg)`. Si no coincide, para.

## Contexto rehidratado

Sociedad de prueba ya creada en Cloud:

- Sociedad: `Arga test A, SL`
- `entity_id`: `16b28a35-663d-426b-bbf8-9f0d6e8a5d25`
- Tipo: Sociedad Limitada
- Estado: operativa
- Consejo de Administracion: `075a5339-4d58-43e7-8a36-4b11257a760e`
- Convocatoria de Consejo ya emitida: `0dcc11f0-b32d-46d6-a212-a21e3e3b9346`
- Fecha convocatoria Consejo: `2026-06-07T08:00:00Z` (10:00 Madrid)

Cap table:

- Clara Rivas Arga Test: 25%, clase A
- Mateo Soler Arga Test: 25%, clase A
- Nerea Vidal Arga Test: 25%, clase A
- ARGA Seguros S.A.: 25%, clase B

Clases:

- Clase A: ordinaria
- Clase B: `economic_rights_coeff = 1.25`, `preferred_dividend = true`, descripcion: `Dividendo preferente para ARGA Seguros antes de reparto ordinario`

Consejo:

- Clara Rivas Arga Test: PRESIDENTE
- Mateo Soler Arga Test: CONSEJERO y SECRETARIO
- ARGA Seguros S.A.: CONSEJERO PJ con representante permanente PF

Estado de tests ya creado:

- `e2e/46-secretaria-arga-test-a-sociedad.spec.ts`
- `e2e/47-secretaria-arga-test-a-convocatoria.spec.ts`
- Migracion: `supabase/migrations/20260518134841_share_classes_restrictions.sql`

Verificaciones ya pasadas en el hilo anterior:

```bash
bun run db:check-target
SECRETARIA_E2E_ARGA_TEST_A=1 bun run e2e -- e2e/46-secretaria-arga-test-a-sociedad.spec.ts --project=chromium
SECRETARIA_E2E_ARGA_TEST_A_CONVOCATORIA=1 bun run e2e -- e2e/47-secretaria-arga-test-a-convocatoria.spec.ts --project=chromium
bun run typecheck
bun run build
```

Bug corregido antes de compactar:

- Sintoma: el Paso 7 de `ConvocatoriasStepper` generaba texto de convocatoria pero mantenia visible `Cargando motor de plantillas...` y bloqueaba `Siguiente`.
- Causa: dependencias recreadas en cada render (`activeMandates`, `channelOpts`) disparaban regeneracion infinita.
- Fix: estabilizar con `useMemo`.
- E2E `47` ahora verifica que el borrador se genera desde plantilla sin rellenar el textarea manualmente.

## Fuente funcional

El documento `/Users/moisesmenendez/Downloads/Test_para_Estado_de_la_Plataforma.docx` define una suite para validar:

1. Alta de una SL.
2. Cuatro socios con clases de participaciones distintas y un socio PJ.
3. Consejo de 3 miembros, uno PJ, y secretaria no consejera.
4. Convocar Junta y Consejo con materias ordinarias y mayorias SL.
5. Acuerdos por escrito y sin sesion con control de oposicion.
6. Tramitacion y registro de libros: libro registro de socios y libro de actas.

Tambien propone tres steppers especificos para continuar:

- Stepper A: acuerdo por escrito y sin sesion del Consejo para concesion de poderes.
- Stepper B: Junta universal para modificar estatutos, cambiar a Administrador Unico y nombrarlo.
- Stepper C: decision del Administrador Unico para formular cuentas anuales. Importante: no es decision del socio unico; la competencia es del organo de administracion.

## Protocolo Ruflo supervisado

Trabaja con este ciclo estricto:

1. Supervisor Codex define un unico objetivo de test.
2. Si usas Ruflo/subagente, asignale solo ese objetivo y un write scope concreto.
3. No lances dos tests nuevos en paralelo.
4. Inspecciona el codigo antes de tocarlo.
5. Escribe o ajusta un E2E opt-in, idempotente y con guard de target Supabase.
6. Ejecuta solo ese E2E.
7. Si falla, corrige el minimo codigo necesario y reejecuta el mismo E2E.
8. Cuando pase, ejecuta `bun run typecheck`. Ejecuta `bun run build` al cierre de cada bloque de 2-3 tests o si tocaste imports/routing/build-sensitive code.
9. Registra IDs creados, ruta local, comando ejecutado y resultado.
10. Compacta contexto en 8-12 bullets antes de pasar al siguiente test.

No commits ni push salvo instruccion explicita. No limpies ni borres registros de `Arga test A, SL`; los tests deben ser idempotentes localizando registros existentes por nombre/materia/fecha antes de crear nuevos.

## Convenciones para nuevos E2E

Usa el patron de `e2e/46` y `e2e/47`:

- Opt-in por variable de entorno.
- Service role key leida de env o `docs/superpowers/plans/.env`.
- Guard de proyecto: rechazar cualquier ref distinto de `hzqwefkwsxopwrmtksbg` salvo override explicito.
- Buscar primero si el expediente ya existe; si existe, verificar en Cloud y UI; si no existe, crearlo por UI.
- Capturar `pageerror`, `console.error` y respuestas Supabase 4xx/5xx.
- Asertos sobre DB y UI.

Nombres sugeridos:

- `e2e/48-secretaria-arga-test-a-junta-convocatoria.spec.ts`
- `e2e/49-secretaria-arga-test-a-reunion-consejo.spec.ts`
- `e2e/50-secretaria-arga-test-a-acuerdo-sin-sesion-poderes.spec.ts`
- `e2e/51-secretaria-arga-test-a-junta-universal-admin-unico.spec.ts`
- `e2e/52-secretaria-arga-test-a-decision-admin-unico-cuentas.spec.ts`
- `e2e/53-secretaria-arga-test-a-libros.spec.ts`
- `e2e/54-secretaria-arga-test-a-tramitador-registro.spec.ts`

## Secuencia de ejecucion

### T0 — Rehidratacion y baseline

Objetivo: confirmar estado sin tocar datos.

Comandos:

```bash
git status --short --branch
bun run db:check-target
SECRETARIA_E2E_ARGA_TEST_A=1 bun run e2e -- e2e/46-secretaria-arga-test-a-sociedad.spec.ts --project=chromium
SECRETARIA_E2E_ARGA_TEST_A_CONVOCATORIA=1 bun run e2e -- e2e/47-secretaria-arga-test-a-convocatoria.spec.ts --project=chromium
```

Aceptar si ambos specs pasan y la sociedad/convocatoria siguen en Cloud.

### T1 — Convocatoria de Junta SL ordinaria

Objetivo: crear/verificar convocatoria de Junta de `Arga test A, SL` con notificacion individual y 15 dias naturales.

Materias sugeridas:

- `APROBACION_CUENTAS`
- `APLICACION_RESULTADO` o `DISTRIBUCION_DIVIDENDOS`

Asertos:

- Usa Junta General de Socios de la misma sociedad.
- Canal por defecto compatible con SL: notificacion individual/ERDS.
- Plantilla `CONVOCATORIA_SL_NOTIFICACION` o fallback correcto para SL.
- Borrador de documento generado desde plantilla sin bloqueo.
- Plazo legal mostrado/evaluado: 15 dias.
- `convocatoria_text` no nulo y contiene orden del dia.

### T2 — Reunion del Consejo desde convocatoria existente

Objetivo: celebrar la convocatoria de Consejo ya emitida para:

- Nombrar consejera delegada a Clara Rivas.
- Aprobar presupuesto anual 2026.

Asertos:

- Reutiliza convocatoria `0dcc11f0-b32d-46d6-a212-a21e3e3b9346`.
- Genera reunion/acta/acuerdos desde el stepper, no inserts manuales salvo verificaciones.
- El acuerdo `DELEGACION_FACULTADES` advierte o valida regla de 2/3 del Consejo si aplica.
- El presupuesto queda como materia ordinaria de Consejo.
- Acta generada con asistentes, quorum y acuerdos.
- Si se intenta certificar antes de acta aprobada, debe bloquear por RRM 108-109.

### T3 — Acuerdo sin sesion del Consejo: concesion de poderes

Objetivo: crear expediente por escrito y sin sesion para concesion de poderes.

Datos sugeridos:

- Apoderado: `Laura Molina Poderes Arga Test` o persona nueva equivalente.
- Facultades: poder general mercantil limitado a presupuesto operativo y contratos ordinarios.
- Manifestacion: no oposicion de todos los miembros del Consejo.

Asertos:

- Adoption mode `NO_SESSION`.
- Plantilla o documento tipo `ACTA_ACUERDO_ESCRITO`.
- No oposicion registrada.
- `agreement_id` persistido.
- Intento de certificacion sin acta aprobada bloquea por RRM 109.

### T4 — Junta universal: cambio a Administrador Unico

Objetivo: tramitar Junta universal que modifica estatutos para cambiar el organo de administracion a Administrador Unico y nombra al administrador.

Datos sugeridos:

- Administrador Unico: Clara Rivas Arga Test.
- Nueva clausula estatutaria: administracion confiada a Administrador Unico con duracion indefinida o plazo estatutario demo.

Asertos:

- Flag de Junta universal y aceptacion unanime del orden del dia.
- Capital concurrente: 100%.
- Materia `MODIFICACION_ESTATUTOS` con mayoria reforzada SL art. 199.
- Materia de nombramiento vinculada.
- Acta incluye universalidad art. 178 LSC, nueva redaccion estatutaria, nombramiento y aceptacion.
- Prepara certificacion/registro pero respeta gate de acta aprobada.

Importante: este test cambia la forma de administracion de la sociedad. Ejecutarlo solo cuando los tests de Consejo ya hayan pasado.

### T5 — Decision del Administrador Unico: formulacion de cuentas

Objetivo: tras T4, crear decision del Administrador Unico para formular cuentas anuales.

No usar decision de socio unico. La competencia es del organo de administracion.

Datos sugeridos:

- Ejercicio: 2026.
- Documentos/campos: cuentas anuales, informe de gestion, propuesta de aplicacion del resultado.

Asertos:

- Adoption mode `UNIPERSONAL_ADMIN` o equivalente del stepper.
- Materia `FORMULACION_CUENTAS`.
- No exige convocatoria.
- Deja prerequisito satisfecho para futura Junta de aprobacion de cuentas.
- Documento/acta de consignacion contiene fecha, ejercicio y firma del Administrador Unico.

### T6 — Libros societarios

Objetivo: verificar libro registro de socios y libro de actas tras los pasos anteriores.

Asertos:

- Libro registro de socios refleja cuatro socios, clases A/B y preferencia economica de B.
- Las actas de Consejo/Junta/decision quedan en libro de actas o vistas equivalentes.
- No se habilita certificacion si el acta esta pendiente de aprobacion.
- Cuando acta se aprueba, la certificacion incluye autoridad certificante, VºBº y trazabilidad.

### T7 — Tramitador y registro

Objetivo: probar el stepper de tramitacion registral para un acto inscribible ya generado.

Candidatos:

- Delegacion de facultades/consejera delegada.
- Modificacion estatutaria y nombramiento de Administrador Unico.

Asertos:

- Se arrastra `agreement_id`.
- Se genera expediente registral.
- Documentos requeridos y warnings aparecen.
- No se omite el gate de acta aprobada.
- Evidencia demo/operativa queda marcada como tal.

## Cierre de cada test

Despues de cada Tn responde con:

- Test ejecutado.
- Archivos modificados.
- IDs Cloud creados/reutilizados.
- Comando E2E exacto.
- Resultado.
- Bugs encontrados y fix aplicado.
- Siguiente test recomendado.

Si el contexto empieza a saturarse, escribe un bloque `CONTEXT SNAPSHOT` con solo:

- Sociedad y IDs.
- Ultimo test verde.
- Nuevos IDs.
- Cambios de codigo pendientes.
- Comandos que pasaron.
- Siguiente objetivo exacto.

