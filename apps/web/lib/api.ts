export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      ...options,
      credentials: "same-origin",
      cache: "no-store",
      signal: options.signal ?? AbortSignal.timeout(15000),
      headers: {
        "Content-Type": "application/json",
        "X-Woorisai-Request": "1",
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError(
      "NETWORK_ERROR",
      "연결이 잠시 끊겼어요. 다시 시도해주세요.",
      0,
    );
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(
      "NETWORK_ERROR",
      "서버에 연결하지 못했어요. 잠시 후 다시 시도해주세요.",
      response.status,
    );
  }
  if (!response.ok)
    throw new ApiError(
      data.code ?? "REQUEST_FAILED",
      data.message ?? "다시 시도해주세요.",
      response.status,
    );
  return data as T;
}
export const post = <T>(path: string, body: unknown = {}) =>
  api<T>(path, { method: "POST", body: JSON.stringify(body) });
export const put = <T>(path: string, body: unknown) =>
  api<T>(path, { method: "PUT", body: JSON.stringify(body) });
export function errorText(error: unknown) {
  return error instanceof Error
    ? error.message
    : "연결이 잠시 끊겼어요. 다시 시도해주세요.";
}
export function track(eventName: string, sessionId?: string) {
  // Public-page analytics are opt-in; personal server events remain transactional.
  if (
    typeof window === "undefined" ||
    localStorage.getItem("woorisai_analytics") !== "yes"
  )
    return;
  let visitorId = sessionStorage.getItem("woorisai_visitor");
  if (!visitorId) {
    visitorId = crypto.randomUUID();
    sessionStorage.setItem("woorisai_visitor", visitorId);
  }
  void post("/analytics/events", {
    eventName,
    visitorId,
    ...(sessionId ? { sessionId } : {}),
  }).catch(() => {});
}
