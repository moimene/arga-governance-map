# DEFINER / Trigger Threat Model — F2.G14

**Fecha:** 2026-05-16
**Plan:** docs/superpowers/plans/2026-05-16-tgms-gaps-coverage-plan-v1.md §4
**Versión:** v1 (post-concilio Codex K12)

> Concilio Codex K12: "G2 v0 cubría solo RPCs invocables. Los triggers DEFINER y funciones en otros schemas son ruta de escalación independiente." Este documento responde a esa crítica con un inventario completo + decisión por función.

---

## §1 Inventario consolidado

| Tipo | Schema | Total | Acción |
|---|---|---:|---|
| Funciones SECURITY DEFINER | `public` | ~20 RPCs + helpers | Auditadas |
| Triggers con función DEFINER subyacente | `public` | 3 conocidos | Auditadas |
| Funciones DEFINER en `auth` / `storage` | Supabase managed | ~15 | No tocar (documentadas para conciencia) |

---

## §2 Matriz de riesgo (acción aplicable)

| Función | Archivo:línea | search_path | tenant guard | role guard | DML target | GRANT | Decisión | Riesgo |
|---|---|---|---|---|---|---|---|---|
| `fn_current_tenant_id()` | 20260516120001:23 | ✓ public | N/A (read-only) | N/A | N/A | auth, srole | **KEEP** | LOW |
| `fn_assert_current_tenant_id()` | 20260516120001:79 | ✓ public | N/A | N/A | N/A | auth, srole | **KEEP** | LOW |
| `fn_user_has_body_access(uuid)` | 20260516120003 | ✓ public | N/A | N/A | N/A | auth, srole | **KEEP** | LOW |
| `fn_intra_tenant_scope_enabled()` | 20260516120003 | ✓ public | N/A | N/A | N/A | auth, srole | **KEEP** | LOW |
| `fn_secretaria_current_tenant_id()` | 20260504201000:23 | ✓ public,extensions | N/A | N/A | N/A | auth, srole | **KEEP** | LOW |
| `fn_secretaria_assert_tenant_access(uuid)` | 20260504201000:60 | ✓ public,extensions | ✓ param required | N/A | N/A | auth, srole | **KEEP** | LOW |
| `fn_secretaria_current_role_code()` | 20260504201000:80 | ✓ public,extensions | N/A | N/A | N/A | auth, srole | **KEEP** | LOW |
| `fn_secretaria_current_person_id()` | 20260504201000:95 | ✓ public,extensions | N/A | N/A | N/A | auth, srole | **KEEP** | LOW |
| `fn_secretaria_assert_capability(uuid, text)` | 20260504201000:110 | ✓ public,extensions | ✓ tenant_access | ✓ capability_matrix | read-only | auth, srole | **KEEP** | LOW |
| `fn_secretaria_assert_role_allowed(uuid, text[])` | 20260504201000:140 | ✓ public,extensions | ✓ tenant_access | ✓ role array | read-only | auth, srole | **KEEP** | LOW |
| `fn_cerrar_votaciones_vencidas(uuid)` | 20260504201000:170 | ✓ public,extensions | ✓ p_tenant_id WHERE | ✓ role guard | no_session_resolutions | auth, srole | **KEEP** | MEDIUM |
| `fn_no_session_cast_response(...)` | 20260504201000:210 | ✓ public,extensions | ✓ tenant scoped | ✓ capability | no_session_responses | auth, srole | **KEEP** | MEDIUM |
| `fn_no_session_close_and_materialize_agreement(...)` | 20260504201000:280 | ✓ public,extensions | ✓ tenant scoped | ✓ role | agreements | auth, srole | **KEEP** | MEDIUM |
| `fn_generar_certificacion_acuerdo_sin_sesion(...)` | 20260504201000:350 | ✓ public,extensions | ✓ from agreement | ✓ role | acuerdo_certificaciones | auth, srole | **KEEP** | MEDIUM |
| `fn_registrar_transmision_capital(...)` | 20260504201000:420 | ✓ public,extensions | ✓ p_tenant_id | ✓ actor | capital_holdings | auth, srole | **KEEP** | MEDIUM |
| `fn_assert_actor_person(...)` | 20260504201000:470 | ✓ public,extensions | ✓ tenant+FK | N/A | read-only | auth, srole | **KEEP** | LOW |
| `fn_assert_person_tenant(...)` | 20260504201000:490 | ✓ public,extensions | ✓ tenant+FK | N/A | read-only | auth, srole | **KEEP** | LOW |
| `fn_assert_template_tenant(...)` | 20260504201000:510 | ✓ public,extensions | ✓ tenant+FK | N/A | read-only | auth, srole | **KEEP** | LOW |
| `fn_is_service_role()` | 20260504201000:530 | ✓ public,extensions | N/A | N/A | N/A | auth, srole | **KEEP** | LOW |
| `trg_censo_snapshot_worm()` | 20260421124047:55 | ✓ public | N/A (append-only) | N/A | audit_log | trigger | **KEEP** | LOW |
| **`fn_registrar_movimiento_capital(...)`** | 20260424155349:49 | **✗ MISSING** | **✗ MISSING explicit** | N/A | audit_log, capital_movements | auth, srole | **HARDEN P0** | HIGH |
| **`handle_new_user()`** | 20260417133213:13 | **✗ MISSING** | N/A (auth trigger) | N/A | profiles | auth, srole | **HARDEN P0** | HIGH |
| `fn_audit_worm()` | 20260419173059:71 | ⚠️ verify | N/A (append-only) | N/A | audit_log | trigger | **HARDEN P1** | MEDIUM |

---

## §3 Funciones KEEP (no acción, 20 functions)

Todas las funciones del bloque post-P0 hardening (migración `20260504201000_000053_secretaria_p0_pgcrypto_search_path.sql`) y las nuevas del F1.G13/G18 cumplen el patrón hardening:

- `SET search_path = public[,extensions]` explícito.
- Parámetro `p_tenant_id` obligatorio cuando aplica.
- Llamada explícita a `fn_secretaria_assert_tenant_access(p_tenant_id)` antes de cualquier DML.
- Cuando aplica: `fn_secretaria_assert_role_allowed(p_tenant_id, ARRAY[...])`.
- `REVOKE EXECUTE FROM PUBLIC, anon; GRANT TO authenticated, service_role`.
- DML scope siempre por tenant_id o derivado de un FK que ya está scoped.

`trg_censo_snapshot_worm()` también pasa: append-only, BEFORE INSERT, NEW.tenant_id presente, search_path correcto.

---

## §4 Funciones HARDEN — guards a añadir

### 4.1 `fn_registrar_movimiento_capital(...)` — **P0**

**Archivo:** `supabase/migrations/20260424155349_000032_capital_movements_worm.sql:49`

**Problemas detectados:**
1. **Falta `SET search_path`** — bajo plpgsql con DEFINER, una referencia no calificada a `audit_log` o `capital_movements` podría ser hijackeada por un schema malicioso. Vulnerabilidad **schema injection**.
2. **Falta `PERFORM fn_secretaria_assert_tenant_access(p_tenant_id)`** explícito (o equivalente). El p_tenant_id se pasa pero no se valida.

**Patch SQL:**

```sql
CREATE OR REPLACE FUNCTION fn_registrar_movimiento_capital(
  p_tenant_id      uuid,
  p_entity_id      uuid,
  ... -- params restantes
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions    -- ← AÑADIR
AS $$
DECLARE
  v_movement_id uuid;
  v_audit_id    uuid;
  v_prev_hash   text;
BEGIN
  PERFORM fn_secretaria_assert_tenant_access(p_tenant_id);  -- ← AÑADIR
  -- ... resto sin cambios
END;
$$;
```

### 4.2 `handle_new_user()` — **P0**

**Archivo:** `supabase/migrations/20260417133213_002_profiles_and_auth_trigger.sql:13`

**Problema:** Trigger `BEFORE INSERT ON auth.users`. Sin `SET search_path`, una referencia no calificada a `public.profiles` puede ser hijackeada vía `pg_temp` u otro schema malicioso.

**Patch SQL:**

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public    -- ← AÑADIR
AS $$
BEGIN
  INSERT INTO public.profiles (id, updated_at)
  VALUES (new.id, now());
  RETURN new;
END;
$$;
```

### 4.3 `fn_audit_worm()` — **P1**

**Archivo:** `supabase/migrations/20260419173059_b3_audit_worm_triggers.sql:71`

**Problema:** Trigger DEFINER que escribe en `audit_log`. El subagente no pudo confirmar visualmente la presencia de `SET search_path`. Si falta, vulnerabilidad similar a 4.1/4.2.

**Acción:** verificar contenido completo de la migración. Si `SET search_path = public` está presente → mover a KEEP. Si falta → aplicar patch similar a 4.2.

---

## §5 Funciones DROP

### 5.1 `fn_secretaria_current_tenant_id` × 3 — duplicación de migración

**Archivos:** las migraciones `000051`, `000052`, `000053` (4-5 de mayo) redefinen la misma función. Tres copias idénticas funcionalmente.

**Riesgo:** No es de seguridad directamente (CREATE OR REPLACE → la última gana). Pero:
- Confusión audit (¿cuál es la fuente canónica?).
- Inconsistencia search_path entre versiones (`000052` con `public`, `000053` con `public,extensions`).

**Decisión propuesta:** mantener `000053` como canónica (search_path incluye `extensions` para `pgcrypto`). En siguiente sprint de cleanup, marcar `000052` como retired-migration vía mover a `docs/superpowers/retired-migrations/`. **No es DROP del fn; es DROP de la duplicación de definición en repo.**

---

## §6 Triggers SECURITY DEFINER

| Trigger | Target | Función | DEFINER | search_path | Decisión |
|---|---|---|---|---|---|
| `on_auth_user_created` | `auth.users` | `handle_new_user()` | ✓ | ✗ MISSING | **HARDEN P0** (§4.2) |
| `trg_censo_snapshot_worm` | `censo_snapshot` | `trg_censo_snapshot_worm()` | ✓ | ✓ public | **KEEP** |
| (audit_worm triggers) | `audit_log` | `fn_audit_worm()` | ✓ | ⚠️ verify | **HARDEN P1** (§4.3) |
| `trg_capital_movements_worm` | `capital_movements` | guard inmutabilidad | INVOKER | N/A | **KEEP** (no DEFINER) |

---

## §7 Conclusión

### Conteo
- **KEEP:** 20 funciones + 1 trigger
- **HARDEN:** 2 P0 + 1 P1 = 3 funciones
- **DROP (duplicación de definición):** 1 (migración `000052`, opcional cleanup)

### Plan de hardening (próximo sprint, post-PR F1+F2 actual)

1. **Migración G14 hardening (P0)**: aplica patches §4.1 + §4.2 en una migración consolidada.
2. **Migración G14 verify (P1)**: lee `fn_audit_worm` completo; si falta `SET search_path`, añadir.
3. **Cleanup G14 (opcional)**: mover `20260504193000_000052_secretaria_p0_rpc_hardening.sql` a `docs/superpowers/retired-migrations/` para reducir confusión.

### Defensa en profundidad

RLS policies (F1.G1) + SECURITY DEFINER guards (F2.G14) son capas independientes:
- RLS bloquea acceso por tenant_id.
- DEFINER guards bloquean abuso de la función (search_path injection, tenant bypass, role escalation).

Ambas deben pasar para que DML proceda. Esta migración G2+G19 cubre el segundo eje. G14 hardening completa la capa.

---

*v1 — 2026-05-16. Generado por threat-model agent post-aplicación G2+G19.*
