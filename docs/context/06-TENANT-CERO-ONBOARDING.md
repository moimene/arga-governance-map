# 06 — Tenant cero: tercera instancia para arrancar un grupo desde cero

> **Propósito.** Memoria de continuidad de la línea de trabajo «tercer tenant / onboarding real». Permite retomar el asunto en una conversación nueva sin releer el historial. Se sitúa en la suite `docs/context/` (→ `00`) y no sustituye a `CLAUDE.md`.
>
> **Fecha de creación:** 2026-09-19. **Última actualización:** 2026-09-25 (cierre de MOI-15: recorrido por pantalla de bloques 3 y 4 completado; marco normativo activado y publicado; convocatoria de Consejo con DOCX server-side y reunión materializada con bloqueo de cronología; gate de cuentas anuales de Junta validado; acuerdos sin sesión adoptados con votos WORM unánimes; decisión de socio único formalizada en SLU; acuerdo de administrador solidario validado por motor LSC; tramitador registral completado con asiento de presentación en RM; 38 libros obligatorios y Cap table 100% verificados; Board Pack generado en vivo; hallazgos H-16 a H-25 documentados; aislamiento tri-tenant verificado sin contaminación). **Estado:** tenant «Grupo Nuevo» **OPERATIVO, VALIDADO EN ALTA Y EN CICLO SOCIETARIO COMPLETO**; 3 sociedades dadas de alta; 4 acuerdos adoptados; 1 reunión convocada; 1 expediente registral presentado; 38 libros persistidos; >145 capturas de evidencia archivadas. **Mantener vivo:** actualizar estado y fecha al cerrar cada conversación sobre este asunto.

---

## 0. Dónde está esto hoy (leer primero)

**En Cloud (`governance_OS`), desde el 2026-09-19, con autorización expresa del usuario:**

- Tenant **«Grupo Nuevo»**, `00000000-0000-0000-0000-000000000003`, con marca propia y `fixtures: "none"`.
- Usuarios `demo@grupo-nuevo-demo.dev` (SECRETARIO) y `admin@grupo-nuevo-demo.dev` (ADMIN_TENANT). Contraseña: variable `DEMO_PASSWORD_NUEVO` del `.env` local del repo (generada al azar, nunca mostrada ni registrada; `.env` está ignorado por git).
- Suelo: 58 rule packs `GN_*` con materia canónica y versión `ACTIVE`, 5 rule sets de España, 72 plantillas `ACTIVA`, 6 módulos GRC con propietario «Pendiente de designación».
- **Ni una sociedad, persona, órgano o acuerdo.** Eso se hace por pantalla.
- ARGA y Garrigues: recuento idéntico antes y después en las seis tablas tocadas, medido por el propio script en cada ejecución.

**En el repo, empaquetado en rama `grupo-nuevo/tenant-cero-2026-09-19`:**

- Spec `docs/superpowers/specs/2026-09-19-tenant-cero-onboarding-design.md`, plan `docs/superpowers/plans/2026-09-19-tenant-cero-bootstrap.md` (Tareas 1–7 hechas) y guion `docs/superpowers/plans/2026-09-19-tenant-cero-guion-recorrido.md`.
- `scripts/tenant-bootstrap.ts` (fases `fundacion` y `pack-base`, dry-run por defecto, idempotente) + lógica pura en `scripts/tenants/`. El catálogo declara `cloud: "PROVISIONADO"`.
- **Pack base LSC congelado** en `scripts/tenants/pack-base-lsc/` con manifiesto de hashes. Lo regenera `scripts/export-pack-base-lsc.ts`, que solo lee de Cloud.
- Aplicación: tercer entorno de login **visible solo por `/login?tenant=nuevo`**; `branding.fixtures = "none"` apaga los fixtures de ARGA (ESG, Notificaciones, dos tarjetas del Dashboard) para ese tenant y para nadie más.
- Gate `src/test/schema/tenant-cero-isolation.test.ts`: 25/25 con tres logins reales.
- Nombre «Grupo Nuevo» confirmado formalmente como identidad definitiva de la plantilla de onboarding (Opción A, resuelto en MOI-131). Coincide plenamente con la fila de Cloud (`governance_OS`), los identificadores de reglas `GN_*` y las cuentas Auth.

**Verificado el 2026-09-24 (sesión MOI-126):** typecheck 0 errores, eslint limpio, `bun run build` limpio (7.62s), 88 tests de aislamiento tri-tenant y bilateral verdes (`tenant-isolation` + `tenant-cero-isolation`), suite `src/test/garrigues/` (98 pass) y `src/test/tenants/` (44 pass) verdes, 4.890 tests en bloque (0 fail, 151 skip, 3 todo), dry-run posterior = 0 por crear, 0 filas `PROBE-%` residuales en Cloud. **Primer recorrido en navegador:** resuelto en MOI-132 por la Opción A: el primer recorrido se realiza en local (`bun run dev` → `/login?tenant=nuevo`), preservando la versión de producción sin exponer prematuramente el tercer entorno hasta su incorporación formal en MOI-136.

**Rectificación de esta línea de trabajo.** La recomendación inicial («clonar el pack base desde `seed-rule-packs.ts`, no desde Cloud») era **incorrecta**: ese seed quedó atrás respecto a las correcciones del Comité Legal aplicadas por migración (13 de los 58 packs tienen hoy versión activa posterior a la 1.0.0). El origen correcto es el estado vivo de Cloud, congelado en el repo como snapshot. §4 está corregido.

**Abierto para el Comité Legal:** la plantilla `ACTA_COMISION_DELEGADA v1.0.1` entró en el pack base, pero sus notas atribuyen la ausencia de voto de calidad en comisiones delegadas al Reglamento del Consejo de ARGA. Puede ser una regla de ese grupo y no derecho común.

**Dato a tener presente:** `tenants` es de lectura pública por diseño (excepción documentada en el gate G0): las sesiones de ARGA y Garrigues pueden leer que existe un tenant «Grupo Nuevo» y su marca. No ven ninguna de sus filas de dominio.

**Residuo en el repo:** carpeta `_to_delete/` en la raíz (un `index.lock` vacío y un `tsconfig` temporal de verificación). Se puede borrar sin más; la sesión no tenía permiso de borrado.

---

## 1. La pregunta de origen

El sistema está adaptado a dos contextos (ARGA Seguros, grupo asegurador ficticio, y Garrigues). ¿Cómo se levanta una tercera instancia para empezar un grupo desde cero y cablear sociedades, órganos, personas y reglas?

## 2. Decisiones tomadas por el usuario (2026-09-19)

| # | Decisión | Elección |
|---|---|---|
| T1 | Propósito | **Tenant cero / plantilla**: grupo ficticio en blanco dentro de `governance_OS`, para ejercitar y demostrar el onboarding real por pantalla; queda como plantilla reutilizable. No es piloto con dato real. |
| T2 | Suelo jurídico | **SA y SL comunes**: basta un pack base LSC extraído de los rule packs actuales más las plantillas núcleo. Sin cotizada, sector regulado ni formas especiales en esta fase. |
| T3 | Alcance | **Instancia básica para probar toda la capacidad** (precisión del usuario, literal: «es mucho más básica, queremos probar toda la capacidad»). Grupo sencillo, sin narrativa elaborada ni dato sembrado; todos los módulos abiertos; el objetivo es recorrer el sistema entero partiendo de cero. |
| T4 | Origen del pack base | **Estado vivo de Cloud, congelado en el repo como snapshot**; no `seed-rule-packs.ts` (decisión técnica de la sesión de implementación; rectifica la recomendación inicial). |
| T5 | Identidad | «Grupo Nuevo» / `nuevo` / `…0003` / prefijo `GN` — **confirmado formalmente como nombre definitivo de la plantilla de onboarding (Opción A, resuelto en MOI-131)**. |
| T6 | Login | El entorno nuevo solo aparece llegando por `/login?tenant=nuevo`; el selector de las demos de ARGA y Garrigues no cambia. |
| T7 | Fixtures | `branding.fixtures = "none"` por declaración expresa; ARGA y Garrigues ven lo mismo que antes. |

Consecuencia de T1: se mantiene la decisión D2 del spec de Garrigues (tenant nuevo en el mismo Supabase, mismo repo, aislado por RLS; sin fork). Si algún día el propósito pasara a piloto con dato real de un tercero, la respuesta cambia: proyecto Supabase separado y endurecimiento F0 de la spec de producción antes de cargar nada.

## 3. Diagnóstico verificado contra el repo (2026-09-19, `main` en `b1721a5`)

### 3.1 La arquitectura ya es multi-tenant

- Un único Supabase (`governance_OS`). ARGA = `00000000-0000-0000-0000-000000000001`, Garrigues = `…0002`. El tercero sería `…0003`.
- 175 de las 192 tablas de `public` llevan `tenant_id` (medido sobre `src/integrations/supabase/types.ts`). Sin `tenant_id`: catálogos globales (`materia_catalog`, `entity_settings_catalog`, `bloques_sectoriales`, `rbac_roles`, `capability_matrix`, `sod_toxic_pairs`, `pack_rules`, `rule_pack_versions`, `pacto_clausulas`, `tenants`, `profiles`) y tablas hijas aisladas por join (`ai_compliance_checks`, `ai_risk_assessments`, `communication_*`, `evidence_bundle_artifacts`).
- Tenant de sesión: `TenantContext` lo lee de `user_profiles.tenant_id`; en servidor, `fn_current_tenant_id()`. Marca: `tenants.branding jsonb` aplicada por `TenantBrandProvider`.
- Fundación de Garrigues (G0): `scripts/seed-garrigues-tenant.ts` (fila `tenants` + branding + usuarios Auth + `user_profiles` + `rbac_user_roles`), idempotente, dry-run por defecto, con guard de target.

### 3.2 El alta desde cero ya existe en producto

- `/secretaria/sociedades/nueva` → `SociedadNuevaStepper` (11 pasos: identificación, domicilio, perfil de grupo, capital, clases, cap table, órganos, cargos, reglas, soporte, revisión).
- TX1 = RPC `fn_crear_sociedad_legal_y_capital(p_tenant_id, p_payload)` (SECURITY DEFINER; asierta acceso al tenant y rol SECRETARIO/ADMIN_TENANT; crea persona PJ, `entities`, `entity_capital_profile`, `share_classes`, socios, `capital_holdings`, `governing_bodies`, `entity_settings`, `rule_param_overrides`). TX2 = cargos y representaciones iniciales. Estados: `INCOMPLETA_DATOS → INCOMPLETA_CARGOS → OPERATIVA`.
- El paso «Perfil» (rol en grupo MATRIZ/FILIAL/PARTICIPADA/INDEPENDIENTE, matriz, % de participación) es el cableado del grupo.
- Alrededor: `PersonaNuevaStepper`, `PersonasImportStepper` (alta masiva de personas), `AnadirSocioStepper`, `DesignarAdminStepper`, `RepresentanteAdminPJStepper`, `TransmisionStepper` y el asistente `ActivarMarcoNormativo` por sociedad (diagnóstico, regla base, estatutos, mapeo de cláusulas, plantillas, publicación).
- Garrigues apenas ejercitó este camino: su perímetro se sembró por script desde `scripts/garrigues/entities-catalog.ts`.

### 3.3 Lo que un tenant en blanco no tiene

**Capa A — Fundación (trabajo pequeño, es G0 parametrizado).**
- `tenants.branding` es obligatorio en la práctica: con branding NULL la aplicación aplica los defaults de ARGA verbatim (`src/lib/tenant-brand-labels.ts`, `tenant-scopes.ts`: «Grupo ARGA», «Buen día, Lucía», ámbitos de ARGA). Es el contrato cero-cambio de ARGA, no un defecto, pero obliga a declarar marca en todo tenant nuevo.
- `LOGIN_BRANDS` (`src/lib/login-brands.ts`) es un mapa estático pre-login con dos claves y tipo `LoginBrandKey = "arga" | "garrigues"`. Hay que añadir la tercera (consumidores: `Login.tsx` y dos tests).
- `branding.modules` es una lista blanca opcional. Por T3 **no se declara**: sin lista (o con lista vacía) `isModuleEnabled` falla abierto y el tenant ve todos los módulos, incluidos DORA, packs de país y Board Pack.
- Filas de `grc_modules` del tenant si se van a registrar obligaciones: `tg_sync_obligation_to_backbone` FKea contra `grc_modules(tenant_id,id)` y su fallback no comprueba existencia.
- Atención a las columnas con `DEFAULT '…0001'` que sobreviven (p. ej. `jurisdiction_rule_sets.tenant_id`): toda escritura del tenant nuevo debe nombrar `tenant_id`.

**Capa B — Suelo jurídico (el hallazgo principal).**
- `rule_packs`, `plantillas_protegidas` y `jurisdiction_rule_sets` son por tenant, y todos los hooks filtran por `tenant_id` (`useRuleResolution`, `useReglasAplicables`, `useRulePackForMateria`, `usePlantillasProtegidas`, `useJurisdiccionRules`…).
- El derecho común de la LSC vive dentro del tenant ARGA: `scripts/seed-rule-packs.ts` (35 materias, cero menciones a ARGA en el contenido) e `import-templates-batch.ts` están cableados a `…0001`; la migración `20260424175656` siembra `jurisdiction_rule_sets` solo para ARGA. En Cloud, a fecha de G3: 59 packs y 73 plantillas en ARGA, 10 packs y 6 plantillas en Garrigues (estos, estatutarios SLP).
- La resolución de reglas es por materia y sin fallback a órgano. Un tenant vacío puede dar de alta sociedades pero no convocar ni adoptar acuerdos.
- Falta, por tanto, un **pack base LSC** clonable a cualquier tenant: rule packs SA/SL/Consejo + `jurisdiction_rule_sets` ES + plantillas núcleo (convocatoria, acta, certificación como mínimo para la prueba de humo). Las plantillas entran en BORRADOR y se promueven con `fn_secretaria_transition_template_state`.

**Capa C — Residuos y huecos de UI.**
- UUID de tenant cableado en 7 ficheros de `src` fuera de tests: `ErpConsolePanel.tsx`, `useWhistleblowing.ts`, `lib/sii/roles-por-tenant.ts`, `lib/aims/governing-body.ts`, `login-brands.ts`, `lib/demo-operable/runner.ts`, `pages/Dashboard.tsx`. Casi todos fallan cerrado de forma correcta para un tenant desconocido (SII: «Pendiente de designación»; AIMS: sin órgano de IA, el panel no se pinta; panel demo-operable solo ARGA).
- Fixtures estáticos de `src/data/*` consumidos por `Dashboard.tsx` (actividad reciente, ESG), `Esg.tsx`, `Notificaciones.tsx`, `Conflictos.tsx` y `OrganoDetalle.tsx`: pintarían dato de ARGA en el tenant nuevo. Hay que gatear por tenant o mostrar estado vacío honesto.
- Huecos funcionales que un grupo desde cero destapará: (1) no hay UI para crear un órgano después del alta de la sociedad; (2) no hay UI para modificar la estructura de grupo a posteriori (matriz y % solo se fijan en el alta); (3) no hay alta masiva de sociedades, solo de personas.

### 3.4 Mapa de capacidad desde cero: qué se puede poblar por pantalla y qué no

Medido sobre las escrituras reales de `src` (INSERT/UPSERT directos y RPC invocadas, sin tests). Es el dato que condiciona T3: «probar toda la capacidad» solo es posible donde existe un camino de alta.

| Módulo | ¿Se puebla desde cero por pantalla? | Base |
|---|---|---|
| **Secretaría** | **Sí, ciclo completo.** Sociedad, personas (unitaria y masiva), socios, cargos y ceses, representaciones, transmisiones, marco normativo y estatutos, reglas de órgano, convocatoria → reunión → acuerdos → acta → certificación, acuerdos sin sesión, decisiones unipersonales, comunicaciones, libros de actas, cuentas anuales, gestor de plantillas (ADMIN_TENANT). | Más de 50 RPC `fn_*` + inserts de `agreements`, `meeting_attendees`, `plantillas_protegidas`… Requiere la Capa B. Frontera conocida: la certificación queda bloqueada en custodia EAD por diseño (`EADInterpositionControl` sin renderer autoritativo). |
| **AIMS 360** | **Sí.** Alta de sistema por cuestionario (`fn_aims_registrar_sistema`), evaluaciones con congelación y revisión a cuatro ojos, incidentes, versiones, expediente técnico, indicadores. | El órgano de gobierno de la IA se resuelve por mapa estático por tenant (`lib/aims/governing-body.ts`): un tenant nuevo no lo tendrá hasta añadirlo. |
| **GRC Compass** | **Parcial.** Riesgos (`/grc/risk-360/nuevo`), incidentes, excepciones y terceros (TPRM) tienen alta. | Obligaciones, controles y módulos GRC se leen de dato sembrado. |
| **SII** | **Sí.** Alta de comunicaciones por el portal; persistencia en `sii.reports` por tenant. | Roles del canal: «Pendiente de designación» hasta declararlos en `lib/sii/roles-por-tenant.ts`. El catálogo inicial de un tenant desconocido es vacío (no hereda los casos de ARGA). |
| **Consola TGMS: políticas, obligaciones, controles, hallazgos, planes de acción, delegaciones, conflictos, notificaciones regulatorias** | **No.** Cero inserts desde la UI: son superficies de solo lectura sobre dato sembrado por script. | En un tenant en blanco quedarán vacías y sin forma de poblarlas por pantalla. |
| **Órganos (post-alta) y estructura de grupo** | **No.** Los órganos solo nacen dentro del alta de sociedad; matriz y % solo se fijan ahí. | Huecos (1) y (2) de la Capa C. |
| **ESG, notificaciones, actividad reciente** | **No aplica.** Son fixtures estáticos de ARGA en `src/data/*`. | Hay que gatearlos o vaciarlos para el tenant nuevo. |
| **Board Pack, Governance Map, Dashboard** | **Derivados.** Se componen de lo anterior: serán tan ricos como el dato que exista. | — |

Lectura: el sistema es operable desde cero en Secretaría, AIMS, SII y la mitad transaccional de GRC. La mitad «registro» de la consola (normativa interna, obligaciones, controles, hallazgos, delegaciones, conflictos) depende hoy de siembra. Para probar toda la capacidad hay dos salidas por módulo: construir el alta por pantalla o dotar al `tenant-bootstrap` de un kit de arranque mínimo y genérico. La primera pasada honesta es sin kit, para levantar el inventario exacto de lo que un cliente no podría hacer el día uno.

## 4. Camino recomendado

1. **`tenant-bootstrap` genérico.** Generalizar `seed-garrigues-tenant.ts` en un script parametrizado (slug, nombre, marca, usuarios) que cree la Capa A. Mismo patrón: service-role, dry-run por defecto, idempotente, guard de target.
2. **Pack base LSC congelado en el repo, con origen en Cloud.** `export-pack-base-lsc.ts` lee lo que hoy está `ACTIVE`/`ACTIVA` en el tenant de origen, aplica reglas de selección que fallan cerrado (sin `demo_scope`, sin mención a ARGA en nada que llegue a un documento) y escribe un snapshot con manifiesto de hashes. ~~Parametrizar `seed-rule-packs.ts`~~: descartado, ese seed resucitaría reglas ya corregidas por el Comité Legal.
3. **Ni una sociedad sembrada.** El tenant nace vacío de dato societario.
4. **Cableado por pantalla**, en este orden: personas (importación) → matriz → filiales con matriz declarada → socios y cap table → cargos → marco normativo por sociedad → primera convocatoria como prueba de humo de extremo a extremo. Grupo mínimo suficiente para tocar todas las ramas del motor: una SA matriz con Consejo y comisiones, una SL filial con administrador único (unipersonal), una SL con administradores solidarios o mancomunados y un socio externo.
5. **Recorrido de capacidad completo (T3).** Tras Secretaría, recorrer por pantalla AIMS (alta de sistema por cuestionario, evaluación, congelación, revisión, incidente), GRC (riesgo, incidente, excepción, tercero), SII (comunicación, acuse, cierre) y comprobar qué componen Dashboard, Governance Map y Board Pack con dato nacido en el tenant. Registrar como hallazgo cada superficie que quede vacía sin camino de alta (§3.4).
6. **Gates.** El gate de aislamiento (`src/test/schema/tenant-isolation.test.ts` y el de 16 tablas) pasa de bilateral a tres tenants. Se mantienen los contratos vigentes: cero-cambio ARGA y persistencia del dato de Garrigues.
7. **Backlog que saldrá del ejercicio:** los tres huecos de la Capa C, el gateo de fixtures y, por cada módulo de solo lectura de §3.4, la decisión entre alta por pantalla o kit de arranque genérico en el `tenant-bootstrap`. Priorizar según lo que bloquee el recorrido.

Valor del ejercicio: es la primera vez que el producto se recorre como lo haría un cliente, sin scripts de siembra. El tenant resultante queda como plantilla de onboarding y como demo del «día uno».

## 5. Pendiente de decidir

- ~~Confirmar o cambiar el nombre «Grupo Nuevo»~~: Resuelto en MOI-131 por la opción A (confirmado «Grupo Nuevo» como identidad definitiva de la plantilla de onboarding, en total coherencia con Cloud y `GN_*`).
- Criterio del Comité Legal sobre la plantilla `ACTA_COMISION_DELEGADA` (§0).
- Para los módulos de solo lectura (§3.4): alta por pantalla o kit de arranque genérico. Decidir después de la primera pasada sin kit.
- Si el pack base LSC sigue siendo copia por tenant (modelo actual) o se introduce herencia de un tenant «sistema» (cambio de modelo: fuera de alcance salvo decisión expresa).
- Cuándo y cómo se hace el commit (árbol compartido: por rutas específicas), si se despliega, y si se añade la sección correspondiente a `CLAUDE.md`.

## 6. Estado tras recorrido por pantalla (Cierre de MOI-53, 2026-09-25)

El recorrido de los bloques 0, 1, 2 y 8 del guion se ha completado exhaustivamente en local sobre Cloud DB (`governance_OS`), con 87 capturas de evidencia archivadas en `docs/superpowers/evidence/2026-09-25-tenant-cero-recorrido/` y 15 filas de hallazgos H-01 a H-15 registradas en `docs/superpowers/plans/2026-09-19-tenant-cero-guion-recorrido.md`.

### 6.1 Sociedades creadas en Cloud (`tenant_id = …0003`, `data_class = 'DEMO'`)
1. **Matriz (2.1): `Corporación Nueva, S.A.`** (`45c8df67-64c9-42a3-abff-8047dd23748b`, NIF `A98765432`):
   - Cap table: Carlos Mendoza Ruiz (60%) + Elena Gómez Blanco (40%).
   - Órganos: Junta General + Consejo de Administración + Comisiones de Auditoría y Nombramientos.
   - Cargos: Presidente, Secretaria, 2 Consejeros.
   - Estado: `OPERATIVA` (promovida automáticamente al tener Consejo completo con Presidente y Secretaria).
2. **Filial A (2.2): `Servicios Nuevos Integrales, S.L.U.`** (`7ea1d208-6c67-4021-baf4-ecb9de2abacd`, NIF `B87654321`):
   - Matriz 2.1 al 100% (3.000 participaciones). `tipo_social = 'SL'`, `es_unipersonal = true`.
   - Cargo: Administrador Único (Carlos Mendoza Ruiz).
   - Estado: `OPERATIVA` (promovida tras la migración de fix de `fn_promover_sociedad_operativa` en **MOI-219** para formas de administración sin Consejo).
3. **Filial B (2.3): `Tecnología e Innovación Nueva, S.L.`** (`9d209ef6-ca87-44d4-a12c-86f12a0ea368`, NIF `B76543210`):
   - Matriz 2.1 (70%) + Minoritario Alianza Norte (30%).
   - Cargos: 3 Administradores Solidarios (2 en alta inicial + 1 vía `/secretaria/cargos/nuevo` en paso 2.5).
   - Estado: `OPERATIVA` (promovida tras la migración de fix de `fn_promover_sociedad_operativa` en **MOI-219** para formas de administración sin Consejo).

### 6.2 Dictamen de los dos huecos del punto 2.7
- **Hueco 1 («Crear órgano en matriz post-alta»): DESMENTIDO.** Existe botón funcional «Crear órgano» en `/secretaria/catalogo-organos` con modal interactivo completo. La persistencia en servidor está implementada mediante la RPC `fn_secretaria_upsert_organ_profile` (verificada en código).
- **Hueco 2 («Editar matriz o % de Filial B post-alta»): CONFIRMADO.** No existe UI ni acción en la ficha de sociedad para modificar la matriz ni el porcentaje de participación una vez finalizado el asistente de alta. Trazado como tarea de backlog en **MOI-220**.

### 6.3 Hallazgo técnico servidor relevante
- La RPC `fn_promover_sociedad_operativa` contenía inicialmente una regla genérica que exigía `condiciones_persona (count >= 2, PRESIDENTE + SECRETARIO)` pensada únicamente para Consejos de Administración. Al no contemplar `ADMINISTRADOR_UNICO` ni `ADMINISTRADORES_SOLIDARIOS`, dejaba erróneamente en `INCOMPLETA_CARGOS` a sociedades válidas. Este defecto fue subsanado y aplicado a Cloud mediante migración en el issue **MOI-219**, pasando ambas filiales a estado `OPERATIVA`.

### 6.4 Próximos pasos naturales
1. Abordar el recorrido de operatividad integral en los módulos restantes según guion (Bloques 5 a 7: AIMS 360, GRC, SII; cubiertos en MOI-55 y MOI-146).
2. Ejecutar la solución del issue **MOI-220** (edición de matriz y % post-alta).
3. Abordar **MOI-221** (idempotencia y protección anti-duplicación en emisión de convocatorias).
4. Decidir para los módulos de solo lectura de consola TGMS (§3.4): desarrollo de alta por pantalla vs kit de arranque en bootstrap.

### 6.5 Estado tras validación del ciclo societario y documental (Cierre de MOI-15, 2026-09-25)

El recorrido de los bloques 3 (Marco normativo) y 4 (Ciclo societario completo) del guion canónico se ha completado íntegramente por pantalla sobre Cloud DB (`governance_OS`), con más de 55 nuevas capturas PNG archivadas en `docs/superpowers/evidence/2026-09-25-tenant-cero-recorrido/` y 11 filas de hallazgos H-16 a H-26 registradas en `docs/superpowers/plans/2026-09-19-tenant-cero-guion-recorrido.md`.

**Hitos societarios acreditados en Grupo Nuevo:**
1. **Marco normativo activado y publicado (3.1 - 3.3):**
   - 53/53 materias del catálogo cubiertas con reglas activas del Pack base LSC.
   - Gestor de plantillas verificado con rol `ADMIN_TENANT`: 86 plantillas gobernadas (72 plantillas `ACTIVA` del pack base LSC en Cloud DB + 14 plantillas puente provisionales en catálogo local con procedencia «Pack base LSC» en notas).
2. **Convocatoria y bloqueo estricto de cronología (4.1):**
   - Convocatoria de Consejo de Administración de 2.1 completada a través del stepper de 8 pasos para la convocatoria canónica `28bc0b69-200c-4616-97ea-393a629050fa`.
   - DOCX server-side renderizado con SHA-512 `585e44dd4f4e7ad786454156f159a2fb7d2319181384e3343d16d50c8e5b1dfd3dac3eb42d8e4ce3b89a63ddd5f49d2f105b535ac0d7981556f8ea7697d9eaf5` (SHA-256 `4cac99e9e47a80325ef6a579652acb427f5e22968bf496f236ce2aa84afa3061`, 28.125 B) bajo contrato canónico `2026-07-21.1`.
   - Reunión materializada en Cloud (`meetings`, id `ffd71122-0dfa-43d0-8238-ddd8e78dec73`) en estado `CONVOCADA`. Bloqueo formal de cronología verificado en UI y DB (`MEETING_OPEN_TOO_EARLY`, código Postgres 22023), impidiendo abrir la reunión antes de su fecha/hora legal.
3. **Validación documental PRE en Junta General (4.2):**
   - Gate PRE de aprobación de cuentas anuales validado, requiriendo los 4 documentos preceptivos (Cuentas Anuales, Informe de Gestión, Propuesta de Aplicación de Resultado, Informe de Auditoría).
   - Bloqueo formal en servidor con código `0AK01` (`CONVOCATION_RPC_SUPPORTS_ONLY_ACTIVE_ES_DEMO_CDA`), documentado como frontera conocida en **MOI-142** y **MOI-143**.
4. **Acuerdos por escrito y sin sesión de Consejo (4.3):**
   - Stepper de 5 pasos completado para `APROBACION_PLAN_NEGOCIO` (Plan Estratégico 2026-2029).
   - Votos WORM de los 3 consejeros (`Carlos Mendoza`, `Beatriz Gil`, `Javier Navarro`) emitidos con éxito vía `fn_no_session_cast_response`.
   - Materialización transaccional completada en estado `ADOPTED` (`e2efa1ef-20f8-42b1-ae2f-7b33ba524b1d`) con `profile_hash: nf_36285d86` y 63 fuentes normativas activas.
5. **Decisión del socio único en filial unipersonal 2.2 (4.4):**
   - Stepper de 3 pasos completado para `APROBACION_PRESUPUESTO` en `Servicios Nuevos Integrales, S.L.U.`.
   - Socio único `Corporación Nueva, S.A.` reconocido automáticamente (art. 15 LSC).
   - Decisión formalizada en Secretaría con id `c16aff69-3039-4b91-9fbe-8ffb7c0607fc` y consignada en el registro de decisiones unipersonales.
6. **Actuación de administradores solidarios en filial 2.3 (4.5):**
   - Stepper de 4 pasos completado para Administradores Solidarios en `Tecnología e Innovación Nueva, S.L.`.
   - Administradora actuante `Laura Ibáñez Vega` seleccionada entre los 3 administradores vigentes.
   - Evaluación por motor LSC positiva ("Acuerdo solidario válido, Severity: OK") y acuerdo materializado en estado `ADOPTED` con id `6c0959c5-4be1-44d1-8644-ce8aec5aa765`.
7. **Tramitador registral de extremo a extremo (4.6):**
   - Validación de inscribibilidad: acuerdos no inscribibles bloquean el trámite.
   - Acuerdo inscribible `NOMBRAMIENTO_CONSEJERO` (`172f33d4…`): dictaminado `Documento base: ESCRITURA`.
   - Instrumento notarial protocolizado (Notaría García-Valdecasas).
   - Documento preparatorio DOCX generado y archivado (`a31d52f6…`, SHA-512 `41f69540…`).
   - Filing preparado en estado `ELEVADA` (`053a52a8…`) y asiento de presentación asentado en el Registro Mercantil en estado `PRESENTADA` con número `ASIENTO-2026-0925-001`.
8. **Certificaciones autónomas (4.7):**
   - Pantalla de certificaciones autónomas operativa. Bloqueo en emisión por catálogo y custodia final EAD Trust pendiente de decisión en **MOI-144** y **MOI-145**.
9. **Libros societarios y Cap Table (4.8):**
   - 38 libros obligatorios persistidos con plazos de legalización (30/04/2027).
   - Cap table actual en modo Sociedad 100% verificado: Matriz (60/40), Filial 2.2 (100% matriz), Filial 2.3 (70/30).
10. **Comunicaciones, calendario y Board Pack ejecutivo (4.9 y 4.10):**
    - Bandeja de comunicaciones neutral honesta (0 envíos simulados).
    - Calendario agregador calcula vencimientos en ventana de 90 días sin alertas espurias.
    - Board Pack genera informe ejecutivo dinámico para el Consejo de Administración de `Corporación Nueva, S.A.` (Presidente Carlos Mendoza, Secretaria Elena Gómez, orden del día de presupuesto 2026), exportable e impermeable entre tenants.

## 7. Referencias

- Spec Garrigues: `docs/superpowers/specs/2026-08-02-garrigues-tenant-gobernanza-design.md` (D2 aislamiento; §7 deja «white-label para un tercer cliente» como YAGNI hasta que exista: ya existe).
- Plan G0: `docs/superpowers/plans/2026-08-02-g0-tenant-garrigues-fundacion.md`.
- `CLAUDE.md` §«Tenant Garrigues — G0 fundación + G1 espejo societario» (gotchas de RLS, defaults de tenant, canal Cloud).
- Alta de sociedad: `supabase/migrations/20260515183150_secretaria_d6_crear_sociedad_legal_y_capital.sql`, `src/lib/secretaria/sociedad-onboarding/`.
- Tenant cero: spec `docs/superpowers/specs/2026-09-19-tenant-cero-onboarding-design.md`, plan `docs/superpowers/plans/2026-09-19-tenant-cero-bootstrap.md`, guion `docs/superpowers/plans/2026-09-19-tenant-cero-guion-recorrido.md`, código en `scripts/tenant-bootstrap.ts`, `scripts/export-pack-base-lsc.ts` y `scripts/tenants/`.
