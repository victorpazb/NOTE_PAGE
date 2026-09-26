import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePixKey, createPixPayload, crc16, pixQrSvg } from '../pix.js';
import { calculateStay } from '../pricing.js';

const hotel = { key: '60.996.892/0001-54', payee: 'BSH FLATS CAMPINA', city: 'Campina Grande / PB' };
function fields(payload) {
  const result = {};
  for (let offset = 0; offset < payload.length;) {
    const id = payload.slice(offset, offset + 2);
    const length = Number(payload.slice(offset + 2, offset + 4));
    assert.ok(length > 0 && offset + 4 + length <= payload.length);
    result[id] = payload.slice(offset + 4, offset + 4 + length);
    offset += 4 + length;
  }
  return result;
}

test('reproduz o exemplo completo e o CRC do manual do Banco Central', () => {
  const payload = createPixPayload({ key: '123e4567-e12b-12d1-a456-426655440000', payee: 'Fulano de Tal', city: 'BRASILIA' });
  assert.equal(payload, '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D');
  assert.equal(crc16('123456789'), '29B1');
});

test('QR do hotel contém a chave sem máscara e o total exato após desconto', () => {
  const calc = calculateStay({ checkIn: '2026-09-25', checkOut: '2026-09-27', rooms: { single: 1 }, guests: 1, manualDiscount: '12,5' });
  const payload = createPixPayload({ ...hotel, amount: calc.total });
  const data = fields(payload);
  assert.deepEqual(fields(data['26']), { '00': 'br.gov.bcb.pix', '01': '60996892000154' });
  assert.equal(data['54'], '174.82');
  assert.equal(data['53'], '986');
  assert.equal(data['58'], 'BR');
  assert.equal(data['60'], 'Campina Grande');
  assert.equal(fields(data['62'])['05'], '***');
  assert.equal(data['63'], crc16(payload.slice(0, -4)));
});

test('normaliza os tipos de chave sem confundir e-mail ou chave aleatória com documentos', () => {
  for (const [input, expected] of [
    [' 60.996.892/0001-54 ', '60996892000154'],
    ['123.456.789-00', '12345678900'],
    ['12345678900', '12345678900'],
    ['12.abc.345/01de-35', '12ABC34501DE35'],
    ['+55 (83) 98211-0011', '+5583982110011'],
    ['Hotel.Exemplo+pix@EXAMPLE.com', 'hotel.exemplo+pix@example.com'],
    ['123E4567-E12B-12D1-A456-426655440000', '123e4567-e12b-12d1-a456-426655440000'],
  ]) assert.equal(normalizePixKey(input), expected);
});

test('recusa chaves vazias, formatos inválidos, caracteres não ASCII e chaves longas', () => {
  for (const key of ['', 'abc', '60.996.892/0001-54 extra', '123', 'hotel@', 'olá@example.com', 'a'.repeat(66) + '@example.com', '<script>']) {
    assert.throws(() => createPixPayload({ ...hotel, key }), /chave Pix/);
  }
});

test('preserva e-mail de 77 caracteres sem ultrapassar o template de 99', () => {
  const key = 'a'.repeat(64) + '@example.test';
  assert.equal(key.length, 77);
  const data = fields(createPixPayload({ ...hotel, key }));
  assert.equal(data['26'].length, 99);
  assert.equal(fields(data['26'])['01'], key);
});

test('remove acentos, UF e limita favorecido/cidade sem corromper os tamanhos', () => {
  const data = fields(createPixPayload({ ...hotel, payee: 'Pousada São João e Família da Silva', city: 'São José dos Campos / SP' }));
  assert.equal(data['59'], 'Pousada Sao Joao e Famili');
  assert.equal(data['60'], 'Sao Jose dos Ca');
  assert.throws(() => createPixPayload({ ...hotel, payee: ' ' }), /favorecido/);
  assert.throws(() => createPixPayload({ ...hotel, city: ' / PB' }), /cidade/);
});

test('formata centavos e rejeita zero, negativos, frações e valores fora do limite', () => {
  for (const [amount, expected] of [[1, '0.01'], [9990, '99.90'], [10000, '100.00'], [999999999999, '9999999999.99']]) {
    assert.equal(fields(createPixPayload({ ...hotel, amount }))['54'], expected);
  }
  for (const amount of [0, -1, 1.5, NaN, Infinity, '9990', 1000000000000]) {
    assert.throws(() => createPixPayload({ ...hotel, amount }), /valor do Pix/);
  }
});

test('alterar chave ou valor atualiza o conteúdo do QR Code', () => {
  const original = createPixPayload({ ...hotel, amount: 9990 });
  const changedAmount = createPixPayload({ ...hotel, amount: 12000 });
  const changedKey = createPixPayload({ ...hotel, key: 'hotel@example.com', amount: 9990 });
  assert.notEqual(pixQrSvg(original), pixQrSvg(changedAmount));
  assert.notEqual(pixQrSvg(original), pixQrSvg(changedKey));
});
