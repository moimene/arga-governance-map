# Personas y Cargos Sprint 2 — brief legal de desbloqueo

**Fecha:** 2026-05-12  
**Estado:** FIRMADO por Secretaria Societaria el 2026-05-12. No es spec implementable.  
**Baseline:** `main` en `e350774` tras merge PR #5. Gates baseline post-merge green.  
**Fuente:** `docs/superpowers/plans/2026-05-12-personas-cargos-completitud-handoff.md` + spec Sprint 1 + reviews adversariales.

---

## 0. Firma recibida

La firma legal recibida el 2026-05-12 desbloquea la escritura de la spec
adversarial Sprint 2 con estos parametros obligatorios:

| Decision | Opcion firmada | Matices obligatorios |
|---|---|---|
| L12 | L12-C Hibrida | BD hard para PRESIDENTE, SECRETARIO, CONSEJERO_COORDINADOR y ADMIN_UNICO. VICESECRETARIO y VICEPRESIDENTE fuera del singleton hard. ADMIN_SOLIDARIO/MANCOMUNADO con alerta al cierre y bloqueo solo al certificar/cerrar distribucion con menos de 2. |
| L13 | L13-B Notificacion interna | Owner Secretario del CdA o Vicesecretario en suplencia. Umbrales D+0, D+60 y D+90. No bloquea operaciones salvo falta de VºBº para certificar, ya cubierta por Sprint 1. |
| L20 | L20-A Post-piloto | No entra en Sprint 2. Solo documentar respuesta de piloto y modelo futuro si el cliente lo exige. |

La spec resultante es:
`docs/superpowers/specs/2026-05-12-personas-cargos-completitud-design.md`.

---

## 1. Proposito

Desbloquear la escritura del spec adversarial de Sprint 2 para llevar Personas y
Cargos a integridad production-ready.

Este brief pide decision legal expresa sobre tres puntos reabiertos:

1. **L12** — enforce automatico de cardinalidad de cargos.
2. **L13** — tratamiento operativo de la vacancia presidencial de 90 dias.
3. **L20** — prioridad de sucesion juridica por transformacion, fusion o escision.

Hasta que estas decisiones esten firmadas:

- No se escribe spec definitivo.
- No se programa Sprint 2.
- No se aplican migraciones Cloud.
- No se ejecutan consolidaciones de datos demo.

---

## 2. Decision L12 — enforce automatico de cardinalidad

### Contexto Sprint 1

La decision L12 firmada para demo fue: **no obligatorio para demo; validacion
humana + warnings suficientes**.

Sprint 2 ya no cubre solo demo. El riesgo cambia: en produccion multiusuario,
dos operaciones concurrentes pueden dejar dos PRESIDENTEs, SECRETARIOs o
ADMIN_UNICO vigentes aunque la UI advierta correctamente.

### Cargos afectados

Segun L4-L11:

| Cargo | Base legal | Cardinalidad |
|---|---|---|
| PRESIDENTE | L4, LSC art. 529 sexies | 1 por CdA/body |
| SECRETARIO | L6, RRM art. 109 | 1 por body |
| VICESECRETARIO | L7, RRM art. 109 + LSC art. 529 octies | 1 en practica habitual; no prohibicion legal de varios |
| CONSEJERO_COORDINADOR | L8, LSC art. 529 septies | 1 en cotizadas |
| ADMIN_UNICO | L9, LSC art. 210 | 1 por entidad |
| ADMIN_SOLIDARIO | L10, LSC art. 210 | minimo 2 |
| ADMIN_MANCOMUNADO | L11, LSC art. 210 | minimo 2 |

### Opciones

| Opcion | Descripcion | Impacto |
|---|---|---|
| L12-A BD hard | Partial UNIQUE index por tenant, entidad, organo y cargo singleton. | Maxima integridad; bloquea carreras aunque fallen UI/RPC. |
| L12-B RPC hard | `fn_designar_cargo` valida singleton con locks, sin unique index. | Mejor UX y mensajes legales; menor proteccion ante writes fuera del RPC. |
| L12-C Hibrida | BD hard para cardinalidades legalmente cerradas; RPC hard para mensajes, transicion y cardinalidades minimas. | Recomendada tecnicamente. Combina proteccion de schema y UX gobernada. |

### Recomendacion tecnica para firma

Adoptar **L12-C hibrida**:

- BD partial UNIQUE para `PRESIDENTE`, `SECRETARIO`, `CONSEJERO_COORDINADOR` y
  `ADMIN_UNICO`.
- Decidir expresamente si `VICESECRETARIO` entra en el UNIQUE. Hay que firmarlo
  porque L7 dice "1 en practica habitual" pero tambien "no hay prohibicion legal
  de varios".
- RPC `fn_designar_cargo` obligatorio para altas/ceses con:
  - `SECURITY DEFINER`
  - `SET search_path TO 'public', 'extensions'`
  - validacion explicita de `tenant_id`
  - capability check server-side
  - bloqueo `SELECT ... FOR UPDATE` o advisory lock por entidad/body/cargo
  - validacion de authority_evidence vigente con RM ref antes de writes criticos
  - idempotency key opcional
- `ADMIN_SOLIDARIO` y `ADMIN_MANCOMUNADO` no deben modelarse con UNIQUE; requieren
  validacion de minimo 2 por RPC y/o check diferido de proceso.

### Decision firmada

1. L12-C hibrida.
2. `VICESECRETARIO` fuera del singleton hard; warning configurable/RPC.
3. `VICEPRESIDENTE` fuera del singleton hard.
4. `ADMIN_SOLIDARIO` / `ADMIN_MANCOMUNADO` con alerta al cierre; no bloqueo
   duro en la primera alta individual. Bloqueo solo al certificar o cerrar una
   distribucion con menos de 2.

---

## 3. Decision L13 — vacancia presidencial 90 dias

### Contexto Sprint 1

L13 firmada: **vacancia presidencial legal y transitoria; maximo razonable 90
dias; preside Vicepresidente o suplente estatutario**.

Sprint 2 debe decidir si la plataforma solo muestra el riesgo o si crea una
obligacion operativa trazable.

### Opciones

| Opcion | Descripcion | Impacto |
|---|---|---|
| L13-A Badge visual | Mostrar estado "Vacancia presidencial" y contador D+N en UI. | Bajo coste; poca trazabilidad. |
| L13-B Notificacion interna | Crear alerta/notificacion persistente con vencimiento a 90 dias. | Trazabilidad minima de cliente real. |
| L13-C Workflow/obligacion | Crear tarea u obligacion formal con owner, vencimiento, reminders y cierre. | Mas completo; mayor alcance funcional. |

### Recomendacion tecnica para firma

Adoptar **L13-B como minimo productivo**, con opcion de evolucion a L13-C:

- Detectar inicio de vacancia cuando no exista `PRESIDENTE` vigente para un CdA.
- Calcular `deadline = fecha_vacancia + 90 dias`.
- Mostrar badge visual en Secretaria.
- Crear notificacion persistente para:
  - vacancia abierta
  - aviso proximo a vencimiento
  - vencimiento superado
- No bloquear actos societarios automaticamente salvo decision legal expresa; la
  UI debe informar de quien actua como suplente o VºBº si existe.

### Decision firmada

1. L13-B: notificacion interna persistente.
2. Umbrales D+0, D+60 y D+90.
3. No bloquea operaciones; solo escala alerta.
4. Owner operativo: Secretario del CdA o Vicesecretario en suplencia.
5. La certificacion se bloquea solo si no existe Presidente, Vicepresidente ni
   suplente estatutario que pueda dar VºBº; Sprint 1 ya cubre el bloqueo por
   falta de VºBº/RM en `EmitirCertificacionButton`.

---

## 4. Decision L20 — sucesion juridica

### Contexto Sprint 1

L20 firmada: **cambio CIF por transformacion/fusion es caso edge no presente en
demo ARGA; diferido a Plan A' o futuro**.

Sprint 2 debe decidir si se implementa como core production-grade o se deja para
post-piloto.

### Casos cubiertos si entra en Sprint 2

- Transformacion SL -> SA o SA -> SL.
- Fusion por absorcion.
- Fusion por nueva sociedad.
- Escision.
- Cambio de identificador fiscal por operacion estructural.

### Opciones

| Opcion | Descripcion | Impacto |
|---|---|---|
| L20-A Post-piloto | Mantener diferido. Solo documentar modelo futuro. | Evita sobredimensionar Sprint 2. |
| L20-B Relacion minima | Tabla/relacion predecessor/successor con tipo de operacion y fecha efecto. | Cubre trazabilidad sin migrar historicos. |
| L20-C Modelo completo | Sucesion juridica con migracion de holdings, cargos, evidencias y reporting. | Alto alcance; requiere sprint propio. |

### Recomendacion tecnica para firma

Adoptar **L20-B solo si el piloto cliente lo necesita antes de contrato**. Si no,
mantener **L20-A post-piloto**.

Motivo: las dependencias con `persons`, `entities`, cargos, capital, authority
evidence y evidencias WORM son suficientemente amplias para no mezclarlas con
RPCs atomicas y limpieza de datos en el mismo wave si no hay necesidad comercial
inmediata.

### Decision firmada

1. L20-A: post-piloto.
2. No entra en Sprint 2.
3. Respuesta de piloto: el sistema registrara la operacion como acuerdo de Junta
   cuando la plantilla `FUSION_ESCISION` este cerrada legalmente; la migracion
   automatica de cargos/capital a la sociedad resultante queda fuera y requerira
   intervencion manual o sprint propio.

---

## 5. Hardening tecnico que la spec debe incluir tras firma

Para cualquier RPC nueva de Sprint 2:

- `SECURITY DEFINER`.
- `SET search_path TO 'public', 'extensions'`.
- Validacion explicita de tenant al inicio.
- Capability check server-side, por ejemplo `fn_has_capability(role, action)`.
- Autoridad server-side: el certificante/firmante debe tener `authority_evidence`
  vigente y `inscripcion_rm_referencia`.
- Locks para cardinalidad y carreras multi-transaccion.
- Idempotency key opcional para reintentos seguros.
- WORM semantics documentadas: las tablas WORM no se reescriben; si hace falta
  evidencia nueva, se inserta fila nueva auditada o se preserva referencia
  historica al duplicado archivado.

RPCs iniciales candidatos:

- `fn_designar_cargo`.
- `fn_consolidate_person`.
- RPC auxiliar para representative admin PJ si se elimina el dual-write cliente.

---

## 6. Tests adversariales minimos post-firma

La spec de Sprint 2 debe incluir:

- E2E submit real de cese de cargo con verificacion BD.
- E2E alta cargo full flow: PJ administradora + representante PF + RM ref.
- E2E representante PJ wizard 3 pasos persistiendo en `representaciones`.
- E2E certificacion bloqueada por falta de RM.
- Tests de carrera: dos sesiones intentando modificar el mismo cargo singleton.
- Tests RLS denial: usuario/tenant incorrecto no puede leer ni escribir.
- Readiness script en CI para Personas y Cargos.

Defecto no procesado que debe entrar en scope:

- `src/pages/secretaria/DesignarAdminStepper.tsx:215`: `personaFinal` debe
  validarse por `id === draft.person_id`/`personIdFromUrl` antes de decidir si
  una PJ requiere representante. El fix actual cubre loading, pero la spec debe
  cerrar explicitamente el caso de persona cargada pero no coincidente.

---

## 7. Resultado recibido de la firma legal

La firma legal recibida devuelve esta matriz:

| Decision | Opcion firmada | Matices obligatorios |
|---|---|---|
| L12 | L12-C | VICESECRETARIO fuera del singleton hard; ADMIN_SOLIDARIO/MANCOMUNADO con alerta al cierre y bloqueo solo al certificar/cerrar distribucion con menos de 2. |
| L13 | L13-B | Notificacion persistente D+0/D+60/D+90; owner Secretario/Vicesecretario; sin bloqueo de operaciones. |
| L20 | L20-A | Post-piloto; no implementar sucesion juridica automatica en Sprint 2. |

Con esa matriz firmada, se escribe:

`docs/superpowers/specs/2026-05-12-personas-cargos-completitud-design.md`

La implementacion sigue bloqueada hasta plan implementable aprobado.
