import type { Booking } from './bookings';
import type { Subscription } from './store';

// Cobros (evz_payments): PayPal y pagos manuales verificados por Adela.
const API_BASE = '/api/payments';

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

/** Método de pago manual (Zelle, transferencia, USDT) con los datos para pagar. */
export interface ManualMethod {
  id: number;
  kind: 'zelle' | 'bank' | 'crypto';
  name: string;
  details: { label: string; value: string }[];
  instructions: string;
}

export interface PaymentsConfig {
  paypal_client_id: string;
  paypal_enabled: boolean;
  currency: string;
  manual_methods: ManualMethod[];
}

/** 'paypal' o el ID de un método manual. */
export type PaymentChoice = 'paypal' | number;

export interface CheckoutPayload {
  items: { product_id: number; quantity: number }[];
  customer_name?: string;
  customer_email?: string;
  method?: PaymentChoice;
}

export interface CheckoutResult {
  receipt: string;
  paypal_order_id?: string;
  status?: string;
  manual?: ManualMethod;
}

export interface PaymentState {
  method: string;
  manual: ManualMethod | null;
  manual_payment: {
    status: 'pending' | 'confirmed' | 'rejected';
    reference: string;
    rejection_reason: string;
    created_at: string;
  } | null;
}

export interface Receipt {
  id: number;
  status: string;
  customer_name: string;
  customer_email: string;
  created_at: string;
  total: string;
  currency: string;
  items: { description: string; quantity: string; subtotal: string }[];
  downloads: { token: string; name: string; available: boolean }[];
  payment: PaymentState;
  booking: Booking | null;
}

export const fetchPaymentsConfig = () => call<PaymentsConfig>('/config/');

export const checkout = (payload: CheckoutPayload, token?: string | null) =>
  call<CheckoutResult>('/checkout/', { method: 'POST', headers: headers(token), body: JSON.stringify(payload) });

export const captureCheckout = (receipt: string) =>
  call<{ receipt: string; status: string }>(`/checkout/${receipt}/capture/`, { method: 'POST', headers: headers() });

/** El cliente declara su pago manual; el comprobante es opcional. */
export const submitManualPayment = (receipt: string, reference: string, proof?: File | null) => {
  const body = new FormData();
  body.append('reference', reference);
  if (proof) body.append('proof', proof);
  return call<PaymentState>(`/checkout/${receipt}/manual/`, { method: 'POST', body });
};

export const fetchReceipt = (receipt: string) => call<Receipt>(`/receipt/${receipt}/`);

export const startSubscription = (token: string, plan: number) =>
  call<{ id: number; approve_url: string }>('/subscriptions/', {
    method: 'POST', headers: headers(token), body: JSON.stringify({ plan }),
  });

export const syncSubscription = (token: string, id: number) =>
  call<Subscription>(`/subscriptions/${id}/sync/`, { method: 'POST', headers: headers(token) });

export const cancelSubscription = (token: string, id: number) =>
  call<Subscription>(`/subscriptions/${id}/cancel/`, { method: 'POST', headers: headers(token) });
