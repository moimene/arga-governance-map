# Brief corregido equipo legal Garrigues — cierre de 17 plantillas legacy reales

> **Versión:** 2 (corregida tras ejecutar query Cloud real)
> **Reemplaza al brief inicial** que pedía definir Capa 1/2/3 desde cero. Las 17 plantillas reales **ya tienen** las 3 capas pobladas. La tarea es **revisar, completar metadatos y firmar**, no crear.
> **Audiencia:** comité legal Garrigues (Secretaría Societaria)
> **Estado de evidencia:** demo / operativa. NO evidencia final productiva.

---

## 1. Lo que ha pasado

El brief inicial usó una query incorrecta para identificar plantillas legacy. La realidad Cloud (proyecto `governance_OS`) es:

- 37 plantillas ACTIVAS, 18 ARCHIVADAS — todas con Capa 1, Capa 2 y Capa 3 pobladas (excepto 2 con Capa 3 vacía).
- 17 de las 37 ACTIVAS están **sin firma formal del comité legal** (`aprobada_por IS NULL`). Esas son las 17 legacy reales.

Esas 17 son todas `MODELO_ACUERDO`. El detalle por UUID está en el directorio `/docs/legal-team/plantillas-core-revision-2026-05-02/` — un archivo markdown por plantilla con su contenido actual de Cloud y el checklist de cierre.

---

## 2. Lista de las 17 con UUIDs y prioridad

| # | UUID | materia | organo actual | adopción actual | versión | ref. legal | prioridad |
|---|---|---|---|---|---|---|---|
| 1 | `68da89bc-03cd-4820-80f1-8a549b0c7d78` | APROBACION_PLAN_NEGOCIO | CONSEJO_ADMINISTRACION | MEETING | 0.1.0 | Art. 225 LSC | Media |
| 2 | `2d814072-3fb0-4ffd-a181-875d9c4a5c0d` | AUMENTO_CAPITAL | JUNTA_GENERAL | MEETING | 0.1.0 | Arts. 295-310 LSC | Alta |
| 3 | `ba214d42-1933-497f-a2c0-0867c7c7a55f` | CESE_CONSEJERO (CdA) | CONSEJO_ADMINISTRACION | MEETING | 1.0.0 | Arts. 223.1, 225 LSC; art. 94 RRM | Media |
| 4 | `433da411-ba65-410c-8375-24db637f7e75` | CESE_CONSEJERO (Junta) | JUNTA_GENERAL | MEETING | 1.0.0 | Arts. 223, 225 LSC; art. 94 RRM | Media |
| 5 | `313e7609-8b11-4ef5-a8fd-e9fdcf99d22c` | COMITES_INTERNOS | **NULL** | **NULL** | "1" | **NULL** | Alta — completar 3 metadatos |
| 6 | `a09cc4bf-c927-470a-b392-43d2db424279` | DISTRIBUCION_CARGOS | **NULL** | **NULL** | "1" | **NULL** | Alta — completar 3 metadatos |
| 7 | `395ca996-fdf0-4203-b7ae-f894d3012c8b` | DISTRIBUCION_DIVIDENDOS | JUNTA_GENERAL | MEETING | 0.1.0 | Arts. 273, 348 LSC | Media |
| 8 | `e3697ad9-e0c2-4baf-9144-c80a11808c07` | FUSION_ESCISION | **NULL** | **NULL** | "1" | **NULL** | **CRÍTICA** — RDL 5/2023 |
| 9 | `29739424-5641-42bd-8b5a-58f81ee5c471` | MODIFICACION_ESTATUTOS | JUNTA_GENERAL | MEETING | 0.1.0 | Arts. 285-290 LSC | Alta |
| 10 | `e64ce755-9e76-4b57-8fb7-750afb94857c` | NOMBRAMIENTO_AUDITOR | JUNTA_GENERAL | MEETING | 0.1.0 | Arts. 263-271 LSC; LAC | Media |
| 11 | `27be9063-8977-44c7-b72c-eb26ecb3c49b` | NOMBRAMIENTO_CONSEJERO (CdA) | CONSEJO_ADMINISTRACION | MEETING | 1.0.0 | Art. 244 LSC; art. 94 RRM | Media |
| 12 | `10f90d59-39d3-4633-83ff-81140eff50d5` | NOMBRAMIENTO_CONSEJERO (Junta) | JUNTA_GENERAL | MEETING | 1.0.0 | Arts. 214, 217-219 LSC; art. 94 RRM | Media |
| 13 | `ee72efde-299b-42fc-86ba-57e29a187a7c` | POLITICA_REMUNERACION | **NULL** | **NULL** | "1" | **NULL** | Alta — completar 3 metadatos |
| 14 | `b846bb03-9329-4470-840b-30d614adc613` | POLITICAS_CORPORATIVAS | **NULL** | **NULL** | "1" | **NULL** | Alta — completar 3 metadatos |
| 15 | `edd5c389-0187-476c-9592-c020058fdc69` | RATIFICACION_ACTOS | CONSEJO_ADMINISTRACION | MEETING | 0.1.0 | Arts. 234-235 LSC | **CRÍTICA** — riesgo nulidad |
| 16 | `c06957aa-ce9d-4560-9d4e-501756ed5e4f` | REDUCCION_CAPITAL | JUNTA_GENERAL | MEETING | 0.1.0 | Arts. 317-342 LSC | Alta |
| 17 | `df75cda9-e558-43c7-a6a9-902e2c06ee97` | SEGUROS_RESPONSABILIDAD | **NULL** | **NULL** | "1" | **NULL** | **CRÍTICA** — conflicto intra-grupo ARGA |

### Resumen de bloques

| Bloque | Plantillas | Tarea común |
|---|---|---|
| **Crítica** (3) | FUSION_ESCISION, RATIFICACION_ACTOS, SEGUROS_RESPONSABILIDAD | Reescribir referencia legal o completar campos críticos antes de firmar |
| **Alta** (8) | AUMENTO_CAPITAL, COMITES_INTERNOS, DISTRIBUCION_CARGOS, MODIFICACION_ESTATUTOS, POLITICA_REMUNERACION, POLITICAS_CORPORATIVAS, REDUCCION_CAPITAL, NOMBRAMIENTO_AUDITOR | Revisar + completar metadatos null + firmar |
| **Media** (6) | APROBACION_PLAN_NEGOCIO, CESE_CONSEJERO ×2, DISTRIBUCION_DIVIDENDOS, NOMBRAMIENTO_CONSEJERO ×2 | Revisar + firmar (metadatos ya completos) |

---

## 3. Tarea por plantilla

Para CADA UUID de la tabla anterior, abrir el archivo correspondiente en:

`/docs/legal-team/plantillas-core-revision-2026-05-02/<NN>-<materia-slug>.md`

Cada archivo trae el contenido **actual** de Cloud (Capa 1 + Capa 2 + Capa 3 + metadatos) y un checklist específico. La acción es:

### 3.1. Validar contenido existente

- [ ] Leer Capa 1 actual completa.
- [ ] Confirmar que el texto jurídico es correcto y vigente. Si hay artículos derogados o redacciones obsoletas, marcar y proponer reemplazo.
- [ ] Confirmar que NO hay nombres reales de cliente, NIFs reales ni direcciones reales (ARGA es pseudónimo demo).
- [ ] Validar que las fuentes Capa 2 declaradas mapean al resolver canónico (lista en sección 5).
- [ ] Validar que los campos Capa 3 con `OBLIGATORIO` son realmente críticos.
- [ ] Detectar y reportar: variables Capa 1 sin declaración Capa 2/3, declaraciones Capa 2/3 no usadas en Capa 1.

### 3.2. Completar metadatos faltantes

Para las 6 plantillas con campos NULL:

- [ ] `organo_tipo`: uno de `JUNTA_GENERAL | CONSEJO | CONSEJO_ADMIN | SOCIO_UNICO | ADMIN_UNICO | ADMIN_CONJUNTA | ADMIN_SOLIDARIOS`.
- [ ] `adoption_mode`: uno de `MEETING | NO_SESSION | UNIPERSONAL_SOCIO | UNIPERSONAL_ADMIN | CO_APROBACION | SOLIDARIO`.
- [ ] `referencia_legal`: artículos LSC/RRM aplicables, normativa específica si procede (ej. RDL 5/2023 para FUSION_ESCISION).

### 3.3. Bumpear versión

| Versión actual | Versión nueva al firmar |
|---|---|
| `0.1.0` | `1.0.0` (promoción de draft a release formal) |
| `"1"` (string suelto) | `1.0.0` (normalizar a semver) |
| `1.0.0` | `1.1.0` (refresh del comité) |

### 3.4. Firmar formalmente

- [ ] `aprobada_por`: nombre completo + colegio profesional + número colegial.
- [ ] `fecha_aprobacion`: YYYY-MM-DD.

---

## 4. Atención prioritaria a las 3 plantillas críticas

### 4.1. FUSION_ESCISION (`e3697ad9-...`)

**Problema detectado por el agente técnico:** la plantilla cita LSC genérica para modificaciones estructurales. La normativa vigente es **RDL 5/2023, de 28 de junio**, sobre modificaciones estructurales de sociedades mercantiles, que sustituye y supera el régimen LSC tradicional para fusiones, escisiones, transformaciones, cesiones globales y traslados internacionales.

**Acción:**

1. Reescribir Capa 1 incorporando referencia explícita a RDL 5/2023 (TR-LME).
2. Revisar si los plazos, derechos de oposición y régimen de publicación reflejan el régimen actual.
3. Completar metadatos `organo_tipo`, `adoption_mode`, `referencia_legal`.
4. Firmar.

### 4.2. RATIFICACION_ACTOS (`edd5c389-...`)

**Problema detectado:** la plantilla no captura el listado de actos a ratificar. Sin ese campo, una ratificación sería genérica y susceptible de impugnación por indeterminación.

**Acción:**

1. Añadir a Capa 3 un campo `OBLIGATORIO` para listado de actos ratificados (texto largo o array estructurado).
2. Referenciar ese campo en Capa 1.
3. Validar que la formulación captura: identificación del acto, fecha, partes, efectos pretendidos.
4. Firmar.

### 4.3. SEGUROS_RESPONSABILIDAD (`df75cda9-...`)

**Problema detectado:** ARGA es asegurador cotizado. Si la aseguradora del seguro de responsabilidad de administradores fuera del propio grupo, hay conflicto de interés que la plantilla actual no captura.

**Acción:**

1. Añadir a Capa 3 un campo flag `OBLIGATORIO` para "aseguradora del grupo (sí/no)".
2. Si "sí", añadir bloque condicional en Capa 1 con tratamiento de conflicto (abstención del consejero afectado, soporte de mercado independiente, decisión de Consejo con mayoría reforzada o derivación a Junta según normativa de operaciones vinculadas).
3. Completar metadatos null.
4. Firmar.

---

## 5. Glosario fuentes Capa 2 (recordatorio)

Toda variable Capa 2 debe declarar una `fuente` que mapee a una de estas categorías:

| Prefijo | Categoría resolver | Resuelve |
|---|---|---|
| `entities.*` o `agreement.*`/`agreements.*` | ENTIDAD/EXPEDIENTE | Sociedad, datos registrales, expediente acuerdo |
| `governing_bodies.*` o `mandate.*` | ORGANO | Órgano: presidente, secretario, miembros |
| `meetings.*` | REUNION | Reunión: fecha, lugar, asistentes, votaciones |
| `capital_holdings.*` o `cap_table.*` o `parte_votante.*` | CAP_TABLE | Libro socios, % capital, % voto |
| `persons.*` | PERSONA | Personas: nombre, NIF |
| `LEY` / `ESTATUTOS` / `PACTO_PARASOCIAL` / `REGLAMENTO` | Snapshot motor | Constantes legales |
| `rule_pack.*` / `evaluar*` / `calcular*` | Snapshot motor | Resultados motor de reglas (quórum, mayorías, gates) |
| `QTSP.*` / `SISTEMA.*` | Técnico | Firma electrónica, sello tiempo, fecha emisión |
| `USUARIO` | Capa 3 | Input humano por secretario |

Si una plantilla declara una fuente fuera de esta lista, marcar como **PENDIENTE_INGENIERIA** y describir el dato necesario.

---

## 6. Hallazgos técnicos del agente que merece atención

El agente técnico detectó issues no críticos pero limpiables:

- **5 plantillas usan `ENTIDAD` literal** como fuente (en lugar de `entities.name`): AUMENTO_CAPITAL, DISTRIBUCION_DIVIDENDOS, MODIFICACION_ESTATUTOS, NOMBRAMIENTO_AUDITOR. Funciona por normalización del resolver pero no es canónico. **Acción opcional**: estandarizar al firmar.
- **2 plantillas con variables Capa 2 declaradas sin uso en Capa 1**: DISTRIBUCION_DIVIDENDOS (`denominacion_social`), REDUCCION_CAPITAL (`tipo_social`). **Acción opcional**: eliminar del array Capa 2 o usar en Capa 1.
- **4 plantillas con duplicidad Capa 2/Capa 3**: CESE_CONSEJERO ×2, NOMBRAMIENTO_CONSEJERO ×2. **Acción opcional**: limpiar duplicados.

Estos issues no bloquean la firma. Pueden cerrarse en una iteración futura.

---

## 7. Constraints jurídico-operativas inviolables

1. Capa 1 **inmutable post-aprobación**. Una vez `ACTIVA` y firmada, el texto no se cambia salvo bumpear versión y promover una nueva.
2. **No inventar hechos**: variables Capa 2 deben resolverse desde fuentes canónicas reales. Si no existe, va a Capa 3 (USUARIO).
3. **No usar IA generativa** para texto Capa 1. El texto jurídico se redacta humanamente. La IA, cuando exista en el carril futuro, solo tocará bloques narrativos no críticos en `narrativa.*`.
4. **ARGA es pseudónimo demo**. Sin nombres reales, sin NIFs reales, sin direcciones reales.
5. **Evidencia demo/operativa**, no productiva. El texto Capa 1 incluye disclaimer.
6. **Firma con nombre + colegio + número colegial**. Sin firmas anónimas.

---

## 8. Cómo entregar

Para CADA UUID, ingeniería necesita:

1. Versión revisada del Capa 1 (texto markdown o estructurado).
2. Lista actualizada de Capa 2 si cambia (tabla `variable | fuente | condicion`).
3. Lista actualizada de Capa 3 si cambia (tabla `campo | obligatoriedad | descripcion`).
4. Valores definitivos de `organo_tipo`, `adoption_mode`, `referencia_legal` (si estaban null).
5. Versión nueva (`1.0.0` típicamente).
6. `aprobada_por` (formato: `<nombre>, <colegio> nº <nº>`).
7. `fecha_aprobacion` (YYYY-MM-DD).

**Formato preferido:** un archivo markdown por plantilla siguiendo la estructura de las fichas en `plantillas-core-revision-2026-05-02/`. Alternativa: tabla CSV con todas las plantillas.

**Entrega a:** equipo de ingeniería TGMS. Ingeniería convierte cada entrega a SQL UPDATE y aplica con credencial admin (no por `db push`).

---

## 9. Plazo y orden de prioridad sugeridos

| Bloque | Plantillas | Orden |
|---|---|---|
| 1. Críticas | FUSION_ESCISION, RATIFICACION_ACTOS, SEGUROS_RESPONSABILIDAD | Primero — bloquean validez registral / generan riesgo de impugnación |
| 2. Metadatos null | COMITES_INTERNOS, DISTRIBUCION_CARGOS, POLITICA_REMUNERACION, POLITICAS_CORPORATIVAS | Segundo — más fácil (rellenar 3 campos + firmar) |
| 3. Materia substantiva | AUMENTO_CAPITAL, MODIFICACION_ESTATUTOS, REDUCCION_CAPITAL, NOMBRAMIENTO_AUDITOR | Tercero — refrescar redacción + firmar |
| 4. Cierre rutinario | resto (6 plantillas) | Último — solo revisión + firma |

Plazo orientativo: cerrar las 3 críticas en 1 semana. Las otras 14 en 2-3 semanas adicionales.

---

## 10. Verificación post-cierre

Tras entregar las 17, ingeniería ejecuta esta probe contra Cloud:

```sql
SELECT COUNT(*) AS legacy_pendientes
FROM plantillas_protegidas
WHERE estado = 'ACTIVA' AND aprobada_por IS NULL;
-- Debe devolver 0.
```

Si devuelve 0, el núcleo sólido está cerrado por el lado Path A.

Tras aplicar también el Path B (SQL packet `2026-05-02-plantillas-core-v2-mejoras.sql`), las 16 mejoras estarán en estado BORRADOR pendientes de promoción a ACTIVA — fase separada con visto bueno legal del comité.

---

**Cualquier duda jurídica de modelado o de mapping al sistema, levantar a ingeniería antes de firmar. Es preferible 16 plantillas correctamente cerradas y 1 bloqueada que 17 cerradas con drift jurídico.**
