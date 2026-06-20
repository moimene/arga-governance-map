# Informe para revision legal: propuesta de rediseño UX y copy

**Fecha:** 2026-06-20  
**Ambito:** modulo Secretaria Societaria (`/secretaria/*`) de TGMS  
**Destinatarios:** equipo legal, producto e ingenieria  
**Estado:** propuesta para revision legal, no especificacion vinculante todavia  
**Revision incorporada:** observaciones de revision integral y tres anexos de especificacion sobre jerarquia normativa, mobile UX y certificaciones autonomas  
**Origen:** ciclo de revision UI con `impeccable`, inspeccion de `/secretaria`, `/secretaria/informes`, `/secretaria/certificaciones` y `/secretaria/documentos/pendientes-revision`  
**Cliente demo:** Grupo ARGA Seguros, pseudonimo operativo  

## 1. Proposito del informe

Este informe consolida una propuesta de rediseño de la experiencia de usuario del modulo de Secretaria Societaria y un catalogo inicial de textos, etiquetas y microcopy para revision del equipo legal.

El objetivo no es cambiar la logica juridica, los motores de reglas ni los efectos de los documentos. El objetivo es hacer que la interfaz sea mas intuitiva, mas segura para usuarios no tecnicos y mas honesta en la distincion entre:

- entorno de validacion funcional y evidencia cualificada productiva;
- informacion mostrada y acto societario ejecutado;
- fuente canonica y dato manual;
- certificacion emitida, documento generado, firma, sello, archivo y revision;
- control profesional del secretario y señales provenientes de otros modulos.

La propuesta mantiene el tono institucional Garrigues: experto, sobrio, juridicamente preciso y orientado a trabajo real.

## 2. Lectura ejecutiva

La UX actual muestra un modulo funcionalmente amplio, pero todavia exige que el usuario entienda la estructura interna del sistema: tablas, tipos de artefacto, estados tecnicos, hashes, UUIDs y rutas separadas por objeto. Para un usuario legal, esto aumenta carga cognitiva y puede inducir lecturas equivocadas sobre el estado juridico de un documento.

La recomendacion principal es reorganizar Secretaria alrededor de los trabajos que el usuario quiere completar:

1. saber que requiere atencion;
2. preparar y celebrar actos societarios;
3. cerrar actas y certificaciones;
4. revisar documentos y evidencia;
5. tramitar o archivar;
6. vigilar plazos, libros y cumplimiento.

La nueva UX debe pasar de una navegacion exhaustiva por funcionalidades a una mesa de trabajo guiada por expediente, fuente, estado y siguiente accion.

### 2.1. Mecanismo formal de aprobacion legal

Como este documento se declara expresamente "no vinculante todavia", la aprobacion de Legal debe quedar formalizada antes de convertirse en backlog de implementacion. No basta con una lista de puntos pendientes.

Propuesta de circuito:

| Paso | Responsable | Resultado | Efecto sobre desarrollo |
|---|---|---|---|
| Revision de lenguaje juridico | Legal | Glosario aprobado, rechazado o aprobado con reservas. | Solo el glosario aprobado puede pasar a UI visible. |
| Revision de efectos y estados | Legal + Producto | Matriz de estados juridicos, documentales y probatorios. | Bloquea cambios en certificaciones, evidencia y registro. |
| Revision de flujos criticos | Legal + Producto + Ingenieria | Certificaciones, evidencia, regla efectiva y autoridad certificante validadas. | Habilita implementacion funcional. |
| Firma de alcance | Responsable Legal designado | Acta de aprobacion de copy/UX con version de documento. | Congela el alcance de la iteracion UX. |
| Registro de cambios | Producto | Decision log con fecha, aprobador y terminos afectados. | Todo cambio posterior requiere nueva aprobacion si afecta efecto juridico. |

Estados documentales recomendados para este informe:

- `BORRADOR_UX`: propuesta redactada, pendiente de revision legal.
- `REVISION_LEGAL`: Legal revisando terminos, estados y alcance.
- `APROBADO_CON_RESERVAS`: puede implementarse salvo puntos marcados como bloqueantes.
- `APROBADO_LEGAL`: copy y criterios UX aprobados para implementacion.
- `SUPERADO`: reemplazado por nueva version del informe.

## 3. Riesgos UX detectados

| Riesgo | Descripcion | Impacto legal o operativo |
|---|---|---|
| Estados tecnicos visibles | Se muestran valores como `EMITTED`, `ARCHIVED`, `DEMO_OPERATIVA`, `TERCERO` o `AUDITOR`. | El usuario puede no distinguir estado documental, efecto juridico, destinatario y evidencia. |
| Formularios por estructura tecnica | Certificaciones autonomas pide multiples UUID opcionales a la vez. | El usuario puede introducir una fuente incorrecta o pensar que debe conocer IDs internos. |
| Acciones deshabilitadas sin razon | Botones como `Crear` o `Emitir` aparecen inactivos sin explicar el requisito faltante. | Reduce trazabilidad de decision y aumenta soporte. |
| Tablas demasiado densas en movil | Las tablas usan scroll horizontal interno. | Correcto tecnicamente, pero poco apto para revision rapida por consejeros o legal. |
| Empty states pobres | Mensajes como "No hay informes registrados" no indican siguiente accion. | La pantalla parece incompleta aunque sea un estado valido. |
| Copy ambiguo sobre evidencia | `DEMO_OPERATIVA` aparece como dato tecnico, no como explicacion legal. | Puede confundirse con evidencia final o cualificada. |
| Navegacion larga | La sidebar presenta muchas opciones simultaneas. | El usuario debe saber de antemano donde vive cada trabajo. |
| Jerarquia normativa opaca | La UI puede mostrar "regla efectiva" sin explicar que fuentes la componen ni que capa prevalece. | El abogado no sabe por que una regla desplaza a otra ni cuando un pacto solo genera warning. |
| Plantillas en transicion | Plantillas activas pueden tener metadatos incompletos o estar en cohortes de upgrade/revision. | Riesgo de usar una plantilla aparentemente activa pero no plenamente gobernada. |
| Criticidad movil no definida | El criterio movil debe identificar pantallas M1/M2/M3, niveles y restricciones de accion. | Ingenieria no puede aplicar el criterio de forma verificable si no hay clasificacion. |

## 4. Principios de rediseño propuestos

### 4.1. Principios funcionales

1. **Trabajo antes que objeto.** La UI debe responder "que tengo que hacer ahora" antes que "en que tabla estoy".
2. **Fuente antes que formulario.** Informes y certificaciones deben nacer desde una fuente canonica reconocible: acuerdo, reunion, acta, libro, cargo, persona, sociedad o expediente.
3. **Estado legal separado de estado tecnico.** Un chip de estado no debe mezclar generacion documental, revision, firma, evidencia y efecto frente a terceros.
4. **Entorno siempre visible cuando proceda.** Todo resultado sandbox o stub debe decirlo en lenguaje juridico comprensible, sin sugerir eficacia cualificada productiva.
5. **Secretario como garante.** Las señales de GRC, AI Governance u otros modulos son propuestas, no actos societarios hasta que Secretaria las acepte.
6. **Configuracion fuera del flujo diario.** Plantillas, materias, organos y reglas deben quedar accesibles, pero no competir con tareas operativas.

### 4.2. Principios de copy

1. Usar lenguaje juridico claro, no valores internos de base de datos.
2. Nombrar la consecuencia de cada accion.
3. Explicar por que una accion esta bloqueada.
4. Evitar prometer eficacia juridica final cuando el entorno sea demo.
5. Mantener terminos estables: no alternar "artefacto", "documento", "soporte" y "evidencia" sin regla.
6. Usar verbos concretos: preparar, revisar, aprobar, generar, emitir, archivar, sustituir.

## 5. Nueva arquitectura de informacion propuesta

### 5.1. Navegacion principal

Propuesta de siete areas principales:

| Area | Proposito | Contenido |
|---|---|---|
| Mesa | Prioridad diaria y trabajo pendiente. | Tareas, hitos, bloqueos, documentos por revisar, accesos frecuentes. |
| Expedientes | Centro de verdad operativa por asunto. | Acuerdos, actas, certificaciones, anexos, registro, evidencia y timeline. |
| Adopcion | Preparar y adoptar actos societarios. | Convocatorias, reuniones, acuerdos sin sesion, decisiones unipersonales. |
| Documentacion | Documentos, informes, certificaciones y revision. | Informes preceptivos, certificaciones, anexos, cola documental. |
| Registro y libros | Formalizacion y obligaciones recurrentes. | Tramitador, libros, legalizaciones, plazos, subsanaciones. |
| Sociedades y personas | Datos maestros de identidad, cargos, representacion y autoridad. | Sociedades, personas, cargos, representantes, socios, cap table, autoridad certificante. |
| Configuracion y reglas | Gobierno del motor juridico y documental. | Materias, organos, rule packs, plantillas, validacion documental previa, parametros normativos. |

La propuesta no elimina `Sociedades y personas` ni `Configuracion y reglas`. Al contrario: las separa del trabajo diario para que no compitan con tareas urgentes, pero las eleva como areas de gobierno de datos maestros y gobierno juridico-documental. Deben ser mas claras para usuarios legales porque de ellas dependen censo, autoridad certificante, Vº Bº, plantillas, rule packs y requisitos formales.

### 5.2. Sidebar propuesta

Texto recomendado para la sidebar:

| Actual | Propuesto | Nota |
|---|---|---|
| Dashboard | Mesa | Mas cercano al trabajo del secretario. |
| Board Pack | Board pack | Mantener si Legal confirma uso de anglicismo. Alternativa: `Paquete del consejo`. |
| Convocatorias | Convocatorias | Mantener. |
| Reuniones | Sesiones | Legal debe validar si "sesiones" es preferible para organos colegiados. |
| Acuerdos sin sesion | Acuerdos sin sesion | Mantener. |
| Actas | Actas | Mantener. |
| Certificaciones vinculadas | Certificaciones de acuerdos | Mas explicito. |
| Informes preceptivos | Informes y anexos | Agrupa informes obligatorios y soportes. |
| Certificaciones autonomas | Certificaciones autonomas | Mantener, pero con explicacion en pantalla. |
| Documentos en revision | Revision documental | Mas accionable. |
| Tramitador registral | Registro | Mas corto. El H1 puede ser "Tramitador registral". |
| Subsanaciones | Subsanaciones | Mantener. |
| Presentaciones | Presentaciones registrales | Mas preciso. |
| Procesos | Calendario societario | Mas claro. |
| Sociedades | Sociedades | Mantener; debe actuar como ficha maestra y no solo listado. |
| Personas y cargos | Personas, cargos y representantes | Mas claro: incluye PF/PJ, cargos vigentes, ceses y representantes de PJ. |
| Materias y reglas | Materias y reglas | Mantener, con copy de gobierno juridico. |
| Catalogo de organos | Catalogo de organos | Mantener; explicar que gobierna quorums, mayorias y organos disponibles. |
| Plantillas | Plantillas documentales | Mas explicito. |
| Gestor plantillas | Gobierno de plantillas | Evita lectura de simple editor administrativo. |

## 6. Modelo de pantallas objetivo

### 6.1. Mesa

**Objetivo:** que el secretario entienda en 30 segundos que requiere atencion.

Estructura propuesta:

1. Header: sociedad, jurisdiccion, modo, fecha de corte.
2. Bloque "Requiere tu atencion".
3. Bloque "Proximos hitos".
4. Bloque "Documentos pendientes".
5. Bloque "Accesos frecuentes".
6. Panel plegado "Contratos tecnicos y señales avanzadas".

Copy recomendado:

| Elemento | Texto propuesto |
|---|---|
| H1 | Mesa de Secretaria |
| Subcopy | Revisa primero los hitos, documentos y bloqueos que pueden afectar al ciclo societario de esta sociedad. |
| Bloque prioridad | Requiere tu atencion |
| Empty state prioridad | No hay acciones urgentes para esta sociedad. Revisa los proximos hitos o inicia un nuevo flujo. |
| Señales externas | Propuestas recibidas de otros modulos |
| Disclaimer señales externas | Estas propuestas no modifican el expediente societario hasta que Secretaria las acepte. |
| CTA principal | Preparar convocatoria |
| CTA secundario | Revisar documentos |

### 6.2. Expediente 360

**Objetivo:** que cada asunto tenga una vista unificada: propuesta, adopcion, documentos, certificaciones, registro y evidencia.

Estructura propuesta:

1. Resumen del expediente.
2. Siguiente accion.
3. Estado legal.
4. Timeline.
5. Documentos y anexos.
6. Certificaciones.
7. Registro.
8. Evidencia y auditoria.

Copy recomendado:

| Elemento | Texto propuesto |
|---|---|
| H1 | Expediente societario |
| Subcopy | Estado completo del asunto: adopcion, documentacion, certificacion, registro y evidencia asociada. |
| Panel accion | Siguiente accion recomendada |
| Panel bloqueos | Que impide avanzar |
| Panel pendientes | Que falta completar |
| Estado sin bloqueos | Sin bloqueos societarios detectados para este paso. |
| Estado con advertencias | Hay advertencias que deben revisarse antes de continuar. |
| CTA | Continuar expediente |

### 6.3. Informes y anexos

**Problema actual:** la pantalla permite crear informes manuales, pero el usuario no ve claramente desde que fuente nace el informe ni que requisito cumple.

Flujo propuesto:

1. Seleccionar fuente: acuerdo, convocatoria, acta, certificacion, libro, manual.
2. Mostrar requisitos documentales detectados.
3. Elegir documento a preparar.
4. Generar o anexar.
5. Enviar a revision.

Copy recomendado:

| Elemento | Texto propuesto |
|---|---|
| H1 | Informes y anexos |
| Subcopy | Prepara o anexa documentos exigibles por materia y vinculos al expediente correspondiente. |
| Selector fuente | Fuente del documento |
| Ayuda fuente | Selecciona el acuerdo, reunion, acta o libro que justifica este documento. |
| Campo titulo | Titulo del informe |
| Campo referencia | Referencia de fuente |
| Ayuda referencia | Usa este campo solo si el documento procede de una fuente externa o manual. |
| Boton crear | Crear informe |
| Boton deshabilitado | Introduce un titulo para crear el informe. |
| Empty state | No hay informes asociados a esta sociedad. Crea uno desde una fuente o abre un expediente con requisitos documentales. |
| Success | Informe creado y pendiente de revision. |
| Error | No se pudo crear el informe. Revisa la fuente y vuelve a intentarlo. |

Terminos que debe validar Legal:

- "documento exigible";
- "informe preceptivo";
- "anexo obligatorio";
- "requisito documental";
- "fuente externa o manual".

### 6.4. Certificaciones autonomas

**Problema actual:** la pantalla pide UUIDs opcionales de organo, persona, cargo, libro, movimiento, acuerdo y decision en un unico formulario.

Flujo propuesto:

1. Seleccionar tipo de certificacion.
2. Seleccionar sociedad y fecha de corte.
3. Seleccionar fuente canonica con buscador.
4. Revisar resumen certificable.
5. Confirmar autoridad certificante y Vº Bº.
6. Generar documento.
7. Emitir, archivar o marcar como sustituida.

Copy recomendado:

| Elemento | Texto propuesto |
|---|---|
| H1 | Certificaciones autonomas |
| Subcopy | Emite certificaciones desde libros, cargos, capital, acuerdos o fuentes canonicas sin depender necesariamente de un acta. |
| Paso 1 | Tipo de certificacion |
| Paso 2 | Fuente certificable |
| Paso 3 | Resumen y fecha de corte |
| Paso 4 | Autoridad y Vº Bº |
| Paso 5 | Generacion y emision |
| Campo fecha | Fecha de corte |
| Ayuda fecha | La certificacion reflejara la informacion vigente en esta fecha. |
| Selector fuente | Selecciona la fuente |
| Ayuda fuente | El sistema calculara el hash sobre los datos canonicos seleccionados. |
| Resumen fuente | Resumen certificable |
| Aviso fuente fijada | Los datos certificados quedan fijados a la fecha de corte indicada. Si la informacion de base cambia despues, sera necesario emitir una nueva certificacion. |
| CTA preparar | Preparar fuente |
| CTA generar | Generar certificacion |
| CTA emitir | Emitir certificacion |
| CTA ver | Ver certificacion |
| Disabled emitida | Esta certificacion ya esta emitida. Puedes verla o marcarla como sustituida. |
| Empty state | No hay certificaciones autonomas para esta sociedad. Selecciona un tipo y una fuente para preparar la primera. |

#### 6.4.1. Especificacion adicional: certificacion registral frente a certificacion autonoma

La UX debe distinguir dos familias con claridad, porque comparten lenguaje de "certificacion" pero no comparten fuente, hash, autoridad ni efecto.

| Familia | Fuente | Hash | Autoridad | Efecto UI |
|---|---|---|---|---|
| Certificacion registral de acuerdos | Acta aprobada y firmada, acuerdos certificados y censo WORM. | `gate_hash` sobre snapshot, acta y resultado/acuerdos. | Secretario o vicesecretario con Vº Bº cuando proceda conforme a RRM. | Certificacion de acuerdos para elevacion, notaria o registro. |
| Certificacion autonoma | Libro, registro, cargo, persona, capital, sociedad, decision o dato canonico a fecha de corte. | `source_hash` sobre la representacion canonica de la fuente certificada. | Autoridad segun tipo, fuente y efecto declarado. | Certificacion o constancia del dato certificado, no necesariamente registral. |

Reglas UX no negociables:

1. No mostrar `minute_id`, `agreements_certified[]`, `canonical_minutes_hash` ni sentinels de acta cuando la certificacion sea autonoma.
2. No fabricar un `gate_hash` sobre fuentes inexistentes.
3. Mostrar siempre tipo de efecto declarado: interno, auditoria, frente a socio, frente a terceros, notarial o registral.
4. Mostrar fuente, fecha de corte, resumen certificable, `source_hash`, autoridad y Vº Bº antes de confirmar.
5. Si la firma o sello opera en sandbox, mostrar `Entorno de validacion funcional - sin eficacia juridica cualificada productiva`.

Copy recomendado para la diferencia:

| Contexto | Texto propuesto |
|---|---|
| Aviso certificacion autonoma | Esta certificacion se emite sobre una fuente canonica distinta de un acta. Su alcance depende del tipo, la fuente, la fecha de corte, la autoridad y el efecto declarado. |
| Aviso fuente fijada | Los datos certificados quedan fijados a la fecha de corte indicada. Si la informacion de base se modifica con posterioridad, sera necesario emitir una nueva certificacion que refleje el estado actualizado. |
| Aviso efecto interno | Esta certificacion tiene alcance interno o documental. No se presenta como certificacion registral salvo que cumpla los presupuestos aplicables. |
| Aviso efecto registral | Esta certificacion se prepara con efecto registral o frente a terceros. Requiere autoridad certificante vigente, referencia registral cuando proceda y Vº Bº si aplica. |
| Error autoridad | No se puede emitir: falta autoridad certificante vigente o Vº Bº requerido para este tipo de certificacion. |

#### 6.4.2. Autoridad certificante y Vº Bº condicional

La autoridad no debe resolverse solo por rol RBAC. La UI debe mostrar los cuatro factores que justifican la emision:

1. capacidad `CERTIFICATION` del usuario;
2. cargo certificante admitido para el tipo;
3. `authority_evidence` vigente y, si procede, referencia registral;
4. exigencia o no de Vº Bº por efecto declarado.

Matriz de copy para la pantalla de confirmacion:

| Elemento | Texto propuesto |
|---|---|
| Certificante | Firmara como certificante: [persona], [cargo], [sociedad/organo]. |
| Vº Bº requerido | Este tipo de certificacion requiere Vº Bº de [presidente/vicepresidente] por su efecto declarado. |
| Vº Bº no requerido | Este tipo de certificacion no requiere Vº Bº para el efecto declarado. |
| Referencia registral presente | Cargo con referencia registral informada. |
| Referencia registral ausente | Cargo vigente pendiente de referencia registral. Puede limitar el uso frente a terceros. |
| Confirmacion final | Antes de emitir, revisa fuente, fecha de corte, autoridad, Vº Bº y efecto declarado. |

#### 6.4.3. Garantias de comprension y validacion del secretario

El wizard debe garantizar que el secretario comprenda y valide tres elementos antes de confirmar:

1. que datos se certifican y con que huella de integridad;
2. bajo que autoridad, Vº Bº y efecto se emite;
3. que advertencias o limitaciones aplican al documento resultante.

La UI no debe convertir la emision en un clic ciego. El sistema propone, calcula y advierte; el secretario revisa, decide y confirma como acto profesional informado.

##### Paso de fuente: vista de solo lectura

El paso de fuente no debe ser un formulario vacio ni un campo libre. Debe mostrar una vista de solo lectura de los datos canonicos que se van a certificar.

Ejemplos por tipo:

| Tipo de certificacion | Datos minimos visibles antes de confirmar |
|---|---|
| Titularidad en libro de socios/acciones | Titulares vigentes, porcentajes, clases, derechos de voto, autocartera si aplica, fecha de alta y fecha de corte. |
| Extracto o indice de actas | Organo, actas incluidas, fecha, estado de firma, libro asignado y referencia. |
| Vigencia de cargo | Persona, cargo, organo, sociedad, fecha de inicio, estado, referencia registral si existe y autoridad asociada. |
| Estado de legalizacion de libros | Libro, ejercicio, estado, fecha de cierre, fecha de presentacion, alerta de plazo y evidencia disponible. |
| Cap table a fecha | Clases, titulares, porcentajes, derechos de voto, autocartera y fecha de corte. |

Si la fuente tiene datos incompletos, duplicados, discrepancias con datos legacy, estado pendiente o advertencias del motor, el wizard debe mostrarlas en este paso, antes de avanzar.

##### Huella de fuente y fecha de corte

La huella de fuente debe ser visible como dato de integridad, pero no como carga cognitiva principal. El secretario debe entender que el documento queda unido a la proyeccion de datos mostrada.

Copy recomendado:

```text
Huella de fuente calculada sobre los datos mostrados. Si cambias la fecha de corte, los datos y la huella se recalcularan.
```

Si el usuario modifica la fecha de corte:

- se actualiza la vista de datos;
- se recalcula la huella;
- se muestra que la proyeccion certificable ha cambiado;
- no se permite continuar si la fuente queda inconsistente.

##### Plantilla de tres capas

El wizard debe mostrar la plantilla como tres capas, con responsabilidades separadas:

| Capa | Responsable | Edicion por secretario | Regla UX |
|---|---|---|---|
| Capa 1 | Legal | No editable | Texto certificante protegido, referencias y formula base. |
| Capa 2 | Sistema | No editable directamente | Variables resueltas desde fuentes canonicas. Si hay error, se corrige la fuente, no el texto. |
| Capa 3 | Secretario | Editable dentro de limites | Destinatario, motivo, finalidad declarada, alcance, salvedades y reservas. |

La Capa 3 no debe permitir reescribir datos certificables. Si el secretario detecta un error en titularidad, cargo, libro o acta, el flujo correcto es corregir la fuente primaria y recalcular la huella.

Campos habituales de Capa 3:

- destinatario;
- motivo de emision;
- finalidad declarada;
- salvedades o reservas;
- alcance temporal o material;
- observaciones no sustitutivas de la fuente.

La obligatoriedad debe derivarse de la plantilla y de la validacion documental previa:

| Regla | Comportamiento |
|---|---|
| `OBLIGATORIO` | Bloquea avance si falta. |
| `RECOMENDADO` | Warning no bloqueante. |
| `OPCIONAL` | No bloquea. |
| `OBLIGATORIO_SI_TELEMATICA` | Bloquea solo si el canal o efecto lo exige. |

##### Previsualizacion antes de generar

Antes de generar el DOCX, el secretario debe ver el documento compuesto completo:

- Capa 1 protegida;
- Capa 2 resuelta desde fuente canonica;
- Capa 3 incorporada;
- advertencias visibles;
- marca de entorno si no hay evidencia cualificada productiva.

La previsualizacion debe ser de solo lectura en esta etapa. El documento final archivado no debe diferir del preview mostrado.

Copy recomendado:

```text
Revisa el borrador completo antes de generar. Este es el contenido que se archivara si confirmas la emision.
```

##### Confirmacion final reforzada

La confirmacion final debe mostrar en una seccion no colapsable:

- fuente;
- fecha de corte;
- huella de fuente;
- certificante;
- Vº Bº si aplica;
- referencia registral si aplica;
- efecto declarado;
- estado de evidencia;
- disclaimers aceptados.

Si el efecto es registral o frente a terceros, la confirmacion debe bloquear cuando falte autoridad, referencia registral requerida o Vº Bº requerido. Si el efecto es interno, puede permitir avanzar con warning cuando Legal lo haya autorizado.

##### Generacion, archivado y reverificacion

Tras confirmar, el sistema debe mostrar un resumen post-emision:

| Dato | Proposito |
|---|---|
| Huella de fuente | Verificar los datos certificados. |
| SHA-512 del documento | Verificar integridad del DOCX archivado. |
| URI del documento | Localizar el documento generado. |
| Estado de evidence bundle | Distinguir validacion funcional de evidencia cualificada. |
| Autoridad certificante | Reconstruir quien emitio y bajo que cargo. |
| Efecto declarado | Evitar confusion sobre alcance juridico. |

Acciones post-emision:

- descargar;
- verificar huella;
- vincular como anexo;
- ver historial;
- marcar como sustituida;
- abrir panel de certificaciones autonomas.

Si una certificacion se sustituye, la version anterior debe quedar accesible como `SUPERSEDED`, sin alterar hash, URL ni bundle.

##### Auditoria del acto informado

El wizard debe dejar traza de:

- datos mostrados al secretario;
- huella calculada;
- plantilla aplicada;
- campos de Capa 3;
- autoridad verificada;
- Vº Bº requerido o no requerido;
- efecto declarado;
- disclaimers aceptados;
- artefacto archivado;
- usuario, fecha y evento de emision.

La auditoria recomendada para certificaciones autonomas debe diferenciarse de la certificacion registral. El evento sugerido es:

```text
STANDALONE_CERT_EMITIDA
```

El criterio funcional es que un auditor pueda reconstruir que vio el secretario, que verifico el sistema y que limitaciones existian en el momento de la emision.

#### 6.4.4. Modelo de datos, RLS y auditoria de certificaciones autonomas

La separacion UX entre certificacion registral y autonoma debe reflejarse tambien en el modelo de datos. No es una distincion cosmetica.

Recomendacion arquitectonica:

| Decision | Motivo |
|---|---|
| Mantener certificaciones registrales de acuerdos en su pipeline actual. | Ese pipeline depende de acta aprobada y firmada, censo WORM, `gate_hash`, acuerdos certificados y Vº Bº. |
| Usar tabla o subtipo explicito para certificaciones autonomas. | Sus fuentes son libros, cargos, capital, personas, sociedades o registros, no actas. |
| Calcular `source_hash` separado de `gate_hash`. | Cada hash debe tener semantica estable y verificable. |
| Evitar sentinels como practica sistematica. | `NO_CANONICAL_MINUTES_HASH` o `agreements_certified=[]` degradan la trazabilidad cuando no existe acta. |
| Registrar evento de auditoria propio. | Permite reconstruir la emision autonoma sin mezclarla con certificacion registral. |

Campos minimos para certificacion autonoma:

- `tenant_id`;
- `entity_id`;
- `certification_kind`;
- `source_domain`;
- `source_id`;
- `source_payload`;
- `source_hash`;
- `cutoff_at`;
- `issued_to`;
- `legal_effect`;
- `certificante_role`;
- `authority_evidence_id`;
- `requires_visto_bueno`;
- `visto_bueno_persona_id`;
- `artifact_id`;
- `evidence_bundle_id`;
- `status`.

Indices y RLS recomendados:

| Necesidad | Recomendacion |
|---|---|
| Consulta por sociedad y tipo | Indice sobre `(tenant_id, entity_id, certification_kind, cutoff_at)`. |
| Consulta por fuente certificada | Indice sobre `(tenant_id, source_domain, source_id)`. |
| Auditoria por emision | Evento WORM `STANDALONE_CERT_EMITIDA` con usuario, fecha, fuente, huellas, autoridad y efecto. |
| Lectura de auditor/compliance | RLS de lectura para `AUDITOR` y `COMPLIANCE`, sin capacidad de emitir, sustituir ni revocar. |
| Emision | Solo roles con capacidad `CERTIFICATION` y autoridad resuelta por tipo y efecto. |

No se considerara correcta una implementacion que:

- fabrique `gate_hash` sobre fuentes inexistentes;
- muestre `minute_id` vacio sin explicacion;
- reutilice `agreements_certified[]` para certificados que no certifican acuerdos;
- no distinga efecto registral de efecto interno;
- permita emitir sin autoridad verificable cuando el tipo la exige;
- oculte que el entorno es de validacion funcional cuando la firma/sello sea sandbox.

### 6.5. Revision documental

**Objetivo:** bandeja unica para revisar informes, anexos y certificaciones antes de archivo, sustitucion o emision.

Copy recomendado:

| Elemento | Texto propuesto |
|---|---|
| H1 | Revision documental |
| Subcopy | Revisa documentos generados o anexados antes de aprobarlos, archivarlos o marcarlos como sustituidos. |
| Cola | Pendientes de revision |
| Cerrados | Documentos cerrados |
| Empty pendientes | No hay documentos pendientes de revision. Los documentos generados apareceran aqui antes de su cierre. |
| Empty cerrados | No hay documentos cerrados todavia. |
| CTA revisar | Revisar |
| CTA aprobar | Aprobar documento |
| CTA archivar | Archivar |
| CTA sustituir | Marcar como sustituido |
| Tooltip sustituir | Usa esta accion cuando exista una version posterior o el documento ya no deba utilizarse. |
| Success aprobar | Documento aprobado para el expediente. |
| Success archivar | Documento archivado con trazabilidad. Conservamos su huella y version. |
| Success sustituir | Documento marcado como sustituido. Conservamos la version anterior por trazabilidad. |

### 6.6. Registro y libros

Copy recomendado:

| Elemento | Texto propuesto |
|---|---|
| Area | Registro y libros |
| H1 tramitador | Tramitador registral |
| Subcopy tramitador | Prepara la elevacion, presentacion, subsanacion e inscripcion de acuerdos con trazabilidad documental. |
| H1 libros | Libros societarios |
| Subcopy libros | Controla libros obligatorios, registros auxiliares, legalizaciones y alertas por sociedad. |
| Estado presentado | Presentado al registro |
| Estado inscrito | Inscrito |
| Estado denegado | Denegado por el registro |
| Estado subsanacion | Subsanacion requerida |
| CTA elevar | Preparar elevacion |
| CTA presentar | Registrar presentacion |
| CTA subsanar | Preparar subsanacion |

### 6.7. Sociedades, personas y cargos

**Objetivo:** convertir esta area en el modelo canonico visible del modulo. No debe sentirse como un directorio administrativo, sino como el lugar donde se gobiernan identidad societaria, cargos vigentes, representantes, socios, capital, autoridad certificante y capacidad para firmar o certificar.

**Problema actual:** la navegacion separa `Sociedades` y `Personas y cargos`, pero el usuario puede no entender que un dato incompleto aqui bloquea o condiciona certificaciones, convocatorias, quorums, libros y expedientes.

Estructura propuesta:

1. Vista `Sociedades`: ficha maestra, estado operativo, organos, socios, capital, libros, reglas aplicables, autoridad y alertas.
2. Vista `Personas, cargos y representantes`: personas fisicas y juridicas, cargos vigentes, historico, representantes de PJ, conflictos, delegaciones y certificabilidad.
3. Vista detalle persona: identidad, cargos, representaciones, participaciones, autoridad, certificados disponibles y bloqueos.
4. Vista detalle sociedad: situacion operativa, organos, cap table, libros, materias aplicables, documentos, autoridad y proximas acciones.

Copy recomendado:

| Elemento | Texto propuesto |
|---|---|
| Area | Sociedades y personas |
| H1 sociedades | Sociedades |
| Subcopy sociedades | Consulta y mantiene los datos maestros societarios: forma social, organos, capital, libros, reglas aplicables y estado operativo. |
| H1 personas | Personas, cargos y representantes |
| Subcopy personas | Gestiona personas fisicas y juridicas, cargos vigentes, representantes permanentes, socios y autoridad certificante. |
| H1 detalle persona | Ficha de persona |
| Subcopy detalle persona | Identidad, cargos, representaciones, participaciones y certificaciones disponibles para esta persona. |
| H1 detalle sociedad | Ficha societaria |
| Subcopy detalle sociedad | Estado operativo de la sociedad: organos, capital, libros, materias aplicables, autoridad y proximos hitos. |
| CTA nueva sociedad | Crear sociedad |
| CTA nueva persona | Crear persona |
| CTA nuevo cargo | Añadir cargo |
| CTA representante PJ | Añadir representante de persona juridica |
| CTA emitir cert cargo | Certificar vigencia de cargo |
| CTA emitir cert titularidad | Certificar titularidad |
| CTA revisar autoridad | Revisar autoridad certificante |
| Empty personas sociedad | No hay personas vinculadas a esta sociedad. Añade una persona o asigna un cargo desde una ficha existente. |
| Empty cargos | Esta persona no tiene cargos vigentes en la sociedad seleccionada. |
| Empty representantes | No hay representantes vigentes registrados para esta persona juridica. |

Estados y avisos recomendados:

| Situacion | Texto UI |
|---|---|
| Sociedad incompleta | Ficha incompleta: faltan datos necesarios para operar con seguridad. |
| Cargos incompletos | Faltan cargos iniciales o representantes para tratar esta sociedad como operativa. |
| Persona juridica sin representante | Esta persona juridica tiene cargos de administracion sin representante persona fisica vigente. |
| Autoridad no inscrita | Cargo vigente pendiente de referencia registral. Puede limitar certificaciones frente a terceros. |
| Autoridad certificante vigente | Autoridad certificante vigente para esta sociedad u organo. |
| Censo pendiente | El censo no esta congelado para este expediente. |
| Participacion sin derechos de voto | Participacion registrada sin derechos de voto computables. |

Terminos que debe validar Legal:

- "datos maestros societarios";
- "estado operativo";
- "autoridad certificante vigente";
- "cargo vigente pendiente de referencia registral";
- "representante de persona juridica";
- "certificar vigencia de cargo";
- "certificar titularidad".

### 6.8. Configuracion, reglas y plantillas

**Objetivo:** que esta area sea entendida como gobierno juridico-documental del modulo, no como configuracion tecnica. Debe explicar que aqui se controlan materias, organos, reglas, plantillas y gates que luego afectan expedientes reales.

**Problema actual:** `Materias y reglas`, `Catalogo de organos`, `Plantillas` y `Gestor plantillas` pueden parecer pantallas administrativas equivalentes. Para Legal, en realidad tienen responsabilidades distintas: regla aplicable, organo competente, plantilla documental y ciclo de aprobacion de contenido.

Estructura propuesta:

1. `Materias y reglas`: matriz juridica por materia, organo, tipo social, modo de adopcion y jurisdiccion.
2. `Catalogo de organos`: organos disponibles, quorums, mayorias, voto de calidad, comisiones y restricciones por sociedad.
3. `Plantillas documentales`: plantillas activas, cobertura, jurisdiccion, tipo, version y estado de preparacion documental.
4. `Gobierno de plantillas`: workflow de borrador, revision, aprobacion, activacion, metadatos y archivo.
5. `Parametros normativos`: modificaciones estatutarias de la regla base, pactos y decisiones pendientes de validacion legal.

Copy recomendado:

| Elemento | Texto propuesto |
|---|---|
| Area | Configuracion y reglas |
| H1 materias | Materias y reglas |
| Subcopy materias | Revisa la regla aplicable por materia, organo, tipo social, jurisdiccion y modo de adopcion antes de iniciar un expediente. |
| H1 organos | Catalogo de organos |
| Subcopy organos | Configura organos, comisiones, quorums, mayorias, voto de calidad y restricciones aplicables. |
| H1 plantillas | Plantillas documentales |
| Subcopy plantillas | Consulta las plantillas activas que alimentan la generacion documental y la validacion documental previa. |
| H1 gestor plantillas | Gobierno de plantillas |
| Subcopy gestor plantillas | Revisa, aprueba y activa versiones documentales antes de permitir su uso en expedientes. |
| H1 parametros | Parametros normativos |
| Subcopy parametros | Gestiona modificaciones estatutarias de la regla base, pactos y decisiones legales que afectan a la regla aplicable. |
| CTA simular regla | Simular regla |
| CTA activar marco | Activar marco normativo |
| CTA revisar cobertura | Revisar cobertura documental |
| CTA editar borrador | Editar borrador |
| CTA enviar revision | Enviar a revision |
| CTA aprobar plantilla | Aprobar plantilla |
| CTA activar plantilla | Activar plantilla |
| Empty materias | No hay materias configuradas para esta combinacion. Revisa rule packs o jurisdiccion. |
| Empty plantillas | No hay plantillas activas para este filtro. Revisa cobertura o crea una version en borrador. |
| Empty organos | No hay organos configurados para esta sociedad. Añade organos antes de preparar convocatorias o acuerdos. |

Estados y avisos recomendados:

| Situacion | Texto UI |
|---|---|
| Regla sin plantilla | La regla existe, pero falta plantilla documental activa. |
| Plantilla sin regla | Esta plantilla existe, pero no esta vinculada a una regla aplicable. |
| Version en borrador | Borrador no disponible para expedientes. |
| Version revisada | Revisada por Legal, pendiente de aprobacion. |
| Version aprobada | Aprobada, pendiente de activacion. |
| Version activa | Activa para nuevos expedientes. |
| Version archivada | Archivada. Se conserva por trazabilidad, pero no se usa en nuevos expedientes. |
| Modificacion estatutaria | Los estatutos modifican o concretan la regla legal de base para esta sociedad. |
| Decision legal pendiente | Este punto requiere validacion legal antes de activar bloqueo. |

Terminos que debe validar Legal:

- "validacion documental previa (Gate PRE)";
- "rule pack";
- "marco normativo";
- "modificacion estatutaria de la regla base";
- "regla efectiva";
- "version activa para nuevos expedientes";
- "decision legal pendiente".

### 6.9. Visualizacion de jerarquia normativa y regla efectiva

**Objetivo:** que el abogado entienda por que una regla concreta aplica a una sociedad, materia y organo, y que fuente prevalece sobre cual.

La pantalla principal es `Materias y reglas`, con resumen adicional en `Ficha societaria` y `Expediente societario`.

#### 6.9.1. Capas normativas visibles

La UI debe representar la composicion normativa como capas ordenadas:

| Capa UI | Fuente tecnica | Copy recomendado | Comportamiento |
|---|---|---|---|
| Ley aplicable | `LEY` | Regla legal de base segun jurisdiccion y tipo social. | Siempre visible. Indicar si es imperativa o dispositiva. |
| Formalizacion registral | `REGISTRO` | Requisitos de inscripcion y formalizacion aplicables. | Visible cuando la materia tenga requisito registral. |
| Estatutos de la sociedad | `ESTATUTOS` | Modificacion estatutaria de la regla de base. | Visible cuando exista regla estatutaria registrada. |
| Pacto parasocial | `PACTO_PARASOCIAL` | Control contractual paralelo. Puede generar advertencias, pero no invalida automaticamente el acuerdo societario. | Visible como warning, no como bloqueo de validez societaria salvo decision legal especifica. |
| Reglamento del organo | `REGLAMENTO` | Regla operativa del organo competente. | Visible cuando el organo tenga reglamento aplicable. |
| Politica del motor | `POLITICA` | Parametrizacion operativa del sistema. | Plegada por defecto para usuario legal. |
| Trazabilidad del sistema | `SISTEMA` | Configuracion tecnica y versionado. | Oculta salvo modo tecnico avanzado. |

#### 6.9.2. Norma imperativa frente a dispositiva

La capa `LEY` debe mostrar un chip de naturaleza normativa:

| Estado | Icono | Etiqueta UI | Tooltip |
|---|---|---|---|
| Imperativa | Candado cerrado | Norma imperativa | Esta regla no puede ser desplazada por estatutos, pactos ni parametros. Cualquier clausula contraria requiere revision legal. |
| Dispositiva | Candado abierto | Norma dispositiva | Esta regla puede ser concretada o sustituida por los estatutos de la sociedad si existe modificacion estatutaria valida. |

Cuando exista modificacion estatutaria sobre una norma imperativa, la UI debe mostrar un aviso visible:

```text
Conflicto normativo: los estatutos de [Sociedad] contienen una clausula que modifica esta regla, pero la regla legal de base es imperativa. Revisa la validez de la clausula estatutaria antes de continuar.
```

Cuando la norma sea dispositiva y exista modificacion estatutaria valida:

```text
Los estatutos de [Sociedad] concretan esta regla. La regla efectiva refleja la modificacion estatutaria.
```

#### 6.9.3. Explicacion dinamica "por que esta regla"

Cada regla efectiva debe tener un enlace expandible:

```text
¿Por que esta regla?
```

La explicacion no debe ser generica. Debe nombrar fuentes concretas:

```text
Esta regla resulta de aplicar [articulo/norma] como [norma imperativa/dispositiva], modificada por [articulo estatutario] de [Sociedad]. No hay pacto parasocial ni reglamento de organo que afecte a esta materia.
```

Si falta una fuente esperada:

```text
Fuente esperada no disponible: los estatutos de [Sociedad] no estan registrados en el sistema. La regla se aplica sobre la ley de base. Si existen clausulas estatutarias relevantes, el resultado podria variar.
```

Si hay pacto parasocial:

```text
Existe un pacto parasocial que puede afectar a esta materia. El pacto no invalida automaticamente el acuerdo societario, pero puede generar obligaciones contractuales o responsabilidad entre partes.
```

#### 6.9.4. Ficha societaria y expediente

En `Ficha societaria`, el bloque `Marco normativo` debe mostrar:

- fuentes activas;
- fuentes esperadas no registradas;
- modificaciones estatutarias vigentes;
- pactos parasociales vigentes;
- reglamentos de organos;
- fecha o version del perfil normativo.

Copy recomendado:

```text
Marco normativo de [Sociedad]: fuentes activas, fuentes esperadas y parametros que afectan a materias, organos y documentacion.
```

En `Expediente societario`, el snapshot normativo debe indicar si sigue vigente:

```text
El marco normativo de la sociedad ha cambiado desde que se documento este acuerdo. Revisa si los cambios afectan al expediente.
```

### 6.10. Plantillas, versionado y cohortes de transicion

**Objetivo:** evitar que una plantilla aparezca como plenamente utilizable cuando esta activa tecnicamente pero pendiente de metadatos, revision o alineacion con una regla.

Estados UI recomendados:

| Estado UI | Uso | Consecuencia |
|---|---|---|
| Borrador | Texto o metadatos en preparacion. | No disponible para expedientes. |
| Revisada por Legal | Legal reviso contenido, pendiente de aprobacion formal. | No disponible salvo modo prueba. |
| Aprobada | Validada, pendiente de activacion. | No se usa automaticamente en nuevos expedientes. |
| Activa | Disponible para nuevos expedientes. | Puede alimentar generacion documental. |
| Activa con metadatos incompletos | Texto activo, pero faltan metadatos, semver, binding o cobertura. | Advertencia visible; no debe usarse para activar bloqueos. |
| Pendiente de upgrade tecnico | Requiere migracion SQL, normalizacion o Path B. | Visible para gobierno, no para usuario diario. |
| Pendiente de firma/revision | Requiere revision/firma legal o Path A. | No debe presentarse como gobernada. |
| Archivada | Conservada por trazabilidad. | No disponible para nuevos expedientes. |

Avisos recomendados:

| Situacion | Copy |
|---|---|
| Plantilla activa con metadatos incompletos | Esta plantilla esta activa, pero faltan metadatos de gobierno documental. Revisa version, binding, jurisdiccion y cobertura antes de usarla como base de bloqueo. |
| Plantilla sin regla | Esta plantilla existe, pero no esta vinculada a una regla aplicable. |
| Regla sin plantilla | La regla existe, pero falta plantilla documental activa. |
| Version no semver | La version de esta plantilla no sigue versionado semantico. Regulariza la version antes de promoverla. |

La pantalla `Plantillas documentales` debe permitir filtrar por estado, jurisdiccion, tipo documental, materia, organo, cohorte de transicion, metadatos incompletos y vinculacion a regla.

### 6.11. Matriz movil M1/M2/M3

El criterio de criticidad movil se concreta en tres niveles:

| Nivel | Nombre | Definicion operativa | Consecuencia de diseño |
|---|---|---|---|
| M1 | Optimizacion completa | Pantalla que se consulta bajo presion de tiempo y debe responder "que pasa ahora" en menos de 30 segundos. | Layout movil dedicado, tarjetas verticales, sin tablas horizontales, CTA principal visible sin scroll. |
| M2 | Consulta con restriccion de accion | Pantalla consultable en movil, pero con acciones juridicamente sensibles o dificiles de revertir. | Lectura movil optimizada; acciones irreversibles con confirmacion de dos pasos o reservadas a escritorio. |
| M3 | Solo escritorio | Pantalla de configuracion, gobierno o edicion compleja. | Responsive generico; sin layout movil dedicado. |

Clasificacion propuesta:

| Pantalla | Nivel | Justificacion |
|---|---|---|
| Mesa de Secretaria | M1 | Debe explicar en 30 segundos que requiere atencion. |
| Expediente societario | M1 | Muestra siguiente accion, bloqueos y pendientes antes o durante una decision. |
| Certificaciones autonomas | M2 | La consulta es util; emitir certificacion desde movil exige confirmacion reforzada o restriccion. |
| Revision documental | M2 | Aprobar, archivar o sustituir afecta expediente y trazabilidad. |
| Registro y libros | M2 | Estado y plazos son urgentes; acciones de elevacion/presentacion son complejas. |
| Ficha societaria | M2 | Lectura de organos, capital, autoridad y estado operativo. |
| Ficha de persona | M2 | Lectura de cargos vigentes, representante y autoridad. |
| Informes y anexos | M3 | Creacion documental planificada, mejor en escritorio. |
| Configuracion y reglas | M3 | Gobierno juridico-documental, no operacion reactiva. |
| Gobierno de plantillas | M3 | Comparacion y aprobacion de versiones, mejor en escritorio. |

Campos minimos en tarjetas M1:

| Pantalla | Tarjeta | Campos minimos |
|---|---|---|
| Mesa | Requiere tu atencion | Titulo, sociedad si aplica, tipo de atencion, fecha limite, CTA principal. |
| Mesa | Proximos hitos | Nombre del hito, fecha, estado de preparacion. |
| Mesa | Documentos pendientes | Titulo, tipo de documento, estado traducido, CTA `Revisar`. |
| Expediente | Header fijo | Nombre, sociedad, estado legal, entorno si aplica. |
| Expediente | Siguiente accion | Accion, responsable/rol, CTA. |
| Expediente | Que impide avanzar | Bloqueo, severidad, CTA de resolucion. |
| Expediente | Que falta completar | Lista breve de pendientes y contador. |

Criterio testeable:

```text
En movil, las pantallas M1 permiten identificar accion principal, bloqueos activos y proximo hito sin scroll horizontal ni mas de un nivel de detalle. Las pantallas M2 permiten consulta optimizada; las acciones irreversibles requieren confirmacion de dos pasos con resumen visible de fuente, autoridad, fecha de corte y consecuencia.
```

## 7. Sistema de terminos y convenciones

### 7.1. Terminos recomendados

| Concepto | Termino UI recomendado | Evitar |
|---|---|---|
| Documento persistido con hash | Documento | Artefacto, salvo en contexto tecnico. |
| Documento exigido por regla | Documento exigible | Requirement, requisito tecnico. |
| Paquete de evidencia | Bundle de evidencia | Evidence bundle solo en modo tecnico. |
| Estado sandbox | Entorno de validacion funcional | Demo, stub, sandbox sin explicacion. |
| Hash de fuente | Huella de fuente | Hash fuente como etiqueta principal. |
| Certificacion ya reemplazada | Sustituida | Superseded. |
| Certificacion con efecto frente a tercero | Efecto frente a terceros | Tercero como estado aislado. |
| Destinatario auditor | Destinatario: auditor | AUDITOR como valor suelto. |
| Estado de archivo | Archivado | ARCHIVED. |
| Estado emitido | Emitida | EMITTED. |
| Persona juridica administradora | Persona juridica administradora | PJ admin como etiqueta visible. |
| Representante permanente de PJ | Representante persona fisica | Representative ID, representante PJ sin contexto. |
| Cargo pendiente de inscripcion | Pendiente de referencia registral | No inscrito sin matiz. |
| Regla aplicable versionada | Regla efectiva | Rule pack efectivo como etiqueta principal. |
| Version documental aprobada | Plantilla aprobada | Template approved. |
| Fuente de verdad societaria | Datos maestros societarios | Fuente de verdad como promesa de fehaciencia. |
| Readiness operativo | Estado operativo | Readiness. |

### 7.2. Estados tecnicos traducidos

| Estado tecnico | Texto UI | Nota legal |
|---|---|---|
| `DRAFT` | Borrador | Documento editable o no cerrado. |
| `SOURCE_LOCKED` | Fuente fijada | Los datos certificados quedan fijados a una fecha de corte o snapshot concreto. |
| `GENERATED` | Documento generado | Todavia no implica emision. |
| `IN_REVIEW` | En revision | Pendiente de aprobacion humana. |
| `APPROVED` | Aprobado documentalmente | Aprobado para incorporacion documental al expediente, no necesariamente aprobado en cuanto al fondo juridico. |
| `SIGNED` | Firmado | Solo usar cuando la firma real o demo este clara en evidencia. |
| `EMITTED` | Emitida | Certificacion emitida en el entorno correspondiente. |
| `ARCHIVED` | Archivado | Conservado con trazabilidad. En entorno de validacion funcional no equivale a evidencia cualificada productiva. |
| `ATTACHED` | Anexado | Vinculado a otro expediente o documento. |
| `SUPERSEDED` | Sustituido | Existe version posterior o se retira de uso. |
| `REVOKED` | Revocado | Requiere criterio legal para uso y efecto. |
| `FAILED` | Fallido | Operacion no completada. |
| `WAIVED_WITH_OVERRIDE` | Omitido con autorizacion | Requiere validacion legal de etiqueta. |

### 7.3. Estados de evidencia

| Estado tecnico | Texto UI | Copy recomendado |
|---|---|---|
| `DEMO_OPERATIVA` | Entorno de validacion funcional | Resultado generado sin eficacia juridica cualificada productiva. No equivale a firma, sello o timestamp cualificado real. |
| `SEALED` | Sellada | Evidencia sellada con QTSP productivo. Validar solo cuando EAD Trust este conectado en produccion. |
| `VERIFIED` | Verificada | Evidencia verificada frente al servicio cualificado correspondiente. |
| `PENDING` | Pendiente de evidencia | El documento existe, pero aun no tiene evidencia asociada. |
| `FAILED` | Error de evidencia | No se pudo completar la evidencia. Reintentar o revisar el detalle tecnico. |

## 8. Catalogo de microcopy transversal

### 8.1. Mensajes de carga

| Contexto | Texto |
|---|---|
| Mesa | Cargando tareas y proximos hitos de la sociedad. |
| Expediente | Cargando estado del expediente. |
| Documentos | Cargando documentos y evidencias. |
| Certificacion | Preparando fuente certificable. |
| Registro | Consultando estado registral y subsanaciones. |
| Personas | Cargando personas, cargos y representantes. |
| Sociedad | Cargando ficha societaria y datos maestros. |
| Configuracion | Cargando reglas, organos y plantillas. |

### 8.2. Mensajes de error

| Contexto | Texto |
|---|---|
| Error generico | No se pudo completar la accion. Revisa los datos y vuelve a intentarlo. |
| Sin permisos | Tu rol puede consultar esta informacion, pero no ejecutar esta accion. |
| Fuente ausente | Falta seleccionar una fuente valida para continuar. |
| Autoridad ausente | No hay autoridad certificante vigente para esta sociedad u organo. Revisa cargos y evidencia de autoridad. |
| Evidencia no disponible | El documento se genero, pero la evidencia no pudo completarse en este intento. |
| Schema pendiente | Esta funcion requiere la migracion documental de informes y certificaciones. |
| Persona duplicada | Ya existe una persona con este identificador. Revisa la ficha existente antes de crear otra. |
| Representante ausente | Falta representante persona fisica vigente para esta persona juridica. |
| Cargo sin referencia registral | El cargo esta vigente, pero falta referencia registral para determinados usos frente a terceros. |
| Regla sin plantilla | La regla aplicable no tiene plantilla activa asociada. |
| Plantilla no activa | Esta plantilla no esta activa para nuevos expedientes. |

### 8.3. Mensajes de exito

| Accion | Texto |
|---|---|
| Crear informe | Informe creado y pendiente de revision. |
| Preparar fuente | Fuente preparada y huella calculada. |
| Crear certificacion | Certificacion creada a partir de la fuente seleccionada. |
| Emitir certificacion | Certificacion emitida y vinculada al expediente. Revisa el estado de evidencia antes de usarla frente a terceros. |
| Aprobar documento | Documento aprobado documentalmente para su incorporacion al expediente. |
| Archivar documento | Documento archivado con trazabilidad. Conservamos su huella y version. |
| Sustituir documento | Documento marcado como sustituido. La version anterior se conserva. |
| Crear persona | Persona creada en el modelo canonico. |
| Añadir cargo | Cargo añadido y pendiente de revision de autoridad si aplica. |
| Añadir representante | Representante registrado para esta persona juridica. |
| Activar plantilla | Plantilla activada para nuevos expedientes. |
| Aprobar regla | Regla revisada. Los cambios se aplicaran segun el flujo de activacion. |

### 8.4. Tooltips y ayudas breves

| Elemento | Texto |
|---|---|
| Huella de fuente | Identificador calculado sobre los datos que sirven de base al documento. |
| Vº Bº | Persona que debe validar la certificacion cuando la regla o el tipo social lo exija. |
| Entorno de validacion funcional | Resultado generado para validacion funcional. No equivale por si solo a evidencia cualificada productiva. |
| Fuente fijada | Los datos certificados quedan fijados a la fecha de corte indicada. Si la informacion de base cambia despues, sera necesario emitir una nueva certificacion. |
| Documento sustituido | Version conservada por trazabilidad, pero no recomendada para nuevos usos. |
| Referencia registral | Dato que acredita la inscripcion o presentacion registral asociada al cargo o acuerdo. |
| Regla efectiva | Resultado explicado de aplicar ley base, formalizacion registral, estatutos, pactos, reglamento, politica del motor y trazabilidad del sistema a una materia concreta. |
| Plantilla activa | Version documental disponible para generar nuevos expedientes. |
| Modelo canonico | Datos maestros que alimentan censos, cargos, autoridad, libros y certificaciones. |

### 8.5. Patron obligatorio de empty states

Todo estado vacio debe seguir el patron:

```text
Que pasa + por que importa + que puedo hacer ahora
```

Ejemplos revisados:

| Pantalla | Empty state recomendado |
|---|---|
| Informes y anexos | No hay informes asociados a esta sociedad. Crea uno desde una fuente canonica o abre un expediente con requisitos documentales. |
| Certificaciones autonomas | No hay certificaciones autonomas para esta sociedad. Selecciona un tipo y una fuente para preparar la primera. |
| Revision documental | No hay documentos pendientes de revision. Los documentos generados o anexados apareceran aqui antes de su cierre. |
| Documentos cerrados | No hay documentos cerrados todavia. Cuando apruebes, archives o sustituyas un documento, aparecera aqui con su trazabilidad. |
| Personas | No hay personas vinculadas a esta sociedad. Añade una persona o asigna un cargo desde una ficha existente. |
| Cargos | Esta persona no tiene cargos vigentes en la sociedad seleccionada. Añade un cargo si debe intervenir, firmar o certificar. |
| Plantillas | No hay plantillas activas para este filtro. Revisa cobertura, metadatos o crea una version en borrador. |
| Materias | No hay materias configuradas para esta combinacion. Revisa jurisdiccion, tipo social, organo o rule packs. |

## 9. Copys concretos por pantalla

### 9.1. Header de modulo

| Elemento | Texto |
|---|---|
| Breadcrumb raiz | Secretaria Societaria |
| Scope sociedad | Modo sociedad |
| Scope grupo | Modo grupo |
| Texto scope sociedad | Vista filtrada a la sociedad seleccionada. |
| Texto scope grupo | Vista de coordinacion multi-sociedad. |
| Selector sociedad | Sociedad seleccionada |

### 9.2. Mesa

```text
H1: Mesa de Secretaria
Subcopy: Revisa primero los hitos, documentos y bloqueos que pueden afectar al ciclo societario de esta sociedad.

Seccion: Requiere tu atencion
Empty: No hay acciones urgentes para esta sociedad.

Seccion: Proximos hitos
CTA: Ver calendario societario

Seccion: Accesos frecuentes
CTA: Preparar convocatoria
CTA: Nueva reunion
CTA: Nuevo acuerdo sin sesion
CTA: Revisar documentos
CTA: Abrir tramitador registral
```

### 9.3. Informes y anexos

```text
H1: Informes y anexos
Subcopy: Prepara o anexa documentos exigibles por materia y vinculos al expediente correspondiente.

Campo: Tipo de documento
Campo: Fuente del documento
Campo: Titulo del informe
Campo: Referencia de fuente

Ayuda: Selecciona una fuente canonica cuando el informe derive de un expediente. Usa referencia manual solo para soportes externos.
CTA: Crear informe
Disabled: Introduce un titulo para crear el informe.
Empty: No hay informes asociados a esta sociedad.
```

### 9.4. Certificaciones autonomas

```text
H1: Certificaciones autonomas
Subcopy: Emite certificaciones desde libros, cargos, capital, acuerdos o fuentes canonicas sin depender necesariamente de un acta.

Paso 1: Tipo de certificacion
Paso 2: Fuente certificable
Paso 3: Resumen y fecha de corte
Paso 4: Autoridad y Vº Bº
Paso 5: Generacion y emision

CTA: Preparar fuente
CTA: Generar certificacion
CTA: Emitir certificacion
CTA: Ver certificacion

Empty: No hay certificaciones autonomas para esta sociedad.
Disabled emitida: Esta certificacion ya esta emitida. Puedes verla o marcarla como sustituida.
Aviso fuente: Los datos certificados quedan fijados a la fecha de corte indicada. Si la informacion de base cambia despues, sera necesario emitir una nueva certificacion.
Aviso entorno: Entorno de validacion funcional, sin eficacia juridica cualificada productiva.
```

### 9.5. Revision documental

```text
H1: Revision documental
Subcopy: Revisa documentos generados o anexados antes de aprobarlos, archivarlos o marcarlos como sustituidos.

Seccion: Pendientes de revision
Seccion: Documentos cerrados

CTA: Revisar
CTA: Aprobar documento
CTA: Archivar
CTA: Marcar como sustituido

Empty pendientes: No hay documentos pendientes de revision.
Empty cerrados: No hay documentos cerrados todavia.
```

### 9.6. Expediente 360

```text
H1: Expediente societario
Subcopy: Estado completo del asunto: adopcion, documentacion, certificacion, registro y evidencia asociada.

Seccion: Siguiente accion
Seccion: Estado legal
Seccion: Documentos y anexos
Seccion: Certificaciones
Seccion: Registro
Seccion: Evidencia y auditoria

Empty documentos: Este expediente todavia no tiene documentos asociados.
Empty certificaciones: Todavia no se han generado certificaciones para este expediente.
```

### 9.7. Sociedades y personas

```text
H1: Sociedades
Subcopy: Consulta y mantiene los datos maestros societarios: forma social, organos, capital, libros, reglas aplicables y estado operativo.

H1: Personas, cargos y representantes
Subcopy: Gestiona personas fisicas y juridicas, cargos vigentes, representantes permanentes, socios y autoridad certificante.

H1: Ficha de persona
Subcopy: Identidad, cargos, representaciones, participaciones y certificaciones disponibles para esta persona.

H1: Ficha societaria
Subcopy: Estado operativo de la sociedad: organos, capital, libros, materias aplicables, autoridad y proximos hitos.

CTA: Crear persona
CTA: Añadir cargo
CTA: Añadir representante de persona juridica
CTA: Certificar vigencia de cargo
CTA: Certificar titularidad
CTA: Revisar autoridad certificante

Empty personas: No hay personas vinculadas a esta sociedad.
Empty cargos: Esta persona no tiene cargos vigentes en la sociedad seleccionada.
Aviso: Esta persona juridica tiene cargos de administracion sin representante persona fisica vigente.
Aviso: Cargo vigente pendiente de referencia registral. Puede limitar certificaciones frente a terceros.
```

### 9.8. Configuracion y reglas

```text
H1: Materias y reglas
Subcopy: Revisa la regla aplicable por materia, organo, tipo social, jurisdiccion y modo de adopcion antes de iniciar un expediente.

H1: Catalogo de organos
Subcopy: Configura organos, comisiones, quorums, mayorias, voto de calidad y restricciones aplicables.

H1: Plantillas documentales
Subcopy: Consulta las plantillas activas que alimentan la generacion documental y la validacion documental previa.

H1: Gobierno de plantillas
Subcopy: Revisa, aprueba y activa versiones documentales antes de permitir su uso en expedientes.

CTA: Simular regla
CTA: Activar marco normativo
CTA: Revisar cobertura documental
CTA: Enviar a revision
CTA: Aprobar plantilla
CTA: Activar plantilla

Empty materias: No hay materias configuradas para esta combinacion.
Empty plantillas: No hay plantillas activas para este filtro.
Aviso: La regla existe, pero falta plantilla documental activa.
Aviso: Este punto requiere validacion legal antes de activar bloqueo.
Aviso: Esta plantilla esta activa, pero faltan metadatos de gobierno documental.
```

## 10. Puntos que requieren validacion legal

| Punto | Pregunta para Legal | Impacto |
|---|---|---|
| "Entorno de validacion funcional" | ¿Es la expresion preferente para diferenciar sandbox/stub de evidencia cualificada productiva? | Alto. Afecta a confianza y disclaimers. |
| "Huella de fuente" | ¿Puede sustituir a "hash de fuente" como texto visible principal? | Medio. Mejora comprension. |
| "Fuente fijada a fecha de corte" | ¿Describe correctamente la fijacion de datos certificables como garantia de integridad? | Alto. Afecta a certificaciones. |
| "Aprobado documentalmente" | ¿Evita confusion con aprobacion legal del contenido sustantivo? | Alto. |
| "Archivado con trazabilidad" | ¿Es juridicamente mas seguro que "archivado como evidencia operativa" en entorno demo? | Alto. |
| "Emitida" | ¿Debe reservarse solo a certificaciones con autoridad certificante vigente, documento cerrado y efecto declarado? | Alto. |
| "Sustituido" | ¿Es preferible "sustituido" o "reemplazado"? | Bajo/medio. |
| "Certificaciones autonomas" | ¿Es la denominacion juridica/comercial adecuada? | Medio. |
| "Expediente 360" | ¿Debe usarse internamente o cambiar a "Expediente societario"? | Medio. |
| "Board pack" | ¿Debe traducirse como "Paquete del consejo" en UI Garrigues? | Medio. |
| "Datos maestros societarios" | ¿Debe ser el texto visible en lugar de "fuente de verdad societaria"? | Medio. |
| "Estado operativo" | ¿Debe sustituir de forma definitiva a "readiness operativo"? | Medio. |
| "Cargo vigente pendiente de referencia registral" | ¿Describe correctamente la diferencia entre vigencia interna e inscripcion? | Alto. |
| "Autoridad certificante vigente" | ¿Debe incluir siempre referencia a secretario, Vº Bº o cargo inscrito? | Alto. |
| "Regla efectiva" | ¿Es el termino correcto si se acompaña siempre de fuentes concretas y enlace "¿Por que esta regla?"? | Alto. |
| "Modificacion estatutaria de la regla de base" | ¿Es el texto visible preferente para sustituir "override estatutario"? | Medio/alto. |
| "Validacion documental previa" | ¿Debe reemplazar "Gate PRE" en toda UI legal visible? | Medio. |
| "Plantilla activa" | ¿Debe entenderse como aprobada para nuevos expedientes o solo disponible tecnicamente? | Medio. |
| "Norma imperativa/dispositiva" | ¿Debe mostrarse como chip en Materias y reglas y en snapshots de expediente? | Alto. |
| "Pacto parasocial" | ¿Es correcta la formulacion de warning contractual paralelo sin invalidez societaria automatica? | Alto. |
| "M1/M2/M3 movil" | ¿Aprueba Legal que acciones M2 tengan confirmacion reforzada o se reserven a escritorio? | Alto. |

## 11. Criterios de aceptacion UX

La propuesta se considerara lista para implementacion cuando Legal y Producto validen:

1. No hay copy que presente evidencia demo como evidencia cualificada productiva.
2. Los estados visibles distinguen documento, certificacion, revision, firma, archivo y evidencia.
3. Las certificaciones explican fuente, fecha de corte, autoridad y Vº Bº antes de emitir.
4. Los informes explican que fuente o requisito documental satisfacen.
5. Los empty states indican una accion posible o explican por que no hay datos.
6. Las acciones deshabilitadas tienen razon visible.
7. Los terminos tecnicos quedan relegados a detalle avanzado.
8. En movil, las pantallas M1 permiten identificar accion principal, bloqueos activos y proximo hito sin scroll horizontal ni mas de un nivel de detalle.
9. Personas, cargos, representantes y autoridad explican su impacto en certificaciones, censos y expedientes.
10. Configuracion y reglas distinguen regla juridica, organo, plantilla, version y validacion documental previa.
11. Ninguna pantalla de configuracion permite activar bloqueos sin marcar decisiones legales pendientes cuando aplique.
12. `Materias y reglas` explica jerarquia normativa y naturaleza imperativa/dispositiva de la capa legal.
13. Plantillas en transicion muestran metadatos incompletos, pendiente de upgrade o pendiente de revision/firma.
14. Las pantallas M2 permiten consulta optimizada; las acciones irreversibles requieren confirmacion de dos pasos o restriccion a escritorio.
15. El wizard de certificaciones autonomas muestra datos canonicos de solo lectura, huella de fuente, fecha de corte, plantilla de tres capas, preview, autoridad, Vº Bº, efecto declarado y estado de evidencia antes de emitir.
16. La Capa 3 no permite reescribir datos certificables; si la fuente es incorrecta, el flujo obliga a corregir la fuente primaria y recalcular la huella.
17. La auditoria de certificaciones autonomas permite reconstruir que datos vio el secretario, que huella se calculo, que plantilla se uso, que autoridad se verifico y que disclaimers acepto.
18. La implementacion no reutiliza el `gate_hash` registral para fuentes autonomas ni fabrica hashes sobre actas inexistentes.

## 12. Plan de implementacion recomendado

### Fase UX-0: Aprobacion legal prioritaria de lenguaje y efectos

- Validar glosario de estados.
- Validar texto visible para `DEMO_OPERATIVA`: `Entorno de validacion funcional - sin eficacia juridica cualificada productiva`.
- Validar copy de certificaciones autonomas, autoridad, Vº Bº, efecto declarado y fuente fijada.
- Validar copy de evidencia, archivo, emision, sustitucion y aprobacion documental.
- Validar `regla efectiva`, jerarquia normativa, norma imperativa/dispositiva y modificacion estatutaria.
- Validar uso de "Expediente societario" como termino central.
- Esta fase debe producir cambios de copy incluso antes de implementar el wizard completo de certificaciones.

### Fase UX-1: Shell y navegacion

- Reducir sidebar a areas principales.
- Corregir breadcrumbs y tildes.
- Uniformar header de sociedad/grupo.
- Añadir razon visible a estados de scope.

### Fase UX-2: Mesa de Secretaria

- Reorganizar `/secretaria` por prioridad, hitos, documentos, bloqueos y accesos.
- Separar señales externas de actos societarios.
- Mantener contratos tecnicos plegados.

### Fase UX-3: Documentacion

- Rediseñar informes y anexos alrededor de fuente y requisito.
- Rediseñar revision documental con estados traducidos y acciones explicadas.
- Sustituir tablas moviles por listas resumidas segun matriz M1/M2/M3.

### Fase UX-4: Certificaciones

- Sustituir formulario de UUIDs por wizard guiado.
- Mostrar solo campos relevantes segun tipo.
- Añadir resumen certificable, fuente fijada, fecha de corte, autoridad, Vº Bº, efecto declarado y disclaimer de entorno.
- Separar visualmente certificacion registral de acuerdos y certificacion autonoma.

### Fase UX-5: Expediente societario

- Unificar estado de acuerdo, acta, certificaciones, anexos, registro y evidencia.
- Añadir timeline y siguiente accion.
- Consolidar panels de "que falta", "que bloquea" y "que puedo hacer".

### Fase UX-6: Sociedades, personas y autoridad

- Rediseñar `Sociedades` como ficha maestra y estado operativo societario.
- Rediseñar `Personas y cargos` como modelo canonico visible, no como directorio.
- Hacer explicitos representantes de PJ, cargos pendientes de referencia registral y autoridad certificante.
- Conectar CTAs contextuales a certificaciones de cargo, titularidad, representante y autoridad.

### Fase UX-7: Configuracion, reglas y plantillas

- Separar visualmente regla efectiva, jerarquia normativa, organo, plantilla y workflow de aprobacion documental.
- Reescribir copys de `Materias y reglas`, `Catalogo de organos`, `Plantillas` y `Gestor plantillas`.
- Añadir avisos de decision legal pendiente, regla sin plantilla, plantilla sin regla y plantilla activa con metadatos incompletos.
- Mostrar capas `LEY`, `REGISTRO`, `ESTATUTOS`, `PACTO_PARASOCIAL`, `REGLAMENTO`, `POLITICA` y `SISTEMA` segun disponibilidad.
- Mantener opciones avanzadas plegadas para no mezclar gobierno juridico con trabajo diario.

## 13. No objetivos

Este rediseño no debe:

- cambiar el motor legal sin decision juridica;
- ocultar que el entorno actual es demo/pre-release cuando aplique;
- prometer inscripcion, eficacia frente a terceros o evidencia cualificada si el flujo no lo acredita;
- introducir lenguaje comercial o marketing dentro de pantallas operativas;
- mezclar ownership de TGMS, Secretaria, GRC y AI Governance;
- reemplazar revision profesional por automatizacion opaca.

## 14. Recomendacion final

El rediseño debe implementarse como una evolucion incremental, no como reescritura. La prioridad es cerrar la brecha de comprension:

1. primero lenguaje, estados y navegacion;
2. en paralelo, aplicar copy prioritario de certificaciones, evidencia, autoridad y regla efectiva;
3. despues sociedades/personas y configuracion, porque alimentan autoridad, reglas y plantillas;
4. despues dashboard/mesa con matriz movil M1;
5. despues documentos y certificaciones con matriz movil M2;
6. finalmente expediente unificado.

La mejora de copy es especialmente urgente en certificaciones y evidencia, porque son las pantallas con mayor riesgo de interpretacion juridica incorrecta. Esa mejora debe ejecutarse en UX-0 aunque el rediseño completo del wizard se implemente en UX-4. La UI debe hacer visible que TGMS ayuda a preparar, revisar, emitir y archivar, pero que la eficacia juridica depende de autoridad, fuente, firma, sello, entorno y gates aprobados.
