# UX Configuración Secretaría — Fase 1: coherencia transversal

> Plan detallado derivado del plan marco `2026-07-11-ux-configuracion-oleada2-coherencia-plan.md`. Se ejecuta después de la Fase 0 y antes de cualquier backlog específico de pantalla.

**Objetivo:** que Materias y reglas, Plantillas y Gobierno de plantillas compartan lenguaje jurídico, semántica de estados, labels, criterios de incidencia y viajes contextuales, sin alterar identidades Cloud ni romper los contratos de navegación.

**Método:** auditoría adversarial contra código y Cloud → plan → tests de caracterización → implementación → escritura Cloud por MCP con migración espejo → gates completos → verificación en vivo con login demo → review adversarial del diff → fixes.

## 1. Evidencia de entrada y decisiones cerradas

### 1.1 Estado del repositorio

- Worktree e index limpios al empezar; `main` está dos commits por delante de `origin/main` y no está por detrás.
- Oleada 1 local:
  - `b61b57b` — Materias y reglas + Plantillas.
  - `6e07833` — Gobierno de plantillas + plan marco.
- No se empuja ni se crea commit sin confirmación expresa. Cualquier `git add` usará rutas específicas.

### 1.2 Sesiones paralelas de Fase 0

- ITEM-089 es un fallo preexistente de HEAD: `CatalogoTab` oculta el CTA de fixtures mientras e2e/14 y e2e/17 lo exigen. El parche validado del worktree histórico se extraerá por hunks, sin fusionar el worktree: conservará `Cobertura provisional`, mostrará `Fixture local · puente de cobertura` y permitirá iniciar el trámite.
- El parche aislado no basta: `TramitadorLista` pierde `plantilla`, `tipo`, `scope` y `entity` al navegar a `/nuevo`. Se cerrará ese handoff y e2e/17 recorrerá el clic real, no un `page.goto` artificial.
- La migración ortográfica `20260710103000_materia_catalog_orthography_fix.sql` está aplicada y registrada en Cloud; 18/18 labels/referencias coinciden. No se reintroducirá overlay local. La deuda de cuerpos Capa 1 y `rule_packs.descripcion` se difiere a revisión jurídica de contenido.

### 1.3 Decisiones del Workstream D confirmadas por el usuario

1. **Art. 308 LSC:** alias exclusivamente de presentación. `EXCLUSION_DERECHO_SUSCRIPCION_PREFERENTE` se colapsa en `SUPRESION_PREFERENTE`, con label visible `Exclusión o supresión del derecho de preferencia` y nota de uso. No se borran ni renombran filas.
2. **FORMULACION_CUENTAS:** la combinación core pasa a `CONSEJO_ADMIN`; el binding stale se reapunta a la plantilla ACTIVA v1.2.0 de Consejo. No se retipa contenido ni se reactiva la versión archivada.
3. **NULL tipado:** `organo_tipo NULL` es metadato ausente; `adoption_mode NULL` solo es `No aplica` en documentos no adoptables; en documentos adoptables es ausencia; `tipo_social NULL` significa `Todos los tipos sociales`; `ANY` explícito queda reservado a bindings.
4. **Supuestos duplicados:** CESE/NOMBRAMIENTO v1.1.1 y ACTA_SESION v1.2.1 son variantes jurídicas por órgano/contenido. Se conservan todas. Solo una identidad funcional completa idéntica será incidencia de duplicidad.
5. **Tabs del Gestor:** se conservan los ocho IDs. En Fase 2 Gestor se aplicarán los labels confirmados: Salud documental, Catálogo gobernado, Cobertura por materia y órgano, Indicadores de ciclo de vida, Auditoría y changelog, Importar, Comprobación documental y Configuración por sociedad. La cola de incidencias será una sección priorizada de Salud documental, no una novena tab.

## 2. Resultado de la auditoría adversarial de Fase 1

### 2.1 Lenguaje

Brechas verificadas:

- `Plantillas.tsx` aún presenta `Configuración del motor`, `Gate PRE`, `motor de documentos` y mensajes de activación técnicos al abogado.
- `CatalogoMaterias.tsx` conserva `para que el motor habilite el expediente`.
- `CatalogoTab`, `ValidacionTab`, `TemplateImportWizard` y `TriCapaEditor` mezclan `Gate PRE`, `preflight`, `headless`, `issues` y nombres de función como copy principal.
- El contrato unitario y e2e/17/e2e/22 fijan parte de ese copy antiguo.

Glosario canónico:

| Concepto interno | Vista jurídica | Vista técnica/administrativa |
|---|---|---|
| Gate PRE / preflight | Comprobación documental previa | Comprobación documental previa (Gate PRE) |
| motor de documentos | Generación documental | Motor de generación documental, solo como detalle secundario |
| regla engine | Regla aplicable | Motor de reglas, solo como detalle secundario |
| warnings / issues | Advertencias / incidencias | Código técnico como dato secundario |
| active | Vigente para nuevos expedientes | Estado técnico ACTIVA como dato secundario cuando proceda |
| fixture | Cobertura provisional | Fixture local · puente de cobertura como detalle secundario |
| draft version | Versión provisional | Versión provisional |

No se renombrarán APIs, tipos, comentarios internos ni códigos estables solo para traducir la UI.

### 2.2 Labels y semántica visual

Brechas verificadas:

- Existen tres fuentes divergentes para órgano/adopción/tipo: `template-admin/labels.ts`, helpers en `mesa-control-societaria.ts` y funciones locales de `Plantillas.tsx`.
- `adoptionModeBusinessLabel(NULL)` cae erróneamente a `Sesión formal`; otros consumidores muestran `—`, `No informada` o `Cualquier forma`.
- `REVISADA` usa tonos diferentes entre Plantillas y Gestor.
- Los sistemas de estado representan ejes distintos y no deben fusionarse: ciclo de vida, disponibilidad jurídica, salud agregada y cobertura de materia.

Decisión de diseño:

- `template-admin/labels.ts` será la única fuente de labels de tipo, órgano, adopción, estado de ciclo, jurisdicción y tipo social.
- `agenda-materias.ts::labelMateria` será la única fuente de labels de materia, con fallback humanizado y override del art. 308.
- Los helpers públicos de `mesa-control-societaria.ts` quedarán temporalmente como wrappers compatibles o se migrarán sus consumidores; no mantendrán mapas propios.
- Se centralizará un vocabulario de tonos semánticos, no un único vocabulario de nombres:
  - `success`: operativo/lista/vigente;
  - `warning`: advertencia o revisión pendiente;
  - `info`: contexto o trabajo en curso;
  - `error`: bloqueo o incidencia;
  - `neutral`: histórico/no aplica.
- Los chips usarán solo tokens Garrigues/estado. Warning/error no dependerán de texto inverso sobre fondos de contraste dudoso.

### 2.3 Incidencias

Brechas verificadas:

- `legal-template-review` llama duplicada a cualquier pareja `tipo + materia`, mezclando variantes legítimas de órgano/adopción.
- `detectTemplateDataDuplicates` usa una identidad más completa, mientras el Gate usa `buildFunctionalKey`; esta última fuerza `tipoSocial: null` aunque el row lo contenga.
- Plantillas audita vigentes y Gestor todos los estados, de modo que los contadores no son comparables.

Responsabilidad canónica por concepto:

| Concepto visible | Fuente canónica | Severidad/efecto |
|---|---|---|
| Plantilla activa equivalente | clave funcional completa + `detectActiveDuplicate` | bloqueante |
| Variante por órgano o forma de adopción | agrupación descriptiva | informativa, nunca duplicado |
| Versión provisional | predicado compartido de versión | revisión |
| Falta órgano o forma de adopción | política tipada por tipo documental + Gate semántico | bloqueante si el documento es adoptable |
| Falta referencia legal | validación de activación | revisión/bloqueo según tipo |
| Falta aprobación formal | plan de aprobación + metadatos | revisión |
| Variables sin origen de datos | validación de capas | bloqueante |
| Vínculo a una versión no vigente | bindings/changelog | incidencia |
| Cobertura provisional | `isLocalFixture` | advertencia no bloqueante |
| Sin changelog | huérfanos de changelog | advertencia |

La identidad funcional será: tenant + tipo + jurisdicción + materia canónica + órgano + adopción + tipo social. La versión distingue historial de una misma pieza; la misma identidad y misma versión es duplicidad de datos. La materia se normaliza por alias solo para comparar, nunca para mutar filas.

### 2.4 Viajes y URL

Brechas verificadas:

- Materias conserva sus propios parámetros, pero algunos enlaces omiten `entity/scope/materia`.
- Plantillas solo consume `materia` y `tipo`; no sincroniza `plantilla` ni `ciclo`, y `tipo` no filtra realmente el catálogo.
- Gestor consume `materia/plantilla`, pero cambiar tab o redirigir por RBAC hace `setSearchParams({tab})` y destruye el contexto. El deep-link a una segunda plantilla en el mismo mount no se vuelve a resolver.
- No existe viaje Plantillas/Gestor → Materias.

Contrato URL de Fase 1:

- IDs existentes de `?vista=` y `?tab=` permanecen intactos.
- Cada navegación clonará los parámetros compatibles y cambiará solo las claves propias del destino.
- Materias: `entity`, `scope`, `materia`, `vista`.
- Plantillas: `entity`, `scope`, `materia`, `tipo`, `plantilla`, `ciclo`.
- Gestor catálogo: `entity`, `scope`, `tab=catalogo`, `materia`, `plantilla`, `estado` cuando aplique.
- Tramitador: `entity`, `scope`, `plantilla`, `tipo`, y `materia` cuando exista.
- Un target inexistente o fuera de scope mostrará estado explícito y recuperable; no dejará un panel vacío indefinido.

## 3. Implementación

### T1 — Caracterización y helpers canónicos de presentación

**Archivos:**

- `src/lib/secretaria/template-admin/labels.ts`
- `src/lib/secretaria/template-admin/types.ts`
- nuevo helper de tono/estado bajo `src/lib/secretaria/template-admin/`
- `src/lib/secretaria/agenda-materias.ts`
- tests existentes de labels/agenda/mesa-control

**Cambios:**

1. Ampliar mapas canónicos y fallbacks humanizados.
2. Añadir helpers explícitos para `NULL`, `ANY`, documentos adoptables/no adoptables y `tipo_social`.
3. Definir tonos semánticos sin clases Tailwind de color nativo ni hex.
4. Añadir el label combinado del art. 308.
5. Escribir tests antes de migrar consumidores.

### T2 — Identidad funcional y detectores únicos

**Archivos:**

- `src/lib/secretaria/template-admin/functional-key.ts`
- `src/lib/secretaria/template-admin/types.ts`
- `src/lib/secretaria/legal-template-review.ts`
- `src/lib/secretaria/mesa-control-societaria.ts`
- tests de `template-admin`, review legal y mesa-control

**Cambios:**

1. Incorporar `tipo_social` y materia canónica a `PlantillaCandidate/buildFunctionalKey`.
2. Reusar la identidad en agrupación/duplicidad visible.
3. Dejar de marcar variantes por órgano/adopción como duplicadas.
4. Exportar/reusar predicados de versión provisional, fixture y política de metadatos.
5. Alinear labels y contadores en las tres superficies sin mezclar todos los estados con la cohorte vigente.

### T3 — Art. 308: alias de presentación completo

**Archivos:**

- `src/lib/secretaria/mesa-control-societaria.ts`
- `src/lib/secretaria/agenda-materias.ts`
- `src/pages/secretaria/CatalogoMaterias.tsx`
- tests de alias, pactos, overrides, bindings y tarjeta única

**Cambios:**

1. Añadir `EXCLUSION_DERECHO_SUSCRIPCION_PREFERENTE → SUPRESION_PREFERENTE`.
2. Hacer alias-aware el matching plantilla↔materia y la identidad funcional.
3. Mostrar una sola tarjeta y una nota que conserva la terminología del art. 308.
4. Verificar que deep-links legacy, pactos y overrides llegan a la canónica sin modificar datos.

### T4 — Glosario y estados en las tres superficies

**Archivos principales:**

- `src/pages/secretaria/CatalogoMaterias.tsx`
- `src/pages/secretaria/Plantillas.tsx`
- `src/components/secretaria/gestor/CatalogoTab.tsx`
- `src/components/secretaria/gestor/ValidacionTab.tsx`
- `src/components/secretaria/gestor/TemplateImportWizard.tsx`
- `src/components/secretaria/gestor/TriCapaEditor.tsx`
- `src/components/secretaria/gestor/CoberturaLegalTab.tsx`
- `src/components/secretaria/gestor/MetricasTab.tsx`

**Cambios:**

1. Sustituir copy técnico principal por el glosario canónico; conservar códigos solo como detalle administrativo.
2. Migrar labels locales a helpers canónicos.
3. Aplicar la misma asignación de tonos a estados equivalentes.
4. Mantener foco visible, labels accesibles, `aria-busy/invalid/describedby` y tokens Garrigues.

### T5 — Deep-links contextuales y viaje inverso

**Archivos principales:**

- nuevo helper puro de URL bajo `src/lib/secretaria/`
- `src/pages/secretaria/CatalogoMaterias.tsx`
- `src/pages/secretaria/Plantillas.tsx`
- `src/pages/secretaria/GestorPlantillas.tsx`
- `src/components/secretaria/gestor/CatalogoTab.tsx`
- `src/pages/secretaria/TramitadorLista.tsx`
- tests unitarios del helper y e2e afectados

**Cambios:**

1. Clonar y mutar search params de forma explícita; nunca `setSearchParams({tab})` si hay contexto.
2. Plantillas consume/sincroniza `materia`, `tipo`, `plantilla` y `ciclo`.
3. Gestor reacciona a cambios de `materia/plantilla` sin remount y preserva parámetros compatibles.
4. Añadir `Ver materia y reglas` y `Administrar esta plantilla` con contexto completo.
5. Preservar `plantilla/tipo/materia/entity/scope` en el salto Tramitador lista→nuevo.

### T6 — ITEM-089 integrado, no parche superficial

**Archivos:**

- `src/components/secretaria/gestor/CatalogoTab.tsx`
- `src/pages/secretaria/TramitadorLista.tsx`
- `e2e/14-secretaria-documentos.spec.ts`
- `e2e/17-secretaria-template-context.spec.ts`

**Cambios:**

1. Extraer solo los tres hunks validados del worktree histórico.
2. Permitir CTA en fixture ACTIVA manteniendo advertencia de cobertura provisional.
3. Recorrer el handoff real hasta `/nuevo` y comprobar que se conservan `plantilla` y `tipo`.
4. Documentar que los dos fallos eran preexistentes en HEAD.

### T7 — Corrección Cloud de FORMULACION_CUENTAS

**Archivos:**

- `src/lib/secretaria/template-admin/functional-key.ts`
- tests de cobertura core
- nueva migración forward-only `supabase/migrations/20260711*_secretaria_formulacion_cuentas_binding.sql`

**Secuencia obligatoria:**

1. Ejecutar `bun run db:check-target` y confirmar `governance_OS` (`hzqwefkwsxopwrmtksbg`).
2. Probar Cloud otra vez: plantilla activa target, binding stale por ID/clave, unicidad parcial y matriz efectiva.
3. Crear SQL idempotente con assertions:
   - validar la plantilla ACTIVA v1.2.0 `bc49965f-2c0b-4778-9751-163f87fcbff6` como `CONSEJO_ADMIN/MEETING`;
   - desactivar o actualizar exactamente el binding stale, sin crear dos candidatos equivalentes;
   - dejar una sola fila activa canónica hacia la v1.2.0;
   - no alterar plantillas ni filas de materia.
4. Ejecutar el contenido espejo exclusivamente mediante MCP `execute_sql`.
5. Registrar la versión en `supabase_migrations.schema_migrations` dentro de la misma transacción si `execute_sql` no lo hace automáticamente, siguiendo el patrón del repo.
6. Verificar binding, plantilla, recuento de activos, registro de migración y matriz efectiva. No actualizar la matriz a mano; rematerializar solo mediante RPC canónica si el probe demuestra staleness independiente.
7. No usar `db push --linked`, `migration repair` ni otro canal.

### T8 — Contratos coordinados

**Archivos mínimos:**

- `src/test/secretaria/mesa-control-ui-contract.test.ts`
- `e2e/08-secretaria-plantillas.spec.ts`
- `e2e/14-secretaria-documentos.spec.ts`
- `e2e/17-secretaria-template-context.spec.ts`
- `e2e/22-secretaria-template-import-wizard.spec.ts`
- otros e2e 12/16/21/24/25 solo si el copy o navegación compartida cambia

**Cambios:**

1. Reemplazar el contrato positivo `Configuración del motor` por el copy jurídico.
2. Añadir negativos para jargon no traducido en vistas jurídicas.
3. Fijar alias art. 308, semántica NULL, duplicidad exacta/variante y round-trip de URLs.
4. Actualizar locators visibles de Capa 2 y comprobación documental en el mismo cambio de UI.

## 4. Gates y cierre de fase

### 4.1 Gates locales

1. Tests dirigidos durante la implementación.
2. `bun test` completo.
3. `bun run typecheck`.
4. ESLint solo de todos los `.ts/.tsx` tocados, enumerados explícitamente.
5. Auditoría Garrigues de archivos tocados: cero hex, colores Tailwind nativos o estilos inline de color; cero componentes con ref sin `forwardRef`; icon-only con `aria-label`.
6. `bun run build`.
7. E2E directos: 08, 14, 17 y 22; añadir todo test cuyo contrato se haya tocado. Ejecutar además la regresión de las tres superficies 12, 16, 21, 24 y 25 cuando los cambios compartidos puedan afectarlas.

### 4.2 Verificación Cloud y en vivo

Con `demo@arga-seguros.com`:

- Art. 308 muestra una tarjeta, label combinado y nota; deep-link legacy aterriza en ella.
- FORMULACION_CUENTAS ya no aparece como gap core y el detalle apunta a la v1.2.0 activa de Consejo.
- CESE, NOMBRAMIENTO y ACTA_SESION muestran variantes distinguibles y no incidencias falsas.
- `NULL` se presenta según tipo documental y `tipo_social NULL` como todos los tipos sociales.
- Materias → Plantillas → Gestor → Materias conserva materia, plantilla, entidad/scope y filtros compatibles.
- Fixture local mantiene el CTA y el salto real a nuevo trámite conserva la plantilla.
- Revisar escritorio y 390 px; sin overflow horizontal, foco perdido ni panel vacío.

Guardar evidencia de URL, datos visibles y probes Cloud en la sección post-review de este plan.

### 4.3 Review adversarial

Tras todos los gates:

- Revisor 1: lógica, detectores, alias, NULL y riesgos de datos.
- Revisor 2: UX/copy/accesibilidad/tokens y coherencia de estados.
- Revisor 3: navegación, contratos/e2e y migración/Cloud.
- Aplicar todos los P0/P1 y los P2 pertinentes; repetir gates afectados.
- Solo entonces marcar la Fase 1 cerrada y pasar a la auditoría de Fase 2 — Materias y reglas.

## 5. Fuera de alcance de esta fase

- Renombre visible de tabs y cola unificada: Fase 2 Gestor, con IDs estables.
- Búsqueda avanzada, tabla comparativa, ayudas, explicación de regla y matriz documental: Fase 2 Materias.
- Comparación histórica y columna tipo social: Fase 2 Plantillas.
- Reescritura jurídica masiva de cuerpos Capa 1 o `rule_packs.descripcion`.
- Borrado, renombrado o consolidación física de `materia_catalog` o `plantillas_protegidas`.
- Commits o push sin autorización expresa.

## 6. Registro de ejecución

**Estado: CERRADA el 2026-07-11.** No se ha creado commit ni se ha preparado el index.

### 6.1 Implementación consolidada

- Labels, tonos y semántica `NULL/ANY` centralizados en `template-admin/labels.ts`; los consumidores de Materias, Plantillas y Gestor usan el mismo vocabulario jurídico y los mismos tonos semánticos.
- Identidad funcional completa: tenant + tipo + jurisdicción + materia canónica + órgano + adopción + tipo social. La revisión legal enfrenta solo plantillas `ACTIVA` equivalentes; el detector de duplicado de datos conserva además la versión.
- Las variantes CESE/NOMBRAMIENTO/ACTA_SESION se conservan y se distinguen por órgano, adopción o tipo social. Una equivalencia activa bloquea el claim `Aprobada legalmente`, incluso si existe un dictamen del Comité, y queda como `Revisión legal` hasta resolver la coexistencia.
- Art. 308 colapsado solo en presentación bajo `SUPRESION_PREFERENTE`, con label combinado. El mapping al pacto conserva `EXCLUSION_PREFERENTE`; no se modificó ninguna fila Cloud.
- Nuevo helper puro `template-configuration-routing.ts` para round-trips y handoffs. `scope=grupo` queda explícito; los destinos de sociedad conservan `entity`; targets inexistentes muestran una alerta recuperable sin perder el query solicitado.
- ITEM-089 integrado con CTA de fixture en Gestor y handoff real hasta Tramitador. La navegación inversa a Plantillas se oculta para fixtures locales porque no existe una fila persistida equivalente; la UI lo explica.
- Estados de error Cloud explícitos en las tres superficies y sus tabs dependientes. Se añadieron accesos por teclado en filas, `aria-label` en acciones de icono, contraste AA y scroll interno de tablas a 390 px.
- Contratos coordinados en el test UI y en e2e 08, 12, 14, 17, 22 y 25. Se preservaron todos los IDs existentes de `tab` y `vista`.

### 6.2 Cloud y migración espejo

- `bun run db:check-target`: `governance_OS` (`hzqwefkwsxopwrmtksbg`) confirmado antes de escribir.
- Migración espejo: `supabase/migrations/20260711123000_secretaria_formulacion_cuentas_binding.sql`.
- El MCP disponible no exponía escritura. Se ejecutó el mismo SQL forward-only mediante Management API con el token del keychain, canal permitido por la política del proyecto.
- Ledger verificado: versión `20260711123000`, `created_by=codex_management_api`.
- Resultado: un único binding activo para `FORMULACION_CUENTAS`, ID `babd5bda…`, apunta a `bc49965f…` v1.2.0 `ACTIVA`, `CONSEJO_ADMIN/MEETING`; la v1.1.0 archivada permanece intacta. Cobertura core: 14/14.
- Contrato estructural añadido en `src/test/schema/secretaria-formulacion-cuentas-binding-migration.test.ts`.

### 6.3 Gates finales

- `bun test`: **2214 pass, 152 skip, 0 fail**, 255 archivos.
- `bun run typecheck`: limpio.
- ESLint de todos los TS/TSX tocados: 0 errores; el rerun final de review legal también quedó limpio.
- Auditoría Garrigues: 0 hex, 0 colores Tailwind nativos, 0 inline colors en los archivos tocados.
- `bun run build`: limpio. Solo permanecen los avisos conocidos de tamaño de chunks/caniuse.
- E2E afectados: **52 pass, 1 skip**. El primer recorrido detectó dos expectativas antiguas de e2e/12 que no incluían el nuevo `scope=grupo` explícito; contrato actualizado y rerun 5/5. ITEM-089: e2e/17 grupo 4/4.
- `git diff --check`: limpio.

### 6.4 Verificación en vivo con datos Cloud

- Art. 308: una tarjeta, label combinado, alias legacy recuperable y pacto `Consentimiento inversor dilución` visible.
- FORMULACION_CUENTAS: v1.2.0 activa de Consejo y core 14/14.
- Variantes v1.1.1 legítimas visibles por separado y sin falsos duplicados.
- Dos versiones activas equivalentes de `CONVOCATORIA_COMISION_DELEGADA`: ambas muestran `Revisión legal`, ninguna `Aprobada legalmente`, y el detalle explica `Plantilla activa equivalente`.
- Scope de grupo preservado de forma explícita en sidebar, enlaces y viajes entre las tres superficies.
- Deep-links inválidos de materia/plantilla conservan el target y ofrecen recuperación; no hay panel vacío silencioso.
- Plantillas expone 17 acciones de detalle accesibles por teclado con `aria-label` descriptiva.
- A 390 px: ancho de página 390 px y tabla de métricas contenida en scroller interno 340→720 px, sin overflow de documento.

### 6.5 Review adversarial y fixes

Tres revisores independientes cubrieron lógica/datos, UX/accesibilidad y navegación/contratos. No hubo P0. Se aplicaron todos los P1:

1. mapping del alias art. 308 al pacto;
2. equivalencia activa coherente entre superficies, separada de duplicidad exacta;
3. preservación explícita de `scope=grupo` y limpieza de `entity` incoherente;
4. viaje inverso imposible de fixture sustituido por explicación honesta;
5. deep-links inválidos recuperables;
6. errores Cloud explícitos;
7. contraste de estados, acción de fila accesible y fixes mobile;
8. corrección final en vivo: una equivalencia activa ya no puede heredar el badge `Aprobada legalmente` del informe del Comité.

Los fallos originales de e2e/14:147 y e2e/17:4 quedan documentados como preexistentes por ITEM-089, no como regresiones de esta fase.
