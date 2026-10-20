import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Clock, Loader2 } from 'lucide-react';
import { createBooking, fetchDays, fetchServices, fetchSlots, type DaySlots, type Service, type Slot } from '../api/bookings';
import { fetchPaymentsConfig, type PaymentsConfig } from '../api/payments';
import { Editable } from '../components/Editable';
import { PaymentOptions } from '../components/PaymentOptions';
import { useAuth } from '../context/AuthContext';
import { BUSINESS_TZ, differsFromBusiness, formatDate, formatTime } from '../lib/dates';
import { formatMoney } from '../lib/money';
import { cn, descriptionBox } from '../lib/utils';

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const inputClass = 'w-full p-3 rounded-xl border border-white/15 focus:outline-none focus:border-gold bg-black/40 text-bone placeholder:text-mist/60';

const ymd = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** Calendario mensual: solo se pueden elegir los días con atención. */
const MonthCalendar: React.FC<{ days: string[]; selected: string | null; onSelect: (d: string) => void }> = ({ days, selected, onSelect }) => {
  const open = useMemo(() => new Set(days), [days]);
  const months = useMemo(() => Array.from(new Set(days.map(d => d.slice(0, 7)))), [days]);
  const [index, setIndex] = useState(0);
  if (months.length === 0) return <p className="text-sm text-mist">No hay fechas disponibles por ahora.</p>;

  const [y, m] = months[Math.min(index, months.length - 1)].split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7; // lunes = 0
  const total = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const title = first.toLocaleDateString('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={() => setIndex(i => i - 1)} disabled={index === 0} className="p-2 text-mist hover:text-gold disabled:opacity-30" aria-label="Mes anterior"><ChevronLeft size={18} /></button>
        <p className="first-letter:uppercase">{title}</p>
        <button onClick={() => setIndex(i => i + 1)} disabled={index >= months.length - 1} className="p-2 text-mist hover:text-gold disabled:opacity-30" aria-label="Mes siguiente"><ChevronRight size={18} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-sm">
        {WEEKDAYS.map(d => <span key={d} className="text-xs text-mist py-1">{d}</span>)}
        {Array.from({ length: lead }, (_, i) => <span key={`x${i}`} />)}
        {Array.from({ length: total }, (_, i) => {
          const day = ymd(y, m - 1, i + 1);
          const available = open.has(day);
          return (
            <button
              key={day}
              disabled={!available}
              onClick={() => onSelect(day)}
              className={cn(
                'aspect-square rounded-full transition-colors',
                available ? 'text-bone hover:bg-gold/20' : 'text-mist/30',
                selected === day && 'bg-gold text-ink hover:bg-gold',
              )}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export const Consultations: React.FC = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [services, setServices] = useState<Service[] | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [days, setDays] = useState<string[] | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [slots, setSlots] = useState<DaySlots | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [config, setConfig] = useState<PaymentsConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchServices().then(list => {
      setServices(list);
      // ?sesion=mentoria (botón «Mentoría VIP»): elige la primera sesión cuyo nombre lo contiene.
      // Por nombre y no por ID: los IDs de la base local y la de la VM no coinciden.
      const wanted = normalize(params.get('sesion') ?? '');
      const match = wanted ? list.find(s => normalize(s.name).includes(wanted)) : undefined;
      if (match) setService(match);
      else if (list.length === 1) setService(list[0]);
    }).catch(e => setError(e.message));
    fetchPaymentsConfig().then(setConfig).catch(() => undefined);
  }, []);

  useEffect(() => {
    setDays(null); setDay(null); setSlots(null); setSlot(null);
    if (service) fetchDays(service.id).then(r => setDays(r.days)).catch(e => setError(e.message));
  }, [service]);

  const loadSlots = (d: string) => {
    if (!service) return;
    setDay(d); setSlot(null); setSlots(null); setError(null);
    fetchSlots(service.id, d).then(setSlots).catch(e => setError(e.message));
  };

  const showLocal = differsFromBusiness();
  const free = service ? Number(service.price) === 0 : false;
  const contactReady = !!user || (form.name.trim() !== '' && /\S+@\S+\.\S+/.test(form.email));
  const ready = !!service && !!slot && contactReady;

  const payload = () => ({
    service: service!.id,
    start: slot!.start,
    customer_name: user ? undefined : form.name,
    customer_email: user ? undefined : form.email,
    customer_phone: form.phone,
    message: form.message,
  });

  const onBookingError = (message: string) => {
    setError(message);
    if (day) loadSlots(day); // el horario pudo ocuparse mientras tanto
  };

  const bookFree = async () => {
    setBusy(true); setError(null);
    try {
      const res = await createBooking(payload(), token);
      navigate(`/pedido/${res.receipt}`);
    } catch (e: any) {
      onBookingError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="max-w-4xl mx-auto px-4 py-16 space-y-10">
      <div className="space-y-4">
        <Editable k="consultations.intro.title" as="h1" className="text-4xl">Asesorías</Editable>
        <Editable k="consultations.intro.text" className="text-mist">
          Sesiones personales con Adela. Elige la sesión, el día y la hora; al confirmar recibirás un correo con los detalles.
        </Editable>
      </div>

      {/* 1 · Sesión */}
      <div className="space-y-4">
        <h2 className="text-xl text-gold">1 · Elige tu sesión</h2>
        {!services ? <Loader2 className="animate-spin text-gold" /> : services.length === 0 ? (
          <p className="text-mist">No hay sesiones disponibles en este momento.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {services.map(s => (
              <button
                key={s.id}
                onClick={() => setService(s)}
                className={cn('glass rounded-3xl p-6 text-left space-y-2 border transition-colors',
                  service?.id === s.id ? 'border-gold' : 'border-transparent hover:border-gold/40')}
              >
                <p className="text-lg">{s.name}</p>
                <p className="text-sm text-mist flex items-center gap-2"><Clock size={14} /> {s.minutes} min</p>
                {s.description && <p className={cn('text-sm text-mist', descriptionBox)}>{s.description}</p>}
                <p className="text-gold">{Number(s.price) === 0 ? 'Gratuita' : formatMoney(s.price, s.currency)}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 2 · Día y hora */}
      {service && (
        <div className="space-y-4">
          <h2 className="text-xl text-gold">2 · Día y hora</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="glass rounded-3xl p-6">
              {days ? <MonthCalendar days={days} selected={day} onSelect={loadSlots} /> : <Loader2 className="animate-spin text-gold" />}
            </div>
            <div className="glass rounded-3xl p-6 space-y-3">
              {!day ? (
                <p className="text-sm text-mist">Elige un día en el calendario.</p>
              ) : !slots ? (
                <Loader2 className="animate-spin text-gold" />
              ) : slots.slots.length === 0 ? (
                <p className="text-sm text-mist">No quedan horarios libres el {formatDate(`${day}T12:00:00Z`)}. Prueba otro día.</p>
              ) : (
                <>
                  <p className="text-sm text-mist capitalize">{formatDate(slots.slots[0].start)} · hora de Madrid</p>
                  <div className="grid grid-cols-3 gap-2">
                    {slots.slots.map(s => (
                      <button
                        key={s.start}
                        onClick={() => setSlot(s)}
                        className={cn('py-2 rounded-full border text-sm',
                          slot?.start === s.start ? 'bg-gold text-ink border-gold' : 'border-white/15 hover:border-gold/60')}
                      >
                        {formatTime(s.start, BUSINESS_TZ)}
                        {showLocal && <span className="block text-[10px] opacity-70">{formatTime(s.start)} tu hora</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3 · Datos y pago */}
      {service && slot && (
        <div className="space-y-4">
          <h2 className="text-xl text-gold">3 · Confirma tu reserva</h2>
          <div className="glass rounded-3xl p-6 space-y-3">
            <p>
              <span className="text-gold">{service.name}</span> · <span className="capitalize">{formatDate(slot.start)}</span>, {formatTime(slot.start, BUSINESS_TZ)} (hora de Madrid)
              {showLocal && <span className="text-mist"> · {formatTime(slot.start)} en tu hora local</span>}
            </p>
            {!user && (
              <div className="grid sm:grid-cols-2 gap-3">
                <input className={inputClass} placeholder="Tu nombre" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                <input className={inputClass} type="email" placeholder="Tu correo electrónico" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
            )}
            <input className={inputClass} type="tel" placeholder="Teléfono o WhatsApp (opcional)" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            <textarea className={inputClass} rows={3} placeholder="¿Qué te gustaría trabajar en la sesión? (opcional)" value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} />
            <Editable k="consultations.booking.note" className="text-xs text-mist">
              El horario queda reservado 30 minutos mientras completas el pago. Para cambiar la fecha de una sesión pagada, escríbenos.
            </Editable>
          </div>

          {error && <p className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-sm text-red-200">{error}</p>}
          {busy && <p className="flex items-center gap-2 text-mist"><Loader2 className="animate-spin" size={16} /> Confirmando tu reserva…</p>}

          {!ready ? (
            <p className="text-sm text-mist">Escribe tu nombre y correo para continuar.</p>
          ) : free ? (
            <button onClick={bookFree} disabled={busy} className="w-full bg-gold text-ink py-4 rounded-full font-semibold disabled:opacity-50">
              Reservar sesión
            </button>
          ) : !config ? null : (
            <PaymentOptions
              config={config}
              start={method => { setError(null); return createBooking({ ...payload(), method }, token); }}
              onDone={receipt => navigate(`/pedido/${receipt}`)}
              onError={onBookingError}
              onBusy={setBusy}
            />
          )}
        </div>
      )}
      {error && !slot && <p className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-sm text-red-200">{error}</p>}
    </section>
  );
};
