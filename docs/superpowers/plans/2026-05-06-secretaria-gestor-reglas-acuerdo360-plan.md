# Secretaría — Gestor de Reglas Acuerdo360

Fecha: 2026-05-06  
Estado: plan de implementación segura  
Worktree operativo: `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map` en `main`

## Objetivo

Construir dentro del módulo Secretaría un **Gestor de Reglas Acuerdo360** que permita al equipo legal observar y simular los requisitos aplicables a cada acuerdo sin romper los flujos actuales de adopción, documentación y registro. La configuración editable queda como fase posterior, sujeta a auditoría, versionado y aprobación legal.

El gestor debe responder, para una sociedad y una materia concreta:

- qué regla legal base aplica;
- qué estatutos, reglamento u override elevan o concretan esa regla;
- qué pactos parasociales aplican;
- si existe derecho de veto, consentimiento previo o mayoría pactada;
- qué documentación, firma, publicación, escritura o registro exige el acuerdo;
- qué queda congelado en el snapshot Acuerdo360 al adoptar o documentar.

## Diagnóstico actual

Ya existe una base funcional, pero no está presentada como gestor integral:

- `src/pages/secretaria/ReglasAplicables.tsx` muestra reglas aplicables por sociedad.
- `src/hooks/useReglasAplicables.ts` compone `LEY`, `PACTO` y placeholders para `ESTATUTOS`/`REGLAMENTO`.
- `src/lib/secretaria/normative-framework.ts` proyecta el marco normativo de sociedad y acuerdo.
- `src/lib/secretaria/agreement-360.ts` congela el snapshot normativo dentro de `agreements.compliance_snapshot`, `agreements.compliance_explain` y `agreements.execution_mode`.
- `src/lib/rules-engine/pactos-engine.ts` evalúa pactos MVP: `VETO`, `MAYORIA_REFORZADA_PACTADA`, `CONSENTIMIENTO_INVERSOR`, y warnings para pactos no plenamente computables.
- `rule_packs`, `rule_pack_versions`, `rule_param_overrides`, `jurisdiction_rule_sets`, `pactos_parasociales` y `rule_evaluation_results` son las fuentes Cloud relevantes.

La carencia principal no es de motor, sino de **capa de gestión legal explicable**: Legal necesita ver la regla efectiva antes de ejecutar un acuerdo y entender la diferencia entre validez societaria, cumplimiento contractual e implementación operativa.

## Principios de seguridad

1. **Carril aditivo**: no sustituir `ReglasAplicables`, `TramitadorStepper`, `ReunionStepper`, `AcuerdoSinSesionStepper` ni `ExpedienteAcuerdo` en el primer corte.
2. **MVP read-only**: la primera entrega lee y simula; no escribe reglas, pactos, overrides ni snapshots.
3. **Sin migración inicial**: usar fuentes existentes. Cualquier tabla nueva para estatutos/reglamentos versionados queda fuera del primer corte.
4. **No mezclar planos jurídicos**: un pacto parasocial incumplido no invalida automáticamente la proclamación societaria salvo que esté estatutarizado o incorporado al régimen orgánico aplicable.
5. **Bloqueo operativo separado**: un veto pactado puede bloquear la implementación interna aunque el acuerdo sea societariamente proclamable.
6. **Snapshots inmutables**: el gestor puede previsualizar reglas, pero el Acuerdo360 debe conservar el snapshot usado en el momento de adopción/documentación.
7. **Sin referencias a proveedores QTSP alternativos**: EAD Trust sigue siendo el único QTSP del ecosistema.
8. **No tocar datos demo en bloque**: cualquier seed futuro debe ser idempotente, acotado y verificado.
9. **UX Garrigues estricta**: si se toca UI de Secretaría, usar tokens `--g-*` y `--status-*`; nada de colores Tailwind nativos ni hex inline.

## Modelo conceptual

El gestor debe presentar una regla efectiva por materia como composición de capas:

```text
LEY
→ ESTATUTOS / overrides societarios
→ REGLAMENTO del órgano
→ PACTO PARASOCIAL
→ POLÍTICA / parametrización del motor
→ REGLA EFECTIVA DEL ACUERDO
→ SNAPSHOT ACUERDO360
```

La salida debe separar tres veredictos:

```text
Validez societaria
¿El órgano puede adoptar el acuerdo conforme a ley, estatutos y reglas orgánicas?

Cumplimiento contractual
¿La adopción incumple un pacto de socios, veto, consentimiento o mayoría pactada?

Implementación operativa
¿Secretaría debe bloquear ejecución, documentación, firma, registro o publicación hasta obtener waiver/consentimiento?
```

## Caso clave: veto en pacto parasocial

Ejemplo ARGA:

> Fundación ARGA tiene derecho de veto en operaciones estructurales.

El gestor debe mostrar:

- Materias protegidas: fusión, escisión, disolución, venta de activos relevantes u otras configuradas en el pacto.
- Titular del veto.
- Fuente: pacto parasocial vigente.
- Estado: consentimiento obtenido, renuncia/waiver, pendiente o incumplido.
- Resultado societario: separado del resultado contractual.
- Consecuencia operativa: no implementar o escalar a Legal hasta documentar consentimiento/renuncia.

Regla de tratamiento:

- Si el veto está solo en pacto parasocial: genera **incumplimiento contractual** y **bloqueo operativo configurable**, no nulidad societaria automática.
- Si el veto está estatutarizado: puede convertirse en requisito societario y bloquear la proclamación del acuerdo.

## Fase 0 — Inventario sin cambios

Objetivo: confirmar contratos reales antes de escribir código.

Tareas:

- Inventariar columnas actuales de:
  - `rule_packs`
  - `rule_pack_versions`
  - `rule_param_overrides`
  - `jurisdiction_rule_sets`
  - `pactos_parasociales`
  - `pacto_clausulas`
  - `agreements`
  - `rule_evaluation_results`
- Confirmar qué datos de pactos existen en Cloud para ARGA Seguros S.A.
- Revisar si `pacto_clausulas` tiene granularidad suficiente para veto por materia/órgano.
- Verificar rutas actuales:
  - `/secretaria/sociedades/:id/reglas`
  - `/secretaria/acuerdos/:id`
  - asistentes de reunión y acuerdos sin sesión.

Entregable:

- Nota corta de inventario con “usable ahora”, “placeholder” y “requiere schema futuro”.

## Fase 1 — Contrato puro de regla efectiva

Objetivo: crear una capa pura, testeable y sin Supabase que normalice la regla efectiva.

Archivos propuestos:

- `src/lib/secretaria/rule-manager-contract.ts`
- `src/lib/secretaria/__tests__/rule-manager-contract.test.ts`

Tipos sugeridos:

```ts
export type RulePlane =
  | "SOCIETARIO"
  | "ESTATUTARIO"
  | "REGLAMENTO"
  | "PACTO_CONTRACTUAL"
  | "OPERATIVO"
  | "REGISTRAL";

export type LegalConsequence =
  | "VALIDITY_BLOCK"
  | "CONTRACTUAL_BREACH"
  | "OPERATIONAL_HOLD"
  | "WARNING"
  | "NO_EFFECT";

export interface EffectiveAgreementRule {
  entity_id: string;
  matter: string;
  body_type: string | null;
  adoption_mode: string;
  sources: EffectiveRuleSource[];
  requirements: {
    convocatoria?: unknown;
    quorum?: unknown;
    majority?: unknown;
    unanimity?: unknown;
    veto?: unknown;
    consent?: unknown;
    documentation?: unknown;
    formalization?: unknown;
    registry?: unknown;
    publication?: unknown;
  };
  consequences: EffectiveRuleConsequence[];
  snapshot_seed: Record<string, unknown>;
}
```

Tests mínimos:

- Ley sin override.
- Override estatutario que eleva requisito.
- Override estatutario que rebaja mínimo legal: se ignora o marca conflicto.
- Pacto con veto aplicable y sin waiver: `CONTRACTUAL_BREACH` + `OPERATIONAL_HOLD`.
- Pacto con veto renunciado: sin hold.
- Veto estatutarizado: `VALIDITY_BLOCK` si no se cumple.
- Materia no afectada por pacto: no efecto.

## Fase 2 — Hook read-only

Objetivo: conectar el contrato puro con fuentes existentes sin mutar datos.

Archivos propuestos:

- `src/hooks/useRuleManager.ts`

Hooks:

- `useRuleManagerProfile(entityId)`
- `useAgreementRulePreview({ entityId, bodyId, matter, adoptionMode })`
- `useAgreementRuleSnapshot(agreementId)`

Reglas:

- Reutilizar `useReglasAplicables`, `usePactosVigentes`, `useAgreementNormativeSnapshot` cuando encaje.
- Si falta una fuente, devolver `source_status = "EXPECTED_NOT_STRUCTURED"` en vez de fallar.
- No escribir en `agreements`, `rule_evaluation_results` ni `rule_param_overrides`.

## Fase 3 — UI aditiva del Gestor

Objetivo: crear una experiencia visible para Legal sin alterar rutas críticas.

Ruta propuesta:

- `/secretaria/reglas`

Integraciones opcionales:

- Mantener `/secretaria/sociedades/:id/reglas` y enriquecerla con enlace al gestor.
- Añadir enlace desde `SociedadDetalle` bajo “Marco normativo”.
- Añadir enlace desde `ExpedienteAcuerdo` hacia la regla efectiva congelada.

Pantallas:

- **Catálogo de reglas**: materias, órganos, modos de adopción, fuentes.
- **Reglas por sociedad**: perfil normativo, rule packs, overrides y pactos.
- **Simulador de acuerdo**: sociedad + órgano + materia + modo de adopción → requisitos y consecuencias.
- **Pactos y vetos**: pactos vigentes, materias afectadas, estado de consentimiento/waiver.
- **Snapshots Acuerdo360**: qué regla quedó congelada para acuerdos existentes.

UX:

- Estados claros: `Societario OK`, `Pacto incumplido`, `Hold operativo`, `Bloqueo societario`, `Advertencia`.
- No usar lenguaje que confunda pacto con nulidad societaria.
- No permitir botones de edición en MVP; solo “ver fuente”, “simular” y “abrir expediente”.

## Fase 4 — Integración con Acuerdo360

Objetivo: hacer que cada expediente muestre “regla efectiva” de forma explícita.

Cambios acotados:

- En `ExpedienteAcuerdo`, añadir card read-only “Regla efectiva Acuerdo360”.
- Mostrar:
  - fuente legal base;
  - regla estatutaria/reglamentaria aplicable si existe;
  - pactos aplicables;
  - veto/consentimiento/mayoría pactada;
  - requisitos de documentación/registro/publicación;
  - snapshot usado.

No cambiar:

- Materialización de acuerdos.
- Estado de adopción.
- Generación documental.
- Firma o archivado.

## Fase 5 — Edición controlada futura

Objetivo: habilitar configuración por Legal solo cuando el visor sea estable.

Fuera del MVP inicial, pero previsto:

- Crear/editar `rule_param_overrides` con motivo obligatorio.
- Registrar cambios en auditoría WORM.
- Flujo de revisión/aprobación antes de activar una regla.
- Versionado de estatutos y reglamentos si se aprueba schema específico.
- Simulación obligatoria antes de activar cambios.

Condiciones para abrir esta fase:

- Inventario Cloud completo.
- Tests del contrato puro.
- Smoke de rutas de Secretaría.
- Validación legal de consecuencias: `VALIDITY_BLOCK`, `CONTRACTUAL_BREACH`, `OPERATIONAL_HOLD`.

## Verificación obligatoria

Cada corte debe ejecutar, como mínimo:

```bash
bunx tsc --noEmit --pretty false
bun run lint
bun run build
bun run test -- --reporter=dot
```

Si se toca UI de Secretaría:

```bash
bun run test -- --reporter=dot src/lib/secretaria
```

Y smoke manual o Playwright de:

- `/secretaria`
- `/secretaria/sociedades`
- `/secretaria/sociedades/:id/reglas`
- `/secretaria/acuerdos/:id`
- `/secretaria/reuniones`

## Criterios de aceptación MVP

- El gestor es accesible sin romper navegación existente.
- El sistema puede simular requisitos de un acuerdo por sociedad, órgano, materia y modo de adopción.
- El veto pactado aparece como pacto aplicable, con consecuencia contractual/operativa diferenciada.
- El Acuerdo360 muestra la regla efectiva o el snapshot asociado sin recalcular de forma destructiva.
- No hay migraciones ni escrituras nuevas en el primer corte.
- No se altera el resultado de adopción de reuniones, acuerdos sin sesión ni decisiones unipersonales.
- La suite existente sigue limpia.

## Prompt para lanzar carril

```text
Trabaja en /Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map, rama main, respetando AGENTS.md.

Objetivo: construir el plan técnico detallado y, si el alcance queda claro, preparar el primer corte read-only del Gestor de Reglas Acuerdo360 dentro del módulo Secretaría.

Contexto funcional:
- Acuerdo360 es el expediente canónico del acuerdo societario.
- Secretaría debe poder mostrar la regla efectiva aplicable a cada acuerdo: ley, estatutos/overrides, reglamento, pactos parasociales, requisitos documentales, formalización, registro y publicación.
- Caso crítico: pacto parasocial con derecho de veto. Si el veto está solo en pacto, debe mostrarse como incumplimiento contractual y posible hold operativo, no como nulidad societaria automática. Si está estatutarizado, puede ser bloqueo societario.

Restricciones:
- No romper flujos existentes de Secretaría.
- Primer corte read-only: no escribir en rule_packs, rule_param_overrides, pactos, agreements ni rule_evaluation_results.
- No crear migraciones en el primer corte.
- No modificar motores de adopción, documentación, firma o registro salvo enlaces/cards read-only.
- Mantener UX Garrigues: tokens --g-* y --status-*; no Tailwind native colors ni hex inline.
- No introducir proveedores QTSP distintos de EAD Trust.

Archivos a revisar primero:
- docs/superpowers/contracts/2026-05-03-secretaria-marco-normativo-acuerdo-360.md
- src/pages/secretaria/ReglasAplicables.tsx
- src/hooks/useReglasAplicables.ts
- src/lib/secretaria/normative-framework.ts
- src/lib/secretaria/agreement-360.ts
- src/lib/rules-engine/pactos-engine.ts
- src/pages/secretaria/ExpedienteAcuerdo.tsx

Entregables esperados:
1. Inventario de fuentes Cloud existentes y gaps.
2. Diseño de contrato puro EffectiveAgreementRule.
3. Plan de hooks read-only.
4. Plan de UI aditiva para /secretaria/reglas y enriquecimiento de /secretaria/sociedades/:id/reglas.
5. Criterios de aceptación y pruebas.
6. Si implementas primer corte, limita cambios a contrato puro + tests o UI read-only claramente aislada.

Verificación mínima:
- bunx tsc --noEmit --pretty false
- bun run lint
- bun run build
- bun run test -- --reporter=dot
```

## Riesgos abiertos

- `ESTATUTOS` y `REGLAMENTO` todavía no tienen repositorio estructurado completo; pueden aparecer como fuente esperada o como override hasta decidir schema.
- `pacto_clausulas` puede tener más granularidad que `pactos_parasociales`; hay que confirmar contrato real antes de diseñar edición.
- El motor MVP de pactos marca `VETO`, `MAYORIA_REFORZADA_PACTADA` y `CONSENTIMIENTO_INVERSOR` como `BLOCKING`; la UI legal debe traducir ese bloqueo al plano correcto: societario, contractual u operativo.
- Persistir `CO_APROBACION` y `SOLIDARIO` como `adoption_mode` de primera clase sigue siendo deuda separada.
- Una edición real de reglas requiere auditoría, versionado y aprobación legal; no debe entrar en el MVP read-only.
