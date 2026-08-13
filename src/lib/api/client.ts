import { getToken, clearToken } from '@/lib/storage/secure-token';
import { config } from '@/lib/config';
import { currentLocale, t } from '@/lib/i18n';

/**
 * Thin fetch wrapper around the Zinevu Laravel v1 API.
 *
 * Backend response envelope (app/Services/ResponseService.php) — note it is
 * NOT the `{ success, error }` shape other Laravel apps use:
 *   success: { meta: { message, pagination? }, data }
 *   error:   { meta: { message }, errors: { field: [msg, ...] } }
 *
 * So an error is recognised by the HTTP status and the presence of `errors`,
 * never by a `success` flag. request<T>() returns the unwrapped `data` payload;
 * `meta` (page-number pagination) is exposed via requestWithMeta(). Feature APIs
 * read the named key inside data (e.g. data.user) themselves.
 */

export type ApiPagination = {
  total: number;
  current_page: number;
  total_page: number;
  per_page: number;
};

export type ApiMeta = {
  message?: string;
  pagination?: ApiPagination;
  [key: string]: unknown;
};

type SuccessEnvelope<T> = {
  meta?: ApiMeta;
  data: T;
};

type ErrorEnvelope = {
  meta?: { message?: string };
  /** Laravel validation bag: field -> messages. */
  errors?: Record<string, string[] | string>;
};

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// Set by the auth store so a 401 anywhere tears down the session once.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

/**
 * Builds an ApiError from Zinevu's error envelope. The backend has no error
 * *code* vocabulary — `meta.message` is already the human sentence (localized
 * via Accept-Language), so the code is synthesised from the status and the
 * validation bag is carried through as `details` for form field errors.
 */
function toApiError(status: number, body: ErrorEnvelope | null): ApiError {
  const message =
    body?.meta?.message ?? t('errors.requestFailed', { status });
  const code = status === 422 ? 'VALIDATION' : status === 403 ? 'FORBIDDEN' : 'UNKNOWN';
  return new ApiError(status, code, message, body?.errors);
}

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Plain object → JSON body. Pass FormData for multipart uploads. */
  body?: unknown;
  /** Query params; undefined/null values are dropped. */
  params?: Record<string, string | number | boolean | undefined | null>;
  /** Skip attaching the bearer token (public endpoints). */
  auth?: boolean;
  signal?: AbortSignal;
  locale?: string;
};

function buildUrl(path: string, params?: RequestOptions['params']): string {
  const base = `${config.apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  if (!params) return base;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) qs.append(k, String(v));
  }
  const query = qs.toString();
  return query ? `${base}?${query}` : base;
}

async function raw<T>(
  path: string,
  options: RequestOptions = {}
): Promise<SuccessEnvelope<T>> {
  const { method = 'GET', body, params, auth = true, signal, locale } = options;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Language': locale ?? currentLocale(),
  };

  if (auth) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const isFormData =
    typeof FormData !== 'undefined' && body instanceof FormData;
  let payload: BodyInit | undefined;
  if (body !== undefined) {
    if (isFormData) {
      payload = body as FormData; // let fetch set the multipart boundary
    } else {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, params), {
      method,
      headers,
      body: payload,
      signal,
    });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK_ERROR', t('errors.network'));
  }

  if (response.status === 401) {
    await clearToken();
    onUnauthorized?.();
  }

  let json: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  if (!response.ok) {
    throw toApiError(response.status, json as ErrorEnvelope | null);
  }

  return json as SuccessEnvelope<T>;
}

/** Returns the unwrapped `data` payload. */
export async function request<T>(
  path: string,
  options?: RequestOptions
): Promise<T> {
  return (await raw<T>(path, options)).data;
}

/**
 * Multipart upload over XMLHttpRequest.
 *
 * Expo SDK 54+ installs its own WinterCG `fetch` as the global (see
 * expo/src/winter/runtime.native.ts), and its FormData serializer rejects
 * React Native's classic `{ uri, name, type }` file part with "Unsupported
 * FormDataPart implementation". XHR is left untouched by Expo, and its native
 * networking streams file-uri parts directly — so file uploads must go through
 * here, not `request()`. Returns the unwrapped `data` payload like request().
 */
export async function uploadMultipart<T>(
  path: string,
  form: FormData,
  options: { locale?: string } = {}
): Promise<T> {
  const token = await getToken();
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', buildUrl(path));
    xhr.responseType = 'text';
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.setRequestHeader('Accept-Language', options.locale ?? currentLocale());
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    // No Content-Type — XHR derives the multipart boundary from the FormData.

    xhr.onload = () => {
      const status = xhr.status;
      if (status === 401) {
        void clearToken();
        onUnauthorized?.();
      }
      let json: unknown = null;
      if (xhr.responseText) {
        try {
          json = JSON.parse(xhr.responseText);
        } catch {
          json = null;
        }
      }
      if (status < 200 || status >= 300) {
        reject(toApiError(status, json as ErrorEnvelope | null));
        return;
      }
      resolve((json as SuccessEnvelope<T>).data);
    };
    xhr.onerror = () =>
      reject(new ApiError(0, 'NETWORK_ERROR', t('errors.network')));
    xhr.ontimeout = () =>
      reject(new ApiError(0, 'TIMEOUT', t('errors.timeout')));

    xhr.send(form);
  });
}

/** Returns `data` plus the top-level `meta` (cursor pagination). */
export async function requestWithMeta<T>(
  path: string,
  options?: RequestOptions
): Promise<{ data: T; meta?: ApiMeta }> {
  const env = await raw<T>(path, options);
  return { data: env.data, meta: env.meta };
}
