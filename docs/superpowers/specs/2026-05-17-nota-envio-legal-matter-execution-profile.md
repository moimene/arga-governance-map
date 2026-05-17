# Nota de envio - Revision legal MatterExecutionProfile

Fecha: 2026-05-17
De: Equipo de ingenieria TGMS Secretaria Societaria
Para: Comite Legal Garrigues - Secretaria Societaria
Cliente: Demo ARGA (pseudonimo)
Referencia tecnica: commits `4b4c866` (Matter Registry), `08eb9b6` (MatterExecutionProfile), `ac15b77` (dossier legal expandido)

## 1. Proposito

Solicitamos la validacion de la logica computable de adopcion de acuerdos societarios implementada en el modulo `MatterExecutionProfile` antes de conectarlo al flujo operativo del `TramitadorStepper`.

El modulo modela:

- gates formales evaluables: convocatoria, constitucion, votacion, documentacion y post-acuerdo;
- prerequisitos como grafo de materias: que acuerdos o documentos deben existir antes de que otro pueda adoptarse;
- overrides tipificados: via alternativa legitima (junta universal, regimen simplificado) vs. desviacion con riesgo (defecto formal con trazabilidad);
- workflow post-acuerdo: certificacion, escritura, inscripcion RM, publicacion BORME, deposito y comunicacion regulatoria;
- eficiencia operativa: unanimidad por defecto, duplicacion segura de expedientes y computo automatico de capital, votos y quorum.

Principio operativo: el modulo es propositivo y proactivo, nunca bloqueante. Los gates advierten, no impiden avanzar. El secretario conserva siempre la capacidad de override. Ningun gate sustituye el criterio profesional del secretario.

El modulo no selecciona plantillas. Esa funcion corresponde al `Matter Registry` (commit `4b4c866`), que sigue operativo e inalterado.

## 2. Documentacion adjunta

| Documento | Ubicacion en repo | Contenido |
|---|---|---|
| Dossier principal | `docs/superpowers/specs/dossier-revision-legal-matter-execution-profile.md` | Matriz de gates, prerequisitos, overrides, materias con incertidumbre, 14 preguntas cerradas, formato de casos de prueba y guia de validacion de rule packs |
| Nota de envio | `docs/superpowers/specs/2026-05-17-nota-envio-legal-matter-execution-profile.md` | Priorizacion, instrucciones de respuesta y decision esperada |
| SQL de extraccion de rule packs | `docs/superpowers/specs/2026-05-17-rule-packs-review-extraction.sql` | Query read-only para obtener payloads vigentes de materias prioritarias |
| Instrucciones de extraccion | `docs/superpowers/specs/2026-05-17-rule-packs-review-instructions.md` | Como ejecutar el SQL de forma segura y como formatear el resultado para Legal |

## 3. Que es bloqueante para fase 1

Sin estas respuestas no podemos conectar el panel informativo no disruptivo al `TramitadorStepper`.

### 3.a. Respuestas a preguntas P1-P10

Las preguntas P1-P10 del dossier principal cubren parametros que el modulo necesita para calcular gates correctamente. Cada pregunta tiene opciones cerradas e impacto tecnico especificado.

| Pregunta | Tema | Urgencia |
|---|---|---|
| P1 | Plazo base 30 dias SA para todos los acuerdos ordinarios | Alta - afecta gate de convocatoria |
| P2 | Segunda convocatoria en SL con prevision estatutaria | Alta - afecta gate de convocatoria |
| P3 | Proyecto comun en fusion/escision como `BLOCKING` o `WARNING` | Alta - afecta prerequisitos |
| P4 | Delegacion de facultades: consejero inscrito como `BLOCKING` | Media - afecta prerequisitos |
| P5 | Cooptacion en SL: `BLOCKING`, `WARNING` o permitida | Alta - afecta gate de votacion |
| P6 | Cese por Consejo: solo renuncia/toma de razon o mas supuestos | Media - afecta subtipos |
| P7 | Operaciones vinculadas no cotizadas: abstencion siempre o condicional | Alta - afecta gate de votacion |
| P8 | Activos esenciales en financiacion/contratacion: escalado a Junta | Alta - afecta prerequisitos |
| P9 | Materias con comunicacion regulatoria sectorial (DGSFP/CNMV) | Media - afecta post-acuerdo |
| P10 | Gaps `BLOCKING` con doble confirmacion en UX | Media - afecta politica de override |

### 3.b. Confirmacion de prerequisitos `BLOCKING` / `WARNING`

El dossier propone cadenas de prerequisitos con severidad asignada. Legal debe confirmar o reclasificar cada una:

| Cadena | Severidad propuesta | Decision requerida |
|---|---|---|
| `APROBACION_CUENTAS <- FORMULACION_CUENTAS` | `BLOCKING` | Confirmar o reclasificar |
| `DISTRIBUCION_DIVIDENDOS <- APROBACION_CUENTAS` | `BLOCKING` | Confirmar o reclasificar |
| `DISTRIBUCION_DIVIDENDOS <- FORMULACION_CUENTAS` (transitivo) | `WARNING` | Mantener o eliminar |
| `FUSION <- Proyecto comun` | `WARNING` | Confirmar o elevar a `BLOCKING` |
| `ESCISION <- Proyecto comun` | `WARNING` | Confirmar o elevar a `BLOCKING` |
| `DELEGACION_FACULTADES <- NOMBRAMIENTO_CONSEJERO inscrito` | `WARNING` | Confirmar o elevar a `BLOCKING` |
| `CERTIFICACION_ACUERDOS <- Acta aprobada` | `BLOCKING` | Confirmar o reclasificar |
| `REDUCCION_CAPITAL <- Resolucion oposicion acreedores` | `WARNING` | Confirmar, reclasificar o eliminar |

### 3.c. Al menos 5 casos de prueba legales

Necesitamos expedientes ejemplo con resultado esperado para validar que el panel muestra informacion correcta. El formato exacto esta en la seccion 6 del dossier.

Columnas requeridas:

- `materia` (enum del sistema);
- `organo_tipo` (enum del sistema);
- `tipo_social` (`SA`, `SL`, `SAU`, `SLU`);
- `adoption_mode` (obligatorio en materias inscribibles);
- `subtipo_materia` (obligatorio si hay bifurcacion);
- `escenario` (hechos del expediente: que existe, que falta, que es irregular);
- `resultado_esperado` (`PASSED_LIMPIO`, `PASSED_CON_WARNING`, `OVERRIDE_REQUIRED`, `BLOCKING_GAP`);
- `override_esperado` (obligatorio si hay gap: `VIA_ALTERNATIVA` o `DESVIACION_CON_RIESGO` + `risk_flag`).

Reglas:

- no usar "segun proceda" ni "si aplica" en resultados esperados;
- cada fila debe ser atomica y determinista;
- cada escenario debe convertirse en un test automatizable sin interpretacion intermedia.

## 4. Que puede ir a fase 2

Estos elementos no bloquean el panel informativo inicial:

| Elemento | Descripcion | Puede esperar hasta |
|---|---|---|
| P11-P14 | Materias grises: adquisicion de propias, exclusion/separacion, deuda convertible, pactos parasociales | Despues del panel informativo |
| Mini-dossier `DISOLUCION` / `LIQUIDACION` | Mapa de causas, prerequisitos y decision arquitectonica (perfil propio vs. workflow extendido) | Siguiente version del modulo |
| Validacion completa de rule packs | Cruce gate x tipo social de todos los rule packs vigentes | Paralelo a fase 1, via SQL adjunto |
| Casos de prueba adicionales | Escenarios complementarios hasta 15 casos | Iteracion posterior |

## 5. Instrucciones de respuesta

### 5.a. Preguntas P1-P14

Responder usando la opcion correspondiente (a/b/c/d) segun se indica en cada pregunta del dossier. Si ninguna opcion se ajusta, indicar la respuesta preferida con una frase breve.

### 5.b. Casos de prueba legales

Devolver tabla con estas columnas exactas:

| materia | organo_tipo | tipo_social | adoption_mode | subtipo_materia | escenario | resultado_esperado | override_esperado |
|---|---|---|---|---|---|---|---|
| `APROBACION_CUENTAS` | `JUNTA_GENERAL` | `SA` | `MEETING` | N/A | Formulacion previa aprobada; convocatoria 30 dias; quorum 40%; unanimidad | `PASSED_LIMPIO`, 0 gaps | N/A |

### 5.c. Prerequisitos

Para cada cadena de la tabla de la seccion 3.b, indicar una de estas decisiones:

- confirmar;
- reclasificar a `BLOCKING`;
- reclasificar a `WARNING`;
- eliminar.

### 5.d. Materias nuevas

Si se propone modelar alguna materia no incluida en el catalogo actual, marcarla como `PROPUESTA: [nombre de materia]` con una linea de justificacion.

## 6. Decision esperada

Al final de la revision, Legal debe comunicar:

1. Autorizacion o no para conectar el panel informativo no disruptivo al `TramitadorStepper`.
2. Condiciones, si las hay, para esa autorizacion. Ejemplo: "solo para materias no inscribibles hasta validar rule packs de materias inscribibles".
3. Priorizacion de materias con incertidumbre: cuales deben resolverse antes de fase 2 y cuales pueden esperar.

El panel informativo propuesto:

- solo muestra gates y prerequisitos como informacion;
- no impide generacion documental;
- no cambia el flujo actual del secretario;
- registra overrides en el `compliance_snapshot` del acuerdo.

## 7. Plazo y canal de entrega

- Plazo sugerido: 2 semanas desde la recepcion del paquete.
- Minimo para desbloquear fase 1: respuestas P1-P10 + confirmacion de prerequisitos + 5 casos de prueba.
- Canal: via habitual (mail, Teams o repositorio Git en `docs/legal-team/firmas-cierre-plantillas/`).

## 8. Nota sobre rule packs

Los valores de quorum, mayorias y documentacion preceptiva que el modulo usa proceden de los rule packs vigentes en Cloud (`rule_pack_versions.payload`). La validacion legal debe cubrir tanto el dossier como esos payloads.

Se adjunta un SQL read-only (`2026-05-17-rule-packs-review-extraction.sql`) para extraer los payloads de las materias prioritarias, especialmente las inscribibles o con riesgo de calificacion registral. Las instrucciones de ejecucion estan en `2026-05-17-rule-packs-review-instructions.md`.

Si Legal prefiere recibir la tabla ya extraida en lugar de ejecutar el SQL, ingenieria puede entregarla como markdown formateado previa confirmacion del target Cloud.
