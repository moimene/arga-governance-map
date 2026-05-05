# Estado plantillas societarias TGMS — fuente única de verdad

> **Última actualización:** 2026-05-04
> **Cliente demo:** Grupo ARGA Seguros (pseudónimo)
> **Estado de evidencia:** demo / operativa
>
> Este es el ÚNICO documento que necesitas leer para entender el estado actual de las plantillas. Todo lo demás en este directorio es material de trabajo o anexo técnico.

---

## Resumen en una frase

**Tenemos 37 plantillas operativas en demo, cubriendo 14 categorías de documento societario español; las 37 quedan cerradas en Cloud para uso demo-operativo, con 0 plantillas ACTIVAS sin firma, 0 versiones no semver y 0 MODELO_ACUERDO activo con metadatos jurídicos nulos.**

---

## 1. Por qué son 37 y no más

El inventario está dimensionado para que el demo cubra **el ciclo completo de gobernanza societaria de un gran grupo asegurador cotizado**. Las 37 plantillas se distribuyen así por categoría de uso:

| Categoría de uso | Plantillas | Cobertura |
|---|---|---|
| **Convocatorias** | 2 | Junta General (SA cotizada) + Notificación individual SL |
| **Actas de sesión** | 2 | Junta General + Consejo de Administración |
| **Actas órganos especiales** | 3 | Comisión Delegada + Decisión Conjunta (admin conjunta/coaprobación) + Órgano Admin (admin solidario) |
| **Acuerdos sin sesión y unipersonales** | 3 | Acuerdo escrito sin sesión + Decisión socio único (SLU/SAU) + Decisión administrador único |
| **Certificación transversal** | 1 | Certificación de acuerdos cubre todos los modos de adopción |
| **Informes** | 3 | Preceptivo pre-convocatoria + Documental PRE expediente + Informe de gestión |
| **Modelos de acuerdo por materia** | 23 | 22 materias específicas (cuentas, capital, consejeros, dividendos, fusión, etc.) |
| **TOTAL** | **37** | **14 categorías** |

Lo que **NO** cubrimos por diseño (módulo opcional futuro):

| Falta | Decisión |
|---|---|
| `DOCUMENTO_REGISTRAL` (escritura para Registro Mercantil) | Demo termina en estado `PROMOTED` ("preparado para Registro"); no envía físicamente |
| `SUBSANACION_REGISTRAL` (respuesta a calificación negativa) | Idem |

---

## 2. Las 37 plantillas, una a una, con su estado actual

### 2.1. Convocatorias (2)

| # | Plantilla | UUID Cloud | Versión | Firmada | Estado |
|---|---|---|---|---|---|
| 1 | CONVOCATORIA / CONVOCATORIA_JUNTA | `8dcfc85c-9422-4456-aa31-ceea5da6d64d` | 1.2.0 | ✅ | Path B promovida a ACTIVA; predecesora archivada |
| 2 | CONVOCATORIA_SL_NOTIFICACION / NOTIFICACION_CONVOCATORIA_SL | `1d7d5671-2588-4071-a9f6-e9b377d337bc` | 1.2.0 | ✅ | Path B promovida a ACTIVA; predecesora archivada |

### 2.2. Actas de sesión (2)

| # | Plantilla | UUID Cloud | Versión | Firmada | Estado |
|---|---|---|---|---|---|
| 3 | ACTA_SESION / JUNTA_GENERAL | `b9c17ef0-cf3d-4ba8-a753-7f4dafc2793e` | 1.2.0 | ✅ | Path B promovida a ACTIVA; predecesora archivada |
| 4 | ACTA_SESION / CONSEJO_ADMIN | `77191407-4d5b-4279-b09e-041985026aa4` | 1.2.0 | ✅ | Path B promovida a ACTIVA; predecesora archivada |

### 2.3. Actas de órganos especiales (3)

| # | Plantilla | UUID Cloud | Versión | Firmada | Estado |
|---|---|---|---|---|---|
| 5 | COMISION_DELEGADA / ACTAS_ORGANOS_DELEGADOS | (resolver UUID con SQL inventario) | 1.0.0 | ✅ | Núcleo estable, sin upgrade pendiente |
| 6 | ACTA_DECISION_CONJUNTA / CO_APROBACION | `ae44ec3b-ba47-4fd7-a119-5ac70346fdc0` | 1.1.0 | ✅ | Path B promovida a ACTIVA; predecesora archivada |
| 7 | ACTA_ORGANO_ADMIN / ADMIN_SOLIDARIO | `b5f436c9-e8e6-4a01-92e7-25fe51ed83f3` | 1.1.0 | ✅ | Path B promovida a ACTIVA; predecesora archivada |

### 2.4. Acuerdos sin sesión y unipersonales (3)

| # | Plantilla | UUID Cloud | Versión | Firmada | Estado |
|---|---|---|---|---|---|
| 8 | ACTA_ACUERDO_ESCRITO / ACUERDO_SIN_SESION | `2c15640c-de2f-41ea-aa8d-304147124a6e` | 1.3.0 | ✅ | Path B promovida a ACTIVA; predecesora archivada |
| 9 | ACTA_CONSIGNACION / DECISION_SOCIO_UNICO | `2d9134d5-7935-4f3c-a6de-de1c6fc35227` | 1.2.0 | ✅ | Path B promovida a ACTIVA; predecesora archivada |
| 10 | ACTA_CONSIGNACION / DECISION_ADMIN_UNICO | `383d7f4c-1df6-42a2-bc5c-df3a4e1685fe` | 1.2.0 | ✅ | Path B promovida a ACTIVA; predecesora archivada |

### 2.5. Certificación (1)

| # | Plantilla | UUID Cloud | Versión | Firmada | Estado |
|---|---|---|---|---|---|
| 11 | CERTIFICACION / CERTIFICACION_ACUERDOS | `79bc76c7-512e-4734-9849-31cdc73b0e84` | 1.3.0 | ✅ | Path B promovida a ACTIVA; predecesora archivada |

### 2.6. Informes (3)

| # | Plantilla | UUID Cloud | Versión | Firmada | Estado |
|---|---|---|---|---|---|
| 12 | INFORME_PRECEPTIVO / CONVOCATORIA_PRE | `24e1b9cb-9c4c-49a2-9259-d49b5b6647a1` | 1.1.0 | ✅ | Path B promovida a ACTIVA; predecesora archivada |
| 13 | INFORME_DOCUMENTAL_PRE / EXPEDIENTE_PRE | `62da5ae6-1cff-4a7c-8032-29e489d3e877` | 1.1.0 | ✅ | Path B promovida a ACTIVA; predecesora archivada |
| 14 | INFORME_GESTION / GESTION_SOCIEDAD | `944ff8d4-27e5-453e-82b5-8597b97a7300` | 1.0.0 | ✅ | Núcleo estable, **gap menor**: Capa 3 vacía |

### 2.7. Modelos de acuerdo firmados (6)

| # | Plantilla | UUID Cloud | Versión | Firmada | Estado |
|---|---|---|---|---|---|
| 15 | MODELO_ACUERDO / APROBACION_CUENTAS | `c8da1e61-ef2a-4a5c-895b-a5d100916ecf` | 1.1.0 | ✅ | Path B promovida a ACTIVA; predecesora archivada |
| 16 | MODELO_ACUERDO / FORMULACION_CUENTAS | `c90edc8c-4655-46b5-a708-31543faadd2e` | 1.1.0 | ✅ | Path B promovida a ACTIVA; predecesora archivada |
| 17 | MODELO_ACUERDO / DELEGACION_FACULTADES | `d3e08b42-a67e-4b33-9bbb-2689b5d8d4cf` | 1.1.0 | ✅ | Path B promovida a ACTIVA; predecesora archivada |
| 18 | MODELO_ACUERDO / OPERACION_VINCULADA | `64fa1683-8cb8-4c4c-b8d6-e09f91cafa59` | 1.1.0 | ✅ | Path B promovida a ACTIVA; predecesora archivada |
| 19 | MODELO_ACUERDO / ACTIVOS_ESENCIALES | (resolver UUID) | 1.0.0 | ✅ | Núcleo estable, sin upgrade pendiente |
| 20 | MODELO_ACUERDO / AUTORIZACION_GARANTIA | (resolver UUID) | 1.0.0 | ✅ | Núcleo estable, sin upgrade pendiente |

### 2.8. Modelos de acuerdo cerrados en Fase 4 (17)

| # | Plantilla | UUID Cloud | Versión cerrada | Estado |
|---|---|---|---|---|
| 21 | MODELO_ACUERDO / APROBACION_PLAN_NEGOCIO | `68da89bc-03cd-4820-80f1-8a549b0c7d78` | 1.0.0 | ✅ Cerrada demo-operativa |
| 22 | MODELO_ACUERDO / AUMENTO_CAPITAL | `2d814072-3fb0-4ffd-a181-875d9c4a5c0d` | 1.0.0 | ✅ Cerrada demo-operativa |
| 23 | MODELO_ACUERDO / CESE_CONSEJERO (Consejo) | `ba214d42-1933-497f-a2c0-0867c7c7a55f` | 1.1.0 | ✅ Cerrada demo-operativa |
| 24 | MODELO_ACUERDO / CESE_CONSEJERO (Junta) | `433da411-ba65-410c-8375-24db637f7e75` | 1.1.0 | ✅ Cerrada demo-operativa |
| 25 | MODELO_ACUERDO / COMITES_INTERNOS | `313e7609-8b11-4ef5-a8fd-e9fdcf99d22c` | 1.0.0 | ✅ Metadatos completos |
| 26 | MODELO_ACUERDO / DISTRIBUCION_CARGOS | `a09cc4bf-c927-470a-b392-43d2db424279` | 1.0.0 | ✅ Metadatos completos |
| 27 | MODELO_ACUERDO / DISTRIBUCION_DIVIDENDOS | `395ca996-fdf0-4203-b7ae-f894d3012c8b` | 1.0.0 | ✅ Cerrada demo-operativa |
| 28 | MODELO_ACUERDO / **FUSION_ESCISION** | `e3697ad9-e0c2-4baf-9144-c80a11808c07` | 1.0.0 | ✅ RDL 5/2023 + condicional experto |
| 29 | MODELO_ACUERDO / MODIFICACION_ESTATUTOS | `29739424-5641-42bd-8b5a-58f81ee5c471` | 1.0.0 | ✅ Cerrada demo-operativa |
| 30 | MODELO_ACUERDO / NOMBRAMIENTO_AUDITOR | `e64ce755-9e76-4b57-8fb7-750afb94857c` | 1.0.0 | ✅ Rango Capa 3 auditor |
| 31 | MODELO_ACUERDO / NOMBRAMIENTO_CONSEJERO (Consejo) | `27be9063-8977-44c7-b72c-eb26ecb3c49b` | 1.1.0 | ✅ Cooptación SA cubierta |
| 32 | MODELO_ACUERDO / NOMBRAMIENTO_CONSEJERO (Junta) | `10f90d59-39d3-4633-83ff-81140eff50d5` | 1.1.0 | ✅ Plazo mandato cubierto |
| 33 | MODELO_ACUERDO / POLITICA_REMUNERACION | `ee72efde-299b-42fc-86ba-57e29a187a7c` | 1.0.0 | ✅ Metadatos + tipo numérico |
| 34 | MODELO_ACUERDO / POLITICAS_CORPORATIVAS | `b846bb03-9329-4470-840b-30d614adc613` | 1.0.0 | ✅ Metadatos completos |
| 35 | MODELO_ACUERDO / **RATIFICACION_ACTOS** | `edd5c389-0187-476c-9592-c020058fdc69` | 1.0.0 | ✅ Listado de actos obligatorio |
| 36 | MODELO_ACUERDO / REDUCCION_CAPITAL | `c06957aa-ce9d-4560-9d4e-501756ed5e4f` | 1.0.0 | ✅ Oposición acreedores cubierta |
| 37 | MODELO_ACUERDO / **SEGUROS_RESPONSABILIDAD** | `df75cda9-e558-43c7-a6a9-902e2c06ee97` | 1.0.0 | ✅ Conflicto intra-grupo cubierto |

**Aplicación Cloud:** `scripts/close-legacy-templates-phase4.ts --apply`, 17/17 filas actualizadas, sin migraciones y sin crear versiones nuevas.
**Aprobador registrado:** `Comite Legal Garrigues - Secretaria Societaria (demo-operativo)`.
**Límite:** cierre válido para demo-operativa; antes de producción debe sustituirse por firma nominal profesional si el Comité lo exige.
**Informes Garrigues recibidos:** `Cierre_Legal_De_Plantillas_Críticas_TGMS.docx` cerró inicialmente `FUSION_ESCISION`; el entregable completo `ENTREGABLE_COMPLETO_CIERRE_LEGAL_17_PLANTILLAS_LEGACY_PATH_A.docx` cierra Path A para las 17 legacy. Addenda trazados en `2026-05-04-cierre-garrigues-fusion-escision.md` y `2026-05-04-cierre-garrigues-path-a-17-plantillas.md`.

---

## 3. Qué se está haciendo ahora — 3 tracks paralelos

### Track 1 — Path A: cierre legal de las 17 sin firma (Garrigues)

**Quién:** Comité Legal Garrigues — Secretaría Societaria
**Qué:** Revisar contenido + completar metadatos null + firmar formalmente las 17 plantillas
**Prioridad interna:** ya ejecutada en demo-operativa para las 3 críticas (FUSION_ESCISION, RATIFICACION_ACTOS, SEGUROS_RESPONSABILIDAD)
**Material de trabajo:** carpeta `plantillas-core-revision-2026-05-02/` queda como anexo histórico; el cierre ejecutado está trazado en `scripts/close-legacy-templates-phase4.ts`; el entregable completo Garrigues recibido el 2026-05-04 cubre las 17 legacy y está resumido en `2026-05-04-cierre-garrigues-path-a-17-plantillas.md`
**Plazo:** cerrado el 2026-05-04 para demo-operativa
**Estado actual:** Cerrado en Cloud. Probe: 0 ACTIVAS sin firma, 0 versiones no semver, 0 MODELO_ACUERDO activo con metadatos nulos. Para producción, queda pendiente únicamente sustituir la firma demo-operativa por firma nominal profesional si el Comité Legal lo exige.

### Track 2 — Path B: aplicar 16 mejoras como nueva versión (Garrigues + Ingeniería)

**Quién:**
- Decisión jurídica → Comité Legal Garrigues
- Ejecución técnica → Ingeniería TGMS

**Qué:**
- 3 plantillas con texto Capa 1 NUEVO (CONVOCATORIA, CONVOCATORIA_SL_NOTIFICACION, ACTA_SESION JUNTA_GENERAL): bloque cotizada, idempotencia, referencias QTSP
- 13 plantillas con commit formal sin cambio sustantivo

**Material de trabajo:** `2026-05-02-bloque-B-revision-castellano.md` (lo que el Comité abre)
**Anexo técnico:** `sql-drafts/2026-05-02-plantillas-core-v2-mejoras.sql` (para ingeniería tras decisión)
**Plazo:** 1 semana de revisión legal, ejecución posterior
**Estado actual:** cerrado. Autorizado y aplicado el 2026-05-04 como 16 nuevas filas `BORRADOR`; promovido el 2026-05-05 mediante `sql-drafts/2026-05-05-promote-path-b-templates.sql`. La promoción archivó exactamente 16 predecesoras `ACTIVA` y promovió exactamente 16 sucesoras Path B a `ACTIVA`. Probe posterior: 37 activas, 0 borradores, 0 bloqueos.

### Track 3 — Sprint B Motor v1 + Composer (Ingeniería, conversación nueva)

**Quién:** Ingeniería TGMS
**Qué:**
- Consolidar `src/lib/motor-plantillas/` como API estable v1.0.0-beta
- Crear `composeDocument()` end-to-end
- Post-render validation
- Review state machine en `evidence_bundles`
- Refactor `GenerarDocumentoStepper` (842 → 400 LOC)
- Panel revisión + promoción a expediente

**Plazo:** 3 semanas, paralelo a tracks 1 y 2
**Estado actual:** Planificado, no arrancado. Starter prompt en disco para nueva conversación.

---

## 4. Qué falta cuando estos 3 tracks cierren

| Item | Naturaleza | Decisión actual |
|---|---|---|
| 2 plantillas registrales (DOCUMENTO_REGISTRAL, SUBSANACION_REGISTRAL) | Categoría adicional para envío al Registro Mercantil | **Módulo opcional futuro**. Demo termina en `PROMOTED` (preparado para Registro), no envía |
| INFORME_GESTION con Capa 3 vacía | Gap menor en plantilla activa | Backlog. No bloquea demo |
| Cleanups técnicos Fase 4 | No críticos | Fuentes y duplicidades quedan cubiertas por resolver + tests; Capa 3 se normalizó en las 17 filas cerradas |
| Promoción de las 16 mejoras Path B de BORRADOR a ACTIVA | Operativa post-aplicación | ✅ Cerrada el 2026-05-05: 16 predecesoras archivadas, 16 sucesoras ACTIVA, 0 borradores Path B |
| 8 duplicados ACTIVE en `rule_pack_versions` | Heredado del cierre Secretaría previo | Requiere credencial admin Cloud |

**Cero gaps críticos para demo end-to-end** respecto al núcleo de plantillas activas. Path B queda incorporado como versión activa demo-operativa.

---

## 5. Calendario realista

| Semana | Hito |
|---|---|
| **S0 (2026-05-04)** | Path A aplicado sobre Cloud como cierre demo-operativo. Probe final: 0 pendientes. |
| **S1 (2026-05-04)** | Path B autorizado y aplicado como 16 nuevas versiones `BORRADOR`; sin promoción automática. |
| **S2 (2026-05-05)** | Path B promovido: 16 sucesoras `ACTIVA`, 16 predecesoras `ARCHIVADA`, probe Cloud verde. |
| **S3** | Sustituir firma demo-operativa por firma nominal profesional si el Comité Legal lo requiere para producción. |
| **S4** | Cerrar documentación final de producto, manteniendo frontera `PROMOTED` = preparado para registro, sin envío registral real. |

---

## 6. Material de trabajo del paquete legal (qué hace cada archivo)

Si tienes que profundizar en alguna parte, abre estos archivos. **No son documentos de gobernanza**, son material operativo. La gobernanza es este documento que estás leyendo ahora.

| Archivo | Para quién | Para qué |
|---|---|---|
| `2026-05-02-INDICE-PAQUETE-ENTREGA-COMITE.md` | Comité Legal | Punto de entrada físico al ZIP — orienta los archivos del paquete |
| `2026-05-02-encargo-comite-legal-garrigues.md` | Comité Legal | Encargo formal — qué se les pide, plazos, constraints |
| `plantillas-core-revision-2026-05-02/01..17-*.md` | Comité Legal | Histórico del paquete Path A anterior al cierre Fase 4 |
| `2026-05-04-cierre-garrigues-path-a-17-plantillas.md` | Comité Legal + ingeniería | Addendum del entregable completo Path A de Garrigues para las 17 plantillas legacy |
| `scripts/close-legacy-templates-phase4.ts` | Ingeniería + Comité Legal | Script trazable del cierre aplicado el 2026-05-04 sobre las 17 filas existentes |
| `2026-05-02-bloque-B-revision-castellano.md` | Comité Legal | Documento legible para revisar las 16 mejoras (Track 2 / Path B) |
| `prompts/01-version-bump-validator.md` | Coordinador Comité en Harvey Space | Valida transiciones de versión durante el cierre |
| `prompts/02-pre-export-probe.md` | Coordinador Comité en Harvey Space | Bloquea exportación si hay incumplimientos |
| `sql-drafts/2026-05-02-plantillas-core-v2-mejoras.sql` | Ingeniería tras decisión legal | Anexo técnico del Path B — el Comité no lo abre |
| `sql-drafts/2026-05-05-promote-path-b-templates.sql` | Ingeniería | Promoción transaccional Path B: archiva predecesoras y activa sucesoras con guards de conteo |
| `2026-05-02-paquete-17-plantillas-entregable-legal.md` | Histórico | Entregable bruto previo del equipo legal antes del descubrimiento del mismatch |
| `2026-05-02-brief-corregido-17-plantillas-legacy.md` | Histórico | Brief técnico complementario, redundante con el encargo formal |
| `2026-05-02-plantillas-mapping-uuid-cierre.md` | Histórico | Mapping consolidado UUID-cierre. Información integrada en este documento (sección 2). Conservar como referencia técnica |

Plan maestro técnico (en `docs/superpowers/plans/2026-05-02-plantillas-core-multiagent-cierre.md`): histórico del proceso multiagente, no documento de gobernanza.

---

## 7. Cómo mantener este documento

Este documento se actualiza **únicamente** cuando cambia el estado material de las plantillas:

| Evento que dispara update | Sección a actualizar |
|---|---|
| Sustitución por firma nominal productiva | Sección 2.8 y Track 1 |
| Aplicación SQL del Path B con autorización | Sección 2 actualizar versiones afectadas. Sección 3 Track 2 |
| Sprint B avanza milestone | Sección 3 Track 3 |
| Cierra alguno de los 3 tracks | Sección 3 + sección 5 calendario |
| Aparecen nuevas plantillas (módulo registral, etc.) | Secciones 1, 2, 4 |

No se crea otro documento "estado-plantillas" en disco. Si alguien lo crea, se borra y se redirige aquí.
