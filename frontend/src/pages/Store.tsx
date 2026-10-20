import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, Loader2, ShoppingBag } from 'lucide-react';
import { categoryLabel, categorySlug, type StoreProduct } from '../api/store';
import { useBusiness } from '../context/BusinessContext';
import { useCart } from '../context/CartContext';
import { useCatalog } from '../context/CatalogContext';
import { Editable } from '../components/Editable';
import { formatMoney } from '../lib/money';
import { cn } from '../lib/utils';

/** /tienda?categoria=<slug> muestra una categoría; sin ella, todo agrupado por categoría. */
export const Store: React.FC = () => {
  const { business } = useBusiness();
  const { items, add } = useCart();
  const { categories, products, menu, error } = useCatalog();
  const [params] = useSearchParams();

  const slug = params.get('categoria');
  const selected = slug ? categories.find(c => categorySlug(c) === slug) : undefined;
  const inCart = (id: number) => items.some(i => i.product_id === id);
  const labelOf = (p: StoreProduct) => {
    const c = categories.find(x => x.id === p.category);
    return c ? categoryLabel(c) : p.category_name;
  };

  // Grupos en el orden de las categorías (position); solo los que tienen productos.
  const groups = (products ? categories : [])
    .filter(c => !selected || c.id === selected.id)
    .map(c => ({ category: c, items: products!.filter(p => p.category === c.id) }))
    .filter(g => g.items.length > 0);

  const card = (p: StoreProduct) => (
    <article key={p.id} className="glass rounded-3xl overflow-hidden flex flex-col">
      {p.image && <img src={p.image} alt="" className="aspect-[4/3] object-cover" />}
      <div className="p-6 flex-1 flex flex-col gap-3">
        <p className="text-xs uppercase tracking-widest text-mist">{labelOf(p)}{p.is_digital && ' · PDF'}</p>
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
  );

  return (
    <section className="max-w-6xl mx-auto px-4 py-16">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        {selected
          ? <h1 className="text-4xl">{categoryLabel(selected)}</h1>
          : <Editable k="store.intro.title" as="h1" className="text-4xl">Tienda</Editable>}
        <Link to="/planes" className="text-sm text-gold hover:text-gold-light">Ver planes de suscripción</Link>
      </div>
      {selected?.description && <p className="text-mist whitespace-pre-line max-w-3xl mb-6">{selected.description}</p>}
      {menu.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-10">
          {menu.map(c => (
            <Link key={c.id} to={`/tienda?categoria=${categorySlug(c)}`}
              className={cn('px-4 py-2 rounded-full text-sm border transition-colors',
                selected?.id === c.id ? 'border-gold text-gold' : 'border-white/15 text-mist hover:border-gold/50')}>
              {categoryLabel(c)}
            </Link>
          ))}
        </div>
      )}
      {error && <p className="text-red-300">{error}</p>}
      {!products && !error && <Loader2 className="animate-spin text-gold" />}
      {slug && !selected && categories.length > 0 && <p className="text-mist mb-6">Esa categoría no existe; te mostramos toda la tienda.</p>}
      {products && groups.length === 0 && <p className="text-mist">Aún no hay productos publicados.</p>}
      <div className="space-y-14">
        {groups.map(g => (
          <div key={g.category.id}>
            {!selected && <h2 className="text-2xl text-gold mb-6">{categoryLabel(g.category)}</h2>}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {g.items.map(card)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
