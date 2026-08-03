-- Refresh PostgREST after the authoritative Secretaría RPCs introduced in
-- migrations 138 and 139. Without this notification an already-running API
-- instance may continue returning PGRST202/404 for functions that exist and
-- have the correct grants in PostgreSQL.
NOTIFY pgrst, 'reload schema';

