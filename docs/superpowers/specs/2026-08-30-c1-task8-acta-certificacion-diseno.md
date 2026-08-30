# Task 8 — Acta y certificación de la Junta de Socios: diseño previo

**Estado:** diseño para decisión. **No escrito ni un renglón de código.**
**Medido en `governance_OS` el 2026-08-30**, no inferido de la memoria del carril.

---

## 1. La corrección de partida: no son tres muros, son treinta y tres

Llevo dos días citando «los tres muros de `fn_generar_acta`». Al ir a leer la
función, **`fn_generar_acta` no tiene ningún muro CDA-only**: comprueba que la
reunión existe, el tenant, el rol (`SECRETARIO`/`ADMIN_TENANT`, saltado para
`service_role`) y delega todo lo demás.

Los muros están en `fn_secretaria_build_minute_legal_manifest`, y son **33
`RAISE EXCEPTION`**. Recorren desde «la reunión debe estar CELEBRADA» hasta «una
resolución difiere de la evaluación de censo/voto del servidor».

## 2. El muro que decide, y que es deliberado

No es un efecto colateral de un modelo pensado para consejos. Es una puerta
cerrada **a propósito, con su comentario delante**:

```sql
-- The present prototype can issue authoritative minutes for a political
-- collegial census (CdA). Economic/Junta and universal sessions remain
-- explicitly closed until their individual capital/acceptance evidence is
-- persisted; client booleans are never a substitute for that evidence.
IF v_is_junta THEN
  RAISE EXCEPTION 'authoritative minute: economic Junta quorum requires
                   the dedicated capital evaluator before legal finalization';
END IF;
```

`v_is_junta` se deriva de `body_type LIKE '%JUNTA%'`. Nuestro órgano **es** una
Junta de Socios. **Toda Junta, de cualquier tenant, está fuera.** Y el mensaje
nombra lo que falta: *the dedicated capital evaluator*.

Detrás vienen, para el mismo caso, `snapshot_type <> 'POLITICO'` (el nuestro es
`ECONOMICO`, que es lo correcto para una Junta: se vota por participaciones, no
por asientos) y la exigencia de que la asistencia **cubra cada asiento** del
censo político. El modelo entero del manifiesto es el de un órgano colegiado de
asiento único.

## 3. Estado medido del expediente frente a esos muros

| Muro | Nuestro dato | ¿Pasa? |
|---|---|---|
| Reunión `CELEBRADA` | `DRAFT` | ✗ |
| Presidente y secretario atribuidos | ambos presentes | ✓ |
| Convocatoria emitida, inmutable y completa | `BORRADOR` (`fn_emit_convocatoria` rechaza JUNTA) | ✗ |
| No es Junta | **es Junta** | ✗ **irreducible** |
| Censo `POLITICO` | `ECONOMICO` | ✗ **y debe seguir siéndolo** |
| Un acuerdo por punto decisorio | 10 y 10 | ✓ |
| Constancia en cada punto no decisorio | `agenda_items` = 10, no las 4 constancias | ✗ |
| Resolución concuerda con la evaluación del servidor | `fn_secretaria_server_resolution_evaluation` rechaza JUNTA | ✗ |

Cloud hoy: **0 actas y 0 certificaciones** en Garrigues; ARGA tiene 12 actas.

## 4. La certificación cae por la misma puerta

`fn_generar_certificacion` exige un `p_minute_id`. Y la variante sin sesión
**no es una alternativa: es un rechazo puro**, sin cuerpo:

```sql
CREATE FUNCTION fn_generar_certificacion_acuerdo_sin_sesion(...)
BEGIN
  RAISE EXCEPTION 'authoritative legal gate: certification currently requires
    an approved, signed and posted minute; no-session certification remains
    non-legal simulation' USING ERRCODE = '42501';
END;
```

Sin acta no hay certificación, y no hay segunda puerta.

## 5. Las opciones, con la que se rechaza dicha en voz alta

**A — Escribir el evaluador de capital que el código nombra.** Es la vía
legítima. Toca un gate del manifiesto ⇒ **paro y escalo**, por criterio expreso.
Además colisiona de frente con la decisión de hoy: el evaluador tendría que
computar quórum y mayoría **sobre censo** para una Junta, que es exactamente el
P0-2 que el usuario acaba de acotar a SLP dejando ARGA intacta. No es una tarea
de un día ni de un carril.

**B — Sembrar un censo `POLITICO` y pasar la Junta por colegiada.** Afirmaría un
voto por cabeza en un órgano que vota por participaciones, con 346 asientos de
peso 1. **Es falso en Derecho.** Rechazada.

**C — Declararla universal.** También cerrada por el manifiesto, y **falsa**:
hubo convocatoria formal con 15 días de antelación (arts. 27.3/27.4 Estatutos).
Rechazada.

**D — Forzar la inserción.** `minutes` solo admite INSERT si la sesión trae
`app.secretaria_authoritative_rpc = '1'`, que únicamente pone la RPC gobernada.
Un `service_role` **podría** llamar a `set_config` y luego insertar. Eso es
**fabricar evidencia jurídica autoritativa saltándose su guardia**.
**Rechazada, y queda escrita aquí como rechazada** para que nadie la reproponga
como atajo dentro de tres semanas.

## 6. La cuarta vía que propongo

El acta del 6 de mayo de 2026 **existe**, y el expediente ya la tiene — no como
documento, sino **por su huella registral**: es lo que sostiene el asiento
I/A 960 del BORME 338618/2026 que la Task 9 sembró como `INSCRITA`. Una
inscripción registral de un acuerdo social es, precisamente, la consecuencia de
una certificación de un acta.

Propuesta: **el expediente muestra el acta y la certificación como acreditadas
por su huella registral, y dice que la plataforma no las ha generado.** Misma
doctrina que el resto del carril —se afirma lo que la fuente dice y se etiqueta
la procedencia—, aplicada a los dos eslabones que faltan.

Concretamente:

1. Un bloque en la ficha del acuerdo y en el paso de cierre de la reunión que
   diga, con el asiento delante: *acta de 06/05/2026 y certificación
   acreditadas por el asiento I/A 960 (BORME 338618/2026); la plataforma no
   emite acta autoritativa para una Junta de Socios, y explica por qué*.
2. **Cero escrituras en `minutes` y en `certifications`.** El contador sigue en
   0/0, que es la verdad.
3. Un test que **falle si alguien mete una fila** en cualquiera de las dos para
   este tenant: hoy es 0 por imposibilidad técnica; mañana, si alguien abre la
   puerta, tiene que ser una decisión consciente y no un efecto colateral.

Ventajas: no toca ningún gate, no fabrica nada, cierra visualmente la cadena del
GOAL y **deja el hueco a la vista con su motivo**, que para un despacho vale más
que un acta de mentira.

Límite que hay que decir sin adornos: **esto no es «la Task 8 hecha»**. El
sistema sigue sin poder emitir el acta de una Junta. La cadena queda completa
como *expediente*, no como *capacidad*. Si lo que se quiere es la capacidad, es
la opción A y hay que decidirla arriba.

## 7. Lo que hace falta decidir

1. ¿Cuarta vía (acreditación con el hueco declarado) o se escala la opción A?
2. Si es la cuarta vía: ¿el bloque se pinta también en el paso 6 del stepper de
   la reunión, o solo en la ficha del acuerdo?
3. La reunión sigue en `DRAFT`. Abrirla no acerca el acta —el muro de Junta no
   depende del estado— y `CELEBRADA` sin acta sería otra afirmación sin
   respaldo. **Propongo dejarla en `DRAFT`** y decir por qué en pantalla.
