export interface ContactPayload {
  name: string;
  email: string;
  phone: string;
  message: string;
  /** De qué trata (ej. «Escuela del Silencio»): va al aviso y a la nota de la ficha. */
  topic: string;
  /** Trampa para bots: el formulario no la muestra y siempre va vacía. */
  website: string;
}

/** Consulta pública: llega a Adela como ficha en Clientes («Consulta pendiente») y aviso push. */
export async function sendContact(payload: ContactPayload, token?: string | null) {
  const res = await fetch('/api/crm/contact/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 429) throw new Error('Has enviado varios mensajes seguidos. Inténtalo de nuevo más tarde.');
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
}
