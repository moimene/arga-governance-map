-- Lock down dispatcher-internal RPCs: only service_role can invoke.
-- Authenticated users must not be able to claim the dispatch queue,
-- mark recipients as sent, or trigger fallback promotion.

REVOKE EXECUTE ON FUNCTION fn_claim_recipients_for_dispatch(int) FROM PUBLIC, authenticated;
REVOKE EXECUTE ON FUNCTION fn_recipient_mark_sent(uuid, text, text, text, text) FROM PUBLIC, authenticated;
REVOKE EXECUTE ON FUNCTION fn_recipient_handle_error(uuid, text, boolean) FROM PUBLIC, authenticated;

GRANT EXECUTE ON FUNCTION fn_claim_recipients_for_dispatch(int) TO service_role;
GRANT EXECUTE ON FUNCTION fn_recipient_mark_sent(uuid, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION fn_recipient_handle_error(uuid, text, boolean) TO service_role;
