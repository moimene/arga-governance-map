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
| 1 | CONVOCATORIA / CONVOCATORIA_JUNTA | `76c3260e-2be6-4969-8b21-e3d6b720e38f` | 1.1.0 | ✅ | Operativa, mejora pendiente vía Path B |
| 2 | CONVOCATORIA_SL_NOTIFICACION / NOTIFICACION_CONVOCATORIA_SL | `1e1a7755-de14-4fdc-a913-e19fbe48d64c` | 1.1.0 | ✅ | Operativa, mejora pendiente vía Path B |

### 2.2. Actas de sesión (2)

| # | Plantilla | UUID Cloud | Versión | Firmada | Estado |
|---|---|---|---|---|---|
| 3 | ACTA_SESION / JUNTA_GENERAL | `53b34d3e-a87d-4378-928a-b03d339cb65c` | 1.1.0 | ✅ | Operativa, mejora pendiente vía Path B |
| 4 | ACTA_SESION / CONSEJO_ADMIN | `36c28a8c-cbe1-4692-90fd-768a83c26480` | 1.1.0 | ✅ | Operativa, mejora pendiente vía Path B |

### 2.3. Actas de órganos especiales (3)

| # | Plantilla | UUID Cloud | Versión | Firmada | Estado |
|---|---|---|---|---|---|
| 5 | COMISION_DELEGADA / ACTAS_ORGANOS_DELEGADOS | (resolver UUID con SQL inventario) | 1.0.0 | ✅ | Núcleo estable, sin upgrade pendiente |
| 6 | ACTA_DECISION_CONJUNTA / CO_APROBACION | `1e3b82a7-fffc-4a72-8851-b1e0f1649093` | 1.0.0 | ✅ | Operativa, mejora pendiente vía Path B |
| 7 | ACTA_ORGANO_ADMIN / ADMIN_SOLIDARIO | `b2409fb5-eb14-480b-89f4-66c72f1cbc5d` | 1.0.0 | ✅ | Operativa, mejora pendiente vía Path B |

### 2.4. Acuerdos sin sesión y unipersonales (3)

| # | Plantilla | UUID Cloud | Versión | Firmada | Estado |
|---|---|---|---|---|---|
| 8 | ACTA_ACUERDO_ESCRITO / ACUERDO_SIN_SESION | `1b1118a6-577d-45ed-96ee-77be89358aa0` | 1.2.0 | ✅ | Operativa, mejora pendiente vía Path B |
| 9 | ACTA_CONSIGNACION / DECISION_SOCIO_UNICO | `6f43fcce-4893-4636-b1d2-551ba6db92fb` | 1.1.0 | ✅ | Operativa, mejora pendiente vía Path B |
| 10 | ACTA_CONSIGNACION / DECISION_ADMIN_UNICO | `56bcbb33-b603-4025-9393-c5ad84ba3808` | 1.1.0 | ✅ | Operativa, mejora pendiente vía Path B |

### 2.5. Certificación (1)

| # | Plantilla | UUID Cloud | Versión | Firmada | Estado |
|---|---|---|---|---|---|
| 11 | CERTIFICACION / CERTIFICACION_ACUERDOS | `ca3df363-139a-41aa-8c21-37c7a68bddc7` | 1.2.0 | ✅ | Operativa, mejora pendiente vía Path B |

### 2.6. Informes (3)

| # | Plantilla | UUID Cloud | Versión | Firmada | Estado |
|---|---|---|---|---|---|
| 12 | INFORME_PRECEPTIVO / CONVOCATORIA_PRE | `4c2644ec-474e-486e-9893-28b5167a6bfc` | 1.0.1 | ✅ | Operativa, mejora pendiente vía Path B |
| 13 | INFORME_DOCUMENTAL_PRE / EXPEDIENTE_PRE | `438fa893-9704-48ee-91b3-9966e6f4df63` | 1.0.1 | ✅ | Operativa, mejora pendiente vía Path B |
| 14 | INFORME_GESTION / GESTION_SOCIEDAD | `944ff8d4-27e5-453e-82b5-8597b97a7300` | 1.0.0 | ✅ | Núcleo estable, **gap menor**: Capa 3 vacía |

### 2.7. Modelos de acuerdo firmados (6)

| # | Plantilla | UUID Cloud | Versión | Firmada | Estado |
|---|---|---|---|---|---|
| 15 | MODELO_ACUERDO / APROBACION_CUENTAS | `affa4219-9b3d-4ded-8c5a-2ed304738c4f` | 1.0.0 | ✅ | Operativa, mejora pendiente vía Path B |
| 16 | MODELO_ACUERDO / FORMULACION_CUENTAS | `389b0205-8639-49a6-aa5c-777413ea8471` | 1.0.0 | ✅ | Operativa, mejora pendiente vía Path B |
| 17 | MODELO_ACUERDO / DELEGACION_FACULTADES | `0b1beb86-5a19-45ba-8d0c-68e176844ac2` | 1.0.0 | ✅ | Operativa, mejora pendiente vía Path B |
| 18 | MODELO_ACUERDO / OPERACION_VINCULADA | `73669c41-0c1e-4616-bfc6-ca9b67277623` | 1.0.0 | ✅ | Operativa, mejora pendiente vía Path B |
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
**Estado actual:** autorizado y aplicado el 2026-05-04 como 16 nuevas filas `BORRADOR` mediante `scripts/apply-path-b-templates.ts --apply`. No se archivó ni promovió ninguna versión `ACTIVA`; la promoción `BORRADOR → ACTIVA` queda como paso separado con visto bueno operativo.

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
| Promoción de las 16 mejoras Path B de BORRADOR a ACTIVA | Operativa post-aplicación | Las 16 filas `BORRADOR` ya existen; requiere visto bueno operativo explícito para archivar versiones anteriores y promover nuevas |
| 8 duplicados ACTIVE en `rule_pack_versions` | Heredado del cierre Secretaría previo | Requiere credencial admin Cloud |

**Cero gaps críticos para demo end-to-end** respecto al núcleo de plantillas activas. Path B sigue siendo mejora versionada, no bloqueante.

---

## 5. Calendario realista

| Semana | Hito |
|---|---|
| **S0 (2026-05-04)** | Path A aplicado sobre Cloud como cierre demo-operativo. Probe final: 0 pendientes. |
| **S1 (2026-05-04)** | Path B autorizado y aplicado como 16 nuevas versiones `BORRADOR`; sin promoción automática. |
| **S2** | Decidir promoción operativa Path B: archivar versiones anteriores y promover nuevas a `ACTIVA`, o conservarlas como borrador. |
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
