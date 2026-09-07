# Invariantes de diseño de G5 y G6 — qué sigue en pie y qué derogó la orden del 2026-09-07

- **Fecha:** 2026-08-29 · **revisado el 2026-09-07** (cambio de orden: el tenant Garrigues se
  siembra; §1 ya estaba superado y §4 queda derogado en su parte decisoria)
- **Origen:** la conversación que diseñó G5 y G6, a petición de la orquestación del programa
- **Para qué:** G5 y G6 se cerraron **sin ledger SDD**. El código está en git; el porqué no
  estaba en ninguna parte. Esto es el porqué.

Cada punto describía algo que **parecía un defecto y no lo era**. Todos han estado a punto de
ser «corregidos» al menos una vez.

> **El §1 está SUPERADO** desde el 2026-08-29 por una fuente que apareció después. Se deja
> escrito con su refutación en vez de borrarlo. Un invariante desmentido que se queda escrito
> como invariante es peor que no tenerlo: se lee como comprobado y el siguiente lector ya no
> vuelve a mirar.

> ## ⚠️ Cambio de orden del 2026-09-07 — leer antes que nada
>
> El usuario ha derogado la premisa de la que colgaban varios de estos puntos:
>
> - **Orden derogada:** «Garrigues no tiene inventario propio y NO se siembra, porque fabricar
>   esos datos haría el dato demo indistinguible del real. La ausencia ES la decisión.»
> - **Orden vigente:** «El tenant Garrigues SE VA A IR SEMBRANDO, de forma PROGRESIVA, con datos
>   SIMULADOS PERO BASADOS EN LA REALIDAD, y ese dato DEBE PERSISTIR.»
>
> Consecuencias, por orden de importancia:
>
> 1. **Persistir es el requisito duro.** Borrar, pisar o duplicar dato sembrado de Garrigues es
>    ahora un DEFECTO, no una limpieza.
> 2. **Sembrar no puede poner la corrida en rojo.** Un gate que se pone rojo cuando alguien
>    siembra empuja al siguiente a revertir la siembra.
> 3. **Perder dato sí tiene que ponerse rojo.** Los gates no se desarman: se les da la vuelta.
>    Donde vigilaban «sigue vacío», vigilan «no se ha perdido lo que había».
>
> **Qué deroga y qué no, punto por punto de este documento:**
>
> | § | Estado tras el 2026-09-07 |
> |---|---|
> | 1 | Ya estaba SUPERADO por fuente sobrevenida. Sin cambio. |
> | 2 | **DEROGADO POR DECISIÓN EXPRESA DEL USUARIO el 2026-09-07.** El CHECK `risks_banda_sin_ejes_check` se retiró (`20260907160000`) para poder sembrar ejes simulados. El razonamiento de abajo —que de un color final no se derivan P e I— **sigue siendo cierto**: lo que cambia es que ya no lo impide la base. Ahora un riesgo puede traer las dos evaluaciones, y la regla es que **no se concilian**: se pintan las dos, la pantalla lo declara, y la escala 1-25 se alimenta solo de los ejes (`lecturaRiesgo`, `src/lib/grc/assessed-band.ts`). Lo que se pierde está dicho: la base ya no distingue un eje medido de uno inventado. |
> | 3 | **SIGUE EN PIE.** El 8 es «el resultado de contar» las celdas de banda alta del mapa, no un tamaño de demo elegido: si tras un reseed salen ≠ 8, cambió la fuente o se rompió el extractor. |
> | 4 | **DEROGADO en su parte decisoria.** Ver el apartado, reescrito abajo. El aviso de pantalla y el peligro del `DEFAULT` a ARGA siguen vigentes. |
> | 5 | **SIGUE EN PIE.** Es criterio jurídico con fuente, no ausencia de dato. |
> | 6 | **SIGUE EN PIE.** Es criterio de evidencia, no ausencia de dato. |
>
> Lo que **no** cambia en ningún caso: el contrato **cero-cambio ARGA**, y que el dato simulado
> se **etiquete** donde ya se etiqueta (`data_provenance`, `firmeza: "DEMO_PILOTO"`, badges de
> procedencia). «Simulado pero basado en la realidad» no autoriza a presentarlo como real.

---

## 1. ~~Los dos verdes del mapa penal no tienen orden publicado~~ — SUPERADO

> **⚠️ Invariante superado por fuente sobrevenida el 2026-08-29.** No se borra: se deja con
> su razonamiento original y su refutación, porque el orden en que se supo importa.

### Lo que decía, y por qué era cierto entonces

`assessed_band` colapsa verde intenso y verde claro en un único `VERDE`, mientras que
`assessment_breakdown` conserva el color exacto de cada celda.

Con la evidencia disponible en G5 —los dos PDF del mapa evaluado 2025— **el nivel se expresa
solo por color y no hay leyenda en ninguna de sus páginas**; PPD-01 tampoco documenta la
escala. Se comprobó si el orden era derivable del propio dato y **no lo era**: solo 5 de las
82 filas usan los dos verdes a la vez, y la frecuencia se invierte entre los dos mapas (en
áreas de negocio el claro es 17 veces más frecuente que el intenso; en departamentos internos
la proporción se da la vuelta). Determinado: amarillo < naranja < rojo, y los dos verdes por
debajo del amarillo. Indeterminado: cuál de los dos verdes iba antes.

Colapsarlos **era la decisión correcta con esa evidencia**: separarlos habría sido inventar
una escala que las fuentes entonces conocidas no tenían.

### Lo que la superó

`Plantilla evaluación de riesgos_G-Digital.xlsx`, hoja **`Config.`**. Es la plantilla oficial
del despacho para evaluar riesgos penales. Su matriz probabilidad × impacto lleva el nivel
escrito en el texto de cada celda y **la banda en el color de relleno**. Los rellenos
extraídos de `xl/styles.xml` coinciden **exactamente** con los RGB medidos píxel a píxel en el
mapa evaluado — la misma paleta por dos caminos independientes:

| Nivel | Color | RGB |
|---|---|---|
| Muy bajo | verde intenso | `#00B050` = (0,176,80) |
| Bajo | verde claro | `#92D050` = (146,208,80) |
| Medio | amarillo | `#FFFF00` |
| Alto | naranja | `#FFC000` |
| Muy alto | rojo | `#FF0000` |
| — | gris `#D9D9D9` | sin valor / no evaluado |

**La escala tiene nombres y los dos verdes tienen orden: verde intenso = Muy bajo, verde
claro = Bajo.** El spec de G5 §6 condicionaba el pase de `DEMO_PILOTO` a `FIRME` a que el
despacho facilitara la leyenda real. La ha facilitado.

### Qué queda en pie y qué no

- **Cae:** «escala ordinal sin nombres» y «el orden de los dos verdes no es derivable».
- **Sigue en pie:** que el colapso a `VERDE` fue correcto mientras la leyenda no constaba, y
  que `assessment_breakdown` conserve el color exacto de cada celda — ahora es lo que permite
  reetiquetar sin volver a extraer.
- **Pendiente de ejecución**, en cola detrás del cierre de C3: reetiquetar las bandas con sus
  nombres y subir la `firmeza`. Hasta que se ejecute, el dato en Cloud sigue como está.

## 2. `probability`, `impact` y `residual_score` están en NULL a propósito

> **DEROGADO EN SU PARTE IMPERATIVA — 2026-09-07.** El usuario decidió permitir ejes simulados
> sobre riesgos con banda, y el CHECK se retiró en `20260907160000`. Todo lo que sigue explica
> POR QUÉ estaban en NULL y sigue siendo la mejor descripción del problema; lo único que ya no
> vale es la conclusión operativa («no se pueden rellenar»). Hoy sí se pueden, y por eso importa
> más que antes lo que dice el párrafo final sobre la leyenda.

Los 82 riesgos penales los tienen vacíos. Hasta el 2026-09-07 hubo un CHECK
(`risks_banda_sin_ejes_check`) que impedía rellenarlos cuando existe `assessed_band`.

La fuente da **un nivel compuesto por celda** y no lo descompone en probabilidad × impacto.
**Rellenarlos es fabricar dato, no completarlo.** El CHECK es la red; la razón es esta.

**Matiz añadido el 2026-08-29, y es el que impide que el hallazgo del §1 se convierta en
barra libre.** La plantilla revela que la metodología del despacho **sí descompone**: P1
frecuencia de exposición (habitual 5 / ocasional 2,5 / remoto 1) × P2 sujetos activos (solo
Socio 1 → Staff y superior 2), máximo bruto 10, normalizado a 0-1 con cortes en 0,8 / 0,6 /
0,4 / 0,2, cruzado contra impacto en la matriz de `Config.`.

Eso **no cambia este invariante**. La plantilla acredita la **leyenda**, no los **ejes de cada
riesgo concreto**: el PDF evaluado sigue publicando únicamente el color final, y de ahí no se
pueden derivar la P y la I de cada celda.

**Y esto es lo que sobrevive a la derogación, y es lo importante:** que ahora se PUEDA sembrar
ejes no significa que se puedan DERIVAR de la banda. Un eje sembrado sobre uno de estos 82 es
dato nuevo, no la descomposición del color que ya estaba: tiene que declarar su procedencia y su
firmeza, o la ficha lo pintará como dato firme. Los `RSK-GARR-PEN-%` son además una extracción
congelada —`src/test/schema/g5-mapa-penal.test.ts` exige sus ejes en NULL—, así que **los riesgos
con ejes simulados deben usar otro prefijo**; ese gate poniéndose rojo sobre los 82 sería la
señal correcta, no un estorbo. Derivar P e I del color seguiría exigiendo una leyenda que la
fuente no publica: eso sigue siendo del Comité Legal.

De aquí salieron cuatro superficies que afirmaban algo falso al leer NULL, y las cuatro se
corrigieron en código: la ficha de Risk 360 imprimía «Prob. 1 · Impacto 1», la rejilla apilaba
todo en la casilla de menor exposición, el trigger de sync registraba `'Bajo'` en `grc_risks`
—invisible desde la pantalla— y el editor prerrellenaba 3×3 y **al guardar lo persistía**.

## 3. Los 8 hallazgos son un recuento, no una muestra

Son las celdas naranja y rojo de las 1476 del mapa: 7 naranja + 1 rojo, todas en áreas de
negocio; los departamentos internos no alcanzan la banda alta. El único rojo del corpus es
**contrabando en el área Fiscal**.

**Si tras un reseed salen ≠ 8, cambió la fuente o se rompió el extractor.** No es un umbral
elegido ni un tamaño de demo: es el resultado de contar.

`findings.severity` queda NULL por la misma razón del punto 1: el CHECK solo admite cuatro
nombres castellanos y la escala de la fuente no tiene nombres.

## 4. ~~`action_plans` vacío es una ausencia con fuente~~ — DEROGADO en su parte decisoria

> **⚠️ Derogado el 2026-09-07 por el cambio de orden.** No se borra, por lo mismo que el §1: el
> orden en que se supo importa, y este apartado se citó como prohibición durante nueve días.
>
> - **Cae:** que el vacío de `action_plans` en Garrigues sea una decisión firme. Sembrar planes
>   de acción SIMULADOS y etiquetados como tales pasa a estar permitido, y lo sembrado tiene que
>   persistir. Un gate que exija `action_plans` vacío para Garrigues está midiendo la orden
>   vieja: hay uno así en `src/test/garrigues/hallazgos-planes.test.ts` («NO hay planes de acción
>   sembrados, y eso es el requisito», `expect(data).toEqual([])`), y otro declarado en
>   `src/test/garrigues/aislamiento-declarado.ts`. Se dejan anotados aquí porque son de otro
>   carril, no porque estén bien.
> - **Sigue en pie, y ahora importa MÁS:** el peligro del `DEFAULT` a ARGA de más abajo. Un
>   INSERT sin tenant explícito contamina ARGA, y ahora sí va a haber INSERTs.
> - **Sigue en pie:** que PPD-01 no publique la lista. Eso no prohíbe sembrar; determina que lo
>   que se siembre es **simulado** y hay que etiquetarlo, no trasladado literalmente de la fuente.
> - **Sigue en pie:** el aviso de `/grc/m/audit/action-plans`, reescrito para decir «todavía no
>   incorporados» en vez de «se decidió no sembrarlos». Está gateado por `plans.length === 0`, así
>   que desaparece solo con el primer plan; lo fija
>   `src/test/garrigues/plan-accion-siembra-progresiva.test.ts`.

> **Corrección 2026-08-30.** Este apartado citaba «PPD-01 §246» y «§350-356». **Esos apartados
> no existen.** El índice de PPD-01 va de «1. Introducción» a «10. Control de versiones» con
> subapartados decimales: el Plan de acción es el **4.2** y la supervisión el **8** (8.1-8.4).
> Los números de tres cifras eran **posiciones de párrafo del volcado de texto** que hice al
> diseñar G5, escritas con el signo de apartado. Lo cazó la lente adversarial del carril C3
> sobre el código; de ahí venían, porque el código las heredó de mi plan. **Una cita es la
> promesa de que alguien puede ir a mirarlo**, y con la posición de párrafo de un volcado que
> ya no existe no puede.


PPD-01 §4.2 «Plan de acción» describe el **mecanismo** —el Comité de Práctica Profesional «planteará, en su
caso» nuevas medidas— pero **no publica la lista resultante**. Y `action_plans.finding_id` es
NOT NULL: colgar algo de ahí exigiría fabricar antes el hallazgo del que colgarlo.

Lo que sí está literal es el **Plan de seguimiento** (PPD-01 §8 «Supervisión y seguimiento del programa», 8.1-8.4), con cuatro actividades
nombradas, y por eso entraron como controles `CTR-GARR-25…28` y no como planes.

**Peligro asociado:** `action_plans.tenant_id` se añadió después de la tabla
(`20260419173010_b1_rls_all_domain_tables.sql:238`) **con `DEFAULT '…0001'`, que es ARGA**. Un
INSERT sin tenant explícito contamina el tenant que el programa entero se compromete a no tocar.

## 5. NIS2 no es deber del despacho — y eso es el diseño, no una omisión

`obligaciones-ciber.ts:6-7` lo dice literal, las obligaciones llevan `prospectiva: true` y la
cita remata «Aplicabilidad sujeta a transposición en España». **No tocar eso.**

- Los servicios jurídicos tienen **0 ocurrencias** en los Anexos I y II de la Directiva
  (UE) 2022/2555, y el *chapeau* del art. 2.2 cierra las excepciones b)-e): presuponen
  pertenecer a un tipo de los anexos. El Anexo de la Directiva CER tampoco los lista.
- El sujeto es **EAD Trust, S.L.**: Anexo I sector 8, y **cualificado** —verificado contra la
  Trusted List española, secuencia 188 de 06/08/2026, NIF B85626240, 26 CA/QC + 11 TSA/QTST—,
  luego entidad **esencial** con independencia del tamaño (art. 3.1.b).
- **España no ha transpuesto.** El marco vigente es NIS1 (RDL 12/2018), que **excluye
  expresamente** a los prestadores de servicios de confianza no designados operadores críticos.
- El despacho puede quedar sujeto **por vía contractual** (art. 21.2.d, cadena de suministro),
  que obliga al cliente, no al proveedor.

**Si alguna vez hubiera que rebajar esencial → importante, cambia la CITA, no solo la
etiqueta:** el art. 3.1.b solo cubre a los cualificados; para un no cualificado el anclaje
pasa al art. 2.2.a.ii —que lo mete en ámbito sin criterio de tamaño, porque dice «prestadores
de servicios de confianza» **sin** el adjetivo— más el art. 3.2, que es el que clasifica. Y el
plazo de 24 h del art. 23.4 **no** dependería de esa respuesta: tampoco lleva el adjetivo.

## 6. La Trusted List sirve para negar, no para afirmar

Criterio de programa, nacido de aquí:

> La TSL es excelente para **negar** lo cualificado con fuente externa, y **no basta por sí
> sola para afirmar** una capacidad concreta del producto. Cada dirección necesita evidencia
> distinta.

- «Cero servicios `EDS/Q` y `PSES/Q`» sostiene *no puede afirmarse entrega ni preservación
  **cualificadas***. **No** sostiene «el proveedor no presta ninguna entrega»: un servicio no
  cualificado no aparece en la TSL. La formulación que aguanta es la negativa acotada.
- Los **26 CA/QC** son emisión de certificados cualificados a suscriptores y **no** habilitan a
  reclamar QES en este producto: el API que se usa topa en **ADVANCED**. Leer «CA/QC» como
  permiso para decir QES incumpliría la política vigente **por el camino de una fuente que
  parece dar la razón**.

---

## Apéndice — dos defectos de origen del plan de G5, ya corregidos

Se dejan escritos porque enseñan más que el código que los rodeaba.

1. **`describe.skip` sí ejecuta su callback.** El gate del mapa penal se salta por `existsSync`
   de dos PDF que están en `.gitignore` **por diseño**; pero el guard no protegía las llamadas
   a `extraerMapa` del cuerpo del `describe`, así que reventaba en cualquier entorno limpio.
   Corregido en `0f0e57a`.
2. **Un plan escrito por quien conoce el gotcha puede codificar el gotcha.** El plan quitaba a
   propósito el respaldo de la anon key, razonando que un fallback silencioso deja el gate
   verde sin asertar nada. Como `VITE_SUPABASE_ANON_KEY` **no existe en el `.env` de este repo**
   —define `ANON_PUBLIC`, `PUBLISHABLE_KEY`, `PROJECT_URL`, `SERVICE_ROLE_SECRET`—, la
   instrucción producía exactamente el resultado que quería evitar. Lo salvó que el ejecutor
   mirara qué hacían las otras 17 sondas antes de obedecer.

Y el corolario de método, con siete casos ya en este repo:

> Barrer una forma sintáctica y no su equivalente es el modo de fallo más barato de cometer y
> más caro de creerse. Cuando el barrido devuelve una ausencia, buscar la variante antes de
> reportarla: **una ausencia solo es dato si el control discriminante la respalda.**

`||` vs `??` · ruta literal vs template literal · `?? 3` vs ternario equivalente · `ead`
casando dentro de `readiness` · siglas como subcadena en `innerText` · un comentario que
documenta el arreglo confundido con el defecto · contar ocurrencias en vez de exposiciones.

**Saber la regla no protege de la regla.** Las tres veces que se cazó en esta ronda fue porque
otro fue a mirar, no porque el autor recordara el criterio.
