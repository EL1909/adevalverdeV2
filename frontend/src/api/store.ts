// Tienda (evz_store): catálogo, descargas, planes, historial del cliente y,
// para el staff, la gestión de productos y pedidos (ver api/staff.ts).
const API_BASE = '/api/store';

const authHeader = (token: string) => ({ 'Authorization': `Bearer ${token}` });

async function get<T>(path: string, token?: string | null, error = 'Error al cargar los datos'): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: token ? authHeader(token) : {} });
  if (!res.ok) throw new Error(error);
  return res.json();
}

export interface StoreProduct {
  id: number;
  name: string;
  description: string;
  price: string;
  duration: string;
  category: number;
  category_name: string;
  image: string | null;
  is_active: boolean;
  is_digital: boolean;
  requires_shipping: boolean;
  has_download: boolean;
  /** Solo lo recibe el staff. */
  download_file?: string | null;
}

export interface DownloadInfo {
  token: string;
  product: string;
  order_id: number;
  paid: boolean;
  available: boolean;
  remaining: number | null;
  downloaded_at: string | null;
  customer_name: string;
  purchased_at: string;
}

export interface Order {
  id: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  status: string;
  booking_date: string | null;
  booking_time: string | null;
  created_at: string;
  total: string;
  payment_method: string;
  payment_reference: string;
  amount_paid: string;
  balance_due: string;
  is_fully_paid: boolean;
  notes: { author_email: string | null; text: string; date: string }[];
  // Coincide con OrderItemSerializer de evz_store.
  items: { id: number; product: number | null; product_name: string | null; quantity: string; unit_price: string; subtotal: string }[];
}

export interface Plan {
  id: number;
  name: string;
  description: string;
  price: string;
  currency: string;
  interval: 'MONTH' | 'YEAR';
  grants: string[];
  /** Pasarelas en las que el plan ya existe (p. ej. ['paypal']). */
  gateways: string[];
}

export interface Subscription {
  id: number;
  plan: Plan;
  status: 'APPROVAL_PENDING' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | 'EXPIRED';
  gateway: string;
  current_period_end: string | null;
  cancelled_at: string | null;
  created_at: string;
}

/** Lo que se compra desde el carrito: sin planes ni asesorías. */
export const fetchStoreProducts = () => get<StoreProduct[]>('/products/?sellable=1', null, 'Error al cargar la tienda');

export const fetchMyOrders = (token: string) => get<Order[]>('/orders/mine/', token, 'Error al cargar tus pedidos');

export const fetchMyDownloads = (token: string) => get<DownloadInfo[]>('/downloads/mine/', token, 'Error al cargar tus descargas');

export const verifyDownload = (token: string) => get<DownloadInfo>(`/downloads/${token}/`, null, 'Código de verificación no válido.');

export const downloadFileUrl = (token: string) => `${API_BASE}/downloads/${token}/file/`;

export const fetchPlans = () => get<Plan[]>('/plans/', null, 'Error al cargar los planes');

export const fetchMySubscriptions = (token: string) => get<Subscription[]>('/subscriptions/mine/', token, 'Error al cargar tus suscripciones');

export const fetchAccess = (token?: string | null) => get<{ grants: string[] }>('/access/', token);
