// invite-portal-member: STUB for P1. Full implementation in P2 sem 2.
// Will: supabase.auth.admin.inviteUserByEmail + INSERT communications (COMUNICACION_INTER_ORGANO).

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

serve(async (_req) => {
  return new Response(
    JSON.stringify({ error: 'invite-portal-member not implemented in P1; activated in P2 sem 2' }),
    { status: 501, headers: { 'Content-Type': 'application/json' } },
  );
});
