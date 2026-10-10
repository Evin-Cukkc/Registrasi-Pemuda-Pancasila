import { apiLogin, apiRegister } from './api.js';
import { safeSetStorage, addActivityLog } from './storage.js';
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

export async function processLogin(email, password) {
  const res = await apiLogin(email, password);
  if (res.success && res.member) {
    // Simpan objek sesi lengkap agar tidak error saat pemulihan halaman
    safeSetStorage(SESSION_KEY, JSON.stringify(res.member));
    addActivityLog(res.member.id, "Berhasil masuk ke portal");
  }
  return res;
}