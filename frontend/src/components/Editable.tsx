import React, { useEffect, useRef, useState } from 'react';
import { Check, ImageUp, Loader2, Pencil, X } from 'lucide-react';
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
}

/**
 * Texto que Adela (staff) puede editar en el propio sitio. Fuera del modo
 * edición se ve como texto normal; los saltos de línea se respetan.
 */
export const Editable: React.FC<EditableProps> = ({ k, children, as: Tag = 'p', className, render }) => {
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
      {editMode && <Pencil size={12} className="inline-block ml-2 text-gold align-super" />}
    </Tag>
  );
};

interface EditableImageProps {
  k: string;
  src: string;
  alt: string;
  className?: string;
}

/** Imagen reemplazable por Adela desde el modo edición. */
export const EditableImage: React.FC<EditableImageProps> = ({ k, src, alt, className }) => {
  const { blocks, loadPage, editMode, save } = useContent();
  const input = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { loadPage(pageOf(k)); }, [k, loadPage]);

  const current = blocks[k]?.image || src;

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    setError(null);
    try {
      await save(k, { image: file });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
      e.target.value = '';
    }
  };

  return (
    <div className="relative">
      <img src={current} alt={alt} className={className} />
      {editMode && (
        <>
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="absolute top-3 right-3 flex items-center gap-2 bg-ink/80 border border-gold/60 text-gold text-xs px-3 py-1.5 rounded-full"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <ImageUp size={14} />} Cambiar imagen
          </button>
          <input ref={input} type="file" accept="image/*" className="hidden" onChange={onFile} />
          {error && <p className="absolute bottom-3 left-3 right-3 text-xs bg-ink/80 text-red-300 p-2 rounded">{error}</p>}
        </>
      )}
    </div>
  );
};
