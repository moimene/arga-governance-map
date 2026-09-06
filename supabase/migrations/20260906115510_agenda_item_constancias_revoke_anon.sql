-- agenda_item_constancias concedía INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/
-- TRIGGER a anon (medido 2026-09-06). La RLS (tenant_write, con
-- fn_secretaria_current_tenant_id) bloquea el DML anónimo, pero TRUNCATE no
-- pasa por RLS. Misma clase que 20260906072910. authenticated conserva el DML:
-- useReplaceAgendaItemConstancias hace delete+insert por reunión, siempre
-- dentro de su tenant.
revoke all on public.agenda_item_constancias from anon;
revoke truncate, references, trigger on public.agenda_item_constancias from authenticated;
