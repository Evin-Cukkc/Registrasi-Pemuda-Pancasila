import { apiLogin, apiRegister } from './api.js';
import { safeSetStorage, safeGetStorage, addActivityLog } from './storage.js';
import { SESSION_KEY } from './config.js';

export function calculateAge(dateString) {
  if (!dateString) return null;
  const birth = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  if (birth > today) return null;

  let age = today.getFullYear() - birth.getFullYear();
  const passed = today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  if (!passed) age--;
  return age;
}

export function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function processRegister(formData, photoBase64) {
  const password = String(formData.get("password") || "");
  const konfirmasi = String(formData.get("konfirmasi_password") || "");

  // Validasi konfirmasi password
  if (password !== konfirmasi) {
    return { success: false, message: "Konfirmasi kata sandi tidak cocok." };
  }

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const age = calculateAge(formData.get("tanggal_lahir"));

  const memberData = {
    nama: String(formData.get("nama") || "").trim(),
    email,
    password,
    tanggal_lahir: String(formData.get("tanggal_lahir") || ""),
    usia: age,
    jenis_kelamin: String(formData.get("jenis_kelamin") || ""),
    telepon: String(formData.get("telepon") || "").trim(),
    kode_pos: String(formData.get("kode_pos") || "").trim(),
    alamat: String(formData.get("alamat") || "").trim(),
    kota: String(formData.get("kota") || ""),
    hobi: formData.getAll("hobi"),
    foto: photoBase64 || ""
  };

  const res = await apiRegister(memberData);
  return res;
}

export function saveSession(token, member) {
  const { password, ...safe } = member || {};
  safeSetStorage(SESSION_KEY, JSON.stringify({ token, member: safe }));
}

export function getSession() {
  try {
    const s = JSON.parse(safeGetStorage(SESSION_KEY));
    return s && s.token && s.member && s.member.id ? s : null;
  } catch { return null; }
}

// Perkecil foto (maks 256px) agar muat di satu sel Google Sheets (batas 50.000 karakter)
export function resizeImage(file, max = 256) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Gambar tidak valid')); };
    img.src = url;
  });
}

export async function processLogin(email, password) {
  const res = await apiLogin(String(email).trim().toLowerCase(), password);
  if (res.success && res.token && res.member) {
    saveSession(res.token, res.member);
    addActivityLog(res.member.id, "Berhasil masuk ke portal");
    return res;
  }
  return res.success ? { success: false, message: "Respons server tidak lengkap. Periksa deployment Apps Script." } : res;
}
