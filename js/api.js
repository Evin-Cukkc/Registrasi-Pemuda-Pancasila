import { API_CONFIG } from './config.js';

// Semua data anggota sekarang hanya lewat server (Google Apps Script).
async function post(action, payload = {}) {
  if (!navigator.onLine) return { success: false, message: 'Anda sedang offline. Sambungkan internet lalu coba lagi.' };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(API_CONFIG.GAS_ENDPOINT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...payload }),
      signal: ctrl.signal
    });
    return await res.json();
  } catch {
    return { success: false, message: 'Tidak dapat terhubung ke server. Periksa koneksi Anda.' };
  } finally { clearTimeout(timer); }
}

export const apiLogin = (email, password) => post('login', { email, password });
export const apiRegister = (data) => post('register', { data });
export const apiLogout = (token) => post('logout', { token });
export const apiGetProfile = (token) => post('getProfile', { token });
export const apiUpdateProfile = (token, data) => post('updateProfile', { token, data });
export const apiAdminList = (token, q, status) => post('adminListMembers', { token, q, status });
export const apiAdminSetStatus = (token, memberId, status) => post('adminUpdateMember', { token, memberId, status });
export const apiGetEvents = (token) => post('getEvents', { token });
export const apiRegisterEvent = (token, eventId) => post('registerEvent', { token, eventId });
export const apiCancelEvent = (token, eventId) => post('cancelEvent', { token, eventId });
export const apiMyRegistrations = (token) => post('myRegistrations', { token });
export const apiAdminSaveEvent = (token, event) => post('adminSaveEvent', { token, event });
export const apiAdminRegistrants = (token, eventId) => post('adminRegistrants', { token, eventId });
export const apiGetAnnouncements = (token) => post('getAnnouncements', { token });
export const apiAdminSaveAnnouncement = (token, judul, isi) => post('adminSaveAnnouncement', { token, judul, isi });
export const apiAdminDeleteAnnouncement = (token, id) => post('adminDeleteAnnouncement', { token, id });
