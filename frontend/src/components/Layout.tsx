import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Menu, X, User, Pencil, Eye, ShoppingBag, Home, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useContent } from '../context/ContentContext';
import { useCart } from '../context/CartContext';
import { useCatalog } from '../context/CatalogContext';
import { categoryLabel, categorySlug } from '../api/store';
import { AuthModal } from './AuthModal';
import { SocialLinks } from './SocialLinks';
import { cn } from '../lib/utils';

interface NavItem { to: string; label: string }

const SCHOOL: NavItem[] = [
  { to: '/escuela', label: 'Ir a Escuela de Silencio' },
  { to: '/apps', label: 'Herramientas' },
  { to: '/asesorias', label: 'Sesiones y mentorías' },
];

// Botones dorados del sitio anterior (.btn-vip), a ambos lados de los desplegables.
const vipClass = 'border border-gold text-gold px-5 py-2 text-xs font-bold uppercase tracking-wider transition-all hover:bg-gold hover:text-ink hover:shadow-[0_0_15px_rgba(212,175,55,0.4)]';
// Por ahora El Escáner abre el Test de la Coherencia (la herramienta 1 aún no existe).
const ScannerLink: React.FC<{ className?: string }> = ({ className }) => (
  <Link to="/apps/test-coherencia" className={cn(vipClass, className)}>El Escáner</Link>
);
const MentorshipLink: React.FC<{ className?: string }> = ({ className }) => (
  <Link to="/asesorias?sesion=mentoria" className={cn(vipClass, className)}>Mentoría VIP</Link>
);

/** Escritorio: se abre al pasar el ratón o con clic; se cierra al navegar. */
const Dropdown: React.FC<{ label: string; active: boolean; children: React.ReactNode }> = ({ label, active, children }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { pathname, search } = useLocation();
  useEffect(() => setOpen(false), [pathname, search]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={ref} className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      {/* En pantallas táctiles el toque dispara mouseenter y luego click: un toggle lo cerraría en el acto. */}
      <button onClick={() => setOpen(true)} aria-expanded={open}
        className={cn('flex items-center gap-1 text-sm uppercase tracking-wide transition-colors', active || open ? 'text-gold' : 'text-mist hover:text-bone')}>
        {label} <ChevronDown size={14} className={cn('transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        // pt-3: puente invisible para que el menú no se cierre al bajar el ratón.
        <div className="absolute left-1/2 -translate-x-1/2 top-full pt-3 min-w-[240px]">
          <div className="bg-ink border border-white/10 rounded-2xl shadow-xl py-2">{children}</div>
        </div>
      )}
    </div>
  );
};

/**
 * Inicio, carrito y cuenta, plegados tras una hamburguesa: se despliegan en fila
 * hacia la izquierda al pasar el ratón, con clic o al llegar con el teclado.
 */
const IconTray: React.FC<{ badge: boolean; children: React.ReactNode }> = ({ badge, children }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { pathname, search } = useLocation();
  useEffect(() => setOpen(false), [pathname, search]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={ref} className="flex items-center" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
      onBlur={e => { if (!ref.current?.contains(e.relatedTarget as Node)) setOpen(false); }}>
      <div inert={!open} className={cn('flex items-center gap-1 py-1 overflow-hidden transition-all duration-300',
        open ? 'max-w-[160px] opacity-100' : 'max-w-0 opacity-0')}>
        {children}
      </div>
      {/* Como en Dropdown: en táctil el toque dispara mouseenter y luego click, así que el clic solo abre. */}
      <button onClick={() => setOpen(true)} aria-expanded={open} aria-label="Accesos"
        className={cn('relative p-2 transition-colors', open ? 'text-gold' : 'text-mist hover:text-gold')}>
        <Menu size={22} />
        {badge && !open && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-gold" />}
      </button>
    </div>
  );
};

/** Móvil: sección plegable dentro del menú. */
const MobileSection: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(o => !o)} aria-expanded={open}
        className={cn('w-full flex items-center justify-between text-sm uppercase tracking-wide', open ? 'text-gold' : 'text-mist')}>
        {label} <ChevronDown size={16} className={cn('transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="mt-3 ml-3 pl-3 border-l border-white/10 flex flex-col gap-3">{children}</div>}
    </div>
  );
};

export const Layout: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const { canEdit, editMode, setEditMode } = useContent();
  const { count } = useCart();
  const { menu } = useCatalog();
  const { pathname, search } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  useEffect(() => setMenuOpen(false), [pathname, search]);

  const current = pathname + search;
  const umbral: NavItem[] = menu.map(c => ({ to: `/tienda?categoria=${categorySlug(c)}`, label: categoryLabel(c) }));
  // En modo edición Adela ve, al final de El Umbral, el atajo para elegir sus categorías.
  const pickCategories = canEdit && editMode
    ? <Link to="/cuenta?tab=tienda&sub=products" className="flex items-center gap-2 text-xs text-gold/80 hover:text-gold"><Pencil size={12} /> Elegir categorías</Link>
    : null;

  const itemClass = (to: string) =>
    cn('text-sm transition-colors', current === to ? 'text-gold' : 'text-mist hover:text-bone');
  const dropItem = (n: NavItem) => (
    <Link key={n.to} to={n.to} className={cn(itemClass(n.to), 'block px-5 py-2 hover:bg-white/5')}>{n.label}</Link>
  );

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-50 bg-ink/90 backdrop-blur border-b border-white/10 uppercase">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/sobre-mi" className="group font-title text-[22px] leading-none tracking-wide whitespace-nowrap">
            <span className="font-bold text-white transition-colors group-hover:text-gold">Adela</span> <span className="text-gold">Valverde</span>
          </Link>

          <nav className="hidden lg:flex items-center gap-8 whitespace-nowrap">
            <ScannerLink />
            <Dropdown label="El Umbral" active={pathname === '/tienda'}>
              {umbral.length ? umbral.map(dropItem) : <p className="px-5 py-2 text-sm text-mist">Pronto</p>}
              {pickCategories && <div className="px-5 pt-2 mt-1 border-t border-white/10">{pickCategories}</div>}
            </Dropdown>
            <Dropdown label="Escuela de Silencio" active={SCHOOL.some(n => n.to === pathname)}>
              {SCHOOL.map(dropItem)}
            </Dropdown>
            <MentorshipLink />
          </nav>

          <div className="flex items-center gap-1">
            <IconTray badge={count > 0}>
              <NavLink to="/" end className={({ isActive }) => cn('p-2', isActive ? 'text-gold' : 'text-mist hover:text-gold')} aria-label="Inicio">
                <Home size={20} />
              </NavLink>
              <Link to="/carrito" className="relative p-2 text-mist hover:text-gold" aria-label="Carrito">
                <ShoppingBag size={20} />
                {count > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-gold text-ink text-[10px] font-bold flex items-center justify-center">{count}</span>
                )}
              </Link>
              {isAuthenticated ? (
                <NavLink to="/cuenta" title={user?.first_name || 'Mi cuenta'} aria-label="Mi cuenta"
                  className={({ isActive }) => cn('p-2', isActive ? 'text-gold' : 'text-mist hover:text-gold')}>
                  <User size={20} />
                </NavLink>
              ) : (
                <button onClick={() => setAuthOpen(true)} title="Entrar" aria-label="Entrar" className="p-2 text-mist hover:text-gold">
                  <User size={20} />
                </button>
              )}
            </IconTray>
            {/* La hamburguesa ya es de los accesos: el menú móvil se abre con texto. */}
            <button className="lg:hidden flex items-center gap-1 p-2 text-xs uppercase tracking-wider text-mist hover:text-gold" onClick={() => setMenuOpen(o => !o)} aria-expanded={menuOpen}>
              Menú {menuOpen ? <X size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav className="lg:hidden flex flex-col gap-4 px-4 pb-4">
            <ScannerLink className="text-center" />
            <MobileSection label="El Umbral">
              {umbral.length ? umbral.map(n => <Link key={n.to} to={n.to} className={itemClass(n.to)}>{n.label}</Link>)
                : <p className="text-sm text-mist">Pronto</p>}
              {pickCategories}
            </MobileSection>
            <MobileSection label="Escuela de Silencio">
              {SCHOOL.map(n => <Link key={n.to} to={n.to} className={itemClass(n.to)}>{n.label}</Link>)}
            </MobileSection>
            <MentorshipLink className="text-center" />
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
