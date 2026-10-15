import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { startSubscription } from '../api/payments';
import { fetchPlans, type Plan } from '../api/store';
import { TOOL_APPS } from '../apps/registry';
import { AuthModal } from '../components/AuthModal';
import { Editable } from '../components/Editable';
import { useAuth } from '../context/AuthContext';
import { formatMoney } from '../lib/money';

const appNames = (apps: string[]) =>
  apps.includes('*') ? 'Todas las herramientas' : apps.map(s => TOOL_APPS.find(a => a.slug === s)?.name ?? s).join(', ');

export const Plans: React.FC = () => {
  const { isAuthenticated, token } = useAuth();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    fetchPlans().then(setPlans).catch(e => setError(e.message));
  }, []);

  const subscribe = async (plan: Plan) => {
    if (!isAuthenticated || !token) {
      setAuthOpen(true);
      return;
    }
    setPending(plan.id);
    setError(null);
    try {
      const { approve_url } = await startSubscription(token, plan.id);
      window.location.href = approve_url; // aprobación en PayPal; vuelve a /cuenta/suscripcion
    } catch (e: any) {
      setError(e.message);
      setPending(null);
    }
  };

  return (
    <section className="max-w-6xl mx-auto px-4 py-16">
      <Editable k="plans.intro.title" as="h1" className="text-4xl mb-3">Planes</Editable>
      <Editable k="plans.intro.text" className="text-mist mb-10 max-w-2xl">
        Suscríbete a una herramienta o a todas. Puedes cancelar cuando quieras desde tu cuenta y conservas el acceso hasta el final del periodo pagado.
      </Editable>
      {error && <p className="mb-6 text-red-300">{error}</p>}
      {!plans && !error && <Loader2 className="animate-spin text-gold" />}
      {plans?.length === 0 && <p className="text-mist">Muy pronto.</p>}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans?.map(plan => (
          <article key={plan.id} className="glass rounded-3xl p-6 flex flex-col gap-3">
            <h3 className="text-xl text-gold">{plan.name}</h3>
            <p className="text-3xl">
              {formatMoney(plan.price, plan.currency)}
              <span className="text-sm text-mist"> / {plan.interval === 'YEAR' ? 'año' : 'mes'}</span>
            </p>
            <p className="text-xs uppercase tracking-widest text-mist">{appNames(plan.grants)}</p>
            <p className="text-sm text-mist flex-1 whitespace-pre-line">{plan.description}</p>
            <button
              onClick={() => subscribe(plan)}
              disabled={!plan.gateways.includes('paypal') || pending !== null}
              className="mt-2 bg-gold text-ink rounded-full py-3 font-semibold hover:bg-gold-light disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {pending === plan.id && <Loader2 size={16} className="animate-spin" />}
              {plan.gateways.includes('paypal') ? 'Suscribirme' : 'Próximamente'}
            </button>
          </article>
        ))}
      </div>
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} initialMode="register" />
    </section>
  );
};
