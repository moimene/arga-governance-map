# Gap Analysis — Motor de Reglas LSC

**Fecha:** 2026-04-19
**Estado:** 4 fases técnicas completadas (T1–T25), motor V2 activo
**Pendiente:** items que requieren input del equipo legal o trabajo adicional de integración

---

## 1. Estado actual del motor (resumen ejecutivo)

| Componente | Estado | LOC | Tests |
|---|---|---|---|
| Tipos base (types.ts) | ✅ Completo | 533 | — |
| 16 Rule Packs (seed) | ✅ v1.0.0 insertados | 1,256 | — |
| Jerarquía normativa | ✅ LEY > ESTATUTOS > PACTO > REGLAMENTO | 114 | 15 |
| Motor convocatoria | ✅ SA/SL, antelación, canales, documentos | 384 | 15 |
| Motor constitución | ✅ Quórum 1ª/2ª conv, denominador ajustado | 255 | 14 |
| Motor mayorías | ✅ Fórmulas, reforzada, unanimidad | 199 | 15 |
| Motor votación (6 gates) | ✅ Elegibilidad→Quórum→Mayoría→Unanimidad→Vetos→Voto calidad | 370 | 21 |
| Motor sin sesión (5 gates) | ✅ 3 variantes: unanimidad SL, circulación consejo, socio único | 653 | 23 |
| Motor documentación | ✅ Docs obligatorios + validación acta | ~300 | 15+ |
| Orquestador (3 flujos) | ✅ Path A (colegiado), B (unipersonal), C (sin sesión) | ~350 | 24+ |
| Bordes no computables | ✅ 7 bordes con BLOQUEO | 260 | 15 |
| Plantillas engine (Gate PRE) | ✅ STRICT/FALLBACK/DISABLED | 471 | 15 |
| Evidence bundle ASiC-E | ✅ Manifiesto + empaquetado + verificador offline | 626 | 26 |
| QTSP integración | ✅ Firma QES + notificación certificada + OCSP | ~800 | 33 |
| Trust Center | ✅ verificarIntegridad() + panel UI | ~560 | 17 |
| Contrato de variables | ✅ YAML v1.0.0 generado + CI test | ~1,100 | 11 |
| PlantillasTracker | ✅ 5 leading + 3 lagging + alertas | ~700 | 12 |
| ENGINE_V2 switch | ✅ Activo en todos los puntos | — | — |
| **Total** | **4 fases completas** | **~18,000** | **~250+** |

---

## 2. Pendientes que requieren equipo legal

### 2.1 🔴 Oleada 1 — Contenido jurídico de 7 plantillas go-live

**Estado actual:** 7 plantillas existen como esqueletos técnicos (Oleada 0) con placeholders.
**Necesario:** El equipo legal redacta el contenido jurídico real en las 3 capas definidas.

| # | Plantilla | Tipo | Modos | Estado | Acción legal requerida |
|---|---|---|---|---|---|
| 1 | Acta Junta General | ACTA_JUNTA | MEETING, UNIVERSAL | BORRADOR | Redactar fórmulas de proclamación, advertencias de derechos, cláusulas normativas |
| 2 | Acta Consejo Administración | ACTA_CONSEJO | MEETING | BORRADOR | Redactar cuerpo con formulación cuentas, deliberaciones tipo, exclusiones |
| 3 | Acta consignación socio/admin único | ACTA_CONSIGNACION | UNIPERSONAL_* | BORRADOR | Revisar condicional persona_type, fórmulas art. 15 LSC |
| 4 | Acta acuerdo escrito sin sesión | ACTA_ACUERDO_ESCRITO | NO_SESSION | BORRADOR | Redactar relación de respuestas, fórmula de cierre, estructura expediente |
| 5 | Certificación de acuerdos | CERTIFICACION | Todos | BORRADOR | Redactar fórmula de certificación, referencia a libro de actas, menciones legales |
| 6 | Convocatoria SA | CONVOCATORIA | MEETING | BORRADOR | Redactar texto derecho información (art. 197 LSC), mención BORME/web |
| 7 | Convocatoria SL | CONVOCATORIA | MEETING | (por crear) | Redactar versión SL: notificación individual certificada (art. 173 LSC) |

**Entregable legal por plantilla (3 capas):**

- **Capa 1 (Inmutable):** Encabezamiento legal, ley aplicable, fórmulas de proclamación ("ACUERDO ADOPTADO POR mayoría [simple/reforzada] de..."), advertencias de efectos jurídicos, referencia snapshot. *Esta capa se protege por hash — no puede cambiar sin re-versionear.*
- **Capa 2 (Parametrizada — variables motor):** El motor ya inyecta: `{{snapshot_hash}}`, `{{resultado_gate}}`, sello QES/TSQ. Legal debe indicar *dónde* van estos campos en el texto definitivo.
- **Capa 3 (Editable — variables usuario):** Deliberaciones detalladas, observaciones presidente, ruegos, declaración de conflictos. Legal define qué campos son OBLIGATORIOS vs. opcionales.

### 2.2 🔴 Oleada 2 — Aprobación formal y activación

Una vez entregada la Oleada 1:
1. Comité Legal revisa cada plantilla REVISADA
2. UAT: verificar que Gate PRE acepta, firma QES funciona, variables se renderizan
3. Transicionar REVISADA → APROBADA → ACTIVA
4. Confirmar que las 7 plantillas están ACTIVAS antes de producción

### 2.3 🟡 Golden tests jurídicos (AC #22)

El spec define 6 golden tests que el equipo legal debe validar:

**Grupo 1: Conflicto de interés (art. 190 LSC)**
- ✅ Tests técnicos ya implementados (EXCLUIR_QUORUM/VOTO/AMBOS, denominador=0→BLOQUEO)
- ⚠️ **Pendiente:** Legal confirma que los 4 escenarios cubren los supuestos reales que manejan

**Grupo 2: WORM y QTSP**
- ✅ Tests técnicos de worm_guard() implementados
- ⚠️ **Pendiente:** Legal confirma que la cadena de evidencia (evaluación → snapshot → QSeal → evidence bundle → verificador offline) satisface requisitos probatorios

### 2.4 🟡 Congelación del contrato de variables (AC #23)

- ✅ YAML v1.0.0 generado con 54 tipos en 3 bloques
- ✅ CI test activo (detecta tipos nuevos/eliminados)
- ⚠️ **Pendiente:** Revisión cruzada:
  - **Dev** revisa bloque QTSP (variables técnicas de firma/sello)
  - **Legal** revisa bloque USUARIO (variables que rellenan los secretarios)
  - Firma, poner `fecha_congelacion` y versión definitiva

### 2.5 ✅ 6 decisiones legales — RESUELTAS (2026-04-19)

> **Todas resueltas.** Ver resoluciones completas en `docs/superpowers/specs/2026-04-19-decisiones-legales-motor-lsc-resueltas.md`.

Decisiones originales (ahora resueltas) para el contexto de gobernanza:

1. **Jurisdicción:** ¿Los Rule Packs cubren solo ES o también BR/MX/PT? Los 16 packs tienen parámetros ES. Si aplican otras jurisdicciones, necesitamos overrides.
2. **Cotizadas:** El motor rechaza con BLOQUEO (borde no computable). ¿Se quiere soporte parcial para cotizadas en Oleada 2?
3. **Pactos parasociales:** Estructura `PactosEvaluation` presente pero sin lógica. ¿Cuándo se activa? ¿Qué impacto real tienen en el cliente demo?
4. **Convocatoria SL separada:** La plantilla #7 (Convocatoria SL) no existe todavía como registro separado en DB — solo hay una CONVOCATORIA genérica. ¿Se crea como plantilla separada o condicional dentro de la misma?
5. **Voto de calidad:** Implementado como gate opcional. ¿Reglas específicas del cliente demo (ARGA) para habilitarlo/deshabilitarlo por órgano?
6. **Retribución consejeros (art. 217 LSC):** Rule Pack existe con parámetros demo. ¿Valores reales para el cliente demo?

---

## 3. Pendientes técnicos (sin bloqueo legal)

### 3.1 ✅ Completados / no bloqueantes
- ENGINE_V2 activo en todas las integraciones
- Funciones V1 deprecadas con `@deprecated` y wrapper
- 15 suites de tests, ~250 tests pasando
- tsc --noEmit = 0 errores
- 0 violaciones Garrigues (tokens `--g-*`)

### 3.2 🟡 Mejoras técnicas opcionales

| Item | Descripción | Prioridad |
|---|---|---|
| Metamorphic tests (§19.2) | Tests de invariantes (elevar quórum nunca convierte rechazo en aprobación) | Media |
| Tests WORM contra Supabase real | Los golden tests WORM del spec requieren Supabase real (no mocked) | Baja (validado en migration) |
| Renderizado HTML de plantillas | Actualmente las plantillas son texto con `{{variables}}` — falta renderizador real | Media (bloqueado por Oleada 1) |
| Convocatoria SL como plantilla separada | AC #30 pide 7 plantillas, hay 7 registros pero falta la SL diferenciada | Media |
| Panel de administración de plantillas | UI para que Legal suba contenido Oleada 1 sin tocar SQL | Alta (acelera Oleada 1) |
| `bun run build` completo | Solo se verifica `tsc --noEmit`; falta vite build (puede haber warnings) | Baja |

---

## 4. Roadmap sugerido

```
Semana actual (S1):
  ├─ Dev: entrega docs/legal-team/ con brief + contrato variables
  ├─ Legal: recibe brief, inicia redacción Oleada 1 (plantillas 1-4)
  └─ Dev: panel admin plantillas (subir contenido Oleada 1 sin SQL)

S2:
  ├─ Legal: entrega plantillas 1-4 en REVISADA
  ├─ Dev: metamorphic tests + renderizador HTML
  └─ Legal: revisa contrato de variables USUARIO, feedback

S3:
  ├─ Legal: entrega plantillas 5-7, revisa golden tests
  ├─ Dev: integra contenido legal, UAT Gate PRE
  └─ Conjunto: sesión de validación golden tests

S4:
  ├─ Oleada 2: REVISADA → APROBADA → ACTIVA (las 7)
  ├─ Dev: congelación contrato variables (fecha_congelacion)
  └─ Go-live ready
```
