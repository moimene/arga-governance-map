# 2026-04-26 — Matriz de control legal para refactor UX Secretaría

## Objetivo

Evitar que el refactor UX de `/secretaria` simplifique indebidamente procesos jurídicos críticos. A partir de esta matriz, cada stepper debe poder explicar:

- qué órgano adopta el acuerdo;
- qué `AdoptionMode` aplica;
- qué rule pack y overrides se han aplicado;
- qué requisitos vienen de ley, estatutos y pactos;
- qué gates bloquean, advierten o requieren revisión humana;
- qué evidencia se genera en PRE, INTRA y POST.

## Corrección de enfoque

Estos requisitos **ya estaban en la planificación y documentación del equipo legal**. Esta matriz no sustituye ni reabre esa planificación: la convierte en una capa de control de implementación.

El problema a corregir no es documental, sino de ejecución:

- los requisitos estaban descritos, pero no todos estaban ligados a gates visibles en UI;
- algunos requisitos estaban en planes, pero no convertidos en criterios de aceptación por stepper;
- la UX empezó a reorganizar navegación y modo Grupo/Sociedad antes de fijar la fidelidad jurídica de cada proceso;
- faltaba una vista única de trazabilidad `requisito legal -> regla -> pantalla -> bloqueo/warning -> test`.

Desde este punto, cualquier cambio de UX en Secretaría debe demostrar que no reduce esos requisitos a una secuencia genérica.

## Fuentes revisadas

- `/Users/moisesmenendez/Downloads/Revisión_del_Plan_de_Implantación_del_Motor_de_Reglas (1).docx`
- `/Users/moisesmenendez/Downloads/LSC_Rule_Engine_Expansion_Master_Reference (1).xlsx`
- `docs/superpowers/specs/2026-04-19-decisiones-legales-motor-lsc-resueltas.md`
- `docs/superpowers/plans/2026-04-26-secretaria-ui-refactor-ruflo.md`

## Decisión de trabajo

La siguiente fase de UI queda condicionada a esta matriz. No se debe construir un stepper "bonito" si no conserva los requisitos legales materiales: convocatoria, constitución, lista de asistentes, capital/derechos de voto, quórum, mayorías, conflictos, vetos, documentación, firmas, certificación, inscripción y archivo.

### Decisión específica sobre convocatoria

En el flujo de convocatoria **no se bloquea la emisión por requisitos legales, documentales, de plazo o de canal**. La plataforma debe presentar esos requisitos como recordatorios/alertas explicables y dejar trazabilidad, porque el equipo legal puede ejecutar la convocatoria fuera del sistema o regularizar evidencias por otra vía.

Esta decisión no elimina los requisitos: cambia su efecto UX en convocatoria. El stepper debe seguir calculando plazo, canal, documentación y rule pack aplicable, pero debe mostrarlos como:

- `Recordatorio`: requisito pendiente o no evidenciado.
- `Alerta alta`: riesgo legal relevante que conviene revisar antes de emitir.
- `Trazabilidad`: constancia de qué regla se evaluó, versión, fuente y motivo.

Los bloqueos se reservan para validaciones mínimas de formulario o permisos técnicos, no para impedir que el usuario emita una convocatoria desde la UI.

## Conflictos a resolver antes de codificar gates definitivos

| ID | Conflicto | Fuente | Riesgo | Decisión pendiente |
|---|---|---|---|---|
| C-01 | Cotizadas: el XLSX marca "Cotizadas excluidas"; las decisiones DL-2 indican evaluar LSC y advertir LMV, sin bloquear. | XLSX checklist vs DL-2 | Bloqueo indebido de ARGA Seguros S.A. cotizada demo | Mantener DL-2 como criterio vigente salvo contraorden legal: evaluar y advertir, no bloquear por ser cotizada. |
| C-02 | JGA SL: el DOCX describe mayoría sobre capital presente y sin quórum legal mínimo; el catálogo XLSX incluye 33%. | DOCX vs XLSX | Gate de constitución/voto incorrecto en SL | Reconciliar con equipo legal si 33% es umbral estatutario demo, no regla legal general. |
| C-03 | Pactos parasociales: no deben bloquear proclamación societaria salvo estatutarización, pero sí generar incumplimiento contractual. | DOCX + XLSX | Confundir validez societaria con compliance contractual | Separar `societary_validity` de `pacto_ok` y mostrar ambos en UI. |

## Matriz de requisitos no negociables

| Área | Requisito legal/operativo | Estado esperado en producto | Gate UX/engine | Prueba de aceptación |
|---|---|---|---|---|
| Rule packs | Las materias se resuelven por rule pack declarativo, no por lógica fija de pantalla. | 28 rule packs activos y versionados. | Bloquear creación si no hay pack activo para materia obligatoria. | Test: materia sin pack activo muestra bloqueo explicable. |
| Jerarquía normativa | Ley, estatutos y pactos deben componerse aplicando la regla más estricta cuando proceda. | `explain` debe indicar fuente y precedencia. | Warning o block según fuente: ley/estatuto bloquea; pacto no estatutarizado advierte. | Test: override estatutario aumenta plazo/mayoría y queda explicado. |
| AdoptionMode | Deben mantenerse `MEETING`, `UNIVERSAL`, `NO_SESSION`, `UNIPERSONAL_SOCIO`, `UNIPERSONAL_ADMIN`, `CO_APROBACION`, `SOLIDARIO`. | El stepper cambia pasos según modo, sin ocultar requisitos materiales. | Selector o resolución automática con explicación. | Test por modo: pasos esperados y gates mínimos. |
| Convocatoria PRE | La convocatoria depende de tipo social, órgano, materia, documentación, canal y plazo. | Stepper de convocatoria con rule pack visible, órgano competente, canal, plazo, OdD y docs. | Recordatorio/alerta no bloqueante si falta documentación, canal admisible o plazo. | Test SA: un mes + publicación. Test SL: 15 días + notificación individual ERDS. Test SLU: no convocatoria formal. |
| Documentación PRE | Modificaciones estatutarias, aumentos, exclusión de preferencia, cuentas y operaciones estructurales requieren docs específicos y puesta a disposición. | Checklist documental por materia antes de emitir convocatoria. | Recordatorio no bloqueante en convocatoria; bloqueo solo en generación documental final si procede. | Test: modificación estatutos sin texto íntegro permite emitir con alerta y deja trazabilidad. |
| Constitución reunión | La reunión debe formar lista de asistentes y validar representación, capital y derechos de voto. | Paso de asistentes con presentes, representados, ausentes, capital económico y voto. | Block si PJ no tiene representante, si falta capacidad o si no hay quórum legal/estatutario. | Test: persona jurídica sin representante bloquea constitución. |
| Votación | Mayorías dependen de órgano, tipo social, materia, capital presente, derechos de voto, conflictos y clases afectadas. | Paso de votación con denominadores explicados y exclusiones. | Block si mayoría legal/estatutaria no alcanzada; warning si pacto parasocial no cumplido. | Test: conflictuado excluido del denominador en operación vinculada. |
| Vetos | Veto estatutario y veto parasocial tienen efectos distintos. | UI debe mostrar "validez societaria" y "cumplimiento pacto" por separado. | Estatuto bloquea; pacto no estatutarizado advierte/incumplimiento. | Test: veto parasocial activo no impide certificación societaria, pero deja alerta. |
| Bordes no computables | Liquidez, indelegabilidad fina, cotizada/régimen especial, telemática-only y consentimientos de clase pueden requerir revisión humana. | Banner de revisión legal con motivo y responsable. | Block o warning según severidad configurada. | Test: dividendo a cuenta sin juicio de liquidez queda bloqueado o warning alto. |
| Plantillas | Plantillas protegidas y aprobadas por Legal son requisito estructural. | Solo plantillas `ACTIVA` y aprobadas generan documentos finales. | Block si plantilla no aprobada o variables requeridas incompletas. | Test: plantilla BORRADOR no genera documento final. |
| Snapshot y WORM | Actas y certificaciones deben incorporar hash de snapshot/reglaset y auditoría WORM. | Cada expediente muestra `ruleset_hash`, snapshot y evidencia. | Block para emisión si no existe snapshot exigible. | Test: certificación sin snapshot en expediente nuevo bloquea. |
| Certificación | Requiere autoridad vigente del certificante, Vº Bº cuando proceda, QES y bundle de evidencia. | Pipeline visible: generar, firmar, emitir, archivar. | Block si secretario/certificante expirado, falta Vº Bº o firma QES. | Test: acuerdo inscribible sin Vº Bº bloquea certificación. |
| RLS y permisos | El frontend no debe usar `service_role`; roles controlan convocar, proclamar, aprobar packs y certificar. | UI oculta acciones no permitidas y backend deniega. | Block por permiso insuficiente. | Test de denegación RLS para rol no autorizado. |
| Grupo/campañas | Una campaña de grupo descompone expedientes por sociedad según datos maestros. | War Room de campaña con fases, estado, bloqueos y plazo por sociedad. | Block por sociedad cuando su expediente incumple su propio pack. | Test: campaña cuentas crea expedientes distintos por consejo/admin único/mancomunados/solidarios/SLU. |

## Gobierno y mantenimiento de reglas

El mantenimiento de reglas es producto, no tarea técnica secundaria. La plataforma debe permitir que Legal mantenga reglas sin tocar código, pero con controles suficientes para que una regla errónea no contamine expedientes.

### Principios

1. **No se edita una regla activa en caliente**. Se crea una nueva versión inmutable.
2. **La activación es jurídica, no técnica**. Solo Comité Legal o rol equivalente puede activar/deprecar.
3. **Todo cambio deja auditoría WORM** en `rule_change_audit`, incluyendo motivo, fuente y diff.
4. **Cada expediente guarda snapshot** de rule pack, overrides y pactos evaluados; los expedientes anteriores no cambian por una regla nueva.
5. **La regla tiene vigencia temporal**: fecha de entrada en vigor, fecha de derogación/deprecación y motivo.
6. **Los overrides no pueden rebajar mínimos legales**. Estatutos/reglamento pueden endurecer; pactos parasociales se evalúan en pista separada salvo estatutarización.
7. **Toda activación exige regresión legal**: fixtures por SA, SL, SLU, consejo, admin único, mancomunados, solidarios, universal y sin sesión.

### Lifecycle requerido

| Estado | Quién puede mover | Uso en producción | Condición de entrada |
|---|---|---|---|
| `DRAFT` | Secretaría corporativa / Legal editor | No | Nueva regla o nueva versión. |
| `LEGAL_REVIEW` | Legal editor | No | Payload completo, fuente normativa y fixtures mínimos. |
| `APPROVED` | Comité Legal | No, salvo entorno UAT | Revisión legal aprobada y tests unitarios OK. |
| `ACTIVE` | Comité Legal | Sí | UAT verde, plantillas compatibles, fecha de vigencia informada. |
| `DEPRECATED` | Comité Legal | No para nuevos expedientes | Sustituida por otra versión, cambio legal o corrección. |
| `RETIRED` | Admin sistema con acta Legal | No | Conservación histórica únicamente. |

Nota: si el schema efectivo mantiene solo `is_active`, debe ampliarse o normalizarse al lifecycle anterior. `is_active` no es suficiente para gobierno jurídico.

### Workflow de cambio

1. **Change request**: alta de solicitud con materia, norma afectada, urgencia, fuente y responsable legal.
2. **Borrador**: nueva versión del rule pack u override, nunca actualización destructiva.
3. **Validación estructural**: JSON schema, claves obligatorias, compatibilidad con `AdoptionMode` y plantillas.
4. **Regresión legal**: tests contra fixtures de sociedades y casos borde.
5. **Revisión Legal**: aprobación por Comité Legal, con comentario de alcance.
6. **Activación programada**: `effective_from`, `effective_to`, jurisdicción, tipo social y alcance.
7. **Snapshot en expedientes**: cada expediente nuevo fija versión y hash; expedientes previos mantienen versión histórica.
8. **Monitorización**: dashboard de reglas con fallos, warnings, overrides usados y expedientes impactados.

### Overrides por sociedad

Los overrides de `rule_param_overrides` deben tener mantenimiento propio:

| Tipo | Ejemplo | Quién mantiene | Efecto |
|---|---|---|---|
| Estatutos | Mayoría reforzada, plazo superior, órgano competente | Secretaría sociedad + Legal | Puede endurecer y bloquear si no se cumple. |
| Reglamento | Reglas internas de consejo/comisiones | Secretaría corporativa | Puede añadir requisitos internos. |
| Pacto parasocial | Veto, consentimiento inversor, política dividendos | Legal/M&A | No invalida societariamente salvo estatutarización; genera `pacto_ok`. |
| Jurisdicción | PT/BR/MX cuando se active extensión | Legal jurisdiccional | Rule pack o override jurisdiccional versionado. |

Cada override debe exponer fuente, referencia, vigencia y evidencia de aprobación. Un override sin referencia o sin vigencia debe aparecer como deuda legal, no como regla silenciosa.

### Pruebas mínimas para activar una regla

- **Schema test**: payload válido y completo.
- **Golden fixtures**: ARGA Seguros S.A., SL, SLU, admin único, mancomunados, solidarios y consejo.
- **Regresión de jerarquía**: no rebaja mínimos legales; aplica regla más estricta.
- **Regresión de UI**: el stepper explica la regla y no permite avanzar si el gate bloquea.
- **Regresión documental**: plantilla activa compatible con variables requeridas.
- **Regresión de evidencia**: snapshot hash y WORM audit generados.

### Pantallas necesarias

| Pantalla | Función |
|---|---|
| Catálogo de rule packs | Ver materias, órgano, tipo social, jurisdicción, versión activa y cobertura. |
| Detalle de regla | Payload explicado en lenguaje legal, fuentes y tests asociados. |
| Comparador de versiones | Diff semántico entre versión activa y propuesta. |
| Overrides por sociedad | Estatutos, reglamento y pactos aplicables a una entidad concreta. |
| Cola de revisión Legal | Aprobar, rechazar, pedir cambios o activar con vigencia. |
| Impact analysis | Qué sociedades, campañas y expedientes se verán afectados por activar/deprecar. |

### Deuda técnica detectada

- La documentación de diseño exige lifecycle `DRAFT/REVIEW/APPROVED/ACTIVE/DEPRECATED`, pero parte del schema inicial usa `is_active`. Hay que normalizar antes de depender de esta tabla para flujos críticos.
- Existen hooks con contratos distintos para rule packs (`pack_id/version/payload` frente a `rule_pack_id/version_tag/status/params`). Debe consolidarse un único adaptador canónico para evitar que cada pantalla interprete reglas de forma distinta.
- La UI no debe consumir payloads brutos sin un `RuleResolution` normalizado que incluya versión, hash, fuente, vigencia, overrides y resultado de jerarquía normativa.

## Stepper mínimo por tipo de proceso

### Convocatoria

1. Contexto: sociedad, órgano, materia, tipo social, forma de administración, `AdoptionMode`.
2. Regla aplicable: rule pack, versión, overrides estatutarios, pactos relevantes.
3. Orden del día y documentación: checklist por materia.
4. Canal y plazo: SA/SL/SLU, web/BORME/diario, notificación individual, ERDS.
5. Evidencia PRE: hash de convocatoria, destinatarios, publicación/notificación.
6. Emisión: permitida con recordatorios visibles; la UI deja trazabilidad de alertas aceptadas y evidencia pendiente.

### Reunión

1. Apertura y mesa: presidente, secretario, autoridad vigente.
2. Lista de asistentes: personas físicas, personas jurídicas, representantes, presencia/representación/ausencia.
3. Capital y voto: capital económico, derechos de voto, clases, restricciones.
4. Constitución: quórum legal, estatutario y pactado si aplica.
5. Deliberación y voto: denominador, exclusiones por conflicto, vetos, mayorías.
6. Proclamación: validez societaria y pista separada de pactos.
7. Acta: contenido, firmas, snapshot, WORM.
8. Certificación/POST: QES, Vº Bº, inscripción, libros, depósitos, tareas posteriores.

Estado 2026-04-27:

- `ReunionStepper` ya guarda `meetings.quorum_data.point_snapshots` por punto con mayoría, denominador, conflictos, veto estatutario y pactos parasociales.
- La resolución `ADOPTED/REJECTED` deriva de `societary_validity`; `pacto_compliance` queda separado como incumplimiento contractual.
- Queda pendiente conectar capital/derechos de voto desde el maestro societario de forma completa, no solo desde `meeting_attendees`, y persistir snapshot WORM específico cuando se cierre paridad Supabase.

### Acuerdo sin sesión / escrito

1. Elegibilidad de materia y órgano.
2. Consentimientos requeridos por ley/estatutos.
3. Firma QES y evidencia QTSP.
4. Denominador de aprobación y conflictos.
5. Acta o consignación, archivo y POST.

### Unipersonal

1. Verificación de unipersonalidad o administrador único vigente.
2. Competencia del decisor.
3. Conflictos, operaciones vinculadas y límites indelegables.
4. Decisión firmada.
5. Transcripción en libro, publicidad registral cuando aplique y contratos con socio único.

### Co-aprobación y solidarios

1. Forma de administración vigente.
2. Reglas k-de-n o administrador actuante.
3. Restricciones estatutarias y conflictos.
4. Firmas requeridas.
5. Acta de órgano o decisión conjunta, evidencia y POST.

## Campañas de grupo: cobertura inicial obligatoria

| Campaña | Descomposición mínima | Gates críticos |
|---|---|---|
| Cuentas anuales | Formulación → Convocatoria JGA → Aprobación → Depósito | Plazo 3 meses formulación; plazo 1 mes depósito; docs cuentas; firma admins; SLU sin convocatoria formal. |
| Renovación cargos | JGA nombramiento/cese → aceptación → Consejo constitutivo si consejo → delegaciones/poderes | Mandato vigente/expirado; aceptación; inscripción; 2/3 para delegación cuando aplique. |
| Presupuesto anual | Consejo/admin/co-aprobación según forma | Pacto P6 si existe; fallback presupuestario si configurado. |
| Garantías intragrupo | Determinar órgano por umbral 25% activo | JGA si activo esencial; operación vinculada si aplica; exclusión conflictuado. |
| Dividendos | Dividendo a cuenta filial → pago → aplicación matriz | Base disponible, liquidez, reservas, patrimonio neto. |
| Modificación estatutos | Órgano admin si autorizado para domicilio; si no JGA/socio único | Texto íntegro, mayoría reforzada, escritura e inscripción. |
| Auditor | Nombramiento/renovación JGA | ROAC, independencia, mandato 3-9 años. |
| Operación estructural | Proyecto → convocatoria → aprobación → oposición acreedores → escritura/RM | Ventanas cruzadas, docs disponibles, mayorías reforzadas. |

## Orden de implementación recomendado

1. **Legal Gates Foundation**: tipos de resultado separados (`societary_validity`, `pacto_ok`, `human_review_required`) y componente común de explicación.
2. **Convocatoria v2**: resolver rule pack por materia, órgano, tipo social y `AdoptionMode`; añadir checklist documental y canal/plazo.
3. **Reunión v2**: lista de asistentes con capital/voto/representación, constitución y votación con denominadores.
4. **Certificación v2**: authority evidence, Vº Bº, QES, snapshot/ruleset hash y WORM como gates visibles.
5. **Campaña Cuentas Anuales**: primer flujo de grupo end-to-end, usando los steppers anteriores por sociedad.

## Definition of Done legal

- Cada bloqueo o warning muestra fuente: ley, estatuto, pacto, plantilla, permisos, evidencia o borde no computable.
- Ningún proceso proclama "válido" sin explicar órgano, modo, quórum, mayoría y documentación.
- Pactos parasociales no se mezclan con validez societaria salvo estatutarización.
- Los procesos por sociedad no heredan reglas agregadas de grupo sin recalcular contra sus datos maestros.
- `bunx tsc --noEmit`, tests de motor y smoke e2e de Secretaría pasan antes de continuar con la siguiente pantalla.
