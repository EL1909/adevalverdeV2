import React, { useState } from 'react';
import { ArrowRight, CheckCircle, Loader2, X } from 'lucide-react';
import { sendContact } from '../api/contact';
import { useAuth } from '../context/AuthContext';
import { useContent } from '../context/ContentContext';
import { Editable } from './Editable';
import { cn } from '../lib/utils';

const inputClass = 'w-full p-4 rounded-xl border border-white/15 focus:outline-none focus:border-gold bg-black/40 text-bone placeholder:text-mist/60';

interface Props {
  /** Bloque del CMS con el texto del botón. */
  k: string;
  /** De qué trata la consulta (ej. «Escuela del Silencio»): Adela lo ve en el aviso y en la ficha. */
  topic: string;
  children: string;
  variant?: 'solid' | 'outline';
}

/**
 * Botón que abre un formulario de consulta. El mensaje llega al panel de Adela
 * (Clientes → Consultas, con aviso push), no por correo. Con sesión iniciada
 * el nombre y el email ya vienen puestos.
 */
export const ContactCta: React.FC<Props> = ({ k, topic, children, variant = 'solid' }) => {
  const { user, token } = useAuth();
  const { editMode } = useContent();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '', website: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const className = cn(
    'inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold tracking-wide transition-colors',
    variant === 'solid' ? 'bg-gold text-ink hover:bg-gold-light' : 'border border-gold/60 text-gold hover:bg-gold/10',
  );

  const show = () => {
    if (editMode) return; // en modo edición el clic edita el texto del botón
    setForm(f => ({
      ...f,
      name: f.name || [user?.first_name, user?.last_name].filter(Boolean).join(' '),
      email: f.email || user?.email || '',
      phone: f.phone || user?.profile?.phone || '',
    }));
    setError(null); setSent(false); setOpen(true);
  };

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email.trim() && !form.phone.trim()) {
      setError('Déjanos un email o un teléfono para responderte.');
      return;
    }
    setBusy(true); setError(null);
    try {
      await sendContact({ ...form, topic }, token);
      setSent(true);
      setForm(f => ({ ...f, message: '' }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" onClick={show} className={className}>
        <Editable k={k} as="span">{children}</Editable><ArrowRight size={16} />
      </button>
      {open && (
        <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="bg-ink border border-gold/30 w-full max-w-md rounded-[2rem] shadow-2xl overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start p-8 pb-0">
              <div>
                <h2 className="text-3xl font-title text-gold">Escríbele a Adela</h2>
                <p className="text-mist text-sm mt-1">{topic}</p>
              </div>
              <button onClick={() => setOpen(false)} className="p-2 text-mist hover:text-gold" aria-label="Cerrar"><X size={20} /></button>
            </div>
            {sent ? (
              <div className="p-8 space-y-4">
                <p className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-sm text-emerald-200 flex items-center gap-2">
                  <CheckCircle size={16} /> Mensaje recibido. Adela te responderá pronto.
                </p>
                <button onClick={() => setOpen(false)} className="w-full border border-gold/60 text-gold py-3 rounded-2xl hover:bg-gold/10">Cerrar</button>
              </div>
            ) : (
              <form onSubmit={submit} className="p-8 space-y-4">
                {error && <div className="p-4 bg-red-950/40 border border-red-500/40 rounded-xl text-sm text-red-200">{error}</div>}
                <input required placeholder="Tu nombre" className={inputClass} value={form.name} onChange={set('name')} />
                <input type="email" placeholder="Tu correo electrónico" className={inputClass} value={form.email} onChange={set('email')} />
                <input type="tel" placeholder="Teléfono o WhatsApp" className={inputClass} value={form.phone} onChange={set('phone')} />
                <textarea required rows={4} placeholder="Tu mensaje" className={cn(inputClass, 'resize-none')} value={form.message} onChange={set('message')} />
                {/* Trampa para bots: invisible para las personas. */}
                <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true"
                  className="hidden" value={form.website} onChange={set('website')} />
                <p className="text-xs text-mist">Con un email o un teléfono basta para que te respondamos.</p>
                <button disabled={busy} className="w-full bg-gold text-ink py-4 rounded-2xl font-semibold hover:bg-gold-light flex items-center justify-center gap-2 disabled:opacity-60">
                  {busy && <Loader2 size={18} className="animate-spin" />} Enviar
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
};
