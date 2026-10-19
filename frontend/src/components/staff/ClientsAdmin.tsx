import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, Search, UserCheck, Users, X } from 'lucide-react';
import {
  CLIENT_TAG, LEAD_TAG, addClientNote, clientHistory, getClient, listClients, promoteClient, updateClient,
  type ClientHistory, type CrmClient, type Note,
} from '../../api/staff';
import { useAuth } from '../../context/AuthContext';
import { formatBooking } from '../../lib/dates';
import { formatMoney } from '../../lib/money';
import { cn } from '../../lib/utils';
import { ErrorBox, SubTabs, inputClass } from './StoreAdmin';

const when = (iso: string) => new Date(iso).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Madrid' });

const APPT_STATUS: Record<string, string> = {
  pending: 'Pendiente de pago', confirmed: 'Confirmada', completed: 'Realizada', cancelled: 'Cancelada',
};
const ORDER_STATUS: Record<string, string> = { pending: 'Pendiente', completed: 'Pagado', cancelled: 'Cancelado' };

// ── Piezas compartidas con el calendario ───────────────────────────────────

/** Lead o Cliente, según las etiquetas de su ficha. */
export const ClientTag: React.FC<{ tags?: string[] }> = ({ tags = [] }) => {
  if (tags.includes(CLIENT_TAG)) return <span className="px-2 py-0.5 rounded-full text-[11px] bg-gold text-ink font-semibold">Cliente</span>;
  if (tags.includes(LEAD_TAG)) return <span className="px-2 py-0.5 rounded-full text-[11px] border border-gold/60 text-gold">Lead</span>;
  return null;
};

/** Hilo de notas (solo se agregan: quedan como historial) con campo para una nueva. */
export const NotesThread: React.FC<{ notes: Note[]; onAdd: (text: string) => Promise<void> }> = ({ notes, onAdd }) => {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onAdd(text.trim());
      setText('');
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      {notes.length === 0 ? <p className="text-sm text-mist">Sin notas.</p> : (
        <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {[...notes].reverse().map((n, i) => (
            <li key={i} className={cn('rounded-xl p-3 text-sm', n.author_email ? 'bg-white/5' : 'border border-white/10 text-mist')}>
              <p className="whitespace-pre-line">{n.text}</p>
              <p className="text-[11px] text-mist/70 mt-1">{n.author_email ?? 'Sistema'} · {when(n.date)}</p>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="space-y-2">
        <textarea rows={2} className={cn(inputClass, 'resize-none text-sm')} placeholder="Agregar una nota…"
          value={text} onChange={e => setText(e.target.value)} />
        <ErrorBox error={error} />
        <button disabled={busy || !text.trim()} className="px-4 py-1.5 rounded-full border border-gold/60 text-gold text-sm hover:bg-gold hover:text-ink disabled:opacity-40">
          {busy ? 'Guardando…' : 'Agregar nota'}
        </button>
      </form>
    </div>
  );
};

// ── Ficha ───────────────────────────────────────────────────────────────────

const ClientDetail: React.FC<{ id: number; onChanged: (c: CrmClient) => void }> = ({ id, onChanged }) => {
  const { token } = useAuth();
  const [client, setClient] = useState<CrmClient | null>(null);
  const [history, setHistory] = useState<ClientHistory | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', city: '' });
  const [newTag, setNewTag] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!token) return;
    setClient(null);
    setHistory(null);
    getClient(token, id).then(c => {
      setClient(c);
      setForm({ name: c.name, email: c.email, phone: c.phone, city: c.city });
    }).catch(e => setError(e.message));
    clientHistory(token, id).then(setHistory).catch(e => setError(e.message));
  }, [token, id]);

  const apply = (c: CrmClient) => { setClient(c); onChanged(c); };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError(null);
    try {
      apply(await updateClient(token, id, form));
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err: any) { setError(err.message); }
  };

  const setTags = async (tags: string[]) => {
    if (!token) return;
    setError(null);
    try { apply(await updateClient(token, id, { tags })); } catch (err: any) { setError(err.message); }
  };

  const promote = async () => {
    if (!token) return;
    try { apply(await promoteClient(token, id)); } catch (err: any) { setError(err.message); }
  };

  if (!client) return error ? <ErrorBox error={error} /> : <Loader2 className="animate-spin text-gold" />;
  const isLead = !client.tags.includes(CLIENT_TAG);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-2xl text-bone flex items-center gap-2">{client.name} <ClientTag tags={client.tags} /></h3>
          <p className="text-xs text-mist">Desde {when(client.created_at)}{client.has_account && ' · tiene cuenta en el sitio'}</p>
        </div>
        {isLead && (
          <button onClick={promote} className="flex items-center gap-2 px-4 py-2 rounded-full bg-gold text-ink text-sm font-semibold">
            <UserCheck size={16} /> Marcar como cliente
          </button>
        )}
      </div>
      <ErrorBox error={error} />

      <form onSubmit={save} className="grid sm:grid-cols-2 gap-3">
        <label className="text-xs text-mist">Nombre<input required className={inputClass} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></label>
        <label className="text-xs text-mist">Email<input type="email" className={inputClass} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></label>
        <label className="text-xs text-mist">Teléfono / WhatsApp<input className={inputClass} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></label>
        <label className="text-xs text-mist">Ciudad<input className={inputClass} value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></label>
        <div className="sm:col-span-2 flex items-center gap-3">
          <button className="px-5 py-2 rounded-full border border-gold/60 text-gold text-sm hover:bg-gold hover:text-ink">Guardar datos</button>
          {saved && <span className="text-xs text-gold">Guardado</span>}
        </div>
      </form>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-mist/70">Etiquetas</p>
        <div className="flex flex-wrap items-center gap-2">
          {client.tags.map(t => (
            <span key={t} className="flex items-center gap-1 pl-3 pr-1 py-1 rounded-full bg-white/5 border border-white/10 text-sm">
              {t}
              <button onClick={() => setTags(client.tags.filter(x => x !== t))} className="p-0.5 text-mist hover:text-red-300" aria-label={`Quitar ${t}`}><X size={12} /></button>
            </span>
          ))}
          <form onSubmit={e => { e.preventDefault(); const t = newTag.trim(); if (t && !client.tags.includes(t)) setTags([...client.tags, t]); setNewTag(''); }}>
            <input className={cn(inputClass, 'w-40 py-1.5 px-3 text-sm')} placeholder="+ etiqueta" value={newTag} onChange={e => setNewTag(e.target.value)} />
          </form>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-mist/70">Notas</p>
        <NotesThread notes={client.notes} onAdd={async text => { if (token) apply(await addClientNote(token, id, text)); }} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-mist/70">Citas</p>
          {!history ? <Loader2 className="animate-spin text-gold" size={16} /> : history.appointments.length === 0
            ? <p className="text-sm text-mist">Sin citas.</p>
            : (
              <ul className="space-y-2">
                {history.appointments.map(a => (
                  <li key={a.id} className="rounded-xl bg-white/5 p-3 text-sm">
                    <p className="first-letter:uppercase">{formatBooking(a.start)}</p>
                    <p className="text-mist">{a.title} · {APPT_STATUS[a.status] ?? a.status}</p>
                  </li>
                ))}
              </ul>
            )}
        </div>
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-mist/70">Pedidos</p>
          {!history ? <Loader2 className="animate-spin text-gold" size={16} /> : history.orders.length === 0
            ? <p className="text-sm text-mist">Sin pedidos.</p>
            : (
              <ul className="space-y-2">
                {history.orders.map(o => (
                  <li key={o.id} className="rounded-xl bg-white/5 p-3 text-sm flex justify-between gap-2">
                    <span>#{o.id} · {when(o.date)}</span>
                    <span className="text-mist">{ORDER_STATUS[o.status] ?? o.status} · {formatMoney(o.total, history.currency)}</span>
                  </li>
                ))}
              </ul>
            )}
        </div>
      </div>
    </div>
  );
};

// ── Directorio ──────────────────────────────────────────────────────────────

const FILTERS: Record<string, string | undefined> = { all: undefined, leads: LEAD_TAG, clients: CLIENT_TAG };

export const ClientsAdmin: React.FC = () => {
  const { token } = useAuth();
  const [params, setParams] = useSearchParams();
  const [clients, setClients] = useState<CrmClient[] | null>(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const selected = Number(params.get('client')) || null;

  useEffect(() => {
    if (!token) return;
    const id = setTimeout(() => {
      listClients(token, { search, tag: FILTERS[filter] }).then(setClients).catch(e => setError(e.message));
    }, 250);
    return () => clearTimeout(id);
  }, [token, search, filter]);

  const select = (id: number) => setParams({ tab: 'clientes', client: String(id) });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="glass rounded-3xl p-5 space-y-4 lg:max-h-[80vh] lg:overflow-y-auto">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-mist" />
          <input className={cn(inputClass, 'pl-9')} placeholder="Buscar por nombre, email o teléfono"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <SubTabs value={filter} onChange={setFilter} tabs={[
          { id: 'all', label: 'Todos' }, { id: 'leads', label: 'Leads' }, { id: 'clients', label: 'Clientes' },
        ]} />
        <ErrorBox error={error} />
        {!clients ? <Loader2 className="animate-spin text-gold" /> : clients.length === 0 ? (
          <p className="text-sm text-mist">No hay {filter === 'leads' ? 'leads' : filter === 'clients' ? 'clientes' : 'nadie'} que coincida.</p>
        ) : (
          <ul className="divide-y divide-white/10">
            {clients.map(c => (
              <li key={c.id}>
                <button onClick={() => select(c.id)}
                  className={cn('w-full text-left py-3 px-2 rounded-xl transition-colors', selected === c.id ? 'bg-gold/10' : 'hover:bg-white/5')}>
                  <span className="flex items-center justify-between gap-2">
                    <span className={cn('truncate', selected === c.id && 'text-gold')}>{c.name}</span>
                    <ClientTag tags={c.tags} />
                  </span>
                  <span className="block text-xs text-mist truncate">{[c.email, c.phone].filter(Boolean).join(' · ') || '—'}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="glass rounded-3xl p-6 lg:col-span-2">
        {selected ? (
          <ClientDetail key={selected} id={selected}
            onChanged={c => setClients(prev => prev?.map(x => (x.id === c.id ? c : x)) ?? null)} />
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Users size={32} className="text-mist/40 mb-4" />
            <p className="text-lg text-mist">Selecciona una persona</p>
            <p className="text-sm text-mist/70 mt-1">Cada reserva crea su ficha como lead; al primer pago pasa a cliente.</p>
          </div>
        )}
      </div>
    </div>
  );
};
