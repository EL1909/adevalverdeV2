import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Loader2, ShoppingBag } from 'lucide-react';
import { fetchStoreProducts, type StoreProduct } from '../api/store';
import { useBusiness } from '../context/BusinessContext';
import { useCart } from '../context/CartContext';
import { Editable } from '../components/Editable';
import { formatMoney } from '../lib/money';

export const Store: React.FC = () => {
  const { business } = useBusiness();
  const { items, add } = useCart();
  const [products, setProducts] = useState<StoreProduct[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStoreProducts().then(setProducts).catch(e => setError(e.message));
  }, []);

  const inCart = (id: number) => items.some(i => i.product_id === id);

  return (
    <section className="max-w-6xl mx-auto px-4 py-16">
      <div className="flex items-end justify-between mb-10">
        <Editable k="store.intro.title" as="h1" className="text-4xl">Tienda</Editable>
        <Link to="/planes" className="text-sm text-gold hover:text-gold-light">Ver planes de suscripción</Link>
      </div>
      {error && <p className="text-red-300">{error}</p>}
      {!products && !error && <Loader2 className="animate-spin text-gold" />}
      {products && products.length === 0 && <p className="text-mist">Aún no hay productos publicados.</p>}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {products?.map(p => (
          <article key={p.id} className="glass rounded-3xl overflow-hidden flex flex-col">
            {p.image && <img src={p.image} alt="" className="aspect-[4/3] object-cover" />}
            <div className="p-6 flex-1 flex flex-col gap-3">
              <p className="text-xs uppercase tracking-widest text-mist">{p.category_name}{p.is_digital && ' · PDF'}</p>
              <h3 className="text-xl text-gold">{p.name}</h3>
              <p className="text-sm text-mist flex-1 line-clamp-4 whitespace-pre-line">{p.description}</p>
              <div className="flex items-center justify-between gap-3 pt-2">
                <span className="text-bone font-semibold">
                  {Number(p.price) === 0 ? 'Gratis' : formatMoney(p.price, business.currency || 'USD')}
                </span>
              </div>
              <button
                onClick={() => add({ product_id: p.id, name: p.name, price: p.price, image: p.image, is_digital: p.is_digital })}
                disabled={p.is_digital && inCart(p.id)}
                className="mt-2 flex items-center justify-center gap-2 border border-gold/60 text-gold rounded-full py-2.5 text-sm hover:bg-gold hover:text-ink transition-colors disabled:opacity-60 disabled:hover:bg-transparent disabled:hover:text-gold"
              >
                {inCart(p.id) ? <><Check size={16} /> En tu carrito</> : <><ShoppingBag size={16} /> Añadir al carrito</>}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};
