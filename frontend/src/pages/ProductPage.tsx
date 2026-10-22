import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Check, Loader2, ShoppingBag } from 'lucide-react';
import { categoryLabel, categorySlug, fetchProductPage, type StoreProduct } from '../api/store';
import { useBusiness } from '../context/BusinessContext';
import { useCart } from '../context/CartContext';
import { useCatalog } from '../context/CatalogContext';
import { useContent } from '../context/ContentContext';
import { ProductImage, ProductText } from '../components/ProductEditable';
import { ProductSections } from '../components/ProductSections';
import { Placeholder } from './Placeholder';
import { formatMoney } from '../lib/money';
import { cn, descriptionBox } from '../lib/utils';

/**
 * /libro/<slug>: página propia de un producto (Adela la activa en el panel).
 * Portada, nombre y descripción se editan en el producto (igual que en el panel);
 * debajo, la página larga por secciones (bloques del CMS libro.<slug>.*).
 */
export const ProductPage: React.FC = () => {
  const { slug = '' } = useParams();
  const { business } = useBusiness();
  const { items, add } = useCart();
  const { categories } = useCatalog();
  const { editMode } = useContent();
  const [product, setProduct] = useState<StoreProduct | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setProduct(undefined);
    fetchProductPage(slug).then(setProduct).catch(e => setError(e.message));
  }, [slug]);

  if (error) return <Placeholder title="No se pudo cargar" text={error} />;
  if (product === undefined) return <div className="max-w-5xl mx-auto px-4 py-16"><Loader2 className="animate-spin text-gold" /></div>;
  if (!product) return <Placeholder title="Página no encontrada" text="Este libro no existe o ya no está disponible." />;

  const category = categories.find(c => c.id === product.category);
  const inCart = items.some(i => i.product_id === product.id);
  const isSession = !!product.duration; // las asesorías se reservan, no van al carrito

  return (
    <section className="max-w-5xl mx-auto px-4 py-16 space-y-12">
      <Link to={category ? `/tienda?categoria=${categorySlug(category)}` : '/tienda'}
        className="inline-flex items-center gap-1 text-sm text-mist hover:text-gold">
        <ArrowLeft size={14} /> {category ? categoryLabel(category) : 'Tienda'}
      </Link>

      <div className="grid md:grid-cols-2 gap-10 items-start">
        {product.image || editMode
          ? <ProductImage product={product} onSaved={setProduct}
              className={cn('w-full rounded-3xl object-cover', !product.image && 'aspect-[3/4]')} />
          : <div className="aspect-[3/4] rounded-3xl bg-white/5" />}
        <div className="space-y-5">
          <p className="text-xs uppercase tracking-widest text-mist">
            {category ? categoryLabel(category) : product.category_name}{product.is_digital && ' · PDF'}
          </p>
          <ProductText product={product} field="name" as="h1" className="text-4xl text-gold" onSaved={setProduct} />
          <p className="text-2xl text-bone font-semibold">
            {Number(product.price) === 0 ? 'Gratis' : formatMoney(product.price, business.currency || 'USD')}
          </p>
          {(product.description || editMode) && (
            <ProductText product={product} field="description" className={cn('text-mist', descriptionBox)} onSaved={setProduct} />
          )}
          {isSession ? (
            <Link to={`/asesorias?sesion=${encodeURIComponent(product.name)}`}
              className="flex items-center justify-center gap-2 bg-gold text-ink rounded-full py-3 font-semibold hover:bg-gold-light transition-colors">
              <CalendarDays size={18} /> Reservar
            </Link>
          ) : (
            <button
              onClick={() => add({ product_id: product.id, name: product.name, price: product.price, image: product.image, is_digital: product.is_digital })}
              disabled={product.is_digital && inCart}
              className="w-full flex items-center justify-center gap-2 bg-gold text-ink rounded-full py-3 font-semibold hover:bg-gold-light transition-colors disabled:opacity-60"
            >
              {inCart ? <><Check size={18} /> En tu carrito</> : <><ShoppingBag size={18} /> Añadir al carrito</>}
            </button>
          )}
          {inCart && <Link to="/carrito" className="block text-center text-sm text-gold hover:text-gold-light">Ir al carrito</Link>}
        </div>
      </div>

      <ProductSections product={product} prefix={`libro.${product.slug.slice(0, 100)}`} />
    </section>
  );
};
