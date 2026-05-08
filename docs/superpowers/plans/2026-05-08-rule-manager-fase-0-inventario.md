# Rule Manager Acuerdo360 — Fase 0 inventario

Fecha: 2026-05-08
Worktree: `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map`, rama `main`
Plan referencia: `docs/superpowers/plans/2026-05-06-secretaria-gestor-reglas-acuerdo360-plan.md` (Fase 0).
Modo: lectura. Cierra el entregable explícito de la Fase 0 que estaba pendiente.

## Objetivo

Confirmar qué fuentes existen ya en código y en Cloud antes de cualquier diseño. La Fase 0 del plan original pedía:

> Nota corta de inventario con "usable ahora", "placeholder" y "requiere schema futuro".

## Tablas y módulos

### Usable ahora

| Fuente | Tipo | Forma | Notas |
|---|---|---|---|
| `rule_packs` + `rule_pack_versions` | Tabla Cloud | columns: `id`, `tenant_id`, `codigo`, `materia`, `materia_clase`, `organo_tipo`, `nombre`, `descripcion`. Las versiones tienen `version_number`, `is_active` | Motor LSC. Cargado por `useReglasAplicables`. Threshold real vive en el payload de la versión activa, **pero el hook actual no lo expone**. Pendiente bridge en Fase 2. |
| `jurisdiction_rule_sets` | Tabla Cloud | columns: `id`, `tenant_id`, `jurisdiction`, `company_form`, `rule_set_version`, `legal_reference`, `is_active` | Régimen legal por jurisdicción + tipo social. Cargado por `useReglasAplicables`. |
| `pactos_parasociales` + `pacto_clausulas` + `pacto_evaluacion_results` | Tabla Cloud | Pactos vigentes con `materias_aplicables[]`, `umbral_activacion`, `titular_veto`, `firmantes[]` | Cargado por `usePactosVigentes`. Seed `PACTO_FUNDACION_ARGA_2024` confirmado en CLAUDE.md. **TODO en Fase 2**: probe Cloud para confirmar fila `VIGENTE` antes de inferir consequences. |
| `agreements.compliance_explain` / `compliance_snapshot` | Columnas JSONB | Almacena `societary_validity`, `pacto_compliance`, `normative_snapshot` | Materializado por `agreement-360.ts` en cada acuerdo adoptado. Es **fuente de verdad post-adopción**; el contrato puro nuevo cubre **simulación pre-adopción**. |
| `src/lib/secretaria/normative-framework.ts` | Módulo | `buildEntityNormativeProfile`, `buildAgreementNormativeSnapshot`, `summarizeFormalizationForAgreement`, tipos `NormativeLayer`/`NormativePlane`/`NormativeSource` | Capa lógica reusada por el contrato puro nuevo sin duplicar tipos. |
| `src/lib/secretaria/agreement-360.ts` | Módulo | `buildMeetingAgreementPayload`, `compactAgreementNormativeSnapshot` | Materialización de acuerdos con compliance_explain. No se modifica desde Bloque 1. |
| `src/lib/rules-engine/pactos-engine.ts` | Módulo | `evaluarPactosParasociales`, evaluadores de VETO / MAYORIA_REFORZADA_PACTADA / CONSENTIMIENTO_INVERSOR / TAG_ALONG / DRAG_ALONG / SINDICACION_VOTO | Reusado por el contrato puro. **Limitación detectada**: los `PactoEvalResult` no exponen `titulares` estructurado; el contrato puro hace el join contra `PactoParasocial` original para extraer `titular_veto` o `firmantes` sin parsing de strings. |
| `src/hooks/useReglasAplicables.ts` | Hook | Devuelve `ReglasPack[]` desde rule_packs + jurisdiction_rule_sets + pactos | Será reemplazado/complementado por `useRuleManager` en Fase 2 (Bloque 2). |
| `src/pages/secretaria/ReglasAplicables.tsx` | Página | Lista cruda de reglas aplicables por sociedad | Quedará compatible con `/secretaria/reglas` que añadiremos en Fase 3 (Bloque 2). |

### Placeholder (existe en hook como stub, no en BD)

| Fuente | Estado | Acción Fase 1 |
|---|---|---|
| ESTATUTOS estructurados | `useReglasAplicables` lo marca como stub. Algunos overrides en `rule_param_overrides.fuente='ESTATUTOS'` pueden funcionar como sustituto parcial. | El contrato puro reporta `WARNING` en `sources` cuando no hay overrides estatutarios y respeta los overrides cuando los hay. La capacidad de "elevar a `VALIDITY_BLOCK`" se controla por `options.statutoryEnshrinedPactoIds` (caller decide). |
| REGLAMENTO de órgano | `useReglasAplicables` lo marca como stub. | El contrato puro lo reporta como `WARNING` en `sources` (placeholder) pero no genera consequences automáticas. |

### Requiere schema futuro (fuera de Bloque 1-3)

| Schema futuro | Motivación | Bloqueo en MVP read-only |
|---|---|---|
| Tabla `statutes` versionada con cláusulas estructuradas | Necesario para tipificar overrides estatutarios como `VALIDITY_BLOCK` automático sin pasar por `options.statutoryEnshrinedPactoIds` | No bloquea Bloque 1-3 (la opción manual en input es suficiente). |
| Tabla `regulations` (reglamento órgano) versionada | Permitiría reflejar reglas de funcionamiento del CdA / comisiones | No bloquea Bloque 1-3 (placeholder en sources). |
| `rule_pack_versions.payload` lectura por threshold | El motor LSC ya tiene el threshold; falta exponerlo al UI | No bloquea Bloque 1: contrato acepta `legal_majority.threshold` como input opcional desde el caller; el caller lo cargará en Fase 2 desde el rule pack activo. |

## Verificación de pactos en Cloud (pendiente Fase 2)

El plan original pedía probe directo. **No se ejecutó probe en este Bloque 1 deliberadamente**, porque el contrato puro no toca Cloud y los tests cubren el camino con datos sintéticos.

Para Fase 2 (hook), añadir probe:

```bash
# Ejemplo conceptual del probe que el hook hará al montar
SELECT id, tipo_clausula, estado, materias_aplicables, titular_veto, firmantes
  FROM pactos_parasociales
 WHERE tenant_id = '00000000-...-001'
   AND entity_id = '6d7ed736-f263-4531-a59d-c6ca0cd41602'
   AND estado = 'VIGENTE';
```

Si el resultado está vacío, el hook devolverá `consequences = [WARNING-cotizada solamente]` y la UI mostrará "no hay pactos aplicables vigentes a esta sociedad".

## Decisiones de diseño consolidadas en Bloque 1

1. **Reusar la taxonomía existente** (`NormativeLayer` / `NormativePlane` / `NormativeSource`) en lugar de crear `RulePlane` paralelo.
2. **Añadir `LegalConsequence`** (5 valores) para que la UI separe los planos societario/contractual/operativo.
3. **`classifyPactoConsequence`** hace explícita la distinción estatutos vs pacto.
4. **`legal_majority` opcional** en el input para que el caller (Fase 2) inyecte threshold real del rule pack activo cuando lo conoce; el contrato puro **no consulta Cloud**.
5. **`maxPactoMajorityThreshold`** eleva el threshold efectivo cuando un pacto pacta una mayoría superior a la legal y marca `effective_source: "PACTO"` para que la UI lo muestre.
6. **Titulares estructurados** desde `PactoParasocial.titular_veto` / `firmantes[]` — sin parsing de strings ni regex frágil.
7. **Adoption modes cubiertos**: `MEETING`, `UNIVERSAL`, `NO_SESSION`, `CO_APROBACION`, `SOLIDARIO`, `UNIPERSONAL_SOCIO`, `UNIPERSONAL_ADMIN` con notas humanas distintas para cada uno.

## Tests cubiertos (26)

11 casos del plan original + 10 casos adversariales adicionales + 5 unitarios del classifier:

- CASO 1-11: ley sin override, override estatutario, sin override (warning), veto sin waiver, veto renunciado, veto estatutarizado, materia no afectada, mayoría reforzada incumplida, consent inversor, snapshot trazable, NO_SESSION unanimity.
- CASO 12-21 (adversariales): SL no cotizada (sin warning LMV), entidad sin jurisdicción (blocker en profile), multi-pacto, CO_APROBACION, SOLIDARIO, legal_majority custom, pacto eleva threshold sobre legal, titulares con titular_veto, titulares con firmantes fallback, titular del consentimiento.

## Lo que sigue (Bloque 2)

1. `src/hooks/useRuleManager.ts` — hook que carga inputs desde Supabase y construye `EffectiveAgreementRule` para `(entityId, bodyId?, matter, adoptionMode)`.
2. `useRuleManagerProfile(entityId)` — perfil normativo de una sociedad.
3. `useAgreementRulePreview(input)` — simulador de regla efectiva.
4. `useAgreementRuleSnapshot(agreementId)` — lectura del snapshot ya almacenado en `compliance_explain`.
5. Página `/secretaria/reglas` con catálogo + simulador + pactos + snapshots.

Sin migraciones, sin escrituras, sin proveedores QTSP distintos de EAD Trust.

## Verificación Bloque 1 post-fixes adversariales

```md
- bunx tsc --noEmit --pretty false: pass
- bun run lint: pass (0 errors)
- bun run test rule-manager-contract: 26/26 pass
- bun test full suite: pendiente al cerrar este turno
- bun run build: pendiente al cerrar este turno
- No secrets stored: yes
- No Cloud writes: yes (solo lectura en Bloque 2 cuando llegue)
```
