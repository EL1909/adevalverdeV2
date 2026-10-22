const API_BASE = '/api/content';

/** Encuadre de una imagen: punto a la vista (0–100 %) y zoom (1–4). Vacío = centrada. */
export interface Framing { x: number; y: number; zoom: number }

export interface ContentBlock {
  key: string;
  text: string;
  image: string | null;
  framing: Framing | Record<string, never>;
  updated_at: string;
}

/** `{ image: null }` quita la imagen del bloque. */
export type ContentUpdate = { text: string } | { image: File | null } | { framing: Framing | Record<string, never> };

export type ContentMap = Record<string, ContentBlock>;

export const fetchContent = async (page: string): Promise<ContentMap> => {
  const res = await fetch(`${API_BASE}/?page=${encodeURIComponent(page)}`);
  if (!res.ok) throw new Error('No se pudo cargar el contenido');
  return res.json();
};

export const saveContent = async (
  token: string,
  key: string,
  data: ContentUpdate,
): Promise<ContentBlock> => {
  const isImage = 'image' in data && data.image instanceof File;
  let body: FormData | string;
  if (isImage) {
    body = new FormData();
    body.append('image', (data as { image: File }).image);
  } else {
    body = JSON.stringify(data);
  }
  const res = await fetch(`${API_BASE}/${key}/`, {
    method: 'PUT',
    headers: isImage
      ? { Authorization: `Bearer ${token}` }
      : { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = Object.values(err).flat().join(' ');
    throw new Error(msg || `Error ${res.status} al guardar`);
  }
  return res.json();
};
