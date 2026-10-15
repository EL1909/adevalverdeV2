import React, { useEffect, useRef } from 'react';
import { captureCheckout, type CheckoutResult, type PaymentsConfig } from '../api/payments';
import { loadPayPal } from '../lib/paypal';
import { Editable } from './Editable';

interface Props {
  config: PaymentsConfig;
  /** Crea el pedido en el backend; se llama al pulsar el botón. */
  start: () => Promise<CheckoutResult>;
  onPaid: (receipt: string) => void;
  onError: (message: string) => void;
  onBusy?: (busy: boolean) => void;
}

/**
 * Botones de PayPal: crean el pedido con `start`, y tras la aprobación
 * capturan el cobro en el backend. Se montan una vez; leen las props
 * actuales por ref para no re-renderizar el iframe de PayPal.
 */
export const PayPalButtons: React.FC<Props> = props => {
  const container = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const receipt = useRef<string | null>(null);
  const startFailed = useRef(false);
  const { paypal_client_id, currency } = props.config;

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    let cancelled = false;
    loadPayPal(paypal_client_id, currency).then(paypal => {
      if (cancelled || !paypal) return;
      el.innerHTML = '';
      paypal.Buttons({
        style: { color: 'gold', shape: 'pill', label: 'pay' },
        createOrder: async () => {
          try {
            const res = await latest.current.start();
            receipt.current = res.receipt;
            return res.paypal_order_id;
          } catch (e: any) {
            // Mensaje del backend (ej. horario ocupado); PayPal solo daría uno genérico.
            startFailed.current = true;
            latest.current.onError(e.message);
            throw e;
          }
        },
        onApprove: async () => {
          latest.current.onBusy?.(true);
          try {
            const res = await captureCheckout(receipt.current!);
            if (res.status !== 'completed') throw new Error('El pago no se completó. Revisa tu cuenta de PayPal o escríbenos.');
            latest.current.onPaid(res.receipt);
          } catch (e: any) {
            latest.current.onError(e.message);
          } finally {
            latest.current.onBusy?.(false);
          }
        },
        onError: (err: any) => {
          if (startFailed.current) { startFailed.current = false; return; }
          latest.current.onError(err?.message || 'PayPal no pudo procesar el pago.');
        },
      }).render(el);
    }).catch(e => latest.current.onError(e.message));
    return () => { cancelled = true; el.innerHTML = ''; };
  }, [paypal_client_id, currency]);

  return (
    <div className="space-y-2">
      <div ref={container} className="min-h-[50px]" />
      <Editable k="checkout.currency.note" className="text-xs text-mist text-center">
        Los precios están en dólares (USD). Si pagas con otra moneda, PayPal hace la conversión al tipo de cambio del día.
      </Editable>
    </div>
  );
};
