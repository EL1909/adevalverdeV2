// Las asesorías se agendan en hora de Madrid; quien reserva desde otro país
// ve además su hora local.
export const BUSINESS_TZ = 'Europe/Madrid';

export const browserTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

const offsetMinutes = (tz: string, at: Date) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(at);
  const v = (t: string) => Number(parts.find(p => p.type === t)?.value);
  return (Date.UTC(v('year'), v('month') - 1, v('day'), v('hour'), v('minute')) - at.getTime()) / 60000;
};

/** ¿La hora del navegador difiere de la de Madrid en esa fecha? */
export const differsFromBusiness = (at: Date = new Date()) =>
  Math.round(offsetMinutes(browserTz(), at)) !== Math.round(offsetMinutes(BUSINESS_TZ, at));

export const formatTime = (iso: string, tz?: string) =>
  new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: tz });

export const formatDate = (iso: string, tz: string = BUSINESS_TZ) =>
  new Date(iso).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz });

/** "martes 21 de octubre, 10:00 (hora de Madrid)" + la local si difiere. */
export const formatBooking = (iso: string) => {
  const madrid = `${formatDate(iso)}, ${formatTime(iso, BUSINESS_TZ)} (hora de Madrid)`;
  return differsFromBusiness(new Date(iso)) ? `${madrid} · ${formatTime(iso)} en tu hora local` : madrid;
};
