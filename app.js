import { currency, currencyWords, dateTimestamp, localToday, addDays, formatDate, formatBrazilianTaxId, brazilianTaxIdType, calculateStay } from './pricing.js';
import { createPixPayload, pixQrSvg } from './pix.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const DRAFT_KEY = 'bsh-document-draft-v1';
const HOTEL_KEY = 'bsh-hotel-v1';
const DEFAULT_LOGO = 'assets/logo-oficial.jpg';
const DEFAULT_HOTEL = {
  hotelName: 'BSH FLATS CAMPINA GRANDE',
  hotelPhone: '(83) 98211-0011',
  hotelCnpj: '60.996.892/0001-54',
  hotelAddress: 'Av. Senador Argemiro de Figueiredo, 4100 · Bairro Universitário',
  hotelCity: 'Campina Grande / PB',
  hotelZip: '',
  hotelPix: '60.996.892/0001-54',
  hotelPayee: 'BSH FLATS CAMPINA',
  hotelBank: '280 – NU PAGAMENTOS S.A.',
  hotelAgency: '0001',
  hotelAccount: '143596480-8',
  logo: DEFAULT_LOGO,
};
const FIELD_NAMES = ['guestName', 'guestDocument', 'guests', 'checkIn', 'checkOut', 'single', 'double', 'triple', 'issueDate', 'documentNumber', 'paymentDate', 'paymentMethod', 'notes', 'manualDiscount'];
const PAYMENT_METHODS = ['Pix', 'Dinheiro', 'Cartão de crédito', 'Cartão de débito', 'Transferência bancária'];
const form = $('#document-form');
let toastTimer;
let pendingLogo;
let attemptedSubmit = false;
let storageAvailable = true;
let cachedPix = { payload: '', svg: '' };

function defaults() {
  const today = localToday();
  return { type: 'quote', guestName: '', guestDocument: '', guests: '1', checkIn: today, checkOut: addDays(today, 1), single: '1', double: '0', triple: '0', issueDate: today, documentNumber: '', paymentDate: today, paymentMethod: 'Pix', notes: '', manualDiscount: '0' };
}
function readStorage(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); }
  catch { return null; }
}
function writeStorage(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
}
function loadFields(base, saved) {
  const result = { ...base };
  if (saved && typeof saved === 'object') {
    Object.keys(base).forEach((key) => {
      if (typeof saved[key] === typeof base[key]) result[key] = saved[key];
    });
  }
  return result;
}
let state = loadFields(defaults(), readStorage(DRAFT_KEY));
state.type = state.type === 'receipt' ? 'receipt' : 'quote';
state.guestDocument = formatBrazilianTaxId(state.guestDocument);
if (!PAYMENT_METHODS.includes(state.paymentMethod)) state.paymentMethod = 'Pix';
let hotel = loadFields(DEFAULT_HOTEL, readStorage(HOTEL_KEY));
if (!validLogo(hotel.logo)) hotel.logo = DEFAULT_LOGO;

function validLogo(value) {
  return value === DEFAULT_LOGO || /^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(value);
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}
function printFileName(type, guestName, issueDate) {
  const documentType = type === 'receipt' ? 'RECIBO' : 'ORCAMENTO';
  const name = guestName.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 70).replace(/_+$/g, '') || 'HOSPEDE';
  const date = issueDate.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3$2$1');
  return `${documentType}_${name}_${date}`;
}
const e = escapeHtml;
const icon = (name) => '<svg class="icon" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
const plural = (value, singular, multiple) => value + ' ' + (value === 1 ? singular : multiple);
const percent = (value) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value) + '%';

function applyState() {
  FIELD_NAMES.forEach((name) => { form.elements[name].value = state[name]; });
  $$('.type-option').forEach((button) => {
    const active = button.dataset.type === state.type;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active);
  });
  const receipt = state.type === 'receipt';
  $('#payment-fields').hidden = !receipt;
  $('#receipt-note').hidden = !receipt;
  $('#paymentDate').required = receipt;
  $('#paymentDate').disabled = !receipt;
  $('#paymentMethod').disabled = !receipt;
  $('#details-title').textContent = receipt ? 'Documento e pagamento' : 'Detalhes do documento';
}
function readForm() {
  FIELD_NAMES.forEach((name) => { state[name] = form.elements[name].value; });
}
function currentCalculation() {
  return calculateStay({ checkIn: state.checkIn, checkOut: state.checkOut, guests: state.guests, rooms: { single: state.single, double: state.double, triple: state.triple }, manualDiscount: state.manualDiscount });
}
function saveDraft() {
  storageAvailable = writeStorage(DRAFT_KEY, state);
  $('#save-status').textContent = storageAvailable ? 'Rascunho salvo neste navegador' : 'Rascunho apenas nesta sessão';
}
function notify(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 3500);
}

function renderPix(calc) {
  if (state.type === 'receipt' || calc.errors.length || calc.total <= 0) return '';
  try {
    const payload = createPixPayload({ key: hotel.hotelPix, payee: hotel.hotelPayee, city: hotel.hotelCity, amount: calc.total });
    if (payload !== cachedPix.payload) cachedPix = { payload, svg: pixQrSvg(payload) };
    return '<figure class="doc-pix-code">' + cachedPix.svg + '<figcaption>Escaneie para pagar<br><strong>' + e(currency(calc.total)) + '</strong></figcaption></figure>';
  } catch {
    return '<p class="doc-pix-error">QR Code indisponível. Confira a chave Pix, o favorecido e a cidade em Dados do hotel.</p>';
  }
}

function renderPreview(calc) {
  const receipt = state.type === 'receipt';
  const guest = state.guestName.trim();
  const guestDocumentType = brazilianTaxIdType(state.guestDocument);
  const guestCount = Number(state.guests) || 0;
  const label = receipt ? 'Recibo' : 'Orçamento';
  const pix = renderPix(calc);
  const rows = calc.lines.map((room) => '<tr><td>' + e(room.name) + '</td><td>' + room.quantity + '</td><td>' + calc.nights + '</td><td>' + e(currency(room.rate)) + '</td><td>' + e(currency(room.subtotal)) + '</td></tr>').join('');
  const stayDates = e(formatDate(state.checkIn)) + ' a ' + e(formatDate(state.checkOut));
  const paper = $('#document-preview');
  paper.classList.toggle('receipt-document', receipt);
  paper.innerHTML = [
    '<header class="doc-header"><img class="doc-logo" src="' + e(hotel.logo) + '" alt="' + e(hotel.hotelName) + '"><div class="doc-title-group"><div class="doc-kicker">' + e(hotel.hotelName) + '</div><h2 class="doc-title">' + label + ' de<br>Hospedagem</h2><div class="doc-phone">' + e(hotel.hotelPhone) + ' &nbsp;·&nbsp; ' + e(hotel.hotelCity) + '</div></div></header>',
    '<div class="doc-meta"><span>Emissão: ' + e(formatDate(state.issueDate)) + '</span><span>' + (state.documentNumber.trim() ? 'Nº ' + e(state.documentNumber) : 'HOSPEDAGEM COM CUIDADO') + '</span></div>',
    '<div class="doc-client"><div class="doc-label">' + (receipt ? 'Recebemos de' : 'Preparado para') + '</div><strong class="' + (guest ? '' : 'doc-muted') + '">' + e(guest || 'Nome do hóspede ou responsável') + '</strong>' + (state.guestDocument.trim() ? '<p>' + guestDocumentType + ': ' + e(formatBrazilianTaxId(state.guestDocument)) + '</p>' : '') + '</div>',
    receipt ? '<p class="doc-receipt-text">Confirmamos o recebimento de <strong>' + e(currency(calc.total)) + '</strong>, via <strong>' + e(state.paymentMethod) + '</strong>, em <strong>' + e(formatDate(state.paymentDate)) + '</strong>, referente ao pagamento integral da hospedagem descrita neste documento.</p>' : '',
    '<div class="doc-stay"><div><div class="doc-label">Período da hospedagem</div><strong>' + stayDates + '</strong><div class="doc-sub">' + plural(calc.nights, 'diária', 'diárias') + ' · Check-in 14h / Check-out 12h</div></div><div><div class="doc-label">Hóspedes & acomodações</div><strong>' + plural(guestCount, 'pessoa', 'pessoas') + '</strong><div class="doc-sub">' + plural(calc.roomCount, 'quarto selecionado', 'quartos selecionados') + '</div></div></div>',
    '<div class="doc-section-title">Detalhamento da hospedagem</div>',
    '<table class="doc-table"><thead><tr><th scope="col">ACOMODAÇÃO</th><th scope="col">QTD.</th><th scope="col">DIÁRIAS</th><th scope="col">UNITÁRIO</th><th scope="col">SUBTOTAL</th></tr></thead><tbody>' + (rows || '<tr><td colspan="5" class="doc-empty">Selecione uma acomodação para começar.</td></tr>') + '</tbody></table>',
    '<div class="doc-calculation"><div><span>Subtotal da hospedagem</span><span>' + e(currency(calc.subtotal)) + '</span></div>' + (calc.discount ? '<div class="discount-line"><span>Desconto de ' + e(percent(calc.discountPercent)) + '</span><span>− ' + e(currency(calc.discount)) + '</span></div>' : '') + '</div>',
    '<div class="doc-breakfast">' + icon('coffee') + 'Café da manhã incluso em todas as diárias</div>',
    '<div class="doc-total"><div class="doc-total-top"><span>' + (receipt ? 'Valor total recebido' : 'Valor final do orçamento') + '</span><strong>' + e(currency(calc.total)) + '</strong></div><div class="doc-words">' + e(currencyWords(calc.total)) + '</div><div class="doc-average">Valor médio por diária / pessoa: ' + e(currency(calc.average)) + '</div></div>',
    '<div class="doc-bottom-grid' + (pix ? ' doc-bottom-with-qr' : '') + '"><div><div class="doc-bottom-title">' + (receipt ? 'Detalhes do pagamento' : 'Informações importantes') + '</div>',
    receipt ? '<ul class="doc-conditions"><li>Recebido em ' + e(formatDate(state.paymentDate)) + '.</li><li>Forma de pagamento: ' + e(state.paymentMethod) + '.</li><li>Pagamento integral da hospedagem.</li></ul><span class="doc-paid">PAGAMENTO RECEBIDO</span>' : '<ul class="doc-conditions"><li>Check-in a partir das 14h de ' + e(formatDate(state.checkIn)) + '.</li><li>Check-out até as 12h de ' + e(formatDate(state.checkOut)) + '.</li><li>Confirmação mediante disponibilidade.</li><li>Valores sujeitos a alteração sem aviso prévio.</li></ul>',
    '</div><div><div class="doc-bottom-title">' + (receipt ? 'Dados do recebedor' : 'Dados para pagamento · Pix') + '</div><div class="doc-payment"><div class="doc-payment-details"><div class="doc-pix-key">' + e(receipt ? hotel.hotelCnpj : hotel.hotelPix) + '</div><div class="doc-payee">' + e(hotel.hotelPayee) + '<br>CNPJ: ' + e(hotel.hotelCnpj) + '</div><div class="doc-bank">' + (receipt ? e(hotel.hotelPhone) : e(hotel.hotelBank) + '<br>' + (hotel.hotelAgency ? 'Agência: ' + e(hotel.hotelAgency) : '') + (hotel.hotelAccount ? ' · Conta: ' + e(hotel.hotelAccount) : '')) + '</div></div>' + pix + '</div></div></div>',
    state.notes.trim() ? '<div class="doc-notes"><strong>OBSERVAÇÕES</strong><br>' + e(state.notes.trim()) + '</div>' : '',
    receipt ? '<div class="doc-signature">' + e(hotel.hotelName) + '<br>Assinatura do recebedor</div>' : '',
    '<footer class="doc-footer"><strong>' + e(hotel.hotelName) + '</strong><br>' + e(hotel.hotelAddress) + '<br>' + e(hotel.hotelCity) + (hotel.hotelZip ? ' · CEP ' + e(hotel.hotelZip) : '') + ' · ' + e(hotel.hotelPhone) + '</footer>',
  ].join('');
}

function updateValidation(calc) {
  $('#manualDiscount').setCustomValidity(calc.discountError);
  $('#manualDiscount').setAttribute('aria-invalid', Boolean(calc.discountError));
  $('#manual-discount-error').textContent = calc.discountError;
  $('#manual-discount-error').hidden = !calc.discountError;
  $('#guestName').setCustomValidity(state.guestName.trim() ? '' : 'Informe o nome do hóspede ou responsável.');
  const minimumCheckout = addDays(state.checkIn, 1);
  if ($('#checkOut').min !== minimumCheckout) $('#checkOut').min = minimumCheckout;
  $('#checkOut').setCustomValidity(calc.nights ? '' : 'A saída deve ser posterior à entrada.');
  const count = Number(state.guests);
  $('#guests').setCustomValidity(calc.roomCount && count > calc.capacity ? 'Os quartos selecionados acomodam até ' + calc.capacity + ' pessoa(s).' : '');
  if ($('#paymentDate').max !== state.issueDate) $('#paymentDate').max = state.issueDate;
  $('#paymentDate').setCustomValidity(state.type === 'receipt' && dateTimestamp(state.paymentDate) > dateTimestamp(state.issueDate) ? 'O pagamento deve ocorrer até a data de emissão.' : '');
  const errors = [...calc.errors];
  if (attemptedSubmit && !state.guestName.trim()) errors.unshift('Informe o nome do hóspede ou responsável.');
  const error = $('#validation-message');
  error.textContent = errors.join(' ');
  error.hidden = errors.length === 0;
}

function render({ syncNights = true } = {}) {
  const calc = currentCalculation();
  $('#guest-document-label-text').textContent = brazilianTaxIdType(state.guestDocument) || 'Documento';
  if (syncNights) {
    $('#nights').value = calc.nights || '';
    $('#nights').setCustomValidity('');
  }
  $('#stay-description').textContent = calc.nights ? plural(calc.nights, 'diária de hospedagem', 'diárias de hospedagem') : 'Selecione um período válido';
  $('#room-summary').textContent = plural(calc.roomCount, 'quarto selecionado', 'quartos selecionados');
  $('#capacity-summary').textContent = 'Capacidade: ' + plural(calc.capacity, 'pessoa', 'pessoas');
  $$('[data-room]').forEach((button) => {
    const value = Number(state[button.dataset.room]);
    button.disabled = button.dataset.delta === '-1' ? value <= 0 : value >= 99;
  });
  $('#grand-total').textContent = currency(calc.total);
  $('#total-label').textContent = state.type === 'receipt' ? 'Total recebido' : 'Total do orçamento';
  $('#savings-label').textContent = calc.discountError ? 'Corrija o desconto' : calc.discount ? 'Economia de ' + currency(calc.discount) + ' (' + percent(calc.discountPercent) + ')' : 'Café da manhã incluso';
  $('#savings-label').classList.toggle('has-discount', calc.discount > 0);
  $('#discount-subtotal').textContent = currency(calc.subtotal);
  $('#discount-applied-label').textContent = 'Desconto (' + percent(calc.discountPercent) + ')';
  $('#discount-amount').textContent = (calc.discount ? '− ' : '') + currency(calc.discount);
  $('#discount-total').textContent = currency(calc.total);
  updateValidation(calc);
  renderPreview(calc);
}

function handleFormEdit(event) {
  readForm();
  if (event.target.id === 'guestDocument') {
    state.guestDocument = formatBrazilianTaxId(event.target.value);
    event.target.value = state.guestDocument;
  } else if (event.target.id === 'nights') {
    const nights = Number($('#nights').value);
    const checkout = Number.isInteger(nights) && nights >= 1 ? addDays(state.checkIn, nights) : '';
    $('#nights').setCustomValidity(checkout ? '' : 'Informe uma quantidade inteira de diárias e uma data de entrada válida.');
    if (checkout) {
      state.checkOut = checkout;
      $('#checkOut').value = checkout;
    }
  } else if (event.type === 'change' && event.target.id === 'checkIn' && Number.isFinite(dateTimestamp(state.checkIn)) && dateTimestamp(state.checkOut) <= dateTimestamp(state.checkIn)) {
    state.checkOut = addDays(state.checkIn, 1);
    $('#checkOut').value = state.checkOut;
  }
  render({ syncNights: event.target.id !== 'nights' });
  saveDraft();
}
form.addEventListener('input', handleFormEdit);
form.addEventListener('change', handleFormEdit);
form.addEventListener('invalid', () => {
  attemptedSubmit = true;
  updateValidation(currentCalculation());
}, true);
$$('[data-type]').forEach((button) => button.addEventListener('click', () => {
  readForm();
  state.type = button.dataset.type;
  applyState();
  render();
  saveDraft();
}));
$$('[data-room]').forEach((button) => button.addEventListener('click', () => {
  readForm();
  const id = button.dataset.room;
  state[id] = String(Math.max(0, Math.min(99, (Number(state[id]) || 0) + Number(button.dataset.delta))));
  $('#' + id).value = state[id];
  render();
  saveDraft();
}));

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  attemptedSubmit = true;
  readForm();
  render();
  if (!form.reportValidity()) return;
  const calc = currentCalculation();
  if (calc.errors.length) {
    $('#validation-message').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  saveDraft();
  const oldTitle = document.title;
  document.title = printFileName(state.type, state.guestName, state.issueDate);
  const restoreTitle = () => { document.title = oldTitle; };
  window.addEventListener('afterprint', restoreTitle, { once: true });
  const logo = $('#document-preview .doc-logo');
  try { await logo.decode(); } catch { /* Printing remains available if an image fails. */ }
  try { window.print(); }
  catch { restoreTitle(); notify('Não foi possível abrir a impressão. Use a opção Imprimir do navegador.'); }
});

function applyHotelBrand() {
  $('.brand img').src = hotel.logo;
  $('.brand img').alt = hotel.hotelName;
  $('.location-label span').textContent = hotel.hotelCity;
}
function openSettings() {
  const hotelForm = $('#hotel-form');
  Object.keys(DEFAULT_HOTEL).filter((key) => key !== 'logo').forEach((name) => { hotelForm.elements[name].value = hotel[name]; });
  pendingLogo = hotel.logo;
  $('#settings-logo').src = pendingLogo;
  $('#settings-error').hidden = true;
  $('#logo-upload').value = '';
  $('#settings-dialog').showModal();
}
$('.settings-trigger').addEventListener('click', openSettings);
$('#close-settings').addEventListener('click', () => $('#settings-dialog').close());
$('#cancel-settings').addEventListener('click', () => $('#settings-dialog').close());
$('#upload-logo-button').addEventListener('click', () => $('#logo-upload').click());
$('#restore-logo').addEventListener('click', () => {
  pendingLogo = DEFAULT_LOGO;
  $('#settings-logo').src = pendingLogo;
  $('#logo-upload').value = '';
});
$('#logo-upload').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const error = $('#settings-error');
  error.hidden = true;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
    error.textContent = 'Escolha uma imagem PNG, JPG ou WebP de até 2 MB.';
    error.hidden = false;
    event.target.value = '';
    return;
  }
  try {
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    if (!validLogo(data)) throw new Error('Invalid image');
    const img = new Image();
    img.src = data;
    await img.decode();
    pendingLogo = data;
    $('#settings-logo').src = data;
  } catch {
    error.textContent = 'Não foi possível ler esta imagem. Tente outro arquivo.';
    error.hidden = false;
  }
});
$('#hotel-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const nextHotel = { logo: pendingLogo };
  Object.keys(DEFAULT_HOTEL).filter((key) => key !== 'logo').forEach((name) => { nextHotel[name] = event.currentTarget.elements[name].value.trim(); });
  if (!nextHotel.hotelName || !nextHotel.hotelPhone || !nextHotel.hotelCnpj || !nextHotel.hotelAddress || !nextHotel.hotelCity || !nextHotel.hotelPix || !nextHotel.hotelPayee) {
    $('#settings-error').textContent = 'Preencha os dados obrigatórios do hotel.';
    $('#settings-error').hidden = false;
    return;
  }
  try {
    createPixPayload({ key: nextHotel.hotelPix, payee: nextHotel.hotelPayee, city: nextHotel.hotelCity });
  } catch (error) {
    $('#settings-error').textContent = error.message;
    $('#settings-error').hidden = false;
    return;
  }
  hotel = nextHotel;
  const saved = writeStorage(HOTEL_KEY, hotel);
  applyHotelBrand();
  render();
  $('#settings-dialog').close();
  notify(saved ? 'Dados do hotel atualizados.' : 'Dados atualizados nesta sessão. O navegador não permitiu salvá-los.');
});

$('#reset-button').addEventListener('click', () => $('#reset-dialog').showModal());
$('#cancel-reset').addEventListener('click', () => $('#reset-dialog').close());
$('#confirm-reset').addEventListener('click', () => {
  state = defaults();
  attemptedSubmit = false;
  applyState();
  render();
  saveDraft();
  $('#reset-dialog').close();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  $('#guestName').focus({ preventScroll: true });
  notify('Tudo pronto para uma nova hospedagem.');
});
$$('dialog').forEach((dialog) => dialog.addEventListener('click', (event) => {
  if (event.target === dialog) {
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  }
}));

applyState();
applyHotelBrand();
render();
saveDraft();
