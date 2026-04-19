# Brief para Equipo Legal — Oleada 1: Plantillas con Contenido Jurídico

**De:** Equipo técnico TGMS
**Para:** Comité Legal / Secretaría Corporativa
**Fecha:** 2026-04-19
**Prioridad:** Alta — bloquea activación del motor en producción

---

## Contexto

El Motor de Reglas LSC está técnicamente completo (16 Rule Packs, 6 motores de evaluación, 250+ tests). Evalúa automáticamente: quórum, mayorías, antelación de convocatoria, documentación obligatoria, conflictos de interés y proceso sin sesión.

Para que el motor funcione en producción, necesitamos **7 plantillas documentarias con contenido jurídico real**. Actualmente existen como esqueletos técnicos con placeholders (`{{variable}}`). El equipo legal debe redactar el contenido normativo.

---

## Qué es una plantilla protegida

Cada plantilla tiene 3 capas:

**Capa 1 — INMUTABLE (protegida por hash, no editable post-aprobación):**
- Encabezamiento legal con ley aplicable
- Fórmulas de proclamación normativas (ej: "ACUERDO ADOPTADO POR mayoría simple de los presentes conforme al art. 201.1 LSC")
- Advertencias de efectos jurídicos
- Referencia al snapshot de reglas: "Evaluado bajo Rule Pack [X] v1.0, snapshot_hash=[Y]"

**Capa 2 — PARAMETRIZADA (el motor inyecta automáticamente):**
- `{{snapshot_hash}}` — hash del ruleset aplicado
- `{{resultado_gate}}` — resultado de la evaluación (GATE_OK / GATE_ADVERTENCIA / GATE_BLOQUEADO)
- `{{denominacion_social}}`, `{{fecha}}`, `{{lugar}}`
- Sellos QES y TSQ del QTSP

**Capa 3 — EDITABLE (el secretario/usuario completa):**
- Deliberaciones detalladas
- Observaciones del presidente
- Ruegos y preguntas
- Declaración de conflictos de interés

---

## Las 7 plantillas que necesitamos

### Plantilla 1: Acta de sesión — Junta General

**Tipo técnico:** `ACTA_JUNTA`
**Modos:** MEETING (junta convocada), UNIVERSAL (junta universal)
**Referencia legal:** Arts. 97-103 RRM, art. 202 LSC

**Lo que necesitamos del equipo legal:**

1. **Encabezamiento normativo** — Texto estándar de apertura de acta de Junta General. Incluir:
   - Mención de la sociedad, CIF, domicilio, datos registrales
   - Referencia a la convocatoria (o mención de universalidad si aplica)
   - Fórmula de constitución: "Reunidos [presencialmente/telemáticamente] los socios que representan el [X]% del capital social, queda válidamente constituida la Junta [General Ordinaria/Extraordinaria] conforme al art. [193/194] LSC"

2. **Fórmula de proclamación por tipo de mayoría** — Texto parametrizable:
   - Mayoría simple: "El acuerdo queda aprobado por mayoría simple, con [X] votos a favor, [Y] en contra y [Z] abstenciones, conforme al art. 201.1 LSC"
   - Mayoría reforzada: "El acuerdo queda aprobado por mayoría reforzada de [X]% del capital presente, conforme al art. 201.2 LSC"
   - Unanimidad: "El acuerdo queda aprobado por unanimidad de todos los socios con derecho a voto"

3. **Advertencias legales** — Texto sobre efectos del acta:
   - Fuerza probatoria
   - Posibilidad de impugnación (art. 204 LSC)
   - Inscripción registral (si procede)

4. **Sección de conflictos** — Fórmula cuando hay consejeros/socios conflictuados:
   - "D./Dña. [nombre] ha sido excluido del [quórum/voto/ambos] en el punto [X] del orden del día por concurrir situación de conflicto de interés conforme al art. 190 LSC"

5. **Cierre y firma** — Fórmula estándar de cierre con Secretario + VºBº Presidente

---

### Plantilla 2: Acta de sesión — Consejo de Administración

**Tipo técnico:** `ACTA_CONSEJO`
**Modos:** MEETING
**Referencia legal:** Art. 250 LSC, arts. 97-103 RRM

**Lo que necesitamos:**

Mismo esquema que Plantilla 1, adaptado a Consejo:
1. Encabezamiento con mención a consejeros (no socios)
2. Fórmula de quórum: "Presentes/representados [X] de [Y] consejeros, queda válidamente constituido el Consejo"
3. Fórmula de mayoría: mayoría absoluta de asistentes (art. 248.1 LSC)
4. Mención especial para formulación de cuentas anuales
5. Delegación de voto si procede (representación entre consejeros)

---

### Plantilla 3: Acta de consignación — Socio único / Administrador único

**Tipo técnico:** `ACTA_CONSIGNACION`
**Modos:** UNIPERSONAL_SOCIO, UNIPERSONAL_ADMIN
**Referencia legal:** Art. 15 LSC

**Lo que necesitamos:**

1. Fórmula diferenciada según tipo:
   - **Socio único:** "El socio único de [sociedad], D./Dña. [nombre], en ejercicio de las competencias que le atribuye el art. 15 LSC, adopta la siguiente decisión..."
   - **Administrador único:** "El administrador único de [sociedad], D./Dña. [nombre], adopta la siguiente decisión en materias de su competencia..."
2. Advertencia de consignación en Libro de Actas (art. 15.2 LSC)
3. Requisitos de firma (firma manuscrita, firma electrónica cualificada)

---

### Plantilla 4: Acta de acuerdo escrito sin sesión

**Tipo técnico:** `ACTA_ACUERDO_ESCRITO`
**Modos:** NO_SESSION
**Referencia legal:** Art. 100 RRM (juntas escritas), arts. 248.2 LSC (consejo)

**Lo que necesitamos:**

1. Encabezamiento indicando que el acuerdo se adopta sin celebración de sesión
2. **Fórmula de adopción según variante:**
   - **Unanimidad capital SL:** "Todos los socios, representando el 100% del capital social, han manifestado por escrito su conformidad con la propuesta..."
   - **Circulación consejo:** "Consultados por escrito los [X] miembros del Consejo, [Y] han votado a favor, alcanzando la mayoría requerida..."
   - **Decisión socio único:** (similar a consignación, pero por vía escrita sin sesión formal)
3. Relación de respuestas recibidas (tabla con nombre, sentido, fecha, referencia firma QES)
4. Fórmula de cierre con fecha de cierre del expediente
5. Mención al expediente electrónico con hash de integridad

---

### Plantilla 5: Certificación de acuerdos

**Tipo técnico:** `CERTIFICACION`
**Modos:** Todos (transversal — aplica a cualquier acuerdo adoptado)
**Referencia legal:** Arts. 109-112 RRM

**Lo que necesitamos:**

1. Encabezamiento: "D./Dña. [nombre], Secretario/a [no consejero] del [órgano] de [sociedad], CERTIFICO:"
2. Fórmula diferenciada según modo de adopción:
   - Sesión: "Que en [tipo de sesión] celebrada el día [fecha]..."
   - Sin sesión: "Que por acuerdo adoptado sin celebración de sesión, con fecha de cierre [fecha]..."
   - Unipersonal: "Que por decisión del [socio/administrador] único, de fecha [fecha]..."
3. Transcripción del acuerdo certificado
4. Fórmula VºBº del Presidente (¿obligatorio siempre o solo en determinados supuestos?)
5. Mención de conformidad conjunta si aplica (¿en qué supuestos es obligatoria?)
6. Referencia a verificación de integridad (hash, evidence bundle)

---

### Plantilla 6: Convocatoria — SA

**Tipo técnico:** `CONVOCATORIA` (subtipo SA)
**Modos:** MEETING
**Referencia legal:** Arts. 166-177 LSC

**Lo que necesitamos:**

1. Encabezamiento: "El [órgano convocante] de [sociedad] convoca a los señores accionistas..."
2. Datos obligatorios: fecha, hora, lugar, orden del día
3. **Texto del derecho de información (art. 197 LSC):** Fórmula estándar informando del derecho a solicitar información por escrito antes de la junta
4. Canales de publicación: mención BORME + web corporativa (si inscrita)
5. Texto para 2ª convocatoria (si procede): fecha subsidiaria, intervalo mínimo
6. Mención de documentación disponible en domicilio social

---

### Plantilla 7: Convocatoria — SL

**Tipo técnico:** `CONVOCATORIA` (subtipo SL)
**Modos:** MEETING
**Referencia legal:** Arts. 166-177 LSC, art. 173 LSC (notificación individual)

**Lo que necesitamos:**

1. **Diferencia clave con SA:** La SL no publica en BORME. Se notifica individualmente a cada socio.
2. Fórmula de notificación individual: "Se notifica individualmente a cada uno de los socios de [sociedad], de conformidad con el art. 173 LSC..."
3. Canal: ¿correo certificado con acuse, burofax, notificación electrónica certificada (eDelivery)?
4. Texto del derecho de información adaptado a SL
5. Mención de antelación mínima (15 días, art. 176.1 LSC — ¿o diferente para SL?)

---

## Formato de entrega

Para cada plantilla, entregar un documento con:

```
[CAPA 1 — INMUTABLE]
(Texto legal fijo — será protegido por hash)

--- SECCION PROTEGIDA: SNAPSHOT ---
Hash del ruleset: {{snapshot_hash}}
Resultado Gate: {{resultado_gate}}
--- FIN SECCION PROTEGIDA ---

[CAPA 2 — PARAMETRIZADA]
(Indicar dónde van las variables del motor usando {{nombre_variable}})

[CAPA 3 — EDITABLE]
(Indicar campos que rellena el usuario, marcando OBLIGATORIO u OPCIONAL)
```

**Variables disponibles del motor** (Capa 2 — se inyectan automáticamente):

| Variable | Descripción | Disponible en |
|---|---|---|
| `{{snapshot_hash}}` | Hash SHA-256 del ruleset aplicado | Todas |
| `{{resultado_gate}}` | GATE_OK, GATE_ADVERTENCIA, GATE_BLOQUEADO | Todas |
| `{{denominacion_social}}` | Razón social de la entidad | Todas |
| `{{fecha}}` | Fecha del acuerdo/sesión | Todas |
| `{{lugar}}` | Lugar de celebración | Sesión |
| `{{secretario}}` | Nombre del Secretario | Todas |
| `{{presidente}}` | Nombre del Presidente | Todas |
| `{{tipo_junta}}` | JGO, JGE, JGU | Junta |
| `{{orden_dia}}` | Lista de puntos del orden del día | Sesión, Convocatoria |
| `{{lista_consejeros}}` | Lista de asistentes con representación | Consejo |
| `{{resultado_evaluacion}}` | Resumen de evaluación (quórum %, mayoría %) | Todas |
| `{{relacion_respuestas}}` | Tabla de respuestas (sin sesión) | NO_SESSION |
| `{{tipo_proceso}}` | UNANIMIDAD_CAPITAL_SL, CIRCULACION_CONSEJO, DECISION_SOCIO_UNICO | NO_SESSION |
| `{{condicion_adopcion}}` | Condición evaluada para cierre | NO_SESSION |
| `{{texto_derecho_informacion}}` | Texto legal de derecho de información | Convocatoria |
| `{{documentacion}}` | Lista de documentación disponible | Convocatoria |
| `{{firma_qes_ref}}` | Referencia de firma QES del QTSP | Actas, Certificación |
| `{{tsq_token}}` | Sello cualificado de tiempo | Actas, Certificación |

**Variables del usuario** (Capa 3 — las completa el secretario):

| Variable | Descripción | ¿Obligatoria? (decidir Legal) |
|---|---|---|
| `{{deliberaciones}}` | Texto libre de deliberaciones | ¿? |
| `{{texto_decision}}` | Texto del acuerdo adoptado | Sí |
| `{{observaciones_presidente}}` | Observaciones adicionales | ¿? |
| `{{ruegos_preguntas}}` | Ruegos y preguntas | ¿? |
| `{{declaracion_conflictos}}` | Conflictos declarados | ¿Obligatoria si hay conflictos? |
| `{{identidad_decisor}}` | Nombre del socio/admin único | Sí (unipersonal) |
| `{{propuesta_texto}}` | Texto de la propuesta (sin sesión) | Sí (NO_SESSION) |

---

## Preguntas abiertas para Legal

1. **Conformidad conjunta en certificación:** ¿En qué supuestos es obligatoria la mención de conformidad conjunta Secretario + Presidente? ¿Solo cuando no hay acta aprobada?

2. **Convocatoria SL — canal:** ¿El canal principal es correo certificado o se acepta notificación electrónica certificada (eDelivery vía QTSP)?

3. **Deliberaciones:** ¿Son campo obligatorio en actas de Junta y Consejo, o solo recomendado?

4. **Acta de acuerdo escrito:** ¿La relación de respuestas debe incluir el sentido del voto de cada socio, o solo el resultado agregado?

5. **Voto de calidad del Presidente:** ¿En qué órganos del grupo demo (ARGA) está habilitado?

6. **Cotizadas:** ¿Necesitamos soporte parcial o el BLOQUEO actual (borde no computable) es suficiente para el demo?

7. **Jurisdicciones BR/MX/PT:** Los Rule Packs tienen parámetros para estas jurisdicciones. ¿Se validan los valores o se mantienen como estimación?

---

## Plazo

- **Entrega Oleada 1 (contenido jurídico):** idealmente en 2 semanas
- **Revisión Oleada 2 (aprobación formal):** 1 semana adicional
- **Go-live:** tras activación de las 7 plantillas ACTIVAS

El panel de seguimiento (`/secretaria/plantillas-tracker`) muestra el estado en tiempo real de cada plantilla con alertas automáticas.
