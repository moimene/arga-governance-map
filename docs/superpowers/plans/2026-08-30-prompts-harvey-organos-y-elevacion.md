# Dos prompts para Harvey — órganos de las filiales y cadena de elevación a público

- **Fecha:** 2026-08-30
- **Para qué:** desbloquear los **51 de 59 acuerdos** que hoy no tienen órgano al que apuntar,
  y dotar a Secretaría del rastro documental que hace que el módulo se lea como real.
- **Destino:** tenant Garrigues `00000000-0000-0000-0000-000000000002`.
- **Por qué Harvey y no un modelo generalista:** los dos encargos son de redacción jurídica
  societaria española. Lo que se pide no es inventar datos, es **redactar como redacta un
  despacho**: la certificación, la escritura y la diligencia registral tienen fórmulas fijas y
  un lector abogado detecta en dos líneas si el texto lo escribió alguien que ha visto una.

---

## Contexto común — va al principio de los DOS prompts

```
Eres un asistente jurídico especializado en derecho societario español. Trabajas para un
prototipo de gobernanza corporativa cuyo tenant de demostración reproduce la estructura del
Grupo Garrigues. Los datos que generes son SINTÉTICOS y así se etiquetan, pero deben ser
indistinguibles de los reales en su FORMA jurídica: fórmulas, estructura, terminología,
citas legales y lógica registral.

## La regla que gobierna todo

Sintético no es sinónimo de inventado a la ligera. Cambia dónde está la disciplina:

1. **La forma jurídica no se inventa: se reproduce.** Una certificación de acuerdos, una
   escritura de elevación a público y una instancia de depósito tienen estructura y fórmulas
   consolidadas. Úsalas. Si no estás seguro de una fórmula, dilo en `dudas` en vez de
   aproximarla.
2. **Los hechos sí son sintéticos, y van etiquetados.** Cada registro lleva
   `firmeza: "SINTETICO"` y `procedencia` con uno de estos valores:
   `DECLARADO_USUARIO` (consta en documento del despacho) · `INFERIDO_DE_ESTRUCTURA`
   (se deduce de la forma social o del organigrama real) · `SIMULADO` (inventado para la
   demo) · `DEMO_PILOTO` (criterio provisional pendiente de confirmación).
   **Un registro que no pueda declarar su procedencia no se genera.**
3. **Prohibido afirmar hechos registrales concretos que no consten.** No inventes números de
   protocolo notarial, ni nombres de notario, ni datos de inscripción (tomo, folio, hoja,
   inscripción) como si fueran reales. Si el campo hace falta para que el documento tenga
   forma, genera un valor y **márcalo `SIMULADO` en el propio registro**.
4. **Nombres de persona: de ficción**, salvo los cargos que constan públicamente en el
   Registro Mercantil, que se indican expresamente abajo.
5. Castellano de España, registro jurídico. Devuelve JSON válido, sin texto alrededor.

## La estructura real del grupo, que no puedes contradecir

- **Matriz: J&A Garrigues, S.L.P.** — CIF B81709081, hoja registral M-190538 del Registro
  Mercantil de Madrid. **Administrador único: Fernando Vives Ruiz**, mandato 2026-2032,
  inscripción I/A 960. Este dato SÍ es real y consta en el Registro: úsalo tal cual.
- **Junta de Socios de la matriz** con censo de **346 socios**, y **19 estructuras
  consultivas** (comités) que **NO adoptan acuerdos**: informan. El motor del producto las
  excluye de la adopción.
- **EAD Trust European Agency of Digital Trust, S.L.** — participada al 51,001 % a través de
  Compañía Digital NewLaw, S.L.U. Tiene **Consejo de Administración** (7 cargos) ya modelado.
- Las filiales profesionales son **SLP (Sociedad Limitada Profesional)**, regidas por la
  **Ley 2/2007 de sociedades profesionales** además de por la LSC. Las de inversión son SL.

## Restricción legal que se incumple con más frecuencia, y que aquí es descalificatoria

**Las cuentas anuales NO se elevan a público ni se inscriben: se DEPOSITAN.** El depósito se
practica presentando la certificación del acuerdo de aprobación junto con los documentos
contables, por vía telemática o en soporte, **sin escritura y sin intervención de notario**
(arts. 279 y ss. LSC y arts. 365 y ss. RRM).

La **elevación a público** en escritura ante notario y la posterior **inscripción** operan
sobre actos distintos: nombramientos y ceses de administradores, otorgamientos y revocaciones
de poder, modificaciones estatutarias, operaciones sobre el capital y estructurales.

Si un solo documento generado eleva a público unas cuentas anuales, el entregable entero
queda invalidado.
```

---

## Prompt 1 — Órganos de administración y juntas de las filiales

```
[PEGAR AQUÍ EL CONTEXTO COMÚN]

## El problema concreto que vienes a resolver

El tenant modela hoy los órganos de **dos** entidades: la matriz (Junta de Socios,
Administrador Único y sus 19 estructuras consultivas) y EAD Trust (su Consejo de
Administración). Nada más.

Pero hay **59 acuerdos societarios** generados para **12 entidades**, y **51 de ellos no
tienen órgano al que apuntar**, porque las otras diez sociedades no tienen ningún órgano
modelado y EAD Trust tiene su Consejo pero **no su Junta General**, pese a que se le
atribuyen tres aprobaciones de cuentas por junta.

## Qué tienes que generar

Los órganos que faltan, para estas once entidades:

| Entidad | Forma | Órganos que faltan |
|---|---|---|
| Compañía Digital NewLaw, S.L.U. | SLU | Órgano de administración + Socio único |
| G-Advisory, Consultoría Técnica, Económica y Estratégica, S.L.P. | SLP | Órgano de administración + Junta general |
| Garrigues IP, S.L.P. | SLP | Órgano de administración + Socio único |
| Garrigues Letrados de Soporte, S.L.P. | SLP | Órgano de administración + Socio único |
| Garrigues Human Capital Services, S.L.P. | SLP | Órgano de administración + Socio único |
| Garrigues Consultoría de Empresa Familiar, S.L.P. | SLP | Órgano de administración + Socio único |
| Garrigues Portugal, S.L.P. | SLP | Órgano de administración + Junta general |
| Violet Inversiones 2010, S.L. | SL | Órgano de administración + Junta general |
| EWOH Inversiones 2010, S.L. | SL | Órgano de administración + Junta general |
| Garmen Inversiones 2013, S.L. | SL | Órgano de administración + Junta general |
| EAD Trust European Agency of Digital Trust, S.L. | SL | **Solo la Junta general** (su Consejo ya existe) |

## Las decisiones jurídicas que tienes que tomar, y razonar

1. **Sociedad unipersonal o pluripersonal.** Donde la tabla dice «Socio único», la sociedad es
   unipersonal y **no hay junta general: decide el socio único** consignando sus decisiones en
   acta (art. 15 LSC). Donde dice «Junta general», hay pluralidad. **No los mezcles**: es el
   error más visible del entregable anterior, donde se invocó socio único apoyándose en que la
   matriz era administrador único, que es cosa distinta.
2. **Estructura del órgano de administración.** Para cada sociedad decide entre administrador
   único, varios solidarios, varios mancomunados o consejo, **y razona por qué** en función de
   su tamaño y objeto. Una sociedad instrumental de inversión y una SLP con actividad
   profesional no se administran igual. Evita que las once sean idénticas: un grupo real no lo es.
3. **Las SLP tienen restricción subjetiva.** La Ley 2/2007 exige que la mayoría del capital y
   de los derechos de voto, y la mayoría de los miembros del órgano de administración, sean
   socios profesionales. Refléjalo en la composición y **cítalo**.
4. **Garrigues Portugal, S.L.P.** figura como SLP española pese al nombre. Si consideras que
   eso plantea un problema de forma o de jurisdicción, **dilo en `dudas`**: no lo resuelvas por
   tu cuenta ni cambies su forma social.

## Formato de salida

JSON con la clave `organos`, y cada elemento con:

- `entidad_slug` y `denominacion` exactos de la tabla de arriba.
- `slug`: **con el prefijo del tenant**, en la forma `garrigues-<identificador>`. Es el
  identificador real de `governing_bodies` y sin el prefijo el órgano queda huérfano.
- `nombre`: la denominación del órgano como la escribiría el despacho.
- `body_type`: uno de `JUNTA` · `CDA` · `ADMIN_UNICO` · `ADMIN_SOLIDARIO` ·
  `ADMIN_MANCOMUNADO` · `SOCIO_UNICO`.
- `naturaleza`: `DECISORIO` en todos. Estos órganos adoptan; los comités de la matriz no.
- `composicion`: array de cargos con su denominación, y `es_socio_profesional` booleano en las SLP.
- `fundamento_legal`: los preceptos concretos que sostienen esa estructura.
- `razonamiento`: dos o tres frases sobre por qué ese órgano y no otro.
- `firmeza`, `procedencia`, `ancla`.

Cierra con `dudas`: todo lo que no hayas podido resolver sin preguntar al despacho.

## Cómo se te va a evaluar

Se comprobará que ninguna sociedad unipersonal tiene junta general, que ninguna pluripersonal
decide por socio único, que las SLP respetan la restricción de la Ley 2/2007, que los slugs
llevan prefijo, y que las once estructuras no son la misma copiada once veces.
```

---

## Prompt 2 — La cadena documental: certificación, elevación a público e inscripción

```
[PEGAR AQUÍ EL CONTEXTO COMÚN]

## Qué vienes a resolver

El módulo de Secretaría tiene los acuerdos pero **no el rastro documental que los convierte en
eficaces frente a terceros**. Un acuerdo sin su certificación, sin su escritura y sin su
asiento registral es una fila en una base de datos; con ellos es un expediente.

El ciclo que el producto modela es:

`DRAFT → PROPOSED → ADOPTED → CERTIFIED → INSTRUMENTED → FILED → REGISTERED → PUBLISHED`

Tú generas los artefactos de los cuatro últimos tramos.

## Los tres documentos, y qué los distingue

**1. CERTIFICACIÓN DEL ACUERDO.** La expide quien tiene facultad certificante (art. 109 RRM).
Contiene la identificación de la sociedad y del órgano, la fecha y lugar de la sesión o de la
decisión, la forma de convocatoria o su carácter universal, el quórum y la mayoría alcanzada,
la transcripción literal del acuerdo y la fecha de aprobación del acta.

**Regla que el producto ya implementa y no puedes contradecir:** cuando certifica el
**administrador único**, la certificación **no lleva visto bueno** — el visto bueno del
presidente solo existe cuando quien certifica es el secretario de un órgano colegiado.

**2. ESCRITURA DE ELEVACIÓN A PÚBLICO.** Comparecencia del otorgante y su título; exposición
con la identificación de la sociedad y del acuerdo que se eleva; el otorgamiento propiamente
dicho; la incorporación de la certificación; y las reservas y advertencias legales.

**Solo para actos que la requieren.** No todos: repasa la restricción del contexto común.

**3. ASIENTO REGISTRAL.** Presentación en el Diario, calificación y, según el resultado,
inscripción practicada o **nota de calificación con defectos**. Si hay defecto, hay
subsanación y nueva presentación.

## Qué tienes que generar

Sobre los 59 acuerdos ya existentes —que recibirás como entrada—, **la cadena que a cada uno
le corresponda según su naturaleza**, no la misma para todos. Ese es el núcleo del encargo:

- **Aprobación de cuentas anuales:** certificación **+ depósito**. Nunca escritura.
- **Formulación de cuentas:** no genera cadena externa; agota su efecto en el órgano de
  administración y en el libro de actas.
- **Otorgamiento y revocación de poderes:** certificación cuando proceda + **escritura** +
  inscripción.
- **Nombramiento y cese de administradores:** certificación con firma legitimada o escritura +
  inscripción, dentro del plazo del art. 142 RRM.

## Lo que hará bueno este entregable

- **Que los plazos se computen bien.** Los del art. 279 LSC para el depósito, los del art. 142
  RRM para el nombramiento, y el de vigencia del asiento de presentación. Cómputo de fecha a
  fecha (art. 5.1 CC), no por bloques de treinta días.
- **Que al menos dos expedientes tengan defecto y subsanación.** Un registro donde todo se
  inscribe a la primera no se parece a ninguno real. Usa defectos verosímiles: falta de
  legitimación de firma, cargo no vigente en el momento de certificar, discordancia entre la
  certificación y el acuerdo, o falta de depósito de cuentas del ejercicio anterior — que es
  el cierre registral del art. 282 LSC y es el defecto más frecuente de verdad.
- **Que el texto de cada documento esté completo**, no resumido. La certificación con sus
  fórmulas, la escritura con su comparecencia y su otorgamiento. Es lo que se va a leer en
  pantalla.
- **Que la firma y el sellado sean honestos.** El grupo tiene un prestador cualificado de
  servicios de confianza, pero en este prototipo **no se afirma firma cualificada de ninguna
  persona**. Modela el artefacto y su custodia; **no atribuyas una firma electrónica
  cualificada a nadie**, y si el documento la exigiría en la realidad, dilo en el propio
  registro en vez de simularla.

## Formato de salida

JSON con `certificaciones`, `escrituras`, `asientos_registrales` y `depositos_cuentas`. Cada
elemento referencia su `agreement_id` de origen y lleva:

- `tipo`, `fecha`, `otorgante_o_certificante` con su cargo y el fundamento de su facultad.
- `texto`: el documento completo, en castellano jurídico.
- `datos_instrumentales`: protocolo, notario, datos de inscripción — **cada uno con su marca
  de `SIMULADO`**, porque son los campos donde más fácil es afirmar algo que no consta.
- `plazo`: el precepto aplicable, la fecha límite computada y los días de margen.
- `estado_resultante` del acuerdo en el ciclo de arriba.
- `firmeza`, `procedencia`, `ancla`.

Y una clave `cadenas`, con la secuencia completa de cada acuerdo, para que se pueda comprobar
de un vistazo que ningún acuerdo tiene escritura sin certificación previa ni inscripción sin
escritura cuando esta era necesaria.

Cierra con `dudas`.

## Cómo se te va a evaluar

Se comprobará que **ninguna cuenta anual se ha elevado a público**, que ninguna certificación
de administrador único lleva visto bueno, que las fechas de cada cadena se ordenan solas, que
los plazos están computados de fecha a fecha, y que ningún documento atribuye una firma
cualificada a una persona.
```

---

## Nota de uso

**Orden:** primero el prompt 1. Sin órganos, los documentos del prompt 2 no tienen quién los
certifique ni quién los otorgue.

**Qué revisar a mano antes de sembrar**, que es donde un modelo se resbala aunque sea bueno:
la coherencia unipersonal / pluripersonal en las once sociedades, que ninguna cuenta anual
haya acabado en escritura, y los cómputos de plazo. El resto admite revisión ligera.

**Lo que sigue sin resolverse y no lo resuelve Harvey:** cómo representa Secretaría el rastro
de una elevación a un **órgano consultivo** —informe o acta, nunca acuerdo adoptado—. Es
distinto de la elevación a público y sigue siendo una decisión de modelado del producto.
