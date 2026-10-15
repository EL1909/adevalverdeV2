import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import {
  createBlock, deleteBlock, listBlocks, listCalendar, listSchedule, updateAppointment, updateSchedule,
  type CalendarEvent, type TimeBlock, type WeeklySchedule,
} from '../../api/staff';
import { useAuth } from '../../context/AuthContext';
import { formatBooking } from '../../lib/dates';
import { cn } from '../../lib/utils';
import { ErrorBox, SubTabs, inputClass } from './StoreAdmin';

const APPT_STATUS: Record<string, string> = {
  pending: 'Pendiente de pago', confirmed: 'Confirmada', completed: 'Realizada', cancelled: 'Cancelada',
};

// ── Citas ───────────────────────────────────────────────────────────────────

const Appointments: React.FC = () => {
  const { token } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [past, setPast] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => { if (token) listCalendar(token).then(setEvents).catch(e => setError(e.message)); };
  useEffect(load, [token]);

  const shown = useMemo(() => {
    const now = Date.now();
    return (events ?? [])
      .filter(e => e.display !== 'background')
      .filter(e => (past ? new Date(e.end).getTime() < now : new Date(e.end).getTime() >= now))
      .sort((a, b) => (past ? -1 : 1) * (new Date(a.start).getTime() - new Date(b.start).getTime()));
  }, [events, past]);

  const setStatus = async (e: CalendarEvent, status: string) => {
    const label = status === 'cancelled' ? 'cancelar' : 'marcar como realizada';
    if (!token || !confirm(`¿Seguro que quieres ${label} la cita de ${e.extendedProps.customer_name}?`)) return;
    try {
      await updateAppointment(token, Number(e.id), { status });
      load();
    } catch (err: any) { setError(err.message); }
  };

  if (!events) return <Loader2 className="animate-spin text-gold" />;
  return (
    <div className="space-y-3">
      <SubTabs value={past ? 'past' : 'next'} onChange={v => setPast(v === 'past')}
        tabs={[{ id: 'next', label: 'Próximas' }, { id: 'past', label: 'Pasadas' }]} />
      <ErrorBox error={error} />
      {shown.length === 0 && <p className="text-sm text-mist">{past ? 'Sin citas pasadas.' : 'No hay citas próximas.'}</p>}
      {shown.map(e => {
        const p = e.extendedProps;
        return (
          <div key={e.id} className={cn('glass rounded-2xl p-4 space-y-1', p.status === 'cancelled' && 'opacity-60')}>
            <div className="flex flex-wrap justify-between gap-2">
              <p className="first-letter:uppercase">{formatBooking(e.start)}</p>
              <p className="text-sm text-gold">{APPT_STATUS[p.status ?? ''] ?? p.status}</p>
            </div>
            <p>{p.customer_name} · <span className="text-mist text-sm">{p.customer_email}{p.customer_phone && ` · ${p.customer_phone}`}</span></p>
            <p className="text-sm text-mist">{(p.services ?? []).join(', ') || e.title}{p.order_id && ` · pedido #${p.order_id}`}</p>
            {(p.notes ?? []).map((n, i) => <p key={i} className="text-sm text-mist">“{n.text}”</p>)}
            {p.status === 'confirmed' && (
              <div className="flex gap-3 pt-1 text-sm">
                {past && <button onClick={() => setStatus(e, 'completed')} className="text-gold hover:text-gold-light">Marcar realizada</button>}
                {!past && <button onClick={() => setStatus(e, 'cancelled')} className="text-red-200 hover:text-red-100">Cancelar cita</button>}
              </div>
            )}
          </div>
        );
      })}
      <p className="text-xs text-mist">Cancelar aquí no devuelve el dinero: si estaba pagada, haz la devolución en PayPal o por el mismo medio de pago.</p>
    </div>
  );
};

// ── Horario semanal ─────────────────────────────────────────────────────────

const Schedule: React.FC = () => {
  const { token } = useAuth();
  const [days, setDays] = useState<WeeklySchedule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(null);

  useEffect(() => { if (token) listSchedule(token).then(d => setDays([...d].sort((a, b) => a.weekday - b.weekday))).catch(e => setError(e.message)); }, [token]);

  const save = async (day: WeeklySchedule, patch: Partial<WeeklySchedule>) => {
    if (!token) return;
    setError(null);
    try {
      const updated = await updateSchedule(token, day.id, patch);
      setDays(prev => prev?.map(d => (d.id === updated.id ? updated : d)) ?? null);
      setSaved(day.id);
      setTimeout(() => setSaved(null), 1500);
    } catch (e: any) { setError(e.message); }
  };

  if (!days) return <Loader2 className="animate-spin text-gold" />;
  return (
    <div className="space-y-3">
      <p className="text-sm text-mist">Horario de atención en hora de Madrid. Los cambios se guardan al momento.</p>
      <ErrorBox error={error} />
      <ul className="glass rounded-2xl divide-y divide-white/10">
        {days.map(d => (
          <li key={d.id} className="p-3 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 w-36">
              <input type="checkbox" checked={d.is_open} onChange={e => save(d, { is_open: e.target.checked })} />
              <span className={cn(!d.is_open && 'text-mist')}>{d.weekday_label}</span>
            </label>
            {d.is_open ? (
              <div className="flex items-center gap-2 text-sm">
                <input type="time" defaultValue={d.opens_at.slice(0, 5)} className={cn(inputClass, 'w-auto p-2')}
                  onBlur={e => e.target.value && e.target.value !== d.opens_at.slice(0, 5) && save(d, { opens_at: e.target.value })} />
                a
                <input type="time" defaultValue={d.closes_at.slice(0, 5)} className={cn(inputClass, 'w-auto p-2')}
                  onBlur={e => e.target.value && e.target.value !== d.closes_at.slice(0, 5) && save(d, { closes_at: e.target.value })} />
              </div>
            ) : <span className="text-sm text-mist">Cerrado</span>}
            {saved === d.id && <span className="text-xs text-gold">Guardado</span>}
          </li>
        ))}
      </ul>
    </div>
  );
};

// ── Bloqueos ────────────────────────────────────────────────────────────────

const REASONS: Record<TimeBlock['reason'], string> = {
  vacation: 'Vacaciones', holiday: 'Festivo', personal: 'Asunto personal', maintenance: 'Mantenimiento', other: 'Otro',
};

const Blocks: React.FC = () => {
  const { token } = useAuth();
  const [blocks, setBlocks] = useState<TimeBlock[] | null>(null);
  const [form, setForm] = useState({ start: '', end: '', reason: 'vacation', note: '' });
  const [error, setError] = useState<string | null>(null);

  const load = () => { if (token) listBlocks(token).then(setBlocks).catch(e => setError(e.message)); };
  useEffect(load, [token]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError(null);
    try {
      await createBlock(token, form);
      setForm({ start: '', end: '', reason: 'vacation', note: '' });
      load();
    } catch (err: any) { setError(err.message); }
  };

  const remove = async (b: TimeBlock) => {
    if (!token || !confirm('¿Quitar este bloqueo? Esas horas vuelven a quedar disponibles.')) return;
    try { await deleteBlock(token, b.id); load(); } catch (err: any) { setError(err.message); }
  };

  const upcoming = (blocks ?? []).filter(b => new Date(b.end).getTime() >= Date.now())
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  const fmt = (iso: string) => new Date(iso).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Madrid' });

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="glass rounded-2xl p-4 space-y-3">
        <p className="text-sm text-mist">Bloquea días u horas (hora de Madrid): no se podrán reservar asesorías en ese tramo.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm text-mist">Desde
            <input required type="datetime-local" className={inputClass} value={form.start} onChange={e => setForm(f => ({ ...f, start: e.target.value }))} />
          </label>
          <label className="text-sm text-mist">Hasta
            <input required type="datetime-local" className={inputClass} value={form.end} onChange={e => setForm(f => ({ ...f, end: e.target.value }))} />
          </label>
          <select className={inputClass} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}>
            {Object.entries(REASONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input className={inputClass} placeholder="Nota (opcional)" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
        </div>
        <ErrorBox error={error} />
        <button className="px-5 py-2 rounded-full bg-gold text-ink text-sm font-semibold">Bloquear</button>
      </form>
      {!blocks ? <Loader2 className="animate-spin text-gold" /> : upcoming.length === 0 ? (
        <p className="text-sm text-mist">No hay bloqueos próximos.</p>
      ) : (
        <ul className="glass rounded-2xl divide-y divide-white/10">
          {upcoming.map(b => (
            <li key={b.id} className="p-3 flex items-center gap-3">
              <div className="flex-1">
                <p>{fmt(b.start)} → {fmt(b.end)}</p>
                <p className="text-sm text-mist">{REASONS[b.reason] ?? b.reason_label}{b.note && ` · ${b.note}`}</p>
              </div>
              <button onClick={() => remove(b)} className="p-2 text-mist hover:text-red-300" aria-label="Quitar bloqueo"><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const CalendarAdmin: React.FC = () => {
  const [tab, setTab] = useState('appointments');
  return (
    <div className="space-y-4">
      <SubTabs value={tab} onChange={setTab} tabs={[
        { id: 'appointments', label: 'Citas' },
        { id: 'schedule', label: 'Horario semanal' },
        { id: 'blocks', label: 'Bloqueos' },
      ]} />
      {tab === 'appointments' && <Appointments />}
      {tab === 'schedule' && <Schedule />}
      {tab === 'blocks' && <Blocks />}
    </div>
  );
};
