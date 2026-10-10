import { apiGetEvents, apiRegisterEvent, apiCancelEvent, apiMyRegistrations, apiAdminSaveEvent, apiAdminRegistrants } from './api.js';
import { getSession } from './auth.js';
import { showToast, el, skeleton } from './ui.js';
import { safeGetStorage, safeSetStorage } from './storage.js';

const CACHE_PREFIX = 'pp_cache_events_';
const cacheKey = () => CACHE_PREFIX + (getSession()?.member.id || '');
const readCache = () => { try { return JSON.parse(safeGetStorage(cacheKey())); } catch { return null; } };
export function clearEventsCache() {
  try { Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX)).forEach(k => localStorage.removeItem(k)); } catch {}
}

let events = [], isAdmin = false, bound = false;
const $ = (id) => document.getElementById(id);
const fmt = (t) => new Date(t + ':00+07:00').toLocaleString('id-ID', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) + ' WIB';

export function initEvents(member) {
  isAdmin = member.role === 'admin';
  if (!bound) {
    bound = true;
    $('eventSearch').addEventListener('input', draw);
    $('eventCategory').addEventListener('change', draw);
    $('evSave').addEventListener('click', saveEvent);
    $('evReset').addEventListener('click', resetForm);
  }
  refresh();
}

async function refresh() {
  const s = getSession(); if (!s) return;
  const box = $('eventsContainer');
  if (!events.length) skeleton(box);
  const res = await apiGetEvents(s.token);
  if (res.success) {
    events = res.events;
    safeSetStorage(cacheKey(), JSON.stringify(events));
  } else {
    const cached = readCache();
    if (!cached) {
      const b = el('button', 'btn btn-secondary btn-sm', 'Coba lagi'); b.type = 'button'; b.addEventListener('click', refresh);
      box.replaceChildren(el('p', 'dash-text-sm', res.message || 'Gagal memuat kegiatan.'), b);
      return;
    }
    events = cached;
    showToast('Menampilkan kegiatan tersimpan terakhir (mode offline).', 'info');
  }
  const sel = $('eventCategory'), cur = sel.value;
  sel.replaceChildren(el('option', '', 'Semua kategori'));
  sel.firstChild.value = '';
  [...new Set(events.map(e => e.kategori).filter(Boolean))].forEach(k => sel.append(el('option', '', k)));
  sel.value = cur;
  draw();
  loadMine();
}

function badgeOf(e) {
  if (e.saya) return ['Terdaftar', 'badge-success'];
  if (e.lewat || e.status === 'Selesai') return ['Selesai', ''];
  if (e.status !== 'Dibuka') return ['Ditutup', ''];
  return e.penuh ? ['Penuh', ''] : ['Dibuka', 'badge-success'];
}

function draw() {
  const q = $('eventSearch').value.trim().toLowerCase(), cat = $('eventCategory').value, box = $('eventsContainer');
  const list = events.filter(e => (!cat || e.kategori === cat) && `${e.judul} ${e.deskripsi}`.toLowerCase().includes(q));
  box.replaceChildren();
  if (!list.length) { box.append(el('p', 'dash-text-sm', 'Belum ada kegiatan yang cocok.')); return; }
  list.forEach(e => box.append(card(e)));
}

function card(e) {
  const d = el('details', 'card-item admin-member event-card'), sm = el('summary'), [label, cls] = badgeOf(e);
  const dt = new Date(e.tanggal + ':00+07:00'), box = el('div', 'date-box'), ttl = el('div', 'ev-title');
  box.append(el('b', '', dt.toLocaleString('id-ID', { day: 'numeric', timeZone: 'Asia/Jakarta' })), el('span', '', dt.toLocaleString('id-ID', { month: 'short', timeZone: 'Asia/Jakarta' })));
  ttl.append(el('strong', '', e.judul), el('small', '', `${e.kategori} · ${e.lokasi || '-'}`));
  sm.append(box, ttl, el('span', 'badge ' + cls, label));
  const info = el('div', 'admin-info');
  [`📅 ${fmt(e.tanggal)}`, `📍 ${e.lokasi || '-'}`, `👥 ${e.terdaftar}/${e.kuota || '∞'} peserta · ${e.kategori}`, e.deskripsi || ''].filter(Boolean).forEach(t => info.append(el('p', '', t)));
  const row = el('div', 'admin-actions');
  if (e.bisaDaftar) row.append(action('Ikuti Kegiatan', 'btn-primary', () => apiRegisterEvent(getSession().token, e.id)));
  if (e.bisaBatal) row.append(action('Batalkan Pendaftaran', 'btn-secondary', () => apiCancelEvent(getSession().token, e.id)));
  if (isAdmin) {
    const ed = el('button', 'btn btn-secondary btn-sm', 'Edit'); ed.type = 'button';
    ed.addEventListener('click', () => fillForm(e));
    const pe = el('button', 'btn btn-secondary btn-sm', 'Peserta'); pe.type = 'button';
    pe.addEventListener('click', () => showRegistrants(e, d));
    row.append(ed, pe);
  }
  d.append(sm, info, row);
  return d;
}

function action(text, cls, fn) {
  const b = el('button', `btn ${cls} btn-sm`, text); b.type = 'button';
  b.addEventListener('click', async () => {
    b.disabled = true;
    const r = await fn();
    b.disabled = false;
    showToast(r.message || 'Gagal memproses.', r.success ? 'success' : 'error');
    refresh();
  });
  return b;
}

async function loadMine() {
  const s = getSession(); if (!s) return;
  const box = $('myEventsList'), res = await apiMyRegistrations(s.token);
  box.replaceChildren();
  if (!res.success || !res.items.length) { box.append(el('p', 'dash-text-sm', 'Belum ada pendaftaran kegiatan.')); return; }
  res.items.forEach(i => box.append(el('p', 'dash-text-sm', `${i.status === 'Terdaftar' ? '✅' : '✖️'} ${i.judul} · ${fmt(i.tanggal)} · ${i.status}`)));
}

async function showRegistrants(e, card) {
  const res = await apiAdminRegistrants(getSession().token, e.id);
  card.querySelector('.regs')?.remove();
  const box = el('div', 'regs admin-info');
  if (!res.success) box.append(el('p', '', res.message || 'Gagal memuat peserta.'));
  else if (!res.items.length) box.append(el('p', '', 'Belum ada peserta.'));
  else res.items.forEach(p => box.append(el('p', '', `${p.nama} · ${p.email || '-'} · ${p.telepon || '-'}`)));
  card.append(box);
}

function fillForm(e) {
  $('evId').value = e.id; $('evJudul').value = e.judul; $('evKategori').value = e.kategori; $('evTanggal').value = e.tanggal;
  $('evLokasi').value = e.lokasi; $('evKuota').value = e.kuota; $('evStatus').value = e.status; $('evDeskripsi').value = e.deskripsi;
  document.querySelector('.nav-link[data-target="adminSection"]').click();
  $('evJudul').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function resetForm() { ['evId', 'evJudul', 'evKategori', 'evTanggal', 'evLokasi', 'evKuota', 'evDeskripsi'].forEach(i => $(i).value = ''); $('evStatus').value = 'Dibuka'; }

async function saveEvent() {
  const s = getSession(); if (!s) return;
  const ev = { id: $('evId').value, judul: $('evJudul').value, kategori: $('evKategori').value, tanggal: $('evTanggal').value,
    lokasi: $('evLokasi').value, kuota: $('evKuota').value, status: $('evStatus').value, deskripsi: $('evDeskripsi').value };
  $('evSave').disabled = true;
  const res = await apiAdminSaveEvent(s.token, ev);
  $('evSave').disabled = false;
  showToast(res.success ? 'Kegiatan tersimpan.' : (res.message || 'Gagal menyimpan.'), res.success ? 'success' : 'error');
  if (res.success) { resetForm(); refresh(); }
}
