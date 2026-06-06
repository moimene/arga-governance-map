# Plan de cierre de gaps del motor de reglas de Secretaria 360

Fecha: 2026-05-20  
Origen: informe de cierre de gaps recibido tras revision legal  
Ambito: motor de reglas, rule packs, Matter Registry, MatterExecutionProfile, plantillas y formal gates  
Estado: plan de desbloqueo parcial. Habilita trabajo read-only y preparatorio; no habilita aun cambios funcionales bloqueantes.

---

## 1. Resumen ejecutivo

El estado de base del motor es solido en seleccion documental y perfilado estatico:

| Componente | Commit referido | Estado |
|---|---:|---|
| Matter Registry, selector documental | `4b4c866` | Estable, operativo |
| MatterExecutionProfile, modulo puro con 5 funciones y tests | `08eb9b6` | Implementado, tests pasan |
| Dossier de revision legal expandido | `ac15b77` | Listo para envio a Garrigues |

Persisten gaps en cuatro frentes:

- evaluacion formal dinamica;
- criterio de severidad y absorcion;
- duplicados de rule packs activos;
- diferenciacion de mayorias en SL.

La recomendacion es ejecutar primero saneamiento legal read-only y correccion core, antes de ampliar UX o conectar flujos.

---

## 2. Decisiones P1-P10 solicitadas a Legal/Garrigues

Estas decisiones evitan que el codigo fije doctrina por defecto. Deben resolverse como regla general y, cuando proceda, con excepciones por materia.

| Item | Regla general propuesta | Excepciones por materia | Articulo o referencia | Observaciones |
|---|---|---|---|---|
| Plazo de convocatoria del CdA | `[Completar]` | `[Completar]` | `[Completar]` | Homologar presencial/telematico; canales minimos |
| Segunda convocatoria en SL | `[Completar]` | `[Completar]` | `[Completar]` | Si estatutos permiten segunda convocatoria; plazos |
| Severidad de prerequisitos | `[Completar]` | `[Completar]` | `[Completar]` | Clasificar como `BLOCKING`, `WARNING` o `INFO` |
| Cooptacion, solo SA | Confirmar solo SA | Trato de intento en SL | art. 244 LSC | Gap tipico: rechazar y redirigir a JG |
| Operaciones vinculadas no cotizadas | `[Completar]` | `[Completar]` | `[Completar]` | Abstenciones y computo de mayorias |
| Comunicacion regulatoria | `[Completar]` | `[Completar]` | `[Completar]` | CNMV, BORME u otros si aplica |
| Mayoria SL, art. 199 LSC | `[Completar]` | Materias reforzadas | arts. 198 y 199 LSC | Diferenciar un tercio frente a mas de la mitad |
| Duracion auditor, 3-9 anos | Confirmar rango | Excepciones | art. 264 LSC | Tratamiento de propuestas fuera de rango |
| Derecho de informacion | `[Completar]` | Materias estatutarias | art. 287 LSC | Medios y antelacion |
| BORME y publicaciones | `[Completar]` | `[Completar]` | `[Completar]` | Cuando es requisito habilitante para inscripcion |

---

## 3. Severidad y absorcion de riesgos

Esta tabla es el insumo directo para `evaluateFormalGate`. Sin validacion legal no debe implementarse logica bloqueante en runtime.

| Incumplimiento | Severidad principal | Regla de absorcion | Consecuencia operativa recomendada |
|---|---|---|---|
| Falta quorum | `NULIDAD` | `NULIDAD` absorbe el resto | Bloqueo sin override, mensaje explicativo y accion correctora |
| Falta mayoria | `IMPUGNABILIDAD` | Absorbe `CALIFICACION_REGISTRAL` | Bloqueo sin override; ajustar recuento o repetir votacion |
| Falta convocatoria suficiente | `IMPUGNABILIDAD` | Si deviene en nulidad por materia, aplicar `NULIDAD` | Bloqueo sin override; reconvocar conforme a plazos y canales |
| Falta documento obligatorio | `CALIFICACION_REGISTRAL` | Absorbe `TRAZABILIDAD_PARCIAL` | Bloqueo en materias inscribibles; advertencia en no inscribibles |
| Falta prerequisito | `BLOCKING` segun P1-P10 | Ajustar por materia | Bloqueo o warning trazable segun severidad fijada |
| Falta plantilla | `TRAZABILIDAD_PARCIAL` | No absorbe nada | Permitir avance solo con plantilla sustitutiva aprobada o detener |

Nota de metodo: bloqueo sin override significa que la UI no ofrece campo de justificacion, solo instruccion correctiva. Debe limitarse a supuestos tasados, por ejemplo auditor por 2 anos o cooptacion en SL.

---

## 4. Duplicados de rule packs a resolver

Existen duplicados activos por materia y organo que impiden un selector determinista. Para cada caso Legal debe decidir conservar, archivar o fusionar, y que valores prevalecen.

| Materia | Organo | Versiones activas | Diferencia sustantiva | Decision requerida | Valores canonicos |
|---|---|---|---|---|---|
| AUMENTO_CAPITAL | JG | v1.0.0 frente a v1.0.0 | Una sin convocatoria, otra con convocatoria | `[Completar]` | `[Completar]` |
| REDUCCION_CAPITAL | JG | v1.0.0 frente a v1.0.0 | Patron analogo | `[Completar]` | `[Completar]` |
| APROBACION_CUENTAS | JG | v1.0.0 frente a v1.0.0 | SA 30 dias frente a SA 15 dias | `[Completar]` | `[Completar]` |
| DELEGACION_FACULTADES | Consejo | 1.1.0 frente a 1.0.0 | 1.1.0 anade verificacion art. 249 LSC | `[Completar]` | `[Completar]` |
| NOMBRAMIENTO_AUDITOR | JG | 1.1.0 frente a 1.0.0 | Rango de duracion y documentacion | `[Completar]` | `[Completar]` |
| AUTORIZACION_GARANTIA | JG/Consejo | 1.1.0 frente a 1.0.0 | Antelacion 0 en Consejo frente a 15 dias en Junta | `[Completar]` | `[Completar]` |

---

## 5. Mayorias SL como desbloqueo sustantivo prioritario

La matriz validada de mayorias y quorum por materia y tipo social es el primer desbloqueo de codigo.

Formato canonico:

| Materia | Tipo social | Organo | Mayoria | Quorum | Articulo LSC | Severidad si no se cumple |
|---|---|---|---|---|---|---|
| AUMENTO_CAPITAL | SL | JG | Mas de la mitad del capital total | Sin quorum legal | art. 199 LSC | `IMPUGNABILIDAD` |
| EXCLUSION_DERECHO_PREFERENTE | SL | JG | Reforzada, a precisar | A precisar | art. 308 y concordantes | `CALIFICACION_REGISTRAL` o `IMPUGNABILIDAD` |
| MODIFICACION_ESTATUTOS | SL | JG | Reforzada, a precisar | A precisar | arts. 199 y 287 LSC | `IMPUGNABILIDAD` |
| NOMBRAMIENTO_CONSEJERO_ORDINARIO | SL | JG | Mas de un tercio del capital, si aplica | No informado | arts. 198 y 201 LSC | `WARNING` o `IMPUGNABILIDAD`, segun P1-P10 |
| NOMBRAMIENTO_AUDITOR | SL | JG | Ordinaria | No informado | art. 264 LSC | `CALIFICACION_REGISTRAL` si duracion fuera de rango |
| REDUCCION_CAPITAL | SL | JG | Reforzada, a precisar | A precisar | arts. 317 y ss. LSC | `CALIFICACION_REGISTRAL` |

Estos ejemplos son de trabajo. Deben reemplazarse o confirmarse con el cuadro integro validado por Legal para materias inscribibles o reforzadas.

---

## 6. Alcance del siguiente sprint

### Fase 1: saneamiento legal read-only y correccion core

No introduce nueva UX.

Entregables:

1. Extraccion SQL read-only de payloads vigentes de rule packs.
2. Consolidacion de tabla de control por gate y tipo social.
3. Deteccion de divergencias frente a LSC por convocatoria, quorum, mayoria y documentacion.
4. Dossier para Legal con matriz de divergencias priorizada por materias inscribibles y reforzadas.
5. Resolucion de duplicados segun decision canonica.
6. Correccion de mayorias SL en payloads afectados cuando Legal valide la matriz.

### Fase 2: Formal Gates MVP

Implementar `evaluateFormalGate` solo cuando este aprobada la tabla de severidad.

Entregables:

1. Evaluacion dinamica en runtime con evidencia del expediente.
2. Validacion de plazo de convocatoria.
3. Validacion de quorum.
4. Validacion de mayoria.
5. Validacion de documentacion presente.
6. Validacion de prerequisitos.
7. Bloqueo sin override en supuestos tasados.
8. Advertencias trazables para el resto.

### Fase 3: conexion de flujo

Posponer `TramitadorStepper -> MatterExecutionProfile` hasta cerrar Fase 1 y Fase 2.

El stepper consumira el perfil como contexto propositivo y mostrara advertencias por checkpoint. La ruta rapida seguira usando `computeRefreshableCapa3Fields`.

---

## 7. Trabajo ejecutable sin desbloqueo legal

Mientras Legal cierra P1-P10, se puede avanzar en tareas read-only y preparatorias:

1. Ejecutar SQL de extraccion de rule packs.
2. Consolidar tabla de valores por gate y tipo social.
3. Preparar informe de divergencias contra LSC.
4. Inventariar duplicados activos.
5. Preparar paquete de dossier para Legal con tablas 1-3 pre-rellenadas.
6. Inventariar plantillas faltantes por materia para los gaps sustantivos.
7. Proponer bindings y metadatos minimos: `organo_tipo`, `adoption_mode`, `referencia_legal`.
8. Documentar especificacion tecnica de `evaluateFormalGate` sin implementar logica bloqueante.

---

## 8. Condiciones minimas para iniciar codigo funcional

No iniciar cambios de codigo que afecten validez de acuerdos hasta contar con:

1. Matriz validada de mayorias SL para materias reforzadas e inscribibles.
2. Decision canonica y limpieza de duplicados de rule packs.
3. Aprobacion de tabla de severidad y regla de absorcion.

---

## 9. Cierre

Con la validacion de P1-P10, la tabla de severidad y la matriz de mayorias SL, se podran ejecutar dos sprints cortos:

1. Saneamiento de rule packs y correccion core.
2. MVP de formal gates.

Despues de eso, el sistema queda en posicion de conectar el `TramitadorStepper` con un perfil operativo fiable y trazable, minimizando regresiones y deuda juridica.
