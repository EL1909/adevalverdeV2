import React, { Suspense, lazy, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { ChevronDown, Loader2, LogOut } from 'lucide-react';
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

/** Sección del perfil, cerrada al entrar: el título la abre y cierra; el contenido, unas 6 filas con scroll. */
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="glass rounded-3xl p-6">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 text-xl text-gold hover:text-gold-light">
        {title}
        <ChevronDown size={20} className={cn('transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="mt-2 max-h-[27rem] overflow-y-auto pr-1">{children}</div>}
    </div>
  );
};

const Profile: React.FC = () => {
  const { user } = useAuth();
  return (
    <div className="space-y-8">
      <div className="glass rounded-3xl p-6 space-y-1">
        <p className="text-lg">{user?.first_name} {user?.last_name}</p>
        <p className="text-mist text-sm">{user?.email}</p>
        {user?.is_superuser && <div className="pt-4"><PushToggle /></div>}
      </div>

      <Section title="Asesorías"><MyBookings /></Section>

      <Section title="Historial de pedidos"><OrderHistory /></Section>

      <Section title="Suscripciones"><MySubscriptions /></Section>

      <Section title="Descargas"><MyDownloads /></Section>
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
