export const formatMoney = (value: string | number, currency = 'USD') =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(Number(value));
