# Plantillas Core — cierre multiagente de núcleo sólido

**Fecha:** 2026-05-02
**Worktree origen:** `arga-governance-map-aims360` (orquestación) → ejecutado contra `arga-governance-map` (rama main, Secretaría)
**Modo:** opción C — combinar Path A (revisión legacy) + Path B (mejora ACTIVAS firmadas)
**Estado de evidencia:** demo / operativa. NO evidencia final productiva.

---

## 1. Misión

Establecer un **núcleo sólido de plantillas** societarias para el demo ARGA. Núcleo sólido significa:

1. Cero plantillas ACTIVAS sin aprobación formal del comité legal.
2. Cero plantillas con metadatos críticos en NULL (`organo_tipo`, `adoption_mode`, `referencia_legal`).
3. Cero plantillas con fuentes Capa 2 fuera del resolver canónico.
4. Cero placeholders huérfanos en Capa 1 (sin declaración Capa 2/3).
5. Versionado coherente (semver, no strings sueltos como `"1"`).
6. Firma legal formal por plantilla con autor, colegio, fecha.
7. Trazabilidad demo/operativa explícita en cada texto Capa 1.

---

## 2. Hallazgo crítico que disparó este plan

El brief original de cierre de plantillas (escrito el 2026-05-02 antes de este plan) usó como criterio:

```sql
WHERE estado IN ('BORRADOR', 'REVISADA')
  AND (capa1 vacía OR capa2 vacía OR capa3 vacía)
```

Esa query devuelve **cero filas** en Cloud. El criterio era incorrecto. El estado real Cloud es:

| Estado | Total | Sin capa1 | Sin capa2 | Sin capa3 | Sin aprobador formal |
|---|---|---|---|---|---|
| ACTIVA | 37 | 0 | 0 | 1 | **17** |
| ARCHIVADA | 18 | 0 | 0 | 1 | — |

Las **17 plantillas legacy reales** son `MODELO_ACUERDO` ACTIVAS con `aprobada_por IS NULL`. Tienen las 3 capas pobladas, ya operan en demo, pero **carecen de firma formal del comité legal** y la mayoría tienen metadatos null.

El equipo legal entregó 17 paquetes nuevos siguiendo el brief incorrecto. **Solo 1 de esos 17 (POLITICA_REMUNERACION) cubre una plantilla legacy real**. Las otras 16 son mejoras cualitativas a plantillas ACTIVAS ya firmadas por Comité Legal ARGA — no cierran el bloqueo declarado, pero pueden aplicarse como nuevas versiones.

---

## 3. Decisión: opción C (combinar A + B)

| Carril | Objetivo | Quién consume |
|---|---|---|
| **Path A** | Cerrar las 17 plantillas legacy reales (revisar contenido + completar nulls + firmar) | Equipo legal Garrigues |
| **Path B** | Aplicar las 16 mejoras del equipo legal como `version+1` de las ACTIVAS firmadas | Ingeniería (SQL packet propuesto, no aplicado) |

Ambos carriles son ortogonales y pueden ejecutarse en paralelo. El núcleo final post-ejecución: **37 plantillas ACTIVAS, todas firmadas formalmente**.

---

## 4. Ejecución multiagente

### 4.1. Agent A — extracción de las 17 reales

**Misión:** leer Cloud, generar 17 fichas individuales markdown listas para revisión legal.

**Output:** `/arga-governance-map/docs/legal-team/plantillas-core-revision-2026-05-02/` (17 archivos `<NN>-<materia-slug>.md`).

**Hallazgos relevantes (no esperados en el brief original):**

| Plantilla | Issue detectado por Agent A | Severidad |
|---|---|---|
| FUSION_ESCISION | Cita LSC genérica cuando aplica RDL 5/2023 (modificaciones estructurales) | **Alta — desactualización legal** |
| RATIFICACION_ACTOS | No captura el listado de actos a ratificar | **Alta — riesgo de nulidad** |
| SEGUROS_RESPONSABILIDAD | No captura si la aseguradora es del propio grupo (relevante en ARGA, asegurador cotizado) | **Alta — riesgo de conflicto intra-grupo** |
| AUMENTO_CAPITAL, DISTRIBUCION_DIVIDENDOS, MODIFICACION_ESTATUTOS, NOMBRAMIENTO_AUDITOR | Usan `ENTIDAD` literal en `fuente` en vez de `entities.name` | Media — funciona por normalización pero no canónico |
| CESE_CONSEJERO ×2, NOMBRAMIENTO_CONSEJERO ×2 | Capa 2/Capa 3 con duplicidad de mismas variables | Baja — limpieza |
| DISTRIBUCION_DIVIDENDOS, REDUCCION_CAPITAL | Variables Capa 2 declaradas sin uso en Capa 1 | Baja — sobrante |
| 6 plantillas (`version="1"`) | `organo_tipo`, `adoption_mode`, `referencia_legal` en NULL | Media — completar antes de firmar |

**Verificación Agent A:** 1 query batch (17 plantillas en una consulta). 0 writes a Cloud. 17 archivos escritos. Tiempo: ~12 min.

### 4.2. Agent B — SQL packet para Path B

**Misión:** procesar el entregable bruto del equipo legal y generar SQL transaccional propuesto (no aplicado) que aplique las 16 mejoras como `version+1`.

**Output:** `/arga-governance-map/docs/legal-team/sql-drafts/2026-05-02-plantillas-core-v2-mejoras.sql` (94.5 KB / 2191 líneas).

**Estructura del packet:**

- 1 transacción `BEGIN..COMMIT` con 16 INSERTs.
- Cada INSERT crea una nueva fila en `plantillas_protegidas` con estado `BORRADOR` y versión bump.
- La fila ACTIVA original queda inalterada para rollback.
- Auto-link artifacts del frontend (`[name](http://name)`) limpiados a forma plana.
- Aprobación: `Comité Legal ARGA — Secretaría Societaria (demo-operativo)`, fecha `2026-05-02`.
- SELECT post-aplicación verifica que aparezcan 16 filas BORRADOR.

**Mapping UUID Cloud → versión bump:**

| # | tipo + materia | UUID original | versión actual → nueva |
|---|---|---|---|
| 01 | CONVOCATORIA / CONVOCATORIA_JUNTA | `76c3260e-2be6-4969-8b21-e3d6b720e38f` | 1.1.0 → 1.2.0 |
| 02 | CONVOCATORIA_SL_NOTIFICACION | `1e1a7755-de14-4fdc-a913-e19fbe48d64c` | 1.1.0 → 1.2.0 |
| 03 | ACTA_SESION / JUNTA_GENERAL | `53b34d3e-a87d-4378-928a-b03d339cb65c` | 1.1.0 → 1.2.0 |
| 04 | ACTA_SESION / CONSEJO_ADMIN | `36c28a8c-cbe1-4692-90fd-768a83c26480` | 1.1.0 → 1.2.0 |
| 05 | CERTIFICACION | `ca3df363-139a-41aa-8c21-37c7a68bddc7` | 1.2.0 → 1.3.0 |
| 06 | INFORME_DOCUMENTAL_PRE | `438fa893-9704-48ee-91b3-9966e6f4df63` | 1.0.1 → 1.1.0 |
| 07 | INFORME_PRECEPTIVO | `4c2644ec-474e-486e-9893-28b5167a6bfc` | 1.0.1 → 1.1.0 |
| 08 | ACTA_ACUERDO_ESCRITO | `1b1118a6-577d-45ed-96ee-77be89358aa0` | 1.2.0 → 1.3.0 |
| 09 | ACTA_CONSIGNACION / DECISION_SOCIO_UNICO | `6f43fcce-4893-4636-b1d2-551ba6db92fb` | 1.1.0 → 1.2.0 |
| 10 | ACTA_CONSIGNACION / DECISION_ADMIN_UNICO | `56bcbb33-b603-4025-9393-c5ad84ba3808` | 1.1.0 → 1.2.0 |
| 11 | ACTA_DECISION_CONJUNTA | `1e3b82a7-fffc-4a72-8851-b1e0f1649093` | 1.0.0 → 1.1.0 |
| 12 | ACTA_ORGANO_ADMIN | `b2409fb5-eb14-480b-89f4-66c72f1cbc5d` | 1.0.0 → 1.1.0 |
| 13 | MODELO_ACUERDO / APROBACION_CUENTAS | `affa4219-9b3d-4ded-8c5a-2ed304738c4f` | 1.0.0 → 1.1.0 |
| 14 | MODELO_ACUERDO / FORMULACION_CUENTAS | `389b0205-8639-49a6-aa5c-777413ea8471` | 1.0.0 → 1.1.0 |
| 15 | MODELO_ACUERDO / DELEGACION_FACULTADES | `0b1beb86-5a19-45ba-8d0c-68e176844ac2` | 1.0.0 → 1.1.0 |
| 16 | MODELO_ACUERDO / OPERACION_VINCULADA | `73669c41-0c1e-4616-bfc6-ca9b67277623` | 1.0.0 → 1.1.0 |

**Detalle importante sobre fidelidad de contenido:**

- Plantillas 01, 02, 03: **texto Capa 1 NUEVO del equipo legal** (con bloque cotizada, idempotencia, QTSP refs).
- Plantillas 04-16: **texto Capa 1 PRESERVADO del Cloud actual** porque el archivo legal solo trae encabezado para ellas. El packet formaliza el commit del comité sin inventar texto donde no lo entregaron. Mejoras estructurales pendientes de entrega completa por parte del equipo legal.

**Verificación Agent B:** 5 SELECTs Cloud. 0 writes. 1 archivo SQL. Tiempo: ~12 min.

---

## 5. Path A — brief corregido para 17 legacy reales

Documento entregable: `/arga-governance-map/docs/legal-team/2026-05-02-brief-corregido-17-plantillas-legacy.md`.

Cada una de las 17 plantillas tiene su ficha individual en el directorio `plantillas-core-revision-2026-05-02/`. La tarea por plantilla es **revisión + completado + firma**, no creación desde cero.

Checklist mínimo por plantilla:

1. Validar texto Capa 1 actual (correcto, vigente, sin nombres reales).
2. Validar fuentes Capa 2 (todas en lista canónica del resolver).
3. Validar Capa 3 (obligatoriedades coherentes).
4. Completar `organo_tipo` si es null (6 plantillas).
5. Completar `adoption_mode` si es null (6 plantillas).
6. Completar `referencia_legal` si es null (6 plantillas).
7. Bumpear versión: `0.1.0` → `1.0.0`, `"1"` → `1.0.0`, `1.0.0` → `1.1.0`.
8. Firmar: `aprobada_por`, `fecha_aprobacion`.

Atención especial a las 3 plantillas con riesgos jurídicos altos detectados por Agent A:

- **FUSION_ESCISION** (`e3697ad9-...`): actualizar referencia legal a RDL 5/2023.
- **RATIFICACION_ACTOS** (`edd5c389-...`): completar Capa 3 con campo obligatorio para listado de actos ratificados.
- **SEGUROS_RESPONSABILIDAD** (`df75cda9-...`): completar Capa 3 con flag conflicto intra-grupo asegurador.

---

## 6. Decisión sobre Path B antes de aplicar

El SQL packet está listo pero **NO aplicado**. Antes de aplicar:

1. **Revisión legal del SQL** por parte del comité legal Garrigues (1-2 horas).
2. **Validación cruzada**: confirmar que las 12 plantillas con texto preservado de Cloud no se degradan con la versión bump.
3. **Decisión sobre aprobación implícita**: el packet asume que el comité legal aprueba aplicar el cambio de versión como acto formal aunque el texto en sí no cambie en 12 plantillas. Esa interpretación legal debe confirmarse.
4. **Plan de promoción a ACTIVA**: tras aplicar el packet, las nuevas filas quedan en BORRADOR. El paso `BORRADOR → ACTIVA` + archivado de versión anterior requiere un segundo SQL packet.
5. **`db:check-target` antes de aplicar**: obligatorio. Cloud `governance_OS` (`hzqwefkwsxopwrmtksbg`).

---

## 7. Núcleo sólido — definición operativa

Tras ejecutar Path A + Path B, el inventario `plantillas_protegidas` quedaría:

| Cohorte | Cuántas | Estado | Notas |
|---|---|---|---|
| ACTIVAS firmadas por Comité Legal ARGA, sin upgrade pendiente | 4 | Estables | COMISION_DELEGADA, INFORME_GESTION (con capa3 vacía → gap), MODELO_ACUERDO/ACTIVOS_ESENCIALES, MODELO_ACUERDO/AUTORIZACION_GARANTIA |
| ACTIVAS firmadas + upgrade aplicado vía Path B | 16 | Versión+1 ACTIVA, anterior ARCHIVADA | Tras BORRADOR → ACTIVA |
| ACTIVAS legacy + firma vía Path A | 17 | Firmadas + metadatos completos + versionado coherente | Tras revisión y firma |
| ARCHIVADAS | 18+16 | Histórico | Sumar las 16 desplazadas por Path B |

**Total núcleo activo:** 37 plantillas firmadas formalmente.

---

## 8. Reglas operativas para que el núcleo se mantenga sólido

1. **Cero `db push`** de plantillas. Toda mutación pasa por SQL packet propuesto + revisión + aplicación supervisada.
2. **Firma obligatoria al promover a ACTIVA**: no debe poder existir una plantilla ACTIVA con `aprobada_por IS NULL`. Esta regla es un check de probe (no un constraint de schema todavía — fuera de scope).
3. **Metadatos obligatorios**: `organo_tipo`, `adoption_mode`, `referencia_legal` deben estar pobladas antes de promover.
4. **Versionado semver**: `MAJOR.MINOR.PATCH`. Cero strings sueltos como `"1"`.
5. **Texto Capa 1 incluye disclaimer demo/operativo** mientras no exista evidencia final productiva.
6. **Fuentes Capa 2 dentro del resolver canónico**: si una variable necesita una fuente nueva, abrir ticket para ingeniería (extender el resolver) o reasignar a Capa 3 (USUARIO).
7. **Workflow de promoción**: `BORRADOR → REVISADA → APROBADA → ACTIVA`. La promoción `APROBADA → ACTIVA` requiere visto bueno de operaciones.

---

## 9. Riesgos y mitigaciones

| # | Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|---|
| R1 | Path B aplicado sin revisión legal del SQL → cambios estructurales no firmados en plantillas críticas | Media | Alto | Packet en BORRADOR no auto-promovido. Plan de promoción separado con visto bueno legal explícito |
| R2 | Equipo legal cierra Path A sin actualizar FUSION_ESCISION → plantilla activa con cita legal derogada | Alta si pasa desapercibido | Crítico para validez registral | Brief corregido marca FUSION_ESCISION como prioridad; checklist obligatorio |
| R3 | Las 12 plantillas con texto preservado de Cloud nunca reciben mejoras estructurales del equipo legal | Alta | Medio | Documentar en mapping como deuda; abrir ticket para entrega completa |
| R4 | Usuario aplica el packet sin `db:check-target` previo | Baja | Crítico (target wrong) | Comentario al inicio del SQL recuerda el check |
| R5 | Promoción BORRADOR → ACTIVA antes de archivar la versión anterior → 2 plantillas ACTIVAS para mismo (tipo, materia) | Media | Medio | Constraint de unicidad parcial recomendado en plantilla SQL futuro |
| R6 | Capa 3 vacía en INFORME_GESTION (ACTIVA) y INFORME_PRECEPTIVO (ARCHIVADA) no se aborda | Existente | Bajo (la archivada no afecta) | INFORME_GESTION debe entrar en backlog del equipo legal aunque no estaba en las 17 |
| R7 | Auto-link artifacts no detectados en otras partes del entregable legal | Baja | Bajo | Agent B aplicó regex; revisar SQL antes de aplicar |
| R8 | Versiones Cloud declaradas en este plan se desincronizan si alguien aplica cambios entre ahora y la aplicación del packet | Media | Bajo | El SQL del packet usa `INSERT` con versiones fijas; conflicto se manifestaría como error de unicidad detectable |

---

## 10. Próximos pasos

1. **Equipo legal Garrigues** recibe el brief corregido (`docs/legal-team/2026-05-02-brief-corregido-17-plantillas-legacy.md`) y las 17 fichas individuales.
2. **Equipo legal Garrigues** revisa el SQL packet (`docs/legal-team/sql-drafts/2026-05-02-plantillas-core-v2-mejoras.sql`) y aprueba/rechaza la aplicación.
3. **Ingeniería** ejecuta `bun run db:check-target` y aplica el SQL packet con credencial admin si está aprobado, en la sesión privilegiada que el closeout Secretaría declaró pendiente.
4. **Equipo legal Garrigues** completa Path A entregando 17 fichas firmadas con metadatos completos.
5. **Ingeniería** convierte las 17 firmadas a UPDATEs SQL y aplica.
6. **Probe final**: query Cloud post-aplicación esperando 0 plantillas ACTIVA con `aprobada_por IS NULL`.

---

## 11. Verificación gates antes de aplicar (resumen)

| Gate | Quién | Qué |
|---|---|---|
| 1 | Comité Legal Garrigues | Revisión jurídica de las 17 fichas (Path A) |
| 2 | Comité Legal Garrigues | Revisión jurídica del SQL packet (Path B) |
| 3 | Ingeniería | `bun run db:check-target` antes de cualquier aplicación |
| 4 | Ingeniería | Aplicar SQL packet B en transacción; abortar si error |
| 5 | Ingeniería | Aplicar UPDATEs A en transacción; abortar si error |
| 6 | Ingeniería | Probe final: `SELECT COUNT(*) FROM plantillas_protegidas WHERE estado='ACTIVA' AND aprobada_por IS NULL;` debe ser 0 |
| 7 | Probe boundary existente | `bun run scripts/probe-secretaria-document-boundary.ts` mantiene status READY |

---

## 12. Inventario de artefactos generados por este corte

| Artefacto | Path | Generado por |
|---|---|---|
| Plan maestro (este doc) | `docs/superpowers/plans/2026-05-02-plantillas-core-multiagent-cierre.md` | Síntesis manual |
| Entregable bruto legal (archivado) | `docs/legal-team/2026-05-02-paquete-17-plantillas-entregable-legal.md` | Conversación legal team |
| 17 fichas Path A | `docs/legal-team/plantillas-core-revision-2026-05-02/01..17-*.md` | Agent A |
| Brief corregido legal | `docs/legal-team/2026-05-02-brief-corregido-17-plantillas-legacy.md` | Síntesis manual |
| Mapping UUID-cierre | `docs/legal-team/2026-05-02-plantillas-mapping-uuid-cierre.md` | Síntesis manual |
| SQL packet Path B | `docs/legal-team/sql-drafts/2026-05-02-plantillas-core-v2-mejoras.sql` | Agent B |

---

## 13. Cierre obligatorio (CLAUDE.md)

```md
Documentation and memory:
- Project docs updated:
  - docs/superpowers/plans/2026-05-02-plantillas-core-multiagent-cierre.md (este plan)
  - docs/legal-team/2026-05-02-paquete-17-plantillas-entregable-legal.md
  - docs/legal-team/plantillas-core-revision-2026-05-02/ (17 archivos)
  - docs/legal-team/2026-05-02-brief-corregido-17-plantillas-legacy.md
  - docs/legal-team/2026-05-02-plantillas-mapping-uuid-cierre.md
  - docs/legal-team/sql-drafts/2026-05-02-plantillas-core-v2-mejoras.sql
- Memory key: patterns/secretaria-plantillas-core-multiagent-cierre-2026-05-02
- Stable lesson recorded: yes (criterio de "núcleo sólido": cero ACTIVAS sin firma + cero metadatos null + fuentes canónicas + versionado semver)
- No secrets stored: yes

Data contract:
- Tables used: plantillas_protegidas (read-only durante este corte)
- Source of truth: Cloud Supabase governance_OS (hzqwefkwsxopwrmtksbg)
- Migration required: no para este corte; SQL packet propuesto requiere autorización separada
- Types affected: ninguno
- Cross-module contracts: el boundary V1 (document-generation-boundary.ts) sigue vigente; las 37 ACTIVAS son consumibles vía template_id en SecretariaDocumentGenerationRequestV1
- Parity risk: bajo; las nuevas filas BORRADOR no afectan flujos demo hasta promoción

Verification:
- db:check-target: passed (governance_OS confirmado antes de Agent A y B)
- Typecheck: no aplica (cambio doc-only en este corte)
- Tests: no aplica
- Build/lint/e2e: no aplica
- Cloud reads (Agent A): 1 query batch de 17 plantillas
- Cloud reads (Agent B): 5 queries de resolución UUID + dump
- Cloud writes: 0
- Files written: 24 (1 plan + 1 entregable + 17 fichas + 1 brief + 1 mapping + 1 SQL + 1 archivo legal pre-existente actualizado)
```
