import React, { useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import { saveProduct } from '../api/staff';
import type { StoreProduct } from '../api/store';
import { useAuth } from '../context/AuthContext';
import { useCatalog } from '../context/CatalogContext';
import { useContent } from '../context/ContentContext';
import { cn } from '../lib/utils';
import { EditBox, ImageEditor, framingOf } from './Editable';

/**
 * Campos de un producto editables en el sitio (modo edición): se guardan en el
 * producto mismo (evz_store), así que el panel de staff ve lo mismo.
 */
const useSaveProduct = (product: StoreProduct, onSaved?: (p: StoreProduct) => void) => {
  const { token } = useAuth();
  const { replaceProduct } = useCatalog();
  return async (fields: Record<string, string | Blob>) => {
    if (!token) throw new Error('Sesión expirada');
    const data = new FormData();
    Object.entries(fields).forEach(([k, v]) => data.append(k, v));
    const saved = await saveProduct(token, data, product.id);
    replaceProduct(saved);
    onSaved?.(saved);
    return saved;
  };
};

interface ProductImageProps {
  product: StoreProduct;
  className?: string;
  wrapperClassName?: string;
  /** La portada de la tienda se ve en una caja con encuadre; la página propia, entera. */
  framed?: boolean;
  onSaved?: (p: StoreProduct) => void;
}

/** Portada del producto: «Cambiar imagen» y, en la tienda, «Ajustar encuadre». */
export const ProductImage: React.FC<ProductImageProps> = ({ product, className, wrapperClassName, framed, onSaved }) => {
  const save = useSaveProduct(product, onSaved);
  // Al subir otra imagen el backend vuelve el encuadre a centrado.
  return (
    <ImageEditor src={product.image ?? ''} alt={product.name} className={className} wrapperClassName={wrapperClassName}
      framing={framed ? framingOf(product.image_framing) : null}
      onImage={image => save({ image })}
      onFraming={framing => save({ image_framing: JSON.stringify(framing) })} />
  );
};

const LABELS = { name: 'nombre', description: 'descripción' } as const;

interface ProductTextProps {
  product: StoreProduct;
  field: keyof typeof LABELS;
  as?: React.ElementType;
  className?: string;
  onSaved?: (p: StoreProduct) => void;
}

/** Nombre o descripción del producto; fuera del modo edición, texto normal. */
export const ProductText: React.FC<ProductTextProps> = ({ product, field, as: Tag = 'p', className, onSaved }) => {
  const { editMode } = useContent();
  const save = useSaveProduct(product, onSaved);
  const [editing, setEditing] = useState(false);

  useEffect(() => { if (!editMode) setEditing(false); }, [editMode]);

  const text = product[field] ?? '';

  if (editing) return (
    <EditBox initial={text} label={`Producto · ${LABELS[field]}`}
      onCancel={() => setEditing(false)}
      onSave={async draft => { await save({ [field]: draft }); setEditing(false); }} />
  );

  return (
    <Tag
      className={cn(
        'whitespace-pre-line',
        className,
        editMode && 'relative cursor-pointer outline outline-1 outline-dashed outline-gold/60 outline-offset-4 rounded hover:outline-gold',
      )}
      onClick={editMode ? (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); setEditing(true); } : undefined}
      title={editMode ? 'Clic para editar' : undefined}
    >
      {text}
      {editMode && !text && <span className="text-mist/60 italic">Sin {LABELS[field]}</span>}
      {editMode && <Pencil size={12} className="inline-block ml-2 text-gold align-super" />}
    </Tag>
  );
};
