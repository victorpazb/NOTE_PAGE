export const ROOM_TYPES = Object.freeze([
  { id: 'single', name: 'Quarto Single', rate: 9990, capacity: 1 },
  { id: 'double', name: 'Quarto Duplo', rate: 12000, capacity: 2 },
  { id: 'triple', name: 'Quarto Triplo', rate: 15000, capacity: 3 },
]);
const DAY_MS = 86400000;
const SMALL = {
  10: 'dez', 11: 'onze', 12: 'doze', 13: 'treze', 14: 'quatorze',
  15: 'quinze', 16: 'dezesseis', 17: 'dezessete', 18: 'dezoito', 19: 'dezenove',
  9: 'nove', 8: 'oito', 7: 'sete', 6: 'seis', 5: 'cinco',
  4: 'quatro', 3: 'três', 2: 'dois', 1: 'um', 0: 'zero',
};
const TENS = { 9: 'noventa', 8: 'oitenta', 7: 'setenta', 6: 'sessenta', 5: 'cinquenta', 4: 'quarenta', 3: 'trinta', 2: 'vinte' };
const HUNDREDS = { 9: 'novecentos', 8: 'oitocentos', 7: 'setecentos', 6: 'seiscentos', 5: 'quinhentos', 4: 'quatrocentos', 3: 'trezentos', 2: 'duzentos', 1: 'cento' };
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const currency = (cents) => brl.format(cents / 100);

export function formatBrazilianTaxId(value) {
  const digits = String(value ?? '').replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return digits.slice(0, 3) + '.' + digits.slice(3);
  if (digits.length <= 9) return digits.slice(0, 3) + '.' + digits.slice(3, 6) + '.' + digits.slice(6);
  if (digits.length <= 11) return digits.slice(0, 3) + '.' + digits.slice(3, 6) + '.' + digits.slice(6, 9) + '-' + digits.slice(9);
  return digits.slice(0, 2) + '.' + digits.slice(2, 5) + '.' + digits.slice(5, 8) + '/' + digits.slice(8, 12)
    + (digits.length > 12 ? '-' + digits.slice(12) : '');
}

export function brazilianTaxIdType(value) {
  const digits = String(value ?? '').replace(/\D/g, '').slice(0, 14);
  if (!digits) return '';
  return digits.length <= 11 ? 'CPF' : 'CNPJ';
}

function groupWords(value) {
  if (value in SMALL) return SMALL[value];
  if (value === 100) return 'cem';
  if (value < 100) return TENS[Math.floor(value / 10)] + (value % 10 ? ' e ' + SMALL[value % 10] : '');
  return HUNDREDS[Math.floor(value / 100)] + (value % 100 ? ' e ' + groupWords(value % 100) : '');
}

function integerWords(value) {
  if (value < 1000) return groupWords(value);
  const scales = [[1e12, 'trilhão', 'trilhões'], [1e9, 'bilhão', 'bilhões'], [1e6, 'milhão', 'milhões'], [1000, 'mil', 'mil'], [1, '', '']];
  const parts = [];
  let remaining = value;
  for (const [scale, singular, multiple] of scales) {
    const group = Math.floor(remaining / scale);
    if (!group) continue;
    const prefix = parts.length && (remaining < 100 || remaining % 100 === 0 && remaining < 1000) ? ' e ' : parts.length ? ' ' : '';
    const words = scale === 1000 && group === 1 ? 'mil' : groupWords(group) + (singular ? ' ' + (group === 1 ? singular : multiple) : '');
    parts.push(prefix + words);
    remaining %= scale;
  }
  return parts.join('');
}
export function currencyWords(cents) {
  const value = Math.max(0, Math.round(cents));
  const reais = Math.floor(value / 100);
  const fraction = value % 100;
  const whole = integerWords(reais) + (reais === 1 ? ' real' : reais && reais % 1e6 === 0 ? ' de reais' : ' reais');
  const decimal = fraction ? integerWords(fraction) + (fraction === 1 ? ' centavo' : ' centavos') : '';
  return reais || !fraction ? whole + (decimal ? ' e ' + decimal : '') : decimal;
}
export function dateTimestamp(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return NaN;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1900 || year > 9999) return NaN;
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day ? timestamp : NaN;
}
export function localToday() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
}
export function addDays(date, days) {
  const timestamp = dateTimestamp(date);
  if (!Number.isFinite(timestamp) || !Number.isInteger(days)) return '';
  const shifted = new Date(timestamp + days * DAY_MS);
  return Number.isFinite(shifted.getTime()) && shifted.getUTCFullYear() >= 1900 && shifted.getUTCFullYear() <= 9999 ? shifted.toISOString().slice(0, 10) : '';
}
export function formatDate(value) {
  return Number.isFinite(dateTimestamp(value)) ? value.split('-').reverse().join('/') : '—';
}
export function nightsBetween(checkIn, checkOut) {
  const start = dateTimestamp(checkIn);
  const end = dateTimestamp(checkOut);
  return Number.isFinite(start) && Number.isFinite(end) && end > start ? (end - start) / DAY_MS : 0;
}
export function resolveDiscount(manualDiscount = '') {
  const result = { discountPercent: 0, discountError: '' };
  const entered = String(manualDiscount ?? '').trim();
  if (!entered) return result;
  const percent = Number(entered.replace(',', '.'));
  if (!/^\d{1,3}([.,]\d{1,2})?$/.test(entered) || !Number.isFinite(percent) || percent > 100) {
    return { ...result, discountError: 'Informe um desconto de 0% a 100%, com no máximo 2 casas decimais.' };
  }
  return { ...result, discountPercent: percent };
}
export function calculateStay({ checkIn, checkOut, rooms = {}, guests, manualDiscount = '' }) {
  const nights = nightsBetween(checkIn, checkOut);
  const errors = [];
  if (!nights) errors.push('Informe uma saída posterior à entrada, com pelo menos 1 diária.');
  const lines = ROOM_TYPES.map((room) => {
    const value = rooms[room.id] ?? 0;
    const quantity = Number(value);
    const valid = value !== '' && Number.isInteger(quantity) && quantity >= 0 && quantity <= 99;
    if (!valid) errors.push('Use uma quantidade de 0 a 99 para ' + room.name.toLowerCase() + '.');
    return { ...room, quantity: valid ? quantity : 0, subtotal: valid ? quantity * room.rate * nights : 0 };
  }).filter((room) => room.quantity > 0);
  const roomCount = lines.reduce((sum, room) => sum + room.quantity, 0);
  const capacity = lines.reduce((sum, room) => sum + room.quantity * room.capacity, 0);
  if (!roomCount) errors.push('Selecione pelo menos um quarto.');
  const guestCount = Number(guests);
  if (!Number.isInteger(guestCount) || !(guestCount >= 1)) errors.push('Informe pelo menos 1 hóspede.');
  else if (guestCount > capacity && roomCount) errors.push('Os quartos selecionados acomodam até ' + capacity + (capacity === 1 ? ' pessoa.' : ' pessoas.') + ' Ajuste os hóspedes ou adicione quartos.');
  const subtotal = lines.reduce((sum, room) => sum + room.subtotal, 0);
  const discountDetails = resolveDiscount(manualDiscount);
  if (discountDetails.discountError) errors.push(discountDetails.discountError);
  const basisPoints = Math.round(discountDetails.discountPercent * 100);
  const discount = Math.round(subtotal * basisPoints / 10000);
  const total = subtotal - discount;
  const average = nights && guestCount > 0 ? Math.round(total / nights / guestCount) : 0;
  return { nights, lines, roomCount, capacity, subtotal, ...discountDetails, discount, total, average, errors };
}
