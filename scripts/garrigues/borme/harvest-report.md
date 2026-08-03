# Informe de cosecha BORME — Carril B / vertiente B1

Fecha de captura: 2026-08-03. Investigador: agente Carril B (vertiente B1), con apoyo de 4 sub-agentes paralelos para las 8 sociedades SLP más sencillas mientras esta vertiente investigaba directamente EAD Trust, Violet, EWCH y Garben (las 4 piezas que requerían más criterio).

Política de fuentes aplicada: BOE/BORME oficial (boe.es, con CVE) como preferente; agregadores públicos sin login (einforma.com, axesor.es, infonif.economia3.com, datoscif.es, empresia.es, empresite.eleconomista.es, infoempresa.com, iberinform.es) como aceptable, con URL de captura siempre anotada. Ningún dato se ha inventado: todo lo no verificado queda como `PENDIENTE` con explicación de por qué. `einforma.com` devolvió HTTP 429 (rate limit) en la mayoría de los intentos posteriores a la primera hora de trabajo, muy probablemente por la carga concurrente de los 5 carriles trabajando a la vez contra ese dominio — se respetó la política de no forzar scraping agresivo y se usaron fuentes alternativas equivalentes.

**Nota de alcance:** las cifras/estados de este informe son una fotografía de la captura del 2026-08-03 (situación societaria, capital, cargos vigentes según el Registro Mercantil vía agregadores). No se ha verificado nada más allá de lo aquí documentado.

---

## Resumen de cobertura

| # | Sociedad | Fichero | Estado |
|---|---|---|---|
| 1 | Garrigues IP, S.L.P. | `garrigues-ip-slp.json` | COMPLETO |
| 2 | G-Advisory, Consultoría Técnica, Económica y Estratégica, S.L.P. | `g-advisory-slp.json` | COMPLETO |
| 3 | Garrigues Letrados de Soporte, S.L.P. | `garrigues-letrados-soporte-slp.json` | COMPLETO |
| 4 | Garrigues Human Capital Services, S.L.P. | `garrigues-hcs-slp.json` | COMPLETO |
| 5 | Garrigues Consultoría de Empresa Familiar, S.L.P. | `garrigues-empresa-familiar-slp.json` | COMPLETO |
| 6 | Garrigues Sports & Entertainment, S.L.P. | `garrigues-sports-entertainment-slp.json` | COMPLETO — hallazgo mayor: EXTINGUIDA desde 2018 |
| 7 | Garrigues Portugal, S.L.P. | `garrigues-portugal-slp.json` | COMPLETO — hallazgo relevante: parece SLP hermana con socios propios, no filial de capital |
| 8 | Compañía Digital NewLaw, S.L.U. | `cia-digital-newlaw-slu.json` | COMPLETO |
| 9 | EAD Trust European Agency of Digital Trust, S.L. | `ead-trust-sl.json` | COMPLETO — consejo verificado en su totalidad |
| 10 | Violet Inversiones 2010, S.L. | `violet-inversiones-2010-sl.json` | COMPLETO |
| 11 | (EWCH) → EWOH Inversiones 2010, S.L. | `ewch-inversiones-sl.json` | COMPLETO — denominación RESUELTA (ver sección dedicada) |
| 12 | Garben → Garmen Inversiones 2013, S.L. | `garben-inversiones-2013-slu.json` | COMPLETO — denominación probablemente corregida (ver sección dedicada) |

**Las 12 sociedades objetivo tienen ficha completa. 10 de 12 tenían `nif: null` en el catálogo interno y ahora tienen NIF confirmado** (las 2 excepciones ya tenían NIF: EAD Trust y Compañía Digital NewLaw no partían de `null` — su NIF real coincide con lo esperado). Ninguna sociedad quedó sin investigar.

---

## Notas por sociedad (1–12)

### 1. Garrigues IP, S.L.P. — NIF B78523123
Activa. Adm. Único: J&A Garrigues SLP (nombramiento 15/07/2008); representante persona física contradictorio entre fuentes (einforma cita a Alonso Puig 2008, iberinform/infonif citan a Vives Ruiz sin fecha) — PENDIENTE de resolver. Domicilio Plaza de Colón 2 (antes Hermosilla 3, trasladado 05/2025). Capital 162.000 €. 4 actos 2024-2025 verificados con texto literal oficial en boe.es. Denominación anterior: "Garrigues Agencia de Propiedad Industrial e Intelectual SLP". PENDIENTE: auditor, % de participación real, estatus de unipersonalidad.

### 2. G-Advisory, Consultoría Técnica, Económica y Estratégica, S.L.P. — NIF B82801069
Activa. Antes llamada **"Garrigues Medio Ambiente Consultoría Técnica y de Gestión Integrada del Medio Ambiente, S.L.P."** — cambio de nombre corroborado por un comunicado propio de Garrigues (fuente no-BORME); el acto BORME concreto del cambio de denominación no se localizó. Adm. Único: J&A Garrigues SLP (15/07/2008). Auditor: Lillo Auditores Asociados SL (reelecciones sucesivas hasta 2026). Capital 512.000 € (ampliación ~20/03/2025). 7 actos 2024-2026, 3 verificados con texto oficial BOE, 4 solo vía agregador (anuncio+boletín citado, sin verificación de texto exacto). PENDIENTE: % de participación real (el 75% del catálogo interno ni se confirma ni se descarta).

### 3. Garrigues Letrados de Soporte, S.L.P. — NIF B81552671
Activa. **Antes llamada "Rino Asesores, S.L.P."** hasta el cambio de denominación del 02/01/2018 — dato con implicaciones para Violet/EWOH/Garmen, ver sección de discrepancias más abajo. Adm. Único = J&A Garrigues SLP, confirmado explícitamente por 2 fuentes independientes (a diferencia de su hermana HCS). CNAE 6920. Domicilio Plaza de Colón 2 (trasladado 05/2025). Capital social PENDIENTE (oculto tras muro premium en todas las fuentes). 6 actos BORME 2024-2025 con anuncio citado.

### 4. Garrigues Human Capital Services, S.L.P. — NIF B83697128
Activa. A diferencia de su hermana Letrados de Soporte, **ninguna fuente declara explícitamente "Administrador Único"** para esta sociedad — solo un "Representante" (Vives Ruiz, Fernando) sin cargo especificado. Tratado como inferencia razonable por patrón de grupo, no como dato confirmado (recomendación del propio carril: bajar la confianza de `formaAdministracion=ADMINISTRADOR_UNICO` de "CONFIRMADO" a "ALTA_PROBABILIDAD" para esta ficha concreta). CNAE 7022. Capital PENDIENTE. 10 actos 2021-2025 documentados, incluida una rectificación de apellido (Pintado→Pindado) que explica una discrepancia de grafía recurrente en varias fichas hermanas.

### 5. Garrigues Consultoría de Empresa Familiar, S.L.P. — NIF B83752626
Activa. Confirmada explícitamente entre las 10 participadas vigentes de J&A Garrigues SLP. Capital 76.080 €. CNAE 8299. Denominación anterior: "Garrigues Empresa Familiar SL". Acto de 2017 confirma que J&A Garrigues SLP adquirió la titularidad única (socio único) — consistente con `esUnipersonal=true`. El "Adm. Único" explícito no se confirmó con cita literal para esta sociedad en concreto (mismo patrón de inferencia razonable que HCS).

### 6. Garrigues Sports & Entertainment, S.L.P. — NIF B83321901 — HALLAZGO MAYOR
**EXTINGUIDA desde el 10/01/2018** (disolución voluntaria + liquidación). El catálogo interno la listaba con `confianza=PENDIENTE` y sin evidencia IDC, pero SÍ existe y SÍ tiene un vínculo societario real y verificado oficialmente en boe.es (CVE `BORME-A-2018-14-28`, anuncio 29390): en el momento de su disolución, **J&A Garrigues SLP (representada por Fernando Vives Ruiz) era su Administrador Único y también su Liquidador**. Domicilio distinto al resto del grupo (Calle Hermosilla 3, no Plaza de Colón 2). Corroboración cruzada independiente (verificada dos veces, por dos métodos distintos): la ficha de "cargos por persona" de Roberto Delgado Gil confirma su cese como apoderado exactamente el 10/01/2018, coincidiendo con la fecha de extinción. **Recomendación explícita al catálogo:** pasar de `confianza=PENDIENTE` a algo como `CONFIRMADO_HISTORICO_EXTINTA`, dejando claro que la sociedad ya no existe y que la evidencia de vínculo es histórica (2002/2017-2018), no vigente.

### 7. Garrigues Portugal, S.L.P. — NIF B81745754 — HALLAZGO ESTRUCTURAL RELEVANTE
Activa (sociedad **española**, Registro Mercantil de Madrid, pese al nombre — no confundir con `garrigues-portugal-sucursal`, la sucursal en Oporto). CNAE 6910. Domicilio Plaza de Colón 2. Capital 63.010 € (discrepancia sin resolver: un resumen de motor de búsqueda sobre un BORME de 2014 sugería 147.387,50 €, muy superior — no investigada, queda como lead). Adm. Único Vives Ruiz Fernando (reelegido 06/07/2026), Auditor Lillo Auditores Asociados SL.

**Hallazgo relevante:** a diferencia de las SLP puramente instrumentales (IP, HCS, Letrados de Soporte, Empresa Familiar — solo Adm. Único + Apoderados), Garrigues Portugal SLP tiene **socios profesionales propios** (Soc.Prof.) que compran/venden participaciones numeradas directamente entre sí vía autocartera — el mismo patrón que la propia matriz J&A Garrigues SLP (ver `jya-garrigues-slp.json`), no el patrón de las filiales-vehículo. Tampoco aparece en la lista de "10 participadas vigentes" de J&A Garrigues SLP. El propio carril que la investigó concluye que esto sugiere una **SLP hermana con pool de socios profesionales compartido**, no necesariamente una filial de capital al 100%/porcentaje conocido — matiz importante para el campo `groupRole=FILIAL` del catálogo. 19 actos en total localizados (6 dentro de 2024-2026 destacados aquí), todos verificados por lectura directa del PDF oficial de boe.es (no solo agregador); el propio carril detectó y evitó una alucinación de una herramienta de extracción de texto que había atribuido a esta sociedad los datos registrales de la matriz.

### 8. Compañía Digital NewLaw, S.L.U. — NIF B72893035
Activa. **Socio Único y Administrador Único: J&A Garrigues SLP** (desde 28/12/2022, representada por Vives Ruiz Fernando) — confirma `esUnipersonal=true` del catálogo. Constituida 16/12/2022 (capital inicial 20.000 €), con una cadena de ampliaciones de capital bien reconstruida y aritméticamente consistente hasta el capital vigente de **1.578.000 €** (última ampliación de 400.000 €, inscrita 06/08/2025). 3 de los 6 hitos de capital verificados por lectura directa del PDF oficial de boe.es; los 3 más antiguos (constitución 2022, ampliaciones de 2023 y enero 2024) solo vía agregador. Roberto Delgado Gil aparece de nuevo como apoderado (desde 28/12/2022) — la misma persona que es apoderado mancomunado de Garrigues Portugal SLP desde 2018 y Secretario no Consejero de EAD Trust. **No se ha verificado la participación ~51% en EAD Trust** (las participaciones de una sociedad en otra no constan en el BORME de la matriz, solo en el de la participada, y ese análisis queda fuera del alcance de este fichero).

### 9. EAD Trust European Agency of Digital Trust, S.L. — NIF B85626240 — CONSEJO VERIFICADO
Activa. Domicilio Calle Méntrida 6 (Madrid) — **distinto** del resto del grupo (Plaza de Colón 2), consistente con ser una operación tecnológica propia, no una filial instrumental jurídica. Capital 3.445 €. Auditor Lillo Auditores Asociados SL.

**Las 7 personas de la composición esperada por la fuente interna quedan confirmadas, 6 de ellas con nombre y apellido completos vía fuente directa (datoscif.es) y texto oficial BOE:**
- Julián Ramón Inza Aldaz — **Presidente** + Consejero ✓
- Eduardo Inza Blasco — **Consejero Delegado** (desde 03/05/2023) + Consejero ✓
- Eduardo Abad Valdenebro — Consejero ✓, **y además Vicepresidente** (rol no anticipado por la fuente interna)
- Cristina Mesa Sánchez — Consejera ✓
- Moisés Menéndez Andrés — Consejero ✓
- Roberto Delgado Gil — **Secretario no Consejero** (desde 20/04/2023, confirmado también de forma cruzada vía empresia.es) ✓
- Belén Aguayo — **Vicesecretaria no Consejera** ✓, con matiz: el apellido completo solo se vio como "BELEN A..." (redactado) en una de las fuentes — coincide con el nombre esperado pero no se deletreó letra por letra en ninguna fuente que pude leer sin login.

2 CVE confirmados con texto literal (`BORME-A-2026-123-28` reelección de auditor; `BORME-A-2024-239-28` nombramiento de 7 apoderados, con los 7 apellidos completos citados literalmente en el propio BORME). Manuel Delgado Quirós aparece como apoderado adicional (no consejero) — la misma persona que administra Violet/EWOH/Garmen.

### 10. Violet Inversiones 2010, S.L. — NIF B85944411
Activa. CNAE 7022. Domicilio Plaza de Colón 2 (trasladado desde Paseo de la Castellana 10 en abril/mayo 2025). Capital 3.012 € (sin cambios desde constitución 2010). Adm. Único: **Rino Asesores, S.L.P.**, representada por Manuel Delgado Quirós — ver discrepancia/hallazgo importante abajo (Rino Asesores = hoy Garrigues Letrados de Soporte SLP). 10 apoderados nombrados el mismo día (12/11/2021) que en EWOH y Garmen. 1 acto 2024-2026 (cambio de domicilio).

### 11. EWCH → EWOH Inversiones 2010, S.L. — NIF B86021698 — VER SECCIÓN DEDICADA

### 12. Garben → Garmen Inversiones 2013, S.L. — NIF B86825437 — VER SECCIÓN DEDICADA

---

## Resolución de "EWCH(?) Inversiones 20¿10?, S.L." — objetivo central

**Conclusión: la sociedad real es, con confianza ALTA pero no absoluta, "EWOH Inversiones 2010, S.L." (NIF B86021698).**

Razonamiento:
1. El año "2010" encaja exactamente con la parte "20¿10?" que el IDC marcaba como dudosa.
2. "EWOH" vs "EWCH" difiere en una sola letra (O↔C) — una confusión de OCR plausible en un cuadro escaneado.
3. Triangulación: la entidad aparece con el mismo NIF B86021698 en (a) la ficha de participadas de J&A Garrigues SLP, (b) la ficha de participadas de G-Advisory SLP, y (c) su propia ficha directa en infonif.economia3.com — perfil gemelo de Violet Inversiones 2010 SL (mismo año, mismo capital de constitución 3.012 €, mismo domicilio, mismos 10 apoderados, mismo patrón de administrador persona jurídica representado por Manuel Delgado Quirós).
4. Corroboración **independiente** por un método distinto: la ficha de "cargos por persona" de Roberto Delgado Gil en empresia.es confirma "EWOH INVERSIONES 2010 SL — Apoderado (12/11/2021-present)" — la misma fecha exacta del lote de apoderamientos de Violet y Garmen.

**Limitación honesta:** los puntos 1-3 dependen, en rigor, de UNA sola base de datos subyacente (red economia3.com/infonif), consultada desde 3 ángulos distintos — no de 3 proveedores de datos independientes. Solo el punto 4 (empresia.es) es una fuente genuinamente distinta. `einforma.com` devolvió HTTP 429 en el intento de esta vertiente; `axesor.es` y `empresite.eleconomista.es` no devolvieron resultados para "EWOH" en las búsquedas realizadas. **Recomendación:** tratar la resolución como utilizable para la demo, pero verificar de forma adicional (Registro Mercantil de Madrid o búsqueda BORME por NIF) antes de marcarla `CONFIRMADO` en `entities-catalog.ts`.

No se localizó ningún acto BORME 2024-2026 específico de esta sociedad (el array `actos` queda vacío, no inventado).

---

## Resolución de "Garben Inversiones 2013, S.L.U." — corrección probable

**Hallazgo: la única sociedad localizable con este perfil se llama consistentemente "Garmen Inversiones 2013, S.L." (con M, no B) — NIF B86825437.**

Aparece así, de forma idéntica, en 3 consultas directas (ficha propia, participadas de J&A Garrigues SLP, participadas de G-Advisory SLP) más un indicio adicional no verificado por fetch directo (empresite.eleconomista.es, bloqueado por rate-limit, pero con el mismo nombre en el título de la página según los resultados de búsqueda). Ninguna búsqueda de "Garben Inversiones 2013" devolvió resultados; todas las búsquedas de "Garmen Inversiones 2013" sí.

Misma limitación honesta que EWCH/EWOH: la evidencia descansa esencialmente en la misma base de datos subyacente consultada varias veces. **Recomendación:** verificación adicional antes de renombrar el catálogo.

Datos adicionales: capital ampliado de 70.000 € a 73.000 € (28/01/2026, anuncio 44669) — a diferencia de Violet/EWOH, esta sociedad SÍ tuvo una ampliación de capital reciente. CNAE distinto al de sus hermanas: "Intermediarios financieros" (no "Consultoría empresarial y otros"). El catálogo interno asume forma "S.L.U." (unipersonal); ninguna fuente consultada lo confirma explícitamente — queda PENDIENTE, no afirmado.

**El % de participación directo de Violet/EWOH/Garmen (¿J&A Garrigues SLP directamente, o vía G-Advisory como infiere el catálogo para Garmen?) sigue SIN RESOLVER**: el campo "Empresa Matriz" que usan estos agregadores parece señalar siempre la cabecera última del grupo (aparece idéntico en G-Advisory, que es 75% no 100%), no el accionista directo/inmediato. El Registro Mercantil no publica libro de socios, así que esta pregunta requeriría una fuente distinta (p. ej. confirmación directa del despacho) para cerrarse.

---

## Discrepancias y correcciones sugeridas al catálogo (`scripts/garrigues/entities-catalog.ts`)

Leído para contraste, **no modificado**, según instrucción.

| Entidad (slug) | Campo del catálogo | Lo que dice el catálogo | Lo que dice esta cosecha | Sugerencia |
|---|---|---|---|---|
| `garrigues-sports-entertainment-slp` | `confianza` | `PENDIENTE`, sin evidencia IDC | **Sociedad real, NIF B83321901, pero EXTINGUIDA desde 10/01/2018**, con vínculo de gobierno corporativo documentado oficialmente (Adm. Único/Liquidador = J&A Garrigues SLP) | Pasar a algo como `CONFIRMADO_HISTORICO_EXTINTA`; no tratarla como filial viva |
| `garrigues-ip-slp`, `g-advisory-slp`, `garrigues-letrados-soporte-slp`, `garrigues-hcs-slp`, `garrigues-empresa-familiar-slp` | `nif: null` | Sin NIF | NIF confirmado para las 5 (ver tabla de arriba) | Actualizar `nif` en el catálogo |
| `ewch-inversiones-sl` | `legalName` | `"EWCH(?) Inversiones 20¿10?, S.L."` (denominación dudosa) | Probablemente **"EWOH Inversiones 2010, S.L."**, NIF B86021698 (confianza alta, no absoluta) | Actualizar denominación tras verificación adicional recomendada |
| `garben-inversiones-2013-slu` | `legalName` | `"Garben Inversiones 2013, S.L.U."` | Probablemente **"Garmen Inversiones 2013, S.L."**, NIF B86825437; "S.L.U." no confirmado | Actualizar denominación y revisar el sufijo "U" tras verificación adicional |
| `violet-inversiones-2010-sl`, `ewch-inversiones-sl`, `garben-inversiones-2013-slu` | `parentSlug: null` / inferencia G-Advisory | Sin padre asignado (Violet/EWOH) o G-Advisory inferido por aritmética (Garmen) | El "Empresa Matriz" de los agregadores señala J&A Garrigues SLP para las 3, pero ese campo parece ser la cabecera última del grupo, no el accionista directo — **no resuelve** la pregunta del catálogo | Mantener como pendiente de confirmación directa; no asumir que esto zanja la cuestión |
| — (no está en el catálogo) | — | — | **"Garrigues Retail, S.L.P."** (NIF B87674719) apareció en las búsquedas, pero es una empresa de **arquitectura** sin relación aparente con el grupo (CNAE 7111, domicilio distinto) — **descartada**, falso positivo | Ninguna — solo para que quede constancia de que se revisó y se descartó |
| — (no está en el catálogo) | — | — | **"Centro Europeo de Estudios y Formación Empresarial Garrigues, S.L.P."** (NIF B81011470, Alcobendas) — muy probablemente el vehículo legal real detrás de la entidad 29 del catálogo ("Centro de Estudios Garrigues", hoy tipada como `INSTITUCION` genérica) | Posible lead para resolver las incidencias abiertas de esa entidad (transmisión del 20% en 2025, "toma de participación" 2026) | No investigado a fondo (fuera de los 12 objetivos); recomendar como siguiente paso de una vertiente futura |
| `violet-inversiones-2010-sl` (Adm. Único) | — | No documentado en el catálogo | El Adm. Único de Violet ("Rino Asesores, S.L.P." desde 2010) es, con alta probabilidad, la MISMA persona jurídica que hoy se llama **Garrigues Letrados de Soporte, S.L.P.** (cambio de nombre confirmado 02/01/2018) — es decir, Violet está administrada por otra de las 12 sociedades de este mismo encargo | Documentar esta cadena administrativa en el catálogo si se considera relevante para el mapa de gobernanza |

---

## Metodología y limitaciones generales

- **Fuentes usadas** (todas sin login): einforma.com (limitado por rate-limit HTTP 429 tras la primera hora), axesor.es, infonif.economia3.com, datoscif.es, empresia.es / empresite.eleconomista.es (grupo elEconomista), infoempresa.com, iberinform.es, y verificación de texto oficial en `boe.es/diario_borme/txt.php?id=<CVE>` para los actos más relevantes.
- **Patrón de traslado de sede coordinado:** al menos 5 sociedades (Garrigues IP, G-Advisory, Letrados de Soporte, HCS, Empresa Familiar) y probablemente Violet/Garmen trasladaron su domicilio a Plaza de Colón 2 (Madrid) en una ventana muy estrecha, finales de abril a mediados de mayo de 2025 — parece un único evento corporativo de consolidación de sede, no traslados independientes.
- **Patrón de apoderamiento coordinado:** una lista casi idéntica de personas (Delgado Gil Roberto, Delgado Quirós Manuel, Chapinal Martín Laura, De Pedro Martín Víctor Manuel, Fernández Ruiz Ana, García Temprano Mahey, González Pindado Ana, Vadillo Rebollo María Luisa, Otal Soria Laura, Sastre Gallego María de las Mercedes, Ordúñez Pérez María José, Ramos Bañús Lourdes) fue apoderada en bloque el 12/11/2021 y el 08/02/2022 en varias de estas filiales — equipo de "servicios corporativos" interno del despacho, no accionistas ni socios profesionales.
- **Fernando Vives Ruiz** (Adm. Único persona física de la matriz J&A Garrigues SLP) reaparece como representante/figura de administración en prácticamente todas las filiales investigadas.
- **CVE no siempre resoluble:** en varios casos el número de boletín citado por un agregador no correspondió linealmente al sufijo del CVE oficial al intentar verificarlo directamente en boe.es (p. ej. un intento con `BORME-A-2024-124-28` para EAD Trust, o `BORME-A-2025-87-28` para Violet, no encontraron la entrada esperada) — no se fuerza ni inventa un CVE en esos casos, se cita solo el número de anuncio/boletín del agregador.
- **`librebor.me`** es un mirror de datos abiertos de BORME: en algún intento devolvió HTTP 403, pero otro carril de esta misma cosecha sí logró usarlo con éxito (parte del historial de capital de Compañía Digital NewLaw SLU) — el acceso parece intermitente/sensible a la sesión, no bloqueado de forma sistemática. Podría ser una fuente aceptable adicional para una vertiente futura.
- Ningún dato de este informe se ha usado para tocar código de producto, Supabase, ni se ha hecho ningún commit — cumpliendo el alcance de esta vertiente (solo investigación y ficheros de datos).
