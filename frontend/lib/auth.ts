export type UserRole = "candidate" | "recruiter" | "admin";

export type SessionData = {
  token: string;
  userId: number;
  name: string;
  email: string;
  role: UserRole;
  emailVerified: boolean;
};

const SESSION_KEY = "ijmrs_session";
const SESSION_CHANGE_EVENT = "ijmrs_session_change";
let cachedRawSession: string | null | undefined = undefined;
let cachedSession: SessionData | null = null;

export function getSession(): SessionData | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (raw === cachedRawSession) {
    return cachedSession;
  }
  cachedRawSession = raw;
  if (!raw) {
    cachedSession = null;
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as SessionData;
    if (!parsed.token || !parsed.userId || !parsed.role) {
      cachedSession = null;
      return null;
    }
    cachedSession = parsed;
    return cachedSession;
  } catch {
    cachedSession = null;
    return null;
  }
}

export function setSession(session: SessionData): void {
  if (typeof window === "undefined") return;
  const raw = JSON.stringify(session);
  window.localStorage.setItem(SESSION_KEY, raw);
  cachedRawSession = raw;
  cachedSession = session;
  window.dispatchEvent(new Event(SESSION_CHANGE_EVENT));
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_KEY);
  cachedRawSession = null;
  cachedSession = null;
  window.dispatchEvent(new Event(SESSION_CHANGE_EVENT));
}

export function subscribeSession(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => onStoreChange();
  window.addEventListener("storage", handler);
  window.addEventListener(SESSION_CHANGE_EVENT, handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(SESSION_CHANGE_EVENT, handler);
  };
}
