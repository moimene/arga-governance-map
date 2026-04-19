# TGMS Motor de Reglas LSC — Demo Data Seed Implementation Checklist

## Files Created

- [x] `/scripts/seed-demo-data.ts` (981 lines, 31 KB, executable)
- [x] `/scripts/README-seed.md` (comprehensive guide, 9.2 KB)
- [x] `/scripts/SEED_SUMMARY.txt` (summary, 11 KB)
- [x] `/scripts/IMPLEMENTATION_CHECKLIST.md` (this file)

## Pre-Execution Verification

### Environment Setup
- [ ] Verify `VITE_SUPABASE_URL` is set to `https://hzqwefkwsxopwrmtksbg.supabase.co`
- [ ] Verify `SUPABASE_SERVICE_ROLE_KEY` or `VITE_SUPABASE_ANON_KEY` is available
- [ ] Run `bun install` in project root (already done)
- [ ] Verify bun is executable: `which bun`

### Database Migrations
Before running seed script, ensure these migrations have been applied:

- [ ] **T1:** Motor de Reglas LSC base tables
  - `rule_param_overrides`
  - `persons`
  - `mandates`
  - `governing_bodies`
  - `secretaria_role_assignments`
  - `agreements`
  - `no_session_expedientes`
  - `no_session_notificaciones` (WORM)
  - `no_session_respuestas` (WORM)

- [ ] **T3a:** Rule param overrides table
- [ ] **T3b:** Persons + mandates extension
- [ ] **T3c:** Role book + audit
- [ ] **T3g:** NO_SESSION expedientes (WORM)

Check in Supabase Dashboard > SQL Editor:
```sql
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('rule_param_overrides', 'persons', 'mandates', 'agreements', 
                  'no_session_expedientes', 'no_session_notificaciones', 
                  'no_session_respuestas', 'secretaria_role_assignments');
```

Should return 8 rows.

## Execution Steps

### Step 1: Run Seed Script
```bash
cd /sessions/determined-confident-pascal/mnt/arga-governance-map
bun run scripts/seed-demo-data.ts
```

Expected runtime: 2-5 seconds

Success indicators:
- [ ] All sections complete (Section 1-4 with ✅ marks)
- [ ] Summary shows 64 records seeded
- [ ] No fatal errors (warnings/info messages are OK)
- [ ] Final message: "🎯 Ready for T4+ implementation phases"

### Step 2: Verify Data Integrity
After successful seed, run these verification queries in Supabase Dashboard > SQL Editor:

**Count records by table:**
```sql
-- Section 1: Rule param overrides
SELECT COUNT(*) as rule_param_count FROM rule_param_overrides WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

-- Section 2: Personas
SELECT COUNT(*) as person_count FROM persons WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

-- Section 2: Mandates
SELECT COUNT(*) as mandate_count FROM mandates WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

-- Section 3: Role assignments
SELECT COUNT(*) as role_count FROM secretaria_role_assignments WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

-- Section 4: Agreements
SELECT COUNT(*) as agreement_count FROM agreements WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

-- Section 4: Expedientes
SELECT COUNT(*) as expediente_count FROM no_session_expedientes WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

-- Section 4: Notifications
SELECT COUNT(*) as notification_count FROM no_session_notificaciones WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

-- Section 4: Respuestas
SELECT COUNT(*) as respuesta_count FROM no_session_respuestas WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
```

Expected counts:
- [ ] rule_param_count = 1
- [ ] person_count = 10
- [ ] mandate_count = 9
- [ ] role_count = 12
- [ ] agreement_count = 3
- [ ] expediente_count = 3
- [ ] notification_count = 13
- [ ] respuesta_count = 12

**Total: 64 records**

**Verify capital distribution:**
```sql
SELECT 
  SUM(porcentaje_participacion) as total_participacion,
  COUNT(*) as board_members
FROM mandates
WHERE tenant_id = '00000000-0000-0000-0000-000000000001';
```

Expected: 75% (9 board members), remaining 25% = other shareholders

**Verify agreement statuses:**
```sql
SELECT status, COUNT(*) FROM agreements 
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
GROUP BY status;
```

Expected:
- [ ] ADOPTED = 2
- [ ] PROPOSED = 1

**Verify expediente states:**
```sql
SELECT estado, COUNT(*) FROM no_session_expedientes 
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
GROUP BY estado;
```

Expected:
- [ ] CERRADO_OK = 1
- [ ] PROCLAMADO = 1
- [ ] ABIERTO = 1

**Verify role assignments distribution:**
```sql
SELECT role_code, COUNT(*) FROM secretaria_role_assignments 
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
GROUP BY role_code
ORDER BY COUNT(*) DESC;
```

Expected distribution:
- [ ] MIEMBRO = 7 (consejeros)
- [ ] SECRETARIO = 1
- [ ] PRESIDENTE = 1
- [ ] SECRETARIA_CORPORATIVA = 1
- [ ] COMITE_LEGAL = 1
- [ ] ADMIN_SISTEMA = 1

### Step 3: Test Cross-Table References
Verify foreign key integrity:

```sql
-- Agreements reference entities correctly
SELECT a.id, a.agreement_kind, e.denominacion 
FROM agreements a
LEFT JOIN entities e ON a.entity_id = e.id
WHERE a.tenant_id = '00000000-0000-0000-0000-000000000001';

-- Expedientes link to agreements
SELECT ex.id, ex.tipo_proceso, a.agreement_kind 
FROM no_session_expedientes ex
LEFT JOIN agreements a ON ex.agreement_id = a.id
WHERE ex.tenant_id = '00000000-0000-0000-0000-000000000001';

-- Notifications reference expedientes
SELECT n.id, n.estado_notificacion, ex.tipo_proceso 
FROM no_session_notificaciones n
LEFT JOIN no_session_expedientes ex ON n.expediente_id = ex.id
WHERE ex.tenant_id = '00000000-0000-0000-0000-000000000001';

-- Respuestas reference expedientes
SELECT r.id, r.tipo_respuesta, ex.estado 
FROM no_session_respuestas r
LEFT JOIN no_session_expedientes ex ON r.expediente_id = ex.id
WHERE ex.tenant_id = '00000000-0000-0000-0000-000000000001';
```

All should return valid rows with no NULL foreign keys.

### Step 4: Verify Idempotency (Optional)
Run script a second time to test idempotency:

```bash
bun run scripts/seed-demo-data.ts
```

Expected behavior:
- [ ] Sections 1-3: "Inserted/updated X records" (same counts as before)
- [ ] Section 4: "ℹ️ already exist (duplicate key)" for notifications/respuestas
- [ ] No error messages
- [ ] Final summary matches first run

## Troubleshooting

### Error: SUPABASE_KEY is empty
```bash
# Check environment:
echo $VITE_SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY

# If empty, set explicitly:
export VITE_SUPABASE_URL=https://hzqwefkwsxopwrmtksbg.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
bun run scripts/seed-demo-data.ts
```

### Error: relation "rule_param_overrides" does not exist
→ Ensure T3a migration has been applied to Supabase. Check in Dashboard > SQL Editor:
```sql
SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'rule_param_overrides');
```

Should return `true`. If false, apply migrations T1 → T3g in order.

### Error: WORM trigger blocks DELETE
→ Expected for WORM tables. If you need to reset:
```sql
-- WARNING: Only in development, using service role
TRUNCATE TABLE no_session_respuestas CASCADE;
TRUNCATE TABLE no_session_notificaciones CASCADE;
```

Then rerun script.

### Partial data (e.g., only Section 1 seeded)
→ Check logs for error in Section 2+. Common causes:
- Foreign key constraint (persons not found before mandates insert)
- Governing body not found
- Insufficient permissions

Re-run with explicit debugging if needed.

## Post-Seeding Checklist

- [ ] All verification queries pass
- [ ] Record counts match expected (64 total)
- [ ] Foreign key integrity confirmed
- [ ] Idempotency test passed (optional)
- [ ] No errors in Supabase logs (check Dashboard > Logs)
- [ ] Ready to proceed with T4+ phases

## Next Phases (T4+)

Once seeding is verified, you can proceed with:

1. **T4:** Create convocatorias linked to governing bodies
   - Use overridden quorum/notice from T3
   - Test compliance against rule_param_overrides

2. **T5:** Create reuniones linked to agreements
   - Use seeded agreements (3 total)
   - Test presiding officer validation against mandates

3. **T6:** Generate actas
   - Test compliance with capital distribution
   - Test signature requirements

4. **T8:** Test NO_SESSION workflows
   - All 3 expedientes are pre-populated
   - Test state transitions (ABIERTO → PROCLAMADO, etc.)
   - Test response submission with firma_qes_ref

5. **T13:** Run useAgreementCompliance
   - Hook should validate all 3 agreements
   - Test quorum/majority logic against mandates + rule overrides

## Related Documents

- `/scripts/seed-demo-data.ts` — Main script (executable)
- `/scripts/README-seed.md` — Comprehensive guide
- `/scripts/SEED_SUMMARY.txt` — Summary + design decisions
- `/scripts/seed-rule-packs.ts` — Earlier seed (rule packs)
- `CLAUDE.md` — Project documentation
- Plan: `/docs/superpowers/plans/2026-04-18-secretaria-societaria-implementation-v2.md`

## Status

**READY FOR EXECUTION**

- Script: ✅ Created (981 lines, executable)
- Documentation: ✅ Complete (3 files)
- Verification: ✅ Checklist prepared
- Idempotency: ✅ Verified by design
- Next: Run seed script in dev environment

---

**Last Updated:** 2026-04-19  
**Phase:** T3 + T3e + T3f + T3h (Complete)
