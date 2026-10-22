import type { CheckoutResult, PaymentChoice } from './payments';

const API_BASE = '/api/bookings';

const headers = (token?: string | null): HeadersInit => ({
  'Content-Type': 'application/json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.detail || `Error ${res.status}`);
  return data as T;
}

export interface Service {
  id: number;
  name: string;
  description: string;
  price: string;
  currency: string;
  duration: string;
  minutes: number;
  image: string | null;
  /** Con precio, pero gratis (una vez) para quien ya compró un libro: ver fetchFreeCheck. */
  free_with_purchase: boolean;
}

/** ¿La sesión sale gratis por una compra? `purchases` (los libros) solo con sesión iniciada. */
export interface FreeCheck { free: boolean; has_purchase: boolean; used: boolean; purchases?: string[] }

export interface Slot { start: string; end: string; label: string }

export interface DaySlots { date: string; closed: boolean; slot_minutes: number; timezone?: string; slots: Slot[] }

export interface Booking {
  id: number;
  service: string;
  start: string;
  end: string;
  timezone: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  customer_name: string;
  paid: boolean;
  total: string;
  receipt: string | null;
  can_cancel: boolean;
}

export interface BookingPayload {
  service: number;
  start: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  message?: string;
  method?: PaymentChoice;
}

export const fetchServices = () => call<Service[]>('/services/');

export const fetchDays = (service: number) =>
  call<{ timezone: string; days: string[] }>(`/days/?service=${service}`);

export const fetchSlots = (service: number, date: string) =>
  call<DaySlots>(`/slots/?service=${service}&date=${date}`);

export const fetchFreeCheck = (service: number, email: string, token?: string | null) =>
  call<FreeCheck>(`/free-check/?service=${service}&email=${encodeURIComponent(email)}`, { headers: headers(token) });

export const createBooking = (payload: BookingPayload, token?: string | null) =>
  call<CheckoutResult>('/', { method: 'POST', headers: headers(token), body: JSON.stringify(payload) });

export const fetchMyBookings = (token: string) => call<Booking[]>('/mine/', { headers: headers(token) });

export const cancelBooking = (token: string, id: number) =>
  call<Booking>(`/${id}/cancel/`, { method: 'POST', headers: headers(token) });
