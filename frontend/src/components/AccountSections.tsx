import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { cancelBooking, fetchMyBookings, type Booking } from '../api/bookings';
import { cancelSubscription } from '../api/payments';
import { fetchMyDownloads, fetchMySubscriptions, type DownloadInfo, type Subscription } from '../api/store';
import { useAuth } from '../context/AuthContext';
import { formatBooking } from '../lib/dates';
import { formatMoney } from '../lib/money';

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

const STATUS: Record<Subscription['status'], string> = {
  APPROVAL_PENDING: 'Pendiente',
  ACTIVE: 'Activa',
  SUSPENDED: 'Pago pendiente',
  CANCELLED: 'Cancelada',
  EXPIRED: 'Vencida',
};

export const MySubscriptions: React.FC = () => {
  const { token } = useAuth();
  const [subs, setSubs] = useState<Subscription[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) fetchMySubscriptions(token).then(setSubs).catch(e => setError(e.message));
  }, [token]);

  const cancel = async (sub: Subscription) => {
    if (!token || !confirm(`¿Cancelar ${sub.plan.name}? Conservas el acceso hasta ${date(sub.current_period_end) || 'el final del periodo'}.`)) return;
    try {
      const updated = await cancelSubscription(token, sub.id);
      setSubs(prev => prev?.map(s => (s.id === updated.id ? updated : s)) ?? null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (error) return <p className="text-sm text-red-300">{error}</p>;
  if (!subs) return <Loader2 className="animate-spin text-gold" size={18} />;
  if (subs.length === 0) return <p className="text-sm text-mist">No tienes suscripciones. <Link to="/planes" className="text-gold">Ver planes</Link></p>;

  return (
    <ul className="divide-y divide-white/10">
      {subs.map(s => (
        <li key={s.id} className="py-3 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm">{s.plan.name} · {formatMoney(s.plan.price, s.plan.currency)}/{s.plan.interval === 'YEAR' ? 'año' : 'mes'}</p>
            <p className="text-xs text-mist">
              {STATUS[s.status]}
              {s.status === 'ACTIVE' && s.current_period_end && ` · se renueva el ${date(s.current_period_end)}`}
              {s.status === 'CANCELLED' && s.current_period_end && ` · acceso hasta el ${date(s.current_period_end)}`}
            </p>
          </div>
          {s.status === 'ACTIVE' && (
            <button onClick={() => cancel(s)} className="text-xs text-mist hover:text-red-300">Cancelar</button>
          )}
        </li>
      ))}
    </ul>
  );
};

export const MyDownloads: React.FC = () => {
  const { token } = useAuth();
  const [downloads, setDownloads] = useState<DownloadInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) fetchMyDownloads(token).then(setDownloads).catch(e => setError(e.message));
  }, [token]);

  if (error) return <p className="text-sm text-red-300">{error}</p>;
  if (!downloads) return <Loader2 className="animate-spin text-gold" size={18} />;
  if (downloads.length === 0) return <p className="text-sm text-mist">Aún no tienes descargas.</p>;

  return (
    <ul className="divide-y divide-white/10">
      {downloads.map(d => (
        <li key={d.token} className="py-3 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm">{d.product}</p>
            <p className="text-xs text-mist">Pedido #{d.order_id} · {date(d.purchased_at)}</p>
          </div>
          {d.available ? (
            <Link to={`/verificar/${d.token}`} className="text-xs text-gold hover:text-gold-light">Descargar</Link>
          ) : (
            <span className="text-xs text-mist">{d.downloaded_at ? `Descargado el ${date(d.downloaded_at)}` : 'Pendiente de pago'}</span>
          )}
        </li>
      ))}
    </ul>
  );
};

const BOOKING_STATUS: Record<Booking['status'], string> = {
  pending: 'Pendiente de pago',
  confirmed: 'Confirmada',
  completed: 'Realizada',
  cancelled: 'Cancelada',
};

export const MyBookings: React.FC = () => {
  const { token } = useAuth();
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) fetchMyBookings(token).then(setBookings).catch(e => setError(e.message));
  }, [token]);

  const cancel = async (b: Booking) => {
    if (!token || !confirm(`¿Cancelar ${b.service}?`)) return;
    try {
      const updated = await cancelBooking(token, b.id);
      setBookings(prev => prev?.map(x => (x.id === updated.id ? updated : x)) ?? null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (error) return <p className="text-sm text-red-300">{error}</p>;
  if (!bookings) return <Loader2 className="animate-spin text-gold" size={18} />;
  if (bookings.length === 0) return <p className="text-sm text-mist">No tienes asesorías. <Link to="/asesorias" className="text-gold">Reservar una</Link></p>;

  return (
    <ul className="divide-y divide-white/10">
      {bookings.map(b => (
        <li key={b.id} className="py-3 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm">{b.service}</p>
            <p className="text-xs text-mist first-letter:uppercase">{formatBooking(b.start)} · {BOOKING_STATUS[b.status]}</p>
          </div>
          {b.can_cancel ? (
            <button onClick={() => cancel(b)} className="text-xs text-mist hover:text-red-300">Cancelar</button>
          ) : b.receipt && (
            <Link to={`/pedido/${b.receipt}`} className="text-xs text-gold hover:text-gold-light">Ver</Link>
          )}
        </li>
      ))}
    </ul>
  );
};
