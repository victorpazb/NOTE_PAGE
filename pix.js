import { QrCode } from './vendor/qrcodegen.js';

// BR Code / Pix estático, conforme o Manual de Padrões para Iniciação do Pix:
// https://www.bcb.gov.br/content/estabilidadefinanceira/pix/Regulamento_Pix/II_ManualdePadroesparaIniciacaodoPix.pdf
export function normalizePixKey(value) {
  const key = String(value ?? '').trim();
  if (key.length > 77) throw new Error('A chave Pix deve ter no máximo 77 caracteres.');
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key) && /^[\x21-\x7e]+$/.test(key)) return key.toLowerCase();
  if (/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(key)) return key.toLowerCase();
  if (/^\+[\d\s()-]+$/.test(key)) {
    const phone = key.replace(/[\s()-]/g, '');
    if (/^\+[1-9]\d{7,14}$/.test(phone)) return phone;
  }
  if (/^(?:\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})$/.test(key)) return key.replace(/\D/g, '');
  // O CNPJ também pode ser alfanumérico; seus dois dígitos finais são numéricos.
  if (/^(?:[a-z\d]{12}\d{2}|[a-z\d]{2}\.[a-z\d]{3}\.[a-z\d]{3}\/[a-z\d]{4}-\d{2})$/i.test(key)) {
    return key.replace(/[./-]/g, '').toUpperCase();
  }
  throw new Error('Informe uma chave Pix no formato CPF, CNPJ, e-mail, chave aleatória ou telefone com +55 e DDD.');
}

function merchantText(value, limit, label) {
  const text = String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit).trim();
  if (!text) throw new Error('Informe ' + label + ' para gerar o QR Code Pix.');
  return text;
}

function field(id, value) {
  return id + String(value.length).padStart(2, '0') + value;
}

export function crc16(value) {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(value)) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) crc = ((crc << 1) ^ (crc & 0x8000 ? 0x1021 : 0)) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function createPixPayload({ key, payee, city, amount }) {
  if (amount !== undefined && (!Number.isSafeInteger(amount) || amount <= 0 || amount > 999999999999)) {
    throw new Error('O valor do Pix deve ser positivo e informado em centavos.');
  }
  const account = field('00', 'br.gov.bcb.pix') + field('01', normalizePixKey(key));
  const payload = field('00', '01') + field('26', account) + field('52', '0000') + field('53', '986')
    + (amount === undefined ? '' : field('54', Math.floor(amount / 100) + '.' + String(amount % 100).padStart(2, '0')))
    + field('58', 'BR') + field('59', merchantText(payee, 25, 'o favorecido'))
    + field('60', merchantText(String(city ?? '').replace(/\s*[/–-]\s*[A-Za-z]{2}\s*$/, ''), 15, 'a cidade'))
    + field('62', field('05', '***')) + '6304';
  return payload + crc16(payload);
}

export function pixQrSvg(payload) {
  const qr = QrCode.encodeText(payload, QrCode.Ecc.MEDIUM);
  const border = 4; // Margem branca obrigatória para a leitura, inclusive na impressão.
  const size = qr.size + border * 2;
  const path = [];
  for (let y = 0; y < qr.size; y++) {
    for (let x = 0; x < qr.size; x++) {
      if (qr.getModule(x, y)) path.push(`M${x + border},${y + border}h1v1h-1z`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" class="doc-pix-qr" viewBox="0 0 ${size} ${size}" role="img" aria-label="QR Code para pagamento via Pix" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path d="${path.join('')}" fill="#000"/></svg>`;
}
