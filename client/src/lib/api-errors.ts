/** Parse errors thrown by `apiRequest` (`"${status}: ${body}"`). */
export function parseApiErrorMessage(err: unknown): { status?: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  const m = raw.match(/^(\d+):\s*([\s\S]*)$/);
  if (!m) return { message: raw };
  const status = Number(m[1]);
  let message = m[2].trim();
  try {
    const j = JSON.parse(m[2]);
    message = (j.message as string) ?? (j.error as string) ?? message;
  } catch {
    // plain text body
  }
  return { status, message };
}

const SERVER_CONNECTIVITY_PATTERN =
  /mongodb|timeout|econnrefused|interrupted|server monitor/i;

/** Short, non-technical copy for toasts (network outages, 5xx, DB timeouts). */
export function userFacingApiError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (/failed to fetch|networkerror|load failed/i.test(raw)) {
    return "Couldn't reach the server. Check your connection and try again.";
  }
  const { status, message } = parseApiErrorMessage(err);
  if (status === 502 || status === 503 || status === 504) {
    return "Server is temporarily unavailable. Please try again in a moment.";
  }
  if (status != null && status >= 500) {
    if (SERVER_CONNECTIVITY_PATTERN.test(message)) {
      return "Couldn't save right now. Please try again in a few seconds.";
    }
    return "Something went wrong on our side. Please try again.";
  }
  return message || "Something went wrong";
}
