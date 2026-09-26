import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, dateTimestamp, formatDate, formatBrazilianTaxId, brazilianTaxIdType, nightsBetween, calculateStay, currencyWords } from '../pricing.js';

const stay = (days, rooms = { single: 1 }, guests = 1, discountOptions = {}) => calculateStay({
  checkIn: '2026-09-25', checkOut: addDays('2026-09-25', days), rooms, guests, ...discountOptions,
});

test('formata CPF e CNPJ durante a digitação e limita caracteres excedentes', () => {
  assert.equal(formatBrazilianTaxId('01401212323'), '014.012.123-23');
  assert.equal(formatBrazilianTaxId('014.012.123-23'), '014.012.123-23');
  assert.equal(formatBrazilianTaxId('60996892000154'), '60.996.892/0001-54');
  assert.equal(formatBrazilianTaxId('014012'), '014.012');
  assert.equal(formatBrazilianTaxId('abc01401212323xyz'), '014.012.123-23');
  assert.equal(formatBrazilianTaxId('60996892000154999'), '60.996.892/0001-54');
});

test('identifica a label do documento pela quantidade de dígitos', () => {
  assert.equal(brazilianTaxIdType(''), '');
  assert.equal(brazilianTaxIdType('014.012.123-23'), 'CPF');
  assert.equal(brazilianTaxIdType('60.996.892/0001-54'), 'CNPJ');
  assert.equal(brazilianTaxIdType('609968920001'), 'CNPJ');
});

test('tarifas de uma diária em centavos, sem desconto', () => {
  assert.equal(stay(1).total, 9990);
  assert.equal(stay(1, { double: 1 }, 2).total, 12000);
  assert.equal(stay(1, { triple: 1 }, 3).total, 15000);
});
test('nenhum desconto é aplicado automaticamente, independentemente das diárias', () => {
  for (const days of [1, 2, 3, 4, 5, 10]) {
    const result = stay(days);
    assert.equal(result.discountPercent, 0);
    assert.equal(result.discount, 0);
    assert.equal(result.total, result.subtotal);
  }
});
test('desconto aplicado sobre quartos × diárias, com ocupação independente', () => {
  const result = stay(5, { single: 1, double: 3, triple: 8 }, 12, { manualDiscount: '20' });
  assert.equal(result.roomCount, 12);
  assert.equal(result.capacity, 31);
  assert.equal(result.subtotal, 829950);
  assert.equal(result.discount, 165990);
  assert.equal(result.total, 663960);
  assert.equal(result.average, 11066);
  assert.deepEqual(result.errors, []);
});
test('calendário: virada do mês, do ano, ano bissexto e horário de verão', () => {
  assert.equal(nightsBetween('2026-09-30', '2026-10-02'), 2);
  assert.equal(nightsBetween('2026-12-31', '2027-01-01'), 1);
  assert.equal(nightsBetween('2028-02-28', '2028-03-01'), 2);
  assert.equal(nightsBetween('2026-03-07', '2026-03-09'), 2);
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(formatDate('2026-09-25'), '25/09/2026');
});
test('datas inválidas, iguais e invertidas não geram totais', () => {
  for (const date of ['', '2026-02-30', '2026-13-01', '2026-01-00', '2026-2-3', '2025-02-29']) {
    assert.ok(Number.isNaN(dateTimestamp(date)));
    assert.equal(formatDate(date), '—');
  }
  assert.equal(nightsBetween('2026-09-25', '2026-09-25'), 0);
  assert.equal(nightsBetween('2026-09-26', '2026-09-25'), 0);
  assert.equal(stay(0).total, 0);
  assert.ok(stay(0).errors.length);
});
test('não permite hospedagem sem quartos, hóspedes ou capacidade suficiente', () => {
  assert.match(stay(1, {}).errors.join(' '), /pelo menos um quarto/);
  assert.match(stay(1, { single: 1 }, 0).errors.join(' '), /pelo menos 1 hóspede/);
  assert.match(stay(1, { double: 1 }, 3).errors.join(' '), /acomodam até 2 pessoas/);
  assert.deepEqual(stay(1, { triple: 1 }, 2).errors, []);
  assert.match(stay(1, { triple: 1 }, 1.5).errors.join(' '), /hóspede/);
});
test('rejeita quantidades negativas, fracionadas, vazias e excessivas', () => {
  for (const quantity of [-1, 1.5, '', 'abc', 100, Infinity]) {
    const result = stay(1, { single: quantity });
    assert.ok(result.errors.length);
    assert.equal(result.total, 0);
  }
});
test('valor por extenso em reais e centavos', () => {
  assert.equal(currencyWords(9990), 'noventa e nove reais e noventa centavos');
  assert.equal(currencyWords(147960), 'mil quatrocentos e setenta e nove reais e sessenta centavos');
  assert.equal(currencyWords(10000), 'cem reais');
  assert.equal(currencyWords(100), 'um real');
  assert.equal(currencyWords(1), 'um centavo');
  assert.equal(currencyWords(0), 'zero reais');
  assert.equal(currencyWords(100000000), 'um milhão de reais');
});

test('diárias e quantidade de quartos não ativam desconto', () => {
  const twoNights = stay(2);
  assert.equal(twoNights.nights, 2);
  assert.equal(twoNights.discount, 0);
  assert.equal(twoNights.total, 19980);
  const twoRooms = stay(1, { single: 2 });
  assert.equal(twoRooms.roomCount, 2);
  assert.equal(twoRooms.discount, 0);
  assert.equal(twoRooms.total, 19980);
});
test('campo vazio ou zero considera desconto de 0%', () => {
  for (const manualDiscount of ['', ' ', '0', '0,00', '0.0']) {
    const result = stay(5, { single: 1 }, 1, { manualDiscount });
    assert.equal(result.discountPercent, 0);
    assert.equal(result.discount, 0);
    assert.equal(result.total, result.subtotal);
    assert.deepEqual(result.errors, []);
  }
});
test('desconto informado aplica-se sobre o subtotal', () => {
  const result = stay(2, { single: 1 }, 1, { manualDiscount: '15' });
  assert.equal(result.discountPercent, 15);
  assert.equal(result.discount, 2997);
  assert.equal(result.total, 16983);
  assert.equal(result.average, 8492);
  assert.deepEqual(result.errors, []);
});
test('desconto aceita vírgula, ponto, uma diária e cortesia de 100%', () => {
  for (const manualDiscount of ['12,5', '12.5', '12,50']) {
    const result = stay(2, { single: 1 }, 1, { manualDiscount });
    assert.equal(result.discountPercent, 12.5);
    assert.equal(result.discount, 2498);
    assert.equal(result.total, 17482);
  }
  assert.equal(stay(1, { double: 1 }, 2, { manualDiscount: '10' }).total, 10800);
  assert.equal(stay(5, { triple: 1 }, 3, { manualDiscount: '100' }).total, 0);
});
test('desconto inválido impede emissão e não produz total negativo', () => {
  for (const manualDiscount of ['-1', '100,01', '101', 'texto', '10,125', 'Infinity', '1e2', '2,5.5']) {
    const result = stay(2, { single: 1 }, 1, { manualDiscount });
    assert.ok(result.discountError, manualDiscount);
    assert.ok(result.errors.includes(result.discountError));
    assert.equal(result.discount, 0);
    assert.equal(result.total, result.subtotal);
  }
});
test('limpar o desconto volta a zero e o mesmo percentual vale para outras durações', () => {
  assert.equal(stay(2, { single: 1 }, 1, { manualDiscount: '' }).discountPercent, 0);
  assert.equal(stay(2, { single: 1 }, 1, { manualDiscount: ' ' }).discountPercent, 0);
  assert.equal(stay(2, { single: 1 }, 1, { manualDiscount: '15' }).discountError, '');
  assert.equal(stay(5, { single: 1 }, 1, { manualDiscount: '15' }).discountPercent, 15);
});
test('quantidade de diárias ajusta saída e rejeita datas fora do calendário', () => {
  assert.equal(addDays('2026-09-25', 2), '2026-09-27');
  assert.equal(addDays('2026-09-25', Infinity), '');
  assert.equal(addDays('2026-09-25', 1e20), '');
  assert.equal(addDays('2026-09-25', 1.5), '');
  assert.equal(addDays('9999-12-31', 1), '');
});
