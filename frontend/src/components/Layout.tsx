import React, { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Menu, X, User, Pencil, Eye, ShoppingBag } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useContent } from '../context/ContentContext';
import { useCart } from '../context/CartContext';
import { AuthModal } from './AuthModal';
import { SocialLinks } from './SocialLinks';
import { cn } from '../lib/utils';

const NAV = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/sobre-mi', label: 'Sobre mí' },
  { to: '/escuela', label: 'Escuela' },
  { to: '/apps', label: 'Herramientas' },
  { to: '/tienda', label: 'Tienda' },
  { to: '/planes', label: 'Planes' },
  { to: '/asesorias', label: 'Asesorías' },
];

export const Layout: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const { canEdit, editMode, setEditMode } = useContent();
  const { count } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn('text-sm tracking-wide transition-colors', isActive ? 'text-gold' : 'text-mist hover:text-bone');

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-50 bg-ink/90 backdrop-blur border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="font-title text-xl text-gold tracking-wide">Adela Valverde</Link>

          <nav className="hidden md:flex items-center gap-8">
            {NAV.map(n => <NavLink key={n.to} to={n.to} end={n.end} className={linkClass}>{n.label}</NavLink>)}
          </nav>

          <div className="flex items-center gap-3">
            <Link to="/carrito" className="relative p-2 text-mist hover:text-gold" aria-label="Carrito">
              <ShoppingBag size={20} />
              {count > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-gold text-ink text-[10px] font-bold flex items-center justify-center">{count}</span>
              )}
            </Link>
            {isAuthenticated ? (
              <NavLink to="/cuenta" className="flex items-center gap-2 text-sm text-mist hover:text-gold">
                <User size={18} /> <span className="hidden sm:inline">{user?.first_name || 'Mi cuenta'}</span>
              </NavLink>
            ) : (
              <button onClick={() => setAuthOpen(true)} className="text-sm border border-gold/60 text-gold px-4 py-1.5 rounded-full hover:bg-gold hover:text-ink transition-colors">
                Entrar
              </button>
            )}
            <button className="md:hidden p-2 text-mist" onClick={() => setMenuOpen(o => !o)} aria-label="Menú">
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav className="md:hidden flex flex-col gap-4 px-4 pb-4">
            {NAV.map(n => (
              <NavLink key={n.to} to={n.to} end={n.end} className={linkClass} onClick={() => setMenuOpen(false)}>{n.label}</NavLink>
            ))}
          </nav>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-mist">
          <div className="space-x-4">
            <span>© {new Date().getFullYear()} Adela Valverde</span>
            <Link to="/privacidad" className="hover:text-gold">Privacidad</Link>
            <Link to="/terminos" className="hover:text-gold">Términos</Link>
          </div>
          <SocialLinks className="flex items-center gap-4" />
        </div>
        <div className="border-t border-white/10">
          <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-mist/70">
            <a href="/capacidades" target="_blank" rel="noreferrer" className="font-semibold hover:text-gold transition-colors">
              Capacidades de este website
            </a>
            <a href="https://esfuerzovz.com" target="_blank" rel="noreferrer" className="hover:text-gold transition-colors">
              Desarrollado por EsfuerzoVZ
            </a>
          </div>
        </div>
      </footer>

      {canEdit && (
        <button
          onClick={() => setEditMode(!editMode)}
          className={cn(
            'fixed bottom-5 right-5 z-50 flex items-center gap-2 px-5 py-3 rounded-full shadow-xl text-sm font-semibold transition-colors',
            editMode ? 'bg-gold text-ink' : 'bg-ink border border-gold/60 text-gold',
          )}
        >
          {editMode ? <><Eye size={16} /> Ver como visitante</> : <><Pencil size={16} /> Editar textos</>}
        </button>
      )}

      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
};
