# Loop de estabilización Secretaría Societaria — Log de continuidad

> Documento vivo del loop ultracode iniciado 2026-06-11. Prompt fuente:
> `docs/superpowers/prompts/2026-06-11-prompt-ultracode-estabilizacion-secretaria.md`.
> Backlog vivo: `2026-06-11-secretaria-stabilization-backlog.md`.
> Cualquier sesión fresca debe leer ambos documentos antes de continuar.

## Checklist de arranque (2026-06-11)

| Check | Resultado |
|---|---|
| `git status` sobre `main` | Limpio salvo `?? docs/superpowers/prompts/` (el propio prompt del loop — no bloquea) |
| HEAD | `949228b` fix(security): RPC evidence bundle FAIL-CLOSED real |
| `bun run db:check-target` | PASS — governance_OS (hzqwefkwsxopwrmtksbg) |
| Documentos de continuidad | No existían → arranque fresco |
| Baseline gates | EN EJECUCIÓN (background) — se anota abajo al completar |

## Baseline de gates (pre-loop)

| Gate | Resultado baseline (2026-06-11, pre-fix) |
|---|---|
| `bun test` | **16 FAIL** / 1838 pass / 152 skip (regresión ambiental vs cierre 06-06 que reportó 0 fail) |
| `bun run typecheck` | PASS |
| `bun run lint` | 15 errores `no-explicit-any` (cluster GRC/AIMS, deuda conocida) + 2 warnings `exhaustive-deps` en ConvocatoriasStepper. Exit code 1. |
| `bun run build` | PASS (warnings conocidos chunk size) |

Nota: CLAUDE.md habla de "23 warnings conocidos" de lint; la realidad actual es 2 warnings + 15 errores. Reconciliar docs al cierre.

## Iteraciones

### Iteración 0 — Auditoría integral read-only (EN CURSO)

- **Método:** workflow multi-agente — 13 auditores en paralelo (A1–A12 + barrido usabilidad §4),
  verificación adversarial de hallazgos P0/P1 (skeptics con mandato de refutar; claims normativos
  contrastados contra BOE).
- **Salida esperada:** backlog priorizado completo + matriz de cobertura A2 en
  `docs/superpowers/reviews/`.
- **Resultado (HECHO):** 80 agentes, ~46 min, 2.462 tool uses. **153 hallazgos**; 67 P0/P1 pasaron
  verificación adversarial → 50 confirmados (13 con severidad ajustada), 4 refutados. Backlog
  consolidado: **149 activos = 1 P0 + 50 P1 + 62 P2 + 36 P3**. 1 hallazgo P0/P1 de A10 quedó sin
  verificación individual por cap (12/área) — anotado en el ítem.
- **Entregables:** backlog (`2026-06-11-secretaria-stabilization-backlog.md`), informe con resúmenes
  por área + 13 anexos (`docs/superpowers/reviews/2026-06-11-iteracion0-auditoria-secretaria.md`),
  matriz de cobertura A2 (`docs/superpowers/reviews/2026-06-11-matriz-cobertura-acuerdos-plantillas.md`).
- **Lectura transversal:** clusters de hallazgos duplicados entre áreas (mismo defecto raíz):
  consejo base de mayoría (ITEM-009/036), primeraConvocatoria hardcoded (016/038), voto de calidad
  (017/039/040/052), secretario no consejero en censo (028/037), authority_evidence duplicada
  (029/043), arts. 625/629 inexistentes (011/053), unipersonal (022/051), co-aprobación/solidario
  circular (020/050). Se agruparán en iteraciones temáticas.
- **Nota de triaje:** varios BLOQUEADO-LEGAL del backlog son re-triables a accionables — corregir un
  motor/pack contra texto BOE verificado no es redacción legal nueva (§1.4 aplica a cláusulas de
  plantillas y decisiones de producto). Se revisará ítem a ítem al seleccionarlos.

### Iteración 3 — ITEM-003 [P0] Acta nunca certificable: no existía acción de aprobar/firmar (HECHO)

- **Evidencia:** gate `actaApprovalGateReason` exige `minutes.signed_at` (ActaDetalle.tsx) pero
  `fn_generar_acta` inserta `signed_at NULL` y NO existía ningún UPDATE de `minutes` en todo el
  producto. Cloud: 11 actas demo, solo 6 (seed) firmadas. Toda acta del flujo operativo quedaba
  bloqueada para certificación pidiendo un paso inexistente.
- **Fix:** migración `20260611180327_fn_aprobar_acta` (RPC SECURITY DEFINER con aserción de tenant
  vía `fn_current_tenant_id`, patrón 20260606165443; idempotente; exige contenido; firma + bloquea
  `is_locked` en una operación — `trg_minutes_lock_guard` garantiza inmutabilidad posterior; REVOKE
  anon/PUBLIC, GRANT authenticated). Hook `useAprobarActa` (useActas.ts), componente
  `AprobarActaButton` (capability CERTIFICATION + window.confirm por irreversibilidad), montado
  junto a EmitirCertificacionButton; mensaje del gate ahora accionable.
- **Verificación:** smoke conductual en Cloud (scratch row): firma+lock OK, tamper post-firma
  bloqueado por guard, idempotencia OK, rechazo de acta sin contenido OK, scratch limpiado. Probe
  test `ITEM-003` en rpcs-acta-cert.test.ts verifica existencia + veto a anon. Gates: bun test 2007
  (0 fail), typecheck, lint sin nuevos, build, e2e 05+18 (golden path completo) 6/6.
- **Cloud:** head migraciones = `20260611180327`, `migration list --linked` alineado. Nota: el head
  previo real era 20260606175406 (CLAUDE.md decía 20260606165443 — drift de docs anotado).

### Iteración 2 — ITEM-002 [P2] Spec e2e 12-navigation desfasado (HECHO, commit cbbe102)

- Baseline e2e checkpoint: 46/48 → fix de 3 expectativas estancas (label "Personas y cargos",
  botón dashboard "Nuevo acuerdo sin sesión", heading "Actas y certificaciones vinculadas") →
  **48/48** (spec 12: 5/5).

### Iteración 1 — ITEM-001 [P0] Suite de tests rota por fuga global de mocks (HECHO)

- **Evidencia del gap:** baseline `bun test` con 16 fail (openxml-validation ×2, composer-smoke ×9,
  document-draft-persistence ×2, BloquesSectorialesPanel ×2, usePlantillaWithOverrides ×1). Todos los
  archivos pasaban en aislamiento. Causa raíz: `vi.mock`/`mock.module` de Bun es **global al proceso**
  y se fuga a los archivos de test posteriores. Tres vectores confirmados: (1)
  `process-documents.test.ts` mockeaba `../docx-generator` parcialmente (sin
  `buildPrintableDocumentHtml` → SyntaxError de export; `generateDocx` fake devolvía texto plano →
  jszip "can't find end of central directory" en openxml); (2) `useTemplatePreflight.test.tsx`
  mockeaba `@tanstack/react-query` solo con `useMutation` → `useQuery` undefined en víctimas; (3)
  `useImportPlantillaPackage.test.tsx` fugaba un cliente Supabase fake que lanza
  `Unexpected table agreements` → composer-smoke. La suite era dependiente del orden de ejecución
  (por eso pasaba el 06-06 y falla hoy sin cambios de código).
- **Decisión:** fix estructural, no parche de orden: los 17 archivos con `vi.mock` real capturan los
  módulos reales ANTES de mockear y los **restauran en `afterAll`** (patrón
  `__realModulesForRestore`). `process-documents.test.ts` además migra a `mock.module` de `bun:test`
  explícito y su mock pasa a ser completo (spread del módulo real).
- **Archivos:** 18 archivos de test (codemod uniforme; sin tocar código de producción).
- **Gates:** `bun test` **1854 pass / 0 fail** (idéntico al cierre 06-06); typecheck PASS; lint sin
  problemas nuevos (15+2 preexistentes); build PASS.
- **Commit:** (ver git log — `test(secretaria)`).
- **Pendiente derivado:** ninguno. Higiene futura: cualquier `vi.mock` nuevo debe seguir el patrón
  captura+restore.

### Iteración 4 — ITEM-023 [P1] Forja cross-tenant en fn_create_communication_atomic (HECHO)

- **Evidencia:** la RPC SECURITY DEFINER resolvía tenant como
  `COALESCE(p_comm->>'tenant_id', fn_current_tenant_id())` sin aserción — un SECRETARIO
  autenticado podía crear comunicaciones/adjuntos/destinatarios en cualquier tenant. El check de
  rol tampoco estaba scoped por tenant.
- **Fix en dos pasos con lección aprendida:** la primera migración (20260611181010) usó el patrón
  v1 `v_caller_tenant IS NOT NULL AND ...` — el MISMO patrón fail-open que la saga del evidence
  bundle ya había corregido (test evidence-bundle-rpc-hardening.test.ts lo prohíbe). Detectado al
  releer ese test; la migración 20260611182500 eleva fn_create_communication_atomic **y también
  fn_aprobar_acta (ITEM-003)** al contrato fail-closed v3: solo service_role TRUE explícito
  bypassa; el resto exige tenant resuelto (fn_assert_current_tenant_id) y coincidente (42501).
  Check de rol scoped (`rur.tenant_id = v_tenant_id`).
- **Verificación:** smoke Cloud (DO block): contexto sin tenant resoluble → rechazado (fail-closed
  real); con claim service_role → firma OK. Test nuevo `comms-rpc-hardening.test.ts`: contrato de
  contenido + prueba conductual real (demo user → forja cross-tenant denegada; fn_aprobar_acta
  ejecutable por authenticated con error de negocio, no de permisos). Gates: 2013 tests 0 fail,
  typecheck, lint sin nuevos, build. Head migraciones = 20260611182500 alineado.
- **Regla para el resto del loop:** todo SECURITY DEFINER nuevo o tocado usa el contrato
  fail-closed v3 — nunca el patrón `IS NOT NULL`.

### Iteración 5 — ITEM-029/043 [P1] authority_evidence con cargos fantasma (HECHO)

- **Evidencia (Cloud):** 37 AE VIGENTES en ARGA; 12 sin condiciones_persona VIGENTE de respaldo
  cargo-a-cargo (regla `tipo_condicion = cargo` mismo persona+entidad+órgano): 2 PRESIDENTE y 2
  SECRETARIO en el CdA, presidentes duplicados en las 9 comisiones. La regla cargo-a-cargo resuelve
  también los 2 casos donde ambos duplicados tenían "alguna" condición (Retribuciones → Isabel
  Moreno; Sostenibilidad → Álvaro Mendoza). usePresidenteVigente hacía limit(1) sin ORDER BY.
- **Fix:** migración `20260611183000_cease_phantom_authority_evidence` — UPDATE a CESADO de las 12
  fantasma (con motivo en metadata) + índice único parcial
  `ux_authority_evidence_pres_sec_vigente` (PRESIDENTE/SECRETARIO VIGENTE únicos por órgano;
  verificada 0 colisión global pre-creación; no restringe VICEPRESIDENTE — ARGA declara 2).
  Hooks `usePresidenteVigente` y `useAuthorityEvidenceLookup` con orden determinista.
- **Verificación:** Cloud post-fix: 25 vigentes, 0 fantasmas, 1 PRESIDENTE en CdA, índice creado.
  Test regresión `authority-evidence-integrity.test.ts` (2 tests contra Cloud como demo user).
  Gates: 2015 tests 0 fail, typecheck, lint sin nuevos, build, e2e 05+18 6/6.
- **Nota derivada para ITEM-030:** el presidente del CdA (ejecutivo) preside también la Comisión de
  Auditoría con condición de respaldo — en cotizada el presidente de esa comisión debe ser
  independiente (art. 529 quaterdecies LSC). Tratar en la reconciliación de composición.

### Iteración 6 — ITEM-028/037 [P1] Secretario no consejero computaba en quórum y votaba (HECHO)

- **Evidencia:** useBodyMembers devolvía las 17 condiciones del CdA sin distinguir vocales; la
  secretaria no consejera entraba en denominador de quórum (9/17 "cubierto" con solo 8 de 16
  vocales — falso positivo vs arts. 247.1/247.2 LSC), votaba en VotacionesStep y se ofrecía como
  representante de consejeros.
- **Fix:** helper puro `computeVocalPersonIds` en meeting-census.ts (NON_VOCAL = SECRETARIO/
  VICESECRETARIO/LETRADO_ASESOR; consejero-secretario sigue siendo vocal); `BodyMember.es_vocal`;
  AsistentesStep persiste `voting_rights = es_vocal ? 1 : 0` en órganos colegiados (juntas
  conservan capital), censo y % universal sobre vocales, representantes solo vocales, badge "Con
  voz sin voto"; QuorumStep computa presentes/total sobre vocales; VotacionesStep excluye
  voting_rights=0. Cita del engine corregida: art. 247.2 LSC para SA, 247.1 para SL.
- **Verificación:** 3 tests nuevos en meeting-census.test.ts (incluido el caso CdA ARGA 8/16);
  suite 2018 tests 0 fail; typecheck/lint/build verdes; e2e 05+18 6/6.
- **Nota:** actas/reuniones antiguas con attendees persistidos (voting_rights null) conservan su
  comportamiento; al re-guardar asistencia desde el stepper adoptan el marcador.

### Iteración 7 — ITEM-017/039/040/052 [P1] Cluster voto de calidad (HECHO)

- **Evidencia:** (1) Gate 6 de evaluarVotacion adoptaba CUALQUIER empate con votoCalidadHabilitado
  sin conocer el voto del presidente (snapshot ADOPTED jurídicamente inválido si votó en contra) y
  podía "satisfacer" mayorías reforzadas; (2) votoCalidadHabilitadoPorOrgano hacía return false
  incondicional para COMISION_DELEGADA antes de leer quorum_rule.voto_calidad_presidente, dejando
  sin efecto el true del Comité Ejecutivo (DL-5; verificado en Cloud: solo ese órgano tiene flag).
- **Fix:** VotacionInput.votoPresidente ('FAVOR'|'CONTRA'|'ABSTENCION'|null); Gate 6 fail-closed —
  solo dirime con voto FAVOR confirmado, nunca sobre mayoría reforzada (regex 2/3|3/4|4/5),
  explain nodes específicos para cada rechazo; plumbing por meeting-adoption-snapshot
  (voting_context.voto_presidente persistido) y VotacionesStep (presidente desde condiciones del
  órgano, voto leído de la fila del punto); votoCalidadHabilitadoPorOrgano reordenado (config
  explícita manda; default CONSEJO sí / comisiones no).
- **Verificación:** 4 tests actualizados (camino positivo ahora exige FAVOR) + 5 regresiones nuevas
  (presidente CONTRA, sin voto informado fail-closed, reforzada 2/3, snapshot REJECTED ×2). Suite
  2023 tests 0 fail; typecheck/lint/build verdes; e2e 05+18 6/6.

### Iteración 8 — ITEM-016/038 [P1] primeraConvocatoria hardcodeado a true (HECHO)

- **Evidencia:** QuorumStep y buildSnapshotForPoint pasaban primeraConvocatoria:true fijo. Una JGE
  en 2ª convocatoria con 30% de capital y materia estatutaria (válida, art. 194.2: 25%) quedaba
  bloqueada con el umbral del 50% de 1ª (art. 194.1). El motor codifica 193/194 correctamente
  (verificado contra BOE); el dato simplemente no llegaba.
- **Fix:** el secretario declara la llamada en el paso de Quórum (selector "Primera/Segunda
  convocatoria", visible solo para JUNTA_GENERAL de SA/SAU no universal), persistida en
  quorum_data.quorum.convocatoria_llamada; propagada a evaluarConstitucion y al snapshot de
  votación (primeraConvocatoria = llamada !== SEGUNDA). Reanudación restaura el valor guardado.
- **Residual anotado:** useAgreementCompliance/usePreviewAcuerdo conservan default 1ª convocatoria
  (evaluación de forma con votos placeholder — cubierto por la deuda DL-2/ITEM-019, no por este
  ítem). ConvocatoriasStepper evalúa la convocatoria en 1ª por diseño.
- **Verificación:** gates verdes (2023 tests 0 fail, typecheck, lint, build); e2e 05+18 6/6.

### Iteración 9 — ITEM-044/045/046 [P1] Cluster evidencia/WORM (HECHO + 1 BLOQUEADO-HUMANO)

- **ITEM-044 (HECHO):** archiveDocxToStorage insertaba bundles sin provenance y el hook resolvía
  por source_object_type='AGREEMENT' → todo documento archivado quedaba irrecuperable desde el
  expediente. Fix doble: el escritor popula source_module/source_object_type/source_object_id, y
  useAgreementSignedDocumentUrl añade fallback de LECTURA por agreement_id para los 39 bundles
  legacy (33 OPEN sin provenance + 6 SEALED seed con 'agreement' minúsculas) — sin mutar filas
  WORM existentes.
- **ITEM-046 (HECHO):** el verificador offline comparaba djb2(artifacts) contra un manifest_hash
  que era el SHA-256 del contenido → '✗ Error de integridad' permanente sobre documentos íntegros.
  El manifest se construye ahora con computeManifestHashSync([artifact]) (el SHA-256 sigue como
  artifact.hash). 2 tests de regresión en evidence-bundle.test.ts.
- **ITEM-045 (BLOQUEADO-HUMANO, parte hecha):** migración 20260611190000 alinea fn_audit_worm con
  el verificador (prev = última fila HASHEADA por created_at,id — antes: sin excluir 95 NULLs y
  sin tiebreaker sobre 163 created_at duplicados). Las entradas NUEVAS encadenan correctamente.
  La cadena histórica (3000+ entradas) no es reparable sin RE-ANCLAJE documentado (nuevo génesis
  con corte fechado) — decisión forense que requiere humano; mientras tanto chain_valid seguirá
  false sobre el histórico. Coherente con 000049 HOLD (evidencia nunca final productiva).
- **Verificación:** 2025 tests 0 fail; typecheck/lint/build verdes; e2e 14+18 8/8. Migración head
  20260611190000 alineada.

### Iteración 10 — ITEM-042 [P1] Certificar desde acta no transicionaba a CERTIFIED (HECHO)

- **Evidencia:** fn_generar_certificacion (minute-based, golden path) no actualizaba
  agreements.status (la variante sin sesión sí): 4 acuerdos con cert SIGNED atascados en ADOPTED
  en Cloud — timeline del expediente y Mesa de control contradiciendo la certificación firmada.
- **Fix:** migración 20260611191500 — fn_emitir_certificacion (paso final del pipeline) transiciona
  ADOPTED→CERTIFIED los UUID de agreements_certified (scoped a tenant; ignora referencias no-UUID
  de actas legacy) + backfill de los 4 atascados (verificado en Cloud: ahora CERTIFIED).
- **Hallazgo colateral anotado en ITEM-045:** fn_emitir_certificacion inserta en audit_log sin
  hash (uno de los escritores de filas NULL) — tolerado por el fix de la Iteración 9, candidato a
  unificación de escritores si se decide el re-anclaje.
- **Verificación:** test de invariante Cloud `agreement-certified-transition.test.ts` (cert SIGNED
  ⇒ agreement no-ADOPTED); 2026 tests 0 fail; gates verdes; e2e 07+18 7/7.

### Iteración 11 — ITEM-035 [P1] Convocatorias emitidas nunca inmutables (HECHO)

- **Evidencia:** el guard solo sellaba en la transición a EMITIDA por UPDATE, pero el stepper
  INSERTa directamente en EMITIDA → 11/11 emitidas con immutable_at NULL y campos estructurales
  (body_id, fechas, canales) mutables tras la comunicación.
- **Fix:** migración 20260611192500 — guard unificado TG_OP-aware (sella en INSERT y UPDATE cuando
  NEW.estado='EMITIDA' sin sello previo; mantiene bloqueo estructural), trigger BEFORE INSERT nuevo
  y backfill de las 11 EMITIDA (sello = updated_at/created_at).
- **Verificación:** Cloud 11/11 selladas; smoke conductual (INSERT directo sella + UPDATE
  estructural bloqueado, scratch limpiado); gates verdes; e2e 04+18 6/6.
- **Residual P3 anotado:** 3 convocatorias seed en estado CELEBRADA sin sello (no pasaron por
  EMITIDA en su ciclo seed); las nuevas conservan el sello al transicionar.

### Iteración 12 — ITEM-049 [P1] PactosParasocialesCard con votos inventados (HECHO)

- **Evidencia:** la card del expediente evaluaba con votosFavor:70/votosContra:30 fijos →
  "MAYORÍA PACTADA NO ALCANZADA" permanente en OPERACION_VINCULADA (70%<75%) y vetos siempre
  ACTIVOS, con independencia de la votación real. MATERIA_MAP sin OPERACION_ESTRUCTURAL ni
  alineación con el vocabulario real de cláusulas (AUMENTO_CAPITAL vs AMPLIACION_CAPITAL).
- **Fix:** votos REALES desde compliance_snapshot.vote_summary (congelado al adoptar) cuando
  existen; sin votación real la card opera en "modo aplicabilidad": banner explicativo, badge
  APLICA/No aplica neutro, sin veredictos cumple/incumple ni KPI "Cumplidos", explain sustituido
  por texto de aplicabilidad. MATERIA_MAP ampliado y alineado con materia_ambito de
  pacto_clausulas (verificado en Cloud: FUSION/ESCISION/TRANSFORMACION/CESION_GLOBAL_ACTIVO/
  DISOLUCION; AUMENTO/REDUCCION_CAPITAL; EMISION_OBLIGACIONES; OPERACION_VINCULADA).
- **Verificación:** gates verdes (2026 tests 0 fail); e2e 07+18 verdes.

### Iteración 13 — ITEM-041 [P1] Sobre-exclusión por conflicto de interés (HECHO con residual)

- **Evidencia:** update() reimponía conflict_flag=true para cualquier persona con conflicto activo
  en la entidad, en TODOS los puntos de TODAS las reuniones (el checkbox existía pero era
  inoperante). El motor excluía su voto y peso de numerador y denominador: un conflicto sobre una
  operación concreta alteraba la aprobación de cuentas, nombramientos, etc. (arts. 190.1 —
  privación solo en supuestos tasados y para el acuerdo afectado—, 190.3 —no priva— y 228.c —
  abstención en los acuerdos afectados—).
- **Fix:** el conflicto registrado PRE-MARCA el flag como sugerencia editable por punto (la
  decisión es del secretario, punto a punto — el estado por punto en votesByPoint ya daba la
  granularidad); copys actualizados con el alcance legal correcto. El fast-track unánime mantiene
  la exclusión como default bulk, ajustable después por punto.
- **Residual (decisión humana, anotado):** vincular conflicts_of_interest a materia/expediente para
  pre-marcar solo los puntos afectados (taxonomía 190.1 vs 190.3 vs 228.c) — requiere modelo de
  datos del alcance del conflicto.
- **Verificación:** gates verdes (2026 tests 0 fail); e2e 05+18 verdes (spec 57 conflictos skipped
  por diseño de la serie test-a).

### Iteración 14 — ITEM-006 [P1] Alias divergentes materia UI ↔ rule pack (HECHO)

- **Evidencia:** 7 ids del catálogo de agenda/materia_catalog no matchean los ids sembrados en
  rule_packs (APROBACION_PRESUPUESTOS/O, CESION_GLOBAL/_ACTIVO, REMUNERACION_CONSEJEROS/
  RETRIBUCION_ADMIN, CAMBIO_DOMICILIO_SOCIAL/TRASLADO_DOMICILIO_NACIONAL, MODIFICACION_REGLAMENTO/
  APROBACION_REGLAMENTO_CONSEJO, AMPLIACION_CAPITAL/AUMENTO_CAPITAL, EXCLUSION_DERECHO_
  SUSCRIPCION_PREFERENTE/SUPRESION_PREFERENTE): la convocatoria emitía con accepted-warning
  genérico SIN reglas de pack (mismo patrón que rompió OPERACION_VINCULADA en su día).
- **Fix:** mapa central MATERIA_PACK_ALIASES + normalizeMateriaForRulePack en rule-resolution.ts,
  aplicado en resolveRulePackForMatter (con nodo RULE_PACK_ALIAS en el explain para trazabilidad)
  y en useRulePackForMateria (normaliza antes de consultar Cloud). DISTRIBUCION_RESERVAS NO se
  alía a DIVIDENDO_A_CUENTA (arts. 273 vs 277 LSC: operaciones distintas — gap honesto hasta pack
  propio aprobado por Comité Legal).
- **Residual:** packs duplicados MOD_ESTATUTOS/MODIFICACION_ESTATUTOS (cubierto por ITEM-013
  BLOQUEADO-LEGAL) y lifecycle NULL del pack de cooptación (data/legal).
- **Verificación:** 3 tests nuevos (alias, no-alias jurídico, match+explain); 2029 tests 0 fail;
  gates verdes; e2e 04+06+18 verdes.

## Checkpoints

- **Checkpoint 1 (tras Iteración 5):** e2e ampliada 48/48; push 949228b..3d2b7e2.
- **Checkpoint 2 (tras Iteración 9):** e2e ampliada 48/48; push 3d2b7e2..ee73f3d.
- **Checkpoint 3 (tras Iteración 14):** e2e ampliada 48/48; push ee73f3d..463df10; migraciones
  alineadas local/remoto hasta 20260611192500. Balance: 23 ítems cerrados (ITEM-001..003, 006,
  016/017, 023, 028/029, 035, 037-046 parcial, 049, 052; 045 BLOQUEADO-HUMANO documentado).

### Iteración 15 — ITEM-024/032 [P1] Plazos de convocatoria: cómputo y citas (HECHO)

- **ITEM-024:** las 3 copias del motor de plazos de comunicaciones (TS cliente, _shared Edge
  Function, gemelo plpgsql) citaban 'Art. 173 LSC' para el plazo de SL (el 173 regula la FORMA;
  el plazo está en el 176.1 — contrastado BOE) y computaban el "un mes" de SA como 30 días.
  Fix sincronizado en las 3 copias: cita unificada Art. 176.1 LSC y cómputo de fecha a fecha
  (art. 5.1 CC) — `subtractOneMonthFechaAFecha` en TS, `- interval '1 month'` en plpgsql
  (migración 20260611194500). Junta 31/07 → límite 30/06 (antes permitía 01/07, un día tarde).
- **ITEM-032:** checkNoticePeriodByType (V1 'efectivo') aplicaba 30 días a toda junta ES: una
  convocatoria SL con 15-29 días (legal) producía falso NOTICE_PERIOD + divergencia V1/V2
  permanente. Fix: 15 días para SL/SLU, 30 para SA/SAU — alineado con calcularAntelacion V2.
- **Verificación:** 3 tests nuevos (cita SL, borde 31/07→30/06, casos fecha-a-fecha); 2032 tests
  0 fail; gates verdes; migración aplicada y alineada; e2e 04+18 6/6.

### Iteración 16 — ITEM-034 [P1] Segunda convocatoria sin reglas del art. 177 LSC (HECHO)

- **Evidencia:** el checkbox de 2ª convocatoria se ofrecía a cualquier tipo social y órgano
  (incluidas SL — figura reservada a la SA, art. 177.1 — y consejos), el input permitía el mismo
  día (defaults sugerían gap de 30 min vs 24h del 177.2) y el seed 3a829751 tenía gap de 2h.
- **Fix:** (1) la 2ª convocatoria solo se ofrece y persiste para JUNTA_GENERAL de SA/SAU;
  (2) warning vivo no-bloqueante cuando el gap 1ª↔2ª es inferior a 24h (art. 177.2, cita del
  hallazgo verificada BOE), coherente con la filosofía non-blocking del paso; (3) migración
  20260611200000: gap del seed corregido a 24h + sellado de las 3 CELEBRADA sin immutable_at
  (residual de Iteración 11). Verificado en Cloud: gap 24.0h, 0 celebradas sin sello.
- **Residual P3:** gate de motor V2 que consuma rule_config.second_call_gap_min_hours (hoy sin
  consumidores) — el quórum de 2ª ya se evalúa vía Iteración 8.
- **Verificación:** gates verdes (2032 tests 0 fail); e2e 04+18 6/6.

### Iteración 17 — ITEM-009/010/036 (+019 parcial) [P1] Mayorías del consejo: base de cómputo (HECHO)

- **Evidencia (BOE literal):** art. 248.1 — "mayoría absoluta de los consejeros CONCURRENTES";
  art. 249.3 — delegación permanente exige "dos terceras partes de los COMPONENTES". El evaluador
  remapeaba 'favor > presentes_mitad' a mayoría del TOTAL (CdA 15, 9 presentes, 5-4: ley adopta,
  motor exigía 7.5 → falso negativo, compensado por accidente porque el stepper pasaba presentes
  como total — falseando a la vez voting_context.total_miembros). DELEGACION_FACULTADES exigía
  mitad del total citando 247.2 (que es el QUÓRUM); FORMULACION_CUENTAS 'Mayoría' → simple.
- **Fix:** (1) evaluador: nueva fórmula 'favor > 1/2_miembros_presentes' (concurrentes; fallback
  prudente favor+contra+abstenciones) y 'favor >= 2/3_total_miembros' (componentes);
  'favor > presentes_mitad' y 'favor > total_miembros / 2' canonicalizan a concurrentes.
  (2) snapshot: miembros_presentes = concurrentes reales (antes ¡los votos a favor! — mitad de
  ITEM-019) e input miembrosPresentes; (3) stepper: totalMiembros = vocales reales del censo en
  órganos colegiados, concurrentes aparte; (4) migración 20260611201500: packs
  DELEGACION_FACULTADES → 2/3 componentes (art. 249.3) y FORMULACION_CUENTAS → mayoría absoluta
  de concurrentes (art. 248.1) — re-triados de BLOQUEADO-LEGAL a corrección factual BOE.
- **Verificación:** 5 regresiones nuevas (5-4/9 adopta; 4F-3C-2A no; fallback con abstenciones;
  9/15 no delega, 10/15 sí; grafía total_miembros/2 sobre concurrentes); 2037 tests 0 fail;
  gates verdes; e2e 05+18 6/6; migración alineada.
- **Residual ITEM-019:** fallback de capital_total al peso presente sigue pendiente (mitad restante).

### Iteración 18 — ITEM-004/005 [P1] Cluster overrides estatutarios (HECHO)

- **ITEM-004:** evaluarVotacion ignoraba los overrides de clave votacion.mayoria pese a que la
  matriz efectiva y el rulesetSnapshotId los certificaban como aplicados (trazabilidad de una
  evaluación que no ocurría; el único módulo que los resolvía, effective-rule.ts, es huérfano).
  Fix: Gate 3 aplica los overrides de mayoría con contrato "nunca silencio" — fórmula evaluable →
  SE APLICA (nodo OK con sustitución trazada); unanimidad estatutaria → NO aplicada con WARNING
  (inadmisible, art. 200.1 LSC — caso real en Cloud para ARGA/MODIFICACION_ESTATUTOS); formato no
  evaluable (majority_code desconocido) → NO aplicada con WARNING accionable.
- **ITEM-005:** calcularAntelacion pasaba TODOS los overrides de la materia a resolverReglaEfectiva
  en modo 'mayor': un constitucion_quorum_pct=33 (caso real Cloud, ARGA Portugal) inflaba la
  antelación de 30 a 33 días. Fix: filtro por clave ANTELACION (espejo de isQuorumOverride).
- **Verificación:** 4 regresiones nuevas (override reforzado aplicado y trazado; unanimidad
  rechazada con pack vigente; formato no soportado explícito; quórum no contamina antelación);
  2041 tests 0 fail; gates verdes; e2e 04+05+18 10/10.
- **Residual anotado:** effective-rule.ts sigue sin consumidor UI (la proyección completa); el
  motor ya aplica los overrides de mayoría directamente — decidir en el cierre si se cablea la
  proyección o se retira el módulo (P3).

### Iteración 19 — ITEM-033 [P1] Rule set ES/SA junta a 15 días + selección sin órgano (HECHO)

- **Evidencia (Cloud):** fila legacy 47448c9d (ES+SA+JUNTA_GENERAL, sin nombre ni legal_reference)
  con notice_min_days_first_call=15 contra el art. 176.1 LSC (un mes); además el stepper tomaba
  `find(is_active) ?? ruleSets[0]` sin filtrar por órgano — con 3 rule sets activos para ES+SA, el
  badge de preaviso podía mostrar 3 días para una junta y el statutory_basis persistido podía
  citar el art. 247 (CdA) en una convocatoria de JGA.
- **Fix:** migración 20260611203000 (15→30 con nombre y referencia 176.1, scoped a la fila legacy;
  re-triado de BLOQUEADO-LEGAL a corrección factual BOE) + selección del rule set por
  typology_code coherente con el órgano convocado (sin match → null, mejor sin badge que con un
  badge de otro órgano).
- **Verificación:** gates verdes (2041 tests 0 fail); migración alineada; e2e 04+18 6/6.

### Iteración 20 — ITEM-007/008/013 [P1] Mayorías SL 198 y SA reforzada 201.2 (HECHO, re-triados)

- **ITEM-007 (BOE literal art. 198):** doble condición — mayoría de votos válidamente emitidos
  (favor > contra, blancos no computan) Y favor >= 1/3 del capital total ("al menos" = no
  estricto). El evaluador solo comprobaba favor > total/3: un 34% a favor con 40% en contra se
  proclamaba. Fórmula compuesta implementada; los 5 packs SL que ya citaban 198 quedan correctos
  automáticamente; RETRIBUCION_ADMIN SL migrado de 'Mayoría simple' a la fórmula 198.
- **ITEM-008 (BOE literal art. 201.2 post-Ley 31/2014):** el 2/3 del tramo [25%,50%) es del
  CAPITAL PRESENTE, no de los emitidos (falsos positivos con abstenciones); y con >50% basta
  mayoría absoluta (los packs con 2/3 plano sobre-exigían). Evaluador corregido + migración
  20260611204500: 9 packs SA → 'reforzada art. 201.2 LSC' (3 citaban además el 194.1, que es de
  QUÓRUM). Verificado en Cloud: 0 fórmulas planas restantes, 10 packs en 201.2.
- **ITEM-013:** la contradicción MOD_ESTATUTOS vs MODIFICACION_ESTATUTOS queda resuelta (ambos
  201.2); la consolidación del duplicado pasa a P3.
- **Caso límite documentado:** concurrencia exactamente 50% — se mantiene la lectura mayoritaria
  (mayoría absoluta); la literalidad de «supera» exigiría >50% (nota para Comité Legal).
- **Verificación:** 1 test actualizado al contrato legal + 5 regresiones nuevas; 2045 tests 0
  fail; gates verdes; e2e 05+18 6/6; migración alineada.

### Iteración 21 — ITEM-012 [P1] Quórum SL inventado en 11 packs (HECHO, re-triado)

- **Evidencia (BOE):** la LSC no establece quórum de constitución para la junta de SL (el control
  es la mayoría con suelo de los arts. 198-199). 11 packs activos codificaban quorum.SL=50 citando
  los arts. 196/197 (derecho de información): una junta SL con el 40% del capital quedaba
  BLOQUEADA pese a poder adoptar válidamente. Dos packs citaban además el art. 190 (conflictos)
  como fuente del quórum SA del 25% (es el 193.1).
- **Fix:** migración 20260611210000 — quorum.SL=0 con referencia legal correcta en los 11 packs
  (scoped por id + guard de valor) y citas 190→193.1 en los dos ordinarias. Verificado en Cloud:
  0 packs con SL=50, 0 citas 190 restantes.
- **Verificación:** 2045 tests 0 fail; gates verdes; e2e 05+18 6/6; migración alineada.

### Iteración 22 — ITEM-011/018/053 [P1] Citas normativas en explain nodes (HECHO, re-triados)

- **Evidencia (BOE):** los explain nodes — la justificación jurídica que la UI muestra y los
  snapshots persisten — citaban artículos INEXISTENTES (625/629; la LSC termina en el 541, la API
  del BOE devuelve 404) y 15+ referencias equivocadas (179 por 173, 182 por 174, 187 por 190,
  208 por 202+26 CCom, 305 por 293, 224 por 173, 213 por 173.2, 160 en CoAprobación, etc.).
- **Fix (cambios de string puros, sin lógica):** 8 archivos corregidos con el mapa verificado:
  no-session → art. 100 RRM / arts. 15-16 y 210 LSC; orquestador Flujo B → arts. 15-17 y 210,
  Flujo C → art. 100 RRM + 248.2; convocatoria → 173/174/196-197/272; constitución → 190, 193,
  198-199; votación Gate 1 → 190.2; documentación → 196-197 y 202+26 CCom; bordes → 293/173/173.2;
  CoAprobacionStepper → arts. 210 y 233.2.c.
- **Guard nuevo:** test de lint jurídico `citas-lsc-lint.test.ts` — ninguna cita 'art. N LSC' del
  motor puede superar el art. 541 (no valida idoneidad contextual, solo existencia).
- **Verificación:** 2046 tests 0 fail; gates verdes; e2e 04+05+18 verdes.
- **Checkpoint 4 (tras Iteración 22):** e2e ampliada 48/48; push al día (815ea84..6527861);
  migraciones alineadas hasta 20260611210000. Balance acumulado: 40 ítems cerrados, incluidos
  9 BLOQUEADO-LEGAL re-triados como correcciones factuales BOE (007/008/010/011/012/013/033/053).

### Iteración 23 — ITEM-026 [P1] Blancos silenciosos en documentos formales (HECHO parcial)

- **Evidencia:** plantillas ACTIVA de actas/certificaciones usan namespaces que ningún código
  construye (ACUERDO.*, DECISION.*, COAP.*, REGISTRO.*, meetings.junta.*...); la validación
  post-render los trataba como WARNING y Handlebars rinde cadena vacía → acta/certificación sin
  fecha, lugar, firmante o NIF, emitida sin fricción.
- **Fix intermedio (3 capas):** (1) post-render: UNRESOLVED_VARIABLES pasa a BLOCKING en
  documentos formales (ACTA*/CERTIFICACION) salvo QTSP.* (post-firma by-design) — un documento
  formal ya no puede emitirse con blancos; (2) Gate PRE semántico: nueva regla
  SEM_NAMESPACE_SIN_PROVEEDOR (WARNING) con detector de namespaces huérfanos y set
  SUPPORTED_VARIABLE_NAMESPACES sincronizado con el sourceMap del resolver; (3) aliases baratos
  añadidos al resolver: ENTIDAD.nif, ENTIDAD.tipo_sociedad, REUNION.hora_cierre,
  REUNION.medio_convocatoria.
- **Residual (decisión de contrato, REQUIERE HUMANO/LEGAL):** o el resolver construye los
  namespaces documentales (ACUERDO desde no_session_resolutions, DECISION desde
  unipersonal_decisions, COAP del expediente, REGISTRO desde entities.registry_*) o las plantillas
  migran a los namespaces soportados. Hasta entonces los flujos afectados fallan EXPLÍCITAMENTE
  (BLOCKING accionable) en vez de emitir documentos jurídicamente vacíos.
- **Verificación:** 2 tests nuevos del detector; 2048 tests 0 fail; gates verdes; e2e 14+17+18
  10/10 (el golden path documental resuelve sus variables — el BLOCKING no le afecta).

### Iteración 24 — ITEM-021 [P1] + FK representaciones (hallazgo derivado P0) (HECHO)

- **ITEM-021:** AnadirSocioStepper solo validaba títulos>0 e insertaba directo en capital_holdings
  (0 triggers en Cloud): el libro de socios podía superar el 100% y corromper denominadores de
  quórum/mayoría. Fix: guard vivo en el paso Participación (títulos restantes + % acumulado ≤100,
  label con "restan X de Y", alerta role=alert) y re-chequeo al guardar. RPC con assert de suma
  anotada como deuda P3.
- **Hallazgo derivado (clase P0, preexistente):** representaciones.meeting_id no tenía FK a
  meetings → el embed PostgREST de useRepresentaciones fallaba SIEMPRE ("Could not find a
  relationship") y la pestaña Representaciones mostraba "Sin representaciones vigentes" con datos
  reales. Migración 20260611212000: FK creada (0 huérfanos verificados) + NOTIFY pgrst. Probe
  conductual: el SELECT exacto del hook devuelve la fila como usuario demo.
- **Spec 34 (drift):** actualizado al panel rediseñado ("Ancla normativa de sociedad" / "Matriz
  materia × requisitos" — los textos antiguos ya no existen en src). Spec 34 completo en verde
  por primera vez en el loop.
- **Verificación:** 2048 tests 0 fail; gates verdes; e2e 34 2/2 + 18 verde; migración alineada.

### Iteración 25 — ITEM-022/051 [P1] Decisiones unipersonales (HECHO con residual)

- **Evidencia:** la decisión nacía FIRMADA con decided_by_id NULL (art. 15.2 LSC exige consignación
  bajo firma del socio o su representante); el selector permitía registrar "decisión del socio
  único" sobre ARGA Seguros S.A. (cotizada con free float); PreviewGatePanel evaluaba con
  tipoSocial 'SL' fijo; el paso 3 mostraba checks OCSP/SHA-512 verdes sin que hubiera ocurrido
  ninguna verificación (contra el trust boundary sandbox); placeholder con ejemplo incoherente.
- **Fix:** nuevo hook `useDecisorUnipersonal` — resuelve el decisor REAL (socio único = titular
  único del 100% en capital_holdings sin autocartera; admin único = condición ADMIN_UNICO VIGENTE)
  con motivo accionable si la sociedad no es unipersonal; el paso 1 muestra el decisor o bloquea
  con error; `decidedById` obligatorio en el insert; tipoSocial real derivado de la entidad;
  checklist honesto (firma QES/SHA-512 marcados como pendientes, postura sandbox); copys
  corregidos (SLU/SAU arts. 12-19; ejemplo Cartera ARGA S.L.U.).
- **Residual anotado:** ligar la transición a FIRMADA con la firma documental real exigiría
  callback de éxito en ProcessDocxButton — la decisión consta ahora bajo identidad del decisor,
  que era el defecto jurídico central.
- **Verificación:** 2048 tests 0 fail; gates verdes; e2e 18+25 6/6.

### Iteración 26 — ITEM-047 [P1] Oposición al procedimiento escrito del consejo (art. 248.2) (HECHO)

- **Evidencia:** el motor modelaba OBJECION_PROCEDIMIENTO pero (1) la UI solo ofrecía
  FOR/AGAINST/ABSTAIN; (2) la RPC la contaba como un voto en contra más — en el camino mayoritario
  (default del stepper) el acuerdo podía APROBARSE con oposición al procedimiento, contra el art.
  248.2 LSC ("siempre que ningún consejero se oponga a este procedimiento").
- **Fix:** migración 20260611214000 — rama prioritaria en fn_no_session_cast_response: UNA
  oposición en CIRCULACION_CONSEJO cierra RECHAZADO/CERRADO_FAIL con motivo 'procedure_objected'
  (cuerpo restante idéntico al vigente; verificado parche desplegado). Cliente: VoteChoice +=
  OBJECT_PROCEDURE, mapeo a OBJECION_PROCEDIMIENTO en el cast, y botón "Oponerme al procedimiento
  (art. 248.2 LSC)" visible solo en procesos de consejo (no en unanimidad SL).
- **Verificación:** gates verdes (2048 tests 0 fail); prosrc desplegado contiene la rama; e2e
  07+18 verdes.

### Iteración 27 — ITEM-015 [P1] fn_generar_certificacion vs art. 109 RRM (HECHO)

- **Evidencia (BOE literal 109 RRM):** la RPC exigía el Vº Bº solo si legal_form='SA' (109.1.a lo
  exige SIEMPRE para certificaciones del secretario de órgano colegiado, sin distinción de tipo
  social — y la grafía 'SAU' ni siquiera matcheaba), aceptaba cualquier uuid como Vº Bº sin
  validar cargo, certificaba actas sin firmar (contra 109.4) y resolvía la autoridad del
  certificante a nivel entidad ignorando el órgano del acta.
- **Fix:** migración 20260611215500 — (1) gate 109.4: acta sin signed_at no es certificable (con
  mensaje accionable hacia "Aprobar y firmar acta" de ITEM-003); (2) Vº Bº exigido siempre que
  certifica SECRETARIO/VICESECRETARIO; (3) el Vº Bº debe ostentar PRESIDENTE/VICEPRESIDENTE
  VIGENTE en la entidad con preferencia por el órgano del acta; (4) autoridad del certificante
  resuelta con preferencia por body (determinista tras ITEM-029).
- **Verificación:** probes RPC 5/5; gates verdes (2048 tests 0 fail); e2e 05+18 6/6 (el golden
  path firma el acta antes de certificar, por lo que el gate server-side no lo afecta).

### Iteración 28 — ITEM-050 [P1] CO_APROBACION/SOLIDARIO: validación circular de administradores (HECHO, doble verificación adversarial)

- **Evidencia (el P1):** ambos asistentes pasaban al motor `adminVigentes = firmas.map(f=>f.adminId)`
  (CoAprob) y `[adminId]` (Solidario) — la lista de "vigentes" ERA la de firmantes tecleados a mano
  con ids sintéticos (`admin-${Date.now()}`). El filtro `firmasValidas` del motor era una tautología:
  cualquier conjunto de nombres inventados producía "Co-aprobación válida" y un agreement ADOPTED.
  Sin tipoSocial ni reglas de mancomunidad (k admitía 1).
- **Verificación normativa (BOE, API datos abiertos):** art. 210.2 LSC transcrito — específico de la
  SA: «cuando la administración conjunta se confíe a dos administradores… y, cuando se confíe a más
  de dos administradores, constituirán consejo de administración». Art. 233.2.c LSC — SL con >2
  conjuntos: representación «mancomunadamente al menos por dos». Ambas citas del motor verificadas.
- **Fix (núcleo):** selector de administradores REALES del censo en ambos steppers. Resolución por
  ENTIDAD vía `useAdministradores` (no `useBodyMandates`): los administradores no colegiados
  (solidarios/mancomunados/único/PJ) tienen `body_id NULL` por CHECK `chk_condicion_body_coherente`.
  `adminVigentes` = person_ids reales; `n` derivado del censo (readonly); `tipoSocial` real
  (`deriveTipoSocial`, helper compartido extraído — 3º uso con DecisionUnipersonalStepper). Motor:
  guards `k>=2` (art. 233.2.c) y SA `n>2` BLOCKING (art. 210.2).
- **Auto-segunda-opinión (atrapó bug pre-ejecución):** el primer cableado con `useBodyMandates(bodyId)`
  habría devuelto 0 filas (body_id NULL). Corregido a resolución por entidad antes de correr e2e.
- **Codex adversarial ronda 1 (9 hallazgos):** confirmó P1 cerrado. Actuados: #1/#2 (censo incluía
  consejeros → cambiado a `useAdministradores` no colegiado; verificado en Cloud que ARGA tiene 0 no
  colegiados → bloquea correctamente, es administrada por consejo), #5 (motor sin `n>=k` → guard
  `k>n` BLOCKING + test CO-09), #9 (spec 42 reforzado: afirma ADOPTED + firmas = person_ids reales +
  n derivado + tipoSocial). Documentados: #4/#6/#7/#8.
- **Codex adversarial ronda 2 (verdict needs-attention, 2 [high]) — sobre el código ya remediado:**
  - **#B (HECHO, fail-closed):** `tipoSocial` opcional dejaba fail-open el guard SA fuera del stepper.
    Caller real confirmado: `buildCoAprobacionConfigFromExecution` (useAgreementCompliance) reconstruía
    el config SIN tipoSocial → re-evaluación de expedientes eludía art. 210.2. Fix: `tipoSocial`
    REQUERIDO en el tipo (typecheck fuerza a todos los constructores); el builder lo recupera del
    config persistido o lo deriva de `entities.legal_form`; el guard SA se ata al censo REAL
    (`Math.max(config.n, adminVigentes.length)`) para que subdeclarar `n` no lo eluda. Tests CO-09/CO-10.
  - **#A (DOCUMENTADO, requiere decisión de producto):** `useAdministradores` devuelve todas las clases
    no colegiadas (ÚNICO/SOLIDARIO/MANCOMUNADO/PJ); Codex pide filtrar por modo (SOLIDARIO solo
    solidarios, CO_APROBACION solo mancomunados) y resolver el representante de ADMIN_PJ. **No
    implementado**: (1) la taxonomía existente del producto agrupa intencionadamente solidarios bajo
    co-aprobación (`matter-registry.ts`/`organo-canonico.ts`: `ADMIN_CONJUNTA_O_COAPROBADORES =
    [ADMIN_CONJUNTA, ADMIN_SOLIDARIOS, CO_APROBADORES]`), así que el filtro estricto contradice una
    decisión de diseño vigente; (2) en entidades bien formadas `useAdministradores` ya devuelve un
    único régimen (el de `forma_administracion`), por lo que el cruce de clases solo es explotable en
    censos malformados (multi-régimen). Recomendación anotada: filtrar por `forma_administracion` de
    la entidad y resolver representante de ADMIN_PJ cuando se aborde el modelado de elegibilidad por
    modo.
- **Residuales (decisión humana/producto):** #A (elegibilidad por modo + ADMIN_PJ representante);
  acoplamiento body_id seleccionado ↔ régimen del censo (el body_id del agreement puede no coincidir
  con el régimen, pre-existente); vigencia editable del actuante solidario vs `fecha_inicio` real.
- **Verificación:** `bun test` 1907 pass / 0 fail (CO-01..10, tipo-social, compliance); typecheck,
  lint (tocados), build verdes. e2e **spec 30 aislada 13/13** (incluye bloqueo de régimen ARGA para
  co-aprobación y solidario), **spec 42 aislada 4/4** (B6.1/B6.2/B6.3 ADOPTED con person_ids reales,
  n derivado, tipoSocial cableado), golden path 18 verde. Hallazgo operativo: spec 42 (destructivo,
  crea/borra filas Cloud) NO debe correr concurrente con spec 30 — provoca falsos rojos en los tests
  "detalle no-session" de spec 30 por interferencia cross-spec; correr aislado (gate
  `SECRETARIA_E2E_PHASE_B1=1`).

## Campaña ultracode — completar el backlog (2026-06-11, en curso)

Objetivo del usuario: "completa y termina todo el backlog" en modo ultracode + verificación adversarial.

### Reconciliación inicial (bookkeeping)

El backlog detalle estaba MUY desactualizado: marcaba PENDIENTE/BLOQUEADO ítems que el loop
(iter.1-28) ya había cerrado pero sin volcar el estado. Reconciliado contra el loop-log:
- **25 PENDIENTE → HECHO** (commit `c48594a`/reconcile): 004,005,006,009,016,018,021,022,024,026,032,
  034,035,036,038,039,040,042,043,044,046,047,049,051,052 + ITEM-020 (= ITEM-050).
- **11 BLOQUEADO/HUMANA → HECHO** (re-triados a corrección factual BOE por el loop): 007,008,010,011,
  012,013,015,017,033,041,053. ITEM-045 permanece BLOQUEADO-HUMANO (re-anclaje WORM real).

### Triaje paralelo verificado (workflow `wi9cty562`)

18 agentes, ~1M tokens, 633 tool-uses, 105 ítems no-cerrados triados contra el CÓDIGO ACTUAL +
verificación adversarial de cada ALREADY_FIXED. Resultado: las 28 iteraciones se centraron en
P1/motor, así que la mayoría de P2/P3 (UI/copy/nav/doc/migración) **siguen siendo gap real**.
- **92 accionables**: STILL_REAL 80 + PARTIAL 10 + STILL_REAL_AFTER_REFUTE 2 (058 y 092 reclamados
  "ya arreglado" pero refutados por el escéptico). NEEDS_HUMAN 10, NOT_APPLICABLE 1.
- Desglose: UI_STEPPER 39, MOTOR 18 (muchos legales/BOE), DOC 10, HOOK 7, OTHER 6, SEED_DATA 5
  (Cloud), TYPING 3, TEST 3, MIGRATION 1. Effort: 37 S / 45 M / 10 L. Risk: 31 low / 40 med / 21 high.
- Salida completa de veredictos por ítem (fixSpec+evidence) en el output del workflow; copia de
  accionables en `/tmp/actionable.json` durante la sesión.

### Olas ejecutadas

- **Ola 1 (commit `7414a5f`) — DOC+copy, 10 ítems:** ITEM-055 (cita LMV derogada → Ley 6/2023/MAR),
  072 ("el Registro Mercantil"), 118 (INDEX.md BORDE_COTIZADA), 121/131/136 (CLAUDE.md P0 = lista
  vacía 2026-05-14), 122 (tabla rutas: −ExpedienteSinSesionStepper +4 reales), 131 (taxonomía
  sidebar real), 140 (gestor visibleTabs+toast), 148 (auth role useCurrentUserRole), 058 (no-op).
  Verificación: cada afirmación del triaje confirmada en el código antes de editar CLAUDE.md.
- **Ola 2 (commit `c4af8ff`) — estados UI, 2 ítems:** ITEM-096 (EMITIDA en ConvocatoriasList),
  147 (REJECTED_REGISTRY en TIMELINE_LABEL de ExpedienteAcuerdo).

### Roadmap del remanente (~80 accionables + 10 NEEDS_HUMAN)

Estrategia: olas por subsistema (evitar conflictos en archivos compartidos; commits y Cloud en
serie), cada ola implementar→gates→adversarial→commit. Pendientes:
- **MOTOR (18, alto valor/riesgo, BOE):** ITEM-019 (P1, capital_total cae a cabezas en juntas sin
  datos de capital — meeting-adoption-snapshot.ts:281 + caller ReunionStepper), 014, 056, 057, 063,
  064, 079, 090, 093, 108, 112, 113, 114, 123, 133, 141, 142, 145. Requieren verificación normativa
  individual contra BOE + adversarial Codex.
- **UI_STEPPER restantes (~37):** copy/nav/translations/error-handling. Mayoría S/M, bajo riesgo.
- **HOOK (7), TYPING (3), TEST (3), OTHER (6).**
- **SEED_DATA (5) + MIGRATION (1):** Cloud — serie, con `db:check-target` previo.
- **NEEDS_HUMAN (10):** 027 (payloads postacuerdo legal), 030 (composición CdA modelado), 031
  (transmisión SL gates), 078 (sidebar dup), 092 (capital-validation refutado) y otros — documentar
  con recomendación; no auto-completables sin decisión de producto/legal.

- **Ola MOTOR (commit `007156b`) — ITEM-019 (P1):** junta sin datos de capital → WARNING
  persistido `census_not_available` (flag `capitalDataAvailable` en el snapshot + caller), en vez
  de degradar en silencio las mayorías de capital (arts. 198-201 LSC) al peso presente. 3 tests;
  e2e 05+18 6/6. Residual: resolver capital real desde `entity_capital_profile`.
- **Ola UI (commit `466c9d5`) — ITEM-070/098:** claves de estado inglesas (SIGNED/APPROVED/...) en
  status-labels; conteo de destinatarios con `Math.max(...,0)`.
- **Grupo NEEDS_HUMAN (commit `448e385`) — 10 ítems documentados:** decisión+recomendación por ítem
  en `docs/superpowers/reviews/2026-06-11-decisiones-pendientes-secretaria.md` (027/030/031/048/054/
  082/091/095/106/151). 4 re-triables a corrección factual tras validación legal (048/151/106/027).

### Estado de los 4 grupos (todos en marcha)

| Grupo | Hechos | Remanente | Notas |
|---|---|---|---|
| MOTOR | 050, 019 (+ DOC 055/118) | ~16 (014,056,057,063,064,079,090,093,108,112,113,114,123,133,141,142,145) | legales/BOE+Codex por ítem |
| UI/HOOK/TYPING/TEST/OTHER | 096,147,070,098,100,139,143,150,083,086,135 | ~42 | safe pool casi agotada; resto e2e-coupled/state-vars |
| Cloud (SEED/MIGRATION) | — | 6 (071,073,081,085,134,149) + 091/048 | serie con `db:check-target` |
| NEEDS_HUMAN | 10 documentados | 0 (esperan decisión) | doc de decisiones creado |

**Todos los P1 cerrados.**

### Olas UI/typing ejecutadas (commits b53eedf, e06cd39, 6830268, 5c85876)

- **ITEM-100:** `isOperationalSecretariaBody` excluye órganos QA phase-b.
- **ITEM-139/143:** `aprobada_por`/`accepted_by` = email del usuario real (`useCurrentUser`).
- **ITEM-150:** eliminado `useNoSessionExpediente.ts` (480 líneas, 0 consumidores).
- **ITEM-083:** gate-pre-semantic acepta `lista_actos_ratificados`.
- **ITEM-086:** `countOrphanTemplates` excluye ARCHIVADA.
- **ITEM-135:** tipo `plazoInscripcion` ensanchado a `number | {dias,...}`; destapó y corrigió
  un render latente en TramitadorStepper (`[object Object]`).

### Nota de cadencia (importante para reanudar)

La reserva de quick-wins genuinamente seguros está casi agotada. El remanente exige trabajo
cuidadoso por ítem, NO batcheable a ciegas, por estos acoplamientos detectados:
- **e2e-coupled:** p.ej. ITEM-074 (copy 'resolución'→'acuerdo') rompería el selector del botón
  en specs 18/40/49/51 — cualquier cambio de copy de botones debe actualizar sus specs.
- **state-vars/hooks:** ITEM-062/069/076/077 necesitan ids/linkedAgreement no triviales.
- **MOTOR legal:** 014/056/057/... exigen verificación BOE + Codex por ítem (como 050/019).
- **Cloud:** SEED/MIGRATION en serie con `db:check-target` y verificación post-migración.
- **NEEDS_HUMAN:** documentados; esperan decisión de producto/legal.

Próximo al reanudar: Ola MOTOR ítem a ítem (BOE+Codex), luego Ola Cloud (guardrail
`db:check-target`), luego UI e2e-coupled actualizando specs en el mismo commit.
