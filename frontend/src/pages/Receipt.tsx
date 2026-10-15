import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarCheck, CheckCircle, Download, Loader2 } from 'lucide-react';
import { fetchReceipt, type Receipt as ReceiptData } from '../api/payments';
import { ManualPaymentPanel } from '../components/ManualPaymentPanel';
import { formatBooking } from '../lib/dates';
import { formatMoney } from '../lib/money';

export const Receipt: React.FC = () => {
  const { receipt = '' } = useParams();
  const [data, setData] = useState<ReceiptData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReceipt(receipt).then(setData).catch(e => setError(e.message));
  }, [receipt]);

  if (error) return <section className="max-w-3xl mx-auto px-4 py-16 text-red-300">{error}</section>;
  if (!data) return <section className="max-w-3xl mx-auto px-4 py-16"><Loader2 className="animate-spin text-gold" /></section>;

  const paid = data.status === 'completed';
  const cancelled = data.status === 'cancelled';
  const booking = data.booking;
  const verifying = data.payment.manual_payment?.status === 'pending';
  const pendingTitle = verifying ? 'Verificando tu pago' : 'pendiente de pago';
  const title = booking
    ? (booking.status === 'confirmed' ? 'Tu asesoría está confirmada' : booking.status === 'cancelled' ? 'Reserva cancelada'
      : verifying ? pendingTitle : `Reserva ${pendingTitle}`)
    : (paid ? 'Gracias por tu compra' : cancelled ? 'Pedido cancelado' : verifying ? pendingTitle : `Pedido ${pendingTitle}`);
  return (
    <section className="max-w-3xl mx-auto px-4 py-16 space-y-8">
      <div className="space-y-2">
        {paid && <CheckCircle className="text-gold" size={36} />}
        <h1 className="text-4xl">{title}</h1>
        <p className="text-mist">Pedido #{data.id} · {data.customer_email}</p>
      </div>

      {booking && (
        <div className="glass rounded-3xl p-6 flex gap-4 items-start">
          <CalendarCheck className="text-gold shrink-0" />
          <div className="space-y-1">
            <p className="text-lg">{booking.service}</p>
            <p className="text-mist first-letter:uppercase">{formatBooking(booking.start)}</p>
            {booking.status === 'confirmed' && (
              <p className="text-sm text-mist">Te enviamos la confirmación por correo, con el evento para tu calendario.</p>
            )}
          </div>
        </div>
      )}

      {!paid && !cancelled && data.payment.manual && (
        <ManualPaymentPanel
          receipt={receipt}
          payment={data.payment}
          total={data.total}
          currency={data.currency}
          onSubmitted={payment => setData({ ...data, payment })}
        />
      )}

      <ul className="glass rounded-3xl divide-y divide-white/10">
        {data.items.map((i, idx) => (
          <li key={idx} className="p-4 flex justify-between gap-4">
            <span>{i.description}{Number(i.quantity) > 1 && ` × ${Number(i.quantity)}`}</span>
            <span className="text-mist">{formatMoney(i.subtotal, data.currency)}</span>
          </li>
        ))}
        <li className="p-4 flex justify-between text-lg">
          <span>Total</span><span className="text-gold">{formatMoney(data.total, data.currency)}</span>
        </li>
      </ul>

      {paid && data.downloads.length > 0 && (
        <div className="glass rounded-3xl p-6 space-y-3">
          <h2 className="text-xl text-gold">Tus descargas</h2>
          <p className="text-sm text-mist">Cada PDF lleva tu código de compra y se descarga una sola vez. También te lo enviamos por correo.</p>
          {data.downloads.map(d => (
            <Link key={d.token} to={`/verificar/${d.token}`} className="flex items-center justify-between p-3 rounded-xl border border-white/10 hover:border-gold/60">
              <span>{d.name}</span>
              <span className="flex items-center gap-2 text-sm text-gold">{d.available ? <><Download size={16} /> Descargar</> : 'Ya descargado'}</span>
            </Link>
          ))}
        </div>
      )}

      <Link to={booking ? '/asesorias' : '/tienda'} className="inline-block text-gold hover:text-gold-light">
        {booking ? 'Volver a asesorías' : 'Volver a la tienda'}
      </Link>
    </section>
  );
};
