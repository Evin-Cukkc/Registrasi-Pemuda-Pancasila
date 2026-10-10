/** Backend Portal Anggota PP. Deploy: Web app · Execute as: Me · Access: Anyone.
 *  Password disimpan sebagai hash bergaram; sesi memakai token acak (hanya hash-nya yang disimpan). */
const SHEET_NAME = 'Anggota';
const COLS = ['id','nama','email','password_hash','tanggal_lahir','usia','jenis_kelamin','telepon','kode_pos','alamat','kota','hobi','foto','status','role','token_hash','token_exp','dibuat'];
const TTL = 7 * 24 * 3600 * 1000;
const MAX_GAGAL = 5, KUNCI_DETIK = 900, MAX_DAFTAR_PER_JAM = 30; // pembatasan login & pendaftaran
// Aturan status: akun baru langsung 'Aktif'. Untuk alur persetujuan admin, ubah STATUS_AWAL menjadi 'Menunggu'.
const STATUS_AWAL = 'Aktif';
const STATUS_BOLEH_MASUK = ['Aktif']; // status lain (Menunggu, Nonaktif, Ditolak) tidak bisa login

function doGet() { return out({ success: true, message: 'API aktif' }); }
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    if (e.postData.contents.length > 150000) return out(fail('Permintaan terlalu besar.'));
    const req = JSON.parse(e.postData.contents);
    const actions = { register, login, logout, getProfile, updateProfile, adminListMembers, adminUpdateMember, getEvents, registerEvent, cancelEvent, myRegistrations, adminSaveEvent, adminRegistrants, getAnnouncements, adminSaveAnnouncement, adminDeleteAnnouncement };
    return out(actions[req.action] ? actions[req.action](req) : fail('Aksi tidak dikenal.'));
  } catch (err) { return out(fail('Kesalahan server.')); }
  finally { lock.releaseLock(); }
}

const out = o => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
const fail = (message, code) => ({ success: false, message, code });
const str = v => String(v == null ? '' : v).trim();
const sha = t => Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, t, Utilities.Charset.UTF_8));
// Tulis sebagai teks biasa agar isi yang diawali = + - @ tidak dijalankan sebagai rumus Sheets
const plain = range => range.setNumberFormat('@');
const photo = f => (typeof f === 'string' && f.length <= 45000 && /^data:image\/(jpeg|png);base64,/.test(f)) ? f : '';

function buatSheetBaru(ss) {
  const s = ss.insertSheet(SHEET_NAME);
  s.getRange(1, 1, 1, COLS.length).setValues([COLS]).setBackground('#8D1723').setFontColor('#FFFFFF')
    .setFontWeight('bold').setHorizontalAlignment('center');
  s.getRange(2, 1, s.getMaxRows() - 1, COLS.length).setNumberFormat('@'); // jaga angka 0 di depan nomor HP
  s.setFrozenRows(1);
  s.setColumnWidths(1, COLS.length, 130);
  return s;
}
function sheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_NAME) || buatSheetBaru(ss);
}
function find(pred) {
  const s = sheet(), v = s.getDataRange().getValues();
  for (let i = 1; i < v.length; i++) {
    const o = {}; COLS.forEach((c, j) => o[c] = v[i][j]);
    if (pred(o)) return { row: i + 1, o, s };
  }
  return null;
}
function pub(o) { // data aman untuk dikirim ke browser
  const r = Object.assign({}, o); delete r.password_hash; delete r.token_hash; delete r.token_exp;
  Object.keys(r).forEach(k => { if (r[k] instanceof Date) r[k] = r[k].toISOString().slice(0, 10); });
  r.hobi = o.hobi ? String(o.hobi).split(', ') : [];
  return r;
}
function authed(token) {
  if (!token) return null;
  const h = sha(String(token));
  return find(o => o.token_hash === h && Number(o.token_exp) > Date.now() && STATUS_BOLEH_MASUK.indexOf(str(o.status)) >= 0);
}

function register({ data: d = {} }) {
  const cache = CacheService.getScriptCache(), rn = Number(cache.get('daftar_jam')) || 0;
  if (rn >= MAX_DAFTAR_PER_JAM) return fail('Terlalu banyak pendaftaran saat ini. Coba lagi nanti.', 'BUSY');
  const email = str(d.email).toLowerCase(), nama = str(d.nama), pw = String(d.password || '');
  if (nama.length < 3 || !/^\S+@\S+\.\S+$/.test(email)) return fail('Nama atau email tidak valid.');
  if (pw.length < 8) return fail('Kata sandi minimal 8 karakter.');
  if (!/^08\d{8,11}$/.test(str(d.telepon))) return fail('Nomor HP tidak valid.');
  if (find(o => str(o.email).toLowerCase() === email)) return fail('Email ini sudah terdaftar.');
  const salt = Utilities.getUuid();
  const rec = { id: 'PP-' + Utilities.getUuid().slice(0, 8).toUpperCase(), nama, email,
    password_hash: salt + '$' + sha(salt + pw), tanggal_lahir: str(d.tanggal_lahir), usia: Number(d.usia) || '',
    jenis_kelamin: str(d.jenis_kelamin), telepon: str(d.telepon), kode_pos: str(d.kode_pos), alamat: str(d.alamat),
    kota: str(d.kota), hobi: Array.isArray(d.hobi) ? d.hobi.join(', ') : '', foto: photo(d.foto),
    status: STATUS_AWAL, role: 'anggota', token_hash: '', token_exp: '', dibuat: new Date().toISOString() };
  const s = sheet();
  plain(s.getRange(s.getLastRow() + 1, 1, 1, COLS.length)).setValues([COLS.map(c => rec[c])]);
  cache.put('daftar_jam', String(rn + 1), 3600);
  return { success: true, member: pub(rec) };
}

function login({ email, password }) {
  const cache = CacheService.getScriptCache(), key = 'gagal_' + sha(str(email).toLowerCase()).slice(0, 32);
  const n = Number(cache.get(key)) || 0;
  if (n >= MAX_GAGAL) return fail('Terlalu banyak percobaan masuk. Coba lagi dalam 15 menit.', 'LOCKED');
  const m = find(o => str(o.email).toLowerCase() === str(email).toLowerCase());
  const [salt, hash] = m ? String(m.o.password_hash).split('$') : [];
  if (!m || !hash || sha(salt + String(password || '')) !== hash) {
    cache.put(key, String(n + 1), KUNCI_DETIK);
    return fail('Email atau kata sandi tidak cocok.');
  }
  cache.remove(key);
  if (STATUS_BOLEH_MASUK.indexOf(str(m.o.status)) < 0) return fail('Akun Anda belum aktif atau dinonaktifkan. Hubungi pengurus.', 'INACTIVE');
  const token = Utilities.getUuid() + Utilities.getUuid();
  m.s.getRange(m.row, COLS.indexOf('token_hash') + 1, 1, 2).setValues([[sha(token), Date.now() + TTL]]);
  return { success: true, token, member: pub(m.o) };
}

function logout({ token }) { // cabut token di server
  const m = authed(token);
  if (m) m.s.getRange(m.row, COLS.indexOf('token_hash') + 1, 1, 2).setValues([['', '']]);
  return { success: true };
}

function getProfile({ token }) {
  const m = authed(token);
  return m ? { success: true, member: pub(m.o) } : fail('Sesi berakhir. Silakan masuk kembali.', 'UNAUTHORIZED');
}

function updateProfile({ token, data: d = {} }) {
  const m = authed(token);
  if (!m) return fail('Sesi berakhir. Silakan masuk kembali.', 'UNAUTHORIZED');
  if (!/^08\d{8,11}$/.test(str(d.telepon)) || !str(d.kota) || str(d.alamat).length < 10) return fail('Data profil tidak valid.');
  const set = { telepon: str(d.telepon), kota: str(d.kota), alamat: str(d.alamat) }; // hanya kolom ini yang boleh diubah
  if (d.foto) { set.foto = photo(d.foto); if (!set.foto) return fail('Foto tidak valid atau terlalu besar.'); }
  Object.keys(set).forEach(k => plain(m.s.getRange(m.row, COLS.indexOf(k) + 1)).setValue(set[k]));
  SpreadsheetApp.flush();
  return { success: true, member: pub(find(o => o.id === m.o.id).o) };
}

/** JALANKAN SEKALI jika punya data lama: ganti nama sheet lama menjadi "Anggota_lama" lebih dulu.
 *  Memindahkan anggota lama ke sheet baru dan mengubah kata sandi teks biasa menjadi hash. */
function migrasiDariSheetLama(nama) {
  const lama = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nama || 'Anggota_lama');
  if (!lama) throw new Error("Ganti nama sheet lama menjadi 'Anggota_lama' dulu.");
  const v = lama.getDataRange().getValues(), h = v[0];
  const ada = new Set(sheet().getDataRange().getValues().slice(1).map(r => String(r[COLS.indexOf('email')]).toLowerCase()));
  const rows = v.slice(1).filter(r => r[h.indexOf('email')] && !ada.has(String(r[h.indexOf('email')]).toLowerCase())).map(r => {
    const g = k => r[h.indexOf(k)];
    let hobi = g('hobi'); try { hobi = JSON.parse(hobi).join(', '); } catch (e) {}
    let tel = String(g('telepon') || ''); if (tel && tel[0] !== '0') tel = '0' + tel;
    const tgl = g('tanggal_lahir'), salt = Utilities.getUuid();
    const rec = { id: g('id'), nama: g('nama'), email: String(g('email')).toLowerCase(),
      password_hash: salt + '$' + sha(salt + String(g('password'))),
      tanggal_lahir: tgl instanceof Date ? Utilities.formatDate(tgl, 'GMT+7', 'yyyy-MM-dd') : tgl,
      usia: g('usia'), jenis_kelamin: g('jenis_kelamin'), telepon: tel, kode_pos: String(g('kode_pos')),
      alamat: g('alamat'), kota: g('kota'), hobi: hobi, foto: String(g('foto')).length <= 45000 ? g('foto') : '',
      status: g('status') || STATUS_AWAL, role: 'anggota', token_hash: '', token_exp: '', dibuat: String(g('tanggal_daftar')) };
    return COLS.map(c => rec[c]);
  });
  const s = sheet();
  if (rows.length) plain(s.getRange(s.getLastRow() + 1, 1, rows.length, COLS.length)).setValues(rows);
}

/** Jalankan sekali jika ada akun berstatus 'Terdaftar' dari versi sebelumnya agar bisa login. */
function aktifkanAnggotaTerdaftar() {
  const s = sheet(), v = s.getDataRange().getValues(), c = COLS.indexOf('status');
  for (let i = 1; i < v.length; i++) if (v[i][c] === 'Terdaftar') s.getRange(i + 1, c + 1).setValue('Aktif');
}

/** SATU KLIK: siapkan database. Aman: tidak pernah menghapus data.
 *  - Sheet 'Anggota' sudah sesuai  -> tidak ada yang diubah.
 *  - Sheet 'Anggota' format lama   -> diganti nama jadi 'Anggota_lama', dibuat sheet baru, data dimigrasi.
 *  - Belum ada sheet               -> dibuat sheet baru yang kosong.
 *  Aman dijalankan berulang (anggota yang sudah ada dilewati). Buat salinan spreadsheet dulu. */
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ada = ss.getSheetByName(SHEET_NAME);
  let lama = null;
  if (ada) {
    const h = ada.getRange(1, 1, 1, Math.max(ada.getLastColumn(), 1)).getValues()[0];
    if (h.slice(0, COLS.length).join(',') === COLS.join(',')) { ss.toast('Sheet Anggota sudah sesuai.'); return; }
    lama = ss.getSheetByName('Anggota_lama') ? 'Anggota_lama_' + Date.now() : 'Anggota_lama';
    ada.setName(lama);
  } else if (ss.getSheetByName('Anggota_lama')) {
    lama = 'Anggota_lama';
  }
  buatSheetBaru(ss);
  if (lama) migrasiDariSheetLama(lama);
  ss.toast(lama ? "Database baru siap. Data lama ada di sheet '" + lama + "'." : 'Database baru siap.');
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Portal PP').addItem('Siapkan / perbaiki database', 'setupDatabase').addToUi();
}

// ===== ADMIN: peran diperiksa di server dari kolom 'role' (diisi manual di sheet) =====
const STATUS_VALID = ['Aktif', 'Menunggu', 'Nonaktif', 'Ditolak'];
function admin(token) { const m = authed(token); return m && str(m.o.role) === 'admin' ? m : null; }
const forbidden = () => fail('Akses ditolak. Hanya untuk admin.', 'FORBIDDEN');

function adminListMembers({ token, q, status }) {
  if (!admin(token)) return forbidden();
  const v = sheet().getDataRange().getValues(), needle = str(q).toLowerCase();
  const counts = { total: 0 }, members = [];
  for (let i = 1; i < v.length; i++) {
    const o = {}; COLS.forEach((c, j) => o[c] = v[i][j]);
    counts.total++; counts[o.status] = (counts[o.status] || 0) + 1;
    if (status && o.status !== status) continue;
    if (needle && [o.nama, o.email, o.id].every(x => String(x).toLowerCase().indexOf(needle) < 0)) continue;
    const p = pub(o); delete p.foto; members.push(p);
  }
  return { success: true, members, counts };
}

function adminUpdateMember({ token, memberId, status }) {
  const a = admin(token);
  if (!a) return forbidden();
  if (STATUS_VALID.indexOf(status) < 0) return fail('Status tidak valid.');
  const m = find(o => o.id === str(memberId));
  if (!m) return fail('Anggota tidak ditemukan.');
  if (m.o.id === a.o.id) return fail('Anda tidak dapat mengubah status akun sendiri.');
  m.s.getRange(m.row, COLS.indexOf('status') + 1).setValue(status);
  if (STATUS_BOLEH_MASUK.indexOf(status) < 0) m.s.getRange(m.row, COLS.indexOf('token_hash') + 1, 1, 2).setValues([['', '']]); // putuskan sesi
  SpreadsheetApp.flush();
  return { success: true, member: pub(find(o => o.id === m.o.id).o) };
}

// ===== KEGIATAN =====
// Sheet 'Kegiatan' dan 'PendaftaranKegiatan' dibuat otomatis. Tanggal disimpan sebagai teks 'yyyy-MM-ddTHH:mm' (WIB).
const EV_SHEET = 'Kegiatan', REG_SHEET = 'PendaftaranKegiatan';
const EV_COLS = ['id', 'judul', 'deskripsi', 'kategori', 'tanggal', 'lokasi', 'kuota', 'status', 'dibuat'];
const REG_COLS = ['id_kegiatan', 'id_anggota', 'waktu', 'status'];
const EV_STATUS = ['Dibuka', 'Ditutup', 'Selesai'];
const unauth = () => fail('Sesi berakhir. Silakan masuk kembali.', 'UNAUTHORIZED');
const mulai = t => new Date(str(t) + ':00+07:00').getTime();

function tbl(name, cols) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let s = ss.getSheetByName(name);
  if (!s) { s = ss.insertSheet(name); s.appendRow(cols); s.getRange(2, 1, s.getMaxRows() - 1, cols.length).setNumberFormat('@'); }
  return s;
}
function all(name, cols) {
  return tbl(name, cols).getDataRange().getValues().slice(1).map((r, i) => {
    const o = { _row: i + 2 }; cols.forEach((c, j) => o[c] = r[j]); return o;
  }).filter(o => o[cols[0]] !== '');
}
function evView(e, regs, me) {
  const aktif = regs.filter(r => r.id_kegiatan === e.id && r.status === 'Terdaftar');
  const kuota = Number(e.kuota) || 0, lewat = Date.now() >= mulai(e.tanggal);
  const saya = aktif.some(r => r.id_anggota === me), penuh = kuota > 0 && aktif.length >= kuota;
  return { id: e.id, judul: e.judul, deskripsi: e.deskripsi, kategori: e.kategori, tanggal: str(e.tanggal), lokasi: e.lokasi,
    kuota, status: e.status, terdaftar: aktif.length, saya, penuh, lewat,
    bisaDaftar: e.status === 'Dibuka' && !lewat && !penuh && !saya, bisaBatal: saya && !lewat };
}

function getEvents({ token }) {
  const m = authed(token); if (!m) return unauth();
  const regs = all(REG_SHEET, REG_COLS);
  const events = all(EV_SHEET, EV_COLS).map(e => evView(e, regs, m.o.id)).sort((a, b) =>
    (a.lewat - b.lewat) || (a.lewat ? b.tanggal.localeCompare(a.tanggal) : a.tanggal.localeCompare(b.tanggal)));
  return { success: true, events };
}

function registerEvent({ token, eventId }) {
  const m = authed(token); if (!m) return unauth();
  const e = all(EV_SHEET, EV_COLS).filter(x => x.id === str(eventId))[0];
  if (!e) return fail('Kegiatan tidak ditemukan.');
  const regs = all(REG_SHEET, REG_COLS), v = evView(e, regs, m.o.id);
  if (v.saya) return fail('Anda sudah terdaftar pada kegiatan ini.');
  if (v.lewat || e.status !== 'Dibuka') return fail('Pendaftaran kegiatan ini sudah ditutup.');
  if (v.penuh) return fail('Kuota kegiatan sudah penuh.');
  const now = new Date().toISOString(), s = tbl(REG_SHEET, REG_COLS);
  const old = regs.filter(r => r.id_kegiatan === e.id && r.id_anggota === m.o.id)[0];
  if (old) s.getRange(old._row, 3, 1, 2).setValues([[now, 'Terdaftar']]);
  else s.getRange(s.getLastRow() + 1, 1, 1, 4).setValues([[e.id, m.o.id, now, 'Terdaftar']]);
  SpreadsheetApp.flush();
  return { success: true, message: 'Pendaftaran berhasil.' };
}

function cancelEvent({ token, eventId }) {
  const m = authed(token); if (!m) return unauth();
  const e = all(EV_SHEET, EV_COLS).filter(x => x.id === str(eventId))[0];
  if (!e) return fail('Kegiatan tidak ditemukan.');
  if (Date.now() >= mulai(e.tanggal)) return fail('Kegiatan sudah dimulai, pendaftaran tidak bisa dibatalkan.');
  const r = all(REG_SHEET, REG_COLS).filter(x => x.id_kegiatan === e.id && x.id_anggota === m.o.id && x.status === 'Terdaftar')[0];
  if (!r) return fail('Anda belum terdaftar pada kegiatan ini.');
  tbl(REG_SHEET, REG_COLS).getRange(r._row, 4).setValue('Dibatalkan');
  SpreadsheetApp.flush();
  return { success: true, message: 'Pendaftaran dibatalkan.' };
}

function myRegistrations({ token }) {
  const m = authed(token); if (!m) return unauth();
  const evs = {}; all(EV_SHEET, EV_COLS).forEach(e => evs[e.id] = e);
  const items = all(REG_SHEET, REG_COLS).filter(r => r.id_anggota === m.o.id && evs[r.id_kegiatan])
    .map(r => ({ id: r.id_kegiatan, judul: evs[r.id_kegiatan].judul, tanggal: str(evs[r.id_kegiatan].tanggal), lokasi: evs[r.id_kegiatan].lokasi, status: r.status, waktu: str(r.waktu) }))
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  return { success: true, items };
}

function adminSaveEvent({ token, event: e = {} }) {
  if (!admin(token)) return forbidden();
  const judul = str(e.judul), tanggal = str(e.tanggal), kuota = Math.floor(Number(e.kuota) || 0);
  if (judul.length < 3 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(tanggal) || kuota < 0 || EV_STATUS.indexOf(e.status) < 0)
    return fail('Data kegiatan tidak lengkap atau tidak valid.');
  const rec = { id: str(e.id), judul, deskripsi: str(e.deskripsi).slice(0, 1000), kategori: str(e.kategori) || 'Umum',
    tanggal, lokasi: str(e.lokasi), kuota, status: e.status, dibuat: new Date().toISOString() };
  const s = tbl(EV_SHEET, EV_COLS);
  if (rec.id) {
    const old = all(EV_SHEET, EV_COLS).filter(x => x.id === rec.id)[0];
    if (!old) return fail('Kegiatan tidak ditemukan.');
    rec.dibuat = old.dibuat;
    plain(s.getRange(old._row, 1, 1, EV_COLS.length)).setValues([EV_COLS.map(c => rec[c])]);
  } else {
    rec.id = 'KG-' + Utilities.getUuid().slice(0, 6).toUpperCase();
    plain(s.getRange(s.getLastRow() + 1, 1, 1, EV_COLS.length)).setValues([EV_COLS.map(c => rec[c])]);
  }
  SpreadsheetApp.flush();
  return { success: true, id: rec.id };
}

function adminRegistrants({ token, eventId }) {
  if (!admin(token)) return forbidden();
  const mem = {}; sheet().getDataRange().getValues().slice(1).forEach(r => mem[r[0]] = { nama: r[1], email: r[2], telepon: r[COLS.indexOf('telepon')] });
  const items = all(REG_SHEET, REG_COLS).filter(r => r.id_kegiatan === str(eventId) && r.status === 'Terdaftar')
    .map(r => Object.assign({ id: r.id_anggota, waktu: str(r.waktu) }, mem[r.id_anggota] || { nama: '(anggota dihapus)' }));
  return { success: true, items };
}

// ===== PENGUMUMAN =====
const AN_SHEET = 'Pengumuman', AN_COLS = ['id', 'judul', 'isi', 'dibuat', 'oleh'];

function getAnnouncements({ token }) {
  if (!authed(token)) return unauth();
  const items = all(AN_SHEET, AN_COLS).map(a => ({ id: a.id, judul: a.judul, isi: a.isi, dibuat: str(a.dibuat), oleh: a.oleh }))
    .sort((a, b) => b.dibuat.localeCompare(a.dibuat)).slice(0, 20);
  return { success: true, items };
}

function adminSaveAnnouncement({ token, judul, isi }) {
  const a = admin(token); if (!a) return forbidden();
  judul = str(judul); isi = str(isi).slice(0, 1500);
  if (judul.length < 3 || isi.length < 3) return fail('Judul dan isi pengumuman wajib diisi.');
  const rec = { id: 'PG-' + Utilities.getUuid().slice(0, 6).toUpperCase(), judul, isi, dibuat: new Date().toISOString(), oleh: a.o.nama };
  const s = tbl(AN_SHEET, AN_COLS);
  plain(s.getRange(s.getLastRow() + 1, 1, 1, AN_COLS.length)).setValues([AN_COLS.map(c => rec[c])]);
  return { success: true };
}

function adminDeleteAnnouncement({ token, id }) {
  if (!admin(token)) return forbidden();
  const r = all(AN_SHEET, AN_COLS).filter(x => x.id === str(id))[0];
  if (!r) return fail('Pengumuman tidak ditemukan.');
  tbl(AN_SHEET, AN_COLS).deleteRow(r._row);
  return { success: true };
}
