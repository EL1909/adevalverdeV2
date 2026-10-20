import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Link2 } from 'lucide-react';
import { fetchProductBySlug, fetchProducts, productDestination, type StoreProduct } from '../api/store';
import { useContent } from '../context/ContentContext';

// Un slug → su producto, una sola petición por slug mientras dure la visita.
const cache = new Map<string, Promise<StoreProduct | null>>();
const productFor = (slug: string) => {
  if (!cache.has(slug)) cache.set(slug, fetchProductBySlug(slug).catch(() => null));
  return cache.get(slug)!;
};

interface ProductCtaProps {
  /** Bloque del CMS donde se guarda el slug del producto elegido (ej. `test.resultado.a.destino`). */
  k: string;
  className?: string;
  /** El texto del botón (puede ser un <Editable>). */
  children: React.ReactNode;
}

/**
 * Botón cuyo destino elige Adela en modo edición: un producto con página
 * propia (→ /libro/<slug>) o una asesoría (→ Asesorías con la sesión elegida).
 * Se guarda el slug, que no cambia al renombrar el producto. Sin destino
 * válido, el visitante no ve el botón.
 */
export const ProductCta: React.FC<ProductCtaProps> = ({ k, className, children }) => {
  const { blocks, loadPage, editMode, save } = useContent();
  const slug = blocks[k]?.text ?? '';
  const [resolved, setResolved] = useState<{ slug: string; product: StoreProduct | null } | null>(null);
  const [options, setOptions] = useState<StoreProduct[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { loadPage(k.split('.', 1)[0]); }, [k, loadPage]);
  useEffect(() => {
    if (slug) productFor(slug).then(product => setResolved({ slug, product }));
  }, [slug]);
  // undefined = aún no se sabe; null = sin destino o ya no es un producto publicado.
  const product = !slug ? null : resolved?.slug === slug ? resolved.product : undefined;
  useEffect(() => {
    if (editMode && !options) fetchProducts().then(setOptions).catch(e => setError(e.message));
  }, [editMode, options]);

  const to = product ? productDestination(product) : null;

  if (!editMode) return to ? <Link to={to} className={className}>{children}</Link> : null;

  const choose = async (next: string) => {
    setError(null);
    try {
      await save(k, { text: next });
    } catch (e: any) { setError(e.message); }
  };
  const pages = options?.filter(p => p.has_page && !p.duration) ?? [];
  const sessions = options?.filter(p => p.duration) ?? [];
  const warning = !slug ? 'Sin destino: los visitantes no ven este botón.'
    : product === undefined ? 'Cargando…'
    : product === null ? 'El producto elegido ya no está publicado: los visitantes no ven este botón.'
    : !to ? `«${product.name}» ya no tiene página propia: los visitantes no ven este botón.`
    : null;

  return (
    <div className="space-y-2">
      {/* En edición el botón no navega: el clic es para editar su texto. */}
      <span className={className}>{children}</span>
      <div className="rounded-xl border border-gold/60 bg-black/70 p-3 space-y-2 text-xs">
        <label className="flex items-center gap-2 text-gold">
          <Link2 size={14} /> Este botón lleva a
          <select value={slug} onChange={e => choose(e.target.value)}
            className="flex-1 min-w-0 rounded-lg border border-white/15 bg-black/60 p-1.5 text-bone">
            <option value="">— Sin destino —</option>
            <optgroup label="Libros y productos (su página)">
              {pages.map(p => <option key={p.id} value={p.slug}>{p.name}</option>)}
            </optgroup>
            <optgroup label="Asesorías (reservar)">
              {sessions.map(p => <option key={p.id} value={p.slug}>{p.name}</option>)}
            </optgroup>
          </select>
        </label>
        {warning && <p className="text-mist">{warning}</p>}
        <p className="text-mist/70">¿No aparece? En el panel, marca «Tiene página propia» en el producto.</p>
        {error && <p className="text-red-300">{error}</p>}
      </div>
    </div>
  );
};
