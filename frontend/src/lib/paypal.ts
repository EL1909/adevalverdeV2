// Carga única del SDK de PayPal (botones de pago).
declare global {
  interface Window { paypal?: any }
}

let loading: Promise<any> | null = null;

export function loadPayPal(clientId: string, currency: string): Promise<any> {
  if (window.paypal) return Promise.resolve(window.paypal);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${currency}&intent=capture&components=buttons`;
    script.onload = () => resolve(window.paypal);
    script.onerror = () => {
      loading = null;
      reject(new Error('No se pudo cargar PayPal.'));
    };
    document.head.appendChild(script);
  });
  return loading;
}
