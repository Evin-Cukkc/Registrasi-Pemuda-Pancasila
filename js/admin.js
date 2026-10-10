import { apiAdminList, apiAdminSetStatus } from './api.js';
import { getSession } from './auth.js';
import { showToast, skeleton } from './ui.js';

const STATUSES = ['Aktif', 'Menunggu', 'Nonaktif', 'Ditolak'];
let bound = false, timer;

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function setupAdmin(member) {
  const isAdmin = member.role === 'admin'; // hanya mengatur tampilan; server memeriksa ulang setiap aksi
  document.getElementById('adminNavBtn').classList.toggle('hidden', !isAdmin);
  if (!isAdmin) return;
  if (!bound) {
    bound = true;
    document.getElementById('adminSearch').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(loadMembers, 350); });
    document.getElementById('adminStatusFilter').addEventListener('change', loadMembers);
  }
  loadMembers();
}

async function loadMembers() {
  const s = getSession(); if (!s) return;
  const box = document.getElementById('adminList');
  skeleton(box);
  const res = await apiAdminList(s.token, document.getElementById('adminSearch').value, document.getElementById('adminStatusFilter').value);
  if (!res.success) { box.replaceChildren(el('p', 'dash-text-sm', res.message || 'Gagal memuat data.')); return; }

  const stats = document.getElementById('adminStats');
  stats.replaceChildren();
  [['Total', res.counts.total], ...STATUSES.map(t => [t, res.counts[t] || 0])].forEach(([k, n]) => {
    const c = el('div', 'dash-card'); c.append(el('strong', '', String(n)), el('span', 'dash-text-sm', k)); stats.append(c);
  });

  box.replaceChildren();
  if (!res.members.length) { box.append(el('p', 'dash-text-sm', 'Tidak ada anggota yang cocok.')); return; }
  res.members.forEach(m => {
    const d = el('details', 'card-item admin-member');
    const sm = el('summary'); sm.append(el('strong', '', m.nama), el('span', 'badge ' + (m.status === 'Aktif' ? 'badge-success' : ''), m.status));
    const info = el('div', 'admin-info');
    [`${m.email} · ${m.id}`, `HP: ${m.telepon || '-'} · ${m.kota || '-'}`, `Alamat: ${m.alamat || '-'}`, `Daftar: ${String(m.dibuat || '-').slice(0, 10)} · Peran: ${m.role || 'anggota'}`]
      .forEach(t => info.append(el('p', '', t)));
    const row = el('div', 'admin-actions'), sel = el('select');
    STATUSES.forEach(t => { const o = el('option', '', t); o.selected = t === m.status; sel.append(o); });
    const btn = el('button', 'btn btn-primary btn-sm', 'Simpan Status'); btn.type = 'button';
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const r = await apiAdminSetStatus(s.token, m.id, sel.value);
      btn.disabled = false;
      showToast(r.success ? `Status ${m.nama} menjadi ${sel.value}.` : (r.message || 'Gagal menyimpan.'), r.success ? 'success' : 'error');
      if (r.success) loadMembers();
    });
    row.append(sel, btn);
    d.append(sm, info, row);
    box.append(d);
  });
}
