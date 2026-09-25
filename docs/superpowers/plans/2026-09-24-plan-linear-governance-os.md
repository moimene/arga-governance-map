# Plan de Linear · Governance OS · Secretaría y AIMS — nota de continuidad (24-09-2026)

Proyecto de Linear: https://linear.app/moimene/project/governance-os-secretaria-y-aims-2531df3c8758 · Protocolo: https://linear.app/moimene/document/protocolo-de-ejecucion-contexto-comun-para-agentes-y-personas-40a22d2940cf

## Qué se hizo

- Se inventarió en solo lectura todo lo pendiente desde el informe del 14-09-2026 (`docs/superpowers/reviews/2026-09-14-backlog-consolidacion-aims.md`): conversaciones de Claude y Codex, registros de programa, rama RIA, trabajo sin guardar del grupo nuevo, base de datos y producción. Salieron 137 pendientes verificados en seis familias.
- Se agruparon en 102 issues sin duplicados: los 7 que ya había (MOI-15, MOI-16, MOI-53 a MOI-57) y 95 nuevos (MOI-123 a MOI-217). La «versión from scratch» se interpretó como el tercer entorno «Grupo Nuevo» (…0003) creado el 19-09-2026, coherente con M1 y MOI-53 de Linear; el relevo de Lovable quedó fuera por indicación de Moisés.
- En Linear: 10 etiquetas «GOS · …», 3 hitos nuevos (M0, M3, M4) y descripciones en lenguaje llano de M1 y M2, el documento «Protocolo de ejecución», la descripción del proyecto reescrita (conserva debajo, íntegra, la del 23-09-2026 en «Secciones anteriores»), 95 issues nuevos con descripción completa, los 7 existentes ampliados con su explicación, contexto técnico, puerta humana, dependencias y referencias (su texto anterior intacto) y 92 relaciones de bloqueo.
- Cambios de relación en issues existentes: MOI-54 deja de bloquear MOI-15 y MOI-55 (los recorridos no necesitan la separación completa; sigue bloqueando MOI-57). Se conservan las relaciones con MOI-32 y MOI-34 (proyecto Common AI Platform).

## Cómo leer un issue

Cinco apartados para personas («Para entenderlo sin ser técnico»), luego contexto técnico verificado con fecha, qué hay que hacer, criterios de hecho con nivel exigido, puerta humana, dependencias (generadas del diseño) y referencias con la clave de plan. El vocabulario está en el glosario de la descripción del proyecto.

## Hitos y orden

M0 base gobernada (primero) → M1 grupo desde cero y Secretaría → M2 AIMS y transversal (aceptación en MOI-57). M3 (RIA con fecha en 2026) avanza en paralelo desde hoy, pero necesita a tiempo MOI-153 (cuenta de cumplimiento de ARGA), MOI-162 (plan de acción) y las designaciones de MOI-159 y MOI-155. M4 cuando haya capacidad.

## Estado real al corte (24-09-2026, ~15:45 UTC, solo lectura)

- `main` = `origin/main` = `b1721a5` (14-09); producción sirve ese despliegue.
- Base de datos de producción en `20260920140000` (354 versiones); cuatro cambios solo están en la rama `aims/cobertura-ria-2026-09-19`, 41 commits por delante y sin copia en GitHub. Dos pruebas de `main` fallan por ello.
- Grupo nuevo (…0003) provisionado; su código sin commit en el árbol compartido. 37 copias de trabajo, 53 ramas locales.
- 0 cuestionarios de clasificación de IA; ninguna evaluación congelada ni revisada; ninguna acta con custodia final.

## Reglas duras

Las del protocolo: autorización escrita de Moisés para cambiar la base de datos de producción, incorporar a `main` (publica) o subir ramas; commits por rutas explícitas y nunca el material ajeno; ARGA no cambia sin cambio declarado y autorizado; el dato de Garrigues persiste; EAD Trust solo interposición, mensajería básica y custodia; sin nombre real del cliente; los agentes no crean cuentas ni manejan contraseñas; lo jurídico lo deciden los comités o el equipo legal.

## Incidencias y cómo quedaron

- El conector de Linear de Claude estuvo «pendiente» casi toda la sesión: las escrituras se hicieron con el plugin de Linear de Codex (`codex exec --approve-for-me`, revisión automática de aprobaciones). Al final el conector quedó disponible y se usó para verificar.
- Linear limita a 80 caracteres el nombre de un hito: M0 se acortó.
- Varios errores 502 de Linear durante la creación: cada reintento se hizo tras buscar por clave de plan; no hay duplicados (95 identificadores únicos).
- Linear crea relaciones «relacionado» a partir de las menciones de las descripciones y solo admite una relación por par: en la primera pasada se restauraron por error esas relaciones automáticas en vez de dejar los bloqueos. Se repitió aceptando la conversión: los 92 bloqueos están aplicados y verificados. Muchos pares tienen además la relación automática «relacionado» por mención; no bloquea.
- No se detectó sincronización con GitHub ni espejos (ningún adjunto inesperado).

## Lo que Moisés tiene delante, en orden

1. MOI-123: autorizar subir a GitHub la rama RIA (urgente: es la única copia).
2. MOI-124: decidir cómo llega el trabajo RIA a la versión principal (recomendación: fusionar la rama entera).
3. MOI-211: autorizar, si quiere, las sondas que escriben para comprobar hoy producción.
4. MOI-126 y MOI-205: autorizar guardar el grupo nuevo en una rama y quitar el permiso de vaciar tablas.
5. M1: MOI-131 (nombre del grupo nuevo) y MOI-132 (local o publicado); después, los recorridos por pantalla (MOI-53, MOI-15).
6. Designar a las personas que faltan: responsable de cumplimiento de Garrigues y segunda revisora (MOI-159, MOI-155), DPO del despacho (MOI-156), persona del CATIT (MOI-153) y quien concilie los módulos de GRC de ARGA (MOI-189).
7. Llevar a los comités lo que vence antes del 13-11-2026: MOI-182 (Comité de IA, CP-2 y CP-3), MOI-172 (equipo legal, cuestionario v2), MOI-166 (equipo legal, ayudas) y MOI-168 (experto); MOI-178 (secreto profesional) antes del 30-11 y 18-12.
8. MOI-216: pedir a EAD Trust la confirmación de lo que cubre su contrato.

## Cómo retomar

Texto listo para pegar en una sesión nueva:

> Retoma el plan de Linear del proyecto «Governance OS · Secretaría y AIMS» (https://linear.app/moimene/project/governance-os-secretaria-y-aims-2531df3c8758). Lee primero la descripción del proyecto y el documento «Protocolo de ejecución». La nota de continuidad está en `docs/superpowers/plans/2026-09-24-plan-linear-governance-os.md` y la copia de referencia de las explicaciones en `docs/superpowers/plans/2026-09-24-governance-os-explicaciones-para-personas.md`. Aplica la skill gobernanza-repo-linear en modo operar: antes de trabajar un issue, léelo completo con sus relaciones, comprueba el estado real y respeta las puertas humanas.

## Inventario final

- Creados: 10 etiquetas, 3 hitos, 1 documento (protocolo), 95 issues (MOI-123 a MOI-217), 92 relaciones de bloqueo.
- Actualizados: descripción del proyecto (antepuesta, la anterior conservada), descripciones de M1 y M2, protocolo (segunda versión), 7 issues existentes (explicación y secciones añadidas; texto anterior intacto) y 2 relaciones retiradas (MOI-54 → MOI-15 y MOI-54 → MOI-55).
- Sin cambios: títulos, prioridades y estados de los 7 existentes; relaciones con MOI-32 y MOI-34; el resto de proyectos del equipo.

## Pruebas de lectura y revisión de fidelidad

- Revisión adversarial del diseño: Kimi (kimi-k3) y DeepSeek V4 Pro Max (CLI de Devin). Aportaron, entre otros, las fechas de CP-2 y CP-3 (M3), el adelanto a M0 del permiso de vaciar tablas, la decisión sobre borrar sistemas de IA antes de clasificar (MOI-210), la prueba automática de AIMS como Garrigues (MOI-214) y la separación de criterio y ejecución en los plazos DORA (MOI-163 y MOI-215).
- Comprobador de la skill: sin hallazgos salvo dos excepciones documentadas (las relaciones con MOI-32 y MOI-34, de otro proyecto, y el término legal «responsable del despliegue», que el comprobador confunde con «despliegue»).
- Pruebas de lectura con un lector independiente: primera pasada (100 tareas, ninguna incomprensible, 30 con problemas y 16 en la descripción), segunda pasada exigente (30 tareas con ajustes), tercera pasada: 102 de 102 tareas SÍ/SÍ.
- Fidelidad: Kimi y DeepSeek revisaron los 100 textos completos; unos 67 hallazgos valorados uno a uno (aceptados, adaptados o descartados con motivo en los avisos de cada borrador).

## Después de publicar: el plan ya se está ejecutando (25-09-2026)

Al verificar lo publicado (madrugada del 25-09-2026), otra sesión había empezado a ejecutar el plan en el árbol compartido y en Linear. No se ha tocado nada de ese trabajo. Estado observado en solo lectura:
- En `origin/main`, de más antiguo a más reciente: fusión de la rama RIA (`a195a661`), permiso de vaciar tablas retirado (MOI-205), arreglo de los escenarios de demostración (MOI-127), CLAUDE.md al día (MOI-130), numeración de junio cuadrada (MOI-128), cuentas del grupo nuevo en la rotación (MOI-135), tipos de certificación desactivados (MOI-145) y plantillas demo sin «aprobada legalmente» (MOI-137). Cabeza: `a381acb9` (25-09 01:20). La rama RIA y la del grupo nuevo (`grupo-nuevo/tenant-cero-2026-09-19`) ya están en GitHub.
- En Linear, en «Done»: MOI-123 a MOI-132, MOI-135, MOI-137, MOI-145, MOI-205 y MOI-211; MOI-54 «In Progress». Esos cambios de estado y de asignado los hizo esa sesión, no esta.
- Consecuencia: el «Estado verificado al corte» de la descripción del proyecto y del protocolo es el del 24-09 a las 15:45 UTC y ya no describe el repositorio. Quien retome debe volver a medir antes de actuar (el propio protocolo lo exige).
- Verificación de lo publicado (relectura completa de los 102 issues): comprobador sin hallazgos salvo tres excepciones justificadas: las relaciones con MOI-32 y MOI-34 (otro proyecto), el término «responsable del despliegue» y seis explicaciones que superan el tope en 1 a 7 caracteres solo por el formato que Linear añade a las listas (sus borradores están dentro del límite).

## Correspondencia de identificadores y claves

| Issue | Hito | Etiquetas | Asignado | Prioridad | Clave de plan |
| --- | --- | --- | --- | --- | --- |
| MOI-123 · Repositorio · Poner a salvo en GitHub el programa RIA, que hoy solo existe en este ordenador | M0 | Plataforma, Gobierno, Decisión | Moisés | Urgent | `plan:governance-os:m0-rama-ria-a-salvo` |
| MOI-124 · Repositorio · Decidir cómo llega a la versión principal el trabajo RIA que ya está en la base de datos | M0 | Plataforma, RIA, Decisión | Moisés | Urgent | `plan:governance-os:m0-decidir-integracion-ria` |
| MOI-125 · Repositorio · Incorporar el trabajo RIA a la versión principal, publicarlo y comprobarlo con las cuentas de ARGA y Garrigues | M0 | Plataforma, RIA, Ventana | — | Urgent | `plan:governance-os:m0-fusionar-ria` |
| MOI-126 · Repositorio · Guardar en GitHub el trabajo del grupo nuevo tras pasar todas las pruebas | M0 | Plataforma, Grupo nuevo, Decisión, Ventana | Moisés | High | `plan:governance-os:m0-guardar-grupo-nuevo` |
| MOI-127 · Repositorio · Rescatar el arreglo que evita que los escenarios de demostración se atribuyan siempre a ARGA | M0 | Plataforma, Gobierno | — | Medium | `plan:governance-os:m0-rescatar-demo-operable` |
| MOI-128 · Repositorio · Hacer que el repositorio y la base de datos numeren igual los 26 cambios de junio | M0 | Plataforma, Decisión | Moisés | Medium | `plan:governance-os:m0-cuadrar-migraciones-junio` |
| MOI-129 · Repositorio · Retirar las copias de trabajo, ramas y restos que ya no se usan | M0 | Plataforma, Gobierno, Decisión | Moisés | Low | `plan:governance-os:m0-limpiar-copias` |
| MOI-130 · Repositorio · Poner al día el documento de instrucciones para agentes con el estado real de hoy | M0 | Plataforma, Gobierno | — | Medium | `plan:governance-os:m0-actualizar-claude-md` |
| MOI-205 · Plataforma · Quitar a los usuarios el permiso de vaciar tablas enteras | M0 | Plataforma, Ventana | — | High | `plan:governance-os:m0-revocar-vaciado` |
| MOI-211 · Repositorio · Comprobar hoy que la versión publicada funciona con la base de datos actual | M0 | Plataforma, Gobierno, Ventana | — | High | `plan:governance-os:m0-comprobar-produccion-hoy` |
| MOI-15 · Secretaría · Validar el ciclo societario y documental en un grupo nuevo | M1 | Secretaría, Grupo nuevo | Moisés | Urgent | `plan:governance-os:moi-15` |
| MOI-16 · Gobernanza · Verificar comunicaciones y custodia en el alcance del prototipo | M1 | Secretaría, Plataforma | — | High | `plan:governance-os:moi-16` |
| MOI-53 · Gobernanza · Dar de alta un grupo desde cero sin datos demo | M1 | Grupo nuevo | Moisés | Urgent | `plan:governance-os:moi-53` |
| MOI-54 · Gobernanza · Separar núcleo común, configuración de grupo y simulaciones | M1 | Grupo nuevo, Plataforma | — | Urgent | `plan:governance-os:moi-54` |
| MOI-131 · Grupo nuevo · Confirmar o cambiar el nombre «Grupo Nuevo» del tercer entorno | M1 | Grupo nuevo, Decisión | Moisés | High | `plan:governance-os:m1-nombre-grupo-nuevo` |
| MOI-132 · Grupo nuevo · Decidir si el primer recorrido del grupo nuevo se hace en local o en la versión publicada | M1 | Grupo nuevo, Decisión | Moisés | High | `plan:governance-os:m1-donde-ver-grupo-nuevo` |
| MOI-133 · Grupo nuevo · Enlazar las dos cuentas del grupo nuevo a personas de su censo | M1 | Grupo nuevo, Ventana | — | High | `plan:governance-os:m1-enlazar-cuentas-persona` |
| MOI-134 · Grupo nuevo · Que el menú de usuario no mande a otro entorno ni impida volver al propio | M1 | Grupo nuevo | — | Low | `plan:governance-os:m1-menu-cambiar-entorno` |
| MOI-135 · Grupo nuevo · Incluir las cuentas del grupo nuevo en la gestión de contraseñas de demostración | M1 | Grupo nuevo, Plataforma | — | Medium | `plan:governance-os:m1-contrasenas-grupo-nuevo` |
| MOI-136 · Grupo nuevo · Incorporar a la versión principal y publicar el trabajo del grupo nuevo | M1 | Grupo nuevo, Ventana | — | High | `plan:governance-os:m1-publicar-grupo-nuevo` |
| MOI-137 · Secretaría · Dejar de presentar como «aprobadas legalmente» plantillas aprobadas con un marcador de demostración | M1 | Secretaría, Ventana | — | High | `plan:governance-os:m1-plantillas-sin-aprobacion-nominativa` |
| MOI-138 · Comité Legal · Fijar las citas y los regímenes legales correctos en plantillas y reglas | M1 | Comités, Secretaría | Moisés | High | `plan:governance-os:m1-comite-citas-desfasadas` |
| MOI-139 · Secretaría · Corregir las citas desfasadas en ARGA y evitar que el grupo nuevo las herede | M1 | Secretaría, Grupo nuevo, Ventana | — | High | `plan:governance-os:m1-corregir-citas` |
| MOI-140 · Comité Legal · Definir las reglas de las comisiones delegadas y el alcance de su plantilla de acta | M1 | Comités, Secretaría | Moisés | Medium | `plan:governance-os:m1-comite-comision-delegada` |
| MOI-141 · Secretaría · Cargar las reglas de las comisiones delegadas según el criterio del Comité Legal | M1 | Secretaría, Ventana | — | Medium | `plan:governance-os:m1-reglas-comision-delegada` |
| MOI-142 · Secretaría · Permitir emitir la convocatoria de una Junta, no solo la de un Consejo | M1 | Secretaría, Ventana | — | High | `plan:governance-os:m1-junta-convocatoria` |
| MOI-143 · Secretaría · Poder generar el acta de una Junta computando por capital | M1 | Secretaría, Ventana | — | High | `plan:governance-os:m1-junta-acta` |
| MOI-144 · Secretaría · Decidir si se construye la custodia final de actas con EAD Trust, sin la cual no se pueden emitir certificaciones | M1 | Secretaría, Decisión | Moisés | Medium | `plan:governance-os:m1-custodia-actas-ead` |
| MOI-145 · Secretaría · Desactivar los tipos de certificación que afirman envío, entrega o firma cualificada | M1 | Secretaría, Ventana | — | Medium | `plan:governance-os:m1-certificaciones-que-afirman-envio` |
| MOI-216 · Secretaría · Obtener de EAD Trust la confirmación contractual y técnica de lo que cubre el servicio contratado | M1 | Secretaría, Gobierno | Moisés | Medium | `plan:governance-os:m1-confirmacion-ead` |
| MOI-55 · AIMS · Completar un recorrido operativo en un grupo nuevo | M2 | AIMS, Grupo nuevo | Moisés | Urgent | `plan:governance-os:moi-55` |
| MOI-56 · Gobernanza · Conectar AIMS y Secretaría mediante trabajo y evidencia persistentes | M2 | AIMS, Secretaría | — | High | `plan:governance-os:moi-56` |
| MOI-57 · Gobernanza · Acreditar Secretaría y AIMS sobre un tercer grupo desde cero | M2 | Grupo nuevo, Gobierno | Moisés | Urgent | `plan:governance-os:moi-57` |
| MOI-146 · Grupo nuevo · Recorrer GRC y el canal interno de información en el grupo nuevo | M2 | Grupo nuevo, GRC | Moisés | Medium | `plan:governance-os:m2-recorrido-grc-canal` |
| MOI-147 · Grupo nuevo · Decidir, módulo a módulo, si lo que falta se da de alta por pantalla o con un kit de arranque | M2 | Grupo nuevo, Decisión | Moisés | Medium | `plan:governance-os:m2-alta-o-kit` |
| MOI-148 · Grupo nuevo · Poder cambiar la sociedad matriz o el porcentaje de participación después del alta | M2 | Grupo nuevo, Secretaría | — | Low | `plan:governance-os:m2-estructura-grupo-editable` |
| MOI-149 · Grupo nuevo · Dar camino de alta a políticas, obligaciones, controles y demás registros que hoy solo existen sembrados | M2 | Grupo nuevo, GRC | — | Medium | `plan:governance-os:m2-registros-consola-sin-alta` |
| MOI-150 · Grupo nuevo · Que cada grupo declare su órgano de gobierno de la IA sin tocar el programa | M2 | Grupo nuevo, AIMS | — | Medium | `plan:governance-os:m2-organo-ia-como-dato` |
| MOI-151 · Grupo nuevo · Que cada grupo designe al instructor y los órganos de su canal interno | M2 | Grupo nuevo, GRC, Decisión | Moisés | Medium | `plan:governance-os:m2-roles-canal-como-dato` |
| MOI-152 · Grupo nuevo · Decidir si el grupo nuevo nace con el módulo de IA de GRC | M2 | Grupo nuevo, GRC, Decisión | Moisés | Medium | `plan:governance-os:m2-modulo-ia-grupo-nuevo` |
| MOI-153 · AIMS · Crear la cuenta de cumplimiento de ARGA para poder revisar a cuatro ojos | M2 | AIMS, Ventana | Moisés | High | `plan:governance-os:m2-cuenta-cumplimiento-arga` |
| MOI-154 · AIMS · Volver a evaluar Harvey con el catálogo del responsable del despliegue | M2 | AIMS | Moisés | High | `plan:governance-os:m2-reevaluar-harvey` |
| MOI-155 · AIMS · Recorrer por primera vez con dos personas la congelación y revisión de una evaluación | M2 | AIMS | Moisés | High | `plan:governance-os:m2-congelar-revisar` |
| MOI-156 · AIMS · Determinar si Harvey necesita evaluación de impacto de protección de datos | M2 | AIMS, Comités | Moisés | Medium | `plan:governance-os:m2-eipd-harvey` |
| MOI-157 · Transversal · Llamar «derivación» a los casos que llegan de AIMS a GRC y Secretaría | M2 | AIMS, GRC, Secretaría | — | Low | `plan:governance-os:m2-jerga-derivacion` |
| MOI-158 · Transversal · Que GRC y Secretaría lean qué caso de AIMS les llega | M2 | AIMS, GRC, Secretaría | — | High | `plan:governance-os:m2-traspasos-con-id` |
| MOI-159 · AIMS · Clasificar los seis sistemas de IA de Garrigues con el cuestionario guiado | M2 | AIMS | Moisés | High | `plan:governance-os:m2-clasificar-garrigues` |
| MOI-160 · Transversal · Decidir si «cubierto» significa lo mismo en AIMS y en GRC | M2 | AIMS, GRC, Decisión | Moisés | Medium | `plan:governance-os:m2-criterio-cubierto` |
| MOI-161 · Transversal · Decidir un único vocabulario de estados para AIMS, GRC y Secretaría | M2 | AIMS, GRC, Secretaría, Decisión | Moisés | Medium | `plan:governance-os:m2-vocabulario-estado` |
| MOI-162 · Transversal · Decidir cómo cuelga un plan de acción de una obligación o de una brecha de IA | M2 | AIMS, GRC, Decisión | Moisés | Medium | `plan:governance-os:m2-plan-accion-unico` |
| MOI-163 · Equipo legal · Decidir la lectura del plazo inicial DORA sin clasificación y cotejar la cita del Reglamento Delegado 2025/301 | M2 | GRC, Comités | Moisés | Medium | `plan:governance-os:m2-lectura-plazo-dora` |
| MOI-164 · Transversal · Enlazar los riesgos de IA de GRC con su sistema y corregir el riesgo mal calificado de ARGA | M2 | AIMS, GRC, Ventana | — | Medium | `plan:governance-os:m2-riesgo-ia-vinculado` |
| MOI-210 · AIMS · Decidir, antes de clasificar, si los usuarios pueden seguir borrando sistemas de IA | M2 | AIMS, Decisión | Moisés | High | `plan:governance-os:m2-borrado-sistemas-ia` |
| MOI-215 · Transversal · Un solo cálculo de los plazos DORA y RGPD para AIMS y GRC | M2 | AIMS, GRC | — | Medium | `plan:governance-os:m2-relojes-unicos` |
| MOI-165 · RIA · Archivar la respuesta de Harvey H-02A sin retirar antes de tiempo el rótulo provisional | M3 | RIA | — | High | `plan:governance-os:m3-archivar-harvey` |
| MOI-166 · Equipo legal · Revisar las ayudas del cuestionario y quién entra en el art. 4, para retirar el rótulo provisional | M3 | RIA, Comités | Moisés | High | `plan:governance-os:m3-legal-revisa-ayudas` |
| MOI-167 · Comité de IA · Validar el catálogo de medidas del responsable del despliegue | M3 | RIA, AIMS, Comités | Moisés | High | `plan:governance-os:m3-catalogo-desplegador` |
| MOI-168 · RIA · Enviar al experto el documento de incidencias y celebrar la sesión | M3 | RIA, Comités | Moisés | High | `plan:governance-os:m3-sesion-experto` |
| MOI-169 · RIA · Enviar a Harvey los lotes pendientes, primero los que vencen antes del 13-11 | M3 | RIA | — | Urgent | `plan:governance-os:m3-lotes-harvey` |
| MOI-170 · RIA · Sujeto jurídico, permisos y autoría de cada evaluación (fase F2) | M3 | RIA, AIMS, Ventana | — | High | `plan:governance-os:m3-f2` |
| MOI-171 · RIA · Publicar la versión 1.0 del catálogo de obligaciones del experto (fase F3) | M3 | RIA, AIMS, Ventana | — | High | `plan:governance-os:m3-f3` |
| MOI-172 · Equipo legal · Validar las preguntas nuevas del cuestionario v2 y el alcance de los arts. 27 y 51 a 56 | M3 | RIA, Comités | Moisés | High | `plan:governance-os:m3-preguntas-legal-v2` |
| MOI-173 · RIA · Cuestionario v2 y aplicabilidad única antes del 13-11-2026 (fase F4) | M3 | RIA, AIMS, Ventana | — | Urgent | `plan:governance-os:m3-f4` |
| MOI-174 · RIA · Decidir cómo se muestra un control del art. 4 declarado pero sin efectividad medida | M3 | RIA, GRC, Decisión | Moisés | Medium | `plan:governance-os:m3-control-art4` |
| MOI-175 · RIA · Completar la integración con GRC y Secretaría (fase F5) | M3 | RIA, GRC, Secretaría, Ventana | — | High | `plan:governance-os:m3-f5` |
| MOI-176 · RIA · Carril rápido antes del 2-12-2026: registro, catálogo del proveedor sin alto riesgo y art. 50 (fase F6) | M3 | RIA, AIMS, Ventana | — | Urgent | `plan:governance-os:m3-f6` |
| MOI-177 · RIA · Clasificar de verdad los sistemas de Garrigues y ARGA Assist antes del 2-12-2026 | M3 | RIA, AIMS | Moisés | Urgent | `plan:governance-os:m3-f11-clasificacion-real` |
| MOI-178 · Comité de IA · Fijar la posición del despacho sobre el secreto profesional ante la autoridad | M3 | RIA, Comités | Moisés | High | `plan:governance-os:m3-comite-ia-secreto` |
| MOI-179 · Comité Legal · Fijar desde cuándo se aplica la sección 5 del capítulo III del RIA | M3 | RIA, Comités | Moisés | Medium | `plan:governance-os:m3-comite-legal-seccion-5` |
| MOI-182 · Comité de IA · Procedimiento de «cambio significativo» y acuerdo intragrupo de la herramienta de IA propia | M3 | RIA, Comités | Moisés | High | `plan:governance-os:m3-comite-ia-cambio-intragrupo` |
| MOI-212 · RIA · Resto de la fase F6 antes del 18-12-2026: pantallas, cuadro de mando, reapertura, art. 4 por sistema y requerimientos | M3 | RIA, AIMS, Ventana | — | High | `plan:governance-os:m3-f6-resto` |
| MOI-213 · RIA · Fase F7 del programa entre el 30-11 y el 18-12-2026 | M3 | RIA, AIMS, Ventana | — | Medium | `plan:governance-os:m3-f7` |
| MOI-217 · RIA · Reclasificar los otros siete sistemas de IA de ARGA con el cuestionario v2 (tarea F11.T3, calendario orientativo del 16 al 27-11-2026) | M3 | RIA, AIMS, Ventana | — | High | `plan:governance-os:m3-f11-t3-reclasificar-arga` |
| MOI-180 · RIA · Fases de 2027 del programa (F8 a F10 y el resto de F11) | M4 | RIA, AIMS, Ventana | — | Medium | `plan:governance-os:m4-ria-fases-8-10` |
| MOI-181 · RIA · Cerrar las deudas técnicas anotadas en el registro del programa | M4 | RIA, AIMS | — | Low | `plan:governance-os:m4-ria-deudas` |
| MOI-183 · Comité de IA · Definir el catálogo del responsable del despliegue de un sistema de alto riesgo | M4 | AIMS, Comités | Moisés | Low | `plan:governance-os:m4-catalogo-perfil-b` |
| MOI-184 · AIMS · Decidir qué hacer con los títulos de requisitos guardados con la numeración antigua | M4 | AIMS, Decisión | Moisés | Low | `plan:governance-os:m4-titulos-board-pack` |
| MOI-185 · AIMS · Decidir si el inventario de sistemas de IA exige grupo válido y estados del vocabulario | M4 | AIMS, Decisión | Moisés | Low | `plan:governance-os:m4-protecciones-inventario-ia` |
| MOI-186 · AIMS · Cerrar dos cabos pendientes: las tablas sin uso y el «documento de continuidad de AIMS» que falta | M4 | AIMS, Decisión | Moisés | Low | `plan:governance-os:m4-tablas-y-spec-aims` |
| MOI-187 · AIMS · Decidir si el equipo legal necesita editar las preguntas del cuestionario sin publicar una versión nueva | M4 | AIMS, Decisión | Moisés | Low | `plan:governance-os:m4-editor-preguntas` |
| MOI-188 · Base de datos · Decidir qué hacer con tres restos sin dueño | M4 | Plataforma, Decisión | Moisés | Low | `plan:governance-os:m4-restos-base-datos` |
| MOI-189 · GRC · Decidir cómo se ordena el dato de riesgos y obligaciones de ARGA que no casa con los módulos | M4 | GRC, Decisión | Moisés | Low | `plan:governance-os:m4-datos-grc-arga` |
| MOI-190 · GRC · Hacer únicos dentro de cada grupo los códigos de riesgos y hallazgos | M4 | GRC, Ventana | — | Low | `plan:governance-os:m4-unicidad-codigos` |
| MOI-191 · GRC · Obtener del despacho su categoría ENS, si trabaja para el sector público y su participación en EAD Trust | M4 | GRC, Comités | Moisés | Low | `plan:governance-os:m4-ens-garrigues` |
| MOI-192 · Pruebas · Decidir sobre dos pruebas automáticas que no miden lo que deberían | M4 | Plataforma, Decisión | Moisés | Low | `plan:governance-os:m4-dos-pruebas` |
| MOI-193 · Consola · Dar a Garrigues sus ámbitos reales en el selector de alcance | M4 | GRC, Ventana | — | Low | `plan:governance-os:m4-ambitos-garrigues` |
| MOI-194 · Plataforma · Que la comprobación automática del código conozca la estructura real de la base de datos | M4 | Plataforma | — | Low | `plan:governance-os:m4-cliente-tipado` |
| MOI-195 · Secretaría · Que el asistente de certificaciones autónomas deje de pedir identificadores a mano | M4 | Secretaría | — | Medium | `plan:governance-os:m4-certificaciones-autonomas` |
| MOI-196 · Secretaría · Vincular cada informe preceptivo a su documento fuente y no a un texto libre | M4 | Secretaría | — | Medium | `plan:governance-os:m4-informes-fuente` |
| MOI-197 · Secretaría · Dar un índice navegable a los expedientes de acuerdo | M4 | Secretaría | — | Medium | `plan:governance-os:m4-indice-expedientes` |
| MOI-198 · Comité Legal · Criterios sobre cómo el motor de reglas lee y aplica las normas | M4 | Secretaría, Comités | Moisés | Medium | `plan:governance-os:m4-comite-criterios-motor` |
| MOI-199 · Comité Legal · Decidir qué acredita que una plantilla está aprobada | M4 | Secretaría, Comités | Moisés | Medium | `plan:governance-os:m4-comite-aprobacion-plantillas` |
| MOI-200 · Secretaría · Atar cada plantilla vigente a la huella del texto que se aprobó | M4 | Secretaría, Ventana | — | Medium | `plan:governance-os:m4-sello-plantillas` |
| MOI-201 · Equipo legal · Nueva versión revisada de la convocatoria de comisión delegada e historial de cambios de las plantillas | M4 | Secretaría, Comités | Moisés | Low | `plan:governance-os:m4-backlog-3b` |
| MOI-202 · Comité Legal · Responder las preguntas pendientes del cierre de la versión española | M4 | Secretaría, Comités | Moisés | Medium | `plan:governance-os:m4-comite-cierre-es` |
| MOI-203 · Secretaría · Hacer alcanzable desde la aplicación la inscripción, el depósito y la legalización | M4 | Secretaría, Ventana | — | Medium | `plan:governance-os:m4-ciclo-registral` |
| MOI-204 · Plataforma · Registrar en la auditoría quién hace cada cambio y cubrir actas y expedientes registrales | M4 | Secretaría, Plataforma, Ventana | — | Medium | `plan:governance-os:m4-auditoria-autor` |
| MOI-206 · Secretaría · Capturar los campos sí/no y numéricos de las plantillas con controles propios | M4 | Secretaría | — | Low | `plan:governance-os:m4-capa3-tipada` |
| MOI-207 · Secretaría · Que el control de validez de un acuerdo use la regla del órgano correcto | M4 | Secretaría | — | Medium | `plan:governance-os:m4-pack-por-organo` |
| MOI-208 · Secretaría · Que el cómputo de notificaciones no dé todas por buenas cuando falta el número de miembros | M4 | Secretaría | — | Low | `plan:governance-os:m4-denominador-notificaciones` |
| MOI-209 · Secretaría · Quitar código duplicado o sin uso | M4 | Secretaría | — | Low | `plan:governance-os:m4-limpieza-codigo` |
| MOI-214 · AIMS · Prueba automática de extremo a extremo del recorrido de AIMS como Garrigues | M4 | AIMS, Plataforma, Ventana | — | Medium | `plan:governance-os:m4-e2e-aims-garrigues` |
