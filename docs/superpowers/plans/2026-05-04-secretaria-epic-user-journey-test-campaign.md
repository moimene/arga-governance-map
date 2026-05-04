# Secretaría Societaria — Epic/User Journey Test Campaign

Fecha: 2026-05-04  
Worktree: `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map`  
Rama: `main`  
Fuente de verdad de datos: Supabase Cloud `governance_OS` (`hzqwefkwsxopwrmtksbg`)

## Alcance y restricciones

- No se aplicaron migraciones.
- No se ejecutó `bun run db push`.
- No se crearon tablas, columnas, policies, storage buckets ni RPCs.
- No se regeneraron tipos Supabase.
- Se verificó el target antes de trabajar contra Supabase con `bun run db:check-target`.
- Se mantuvo la frontera demo: el sistema puede dejar expedientes preparados para Registro, pero no realiza envío telemático ni presentación real al Registro Mercantil.
- EAD Trust se mantiene como único QTSP citado.

## Inventario de cobertura

| Ruta | Pantalla | Hooks/tablas/contratos principales | Estado | Riesgo funcional | Test |
|---|---|---|---|---|---|
| `/secretaria/convocatorias` | Lista de convocatorias | `useConvocatorias`; `convocatorias`, `governing_bodies`, `attachments` | Conectado | Medio: depende de trazas JSON para documentos PRE | `e2e/25-secretaria-epic-journeys.spec.ts` |
| `/secretaria/convocatorias/:id` | Detalle convocatoria | `useConvocatoria`, `useConvocatoriaAttachments`; `convocatorias`, `attachments`; `reminders_trace.documents` | Conectado | Medio: índice documental se deriva de payload flexible | Nuevo E2E + mejora UI |
| `/secretaria/reuniones` | Lista reuniones | `useReunionesSecretaria`; `meetings`, `governing_bodies` | Conectado | Medio: cobertura E2E indirecta; falta journey nominal completo de votación por punto | Existente `21` + recomendado ampliar |
| `/secretaria/reuniones/:id` | Stepper reunión/consejo | `useReunionSecretaria`; `meetings`, `meeting_attendees`, `meeting_resolutions`, `meeting_votes`, `minutes`, `agreements`, `rule_evaluation_results`; RPC `fn_generar_acta` | Parcial | Alto: asistencia/quorum/votos por punto necesitan fixture aislada para automatizar sin mutar demo | Gap documentado |
| `/secretaria/decisiones-unipersonales` | Decisiones socio/admin único | `useDecisionesUnipers`; `unipersonal_decisions`, `agreements` | Conectado | Medio: certificación se valida por navegación/guard, no por creación E2E | Nuevo E2E |
| `/secretaria/acuerdos-sin-sesion` | Sin sesión, co-aprobación, solidario | `useAcuerdosSinSesion`, `useNoSessionExpediente`; `no_session_resolutions`, `no_session_expedientes`, `no_session_respuestas`, `no_session_notificaciones`, `agreements`; RPC `fn_cerrar_votaciones_vencidas` | Conectado | Medio: QTSP/ERDS opcional y gates complejos no se ejecutan en E2E destructivo; la smoke stubea el auto-cierre de vencidas para no mutar Cloud | Nuevo E2E no destructivo |
| `/secretaria/actas` | Lista de actas | `useActas`; `minutes`, `meeting_resolutions`, `certifications`, `agreements` | Conectado | Bajo: faltaba link accesible estable al detalle | Nuevo E2E + fix |
| `/secretaria/actas/:id` | Acta y certificación | `useActa`, `useAgreementIdsForMinute`, `EmitirCertificacionButton`; `minutes`, `meeting_resolutions`, `certifications`, `agreements`, `capability_matrix`, `authority_evidence`; RPCs `fn_generar_certificacion`, `fn_firmar_certificacion`, `fn_emitir_certificacion` | Conectado | Medio: pipeline QTSP es demo/operativo, no evidencia productiva final | Nuevo E2E |
| `/secretaria/tramitador` | Tramitaciones registrales | `useTramitador`; `registry_filings`, `agreements`, `certifications`, `minutes`, `meeting_resolutions`; `persistRegistryFilingCertificationLink` | Conectado | Medio: copy debía evitar implicar envío real al RM | Nuevo E2E + fix |
| `/secretaria/sociedades/:id` | Sociedad, órganos, socios | `useSociedad`, `useCapitalHoldings`, `useCapitalMovements`, `useCapitalProfile`; `entities`, `capital_holdings`, `capital_movements`, `entity_capital_profile`, `share_classes` | Conectado/parcial | Alto: libro/movimientos no tienen escritura transaccional completa al ledger | Nuevo E2E + gap P0 |
| `/secretaria/sociedades/:id/transmision` | Transmisión de titularidad | `useCapitalHoldings`, `usePersonasCanonical`; escribe `capital_holdings` | Parcial | Alto: mutación multi-step no atómica y no inserta `capital_movements` | Nuevo E2E no destructivo + gap P0 |
| `/secretaria/libro-socios` | Libro de socios/accionistas | `useCapitalMovements`; `capital_movements`, `persons`, `agreements`, `share_classes` | Parcial | Alto: registro WORM visible, pero falta flujo único de transmisión/anotación/evidencia | Nuevo E2E + gap P0 |
| `/secretaria/board-pack` | Board Pack | `useBoardPackData`; `meetings`, `agenda_items`, `agreements`, GRC/core/AI tables | Conectado | Medio: reporting read-only, sin ownership probatorio propio | Gap P2 |
| `/secretaria/plantillas` | Plantillas/modelos | `usePlantillasProtegidas`, `useModelosAcuerdo`; `plantillas_protegidas` | Conectado | Medio: aprobación legal depende de estado de seeds Cloud | Existente + recomendado ampliar |

## User journey matrix

| Épica | Historia | Precondiciones | Pasos automatizados | Resultado esperado | Evidencia verificable | Estado |
|---|---|---|---|---|---|---|
| 1 Convocatoria JG | Secretario revisa convocatoria con orden del día, informes PRE y canales | Convocatoria demo emitida con `reminders_trace` | Abrir primera convocatoria, entrar al detalle, verificar DOCX, Informe PRE, agenda, índice documental, canales, reunión y trazabilidad | Expediente navegable con documentos PRE y canal/referencia visible | DOM + ausencia de errores Supabase 4xx | Automatizada |
| 1 Convocatoria JG | Variante SL/cotizada | Datos demo por tipo social/canales | No destructivo: cobertura por motor y pantalla; falta fixture dedicada | Canal individual/público y voto a distancia según regla | Requiere fixture estable | Gap P1 |
| 2 Consejo | Consejo con asistentes, quórum, voto de calidad y acuerdos | Reunión demo o fixture creada | No automatizado en esta campaña por riesgo de mutar demo | Lista nominal, quórum, votos por punto y acuerdos trazables | `meeting_attendees`, `meeting_votes`, `meeting_resolutions`, `agreements` | Gap P1 |
| 3 Junta asistencia/voto | Lista de asistentes, delegaciones, voto a distancia, conflictos y pactos | Censo/capital y pactos vigentes | Mapeado; no ejecutado por falta de fixture aislada | Denominadores recalculados por punto | Tablas de asistentes/votos + rule evaluations | Gap P1/P2 |
| 4 Decisiones unipersonales | Socio único o administrador único prepara decisión | App demo autenticada | Abrir lista, iniciar nueva decisión, comprobar tipos y gate de paso documental | Modo unipersonal visible; no se certifica antes de completar | DOM + step disabled | Automatizada |
| 5 Acuerdos sin sesión | Secretario escoge sin sesión/co-aprobación/solidario | App demo autenticada | Abrir hub, verificar tres variantes, navegar co-aprobación y solidario | Variantes accesibles; no se fuerza certificación prematura | DOM + ausencia de errores | Automatizada |
| 6 Certificaciones | Certificación transversal desde acta | Acta demo disponible | Abrir actas, navegar al detalle, verificar revisión legal y disclaimer de evidencia | Certificación aparece como demo/operativa, no evidencia productiva final | DOM | Automatizada |
| 7 Libro socios/capital | Revisar socios, abrir transmisión y libro de movimientos | Sociedad ARGA seleccionable | Abrir sociedad, pestaña socios, transmisión no destructiva, libro de socios | Cap table visible, transmisión preparada sin escritura, ledger visible | DOM + ausencia de botón final antes de completar | Automatizada |
| 8 Libros/auditoría/registro | Expediente preparado para Registro sin envío real | Tramitador con expedientes demo | Abrir actas y tramitador, buscar copy prohibida | No aparece envío RM ni presentación real como acción final | DOM + tests de etiquetas | Automatizada |

## Tests implementados

- `e2e/25-secretaria-epic-journeys.spec.ts`
  - Convocatoria: agenda, índice PRE, canales, documentos y trazabilidad.
  - Libro socios/capital: sociedad, socios, transmisión no destructiva, libro de movimientos.
  - Decisiones unipersonales y acuerdos sin sesión: variantes y gates iniciales; `fn_cerrar_votaciones_vencidas` queda stubeada en Playwright para evitar writes de housekeeping.
  - Certificación/tramitador: frontera demo y ausencia de copy de envío RM.
- `src/lib/secretaria/__tests__/status-labels.test.ts`
  - Cubre etiquetas `EMITIDA` y `FILED` para evitar claves crudas y copy registral incorrecta.

## Bugs corregidos

1. Detalle de convocatoria no exponía de forma suficiente el orden del día ni el índice documental PRE ya presente en datos.
   - Fix: `ConvocatoriaDetalle.tsx` renderiza `agenda_items` y `reminders_trace.documents` con estados incluido/faltante/subido.

2. Estado `EMITIDA` podía verse como clave cruda y `FILED` comunicaba "Presentado al registro".
   - Fix: `status-labels.ts` añade `EMITIDA -> Emitida` y cambia `FILED -> Preparado para registro`.
   - Fix complementario: timeline de `ExpedienteAcuerdo.tsx` usa "Preparado para registro".

3. `TramitadorStepper.tsx` tenía microcopy que implicaba envío automático o subsanación enviada al Registro.
   - Fix: copy cambiado a preparación/registro en expediente demo; mantiene explícito que no hay envío telemático al Registro.

4. La lista de actas dependía de click de fila para navegar, poco estable para E2E y accesibilidad.
   - Fix: primer identificador de acta es ahora `Link` real al detalle.

5. Durante la verificación en navegador local apareció una rotura JSX en `SiiDashboard.tsx` que dejaba el dev server en pantalla negra.
   - Fix: cierre de `section` corregido sin tocar contratos de datos.

## Gaps funcionales y requisitos

### P0 — Transmisión de participaciones/acciones y libro registro

Estado actual:
- `TransmisionStepper.tsx` cierra e inserta filas en `capital_holdings`.
- `LibroSocios` lee `capital_movements`.
- `useCapitalMovements` ya existe.

Riesgo:
- La transmisión no escribe el ledger `capital_movements`.
- La operación no es atómica: cerrar origen, crear remanente y crear destino se hacen desde cliente.
- Falta vínculo obligatorio con documentación soporte/evidencia/expediente.

Requisito propuesto:
- RPC transaccional `fn_registrar_transmision_capital`.
- Entrada mínima: `tenant_id`, `entity_id`, `source_holding_id`, `destino_person_id`, `numero_titulos`, `effective_date`, `agreement_id`, `document_refs[]`, `motivo`.
- Efectos: actualizar `capital_holdings`, insertar movimientos append-only en `capital_movements`, enlazar `agreement_id`, registrar artefactos documentales y devolver resumen de impacto en capital/votos.
- Policies/RLS: permitir a rol Secretaría/Admin tenant ejecutar solo dentro del tenant.
- Storage/evidencia: reutilizar `attachments` o `evidence_bundle_artifacts` para documentación soporte; si se exige archivo nuevo, definir bucket y retention.

### P1 — Consejo/Junta con censo, representación y voto por punto

Estado actual:
- Existen `meeting_attendees`, `meeting_votes`, `meeting_resolutions`, `rule_evaluation_results` y motor de voto.
- El flujo UI de reunión persiste asistencia, quórum, debates, acuerdos y acta.

Riesgo:
- Falta fixture E2E aislada para comprobar recalculo de denominadores por punto, delegaciones, conflictos y pactos sin mutar la demo compartida.

Requisito propuesto:
- Seed/fixture no productivo para Playwright o endpoint test-only ya existente que cree reunión temporal y la limpie.
- Alternativa sin schema: test unitario ampliado del motor con fixtures de representación, conflicto y pacto.

### P1 — Convocatoria SL/cotizada con destinatarios y voto a distancia

Estado actual:
- La pantalla muestra canales y documentos.
- ERDS está integrado para casos de notificación.

Riesgo:
- Falta test E2E con una SL y una cotizada explícitas que compruebe destinatarios, canal individual/público y voto a distancia con fixture estable.

Requisito propuesto:
- Seed demo estable o dataset fixture para convocatoria SL y convocatoria SA cotizada con canales diferenciados y `agreements.id` trazable.

### P1 — Certificación y preparación registral

Estado actual:
- RPCs de generación/firma/emisión existen y el UI muestra evidencia demo/operativa.
- `TramitadorStepper` registra escritura y vínculo certificación-tramitación.

Riesgo:
- El sistema no debe vender el resultado como evidencia productiva final ni como envío al RM.

Requisito propuesto:
- Mantener copy y tests de regresión.
- Para fase productiva futura: definir auditoría, conservación, legal hold, QTSP real y workflow registral externo como contratos separados.

### P2 — Board Pack / reporting

Estado actual:
- `useBoardPackData` compone datos de Secretaría, GRC, core y AI Governance.

Riesgo:
- Es reporting read-only; no tiene ownership documental/evidencia propia del expediente.

Requisito propuesto:
- Si se quiere que el Board Pack sea evidencia de expediente, definir entidad documental, versión, hash, aprobador y vínculo a `evidence_bundles`.

## Propuesta de mejora: documentación complementaria del expediente

Objetivo:
- Convertir la documentación soporte en un complemento operable de reuniones/acuerdos/libro registro sin inventar schema durante esta campaña.

Diseño sugerido:
- Reutilizar `attachments` cuando el documento sea soporte de convocatoria/reunión.
- Reutilizar `evidence_bundle_artifacts` cuando sea parte de un bundle probatorio.
- Vincular siempre a `agreement_id` cuando el soporte fundamente un acuerdo.
- Para transmisión de participaciones: anexar contrato/documento soporte, guardar hash, enlazar a la transmisión y reflejar impacto en `capital_holdings` + `capital_movements`.

Flujo ejemplo:
1. Secretario abre sociedad y selecciona "Transmisión".
2. Carga documento soporte de compraventa/cesión.
3. El sistema valida títulos disponibles y fecha efectiva.
4. La RPC transaccional actualiza cap table, crea movimiento append-only y vincula `agreement_id`.
5. El libro registro muestra asiento, documento soporte, titular anterior/nuevo y efecto en voto/capital.

## Verificación ejecutada

| Check | Resultado |
|---|---|
| `bun run db:check-target` | Pass: proyecto Cloud `governance_OS` |
| `bunx tsc --noEmit --pretty false` | Pass |
| `bun run lint` | Pass con warnings preexistentes |
| `bun run build` | Pass |
| `bunx vitest run src/lib/secretaria/__tests__/status-labels.test.ts --reporter=dot` | Pass |
| `bun run test` | Pass: 617 tests pass, 59 skipped |
| `PLAYWRIGHT_PORT=5201 bunx playwright test e2e/21-secretaria-responsive.spec.ts --project=chromium --reporter=list` | Pass: 2/2 |
| `PLAYWRIGHT_PORT=5201 bunx playwright test e2e/25-secretaria-epic-journeys.spec.ts --project=chromium --reporter=list` | Pass: 5/5 incluyendo setup; 4 journeys de Secretaría |
| Navegador local | Pass parcial visual: login demo y detalle convocatoria con agenda/índice PRE/canales; dev server detenido al cierre |
