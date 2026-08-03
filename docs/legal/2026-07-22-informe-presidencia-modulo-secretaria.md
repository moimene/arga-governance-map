# El módulo de Secretaría Societaria — Informe para Presidencia

> Copia archivada en markdown del informe ejecutivo generado el 22 de julio de 2026 como `.docx` (plantilla de marca Garrigues) para una presentación a Presidencia. Documento **distinto** de la referencia funcional viva `docs/legal/2026-06-13-referencia-modulo-secretaria.md`: este es una selección curada — configuración por sociedad, materias y plantillas, procesos societarios y decisiones de diseño — para una lectura ejecutiva de un solo uso, no un documento de mantenimiento continuo. Exportado con `pandoc` desde el `.docx` fuente; algunas cajas de una sola celda (portada, aviso de alcance, callouts de "decisión de diseño") se conservan como HTML embebido porque el formato de tabla de GitHub-flavored Markdown no admite celdas multi-párrafo.

---

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p>GARRIGUES</p>
<p><strong>TGMS · MÓDULOS GARRIGUES</strong></p></td>
</tr>
</tbody>
</table>

El módulo de Secretaría Societaria

Configuración por sociedad, materias y plantillas,

y procesos societarios soportados

*Arquitectura y decisiones de diseño*

**INFORME PARA PRESIDENCIA**

22 de julio de 2026

Plataforma TGMS · Cliente demostrador: Grupo ARGA Seguros (pseudónimo)

**Confidencial — uso interno**

Aviso de alcance — leer antes que el resto del informe

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>ADVERTENCIA DE ALCANCE</strong></p>
<p><strong>Datos de demostración y prototipo</strong></p>
<p>Este informe describe un prototipo operativo avanzado, construido sobre datos de demostración de "Grupo ARGA Seguros", pseudónimo interno de un grupo asegurador objetivo. Ninguna sociedad, persona, órgano, cifra de capital o de retribución citada en este documento corresponde a un cliente real; todas son coherentes con una estructura corporativa de demostración construida para validar el diseño.</p>
<p>El prestador cualificado de servicios de confianza EAD Trust interviene, en el alcance vigente del prototipo, exclusivamente como capa de interposición, mensajería básica y custodia / archivo electrónico. Ninguna captura actual del sistema debe interpretarse como firma electrónica cualificada (QES), sello electrónico cualificado (QSeal), notificación fehaciente (ERDS), envío o entrega certificada, sin evidencia contractual y técnica separada que lo habilite.</p>
<p>La cadena de integridad criptográfica descrita en el bloque 7 — censo inmutable, huella hash, archivado — es real, está operativa y es verificable en la base de datos viva. Es la capa de servicios de confianza cualificados que se apoyaría sobre ella la que, hoy, no lo es. Este informe distingue ambas cosas en todo momento y no presenta la segunda como si fuera la primera.</p></td>
</tr>
</tbody>
</table>

Índice

| **§** | **Sección**                                         | **Contenido**                                                                                                |
|-------|-----------------------------------------------------|--------------------------------------------------------------------------------------------------------------|
| 1     | Resumen ejecutivo                                   | Qué es el módulo, a qué llama la atención de este informe y cómo está de maduro.                             |
| 2     | Premisa de diseño                                   | Por qué el criterio jurídico vive fuera del código, como dato versionado y auditable.                        |
| 3     | Configuración por sociedad                          | El modelo canónico de identidad, qué se deriva automáticamente de cada sociedad, grupo y multi-jurisdicción. |
| 4     | Materias y plantillas                               | El inventario de materias societarias, el motor de reglas y la arquitectura de plantillas en tres capas.     |
| 5     | Las seis decisiones legales del motor (DL-1 a DL-6) | El catálogo de criterio jurídico ya resuelto por el despacho, no improvisado por ingeniería.                 |
| 6     | Procesos societarios soportados                     | El ciclo del acuerdo social de principio a fin, sus vías alternativas y los procesos de datos maestros.      |
| 7     | Integridad, evidencia y control de acceso           | La cadena de auditoría WORM, la frontera de confianza con EAD Trust, RBAC y segregación de funciones.        |
| 8     | Alcance actual y honestidad de posicionamiento      | Qué cubre hoy el prototipo, qué queda deliberadamente fuera y por qué.                                       |
| 9     | Cierre                                              | Lo que hace posible este diseño, y los puntos abiertos para el Comité Legal.                                 |

1 Resumen ejecutivo

La Secretaría Societaria es el módulo de TGMS que cubre el ciclo de vida completo del acuerdo social: desde la convocatoria del órgano hasta su elevación a público e inscripción registral, pasando por la celebración de la sesión, el acta, la certificación y la generación del documento. No es un editor de documentos con apariencia jurídica: es un sistema en el que el criterio legal — quórum, mayoría, inscribibilidad, instrumento exigido, plazo de inscripción — se declara como dato versionado y se evalúa mediante un motor determinista, de modo que cada resultado puede explicarse artículo por artículo y auditarse frente a la redacción exacta de la regla que se aplicó en cada caso.

Este informe se centra, a petición expresa, en tres planos y un hilo transversal. Los tres planos: cómo se configura el sistema para una sociedad concreta — su forma social, su régimen de administración, sus órganos, su condición de cotizada —; cómo se organiza el conocimiento jurídico en materias y se traduce en plantillas de documento protegidas; y qué procesos societarios soporta hoy el sistema, de principio a fin. El hilo transversal son las decisiones de diseño — varias de ellas con contenido estrictamente jurídico, no solo técnico — que se han tomado de forma consciente, con su motivación.

El rasgo que distingue este diseño de un gestor documental con plantillas es la separación deliberada entre tres planos que casi siempre se confunden: el plano societario (LSC/RRM: invalida o no invalida el acuerdo frente a la sociedad), el plano contractual (pactos parasociales: obliga entre las partes que lo suscriben, pero no afecta por sí solo a la validez del acuerdo) y el plano de lo que el sistema no puede determinar por sí mismo y que, por tanto, no debe fingir que resuelve — siete "bordes no computables" identificados de forma expresa, desde la junta telemática hasta la suficiencia de liquidez para repartir dividendo. Mantener estos tres planos separados, en vez de colapsarlos en un semáforo único de "válido / no válido", es la decisión de la que dependen casi todas las demás descritas en este informe.

El sistema es, a día de hoy, un prototipo operativo avanzado, no un sistema en producción jurídica. Cubre España de forma completa (57 conjuntos de reglas sobre 56 materias societarias distintas, 110 plantillas protegidas), con Portugal en fase de vista previa normativa y Brasil y México planificados tras validar el modelo español. Las partes que producen efectos verificables — persistencia en base de datos, cadena de huella criptográfica, auditoría inmutable — son reales y comprobables en vivo; las partes que dependen de un prestador cualificado de servicios de confianza están deliberadamente acotadas mientras no exista la habilitación contractual y técnica correspondiente. La última batería de verificación (21 de julio de 2026) registra 3.110 pruebas automáticas superadas, 152 omitidas deliberadamente y ningún fallo.

**Lo que este informe no es**

- No es una demostración comercial: cita limitaciones y deuda conocida con el mismo detalle que las capacidades, en el bloque 8.

- No es el informe técnico completo del módulo: existe un documento de referencia interno, de uso continuo por el equipo legal, con inventario exhaustivo de los 23 procesos, las 56 materias y las máquinas de estado por dominio. Este informe selecciona y explica lo relevante para una lectura de Presidencia.

- No afirma capacidad de firma electrónica cualificada ni de notificación fehaciente operativa: ver el aviso de alcance en la página anterior y el bloque 7.

2 Premisa de diseño: el criterio jurídico vive fuera del código

La alternativa habitual en este tipo de sistemas es codificar el criterio legal dentro de la aplicación: quórums, mayorías e instrumentos quedan escritos en el mismo lenguaje que la interfaz. Esa alternativa tiene un coste que un despacho conoce bien: cambiar un criterio exige un ingeniero, no un abogado; no queda traza de quién aprobó qué redacción ni cuándo; y verificar contra qué versión de la regla se certificó un acuerdo concreto, meses después, es difícil o imposible.

El diseño adoptado invierte esa relación. El conocimiento jurídico — 57 conjuntos de reglas ("rule packs") sobre 56 materias societarias distintas — vive en tres tablas de base de datos, no en el código de la aplicación: un catálogo de materias, sus versiones inmutables (cada una con su propia huella hash y con referencia expresa a la versión que sustituye) y una capa de personalizaciones estatutarias, pactadas o jurisdiccionales. El motor que evalúa esas reglas —más de treinta módulos en \`src/lib/rules-engine/\`— está escrito como funciones puras: no accede a la base de datos ni a la interfaz, recibe el conjunto de reglas y el censo de una sesión, y devuelve un resultado con un árbol de explicación trazable nodo a nodo, en el que cada nodo lleva su calificación (correcto, advertencia o bloqueante) y su cita legal.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>DECISIÓN DE DISEÑO</strong></p>
<p><strong>Un dato personalizado puede elevar el listón legal; nunca puede rebajarlo</strong></p>
<p>La jerarquía normativa que resuelve el motor tiene seis capas y un orden de prelación explícito: Ley (prioridad 100) › Estatutos (80) › Pacto parasocial (60, plano contractual) › Reglamento interno (40) › Personalización operativa (20) › Sistema (0). La regla de resolución es una sola: una capa inferior puede exigir más que el mínimo legal, nunca menos. Un intento de fijar, por ejemplo, un quórum estatutario por debajo del mínimo del artículo 193 LSC se rechaza automáticamente como bloqueante — no como advertencia — con independencia de quién lo haya introducido en el sistema.</p>
<p>Esta regla convierte una posible vía de error operativo (una personalización mal cargada) en una garantía verificable: el suelo legal no se puede erosionar por accidente, y cada resolución del motor deja constancia de qué capas se consideraron y cuál prevaleció, con su referencia normativa.</p></td>
</tr>
</tbody>
</table>

La misma arquitectura resuelve, de forma explícita, una distinción que un mercantilista reconoce de inmediato y que un sistema ingenuo tiende a diluir: el incumplimiento de un pacto parasocial es una cuestión contractual, de eficacia inter partes (art. 29 LSC), y no convierte por sí solo un acuerdo en societariamente inválido. El motor lo respeta en su propia arquitectura de datos: los incumplimientos de pacto se reportan en un canal separado y expresamente etiquetado —nunca mezclado con los motivos de bloqueo societario del cauce LSC/RRM—, de modo que el usuario ve "incumplimiento de pacto parasocial", no "acuerdo inválido". Esta separación se desarrolla con más detalle en el bloque 4.

3 Configuración por sociedad

*Cómo se representa cada sociedad administrada, qué se deriva automáticamente de esa representación, y cómo opera el sistema cuando la sociedad es en realidad un grupo con presencia en varias jurisdicciones.*

3.1 El modelo canónico de identidad

La identidad societaria descansa sobre ocho tablas que sustituyen progresivamente al modelo previo, de propósito general ("mandates"). Cada una tiene una responsabilidad jurídica precisa:

| **Tabla**              | **Qué gobierna**                                                                                                  | **Garantía de integridad relevante**                                                                                                                              |
|------------------------|-------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| entities               | La sociedad o persona jurídica administrada: forma social, si cotiza, sector regulado, régimen de administración. | Toda entidad enlaza con su persona jurídica; los campos registrales habilitan la inscripción en el Registro Mercantil.                                            |
| entity_capital_profile | El capital social, con historial.                                                                                 | Como máximo una fila "vigente" por sociedad; las versiones anteriores quedan como histórico, nunca se sobrescriben.                                               |
| share_classes          | Las clases de acciones o participaciones.                                                                         | Separa el derecho económico del derecho político, habilitando clases sin voto o con veto.                                                                         |
| condiciones_persona    | Quién ocupa qué cargo, en qué sociedad y en qué órgano, y desde cuándo.                                           | Fuente única de verdad de nombramientos y ceses; unicidad de condición vigente garantizada por índice de base de datos.                                           |
| capital_holdings       | El libro de socios o accionistas.                                                                                 | La autocartera queda automáticamente a voto y peso cero; no depende de que nadie recuerde marcarla.                                                               |
| representaciones       | Representación permanente de persona jurídica, delegación de voto en junta y delegación en consejo.               | Tres figuras jurídicas distintas, modeladas por separado en vez de una sola tabla de "poderes" genérica.                                                          |
| parte_votante_current  | La proyección de quién vota y con qué peso, recalculable en cualquier momento.                                    | Separa el peso de voto del peso en el denominador de cómputo — imprescindible para excluir correctamente a un conflictuado sin distorsionar el resto del cálculo. |
| censo_snapshot         | La fotografía del censo de una sesión concreta.                                                                   | Inmutable por disparador de base de datos: una vez creado, ningún UPDATE ni DELETE puede alterarlo, ni siquiera por la vía de administración.                     |

*Tabla 1. Las ocho tablas del modelo canónico de identidad y su función jurídica.*

3.2 Qué se deriva automáticamente de la configuración de una sociedad

Cuatro atributos de la ficha de una sociedad —forma social (SA/SAU/SL/SLU), condición de cotizada, sector regulado y régimen de administración (consejo, administrador único, mancomunados, solidarios)— bastan para que el sistema derive, sin intervención manual adicional, el resto de su tratamiento jurídico:

- El catálogo de libros exigibles se calcula, no se asume: una SL genera libro registro de socios (art. 104 LSC); una SA genera libro registro de acciones nominativas (art. 116 LSC); toda sociedad unipersonal añade el libro de contratos del socio único (art. 16 LSC); un asegurador cotizado añade además los registros de idoneidad ("fit & proper") y de supervisión de Solvencia II.

- El libro de actas se secciona por cada órgano vivo de la sociedad —junta, consejo, comisión de auditoría, de nombramientos, de retribuciones, de riesgos regulada, comité ejecutivo— en vez de tratarse como un único libro monolítico, y cada sección arrastra su propia base legal y su propio custodio.

- La condición de cotizada activa las advertencias de mercado de valores (CNMV, información privilegiada del art. 17 del Reglamento de Abuso de Mercado, operaciones vinculadas, Informe Anual de Gobierno Corporativo) sin bloquear el acuerdo — es la decisión legal DL-2, desarrollada en el bloque 5.

- El voto de calidad del presidente se habilita o deshabilita por órgano: activo en el Consejo y en el Comité Ejecutivo, desactivado en las comisiones delegadas (Auditoría, Riesgos, Nombramientos, Retribuciones) — decisión DL-5, también en el bloque 5.

3.3 Grupo y multi-sociedad

Toda la Secretaría opera bajo un conmutador de ámbito con dos modos, Grupo y Sociedad, que se propaga a libros, calendario y procesos sin que cada pantalla tenga que reimplementar el filtro. En modo Grupo, dos capacidades adicionales entran en juego:

- Campañas de grupo (war room): una única instrucción — por ejemplo, "aprobar cuentas en todo el perímetro" — se descompone automáticamente en expedientes diferenciados por sociedad. El motor lee la forma social, el régimen de administración y la unipersonalidad de cada filial y asigna la vía de adopción correcta a cada una — consejo, administrador único, mancomunados, solidarios o socio único —, en vez de forzar una única plantilla de proceso sobre estructuras societarias distintas.

- Matriz jurisdiccional ES/PT/BR/MX: parte de una tesis jurídica explícita —la gobernanza real ocurre en la sociedad dominante española; las filiales extranjeras son vehículos íntegramente dependientes que formalizan localmente la decisión del grupo—, por lo que quórum y mayoría de filial son, en la mayoría de materias, irrelevantes frente al socio o accionista único.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>HONESTIDAD DE ALCANCE</strong></p>
<p><strong>La matriz jurisdiccional es una herramienta de formalización local, no un motor de reglas extranjero</strong></p>
<p>El propio módulo delimita su alcance: hace seguimiento de plazos de inscripción, genera la instrucción multilingüe a la filial y controla la traducción jurada donde se exige (Portugal y Brasil). No valida quórum ni mayorías de filial —resulta irrelevante por tratarse de socio único—, no integra directamente con los registros mercantiles locales (Junta Comercial en Brasil, Registro Público de Comercio en México, Conservatória en Portugal) y no gestiona autorizaciones sectoriales previas (SUSEP en Brasil, CNSF en México, Banco de Portugal): esas autorizaciones las sigue gestionando el departamento legal, no el motor.</p></td>
</tr>
</tbody>
</table>

3.4 La procedencia de la regla se declara, nunca se oculta

El 19 de julio de 2026 se verificó contra los datos vivos del sistema que, de 37 acuerdos con expediente de tramitación registral, 8 recibían el conjunto de reglas de un órgano distinto de aquel que efectivamente había adoptado el acuerdo: 6 acuerdos de Consejo se resolvían con el conjunto de reglas de la Junta General, y 2 acuerdos de comisión delegada no tenían un conjunto de reglas propio en absoluto. La causa era un criterio de coincidencia por subcadena de texto que, entre otros efectos colaterales, llegaba a clasificar la etiqueta "NO_ADMINISTRACION" como órgano de administración. El dato no es anecdótico: ese conjunto de reglas es precisamente el que determina la inscribibilidad del acuerdo, el instrumento público exigido y el plazo de inscripción, y el instrumento habilita de forma directa la acción que registra la escritura.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>DECISIÓN DE DISEÑO</strong></p>
<p><strong>Informar y explicar, no decidir por el abogado</strong></p>
<p>La corrección adoptada tiene dos componentes. Primero, un criterio único de familia de órgano por lista blanca sustituye a la coincidencia por subcadena. Segundo, la función que selecciona el conjunto de reglas aplicable conserva el mismo comportamiento de repliegue que tenía antes —si no hay un conjunto de reglas del órgano exacto, usa el disponible—, pero ahora etiqueta expresamente el motivo de cada selección: coincidencia exacta de órgano, único conjunto disponible sin certeza de a qué órgano pertenece, repliegue a un órgano distinto, o repliegue ambiguo. Ese motivo se muestra al abogado en un aviso de procedencia normativa, situado en el paso de configuración del expediente y de nuevo junto al botón que registra la escritura — que es el punto exacto en que el dato se persiste de forma definitiva.</p>
<p>Deliberadamente no se adoptó una tercera opción, que sí se evaluó: bloquear el expediente en cuanto la procedencia del conjunto de reglas es dudosa ("fail-closed"). Impedir que un abogado continúe su trabajo ante una ambigüedad es, en sí misma, una decisión de política jurídica y no una decisión técnica, y exige un criterio del Comité Legal sobre qué materias toleran ese repliegue y cuáles no deberían tolerarlo nunca. Mientras ese criterio no exista, el sistema informa y razona su motivo; no decide en lugar del abogado.</p></td>
</tr>
</tbody>
</table>

4 Materias y plantillas

*Dos catálogos distintos que conviene no confundir: uno de reglas (qué exige la ley para cada materia) y otro de documentos (cómo se redacta cada acto). Y el motor que conecta el primero con la práctica.*

4.1 Dos catálogos, un mismo propósito

El catálogo de reglas ("rule_packs") contiene 57 conjuntos de reglas sobre 56 materias societarias distintas —la única materia con dos conjuntos es la autorización de garantía significativa, que tiene un conjunto propio para Junta y otro para Consejo—. El catálogo de documentos ("plantillas_protegidas") contiene 110 plantillas, de las cuales 70 son modelos de acuerdo y 58 de ellas están activas, cubriendo 54 materias jurídicas. Son deliberadamente catálogos separados: una regla puede existir sin que exista todavía redacción de documento para ella, y viceversa, y ambos evolucionan bajo distinta autoría y distinto ritmo — el Comité Legal fija el criterio jurídico; la redacción documental se revisa con la cadencia propia de cada modelo.

4.2 El inventario de materias, por naturaleza jurídica

| **Bloque**                    | **Naturaleza**                                      | **Ejemplos**                                                                                                                                  | **Régimen**                                                               |
|-------------------------------|-----------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------|
| Junta — Estructurales         | Afectan a la estructura o existencia de la sociedad | Fusión, escisión, transformación, disolución, liquidación, cesión global de activo y pasivo                                                   | Inscribibles; escritura pública; mayoría reforzada (art. 201.2 LSC en SA) |
| Junta — Estatutarias          | Modificación de estatutos en sentido estricto       | Aumento y reducción de capital, cambio de denominación o domicilio, ampliación del objeto social, emisión de obligaciones                     | Inscribibles; escritura pública; mayoría reforzada                        |
| Junta — Especiales            | Régimen de mayoría o quórum específico              | Transmisión de participaciones, exclusión de socio, pacto parasocial                                                                          | Régimen propio; el pacto parasocial no es inscribible                     |
| Junta — Ordinarias            | Gestión ordinaria de la sociedad                    | Aprobación de cuentas, aplicación del resultado, distribución de dividendos, nombramiento y cese de consejero, retribución de administradores | Mayoría ordinaria (art. 201.1 LSC en SA)                                  |
| Consejo de Administración     | Competencia del propio órgano de administración     | Delegación de facultades (2/3 de los componentes, art. 249.3 LSC), formulación de cuentas, distribución de cargos, operación vinculada        | Mayoría sobre consejeros, no sobre capital                                |
| Socio único y soporte interno | Sociedad unipersonal y figuras de apoyo             | Decisión de sociedad unipersonal, contratos entre socio único y sociedad (art. 15 LSC), separación de socio                                   | Régimen propio del art. 15 y 346 LSC                                      |

*Tabla 2. Inventario de materias por bloque jurídico (57 conjuntos de reglas / 56 materias distintas, verificado en datos vivos el 13 de junio de 2026).*

4.3 El motor de reglas: de la materia al resultado motivado

Evaluar un acuerdo es una cadena de comprobaciones, no una única fórmula. El motor la organiza en un cauce de seis puertas ("gates") para la votación en sesión, y otro paralelo de cinco puertas para la adopción sin sesión:

| **Puerta**           | **Comprobación**                                                                                                                                                                                                                |
|----------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 0 — Modo de adopción | Enruta según el modo: socio único o administrador único si la decisión está firmada; sin sesión, co-aprobación o administrador solidario delegan en su propio evaluador; junta o consejo en sesión continúan a las puertas 1-6. |
| 1 — Elegibilidad     | Recalcula el capital o los votos computables excluyendo los mandatos en conflicto de interés (art. 190.2 LSC).                                                                                                                  |
| 2 — Quórum           | Referencia al quórum ya verificado en la fase de constitución de la sesión.                                                                                                                                                     |
| 3 — Mayoría          | Selecciona la fórmula de mayoría aplicable por órgano o por forma social y aplica las personalizaciones estatutarias; una personalización que exigiera unanimidad se rechaza como inadmisible (art. 200.1 LSC).                 |
| 4 — Unanimidad       | Si la materia la exige, verifica que todos consientan según el ámbito correspondiente (todos los socios, los presentes, o una clase concreta).                                                                                  |
| 5 — Vetos            | Un veto estatutario bloquea el acuerdo; un veto de pacto parasocial solo genera advertencia — no afecta a la validez societaria — e inhabilita el voto de calidad.                                                              |
| 6 — Voto de calidad  | Dirime empates solo en mayoría simple o absoluta; nunca sustituye una mayoría reforzada ni la unanimidad; solo dirime si el presidente ha votado expresamente a favor.                                                          |

*Tabla 3. Las seis puertas del cauce de evaluación de la votación en sesión.*

Un componente orquestador superior encadena convocatoria, constitución, votación, documentación y bordes no computables, y compone el perfil más exigente cuando varias materias distintas concurren en una misma sesión — la máxima antelación, el mayor quórum, la unión de toda la documentación exigida por cada una—. Siete "bordes no computables" quedan expresamente fuera del automatismo del motor porque exigen verificación humana: la condición de cotizada (que genera advertencia, nunca bloqueo — ver DL-2 en el bloque 5), el consentimiento de clase, la suficiencia de liquidez para repartir dividendo, la indelegabilidad fina de ciertas materias, el checklist de junta telemática, y la evidencia de publicación o de notificación de la convocatoria. El motor no intenta resolver estos siete puntos por sí solo: los señala.

4.4 Plantillas: tres capas, tres responsables

Cada plantilla protegida separa su contenido en tres capas con distinto responsable, que es la pieza central de la protección documental del sistema:

| **Capa**                  | **Naturaleza**                   | **Quién la controla**                                       | **Contenido**                                                                                 |
|---------------------------|----------------------------------|-------------------------------------------------------------|-----------------------------------------------------------------------------------------------|
| 1 — Inmutable             | Texto jurídico literal protegido | Comité Legal, y solo mientras la plantilla está en borrador | Cláusulas, fórmulas y referencias legales del cuerpo del documento                            |
| 2 — Variables automáticas | Catálogo de datos a resolver     | El sistema, en tiempo de generación                         | Cada variable declara de qué tabla se extrae su valor (entidad, órgano, reunión, expediente…) |
| 3 — Campos editables      | Formulario de captura            | El secretario, al instanciar el documento                   | Datos que no están en base de datos y que exige la generación concreta                        |

*Tabla 4. Arquitectura de plantilla en tres capas.*

El efecto jurídico de esta separación es directo: el operador que genera un documento en el día a día no puede alterar una coma del cuerpo legal de una plantilla activa; solo el Comité Legal puede tocar la capa 1, y únicamente mientras la plantilla permanece en estado de borrador. Ningún documento se produce a partir de una plantilla que no haya superado antes un control de calidad estructural y semántico — el "Gate PRE" — que bloquea la activación si detecta, entre otras cosas, una plantilla de fusión o escisión sin la condición que exige informe de experto independiente cuando procede, o una plantilla de ratificación de actos que no obligue a identificar expresamente qué actos se ratifican. El ciclo de vida de una plantilla —borrador, revisada, aprobada, activa, archivada— exige aprobación legal explícita antes de llegar a "activa", y cada transición queda registrada en un historial con autor, motivo y resumen del cambio.

5 Las seis decisiones legales del motor (DL-1 a DL-6)

Todo motor determinista tropieza, en algún punto, con una pregunta que la ley no responde de forma mecánica y que exige criterio profesional. El diseño del motor de reglas identificó seis de esas preguntas, las resolvió con el criterio del despacho —no con una decisión de ingeniería por defecto— y dejó constancia documental de la resolución adoptada el 19 de abril de 2026.

| **\#** | **Pregunta**                                      | **Resolución adoptada**                                                                                                                                                                                                            |
|--------|---------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| DL-1   | Alcance jurisdiccional de los conjuntos de reglas | España, completa. Portugal, en vista previa mediante personalizaciones. Brasil y México, tras la validación española.                                                                                                              |
| DL-2   | Sociedades cotizadas                              | El motor evalúa y advierte — nunca bloquea. Genera advertencias de mercado de valores (CNMV, información privilegiada, operaciones vinculadas, Informe Anual de Gobierno Corporativo) sin impedir la adopción del acuerdo.         |
| DL-3   | Pactos parasociales                               | Se modelan y evalúan de forma activa —no como una simple anotación—, con un canal de reporte separado del de invalidez societaria.                                                                                                 |
| DL-4   | Plantilla de convocatoria aplicable               | Selección automática según forma social: SA, publicidad oficial (BORME y web corporativa, art. 197 LSC); SL, notificación individual certificada (art. 173.2 LSC). El cambio manual queda permitido, pero registrado en auditoría. |
| DL-5   | Voto de calidad del presidente                    | Configurable por órgano: habilitado en Consejo y Comité Ejecutivo; deshabilitado en las comisiones delegadas (Auditoría, Riesgos, Nombramientos, Retribuciones).                                                                   |
| DL-6   | Retribución de consejeros                         | Cifras de demostración derivadas del Informe Anual de Retribuciones 2025, con la estructura fija/variable/incentivo a largo plazo propia del sector.                                                                               |

*Tabla 5. Las seis decisiones legales del motor, resueltas el 19 de abril de 2026.*

El orden de prioridad con el que se implementaron —DL-2, DL-4, DL-5, DL-6, DL-3, DL-1— no fue arbitrario: se priorizó primero lo que evitaba el mayor riesgo de un automatismo mal calibrado (bloquear indebidamente a una cotizada) y se dejó para el final lo que requería más infraestructura de datos (la expansión jurisdiccional). Las seis decisiones comparten un mismo rasgo: en ningún caso el motor sustituye el criterio profesional del despacho por una regla de sentido común de ingeniería; en cada caso, aplica el criterio que el despacho ya había fijado.

6 Procesos societarios soportados

*El sistema cataloga 23 procesos operativos distintos. Este bloque los organiza por su función, no por su orden alfabético: primero el ciclo ordinario del acuerdo, después sus vías alternativas de adopción, las herramientas de dirección, y por último los procesos de datos maestros que alimentan a todos los anteriores.*

6.1 El ciclo ordinario del acuerdo

| **Etapa**                 | **Qué ocurre**                                                                                                                                                                                                                                                         | **Base legal**                                                         |
|---------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------|
| 1\. Convocatoria          | Asistente de 8 pasos: sociedad y órgano, fecha y plazo legal (con segunda convocatoria para junta de SA), orden del día clasificado por clase de materia, destinatarios, canales de publicación filtrados por jurisdicción, adjuntos, borrador de documento y emisión. | Arts. 166-176 LSC (junta), art. 246 LSC (consejo)                      |
| 2\. Reunión               | Asistente de 6 pasos: constitución (apertura formal de la sesión), asistentes, quórum, agenda y debate, votación por punto (con conflictos, vetos y pactos evaluados en el momento) y cierre, que genera el acta en borrador.                                          | Arts. 193-194 y 202 LSC (junta), art. 247 LSC (consejo)                |
| 3\. Acta                  | Se genera en el cierre de la reunión, con huella hash vinculada al censo inmutable de la sesión.                                                                                                                                                                       | Art. 202 LSC; arts. 97-112 RRM                                         |
| 4\. Certificación         | El secretario certifica con el visto bueno del presidente, en un proceso de tres pasos encadenados, precargando al presidente vigente de la sociedad.                                                                                                                  | Art. 109 RRM                                                           |
| 5\. Tramitación registral | Asistente de 5 pasos: selección del acuerdo certificado, vía de presentación, datos del instrumento notarial, presentación y seguimiento —incluida la subsanación—.                                                                                                    | Elevación a instrumento público e inscripción en el Registro Mercantil |
| 6\. Expediente            | Vista unificada del acuerdo como agregado: línea de tiempo de 8 etapas (borrador, propuesto, adoptado, certificado, instrumentado, preparado para registro, inscrito, publicado), con una rama terminal de rechazo registral.                                          | —                                                                      |

*Tabla 6. El ciclo ordinario del acuerdo social, de la convocatoria a la inscripción.*

6.2 Vías alternativas de adopción

El mismo motor jurídico —no uno distinto— atiende las formas de adopción que prescinden de la sesión formal; solo cambia la puerta de entrada al cauce de evaluación (puerta 0, descrita en el bloque 4.3):

- Acuerdos sin sesión (votación por escrito): asistente de 5 pasos con recogida de voto por miembro y cierre automático de las votaciones vencidas.

- Co-aprobación de administradores mancomunados (k de n): exige habilitación estatutaria, un mínimo de dos administradores actuantes y, en SA, un máximo de dos administradores conjuntos antes de exigir consejo (art. 210.2 LSC).

- Administrador solidario: contrastado contra el censo vigente de administradores y la materia concreta (art. 210 LSC).

- Decisiones de socio único y de administrador único: con cita expresa del fundamento —art. 15 LSC para el socio único, art. 210 LSC para el administrador único— capturada en el primer paso del asistente, y consignación en el libro-registro de decisiones correspondiente.

6.3 Herramientas de dirección

- Board Pack ejecutivo: dosier de 9 secciones para la sesión del consejo, con las advertencias de cotizada (DL-2) y la información de voto de calidad (DL-5) ya incorporadas, exportable a PDF.

- Calendario de vencimientos: agenda unificada de legalización de libros, próximas convocatorias y reuniones, plazos de votación de acuerdos sin sesión y vencimientos de mandato, con navegación directa a cada expediente.

- Campañas de grupo: coordinación de procesos homogéneos —por ejemplo, aprobación de cuentas en cascada— sobre un perímetro multi-sociedad, con dependencias entre hitos.

6.4 Procesos de datos maestros

Sostienen la operativa anterior sin ser, en sí mismos, actos societarios formales: alta de sociedad (asistente de 11 pasos que puebla capital, clases de títulos, cap table, órganos y cargos en una única transacción), alta de socio o accionista, transmisión de participaciones o acciones, designación de administrador o cargo, alta de persona física o jurídica, importación masiva de personas, designación de representante de administrador persona jurídica (art. 212 bis LSC) y representación puntual —delegación de voto en junta o delegación entre miembros del consejo—.

7 Integridad, evidencia y control de acceso

7.1 La cadena de integridad — qué es real hoy

Cada acuerdo certificado encadena una serie de garantías criptográficas verificables en la base de datos viva: el censo de la sesión queda congelado en un registro inmutable (bloqueado frente a modificación o borrado por disparadores de la propia base de datos, no por convención de la aplicación); ese censo produce una huella de verificación que combina la huella del censo con la del resultado del acuerdo; el documento generado se archiva con su propia huella criptográfica; y un registro de auditoría de solo-adición encadena cada evento con la huella del anterior, de modo que cualquier alteración retroactiva del historial sería detectable. Esta cadena —censo inmutable, huella de verificación, archivado, auditoría encadenada— es arquitectura real y operativa, y se puede volver a verificar en cualquier momento.

7.2 La frontera de confianza con EAD Trust

Sobre esa cadena se apoyaría, en un sistema en producción jurídica, una capa de servicios de confianza cualificados —firma electrónica cualificada, sello de persona jurídica, sello de tiempo, notificación fehaciente— prestada por EAD Trust como prestador cualificado. En el alcance vigente del prototipo, esa capa está deliberadamente acotada: EAD Trust interviene solo como interposición, mensajería básica y custodia o archivo electrónico. El sistema distingue en su propia arquitectura, no solo en la documentación, la evidencia de entorno de pruebas de la evidencia sellada de producción, de modo que un documento generado en modo de pruebas nunca se presenta con la etiqueta de firmado por EAD Trust.

7.3 RBAC y segregación de funciones

El acceso se gobierna por cinco roles (Administrador de tenant, Secretario, Consejero, Compliance, Auditor) sobre los que se apoya una matriz de capacidades societarias: quién puede congelar un censo, quién puede emitir voto en nombre del sistema y quién puede certificar, con la razón jurídica de cada concesión anotada junto al permiso —no es solo una lista de control de acceso, es una lista razonada—. Sobre esa matriz opera además un catálogo de combinaciones tóxicas de funciones (por ejemplo, quien propone no debería ser quien certifica sin más control), que el sistema señala o bloquea según el caso.

8 Alcance actual y honestidad de posicionamiento

El prototipo existe para validar una filosofía de diseño, flujos reales conectados a base de datos y una separación de responsabilidades entre módulos —no para sustituir, hoy, un sistema en producción jurídica. Conviene que Presidencia conozca, con la misma precisión que las capacidades, dónde está la frontera actual:

- Cobertura jurisdiccional: España, completa. Portugal, en vista previa normativa mediante personalizaciones. Brasil y México, planificados tras validar el modelo español; la matriz jurisdiccional de hoy es una herramienta de formalización local, no un motor de reglas extranjero (bloque 3.3).

- Evidencia probatoria: la cadena de integridad es real; la capa de servicios de confianza cualificados sobre EAD Trust está acotada a interposición y custodia, sin claim de firma ni de notificación fehaciente (bloque 7.2).

- Datos de demostración: toda persona, sociedad, cifra de capital y de retribución citada en este informe es de demostración, coherente con una estructura corporativa construida para el prototipo, no información de un cliente real.

- Deuda de diseño declarada, no oculta: entre otras, dos figuras de gobierno corporativo distintas pero con nombres similares —la Comisión de Riesgos Regulada, órgano estatutario, y el Comité de Riesgos, comité interno de gestión— se modelan por separado porque tienen valor jurídico distinto, aunque el módulo las gestione en paralelo; y el conflicto de interés se computa dentro del propio cauce de votación, no como expediente independiente, porque su gestión de riesgo pertenece al módulo de cumplimiento normativo del grupo.

Ninguna de estas fronteras es un defecto silencioso: todas están documentadas, con su motivo, en el mismo repositorio de código que gobierna el sistema, y se revisan en cada iteración del prototipo.

9 Cierre

Cuatro rasgos sostienen este diseño y valen, se cree, la atención de Presidencia:

- El criterio legal está versionado y es auditable con independencia del calendario de publicación del software: cambiar una regla es una decisión del Comité Legal sobre un dato, no un despliegue de ingeniería.

- Cada decisión automática es explicable, artículo por artículo, frente a la redacción exacta de la norma que se aplicó — no hay una "caja negra" entre la materia y el resultado.

- El sistema es honesto sobre su propia incertidumbre: declara la procedencia de una regla cuando es dudosa, separa el plano contractual del societario, y señala los siete bordes que no puede resolver por sí solo, en vez de presentar una falsa confianza.

- La arquitectura es la misma para España hoy y para Portugal, Brasil y México mañana: extender la cobertura jurisdiccional es, en lo esencial, un ejercicio de datos, no un rediseño.

Este informe deja abiertos, para discusión con el Comité Legal, los puntos que el propio sistema ya identifica como pendientes de criterio profesional: si procede tratar por analogía al socio único y al soporte interno como Junta a efectos del art. 15 LSC; si conviene adoptar la opción de bloqueo preventivo ("fail-closed") descrita en el bloque 3.4 para alguna materia concreta, y con qué criterio; y la secuencia de incorporación de Brasil y México a la matriz jurisdiccional. Quedamos a disposición de Presidencia para profundizar en cualquiera de los bloques anteriores con el detalle técnico que se considere oportuno.

*Fuente de verdad: código fuente del repositorio y base de datos en producción del prototipo (Supabase, proyecto governance_OS), consultados en vivo. Cifras fechadas donde procede; ninguna se presenta como vigencia indefinida.*
