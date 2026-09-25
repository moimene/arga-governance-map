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

## Cierre (2026-09-25)

1. **Alcance cubierto:** Los bloques 0, 1, 2 y 8 han quedado íntegramente ejecutados por pantalla, probando el **alta de grupo desde cero y el aislamiento multi-tenant estricto**.
2. **Evidencias archivadas:** 87 archivos PNG en `docs/superpowers/evidence/2026-09-25-tenant-cero-recorrido/` documentando cada paso y estado.
3. **Seguimiento en Linear:**
   - **MOI-219**: Defecto de servidor en `fn_promover_sociedad_operativa` (soportar formas de administración sin Consejo).
   - **MOI-220**: Capacidad ausente para modificar sociedad matriz y % de participación post-alta (Hueco 2).
4. **Próximos bloques:** Los bloques 3 a 7 (marco normativo, secretaría transaccional, AIMS 360, GRC, SII) constituyen el recorrido de **operatividad integral**, abordados en sus tareas correspondientes de backlog (MOI-15, MOI-55, MOI-146).
