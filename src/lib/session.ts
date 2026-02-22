/**
 * Anonymous session ID — per-browser isolation (LuBot pattern).
 * Each browser gets a unique ID so uploaded files are private.
 * Stored in localStorage, persists across page reloads.
 */
export function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";

  const KEY = "mergeai_session_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = `anon_${crypto.randomUUID()}`;
    localStorage.setItem(KEY, id);
  }
  return id;
}
