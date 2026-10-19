import React, { Suspense, lazy } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Loader2, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { OrderHistory } from '../components/OrderHistory';
import { MyBookings, MyDownloads, MySubscriptions } from '../components/AccountSections';
import { PushToggle } from '../components/PushToggle';
import { StoreAdmin } from '../components/staff/StoreAdmin';
import { cn } from '../lib/utils';

// Paneles de staff aparte: FullCalendar pesa y el público nunca lo usa.
const CalendarAdmin = lazy(() => import('../components/staff/CalendarAdmin').then(m => ({ default: m.CalendarAdmin })));
const ClientsAdmin = lazy(() => import('../components/staff/ClientsAdmin').then(m => ({ default: m.ClientsAdmin })));

const TABS = [
  { id: 'perfil', label: 'Perfil' },
  { id: 'tienda', label: 'Tienda' },
  { id: 'calendario', label: 'Calendario' },
  { id: 'clientes', label: 'Clientes' },
];

const Profile: React.FC = () => {
  const { user } = useAuth();
  return (
    <div className="space-y-8">
      <div className="glass rounded-3xl p-6 space-y-1">
        <p className="text-lg">{user?.first_name} {user?.last_name}</p>
        <p className="text-mist text-sm">{user?.email}</p>
        {user?.is_superuser && <div className="pt-4"><PushToggle /></div>}
      </div>

      <div className="glass rounded-3xl p-6">
        <h2 className="text-xl text-gold mb-2">Asesorías</h2>
        <MyBookings />
      </div>

      <div className="glass rounded-3xl p-6">
        <h2 className="text-xl text-gold mb-2">Historial de pedidos</h2>
        <OrderHistory />
      </div>

      <div className="glass rounded-3xl p-6">
        <h2 className="text-xl text-gold mb-2">Suscripciones</h2>
        <MySubscriptions />
      </div>

      <div className="glass rounded-3xl p-6">
        <h2 className="text-xl text-gold mb-2">Descargas</h2>
        <MyDownloads />
      </div>
    </div>
  );
};

export const Account: React.FC = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const [params, setParams] = useSearchParams();
  if (!isAuthenticated) return <Navigate to="/" replace />;

  // Tienda, Calendario y Clientes son el panel de Adela: solo para el staff.
  const staff = !!user?.is_staff;
  const tab = staff && TABS.some(t => t.id === params.get('tab')) ? params.get('tab')! : 'perfil';

  return (
    // Calendario y Clientes van a dos columnas: necesitan más ancho.
    <section className={cn('mx-auto px-4 py-16 space-y-8', tab === 'calendario' || tab === 'clientes' ? 'max-w-7xl' : 'max-w-4xl')}>
      <div className="flex items-center justify-between">
        <h1 className="text-4xl">Mi cuenta</h1>
        <button onClick={logout} className="text-sm text-mist hover:text-gold flex items-center gap-2">
          <LogOut size={16} /> Salir
        </button>
      </div>

      {staff && (
        <nav className="flex gap-1 border-b border-white/10" aria-label="Secciones de la cuenta">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setParams(t.id === 'perfil' ? {} : { tab: t.id })}
              className={cn('px-4 py-2 -mb-px border-b-2 text-sm',
                tab === t.id ? 'border-gold text-gold' : 'border-transparent text-mist hover:text-bone')}>
              {t.label}
            </button>
          ))}
        </nav>
      )}

      {tab === 'perfil' && <Profile />}
      {tab === 'tienda' && <StoreAdmin />}
      <Suspense fallback={<Loader2 className="animate-spin text-gold" />}>
        {tab === 'calendario' && <CalendarAdmin />}
        {tab === 'clientes' && <ClientsAdmin />}
      </Suspense>
    </section>
  );
};
