# G6 — Riesgo TIC, ciberseguridad y certificaciones del tenant Garrigues

- **Fecha:** 2026-08-20
- **Fase:** G6 del programa del tenant Garrigues (`00000000-0000-0000-0000-000000000002`)
- **Precede:** G5 (núcleo penal evaluado), en ejecución
- **Contrato heredado e innegociable:** cero cambio para ARGA (`…0001`)
- **Estado:** diseño para revisión. No hay plan de implementación todavía.

---

## 1. La conclusión que da la vuelta al planteamiento

La forma natural de abordar «ciberseguridad y NIS2 para el despacho» sería inventariar las
obligaciones de NIS2 y presentarlas como el deber de cumplimiento de Garrigues. **Sería
falso**, y en una demo para abogados es el tipo de error que se detecta en el primer minuto.

Cuatro agentes de investigación y cuatro verificadores adversariales trabajaron sobre
fuente primaria. Lo que resulta:

| Afirmación | Veredicto | Sujeto |
|---|---|---|
| Un despacho español **no** es entidad esencial ni importante de NIS2 por razón de sector | **CONFIRMADA** | — |
| Un QTSP **sí** lo está, y por ser cualificado es entidad **esencial** con independencia del tamaño | **CONFIRMADA** | EAD Trust, S.L. |
| A 2026-08-20 **no hay** transposición de NIS2 en vigor en España | **CONFIRMADA** | — |
| Las certificaciones que el corpus atribuye al despacho constan literalmente | **PARCIAL** | ISO 27001 |

El sujeto obligado por NIS2 dentro de este perímetro **no es el despacho: es su filial
QTSP**. Y ni siquiera hoy, porque España no ha transpuesto.

Ese es el diseño: modelar el sujeto correcto, con la fecha correcta, y no fabricar un
deber de cumplimiento que no existe.

---

## 2. Hechos verificados contra fuente primaria

### 2.1 NIS2 no alcanza a los servicios jurídicos

- Texto oficial en español de la Directiva (UE) 2022/2555, DOUE L 333 de 27.12.2022,
  pp. 80-152, obtenido del espejo del DOUE alojado por el BOE. **El verificador descargó el
  PDF por su cuenta y comprobó que el SHA-256 coincidía byte a byte** con el del agente de
  inventario (`798b7edb…6974a`), y releyó los artículos él mismo en vez de fiarse de la
  extracción ajena.
- **Anexo I** («sectores de alta criticidad»), 11 sectores: energía, transporte, banca,
  infraestructuras de los mercados financieros, sanitario, agua potable, aguas residuales,
  **infraestructura digital**, gestión de servicios TIC B2B, Administración pública, espacio.
- **Anexo II** («otros sectores críticos»), 7 sectores: postales y mensajería, residuos,
  químicas, alimentos, fabricación, proveedores de servicios digitales, investigación.
- **«abogad», «despacho», «notari», «servicios jurídicos»: 0 ocurrencias** en las 4.647
  líneas del texto completo. Verificado dos veces, por dos agentes, sobre extracciones
  independientes.
- El *chapeau* del art. 2.2 cierra las excepciones: «la presente Directiva también se
  aplicará a las entidades **de alguno de los tipos mencionados en los anexos I o II**
  cuando…». Las letras b) a e) —proveedor único, repercusión en seguridad pública, riesgo
  sistémico, criticidad nacional— **no son puerta de entrada autónoma**: presuponen
  pertenecer a un tipo de los anexos.
- El verificador cerró además la laguna que el inventario dejó abierta: leyó el **Anexo de
  la Directiva CER (UE) 2022/2557**, a la que remite el art. 2.3, y sus 11 sectores tampoco
  mencionan abogados ni servicios jurídicos.

### 2.2 Un QTSP sí, y en la categoría superior

- **Anexo I, sector 8 «Infraestructura digital»** incluye literalmente «Prestadores de
  servicios de confianza».
- **Art. 3.1.b):** «se considerarán entidades esenciales: […] b) prestadores **cualificados**
  de servicios de confianza […] **independientemente de su tamaño**».
- Matiz que el verificador señaló y que la formulación inicial no recogía: **la
  cualificación no determina la entrada en ámbito, sino la categoría**. El art. 2.2.a).ii)
  dice «prestadores de servicios de confianza» **sin** el adjetivo «cualificados», así que
  todos entran con independencia del tamaño; ser cualificado es lo que los sube de
  *importante* a *esencial*.
- Consecuencias de ser esencial: supervisión **ex ante** (art. 32, inspecciones in situ)
  frente a la *ex post* de las importantes (art. 33), y multas de hasta 10 M€ o el 2 % del
  volumen mundial frente a 7 M€ o el 1,4 % (art. 34.4 y 34.5).
- **Plazo especial de 24 horas** para notificar incidentes significativos, frente al régimen
  general (art. 23.4, párrafo final).
- Dos excepciones reales que el diseño debe respetar: el **considerando 11** excluye los
  servicios de confianza usados exclusivamente en sistemas cerrados, y el **art. 2.10**
  excluye a las entidades que un Estado miembro haya sacado del ámbito de DORA.

### 2.3 España no ha transpuesto, y hoy el QTSP está *excluido*

- Consulta en vivo al buscador del BOE el 2026-08-20, **con control discriminante**:
  «gobernanza de la ciberseguridad» en el título devuelve cero; «ciberseguridad» devuelve
  259 y el primer resultado es del **BOE 204 de 20/08/2026 — la edición de hoy**. El índice
  está al día: el cero es un cero real.
- Legislación consolidada vigente: **RDL 12/2018 y RD 43/2021**, que son NIS1.
- **Bajo ese marco vigente, los prestadores de servicios de confianza están EXCLUIDOS**
  salvo que sean designados operadores críticos (art. 2.3.a RDL 12/2018, literal).
- El instrumento de transposición es el **Anteproyecto de Ley de Coordinación y Gobernanza
  de la Ciberseguridad**, aprobado por el Consejo de Ministros el **14/01/2025**. El
  verificador obtuvo su **texto íntegro de 81 páginas de la base TRIS de la Comisión**
  (notificación 2025/0104/ES, recibida 21/02/2025) — la fuente que el inventario había
  declarado inaccesible— y comprobó que:
  - su Anexo I añade un sector 12 «Industria Nuclear» y su Anexo II «Seguridad Privada»,
    ausentes de NIS2;
  - la **única** aparición de «despacho» en 81 páginas es «despachos de detectives»;
  - **rebaja el umbral de tamaño** respecto de NIS2: 50 o más trabajadores y volumen o
    balance superior a 10 M€;
  - su art. 3.2.i) permite designar «cualquier otra entidad» por resolución motivada —la
    puerta más ancha que existe— pero el art. 4, que es el que clasifica, no la recoge y
    reimpone el filtro de los anexos.
- **El 8 de julio de 2026 la Comisión Europea remitió a España al TJUE** por falta de
  notificación de la transposición completa, con petición de sanciones. Secuencia: carta de
  emplazamiento 28/11/2024, dictamen motivado 07/05/2025, remisión 08/07/2026.

**Lo que queda probado de forma concluyente es la inexistencia de norma publicada, no la
fase interna de tramitación.** El anteproyecto podría haber avanzado sin que se haya podido
confirmar en fuente parlamentaria. Cualquier afirmación basada en su texto es **prospectiva**
y así debe etiquetarse.

### 2.4 Certificaciones: una sola norma, y una tensión interna

- **ISO/IEC 27001 y el ENS son las únicas normas certificables nombradas en todo el corpus.**
  PI-26 (Política sobre seguridad de la información, Ed. 04, junio 2025) §1: «El Grupo
  Garrigues ha tomado la decisión de gestionar los Sistemas de la Información […] conforme
  al estándar ISO/IEC 27001 y Esquema Nacional de Seguridad (ENS)».
- **Tensión que el verificador destapó:** PI-26, que es la política propietaria del SGSI,
  **no contiene ni una vez la raíz «certific»** — habla de «proceso de implantación». La
  única afirmación de que el despacho está certificado vive en **una cláusula contractual**,
  en los Anexos del Manual PBC/FT p. 296: «las establecidas en la certificación ISO-27.001,
  **siendo Garrigues entidad certificada**».
- **El certificado no está en el corpus.** No consta organismo emisor, número, fecha de
  emisión ni de caducidad, ni **la versión de la norma (27001:2013 vs 27001:2022)**. El
  alcance —matriz + Letrados de Soporte + IP + Sports & Entertainment + G-Advisory— se
  conoce solo por un `.md` derivado que referencia un fichero de la carpeta de licitaciones.
- **El ENS no es práctica de mercado: es requisito legal** para quien presta servicios al
  sector público (RD 311/2022, art. 2.3). No consta la categoría del sistema
  (BÁSICA/MEDIA/ALTA) ni ninguna Declaración o Certificación de Conformidad.
- **Cero menciones** en todo el corpus a: ISO 9001, ISO 14001, ISO 45001, ISO 27701,
  ISO 37001, ISO 42001, UNE 19601, UNE 19602, SOC 2. PI-22 y PI-32 —las dos políticas de
  calidad— usan vocabulario de sistema de gestión **sin nombrar ninguna norma**.
- **Error del inventario cazado por el verificador:** afirmó que el PPD «solo dice un
  determinado estándar sin nombrarlo». Falso: **PPD-01 §4 nombra «UNE-ISO 31.000:2010»**.
  Se le escapó porque el punto de millar rompe la búsqueda por «31000».
- El corpus reconoce expresamente que **no existe unidad de auditoría interna** (Manual
  PBC/FT §8.7, literal).
- **Aviso de contaminación:** las apariciones de ISO 37001, UNE 19601, ISO 45001, ISO 42001
  y ENS en `src/` y en migraciones son **datos demo de ARGA**, no del corpus Garrigues.
  `grc_core_seed.sql:16` siembra un módulo `cyber` de ARGA con
  `'["NIS2","ISO 27001","ENS"]'` y owner `'CISO ARGA'`.

### 2.5 El corpus operativo es mucho más rico de lo que sugiere «una sola norma»

Que ISO 27001 sea la única norma **certificable** nombrada no significa que no haya materia.
Hay obligaciones con cadencia medible y anclaje legal, y un cuerpo real de controles:

| Documento | Qué aporta | Literal |
|---|---|---|
| **PI-26** §5(b), §5(g), §15 | **Cadencias sembrables** | «Este análisis se repetirá: al menos una vez al año. Cuando la información y/o servicios gestionados cambien significativamente. Cuando ocurra un incidente de seguridad grave…»; «La Política … será revisada una vez al año» |
| **PI-26 §12** | **Obligación de notificación con anclaje legal** | «De conformidad con lo dispuesto en el **artículo 33 del RD 311/2022** … Garrigues notificará a sus clientes aquellas incidencias que tengan un impacto significativo» |
| **PI-26 §13** | Excepción con informe motivado | «se requerirá un informe del Responsable de Seguridad que precise los riesgos en que se incurre y la forma de tratarlos» |
| **PI-11** (Ed. 20, jun 2025) | **El cuerpo real de controles operativos**: 13 prohibiciones tipificadas, cifrado BitLocker To Go, MDM, filtrado de correo, formación que gatea el acceso, *offboarding* | §10: «medidas de control, que incluirán el acceso y monitorización de la totalidad de recursos y sistemas informáticos … sin excluir el acceso directo a los equipos informáticos y sus discos duros» |
| **PI-24** (Ed. 06) | SSL, cifrado, 2FA «siguiendo los requerimientos de la Oficina Técnica de Seguridad (OTS)», caducidad de claves a 60 días, cierre por inactividad > 2 meses; Anexo 2 con política de contraseña | §5.3.2, §5.3.3, §6.1, Anexo 2 |
| **PI-15** (Ed. 05, feb 2025) | BYOD + MDM + **borrado remoto**; SAU como punto único | §3.8: «deberá informar al SAU para que a través del MDM se pueda borrar la información corporativa» |
| **PI-29** (Ed. 01) | Plataforma *Insiders List*, conservación **5 años**, Reglamento (UE) 596/2014 | §4 |
| **PI-31** (V1) | Libro-registro de 5 campos, supresión a los 3 meses | Anexo 1 §8.2-8.3 |
| **PI-27 / PI-21** | Retención **10 años**, destrucción confidencial | PI-21 §2(a) |
| **PI-28** (Ed. 02, jun 2025) | Extiende PI-26 a la cadena de suministro; su **Anexo 1 §5 se adaptó al ENS en junio de 2025** | Histórico de versiones |
| **PI-30** (Ed. 02, jul 2025) | La prohibición más dura del corpus, con órgano acreditado | §2: «está **terminantemente prohibido** introducir información confidencial o datos personales en herramientas de IA Generativa de terceros» |
| **PPD-01** §9 | Programa de auditoría **bienal** | — |

Los 5 zips `OneDrive_*` **no aportan material nuevo**: son duplicados del mismo lote.

### 2.6 Tres defectos residuales del catálogo congelado de G4

Salieron al releer el corpus con otra lente, y afectan a documentos de este alcance:

- **PI-24**: la última entrada de su `content_outline` es `"8. Anexos Pl-24"` — una cabecera
  de página corrida pegada al epígrafe.
- **PI-24, PI-28 y PI-29**: el índice se detiene en «Anexos», así que **el articulado de los
  anexos no está representado** — incluido el §5 «Seguridad de la información» del Código
  ético de proveedores, que es materia central de esta fase.
- **PI-22 y PI-31**: `edicion: null` pese a llevar versión en el PDF.

G4 cerró habiendo corregido el tope duro de 40 entradas, pero estos tres son distintos y
siguen abiertos. No invalidan G4; sí hay que arreglarlos aquí, porque G6 se apoya
precisamente en esos anexos.

### 2.7 Superficies de código

- **No existe ninguna tabla `cyber_incidents` ni `dora_*`.** Ciber y DORA son un
  discriminador de texto `incidents.incident_type` sobre una única tabla `incidents`, más
  `vulnerabilities` para ciber.
- **El carril ciber NO está gateado por D-5 para Garrigues.** La lista blanca tiene 12
  claves y lo único oculto es `/grc/packs`, `/grc/packs/:cc` y `/grc/m/dora`. Todo
  `cyber`, `gdpr` y `audit` es accesible hoy para Garrigues, **sin item propio de sidebar**.
- Los `grc_modules` de Garrigues son 3 —`aml`, `ethics`, `risk`— y **no incluyen `cyber`**.
- **Trampa:** `fn_sync_obligation_to_backbone` mapea `OBL-NIS2-%` y `OBL-ISO%` al módulo
  `cyber`; como Garrigues no lo tiene, el fallback lo manda a `risk`, que sí existe. No
  revienta: **archiva en silencio las obligaciones de ciberseguridad bajo «Riesgos penales»**.
- `grc_module_nav` es la tabla que alimenta el sidebar modular y **no tiene ningún seed en
  el repo**: un módulo ciber sin esas filas sería código sin navegación.
- `incidents.code`, `exceptions.code` y `findings.code` tienen **UNIQUE global sin tenant**.
- Los CHECK usan castellano con tildes: `incidents.severity IN ('Crítico','Alto','Medio','Bajo')`,
  `incidents.status IN ('Abierto','En contención','En investigación','Resuelto','Cerrado')`.
- **Dos deudas silenciosas ajenas a esta fase:** `action_plans.tenant_id` tiene
  `DEFAULT '…0001'` (un INSERT sin tenant explícito aterriza en ARGA), y las pantallas de
  `audit` consultan **sin `tenant_id` y sin `tenantId` en la `queryKey`**.

---

## 3. El diseño

### 3.1 Tres sujetos distintos, y no se mezclan

| Sujeto | Régimen | Estado hoy |
|---|---|---|
| **Garrigues (el despacho)** | ISO 27001 + ENS, por decisión propia y por exigencia de cliente/pliego | Vigente |
| **EAD Trust, S.L. (QTSP)** | NIS2 → entidad **esencial** por el Anexo I sector 8 | **Prospectivo**: España no ha transpuesto; bajo NIS1 está *excluido* |
| **Clientes del despacho** | NIS2 art. 21.2.d, cadena de suministro | Obliga **al cliente**, y llega al despacho por contrato |

La regla de oro de la fase: **ninguna superficie puede presentar una obligación NIS2 como
deber de cumplimiento del despacho.** Ni por sector, ni por ser proveedor.

### 3.2 Lo que sí se modela como exigible hoy

El SGSI real, que es donde hay dato, cadencia y órgano acreditado.

**Ownership de PI-26 — una brecha de G4 que esta fase cierra.** PI-26 nombra literalmente a
su órgano responsable y **el órgano ya existe sembrado** (`comite-seguridad-privacidad`,
16 miembros, con una misión que cita ISO 27001), pero `OWNER_BY_CODE` tiene exactamente tres
claves —`PBC-FT-10`, `PI-14`, `PI-30`— y **PI-26 no está en ninguna**: su `owner_body_id` y
su `owner_function` están en NULL. Es una atribución acreditada por coincidencia literal, del
mismo tipo que las tres de G4, y **sube el ownership acreditado de 3 documentos a 4**.

Con ella entran los cuatro roles ENS que PI-26 §6.4 asigna literalmente: Responsable de la
Información y Responsable del Servicio (el Comité), Responsable de Seguridad (**CISO**, con
nombre en `comites-2026.json`) y Responsable del Sistema (CIO).

**Obligaciones con cadencia y anclaje**, no genéricas: la revisión anual de la política y del
análisis de riesgos (PI-26 §5, §15), la **notificación a clientes de incidencias con impacto
significativo por el art. 33 RD 311/2022** (PI-26 §12), el informe motivado del Responsable
de Seguridad para excepciones (§13) y la auditoría bienal del PPD (§9).

**Controles operativos reales**, que hoy son cero para este tenant: los de PI-11, PI-15,
PI-24, PI-27/21, PI-28, PI-29, PI-30 y PI-31 (§2.5). Es materia suficiente para que el
módulo tenga contenido propio sin inventar una línea.

### 3.3 NIS2 como horizonte, no como obligación

Se modela con sujeto, artículo y **estado de aplicabilidad**, nunca como una casilla que el
despacho deba marcar. La ficha tiene que poder decir, sin ambigüedad:

> Sujeto obligado: EAD Trust, S.L., por su condición de prestador cualificado de servicios
> de confianza (Anexo I, sector 8). Categoría: entidad esencial, con independencia de su
> tamaño (art. 3.1.b). **Aplicabilidad en España: pendiente de transposición.** El marco
> vigente es el RDL 12/2018, que excluye a los prestadores de servicios de confianza no
> designados operadores críticos (art. 2.3.a).

Eso exige un campo de **aplicabilidad temporal** que hoy no existe en `obligations`, y una
distinción entre *norma aplicable* y *norma prospectiva* que el modelo actual no tiene.
Es la decisión de modelo más importante de la fase y **está abierta**.

### 3.4 Certificaciones: modelar el hueco, no rellenarlo

El repo **no tiene ninguna entidad, tabla ni superficie de «certificación»**. Lo que consta
del certificado ISO 27001 del despacho es: que una cláusula contractual afirma que existe, y
un nombre de fichero en SharePoint. No consta organismo, número, fechas ni versión.

La opción honesta es una ficha de certificación con **los campos que faltan visibles como
faltantes**, no omitidos. Un certificado sin fecha de caducidad en una consola de gobernanza
es exactamente el dato que un cliente pediría primero.

### 3.5 Qué NO se hace

- **No se siembra ninguna obligación NIS2 a nombre del despacho.**
- **No se afirma que el despacho tenga certificaciones que su corpus no nombra**: ni ISO 9001,
  ni 14001, ni 45001, ni 27701, ni 37001, ni 42001, ni UNE 19601, ni SOC 2.
- **No se reutilizan los datos demo de ARGA** (`grc_core_seed.sql`) como si fueran del corpus
  Garrigues. Es la contaminación que G4 tuvo que limpiar tres veces.
- **No se usan códigos `OBL-NIS2-%` ni `OBL-ISO%`** sin sembrar antes `grc_modules.cyber`
  del tenant, o el trigger archivará ciberseguridad bajo «Riesgos penales» en silencio.

---

## 4. Riesgos de diseño

| Riesgo | Por qué es grave aquí | Salvaguarda |
|---|---|---|
| Presentar NIS2 como deber del despacho | Afirmación jurídica falsa ante abogados | §3.1: el sujeto es la filial QTSP, y se nombra |
| Presentar NIS2 como exigible **hoy** | España no ha transpuesto; bajo NIS1 el QTSP está excluido | §3.3: campo de aplicabilidad temporal, etiquetado prospectivo |
| Afirmar «entidad certificada» sin certificado | La afirmación existe, pero en una cláusula de contrato, no en la política del SGSI | §3.4: campos faltantes visibles como faltantes |
| Confundir norma con certificación | PI-32 habla como ISO 9001 sin serlo | Solo se nombra lo que el corpus nombra |
| Arrastrar los datos demo de ARGA | Ya pasó tres veces en G4 | Auditoría previa de ISO*/UNE*/ENS en `src/` y migraciones |
| Archivar ciber bajo «Riesgos penales» | El fallback del trigger es silencioso | Sembrar `grc_modules.cyber` **antes** que cualquier obligación |
| Módulo sin navegación | `grc_module_nav` no tiene seed en el repo | Decidir si se siembra o se usa el carril existente |

---

## 5. Preguntas abiertas — las decide el usuario o el despacho, no un agente

0. **¿Cuál es el alcance de G6?** Ver la pregunta 5, que es la que ordena todo lo demás.

1. **EAD Trust al 51,001 %** figura en `entities-catalog.ts:300-307` con confianza
   **`A_CONFIRMAR`** desde G1. Deja de ser un detalle del organigrama: si se confirma, el
   grupo tiene un sujeto NIS2 esencial. ¿Se confirma la participación y que EAD Trust es
   efectivamente QTSP cualificado inscrito?
2. **El certificado ISO 27001**: ¿versión (27001:2013 o 27001:2022), organismo emisor,
   número, fechas de emisión y caducidad, y alcance vigente? Sin esto, la ficha nace con
   cinco huecos.
3. **ENS**: ¿categoría del sistema (BÁSICA / MEDIA / ALTA)? ¿Hay Declaración o Certificación
   de Conformidad? ¿Se ha hecho la auditoría bienal del art. 31 RD 311/2022?
4. **¿Presta el despacho servicios al sector público bajo contrato?** De eso depende que el
   ENS sea requisito **legal** (RD 311/2022 art. 2.3) o marco adoptado voluntariamente. Es
   la diferencia entre una obligación y una decisión de gestión.
5. **Alcance de la fase**: ¿G6 se queda en el SGSI real del despacho —que es donde hay
   dato— o incluye también el perímetro NIS2 de EAD Trust, que exige el modelo de
   aplicabilidad temporal de §3.3 y es bastante más trabajo?

---

## 6. Procedencia de este documento

Investigación ejecutada como workflow de 9 agentes el 2026-08-20: 4 inventarios en paralelo
(corpus TI/seguridad, superficies de código, ámbito subjetivo de NIS2, certificaciones),
4 verificadores adversariales con lente propia, y síntesis.

Los verificadores **no aceptaron el inventario**: redescargaron las fuentes, compararon
hashes, releyeron el articulado, obtuvieron de TRIS el texto del anteproyecto que el
inventario declaró inaccesible, cerraron la laguna del Anexo CER y **encontraron un error
real** —la cita de UNE-ISO 31.000:2010 en PPD-01 que el inventario dio por inexistente—.

Ninguna conclusión de este documento descansa solo en el inventario.
