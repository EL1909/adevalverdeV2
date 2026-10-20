import React, { useEffect, useRef, useState } from 'react';
import { Check, ImageUp, Loader2, Move, Pencil, RotateCcw, X, ZoomIn } from 'lucide-react';
import type { Framing } from '../api/content';
import { useContent } from '../context/ContentContext';
import { cn } from '../lib/utils';

const pageOf = (key: string) => key.split('.', 1)[0];

interface EditableProps {
  /** Clave estable del bloque: '<página>.<sección>[.<campo>]'. */
  k: string;
  /** Texto por defecto, usado mientras Adela no lo haya editado. */
  children: string;
  as?: React.ElementType;
  className?: string;
  /** Presentación propia del texto (ej. secciones y listas en las páginas legales). */
  render?: (text: string) => React.ReactNode;
  /** Solo en modo edición, mientras el bloque está vacío; no pasa al borrador. */
  placeholder?: string;
}

/**
 * Texto que Adela (staff) puede editar en el propio sitio. Fuera del modo
 * edición se ve como texto normal; los saltos de línea se respetan.
 */
export const Editable: React.FC<EditableProps> = ({ k, children, as: Tag = 'p', className, render, placeholder }) => {
  const { blocks, loadPage, editMode, save } = useContent();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { loadPage(pageOf(k)); }, [k, loadPage]);
  useEffect(() => { if (!editMode) setEditing(false); }, [editMode]);

  const text = blocks[k]?.text || children;

  if (editing) {
    const onSave = async () => {
      setSaving(true);
      setError(null);
      try {
        await save(k, { text: draft.trim() });
        setEditing(false);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setSaving(false);
      }
    };
    return (
      <div className="space-y-2 rounded-xl border border-gold/60 bg-black/60 p-3">
        <textarea
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          rows={Math.max(2, draft.split('\n').length + 1)}
          className="w-full bg-transparent text-bone font-sans text-base focus:outline-none resize-y"
        />
        {error && <p className="text-xs text-red-300">{error}</p>}
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-mist/70 font-mono">{k}</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing(false)} className="flex items-center gap-1 px-3 py-1.5 rounded-full text-mist hover:text-bone">
              <X size={14} /> Cancelar
            </button>
            <button type="button" onClick={onSave} disabled={saving || !draft.trim()} className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-gold text-ink font-semibold disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Guardar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Tag
      className={cn(
        !render && 'whitespace-pre-line',
        className,
        editMode && 'relative cursor-pointer outline outline-1 outline-dashed outline-gold/60 outline-offset-4 rounded hover:outline-gold',
      )}
      onClick={editMode ? (e: React.MouseEvent) => { e.preventDefault(); setDraft(text); setEditing(true); } : undefined}
      title={editMode ? 'Clic para editar' : undefined}
    >
      {render ? render(text) : text}
      {editMode && !text && placeholder && <span className="text-mist/60 italic">{placeholder}</span>}
      {editMode && <Pencil size={12} className="inline-block ml-2 text-gold align-super" />}
    </Tag>
  );
};

interface EditableImageProps {
  k: string;
  src: string;
  alt: string;
  className?: string;
  /** Clases del contenedor (ej. `absolute inset-0` para una imagen a sangre). */
  wrapperClassName?: string;
}

const CENTER: Framing = { x: 50, y: 50, zoom: 1 };
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const framingOf = (f: Framing | Record<string, never> | undefined): Framing =>
  f && 'zoom' in f ? (f as Framing) : CENTER;

/**
 * Encuadre sin recortar el archivo: `object-position` elige el punto a la vista
 * y `scale` (con origen en ese mismo punto) acerca la imagen. Funciona igual con
 * cualquier proporción de la caja (móvil o escritorio).
 */
const frameStyle = ({ x, y, zoom }: Framing): React.CSSProperties => ({
  objectPosition: `${x}% ${y}%`,
  transformOrigin: `${x}% ${y}%`,
  transform: zoom > 1 ? `scale(${zoom})` : undefined,
});

/**
 * Imagen reemplazable por Adela desde el modo edición, con «Ajustar encuadre»:
 * arrastrar para mover, rueda o deslizador para el zoom. Se guarda el encuadre
 * (bloque del CMS), no un recorte: la original queda intacta.
 */
export const EditableImage: React.FC<EditableImageProps> = ({ k, src, alt, className, wrapperClassName }) => {
  const { blocks, loadPage, editMode, save } = useContent();
  const input = useRef<HTMLInputElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const drag = useRef<{ px: number; py: number; from: Framing } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Framing | null>(null); // no null = ajustando el encuadre

  useEffect(() => { loadPage(pageOf(k)); }, [k, loadPage]);
  useEffect(() => { if (!editMode) setDraft(null); }, [editMode]);

  const current = blocks[k]?.image || src;
  const framing = draft ?? framingOf(blocks[k]?.framing);

  // El marco (esquinas redondeadas, borde) pasa al contenedor: así el zoom
  // queda dentro del marco en lugar de agrandar también el borde.
  const classes = (className ?? '').split(/\s+/).filter(Boolean);
  const isFrame = (c: string) => /^(rounded|border)/.test(c);
  const frameClasses = classes.filter(isFrame).join(' ');
  const imgClasses = classes.filter(c => !isFrame(c)).join(' ');

  const run = async (fn: () => Promise<unknown>) => {
    setSaving(true);
    setError(null);
    try { await fn(); return true; } catch (err: any) { setError(err.message); return false; } finally { setSaving(false); }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await run(() => save(k, { image: file }));
    e.target.value = '';
  };

  // Cuántos píxeles se puede desplazar la imagen en cada eje: lo que sobra al
  // cubrir la caja (object-cover) más lo que añade el zoom.
  const movable = () => {
    const el = img.current;
    if (!el || !draft) return { w: 0, h: 0 };
    const box = el.getBoundingClientRect();
    const w = box.width / draft.zoom, h = box.height / draft.zoom; // tamaño de la caja sin el scale
    const cover = el.naturalWidth && el.naturalHeight ? Math.max(w / el.naturalWidth, h / el.naturalHeight) : 1;
    return {
      w: (el.naturalWidth * cover - w) * draft.zoom + w * (draft.zoom - 1),
      h: (el.naturalHeight * cover - h) * draft.zoom + h * (draft.zoom - 1),
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!draft) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, from: draft };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !draft) return;
    const { w, h } = movable();
    // Arrastrar a la derecha muestra lo que hay a la izquierda: el punto a la vista baja.
    setDraft({
      ...draft,
      x: w > 0 ? clamp(d.from.x - ((e.clientX - d.px) / w) * 100, 0, 100) : draft.x,
      y: h > 0 ? clamp(d.from.y - ((e.clientY - d.py) / h) * 100, 0, 100) : draft.y,
    });
  };
  const onPointerUp = () => { drag.current = null; };

  // La rueda acerca/aleja; listener propio porque el de React es pasivo y no puede evitar el scroll.
  const area = useRef<HTMLDivElement>(null);
  const adjusting = !!draft;
  useEffect(() => {
    const el = area.current;
    if (!el || !adjusting) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setDraft(d => d && { ...d, zoom: clamp(d.zoom * (1 - e.deltaY * 0.0015), 1, 4) });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [adjusting]);

  const saveFraming = async () => {
    if (!draft) return;
    const centered = draft.zoom === 1 && draft.x === 50 && draft.y === 50;
    if (await run(() => save(k, { framing: centered ? {} : draft }))) setDraft(null);
  };

  const stop = (e: React.PointerEvent) => e.stopPropagation();
  const chip = 'flex items-center gap-2 bg-ink/80 border border-gold/60 text-gold text-xs px-3 py-1.5 rounded-full disabled:opacity-50';

  return (
    <div
      ref={area}
      className={cn('relative overflow-hidden', frameClasses, wrapperClassName, draft && 'cursor-grab active:cursor-grabbing touch-none select-none outline outline-2 outline-gold')}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
    >
      <img ref={img} src={current} alt={alt} draggable={false} className={cn('block', imgClasses)} style={frameStyle(framing)} />
      {editMode && !draft && (
        <div className="absolute top-3 right-3 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => { setError(null); setDraft(framing); }} className={chip}>
            <Move size={14} /> Ajustar encuadre
          </button>
          <button type="button" onClick={() => input.current?.click()} disabled={saving} className={chip}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <ImageUp size={14} />} Cambiar imagen
          </button>
          <input ref={input} type="file" accept="image/*" className="hidden" onChange={onFile} />
        </div>
      )}
      {draft && (
        <div onPointerDown={stop} className="absolute inset-x-3 bottom-3 flex flex-wrap items-center gap-2 rounded-2xl bg-ink/85 border border-gold/60 p-2 text-xs cursor-default">
          <span className="text-mist px-1">Arrastra para mover</span>
          <label className="flex items-center gap-2 text-gold flex-1 min-w-[140px]">
            <ZoomIn size={14} />
            <input type="range" min={1} max={4} step={0.01} value={draft.zoom}
              onChange={e => setDraft({ ...draft, zoom: Number(e.target.value) })} className="flex-1 accent-[#D4AF37]" />
          </label>
          <button type="button" onClick={() => setDraft(CENTER)} className="px-3 py-1.5 rounded-full border border-white/15 text-mist" title="Centrada y sin zoom">
            <RotateCcw size={14} />
          </button>
          <button type="button" onClick={() => setDraft(null)} className="px-3 py-1.5 rounded-full border border-white/15 text-mist">Cancelar</button>
          <button type="button" onClick={saveFraming} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-gold text-ink font-semibold disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Guardar
          </button>
        </div>
      )}
      {error && <p className="absolute top-14 left-3 right-3 text-xs bg-ink/80 text-red-300 p-2 rounded">{error}</p>}
    </div>
  );
};
