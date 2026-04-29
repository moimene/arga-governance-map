# 2026-04-27 — PRD Addendum: Modo Demo Operable

## Propósito

Este documento añade una capa explícita **Demo-Operable** a la PRD de evolución de TGMS/ARGA. Su objetivo es permitir comercializar y demostrar el producto mientras el prototipo canónico sigue cerrando paridad Supabase, WORM, QES productivo y cadena probatoria completa.

La decisión de producto es:

> **Demo ≠ fake. Demo = simulación controlada con evidencia trazable.**

La demo comercial debe ser perfecta, determinista y legalmente coherente, pero no debe contaminar la arquitectura productiva ni esconder que ciertas evidencias son sandbox.

## Contexto arquitectónico

El sistema se mantiene como **productos separados, plataforma compartida**:

| Contexto | Responsabilidad |
|---|---|
| TGMS Shell / Consola ARGA | Orquestación, presentación, scope, búsqueda, bandeja, guion demo y handoffs |
| Secretaría Societaria | Fuente formal de convocatorias, sesiones, acuerdos, actas, certificaciones y libros |
| GRC Compass | Ledger de obligaciones, riesgos, controles, evidencias, hallazgos, remediación y reporting |
| AIMS 360 | Sistemas IA, AI Act, ISO 42001, expediente técnico, post-market y controles IA |
| Plataforma compartida | Identidad, RBAC base, `governance_module_links`, `governance_module_events`, `evidence_bundles`, `audit_log`, legal hold y retención |

El modo Demo-Operable no crea un quinto dominio. Es una capa de ejecución, dataset, narrativa y simulación segura para venta y validación.

## Problema

La PRD actual define sistema, reglas y evidencia, pero no define cómo demostrar un flujo completo en un entorno incompleto. Eso deja el producto en una zona híbrida peligrosa:

- una demo puede romper por datos incompletos;
- un prototipo puede bloquearse por integraciones aún no productivas;
- el equipo puede introducir hacks demo dentro de lógica productiva;
- el usuario comercial puede perder confianza si aparecen fricciones técnicas visibles.

La capa Demo-Operable resuelve esto separando explícitamente:

- **demo determinista**: dataset ARGA cerrado, snapshots predecibles, resultados repetibles;
- **demo simulada**: QES/TSQ sandbox, evidencias marcadas como simuladas;
- **demo híbrida**: datos reales disponibles con fallback demo controlado.

## Principios no negociables

1. **Separación demo vs producción.** Ningún flujo `demo_mode=true` puede disparar filing registral real ni firma QTSP productiva.
2. **Integridad siempre activa.** La demo puede simular dependencias externas, pero no saltarse reglas, snapshots, hashes, trazas ni ownership.
3. **Evidencia sandbox explícita.** Todo bundle simulado debe indicar `sandbox=true` o equivalente visible en UI y payload.
4. **Owner-first.** La consola ejecuta escenarios y muestra narrativa; Secretaría, GRC y AIMS mantienen sus fuentes de verdad.
5. **Determinismo comercial.** Los escenarios demo deben correr igual en cada presentación.
6. **No schema destructivo.** Cualquier columna nueva requiere migración local, paridad Cloud y tipos regenerados antes de runtime.
7. **No datos reales sensibles.** El Demo Pack ARGA solo usa datos ficticios coherentes con ARGA.

## Sección 19 — Modo Demo Operable

### 19.1 Objetivo

Permitir demostrar el vertical completo:

```text
Convocatoria -> Sesión -> Gate -> Acta -> Certificación -> Evidencia
```

sin depender de:

- datos reales completos;
- paridad Supabase total;
- integraciones QTSP productivas;
- disponibilidad de terceros.

La demo debe preservar:

- coherencia legal;
- narrativa ejecutiva;
- trazabilidad de fuentes;
- confianza comercial;
- frontera estricta con producción.

### 19.2 Demo Mode Flag

Modelo propuesto, sujeto a validación Cloud/local/types:

```sql
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS demo_mode boolean DEFAULT false;
ALTER TABLE convocatorias ADD COLUMN IF NOT EXISTS demo_mode boolean DEFAULT false;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS demo_mode boolean DEFAULT false;
ALTER TABLE agreements ADD COLUMN IF NOT EXISTS demo_mode boolean DEFAULT false;
```

Regla funcional:

```pseudo
IF demo_mode = true THEN
  allow_simulation = true
  enforce_integrity = true
  enforce_external_dependencies = false
  prevent_registry_filing = true
  prevent_real_QTSP = true
END
```

El flag habilita simulación controlada, no bypass de reglas. Los motores de Secretaría, GRC y AIMS deben seguir evaluando inputs canónicos.

### 19.3 Evidencia sandbox verificable

Modelo propuesto para evidencia sandbox, sujeto a validación Cloud/local/types:

```sql
ALTER TABLE evidence_bundles
  ADD COLUMN IF NOT EXISTS sandbox boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS simulation_meta jsonb,
  ADD COLUMN IF NOT EXISTS audit_log_id uuid REFERENCES audit_log(id);
```

Requisitos mínimos:

- `sandbox=true` visible en UI;
- hash de payload demo;
- `simulation_meta.scenario`;
- `simulation_meta.signature_level = "QES_SANDBOX"` cuando aplique;
- relación con `audit_log` como ledger compartido local; no introducir `audit_worm_trail` paralelo sin rediseñar el contrato de evidencia;
- no reclamar evidencia productiva si falta bundle/hash/audit.
- insertar `sandbox`, `simulation_meta` y la referencia de auditoría al crear el bundle, porque `evidence_bundles` es WORM y no debe parchearse después.

### 19.4 Endpoints / contratos API

Los endpoints se documentan como contrato de producto. La implementación puede ser RPC Supabase, Edge Function o API backend, pero debe conservar los payloads.

#### Gate preview determinista

```http
GET /api/v1/acuerdos/{id}/gate-preview
```

```json
{
  "preview": true,
  "estado": "OK",
  "detalles": {
    "quorum_ok": true,
    "mayoria_global_ok": true,
    "clases_ok": true,
    "doble_umbral_ok": true,
    "consents_ok": true,
    "veto_ok": true
  },
  "source": {
    "snapshot_id": "uuid",
    "ruleset_hash": "sha256"
  }
}
```

#### Trust simulado

```http
POST /api/v1/trust/simulate-signature
```

```json
{
  "simulated": true,
  "signature_level": "QES_SANDBOX",
  "ocsp": "ok",
  "authority": "valid",
  "tsq": "mock_tsq_token",
  "integrity": "VALID",
  "evidence_bundle_stub": true
}
```

#### Demo scenario runner

```http
POST /api/v1/demo/run-scenario
```

Input:

```json
{
  "scenario": "JUNTA_UNIVERSAL_OK"
}
```

Output:

```json
{
  "convocatoria_id": "uuid",
  "meeting_id": "uuid",
  "agreement_id": "uuid",
  "snapshot_id": "uuid",
  "agreement_result": "ADOPTADO",
  "evidence_bundle_id": "uuid",
  "sandbox": true,
  "narrative": "Explicación legal paso a paso",
  "explain": [
    "Quórum 100% >= 100% para junta universal",
    "Mayoría 70% >= 66%",
    "Sin vetos activos"
  ]
}
```

#### Explainability API

```http
GET /api/v1/acuerdos/{id}/explain
```

```json
{
  "why_adopted": [
    "Quórum 75% >= 50%",
    "Mayoría 70% >= 66%",
    "Clase A aprobó",
    "Sin vetos"
  ],
  "legal_basis": [
    "LSC art. 193",
    "Estatutos art. 12"
  ],
  "ruleset_hash": "sha256",
  "snapshot_hash": "sha256",
  "evidence_posture": "sandbox"
}
```

### 19.5 Runner demo

Algoritmo esperado:

```pseudo
function runScenario(scenario):
  assert tenant.demo_mode == true
  load ARGA_DEMO_PACK
  create convocatoria(demo_mode=true)
  create deterministic snapshot
  simulate votes from scenario fixture
  result = evaluate agreement using snapshot only
  generate minute
  generate certification
  simulate QES + TSQ
  create evidence_bundle(sandbox=true)
  write audit demo event
  return ids + result + explain + narrative
```

Guardrails:

- no llamadas reales a EAD Trust en `demo_mode=true`;
- no filing registral;
- no cambios destructivos;
- no writes en dominios no owner;
- idempotencia por `scenario_run_id` cuando se implemente persistencia.

### 19.6 ARGA Demo Pack canónico

El Demo Pack debe persistirse como dataset controlado, no como datos improvisados en UI.

Sociedades mínimas:

| Sociedad | Tipo | Caso demo |
|---|---|---|
| ARGA Seguros S.A. | SA cotizada demo con CdA | Consejo, junta, veto, doble umbral, conflicto |
| ARGA Mediación S.L. | SL con administrador único | Decisiones unipersonales / admin único |
| Cartera ARGA S.L.U. | SLU | Socio único, cascada de control |

Escenarios mínimos:

| Scenario ID | Resultado esperado | Narrativa |
|---|---|---|
| `JUNTA_UNIVERSAL_OK` | `ADOPTADO` | 100% capital presente, unanimidad de celebrar, mayorías superadas |
| `JUNTA_UNIVERSAL_FAIL_99` | `BLOQUEADO` | Falta 100% de capital para universal |
| `VETO_BLOCK` | `BLOQUEADO` | Fundación ARGA ejerce veto pactado en operación estructural |
| `DOBLE_UMBRAL_FAIL` | `BLOQUEADO` | Mayoría global OK, clase o umbral reforzado falla |
| `CONFLICTO_EXCLUSION_OK` | `ADOPTADO` | Excluye voto conflictuado y recalcula denominador |

Casos comerciales a preparar:

- Junta Universal;
- veto pactado;
- conflicto de interés;
- doble umbral;
- operación vinculada;
- certificación sandbox con evidencia trazable.

### 19.7 UX demo

Elementos obligatorios:

| Componente | Comportamiento |
|---|---|
| Banner global | `[DEMO MODE] — Evidencias simuladas. Resultado jurídicamente coherente.` |
| Modo presentación | Stepper auto-avanzable con pausa/reanudar |
| Explain panel | Reglas aplicadas, bases legales y umbrales |
| Evidence panel | Bundle, hash, sandbox, audit reference |
| Scenario picker | Lista de escenarios con duración estimada y resultado esperado |
| Presenter notes | Guion comercial visible solo para operador demo |

Estados del Demo Stepper:

- `PREPARED`;
- `AUTO_RUNNING`;
- `PAUSED`;
- `RESULT`;
- `FAILED_SAFE`.

Pasos del vertical:

1. Órgano / sociedad.
2. Censo / snapshot.
3. Votación / gate.
4. Resultado.
5. Acta.
6. Certificación.
7. Evidencia sandbox.
8. Narrativa final.

### 19.8 Separación demo vs producción

Restricciones obligatorias:

```pseudo
IF record.demo_mode = true THEN
  prevent_registry_filing = true
  prevent_real_QTSP = true
  mark_evidence_sandbox = true
  require_explainability = true
END

IF record.demo_mode = false THEN
  reject_sandbox_signature = true
  reject_sandbox_evidence_as_final = true
END
```

La UI nunca debe ocultar el estado sandbox. La palabra “verificable” solo puede usarse para evidencia productiva si hay bundle, hash, storage y audit trail completo. Para demo, usar “sandbox verificable” o “simulación trazable”.

### 19.9 Métricas de éxito demo

| Métrica | Objetivo |
|---|---:|
| Demo completa sin errores visibles | 100% |
| Tiempo de demo completa | < 10 min |
| Tiempo de reset de escenario | < 60 s |
| Comprensión legal percibida | > 90% |
| Explicabilidad percibida | Alta |
| Fricción técnica visible | 0 |
| Escenarios P0 ejecutables | 5/5 |

## Backlog ejecutable

| Prioridad | Tarea | Owner | Entregable | Migración |
|---|---|---|---|---|
| P0 | Demo Mode Flag | Core / Secretaría | flags demo en tenants y objetos del vertical | Sí, no destructiva |
| P0 | Runner `run-scenario` | Secretaría + Shell | 5 escenarios deterministas | Puede requerir Edge/RPC |
| P0 | Trust sandbox | Trust / Documental | QES/TSQ simulado con payload estructural | No necesariamente |
| P0 | Evidence sandbox | Evidence spine | `evidence_bundles.sandbox` + metadata | Sí, no destructiva |
| P0 | Explain API | Motor LSC | why/legal basis/ruleset/snapshot hash | Puede ser read-only |
| P0 | Demo Stepper | Shell + Secretaría | modo presentación auto-avanzable | No |
| P1 | Dataset ARGA Demo Pack | Data / Secretaría | SA, SL, SLU + escenarios | Seed/migración controlada |
| P1 | Demo reset/idempotencia | Core | reset seguro por tenant/scenario | Pendiente diseño |
| P1 | E2E demo scripts | QA | Playwright vertical completo | No |
| P2 | Presenter notes | Shell | guion comercial integrado | No |

## Tests mínimos

| Caso | Given | When | Then |
|---|---|---|---|
| Demo universal OK | `JUNTA_UNIVERSAL_OK` | `runScenario` | `agreement_result = ADOPTADO` |
| Demo universal falla | `JUNTA_UNIVERSAL_FAIL_99` | `runScenario` | `agreement_result = BLOQUEADO` |
| Veto bloquea | `VETO_BLOCK` | `runScenario` | `agreement_result = BLOQUEADO` y explain contiene veto |
| Doble umbral falla | `DOBLE_UMBRAL_FAIL` | `runScenario` | explain separa mayoría global y umbral fallido |
| Conflicto recalcula | `CONFLICTO_EXCLUSION_OK` | `runScenario` | resultado adoptado con denominador ajustado |
| No QTSP real | `demo_mode=true` | firma | no hay llamada productiva a EAD Trust |
| Evidence sandbox | escenario completo | emitir certificación | bundle `sandbox=true` visible |
| No filing real | escenario completo | intentar filing | operación bloqueada por demo guard |

## DoD

- Endpoint/contrato `/api/v1/demo/run-scenario` definido e implementado o simulado en una capa controlada.
- 5 escenarios ejecutables sin error visible.
- Gate preview consistente con resultado final.
- Evidence bundle sandbox creado y visible.
- Snapshot hash persistido o simulado con contrato estable.
- No llamadas reales a QTSP en demo.
- No filing registral desde demo.
- UI muestra explain + evidencia + banner demo.
- Tests e2e del vertical comercial pasan.
- La documentación declara source posture: Cloud, local pending, legacy, generated types only o demo.

## Riesgos y mitigación

| Riesgo | Severidad | Mitigación |
|---|---:|---|
| Mezcla demo/real | Crítica | `demo_mode`, guards anti-QTSP real, anti-filing real, banner visible |
| Resultados no deterministas | Alta | snapshot obligatorio, dataset cerrado, fixtures de voto |
| Evidencia poco creíble | Alta | bundle sandbox + hash + audit reference + explain |
| Drift UI / narrativa confusa | Media | Explain panel obligatorio y presenter notes |
| Hacks en producción | Alta | demo services aislados y tests que rechacen sandbox en producción |
| Paridad Supabase incompleta | Alta | no activar runtime hasta Cloud/local/types documentados |

## Relación con la Consola ARGA

La Consola ARGA debe exponer la Demo-Operable como modo comercial, no como dominio nuevo:

- `Scenario picker` en dashboard comercial;
- banner global demo;
- vista de progreso del vertical;
- handoff a Secretaría para detalle legal;
- cards de evidencia sandbox;
- explain panel cross-module;
- métricas de éxito demo.

La consola mantiene su rol: orquestar, componer y enrutar. No evalúa mayorías, no firma, no genera actas y no crea evidencias productivas.
