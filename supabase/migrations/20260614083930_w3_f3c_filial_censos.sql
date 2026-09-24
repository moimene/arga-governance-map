-- W3-F3c — Censo POLITICO para las 2 reuniones de CdA de filiales sin censo (2026-06-14).
-- ============================================================================
-- Tras F3a/F3b quedaban 2 warnings MEETING_WITHOUT_CENSUS en reuniones CONVOCADA de
-- CdA de filiales (ARGA España cda-esp-28-05-2026, ARGA Brasil cda-bra-11-06-2026).
-- Se genera su censo (snapshot POLITICO) -> readiness del tenant a 0 issues.
-- Backup: w3_backup_20260614. Forward-only, idempotente.

SELECT public.fn_crear_censo_snapshot('21c5e9b5-93d3-43c8-85e9-228e2a94eac3','MEETING','83059ef7-20ca-4e22-b353-48d14e30bdd9','5a21969e-b5a4-4448-b25b-7c4f1d564899','POLITICO');
SELECT public.fn_crear_censo_snapshot('f7f562a2-60e7-4aaa-8208-87564a5bff2b','MEETING','cfe95727-3d53-47c4-817f-47b02a55dc60','d5c4711d-8047-446e-ae6d-ef755fc1b6f3','POLITICO');
