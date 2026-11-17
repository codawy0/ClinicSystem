import { AuthResponseDto, UserDto } from '../types';

export class ApiException extends Error {
  constructor(
    public status: number,
    public errorCode: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiException';
  }
}

export class ShiftRequiredException extends ApiException {
  constructor(message: string = 'لا يمكن إجراء العملية بدون وجود وردية مفتوحة') {
    super(400, 'SHIFT_REQUIRED', message);
    this.name = 'ShiftRequiredException';
  }
}

export class ConcurrencyConflictException extends ApiException {
  constructor(message: string = 'تم تعديل السجل بواسطة مستخدم آخر. يرجى تحديث الصفحة والمحاولة مجدداً.') {
    super(409, 'CONCURRENCY_CONFLICT', message);
    this.name = 'ConcurrencyConflictException';
  }
}

const TOKEN_KEY = 'clinic_access_token';
const USER_KEY = 'clinic_user_session';

export const authStorage = {
  getToken: (): string | null => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  getUser: (): UserDto | null => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  saveSession: (data: AuthResponseDto) => {
    try {
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    } catch (e) {
      console.error('Failed to save session to localStorage', e);
    }
  },
  clearSession: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch (e) {
      console.error('Failed to clear session from localStorage', e);
    }
  },
  updateUser: (user: Partial<UserDto>) => {
    try {
      const current = authStorage.getUser();
      if (current) {
        localStorage.setItem(USER_KEY, JSON.stringify({ ...current, ...user }));
      }
    } catch (e) {
      console.error('Failed to update user in localStorage', e);
    }
  }
};

interface RequestOptions extends RequestInit {
  idempotencyKey?: string;
  params?: Record<string, string | number | boolean | undefined>;
}

export async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const token = authStorage.getToken();
  const headers = new Headers(options.headers || {});

  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (options.idempotencyKey) {
    headers.set('Idempotency-Key', options.idempotencyKey);
  }

  let url = endpoint.startsWith('http') ? endpoint : `/api${endpoint}`;
  if (options.params) {
    const query = new URLSearchParams();
    Object.entries(options.params).forEach(([key, val]) => {
      if (val !== undefined && val !== null) query.append(key, String(val));
    });
    const qs = query.toString();
    if (qs) url += `?${qs}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (netErr: any) {
    throw new ApiException(0, 'NETWORK_ERROR', 'تعذر الاتصال بالخادم. يرجى التحقق من الشبكة المحلية.');
  }

  if (response.status === 204) {
    return {} as T;
  }

  if (!response.ok) {
    let errorData: any = {};
    try {
      errorData = await response.json();
    } catch {
      errorData = { detail: response.statusText };
    }

    const code = errorData.code || errorData.errorCode || errorData.extensions?.errorCode || '';
    const message = errorData.detail || errorData.message || 'حدث خطأ في الاتصال بالخادم';

    if (response.status === 401) {
      authStorage.clearSession();
      if (typeof window !== 'undefined' && 
          !window.location.pathname.startsWith('/login') && 
          !window.location.pathname.startsWith('/tv-queue')) {
        window.location.href = '/login';
      }
      throw new ApiException(401, 'UNAUTHORIZED', 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً');
    }

    if (response.status === 409 || code === 'CONCURRENCY_CONFLICT') {
      throw new ConcurrencyConflictException(message);
    }

    if (code === 'SHIFT_REQUIRED' || (response.status === 400 && message.includes('وردية'))) {
      throw new ShiftRequiredException(message);
    }

    throw new ApiException(response.status, code, message, errorData);
  }

  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(url: string, params?: Record<string, any>) => request<T>(url, { method: 'GET', params }),
  post: <T>(url: string, body?: any, options?: { idempotencyKey?: string }) => {
    const shouldInjectKey = ['/appointments', '/queue/call-next', '/shifts/open', '/shifts/close', '/shifts/expense'].some(p => url.includes(p));
    const idempotencyKey = options?.idempotencyKey || (shouldInjectKey ? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `idemp-${Date.now()}-${Math.random()}`) : undefined);
    
    return request<T>(url, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      idempotencyKey,
    });
  },
  put: <T>(url: string, body?: any) => request<T>(url, { method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T>(url: string) => request<T>(url, { method: 'DELETE' }),
};
