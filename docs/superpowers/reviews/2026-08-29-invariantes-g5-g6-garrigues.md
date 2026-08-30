# Invariantes de diseño de G5 y G6 — lo que no se puede «arreglar»

- **Fecha:** 2026-08-29
- **Origen:** la conversación que diseñó G5 y G6, a petición de la orquestación del programa
- **Para qué:** G5 y G6 se cerraron **sin ledger SDD**. El código está en git; el porqué no
  estaba en ninguna parte. Esto es el porqué.

Cada punto describe algo que **parece un defecto y no lo es**. Todos han estado a punto de
ser «corregidos» al menos una vez, y corregirlos destruiría dato correcto.

> **El §1 está SUPERADO** desde el 2026-08-29 por una fuente que apareció después. Se deja
> escrito con su refutación en vez de borrarlo. Un invariante desmentido que se queda escrito
> como invariante es peor que no tenerlo: se lee como comprobado y el siguiente lector ya no
> vuelve a mirar.

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

Los 82 riesgos penales los tienen vacíos, y hay un CHECK (`risks_banda_sin_ejes_check`) que
impide rellenarlos cuando existe `assessed_band`.

La fuente da **un nivel compuesto por celda** y no lo descompone en probabilidad × impacto.
**Rellenarlos es fabricar dato, no completarlo.** El CHECK es la red; la razón es esta.

**Matiz añadido el 2026-08-29, y es el que impide que el hallazgo del §1 se convierta en
barra libre.** La plantilla revela que la metodología del despacho **sí descompone**: P1
frecuencia de exposición (habitual 5 / ocasional 2,5 / remoto 1) × P2 sujetos activos (solo
Socio 1 → Staff y superior 2), máximo bruto 10, normalizado a 0-1 con cortes en 0,8 / 0,6 /
0,4 / 0,2, cruzado contra impacto en la matriz de `Config.`.

Eso **no cambia este invariante**. La plantilla acredita la **leyenda**, no los **ejes de cada
riesgo concreto**: el PDF evaluado sigue publicando únicamente el color final, y de ahí no se
pueden derivar la P y la I de cada celda. Dejarlos en NULL sigue siendo lo correcto. Solo si
llegan las **plantillas rellenas** habrá P e I reales, y **entonces** —no antes— se revisa el
CHECK `risks_banda_sin_ejes_check`.

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

## 4. `action_plans` vacío es una ausencia con fuente

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
