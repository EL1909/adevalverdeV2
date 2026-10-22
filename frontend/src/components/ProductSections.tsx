import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, CalendarDays, Loader2, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import type { StoreProduct } from '../api/store';
import { useBusiness } from '../context/BusinessContext';
import { useCart } from '../context/CartContext';
import { useContent } from '../context/ContentContext';
import { Editable, EditableImage } from './Editable';
import { formatMoney } from '../lib/money';
import { renderRich } from '../lib/richText';
import { cn } from '../lib/utils';

/**
 * Página larga de un producto hecha de secciones (antes, la página de Gamma).
 * La estructura vive en el bloque `<prefijo>.secciones` (JSON) y cada texto o
 * imagen en su propio bloque del CMS, editable en el sitio:
 *   <prefijo>.<sección>.<campo>          ej. libro.el-librito-del-oro.s3fa.titulo
 *   <prefijo>.<sección>.<item>.<campo>   recuadros y columnas de listas
 * Quitar una sección o un item no borra sus bloques: dejan de mostrarse.
 * El backend puede crear la página desde Gamma: `manage.py import_gamma`.
 */

type Tipo = 'portada' | 'texto' | 'recuadros' | 'listas' | 'oferta';
type Lado = 'izquierda' | 'derecha';
type Estilo = 'tarjetas' | 'pasos' | 'testimonios';

interface Seccion {
  id: string;
  tipo: Tipo;
  lado?: Lado;
  estilo?: Estilo;
  /** Recuadros (o columnas, en listas), en orden. */
  items?: string[];
}

const TIPOS: { tipo: Tipo; label: string }[] = [
  { tipo: 'portada', label: 'Portada con botón' },
  { tipo: 'texto', label: 'Texto e imagen' },
  { tipo: 'recuadros', label: 'Recuadros' },
  { tipo: 'listas', label: 'Listas' },
  { tipo: 'oferta', label: 'Oferta con botón' },
];
const ITEM_LABEL: Partial<Record<Tipo, string>> = { recuadros: 'recuadro', listas: 'columna' };

const parse = (text: string | undefined): Seccion[] => {
  try {
    const v = JSON.parse(text || '[]');
    return Array.isArray(v) ? v.filter(s => s && typeof s.id === 'string' && TIPOS.some(t => t.tipo === s.tipo)) : [];
  } catch {
    return [];
  }
};

const newId = (prefix: string, taken: Set<string>) => {
  for (;;) {
    const id = prefix + Math.random().toString(16).slice(2, 6);
    if (!taken.has(id)) return id;
  }
};

const btn = 'inline-flex items-center justify-center gap-2 bg-gold text-ink rounded-full px-7 py-3 font-semibold hover:bg-gold-light transition-colors';
const tool = 'flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-gold/50 bg-ink/80 text-gold disabled:opacity-40';

interface Props {
  product: StoreProduct;
  /** Página del CMS, ej. `libro.<slug>`. */
  prefix: string;
}

export const ProductSections: React.FC<Props> = ({ product, prefix }) => {
  const { blocks, loadPage, editMode, save } = useContent();
  const { business } = useBusiness();
  const { items: cart, add } = useCart();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<number | null>(null); // posición donde se elige el tipo

  useEffect(() => { loadPage(prefix.split('.', 1)[0]); }, [prefix, loadPage]);

  const structKey = `${prefix}.secciones`;
  const sections = parse(blocks[structKey]?.text);
  const key = (...parts: string[]) => [prefix, ...parts].join('.');
  const has = (k: string) => !!blocks[k]?.text;
  const hasImage = (k: string) => !!blocks[k]?.image;

  if (!editMode && sections.length === 0) return null;

  const store = async (next: Seccion[]) => {
    setBusy(true);
    setError(null);
    try {
      await save(structKey, { text: JSON.stringify(next) });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const taken = () => new Set(sections.flatMap(s => [s.id, ...(s.items ?? [])]));
  const update = (id: string, patch: Partial<Seccion>) => store(sections.map(s => (s.id === id ? { ...s, ...patch } : s)));
  const move = (i: number, d: number) => {
    const next = [...sections];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    store(next);
  };
  const remove = (s: Seccion) => {
    if (confirm('¿Quitar esta sección de la página?')) store(sections.filter(x => x.id !== s.id));
  };
  const insert = (at: number, tipo: Tipo) => {
    const ids = taken();
    const s: Seccion = { id: newId('s', ids), tipo };
    ids.add(s.id);
    if (tipo === 'portada' || tipo === 'texto') s.lado = 'derecha';
    if (tipo === 'recuadros') s.estilo = 'tarjetas';
    if (ITEM_LABEL[tipo]) {
      s.items = [];
      for (let n = tipo === 'recuadros' ? 3 : 2; n > 0; n--) {
        const id = newId('i', ids);
        ids.add(id);
        s.items.push(id);
      }
    }
    setAdding(null);
    store([...sections.slice(0, at), s, ...sections.slice(at)]);
  };
  const addItem = (s: Seccion) => update(s.id, { items: [...(s.items ?? []), newId('i', taken())] });
  const removeItem = (s: Seccion, item: string) => {
    if (confirm(`¿Quitar este ${ITEM_LABEL[s.tipo]}?`)) update(s.id, { items: (s.items ?? []).filter(i => i !== item) });
  };

  // Texto editable; vacío, solo se ve en modo edición (con su indicación).
  const field = (k: string, opts: { as?: React.ElementType; className?: string; rich?: boolean; placeholder: string }) =>
    has(k) || editMode ? (
      <Editable k={k} as={opts.as ?? (opts.rich ? 'div' : 'p')} className={opts.className}
        render={opts.rich ? renderRich : undefined} placeholder={opts.placeholder}>{''}</Editable>
    ) : null;

  const image = (k: string, className: string, wrapperClassName?: string) =>
    hasImage(k) || editMode
      ? <EditableImage k={k} src="" alt="" removable className={className} wrapperClassName={wrapperClassName} />
      : null;

  const price = Number(product.price) === 0 ? 'Gratis' : formatMoney(product.price, business.currency || 'USD');

  // Botón de compra: va al carrito (o a reservar, si es una asesoría). El texto lo edita Adela.
  const buy = (k: string) => {
    const isSession = !!product.duration;
    const fallback = isSession ? 'Reservar mi sesión' : 'Comprar ahora';
    const label = blocks[k]?.text || fallback;
    const icon = isSession ? <CalendarDays size={18} /> : <ShoppingBag size={18} />;
    let control: React.ReactNode;
    if (editMode) {
      control = <span className={btn}>{icon}<Editable k={k} as="span">{fallback}</Editable></span>;
    } else if (isSession) {
      control = <Link to={`/asesorias?sesion=${encodeURIComponent(product.name)}`} className={btn}>{icon}{label}</Link>;
    } else {
      const onClick = () => {
        if (!cart.some(i => i.product_id === product.id)) {
          add({ product_id: product.id, name: product.name, price: product.price, image: product.image, is_digital: product.is_digital });
        }
        navigate('/carrito');
      };
      control = <button type="button" onClick={onClick} className={btn}>{icon}{label}</button>;
    }
    return (
      <div className="flex flex-wrap items-center gap-4">
        {control}
        <span className="text-2xl text-bone font-semibold">{price}</span>
      </div>
    );
  };

  const header = (s: Seccion, center = true) => (
    <div className={cn('space-y-4', center && 'text-center max-w-3xl mx-auto')}>
      {field(key(s.id, 'titulo'), { as: 'h2', className: 'text-3xl md:text-4xl text-gold leading-tight', placeholder: 'Título de la sección' })}
      {field(key(s.id, 'texto'), { rich: true, className: 'text-bone/85 leading-relaxed', placeholder: 'Texto (opcional)' })}
    </div>
  );

  const body = (s: Seccion) => {
    const img = key(s.id, 'imagen');
    const withImage = hasImage(img) || editMode;

    if (s.tipo === 'portada' || s.tipo === 'texto') return (
      <div className={cn('grid gap-10 items-center', withImage && 'md:grid-cols-2')}>
        <div className={cn('space-y-6', s.lado === 'izquierda' && 'md:order-2')}>
          {field(key(s.id, 'titulo'), {
            as: s.tipo === 'portada' ? 'h1' : 'h2',
            className: cn('text-gold leading-tight', s.tipo === 'portada' ? 'text-4xl md:text-5xl' : 'text-3xl md:text-4xl'),
            placeholder: 'Título',
          })}
          {field(key(s.id, 'texto'), { rich: true, className: 'text-bone/85 leading-relaxed text-lg', placeholder: 'Texto' })}
          {s.tipo === 'portada' && buy(key(s.id, 'boton'))}
          {s.tipo === 'portada' && field(key(s.id, 'nota'), { className: 'text-sm text-mist', placeholder: 'Nota bajo el botón (opcional)' })}
        </div>
        {image(img, 'w-full aspect-[3/4] object-cover rounded-3xl')}
      </div>
    );

    if (s.tipo === 'recuadros' || s.tipo === 'listas') {
      const items = s.items ?? [];
      const cols = items.length === 1 ? 'max-w-2xl mx-auto' : items.length % 3 === 0 || items.length > 4 ? 'md:grid-cols-3' : 'md:grid-cols-2';
      const estilo = s.estilo ?? 'tarjetas';
      return (
        <div className="space-y-10">
          {header(s)}
          {image(img, 'w-full aspect-[16/9] object-cover rounded-3xl', 'max-w-3xl mx-auto')}
          <div className={cn('grid gap-6', cols)}>
            {items.map((item, n) => {
              const title = key(s.id, item, 'titulo');
              const text = key(s.id, item, 'texto');
              const testimonio = s.tipo === 'recuadros' && estilo === 'testimonios';
              return (
                <div key={item} className="glass rounded-3xl p-6 space-y-3 relative">
                  {editMode && (
                    <button type="button" onClick={() => removeItem(s, item)} disabled={busy}
                      className="absolute top-3 right-3 p-1 rounded-full text-mist hover:text-red-300" title={`Quitar ${ITEM_LABEL[s.tipo]}`}>
                      <X size={14} />
                    </button>
                  )}
                  {s.tipo === 'recuadros' && estilo === 'pasos' && (
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-gold text-gold font-semibold">{n + 1}</span>
                  )}
                  {testimonio ? (
                    <>
                      {field(text, { rich: true, className: 'italic text-bone/90 leading-relaxed', placeholder: 'Testimonio' })}
                      {field(title, { className: 'text-sm text-gold', placeholder: 'Nombre' })}
                    </>
                  ) : (
                    <>
                      {field(title, { as: 'h3', className: 'text-xl text-gold', placeholder: 'Título (opcional)' })}
                      {field(text, { rich: true, className: 'text-mist leading-relaxed', placeholder: s.tipo === 'listas' ? 'Una línea por punto, empezando con "- "' : 'Texto' })}
                    </>
                  )}
                </div>
              );
            })}
          </div>
          {editMode && (
            <button type="button" onClick={() => addItem(s)} disabled={busy} className={cn(tool, 'mx-auto text-xs')}>
              <Plus size={14} /> Añadir {ITEM_LABEL[s.tipo]}
            </button>
          )}
          {field(key(s.id, 'cierre'), { rich: true, className: 'text-center text-bone/85 max-w-3xl mx-auto', placeholder: 'Texto final (opcional)' })}
        </div>
      );
    }

    // Oferta: la imagen va de fondo, oscurecida. En edición se muestra aparte
    // para poder cambiarla y encuadrarla sin que el texto la tape.
    return (
      <div className="space-y-4">
        {editMode && (
          <div className="space-y-1">
            <p className="text-xs text-mist">Imagen de fondo (opcional)</p>
            {image(img, 'w-full aspect-[16/9] object-cover rounded-3xl', 'max-w-xl')}
          </div>
        )}
        <div className="relative overflow-hidden rounded-3xl border border-gold/30">
          {!editMode && hasImage(img) && (
            <>
              <EditableImage k={img} src="" alt="" className="w-full h-full object-cover" wrapperClassName="absolute inset-0" />
              <div className="absolute inset-0 bg-black/75" />
            </>
          )}
          <div className={cn('relative px-6 py-12 md:px-12 max-w-3xl mx-auto space-y-6 text-center', !hasImage(img) && 'glass')}>
            {field(key(s.id, 'titulo'), { as: 'h2', className: 'text-3xl md:text-4xl text-gold leading-tight', placeholder: 'Título' })}
            {field(key(s.id, 'texto'), { rich: true, className: 'text-bone/90 leading-relaxed text-left md:text-center', placeholder: 'Texto de la oferta' })}
            {field(key(s.id, 'destacado'), { rich: true, className: 'text-left rounded-2xl border-l-4 border-gold bg-gold/10 p-4 text-bone/90', placeholder: 'Texto destacado (opcional)' })}
            <div className="flex justify-center">{buy(key(s.id, 'boton'))}</div>
            {field(key(s.id, 'nota'), { className: 'text-sm text-mist', placeholder: 'Nota bajo el botón (opcional)' })}
          </div>
        </div>
      </div>
    );
  };

  const toolbar = (s: Seccion, i: number) => (
    <div className="flex flex-wrap items-center justify-end gap-2 text-xs mb-4">
      <span className="mr-auto text-mist/70 font-mono">{TIPOS.find(t => t.tipo === s.tipo)?.label} · {s.id}</span>
      {(s.tipo === 'portada' || s.tipo === 'texto') && (
        <select value={s.lado ?? 'derecha'} onChange={e => update(s.id, { lado: e.target.value as Lado })} disabled={busy}
          className="rounded-full border border-gold/50 bg-ink/80 text-gold px-2.5 py-1.5">
          <option value="derecha">Imagen a la derecha</option>
          <option value="izquierda">Imagen a la izquierda</option>
        </select>
      )}
      {s.tipo === 'recuadros' && (
        <select value={s.estilo ?? 'tarjetas'} onChange={e => update(s.id, { estilo: e.target.value as Estilo })} disabled={busy}
          className="rounded-full border border-gold/50 bg-ink/80 text-gold px-2.5 py-1.5">
          <option value="tarjetas">Tarjetas</option>
          <option value="pasos">Pasos numerados</option>
          <option value="testimonios">Testimonios</option>
        </select>
      )}
      <button type="button" onClick={() => move(i, -1)} disabled={busy || i === 0} className={tool} title="Subir"><ArrowUp size={14} /></button>
      <button type="button" onClick={() => move(i, 1)} disabled={busy || i === sections.length - 1} className={tool} title="Bajar"><ArrowDown size={14} /></button>
      <button type="button" onClick={() => remove(s)} disabled={busy} className={cn(tool, 'hover:text-red-300')} title="Quitar sección"><Trash2 size={14} /></button>
    </div>
  );

  const adder = (at: number) => editMode && (
    <div className="flex justify-center py-2">
      {adding === at ? (
        <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-gold/50 bg-ink/80 p-2 text-xs">
          {TIPOS.map(t => (
            <button key={t.tipo} type="button" onClick={() => insert(at, t.tipo)} disabled={busy}
              className="px-3 py-1.5 rounded-full border border-white/15 text-bone hover:border-gold hover:text-gold">{t.label}</button>
          ))}
          <button type="button" onClick={() => setAdding(null)} className="p-1.5 text-mist"><X size={14} /></button>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(at)} disabled={busy} className={cn(tool, 'text-xs')}>
          <Plus size={14} /> Añadir sección aquí
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {editMode && (
        <p className="text-xs text-mist flex items-center gap-2">
          {busy && <Loader2 size={12} className="animate-spin text-gold" />}
          Página larga: clic en cualquier texto o imagen para editarlo. En los textos, "- " al inicio de línea hace una lista y **así** se pone en negrita.
        </p>
      )}
      {error && <p className="text-sm text-red-300">{error}</p>}
      {adder(0)}
      {sections.map((s, i) => (
        <React.Fragment key={s.id}>
          <section className={cn('py-10', editMode && 'rounded-3xl border border-dashed border-gold/30 p-4 md:p-6')}>
            {editMode && toolbar(s, i)}
            {body(s)}
          </section>
          {adder(i + 1)}
        </React.Fragment>
      ))}
    </div>
  );
};
