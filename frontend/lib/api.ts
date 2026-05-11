import { clearSession, type SessionData } from "@/lib/auth";

type ApiResponseEnvelope<T> = {
  data: T;
  meta?: Record<string, unknown>;
};

type ApiErrorEnvelope = {
  error?: {
    code?: string;
    message?: string;
    details?: Record<string, unknown>;
  };
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export async function apiRequest<T>(
  path: string,
  options?: {
    method?: string;
    body?: unknown;
    session?: SessionData | null;
  },
): Promise<ApiResponseEnvelope<T>> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: options?.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options?.session ? { Authorization: `Bearer ${options.session.token}` } : {}),
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  const payload = (await response.json()) as ApiResponseEnvelope<T> & ApiErrorEnvelope;
  if (!response.ok) {
    const message = payload.error?.message ?? `Request failed (${response.status})`;
    if (
      response.status === 401 &&
      (message.toLowerCase().includes("invalid token") ||
        message.toLowerCase().includes("expired token"))
    ) {
      clearSession();
    }
    throw new Error(message);
  }
  return payload;
}

export async function apiUpload<T>(
  path: string,
  file: File,
  session?: SessionData | null,
): Promise<ApiResponseEnvelope<T>> {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
    },
    body: form,
    cache: "no-store",
  });

  const payload = (await response.json()) as ApiResponseEnvelope<T> & ApiErrorEnvelope;
  if (!response.ok) {
    const message = payload.error?.message ?? `Upload failed (${response.status})`;
    if (
      response.status === 401 &&
      (message.toLowerCase().includes("invalid token") ||
        message.toLowerCase().includes("expired token"))
    ) {
      clearSession();
    }
    throw new Error(message);
  }
  return payload;
}

export function qs(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  });
  const result = search.toString();
  return result ? `?${result}` : "";
}
