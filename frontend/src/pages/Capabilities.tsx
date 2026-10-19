import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ExternalLink } from 'lucide-react';

// Resumen de capacidades: enlace del footer público (abre en pestaña nueva),
// mismo formato que MCnails y FVJ con la identidad de este sitio.

interface CapabilityGroup {
  label: string;
  modules: { title: string; items: string[] }[];
}

const CAPABILITY_GROUPS: CapabilityGroup[] = [
  {
    label: 'Sitio web público',
    modules: [
      {
        title: 'Tienda y pagos',
        items: [
          'Catálogo de libros, programas y productos digitales con carrito de compras',
          'Pago con PayPal o con métodos manuales (Zelle, transferencia, USDT) que se verifican antes de confirmar',
          'Compra con o sin cuenta, y recibo público con enlace seguro para consultar el pedido',
          'Descargas protegidas: cada PDF lleva un código QR único y se verifica en línea',
        ],
      },
      {
        title: 'Asesorías con cita',
        items: [
          'Días y horarios libres en tiempo real, en hora de Madrid y en la hora local de quien reserva',
          'El horario queda retenido mientras se completa el pago',
          'Al confirmarse: evento en Google Calendar, correo con la invitación adjunta y aviso a la administración',
          'Sesiones gratuitas limitadas a una por persona, con cancelación en línea',
        ],
      },
      {
        title: 'Planes y herramientas',
        items: [
          'Suscripciones mensuales o anuales con renovación automática',
          'Hub de herramientas: cada plan habilita las apps que incluye',
          'Cancelar mantiene el acceso hasta el final del periodo pagado',
        ],
      },
    ],
  },
  {
    label: 'Cuenta de cliente',
    modules: [
      {
        title: 'Una sola cuenta, todo el historial',
        items: [
          'Registro e inicio de sesión por email, con recuperación de contraseña',
          'Historial de pedidos, asesorías, suscripciones y descargas en un solo lugar',
          'Instalable como app en el teléfono o el ordenador (PWA), con funcionamiento básico sin conexión',
        ],
      },
    ],
  },
  {
    label: 'Panel de administración',
    modules: [
      {
        title: 'Tienda',
        items: [
          'Pagos manuales por verificar, con la referencia que declara el cliente',
          'Pedidos con notas y cancelación',
          'Alta y edición de productos con imagen y archivo PDF',
        ],
      },
      {
        title: 'Agenda',
        items: [
          'Calendario de citas por mes, semana o lista, con horario semanal y bloqueos (vacaciones, ausencias)',
          'Citas agendadas a mano desde el calendario: de cortesía, ya pagadas o pendientes de pago con el recibo enviado al cliente',
          'Avisos push al dispositivo cuando entra una nueva reserva o pago',
        ],
      },
      {
        title: 'Clientes y leads',
        items: [
          'Cada persona que reserva queda registrada como lead y pasa a cliente con su primer pago (o a mano)',
          'Ficha por persona con datos de contacto, etiquetas, notas de seguimiento e historial de citas y pedidos',
          'Búsqueda y filtro de leads y clientes en el directorio',
        ],
      },
      {
        title: 'Ingresos',
        items: [
          'Cada cobro (compra, asesoría o renovación) registra automáticamente su ingreso',
          'Devoluciones de PayPal cancelan el pedido y la cita asociada',
        ],
      },
    ],
  },
  {
    label: 'Contenido autogestionable',
    modules: [
      {
        title: 'Edición en el propio sitio',
        items: [
          'Botón "Editar textos": cada texto e imagen se cambia con un clic, sin ayuda técnica',
          'Cada cambio guarda la versión anterior para poder recuperarla',
          'Páginas legales (privacidad y términos) también editables',
        ],
      },
    ],
  },
];

export const Capabilities: React.FC = () => (
  <div className="min-h-dvh">
    <header className="sticky top-0 z-10 bg-ink/90 backdrop-blur border-b border-white/10">
      <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-1.5 text-xs font-semibold text-mist hover:text-gold transition-colors">
          <ChevronLeft size={14} />
          <span>Volver al sitio</span>
        </Link>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-mist/70">
          Resumen de capacidades
        </span>
      </div>
    </header>

    <main className="max-w-3xl mx-auto px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-wider text-gold mb-3">Resumen de capacidades</p>
      <h1 className="text-3xl md:text-4xl text-bone leading-tight mb-4">Sistema web Adela Valverde</h1>
      <p className="text-mist max-w-xl leading-relaxed mb-14">
        Tienda, asesorías con cita, suscripciones y contenido del sitio, todo conectado a una sola cuenta de usuario.
      </p>

      {CAPABILITY_GROUPS.map(group => (
        <div key={group.label}>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-mist/70 mt-14 mb-1">{group.label}</p>
          {group.modules.map(mod => (
            <section key={mod.title} className="py-9 border-b border-white/10">
              <h2 className="text-lg text-gold-light mb-5">{mod.title}</h2>
              <ul className="space-y-3">
                {mod.items.map(item => (
                  <li key={item} className="flex gap-3 text-sm text-mist leading-relaxed">
                    <span className="w-2 h-0.5 bg-gold mt-2.5 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ))}

      <div className="glass mt-16 p-6 rounded-2xl flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-mist/70 font-semibold mb-1">Desarrollo</p>
          <p className="font-semibold text-sm text-bone">Este sistema fue construido por EsfuerzoVZ</p>
        </div>
        <a
          href="https://esfuerzovz.com"
          target="_blank"
          rel="noreferrer"
          className="px-4 py-2.5 rounded-full border border-gold/60 text-gold hover:bg-gold hover:text-ink font-semibold text-xs flex items-center gap-2 transition-colors shrink-0"
        >
          <span>Ver más desarrollos</span>
          <ExternalLink size={14} />
        </a>
      </div>
    </main>
  </div>
);
