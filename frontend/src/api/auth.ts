const API_BASE = '/api/accounts';

const authHeaders = (token: string) => ({
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json',
});

export const login = async (identifier: string, password: string) => {
  const res = await fetch(`${API_BASE}/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  if (!res.ok) {
    // No asumir "credenciales incorrectas" para cualquier fallo: un 500 (ej.
    // migración pendiente en el servidor) o un error de red se veían igual
    // que una contraseña mala, lo que hacía imposible distinguir un
    // problema real de servidor de un simple typo.
    const err = await res.json().catch(() => null);
    const msg = err?.detail || err?.error || (res.status >= 500
      ? `Error del servidor (${res.status}). Intenta de nuevo en un momento.`
      : 'Credenciales incorrectas');
    throw new Error(msg);
  }
  return res.json(); // { access, refresh }
};

export const register = async (data: {
  email: string;
  phone?: string;
  password: string;
  password2: string;
  first_name: string;
  last_name: string;
}) => {
  const res = await fetch(`${API_BASE}/register/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = Object.entries(err)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join(' | ');
    throw new Error(msg || 'Error al registrarse');
  }
  return res.json(); // { user, access, refresh }
};

export const fetchProfile = async (token: string) => {
  const res = await fetch(`${API_BASE}/profile/`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Sesión expirada');
  return res.json();
};

export const requestPasswordReset = async (email: string) => {
  const res = await fetch(`${API_BASE}/password-reset/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error('Error al enviar el email');
  return res.json();
};

export const confirmPasswordReset = async (uid: string, token: string, new_password1: string, new_password2: string) => {
  const res = await fetch(`${API_BASE}/password-reset/confirm/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid, token, new_password1, new_password2 }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Error al restablecer la contraseña');
  }
  return res.json();
};

export const updateProfile = async (token: string, data: FormData | object) => {
  const isFormData = data instanceof FormData;
  const res = await fetch(`${API_BASE}/profile/`, {
    method: 'PATCH',
    headers: isFormData
      ? { 'Authorization': `Bearer ${token}` }
      : authHeaders(token),
    body: isFormData ? data : JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Error al actualizar perfil');
  return res.json();
};
