import React, { useState } from 'react';
import { Check, Clock, Copy, Loader2, XCircle } from 'lucide-react';
import { submitManualPayment, type PaymentState } from '../api/payments';
import { formatMoney } from '../lib/money';

const inputClass = 'w-full p-3 rounded-xl border border-white/15 focus:outline-none focus:border-gold bg-black/40 text-bone placeholder:text-mist/60';

const CopyRow: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => undefined);
  };
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-white/10">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-mist">{label}</p>
        <p className="break-all">{value}</p>
      </div>
      <button onClick={copy} className="p-2 text-mist hover:text-gold shrink-0" aria-label={`Copiar ${label}`}>
        {copied ? <Check size={16} className="text-gold" /> : <Copy size={16} />}
      </button>
    </div>
  );
};

/** Recibo de un pedido con pago manual: datos para pagar y referencia del cliente. */
export const ManualPaymentPanel: React.FC<{
  receipt: string;
  payment: PaymentState;
  total: string;
  currency: string;
  onSubmitted: (state: PaymentState) => void;
}> = ({ receipt, payment, total, currency, onSubmitted }) => {
  const [reference, setReference] = useState('');
  const [proof, setProof] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const method = payment.manual;
  const last = payment.manual_payment;
  if (!method) return null;

  const send = async () => {
    setBusy(true); setError(null);
    try {
      onSubmitted(await submitManualPayment(receipt, reference.trim(), proof));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (last?.status === 'pending') {
    return (
      <div className="glass rounded-3xl p-6 flex gap-4 items-start">
        <Clock className="text-gold shrink-0" />
        <div className="space-y-1">
          <p className="text-lg">Estamos verificando tu pago</p>
          <p className="text-sm text-mist">
            Referencia {last.reference}. Te escribiremos en cuanto lo confirmemos; suele ser en menos de un día hábil.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass rounded-3xl p-6 space-y-4">
      {last?.status === 'rejected' && (
        <p className="flex gap-2 p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-sm text-red-200">
          <XCircle size={18} className="shrink-0" /> No pudimos confirmar el pago anterior: {last.rejection_reason}
        </p>
      )}
      <h2 className="text-xl text-gold">Paga por {method.name}</h2>
      <p className="text-sm text-mist">Importe exacto: <span className="text-bone">{formatMoney(total, currency)}</span></p>
      <div className="space-y-2">
        {method.details.map(d => <CopyRow key={d.label} label={d.label} value={d.value} />)}
      </div>
      {method.instructions && <p className="text-sm text-mist whitespace-pre-line">{method.instructions}</p>}

      <div className="space-y-3 pt-2">
        <p className="text-sm">Cuando hayas pagado, indícanos la referencia:</p>
        <input className={inputClass} value={reference} onChange={e => setReference(e.target.value)}
          placeholder={method.kind === 'crypto' ? 'Hash de la transacción' : 'Número de confirmación'} />
        <label className="block text-sm text-mist">
          Comprobante (opcional)
          <input type="file" accept="image/*,application/pdf" className="block mt-1 text-sm"
            onChange={e => setProof(e.target.files?.[0] ?? null)} />
        </label>
        {error && <p className="text-sm text-red-300">{error}</p>}
        <button onClick={send} disabled={busy || !reference.trim()}
          className="w-full bg-gold text-ink py-3 rounded-full font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
          {busy && <Loader2 size={16} className="animate-spin" />} Ya pagué
        </button>
      </div>
    </div>
  );
};
