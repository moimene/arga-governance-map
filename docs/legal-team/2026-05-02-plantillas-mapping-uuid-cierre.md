# Mapping consolidado UUID → cierre — plantillas core 2026-05-02

> **Propósito:** índice único cruzado de las 55 plantillas en Cloud (37 ACTIVA + 18 ARCHIVADA) con cobertura por carril (Path A / Path B) y estado de cierre.
> **Lectores:** ingeniería + comité legal + operaciones.
> **Estado:** snapshot 2026-05-02. Refrescar tras aplicar Path A o Path B.

---

## 1. Inventario completo Cloud (37 ACTIVA)

Agrupado por cobertura de cierre.

### 1.1. Cohorte A — Path B (16 plantillas con upgrade pendiente del SQL packet)

| # | UUID | tipo | materia | versión actual → nueva | aprobador actual |
|---|---|---|---|---|---|
| B-01 | `76c3260e-2be6-4969-8b21-e3d6b720e38f` | CONVOCATORIA | CONVOCATORIA_JUNTA | 1.1.0 → 1.2.0 | Comité Legal ARGA — Secretaría Societaria (demo-operativo) |
| B-02 | `1e1a7755-de14-4fdc-a913-e19fbe48d64c` | CONVOCATORIA_SL_NOTIFICACION | NOTIFICACION_CONVOCATORIA_SL | 1.1.0 → 1.2.0 | Comité Legal ARGA — Secretaría Societaria (demo-operativo) |
| B-03 | `53b34d3e-a87d-4378-928a-b03d339cb65c` | ACTA_SESION | JUNTA_GENERAL | 1.1.0 → 1.2.0 | Comité Legal ARGA — Secretaría Societaria (demo-operativo) |
| B-04 | `36c28a8c-cbe1-4692-90fd-768a83c26480` | ACTA_SESION | CONSEJO_ADMIN | 1.1.0 → 1.2.0 | Comité Legal ARGA — Secretaría Societaria (demo-operativo) |
| B-05 | `ca3df363-139a-41aa-8c21-37c7a68bddc7` | CERTIFICACION | CERTIFICACION_ACUERDOS | 1.2.0 → 1.3.0 | Comité Legal ARGA — Secretaría Societaria (demo-operativo) |
| B-06 | `438fa893-9704-48ee-91b3-9966e6f4df63` | INFORME_DOCUMENTAL_PRE | EXPEDIENTE_PRE | 1.0.1 → 1.1.0 | Comité Legal ARGA — Secretaría Societaria (demo-operativo) |
| B-07 | `4c2644ec-474e-486e-9893-28b5167a6bfc` | INFORME_PRECEPTIVO | CONVOCATORIA_PRE | 1.0.1 → 1.1.0 | Comité Legal ARGA — Secretaría Societaria (demo-operativo) |
| B-08 | `1b1118a6-577d-45ed-96ee-77be89358aa0` | ACTA_ACUERDO_ESCRITO | ACUERDO_SIN_SESION | 1.2.0 → 1.3.0 | Comité Legal ARGA — Secretaría Societaria (demo-operativo) |
| B-09 | `6f43fcce-4893-4636-b1d2-551ba6db92fb` | ACTA_CONSIGNACION | DECISION_SOCIO_UNICO | 1.1.0 → 1.2.0 | Comité Legal ARGA — Secretaría Societaria (demo-operativo) |
| B-10 | `56bcbb33-b603-4025-9393-c5ad84ba3808` | ACTA_CONSIGNACION | DECISION_ADMIN_UNICO | 1.1.0 → 1.2.0 | Comité Legal ARGA — Secretaría Societaria (demo-operativo) |
| B-11 | `1e3b82a7-fffc-4a72-8851-b1e0f1649093` | ACTA_DECISION_CONJUNTA | CO_APROBACION | 1.0.0 → 1.1.0 | Comité Legal ARGA — Secretaría Societaria (demo-operativo) |
| B-12 | `b2409fb5-eb14-480b-89f4-66c72f1cbc5d` | ACTA_ORGANO_ADMIN | ADMIN_SOLIDARIO | 1.0.0 → 1.1.0 | Comité Legal ARGA — Secretaría Societaria (demo-operativo) |
| B-13 | `affa4219-9b3d-4ded-8c5a-2ed304738c4f` | MODELO_ACUERDO | APROBACION_CUENTAS | 1.0.0 → 1.1.0 | Comité Legal ARGA — Secretaría Societaria |
| B-14 | `389b0205-8639-49a6-aa5c-777413ea8471` | MODELO_ACUERDO | FORMULACION_CUENTAS | 1.0.0 → 1.1.0 | Comité Legal ARGA — Secretaría Societaria |
| B-15 | `0b1beb86-5a19-45ba-8d0c-68e176844ac2` | MODELO_ACUERDO | DELEGACION_FACULTADES | 1.0.0 → 1.1.0 | Comité Legal ARGA — Secretaría Societaria |
| B-16 | `73669c41-0c1e-4616-bfc6-ca9b67277623` | MODELO_ACUERDO | OPERACION_VINCULADA | 1.0.0 → 1.1.0 | Comité Legal ARGA — Secretaría Societaria |

**SQL packet:** `docs/legal-team/sql-drafts/2026-05-02-plantillas-core-v2-mejoras.sql`. Estado: PROPUESTO, no aplicado.

### 1.2. Cohorte A — Path A (17 plantillas legacy sin firma formal)

| # | UUID | tipo | materia | versión actual → nueva al firmar | prioridad |
|---|---|---|---|---|---|
| A-01 | `68da89bc-03cd-4820-80f1-8a549b0c7d78` | MODELO_ACUERDO | APROBACION_PLAN_NEGOCIO | 0.1.0 → 1.0.0 | Media |
| A-02 | `2d814072-3fb0-4ffd-a181-875d9c4a5c0d` | MODELO_ACUERDO | AUMENTO_CAPITAL | 0.1.0 → 1.0.0 | Alta |
| A-03 | `ba214d42-1933-497f-a2c0-0867c7c7a55f` | MODELO_ACUERDO | CESE_CONSEJERO (CdA) | 1.0.0 → 1.1.0 | Media |
| A-04 | `433da411-ba65-410c-8375-24db637f7e75` | MODELO_ACUERDO | CESE_CONSEJERO (Junta) | 1.0.0 → 1.1.0 | Media |
| A-05 | `313e7609-8b11-4ef5-a8fd-e9fdcf99d22c` | MODELO_ACUERDO | COMITES_INTERNOS | "1" → 1.0.0 | Alta — completar metadatos |
| A-06 | `a09cc4bf-c927-470a-b392-43d2db424279` | MODELO_ACUERDO | DISTRIBUCION_CARGOS | "1" → 1.0.0 | Alta — completar metadatos |
| A-07 | `395ca996-fdf0-4203-b7ae-f894d3012c8b` | MODELO_ACUERDO | DISTRIBUCION_DIVIDENDOS | 0.1.0 → 1.0.0 | Media |
| A-08 | `e3697ad9-e0c2-4baf-9144-c80a11808c07` | MODELO_ACUERDO | FUSION_ESCISION | "1" → 1.0.0 | **CRÍTICA — RDL 5/2023** |
| A-09 | `29739424-5641-42bd-8b5a-58f81ee5c471` | MODELO_ACUERDO | MODIFICACION_ESTATUTOS | 0.1.0 → 1.0.0 | Alta |
| A-10 | `e64ce755-9e76-4b57-8fb7-750afb94857c` | MODELO_ACUERDO | NOMBRAMIENTO_AUDITOR | 0.1.0 → 1.0.0 | Media |
| A-11 | `27be9063-8977-44c7-b72c-eb26ecb3c49b` | MODELO_ACUERDO | NOMBRAMIENTO_CONSEJERO (CdA) | 1.0.0 → 1.1.0 | Media |
| A-12 | `10f90d59-39d3-4633-83ff-81140eff50d5` | MODELO_ACUERDO | NOMBRAMIENTO_CONSEJERO (Junta) | 1.0.0 → 1.1.0 | Media |
| A-13 | `ee72efde-299b-42fc-86ba-57e29a187a7c` | MODELO_ACUERDO | POLITICA_REMUNERACION | "1" → 1.0.0 | Alta — completar metadatos |
| A-14 | `b846bb03-9329-4470-840b-30d614adc613` | MODELO_ACUERDO | POLITICAS_CORPORATIVAS | "1" → 1.0.0 | Alta — completar metadatos |
| A-15 | `edd5c389-0187-476c-9592-c020058fdc69` | MODELO_ACUERDO | RATIFICACION_ACTOS | 0.1.0 → 1.0.0 | **CRÍTICA — riesgo nulidad** |
| A-16 | `c06957aa-ce9d-4560-9d4e-501756ed5e4f` | MODELO_ACUERDO | REDUCCION_CAPITAL | 0.1.0 → 1.0.0 | Alta |
| A-17 | `df75cda9-e558-43c7-a6a9-902e2c06ee97` | MODELO_ACUERDO | SEGUROS_RESPONSABILIDAD | "1" → 1.0.0 | **CRÍTICA — conflicto intra-grupo** |

**Fichas individuales:** `docs/legal-team/plantillas-core-revision-2026-05-02/01..17-*.md`.
**Brief:** `docs/legal-team/2026-05-02-brief-corregido-17-plantillas-legacy.md`.

### 1.3. Cohorte C — núcleo estable (4 plantillas firmadas, sin upgrade pendiente)

| # | tipo | materia | aprobador | gap conocido |
|---|---|---|---|---|
| C-01 | COMISION_DELEGADA | ACTAS_ORGANOS_DELEGADOS | Comité Legal ARGA | — |
| C-02 | INFORME_GESTION | GESTION_SOCIEDAD | Legal Team | **Capa 3 vacía** — abrir backlog para refresh |
| C-03 | MODELO_ACUERDO | ACTIVOS_ESENCIALES | Comité Legal ARGA — Secretaría Societaria | — |
| C-04 | MODELO_ACUERDO | AUTORIZACION_GARANTIA | Comité Legal ARGA — Secretaría Societaria | — |

C-02 (INFORME_GESTION) tiene Capa 3 vacía. No estaba en las 17 legacy del closeout pero merece atención del comité para una iteración futura.

---

## 2. ARCHIVADAS (18 plantillas — referencia histórica)

No relevantes para el cierre de núcleo sólido. Quedan como histórico de versiones anteriores. La 18ª (`b2b3b741-d2d6-4c8a-bb00-7b519854d39e` / INFORME_PRECEPTIVO / CONVOCATORIA_PRE) tiene Capa 3 vacía pero al estar archivada no bloquea nada.

---

## 3. Estado de cobertura

| Cohorte | Plantillas | % | Acción |
|---|---|---|---|
| Path B (upgrade SQL packet) | 16 | 43% | SQL propuesto, esperando aprobación legal |
| Path A (revisión + firma) | 17 | 46% | Brief corregido, esperando equipo legal |
| Núcleo estable | 4 | 11% | Sin acción inmediata; C-02 con gap menor |
| **Total ACTIVA** | **37** | **100%** | |

Tras ejecutar Path A + Path B + promover BORRADORs a ACTIVA + archivar viejas: **37 plantillas firmadas formalmente con metadatos completos y versionado coherente**.

---

## 4. Probes de verificación post-cierre

### 4.1. Probe Path A (cero legacy sin firma)

```sql
SELECT COUNT(*) AS legacy_pendientes
FROM plantillas_protegidas
WHERE estado = 'ACTIVA' AND aprobada_por IS NULL;
-- Esperado: 0
```

### 4.2. Probe Path B (16 BORRADORs nuevos del comité legal)

```sql
SELECT COUNT(*) AS borradores_path_b
FROM plantillas_protegidas
WHERE estado = 'BORRADOR'
  AND fecha_aprobacion = '2026-05-02'
  AND aprobada_por LIKE 'Comité Legal ARGA%';
-- Esperado: 16
```

### 4.3. Probe metadatos completos en ACTIVAS

```sql
SELECT COUNT(*) AS activas_con_metadatos_null
FROM plantillas_protegidas
WHERE estado = 'ACTIVA'
  AND (organo_tipo IS NULL OR adoption_mode IS NULL OR referencia_legal IS NULL);
-- Esperado: pocas (el comité puede dejar adoption_mode null para plantillas tipo soporte interno como CERTIFICACION o INFORME_*).
```

### 4.4. Probe versionado semver

```sql
SELECT id, tipo, materia, version
FROM plantillas_protegidas
WHERE estado = 'ACTIVA'
  AND version !~ '^\d+\.\d+\.\d+$';
-- Esperado: 0 filas tras Path A.
```

### 4.5. Probe boundary V1 sigue ready

```bash
bun run scripts/probe-secretaria-document-boundary.ts
# Esperado: status READY, 8/8 checks pass.
```

---

## 5. Cómo refrescar este mapping

Al completarse Path A o Path B, regenerar este archivo con:

```bash
# Idea de script (no implementado todavía):
bun run scripts/probe-secretaria-plantillas-mapping.ts > docs/legal-team/$(date +%Y-%m-%d)-plantillas-mapping-uuid-cierre.md
```

Hasta que exista ese script, regenerar manualmente con la query siguiente y formatear:

```sql
SELECT
  id, tipo, materia, organo_tipo, adoption_mode, version, estado,
  aprobada_por, fecha_aprobacion, referencia_legal,
  jsonb_array_length(COALESCE(capa2_variables, '[]'::jsonb)) AS num_capa2,
  jsonb_array_length(COALESCE(capa3_editables, '[]'::jsonb)) AS num_capa3
FROM plantillas_protegidas
ORDER BY estado, tipo, materia, version;
```
