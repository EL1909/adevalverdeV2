// Panel de Adela (/cuenta → Tienda, Calendario). Todo exige staff; el
// backend lo comprueba en cada llamada.
import type { ManualMethod } from './payments';
import type { Order, StoreProduct } from './store';

async function call<T>(token: string, url: string, init: RequestInit = {}): Promise<T> {
  const isForm = init.body instanceof FormData;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body && !isForm ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const fieldErrors = typeof data === 'object' && data
      ? Object.entries(data).filter(([k]) => k !== 'error' && k !== 'detail').map(([k, v]) => `${k}: ${([] as string[]).concat(v as string).join(' ')}`)
      : [];
    throw new Error(data.error || data.detail || fieldErrors.join(' · ') || `Error ${res.status}`);
  }
  return data as T;
}

const json = (body: unknown) => JSON.stringify(body);

// ── Tienda ──────────────────────────────────────────────────────────────────

export interface Category { id: number; name: string }

export const listProducts = (t: string) => call<StoreProduct[]>(t, '/api/store/products/');
export const listCategories = (t: string) => call<Category[]>(t, '/api/store/categories/');
export const createCategory = (t: string, name: string) =>
  call<Category>(t, '/api/store/categories/', { method: 'POST', body: json({ name }) });

/** Alta o edición; FormData porque lleva imagen y archivo descargable. */
export const saveProduct = (t: string, data: FormData, id?: number) =>
  call<StoreProduct>(t, id ? `/api/store/products/${id}/` : '/api/store/products/', { method: id ? 'PATCH' : 'POST', body: data });

export const listOrders = (t: string) => call<Order[]>(t, '/api/store/orders/');
export const cancelOrder = (t: string, id: number, reason: string) =>
  call<Order>(t, `/api/store/orders/${id}/cancel/`, { method: 'POST', body: json({ reason }) });
export const addOrderNote = (t: string, id: number, text: string) =>
  call<Order>(t, `/api/store/orders/${id}/message/`, { method: 'POST', body: json({ text }) });

// ── Pagos manuales ──────────────────────────────────────────────────────────

export interface ManualPayment {
  id: number;
  status: 'pending' | 'confirmed' | 'rejected';
  method: ManualMethod;
  amount: string;
  currency: string;
  reference: string;
  has_proof: boolean;
  rejection_reason: string;
  created_at: string;
  reviewed_at: string | null;
  order: { id: number; status: string; customer_name: string; customer_email: string; total: string; items: string[] };
}

export const listManualPayments = (t: string, status = '') =>
  call<ManualPayment[]>(t, `/api/payments/manual/${status ? `?status=${status}` : ''}`);
export const confirmManualPayment = (t: string, id: number) =>
  call<ManualPayment>(t, `/api/payments/manual/${id}/confirm/`, { method: 'POST' });
export const rejectManualPayment = (t: string, id: number, reason: string) =>
  call<ManualPayment>(t, `/api/payments/manual/${id}/reject/`, { method: 'POST', body: json({ reason }) });

/** Abre el comprobante en una pestaña (vive en una carpeta privada: se pide con el token). */
export const openProof = async (t: string, id: number) => {
  const res = await fetch(`/api/payments/manual/${id}/proof/`, { headers: { Authorization: `Bearer ${t}` } });
  if (!res.ok) throw new Error('No se pudo abrir el comprobante.');
  window.open(URL.createObjectURL(await res.blob()), '_blank', 'noopener');
};

// ── Agenda ──────────────────────────────────────────────────────────────────

export interface CalendarEvent {
  id: number | string;
  title: string;
  start: string;
  end: string;
  display?: string;
  extendedProps: {
    status?: 'pending' | 'confirmed' | 'completed' | 'cancelled';
    customer_name?: string;
    customer_email?: string;
    customer_phone?: string;
    services?: string[];
    order_id?: number | null;
    notes?: { author_email: string | null; text: string; date: string }[];
  };
}

export interface WeeklySchedule {
  id: number;
  team_member: number | null;
  weekday: number;
  weekday_label: string;
  is_open: boolean;
  opens_at: string;
  closes_at: string;
}

export interface TimeBlock {
  id: number;
  start: string;
  end: string;
  reason: 'vacation' | 'holiday' | 'personal' | 'maintenance' | 'other';
  reason_label: string;
  note: string;
}

export const listCalendar = (t: string) => call<CalendarEvent[]>(t, '/api/calendars/appointments/');
export const updateAppointment = (t: string, id: number, data: { status: string }) =>
  call<unknown>(t, `/api/calendars/appointments/${id}/`, { method: 'PATCH', body: json(data) });

export const listSchedule = (t: string) => call<WeeklySchedule[]>(t, '/api/calendars/schedule/');
export const updateSchedule = (t: string, id: number, data: Partial<WeeklySchedule>) =>
  call<WeeklySchedule>(t, `/api/calendars/schedule/${id}/`, { method: 'PATCH', body: json(data) });

export const listBlocks = (t: string) => call<TimeBlock[]>(t, '/api/calendars/blocks/');
/** start/end en hora de Madrid, "YYYY-MM-DDTHH:MM": el backend los interpreta en su zona. */
export const createBlock = (t: string, data: { start: string; end: string; reason: string; note: string }) =>
  call<TimeBlock>(t, '/api/calendars/blocks/', { method: 'POST', body: json(data) });
export const deleteBlock = (t: string, id: number) =>
  call<void>(t, `/api/calendars/blocks/${id}/`, { method: 'DELETE' });
