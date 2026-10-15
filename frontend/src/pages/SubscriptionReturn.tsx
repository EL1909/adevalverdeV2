import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, Loader2 } from 'lucide-react';
import { syncSubscription } from '../api/payments';
import type { Subscription } from '../api/store';
import { useAuth } from '../context/AuthContext';

// Retorno desde PayPal tras aprobar una suscripción.
export const SubscriptionReturn: React.FC = () => {
  const [params] = useSearchParams();
  const { token } = useAuth();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = Number(params.get('id'));
    if (!token || !id) return;
    syncSubscription(token, id).then(setSub).catch(e => setError(e.message));
  }, [token, params]);

  return (
    <section className="max-w-xl mx-auto px-4 py-16 space-y-6 text-center">
      {!sub && !error && <Loader2 className="animate-spin text-gold mx-auto" />}
      {error && <p className="text-red-300">{error}</p>}
      {sub && (
        <>
          {sub.status === 'ACTIVE' && <CheckCircle className="mx-auto text-gold" size={40} />}
          <h1 className="text-3xl">
            {sub.status === 'ACTIVE' ? '¡Suscripción activa!' : 'Estamos confirmando tu suscripción'}
          </h1>
          <p className="text-mist">
            {sub.status === 'ACTIVE'
              ? `${sub.plan.name}: ya puedes usar tus herramientas.`
              : 'PayPal puede tardar unos minutos. La verás activa en tu cuenta en cuanto se confirme.'}
          </p>
          <Link to="/cuenta" className="inline-block text-gold hover:text-gold-light">Ir a mi cuenta</Link>
        </>
      )}
    </section>
  );
};
