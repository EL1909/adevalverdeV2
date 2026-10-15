import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Minus, Plus, Trash2 } from 'lucide-react';
import { checkout, fetchPaymentsConfig, type PaymentsConfig } from '../api/payments';
import { PaymentOptions } from '../components/PaymentOptions';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { formatMoney } from '../lib/money';

export const Cart: React.FC = () => {
  const { items, total, setQuantity, remove, clear } = useCart();
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [config, setConfig] = useState<PaymentsConfig | null>(null);
  const [guest, setGuest] = useState({ name: '', email: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const currency = config?.currency || 'USD';
  const guestReady = !!user || /\S+@\S+\.\S+/.test(guest.email);
  const isFree = items.length > 0 && total === 0;

  useEffect(() => {
    fetchPaymentsConfig().then(setConfig).catch(() => setError('No pudimos cargar los medios de pago.'));
  }, []);

  const payload = () => ({
    items: items.map(i => ({ product_id: i.product_id, quantity: i.quantity })),
    customer_name: guest.name,
    customer_email: guest.email,
  });

  const finish = (receipt: string) => {
    clear();
    navigate(`/pedido/${receipt}`);
  };

  const freeCheckout = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await checkout(payload(), token);
      finish(res.receipt);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (items.length === 0) {
    return (
      <section className="max-w-3xl mx-auto px-4 py-16 space-y-4">
        <h1 className="text-4xl">Tu carrito</h1>
        <p className="text-mist">Está vacío. <Link to="/tienda" className="text-gold">Ir a la tienda</Link></p>
      </section>
    );
  }

  const inputClass = 'w-full p-3 rounded-xl border border-white/15 focus:outline-none focus:border-gold bg-black/40 text-bone placeholder:text-mist/60';

  return (
    <section className="max-w-3xl mx-auto px-4 py-16 space-y-8">
      <h1 className="text-4xl">Tu carrito</h1>

      <ul className="glass rounded-3xl divide-y divide-white/10">
        {items.map(i => (
          <li key={i.product_id} className="p-4 flex items-center gap-4">
            {i.image && <img src={i.image} alt="" className="w-16 h-16 rounded-xl object-cover" />}
            <div className="flex-1 min-w-0">
              <p className="truncate">{i.name}</p>
              <p className="text-sm text-mist">{formatMoney(i.price, currency)}</p>
            </div>
            {!i.is_digital && (
              <div className="flex items-center gap-2">
                <button onClick={() => setQuantity(i.product_id, i.quantity - 1)} className="p-1 text-mist hover:text-gold" aria-label="Menos"><Minus size={16} /></button>
                <span className="w-6 text-center">{i.quantity}</span>
                <button onClick={() => setQuantity(i.product_id, i.quantity + 1)} className="p-1 text-mist hover:text-gold" aria-label="Más"><Plus size={16} /></button>
              </div>
            )}
            <button onClick={() => remove(i.product_id)} className="p-2 text-mist hover:text-red-300" aria-label="Quitar"><Trash2 size={16} /></button>
          </li>
        ))}
        <li className="p-4 flex justify-between text-lg">
          <span>Total</span>
          <span className="text-gold">{formatMoney(total, currency)}</span>
        </li>
      </ul>

      {!user && (
        <div className="glass rounded-3xl p-6 space-y-3">
          <p className="text-sm text-mist">Compra sin cuenta: te enviaremos el pedido y las descargas a este correo.</p>
          <input className={inputClass} placeholder="Tu nombre" value={guest.name} onChange={e => setGuest(g => ({ ...g, name: e.target.value }))} />
          <input className={inputClass} type="email" placeholder="Tu correo electrónico" value={guest.email} onChange={e => setGuest(g => ({ ...g, email: e.target.value }))} />
        </div>
      )}

      {error && <p className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-sm text-red-200">{error}</p>}
      {busy && <p className="flex items-center gap-2 text-mist"><Loader2 className="animate-spin" size={16} /> Confirmando tu pedido…</p>}

      {isFree ? (
        <button onClick={freeCheckout} disabled={busy || !guestReady} className="w-full bg-gold text-ink py-4 rounded-full font-semibold disabled:opacity-50">
          Confirmar pedido
        </button>
      ) : !guestReady ? (
        <p className="text-sm text-mist">Escribe tu correo para continuar con el pago.</p>
      ) : !config ? null : (
        <PaymentOptions
          config={config}
          start={method => { setError(null); return checkout({ ...payload(), method }, token); }}
          onDone={finish}
          onError={setError}
          onBusy={setBusy}
        />
      )}
    </section>
  );
};
