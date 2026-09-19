# AIMS 360 frente a la matriz RIA del experto: cobertura, huecos y enfoque

*19 de septiembre de 2026 · versión corregida tras el crítico de completitud y la verificación del calendario en fuente oficial*

Base del análisis:
- **Código:** instantánea congelada `origin/main b1721a5`. Todas las rutas son relativas a `…/scratchpad/ria/snapshot`.
- **Cloud:** dato medido el 19-09-2026, solo con SELECT.
- **Revisión:** cada una de las 65 obligaciones pasó por un juez y dos revisores adversariales (cobertura y jurídico), con desempate cuando hubo disputa. Se revisaron también siete dimensiones estructurales, con verificación de cada punto.

---

## 1. Resumen ejecutivo

- **Lo exigible hoy es justo donde menos cubrimos.** El RIA vigente es el modificado por el Reglamento (UE) 2026/1744, el «Ómnibus digital de IA», en vigor desde el 27-7-2026. Con ese texto, verificado en su versión oficial en español, las 65 obligaciones del experto se reparten así:
  - **9 son exigibles hoy**: la puerta de los arts. 2 y 3.1, los arts. 4, 5 y 50 y la EIPD del RGPD. En esas 9 cubrimos **4 parcialmente y 5 nada**. Matiz: el marcado del art. 50.2 tiene hasta el 2-12-2026 para lo introducido antes del 2-8-2026 (art. 111.4).
  - **35 son del régimen de alto riesgo**: capítulo III y deberes conexos de los capítulos VIII y IX. Se aplican al anexo III desde el **2-12-2027** y al anexo I desde el 2-8-2028. Además, a los sistemas introducidos o puestos en servicio **antes de esas fechas** solo les alcanzan si sufren un cambio significativo de diseño (art. 111.2). Ahí está el grueso de nuestra cobertura: 23 parciales, 11 no cubiertas y 1 retirada.
  - **21 dependen de hechos que hoy no constan en ningún tenant**: importador, distribuidor, proveedor de un modelo de uso general, proveedor fuera de la UE, autoridad pública, espacio controlado de pruebas o pruebas en condiciones reales. Ninguna está cubierta.
  - El módulo, como la matriz, mira sobre todo hacia lo que aún no se exige.
- **Diagnóstico de fondo: las dos herramientas miden cosas distintas y a ninguna le basta con lo suyo.**
  - La del experto es un **plan de proyecto**: 65 obligaciones y 76 entregables, con un único estado por obligación para toda la organización, en fases con plazo.
  - La nuestra es un **inventario por sistema**: rol, nivel y marcos derivados de un cuestionario, y un autodiagnóstico de madurez por requisito.
  - Ninguna tiene el objeto que el RIA exige: cada obligación imputada a una persona jurídica concreta, sobre un sistema y en un rol, con estado, responsable, plazo y evidencia.
- **Cobertura de las 65: 0 cubiertas, 27 parciales, 37 no cubiertas y 1 retirada** (la EIDF del art. 27).
  - Casi todo lo parcial es código sin uso. En Cloud, los dos tenants suman 0 cuestionarios completados, 0 roles declarados, 0 evaluaciones congeladas, 0 evidencias y 0 acciones de plan.
  - Hubo 4 veredictos en disputa (OB-12, OB-32, OB-42, OB-64). El desempate los dejó en NO_CUBIERTO, la lectura más conservadora.
- **La relevancia por tenant depende de hechos que no constan.**
  - **ARGA:** 32 obligaciones le aplican: 7 exigibles hoy y 25 latentes. Todo el peso del alto riesgo está en ARGA Score (tarificación de pólizas de vida, anexo III 5 c), en servicio desde el 1-3-2024. Con el art. 111.2 vigente queda amparado mientras no sufra un cambio significativo de diseño. Sus otros cinco sistemas «Alto» tienen un nivel heredado que, a la vista del anexo III, no encaja.
  - **Garrigues:** 6 obligaciones le aplican (4 hoy y 2 latentes) y 49 quedan en «depende». De esas 49, 36 dependen de dos hechos no acreditados: qué persona jurídica provee GA_IA y si algún uso cae en el anexo III, por ejemplo evaluar a profesionales (punto 4). Las otras 13 dependen de que alguna sociedad importe, distribuya, provea modelos de uso general o participe en pruebas.
- **El producto ya tiene el registro de riesgos inherente → residual, pero en GRC, y AIMS no lo usa.**
  - `risks` guarda probabilidad, impacto, riesgo inherente calculado, residual, sociedad, responsable y obligación.
  - `action_plans` tiene responsable, fecha, estado y %, la forma de la fila del Excel del experto. Pero cada acción tiene que colgar de un hallazgo (`finding_id` NOT NULL), mientras que la fila del experto cuelga de una obligación.
  - ARGA tiene dados de alta dos riesgos del RIA, sin enlazar a ningún sistema: **RSK-TECH-005 «AI Act sistemas no clasificados»** y **RSK-STRA-005**. Tiene además uno de gobierno de la IA generativa, RSK-TECH-006.
  - RSK-STRA-005 afirma «AI Act alto riesgo» para la tarificación de **automóvil**. El anexo III 5 c) solo cubre vida y salud: es un error en nuestro propio dato.
- **Nuestros fallos más caros son de enfoque, y aparecerán en la primera clasificación real:**
  - un solo rol por sistema, así que ARGA Score como proveedor pierde los arts. 26 y 27;
  - el art. 50 se trata como un nivel de riesgo y no como una obligación que se acumula;
  - el responsable del despliegue de alto riesgo se mide contra los deberes de diseño del proveedor;
  - la excepción del art. 6.3 se acepta con 40 caracteres y su ayuda pone como ejemplo válido un scoring crediticio;
  - la ayuda del art. 5 excluye letras. Tras el Ómnibus el art. 5.1 tiene **diez**: se añaden la b bis) y la b ter) (imágenes íntimas sin consentimiento y material de abuso sexual infantil), prohibidas desde el **2-12-2026**, dentro de dos meses y medio. El nuevo art. 5.1 bis las acota:
    - al proveedor solo le alcanza si esa generación es la finalidad prevista, o si es un resultado previsible y reproducible sin salvaguardas razonables;
    - al responsable del despliegue, solo si usa el sistema con ese fin;
  - varios indicadores del Dashboard dicen «Listo» sin haber medido nada.
- **Cableado del grupo Garrigues: ningún sistema ni incidente está atado a una sociedad ni a un responsable.**
  - `ai_systems` e `ai_incidents` no tienen `entity_id`.
  - `owner_id` está vacío en los 14 sistemas.
  - El Comité de Gobernanza de la IA y la PI-30 existen en el dato con arista real entre ellos, pero ningún sistema está enlazado a ninguno de los dos. Cuatro de los seis mencionan la PI-30 solo en el texto libre de la descripción.
  - El dato tiene 33 entidades del grupo, y no todas son personas jurídicas (hay oficinas, una sucursal, una división, la Fundación y una sociedad extinta). Hay dos sociedades tecnológicas, EAD Trust y NewLaw, y la división g-digital. La cadena proveedor → responsable del despliegue puede ser **intragrupo**, y el modelo no puede expresarla.
- **El material del experto es sólido: pocos errores objetivos y un buen método.**
  - Errores claros: OB-43 atribuye el art. 50.2 al distribuidor; OB-12 cita un «art. 10.4.f)» inexistente; OB-56 extiende el registro de la sección C del anexo VIII a sistemas que no son de alto riesgo.
  - Hace mejor que nosotros cuatro cosas: el rol múltiple por sistema, el art. 50 acumulable, el método de riesgos y la capa de gestión.
  - No recoge el Ómnibus, lo cual es lógico si la matriz es anterior a julio.
- **Antes de converger hay que preguntarle al experto para quién es el proyecto.** La diapositiva 8 y el HTML llevan la marca GARRIGUES.
  - Si es el proyecto interno del despacho, casi todo el régimen de alto riesgo le sobra.
  - Si es la metodología que Garrigues ofrece a clientes, AIMS sería su herramienta de entrega y ARGA el caso cliente. Entonces la herramienta tiene que trabajar con varios clientes y varios encargos por cliente: un tenant por cliente ya lo permite, pero no hay objeto «encargo» con fases y plazos.
- **Convergencia: su matriz como catálogo de obligaciones y nuestro inventario como sujeto, unidos por una tabla sociedad × sistema × rol.** Orden:
  1. Dejar de afirmar lo que no se ha medido y cubrir lo exigible hoy: días de trabajo, sin migración.
  2. Construir el modelo de sujeto: semanas, con migración y decisión de Legal.
  3. Después, conectar con GRC (riesgos, planes y obligaciones de organización) y preparar el régimen de alto riesgo antes de diciembre de 2027.

---

## 2. Diagnóstico de paradigma

| | Matriz y cuadro del experto | AIMS 360 |
|---|---|---|
| Unidad | Obligación (65) y entregable (76) | Sistema de IA (14: ARGA 8, Garrigues 6) |
| Estado | Uno por obligación o entregable, para toda la organización, puesto a mano | Uno por par sistema × requisito, con histórico (`checksVigentes`); lo declara quien rellena el asistente |
| Rol | «Rol principal» por obligación. Su método pide el rol «para cada sistema (puede ser varios)» (Fases C7) | Un único `regulatory_role` por sistema, derivado del cuestionario |
| Aplicabilidad | Columna «Tipo de sistema IA» en texto libre. N/A manual en el Excel; ninguno en el HTML | Derivada, pero por dos caminos que no coinciden: marcos (`derivarMarcos`) y catálogo medido (`perfilAplicable`) |
| Avance | % puesto a mano (Excel) o entregables «Hecho» / 76 (HTML) | Calculado desde el dato (sistemas clasificados, evaluados); sin % de proyecto |
| Riesgo | Método inherente → medidas → residual (diap. 12), sin instrumentar | AIMS mide madurez L1–L8 por medida. El producto tiene el registro inherente/residual en GRC (`risks`), sin conectar a los sistemas de IA |
| Entregable | Documento: protocolo, modelo, política | Evidencia adjunta a una medida; no genera documentos |
| Plazos y alarmas | Fases con fecha, alarmas de vencido y de 60 días; sin fechas de aplicación del RIA | Solo relojes de incidente (art. 73, RGPD, DORA); sin fechas de aplicación del RIA |
| Responsable | Texto libre | `owner_id` por sistema y por acción de plan; 0 rellenos |
| Persistencia | Navegador (localStorage), sin usuarios | Servidor, por tenant, con RLS, huellas y triggers de inmutabilidad |
| Sociedad del grupo | No existe | No existe |

**Qué falta en la intersección.** El RIA atribuye cada rol a una persona física o jurídica (art. 3, puntos 3, 4, 6 y 7). El ámbito territorial depende de dónde está establecida (art. 2.1). Ninguno de los dos modelos lo representa: el experto trabaja con una organización en singular y nosotros tratamos el tenant como si fuera una sola sociedad.

Lo que falta es un registro **obligación × sujeto**, donde el sujeto es sociedad × sistema × rol, con dos ámbitos:
- **Organización:** art. 4, sistema de gestión de la calidad del art. 17, protocolos del art. 26, cooperación del art. 21.
- **Sistema:** clasificación, documentación técnica, EIDF, registro, logs.

Su columna «Tipo de sistema IA» es, en la práctica, el predicado de aplicabilidad que ese registro tendría que evaluar sobre las respuestas de cada sistema. Formula unos 20. Hoy no podemos evaluarlos porque el cuestionario guarda booleanos demasiado gruesos: el anexo III es un solo sí/no sin el punto, e interacción y generación de contenido van juntas en una única pregunta.

Cada lado coloca mal un tipo de obligación:
- **Nosotros**, las de organización. El art. 4 se mide dentro de cada evaluación de sistema y no está en el catálogo del proveedor, que es el que se usa cuando falta el rol. Resultado: hoy no se mide en ninguno de los 14 sistemas.
- **El experto**, las de sistema (EIDF, documentación técnica, registro), que lleva con un único estado para toda la organización.

El producto ya tiene el contenedor para las de organización, en GRC: `obligations`, `controls` y `policies`, con órgano responsable, referencia legal y ámbito territorial. Se usa para PBC/FT, ciber, DORA y RGPD. El RIA no tiene ninguna obligación dada de alta (0 filas en `obligations` en los dos tenants). Sí existen políticas de IA (PI-30 en Garrigues, publicada y con órgano; PR-024 en ARGA, en borrador) y un control de IA generativa (CTR-GARR-33), pero ninguno está enlazado a los sistemas: no hay FK entre las tablas `ai_*` y ese registro. Además, AIMS no puede escribir obligaciones de GRC: lo impide la frontera de propiedad entre módulos.

---

## 3. Lo que cubrimos, y dónde vamos más allá de su visión

### 3.1 Cifras por bloque

| Bloque | Obligaciones | Parciales | No cubiertas | Retiradas |
|---|---|---|---|---|
| Inventario y aplicabilidad | 1 | 0 | 1 | 0 |
| Prácticas prohibidas | 2 | 1 | 1 | 0 |
| Clasificación y GPAI | 2 | 1 | 1 | 0 |
| Roles en la cadena | 3 | 1 | 2 | 0 |
| Importadores y distribuidores | 8 | 0 | 8 | 0 |
| Alfabetización | 1 | 1 | 0 | 0 |
| Riesgos y datos | 3 | 2 | 1 | 0 |
| Requisitos técnicos | 5 | 5 | 0 | 0 |
| Proveedor y conformidad | 8 | 7 | 1 | 0 |
| Despliegue, EIDF y EIPD | 10 | 3 | 6 | 1 |
| Transparencia (art. 50) | 5 | 1 | 4 | 0 |
| Modelos de uso general | 5 | 0 | 5 | 0 |
| Pruebas y registro UE | 5 | 0 | 5 | 0 |
| Gobernanza permanente | 7 | 5 | 2 | 0 |
| **Total** | **65** | **27** | **37** | **1** |

**Veredictos disputados.** Los cuatro acabaron en NO_CUBIERTO, que es la opción que afirma menos:
- **OB-12** (registro de actividades de tratamiento del antiguo art. 10.5.f). El juez dio PARCIAL por la medida MG_DATA_10. El desempate lo bajó porque esa medida no menciona el registro ni la motivación de necesidad estricta.
- **OB-42** (aviso del art. 50.1). El juez dio PARCIAL por la medida MD_TRA_01. El desempate lo bajó: esa medida solo se ofrece al responsable del despliegue, al que el 50.1 no obliga, y al proveedor no se le mide nada del art. 50.
- **OB-32** (supervisores del art. 26.2) y **OB-64** (acceso de la autoridad a datos y código fuente). Un revisor propuso PARCIAL por medidas del catálogo del proveedor. El desempate mantuvo NO_CUBIERTO porque ninguna mide el fondo de la obligación.

### 3.2 Qué existe de verdad (caminos que escriben y leen)

- **Cuestionario de clasificación versionado.** Nueve preguntas (arts. 3.3, 5, 6, 50 y capítulo V).
  - El servidor vuelve a derivar **rol, nivel, perfil y GPAI** y rechaza lo que no cuadra. En cambio, los **marcos aplicables** los guarda tal como llegan del cliente y los mete en la huella (`20260908120000:383-425`). El sello acredita la integridad de unos marcos que el servidor no ha comprobado: un cliente podría quitar el art. 27 o el RGPD a un sistema de alto riesgo.
  - Sella con SHA-512 calculado en servidor y deja inmutable la versión sustituida.
  - No pregunta la fecha de puesta en servicio ni si ha habido un cambio significativo, así que no puede aplicar el art. 111.2.
  - `src/lib/aims/cuestionario-calificacion.ts:242-291`
  - `supabase/migrations/20260908120000_aims_cuestionario_calificacion.sql:355-427`, trigger en `:215-246`
  - Sostiene la parte parcial de OB-02, OB-04 y OB-07. Usos: 0.
- **Autodiagnóstico contra dos catálogos.** El del proveedor tiene 84 medidas del RIA (arts. 9-15, 17, 72 y 73) más un catálogo complementario de 8 de ISO 42001. El del responsable del despliegue tiene 43, con la procedencia marcada como OBLIGACION o MARCO_OPERATIVO. Se guarda en `ai_risk_assessments` y `ai_compliance_checks`.
  - `src/lib/aims/catalog-aesia.ts:273-566`, `src/lib/aims/perfil-aplicabilidad.ts:70-125, 301-364`, `src/hooks/useAiAssessments.ts:242, 324`
  - Sostiene OB-09, 10, 11, 13-17, 19, 21, 34 y 38.
  - Uso real con el catálogo vigente: una sola evaluación, la de Harvey, y contra el catálogo equivocado (el del proveedor de alto riesgo; de ahí sale el 49 %).
- **Evidencia por medida.** Lleva huella y no se puede borrar. Un nivel L5 sin evidencia no acredita y un L8 («no aplica») exige justificación.
  - `src/hooks/useAimsEvidence.ts:88-157`, `supabase/migrations/20260907190000_aims_evidencias_por_medida.sql:103-130`, `src/lib/aims/conformidad.ts:25-77`
  - Evidencias en Cloud: 0.
- **Congelación y revisión por otra persona.** Congelar calcula un SHA-512 en servidor. La revisión la rechaza el servidor si la hace quien congeló (`MISMO_EVALUADOR`).
  - `supabase/migrations/20260907210000_aims_congelacion_y_plan_de_adaptacion.sql:87-205`
  - Es la base del control interno del anexo VI (OB-39). Evaluaciones congeladas: 0.
- **Expediente técnico.** Nueve secciones que siguen fielmente el anexo IV. Las funciones que deciden si vinculan los arts. 11 y 47 solo lo afirman para un proveedor de alto riesgo.
  - `src/lib/aims/expediente-tecnico.ts:15-53`, `src/hooks/useAimsTechnicalFile.ts:128-203`
  - Cubre OB-13, OB-20, OB-40 y la sección AIV-09 de OB-61.
- **Incidentes con perímetro regulatorio.** Calcula los plazos del art. 73.2-73.4 (15, 2 y 10 días), del art. 33 RGPD y de DORA. Permite abrir un subexpediente por régimen, con motivación obligatoria.
  - `src/lib/aims/incident-clocks.ts:105-280`, `src/hooks/useAimsMultiregime.ts:87-137`
  - Cubre OB-62 y OB-63. En Cloud: 2 incidentes, 0 subexpedientes.
- **Plan de adaptación.** Por cada medida con brecha: responsable, vencimiento y estado. `src/lib/aims/plan-adaptacion.ts:15-128` (OB-22). Acciones en Cloud: 0.

### 3.3 Dónde vamos más allá de su visión

- **El sistema como unidad y el rol derivado, no declarado.** El experto lo pide en su método (Fases C7), pero su herramienta no puede guardarlo. Nosotros sí, con una salvedad seria: un solo rol por sistema (ver 5.1).
- **Integridad y trazabilidad.** Huellas calculadas en servidor, inmutabilidad por trigger, sin borrado y con histórico de comprobaciones. Su cuadro guarda el estado en el navegador y se vacía con un botón (`cuadro_de_mando.html:109, 118-122`).
- **Relojes del art. 33 RGPD y de DORA junto al del art. 73.** Su matriz solo trata el art. 73 (OB-62, OB-63), lo cual es coherente con su alcance RIA. Para un grupo que trata datos de clientes, el reloj de 72 horas es la notificación más probable.
- **Separar deber jurídico de buena práctica.** Cada medida lleva su carácter (OBLIGACION frente a MARCO_OPERATIVO de ISO o de deontología). Su columna «Naturaleza» (Jurídico, Técnico, Mixto) no hace esa distinción. Hay cuatro etiquetas mal puestas (ver 5.3), pero la idea evita presentar buenas prácticas como deberes.
- **Aplicabilidad que falla hacia el lado prudente y lo dice.** Si falta el rol se mide el catálogo completo, con aviso. Se mide de más en lugar de esconder obligaciones.
- **«No aplica» con motivo por medida.** Su HTML no admite N/A y su Excel lo admite sin motivo.
- **Puerta del art. 47.** La declaración de conformidad solo se ofrece a un proveedor de alto riesgo con clasificación completada. El resto recibe un aviso.

El control a cuatro ojos va más allá que el suyo, pero tiene agujeros:
- compara al revisor con quien congeló, no con quien redactó, porque `assessor_id` no se escribe nunca;
- la revisión no condiciona ningún indicador (`src/lib/aims/readiness.ts:138` da por conforme cualquier evaluación APROBADO o CONFORME, esté revisada o no);
- el revisor aparece en pantalla como un prefijo de UUID.

---

## 4. Lo que no cubrimos, priorizado por relevancia real

### 4.1 Orden de prioridad

| # | Hueco | Obligaciones | Garrigues | ARGA | Por qué ahora |
|---|---|---|---|---|---|
| 1 | Cribado del art. 3.1 y ámbito del art. 2, por sociedad | OB-01 (no cubierta) | Aplica | Aplica | Es la puerta de todo lo demás. El inventario da por hecho que todo lo registrado es IA y está en ámbito. Además, dos contratos (acuerdos enterprise con OpenAI y Anthropic, GARR-IA-101/102) y una hoja de ruta están dados de alta como «sistemas», y el Dashboard cuenta los dos contratos como sistemas activos. |
| 2 | Art. 4 como obligación de organización | OB-09 (parcial) | Aplica | Aplica | Exigible desde el 2-2-2025. Solo existe en el catálogo del responsable del despliegue de riesgo limitado o mínimo, con la redacción ya derogada. No se mide en ningún sistema de ningún tenant (0 comprobaciones). |
| 3 | Art. 5 letra por letra (**diez** letras tras el Ómnibus), dejando constancia del resultado positivo | OB-02 (parcial) | Aplica | Aplica | Letras a)-h) exigibles desde el 2-2-2025. La f) (emociones en el trabajo) afecta a cualquier empleador; la c) y la d) importan a ARGA. **Las nuevas b bis) y b ter) se aplican desde el 2-12-2026**, con el alcance del art. 5.1 bis. A quien provee IA generativa (GA_IA, si la provee una sociedad del grupo; ARGA Assist, si ARGA es la proveedora) le obliga a comprobar la previsibilidad y las salvaguardas. A quien la despliega (Copilot, Harvey) solo le alcanza el uso con esa finalidad. La prohibición de PI-30 §3.2 d) de generar contenido gráfico o audiovisual ayuda, pero admite uso extraordinario autorizado. |
| 4 | Art. 50 medido al proveedor | OB-42, OB-43, OB-46 (no cubiertas); OB-45 (parcial). OB-44 (art. 50.3) es exigible pero no aplica a ningún tenant | GA_IA (50.2), si su proveedor es una sociedad del grupo; 50.4 con la excepción de control editorial | ARGA Assist (50.1 y 50.2) | Exigible desde el 2-8-2026. Para el 50.2, el art. 111.4 da hasta el 2-12-2026 a los sistemas introducidos antes del 2-8-2026: ARGA Assist está en servicio desde el 1-11-2024 y le vence dentro de dos meses y medio. En Garrigues, PI-30 §3.2 d) deja fuera por política la ultrasuplantación gráfica o audiovisual, salvo uso extraordinario autorizado. El audio y el texto de interés público del 50.4 siguen dentro. |
| 5 | EIPD como objeto, con el puente del art. 26.9 hacia la EIDF | OB-38 (parcial) | Aplica (evaluar la necesidad para Harvey y GA_IA) | Aplica (ARGA Score: perfilado con efectos, art. 35.3 a RGPD) | El RGPD está en vigor, y el art. 35 depende del riesgo del tratamiento, no de la clasificación RIA. Tras el Ómnibus, el art. 27.4 permite que la EIDF remita a las secciones de la EIPD: la EIPD es la pieza que hay que construir primero. Hoy es una casilla que nadie ha contestado nunca. |
| 6 | Sujeto: sociedad × sistema × rol | transversal | Aplica | Aplica | Condición previa de todo lo anterior (ver 4.2). |
| 7 | Conversión en proveedor por cambio de finalidad (art. 25.1 c) y reapertura de la clasificación | OB-07 (parcial) | Copilot, Harvey, OpenAI o Anthropic usados para empleo (anexo III, 4) o resolución alternativa de litigios (8 a) | ARGA Assist usado para vida o salud | Ningún cambio de finalidad, versión o estado reabre la clasificación. |
| 8 | Capa de gestión: fases, plazos por obligación, alarmas por fecha de exigibilidad, acciones vivas | transversal | Aplica | Aplica | Es lo que el experto hace mejor. En AIMS no hay ninguna fecha de aplicación del RIA (0 resultados de búsqueda). |
| 9 | EIDF y deberes del responsable del despliegue de alto riesgo | OB-37 (retirada); OB-31, 32, 33, 36 y 65 (no cubiertas) | No aplica hoy | ARGA Score | **Latente.** El anexo III se aplica desde el 2-12-2027. A un sistema introducido o puesto en servicio antes de esa fecha solo le alcanza si sufre un cambio significativo de diseño (art. 111.2); el considerando 39 lo computa por tipo y modelo. La necesitarán los tipos y modelos del punto 5 c) que se introduzcan a partir del 2-12-2027 y los que cambien significativamente. La plantilla de cuestionario de la Oficina de IA (art. 27.5) ya estaba prevista en 2024. El Ómnibus añade que permita remitir a la EIPD. Conviene construir sobre ella y no sobre el esquema FRIA retirado. |
| 10 | Riesgo inherente → residual de cada sistema **en el registro GRC que ya existe**, y registro en la base de datos de la UE (art. 49) | OB-10 (parcial); OB-55 (no cubierta) | Solo si GA_IA pasa a alto riesgo | ARGA Score como proveedor; RSK-TECH-005 y RSK-STRA-005 ya están dados de alta | Mismo calendario que el punto 9. El art. 9.10 permite a ARGA integrar la gestión de riesgos del RIA en su sistema de Solvencia II. |

**Lo que pesa poco hoy.** O no aplica a ningún tenant, o depende de hechos que no constan:
- importador y distribuidor (OB-23 a OB-30): 8 obligaciones, ninguna en el inventario actual;
- proveedor de un modelo de uso general (OB-05, OB-47 a OB-51): ninguno de los dos entrena modelos;
- autoridades públicas (OB-03, OB-56, OB-59);
- pruebas en condiciones reales y espacio controlado de pruebas (OB-52 a OB-54): voluntarios;
- representante autorizado (OB-06).

**Calendario verificado en el texto oficial en español** del Reglamento (UE) 2026/1744 (EUR-Lex, CELEX 32026R1744, leído directamente):
- Es de 8-7-2026, se publicó en el DOUE el 24-7-2026 y está en vigor desde el 27-7-2026.
- **Art. 113 (punto 40):**
  - Capítulos I y II desde el 2-2-2025, salvo el art. 5.1 b bis) y b ter), 5.1 bis y 5.1 ter, que se aplican desde el 2-12-2026.
  - Capítulo III, secciones 1 a 3 (salvo el art. 6.5), desde el 2-12-2027 para el anexo III y desde el 2-8-2028 para el anexo I.
- **Art. 111.2 (punto 39 a):** los sistemas de alto riesgo introducidos o puestos en servicio «antes de la fecha de aplicación del capítulo III a que se refiere el artículo 113» solo quedan sujetos si sufren cambios significativos de diseño.
- **Art. 111.4 (punto 39 b):** los proveedores de sistemas generativos introducidos antes del 2-8-2026 deben cumplir el art. 50.2 a más tardar el 2-12-2026.

Con esto, la EIDF que el análisis de riesgos marcó como P0 **no es exigible a ARGA** para ARGA Score mientras no cambie significativamente. Ninguna obligación del régimen de alto riesgo es P0 por exigibilidad inmediata. Lo urgente es lo que ya se aplica o vence este año (puntos 2 a 5) y dejar de afirmar lo no medido (sección 5).

### 4.2 Cableado del grupo Garrigues (petición expresa)

La pregunta era si la herramienta sabe qué sociedad del grupo hace qué con cada sistema, quién responde y qué órgano decide. No lo sabe, y el dato para saberlo ya está en la base.

- **Sistemas e incidentes sin sociedad.**
  - `ai_systems` solo tiene una FK, `owner_id → persons` (`supabase/migrations/20260418154408_fase4_ai_governance_tables.sql:2-15`). `ai_incidents` tampoco tiene `entity_id`.
  - La única columna de sociedad en el perímetro IA vivo, `aims_incident_regimes.entity_id`, no la escribe ningún camino (`src/hooks/useAimsMultiregime.ts:119-129`).
  - El filtro por ámbito está desactivado a propósito porque no hay columna por la que filtrar (`src/lib/aims/readiness.ts:621-643`), y `branding.scopes` es NULL.
- **No se puede nombrar a la persona jurídica, y el filtro que habría que reutilizar no basta.** `sociedadesOnly` no mira `entity_status` (`src/hooks/useEntities.ts:112-120`). Dejaría pasar «Sports & Entertainment (extinta 2018)», el Centro de Estudios, la Fundación y los vehículos de inversión, y ofrecería una sociedad liquidada como proveedora de un sistema de IA. Varias de las 33 filas de `entities` no son personas jurídicas: g-digital es una división; Bruselas y G-Advisory Bogotá son oficinas; Shanghái es la oficina de representación de J&A Garrigues SLP; Portugal es una sucursal. Consecuencias jurídicas:
  - (a) El proveedor previsible de GA_IA es la matriz. El art. 3.3 incluye a la persona «para la que se desarrolle» un sistema y lo ponga en servicio con su nombre. g-digital no puede ser proveedor. NewLaw solo lo sería si lo pusiera en servicio con su propia marca.
  - (b) Las oficinas de la matriz fuera de la UE siguen dentro del art. 2.1 b), porque la persona jurídica está establecida en España. El 2.1 c) solo rige para filiales con personalidad propia cuya salida se usa en la Unión. Deducir el ámbito fila a fila desde `entities.jurisdiction` daría un resultado erróneo.
- **Nadie responde de ningún sistema.**
  - `owner_id` está relleno en 0 de los 6 sistemas de Garrigues y en 0 de los 8 de ARGA.
  - Solo se lee como un booleano que dispara un aviso que no bloquea (`src/lib/aims/cuestionario-calificacion.ts:470-472`).
  - La ficha pone la etiqueta «Proveedor / Responsable» sobre el texto libre del proveedor: en GA_IA muestra «Garrigues» (`src/components/ai-governance/sistema/CabeceraSistema.tsx:161-162`).
- **El Comité de IA es un enlace, no una relación en el dato.**
  - AIMS lo encuentra por un mapa fijo de UUID de tenant a slug (`src/lib/aims/governing-body.ts:24-36`) y solo pinta nombre y enlace.
  - La siembra declara el comité como órgano de los 6 sistemas y lo descarta porque no hay columna donde guardarlo (`scripts/seed-garrigues-ia.ts:43-48`).
  - PI-30 tiene su órgano registrado en GRC, pero ningún sistema está enlazado a ella. Cuatro de los seis la citan solo en el texto libre de la descripción. La restricción de §3.2 d) consta en las fichas de Copilot y GA_IA, no en la de Harvey, cuya descripción se sustituyó.
  - La revisión a cuatro ojos no exige ser miembro del comité.
  - Que Secretaría no lo ofrezca para adoptar acuerdos es **correcto**: es un órgano consultivo (`src/lib/secretaria/operational-bodies.ts:34-38`). El hueco es otro. No hay dónde guardar su informe o dictamen sobre un sistema, ni su enlace con la decisión final.
  - La cadena de decisión ya está escrita en la PI-30 §3.2 d): el uso extraordinario exige un informe **al** Departamento de Intangibles y la autorización del Comité de IA y, después, del Senior Partner. Es lo más parecido que existe a un «decisor acreditado» para aceptar un riesgo residual. La PI-30 §3.1.1 excluye además las funcionalidades de Gemini de GA_IA. Es un dato de la cadena de modelos de GA_IA que ningún objeto recoge.
  - Para alojar el dictamen podría servir la página genérica de informes de Secretaría (`/secretaria/informes`, `src/pages/secretaria/InformesPreceptivos.tsx`), a la que enlaza el gate del informe preceptivo de G3. Pero hoy esa página está atada a un acuerdo societario. Para un sistema de IA haría falta un nuevo tipo de origen, y respetar la frontera de propiedad entre AIMS y Secretaría.
- **El equipo multidisciplinar está en el dato y no se usa.** Entre los cinco miembros del Comité de IA cubren, entre otros órganos, la Oficina del DPO, el Comité de Seguridad y Privacidad y el de Innovación y Digitalización. Por ejemplo, Vergara está en la Oficina del DPO, Terrero en el CSP, y Abad en el de Innovación, el Comité de Dirección y el Consejo de EAD Trust. La Oficina Técnica de Seguridad la dirige el CISO. Es, ya institucionalizado, el equipo que el experto describe en su diapositiva 11.
- **Los traspasos entre módulos pierden la referencia.**
  - Solo mandan el id del incidente o de la evaluación, y GRC no lo lee (`src/pages/grc/Risk360.tsx:244-245`).
  - Si la URL no lleva sociedad, Secretaría y GRC toman la última guardada en el navegador (`src/components/secretaria/shell/useSecretariaScope.ts:83-88`), que puede ser otra.
  - «Ver planes GRC» lleva a `/grc/m/audit`, que Garrigues no tiene habilitado, y acaba en la portada (`Risk360.tsx:367`, `src/components/module-guards.tsx:50-54`).
  - El escalado a Secretaría pasa el órgano por su nombre y ofrece también los 19 órganos consultivos (`src/components/ai-governance/sistema/EscaladoSecretariaModal.tsx:97-101`).
- **GRC tiene los puentes y no están conectados.** En ARGA hay dos riesgos del RIA dados de alta y sueltos: RSK-TECH-005 «AI Act sistemas no clasificados» y RSK-STRA-005 «Pricing automatizado ML». Este último **afirma mal** «AI Act alto riesgo» para la tarificación de automóvil. Hay además uno de gobierno de la IA generativa, RSK-TECH-006 «Shadow IT uso GenAI sin gobierno». El control CTR-GARR-33 (prohibición de volcar información confidencial en IA generativa de terceros) cuelga de una obligación de ciber, `OBL-GARR-CYBER-03`, y la evaluación de Harvey no puede citarlo. `OBL-GARR-CYBER-02` (notificación a clientes de incidentes de seguridad) es el enlace natural con `ai_incidents`. No hay ninguna FK entre tablas `ai_*` y GRC, y Garrigues no tiene módulo GRC de IA.
- **Autoridad del incidente.** Sin sociedad ni país, el subexpediente propone AESIA o AEPD por defecto:
  - para Garrigues Varsovia, la autoridad RGPD sería la polaca;
  - para la sucursal de Portugal, la AEPD puede ser correcta, porque el responsable del tratamiento es una SLP española.
  - Hacen falta dos datos: la persona jurídica y, para el art. 73.1, el Estado miembro donde ocurrió el incidente.
- **ARGA, igual.** Su equivalente de la PI-30 es la PR-024 «Política de Inteligencia Artificial Responsable»: en borrador, con `owner_function` CTO y sin órgano asignado.
  - 31 sociedades, 12 fuera de la UE.
  - Tres sistemas «Alto» tienen como proveedor «ARGA Analytics», que no es ninguna sociedad del grupo.
  - Hay tres pares de sociedades con el mismo nombre común (Brasil, México, Portugal).
  - El escalado ofrece 20 órganos llamados «Consejo de Administración».

---

## 5. Lo que está mal enfocado en nuestro módulo

**5.1 Un solo rol por sistema, y además excluyente.**
- `derivarRol` devuelve PROVEEDOR en cuanto una de Q1_1 a Q1_3 es afirmativa. Descarta Q1_4, que ya pregunta si la organización controla el uso del sistema (`cuestionario-calificacion.ts:110-126, 242-259`).
- El espejo SQL hace lo mismo y rechaza cualquier otra conclusión (`20260908120000:255-269`).
- Un índice en base de datos permite un solo cuestionario completado por sistema (`:82-83`).
- Quien desarrolla un sistema y lo usa es a la vez proveedor (arts. 3.3 y 3.11: puesta en servicio «para uso propio») y responsable del despliegue (art. 3.4).
- ARGA Score clasificado con la verdad se queda sin los arts. 26 y 27 (`cuestionario-calificacion.ts:330-349`). GA_IA pierde el catálogo del responsable del despliegue.
- Aquí el experto acierta.

**5.2 El art. 50 se trata como un nivel de riesgo y se atribuye al sujeto equivocado.**
- `derivarNivel` devuelve «Alto» antes de mirar Q2_4, y el marco del art. 50 solo aparece con nivel «Limitado» (`cuestionario-calificacion.ts:270-272, 350-352`). Contradice el art. 50.6: ningún sistema del anexo III que genere texto o interactúe con personas recibe el art. 50.
- MD_TRA_01 presenta el art. 50.1 como OBLIGACION del responsable del despliegue (`perfil-aplicabilidad.ts:78`). Pero el 50.1 obliga a «los proveedores».
- Un proveedor de riesgo limitado cae en el catálogo AESIA, que no tiene ninguna medida del art. 50, y encima con la etiqueta «Proveedor de sistema de alto riesgo» (`:353-363`).

**5.3 Catálogo equivocado para el sujeto.**
- Sin rol declarado, que es el caso de los 14 sistemas, y también en el perfil B (responsable del despliegue de alto riesgo), se mide contra las 84 medidas de diseño del proveedor (`perfil-aplicabilidad.ts:308-338`). En consecuencia, los arts. 4, 26 y 27 y la EIPD no se miden nunca en alto riesgo ni para un proveedor.
- El 49 % de Harvey mide a un responsable del despliegue de riesgo limitado contra deberes que no le vinculan. Además, sus trece L5 sin evidencia acreditan porque la fila es anterior al control de evidencia (`conformidad.ts:52-58`).
- Cuatro medidas del catálogo del responsable del despliegue están etiquetadas como OBLIGACION y deberían ser MARCO_OPERATIVO:
  - MD_TRA_01 (art. 50.1);
  - MD_CS_01 y MD_CS_02 (cap. V y anexo XII, que obligan al proveedor del modelo);
  - MD_CS_05 (el art. 25.1 califica al sujeto, no le impone un deber de vigilancia).

**5.4 La excepción del art. 6.3 enseña justo el camino prohibido.**
- La ayuda de Q2_3 propone como ejemplo de excepción «un sistema de scoring crediticio» (`cuestionario-calificacion.ts:172-173`). El último párrafo del art. 6.3 declara siempre de alto riesgo el sistema del anexo III que elabora perfiles de personas físicas.
- El servidor solo comprueba que la motivación tenga 40 caracteres (`20260908120000:368-375`). No pregunta por el perfilado ni por las condiciones a) a d).
- La pregunta se ofrece a cualquier rol, aunque el art. 6.4 atribuye esa evaluación al proveedor.
- La motivación no se muestra en ninguna pantalla una vez completado el cuestionario.
- Con 40 caracteres, ARGA Score bajaría a Limitado y perdería a la vez los arts. 9 y 27.

**5.5 El art. 5 está mal preguntado y peor resuelto.**
- La ayuda dice «Marque «Sí» SOLO si…» y enumera cuatro prácticas, con lo que excluye por instrucción las letras d) a g).
- Invierte el alcance de la letra h): esa letra solo prohíbe el uso con fines de garantía del cumplimiento del Derecho.
- Aconseja «si tiene dudas, casi seguro es No» (`cuestionario-calificacion.ts:134, 140`).
- Un «Sí» bloquea y revierte el alta, en lugar de dejar constancia del hallazgo y del cese.
- El monitor «Prácticas prohibidas» cuenta un valor que ya nadie puede escribir (`readiness.ts:354, 380-384`).

**5.6 Indicadores que dicen «Listo» sin haber medido.** Un revisor ejecutó `buildAimsReadiness` de la instantánea sobre el dato vivo:
- **Asignación por subcadena de texto** (`readiness.ts:329-335`). En ARGA, «Derechos fundamentales / DPIA» sale Listo 1/1 por una comprobación ISO que contiene «privacidad», con 0 EIDF. «Gobierno, roles y accountability» sale Listo 3/3 porque «rol» está dentro de «desarrollo».
- **Incidente abierto contado como cerrado.** En Garrigues, «Post-market monitoring» sale Listo 1/1 con un incidente EN_INVESTIGACION, porque basta con tener texto de causa raíz (`:363-365, 505-507`).
- **Hallazgos sumados de todas las evaluaciones, duplicadas y borradores incluidos.** «Controles» da 35/38 Listo en ARGA; con la última evaluación no borrador de cada sistema da 8/11, Vigilancia (`:508-528`).
- **Brecha por no tener alto riesgo.** Garrigues ve «Evaluaciones AI Act» en rojo con la métrica «Sin alto riesgo» (`:100-103, 541-547`).
- **Evaluaciones heredadas que acreditan para siempre** (`:138`). ARGA Score figura APROBADO con 72 puntos, sin congelar y sin evidencia. Las cuatro APROBADO de 100 puntos del Motor de triaje las generó una prueba end-to-end.
- **Causas de fondo.** La regla «manda la más reciente» se aplicó a las comprobaciones y no a las evaluaciones. Además, `ai_compliance_checks` no tiene `assessment_id`, así que no se sabe si una comprobación viene de un borrador.

**5.7 Madurez presentada como riesgo.**
- La lista se titula «Evaluaciones de riesgo IA» (`src/pages/ai-governance/Evaluaciones.tsx:83`), pero la puntuación es el porcentaje de medidas acreditadas (`catalog-aesia.ts:700`), con todas las medidas pesando igual.
- La prioridad de cada acción sale del hueco de madurez y de la dificultad, no del daño que evita (`plan-adaptacion.ts:54-60`).
- La derivación a GRC se dispara con una puntuación inferior a 80 (`readiness.ts:143-156`).

**5.8 Seguimiento imposible por diseño.**
- El estado de una acción del plan no se puede cambiar desde ninguna pantalla (`PasoRevision.tsx:157-175`).
- El plan se congela junto con la evaluación (`20260907210000:60`).
- El informe no tiene columna de responsable.
- Los indicadores de vigilancia nacen en estado «OK», en verde, sin medición ni umbral, y no hay forma de actualizarlos (`useAimsTechnicalFile.ts:245-274`). Mientras tanto, la pestaña promete «monitorización continua de deriva» (`TabVigilancia.tsx:69-74`).

**5.9 Retirada a medias en el expediente técnico.**
- Se retiró el cierre del expediente, pero el selector de estado de cada sección sigue ofreciendo «Conforme» y «Cerrada», sin revisor (`TabExpedienteTecnico.tsx:232-243`).
- Las secciones sembradas del Motor de triaje tienen AIV-03 y AIV-04 con contenido desplazado respecto al anexo IV, y aparecen como «Conforme · Revisada» sin revisor.
- El monitor «Expediente técnico» no lee las secciones.

**5.10 Catálogo sin recotejar contra el texto final.**
- **Art. 12:** los títulos visibles presentan como generales los mínimos del 12.3, que solo aplican a la biometría remota del anexo III 1 a) (`catalog-aesia.ts:475-497`). El «12.4» inexistente es una clave interna (`subpartId`) que no se pinta.
- **Art. 13:** trata al destinatario como «usuario final» y faltan los puntos 13.3 b) i), iv), v) y vii).
- **Art. 17.1:** las claves internas del catálogo están desplazadas respecto a las letras del artículo: la «d» lleva la f), la «e» la g), y así hasta la «k», que lleva la m) (`catalog-aesia.ts:283-290`). No se pintan en pantalla, porque se muestra el título. Las verdaderas d) y e) no tienen medida.
- **Anexo A de ISO 42001:** numeración desplazada en pantalla (`:571, 585, 599, 613`).
- **Art. 4:** conserva «Garantizar un nivel suficiente» (`perfil-aplicabilidad.ts:139`) y mide el «aprovechamiento» de la formación. Tras el Ómnibus el artículo exige adoptar medidas y dice expresamente que no exige un nivel específico.

**5.11 Documentos y autoridades a nombre equivocado.**
- La declaración del art. 47 pone como «Entidad» al grupo («Grupo Garrigues», «Grupo ARGA Seguros»), que no es una persona jurídica, bajo la frase «exclusiva responsabilidad del proveedor identificado» (`DeclaracionConformidadModal.tsx:38, 118-126`).
- El reloj del RIA muestra siempre como autoridad «AESIA» (`incident-clocks.ts:21, 132`). Para ARGA, el art. 74.6 atribuye la vigilancia al supervisor financiero.
- El reloj no mira el rol. A un responsable del despliegue le pinta el plazo del proveedor, cuando su primer deber es informar al proveedor (art. 26.5).

**5.12 Control de acceso.** Aplica a todo el producto fuera de Secretaría, no solo a AIMS. La RLS solo filtra por tenant: cualquier rol, un consejero o un auditor incluidos, puede clasificar, congelar y revisar.

---

## 6. Lo que está impreciso o mal enfocado en su material

Este es el material de un colega de primer nivel. Casi todas sus citas resisten el cotejo con el DOUE. Lo que sigue va con el texto delante.

### 6.1 Errores objetivos

1. **OB-43: el art. 50.2 atribuido al «Distribuidor».**
   - El art. 50.2 dice: «Los proveedores de sistemas de IA, entre los que se incluyen los sistemas de IA de uso general, que generen contenido sintético de audio, imagen, vídeo o texto, velarán por que…». El distribuidor del art. 3.7 no tiene obligaciones en el art. 50.
   - En su Excel el rol es una categoría que suma (Dashboard B25, COUNTIF sobre la columna F). Corregido quedaría Proveedor 28 y Distribuidor 3, que son los del art. 24.
   - El paréntesis «(deepfake)» es defendible, porque una ultrasuplantación también debe llevar el marcado del proveedor. Lo que falta es una fila para el deber del responsable del despliegue sobre ultrasuplantaciones (art. 50.4, párrafo primero).
   - Fuentes: https://artificialintelligenceact.eu/article/50/ y EUR-Lex CELEX:32024R1689.
2. **OB-12: «Art. 10.4.f)».**
   - El art. 10.4 no tiene letras. Lo que describe es el 10.5.f): el registro de actividades de tratamiento debe recoger por qué fue estrictamente necesario tratar categorías especiales de datos para corregir sesgos.
   - Desde el Reglamento (UE) 2026/1744 ese contenido está en el art. 4 bis.1.f). El 10.5 queda suprimido y el 4 bis.2 extiende el régimen a los responsables del despliegue.
   - Es además un régimen habilitante («podrán tratar excepcionalmente»), no un deber general de actualizar el registro.
   - Fuentes: https://artificialintelligenceact.eu/article/10/ y https://artificialintelligenceact.eu/article/4a/.
3. **OB-56: el tipo de sistema.** Copia el de OB-55 («Alto riesgo y sistemas del Anexo III no considerados de alto riesgo»). Pero el art. 49.3 y la sección C del anexo VIII solo se refieren a sistemas de alto riesgo del anexo III, salvo el punto 2. Registrar un sistema rebajado por el 6.3 corresponde al proveedor (art. 49.2, sección B). Fuente: https://artificialintelligenceact.eu/article/49/.
4. **Integridad del Excel.**
   - Dashboard G25 y G26 contienen `=COUNTIF(Obligaciones!#REF!,…)`: la columna «Origen» que describe la Leyenda (C7) ya no existe. Arreglo mínimo: `COUNTBLANK(Obligaciones!O2:O66)` da 59 y `COUNTIF(Obligaciones!O2:O66,"Incorporado*")` da 6.
   - El estado (J) y el porcentaje (K) son independientes, así que nada impide un «Completado» al 50 % (OB-02). Los valores son ilustrativos; el problema es la estructura.
5. **OB-22: el art. 20 con rol principal «Proveedor / Despliegue».** El art. 20.1 dice: «Los proveedores de sistemas de IA de alto riesgo que consideren o tengan motivos para considerar…». El responsable del despliegue es destinatario de la información y colabora en la investigación (20.2). Es una imprecisión de columna, porque en «Roles implicados» está bien. Su deber propio es el 26.5, que el experto ya recoge en OB-58.

**Recuentos que cuadran.** Las 59 obligaciones «base» más 6 «Añadido (completitud)» (columna Notas: EIPD y arts. 43, 47, 48, 53.1 c y 55) dan las 65. Los 78 entregables de la diapositiva 5 y los 76 del HTML no están reconciliados en el material; la diferencia puede venir de desdoblamientos de filas, pero no consta. Los «cimientos» (RIA, RGPD y ciberseguridad) son la base legal que el análisis ha tratado como transversal.

**Incoherencias internas menores**, propias de una prueba de concepto:
- el HTML tiene 7 textos repetidos; d42-d44 son idénticos, y d59 y d60 declaran formar parte de otro entregable, lo que infla el denominador del avance;
- la remisión a «punto 39» no se resuelve (OB-39 es el art. 43);
- las 6 obligaciones «Añadido (completitud)» (EIPD, arts. 43, 47, 48, 53.1.c y 55) no están en el HTML, aunque la diapositiva 14 las presenta como entregables clave. Es desfase de versión: la 13 dice que el detalle vive en el Excel;
- erratas: «alfebitización», «Sanbox», «necesariamento», «medias adoptadas» y «hardware generados», donde el art. 13.3.e dice «necesarios».

### 6.2 Decisiones de diseño discutibles

- **Seguimiento sin sistema ni sociedad.** Su Excel se presenta como prueba de concepto (Dashboard B3) y su método sí trabaja por sistema (Fases C6, C7, E7), así que no es un error. Pero la herramienta que prometen las diapositivas 8 y 15 no puede llevar con un único estado lo que es por sistema: EIDF, documentación técnica, registro, logs, declaración UE. Tampoco puede tratar un grupo, donde cada rol es de una sociedad distinta.
- **El cuadro digital no admite «no aplica».** El Excel sí lo tenía (Leyenda C5).
  - Un responsable del despliegue puro tiene unos 21 entregables que no le aplican (d3-d5, d8, d34-d41, d52, d61-d67, d69) y nunca llega al 100 % sin marcar «Hecho» lo que no le toca.
  - La fecha de cada entregable no alimenta ninguna alarma.
  - La fase «continua» acabará marcada como VENCIDA.
  - La nota se inserta sin escapar en el HTML (`cuadro_de_mando.html:181`).
- **Plan secuencial.** El art. 4 está en la fase 4, con cierre en el primer trimestre de 2027, cuando se aplica desde el 2-2-2025. Conviene tratar los arts. 4 y 5 como regularización inmediata.
- **OB-37: «Alto riesgo (sector público, Anexo III.5(b)(c))».** Se puede leer como si los puntos 5 b) y 5 c) fueran sector público. El art. 27.1 alcanza también al privado que despliega esos sistemas; el considerando 96 cita expresamente bancos y aseguradoras. Es la fila que decide si ARGA Score necesita EIDF, y el HTML (d51) pierde incluso ese matiz.
- **OB-03: art. 5.2.** Es un deber de la autoridad garante del cumplimiento del Derecho que despliega el sistema. La etiqueta «Despliegue» recoge al sujeto correcto, pero para clientes privados debería venir como N/A por defecto. La notificación está en el 5.4, y falta la autorización previa del 5.3.
- **OB-07: art. 25 con tipo «Alto riesgo».** El 25.1 c) parte de un sistema que no es de alto riesgo, incluidos los de uso general. La abreviatura es defendible, pero conviene nombrar los sistemas de uso general, porque ahí está la conversión real (Copilot, Harvey).
- **OB-38 (EIPD): el tipo «Alto riesgo (datos personales)» dejaría la fila como N/A en Garrigues, y no debe.** El puente del art. 26.9 RIA solo existe en alto riesgo. El deber del art. 35.1 RGPD depende del riesgo del tratamiento, y una herramienta generativa con datos de clientes puede alcanzarlo. Conviene partir la fila en dos: art. 35 RGPD para todo tratamiento de alto riesgo, y puente del 26.9 para alto riesgo RIA. Para Garrigues, la EIPD es la obligación ya en vigor más concreta que tiene.
- **Abreviaturas defendibles que conviene alinear si la matriz pasa a ser catálogo:**
  - OB-55 y OB-56 citan los arts. 71.2 y 71.3, que regulan quién introduce los datos, y no el art. 49, que es la obligación de registrar.
  - En Fases E6, el deber de documentar la excepción está en el art. 6.4, no en el 6.3.
  - OB-64 cita los arts. 91 y 92, que son facultades de la Oficina de IA sobre proveedores de modelos de uso general, con tipo «Todos» y rol «Proveedor».
- **OB-01 cita solo el art. 2.** El cribado del art. 3.1 está en la hoja Fases, pero no tiene fila, y es el grueso del trabajo de la fase 1.
- **OB-27 cita el 23.6.** La cooperación literal está en el 23.7. En OB-28 sí cita los dos apartados paralelos (24.5 y 24.6).
- **No recoge el Reglamento (UE) 2026/1744.** No es un error si la matriz es anterior a julio de 2026, pero hay que actualizar las citas (art. 4; 10.5 → 4 bis) y el calendario.

### 6.3 Lo que falta en su matriz

- **Art. 26.12**, cooperación del responsable del despliegue con las autoridades. Todas sus filas de cooperación son del proveedor.
- **Art. 54**, representante autorizado del proveedor de un modelo de uso general establecido en un tercer país.
- **Arts. 43.4, 27.2 y 111.2.** Para un sistema de alto riesgo ya en servicio, un cambio significativo de diseño no reabre el ciclo: lo abre.
- **Cláusulas de entidades financieras**, decisivas para ARGA: arts. 9.10, 17.4, 18.3, 19.2, 26.5 (último párrafo), 26.6 (párrafo 2) y 72.4 (párrafo 2), y el art. 74.6 para la autoridad. El art. 73.9 no es una cláusula financiera. Se refiere a proveedores sujetos a instrumentos de la Unión con obligaciones de notificación equivalentes. Para aplicarlo a ARGA habría que razonar que DORA o Solvencia II lo son, y aun así solo limitaría la notificación al supuesto del art. 3.49 c).
- **Arts. 5.3, 25.2, 53.2 y 9.10.** El 9.10 permite integrar el sistema de gestión de riesgos en el de Solvencia II.
- **La contraparte del proveedor posterior** (arts. 53.1 b y 3.68).
- **En la EIPD**, la consulta al DPO como paso documentado (art. 35.2 RGPD).

### 6.4 Lo que su material hace mejor que el nuestro

- **Rol por sistema, y múltiple** (Fases C7). Es el defecto 5.1 visto desde el otro lado.
- **Art. 50 acumulable** («No necesariamente alto riesgo» en OB-42 a OB-46), que respeta el art. 50.6.
- **El método de riesgos** de la diapositiva 12. Coincide con el art. 3.2 («combinación de la probabilidad… y la gravedad»), el 9.2, el 9.5 y el 27.1 d)-f).
- **Obligaciones de organización como un único entregable** (OB-09 para el art. 4, OB-19 para el art. 17).
- **Entregables que son documentos:** protocolos, modelos, políticas. Nosotros solo medimos madurez.
- **Capa de gestión:** fases con plazo, alarmas, acciones derivadas y avance por fase, rol y especialidad.
- **Amplitud del catálogo:** importador y distribuidor, registro, espacio controlado de pruebas y arts. 21, 22, 25.4, 74 y 86, que nuestro catálogo no trae.
- **Reevaluación continua como principio** (diapositiva 14), la lectura del art. 5 por usos posibles para el proveedor (OB-02), el puente del art. 26.9 (OB-38) y la duda bien planteada sobre el art. 73.5 (OB-62).

---

## 7. Propuesta de convergencia

Esfuerzos orientativos, con el equipo actual. Todo cambio en Cloud requiere autorización expresa del usuario.

| # | Qué | Esfuerzo | Requiere | Por qué en este orden |
|---|---|---|---|---|
| 1 | **Dejar de afirmar lo no medido.** Monitores asignados por código de requisito, no por subcadena. Un incidente abierto no cuenta como cerrado. Controles solo de la última evaluación no borrador. «Sin alto riesgo» en gris y no en rojo. Clasificación medida por cuestionarios, no por % de activos. «Manda la más reciente» también en evaluaciones. Indicadores que nacen «sin medición». Quitar «Conforme» y «Cerrada» del selector de secciones. Título «Autodiagnóstico» en lugar de «Evaluaciones de riesgo». Declaración del art. 47 sin rellenar el grupo. | 3-5 días | Solo código de cliente | Antes de que nadie clasifique ni enseñe el Dashboard. |
| 2 | **Corregir ayudas y etiquetas.** Q2_1: diez letras (a-h, más b bis y b ter desde el 2-12-2026, con el alcance del art. 5.1 bis), sin «SOLO si», sin «ante la duda No», letra h) bien acotada. Q2_3: retirar el scoring crediticio y avisar del perfilado. Art. 4 con la redacción del Ómnibus. MD_TRA_01 y MD_CS_01/02/05 como marco operativo. Autoridad del incidente sin AESIA por defecto para entidades financieras. | 2-3 días | Revisión del texto por el Comité Legal | Son las pantallas que verá quien clasifique por primera vez. |
| 3 | **Sesión de modelo** con Legal, el Comité de IA y el experto. Primera pregunta: ¿su proyecto es el cumplimiento interno de Garrigues o la metodología que Garrigues ofrece a clientes? Después: qué persona jurídica provee GA_IA (previsiblemente la matriz), qué sociedad despliega ARGA Score, catálogo base (sus 65 corregidas más las filas de 6.3), catálogo del perfil B (DA-2) y alcance del art. 27 para ARGA (DA-4, que el texto permite cerrar). | 1-2 sesiones | Decisión del usuario, Legal y Comité de IA | Todo lo que sigue depende de estas respuestas. |
| 4 | **Modelo de sujeto.** Tabla sistema × sociedad × rol (N:M, solo personas jurídicas activas: `sociedadesOnly` más `entity_status`, y Legal decide si fundaciones, institutos y vehículos pueden ser sujeto). Marcos derivados también en servidor, con el mismo rechazo por CLASIFICACION_INCOHERENTE. Fecha de puesta en servicio y cambio significativo en el cuestionario, para aplicar el art. 111.2. Cuestionario por fila. Doble rol derivado de Q1_4. Art. 50 acumulable al alto riesgo. Punto del anexo III en lugar de sí/no. Control de perfilado del 6.3 en cliente y en servidor. `entity_id` en incidentes y en los traspasos entre módulos. Antes, sanear las sociedades duplicadas de ARGA. | 3-4 semanas | Migración en esquema compartido, sin tocar el dato sembrado de Garrigues ni el contrato de cero cambios de ARGA | Es la raíz: sin sujeto no hay art. 2, ni EIDF por sociedad, ni autoridad correcta. |
| 5 | **Obligaciones de organización del RIA en el registro GRC.** Empezar por el art. 4, la única obligación de organización que ya vincula sin condiciones a los dos tenants. En Garrigues, órgano responsable = Comité de IA, con enlace a PI-30. Corregir antes el trigger que hoy las mandaría al módulo 'risk'. AIMS las lee; no las escribe. | ~1 semana | Contrato entre módulos, siembra idempotente con tenant explícito y migración del trigger | Saca el art. 4 y el sistema de gestión de la calidad de las evaluaciones por sistema. |
| 6 | **Perfil B, EIDF y riesgo por sistema, apoyándose en GRC.** El riesgo de cada sistema de IA se registra en `risks` de GRC, que ya tiene probabilidad, impacto, inherente, residual, sociedad, responsable y obligación, con una referencia al `ai_system`. Lo alimenta el traspaso AIMS→Risk-360 que ya existe. GRC escribe y AIMS lee. Lo mismo con `action_plans` frente al plan de adaptación en jsonb, pero exige relajar el `finding_id` NOT NULL o crear un hallazgo por cada brecha. Hay que enlazar RSK-TECH-005 y corregir RSK-STRA-005. EIPD como objeto enlazado con la EIDF (art. 27.4) y EIDF sobre la plantilla de la Oficina de IA (art. 27.5). Falta además la cadena del art. 26.5. | 3-5 semanas | Contrato entre AIMS y GRC, catálogo validado por el Comité de IA y migración | Es lo que ARGA necesitará para ARGA Score o su sucesor antes del 2-12-2027, sin duplicar lo que GRC ya tiene. |
| 7 | **Capa de gestión.** Fases calculadas desde el dato; acciones vivas fuera de la evaluación congelada; alarmas por fecha de exigibilidad que distingan «ya exigible» de «exigible el…»; reapertura cuando cambian la finalidad, la versión, el estado o la versión del cuestionario. | 2-3 semanas | Migración para acciones modificables | Aquí la vista del experto pasa a ser una proyección del dato. |
| 8 | **Recotejo del catálogo AESIA e ISO** contra el texto consolidado posterior al Ómnibus, con fecha de verificación, como se hizo con las 21 citas de PBC/FT. | ~1 semana jurídica, en paralelo | Legal | El anexo A de ISO se pinta con numeración desplazada, los títulos del art. 12 generalizan el 12.3 y las claves internas del art. 17 no casan con sus letras. |

---

## 8. Límites de este análisis

- **Código.** Se analizó la instantánea congelada `b1721a5`. No se ejecutaron tests. Un revisor ejecutó `buildAimsReadiness` de la instantánea contra el dato vivo.
- **Cloud.** Solo consultas SELECT, el 19-09-2026. No se escribió nada.
- **Derecho.** Fuentes: el DOUE de 12-7-2024 en EUR-Lex y la consolidación de artificialintelligenceact.eu, que es de un tercero. Algunas descargas de EUR-Lex llegaron truncadas.
  - Reglamento (UE) 2026/1744: arts. 111 y 113 y art. 5.1 bis verificados en el texto oficial en español de EUR-Lex, leído directamente en un navegador. **Error corregido en esta versión:** la versión anterior fijaba el corte del art. 111.2 en el 2-8-2026. Esa fecha salió de un resumen automático que leyó la redacción derogada, que el sitio de consolidación muestra tachada junto a la nueva. El texto oficial remite a la fecha de aplicación del capítulo III: 2-12-2027 para el anexo III. La conclusión sobre ARGA no cambia, se refuerza. Las fechas `deployment_date` de ARGA son dato demo.
  - Las Directrices de la Comisión sobre la definición de sistema de IA se citaron con dos referencias: C(2025) 924, de 6-2-2025, y C(2025) 5053 final, de 29-7-2025.
- **Material del experto.** No se ha juzgado el estado, el porcentaje, el responsable ni la fecha de sus filas, que él declara ilustrativos. Su alcance excluye las facultades de las autoridades, la gobernanza pública y el régimen sancionador, y aquí tampoco se evalúan.
- **La relevancia es provisional.**
  - Hay 0 cuestionarios completados.
  - Los niveles «Alto» de ARGA son heredados.
  - Qué sociedad despliega ARGA Score y quién provee GA_IA son hipótesis.
  - Las 32 que aplican a ARGA (7 hoy y 25 latentes) descansan sobre todo en que ARGA Score sea de alto riesgo y ARGA su proveedora. Ese sistema está amparado por el art. 111.2.
- **Puntos de las dimensiones corregidos por su verificación.** Varios no se sostuvieron tal como estaban formulados y se han usado con su corrección:
  - el Comité de IA como «cobertura» (es un enlace);
  - las cifras de especialidad del experto (miden participación, no se comparan con el HTML);
  - «equipo sin DPO» (es el equipo del consultor, no el del cliente);
  - la tipología de OB-07 y la crítica a su ciclo continuo (observaciones, no errores);
  - la receta de sembrar el RIA en GRC (el trigger no tiene rama de IA y no todas las obligaciones vinculan a los dos tenants).
- **Crítico de completitud y verificación final.** El crítico hizo doce observaciones: dos altas (relevancia sin partir por exigibilidad; registro de riesgos de GRC ignorado), siete medias y tres bajas. Después, dos revisores independientes verificaron la versión corregida y encontraron veinticuatro puntos más, entre ellos el error del art. 111.2. Todos están incorporados en esta versión. Una observación del crítico (letras «desplazadas en pantalla» del art. 17) se corrigió porque su premisa era falsa: son claves internas que no se pintan.
- **Desempates.** Los cuatro veredictos disputados se resolvieron con el criterio conservador. Si se leyera con más amplitud, OB-12 y OB-42 podrían contarse como parciales mínimas. La cifra pasaría a 29 parciales y 35 no cubiertas.

---

## Anexo A. Las 65 obligaciones, una por una

Generado desde el dato del análisis, no redactado a mano. «Veredicto» es el final, tras dos revisores adversariales y el desempate cuando lo hubo. Rutas relativas a la instantánea `b1721a5`. «Exigibilidad» a 19-9-2026 con el RIA modificado por el Reglamento (UE) 2026/1744 (texto oficial en español, verificado):

- **HOY**: exigible hoy (arts. 2 y 3.1 como puerta; arts. 4, 5 y 50; EIPD del RGPD).
- **LATENTE**: régimen de alto riesgo (capítulo III y deberes conexos de los capítulos VIII y IX). El capítulo III, secciones 1 a 3, se aplica al anexo III desde el 2-12-2027 y al anexo I desde el 2-8-2028 (art. 113). A los sistemas introducidos o puestos en servicio **antes de esas fechas** solo les alcanza si sufren un cambio significativo de diseño (art. 111.2, en la redacción del Ómnibus). La sección 5 (arts. 40-49) no figura en el aplazamiento y formalmente sigue la fecha general, pero se activa sobre la clasificación del art. 6, que sí está aplazada. Hace falta criterio de Legal.
- **CONDICIONADA**: solo si el tenant es importador, distribuidor, proveedor de un modelo de uso general, proveedor establecido fuera de la UE, autoridad pública, o participa en un espacio controlado o en pruebas en condiciones reales. Hoy no consta ninguno de esos hechos.

«Garrigues» y «ARGA»: relevancia según el juez (APLICA / DEPENDE / NO_APLICA). Única salvedad: OB-43 en Garrigues pasa de APLICA a DEPENDE, porque no consta quién provee GA_IA. «⚠ cita» marca una base legal que no resiste el cotejo; «⚠ sujeto», un rol principal que no es el sujeto al que el artículo obliga.

| OB | Tema (experto) | Base legal | Rol principal | Veredicto | Exigibilidad | Garrigues | ARGA | Evidencia principal |
|---|---|---|---|---|---|---|---|---|
| OB-01 | Evaluación de aplicabilidad del RIA | Art. 2 RIA | Proveedor / Despliegue | NO_CUBIERTO | HOY | APLICA | APLICA | `src/pages/ai-governance/SistemaNuevo.tsx:86-92`<br>`src/pages/ai-governance/SistemaNuevo.tsx:201-213` |
| OB-02 | Categorización de prácticas de IA prohibidas | Art. 5.1. RIA | Proveedor / Despliegue | PARCIAL | HOY | APLICA | APLICA | `src/lib/aims/cuestionario-calificacion.ts:127-144`<br>`src/lib/aims/cuestionario-calificacion.ts:140` |
| OB-03 | Evaluación de impacto relativa a los derechos fundamentales + registr… | Art. 5.2 RIA (excepción) | Proveedor / Despliegue ⚠ sujeto | NO_CUBIERTO | CONDICIONADA | NO_APLICA | NO_APLICA | `src/lib/aims/cuestionario-calificacion.ts:241-259`<br>`src/lib/aims/cuestionario-calificacion.ts:134` |
| OB-04 | Categorización de sistemas | Art. 6.1.; 6.2. y 6.3. RIA. | Proveedor / Despliegue | PARCIAL | LATENTE | APLICA | APLICA | `src/lib/aims/cuestionario-calificacion.ts:145-162`<br>`src/lib/aims/cuestionario-calificacion.ts:163-181` |
| OB-05 | Notificación a la Comisión cuando un modelo de IA de uso general cump… | Art. 52.1 | Proveedor GPAI | NO_CUBIERTO | CONDICIONADA | NO_APLICA | NO_APLICA | `src/lib/aims/cuestionario-calificacion.ts:201-218`<br>`src/lib/aims/cuestionario-calificacion.ts:242-259` |
| OB-06 | Designación de representante autorizado | Art. 22. RIA | Proveedor | NO_CUBIERTO | CONDICIONADA | NO_APLICA | DEPENDE | `src/lib/aims/rol-regulatorio.ts:30-36`<br>`supabase/migrations/20260907180000_ai_systems_rol_regulatorio_y_clasificacion_motivada.sql:44-51` |
| OB-07 | Responsabilidad a lo largo de la cadena (verificación de roles) | Art. 25 RIA | Responsable del despliegue | PARCIAL | LATENTE | APLICA | APLICA | `src/lib/aims/cuestionario-calificacion.ts:51-108`<br>`src/lib/aims/cuestionario-calificacion.ts:242-259` |
| OB-08 | Responsabilidad a lo largo de la cadena (contrato entre proveedor y t… | Art. 25.4 RIA | Proveedor | NO_CUBIERTO | LATENTE | DEPENDE | APLICA | `src/lib/aims/perfil-aplicabilidad.ts:84`<br>`src/lib/aims/perfil-aplicabilidad.ts:321-339` |
| OB-09 | Alfabetización en materia de IA | Art. 4 RIA | Proveedor / Despliegue | PARCIAL | HOY | APLICA | APLICA | `src/lib/aims/perfil-aplicabilidad.ts:72-76`<br>`src/lib/aims/perfil-aplicabilidad.ts:133-151` |
| OB-10 | Sistema de gestión de riesgos | Art. 9 | Proveedor | PARCIAL | LATENTE | DEPENDE | APLICA | `src/lib/aims/catalog-aesia.ts:306-333`<br>`src/lib/aims/catalog-aesia.ts:146` |
| OB-11 | Gobernanza de datos | Art. 10 | Proveedor | PARCIAL | LATENTE | DEPENDE | APLICA | `src/lib/aims/catalog-aesia.ts:362-391`<br>`src/lib/aims/readiness.ts:226-233` |
| OB-12 | Actualización de RATs | Art. 10.4.f) ⚠ cita → Art. 10.5.f) RIA (DOUE de 12.7.2024), en relación con… | Proveedor | NO_CUBIERTO (desempate) | LATENTE | DEPENDE | DEPENDE | `src/lib/aims/catalog-aesia.ts:377,389`<br>`src/lib/aims/perfil-aplicabilidad.ts:88,187` |
| OB-13 | Documentación técnica del sistema | Art 11 RIA. Anexo IV RIA | Proveedor | PARCIAL | LATENTE | DEPENDE | APLICA | `src/lib/aims/expediente-tecnico.ts:15-25`<br>`src/lib/aims/expediente-tecnico.ts:35-41` |
| OB-14 | Registros de eventos (logs) del sistema | Art. 12 RIA; Art. 19 RIA, art 26 RIA | Proveedor / Despliegue | PARCIAL | LATENTE | DEPENDE | APLICA | `src/lib/aims/catalog-aesia.ts:475-497`<br>`src/components/ai-governance/evaluacion/PasoMedidas.tsx:214 y evaluacion-detalle/ChecklistMedidas.tsx:159` |
| OB-15 | Transparencia y comunicación a responsables del despliegue | Art. 13 RIA | Proveedor | PARCIAL | LATENTE | DEPENDE | APLICA | `src/lib/aims/catalog-aesia.ts:393-422`<br>`src/lib/aims/catalog-aesia.ts:516` |
| OB-16 | Supervisión humana | Art. 14 RIA | Proveedor | PARCIAL | LATENTE | DEPENDE | APLICA | `src/lib/aims/catalog-aesia.ts:335-360`<br>`src/lib/aims/catalog-aesia.ts:419` |
| OB-17 | Precisión, solidez y ciberseguridad | Art. 15 RIA | Proveedor | PARCIAL | LATENTE | DEPENDE | APLICA | `src/lib/aims/catalog-aesia.ts:425-472`<br>`src/lib/aims/catalog-aesia.ts:414` |
| OB-18 | Obligaciones de proveedores de sistemas de alto riesgo | Art. 16 RIA | Proveedor | PARCIAL | LATENTE | DEPENDE | DEPENDE | `src/lib/aims/cuestionario-calificacion.ts:242-259`<br>`src/lib/aims/cuestionario-calificacion.ts:343-349` |
| OB-19 | Sistema de gestión de la calidad (documentación SGC) | Art. 17 RIA | Proveedor | PARCIAL | LATENTE | DEPENDE | DEPENDE | `src/lib/aims/catalog-aesia.ts:275-304`<br>`src/hooks/useAimsEvidence.ts:88-157` |
| OB-20 | Conservación de documentación | Art. 18 RIA | Proveedor | PARCIAL | LATENTE | DEPENDE | DEPENDE | `src/lib/aims/expediente-tecnico.ts:15-25`<br>`src/hooks/useAimsTechnicalFile.ts:128-153` |
| OB-21 | Archivos de registro generados automáticamente | Art. 19 RIA | Proveedor | PARCIAL | LATENTE | DEPENDE | DEPENDE | `src/lib/aims/catalog-aesia.ts:494`<br>`src/pages/ai-governance/EvaluacionNueva.tsx:189-209` |
| OB-22 | Medidas correctoras y obligación de información | Art. 20 RIA | Proveedor / Despliegue ⚠ sujeto | PARCIAL | LATENTE | DEPENDE | DEPENDE | `src/lib/aims/plan-adaptacion.ts:15-118`<br>`src/pages/ai-governance/EvaluacionNueva.tsx:209` |
| OB-23 | Obligaciones de los importadores (checklist cumplimiento) | Art. 23. 1;2 RIA | Importador | NO_CUBIERTO | CONDICIONADA | DEPENDE | DEPENDE | `src/lib/aims/cuestionario-calificacion.ts:225`<br>`src/lib/aims/cuestionario-calificacion.ts:242-259` |
| OB-24 | Obligaciones de los importadores (identificación) | Art. 23. 3 RIA | Importador | NO_CUBIERTO | CONDICIONADA | DEPENDE | DEPENDE | `src/hooks/useAiSystems.ts:5-28`<br>`src/pages/ai-governance/SistemaNuevo.tsx:240-247` |
| OB-25 | Obligaciones de los importadores (condiciones de almacenamiento o tra… | Art. 23. 4 RIA | Importador | NO_CUBIERTO | CONDICIONADA | DEPENDE | DEPENDE | `src/lib/aims/expediente-tecnico.ts:23`<br>`supabase/migrations/20260908120000_aims_cuestionario_calificacion.sql:355-362` |
| OB-26 | Obligaciones de los importadores (obligaciones de conservación) | Art. 23. 5 RIA | Importador | NO_CUBIERTO | CONDICIONADA | DEPENDE | DEPENDE | `supabase/migrations/20260907190000_aims_evidencias_por_medida.sql`<br>`supabase/migrations/20260914120000_ai_aims_revoca_delete_sin_uso.sql:23-24` |
| OB-27 | Obligaciones de los importadores (cooperación con autoridades) | Art. 23.6. RIA | Importador | NO_CUBIERTO | CONDICIONADA | DEPENDE | DEPENDE | `src/lib/aims/incident-clocks.ts:11-40`<br>`src/lib/aims/incident-clocks.ts:253-264` |
| OB-28 | Obligaciones de distribuidores (cooperación con autoridades) | Art. 24. 5;6 RIA | Distribuidor | NO_CUBIERTO | CONDICIONADA | DEPENDE | DEPENDE | `src/lib/aims/rol-regulatorio.ts:78-84`<br>`supabase/migrations/20260908120000_aims_cuestionario_calificacion.sql:355-362` |
| OB-29 | Obligaciones de los distribuidores (checklist cumplimiento) | Art. 24.1; 2; 4 RIA | Distribuidor | NO_CUBIERTO | CONDICIONADA | DEPENDE | DEPENDE | `src/lib/aims/cuestionario-calificacion.ts:321-329`<br>`src/lib/aims/cuestionario-calificacion.ts:309` |
| OB-30 | Obligaciones de los distribuidores (condiciones de almacenamiento y t… | Art. 24.3 RIA | Distribuidor | NO_CUBIERTO | CONDICIONADA | DEPENDE | DEPENDE | `supabase/migrations/20260908120000_aims_cuestionario_calificacion.sql:355-362`<br>`src/lib/aims/rol-regulatorio.ts:78-84` |
| OB-31 | Obligaciones de responsable del despliegue: Procedimiento interno de… | Art. 26.1 RIA | Responsable del despliegue | NO_CUBIERTO | LATENTE | DEPENDE | APLICA | `src/lib/aims/cuestionario-calificacion.ts:330-342`<br>`src/lib/aims/perfil-aplicabilidad.ts:100-104, 212-229` |
| OB-32 | Obligaciones de responsable del despliegue: Designación de supervisor… | Art. 26.2 RIA | Responsable del despliegue | NO_CUBIERTO (desempate) | LATENTE | DEPENDE | APLICA | `src/components/ai-governance/sistema/EditarSistemaModal.tsx:34,55`<br>`src/lib/aims/perfil-aplicabilidad.ts:103,224` |
| OB-33 | Obligaciones de responsable del despliegue: Validación/calidad de dat… | Art. 26.4 RIA | Responsable del despliegue | NO_CUBIERTO | LATENTE | DEPENDE | APLICA | `src/lib/aims/perfil-aplicabilidad.ts:247`<br>`src/lib/aims/catalog-aesia.ts:363-390` |
| OB-34 | Obligaciones de responsable del despliegue: conservación de registros | Art. 26.6 RIA | Responsable del despliegue | PARCIAL | LATENTE | DEPENDE | APLICA | `src/lib/aims/catalog-aesia.ts:475-497`<br>`src/lib/aims/perfil-aplicabilidad.ts:321-338` |
| OB-35 | Obligaciones de responsable del despliegue: Comunicación a trabajador… | Art. 26.7 RIA | Responsable del despliegue | NO_CUBIERTO | LATENTE | DEPENDE | DEPENDE | `src/lib/aims/cuestionario-calificacion.ts:148-162`<br>`supabase/migrations/20260908120000_aims_cuestionario_calificacion.sql:369` |
| OB-36 | Obligaciones de responsable del despliegue: Información a personas af… | Art. 26.11 RIA | Responsable del despliegue | NO_CUBIERTO | LATENTE | DEPENDE | APLICA | `src/lib/aims/perfil-aplicabilidad.ts:89,188`<br>`src/lib/aims/perfil-aplicabilidad.ts:164` |
| OB-37 | Evaluación de Impacto en Derechos Fundamentales (EIDF) | Art. 27 RIA | Responsable del despliegue | RETIRADO | LATENTE | NO_APLICA | APLICA | `src/pages/ai-governance/SistemaDetalle.tsx:9-13`<br>`docs/superpowers/plans/2026-09-08-ledger-refactor-aims.md:58-60` |
| OB-38 | Evaluación de impacto en protección de datos (RGPD) | Art. 35 RGPD (puente Art. 26.9 RIA) | Responsable del despliegue | PARCIAL | HOY | APLICA | APLICA | `src/lib/aims/perfil-aplicabilidad.ts:85, 179, 184`<br>`src/lib/aims/perfil-aplicabilidad.ts:341-351` |
| OB-39 | Evaluación de la conformidad | Art. 43 RIA | Proveedor | PARCIAL | LATENTE | DEPENDE | DEPENDE | `supabase/migrations/20260907210000_aims_congelacion_y_plan_de_adaptacion.sql:87,159`<br>`src/hooks/useAiAssessments.ts:293,308` |
| OB-40 | Declaración UE de conformidad | Art. 47 RIA | Proveedor | PARCIAL | LATENTE | DEPENDE | DEPENDE | `src/components/ai-governance/DeclaracionConformidadModal.tsx:38`<br>`src/components/ai-governance/DeclaracionConformidadModal.tsx:52,62-101` |
| OB-41 | Marcado CE | Art. 48 RIA | Proveedor | NO_CUBIERTO | LATENTE | DEPENDE | DEPENDE | `src/lib/aims/perfil-aplicabilidad.ts:160,165` |
| OB-42 | Aviso de sistema IA a humanos | Art. 50.1 RIA | Proveedor | NO_CUBIERTO (desempate) | HOY | DEPENDE | APLICA | `src/lib/aims/cuestionario-calificacion.ts:183-199`<br>`src/lib/aims/cuestionario-calificacion.ts:275-283` |
| OB-43 | Etiquetado de contenidos sintéticos (deepfake) | Art. 50.2 RIA | Distribuidor ⚠ sujeto | NO_CUBIERTO | HOY para sistemas nuevos; 2-12-2026 para los introducidos antes del 2-8-2026 (art. 111.4) | DEPENDE | APLICA | `src/lib/aims/perfil-aplicabilidad.ts:157`<br>`src/lib/aims/perfil-aplicabilidad.ts:160` |
| OB-44 | Aviso en reconocimiento de emociones/biométrico | Art. 50.3 RIA | Responsable del despliegue | NO_CUBIERTO | HOY | NO_APLICA | NO_APLICA | `src/lib/aims/cuestionario-calificacion.ts:128-145`<br>`src/lib/aims/cuestionario-calificacion.ts:152` |
| OB-45 | Divulgación en contenido de interés público | Art. 50.4 RIA | Responsable del despliegue | PARCIAL | HOY | DEPENDE | DEPENDE | `src/lib/aims/perfil-aplicabilidad.ts:79`<br>`src/lib/aims/perfil-aplicabilidad.ts:160,165` |
| OB-46 | Forma de presentar la información | Art. 50.5 RIA | Responsable del despliegue ⚠ sujeto | NO_CUBIERTO | HOY | DEPENDE | APLICA | `src/lib/aims/perfil-aplicabilidad.ts:164`<br>`src/lib/aims/perfil-aplicabilidad.ts:152-167` |
| OB-47 | Documentación técnica de modelo general | Art 53.1.a RIA | Proveedor GPAI | NO_CUBIERTO | CONDICIONADA | DEPENDE | NO_APLICA | `src/lib/aims/cuestionario-calificacion.ts:202-218`<br>`src/lib/aims/cuestionario-calificacion.ts:362-373` |
| OB-48 | Información y documentación para proveedores de sistemas de IA que te… | Art 53.1.b RIA | Proveedor GPAI | NO_CUBIERTO | CONDICIONADA | DEPENDE | NO_APLICA | `src/lib/aims/perfil-aplicabilidad.ts:192-205`<br>`src/lib/aims/perfil-aplicabilidad.ts:91-92` |
| OB-49 | Resumen detallado del contenido utilizado para el entrenamiento de mo… | Art 53.1.d RIA | Proveedor GPAI | NO_CUBIERTO | CONDICIONADA | DEPENDE | NO_APLICA | `src/lib/aims/cuestionario-calificacion.ts:362-373`<br>`supabase/migrations/20260426151000_000043_aims360_core.sql:88-107` |
| OB-50 | Política de derechos de autor (GPAI) | Art. 53.1.c RIA | Proveedor GPAI | NO_CUBIERTO | CONDICIONADA | DEPENDE | NO_APLICA | `src/lib/aims/cuestionario-calificacion.ts:362-373` |
| OB-51 | Modelos GPAI con riesgo sistémico | Art. 55 RIA | Proveedor GPAI | NO_CUBIERTO | CONDICIONADA | NO_APLICA | NO_APLICA | `src/lib/aims/cuestionario-calificacion.ts:226`<br>`src/lib/aims/incident-clocks.ts:20-26` |
| OB-52 | Participación en Sanbox | Art 57 en adelante | Proveedor | NO_CUBIERTO | CONDICIONADA | DEPENDE | DEPENDE | `src/lib/aims/vocabulario.ts:17: ESTADOS_SISTEMA = ACTIVO | EN_EVALUACION | PLANIFICADO | RETIRADO. Ningún estado recoge que el sistema está en un espacio controlado; según el art. 3.57, probar conforme a los arts. 57 o 60 no es introducir en el mercado ni poner en servicio`<br>`src/lib/aims/cuestionario-calificacion.ts:312-371: derivarMarcos no emite ningún marco de los arts. 57 a 59` |
| OB-53 | Pruebas en entornos reales | Art. 60 (limitaciones art. 5) | Proveedor | NO_CUBIERTO | CONDICIONADA | NO_APLICA | DEPENDE | `src/lib/aims/catalog-aesia.ts:327`<br>`src/lib/aims/catalog-aesia.ts:318-319: el catálogo llama «9.7» a «Pruebas para encontrar soluciones de mitigación», que en el texto final es el 9.6. El 9.7 final` |
| OB-54 | Consentimiento informado para participar en entorno de pruebas real | Art. 61 | Proveedor | NO_CUBIERTO | CONDICIONADA | NO_APLICA | DEPENDE | `supabase/migrations/20260418154408_fase4_ai_governance_tables.sql:2-15: ai_systems no tiene ninguna relación con sujetos de prueba, y ninguna migración ai/aims posterior la añade` |
| OB-55 | Registro en el sistema de la base de datos de la UE | Art. 71.2 | Proveedor | NO_CUBIERTO | LATENTE | DEPENDE | APLICA | `src/lib/aims/cuestionario-calificacion.ts:343-348: para proveedor con nivel Alto, derivarMarcos emite los arts. 9-15, 17 y 47, y 72-73. No emite el art. 16`<br>`src/lib/aims/cuestionario-calificacion.ts:273-291: si se invoca la excepción del art. 6.3, el nivel baja a Limitado o Mínimo y ningún marco recoge el art. 6.4 ni el registro del 49.2` |
| OB-56 | Registro en el sistema de la base de datos de la UE | Art. 71.3 | Responsable del despliegue | NO_CUBIERTO | CONDICIONADA | NO_APLICA | NO_APLICA | `src/lib/aims/perfil-aplicabilidad.ts:215-219: el art. 26 solo aparece como marco operativo`<br>`src/lib/aims/perfil-aplicabilidad.ts:85: MD_PD_02 «Art. 35 RGPD» es una medida autoevaluable, no un resumen de la EIPD` |
| OB-57 | Cooperación con autoridades competentes | Art. 21 RIA | Proveedor | PARCIAL | LATENTE | DEPENDE | APLICA | `src/lib/aims/catalog-aesia.ts:300`<br>`src/lib/aims/evaluacion-payload.ts:171-199` |
| OB-58 | Obligaciones de responsable del despliegue: Plan/Procedimiento de vig… | Art. 26.5 RIA | Responsable del despliegue | PARCIAL | LATENTE | DEPENDE | APLICA | `src/components/ai-governance/sistema/TabVigilancia.tsx:8-9`<br>`src/hooks/useAimsTechnicalFile.ts:245-266` |
| OB-59 | Registro público de IA en uso (autoridades) | Art. 26.8 RIA | Responsable del despliegue | NO_CUBIERTO | CONDICIONADA | NO_APLICA | NO_APLICA | `grep sin coincidencias de «art. 49», «art. 71», «base de datos de la UE» y «26.8» en la superficie AIMS de la…` |
| OB-60 | Sistema de vigilancia poscomercialización | Art. 72 RIA | Proveedor | PARCIAL | LATENTE | DEPENDE | APLICA | `src/components/ai-governance/sistema/TabVigilancia.tsx:25-28, 46-51, 70, 127`<br>`src/hooks/useAimsTechnicalFile.ts:245-274` |
| OB-61 | Plan/Procedimiento de vigilancia poscomercialización | Art. 72 RIA | Proveedor | PARCIAL | LATENTE | DEPENDE | APLICA | `src/lib/aims/expediente-tecnico.ts:24`<br>`src/components/ai-governance/sistema/TabExpedienteTecnico.tsx:92-93` |
| OB-62 | Notificación de incidentes graves | Art. 73 RIA | Proveedor | PARCIAL | LATENTE | DEPENDE | APLICA | `src/lib/aims/incident-clocks.ts:12-17`<br>`src/pages/ai-governance/IncidenteDetalle.tsx:117-134, 163-169` |
| OB-63 | Investigaciones técnicas tras la notificación de incidentes graves | Art. 73.6 RIA | Proveedor | PARCIAL | LATENTE | DEPENDE | APLICA | `src/pages/ai-governance/IncidenteDetalle.tsx:53-69`<br>`src/components/ai-governance/incidente/EdicionIncidente.tsx:68-79, 112-114` |
| OB-64 | Colaboración con las autoridades de vigilancia del mercado | Art. 74.12, 91 y 92 RIA | Proveedor | NO_CUBIERTO (desempate) | LATENTE | DEPENDE | APLICA | `supabase/migrations/20260908130000_ai_aims_revoca_privilegios_heredados.sql:98`<br>`src/hooks/useAimsTechnicalFile.ts:128-150` |
| OB-65 | Transparencia en el proceso de toma de decisiones | Art. 86.1 RIA | Responsable del despliegue | NO_CUBIERTO | LATENTE | DEPENDE | APLICA | `src/lib/aims/catalog-aesia.ts:357`<br>`src/lib/aims/readiness.ts:238` |

**Totales:** 27 parciales, 37 no cubiertas, 1 retirada, 0 cubiertas. Por exigibilidad: HOY 9 (NO_CUBIERTO 5, PARCIAL 4); LATENTE 35 (PARCIAL 23, NO_CUBIERTO 11, RETIRADO 1); CONDICIONADA 21 (NO_CUBIERTO 21).
