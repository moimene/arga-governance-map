# Personas y Cargos — Refactor crítico (sprint inmediato + Plan A' diferido)

**Fecha:** 2026-05-12
**Autores:** Moisés Menéndez (decisión de scope) + Equipo Legal Garrigues (validación LSC/RRM) + Claude (análisis técnico)
**Estado:** APROBADO PARA EJECUCIÓN — sprint inmediato 5-7 días con ventana demo Garrigues semana 19-23 mayo 2026
**Contexto previo:**
- `docs/superpowers/specs/2026-04-21-certificacion-autoridad-design.md` (modelo SoA + authority_evidence)
- `docs/superpowers/specs/2026-04-21-gestion-societaria-mvp-design.md` (pipeline acta/certificación)
- Modelo canónico Fase 0+1 ya consolidado (`condiciones_persona`, `authority_evidence`, `representaciones`, `persons` con `representative_person_id`)

---

## 1. Propósito

Cerrar el ciclo operativo **alta de persona → designación de cargo → cese → certificación** del módulo "Personas y Cargos" para que el Comité Legal Garrigues pueda revisar las plantillas de nombramiento, cese y distribución de cargos con datos coherentes en la ventana de demo del 19-23 mayo 2026.

El módulo HOY tiene scaffolding extenso (páginas + hooks + DesignarAdminStepper completo) pero le falta la capa de mutaciones, las acciones contextuales desde Personas, y tiene cinco grietas estructurales que un auditor mercantilista detectaría visualmente:

1. **Identidad fragmentada:** dos+ filas `persons` para la misma sociedad (probe Cloud confirmó "Cartera ARGA" ×3, "ARGA Seguros" ×2 con CIFs canónicos y placeholders coexistiendo).
2. **Cardinalidad sin enforce:** el esquema no previene dos PRESIDENTEs vigentes simultáneos del mismo CdA.
3. **Sync `authority_evidence` con campos perdidos:** el trigger descarta `inscripcion_rm_referencia` e `inscripcion_rm_fecha` aunque la UI los captura.
4. **Dual source de representante PJ:** `persons.representative_person_id` + `representaciones.scope='ADMIN_PJ_REPRESENTANTE'` divergen en datos demo.
5. **Backfill incompleto:** 10 de 20 PRESIDENTEs VIGENTES sin fila en `authority_evidence` (50% de cobertura histórica), causado por inserción pre-trigger o por que el cargo es PRESIDENTE de comisión y debate sobre si debe sincronizar.

El sprint inmediato resuelve los puntos 1, 3, 5 a nivel BD y los tres síntomas operativos prioritarios (urgencia 5 según equipo legal): alta de cargo desde Personas, cese de cargo con cierre de vigencia, y representante PF para PJ administradora. Los puntos 2 y 4 se difieren al Plan A' (sprint siguiente) con respaldo legal explícito ("warning visible es suficiente, bloqueo duro debe estar en emisión de certificación, no en alta").

---

## 2. Decisiones legales validadas (Equipo Legal Garrigues, 2026-05-12)

| # | Cuestión | Decisión | Base LSC/RRM |
|---|---|---|---|
| L1 | PJ socio (no admin) en JGA | **No requiere representante PF permanente**. Acude con apoderado puntual (proxy). | LSC art. 184 |
| L2 | PJ administradora | **Sí requiere representante PF permanente** inscribible. | LSC art. 212 bis; RRM art. 143 |
| L3 | Alta PJ con cargo admin sin representante | **Aceptable como demo con warning**. Bloqueo duro va en emisión de certificación, no en alta. | Práctica registral; LSC art. 212 bis |
| L4 | Cardinalidad PRESIDENTE CdA | 1 (uno) por CdA | LSC art. 529 sexies (cotizadas) + práctica universal |
| L5 | Cardinalidad VICEPRESIDENTE | Sin límite legal; típicamente 1-2. **No forzar en BD; parametrizable por estatutos.** | LSC art. 210; estatutos |
| L6 | Cardinalidad SECRETARIO | 1 (uno) | RRM art. 109 |
| L7 | Cardinalidad VICESECRETARIO | 1 (uno) en práctica habitual; no hay prohibición legal de varios | RRM art. 109 (suplencia) + 529 octies LSC |
| L8 | Cardinalidad CONSEJERO_COORDINADOR | 1 (uno) en cotizadas | LSC art. 529 septies |
| L9 | ADMIN_UNICO | 1 (uno) por definición | LSC art. 210 |
| L10 | ADMIN_SOLIDARIO | Mínimo 2, sin máximo legal | LSC art. 210 |
| L11 | ADMIN_MANCOMUNADO | Mínimo 2, en SL más si estatutos | LSC art. 210 |
| L12 | Enforce de cardinalidad en BD | **No obligatorio para demo.** Validación humana + warnings suficientes. Plan A' diferido. | Decisión operativa equipo legal |
| L13 | Vacancia presidencial | **Legal y transitoria**. Máximo razonable 90 días sin cobertura. Preside Vicepresidente o suplente estatutario. | CNMV/Código Buen Gobierno (cotizadas) |
| L14 | Cese + nombramiento sucesor | **Pueden ser actos separados**. No forzar transaccionalidad. | Práctica habitual del CdA |
| L15 | Presidentes de comisiones del CdA | **No certifican societariamente**. Solo firman actas de la comisión. | RRM art. 109 reserva certificación a Secretario del CdA con VºBº del Presidente del CdA |
| L16 | Pestaña "Autoridad certificante" | Limitada a: Secretario CdA, Vicesecretario CdA, Presidente CdA, Vicepresidente CdA, Administrador único, Socio único | RRM art. 109; LSC para unipersonales |
| L17 | VICESECRETARIO | **Es cargo societario inscribible**. Certifica en suplencia del Secretario. Debe estar en BD y en "Autoridad certificante" como suplente. | RRM arts. 109, 124; LSC art. 529 octies |
| L18 | COMISIONADO | **NO es cargo societario inscribible**. Rol operativo interno de comité. **DESCARTADO del scope** de Personas y Cargos. | RRM art. 124 (no enumerado) |
| L19 | Unicidad NIF/CIF | **Dos identidades distintas con mismo NIF/CIF es siempre error.** UNIQUE constraint obligatorio. | AEAT (identificador único) |
| L20 | Sociedad cambia CIF (transformación/fusión) | Caso edge no presente en demo ARGA. **Diferido a Plan A'** o futuro. | RDL 5/2023 art. 3 |
| L21 | Inscripción RM y certificación | Nombramiento válido desde designación (declarativa). **Para certificar a terceros se exige `inscripcion_rm_referencia`.** | LSC art. 214; RRM art. 109 |
| L22 | Distinción `VIGENTE_INSCRITO` vs `VIGENTE_NO_INSCRITO` | Cargo puede existir y actuar internamente sin inscripción RM. Solo bloquear emisión de certificación si falta inscripción. | LSC art. 214 + RRM art. 109 |
| L23 | Referencia RM en `authority_evidence` | **Obligatoria para considerar al cargo "certificante"**. Trigger debe propagarla. Backfill necesario. | RRM art. 109 |

**Conclusión legal de scope:** Plan híbrido más cerca de B con tres prioridades cerradas en sprint inmediato + Plan A' completo en 2-3 semanas siguientes.

---

## 3. Alcance del sprint inmediato (5-7 días)

### P1 — Alta + cese + histórico de cargos desde Personas y Cargos (urgencia 5)

**Caso operativo bloqueado:** distribución de cargos del CdA de ARGA Seguros + cese de consejero por renuncia (plantilla `CESE_CONSEJERO`).

**Entregables:**

- Botón "Asignar cargo a esta persona" en `PersonaDetalle.tsx`
  → navega a `DesignarAdminStepper` con `?personId=X` (URL param nuevo)
  → si llega `personId`, salta el paso 0 ("Persona") del stepper
  → si llega sin `entityId`, añade paso "Sociedad" antes de "Cargo"

- Botón "Asignar cargo" en `PersonasList.tsx` con acción contextual por fila
  → mismo flujo, abre stepper con `personId` pre-seleccionado

- Acción "Cesar cargo" en cada fila de cargos vigentes en `PersonaDetalle.tsx`
  → modal con `fecha_fin` (default hoy) + razón libre opcional
  → UPDATE `condiciones_persona SET estado='CESADO', fecha_fin=?`
  → trigger `fn_sync_authority_evidence` propaga el cese a `authority_evidence`

- Separación tabular en `PersonaDetalle.tsx`: "Cargos vigentes" / "Histórico (cesados)"

- Hooks nuevos en `src/hooks/useCargos.ts`:
  - `useAsignarCargo(input: CargoInput)` — mutation `condiciones_persona INSERT` con validación cliente (regla de coherencia body_id según tipo).
  - `useCesarCargo(condicionId: string, fechaFin: string, razon?: string)` — mutation UPDATE.
  - Reuso del flujo `DesignarAdminStepper` adaptado a `personId` por URL.

**No incluido (diferido a Plan A'):**
- Enforce singleton automático ("ya hay un Presidente vigente — cesar antes")
- Transaccionalidad cese+nombramiento atómico
- Sucesión obligatoria
- Edición de persona post-alta

### P2 — Eliminar duplicados de personas + UNIQUE(tax_id) (urgencia 4)

**Caso operativo:** "Cartera ARGA" ×3 + "ARGA Seguros" ×2 visibles en dropdowns es inaceptable para auditor Garrigues.

**Entregables:**

- Migración `20260513_000063_persons_tax_id_unique.sql`:
  ```sql
  -- UNIQUE parcial: excluye placeholders E2E y PENDIENTE
  CREATE UNIQUE INDEX IF NOT EXISTS ux_persons_tax_id_real
    ON persons(tenant_id, tax_id)
    WHERE tax_id IS NOT NULL
      AND tax_id NOT LIKE 'PENDIENTE-%'
      AND tax_id NOT LIKE 'E2E-%'
      AND tax_id NOT LIKE 'FREE-FLOAT-%';
  ```

- Script de consolidación `scripts/consolidate-duplicate-persons.ts`:
  - Detecta pares `(tax_id canónico, persona PENDIENTE/duplicada)` por `full_name` similarity + tax_id pattern
  - Lista candidatos para confirmación humana antes de ejecutar
  - Migra referencias: `condiciones_persona.person_id`, `condiciones_persona.representative_person_id`, `capital_holdings.holder_person_id`, `representaciones.represented_person_id`/`representative_person_id`, `meeting_attendees.attendee_person_id`, `persons.representative_person_id`
  - Soft-archive de la duplicada (NO DELETE — preserva audit y FK histórica)
  - Idempotente

- En `PersonaNuevaStepper.tsx`: aviso `taxIdConflict.kind === 'person'` pasa de warning a **BLOQUEO**.
  - Botón pasa de "Continuar" a "Abrir ficha existente" → navega a `/secretaria/personas/<id>`.
  - Aviso `taxIdConflict.kind === 'entity'` mantiene su semántica actual (BLOQUEO ya implementado).

- Filtro en queries de selectores (hook helper en `src/lib/secretaria/persona-filters.ts`):
  ```ts
  export const isProductionPerson = (p: PersonaRow) =>
    !p.full_name.startsWith('[E2E REAL]') &&
    !(p.tax_id?.startsWith('PENDIENTE-') ?? false) &&
    !(p.tax_id?.startsWith('E2E-') ?? false) &&
    p.full_name !== 'PRUEBA 1' &&
    p.full_name !== 'PEDRO PRUEBA PRUEBA';
  ```
  Aplicado en `usePersonasCanonical` con flag `excludeTestData` (default `true` en producción demo, `false` en tests E2E).

**Datos a consolidar manualmente (con confirmación previa del usuario antes de ejecutar):**

| Canónico | Duplicado(s) a archivar | Operación |
|---|---|---|
| ARGA Seguros (id `6d7ed736-...`, tax `A-99999903`) | "ARGA Seguros S.A." (`A-00001001`) — si el segundo no tiene cargos ni capital, archivar; si tiene, migrar referencias primero | Manual + confirmación |
| Cartera ARGA SLU (id `b50fad18-...`, tax `B-99999902`) | "Cartera ARGA" `PENDIENTE-517522ab-...` | Migrar referencias a canónico, archivar duplicado |
| Filiales ARGA con `PENDIENTE-...` (ARGA Brasil, ARGA México, etc.) | — | Decisión: asignar CIF real (si existe en estatutos) o mantener como placeholders con marca explícita |

### P3 — Warning PJ sin representante + referencia RM en Autoridad (urgencia 4)

**Caso operativo:** Garrigues exige coherencia registral en la pestaña Autoridad.

**Entregables:**

- Migración `20260513_000064_authority_evidence_trigger_rm_fields.sql`:
  - Trigger `fn_sync_authority_evidence` actualizado: INSERT incluye `inscripcion_rm_referencia` + `inscripcion_rm_fecha` desde `NEW.inscripcion_rm_referencia` + `NEW.inscripcion_rm_fecha`.
  - UPDATE propaga cambios de RM si cambian (estado VIGENTE).
  - Añadir `VICESECRETARIO` al array `v_cargos_certificantes`.
  - Backfill correctivo:
    ```sql
    UPDATE authority_evidence ae
    SET inscripcion_rm_referencia = cp.inscripcion_rm_referencia,
        inscripcion_rm_fecha = cp.inscripcion_rm_fecha,
        updated_at = now()
    FROM condiciones_persona cp
    WHERE cp.tenant_id = ae.tenant_id
      AND cp.person_id = ae.person_id
      AND cp.entity_id = ae.entity_id
      AND COALESCE(cp.body_id, '00000000-0000-0000-0000-000000000000'::uuid)
          = COALESCE(ae.body_id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND cp.tipo_condicion = ae.cargo
      AND cp.estado = 'VIGENTE'
      AND ae.estado = 'VIGENTE'
      AND ae.inscripcion_rm_referencia IS NULL
      AND cp.inscripcion_rm_referencia IS NOT NULL;

    -- Recreate authority_evidence rows for PRESIDENTE/SECRETARIO vigentes sin AE
    INSERT INTO authority_evidence (...)
    SELECT cp.tenant_id, ... FROM condiciones_persona cp
    LEFT JOIN authority_evidence ae ON (matching predicate)
    WHERE cp.tipo_condicion IN (cargos certificantes incluyendo VICESECRETARIO)
      AND cp.estado = 'VIGENTE' AND ae.id IS NULL
    ON CONFLICT DO NOTHING;
    ```

- Migración `20260513_000065_condiciones_persona_vicesecretario.sql`:
  ```sql
  ALTER TABLE condiciones_persona
    DROP CONSTRAINT IF EXISTS chk_condiciones_persona_tipo_condicion;
  ALTER TABLE condiciones_persona
    ADD CONSTRAINT chk_condiciones_persona_tipo_condicion
    CHECK (tipo_condicion IN (
      'SOCIO',
      'ADMIN_UNICO','ADMIN_SOLIDARIO','ADMIN_MANCOMUNADO','ADMIN_PJ',
      'CONSEJERO','PRESIDENTE','SECRETARIO','VICEPRESIDENTE','VICESECRETARIO',
      'CONSEJERO_COORDINADOR'
    ));

  ALTER TABLE condiciones_persona
    DROP CONSTRAINT IF EXISTS chk_condicion_body_coherente;
  ALTER TABLE condiciones_persona
    ADD CONSTRAINT chk_condicion_body_coherente CHECK (
      (tipo_condicion IN ('SOCIO','ADMIN_UNICO','ADMIN_SOLIDARIO','ADMIN_MANCOMUNADO','ADMIN_PJ')
        AND body_id IS NULL)
      OR
      (tipo_condicion IN ('CONSEJERO','PRESIDENTE','SECRETARIO','VICEPRESIDENTE','VICESECRETARIO','CONSEJERO_COORDINADOR')
        AND body_id IS NOT NULL)
    );
  ```

- Actualizar `src/hooks/useCargos.ts` (`TipoCondicion`, `CARGO_LABELS`, arrays `CARGOS_ORGANO_COLEGIADO`) y `src/hooks/useAuthorityEvidence.ts` (`CargoCertificante`, `CARGO_CERT_LABELS`) para incluir `VICESECRETARIO`.

- En `PersonaDetalle.tsx`, para personas PJ:
  - Detectar caso "PJ con cargo `ADMIN_*` vigente y sin representante PF":
    - `representative_person_id IS NULL` Y
    - No hay `representaciones` activa con `scope=ADMIN_PJ_REPRESENTANTE` y `entity_id` de cada cargo admin vigente
  - Banner amarillo con texto: "Esta persona jurídica administradora requiere representante PF permanente (LSC art. 212 bis) — pendiente de asignar".
  - Botón "Asignar representante" → abre nuevo wizard.

- Nuevo wizard `RepresentanteAdminPJStepper.tsx` (3 pasos):
  1. Seleccionar PF existente **o** crear PF nueva (inline, reusa `PersonaNuevaStepper` modal).
  2. Referencia RM (obligatoria si la designación es inscribible; opcional para draft).
  3. Confirmar → INSERT en `representaciones` con `scope=ADMIN_PJ_REPRESENTANTE` + UPDATE `persons.representative_person_id` (dual-write durante Plan A' transition).

- En `useAuthorityEvidence` y componente "Autoridad certificante" de `SociedadDetalle.tsx`:
  - Chip "Inscrito en RM" (verde, `--status-success`) si `inscripcion_rm_referencia IS NOT NULL`.
  - Chip "Pendiente inscripción" (amarillo, `--status-warning`) si `inscripcion_rm_referencia IS NULL`.

- En `EmitirCertificacionButton.tsx`: bloqueo duro si el cargo certificante seleccionado no tiene `inscripcion_rm_referencia` (toast error + botón deshabilitado).

---

## 4. Cambios de schema (3 migraciones del sprint)

| Migración | Cambia | Reversible |
|---|---|---|
| `20260513_000063_persons_tax_id_unique.sql` | UNIQUE parcial `(tenant_id, tax_id)` excluyendo placeholders | Sí: DROP INDEX |
| `20260513_000064_authority_evidence_trigger_rm_fields.sql` | Trigger `fn_sync_authority_evidence` reescrito + backfill correctivo | Sí: revertir trigger a versión anterior; el backfill es idempotente |
| `20260513_000065_condiciones_persona_vicesecretario.sql` | CHECK extension + coherencia body_id ampliada | Sí: DROP + ADD constraint anterior |

**Pre-requisito:** las tres migraciones se aplican a Cloud (`hzqwefkwsxopwrmtksbg`) vía MCP `apply_migration` con confirmación del usuario, dentro del paquete de sprint, una vez aprobado el plan implementable por writing-plans. NO se aplican sin verificación previa de:
- `bun run db:check-target` pasa
- Script de consolidación de duplicados ya ejecutado (si no, UNIQUE puede fallar)
- Tests schema actualizados para reflejar VICESECRETARIO

---

## 5. Cambios de UI/hooks (resumen)

### Archivos nuevos

- `src/hooks/useCondicionesPersonaMutations.ts` — `useAsignarCargo` + `useCesarCargo`
- `src/hooks/useRepresentantesAdminPJ.ts` — query + mutation para `representaciones` ADMIN_PJ
- `src/lib/secretaria/persona-filters.ts` — `isProductionPerson` + helpers
- `src/lib/secretaria/cargo-validation.ts` — helpers de validación a nivel UI/form (NO confundir con `src/lib/rules-engine/*` que es motor LSC): `requiresBodyId(role)`, `requiresRepresentative(person, role)`, `isAuthorityRole(role)`, `isAuthorityRoleInscribable(role)`
- `src/pages/secretaria/RepresentanteAdminPJStepper.tsx` — wizard 3 pasos
- `scripts/consolidate-duplicate-persons.ts` — consolidación idempotente
- `supabase/migrations/20260513_000063_*.sql` × 3

### Archivos modificados

- `src/pages/secretaria/PersonasList.tsx` — añadir botón "Asignar cargo" por fila + acción
- `src/pages/secretaria/PersonaDetalle.tsx` — botón "Asignar cargo", separación vigentes/histórico, banner PJ sin rep, botón cesar
- `src/pages/secretaria/PersonaNuevaStepper.tsx` — bloqueo (no warning) si `taxIdConflict.kind === 'person'`
- `src/pages/secretaria/DesignarAdminStepper.tsx` — aceptar `?personId=` URL param + paso "Sociedad" condicional
- `src/hooks/useCargos.ts` — añadir VICESECRETARIO al enum + labels + arrays
- `src/hooks/useAuthorityEvidence.ts` — añadir VICESECRETARIO + chip estado inscripción
- `src/hooks/usePersonasCanonical.ts` — flag `excludeTestData` en filtros
- `src/components/secretaria/EmitirCertificacionButton.tsx` — bloqueo si sin RM ref

### Tests nuevos

- `src/test/secretaria/cargo-validation.test.ts` — unit: helpers de validación
- `src/test/secretaria/persona-filters.test.ts` — unit
- `src/test/schema/persons-tax-id-unique.test.ts` — probe Cloud: UNIQUE bloquea duplicados
- `src/test/schema/authority-evidence-trigger-rm.test.ts` — probe: trigger propaga RM
- `src/test/schema/condiciones-persona-vicesecretario.test.ts` — probe: CHECK acepta VICESECRETARIO
- `e2e/20-personas-cargos-flow.spec.ts` — Playwright: alta cargo desde Personas, cese, alta PJ con rep
- Tests de regresión existentes (`canonical-model.test.ts`, etc.) revisados para reflejar VICESECRETARIO

---

## 6. Plan A' diferido (sprint siguiente, 2-3 semanas)

| Ítem | Razón de diferimiento |
|---|---|
| Singleton enforcement automático (partial unique index para PRESIDENTE/SECRETARIO/VICESECRETARIO/CONSEJERO_COORDINADOR/ADMIN_UNICO) | Legal L12: "no obligatorio para demo, warning suficiente" |
| RPC transaccional `fn_designar_cargo` con cese-anterior + alta-nueva | Misma razón |
| Edición persona post-alta (`useUpdatePersona` + UI) | Legal: "workaround aceptable en demo" |
| Validación cardinalidad ADMIN_SOLIDARIO ≥2 / ADMIN_MANCOMUNADO ≥2 | Legal: "validación humana es suficiente" |
| Distinción explícita `VIGENTE_INSCRITO` / `VIGENTE_NO_INSCRITO` como columna | Hoy se deriva en JS desde `inscripcion_rm_referencia IS NOT NULL`. Migrar a columna física en A' |
| Relación predecesor/sucesor (transformación/fusión) | Legal L20: "caso edge que no aparecerá en demo ARGA" |
| Vacancia presidencial con timer 90 días + alertas | Legal L13: "máximo razonable 90 días" — UX y alertas en A' |
| Refactor profundo `DesignarAdminStepper` a 4-5 pasos limpios | Hoy se reusa con URL params; refactor estético en A' |
| Listado personas con paginación / virtualización | Legal: "listado feo es tolerable si alta funciona y dropdowns no duplican" |
| Limpieza profunda datos E2E (test DB separado vs filtro UI) | Filtro UI en sprint inmediato es suficiente para demo |
| Sincronización de `persons.representative_person_id` solo en `representaciones` (deprecar dual source) | Decisión arquitectura en A' tras validar dual-write durante sprint |

---

## 7. Riesgos conocidos + mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Script consolidación duplicados rompe FK | Media | Alto | Soft-archive (no DELETE), migrar referencias primero, confirmación humana por par, tests rollback |
| UNIQUE constraint falla por duplicados no detectados | Baja | Medio | Pre-vuelo: SELECT que liste todos los duplicados antes de aplicar; bloquear migración si quedan |
| Backfill trigger pierde datos al recrear AE | Baja | Alto | INSERT ... ON CONFLICT DO NOTHING; UPDATE solo donde `ae.inscripcion_rm_referencia IS NULL`; no toca AEs ya completos |
| `?personId=` URL param confunde el flujo del stepper | Media | Bajo | Tests E2E que cubren ambas entradas (desde Sociedad, desde Persona); fallback al flujo actual si param ausente |
| Dual-write `persons.representative_person_id` + `representaciones` introduce drift | Media | Medio | Documentar en spec que es transición Plan A'; tests que validan consistencia post-mutation; ticket A' para deprecar uno |
| VICESECRETARIO añadido pero sin UX completa | Baja | Bajo | Sprint inmediato lo incluye en BD + dropdowns; UX detallada (suplencia activación) va en A' |
| Datos demo E2E vuelven a aparecer al correr tests | Alta | Bajo | Filtro UI excluye `[E2E REAL]` y `PENDIENTE-` — los tests siguen funcionando pero no contaminan dropdowns producción |
| Demo Garrigues anticipa fecha | Media | Alto | Sprint priorizado para entregar P1 primero (alta+cese, día 3) — si falta tiempo, P2 y P3 son nice-to-have parcial |

---

## 8. Criterios de aceptación

### Sprint inmediato — definición de "hecho"

- [ ] Migraciones 000063, 000064, 000065 aplicadas a Cloud (`hzqwefkwsxopwrmtksbg`) y verificadas con probes.
- [ ] Script `consolidate-duplicate-persons.ts` ejecutado con confirmación del usuario. Verificado:
  - 0 duplicados de `(tenant_id, tax_id)` reales (excluyendo placeholders).
  - "Cartera ARGA" aparece 1 vez en dropdowns; "ARGA Seguros" aparece 1 vez.
- [ ] PRESIDENTE / SECRETARIO sync con `authority_evidence`:
  - Probe: `SELECT COUNT(*) FROM condiciones_persona cp WHERE cp.tipo_condicion IN ('PRESIDENTE','SECRETARIO','VICESECRETARIO') AND cp.estado = 'VIGENTE' AND NOT EXISTS (SELECT 1 FROM authority_evidence ae WHERE matching predicate)` → debe dar 0.
- [ ] Trigger `fn_sync_authority_evidence`:
  - Test E2E: insertar nuevo PRESIDENTE en `condiciones_persona` con `inscripcion_rm_referencia` → la fila correspondiente en `authority_evidence` aparece con la referencia RM.
- [ ] `PersonaDetalle.tsx` (Cartera ARGA SLU):
  - Botón "Asignar cargo a esta persona" visible y funcional.
  - Banner amarillo "Esta PJ administradora requiere representante PF permanente" presente (si aplica).
  - Tabla cargos separada vigentes/histórico.
  - Acción "Cesar" funcional por cargo vigente.
- [ ] `PersonasList.tsx`:
  - Botón "Asignar cargo" por fila.
  - Sin duplicados visibles en filtros / dropdown global.
  - Sin filas `[E2E REAL]` ni `PENDIENTE-*` salvo en modo test explícito.
- [ ] `DesignarAdminStepper.tsx`:
  - Acepta `?personId=X` y `?entityId=Y` opcionales.
  - Si ambos llegan, salta a paso "Cargo" directamente.
  - Si solo `personId`, paso "Sociedad" antes de "Cargo".
- [ ] `EmitirCertificacionButton.tsx`:
  - Bloqueo duro si el cargo certificante seleccionado no tiene `inscripcion_rm_referencia`. Toast informativo.
- [ ] Tests: `bun test` pasa, `bun run typecheck` 0 errores, `bun run lint` pasa, `bun run build` pasa.
- [ ] E2E: `e2e/20-personas-cargos-flow.spec.ts` pasa end-to-end (alta PF, alta PJ con rep, asignar cargo desde Personas, cesar cargo, emitir certificación con RM ref).

### Demo readiness criteria (validación Garrigues semana 19-23 mayo)

- Plantilla `DISTRIBUCION_CARGOS` (UUID a09cc4bf-...) puede ejecutarse end-to-end con datos del CdA de ARGA Seguros sin huecos visibles.
- Plantilla `CESE_CONSEJERO` (UUID ba214d42-...) puede ejecutarse y el cargo cesa correctamente (vigencia cerrada, histórico preservado).
- Pestaña "Autoridad certificante" de ARGA Seguros muestra los 4 cargos certificantes (Presidente, Vicepresidente, Secretario, Vicesecretario si aplica) con chip "Inscrito en RM" verde donde corresponde y "Pendiente inscripción" amarillo en el resto.

---

## 9. Trazabilidad legal

Este documento es la fuente de verdad de las decisiones tomadas y su justificación legal. Si Garrigues pregunta:

| Pregunta esperada | Respuesta documentada |
|---|---|
| "¿Por qué no hay bloqueo hard de cardinalidad de Presidente?" | L12: "validación humana es suficiente, warning visible cumple"; respaldo en práctica societaria + decisión operativa equipo legal. |
| "¿Por qué COMISIONADO no existe?" | L18: no es cargo societario inscribible (RRM art. 124 no lo enumera). |
| "¿Por qué VICESECRETARIO sí?" | L17: cargo inscribible que certifica en suplencia del Secretario (RRM art. 109, LSC 529 octies). |
| "¿Por qué dejáis crear PJ administradora sin representante?" | L3: aceptable con warning en demo; bloqueo duro está en emisión de certificación (L23), no en alta. Respalda LSC art. 212 bis. |
| "¿Por qué no enforce de SOCIO=NULL body_id?" | YA enforced en BD (chk_condicion_body_coherente, ya migrado). |
| "¿Por qué hay cargos vigentes sin referencia RM en el sistema?" | L21-L22: válido por LSC art. 214 (declarativa). El sistema permite estado VIGENTE_NO_INSCRITO pero bloquea su uso en certificación (L23). |
| "¿Por qué dos sociedades pueden tener mismo NIF?" | YA NO PUEDEN tras este sprint (P2: UNIQUE constraint). Casos previos eran bugs de carga (L19). |
| "¿Qué pasa con cambio de CIF por fusión?" | L20: diferido a Plan A'. Caso edge no presente en demo ARGA. |

---

## 10. Próximos pasos

1. Aprobación final del usuario sobre este spec (revisión inline si necesario).
2. Invocar `superpowers:writing-plans` para generar el plan implementable día a día (D0→D7) con checklists.
3. Ejecución del sprint en worktree canónico `main`.
4. PR + merge antes de demo Garrigues (deadline 19 mayo).
5. Plan A' arranca tras feedback de la sesión Garrigues.
