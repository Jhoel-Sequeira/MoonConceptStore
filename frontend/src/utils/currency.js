export const CURRENCY_SYMBOL = 'C$';
export const CURRENCY_CODE = 'NIO';

export function formatCordobas(value) {
  const amount = Number(value ?? 0);
  return `C$ ${Number.isFinite(amount) ? amount.toLocaleString('es-NI', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) : '0.00'}`;
}

export function formatCordobaDifference(value) {
  const amount = Number(value ?? 0);
  const sign = amount >= 0 ? '+' : '−';
  return `${sign}${formatCordobas(Math.abs(amount))}`;
}
