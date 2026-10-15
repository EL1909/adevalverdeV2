import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { fetchMyOrders, type Order } from '../api/store';
import { useAuth } from '../context/AuthContext';
import { formatMoney } from '../lib/money';
import { cn } from '../lib/utils';

const STATUS: Record<string, { label: string; className: string }> = {
  completed: { label: 'Pagado', className: 'text-emerald-300 border-emerald-500/40' },
  confirmed: { label: 'Confirmado', className: 'text-emerald-300 border-emerald-500/40' },
  pending: { label: 'Pendiente', className: 'text-gold border-gold/40' },
  cancelled: { label: 'Cancelado', className: 'text-mist border-white/20' },
};


export const OrderHistory: React.FC = () => {
  const { token } = useAuth();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetchMyOrders(token).then(setOrders).catch(e => setError(e.message));
  }, [token]);

  if (error) return <p className="text-sm text-red-300">{error}</p>;
  if (!orders) return <Loader2 className="animate-spin text-gold" size={18} />;
  if (orders.length === 0) return <p className="text-sm text-mist">Aún no tienes pedidos.</p>;

  return (
    <ul className="divide-y divide-white/10">
      {orders.map(o => {
        const status = STATUS[o.status] ?? STATUS.pending;
        return (
          <li key={o.id} className="py-3 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm text-bone truncate">
                {o.items.map(i => i.product_name || 'Producto').join(', ') || `Pedido #${o.id}`}
              </p>
              <p className="text-xs text-mist">
                #{o.id} · {new Date(o.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
            <div className="text-right shrink-0 space-y-1">
              <p className="text-sm">{formatMoney(o.total)}</p>
              <span className={cn('text-[11px] border rounded-full px-2 py-0.5', status.className)}>{status.label}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
};
