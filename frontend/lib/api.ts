const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  skipAuth?: boolean;
}

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('globapay_access_token');
}

function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('globapay_refresh_token');
}

export function storeTokens(accessToken: string, refreshToken: string) {
  window.localStorage.setItem('globapay_access_token', accessToken);
  window.localStorage.setItem('globapay_refresh_token', refreshToken);
}

export function clearTokens() {
  window.localStorage.removeItem('globapay_access_token');
  window.localStorage.removeItem('globapay_refresh_token');
}

async function rawRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, skipAuth, headers, ...rest } = options;
  const accessToken = getAccessToken();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken && !skipAuth ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    const message = payload?.message ?? 'Something went wrong. Please try again.';
    throw new ApiError(Array.isArray(message) ? message.join(', ') : message, response.status);
  }

  return (payload?.data ?? payload) as T;
}

/**
 * Wraps rawRequest with a single silent refresh-and-retry on a 401, so
 * components don't need to think about token expiry.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  try {
    return await rawRequest<T>(path, options);
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 401 && !options.skipAuth) {
      const refreshToken = getRefreshToken();
      if (!refreshToken) throw error;

      try {
        const refreshed = await rawRequest<{ accessToken: string; refreshToken: string }>(
          '/auth/refresh',
          { method: 'POST', body: { refreshToken }, skipAuth: true },
        );
        storeTokens(refreshed.accessToken, refreshed.refreshToken);
        return await rawRequest<T>(path, options);
      } catch {
        clearTokens();
        throw error;
      }
    }
    throw error;
  }
}

export const api = {
  get: <T>(path: string) => apiRequest<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
  /** For multipart/form-data endpoints (e.g. KYC document upload) — skips JSON.stringify and the Content-Type header so the browser sets its own multipart boundary. */
  upload: <T>(path: string, formData: FormData) => apiUploadRequest<T>(path, formData),
};

async function apiUploadRequest<T>(path: string, formData: FormData): Promise<T> {
  const accessToken = getAccessToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    body: formData,
  });

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    const message = payload?.message ?? 'Upload failed. Please try again.';
    throw new ApiError(Array.isArray(message) ? message.join(', ') : message, response.status);
  }

  return (payload?.data ?? payload) as T;
}
