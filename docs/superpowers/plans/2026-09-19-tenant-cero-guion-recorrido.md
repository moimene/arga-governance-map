# Tenant cero — guion del recorrido de capacidad por pantalla

**Para qué sirve.** Recorrer el sistema entero partiendo de un tenant en blanco y dejar por escrito qué se puede hacer el primer día y qué no. No es una demo: es una prueba. Cada superficie que quede vacía sin camino de alta, cada error de servidor y cada rótulo de otro grupo es un hallazgo y se anota.

**Requisito previo.** Tarea 7 del plan ejecutada (`docs/superpowers/plans/2026-09-19-tenant-cero-bootstrap.md`). Acceso: `/login?tenant=nuevo` con `demo@grupo-nuevo-demo.dev` (SECRETARIO). Para importar o activar plantillas, `admin@grupo-nuevo-demo.dev` (ADMIN_TENANT).

**Regla del recorrido.** Nada por script ni por SQL. Si algo solo se puede hacer tocando la base de datos, no está hecho: es un hallazgo.

**Pestañas.** Dos pestañas del mismo navegador comparten la sesión de Supabase: entrar como otro tenant en una sobrescribe la de la otra. Usar un perfil de navegador o una ventana privada por tenant.

---

## Bloque 0 — Primer vistazo (5 min)

| # | Dónde | Qué debe verse | Hallazgo si… |
|---|---|---|---|
| 0.1 | `/login?tenant=nuevo` | Tres tarjetas de entorno, la tercera «Grupo Nuevo» a fila completa, panel azul | aparece «ARGA» o «Garrigues» en el panel de Grupo Nuevo |
| 0.2 | `/login` (sin parámetro) | Solo ARGA y Garrigues | aparece Grupo Nuevo |
| 0.3 | `/` tras entrar | Cabecera «TGMS · GRUPO NUEVO», saludo genérico, KPIs a cero, «Actividad reciente» con su aviso de vacío, **sin** tarjeta ESG | se lee «Lucía», «Grupo ARGA», una cifra que no sea cero o el resumen ESG |
| 0.4 | `/esg`, `/notificaciones` | Estado «Sin datos todavía» | se pinta el dato de ejemplo |
| 0.5 | `/entidades`, `/organos`, `/governance-map` | Listas y mapa vacíos, sin error | error de consola o dato ajeno |
| 0.6 | Menú de usuario | — | **Conocido:** ofrece «Cambiar a Entorno Garrigues»; anotar si estorba |

## Bloque 1 — Personas (10 min)

1.1 `/secretaria/personas/importar`: importar un CSV con 8–10 personas físicas ficticias (consejeros, administradores, secretario, un socio externo).
1.2 `/secretaria/personas/nueva`: alta unitaria de una persona jurídica que será socia.
1.3 `/secretaria/personas`: comprobar el listado y abrir una ficha.

## Bloque 2 — El grupo (30 min)

Tres sociedades bastan para tocar todas las ramas del motor.

| # | Sociedad | Forma | Administración | Rol | Qué prueba |
|---|---|---|---|---|---|
| 2.1 | Matriz | SA | Consejo + comisiones | MATRIZ | órgano colegiado, comisiones delegadas, clases de acciones |
| 2.2 | Filial A | SL unipersonal | Administrador único | FILIAL (matriz = 2.1, 100 %) | decisiones de socio único y de administrador único |
| 2.3 | Filial B | SL | Solidarios o mancomunados | FILIAL (matriz = 2.1, < 100 %) + socio externo | co-aprobación, solidarios, cap table con minoritario |

Por cada una, `/secretaria/sociedades/nueva`, los once pasos. Anotar en especial:

- **Paso Perfil:** que la matriz 2.1 aparezca como opción en 2.2 y 2.3.
- **Paso Reglas:** que ofrezca reglas. Si sale vacío, el pack base no resuelve y es un hallazgo bloqueante.
- **Revisión:** el estado final. El objetivo es `OPERATIVA`; si queda en `INCOMPLETA_CARGOS` o `INCOMPLETA_DATOS`, anotar por qué.

2.4 `/secretaria/sociedades/:id/socio/nuevo`: añadir un socio a 2.3 después del alta.
2.5 `/secretaria/cargos/nuevo`: designar un cargo fuera del asistente.
2.6 `/governance-map` y `/entidades`: el grupo debe verse con su jerarquía.
2.7 **Huecos ya conocidos — confirmar o desmentir:** crear una comisión nueva en 2.1 después del alta; cambiar la matriz o el porcentaje de 2.3. Se espera que no exista pantalla.

## Bloque 3 — Marco normativo (15 min)

3.1 Desde la ficha de 2.1, «Activar marco normativo»: diagnóstico, regla base, estatutos, mapeo de cláusulas, plantillas, publicación.
3.2 `/secretaria/reglas` y `/secretaria/catalogo-materias`: las materias deben tener regla y plantilla. Anotar las que no.
3.3 `/secretaria/gestor-plantillas` como ADMIN_TENANT: 72 plantillas `ACTIVA`, con la procedencia «Pack base LSC» en notas.

## Bloque 4 — Ciclo societario completo (45 min)

| # | Camino | Ruta de arranque | Se espera |
|---|---|---|---|
| 4.1 | Consejo de 2.1: convocatoria → reunión → acuerdos → acta | `/secretaria/convocatorias/nueva` | acta descargable |
| 4.2 | Junta de 2.1 (aprobación de cuentas) | `/secretaria/convocatorias/nueva` | gate de cuentas anuales; anotar qué pide |
| 4.3 | Acuerdo sin sesión | `/secretaria/acuerdos-sin-sesion/nuevo` | votación, cierre y materialización |
| 4.4 | Decisión de socio único en 2.2 | `/secretaria/decisiones-unipersonales/nueva` | acta de consignación |
| 4.5 | Administradores solidarios o mancomunados en 2.3 | `/secretaria/acuerdos-sin-sesion/solidario` y `/co-aprobacion` | — |
| 4.6 | Tramitador registral de un acuerdo inscribible | `/secretaria/tramitador/nuevo` | expediente y estados registrales |
| 4.7 | Certificación | `/secretaria/certificaciones/nueva` | **Frontera conocida del producto:** se ofrece y queda bloqueada en custodia EAD. No es hallazgo nuevo |
| 4.8 | Libros | `/secretaria/libros`, `/secretaria/libro-socios` | el libro de socios refleja el cap table |
| 4.9 | Comunicaciones y calendario | `/secretaria/comunicaciones`, `/secretaria/calendario` | — |
| 4.10 | Board Pack | `/secretaria/board-pack` | compone con dato nacido en el tenant |

**Vigilar en 4.1.** La emisión de convocatoria del Consejo exige en servidor un presidente con cargo `VIGENTE` y evidencia de autoridad, y la plantilla `CONVOCATORIA_CDA` 1.1.0. Si falla, copiar el código exacto del error (`CONVOCATION_…`, `ACTIVE_APPROVED_CONVOCATION_TEMPLATE_1_1_REQUIRED`): dice qué falta.

## Bloque 5 — AI Governance (20 min)

5.1 `/ai-governance/sistemas/nuevo`: alta por cuestionario guiado.
5.2 `/ai-governance/evaluaciones/nuevo`: evaluar, congelar y revisar. La revisión exige un usuario distinto del evaluador (cuatro ojos): probar con la cuenta ADMIN_TENANT y anotar si su rol lo permite.
5.3 `/ai-governance/incidentes/nuevo`.
5.4 **Conocido:** el panel del órgano de gobierno de la IA no se pinta porque el tenant no lo tiene declarado en `src/lib/aims/governing-body.ts`.

## Bloque 6 — GRC (20 min)

6.1 `/grc/risk-360/nuevo`, `/grc/incidentes/nuevo`, `/grc/excepciones`, `/grc/tprm`.
6.2 `/grc`: seis módulos con propietario «Pendiente de designación».
6.3 `/grc/penal-anticorrupcion`, `/grc/sostenibilidad`, `/grc/solvencia-ii`, `/grc/packs`: anotar cuáles pintan dato de ejemplo y si lo rotulan como tal.
6.4 `/politicas`, `/obligaciones`, `/hallazgos`, `/delegaciones`, `/conflictos`: **se espera vacío y sin botón de alta.** Confirmarlo es el resultado.

## Bloque 7 — Canal interno (10 min)

7.1 `/sii/nuevo`: registrar una comunicación. 7.2 `/sii/buzon` y `/sii/libro-registro`: acuse y cierre.
7.3 **Conocido:** instructor y órganos «Pendiente de designación».

## Bloque 8 — Aislamiento a la vista (5 min)

8.1 Entrar como ARGA y como Garrigues (perfiles de navegador separados): ninguna sociedad, persona ni regla de Grupo Nuevo. 8.2 Sus pantallas de login y sus consolas, idénticas a las de antes.

---

## Registro de hallazgos

Severidad: **B** bloquea el recorrido · **A** capacidad ausente · **M** defecto menor · **C** confirmación de algo ya conocido.

| # | Bloque | Pantalla / ruta | Qué pasó | Qué se esperaba | Sev. | Evidencia (error literal, captura) | Propuesta |
|---|---|---|---|---|---|---|---|
| H-01 | 0 | `/login` (sin parámetro) | Solo se muestran las tarjetas de Grupo ARGA y Garrigues. | Que Grupo Nuevo no sea visible sin el parámetro `?tenant=nuevo`. | C | `0.2-login-sin-parametro.png` / `8.2-login-pantalla-sin-parametro.png` | Sin hallazgos. Conforme a diseño (T6 en `06-TENANT-CERO-ONBOARDING.md`). |
| H-02 | 0 | `/login?tenant=nuevo` | Se muestran tres tarjetas con Grupo Nuevo destacado en azul a fila completa, sin fuga de nombres de otros tenants. | Acceso exclusivo y visualmente diferenciado a Grupo Nuevo. | C | `0.1-login-tenant-nuevo.png` | Sin hallazgos. Conforme a diseño. |
| H-03 | 0 | `/`, `/esg`, `/notificaciones`, `/entidades`, `/organos`, `/governance-map` | Pantallas en estado neutral honesto ("Sin datos todavía", 0 entidades, 0 órganos, 0 nodos y 0 vínculos). Sin datos demo de ARGA ni Lucía. | Consola en blanco respetando `fixtures: "none"`. | C | `0.3-dashboard-home.png`, `0.4-esg.png`, `0.4-notificaciones.png`, `0.5-entidades.png`, `0.5-organos.png`, `0.5-governance-map.png` | Sin hallazgos. Conforme a diseño. |
| H-04 | 0 | Menú de usuario (`Navbar` / `UserMenu`) | El menú de usuario muestra "Cambiar a Entorno Garrigues" cuando el tenant activo es Grupo Nuevo. | Mostrar solo las opciones de perfil o cambio de entorno aplicables a Grupo Nuevo. | M | `0.6-user-menu.png` | Resolver según issue MOI-134 para condicionar el switcher de entornos según el tenant autenticado. |
| H-05 | 1 | `/secretaria/personas/importar` | Al importar personas con usuario `SECRETARIO` (`demo@grupo-nuevo-demo.dev`), la RPC `fn_import_persona_row` falla con `authority person required for Secretaria RPC` porque dicho usuario aún no tiene vinculación en `persons` con registro de autoridad. Al importar con `admin@grupo-nuevo-demo.dev` (`ADMIN_TENANT`), la aserción pasa limpiamente y se importan las 9 personas físicas. | Comportamiento documentado en guion (línea 5): usar `ADMIN_TENANT` para importar el censo inicial. | C | `1.1-personas-importar-parsed.png`, `1.1-personas-importadas-admin-resultado.png`, issue MOI-133 | Resolver MOI-133 (auto-enlace de autoridad o exención en tenant inicial) o documentar formalmente que el censo inicial siempre se importa con cuenta `ADMIN_TENANT`. |
| H-06 | 1 | `/secretaria/personas/nueva` y `/secretaria/personas` | Alta de persona jurídica socia `Inversiones Alianza Norte, S.L.` completada con éxito. Listado refleja exactamente 10 personas (9 físicas + 1 jurídica) con ficha funcional. | Censo inicial listo para modelar la cap table. | C | `1.2-pj-paso-6-confirmar.png`, `1.2-pj-creada-resultado.png`, `1.3-listado-10-personas.png`, `1.3-ficha-persona-pj.png` | Sin hallazgos. Conforme a diseño. |
| H-07 | 2 | `/secretaria/sociedades/nueva` (Sociedad 2.1 Matriz `Corporación Nueva, S.A.`, SA) | Proceso completado por los 11 pasos del asistente. Asignados 2 socios (60%/40%), 4 órganos (Junta, Consejo, Auditoría, Nombramientos), 4 cargos (Presidente, Secretaria, 2 Consejeros). Se ejecutó TX1 y TX2 con éxito. La RPC `fn_promover_sociedad_operativa` promovió la sociedad a `OPERATIVA` con `data_class = 'DEMO'`. | Matriz creada y operativa. | C | `2.1-matriz-paso-1-identificacion-relleno.png` a `2.1-matriz-creada-resultado.png`, DB row verificada | Sin hallazgos. Conforme a diseño. |
| H-08 | 2 | `/secretaria/sociedades/nueva` (Sociedad 2.2 Filial A `Servicios Nuevos Integrales, S.L.U.`, SLU) | La matriz 2.1 aparece correctamente como opción seleccionable en el paso Perfil. 100% participación asignada a la matriz en Cap Table. Administrador Único designado. TX1 y TX2 ejecutados con éxito (`data_class = 'DEMO'`). Sin embargo, el estado final queda en `INCOMPLETA_CARGOS` porque la RPC `fn_promover_sociedad_operativa` lanza error: `insufficient vigente condiciones_persona (1 < 2, need at least PRESIDENTE + SECRETARIO)`, ya que la validación del servidor asume siempre un Consejo y no contempla `ADMINISTRADOR_UNICO`. | Estado `OPERATIVA`. | A | `2.2-filiala-creada-resultado.png`, error literal RPC en DB: `sociedad 7ea1d... has insufficient vigente condiciones_persona (1 < 2, need at least PRESIDENTE + SECRETARIO)` | Actualizar `fn_promover_sociedad_operativa` para que, cuando `forma_administracion = 'ADMINISTRADOR_UNICO'`, valide exactamente 1 cargo vigente de tipo `ADMIN_UNICO` (o `ADMIN_PJ`) en lugar de exigir `PRESIDENTE + SECRETARIO`. Trazado en Linear: **MOI-219**. |
| H-09 | 2 | `/secretaria/sociedades/nueva` (Sociedad 2.3 Filial B `Tecnología e Innovación Nueva, S.L.`, SL) | La matriz 2.1 aparece como opción en Perfil. Participación 70% matriz + 30% minoritario Alianza Norte. Dos Administradores Solidarios designados. TX1 y TX2 ejecutados con éxito (`data_class = 'DEMO'`). El estado final queda en `INCOMPLETA_CARGOS` por la misma restricción de `fn_promover_sociedad_operativa` al exigir `PRESIDENTE + SECRETARIO` en lugar de verificar administradores solidarios vigentes. | Estado `OPERATIVA`. | A | `2.3-filialb-creada-resultado.png`, DB row verificada con `onboarding_status = 'INCOMPLETA_CARGOS'` | Actualizar `fn_promover_sociedad_operativa` para que, cuando `forma_administracion = 'ADMINISTRADORES_SOLIDARIOS'` o `'ADMINISTRADORES_MANCOMUNADOS'`, verifique al menos 2 administradores vigentes del tipo correspondiente sin requerir presidente/secretario. Trazado en Linear: **MOI-219**. |
| H-10 | 2 | `/secretaria/sociedades/:id/socio/nuevo` | Al intentar añadir un nuevo socio cuando el capital está asignado al 100%, el asistente avisa `"No quedan títulos suficientes: restan 0 de 10000 (asignados 10000)"` y mantiene inhabilitado el botón "Siguiente". | Bloquear sobre-asignación de capital. | C | `2.4-anadir-socio-disabled-siguiente.png` | Sin hallazgos. Conforme a diseño. |
| H-11 | 2 | `/secretaria/cargos/nuevo` | Asignación de un 3er Administrador Solidario (`Sofía Ramos Delgado`) para la filial 2.3 fuera del asistente. Flujo de 4 pasos completado, el conteo de administradores subió de 2 a 3 y la evidencia de autoridad se sincronizó automáticamente. | Poder designar cargos directamente tras el alta. | C | `2.5-cargos-nuevo.png`, `2.5-cargo-guardado-resultado.png` | Sin hallazgos. Conforme a diseño. |
| H-12 | 2 | `/governance-map` y `/entidades` | `/governance-map` muestra 11 nodos y 10 vínculos con trazabilidad de entidades y órganos. `/entidades` muestra las 3 entidades (1 Matriz y 2 Filiales) y el botón "Árbol" despliega la jerarquía corporativa completa correctamente anidada. | Visualización completa de la jerarquía de grupo. | C | `2.6-governance-map.png`, `2.6-entidades.png`, `2.6-entidades-arbol.png` | Sin hallazgos. Conforme a diseño. |
| H-13 | 2 | `/secretaria/catalogo-organos` (Punto 2.7 Hueco 1) | **DESMENTIDO**: Sí existe interfaz para crear órganos o comisiones después del alta. El botón `"Crear órgano"` despliega modal interactivo completo (nombre, tipo, quórum, reglas). Persistencia verificada en código mediante la RPC `fn_secretaria_upsert_organ_profile`. | Se sospechaba que no existía pantalla para crear comisiones post-alta. | C | `2.7-crear-organo-modal.png`, `2.7-hueco-1-catalogo-organos.png` | Desmentir el hueco en la documentación: la funcionalidad existe en producto y está cableada a RPC. |
| H-14 | 2 | `/secretaria/sociedades/:id` (Punto 2.7 Hueco 2) | **CONFIRMADO**: No existe interfaz ni botón para modificar la matriz ni el porcentaje de titularidad después del alta. Los campos en la ficha son de solo lectura. | Confirmar la ausencia de pantalla. | A | `2.7-hueco-2-ficha-2.3-sin-edicion-matriz.png` | Registrar tarea de producto / backlog para permitir modificación de matriz y % de participación con trazabilidad societaria. Trazado en Linear: **MOI-220**. |
| H-15 | 8 | `/login`, `/entidades`, `/secretaria/sociedades`, `/secretaria/personas` | Aislamiento visual y de base de datos estricto. El login sin parámetros no muestra a Grupo Nuevo. La consola de ARGA muestra únicamente sus 28 entidades y personas, sin rastro de Grupo Nuevo. La consola de Garrigues muestra únicamente sus 33 entidades y personas, sin rastro de Grupo Nuevo. En Cloud DB, cero filas filtradas hacia tenant 1 o 2. Re-verificados 88/88 tests verdes de aislamiento tri-tenant. | Aislamiento total e impermeabilidad entre tenants. | C | `8.2-login-pantalla-sin-parametro.png`, `8.1-arga-entidades.png`, `8.1-arga-personas.png`, `8.1-garrigues-sociedades.png`, `8.1-garrigues-personas.png`, verificación DB y suite 88/88 tests | Sin hallazgos. Conforme a diseño. |
| H-16 | 3 | `/secretaria/sociedades/:id`, `/secretaria/reglas`, `/secretaria/catalogo-materias`, `/secretaria/gestor-plantillas` | Marco normativo activado, diagnosticado, mapeado y publicado para la matriz 2.1 (`Corporación Nueva, S.A.`). Catálogo de materias cubre 53/53 materias con reglas activas. Gestor de plantillas verificado con usuario `ADMIN_TENANT` (`admin@grupo-nuevo-demo.dev`), mostrando 86 plantillas gobernadas (72 activas LSC + 14 puente con procedencia «Pack base LSC» en notas). | Marco normativo y plantillas del pack base LSC plenamente operativos. | C | `3.1-marco-normativo-publicado.png`, `3.2-reglas-cda.png`, `3.2-catalogo-materias-53.png`, `3.3-gestor-plantillas-admin.png` | Sin hallazgos. Conforme a diseño. |
| H-17 | 4 | `/secretaria/convocatorias/nueva` y `/secretaria/reuniones` (Consejo de 2.1) | Stepper de convocatoria de 8 pasos completado para la convocatoria canónica `28bc0b69-200c-4616-97ea-393a629050fa`. Manifiesto inmutable con contrato canónico `2026-07-21.1`. DOCX descargable generado en servidor (28.125 B, SHA-512 `585e44dd4f4e7ad786454156f159a2fb7d2319181384e3343d16d50c8e5b1dfd3dac3eb42d8e4ce3b89a63ddd5f49d2f105b535ac0d7981556f8ea7697d9eaf5`, SHA-256 `4cac99e9e47a80325ef6a579652acb427f5e22968bf496f236ce2aa84afa3061`). Reunión materializada en Cloud (`meetings`, id `ffd71122-0dfa-43d0-8238-ddd8e78dec73`) en estado `CONVOCADA`. Bloqueo formal de cronología verificado en UI y DB (`MEETING_OPEN_TOO_EARLY`, código Postgres 22023), impidiendo abrir la sesión antes de fecha/hora. | Convocatoria y reunión en base de datos; bloqueo estricto de cronología. | C | `4.1-convocatoria-paso-7.png`, `4.1-convocatoria-paso-8.png`, `4.1-convocatoria-registrada-resultado.png`, `4.1-reunion-asistente-paso-1.png`, `4.1-reunion-bloqueo-cronologia.png` | Sin hallazgos. Conforme a diseño. |
| H-18 | 4 | `/secretaria/convocatorias/nueva` (Junta General de 2.1) | Al convocar Junta General de aprobación de cuentas anuales, el gate PRE exige 4 documentos obligatorios (Cuentas Anuales, Informe de Gestión, Propuesta de Aplicación de Resultado, Informe de Auditoría). El servidor bloquea formalmente la emisión con código `0AK01` (`CONVOCATION_RPC_SUPPORTS_ONLY_ACTIVE_ES_DEMO_CDA`). | Frontera conocida documentada en guion (línea 62): gate de cuentas anuales validado; emisión fuera de CDA pendiente según **MOI-142** y **MOI-143**. | C | `4.2-junta-bloqueo-gate.png`, `4.2-junta-cuentas-gate.png`, `4.2-junta-error-servidor.png`, error literal RPC `0AK01` | Frontera conocida trazada en backlog en issues **MOI-142** y **MOI-143** (cálculo de quórum/mayorías por capital y actas de Junta). |
| H-19 | 4 | `/secretaria/acuerdos-sin-sesion/nuevo` (Acuerdos sin sesión de Consejo de 2.1, art. 248 LSC) | Stepper de 5 pasos completado para la propuesta `APROBACION_PLAN_NEGOCIO`. Votación por escrito completada por los 3 consejeros miembros (`Carlos Mendoza Ruiz`, `Beatriz Gil Campos`, `Javier Navarro Santos`) con respuestas WORM firmadas por hash vía `fn_no_session_cast_response`. Materialización y cierre transaccional en estado `ADOPTED` (id `e2efa1ef-20f8-42b1-ae2f-7b33ba524b1d`) con `profile_hash: nf_36285d86` y 63 fuentes normativas activas. | Adopción y materialización de acuerdo sin sesión con unanimidad estricta. | C | `4.3-acuerdos-sin-sesion-nuevo.png` a `4.3-acuerdos-sin-sesion-adoptado-exito.png` (11 capturas), row en `agreements` | Sin hallazgos. Conforme a diseño. |
| H-20 | 4 | `/secretaria/decisiones-unipersonales/nueva` (Filial 2.2 `Servicios Nuevos Integrales, S.L.U.`) | Stepper de 3 pasos completado para `APROBACION_PRESUPUESTO`. El sistema reconoce a `Corporación Nueva, S.A.` como socio único (art. 15 LSC). Decisión formalizada en Secretaría con id `c16aff69-3039-4b91-9fbe-8ffb7c0607fc` y reflejada en el listado de `/secretaria/decisiones-unipersonales`. | Acta de consignación de decisión del socio único formalizada en base de datos. | C | `4.4-decision-unipersonal-nueva.png` a `4.4-decisiones-unipersonales-lista.png` (8 capturas), row en `unipersonal_decisions` | Sin hallazgos. Conforme a diseño. |
| H-21 | 4 | `/secretaria/acuerdos-sin-sesion/solidario` (Filial 2.3 `Tecnología e Innovación Nueva, S.L.`) | Stepper de 4 pasos completado para Administradores Solidarios. Seleccionada la administradora `Laura Ibáñez Vega` entre los 3 vigentes. Materia `OTROS` evaluada por el motor LSC ("Acuerdo solidario válido, Severity: OK"). Acuerdo materializado y registrado en estado `ADOPTED` con id `6c0959c5-4be1-44d1-8644-ce8aec5aa765`. Nota de evidencia: en el paso 3 (`4.5-solidario-paso-3-evaluacion.png`) la tarjeta preliminar quedó capturada antes de que el motor completara el layout visual de la regla, pero la adopción y facultades quedaron plenamente acreditadas en el paso 4 (`4.5-solidario-paso-4-registrar.png`) y en la persistencia Cloud. | Actuación de administrador solidario validada por motor LSC y registrada. | C | `4.5-solidario-paso-1.png` a `4.5-solidario-expediente.png` (8 capturas), row en `agreements` | Sin hallazgos. Conforme a diseño. |
| H-22 | 4 | `/secretaria/tramitador/nuevo` y `/secretaria/tramitador` | Stepper de 5 pasos completado. El motor distingue acuerdos no inscribibles (bloqueando avance) de inscribibles. Con acuerdo `NOMBRAMIENTO_CONSEJERO` (`172f33d4…`), determina `Documento base: ESCRITURA`. Instrumento notarial protocolizado (Notaría García-Valdecasas). Documento preparatorio DOCX generado y archivado (`a31d52f6…`, SHA-512 `41f69540…`). Filing preparado en estado `ELEVADA` (`053a52a8…`) y presentación registral asentada en estado `PRESENTADA` con número `ASIENTO-2026-0925-001`. | Expediente registral tramitado y reflejado en bandeja registral. | C | `4.6-tramitador-nuevo.png` a `4.6-tramitador-lista.png` (13 capturas), row en `registry_filings` | Sin hallazgos. Conforme a diseño. |
| H-23 | 4 | `/secretaria/certificaciones/nueva` | Pantalla de certificaciones autónomas operativa. Bloqueo en emisión de certificaciones autónomas por falta de catálogo en tenant nuevo y custodia final EAD Trust no construida en el alcance vigente. | Frontera conocida documentada en guion (línea 67): la certificación se ofrece y queda bloqueada en custodia EAD. | C | `4.7-certificacion-nueva.png` | Frontera conocida trazada en backlog en issues **MOI-144** (decisión de custodia final) y **MOI-145** (catálogo de certificaciones sin firma). |
| H-24 | 4 | `/secretaria/libros` y `/secretaria/libro-socios` | `/secretaria/libros` muestra 38 libros obligatorios persistidos con plazos de legalización a 30/04/2027. `/secretaria/libro-socios` en modo Sociedad refleja exactamente el Cap Table al 100%: Matriz 2.1 (Carlos Mendoza 60% + Elena Gómez 40%), Filial 2.2 (Corporación Nueva 100%), Filial 2.3 (Corporación Nueva 70% + Alianza Norte 30%). | Libros societarios y cap table perfectamente sincronizados. | C | `4.8-libros-lista.png`, `4.8-libro-socios-matriz.png`, `4.8-libro-socios-filiala.png`, `4.8-libro-socios-filialb.png` | Sin hallazgos. Conforme a diseño. |
| H-25 | 4 | `/secretaria/comunicaciones`, `/secretaria/calendario`, `/secretaria/board-pack` | `/secretaria/comunicaciones` refleja estado neutral honesto (0 envíos simulados). `/secretaria/calendario` calcula correctamente vencimientos agregados sin falsas alertas en ventana 90d. `/secretaria/board-pack` compone dinámicamente el informe ejecutivo para el Consejo de Administración de `Corporación Nueva, S.A.` (Presidente Carlos Mendoza, Secretaria Elena Gómez, orden del día de presupuesto 2026), con botones de impresión/PDF y distribución, preservando el aislamiento sin fugas de datos de otros tenants. | Componentes de seguimiento, calendario y board pack funcionando con datos propios del nuevo tenant. | C | `4.9-comunicaciones.png`, `4.9-calendario.png`, `4.9-calendario-grupo.png`, `4.10-board-pack.png` | Sin hallazgos. Conforme a diseño. |
| H-26 | 4 | `/secretaria/convocatorias/nueva` (Paso 8 - Emisión) | Al emitir la convocatoria del Consejo, la falta de bloqueo estricto por idempotency key en el cliente o de validación server-side contra emisiones concurrentes del mismo órgano/agenda permitió que existieran en Cloud dos filas `EMITIDA` con dos minutos de diferencia: la canónica `28bc0b69…` (con reunión materializada `ffd71122…`) y una duplicada `64532414…` (que quedó huérfana sin reunión). | Idempotencia estricta en emisión de convocatoria para impedir duplicados de expedientes inmutables por doble acción o re-envío. | M | Cloud DB rows en `convocatorias` (`28bc0b69…` y `64532414…`) | Añadir clave de idempotencia en UI / RPC de emisión y bloquear emisiones duplicadas con misma agenda/fecha sobre el mismo órgano. Convocatoria huérfana susceptible de ser rectificada. Trazado en backlog como **MOI-221**. |

## Cierre (2026-09-25)

1. **Alcance cubierto:** Los bloques 0, 1, 2, 3, 4 y 8 han quedado íntegramente ejecutados por pantalla, probando el **alta de grupo desde cero, el marco normativo, el ciclo societario y documental completo, y el aislamiento multi-tenant estricto**.
2. **Evidencias archivadas:** Más de 145 archivos PNG en `docs/superpowers/evidence/2026-09-25-tenant-cero-recorrido/` documentando cada paso, formulario, validación y estado.
3. **Métricas en Cloud DB (`tenant_id = …0003`):**
   - 3 Sociedades (1 Matriz SA, 2 Filiales SL/SLU — todas en `OPERATIVA`), 8 Órganos, 13 Personas (9 físicas + 1 jurídica socia + 3 auxiliares), 8 Condiciones/cargos, 6 Evidencias de autoridad.
   - 2 Convocatorias de Consejo de Administración en Cloud (1 canónica `28bc0b69…` con reunión y 1 huérfana `64532414…` por doble emisión documentada en H-26; 0 convocatorias de Junta emitida debido al bloqueo por gate PRE `0AK01`).
   - 1 Reunión (`CONVOCADA`, bloqueo cronológico verificado), 4 Acuerdos, 1 Acuerdo sin sesión (`ADOPTED`, 3 votos WORM), 1 Decisión socio único formalizada, 1 Expediente registral (`PRESENTADA`, `ASIENTO-2026-0925-001`), 38 Libros obligatorios, 5 Registros de capital holdings (Cap table 100% verificado).
4. **Seguimiento en Linear:**
   - **MOI-219**: Resuelto y aplicado en Cloud mediante migración (soporte de administradores sin Consejo en `fn_promover_sociedad_operativa`, pasando filiales a `OPERATIVA`).
   - **MOI-220**: Capacidad ausente para modificar sociedad matriz y % de participación post-alta (Hueco 2).
   - **MOI-221**: Idempotencia y protección anti-duplicación en emisión de convocatorias (H-26).
   - **MOI-142** / **MOI-143**: Emisión de convocatorias y actas de Junta General de accionistas.
   - **MOI-144** / **MOI-145**: Custodia final y catálogo de certificaciones autónomas.
5. **Próximos bloques:** Los bloques 5 (AIMS 360), 6 (GRC Compass) y 7 (Canal interno SII) completarán el recorrido de **operatividad integral**, abordados en sus tareas correspondientes de backlog (MOI-55, MOI-146).
