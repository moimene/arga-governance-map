# Corrección a fondo del módulo AIMS tras el primer alta real

**Fecha:** 2026-09-07
**Origen:** primer alta y autodiagnóstico de un sistema de IA en el tenant Garrigues
(Harvey, `2f877e8c-875d-4b11-9b39-aed0826cacb5`), y el informe de validación
regulatoria `Validation_of_Functional_Improvement_Suggestions_for_AIMS_Module_v2.docx`.

---

## 0. Lo primero: el informe no pudo verificar sus premisas técnicas

El documento de validación lo declara él mismo:

> No se ha localizado en el vault el plan C2, la migración `000043_aims360_core.sql`
> ni los ficheros de código fuente. La validación de las afirmaciones sobre la
> existencia de campos en el esquema se basa en la coherencia interna del feedback.

Validó la **solidez regulatoria** de las sugerencias, no sus premisas técnicas.
Contrastadas contra Cloud y el código, resultó que:

- Las 28 tablas del backbone `aims_*` **sí existen**, todas con RLS. El informe
  acertaba.
- Garrigues tiene **cero filas en las 28**: el alta escribe sólo en `ai_systems`.
- `ai_risk_assessments` y `ai_compliance_checks` **no tienen `tenant_id`**: su
  aislamiento va por join contra `ai_systems`, y eso condiciona cualquier
  escritura nueva sobre ellas.

## 1. Tres defectos que el informe no podía ver

Salen del dato real, no del documento.

| # | Defecto | Medida |
|---|---|---|
| F1 | Las **Medidas Adicionales** se añadían, se pintaban y **se perdían al enviar**: `additionalMeasures` no entraba en `buildEvaluationPayload` | — |
| F2 | `difficulty` y `justification` se recogían por medida y **no se persistían**. `MATURITY_LEVELS.L8` declara la justificación obligatoria y la pantalla la pide con asterisco | La única `L8` de Harvey (`MG_LOGG_07`, trazabilidad biométrica) perdió su motivo |
| F3 | Reevaluar **duplicaba** `ai_compliance_checks` | «Motor de triaje» (ARGA): **28 filas para 7 códigos** |

De F2 sale la regla nueva: **una `L8` sin justificación no acredita
no-aplicabilidad**. No es criterio inventado: es el que el catálogo ya declaraba
y que nadie podía cumplir porque el dato no se guardaba.

## 2. El hallazgo de fondo

Las 84 medidas guía desarrollan los **arts. 9 a 15, 17, 72 y 73** del Reglamento
(UE) 2024/1689: las obligaciones del **proveedor de un sistema de alto riesgo**.
Garrigues es **responsable del despliegue de un sistema de riesgo limitado**.

**El 49 % no dice que cumpla a medias: dice que se le ha medido contra
obligaciones que no le vinculan.**

Resuelto con un perfil de aplicabilidad por rol y nivel, que **falla abierto**:
sin rol declarado se usa el catálogo completo y se dice por qué. Medir de más y
decirlo es conservador; medir de menos por un dato que falta esconde
obligaciones.

## 3. Decisiones del usuario

| Decisión | Resuelta |
|---|---|
| Legacy vs backbone | **Híbrido**: `ai_systems` sigue siendo el inventario; `aims_*` sólo para lo que no tiene sitio en legacy (evidencias). Cero migración de dato, cero cambio ARGA |
| Catálogo del desplegador | **Mecanismo + perfil provisional marcado**. 43 medidas derivadas de las fuentes que el informe nombra, cada una con su norma y su carácter. Declarado «cobertura provisional — pendiente del Comité de IA» |
| Algoritmo de hash (decisión #10 del informe) | **SHA-512**, no el SHA-256 propuesto: unifica con la cadena WORM de `audit_log` y los `evidence_bundles` |

## 4. Qué se ha cerrado, contra el backlog del informe

| # | Tarea | Estado |
|---|---|---|
| 1 | Autosave y borrador en el wizard | ✅ y reanudación, porque guardar sin recuperar es escribir en un pozo |
| 2 | Renderizar notas y PDA en el informe | ✅ + las 12 áreas en la impresión |
| 3 | Componente de evidencias por medida | ✅ con caducidad y reutilización sin duplicar fichero |
| 4 | Bucket por tenant con RLS | ✅ `aims-evidence`, privado, tenant en el primer segmento |
| 5 | Rol y owner en el alta | ✅ |
| 6 | Clasificación de riesgo motivada | ✅ con el aviso del art. 6.3 |
| 7 | Perfil de aplicabilidad del desplegador | ✅ provisional y marcado |
| 8 | Congelación con hash de servidor + evaluador/revisor | ✅ el hash **sí** es de servidor |
| 9 | PDA como acciones estructuradas | ✅ conservando lo editado a mano |
| 14 | Renombrar la exportación JSON | ✅ `autodiagnostico-aims-…` |
| — | Formulario de incidentes y reloj regulatorio | ✅ el motor estaba vivo y desconectado |
| — | Dificultad sin valor por defecto | ✅ y sin código numérico visible |
| — | `vite:preloadError` | ✅ |

**Fuera de alcance, declarado:** decisión #13 del informe (¿hace falta EIPD para
el uso de Harvey?) es una evaluación jurídica del responsable de cumplimiento,
no una tarea de producto. El módulo ya la pregunta —`MD_PD_02`— y registra la
respuesta; decidirla no es suyo.

## 5. Qué se puede afirmar de cada huella

Distinción que la pantalla hace explícita, porque no es la misma:

| Huella | Dónde se calcula | Qué acredita | Qué NO |
|---|---|---|---|
| `aims_evidence_items.content_hash` | **Navegador** (Web Crypto) | Que el fichero no ha cambiado desde que se registró | Fecha cierta, identidad del firmante, integridad contextual |
| `ai_risk_assessments.content_hash` | **Servidor** (`sha512` sobre la fila) | Integridad del contenido y quién congeló | **Fecha cierta**: `now()` es la hora del servidor, no un sello de tiempo cualificado |

`evidentiary_posture` sólo admite `REFERENCE` por CHECK. Las posturas superiores
del informe (paquete auditado, listo para bloqueo legal) exigen un artefacto que
no existe, y dejarlas alcanzables permitiría acuñar una calidad probatoria que
nadie ha producido. Ampliarlas exigirá una migración, que es la fricción que
deben tener.

## 6. Migraciones

| Versión | Qué cierra |
|---|---|
| `20260907180000` | Rol regulatorio, clasificación motivada, único por tenant de `aims_reference_code`, guard de tenant del responsable |
| `20260907190000` | `aims_evidence_items` + bucket `aims-evidence` |
| `20260907200000` | Retira DELETE/TRUNCATE heredados (ver §7) |
| `20260907210000` | Congelación, revisión y `action_plan` |
| `20260907220000` | Perímetro regulatorio del incidente |

Las cinco con bloque de verificación que **aborta** y control positivo del
instrumento. Todas las columnas nullable: ARGA con `NULL` = cero cambio.

## 7. Un hallazgo de la propia sonda

`authenticated` había heredado **DELETE y TRUNCATE** sobre `aims_evidence_items`
del `ALTER DEFAULT PRIVILEGES` del esquema, porque un `grant` es aditivo y no
quita nada. El DELETE lo filtraba la RLS; **TRUNCATE no pasa por RLS** y habría
vaciado la tabla de todos los tenants de una sentencia. No era alcanzable vía
PostgREST —trampa cargada, no fuga abierta—, y es exactamente la misma que se
retiró el 2026-09-06 de otras cinco tablas.

**La lección se repite: al crear una tabla, revocar explícitamente lo que no se
concede.** Un `grant select, insert, update` no es una lista blanca.

## 8. Gates que se pusieron rojos, y por qué tenían razón

Ninguno se relajó. Los tres se **estrecharon**, y la mutación lo comprueba.

1. **Aislamiento de hooks.** `supabase.storage.from(bucket)` no es acceso a una
   tabla y no puede llevar filtro por columna. Sale del conteo y entra en un
   invariante propio: la ruta empieza por el tenant, que es lo que comprueba la
   política de `storage.objects`.
2. **Aislamiento de hooks, otra vez.** Un `UPDATE` sobre una tabla sin
   `tenant_id` tampoco puede filtrar: PostgREST **no aplica a la mutación** el
   filtro sobre un recurso incrustado, sólo a la representación devuelta — que
   es peor que nada, porque una escritura ajena diría «no se guardó» habiéndose
   guardado. La exención va emparejada con una obligación más dura: probar la
   pertenencia antes, acotar la escritura al sistema comprobado, y verificar que
   vuelve fila.
3. **Afirmaciones fabricadas.** Decía que ninguna tabla guarda un hash. Ahora hay
   dos. Se nombran sólo donde la columna existe, y hay que decir **dónde se
   calculan y qué no acreditan**.

Y un guard propio salió derrotable en la primera mutación: contaba
`.eq("system_id", systemId)` suelto en el fichero, y otra consulta lo
satisfacía. Se ató al `.update(` con el que tiene que ir.

## 9. Gates

`bun test` **4320 pass / 151 skip / 3 todo / 0 fail** (línea base 4259).
`typecheck`, `lint` y `build` limpios. 5 migraciones aplicadas y registradas.

Verificado en vivo con el login de Garrigues sobre Harvey: el cuestionario
propone «Limitado», el aviso del art. 6.3 aparece al bajar del anexo III, el
alta se niega a guardar enumerando lo que falta, el borrador se recupera con su
dificultad dentro, y con dos medidas en L5 aparece **un solo** aviso de
«declarada sin evidencia» — el de la que no tiene nada detrás.

Las RPC de congelación se verificaron **en una transacción revertida entera**
(cero residuo): huella de 128 hex, doble congelación rechazada, fila congelada
inmutable, revisión por el mismo usuario rechazada, por otro aceptada, y
congelación cross-tenant rechazada.

## 10. Lo que queda, y de quién es

- **La composición del catálogo del desplegador es del Comité de IA.** Está
  cargado y marcado como provisional; validarlo no es una tarea de producto.
- **La EIPD del art. 35 RGPD para Harvey** es una evaluación del responsable de
  cumplimiento. El módulo la pregunta y registra la respuesta.
- **`aims_evidence_items` no entra todavía en el gate de aislamiento
  cross-tenant de 25 tablas**: está vacía en los dos tenants y vigilarla ahí
  sería teatro. Su aislamiento se mide por comportamiento en
  `src/test/schema/aims-evidence-tenant-isolation.test.ts`, que intenta cruzar
  el bucket desde los dos lados con logins reales.
- **Harvey no declara rol regulatorio.** Hasta que se declare desde su ficha, el
  autodiagnóstico se mide contra las 84 medidas del proveedor y la pantalla lo
  dice. Declararlo es lo que activa el catálogo de 43.
