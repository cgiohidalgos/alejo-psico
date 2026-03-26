export const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export const httpRequest = async (path: string, options: RequestInit = {}) => {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  const resp = await fetch(url, options);
  const text = await resp.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!resp.ok) {
    const error = data?.error || resp.statusText;
    throw new Error(error);
  }
  return data;
};

export const withAuth = (token: string | null, options: RequestInit = {}) => {
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return { ...options, headers };
};
