# Encargo al Comité Legal Garrigues — cierre de núcleo de plantillas societarias

**De:** Equipo de ingeniería TGMS Secretaría Societaria
**Para:** Comité Legal Garrigues — Secretaría Societaria
**Asunto:** Revisión, completado y firma formal de 17 plantillas legacy + revisión del SQL de aplicación de 16 mejoras
**Fecha:** 2026-05-02
**Plazo orientativo:** 3 semanas (1 semana para las 3 críticas; 2 semanas adicionales para el resto)
**Cliente:** Demo ARGA (pseudónimo ficticio de gran grupo asegurador cotizado)
**Estado de evidencia:** demo / operativa. No constituye evidencia final productiva.

---

## 1. Resumen ejecutivo

El sistema TGMS Secretaría Societaria genera documentos a partir de **plantillas protegidas** estructuradas en tres capas (texto inmutable, variables auto-resueltas, campos editables). Hay actualmente **37 plantillas ACTIVAS** en producción demo. Tras una auditoría técnica, se identifican **dos bloques de trabajo** que requieren intervención del Comité Legal:

### Bloque A — 17 plantillas ACTIVAS sin firma formal del Comité Legal

Llevan operando en demo pero carecen de aprobación documentada (`aprobada_por` y `fecha_aprobacion` están en blanco). Algunas además tienen metadatos jurídicos sin completar (`organo_tipo`, `adoption_mode`, `referencia_legal`).

**Tarea:** revisar contenido existente, completar metadatos faltantes, firmar formalmente.

**3 plantillas con riesgos jurídicos detectados que requieren atención prioritaria** (detalle en sección 4).

### Bloque B — Aplicación de 16 plantillas mejoradas como nuevas versiones

El propio Comité ya firmó previamente 16 plantillas como `Comité Legal ARGA — Secretaría Societaria (demo-operativo)`. Recientemente se han redactado versiones mejoradas de estas mismas plantillas (incorporando bloque cotizada, idempotencia, referencias QTSP).

Existe un **paquete SQL preparado** que aplicaría esas mejoras como `version + 1` (manteniendo la versión anterior intacta para rollback). El paquete está **propuesto, no aplicado**.

**Tarea:** revisar el paquete SQL antes de autorizar su aplicación.

---

## 2. Contexto técnico mínimo

### 2.1. Estructura de una plantilla

Cada plantilla tiene tres capas:

| Capa | Naturaleza | Quién la define |
|---|---|---|
| **Capa 1** (`capa1_inmutable`) | Texto jurídico nuclear. Una vez aprobada, no se modifica por uso (sólo por nueva versión). | Comité Legal |
| **Capa 2** (`capa2_variables`) | Etiquetas `{{variable}}` que el sistema resuelve automáticamente desde fuentes canónicas. | Comité Legal define qué variable y qué fuente; ingeniería implementa el resolutor |
| **Capa 3** (`capa3_editables`) | Campos que el secretario rellena en cada uso, con nivel de obligatoriedad (OBLIGATORIO / RECOMENDADO / OPCIONAL / OBLIGATORIO_SI_TELEMATICA). | Comité Legal |

### 2.2. Workflow de promoción

`BORRADOR → REVISADA → APROBADA → ACTIVA` (con `ARCHIVADA` para versiones reemplazadas).

Una plantilla `ACTIVA` está siendo usada en demo. Una nueva versión nace en `BORRADOR` y debe ser revisada y aprobada antes de promover.

### 2.3. Estado actual Cloud (proyecto `governance_OS`)

| Estado | Total | Notas |
|---|---|---|
| ACTIVA | 37 | 20 firmadas formalmente, 17 sin firma (Bloque A) |
| ARCHIVADA | 18 | Histórico de versiones reemplazadas |

---

## 3. Bloque A — Las 17 plantillas legacy a cerrar

### 3.1. Inventario completo

Todas son `MODELO_ACUERDO`. Detalle por UUID en archivo individual: `/docs/legal-team/plantillas-core-revision-2026-05-02/<NN>-<materia-slug>.md`. Cada archivo trae el contenido actual Cloud + checklist específico.

| # | UUID | Materia | Prioridad | Acción principal |
|---|---|---|---|---|
| 1 | `68da89bc-03cd-4820-80f1-8a549b0c7d78` | APROBACION_PLAN_NEGOCIO | Media | Revisar + firmar |
| 2 | `2d814072-3fb0-4ffd-a181-875d9c4a5c0d` | AUMENTO_CAPITAL | Alta | Revisar redacción + firmar |
| 3 | `ba214d42-1933-497f-a2c0-0867c7c7a55f` | CESE_CONSEJERO (Consejo) | Media | Revisar + firmar |
| 4 | `433da411-ba65-410c-8375-24db637f7e75` | CESE_CONSEJERO (Junta) | Media | Revisar + firmar |
| 5 | `313e7609-8b11-4ef5-a8fd-e9fdcf99d22c` | COMITES_INTERNOS | Alta | Completar 3 metadatos null + firmar |
| 6 | `a09cc4bf-c927-470a-b392-43d2db424279` | DISTRIBUCION_CARGOS | Alta | Completar 3 metadatos null + firmar |
| 7 | `395ca996-fdf0-4203-b7ae-f894d3012c8b` | DISTRIBUCION_DIVIDENDOS | Media | Revisar + firmar |
| 8 | `e3697ad9-e0c2-4baf-9144-c80a11808c07` | **FUSION_ESCISION** | **CRÍTICA** | **Reescribir referencia legal a RDL 5/2023** |
| 9 | `29739424-5641-42bd-8b5a-58f81ee5c471` | MODIFICACION_ESTATUTOS | Alta | Revisar redacción + firmar |
| 10 | `e64ce755-9e76-4b57-8fb7-750afb94857c` | NOMBRAMIENTO_AUDITOR | Media | Revisar + firmar |
| 11 | `27be9063-8977-44c7-b72c-eb26ecb3c49b` | NOMBRAMIENTO_CONSEJERO (Consejo) | Media | Revisar + firmar |
| 12 | `10f90d59-39d3-4633-83ff-81140eff50d5` | NOMBRAMIENTO_CONSEJERO (Junta) | Media | Revisar + firmar |
| 13 | `ee72efde-299b-42fc-86ba-57e29a187a7c` | POLITICA_REMUNERACION | Alta | Completar 3 metadatos null + firmar |
| 14 | `b846bb03-9329-4470-840b-30d614adc613` | POLITICAS_CORPORATIVAS | Alta | Completar 3 metadatos null + firmar |
| 15 | `edd5c389-0187-476c-9592-c020058fdc69` | **RATIFICACION_ACTOS** | **CRÍTICA** | **Añadir Capa 3 obligatoria con listado de actos ratificados** |
| 16 | `c06957aa-ce9d-4560-9d4e-501756ed5e4f` | REDUCCION_CAPITAL | Alta | Revisar redacción + firmar |
| 17 | `df75cda9-e558-43c7-a6a9-902e2c06ee97` | **SEGUROS_RESPONSABILIDAD** | **CRÍTICA** | **Añadir flag conflicto intra-grupo + bloque condicional** |

### 3.2. Tarea genérica por plantilla

Para cada UUID, abrir su ficha en `/docs/legal-team/plantillas-core-revision-2026-05-02/<NN>-<materia>.md` y completar el siguiente checklist:

- [ ] Validar texto Capa 1 actual: correcto, vigente, sin referencias derogadas, sin nombres reales de cliente.
- [ ] Validar fuentes Capa 2: todas mapean al resolver canónico (lista en sección 5).
- [ ] Validar Capa 3: obligatoriedades coherentes con la práctica societaria.
- [ ] Detectar variables Capa 1 sin declaración Capa 2/3 (placeholders huérfanos) o declaraciones sin uso (sobrante).
- [ ] Si `organo_tipo` está en blanco: completar con uno de `JUNTA_GENERAL | CONSEJO | CONSEJO_ADMIN | SOCIO_UNICO | ADMIN_UNICO | ADMIN_CONJUNTA | ADMIN_SOLIDARIOS`.
- [ ] Si `adoption_mode` está en blanco: completar con uno de `MEETING | NO_SESSION | UNIPERSONAL_SOCIO | UNIPERSONAL_ADMIN | CO_APROBACION | SOLIDARIO`.
- [ ] Si `referencia_legal` está en blanco: completar con artículos LSC/RRM aplicables.
- [ ] Bumpear `version` al firmar: `0.1.0` → `1.0.0`, `"1"` → `1.0.0`, `1.0.0` → `1.1.0`.
- [ ] Firmar: poblar `aprobada_por` (formato: `<Nombre y apellidos>, <Colegio> nº <nº>`) y `fecha_aprobacion` (YYYY-MM-DD).

---

## 4. Atención específica a las 3 plantillas críticas

### 4.1. FUSION_ESCISION (UUID `e3697ad9-...`)

**Diagnóstico técnico:** la plantilla actual cita LSC genérica para modificaciones estructurales. La normativa vigente es **Real Decreto-ley 5/2023, de 28 de junio**, sobre modificaciones estructurales de sociedades mercantiles, que sustituye y supera el régimen tradicional para fusiones, escisiones, transformaciones, cesiones globales y traslados internacionales.

**Texto Capa 1 actual** (extracto):

> "PRIMERO.- Aprobar el proyecto común de {{tipo_operacion_estructural}} de {{denominacion_social}} con {{nombre_sociedad_contraparte}}, conforme al proyecto redactado en fecha {{fecha_proyecto}} y depositado en el Registro Mercantil de {{registro_mercantil}}, de conformidad con lo previsto en los artículos {{articulos_aplicables}} de la **Ley de Sociedades de Capital**."

**Acción requerida:**

1. Reescribir Capa 1 incorporando referencia explícita a **RDL 5/2023 (TR-LME)**.
2. Revisar si los plazos, derechos de oposición, régimen de publicación y publicidad reflejan el régimen vigente.
3. Completar `organo_tipo`, `adoption_mode`, `referencia_legal` (todos en blanco actualmente).
4. Firmar.

### 4.2. RATIFICACION_ACTOS (UUID `edd5c389-...`)

**Diagnóstico técnico:** la plantilla no captura el listado de actos a ratificar. Sin ese campo, una ratificación sería genérica y susceptible de impugnación por **indeterminación del objeto ratificado**.

**Acción requerida:**

1. Añadir a Capa 3 un campo `OBLIGATORIO` para listado de actos ratificados (texto libre estructurado o array de objetos).
2. Referenciar ese campo en Capa 1 mediante `{{listado_actos_ratificados}}` o equivalente.
3. Validar que la formulación captura: identificación del acto, fecha, partes intervinientes, efectos pretendidos.
4. Firmar.

### 4.3. SEGUROS_RESPONSABILIDAD (UUID `df75cda9-...`)

**Diagnóstico técnico:** ARGA es asegurador cotizado en el demo. Si la aseguradora del seguro de responsabilidad de administradores fuera del propio grupo, se genera **conflicto de interés y operación vinculada** que la plantilla actual no captura.

**Acción requerida:**

1. Añadir a Capa 3 un campo `OBLIGATORIO` flag "aseguradora del grupo (sí/no)".
2. Si "sí", añadir bloque condicional en Capa 1 con tratamiento de conflicto:
   - Abstención del consejero afectado.
   - Soporte de mercado independiente (referencia documental).
   - Decisión de Consejo con mayoría reforzada o, si supera umbrales aplicables, derivación a Junta General conforme a normativa de operaciones vinculadas.
3. Completar metadatos null.
4. Firmar.

---

## 5. Glosario de fuentes Capa 2 (para validación de variables)

Cualquier variable Capa 2 debe declarar una `fuente` que mapee a una de estas categorías:

| Prefijo | Categoría | Resuelve |
|---|---|---|
| `entities.*` o `agreement.*`/`agreements.*` | ENTIDAD/EXPEDIENTE | Sociedad: denominación, CIF, domicilio, registro mercantil, datos del expediente del acuerdo |
| `governing_bodies.*` o `mandate.*` | ORGANO | Órgano: presidente, secretario, miembros, fecha de constitución |
| `meetings.*` | REUNION | Reunión: fecha, lugar, hora, asistentes, orden del día, votaciones |
| `capital_holdings.*` o `cap_table.*` o `parte_votante.*` | CAP_TABLE | Libro de socios: lista, % capital, % voto |
| `persons.*` | PERSONA | Personas físicas/jurídicas: nombre completo, NIF |
| `LEY` / `ESTATUTOS` / `PACTO_PARASOCIAL` / `REGLAMENTO` | Snapshot del motor de reglas | Constantes legales y referencias normativas vigentes |
| `rule_pack.*` / `evaluar*` / `calcular*` | Snapshot del motor de reglas | Resultados del motor: quórum observado/requerido, mayorías, gates de validación |
| `QTSP.*` / `SISTEMA.*` | Capa técnica | Firma electrónica cualificada, sello de tiempo, fecha de emisión |
| `USUARIO` | Capa 3 | Input humano por secretario en cada uso |

Si una plantilla declara una fuente fuera de esta lista, marcar como **PENDIENTE_INGENIERIA** con descripción del dato necesario. Ingeniería decide si extender el resolver o reasignar a Capa 3.

### Hallazgos técnicos no críticos detectados (información para el Comité)

- **5 plantillas usan `ENTIDAD` literal** en `fuente` en lugar de `entities.name` (no canónico, funciona por normalización del resolver). Plantillas: AUMENTO_CAPITAL, DISTRIBUCION_DIVIDENDOS, MODIFICACION_ESTATUTOS, NOMBRAMIENTO_AUDITOR. Estandarizar al firmar es opcional.
- **2 plantillas con variables Capa 2 declaradas sin uso en Capa 1** (sobrantes, no bloqueantes): DISTRIBUCION_DIVIDENDOS (`denominacion_social`), REDUCCION_CAPITAL (`tipo_social`). Limpiar al firmar es opcional.
- **4 plantillas con duplicidad Capa 2/Capa 3** (CESE_CONSEJERO ×2, NOMBRAMIENTO_CONSEJERO ×2): mismas variables declaradas en ambas capas. Limpiar al firmar es opcional.

---

## 6. Bloque B — Revisión del SQL packet (16 mejoras)

### 6.1. Qué es el packet

Archivo: `/docs/legal-team/sql-drafts/2026-05-02-plantillas-core-v2-mejoras.sql` (94.5 KB / 2191 líneas).

Contiene una transacción `BEGIN..COMMIT` con **16 instrucciones INSERT** que crean nuevas filas en `plantillas_protegidas` (estado `BORRADOR`, versión `+1`) sobre las 16 plantillas que el Comité ya tenía firmadas. Las filas originales `ACTIVA` quedan inalteradas para rollback.

### 6.2. Las 16 plantillas afectadas

| Tipo | Materia | Versión actual → nueva |
|---|---|---|
| CONVOCATORIA | CONVOCATORIA_JUNTA | 1.1.0 → 1.2.0 |
| CONVOCATORIA_SL_NOTIFICACION | NOTIFICACION_CONVOCATORIA_SL | 1.1.0 → 1.2.0 |
| ACTA_SESION | JUNTA_GENERAL | 1.1.0 → 1.2.0 |
| ACTA_SESION | CONSEJO_ADMIN | 1.1.0 → 1.2.0 |
| CERTIFICACION | CERTIFICACION_ACUERDOS | 1.2.0 → 1.3.0 |
| INFORME_DOCUMENTAL_PRE | EXPEDIENTE_PRE | 1.0.1 → 1.1.0 |
| INFORME_PRECEPTIVO | CONVOCATORIA_PRE | 1.0.1 → 1.1.0 |
| ACTA_ACUERDO_ESCRITO | ACUERDO_SIN_SESION | 1.2.0 → 1.3.0 |
| ACTA_CONSIGNACION | DECISION_SOCIO_UNICO | 1.1.0 → 1.2.0 |
| ACTA_CONSIGNACION | DECISION_ADMIN_UNICO | 1.1.0 → 1.2.0 |
| ACTA_DECISION_CONJUNTA | CO_APROBACION | 1.0.0 → 1.1.0 |
| ACTA_ORGANO_ADMIN | ADMIN_SOLIDARIO | 1.0.0 → 1.1.0 |
| MODELO_ACUERDO | APROBACION_CUENTAS | 1.0.0 → 1.1.0 |
| MODELO_ACUERDO | FORMULACION_CUENTAS | 1.0.0 → 1.1.0 |
| MODELO_ACUERDO | DELEGACION_FACULTADES | 1.0.0 → 1.1.0 |
| MODELO_ACUERDO | OPERACION_VINCULADA | 1.0.0 → 1.1.0 |

### 6.3. Categorización por nivel de cambio

| Categoría | Cantidad | Detalle |
|---|---|---|
| **Texto Capa 1 nuevo** (mejora estructural sustantiva) | 3 | CONVOCATORIA, CONVOCATORIA_SL_NOTIFICACION, ACTA_SESION JUNTA_GENERAL — incluyen bloque cotizada condicional, idempotencia, referencias QTSP |
| **Texto Capa 1 preservado** (commit formal sin cambio sustantivo) | 13 | El packet bumpa la versión y formaliza el commit del Comité, pero el texto Capa 1 se mantiene tal cual está en Cloud porque la entrega original solo trajo encabezado para esas 13 |

### 6.4. Tarea de revisión sobre el packet

- [ ] Confirmar que el bump de versión sin cambio de texto (las 13 plantillas) es interpretable como **commit jurídico formal** del Comité aunque el contenido sustantivo no cambie. Si no procede, se descartan esas 13 entradas del packet.
- [ ] Revisar las 3 plantillas con texto Capa 1 nuevo (CONVOCATORIA, CONVOCATORIA_SL_NOTIFICACION, ACTA_SESION JUNTA_GENERAL):
   - Validar bloque cotizada condicional.
   - Validar redacción de idempotencia.
   - Validar referencias QTSP.
   - Confirmar coherencia con la práctica societaria española actual.
- [ ] Decisión: autorizar o no la aplicación del packet por ingeniería con credencial admin.
- [ ] Si se autoriza con cambios, marcar las modificaciones requeridas.

### 6.5. Después de aplicar el packet (fuera de este encargo)

Las nuevas filas quedan en estado `BORRADOR`. La promoción `BORRADOR → ACTIVA` y archivado de la versión anterior es un paso separado que requiere visto bueno legal explícito y se documentará en un encargo posterior.

---

## 7. Constraints jurídico-operativas inviolables

1. **Capa 1 es inmutable post-aprobación.** Una vez firmada y promovida a `ACTIVA`, el texto no se modifica salvo nueva versión.
2. **No inventar hechos.** Las variables Capa 2 deben resolverse desde fuentes canónicas reales. Si una variable no tiene fuente, va a Capa 3 o queda como PENDIENTE_INGENIERIA.
3. **Prohibido el uso de IA generativa en Capa 1.** El texto jurídico nuclear se redacta humanamente. Cuando exista en el sistema un carril de generación documental con asistencia IA, sólo podrá tocar bloques narrativos no críticos (`narrativa.introduccion`, `narrativa.deliberaciones`, `narrativa.incidencias_no_criticas`) bajo políticas estrictas que aún no están desplegadas.
4. **ARGA es pseudónimo demo.** El texto debe ser redactable para un gran grupo asegurador cotizado pero **no debe nombrar a ningún cliente real** ni datos identificables (NIFs reales, direcciones reales, nombres de personas reales).
5. **Esta es evidencia demo/operativa.** Las plantillas que se firmen sirven para el demo y para uso operativo interno. NO sirven como evidencia final productiva (registral, judicial). El paso a productiva requiere un paquete separado con QTSP, audit chain, retention, legal hold y aprobación explícita — fuera de este alcance.
6. **Idempotencia de generación.** El sistema deduplica solicitudes por hash de contenido. Si dos sesiones generan el mismo documento con mismos datos, el sistema produce un solo artefacto. Las plantillas deben tolerar esta semántica.
7. **Firma con identificación profesional completa.** `<Nombre y apellidos>, Colegio de Abogados de <ciudad> nº <número colegial>`. Firmas anónimas no se aceptan.

---

## 8. Formato de entrega

### 8.1. Para Bloque A (las 17 plantillas)

Para cada UUID, devolver un archivo markdown con esta estructura mínima:

```md
# <materia> — UUID <uuid>

## Decisión
[ ] Aprobada
[ ] Rechazada
[ ] Aprobada con modificaciones

## Capa 1 — texto inmutable definitivo
\`\`\`
<texto íntegro de Capa 1 a aplicar>
\`\`\`

## Capa 2 — variables
| variable | fuente | condicion |
|---|---|---|
<una fila por variable>

## Capa 3 — campos editables
| campo | obligatoriedad | descripcion |
|---|---|---|
<una fila por campo>

## Metadatos
- organo_tipo: <valor>
- adoption_mode: <valor>
- referencia_legal: <texto>
- version: <semver>

## Firma
- aprobada_por: <Nombre y apellidos>, <Colegio> nº <nº>
- fecha_aprobacion: YYYY-MM-DD

## Notas (opcional)
<observaciones, riesgos identificados, dependencias con otras plantillas>
```

Empaquetar las 17 entregas en un ZIP o carpeta compartida con permisos de lectura.

### 8.2. Para Bloque B (revisión del SQL packet)

Devolver un único documento markdown con esta estructura:

```md
# Revisión SQL packet 2026-05-02-plantillas-core-v2-mejoras.sql

## Decisión global
[ ] Autorizar aplicación íntegra
[ ] Autorizar aplicación parcial (especificar plantillas excluidas)
[ ] Rechazar — requiere modificaciones

## Plantillas con texto Capa 1 nuevo (3)
- CONVOCATORIA / CONVOCATORIA_JUNTA: [aprobar / rechazar / modificar — indicar]
- CONVOCATORIA_SL_NOTIFICACION: [aprobar / rechazar / modificar]
- ACTA_SESION / JUNTA_GENERAL: [aprobar / rechazar / modificar]

## Plantillas con bump de versión sin cambio de texto (13)
[ ] El bump como commit jurídico formal sin cambio de texto se considera procedente.
[ ] No procede — las 13 entradas se descartan del packet.

## Observaciones jurídicas
<libre>

## Firma
- revisado_por: <Nombre y apellidos>, <Colegio> nº <nº>
- fecha_revision: YYYY-MM-DD
```

### 8.3. Canal de entrega

Equipo de ingeniería TGMS. Vía habitual: mail / Teams / repositorio Git si tenéis acceso. Si entregáis vía Git, la ruta es `docs/legal-team/firmas-cierre-plantillas/2026-05-XX/...`.

---

## 9. Plazo y orden de prioridad sugeridos

| Bloque | Plantillas | Plazo |
|---|---|---|
| Críticas (Bloque A) | FUSION_ESCISION, RATIFICACION_ACTOS, SEGUROS_RESPONSABILIDAD | Semana 1 |
| Metadatos null (Bloque A) | COMITES_INTERNOS, DISTRIBUCION_CARGOS, POLITICA_REMUNERACION, POLITICAS_CORPORATIVAS | Semana 2 |
| Materia substantiva (Bloque A) | AUMENTO_CAPITAL, MODIFICACION_ESTATUTOS, REDUCCION_CAPITAL, NOMBRAMIENTO_AUDITOR | Semana 2-3 |
| Cierre rutinario (Bloque A) | resto (6 plantillas) | Semana 3 |
| Revisión SQL packet (Bloque B) | 16 plantillas mejoradas | Semana 1 (paralelo a las críticas) |

Plazo total orientativo: **3 semanas**. Negociable según disponibilidad del Comité.

---

## 10. Criterios de aceptación

### 10.1. Bloque A cerrado

- 17 entregas individuales recibidas.
- Cada entrega con firma profesional completa (nombre, colegio, número).
- Cada entrega con `organo_tipo`, `adoption_mode`, `referencia_legal` definidos (no en blanco).
- Cada entrega con versión bump aplicada conforme a la regla declarada.
- Las 3 críticas con cambios sustantivos efectivamente incorporados (RDL 5/2023, listado actos, flag intra-grupo).

### 10.2. Bloque B cerrado

- 1 documento de revisión recibido con decisión global y por-plantilla.
- Firma profesional completa.
- Si se autoriza aplicación, ingeniería puede proceder. Si se rechaza, se documenta el motivo y se devuelve a redacción.

### 10.3. Verificación post-cierre

Tras la aplicación por ingeniería, se ejecuta esta probe:

```sql
SELECT COUNT(*) FROM plantillas_protegidas
WHERE estado = 'ACTIVA' AND aprobada_por IS NULL;
-- Esperado: 0
```

Resultado 0 = núcleo sólido cerrado por el lado del Comité Legal.

---

## 11. Recursos disponibles

| Recurso | Ubicación |
|---|---|
| Las 17 fichas individuales (Bloque A) | `docs/legal-team/plantillas-core-revision-2026-05-02/01..17-*.md` |
| SQL packet (Bloque B) | `docs/legal-team/sql-drafts/2026-05-02-plantillas-core-v2-mejoras.sql` |
| Mapping consolidado UUID→cierre | `docs/legal-team/2026-05-02-plantillas-mapping-uuid-cierre.md` |
| Plan maestro de cierre | `docs/superpowers/plans/2026-05-02-plantillas-core-multiagent-cierre.md` |
| Brief técnico inicial (este encargo, versión expandida) | `docs/legal-team/2026-05-02-brief-corregido-17-plantillas-legacy.md` |

---

## 12. Contacto y dudas

Cualquier duda jurídica de modelado, mapping al sistema, ambigüedad de fuente, o conflicto entre plantillas: levantar a ingeniería antes de firmar. Es preferible **16 plantillas correctamente cerradas y 1 bloqueada** que 17 cerradas con drift jurídico.

Para temas que excedan las 17 plantillas o el SQL packet (ej. la plantilla `INFORME_GESTION` con Capa 3 vacía detectada como deuda menor), abrir hilo separado tras cerrar este encargo.

---

**Reciben este encargo:** los miembros del Comité Legal Garrigues que firmen en el ámbito Secretaría Societaria.
**Acuse de recibo:** confirmar por canal habitual con plazo estimado real.
**Conflicto con otros encargos:** comunicar lo antes posible para reordenar prioridades.
