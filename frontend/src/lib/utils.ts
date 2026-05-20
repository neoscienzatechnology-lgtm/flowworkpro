export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '-';
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return date.toLocaleDateString('pt-BR');
}

export function formatDateTime(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '-';
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return date.toLocaleString('pt-BR');
}

export function formatNumber(value: number): string {
  return value.toLocaleString('pt-BR');
}

export function formatQuantity(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '0';
  const numeric = Number(value);
  return Number.isInteger(numeric)
    ? numeric.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
    : numeric.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}
