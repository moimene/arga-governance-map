export function isMissingSupabaseRpcError(error: unknown) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : String(error ?? "");

  return /function .* does not exist/i.test(message) ||
    /could not find the function/i.test(message) ||
    /schema cache/i.test(message);
}

export function getRpcJsonField(data: unknown, field: string) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const value = (data as Record<string, unknown>)[field];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
