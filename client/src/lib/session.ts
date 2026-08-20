const sessionStorageKey = "diarize.session.v1";

export function getSessionId(): string {
  const existing = window.sessionStorage.getItem(sessionStorageKey);
  if (existing) return existing;
  const next = crypto.randomUUID();
  window.sessionStorage.setItem(sessionStorageKey, next);
  return next;
}
