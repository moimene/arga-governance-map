# Secretaría Societaria — Ampliación de Pruebas de Lógica y Funcionales

Fecha: 2026-05-04  
Worktree: `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map`  
Fuente de verdad: Supabase Cloud `governance_OS` (`hzqwefkwsxopwrmtksbg`)

## Restricciones aplicadas

- No se aplicaron migraciones.
- No se ejecutó `bun run db push`.
- No se crearon tablas, columnas, RPCs, policies ni buckets.
- No se regeneraron tipos Supabase.
- `bun run db:check-target` pasó usando PATH explícito para `bun` y `supabase`.
- Los tests añadidos son unitarios/locales; no mutan la demo Cloud.
- Se mantiene la frontera demo: preparado para Registro, sin envío telemático al Registro Mercantil.
- QTSP citado: EAD Trust.

## Cambios de motor cubiertos

1. `majority-evaluator.ts`
   - Añadida fórmula `favor >= 2/3_capital_presente`.
   - Cubre mayoría reforzada sobre capital concurrente cuando el capital presente obliga a tramo de 2/3.

2. `votacion-engine.ts`
   - Gate explícito `organ_matter_not_allowed` si una materia reservada a Junta se intenta aprobar desde otro órgano.
   - Gate explícito `no_session_not_allowed_for_matter` si `NO_SESSION` no está en `modosAdopcionPermitidos`.

3. `constitucion-engine.ts`
   - Usa umbrales de `RulePack.constitucion.quorum` cuando el payload los trae, con fallback LSC.
   - Referencias de quorum SA ajustadas a arts. 193/194 LSC.
   - Overrides estatutarios siguen elevando el mínimo por jerarquía LEY < ESTATUTOS.

## Tests añadidos o ampliados

| Archivo | Nº tests nuevos | Cobertura |
|---|---:|---|
| `src/lib/rules-engine/__tests__/secretaria-expanded-logic.test.ts` | 9 | Quórum JG ordinaria/especial, segunda convocatoria, override estatutario, mayoría simple con empate, 2/3 capital presente, voto de calidad, gate órgano-materia, NO_SESSION no permitido |
| `src/lib/doc-gen/__tests__/template-renderer-expanded.test.ts` | 8 | Bloques Handlebars cotizada/no cotizada, comités, política anterior, experto independiente, variables opcionales, prevalencia Capa 3, idempotencia, QTSP EAD Trust activo/inactivo |
| `src/lib/doc-gen/__tests__/variable-resolver.test.ts` | 3 ampliaciones | `ENTIDAD`, `entities.name`, `governing_bodies.presidente`, `governing_bodies.secretario` |
| `src/lib/secretaria/__tests__/normative-framework.test.ts` | 1 | Snapshot normativo compacto, fuentes mínimas, pactos vigentes, congelación frente a cambios posteriores de overrides |

## Matriz de cobertura solicitada

| Área | Estado | Evidencia |
|---|---|---|
| Quórum ordinaria primera convocatoria 25% | Automatizado | `secretaria-expanded-logic.test.ts` |
| Quórum ordinaria segunda convocatoria sin mínimo | Automatizado | `secretaria-expanded-logic.test.ts` |
| Quórum cualificado 50%/25% | Automatizado | `secretaria-expanded-logic.test.ts` |
| Override estatutario 60% | Automatizado | `secretaria-expanded-logic.test.ts` |
| Majority PASS/FAIL en `rule_evaluation_results` | Parcial | Motor devuelve `resultado` OK/BLOCKING; escritura real a tabla requiere journey no destructivo |
| Mayoría simple y empate | Automatizado | `secretaria-expanded-logic.test.ts` |
| Mayoría reforzada 2/3 capital concurrente | Automatizado | `secretaria-expanded-logic.test.ts` |
| Voto de calidad | Automatizado + regresión existente | `secretaria-expanded-logic.test.ts`, `votacion-engine.test.ts` |
| Denominador por conflicto | Cubierto previamente | `votacion-engine.test.ts`; falta fixture E2E por punto |
| Gate órgano-materia | Automatizado | `secretaria-expanded-logic.test.ts` |
| NO_SESSION no permitido | Automatizado | `secretaria-expanded-logic.test.ts` |
| Cooptación restringida a SA | Requisito P1 | Falta helper de elegibilidad materia/forma social o fixture de selección |
| Snapshot normativo completo/congelado | Automatizado | `normative-framework.test.ts` |
| Handlebars condicionales | Automatizado | `template-renderer-expanded.test.ts` |
| Variables huérfanas/opcionales | Automatizado | `template-renderer-expanded.test.ts` |
| Capa 2 vs Capa 3 | Automatizado | `template-renderer-expanded.test.ts` |
| Resolver Capa 2 canónico/fallback | Automatizado parcial | `variable-resolver.test.ts` |
| Idempotencia acta/QTSP input estable | Automatizado | `template-renderer-expanded.test.ts` |
| Rangos legales Capa 3 | Requisito P0 | Falta módulo puro de validación Capa 3 por materia o wiring frontend estable |
| E2E JG mixta | Requisito P0 | Necesita fixture/tenant temporal para no mutar demo compartida |
| E2E Consejo con conflicto/voto calidad | Requisito P1 | Necesita fixture aislada de asistentes/votos/conflictos |
| E2E socio único → cap_table | Requisito P1 bloqueado por P0 | Depende de RPC transaccional de capital |
| E2E transmisión → impacto junta | Requisito P0 | Depende de `fn_registrar_transmision_capital` propuesta |
| Certificación gates RRM | Requisito P0 | Requiere fixture acta pendiente/aprobada o API test-only |
| RLS aislamiento tenant | Requisito P0 | Requiere usuarios/claims de tenant A/B o harness Supabase test-only |

## Requisitos exactos no implementados por restricción

### P0 — Validación Capa 3 por materia

Necesidad:
- Módulo puro o contrato UI que valide valores Capa 3 antes de render/documento.

Reglas mínimas:
- Auditor: `duracion_anos` entre 3 y 9.
- Consejero SA cotizada: `plazo_mandato <= 4`.
- Consejero SA no cotizada: `plazo_mandato <= 6`, respetando `entities.plazo_mandato_estatutos`.
- Aumento capital: `capital_anterior + importe_aumento = capital_nuevo`.
- Suscripción preferente: mínimo según publicación/canal.
- Remuneración: `retribucion_maxima_total` numérico.

### P0 — Fixtures E2E no destructivas

Necesidad:
- Tenant/fixture temporal Playwright o endpoint test-only que cree y limpie:
  - reunión de junta con agenda mixta,
  - reunión de consejo con asistentes/representados/conflictos,
  - acta pendiente de aprobación,
  - certificación/tramitación enlazada.

Sin esto, ejecutar journeys completos contra la demo compartida alteraría datos de ARGA.

### P0 — Transmisión de participaciones

Necesidad:
- RPC transaccional `fn_registrar_transmision_capital`.
- Debe actualizar `capital_holdings`, insertar `capital_movements`, vincular `agreement_id` y documentación soporte en una sola operación.

### P0 — RLS tenant A/B

Necesidad:
- Credenciales o harness de tests con claims diferenciados para tenant A y tenant B.
- Tests sobre `convocatorias`, `minutes`, `agreements`, `capital_holdings` y RPC `fn_generar_acta`.

## Verificación ejecutada

| Check | Resultado |
|---|---|
| `PATH="/opt/homebrew/bin:/Users/moisesmenendez/.bun/bin:$PATH" /Users/moisesmenendez/.bun/bin/bun run db:check-target` | Pass |
| `node node_modules/vitest/vitest.mjs run ...secretaria-expanded... template-renderer-expanded variable-resolver normative-framework --reporter=dot` | Pass: 4 files, 30 tests |
| `node node_modules/vitest/vitest.mjs run votacion-engine plantillas-engine agreement-360 --reporter=dot` | Pass: 3 files, 55 tests |
| `node node_modules/typescript/bin/tsc --noEmit --pretty false` | Pass |
| `bun run lint` | Pass: 0 errors, 21 warnings preexistentes |
| `node node_modules/vite/bin/vite.js build` | Pass |
| `PLAYWRIGHT_BASE_URL=http://127.0.0.1:5201 node node_modules/@playwright/test/cli.js test e2e/25-secretaria-epic-journeys.spec.ts --project=chromium --reporter=list` | Pass: 5/5 |
| `git diff --check` | Pass |
| Copy/QTSP grep | Sin copy prohibida en `src`; solo queda como aserción negativa en E2E |

Nota de entorno:
- `bunx vitest` y el `webServer` estándar de Playwright bajo Node v24 fallaron por firma local del binario nativo de Rollup. La verificación se ejecutó con Node 22 del runtime de workspace; para E2E se arrancó Vite manualmente en `5201` y se detuvo al terminar.

---

## Fase 2 — ampliación adicional ejecutada

Fecha: 2026-05-04  
Alcance: lógica adicional del motor, edge cases documentales, pactos, capital-voto y transiciones de expediente.  
Restricciones: se mantienen todas las anteriores; no hubo migraciones ni cambios Supabase.

### Cambios de lógica

| Archivo | Cambio | Cobertura |
|---|---|---|
| `src/lib/rules-engine/constitucion-engine.ts` | Gate explícito de junta universal art. 178 LSC. Requiere 100% de capital con derecho de voto y aceptación unánime; omite umbrales de primera/segunda convocatoria. | PASS 100%, FAIL 98%, FAIL sin aceptación. |
| `src/lib/rules-engine/pactos-engine.ts` | `SINDICACION_VOTO`, `TAG_ALONG` y `DRAG_ALONG` pasan a warning contractual no bloqueante cuando aplican. | Sindicación de voto y transmisión de participaciones con advertencia en Anexo B/documentación. |
| `src/lib/rules-engine/capital-voting.ts` | Helper puro para capital social, denominador de quórum y peso de voto. | Acciones sin voto, voto doble, participaciones privilegiadas y autocartera. |
| `src/lib/secretaria/expediente-state-machine.ts` | State machine pura de expediente con sesión y sin sesión. | Orden de estados, bloqueo de saltos, rollback limitado, cierre vencido. |

### Tests añadidos o ampliados en Fase 2

| Archivo | Cobertura añadida |
|---|---|
| `src/lib/rules-engine/__tests__/secretaria-expanded-logic.test.ts` | Junta universal; reducción de capital por pérdidas; fusión/escisión RDL 5/2023 y fusión simplificada; disolución voluntaria; exclusión de derecho de suscripción preferente con informes. |
| `src/lib/rules-engine/__tests__/meeting-adoption-snapshot.test.ts` | Conflicto de interés con quórum limítrofe: quórum de constitución se conserva y mayoría usa denominador de voto ajustado. |
| `src/lib/rules-engine/__tests__/pactos-engine.test.ts` | Warnings para sindicación de voto, tag-along y drag-along sin bloqueo societario. |
| `src/lib/rules-engine/__tests__/capital-voting.test.ts` | Clases de acciones/participaciones con derechos de voto diferenciados y autocartera. |
| `src/lib/secretaria/__tests__/expediente-state-machine.test.ts` | Transiciones DRAFT→PROMOTED con sesión, invalid DRAFT→CERTIFICADO, rollback ACTA_PENDIENTE, no rollback PROMOTED, acuerdo sin sesión con cierre vencido. |
| `src/lib/rules-engine/__tests__/normative-hierarchy-phase2.test.ts` | LEY vs ESTATUTOS, ESTATUTOS vs REGLAMENTO, pacto parasocial como warning no invalidante. |
| `src/lib/doc-gen/__tests__/template-renderer-expanded.test.ts` | Acta de junta universal, datos nulos/faltantes en convocatoria, acta y certificación, con issue explícito post-render. |

### Matriz Fase 2 solicitada

| Área | Estado | Evidencia |
|---|---|---|
| Junta universal art. 178 LSC | Automatizado | `secretaria-expanded-logic.test.ts`, `template-renderer-expanded.test.ts` |
| Mayorías cualificadas por materia | Automatizado parcial | Reducción, fusión/escisión, disolución, suscripción preferente en `secretaria-expanded-logic.test.ts` |
| Conflicto + quórum limítrofe | Automatizado | `meeting-adoption-snapshot.test.ts` |
| Pactos parasociales warnings | Automatizado | `pactos-engine.test.ts`, `normative-hierarchy-phase2.test.ts` |
| Transiciones de expediente | Automatizado | `expediente-state-machine.test.ts` |
| Clases de acciones / voto diferenciado | Automatizado | `capital-voting.test.ts` |
| Autocartera | Automatizado | `capital-voting.test.ts` |
| Pipeline JG ordinaria anual | Gap P0 documentado | Requiere fixture E2E temporal no destructiva. |
| Pipeline operación vinculada | Gap P1 documentado | Requiere fixture E2E de consejo/conflicto. |
| Plantilla incorrecta por tipo social | Parcial previo | Gates órgano-materia y NO_SESSION; falta helper de elegibilidad tipo social/plantilla. |
| Datos faltantes/nulos | Automatizado parcial | `template-renderer-expanded.test.ts` |
| Concurrencia/idempotencia DB | Gap P1 documentado | Requiere RPC/constraint o fixture Supabase test-only. |
| Jerarquía fuentes normativas | Automatizado parcial | LEY/ESTATUTOS/REGLAMENTO/PACTO. Fuentes `REGISTRO` y `POLITICA` siguen como extensión de contrato. |
| Unipersonalidad sobrevenida | Gap P1 documentado | Requiere selector/affordance de perfil normativo y plantillas por estado. |
| Audit trail plantillas/acuerdos | Parcial existente | Tests de review-state-machine/snapshot; auditoría DB completa requiere fixture. |
| Trazabilidad QTSP E2E | Gap P2 documentado | Stubs EAD Trust cubiertos; verificación end-to-end productiva requiere expediente firmado real. |

### Requisitos exactos adicionales

#### P0 — Harness E2E de expediente societario

Necesidad:
- Crear fixture temporal de junta ordinaria anual que genere informes PRE, convocatoria, acta, certificaciones y tramitador.
- Debe aislar `tenant_id`, `entity_id`, asistentes, votos, documentos y limpiar al finalizar.
- No debe mutar ARGA demo compartida ni requerir migraciones durante el test.

#### P1 — Idempotencia transaccional DB

Necesidad:
- Garantía única por `meeting_id` para `fn_generar_acta` o mecanismo idempotente de búsqueda/retorno.
- Garantía única por `agreement_id`/`minute_id` para certificaciones equivalentes.
- Tests de concurrencia con dos llamadas simultáneas solo cuando exista contrato DB estable.

#### P1 — Perfil normativo de unipersonalidad sobrevenida

Necesidad:
- Contrato puro que, tras cap table 100% un socio, habilite `ACTA_CONSIGNACION`.
- Debe retirar `CONVOCATORIA`/`ACTA_SESION` para `MEETING` y emitir warning de inscripción de unipersonalidad.

#### P2 — Fuentes normativas extendidas

Necesidad:
- Ampliar `Fuente` o normalizador para cubrir `REGISTRO` y `POLITICA` sin romper jerarquía existente.
- Definir si `REGISTRO` opera como interpretación/gate o como fuente superior a estatutos.

### Verificación Fase 2

| Check | Resultado |
|---|---|
| Focused Vitest Fase 2 (`secretaria-expanded`, `meeting-adoption-snapshot`, `pactos`, `capital-voting`, `expediente-state-machine`, `normative-hierarchy-phase2`, `template-renderer-expanded`, `orquestador`) | Pass: 8 files, 89 tests |
| `bun run db:check-target` | Pass: governance_OS `hzqwefkwsxopwrmtksbg` |
| Full Vitest | Pass: 73 files, 663 tests, 59 skipped existentes |
| `tsc --noEmit --pretty false` | Pass |
| `bun run lint` | Pass: 0 errores, 21 warnings preexistentes |
| `vite build` | Pass; warning conocido de Browserslist/chunk size |
| `e2e/21-secretaria-responsive.spec.ts --project=chromium` | Pass: 5/5 |
| `git diff --check` | Pass |

---

## Fase 3 — ampliación de plazos, representación e integración

Fecha: 2026-05-04  
Alcance: módulos puros para plazos/caducidad, delegaciones, dependencias entre acuerdos, operaciones vinculadas, rendimiento e integración motor-renderer-estado.  
Restricciones: sin migraciones, sin `db push`, sin nuevas tablas/RPC/policies/storage y sin mutación Supabase.

### Cambios de lógica

| Archivo | Cambio | Cobertura |
|---|---|---|
| `src/lib/rules-engine/plazos-engine.ts` | Nuevo motor puro de fechas para convocatoria, segunda convocatoria, caducidad, derecho de información, impugnación, separación, oposición, cuentas anuales, auditoría y reminders registrales demo. | Plazos arts. 176, 177, 197, 205, 253, 279, 282 LSC; art. 44 RDL 5/2023; frontera "preparado para Registro". |
| `src/lib/rules-engine/capital-voting.ts` | Extiende cómputo de capital con `computeAttendanceWithDelegations` y `computeBoardRepresentation`. | Representación junta/consejo, límites estatutarios, revocación, canales, conflicto por punto, indelegabilidad cotizadas. |
| `src/lib/rules-engine/agreement-dependency-validator.ts` | Nuevo validador puro de coherencia temporal e intra-sesión. | Dividendo sin cuentas, auditor requerido, aumento + estatutos, fusión + absorbida, cese + cargos, delegación art. 249 bis, solidarios contradictorios. |
| `src/lib/rules-engine/related-party-engine.ts` | Nuevo helper puro para operaciones vinculadas. | Umbral >10%, exención giro ordinario/mercado, acumulación 12 meses, exclusión de deliberación/voto. |
| `src/lib/secretaria/expediente-state-machine.ts` | Transiciones con `gatesOk` opcional para bloquear `CONVOCADO→EN_SESION` y `ACTA_PENDIENTE→ACTA_APROBADA`. | Integración motor → estado sin persistencia DB. |

### Tests añadidos o ampliados en Fase 3

| Archivo | Cobertura añadida |
|---|---|
| `src/lib/rules-engine/__tests__/plazos-engine.test.ts` | Plazos convocatoria SA/SL/cotizada, segunda convocatoria, caducidad, derecho información, impugnación, separación, oposición acreedores, cuentas, auditor, inscripción/deposito demo. |
| `src/lib/rules-engine/__tests__/delegations-representation.test.ts` | Poder escrito, delegación electrónica, límite de 3 representaciones, conflicto del representante, revocación por asistencia personal, consejo y cotizadas indelegables. |
| `src/lib/rules-engine/__tests__/agreement-dependency-validator.test.ts` | Auditor/cuentas, dividendo/cuentas, cese/cargos, aumento/estatutos, fusión/absorbida, delegación indelegable, 2/3 consejo, solidarios contradictorios. |
| `src/lib/rules-engine/__tests__/related-party-engine.test.ts` | Operación vinculada material, exención, acumulación 12m, exclusión consejo, socio vinculado junta. |
| `src/lib/rules-engine/__tests__/phase3-performance.test.ts` | 500 socios, 500 asistentes/delegaciones, acta con 20 puntos, 20 certificaciones. |
| `src/lib/rules-engine/__tests__/rules-render-state-integration.test.ts` | Flujo motor → renderer → estado y convocatoria → plazo → renderer → bloqueo estado. |
| `src/lib/rules-engine/__tests__/co-aprobacion-solidario.test.ts` | Mancomunados k=n, acta con firmas QTSP EAD Trust como input estable, solidario documenta actuante. |

### Matriz Fase 3 solicitada

| Área | Estado | Evidencia |
|---|---|---|
| Plazos de convocatoria | Automatizado | `plazos-engine.test.ts` |
| Caducidad convocatoria | Automatizado | `plazos-engine.test.ts` |
| Plazos impugnación | Automatizado | `plazos-engine.test.ts` |
| Representación en junta | Automatizado | `delegations-representation.test.ts` |
| Representación en consejo | Automatizado | `delegations-representation.test.ts` |
| Derecho de separación | Automatizado | `plazos-engine.test.ts` |
| Oposición acreedores | Automatizado | `plazos-engine.test.ts` |
| Pipeline cuentas anuales | Automatizado en motor; E2E gap | `plazos-engine.test.ts`; fixture JG ordinaria sigue requerida para E2E completo. |
| Cuentas con salvedades | Automatizado | `plazos-engine.test.ts` |
| Delegación facultades | Automatizado parcial | `agreement-dependency-validator.test.ts`; E2E consejo con fixture sigue P1. |
| Administración conjunta | Automatizado parcial | `co-aprobacion-solidario.test.ts`; conflicto mancomunado con derivación a Junta sigue requisito de selector. |
| Administración solidaria | Automatizado parcial | `co-aprobacion-solidario.test.ts`, `agreement-dependency-validator.test.ts` |
| Coherencia temporal acuerdos | Automatizado | `agreement-dependency-validator.test.ts` |
| Dependencias intra-sesión | Automatizado | `agreement-dependency-validator.test.ts` |
| Rendimiento 500 socios | Automatizado | `phase3-performance.test.ts` |
| Orden del día 20 puntos | Automatizado | `phase3-performance.test.ts` |
| Operaciones vinculadas | Automatizado | `related-party-engine.test.ts` |
| Abstención/exclusión vinculada | Automatizado | `related-party-engine.test.ts`, `delegations-representation.test.ts` |
| Plazos inscripción RM demo | Automatizado | `plazos-engine.test.ts` |
| Depósito cuentas anuales | Automatizado | `plazos-engine.test.ts` |
| Flujo integrado motor→render→estado | Automatizado | `rules-render-state-integration.test.ts` |
| Flujo integrado convocatoria→plazos | Automatizado | `rules-render-state-integration.test.ts` |

### Gaps que siguen requiriendo fixture o contrato adicional

#### P0 — E2E JG ordinaria anual completa

Necesidad:
- Fixture temporal de sociedad/reunión/documentos que encadene FORMULACION_CUENTAS, informes PRE, CONVOCATORIA, APROBACION_CUENTAS, certificaciones y tramitador.
- Debe aislar datos y limpiar al terminar; no debe usar ARGA compartido como scratch.

#### P1 — Consejo real para delegación de facultades y operación vinculada

Necesidad:
- Fixture de consejo con asistentes, representados, conflicto, Comisión de Auditoría y acuerdo de delegación.
- Debe verificar UI/acta/certificación, no solo helper puro.

#### P1 — Conflicto de administrador mancomunado

Necesidad:
- Regla de elegibilidad que decida si puede actuar el otro mancomunado solo o si debe derivarse a Junta.
- No se implementó porque es una regla de gobierno material que necesita contrato funcional cerrado.

#### P2 — Validación productiva QTSP end-to-end

Necesidad:
- Expediente firmado real con refs verificables EAD Trust contra cadena convocatoria → acta → certificación.
- Los tests actuales cubren que el renderer usa refs QTSP como input estable y no genera proveedor alternativo.

### Verificación Fase 3

| Check | Resultado |
|---|---|
| Focused Vitest Fase 3 (`plazos`, `delegations`, `agreement-dependency`, `related-party`, `performance`, `rules-render-state`, `co-aprobacion-solidario`, `expediente-state-machine`) | Pass: 8 files, 65 tests |
| `bun run db:check-target` | Pass: governance_OS `hzqwefkwsxopwrmtksbg` |
| Full Vitest | Pass: 79 files, 713 tests, 59 skipped existentes |
| `tsc --noEmit --pretty false` | Pass |
| `bun run lint` | Pass: 0 errores, 21 warnings preexistentes |
| `vite build` | Pass; warnings conocidos de Browserslist/chunk size |
| `e2e/21-secretaria-responsive.spec.ts --project=chromium` | Pass: 5/5 |

---

## Fase 4 — inventario de plantillas legacy y validación Capa 3

Fecha: 2026-05-04  
Alcance: cierre de riesgos residuales: validación pura de datos Capa 3, auditoría de inventario de 17 plantillas legacy, normalización de fuentes, bloques Handlebars pendientes y cierre demo-operativo posterior de las 17 filas existentes en Cloud.  
Restricciones: sin migraciones, sin `db push`, sin crear tablas/columnas/RPC/policies/storage y sin envío real al Registro Mercantil.

### Criterio práctico de plantilla completa

Una plantilla del Bloque A puede marcarse como completa solo si cumple:

- `estado=ACTIVA`, `version` semver, `aprobada_por` y `fecha_aprobacion`.
- `organo_tipo`, `adoption_mode` y `referencia_legal` completos salvo documentos de soporte interno.
- Capa 1 sin referencias legales obsoletas ni condicionales rígidos cuando la materia exige variantes.
- Capa 3 con campos obligatorios jurídicamente suficientes y validación previa al render.
- Fuentes Capa 2 normalizadas o cubiertas por fallback explícito; duplicidades Capa 2/Capa 3 documentadas con prevalencia Capa 3.

### Cambios implementados

| Archivo | Cambio | Cobertura |
|---|---|---|
| `src/lib/secretaria/capa3-validator.ts` | Nuevo validador puro por materia. Devuelve `PASS`, `WARNING` o `FAIL`, issues bloqueantes/warnings, valores normalizados y derivados. | Auditor, consejero/cooptación, aumento/reducción/dividendo, fusión/escisión, seguros, remuneración, comités, ratificación, estatutos. |
| `src/lib/secretaria/template-inventory-audit.ts` | Nueva probe pura del inventario legacy. Clasifica 17 plantillas en 4 bloques y audita firma formal, semver, owner metadata, referencia legal y contenido crítico. | Bloque 1 críticas, bloque 2 metadatos NULL, bloque 3 materia substantiva, bloque 4 cierre rutinario. |
| `src/lib/doc-gen/__tests__/template-renderer-expanded.test.ts` | Regresiones de bloques Handlebars pendientes. | Seguros intra-grupo, secretario no consejero, Código Buen Gobierno cotizadas, política remuneración no cotizada, default de comités. |
| `src/lib/doc-gen/__tests__/variable-resolver.test.ts` | Regresiones de normalización `ENTIDAD` y prevalencia Capa 3. | 5 plantillas con fuente entidad y 4 duplicidades Capa 2/Capa 3. |

### Reglas Capa 3 automatizadas

| Materia | Regla | Estado |
|---|---|---|
| `NOMBRAMIENTO_AUDITOR` | `duracion_anos` entre 3 y 9. | Automatizado |
| `NOMBRAMIENTO_CONSEJERO` | SA cotizada max 4; SA no cotizada max 6; estatutos pueden reducir; cooptación solo SA. | Automatizado |
| `AUMENTO_CAPITAL` | Coherencia aritmética y plazo mínimo de suscripción preferente. | Automatizado |
| `REDUCCION_CAPITAL` | Gate de oposición acreedores salvo pérdidas/reserva legal. | Automatizado |
| `POLITICA_REMUNERACION` | `retribucion_maxima_total` numérico y positivo. | Automatizado |
| `SEGUROS_RESPONSABILIDAD` | Importes numéricos y gate de conflicto intra-grupo si `aseguradora_del_grupo=true`. | Automatizado |
| `FUSION_ESCISION` | RDL 5/2023 obligatorio; fusión simplificada exige `requiere_experto=false`. | Automatizado |
| `COMITES_INTERNOS` | Default para `articulos_lsc_comite` opcional vacío. | Automatizado |
| `DISTRIBUCION_DIVIDENDOS` | Dividendo no superior al beneficio distribuible. | Automatizado |
| `RATIFICACION_ACTOS` | Listado/anexo de actos obligatorio. | Automatizado |
| `MODIFICACION_ESTATUTOS` | Gate de texto íntegro disponible en convocatoria. | Automatizado |

### Inventario de plantillas

| Bloque | Plantillas | Estado |
|---|---:|---|
| Críticas | 3 | Automatizada clasificación y probe de contenido mínimo |
| Metadatos NULL | 4 | Automatizada detección `organo_tipo`/`adoption_mode`/`referencia_legal` |
| Materia substantiva | 4 | Automatizada clasificación y validadores Capa 3 asociados |
| Cierre rutinario | 6 | Automatizada firma/semver y duplicidades de variables |

### Cierre Cloud aplicado

El 2026-05-04 se ejecutó `scripts/close-legacy-templates-phase4.ts --apply` tras `bun run db:check-target`. La actualización fue sobre filas existentes de `plantillas_protegidas`; no se aplicaron migraciones ni se crearon versiones nuevas.

| Probe Cloud post-cierre | Resultado |
|---|---:|
| Filas legacy actualizadas | 17 |
| ACTIVAS sin `aprobada_por`/`fecha_aprobacion` | 0 |
| ACTIVAS con versión no semver | 0 |
| `MODELO_ACUERDO` activo con `organo_tipo`/`adoption_mode`/`referencia_legal` null | 0 |
| Issues bloqueantes de `template-inventory-audit.ts` sobre las 17 legacy | 0 |

El aprobador registrado es `Comite Legal Garrigues - Secretaria Societaria (demo-operativo)`. Esto cierra el demo; para uso productivo queda pendiente sustituirlo por firma nominal profesional si el Comité Legal lo exige.

### Gaps que siguen fuera de Fase 4

#### P0 — Wiring UI/composer del validador Capa 3

Necesidad:
- Sustituir gradualmente validaciones de `Capa3Form` y `composer` por `validateCapa3ForMateria`.
- Requiere decidir si el bloqueo ocurre en captura UI, preparación documental o ambos.

#### P1 — Desdoblamiento de materias

Necesidad:
- Separar materias genéricas cuando Legal lo cierre: `FUSION_ESCISION`, `POLITICA_REMUNERACION`, `NOMBRAMIENTO_CONSEJERO` por Junta/cooptación, y `CESE_CONSEJERO` por Junta/Consejo.

### Verificación Fase 4

| Check | Resultado |
|---|---|
| Focused Vitest Fase 4 (`capa3-validator`, `template-inventory-audit`, `template-renderer-expanded`, `variable-resolver`) | Pass: 4 files, 84 tests |
| `bun run db:check-target` | Pass: governance_OS `hzqwefkwsxopwrmtksbg` |
| `bun scripts/close-legacy-templates-phase4.ts --apply` | Pass: 17 updated, 0 missing approval, 0 non-semver, 0 blocking inventory issues |
| Full Vitest | Pass: 81 files, 777 tests, 59 skipped existentes |
| `tsc --noEmit --pretty false` | Pass |
| `bun run lint` | Pass: 0 errores, 21 warnings preexistentes |
| `vite build` | Pass; warnings conocidos de Browserslist/chunk size |
| `e2e/21-secretaria-responsive.spec.ts --project=chromium` | Pass: 5/5 |
| `git diff --check` | Pass |
| Copy/QTSP grep | Sin proveedor QTSP alternativo ni copy prohibida nueva |
