# 2026-05-01 - Carriles paralelos AIMS/GRC y coherencia cross-module

## Proposito

Abrir AIMS 360 y GRC Compass como carriles de producto separados, manteniendo una arquitectura compartida con Secretaria Societaria y la consola general TGMS. El objetivo no es fusionar AIMS y GRC, sino hacer que ambos avancen con contratos comunes, handoffs trazables y fuentes de verdad claras.

## Decision rectora

- AIMS y GRC son productos/carriles separados.
- Ambos deben poder funcionar como modulos Garrigues standalone.
- En TGMS completo, ambos se integran mediante la consola general, Secretaria y contratos cross-module.
- Secretaria conserva el ownership de actos societarios formales: convocatorias, reuniones, acuerdos, actas, certificaciones y board pack formal.
- GRC conserva el ownership de riesgos, controles, incidentes, hallazgos, remediacion y reporting de cumplimiento.
- AIMS conserva el ownership de sistemas IA, evaluaciones, expediente tecnico, controles IA e incidentes IA.
- La consola general no crea un supermodelo: compone, enruta y muestra readiness.

## Carriles

### Carril 0 - TGMS Core / Consola general

Responsabilidad:

- Componer estado ejecutivo de Secretaria, GRC y AIMS.
- Mostrar journeys cross-module.
- Resolver navegacion y handoffs.
- No mutar estados owner salvo contrato aprobado.

Fuente de verdad:

- `entities`, `governing_bodies`, `persons`, `tenants`.
- Contratos locales de readiness.
- Futuro: `governance_module_events` y `governance_module_links` cuando haya probes aprobados.

Salida esperada:

- Panel ejecutivo coherente.
- Estado por carril.
- Enlaces a modulo owner.
- Indicacion clara de source posture y evidencia.

### Carril A - AIMS 360

Responsabilidad:

- Inventario de sistemas IA.
- Evaluaciones AI Act / ISO 42001.
- Incidentes IA.
- Controles y evidencias de gobierno IA.
- Preparar compatibilidad standalone.

Postura actual:

- `legacy_read` sobre `ai_*` para pantallas existentes.
- `aims_*` queda como backbone candidato y debe adoptarse por pantalla/workflow, no globalmente.

Integraciones permitidas:

- AIMS -> GRC: gap tecnico o no conformidad que requiera control, plan o riesgo GRC.
- AIMS -> Secretaria: incidente/materialidad IA que requiera conocimiento o decision de organo.
- Secretaria -> AIMS: acuerdo, acta o certificacion que soporte aprobacion de politica, sistema o decision IA.

No permitido:

- Crear riesgos GRC directamente desde AIMS sin handoff owner.
- Crear expedientes societarios desde AIMS.
- Duplicar `ai_*` y `aims_*` en una pantalla sin declarar postura.

### Carril B - GRC Compass

Responsabilidad:

- Riesgos, controles, hallazgos, remediacion, incidentes y reporting regulatorio.
- Flujos P0 conectados realmente en frontend: GDPR/canal interno, DORA/ICT, Cyber, ERM/Auditoria, trabajo/alertas/excepciones y country packs.
- Mantener TPRM y penal/anticorrupcion como backlog visible hasta tener pantallas y datos realmente conectados.

Postura actual:

- `legacy_read` sobre tablas GRC operativas existentes.
- `grc_*` queda como backbone candidato y se adopta por workflow cuando haya decision de paridad.

Integraciones permitidas:

- GRC -> Secretaria: incidente material, hallazgo critico o decision que requiera agenda/acta.
- AIMS -> GRC: gap o incidente IA que GRC transforma en riesgo/control/plan owner.
- Secretaria -> GRC: certificacion, acta o acuerdo como evidencia consumible.

No permitido:

- Modificar acuerdos, actas o certificaciones.
- Presentar evidence/legal hold como final mientras `000049` este en HOLD.
- Activar TPRM/penal como listo si no esta conectado en frontend.

### Carril C - Secretaria Societaria

Responsabilidad:

- Actos formales y prueba societaria.
- Decidir si eventos AIMS/GRC se elevan a organo.
- Emitir acuerdos, actas, certificaciones y board pack formal.

Integraciones permitidas:

- Consumir eventos o links de AIMS/GRC.
- Crear agenda, expediente o decision owner si procede.
- Exponer certificaciones/evidencias a AIMS/GRC como referencia verificable cuando el paquete probatorio este cerrado.

No permitido:

- Poseer controles GRC.
- Poseer inventario IA.
- Convertir eventos de otros modulos en acuerdos sin decision Secretaria.

### Carril D - Evidence / Legal Hold

Responsabilidad:

- Backbone probatorio compartido.
- Hash, storage, bundle, audit, retention y legal hold.

Postura actual:

- HOLD para `000049_grc_evidence_legal_hold`.
- Puede mostrarse evidencia demo/operativa, no evidencia final productiva.

## Reglas de coherencia

1. Cada pantalla declara owner y source posture.
2. Cada mutacion ocurre solo en el modulo owner.
3. La consola general enruta; no decide ni recalcula validez.
4. AIMS y GRC no se fusionan: comparten contratos, no modelo interno.
5. Secretaria formaliza decisiones; no absorbe datos GRC/AIMS.
6. Eventos y links no son evidencia por si solos.
7. `evidence_bundles` solo puede presentarse como evidencia final si hay hash, storage/manifest, audit, owner record y gate legal.
8. Hasta aprobacion explicita, no hay cambios de schema, RLS, RPC, storage ni regeneracion de tipos.

## Roadmap inmediato no_schema

### Slice 1 - Mapa conectado por pantalla

- AIMS: inventariar pantallas actuales y declarar `ai_*` vs `aims_*`.
- GRC: inventariar pantallas actuales y declarar legacy vs `grc_*`.
- Consola: reflejar el estado por carril sin crear modelos paralelos.

Estado AIMS 2026-05-02:

- Completado mapa de pantallas conectadas en `src/lib/aims/readiness.ts` y visible en `/ai-governance`.
- Rutas declaradas: `/ai-governance`, `/ai-governance/sistemas`, `/ai-governance/sistemas/nuevo`, `/ai-governance/sistemas/:id`, `/ai-governance/evaluaciones`, `/ai-governance/incidentes`.
- Postura: `legacy_read` sobre `ai_*` en pantallas de lectura; `legacy_write` owner-write para alta de sistemas en `ai_systems`; sin lectura ni escritura de `aims_*` en UI conectada actual.
- Mutacion actual: AIMS puede crear sistemas IA propios; no crea riesgos/controles GRC ni actos Secretaria.
- Docs de contrato: `docs/superpowers/contracts/2026-04-27-aims-grc-data-contract.md` y `docs/superpowers/contracts/2026-04-27-cross-module-data-contract.md`.

### Slice 2 - Handoffs read-only

- AIMS gap -> ruta GRC owner.
- GRC incidente/hallazgo -> ruta Secretaria owner.
- Secretaria certificacion/acuerdo -> referencia consumible por GRC/AIMS.

Sin writes a `governance_module_events` ni `governance_module_links` en esta fase.

Estado AIMS 2026-05-02:

- `AIMS_TECHNICAL_FILE_GAP` se expone como ruta a `/grc/risk-360` solo cuando la evaluacion tiene gap candidato.
- `AIMS_INCIDENT_MATERIAL` se expone como ruta a GRC y Secretaria solo para incidentes IA materiales abiertos/en investigacion.
- `SECRETARIA_CERTIFICATION_ISSUED` queda como referencia AIMS solo con `evidence=REFERENCE`.
- No hay write probe ni persistencia en contratos compartidos.

### Slice 3 - UX homogenea

- Mantener identidad Garrigues en AIMS, GRC y Secretaria.
- Mantener consola TGMS como capa ejecutiva.
- Reducir copy tecnico en pantallas demo y exponer estado operativo de forma ejecutiva.

### Slice 4 - Probes controlados futuros

Solo despues de cerrar `no_schema`:

- Probe read de `governance_module_events`.
- Probe read de `governance_module_links`.
- Write probe solo con paquete aprobado, tests y rollback logico.

## Definition of Done por carril

```md
Lane closure:
- Lane:
- Screens touched:
- Owner:
- Tables used:
- Source posture:
- Mutation owner:
- Cross-module contracts:
- Evidence posture:
- Migration required:
- Types affected:
- Parity risk:
- Tests:
```

## Estado actual

- Secretaria: carril funcional principal; pendiente pulido final de certificaciones, board pack, PRE y evidencia final.
- GRC: P0 conectado en frontend para superficies reales; backlog no conectado separado.
- AIMS: P0 navegable sobre legacy `ai_*`; backbone `aims_*` pendiente por workflow.
- Consola: readiness y journeys cross-module visibles; writes compartidos pendientes.
- Evidence/legal hold: HOLD.

## Avance 2026-05-02 - Slice 1 GRC

- GRC tiene mapa pantalla por pantalla en `docs/superpowers/contracts/2026-05-02-grc-screen-posture-contract.md`.
- Contrato local puro en `src/lib/grc/dashboard-readiness.ts` con 27 rutas/pantallas, source posture y modo de mutacion.
- `/grc` muestra resumen ejecutivo del screen posture sin nuevas queries.
- AIMS -> GRC queda como handoff read-only hacia `/grc/risk-360` y `/grc/incidentes`.
- GRC incidente/hallazgo -> Secretaria queda como handoff read-only hacia `/secretaria/reuniones/nueva`.
- TPRM y Penal/Anticorrupcion siguen backlog no conectado.
- Sin migrations, sin Supabase typegen, sin RLS/RPC/storage, sin writes a eventos/links y sin promocion de evidence/legal hold.

## Avance 2026-05-02 - Reactivacion AIMS/GRC no_schema

- AIMS reactiva el alta real de sistemas IA en `/ai-governance/sistemas/nuevo`.
- La ruta usa `useCreateAiSystem` y escribe solo en `ai_systems` con `tenant_id` del contexto.
- El contrato local marca esta pantalla como `legacy_write` y `owner-write`.
- Las pruebas e2e renderizan el formulario, pero no ejecutan submit contra Cloud dentro del smoke.
- GRC mantiene owner-write ya existente para incidentes en `/grc/incidentes/nuevo`.
- Risk360, penal/anticorrupcion y TPRM no se activan como writes nuevos en esta tanda; penal/anticorrupcion requiere ruta+datos o paquete de schema si no basta con `risks`.
- `supabase link --project-ref hzqwefkwsxopwrmtksbg` corrigio el enlace local del CLI; `db:check-target` vuelve a pasar. `supabase/.temp/` queda ignorado por Git.
