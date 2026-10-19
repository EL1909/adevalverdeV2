import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import momentTimezonePlugin from '@fullcalendar/moment-timezone';
import { Calendar as CalendarIcon, Loader2, Trash2 } from 'lucide-react';
import {
  CLIENT_TAG, addAppointmentNote, createBlock, createManualBooking, deleteBlock, getManualOptions, listBlocks, listCalendar,
  listClients, listSchedule, promoteClient, updateAppointment, updateSchedule,
  type ApiError, type CalendarEvent, type CrmClient, type ManualOptions, type ManualPaymentKind, type TimeBlock, type WeeklySchedule,
} from '../../api/staff';
import { useAuth } from '../../context/AuthContext';
import { BUSINESS_TZ, formatBooking, formatDate } from '../../lib/dates';
import { formatMoney } from '../../lib/money';
import { cn } from '../../lib/utils';
import { ClientTag, NotesThread } from './ClientsAdmin';
import { ErrorBox, SubTabs, inputClass } from './StoreAdmin';

const APPT_STATUS: Record<string, string> = {
  pending: 'Pendiente de pago', confirmed: 'Confirmada', completed: 'Realizada', cancelled: 'Cancelada',
};

// ── Citas ───────────────────────────────────────────────────────────────────

// Colores por estado sobre el fondo oscuro (el backend manda los del panel claro).
const EVENT_COLORS: Record<string, { bg: string; text: string }> = {
  confirmed: { bg: '#D4AF37', text: '#0a0a0a' },
  pending: { bg: '#5c4f22', text: '#F5F5F5' },
  completed: { bg: '#3a3a3a', text: '#B0B0B0' },
  cancelled: { bg: '#4a1d1d', text: '#B0B0B0' },
};

const PAYMENT_OPTIONS: { id: ManualPaymentKind; label: string; hint: string }[] = [
  { id: 'courtesy', label: 'Cortesía', hint: 'Sin cobro. Queda confirmada.' },
  { id: 'paid', label: 'Ya pagada', hint: 'Registra el ingreso y confirma la cita.' },
  { id: 'pending', label: 'Pendiente', hint: 'El cliente recibe el recibo con los datos para pagar.' },
];

const emptyForm = {
  customer_name: '', customer_email: '', customer_phone: '', client_id: 0, client_tags: [] as string[],
  service: '', date: '', start_time: '', end_time: '',
  payment: 'courtesy' as ManualPaymentKind, paid_method: 'zelle', manual_method: '', send_email: true, notes: '',
};

const addMinutes = (hhmm: string, minutes: number) => {
  const [h, m] = hhmm.split(':').map(Number);
  const total = Math.min(h * 60 + m + minutes, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[11px] font-semibold uppercase tracking-widest text-mist/70 mb-1">{children}</p>
);

const Appointments: React.FC = () => {
  const { token } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [options, setOptions] = useState<ManualOptions | null>(null);
  const [panel, setPanel] = useState<'detail' | 'new'>('detail');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [suggestions, setSuggestions] = useState<CrmClient[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [canForce, setCanForce] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<FullCalendar>(null);

  // En una columna (móvil) el panel queda debajo del calendario: se lleva a la vista.
  const showPanel = (id: 'detail' | 'new') => {
    setPanel(id);
    if (window.innerWidth < 1024) setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const load = () => { if (token) listCalendar(token).then(setEvents).catch(e => setError(e.message)); };
  useEffect(load, [token]);
  useEffect(() => { if (token) getManualOptions(token).then(setOptions).catch(e => setError(e.message)); }, [token]);

  // Sugerencias del directorio mientras se escribe el nombre.
  useEffect(() => {
    const q = form.customer_name.trim();
    if (!token || form.client_id || q.length < 2) { setSuggestions([]); return; }
    const id = setTimeout(() => listClients(token, { search: q }).then(r => setSuggestions(r.slice(0, 6))).catch(() => {}), 250);
    return () => clearTimeout(id);
  }, [token, form.customer_name, form.client_id]);

  const selected = events?.find(e => String(e.id) === selectedId) ?? null;
  const serviceMinutes = (id: string) => options?.services.find(s => String(s.id) === id)?.minutes ?? 60;

  const set = <K extends keyof typeof emptyForm>(k: K, v: (typeof emptyForm)[K]) => {
    setForm(f => ({ ...f, [k]: v }));
    setCanForce(false);
  };

  const openNew = (date: string, start: string, end?: string) => {
    setForm(f => ({ ...f, date, start_time: start, end_time: end ?? addMinutes(start, serviceMinutes(f.service)) }));
    setCanForce(false);
    setCreated(null);
    setError(null);
    showPanel('new');
  };

  const pickClient = (c: CrmClient) => {
    setForm(f => ({ ...f, client_id: c.id, client_tags: c.tags, customer_name: c.name, customer_email: c.email, customer_phone: c.phone }));
    setShowSuggestions(false);
  };

  const submit = async (force = false) => {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const res = await createManualBooking(token, {
        start: `${form.date}T${form.start_time}`,
        end: `${form.date}T${form.end_time}`,
        ...(form.service ? { service: Number(form.service) } : {}),
        ...(form.client_id ? { client_id: form.client_id } : {}),
        customer_name: form.customer_name, customer_email: form.customer_email, customer_phone: form.customer_phone,
        payment: form.payment,
        ...(form.payment === 'paid' ? { paid_method: form.paid_method } : {}),
        ...(form.payment === 'pending' && form.manual_method ? { manual_method: Number(form.manual_method) } : {}),
        send_email: form.send_email && !!form.customer_email,
        notes: form.notes,
        force,
      });
      calendarRef.current?.getApi().gotoDate(form.date);
      setForm(emptyForm);
      setCanForce(false);
      setCreated(res.client_id && !form.client_id ? 'Cita creada. La persona quedó registrada como lead.' : 'Cita creada.');
      setSelectedId(String(res.id));
      setPanel('detail');
      load();
    } catch (err) {
      const e = err as ApiError;
      setError(e.message);
      setCanForce(!!e.data?.can_force);
    } finally { setSaving(false); }
  };

  const setStatus = async (e: CalendarEvent, status: string) => {
    const label = status === 'cancelled' ? 'cancelar' : 'marcar como realizada';
    if (!token || !confirm(`¿Seguro que quieres ${label} la cita de ${e.extendedProps.customer_name}?`)) return;
    try {
      await updateAppointment(token, Number(e.id), { status });
      load();
    } catch (err: any) { setError(err.message); }
  };

  const promote = async (clientId: number) => {
    if (!token) return;
    try { await promoteClient(token, clientId); load(); } catch (err: any) { setError(err.message); }
  };

  const calendarEvents = useMemo(() => (events ?? []).map(e => {
    if (e.display === 'background') return { ...e, id: String(e.id), color: 'rgba(255,255,255,0.07)' };
    const c = EVENT_COLORS[e.extendedProps.status ?? ''] ?? EVENT_COLORS.pending;
    return { ...e, id: String(e.id), backgroundColor: c.bg, borderColor: c.bg, textColor: c.text };
  }), [events]);

  const p = selected?.extendedProps;
  const isPast = selected ? new Date(selected.end).getTime() < Date.now() : false;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="glass rounded-3xl p-4 lg:col-span-2 staff-calendar">
        {!events ? <Loader2 className="animate-spin text-gold" /> : (
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin, momentTimezonePlugin]}
            timeZone={BUSINESS_TZ}
            initialView="timeGridWeek"
            headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,listWeek' }}
            locale="es"
            firstDay={1}
            buttonText={{ today: 'Hoy', month: 'Mes', week: 'Semana', list: 'Lista' }}
            allDaySlot={false}
            events={calendarEvents}
            eventClick={info => {
              if (info.event.display === 'background') return;
              setSelectedId(info.event.id);
              setCreated(null);
              showPanel('detail');
            }}
            // dateStr/startStr ya vienen en hora de Madrid (prop timeZone):
            // nunca info.date, que es un Date en la hora del navegador.
            dateClick={info => {
              const hasTime = info.dateStr.length > 10;
              openNew(info.dateStr.slice(0, 10), hasTime ? info.dateStr.slice(11, 16) : '10:00');
            }}
            select={info => {
              if (info.startStr.length <= 10) return; // selección de días completos en la vista mes
              openNew(info.startStr.slice(0, 10), info.startStr.slice(11, 16), info.endStr.slice(11, 16));
            }}
            selectable
            selectMinDistance={5}
            slotMinTime="07:00:00"
            slotMaxTime="22:00:00"
            scrollTime="08:00:00"
            slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
            eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
            height="70vh"
            stickyHeaderDates
            nowIndicator
          />
        )}
        <p className="text-xs text-mist mt-3">Hora de Madrid. Haz clic en un hueco (o arrastra) para agendar; en una cita para ver su detalle.</p>
      </div>

      <div ref={panelRef} className="glass rounded-3xl p-6 scroll-mt-20 lg:max-h-[calc(70vh+5rem)] lg:overflow-y-auto">
        <div className="flex gap-2 mb-6">
          {(['detail', 'new'] as const).map(id => (
            <button key={id} onClick={() => { setPanel(id); setError(null); }}
              className={cn('flex-1 py-2 rounded-xl text-sm border transition-colors',
                panel === id ? 'bg-gold text-ink border-gold font-semibold' : 'border-white/15 text-mist hover:border-gold/60')}>
              {id === 'detail' ? 'Detalle' : '+ Nueva cita'}
            </button>
          ))}
        </div>

        {panel === 'new' ? (
          <form onSubmit={e => { e.preventDefault(); submit(); }} className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg text-bone">Nueva cita</h3>
              {form.date && form.start_time && (
                <span className="text-xs border border-gold/50 text-gold px-2.5 py-1 rounded-full first-letter:uppercase">
                  {formatDate(`${form.date}T12:00:00Z`)} · {form.start_time}
                </span>
              )}
            </div>

            <div className="relative">
              <Label>Cliente *</Label>
              <input required className={inputClass} placeholder="Nombre completo" autoComplete="off"
                value={form.customer_name}
                onChange={e => { setForm(f => ({ ...f, customer_name: e.target.value, client_id: 0, client_tags: [] })); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)} />
              {form.client_id > 0 && (
                <p className="mt-1 text-xs text-mist flex items-center gap-2">Ficha existente <ClientTag tags={form.client_tags} /></p>
              )}
              {showSuggestions && !form.client_id && form.customer_name.trim().length >= 2 && (
                <div className="absolute z-20 mt-1 w-full rounded-xl border border-white/15 bg-ink shadow-xl overflow-hidden">
                  {suggestions.map(c => (
                    <button key={c.id} type="button" onMouseDown={() => pickClient(c)}
                      className="w-full text-left px-3 py-2 hover:bg-white/5 border-b border-white/5 last:border-0">
                      <span className="flex items-center justify-between gap-2 text-sm">{c.name} <ClientTag tags={c.tags} /></span>
                      {(c.email || c.phone) && <span className="block text-xs text-mist">{[c.email, c.phone].filter(Boolean).join(' · ')}</span>}
                    </button>
                  ))}
                  {suggestions.length === 0 && <p className="px-3 py-2 text-xs text-mist">Cliente nuevo: se creará como lead al guardar.</p>}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Email</Label><input type="email" className={inputClass} placeholder="—" value={form.customer_email} onChange={e => set('customer_email', e.target.value)} /></div>
              <div><Label>WhatsApp</Label><input type="tel" className={inputClass} placeholder="—" value={form.customer_phone} onChange={e => set('customer_phone', e.target.value)} /></div>
            </div>

            <div>
              <Label>Servicio</Label>
              <select className={inputClass} value={form.service}
                onChange={e => { const v = e.target.value; setForm(f => ({ ...f, service: v, end_time: f.start_time ? addMinutes(f.start_time, serviceMinutes(v)) : f.end_time })); setCanForce(false); }}>
                <option value="">— Sin servicio —</option>
                {options?.services.map(s => (
                  <option key={s.id} value={s.id}>{s.name} · {s.minutes} min · {Number(s.price) > 0 ? formatMoney(s.price, options.currency) : 'gratis'}</option>
                ))}
              </select>
            </div>
            <div><Label>Fecha *</Label><input required type="date" className={inputClass} value={form.date} onChange={e => set('date', e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Inicio *</Label><input required type="time" className={inputClass} value={form.start_time}
                onChange={e => { const v = e.target.value; setForm(f => ({ ...f, start_time: v, end_time: v ? addMinutes(v, serviceMinutes(f.service)) : f.end_time })); setCanForce(false); }} /></div>
              <div><Label>Fin *</Label><input required type="time" className={inputClass} value={form.end_time} onChange={e => set('end_time', e.target.value)} /></div>
            </div>

            <div>
              <Label>Pago</Label>
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_OPTIONS.map(o => (
                  <button key={o.id} type="button" onClick={() => set('payment', o.id)}
                    className={cn('py-2 rounded-xl text-xs border transition-colors',
                      form.payment === o.id ? 'border-gold text-gold bg-gold/10' : 'border-white/15 text-mist hover:border-gold/50')}>
                    {o.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-mist mt-1">{PAYMENT_OPTIONS.find(o => o.id === form.payment)?.hint}</p>
            </div>
            {form.payment === 'paid' && (
              <div><Label>Cobrado por</Label>
                <select className={inputClass} value={form.paid_method} onChange={e => set('paid_method', e.target.value)}>
                  {options?.paid_methods.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            )}
            {form.payment === 'pending' && (
              <div><Label>Pagará por *</Label>
                <select required className={inputClass} value={form.manual_method} onChange={e => set('manual_method', e.target.value)}>
                  <option value="">— Elegir —</option>
                  {options?.manual_methods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                {options && options.manual_methods.length === 0 && (
                  <p className="text-xs text-mist mt-1">No hay métodos de pago manual activos (admin → Pagos).</p>
                )}
              </div>
            )}

            <label className={cn('flex items-center gap-2 text-sm', !form.customer_email && 'opacity-50')}>
              <input type="checkbox" checked={form.send_email && !!form.customer_email} disabled={!form.customer_email}
                onChange={e => set('send_email', e.target.checked)} />
              {form.payment === 'pending' ? 'Enviar el recibo para pagar' : 'Enviar confirmación por correo'}
            </label>
            <div><Label>Notas</Label><textarea rows={2} className={cn(inputClass, 'resize-none')} placeholder="Notas opcionales…" value={form.notes} onChange={e => set('notes', e.target.value)} /></div>

            <ErrorBox error={error} />
            {canForce && (
              <button type="button" disabled={saving} onClick={() => submit(true)}
                className="w-full py-2 rounded-xl border border-red-400/60 text-red-200 text-sm hover:bg-red-950/40">
                Agendar igualmente (fuera de horario)
              </button>
            )}
            <div className="flex gap-2 pt-1">
              <button disabled={saving} className="flex-1 py-2.5 rounded-xl bg-gold text-ink text-sm font-semibold disabled:opacity-50">
                {saving ? 'Guardando…' : 'Crear cita'}
              </button>
              <button type="button" onClick={() => { setForm(emptyForm); setError(null); setCanForce(false); }}
                className="px-4 py-2.5 rounded-xl text-sm text-mist border border-white/15 hover:border-gold/60">Limpiar</button>
            </div>
          </form>
        ) : !selected || !p ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <CalendarIcon size={32} className="text-mist/40 mb-4" />
            {created ? <p className="text-gold">{created}</p> : <p className="text-lg text-mist">Selecciona una cita</p>}
            <p className="text-sm text-mist/70 mt-1">Haz clic en el calendario</p>
          </div>
        ) : (
          <div className={cn('space-y-5', p.status === 'cancelled' && 'opacity-70')}>
            {created && <p className="text-sm text-gold">{created}</p>}
            <div className="space-y-1">
              <p className="text-sm text-gold">{APPT_STATUS[p.status ?? ''] ?? p.status}{p.source === 'staff' && ' · agendada desde el panel'}</p>
              <h3 className="text-lg text-bone first-letter:uppercase">{formatBooking(selected.start)}</h3>
              <p className="text-sm text-mist">{(p.services ?? []).join(', ') || selected.title}{p.order_id && ` · pedido #${p.order_id}`}</p>
            </div>

            <div className="rounded-2xl bg-white/5 p-4 space-y-2">
              <p className="flex items-center gap-2">{p.customer_name} <ClientTag tags={p.client_tags} /></p>
              <p className="text-sm text-mist break-all">{[p.customer_email, p.customer_phone].filter(Boolean).join(' · ') || 'Sin datos de contacto'}</p>
              {p.client_id && (
                <div className="flex flex-wrap gap-3 pt-1 text-sm">
                  <Link to={`/cuenta?tab=clientes&client=${p.client_id}`} className="text-gold hover:text-gold-light">Ver ficha</Link>
                  {!(p.client_tags ?? []).includes(CLIENT_TAG) && (
                    <button onClick={() => promote(p.client_id!)} className="text-gold hover:text-gold-light">Marcar como cliente</button>
                  )}
                </div>
              )}
            </div>

            {(p.status === 'confirmed' || p.status === 'pending') && (
              <div className="flex flex-wrap gap-3 text-sm">
                {isPast && p.status === 'confirmed' && <button onClick={() => setStatus(selected, 'completed')} className="text-gold hover:text-gold-light">Marcar realizada</button>}
                {!isPast && <button onClick={() => setStatus(selected, 'cancelled')} className="text-red-200 hover:text-red-100">Cancelar cita</button>}
              </div>
            )}

            <div className="space-y-2">
              <Label>Notas de la cita</Label>
              <NotesThread notes={p.notes ?? []} onAdd={async text => { if (token) { await addAppointmentNote(token, Number(selected.id), text); load(); } }} />
            </div>
            <ErrorBox error={error} />
            <p className="text-xs text-mist">Cancelar aquí no devuelve el dinero: si estaba pagada, haz la devolución en PayPal o por el mismo medio de pago.</p>
          </div>
        )}
      </div>
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
