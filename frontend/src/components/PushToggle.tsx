import React, { useEffect, useState } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { currentSubscription, disablePush, enablePush, pushConfig, pushSupported } from '../lib/push';

/**
 * Activa los avisos push en este dispositivo. Hoy solo los recibe la
 * administración (nuevas reservas); el ritual diario para clientes llega con
 * La Llave del Día (fase 4).
 */
export const PushToggle: React.FC = () => {
  const { token } = useAuth();
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pushSupported()) return;
    pushConfig().then(c => { if (c.enabled) setPublicKey(c.public_key); });
    currentSubscription().then(s => setActive(!!s));
  }, []);

  if (!publicKey || !token) return null;

  const toggle = async () => {
    setBusy(true); setError(null);
    try {
      if (active) await disablePush(token); else await enablePush(token, publicKey);
      setActive(!active);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <button onClick={toggle} disabled={busy} className="flex items-center gap-2 text-sm text-gold hover:text-gold-light disabled:opacity-50">
        {busy ? <Loader2 size={16} className="animate-spin" /> : active ? <BellOff size={16} /> : <Bell size={16} />}
        {active ? 'Desactivar avisos en este dispositivo' : 'Recibir avisos de nuevas reservas en este dispositivo'}
      </button>
      <p className="text-xs text-mist">En iPhone, primero añade el sitio a la pantalla de inicio.</p>
      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  );
};
