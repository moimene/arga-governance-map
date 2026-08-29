# Task 6 — informe de cierre

**Estado: COMPLETA con 9 de 10 acuerdos.** El décimo (`MODIFICACION_ESTATUTOS`, punto 1.1) queda
bloqueado por el art. 36, que **no existe** en los Estatutos entregados.

## Cloud

```
GOAL: meetings=1  agreements=9  convocatorias=1  censo=1  attendees=346
PACK POR MATERIA (los 9, ninguno cae en GARR_JUNTA_SOCIOS):
  ADMISION_SOCIO_CUOTA → ADMISION_SOCIO_CUOTA
  APROBACION_CUENTAS → GARR_APROBACION_CUENTAS
  CONTINUIDAD_SOCIO_POST_60 → CONTINUIDAD_SOCIO_POST_60
  DELEGACION_FACULTADES → GARR_DELEGACION_FACULTADES
  EXCLUSION_SOCIO_ESTATUTARIA → EXCLUSION_SOCIO_ESTATUTARIA
  INTEGRACION_DESPACHO_AUMENTO_SIN_PREFERENCIA → (su pack homónimo)
  NOMBRAMIENTO_ADMINISTRADOR_UNICO → NOMBRAMIENTO_ADMINISTRADOR_UNICO
  NOMBRAMIENTO_AUDITOR → GARR_NOMBRAMIENTO_AUDITOR
  RETRIBUCION_PRESTACIONES_ACCESORIAS → RETRIBUCION_PRESTACIONES_ACCESORIAS

GATE preceptivo dispara en 4: ADMISION, CONTINUIDAD, EXCLUSION, NOMBRAMIENTO_ADMINISTRADOR_UNICO
CONTROL DISCRIMINANTE: acuerdos SIN gate = 5      ← sin esto, «el gate funciona» solo diría «se pinta siempre»
RESIDUO ARGA: packs=59  agreements=46             ← intacta
MODIFICACION_ESTATUTOS en Garrigues: packs=0 acuerdos=0   ← el bloqueo es real, no una omisión
```

Migración `20260829170000` aplicada y registrada, verificada leyendo la fila por su `name`.
Sonda: **42 pass / 0 fail**. `lint` 0, `typecheck` 0.

## La mayoría: art. 30.1, no la supletoria

Los 3 packs nuevos citan **`art. 30.1 de los Estatutos`** con `fuente: "ESTATUTOS"`, con el literal en la
referencia y la base de cómputo escrita: **mayoría de los votos correspondientes a las participaciones
en que se divide el capital social** — no de los votos emitidos, no del capital presente. **No es el art.
198 LSC**, y citarlo habría atribuido a la ley lo que dicen los Estatutos, además con otra base.

El bloque `DO $assert$` de la migración lo asierta: la referencia contiene `30.1` y **falla si contiene
`LSC`**. Más un control discriminante de que los 3 packs homónimos siguen bajo ARGA — sin él, si la
migración los hubiera movido de tenant, la aserción principal habría pasado igual con el aislamiento
roto.

## Dos errores del plan que la implementación cazó

1. **`agenda_item_id` no es el número del punto.** Es `uuid` con FK a `agenda_items(id)`. Lo del plan
   no habría entrado.
2. **El plan no mencionaba `agenda_items`, y son obligatorios.** El trigger `agreement_requires_decisorio`
   rechaza todo `agreements` con `parent_meeting_id` que no resuelva un `agenda_items` de esa reunión con
   `kind='DECISORIO'`.

**La arista real, cableada:** `agenda_items.order_number` = ordinal 1-based del punto en `ORDEN_DEL_DIA`
→ `agreements.agenda_item_id` (uuid, FK). Los 9 quedan en los ordinales **2, 3, 4, 5, 7, 8, 11, 12, 13**,
**con huecos y sin renumerar**, para que el ordinal siga apuntando al mismo elemento del array de la
convocatoria. El `"1.2"` del certificado no cabe en un `integer` y vive en `agenda_items.description`.
`source_convocatoria_*` queda a NULL: su guard exige convocatoria `EMITIDA` e inmutable, y la nuestra
está en `BORRADOR` porque la plataforma no sabe emitir Juntas.

## Decisiones que no se tomaron por no inventar

- **`required_majority_code` queda NULL a propósito.** Su vocabulario es la escalera
  `SIMPLE < REFORZADA_2_3 < UNANIMIDAD`, y **ninguno expresa la base del art. 30.1**. Escribir `SIMPLE`
  afirmaría otra regla. La mayoría vive en el rule pack. **La columna del modelo no sabe expresar esta
  mayoría: es brecha de producto, no dato que falte.**
- **El plazo de inscripción de las 2 materias inscribibles no se fija.** `materia_catalog` dice 10 días
  sin cita y los packs SLP hermanos dicen 30 (art. 83 RRM). Elegir habría sido inventar: el pack lo
  declara `NO_COTEJADO` con la discrepancia escrita.
- **`constitucion` y `convocatoria` se heredan verbatim de G3**, con su cita del art. 198 LSC en el
  quórum. El literal del art. 30.1 cubre la **mayoría**, no el quórum de constitución.
- **El punto 12 se modela diciendo lo que es:** el `decision_text` cita el **art. 31.3** y dice que con
  Administrador Único que además certifica **la delegación no es necesaria** para elevar a público. El
  acuerdo existió; es de cobertura.
- **`ACREDITADO` vs `INFERIDO` sobre el contenido, no la redacción.** Ningún literal del certificado obra
  en el repo, así que los 9 textos son reconstrucción y lo dicen. Los 5 `INFERIDO` no identifican a nadie,
  verificado en la sonda contra los 346+ nombres del tenant.

## Anotado

- **`agenda_items.tenant_id` tiene DEFAULT el tenant de ARGA**, igual que `meeting_attendees`. Segunda
  tabla con la misma mina.
- **`rule_pack_versions` sin RLS por tenant** obligó a que sonda y seed vayan por join `!inner` contra
  `rule_packs`: el test que proponía el plan habría leído también las filas de ARGA.
- **Los 6 packs SLP de G3 declaran `fuente: "LEY"` con referencia estatutaria** (p. ej.
  `LEY · art. 30.2.a) Estatutos`). Incoherente y anterior a C1; los 3 nuevos usan `ESTATUTOS`.
- **`agreement_document_requirements` tiene 0 filas en ARGA**: una aserción cross-tenant sobre esa tabla
  pasaría en vacío, así que no se escribió. El aislamiento se prueba sobre `agreements` (46 en ARGA).

## Desviación de proceso, declarada

**Task 6 se cierra sin ronda adversarial separada**, por instrucción del orquestador de cerrar y parar
para que C3 arregle el gate de tipos. Lo que la sustituye: los controles discriminantes de arriba
—ejecutados por el controller contra Cloud— y el hecho de que la propia implementación cazó los dos
errores del plan y se negó a rellenar tres huecos. **No es equivalente y no se presenta como tal.**
