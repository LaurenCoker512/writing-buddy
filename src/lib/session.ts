export type SessionUser = {
  id?: string;
  email?: string | null;
  name?: string | null;
};

export type ValidSession = {
  user: SessionUser;
};

export function isValidSession(session: unknown): session is ValidSession {
  if (typeof session !== "object" || session === null) return false;
  const s = session as Record<string, unknown>;
  if (typeof s["user"] !== "object" || s["user"] === null) return false;
  const user = s["user"] as Record<string, unknown>;
  return typeof user["email"] === "string";
}
