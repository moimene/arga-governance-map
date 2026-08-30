# Verificación viva — 2026-08-30, ventana concedida por el orquestador

Login real `demo@garrigues-demo.dev` en `/login?tenant=garrigues`, servidor del **worktree** (no del árbol
compartido, que está en manos de otra sesión). Shell verde, «GARRIGUES GOBERNANZA», scope
«Grupo Garrigues (Global)».

## Gate completo — una sola corrida, en la ventana

```
3721 pass · 152 skip · 0 fail · 21.089 expects · 3873 tests
lint 0 · typecheck 0
```

## Lo que estaba declarado pendiente, ahora hecho

**El aviso «Evaluación no sellada en servidor» se ve**, en la tarjeta «Validación normativa», encima de
las filas de resultado. Literal en pantalla:

> Esta evaluación la calculó el motor de reglas en el cliente. Es un cálculo de apoyo a la revisión, no
> un resultado autoritativo: no está sellado ni es oponible.
> La vía sellada en servidor (`fn_secretaria_server_resolution_evaluation`) no admite este órgano:
> evalúa CDA, COMISION y COMITE, exige un censo POLITICO WORM y que cada asiento pese exactamente 1.
> Esta Junta son 346 socios ponderados por títulos × votos por título sobre un censo ECONOMICO…

Nombra la función **real** —la que yo llevaba dos días citando mal— y los **tres** muros.

## La arista registral, con control discriminante de tres vías

| Acuerdo | Inscribible | Bloque registral en pantalla |
|---|---|---|
| `ADMISION_SOCIO_CUOTA` | Sí | «Ver expediente registral · **Inscrita**» |
| `EXCLUSION_SOCIO_ESTATUTARIA` | Sí | «Ver expediente registral · **Preparada**» |
| `APROBACION_CUENTAS` | **No** | **AUSENTE** |

**Las tres se ven distintas.** Es la justificación de Task 9 comprobada en pantalla: sin las filas
`PREPARADA`, el segundo caso se vería como el tercero — un acuerdo inscribible pendiente de inscripción
sería indistinguible de uno que no se inscribe nunca.

## El gate del informe preceptivo, visible y bloqueante

En la ficha de la admisión:

> **Informe preceptivo — Consejo de Socios** · OBLIGATORIO · BLOCKING · art. 39.5.b Estatutos: el Consejo
> de Socios informa preceptivamente a la Junta de Socios antes de que ésta decida; el informe debe
> acompañar a la convocatoria…

Y la mayoría del pack: **«Base estatutaria: art. 30.3.b) Estatutos (80% de los votos)»**. En la exclusión:
**«arts. 30.2.g) Estatutos y 15 Ley 2/2007 (doble mayoría)»**.

## Lo que encontré mirando, y que estuve a punto de reportar mal

La fila de la evaluación de la exclusión, **plegada**, muestra solo `MAYORIA_JUNTA_2026_PUNTO_2` y
`WARNING`. Iba a reportarlo como que el motivo no se enseña. **La desplegué antes de decirlo** y el
`explain` completo está ahí, plano y legible:

```
veredicto: NO EVALUADO por el motor
formula: favor >= 2/3_votos_totales + mayoria_socios_profesionales
escenario: MAXIMO_ALCANZABLE — … el TECHO que la concurrencia permite, no el escrutinio…
adopcion: La adopción está certificada por el acta … Esta evaluación NO la decide.
base_votos: 16900
```

**No es defecto:** la fila es plegable por diseño y es el mismo comportamiento que tienen las de ARGA. Y
la decisión de Task 7 de mantener el `explain` **plano** se nota aquí: `RuleValidationRow` renderiza con
`String(value)`, así que un objeto anidado habría salido como `[object Object]` — como ya les pasa a las
8 filas de ARGA.

**Observación de UX, no defecto:** plegada, un `WARNING` que significa «no se pudo evaluar» se ve igual
que uno que significa «se evaluó y algo no cuadra». Es diseño pre-existente, no algo que Task 7
introdujera, pero en una materia con doble mayoría la diferencia importa.

## Otras dos cosas vistas de paso

- **«Mayoría exigida —»** en el bloque de adopción: es el `required_majority_code` NULL, deliberado. La
  mayoría real aparece dos líneas más abajo como «Base estatutaria». Coherente, pero un lector rápido ve
  un guion donde hay una regla.
- El dashboard dice **«7 acuerdos pendientes y 0 convocatorias emitidas»**: consistente con la
  convocatoria en `BORRADOR`, que es lo que la plataforma no sabe emitir para una Junta.
