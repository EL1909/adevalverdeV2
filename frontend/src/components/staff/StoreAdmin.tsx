import React, { useEffect, useMemo, useState } from 'react';
import { Check, FileText, Loader2, Pencil, Plus, X } from 'lucide-react';
import {
  addOrderNote, cancelOrder, confirmManualPayment, createCategory, listCategories, listManualPayments, listOrders,
  listProducts, openProof, rejectManualPayment, saveProduct, type Category, type ManualPayment,
} from '../../api/staff';
import type { Order, StoreProduct } from '../../api/store';
import { useAuth } from '../../context/AuthContext';
import { formatMoney } from '../../lib/money';
import { cn } from '../../lib/utils';

export const inputClass = 'w-full p-3 rounded-xl border border-white/15 focus:outline-none focus:border-gold bg-black/40 text-bone placeholder:text-mist/60';
const when = (iso: string) => new Date(iso).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Madrid' });

export const SubTabs: React.FC<{ tabs: { id: string; label: string; badge?: number }[]; value: string; onChange: (id: string) => void }> = ({ tabs, value, onChange }) => (
  <div className="flex flex-wrap gap-2">
    {tabs.map(t => (
      <button key={t.id} onClick={() => onChange(t.id)}
        className={cn('px-4 py-2 rounded-full text-sm border', value === t.id ? 'border-gold text-gold' : 'border-white/15 text-mist hover:border-gold/50')}>
        {t.label}
        {!!t.badge && <span className="ml-2 px-2 rounded-full bg-gold text-ink text-xs">{t.badge}</span>}
      </button>
    ))}
  </div>
);

export const ErrorBox: React.FC<{ error: string | null }> = ({ error }) =>
  error ? <p className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-sm text-red-200">{error}</p> : null;

// ── Pagos por verificar ─────────────────────────────────────────────────────

const PaymentsReview: React.FC<{ onChange: () => void }> = ({ onChange }) => {
  const { token } = useAuth();
  const [payments, setPayments] = useState<ManualPayment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = () => token && listManualPayments(token, 'pending').then(setPayments).catch(e => setError(e.message));
  useEffect(() => { load(); }, [token]);

  const act = async (p: ManualPayment, action: 'confirm' | 'reject') => {
    if (!token) return;
    let reason = '';
    if (action === 'reject') {
      reason = prompt('Motivo del rechazo (se envía al cliente):', 'No encontramos el pago con esa referencia.') ?? '';
      if (!reason) return;
    } else if (!confirm(`¿Confirmas que recibiste ${formatMoney(p.amount, p.currency)} de ${p.order.customer_name}?`)) {
      return;
    }
    setBusy(p.id); setError(null);
    try {
      await (action === 'confirm' ? confirmManualPayment(token, p.id) : rejectManualPayment(token, p.id, reason));
      await load();
      onChange();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  if (!payments) return <Loader2 className="animate-spin text-gold" />;
  return (
    <div className="space-y-3">
      <ErrorBox error={error} />
      {payments.length === 0 && <p className="text-sm text-mist">No hay pagos por verificar.</p>}
      {payments.map(p => (
        <div key={p.id} className="glass rounded-2xl p-4 space-y-2">
          <div className="flex flex-wrap justify-between gap-2">
            <p><span className="text-gold">{formatMoney(p.amount, p.currency)}</span> · {p.method.name} · pedido #{p.order.id}</p>
            <p className="text-xs text-mist">{when(p.created_at)}</p>
          </div>
          <p className="text-sm">{p.order.customer_name} · <span className="text-mist">{p.order.customer_email}</span></p>
          <p className="text-sm text-mist">{p.order.items.join(', ')}</p>
          <p className="text-sm">Referencia: <span className="font-mono break-all">{p.reference}</span></p>
          <div className="flex flex-wrap gap-2 pt-1">
            {p.has_proof && (
              <button onClick={() => token && openProof(token, p.id).catch(e => setError(e.message))}
                className="px-3 py-2 rounded-full border border-white/15 text-sm flex items-center gap-1 hover:border-gold/60">
                <FileText size={14} /> Comprobante
              </button>
            )}
            <button disabled={busy === p.id} onClick={() => act(p, 'confirm')}
              className="px-4 py-2 rounded-full bg-gold text-ink text-sm font-semibold flex items-center gap-1 disabled:opacity-50">
              <Check size={14} /> Confirmar pago
            </button>
            <button disabled={busy === p.id} onClick={() => act(p, 'reject')}
              className="px-4 py-2 rounded-full border border-red-400/50 text-red-200 text-sm flex items-center gap-1 disabled:opacity-50">
              <X size={14} /> Rechazar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Pedidos ─────────────────────────────────────────────────────────────────

const ORDER_STATUS: Record<string, string> = {
  pending: 'Pendiente', confirmed: 'Confirmado', completed: 'Pagado', cancelled: 'Cancelado',
};

const Orders: React.FC = () => {
  const { token } = useAuth();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [filter, setFilter] = useState('completed');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (token) listOrders(token).then(setOrders).catch(e => setError(e.message)); }, [token]);

  const shown = useMemo(() => (orders ?? []).filter(o =>
    (!filter || o.status === filter)
    && (!query || `${o.id} ${o.customer_name} ${o.customer_email}`.toLowerCase().includes(query.toLowerCase())),
  ), [orders, filter, query]);

  const replace = (o: Order) => setOrders(prev => prev?.map(x => (x.id === o.id ? o : x)) ?? null);

  const cancel = async (o: Order) => {
    const reason = prompt(`Cancelar el pedido #${o.id}. Motivo (queda en las notas):`);
    if (reason === null || !token) return;
    try { replace(await cancelOrder(token, o.id, reason)); } catch (e: any) { setError(e.message); }
  };

  const addNote = async (o: Order) => {
    if (!token || !note.trim()) return;
    try { replace(await addOrderNote(token, o.id, note.trim())); setNote(''); } catch (e: any) { setError(e.message); }
  };

  if (!orders) return <Loader2 className="animate-spin text-gold" />;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <select value={filter} onChange={e => setFilter(e.target.value)} className={cn(inputClass, 'w-auto')}>
          <option value="">Todos</option>
          {Object.entries(ORDER_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por nombre, email o número"
          className={cn(inputClass, 'flex-1 min-w-[12rem]')} />
      </div>
      <ErrorBox error={error} />
      {shown.length === 0 && <p className="text-sm text-mist">No hay pedidos con ese filtro.</p>}
      <ul className="glass rounded-2xl divide-y divide-white/10">
        {shown.map(o => (
          <li key={o.id} className="p-4 space-y-2">
            <button onClick={() => setOpen(open === o.id ? null : o.id)} className="w-full flex flex-wrap justify-between gap-2 text-left">
              <span>#{o.id} · {o.customer_name} <span className="text-mist text-sm">{o.customer_email}</span></span>
              <span className="text-sm">
                <span className="text-gold">{formatMoney(o.total)}</span>
                <span className="text-mist"> · {ORDER_STATUS[o.status] ?? o.status} · {new Date(o.created_at).toLocaleDateString('es-ES')}</span>
              </span>
            </button>
            {open === o.id && (
              <div className="space-y-3 pt-2 text-sm">
                <ul className="text-mist">
                  {o.items.map(i => <li key={i.id}>{Number(i.quantity)} × {i.product_name ?? 'Producto'} — {formatMoney(i.subtotal)}</li>)}
                </ul>
                <p className="text-mist">Pago: {o.payment_method || '—'}{o.payment_reference && ` · ${o.payment_reference}`}</p>
                {o.notes.length > 0 && (
                  <ul className="space-y-1">
                    {o.notes.map((n, i) => (
                      <li key={i} className="text-mist"><span className="text-xs">{when(n.date)} · {n.author_email ?? 'sistema'}</span><br />{n.text}</li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-2">
                  <input value={note} onChange={e => setNote(e.target.value)} placeholder="Añadir nota interna" className={inputClass} />
                  <button onClick={() => addNote(o)} className="px-4 rounded-xl border border-white/15 hover:border-gold/60">Añadir</button>
                </div>
                {o.status !== 'cancelled' && (
                  <button onClick={() => cancel(o)} className="text-red-200 hover:text-red-100">Cancelar pedido</button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

// ── Productos ───────────────────────────────────────────────────────────────

const ProductForm: React.FC<{
  product: StoreProduct | null;
  categories: Category[];
  onCategory: (c: Category) => void;
  onSaved: (p: StoreProduct) => void;
  onClose: () => void;
}> = ({ product, categories, onCategory, onSaved, onClose }) => {
  const { token } = useAuth();
  const [form, setForm] = useState({
    name: product?.name ?? '',
    description: product?.description ?? '',
    price: product?.price ?? '',
    category: String(product?.category ?? categories[0]?.id ?? ''),
    duration: product?.duration ?? '',
    is_active: product?.is_active ?? true,
    is_digital: product?.is_digital ?? false,
    requires_shipping: product?.requires_shipping ?? false,
  });
  const [image, setImage] = useState<File | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));

  const newCategory = async () => {
    const name = prompt('Nombre de la categoría nueva:');
    if (!name || !token) return;
    try {
      const c = await createCategory(token, name);
      onCategory(c);
      set('category', String(c.id));
    } catch (e: any) { setError(e.message); }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const data = new FormData();
    Object.entries(form).forEach(([k, v]) => data.append(k, String(v)));
    if (image) data.append('image', image);
    if (file) data.append('download_file', file);
    setBusy(true); setError(null);
    try {
      onSaved(await saveProduct(token, data, product?.id));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="glass rounded-2xl p-5 space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-lg text-gold">{product ? `Editar «${product.name}»` : 'Nuevo producto'}</h3>
        <button type="button" onClick={onClose} className="p-2 text-mist hover:text-gold" aria-label="Cerrar"><X size={18} /></button>
      </div>
      <input required className={inputClass} placeholder="Nombre" value={form.name} onChange={e => set('name', e.target.value)} />
      <textarea className={inputClass} rows={5} placeholder="Descripción" value={form.description} onChange={e => set('description', e.target.value)} />
      <div className="grid sm:grid-cols-3 gap-3">
        <label className="text-sm text-mist">Precio (USD)
          <input required type="number" min="0" step="0.01" className={inputClass} value={form.price} onChange={e => set('price', e.target.value)} />
        </label>
        <label className="text-sm text-mist">Categoría
          <div className="flex gap-2">
            <select className={inputClass} value={form.category} onChange={e => set('category', e.target.value)}>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button type="button" onClick={newCategory} className="px-3 rounded-xl border border-white/15" aria-label="Nueva categoría"><Plus size={16} /></button>
          </div>
        </label>
        <label className="text-sm text-mist">Duración (asesorías)
          <input className={inputClass} placeholder="Ej. 90 min" value={form.duration} onChange={e => set('duration', e.target.value)} />
        </label>
      </div>
      <p className="text-xs text-mist">Con duración, el producto es una asesoría: se reserva en Asesorías, no se vende en la tienda.</p>
      <label className="block text-sm text-mist">Imagen {product?.image && '(deja vacío para conservar la actual)'}
        <input type="file" accept="image/*" className="block mt-1" onChange={e => setImage(e.target.files?.[0] ?? null)} />
      </label>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} /> Publicado</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_digital} onChange={e => set('is_digital', e.target.checked)} /> Digital (se descarga)</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.requires_shipping} onChange={e => set('requires_shipping', e.target.checked)} /> Requiere envío</label>
      </div>
      {form.is_digital && (
        <label className="block text-sm text-mist">Archivo que recibe el cliente (PDF){product?.has_download && ' — ya tiene uno; sube otro para reemplazarlo'}
          <input type="file" accept="application/pdf" className="block mt-1" onChange={e => setFile(e.target.files?.[0] ?? null)} />
        </label>
      )}
      <ErrorBox error={error} />
      <button disabled={busy} className="w-full bg-gold text-ink py-3 rounded-full font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
        {busy && <Loader2 size={16} className="animate-spin" />} Guardar
      </button>
    </form>
  );
};

const Products: React.FC = () => {
  const { token } = useAuth();
  const [products, setProducts] = useState<StoreProduct[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editing, setEditing] = useState<StoreProduct | null | 'new'>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    listProducts(token).then(setProducts).catch(e => setError(e.message));
    listCategories(token).then(setCategories).catch(e => setError(e.message));
  }, [token]);

  const saved = (p: StoreProduct) => {
    setProducts(prev => (prev?.some(x => x.id === p.id) ? prev.map(x => (x.id === p.id ? p : x)) : [p, ...(prev ?? [])]));
    setEditing(null);
  };

  if (!products) return <Loader2 className="animate-spin text-gold" />;
  return (
    <div className="space-y-3">
      <ErrorBox error={error} />
      {editing ? (
        <ProductForm product={editing === 'new' ? null : editing} categories={categories}
          onCategory={c => setCategories(cs => [...cs, c])} onSaved={saved} onClose={() => setEditing(null)} />
      ) : (
        <button onClick={() => setEditing('new')} className="px-4 py-2 rounded-full bg-gold text-ink text-sm font-semibold flex items-center gap-1">
          <Plus size={14} /> Nuevo producto
        </button>
      )}
      <ul className="glass rounded-2xl divide-y divide-white/10">
        {products.map(p => (
          <li key={p.id} className="p-3 flex items-center gap-3">
            {p.image ? <img src={p.image} alt="" className="w-12 h-12 rounded-lg object-cover" /> : <div className="w-12 h-12 rounded-lg bg-white/5" />}
            <div className="flex-1 min-w-0">
              <p className={cn('truncate', !p.is_active && 'text-mist line-through')}>{p.name}</p>
              <p className="text-xs text-mist">
                {p.category_name} · {formatMoney(p.price)}
                {p.duration && ` · ${p.duration}`}
                {p.is_digital && (p.has_download ? ' · PDF' : ' · ⚠ falta el archivo')}
              </p>
            </div>
            <button onClick={() => setEditing(p)} className="p-2 text-mist hover:text-gold" aria-label={`Editar ${p.name}`}><Pencil size={16} /></button>
          </li>
        ))}
      </ul>
    </div>
  );
};

// ── Pestaña ─────────────────────────────────────────────────────────────────

export const StoreAdmin: React.FC = () => {
  const { token } = useAuth();
  const [tab, setTab] = useState('payments');
  const [pending, setPending] = useState(0);
  const refreshPending = () => { if (token) listManualPayments(token, 'pending').then(p => setPending(p.length)).catch(() => undefined); };
  useEffect(refreshPending, [token]);

  return (
    <div className="space-y-4">
      <SubTabs value={tab} onChange={setTab} tabs={[
        { id: 'payments', label: 'Pagos por verificar', badge: pending },
        { id: 'orders', label: 'Pedidos' },
        { id: 'products', label: 'Productos' },
      ]} />
      {tab === 'payments' && <PaymentsReview onChange={refreshPending} />}
      {tab === 'orders' && <Orders />}
      {tab === 'products' && <Products />}
    </div>
  );
};
