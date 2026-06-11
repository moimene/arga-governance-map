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
