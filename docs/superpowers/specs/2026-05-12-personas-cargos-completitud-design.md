# Personas y Cargos — Completitud production-ready Sprint 2

**Fecha:** 2026-05-12  
**Estado:** SPEC APROBABLE PARA PLAN. No autoriza implementacion ni Cloud.  
**Baseline:** `main` en `e350774` (merge PR #5), gates post-merge green.  
**Cliente demo:** Grupo ARGA Seguros (pseudonimo). No usar nombre real del cliente.  
**Supabase Cloud:** `governance_OS` (`hzqwefkwsxopwrmtksbg`).  

---

## 1. Proposito

Llevar la gestion de Personas y Cargos desde happy path demo a integridad
production-ready para cliente real, sin romper la demo Garrigues ni las
decisiones legales L1-L23 firmadas en el Sprint 1.

Sprint 1 cerro:

- alta/cese basicos en `condiciones_persona`;
- representantes PJ administradora con dual-write transitorio;
- autoridad certificante con RM ref;
- filtros anti-datos test;
- consolidacion script-side con preflights;
- migraciones Cloud 000063, 000064 y 000065 aplicadas;
- PR #5 mergeado a `main`.

Sprint 2 no debe reabrir esos contratos salvo para endurecerlos.

---

## 2. Fuentes normativas y decisiones firmadas

### 2.1 Inmutables Sprint 1

La spec original `2026-05-12-personas-cargos-refactor-design.md` mantiene las
decisiones L1-L23. En particular:

- L1: PJ socio no requiere representante PF permanente.
- L2: PJ administradora si requiere representante PF permanente.
- L15-L16: CONSEJERO_COORDINADOR no certifica societariamente.
- L17: VICESECRETARIO certifica en suplencia y es cargo inscribible.
- L18: COMISIONADO descartado.
- L19: NIF/CIF unico por tenant.
- L21-L23: RM declarativa para validez interna, pero referencia RM obligatoria
  en `authority_evidence` para certificar a terceros.

### 2.2 Firma legal Sprint 2

| Decision | Opcion firmada | Matices obligatorios |
|---|---|---|
| L12 | L12-C Hibrida | BD hard para PRESIDENTE, SECRETARIO, CONSEJERO_COORDINADOR y ADMIN_UNICO. VICESECRETARIO y VICEPRESIDENTE fuera del singleton hard. ADMIN_SOLIDARIO/MANCOMUNADO con alerta al cierre; no bloquear primera alta individual. |
| L13 | L13-B Notificacion interna | Owner Secretario del CdA o Vicesecretario en suplencia. Umbrales D+0, D+60 y D+90. No bloquea operaciones. |
| L20 | L20-A Post-piloto | Sucesion juridica no entra en Sprint 2. Documentar respuesta de piloto y diferir a sprint propio. |

### 2.3 Consejero coordinador y cotizadas

El hard UNIQUE para CONSEJERO_COORDINADOR se justifica por LSC art. 529 septies
en sociedades cotizadas. ARGA Seguros es cotizada en el demo. Para no cotizadas,
la spec permite dos aproximaciones:

- Sprint 2 minimo: aplicar hard UNIQUE global y documentar que la figura se usa
  solo cuando el perfil normativo la habilita.
- Opcion mas robusta si el schema lo permite: condicionar la validacion en RPC
  por perfil normativo/cotizada y dejar el indice hard solo si puede expresarse
  sin joins inmutables.

El plan implementable debe elegir una de estas dos con lectura de schema previa.

---

## 3. Alcance Sprint 2

### Bloque 4 — higiene de datos demo (primero)

1. Investigar duplicados semanticos restantes:
   - ARGA Seguros S.A. `A-00001001` vs ARGA Seguros, S.A. `A-99999903`.
   - Antonio Rios `12345679B` vs D. Antonio Rios Valverde `NIF-DEMO-01-89B557`.
   - Filiales con `PENDIENTE-*`.
2. No ejecutar consolidacion Cloud sin confirmacion explicita del usuario.
3. Resolver WIP `DemoBackupSecretaria` fuera del flujo production:
   - preservar `stash@{0}` hasta decision;
   - si se reaplica, debe quedar en ruta interna y gated por `import.meta.env.DEV`
     o variable explicita;
   - no exponerlo en navegacion productiva.

### Bloque 1 — integridad production-grade

1. `fn_designar_cargo` transaccional.
2. `fn_consolidate_person` transaccional.
3. Singleton hard L12-C.
4. Cardinalidad minima ADMIN_SOLIDARIO/MANCOMUNADO como alerta de cierre y
   bloqueo al certificar/cerrar distribucion con menos de 2.
5. Vacancia presidencial L13-B con notificaciones persistentes.
6. Deprecar lectura de `persons.representative_person_id`; UI debe leer de
   `representaciones` como fuente canonica.
7. Corregir defecto `DesignarAdminStepper.tsx:215`: `personaFinal` debe
   comprobar identidad contra `draft.person_id` y `personIdFromUrl`.

### Bloque 2 — UX cliente production-ready

1. Edicion persona post-alta.
2. Searchable selector PF server-side.
3. Listado personas con paginacion o virtualizacion.
4. Chips visuales `Inscrito` / `Pendiente RM`.
5. Importacion CSV/Excel con dry-run y apply.
6. Historico de representantes PJ con timeline.
7. Notificaciones de vacancia, mandato proximo a expirar y cargo sin RM ref.
8. Calendar integration: diferida si no hay decision de producto; no bloquear
   Bloque 1.

### Bloque 3 — representaciones secundarias LSC

1. UI `JUNTA_PROXY` por reunion especifica.
2. UI `CONSEJO_DELEGACION` por sesion de consejo.
3. Ambas usan `representaciones.scope` existente y respetan `meeting_id`
   obligatorio por `chk_representacion_scope_meeting`.

### Fuera de scope Sprint 2

- L20 sucesion juridica automatica.
- Sync RM real.
- Conflictos cross-sociedad.
- Workflow dual-approval.
- Roles granulares por entidad.
- Reportes CNMV/IBEX.
- Columna fisica `VIGENTE_INSCRITO` vs `VIGENTE_NO_INSCRITO`; sigue derivada
  de `authority_evidence.inscripcion_rm_referencia` salvo decision posterior.

---

## 4. Arquitectura BD y RPC

### 4.1 Patron obligatorio de RPC

Toda RPC nueva de Personas y Cargos debe cumplir:

- `SECURITY DEFINER`.
- `SET search_path = public, extensions`.
- `p_tenant_id uuid` obligatorio.
- `fn_secretaria_assert_tenant_access(p_tenant_id)` al inicio.
- `fn_secretaria_assert_capability(p_tenant_id, <ACTION>)` o helper equivalente.
- Validacion de pertenencia tenant para toda `person_id`, `entity_id`, `body_id`,
  `representacion_id` o `condicion_id` recibida.
- Locks para carreras:
  - advisory lock por `(tenant_id, entity_id, body_id, tipo_condicion)` para
    singleton/body;
  - advisory lock por `(tenant_id, person_id)` para consolidacion;
  - `SELECT ... FOR UPDATE` sobre filas que se cesan o archivan.
- Idempotency key opcional para reintentos seguros.
- WORM semantics explicitas: no actualizar `audit_log`, `censo_snapshot`,
  `no_session_*`, `capital_movements` ni auditoria asociada.
- Errores con SQLSTATE/mensaje consumible por UI.

Acciones nuevas en `capability_matrix`:

- `PERSON_WRITE`
- `CARGO_MANAGEMENT`
- `PERSON_CONSOLIDATE`
- `REPRESENTATION_MANAGEMENT`

El plan debe revisar si reutilizar `CERTIFICATION` o crear `CARGO_CERTIFY` para
la comprobacion de autoridad.

### 4.2 RPC `fn_designar_cargo`

Firma propuesta:

```sql
fn_designar_cargo(
  p_tenant_id uuid,
  p_person_id uuid,
  p_entity_id uuid,
  p_body_id uuid,
  p_tipo_condicion text,
  p_fecha_inicio date,
  p_fuente_designacion text,
  p_inscripcion_rm_referencia text default null,
  p_inscripcion_rm_fecha date default null,
  p_representative_person_id uuid default null,
  p_cesar_singleton_previo boolean default true,
  p_idempotency_key text default null
) returns uuid
```

Reglas:

- Para `PRESIDENTE`, `SECRETARIO`, `CONSEJERO_COORDINADOR`, `ADMIN_UNICO`,
  la RPC debe bloquear/cerrar singleton previo de forma atomica segun la opcion
  funcional del plan. Nunca puede dejar dos vigentes.
- `VICESECRETARIO` y `VICEPRESIDENTE` quedan fuera del singleton hard; la RPC
  debe devolver warning si ya existe uno vigente.
- `ADMIN_SOLIDARIO` y `ADMIN_MANCOMUNADO` permiten primera alta individual, pero
  devuelven warning si el conteo vigente resultante es menor que 2.
- Para PJ administradora, validar representante PF por L2. Si falta, permitir
  solo si el flujo lo marca como draft no certificable; bloquear al certificar.
- El trigger `fn_sync_authority_evidence` sigue siendo la fuente de propagacion
  a `authority_evidence`.
- No se debe borrar historico; ceses via `estado='CESADO'`, `fecha_fin` y
  metadata.

### 4.3 Singleton hard L12-C

Indice propuesto para roles con `body_id`:

```sql
CREATE UNIQUE INDEX ux_condicion_singleton_body_vigente
  ON condiciones_persona(
    tenant_id,
    entity_id,
    body_id,
    tipo_condicion
  )
  WHERE estado = 'VIGENTE'
    AND tipo_condicion IN ('PRESIDENTE','SECRETARIO','CONSEJERO_COORDINADOR');
```

Indice propuesto para `ADMIN_UNICO`:

```sql
CREATE UNIQUE INDEX ux_condicion_admin_unico_entity_vigente
  ON condiciones_persona(tenant_id, entity_id, tipo_condicion)
  WHERE estado = 'VIGENTE'
    AND tipo_condicion = 'ADMIN_UNICO';
```

Preflight obligatorio antes de aplicar:

- contar duplicados actuales por indice;
- si hay duplicados, no aplicar migracion hasta decision legal/usuario sobre
  que cargo cesar;
- no incluir VICESECRETARIO ni VICEPRESIDENTE.

### 4.4 RPC `fn_consolidate_person`

Objetivo: sustituir el pipeline script-side de 47 FK por una operacion atomica.

Firma propuesta:

```sql
fn_consolidate_person(
  p_tenant_id uuid,
  p_canonical_person_id uuid,
  p_duplicate_person_id uuid,
  p_reason text,
  p_idempotency_key text default null
) returns jsonb
```

Reglas:

- Validar `p_canonical_person_id <> p_duplicate_person_id`.
- Validar ambos pertenecen a `p_tenant_id`.
- Ejecutar preflight dentro de la transaccion:
  - colisiones `ux_condicion_vigente`;
  - colisiones `ux_representaciones_vigente`;
  - colisiones `ux_authority_vigente`;
  - referencias WORM;
  - persona duplicada ya archivada;
  - entidades con `person_id` apuntando a duplicado.
- Tablas WORM se saltan por diseno; la persona duplicada se soft-archive para
  mantener FK historica viva.
- Archive:
  - `full_name` prefijado o metadata marcada como archived;
  - `tax_id = ARCHIVED-<timestamp>-<old>`;
  - nunca DELETE.
- Return JSON con conteos por tabla, warnings WORM y archive id.

### 4.5 Vacancia presidencial L13-B

Usar tabla `notifications` existente salvo que el plan demuestre que no cubre
campos necesarios. Contrato actual:

- `tenant_id`
- `title`
- `body`
- `route`
- `type`
- `is_read`
- `created_at`

Tipo propuesto:

- `type = 'SECRETARIA_VACANCIA_PRESIDENCIA_INFO'`
- `type = 'SECRETARIA_VACANCIA_PRESIDENCIA_WARNING'`
- `type = 'SECRETARIA_VACANCIA_PRESIDENCIA_CRITICAL'`

Detector:

- CdA/body sin `PRESIDENTE` vigente.
- Inicio: `fecha_fin` del ultimo PRESIDENTE cesado; si falta, fecha del acuerdo
  de cese; si falta, `now()::date` con warning.
- D+0: info.
- D+60: warning.
- D+90: critical.
- Owner funcional: Secretario vigente del body; si no hay, Vicesecretario.
- No bloquea operaciones. La certificacion sigue bloqueada solo por falta de VºBº
  conforme RRM art. 109, ya cubierto por Sprint 1.

Debe ser idempotente: no crear notificaciones duplicadas para el mismo
`tenant_id/body_id/threshold` si ya existe una no leida o vigente.

### 4.6 Deprecacion dual-write representante PJ

Fuente canonica desde Sprint 2:

- `representaciones` con `scope='ADMIN_PJ_REPRESENTANTE'`.

Reglas:

- UI lee representante actual desde `representaciones`, no desde
  `persons.representative_person_id`.
- La columna legacy puede seguir recibiendo dual-write temporal para compatibilidad,
  pero no puede decidir UI ni validaciones.
- El plan debe identificar todos los reads restantes de
  `persons.representative_person_id` y migrarlos.
- El DROP de columna queda fuera de Sprint 2 salvo decision explicita.

---

## 5. UX y frontend

Todos los componentes bajo `/secretaria/*` deben cumplir skill Garrigues:

- solo tokens `--g-*` y `--status-*`;
- no Tailwind color nativo;
- no hex literales;
- botones icon-only con `aria-label`;
- formularios con labels visibles;
- errores con `aria-invalid` y `aria-describedby`;
- loading con `aria-busy`.

### 5.1 Edicion persona post-alta

- `useUpdatePersona`.
- UI editable en `PersonaDetalle`.
- Bloqueo de cambios de `tax_id` si violan L19.
- Cambios sensibles deben dejar trazabilidad en metadata/audit disponible, sin
  tocar WORM.

### 5.2 Search y paginacion

- Server-side search por `full_name`, `tax_id` y email si existe.
- No cap fijo de 2000 como mecanismo de producto.
- Listado personas con paginacion o virtualizacion.
- E2E debe cubrir tenant con mas de 2000 personas via fixture controlada o mock.

### 5.3 Importacion masiva

Flujo minimo:

1. Upload CSV/Excel.
2. Parse local.
3. Dry-run server-side: duplicados, cardinalidad, representantes, RM refs.
4. Preview de errores/warnings.
5. Apply via RPCs, no inserts directos multi-step desde cliente.

No se aplica a Cloud demo sin dataset y confirmacion del usuario.

### 5.4 Representaciones secundarias

`JUNTA_PROXY`:

- requiere `meeting_id`;
- delegacion de voto de socio por reunion;
- LSC arts. 184-187;
- UI desde reunion/Junta y ficha persona.

`CONSEJO_DELEGACION`:

- requiere `meeting_id`;
- delegacion de voto de consejero por sesion;
- LSC arts. 248-249;
- UI desde reunion/CdA y ficha persona.

Ambas deben soportar cancelar/cerrar representacion con `effective_to`, no DELETE.

---

## 6. Higiene de datos demo

### 6.1 Pares a investigar

No ejecutar cambios sin confirmacion.

| Caso | Accion requerida |
|---|---|
| ARGA Seguros S.A. `A-00001001` vs ARGA Seguros, S.A. `A-99999903` | Investigar FKs, cargos, capital y entity linkage; proponer canonical/duplicate. |
| Antonio Rios `12345679B` vs D. Antonio Rios Valverde `NIF-DEMO-01-89B557` | Decision legal sobre identidad; no fusionar por similitud sin confirmacion. |
| Filiales `PENDIENTE-*` | Clasificar: placeholder aceptado, CIF real pendiente, o archivar. |

### 6.2 WIP DemoBackup/Harvey/B9

El stash `stash@{0}` conserva DemoBackup/Harvey/B9. Sprint 2 productivo no depende
de ese WIP. Si se reabre:

- debe hacerse en rama separada;
- no se expone en nav productiva;
- `.playwright-mcp/*.yml` debe ir a `.gitignore` si se confirma que son residuos;
- `DemoBackupSecretaria` solo interno/dev.

---

## 7. Tests adversariales obligatorios

### 7.1 Unit/schema

- SQL contract test para nuevos indices singleton.
- SQL contract test para `fn_designar_cargo`:
  - `SECURITY DEFINER`;
  - `search_path`;
  - tenant guard;
  - capability guard;
  - warnings VICESECRETARIO/VICEPRESIDENTE;
  - admin solidario/mancomunado menor que 2.
- SQL contract test para `fn_consolidate_person`:
  - WORM skip;
  - preflight colisiones;
  - idempotency.
- Tests `DesignarAdminStepper` para identity match de `personaFinal`.
- Tests helpers L13 detector.

### 7.2 Race conditions

- Dos sesiones intentan designar PRESIDENTE simultaneo en mismo body.
- Dos sesiones intentan designar ADMIN_UNICO simultaneo.
- Dos consolidaciones intentan archivar la misma persona duplicada.
- Resultado esperado: una gana y otra falla de forma controlada o devuelve el
  mismo resultado por idempotency key.

### 7.3 RLS / denial

- Usuario sin tenant correcto no lee ni escribe personas/cargos.
- Usuario sin capability `CARGO_MANAGEMENT` no ejecuta `fn_designar_cargo`.
- Usuario sin `PERSON_CONSOLIDATE` no ejecuta `fn_consolidate_person`.

### 7.4 E2E

- Submit real de cese cargo y verificacion BD.
- Alta cargo full flow: PJ administradora + representante PF + RM ref.
- Wizard representante PJ 3 pasos persistiendo en `representaciones`.
- Certificacion bloqueada por falta de RM.
- Distribucion de cargos end-to-end: tras designar PRESIDENTE + SECRETARIO,
  ejecutar plantilla `DISTRIBUCION_CARGOS` y verificar resolver desde
  `condiciones_persona`.
- Readiness script en CI: `scripts/demo-readiness-personas-cargos.ts`.

---

## 8. Criterios de aceptacion

### 8.1 Antes de cualquier migracion Cloud

- `bun run db:check-target` pass.
- Plan implementable aprobado por usuario.
- Preview branch Supabase recomendado para schema.
- Preflight duplicados singleton = 0 o decision usuario sobre cese.
- Confirmacion explicita usuario para cada `apply_migration`.

### 8.2 Final Bloque 1

- `fn_designar_cargo` reemplaza inserts directos de cargo en UI.
- `fn_consolidate_person` existe y el script lo usa o queda deprecated.
- Indices singleton L12-C aplicados.
- VICESECRETARIO fuera de singleton hard.
- ADMIN_SOLIDARIO/MANCOMUNADO generan alerta si quedan con menos de 2; no bloquean
  primera alta.
- Vacancia presidencial crea notificaciones D+0/D+60/D+90 idempotentes.
- UI lee representante PJ desde `representaciones`.
- Defecto `personaFinal` cerrado.

### 8.3 Final Sprint 2

- `bun run typecheck` pass.
- `bun run lint` pass sin errores.
- `bun run build` pass.
- `bun test src/test/secretaria src/test/schema` pass.
- E2E Personas y Cargos pass.
- Readiness script pass en CI.
- No hay cambios Cloud no confirmados.
- No hay WORM rewrites.
- No hay tokens Garrigues invalidos.

---

## 9. Riesgos y mitigaciones

| Riesgo | Mitigacion |
|---|---|
| UNIQUE singleton falla por datos previos | Preflight y decision de cese antes de migracion. |
| Hard UNIQUE de CONSEJERO_COORDINADOR en no cotizadas | Plan debe validar perfil normativo; si no es expresable en indice, enforce adicional en RPC y documentar limitacion. |
| RPC SECURITY DEFINER bypassa RLS por error | Usar helpers `fn_secretaria_assert_*` existentes y tests RLS denial. |
| `fn_consolidate_person` toca WORM | Tests de contrato y lista explicita de skips WORM. |
| Notificaciones duplicadas de vacancia | Idempotency por tenant/body/threshold en metadata o type/body route estable. |
| Import bulk contamina demo | Dry-run obligatorio y apply solo con confirmacion. |
| WIP DemoBackup vuelve a nav productiva | Mantener stash aislado hasta decision; si se reintroduce, gating dev estricto. |

---

## 10. Plan posterior requerido

Esta spec habilita escribir un plan implementable, no codigo inmediato.

El plan debe:

1. Dividir en waves con builder/reviewer adversarial.
2. Empezar por preflights y tests de contrato.
3. Separar cambios SQL, hooks y UI.
4. Incluir comandos exactos de verificacion por wave.
5. Pedir confirmacion explicita antes de Cloud.
6. Mantener commits incrementales.

Orden recomendado:

1. Wave 0: baseline + preflight datos + plan de limpieza.
2. Wave 1: SQL contracts + RPC hardening skeleton.
3. Wave 2: `fn_designar_cargo` + UI migration.
4. Wave 3: singleton hard + race tests.
5. Wave 4: `fn_consolidate_person` + script migration.
6. Wave 5: L13 notifications.
7. Wave 6: dual-write deprecation + UX search/pagination/edit.
8. Wave 7: representaciones secundarias.
9. Wave 8: bulk import + readiness + E2E closure.

No implementar hasta que el usuario apruebe el plan.
