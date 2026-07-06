# Cierre del residual genuino — Secretaría (2026-07-06)

Cierre de los ítems que el run-log UX 2026-06-20 dejó **diferidos** (`🟡`/`🔴`) por
requerir esquema o señal de dominio. Mandato: *"completemos el residual genuino y
dejemos todo el backlog resuelto"*.

Disciplina aplicada (heredada de T11 y del feedback del usuario): **no se finge
criterio jurídico**. Un aviso legal solo se emite cuando existe una señal de dominio
**real y comparable**; en caso contrario se convierte en falso positivo. Antes de
descartar un ítem se **verifica empíricamente** (introspección de esquema + datos en
Cloud), no se hereda el diferido del run-log anterior.

---

## Resuelto (implementado)

### T11 — Aviso de desfase del marco normativo · `157d5ca`
Señal real: al adoptar se congela el `profile_hash` del perfil normativo. Si el marco
cambia después, el expediente avisa — **pero solo si el hash congelado es CANÓNICO**
(`normativeFingerprint`). Los acuerdos de origen reunión congelan un `payload_hash`
de fallback (`profile_hash_kind = 'PAYLOAD'`), no comparable con el fingerprint vivo;
compararlos daría falsos avisos de desfase.

- `src/lib/secretaria/desfase-normativo.ts` — helper puro (+5 tests)
- `src/lib/secretaria/agreement-360.ts` — `profile_hash_kind` CANONICAL/PAYLOAD en el
  congelado + `normative_profile_hash_kind` en ambos `compliance_snapshot`
- `src/pages/secretaria/ExpedienteAcuerdo.tsx` — banner solo si desfase real
- Aserción empírica en `agreement-360.test.ts` (origen reunión → PAYLOAD)

### UX-7.B — Modelo de cohortes de plantilla + filtro · `8d79720`
Señal real: los metadatos de la ficha (`estado`, binding de materia,
`contrato_variables_version`) ya existen en `plantillas_protegidas`. La cohorte es una
clasificación **pura y determinista** sobre esos campos — no inventa criterio, agrupa
por estado de gobierno documental. Cierra el "modelo de cohortes" que T9/T10 dejaron
pendiente.

Cohortes: `ACTIVA_LISTA` · `ACTIVA_SIN_REGLA` · `ACTIVA_METADATOS_INCOMPLETOS` ·
`EN_PREPARACION` · `HISTORICO` (precedencia coherente con los avisos T10).

- `src/lib/secretaria/template-admin/plantilla-cohorte.ts` — clasificador (+9 tests)
- `src/components/secretaria/CohorteBadge.tsx` — badge reutilizable
- `src/pages/secretaria/Plantillas.tsx` — badge en lista (mobile+desktop) + panel de
  detalle + filtro por cohorte (ambas pestañas)

### entity_id en cola documental · `9566aec` (previo)
Scope opcional por sociedad en `secretaria_document_artifacts` (migración
`20260706161951`). Ya cerrado.

---

## Diferido genuino (verificado empíricamente — NO se finge)

### 🔴 Aviso "censo pendiente" — sin señal real a nivel de expediente
**Verificación (Cloud, 2026-07-06):**
- `agreements` **no tiene columna** `snapshot_id`/`snapshot_hash`/`censo_*` — solo
  `compliance_snapshot` (jsonb) y `compliance_explain` (jsonb).
- Las 40 claves de `compliance_snapshot` (introspección `jsonb_object_keys`) incluyen
  `vote_summary`, `vote_completeness`, `voters`, `normative_snapshot_id`… pero
  **ninguna referencia a un censo congelado** (`censo_snapshot`).

**Conclusión:** el censo se congela en el *pipeline de certificación*
(`certifications.snapshot_id` / `minutes.snapshot_id` → `censo_snapshot` WORM), no en
la adopción del acuerdo. Un aviso "censo pendiente" en el expediente se dispararía en
**todo** acuerdo pre-certificación (DRAFT/PROPOSED/ADOPTED), que legítimamente aún no
tiene censo congelado → ruido, no señal. Es exactamente el falso positivo que la
disciplina T11 prohíbe. Su hogar correcto es una comprobación en la etapa de
certificación (ActaDetalle/certificación), no en `ExpedienteAcuerdo`. **Requiere
decisión de producto sobre la etapa, no es un gap de implementación.**

### 🔴 Aviso "decisión legal pendiente antes de activar bloqueo" — sin estado real
**Verificación (Cloud, 2026-07-06):**
- `rule_param_overrides` **no tiene** columna de status/pending/decision.
- `rule_pack_versions.status` solo toma valores `{ACTIVE (56), RETIRED (19), NULL (1)}`.
  **No existe** un estado `DRAFT`/`PENDING`/`PENDING_LEGAL_DECISION` que modele "regla
  pendiente de validación legal antes de activar bloqueo".

**Conclusión:** no hay un estado de flujo que represente "decisión legal pendiente".
Ponerlo always-on sería ruido; inventar un status = fabricar criterio jurídico. **No
se finge.** Requiere modelar antes un estado real de override/regla pendiente de
validación (decisión de esquema + producto).

---

## Gates
`typecheck` verde · `lint` limpio en lo tocado · tests de dominio verdes
(desfase 5/5, agreement-360 6/6, template-admin 106/0) · testids E2E intactos ·
`db:check-target` OK contra `governance_OS`.

## Anomalía menor observada (no bloqueante, fuera de backlog)
1 de 57 `rule_pack_versions` con `is_active=true` tiene `status=NULL` (debería ser
`ACTIVE`). Es un dato demo inconsistente, no un concepto de "pendiente". No se toca en
este cierre.
