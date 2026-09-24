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
| H-01 | | | | | | | |

## Cierre

Con la tabla rellena, decidir por cada módulo de solo lectura (bloque 6.4) y por cada hueco del bloque 2.7: **alta por pantalla** o **kit de arranque genérico** en el `tenant-bootstrap`. Llevar el resultado a `docs/context/06-TENANT-CERO-ONBOARDING.md`.
