import { supabase } from "@/integrations/supabase/client";

export const REVIEW_EVENTS_TABLE = "evidence_bundle_review_events";
export const REVIEW_STATE_VIEW = "evidence_bundle_review_state_current";

export interface ReviewStateSchemaGate {
  supported: boolean;
  table: string;
  view: string;
  missing: string[];
  error?: string | null;
}

export function staticReviewStateSchemaGate(): ReviewStateSchemaGate {
  return {
    supported: false,
    table: REVIEW_EVENTS_TABLE,
    view: REVIEW_STATE_VIEW,
    missing: [
      `${REVIEW_EVENTS_TABLE}.id`,
      `${REVIEW_EVENTS_TABLE}.tenant_id`,
      `${REVIEW_EVENTS_TABLE}.evidence_bundle_id`,
      `${REVIEW_EVENTS_TABLE}.review_state`,
      `${REVIEW_EVENTS_TABLE}.event_type`,
      `${REVIEW_EVENTS_TABLE}.actor_id`,
      `${REVIEW_STATE_VIEW}`,
    ],
    error: "review_state schema no existe en el contrato local actual.",
  };
}

export async function probeReviewStateSchema(): Promise<ReviewStateSchemaGate> {
  const client = supabase as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        limit: (count: number) => Promise<{ error: { message: string } | null }>;
      };
    };
  };
  const { error } = await client
    .from(REVIEW_STATE_VIEW)
    .select("tenant_id, evidence_bundle_id, review_state, created_at")
    .limit(1);

  if (error) {
    return {
      ...staticReviewStateSchemaGate(),
      error: error.message,
    };
  }

  return {
    supported: true,
    table: REVIEW_EVENTS_TABLE,
    view: REVIEW_STATE_VIEW,
    missing: [],
    error: null,
  };
}
