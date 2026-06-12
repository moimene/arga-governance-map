# Requerimiento legal a Garrigues / Comité Legal — Backlog Secretaría Societaria

> Generado 2026-06-12 a partir del estado real de `governance_OS` (Cloud).
> Destinatario: Comité Legal + Garrigues. Objetivo: desbloquear los ítems de
> backlog que requieren contenido o criterio jurídico, no solo código.
>
> Contexto técnico: el motor de reglas (LSC) lee de `rule_packs` +
> `rule_pack_versions` (payload JSONB con umbrales) y de `plantillas_protegidas`
> (modelos de acuerdo en 3 capas: capa1 inmutable, capa2 variables, capa3
> editables). Hoy estos modelos están en estado `BORRADOR` con texto
> **placeholder genérico** ("PRIMERO.- El órgano competente {{organo_nombre}},
> reunido el ...") que NO es contenido jurídico real.

---

## 1. ITEM-082 — 16 plantillas en BORRADOR sin contenido legal

Modelos de acuerdo / convocatorias que existen como registro pero cuyo texto
(capa1 inmutable) es un placeholder genérico. Se necesita la **redacción jurídica
real** de cada uno (parte dispositiva del acuerdo, fundamento legal, y campos
variables/editables), para promoverlos a `ACTIVA`.

| # | Materia / clave | Tipo | Órgano | Ver. | Qué hay que redactar |
|---|---|---|---|---|---|
| 1 | `ADQUISICION_PROPIA` | Modelo acuerdo | Junta General | 0.1.0 | Autorización adquisición derivativa de acciones/participaciones propias (arts. 140-148 LSC) |
| 2 | `AMPLIACION_OBJETO_SOCIAL` | Modelo acuerdo | Junta General | 0.1.0 | Modificación estatutaria del objeto social (art. 285 LSC; derecho de separación art. 346.1.a si sustitución) |
| 3 | `APROBACION_PRESUPUESTOS` | Modelo acuerdo | Consejo Admin. | 0.1.0 | Aprobación del presupuesto anual por el Consejo |
| 4 | `CAMBIO_DENOMINACION_SOCIAL` | Modelo acuerdo | Junta General | 0.1.0 | Modificación estatutaria de denominación (art. 285 LSC) |
| 5 | `CAMBIO_DOMICILIO_SOCIAL` | Modelo acuerdo | Junta General | 0.1.0 | Cambio de domicilio (art. 285 LSC; competencia del órgano de admin. art. 285.2 salvo disposición estatutaria) |
| 6 | `CONTRATACION_RELEVANTE` | Modelo acuerdo | Consejo Admin. | 0.1.0 | Autorización de contratación relevante por el Consejo |
| 7 | `CONVOCATORIA_COMISION_DELEGADA` | Convocatoria | Comisión Delegada | 1.1.0 | Texto de convocatoria de comisión delegada (reglamento del consejo) |
| 8 | `DELEGACION_CAPITAL` | Modelo acuerdo | Junta General | 0.1.0 | Delegación en el órgano de admin. para aumentar capital (art. 297 LSC) |
| 9 | `EMISION_DEUDA_CONVERTIBLE` | Modelo acuerdo | Junta General | 0.1.0 | Emisión de obligaciones convertibles (arts. 401-418 LSC; informe de administradores y auditor) |
| 10 | `ESCISION` | Modelo acuerdo | Junta General | 0.1.0 | Escisión (total/parcial/segregación) — RDL 5/2023 (modificaciones estructurales); proyecto, informes, balance |
| 11 | `FINANCIACION` | Modelo acuerdo | Consejo Admin. | 0.1.0 | Operación de financiación por el Consejo |
| 12 | `FORMULACION_CUENTAS` | Modelo acuerdo | Consejo Admin. | 1.2.0 | Formulación de cuentas anuales por el Consejo (art. 253 LSC). **Anomalía de versión: BORRADOR 1.2.0 > ACTIVA 1.1.0 (ITEM-081)** |
| 13 | `FUSION` | Modelo acuerdo | Junta General | 0.1.0 | Fusión — RDL 5/2023; proyecto común, informes de administradores y experto, balance |
| 14 | `LIQUIDACION` | Modelo acuerdo | Junta General | 0.1.0 | Disolución y apertura de liquidación (arts. 360-400 LSC) |
| 15 | `PACTO_PARASOCIAL` | Modelo acuerdo | Junta General | 0.1.0 | Adhesión/modificación de pacto parasocial (art. 29 LSC) |
| 16 | `PRORROGA_SOCIEDAD` | Modelo acuerdo | Junta General | 0.1.0 | Prórroga de la duración (modificación estatutaria; derecho de separación si procede) |

**Entregable solicitado por plantilla:**
- (a) Texto dispositivo del acuerdo (capa1 inmutable), redacción registral.
- (b) Fundamento legal aplicable (referencia normativa concreta).
- (c) Variables de la capa2 (datos objetivos: importes, fechas, denominaciones).
- (d) Campos editables de la capa3 (lo que el secretario completa por expediente).
- (e) Confirmación de órgano competente y mayoría exigible.

---

## 2. ITEM-054 — 15 materias del catálogo SIN rule pack activo

Materias presentes en `materia_catalog` que no tienen ningún `rule_pack` con
versión activa: el motor cae a defaults y no puede resolver instrumento/plazo/
documentación específicos. Se necesita **validación jurídica de los parámetros**
de cada pack (mayoría, quórum, instrumento, plazo de inscripción, documentos
preceptivos) antes de sembrarlo como activo.

| # | Materia | Etiqueta | Clase | Mayoría mín. (seed) | Notario | Registro | Inscribible |
|---|---|---|---|---|---|---|---|
| 1 | `MOD_ESTATUTOS` | Modificación de estatutos | ESTATUTARIA | REFORZADA_2_3 | Sí | Sí | Sí | *(alias de MODIFICACION_ESTATUTOS — decidir si se retira del catálogo, ITEM-081 fase 2)* |
| 2 | `AMPLIACION_CAPITAL` | Aumento de capital | ESTATUTARIA | REFORZADA_2_3 | Sí | Sí | Sí | *(¿alias de AUMENTO_CAPITAL? unificar clave)* |
| 3 | `AMPLIACION_OBJETO_SOCIAL` | Ampliación objeto social | ESTATUTARIA | REFORZADA_2_3 | Sí | Sí | Sí | |
| 4 | `CAMBIO_DENOMINACION_SOCIAL` | Cambio denominación | ESTATUTARIA | SIMPLE | Sí | Sí | Sí | **Revisar: ¿mayoría simple o reforzada? (modif. estatutaria → art. 201.2)** |
| 5 | `CAMBIO_DOMICILIO_SOCIAL` | Cambio domicilio | ESTATUTARIA | SIMPLE | Sí | Sí | Sí | **Revisar competencia órgano admin. (art. 285.2 LSC)** |
| 6 | `DELEGACION_CAPITAL` | Delegación aumento capital | ESTATUTARIA | REFORZADA_2_3 | No | Sí | Sí | art. 297 LSC |
| 7 | `EMISION_DEUDA_CONVERTIBLE` | Emisión deuda convertible | ESTATUTARIA | REFORZADA_2_3 | Sí | Sí | Sí | arts. 401 ss. LSC |
| 8 | `EXCLUSION_DERECHO_SUSCRIPCION_PREFERENTE` | Exclusión preferente | ESTATUTARIA | REFORZADA_2_3 | Sí | Sí | Sí | art. 308 LSC (informe + valor razonable) |
| 9 | `PRORROGA_SOCIEDAD` | Prórroga duración | ESTATUTARIA | REFORZADA_2_3 | Sí | Sí | Sí | |
| 10 | `LIQUIDACION` | Liquidación | ESTRUCTURAL | **UNANIMIDAD** | Sí | Sí | Sí | **Revisar: disolución es mayoría reforzada (art. 364), no unanimidad** |
| 11 | `VENTA_ACTIVOS_ESENCIALES` | Enajenación activos esenciales | ESTRUCTURAL | REFORZADA_2_3 | Sí | No | No | art. 160.f LSC |
| 12 | `ADQUISICION_PROPIA` | Autocartera | ORDINARIA | SIMPLE | No | No | No | arts. 140-148 LSC |
| 13 | `NOMBRAMIENTO_CESE` | Nombramiento consejero | ORDINARIA | SIMPLE | No | Sí | Sí | *(clave combinada deprecada — ITEM-081/133; decidir retiro)* |
| 14 | `REMUNERACION_CONSEJEROS` | Política de remuneración | ORDINARIA | SIMPLE | No | No | No | art. 217 LSC (y 529 sexdecies para cotizada) |
| 15 | `PACTO_PARASOCIAL` | Pacto parasocial | ESPECIAL | **UNANIMIDAD** | No | No | No | **Revisar: ¿unanimidad de partes del pacto o mayoría societaria? art. 29 LSC** |

**Entregable solicitado por materia:** confirmación o corrección de
mayoría/quórum, instrumento (escritura/instancia/ninguno), plazo de inscripción
y documentos preceptivos, para construir el payload del rule pack.

**Puntos marcados en negrita** = posibles errores del seed que conviene validar
(p. ej. LIQUIDACION/disolución como UNANIMIDAD parece incorrecto; mayoría simple
en modificaciones estatutarias de denominación contradice art. 201.2).

---

## 3. Requerimientos formulados — ITEM-057, 099, 113, 116

> El usuario mencionó "115"; ITEM-115 (RLS de no_session_resolutions) **ya está
> resuelto** (commit f4f7cd3). Se entiende referido a **ITEM-116 (DL-2)**.

### ITEM-057 — Circulación de consejo sin sesión (art. 100 LSC / art. 248.2)
**Decisión jurídica requerida:**
1. La votación por escrito y sin sesión del Consejo (art. 100 RRM / 248.2 LSC)
   cuando la participación es **inferior al 50%** de los consejeros: ¿debe
   **bloquear** la adopción (BLOCKING) o solo **advertir** (WARNING)? Hoy el motor
   lo trata como WARNING.
2. Las respuestas en estado **SILENCIO** (consejero que no contesta dentro del
   plazo): ¿**computan en el denominador** del cálculo de mayoría (como abstención
   o como no-concurrencia)? Hoy no computan.
**Entregable:** regla unívoca (umbral de validez + tratamiento del silencio) con
cita normativa, para fijar el gate del `no-session-engine`.

### ITEM-099 — Validación legal de representaciones
**Reglas jurídicas requeridas para cablear el motor:**
1. **Proxy de Junta** (arts. 184-187 LSC): límites a la representación en junta
   (representación por otro socio o tercero, forma escrita, revocabilidad,
   conflicto de interés art. 523 para cotizada, solicitud pública de
   representación arts. 186/526).
2. **Delegación en Consejo** (art. 529 quáter LSC para cotizada): un consejero solo
   puede delegar en otro consejero; límites a delegaciones; quórum de asistencia
   por representación.
**Entregable:** matriz de qué representaciones son válidas por tipo de órgano
(Junta vs Consejo) y tipo social (SA cotizada vs no cotizada vs SL), con los
límites cuantitativos y formales, para validar `representaciones` antes del quórum.

### ITEM-113 — Pactos parasociales: normalización de materias
**Mapeo jurídico requerido:** el pacto demo de Fundación ARGA tiene cláusulas de
**veto** (operaciones estructurales) y **mayoría reforzada pactada** (75% para
operaciones de capital). Las cláusulas Cloud usan materias
`FUSION/ESCISION/DISOLUCION/VENTA_ACTIVOS_SUSTANCIALES/TRANSFORMACION`,
`OPERACION_VINCULADA`, `AMPLIACION_CAPITAL/EMISION_CONVERTIBLES/EXCLUSION_PREFERENTE`,
mientras el vocabulario operativo de los steppers usa
`AUMENTO_CAPITAL`, `FUSION`, etc. (claves distintas).
**Entregable:** tabla de equivalencia jurídica entre la materia del acto operativo
y la materia de la cláusula del pacto (p. ej. ¿`AUMENTO_CAPITAL` operativo dispara
la cláusula `AMPLIACION_CAPITAL` del pacto? ¿`DISOLUCION`↔`LIQUIDACION`?), y
confirmación de qué flujos (reunión, sin sesión, co-aprobación, solidario,
unipersonal) deben evaluar el veto del pacto.

### ITEM-116 — DL-2 (cotizada): advertencias LMV en runtime
**Criterio jurídico requerido:** la parte "no bloquear cotizadas" ya está
implementada. Falta definir **qué advertencias de mercado de valores** deben
mostrarse al usuario en runtime y con qué texto, por materia:
- Hecho relevante / información privilegiada (art. 17 Reglamento MAR 596/2014).
- Informe Anual de Gobierno Corporativo (IAGC).
- Comunicación a CNMV y plazos (art. 226 ss. TRLMV).
- Convocatoria de junta de cotizada (art. 516-517 LSC: anuncio, web corporativa,
  un mes de antelación, complemento de convocatoria).
**Entregable:** lista de advertencias LMV por materia (cuáles aplican a qué tipo
de acuerdo en una cotizada) con su texto y referencia, para volcarlas al panel de
compliance y a las `cotizadaWarnings` del Board Pack.

---

## Anexo — Decisiones de producto/modelado (no requieren Garrigues, sí equipo)

| Ítem | Decisión interna |
|---|---|
| 080 / 112 | ¿Columna `tipo_social` en `plantillas_protegidas` (DL-4) o se documenta que la discriminación SA/SL vive solo en Tramitador? |
| 090 | ¿Migrar lecturas (Calendario/Dashboard/Conflicts) a `condiciones_persona` o abrir Fase 2 dual-write `mandates↔condiciones`? |
| 117 / 119 | ~10 módulos del motor sin consumidor runtime + DL-4 duplicado: cablear vs eliminar (decidir por módulo). |
| 146 | ¿Estado intermedio `EN_CURSO` en `meetings` reservando CELEBRADA para el cierre? (afecta KPIs/e2e). |
| 081 fase 2 | Dedup de `materia_catalog` (retirar alias MOD_ESTATUTOS, NOMBRAMIENTO_CESE, unificar AMPLIACION/AUMENTO_CAPITAL) con re-binding de plantillas. |

---

## Anexo II — Deuda arquitectónica (refactor con diseño, no apresurar)

Estos ítems NO son legales ni de modelado simple: son refactors estructurales que
requieren diseño y re-verificación e2e amplia. Hacerlos a ciegas rompería flujos.
Recomendación: pasada dedicada con su propio plan + e2e de regresión.

| Ítem | Refactor | Por qué no se hace en caliente |
|---|---|---|
| **125** | Unificar las 3 familias de shell de stepper + componentes Input/Field/Checkbox duplicados | Toca ~15 steppers a la vez; un shell común mal diseñado rompe todos los flujos de adopción. Necesita diseño del contrato del shell + migración stepper a stepper con e2e por flujo. |
| **128** | Doble implementación del pipeline de despacho (lib `src/lib/comms` solo en tests vs Edge Function inline, ya divergen) | Consolidar el despacho en una sola fuente de verdad cruza el límite cliente/Edge Function (Deno) con contratos de tipos distintos; requiere decidir dónde vive la lógica y desplegar la Edge Function. |
| **126** | Tres vías paralelas de 'envío' con modelos de estado divergentes | Es la capa de comunicaciones completa; unificar los estados de envío (convocatoria / ERDS acuerdo / board pack) necesita un modelo de estado común acordado antes de tocar código. |
| **146** | Estado intermedio `EN_CURSO` en `meetings` (reservar CELEBRADA para el cierre) | Cambia el ciclo de vida de la reunión del que dependen `deriveReunionInitialStep` (ITEM-059), `isOpen`, KPIs del dashboard y ~8 specs e2e. Cambio coordinado + re-verificación e2e completa. Estaba marcado REQUIERE DECISIÓN HUMANA. |

**Decisiones de producto ya tomadas y documentadas en código (cerradas):**
- ITEM-080/112: la discriminación SA/SL (DL-4) vive en el Tramitador (modelos por
  materia); `plantillas_protegidas` no añade eje `tipo_social`. Documentado en
  `agreement-template-compatibility.ts`.
- ITEM-090: las lecturas de vencimientos/KPIs/conflictos migran a `condiciones_persona`
  (fuente canónica); `mandates` queda para vistas legacy del shell TGMS.
