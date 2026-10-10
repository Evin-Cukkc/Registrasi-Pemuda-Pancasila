import { apiGetAnnouncements, apiAdminSaveAnnouncement, apiAdminDeleteAnnouncement } from './api.js';
import { getSession } from './auth.js';
import { NOTIF_KEY } from './config.js';
import { safeGetStorage, safeSetStorage } from './storage.js';
import { showToast, el } from './ui.js';

const $ = (id) => document.getElementById(id);
const tgl = (t) => new Date(t).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' });
let items = [], isAdmin = false, bound = false;

export function initAnnouncements(member) {
  isAdmin = member.role === 'admin';
  if (!bound) { bound = true; $('anSave').addEventListener('click', save); }
  refresh();
}

export function markAllRead() {
  if (items[0]) safeSetStorage(NOTIF_KEY, items[0].id);
  $('bellDot').classList.add('hidden');
}

async function refresh() {
  const s = getSession(); if (!s) return;
  const res = await apiGetAnnouncements(s.token);
  const home = $('homeAnnouncements'), list = $('notifList'), adm = $('adminAnnouncements');
  if (!res.success) { home.replaceChildren(el('p', 'dash-text-sm', res.message || 'Gagal memuat pengumuman.')); return; }
  items = res.items;
  [home, list, adm].forEach(b => b.replaceChildren());
  if (!items.length) { home.append(el('p', 'dash-text-sm', 'Belum ada pengumuman.')); list.append(el('li', '', 'Belum ada pengumuman.')); }
  items.slice(0, 3).forEach(a => {
    const d = el('div', 'ann-item');
    d.append(el('strong', '', a.judul), el('p', '', a.isi), el('small', '', `${tgl(a.dibuat)} · ${a.oleh || 'Pengurus'}`));
    home.append(d);
  });
  items.forEach(a => list.append(el('li', '', `📣 ${a.judul} (${tgl(a.dibuat)})`)));
  $('bellDot').classList.toggle('hidden', !items[0] || safeGetStorage(NOTIF_KEY) === items[0].id);
  if (isAdmin) items.forEach(a => {
    const r = el('div', 'ann-item'), b = el('button', 'btn btn-secondary btn-sm', 'Hapus'); b.type = 'button';
    b.addEventListener('click', async () => {
      if (!confirm('Hapus pengumuman ini?')) return;
      const x = await apiAdminDeleteAnnouncement(s.token, a.id);
      showToast(x.success ? 'Pengumuman dihapus.' : (x.message || 'Gagal menghapus.'), x.success ? 'success' : 'error');
      refresh();
    });
    r.append(el('strong', '', a.judul), el('p', '', tgl(a.dibuat)), b);
    adm.append(r);
  });
}

async function save() {
  const s = getSession(); if (!s) return;
  $('anSave').disabled = true;
  const res = await apiAdminSaveAnnouncement(s.token, $('anJudul').value, $('anIsi').value);
  $('anSave').disabled = false;
  showToast(res.success ? 'Pengumuman diterbitkan.' : (res.message || 'Gagal menerbitkan.'), res.success ? 'success' : 'error');
  if (res.success) { $('anJudul').value = ''; $('anIsi').value = ''; refresh(); }
}
