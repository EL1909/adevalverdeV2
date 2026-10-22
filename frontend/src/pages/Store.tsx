import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarDays, Check, Loader2, ShoppingBag } from 'lucide-react';
import { categoryLabel, categorySlug, productPath, type StoreProduct } from '../api/store';
import { useBusiness } from '../context/BusinessContext';
import { useCart } from '../context/CartContext';
import { useCatalog } from '../context/CatalogContext';
import { Editable, frameStyle, framingOf } from '../components/Editable';
import { ProductImage, ProductText } from '../components/ProductEditable';
import { useContent } from '../context/ContentContext';
import { formatMoney } from '../lib/money';
import { cn } from '../lib/utils';

/** /tienda?categoria=<slug> muestra una categoría; sin ella, todo agrupado por categoría. */
export const Store: React.FC = () => {
  const { business } = useBusiness();
  const { items, add } = useCart();
  const { categories, products, menu, error } = useCatalog();
  const { editMode } = useContent();
  const [params] = useSearchParams();
  const [openId, setOpenId] = useState<number | null>(null);

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

  const buy = 'flex items-center gap-2 bg-gold text-ink font-semibold rounded-full px-5 py-2.5 text-sm shadow-lg hover:bg-gold-light transition-colors whitespace-nowrap';
  const price = (p: StoreProduct) =>
    Number(p.price) === 0 ? 'Gratis' : formatMoney(p.price, business.currency || 'USD');

  // En modo edición la tarjeta no enlaza ni se despliega: portada, nombre y
  // descripción se editan ahí mismo y se guardan en el producto.
  const editCard = (p: StoreProduct) => (
    <article key={p.id}>
      <ProductImage product={p} framed className="w-full h-full object-cover rounded-2xl" wrapperClassName="h-[400px]" />
      <div className="pt-4 px-1 space-y-2">
        <p className="text-xs uppercase tracking-widest text-mist">{labelOf(p)}{p.is_digital && ' · PDF'}</p>
        <ProductText product={p} field="name" as="h3" className="text-lg text-gold" />
        <p className="text-bone font-semibold">{price(p)}</p>
        <ProductText product={p} field="description" className="text-sm text-mist max-h-40 overflow-y-auto" />
        {p.has_page && <Link to={productPath(p)} className="inline-block text-sm text-gold hover:text-gold-light">Ver página →</Link>}
      </div>
    </article>
  );

  // Portada (400px de alto, como en V1: las imágenes están hechas para ese
  // tamaño) + título. Con página propia la tarjeta enlaza a ella; sin página,
  // el clic despliega encima de la portada la descripción y el botón de compra.
  const card = (p: StoreProduct) => {
    if (editMode) return editCard(p);
    const open = openId === p.id;
    const cover = p.image
      ? <img src={p.image} alt={p.name} className="w-full h-full object-cover" style={frameStyle(framingOf(p.image_framing))} />
      : <div className="w-full h-full bg-white/5 flex items-center justify-center text-mist text-sm">Sin imagen</div>;
    const caption = (
      <div className="pt-4 px-1 space-y-1">
        <p className="text-xs uppercase tracking-widest text-mist">{labelOf(p)}{p.is_digital && ' · PDF'}</p>
        <h3 className="text-lg text-gold">{p.name}</h3>
        <p className="text-bone font-semibold">{price(p)}</p>
      </div>
    );

    if (p.has_page) return (
      <article key={p.id}>
        <Link to={productPath(p)} className="block">
          <div className="h-[400px] overflow-hidden rounded-2xl">{cover}</div>
          {caption}
        </Link>
      </article>
    );

    return (
      <article key={p.id}>
        <div className="relative h-[400px] overflow-hidden rounded-2xl">
          <button type="button" onClick={() => setOpenId(open ? null : p.id)} aria-expanded={open}
            className="block w-full h-full" title="Ver descripción">
            {cover}
          </button>
          {open && (
            <div className="absolute inset-0 bg-black/75 text-white flex flex-col">
              <div onClick={() => setOpenId(null)} title="Ocultar descripción"
                className="flex-1 min-h-0 overflow-y-auto whitespace-pre-line text-sm leading-relaxed p-5 cursor-pointer">
                {p.description}
              </div>
              <div className="p-4 flex justify-center">
                {p.duration ? (
                  // Las asesorías se reservan en el calendario, no van al carrito.
                  <Link to={`/asesorias?sesion=${encodeURIComponent(p.name)}`} className={buy}>
                    <CalendarDays size={16} /> Reservar
                  </Link>
                ) : (
                  <button
                    onClick={() => add({ product_id: p.id, name: p.name, price: p.price, image: p.image, is_digital: p.is_digital })}
                    disabled={p.is_digital && inCart(p.id)}
                    className={cn(buy, 'disabled:opacity-80 disabled:hover:bg-gold')}
                  >
                    {inCart(p.id) ? <><Check size={16} /> En tu carrito</> : <><ShoppingBag size={16} /> Comprar</>}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        <button type="button" onClick={() => setOpenId(open ? null : p.id)} className="block w-full text-left">
          {caption}
        </button>
      </article>
    );
  };

  return (
    <section className="max-w-6xl mx-auto px-4 py-16">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        {selected
          ? <h1 className="text-4xl">{categoryLabel(selected)}</h1>
          : <Editable k="store.intro.title" as="h1" className="text-4xl">Tienda</Editable>}
        <Link to="/asesorias" className="text-sm text-gold hover:text-gold-light">Sesiones y mentorías</Link>
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
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-12">
              {g.items.map(card)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
