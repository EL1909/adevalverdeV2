const API_BASE = '/api/content';

export interface ContentBlock {
  key: string;
  text: string;
  image: string | null;
  updated_at: string;
}

export type ContentMap = Record<string, ContentBlock>;

export const fetchContent = async (page: string): Promise<ContentMap> => {
  const res = await fetch(`${API_BASE}/?page=${encodeURIComponent(page)}`);
  if (!res.ok) throw new Error('No se pudo cargar el contenido');
  return res.json();
};

export const saveContent = async (
  token: string,
  key: string,
  data: { text: string } | { image: File },
): Promise<ContentBlock> => {
  const isImage = 'image' in data;
  let body: FormData | string;
  if (isImage) {
    body = new FormData();
    body.append('image', data.image);
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
