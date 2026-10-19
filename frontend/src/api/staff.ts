// Panel de Adela (/cuenta → Tienda, Calendario). Todo exige staff; el
// backend lo comprueba en cada llamada.
import type { ManualMethod } from './payments';
import type { Order, StoreProduct } from './store';

/** Error de la API con el status y el cuerpo (p. ej. `can_force` en un 409 de la cita manual). */
export class ApiError extends Error {
  constructor(message: string, public status: number, public data: Record<string, unknown> = {}) {
    super(message);
  }
}

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
    throw new ApiError(data.error || data.detail || fieldErrors.join(' · ') || `Error ${res.status}`, res.status, data);
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
export const renameCategory = (t: string, id: number, name: string) =>
  call<Category>(t, `/api/store/categories/${id}/`, { method: 'PATCH', body: json({ name }) });
/** El backend responde 409 si la categoría aún tiene productos. */
export const deleteCategory = (t: string, id: number) =>
  call<void>(t, `/api/store/categories/${id}/`, { method: 'DELETE' });

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
    client_id?: number | null;
    client_tags?: string[];
    source?: '' | 'web' | 'staff';
    notes?: Note[];
  };
}

export interface Note { author_email: string | null; text: string; date: string }

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

// ── Cita manual ─────────────────────────────────────────────────────────────

export type ManualPaymentKind = 'courtesy' | 'paid' | 'pending';

export interface ManualOptions {
  timezone: string;
  currency: string;
  services: { id: number; name: string; price: string; minutes: number }[];
  paid_methods: { value: string; label: string }[];
  manual_methods: { id: number; name: string }[];
}

export interface ManualBookingInput {
  start: string; // "YYYY-MM-DDTHH:MM" en hora de Madrid
  end?: string;
  service?: number;
  title?: string;
  client_id?: number;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  payment: ManualPaymentKind;
  paid_method?: string;
  manual_method?: number;
  send_email: boolean;
  notes?: string;
  force?: boolean;
}

export const getManualOptions = (t: string) => call<ManualOptions>(t, '/api/calendars/appointments/manual/');
export const createManualBooking = (t: string, data: ManualBookingInput) =>
  call<{ id: number; status: string; client_id: number | null; receipt: string | null }>(
    t, '/api/calendars/appointments/manual/', { method: 'POST', body: json(data) });

// ── Clientes y leads (evz_crm) ──────────────────────────────────────────────

export const LEAD_TAG = 'Nuevo Lead';
export const CLIENT_TAG = 'Cliente';

export interface CrmClient {
  id: number;
  user: number | null;
  has_account: boolean;
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  tags: string[];
  notes: Note[];
  preferred_contact: 'whatsapp' | 'email' | 'phone';
  created_at: string;
  updated_at: string;
}

export interface ClientHistory {
  appointments: { id: number; title: string; start: string; end: string; status: string; order_id: number | null }[];
  orders: { id: number; date: string; status: string; total: string }[];
  currency: string;
}

export const listClients = (t: string, params: { search?: string; tag?: string } = {}) => {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
  return call<CrmClient[]>(t, `/api/crm/clients/${qs ? `?${qs}` : ''}`);
};
export const getClient = (t: string, id: number) => call<CrmClient>(t, `/api/crm/clients/${id}/`);
export const updateClient = (t: string, id: number, data: Partial<Pick<CrmClient, 'name' | 'email' | 'phone' | 'city' | 'address' | 'tags' | 'preferred_contact'>>) =>
  call<CrmClient>(t, `/api/crm/clients/${id}/`, { method: 'PATCH', body: json(data) });
export const addClientNote = (t: string, id: number, text: string) =>
  call<CrmClient>(t, `/api/crm/clients/${id}/message/`, { method: 'POST', body: json({ text }) });
export const promoteClient = (t: string, id: number) =>
  call<CrmClient>(t, `/api/crm/clients/${id}/promote/`, { method: 'POST' });
export const clientHistory = (t: string, id: number) => call<ClientHistory>(t, `/api/crm/clients/${id}/history/`);
export const addAppointmentNote = (t: string, id: number, text: string) =>
  call<unknown>(t, `/api/calendars/appointments/${id}/message/`, { method: 'POST', body: json({ text }) });
