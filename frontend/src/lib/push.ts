// Avisos push en este dispositivo (evz_core: /api/business/push/*).
const API = '/api/business/push';

const authHeaders = (token: string): HeadersInit => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` });

export const pushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const urlBase64ToUint8Array = (base64: string) => {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
};

export async function pushConfig(): Promise<{ enabled: boolean; public_key: string }> {
  const res = await fetch(`${API}/public-key/`);
  if (!res.ok) return { enabled: false, public_key: '' };
  return res.json();
}

async function registration() {
  // En desarrollo main.tsx no registra el SW; aquí sí, para poder probar push.
  return (await navigator.serviceWorker.getRegistration()) || navigator.serviceWorker.register('/sw.js');
}

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

export async function enablePush(token: string, publicKey: string) {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('No diste permiso para mostrar avisos en este dispositivo.');
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription())
    || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
  const res = await fetch(`${API}/subscribe/`, { method: 'POST', headers: authHeaders(token), body: JSON.stringify(sub.toJSON()) });
  if (!res.ok) throw new Error('No se pudo activar los avisos.');
}

export async function disablePush(token: string) {
  const sub = await currentSubscription();
  if (!sub) return;
  await fetch(`${API}/unsubscribe/`, { method: 'POST', headers: authHeaders(token), body: JSON.stringify({ endpoint: sub.endpoint }) });
  await sub.unsubscribe();
}
