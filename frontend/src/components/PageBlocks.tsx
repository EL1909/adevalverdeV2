import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Editable } from './Editable';
import { cn } from '../lib/utils';

/** Botón de llamada a la acción con texto editable. `to` externo (mailto:, https:) abre un <a>. */
export const Cta: React.FC<{ k: string; to: string; children: string; variant?: 'solid' | 'outline' }> = ({ k, to, children, variant = 'solid' }) => {
  const className = cn(
    'inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold tracking-wide transition-colors',
    variant === 'solid' ? 'bg-gold text-ink hover:bg-gold-light' : 'border border-gold/60 text-gold hover:bg-gold/10',
  );
  const label = <><Editable k={k} as="span">{children}</Editable><ArrowRight size={16} /></>;
  return /^(https?:|mailto:)/.test(to)
    ? <a href={to} className={className}>{label}</a>
    : <Link to={to} className={className}>{label}</Link>;
};

/** Encabezado de sección: antetítulo dorado + título. */
export const SectionTitle: React.FC<{ k: string; eyebrow?: string; children: string; center?: boolean }> = ({ k, eyebrow, children, center }) => (
  <div className={cn('space-y-3', center && 'text-center')}>
    {eyebrow && <Editable k={`${k}.eyebrow`} className="text-xs uppercase tracking-[0.3em] text-gold">{eyebrow}</Editable>}
    <Editable k={`${k}.title`} as="h2" className="text-3xl md:text-4xl leading-tight">{children}</Editable>
  </div>
);

export const Quote: React.FC<{ k: string; children: string }> = ({ k, children }) => (
  <Editable k={k} as="blockquote" className="font-title text-2xl md:text-3xl text-gold-light text-center italic max-w-3xl mx-auto">
    {children}
  </Editable>
);
