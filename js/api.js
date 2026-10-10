import { API_CONFIG } from './config.js';
import { getMembersLocal, saveMembersLocal } from './storage.js';

export async function apiLogin(email, password) {
  if (API_CONFIG.MODE_MOCK) {
    const members = getMembersLocal();
    const member = members.find(m => m.email === email && m.password === password);
    if (!member) return { success: false, message: "Email atau kata sandi tidak cocok." };
    return { success: true, member };
  } else {
    try {
      const res = await fetch(API_CONFIG.GAS_ENDPOINT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'login', email, password })
      });
      const data = await res.json();
      return data;
    } catch (err) {
      return { success: false, message: "Gagal terhubung ke server Google Sheets." };
    }
  }
}

export async function apiRegister(memberData) {
  if (API_CONFIG.MODE_MOCK) {
    const members = getMembersLocal();
    if (members.some(m => m.email === memberData.email)) {
      return { success: false, message: "Email ini sudah terdaftar." };
    }
    members.push(memberData);
    saveMembersLocal(members);
    return { success: true, member: memberData };
  } else {
    try {
      const res = await fetch(API_CONFIG.GAS_ENDPOINT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'register', data: memberData })
      });
      const data = await res.json();
      return data;
    } catch (err) {
      return { success: false, message: "Gagal mendaftar ke server Google Sheets." };
    }
  }
}

export async function apiUpdateProfile(memberId, updateFields) {
  if (API_CONFIG.MODE_MOCK) {
    const members = getMembersLocal();
    const idx = members.findIndex(m => m.id === memberId);
    if (idx === -1) return { success: false, message: "Profil tidak ditemukan." };

    members[idx] = { ...members[idx], ...updateFields };
    saveMembersLocal(members);
    return { success: true, member: members[idx] };
  } else {
    try {
      const res = await fetch(API_CONFIG.GAS_ENDPOINT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'updateProfile', memberId, data: updateFields })
      });
      const data = await res.json();
      return data; // Diharapkan mengembalikan { success: true, member: updatedMember } atau pesan sukses
    } catch (err) {
      return { success: false, message: "Gagal memperbarui profil di server." };
    }
  }
}