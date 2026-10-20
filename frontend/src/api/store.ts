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
  /** Dirección de su página (/libro/<slug>); no cambia al renombrar. */
  slug: string;
  /** Adela elige qué productos tienen página propia. */
  has_page: boolean;
  /** Solo lo recibe el staff. */
  download_file?: string | null;
}

export interface Category {
  id: number;
  name: string;
  /** Lo que ve el público; vacío = `name`. */
  display_name: string;
  description: string;
  /** Adela elige qué categorías van en «El Umbral». */
  show_in_menu: boolean;
  position: number;
}

export const categoryLabel = (c: Category) => c.display_name || c.name;

/** `?categoria=` legible y estable: sale de `name`, no del nombre visible. */
export const categorySlug = (c: Category) =>
  c.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

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

/** La página propia de un producto; null si no existe, no está publicado o no tiene página. */
export const fetchProductPage = async (slug: string) => {
  const rows = await get<StoreProduct[]>(`/products/?slug=${encodeURIComponent(slug)}&has_page=1`, null, 'Error al cargar el producto');
  return rows[0] ?? null;
};

export const productPath = (p: Pick<StoreProduct, 'slug'>) => `/libro/${p.slug}`;

/** Todos los productos publicados (incluye asesorías): el selector de destinos del staff. */
export const fetchProducts = () => get<StoreProduct[]>('/products/', null, 'Error al cargar los productos');

/** Un producto publicado por su slug, tenga o no página propia. */
export const fetchProductBySlug = async (slug: string) =>
  (await get<StoreProduct[]>(`/products/?slug=${encodeURIComponent(slug)}`, null, 'Error al cargar el producto'))[0] ?? null;

/**
 * Adónde lleva un botón que apunta a un producto: una asesoría se reserva
 * (Asesorías con la sesión elegida); lo demás, a su página. Sin página: null.
 */
export const productDestination = (p: StoreProduct) =>
  p.duration ? `/asesorias?sesion=${encodeURIComponent(p.name)}` : p.has_page ? productPath(p) : null;

/** Ordenadas por `position` (el backend ya las devuelve así). */
export const fetchCategories = () => get<Category[]>('/categories/', null, 'Error al cargar las categorías');

export const fetchMyOrders = (token: string) => get<Order[]>('/orders/mine/', token, 'Error al cargar tus pedidos');

export const fetchMyDownloads = (token: string) => get<DownloadInfo[]>('/downloads/mine/', token, 'Error al cargar tus descargas');

export const verifyDownload = (token: string) => get<DownloadInfo>(`/downloads/${token}/`, null, 'Código de verificación no válido.');

export const downloadFileUrl = (token: string) => `${API_BASE}/downloads/${token}/file/`;

export const fetchPlans = () => get<Plan[]>('/plans/', null, 'Error al cargar los planes');

export const fetchMySubscriptions = (token: string) => get<Subscription[]>('/subscriptions/mine/', token, 'Error al cargar tus suscripciones');

export const fetchAccess = (token?: string | null) => get<{ grants: string[] }>('/access/', token);
