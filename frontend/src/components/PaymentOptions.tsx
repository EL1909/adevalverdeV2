import React, { useState } from 'react';
import { Landmark, Wallet } from 'lucide-react';
import type { CheckoutResult, ManualMethod, PaymentChoice, PaymentsConfig } from '../api/payments';
import { PayPalButtons } from './PayPalButtons';
import { cn } from '../lib/utils';

interface Props {
  config: PaymentsConfig;
  /** Crea el pedido (o la reserva) con el método elegido. */
  start: (method: PaymentChoice) => Promise<CheckoutResult>;
  /** Pedido pagado con PayPal, o creado a la espera de un pago manual. */
  onDone: (receipt: string) => void;
  onError: (message: string) => void;
  onBusy?: (busy: boolean) => void;
}

const ICON: Record<ManualMethod['kind'], React.ReactNode> = {
  zelle: <Wallet size={16} />,
  bank: <Landmark size={16} />,
  crypto: <Wallet size={16} />,
};

/**
 * PayPal y los métodos manuales que Adela tenga activos. Con un manual, el
 * pedido se crea y el recibo muestra los datos para pagar y dónde indicar
 * la referencia.
 */
export const PaymentOptions: React.FC<Props> = ({ config, start, onDone, onError, onBusy }) => {
  const options: PaymentChoice[] = [
    ...(config.paypal_enabled ? ['paypal' as const] : []),
    ...config.manual_methods.map(m => m.id),
  ];
  const [choice, setChoice] = useState<PaymentChoice | null>(options[0] ?? null);
  const [busy, setBusy] = useState(false);

  if (options.length === 0) return <p className="text-sm text-mist">Los pagos aún no están habilitados.</p>;

  const manual = config.manual_methods.find(m => m.id === choice);

  const confirmManual = async () => {
    if (!manual) return;
    setBusy(true); onBusy?.(true);
    try {
      const res = await start(manual.id);
      onDone(res.receipt);
    } catch (e: any) {
      onError(e.message);
    } finally {
      setBusy(false); onBusy?.(false);
    }
  };

  return (
    <div className="space-y-4">
      {options.length > 1 && (
        <div className="grid sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Método de pago">
          {options.map(opt => {
            const method = config.manual_methods.find(m => m.id === opt);
            return (
              <button
                key={String(opt)}
                role="radio"
                aria-checked={choice === opt}
                onClick={() => setChoice(opt)}
                className={cn('flex items-center gap-2 p-3 rounded-xl border text-left text-sm',
                  choice === opt ? 'border-gold text-bone' : 'border-white/15 text-mist hover:border-gold/50')}
              >
                {method ? ICON[method.kind] : <Wallet size={16} />}
                {method ? method.name : 'PayPal o tarjeta'}
              </button>
            );
          })}
        </div>
      )}

      {choice === 'paypal' && (
        <PayPalButtons config={config} start={() => start('paypal')} onPaid={onDone} onError={onError} onBusy={onBusy} />
      )}

      {manual && (
        <div className="space-y-3">
          <p className="text-sm text-mist">
            Al confirmar verás los datos para pagar por {manual.name}. Cuando hayas pagado, indica la referencia
            en la página del pedido; te confirmaremos en cuanto lo verifiquemos.
          </p>
          <button onClick={confirmManual} disabled={busy}
            className="w-full bg-gold text-ink py-4 rounded-full font-semibold disabled:opacity-50">
            Confirmar y ver datos de pago
          </button>
        </div>
      )}
    </div>
  );
};
